var assert = require('assert');
var async = require('async');

var mage = require('../../mage');
var users = require('./users');

var logger = mage.core.logger.context('ident');

/**
 * EntryPoint is a class holding information about an engine, including the instance itself.
 *
 * @param {string} engineName
 * @param {Object} cfg
 * @constructor
 */

function EntryPoint(engineName, cfg) {
	assert(engineName, 'No engine name provided');
	assert(cfg, 'No configuration provided for engine: ' + engineName);

	this.engineCfg = cfg.config || {};
	this.driver = require('./engines/' + cfg.type);
	this.type = cfg.type;
	this.engineName = engineName;
	this.engine = undefined;   // run setup(cb) to instantiate engine itself
	this.post = [];
}


EntryPoint.prototype.setup = function (cb) {
	var that = this;

	function callback(error, engine) {
		if (error) {
			return cb(error);
		}

		that.engine = engine;

		cb();
	}

	try {
		this.driver.setup(
			this.engineName, this.engineCfg, logger.context(this.engineName), callback
		);
	} catch (error) {
		cb(error);
	}
};


// this map contains entry points by engine name
// { engineName: { EntryPoint } }

var entryPoints = {};
var publicEntryPoints = [];  // entry point information that is safe to share in public

/**
 * Setup an engine based on it's config and return an instance in the callback
 *
 * @param {string}   engineName The name for the engine
 * @param {Object}   cfg        The config, must contain the engine type and the engine config
 * @param {Function} cb         A callback that take an error and an engine instance
 */

function setupEngine(engineName, cfg, cb) {
	var entryPoint = new EntryPoint(engineName, cfg);

	entryPoint.setup(function (error) {
		if (error) {
			return cb(error);
		}

		entryPoints[engineName] = entryPoint;

		publicEntryPoints.push({
			engineName: entryPoint.engineName,
			type: entryPoint.type
		});

		cb();
	});
}


/**
 * Setup the ident system, it will instantiate every engine
 *
 * @param {State}    state
 * @param {Function} cb
 */

exports.setup = function (state, cb) {
	var enginesCfg = mage.core.config.get(['module', 'ident', 'engines'], {});

	// auto-inject an anonymous engine, cannot be overridden

	enginesCfg.anonymous = {
		type: 'anonymous',
		config: {
			ephemeral: true
		}
	};

	var engineNames = Object.keys(enginesCfg);

	async.eachSeries(engineNames, function (engineName, cb) {
		// assert that the engine is not anonymous, unless its the built-in one.
		var cfg = enginesCfg[engineName];

		if (!cfg) {
			return cb();
		}

		if (engineName !== 'anonymous' && cfg.type === 'anonymous') {
			var error = 'You are not allowed to configure anonymous ident engines. ' +
				'You may however use the built-in engine named "anonymous".';

			return cb(error);
		}

		setupEngine(engineName, cfg, cb);
	}, function (error) {
		if (error) {
			logger.emergency(error);
			return state.error('ident', null, cb);
		}

		cb();
	});
};


/**
 * Get an entry point
 *
 * @param {string} engineName The engine to target
 * @throws Error              If the entry point is not found or the app is invalid
 * @returns {Object}          The EntryPoint instance
 */

exports.getEntryPoint = function (engineName) {
	assert.ok(engineName, 'noEngineName');
	assert.ok(entryPoints.hasOwnProperty(engineName), 'invalidEngine');

	return entryPoints[engineName];
};


/**
 * Get an engine
 *
 * @param {string} engineName The engine to target
 * @throws Error              If the entry point is not found or the app is invalid
 * @returns {Object}          The Engine instance
 */

exports.getEngine = function (engineName) {
	return exports.getEntryPoint(engineName).engine;
};


/**
 * Gives the list of all engines without exposing too much information
 *
 * @returns {Object[]}
 */

exports.getPublicEngineList = function () {
	return publicEntryPoints;
};


exports.addAuthSources = users.addAuthSources;
exports.ban = users.ban;
exports.unban = users.unban;

exports.register = function (state, engineName, credentials, options, cb) {
	var entryPoint;

	try {
		entryPoint = exports.getEntryPoint(engineName);
	} catch (err) {
		return cb(err);
	}

	entryPoint.engine.auth(state, credentials, function (error, userId, engineKey) {
		if (error) {
			return cb(error);
		}

		var authSources = {};
		authSources[engineName] = engineKey;

		users.create(state, userId, authSources, options, cb);
	});
};



/**
 * @param {State}    state        The current state
 * @param {string}   engineName   The engine we want to query
 * @param {Object}   credentials  Parameters to give to the engine
 * @param {Function} cb           A callback that take an error
 * @returns {*}
 */
exports.login = function (state, engineName, credentials, cb) {
	var entryPoint;

	try {
		entryPoint = exports.getEntryPoint(engineName);
	} catch (err) {
		return cb(err);
	}

	function postLogin(user, engineKey) {
		var meta = {
			acl: user.acl ? user.acl.valueOf() : [],
			user: user
		};

		if (!mage.session) {
			return cb('noSessionModule');
		}

		var userId = user.id;

		var session;

		try {
			session = mage.session.register(state, userId, null, meta);
		} catch (e) {
			return state.error('ident', e, cb);
		}

		// run post login hooks

		logger.debug('Running', entryPoint.post.length, 'post-login hooks.');

		async.eachSeries(
			entryPoint.post,
			function (hook, callback) {
				hook(state, entryPoint.engineName, engineKey, callback);
			},
			function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, session);
			}
		);
	}

	// authenticate on the engine

	entryPoint.engine.auth(state, credentials, function (error, userId, engineKey) {
		if (error) {
			mage.logger.error('Failed to auth: ' + error);
			return cb(error);
		}

		// TODO: check engineKey against user. Maybe they revoked an engine.

		if (entryPoint.engineCfg.ephemeral) {
			var ephemeralUser = { id: userId };
			return postLogin(ephemeralUser, engineKey);
		}

		users.get(state, userId, function (error, tUser) {
			if (error) {
				return cb(error);
			}

			if (tUser.banned) {
				return cb('banned');
			}

			// register a session and store the user information in its meta data

			postLogin(tUser, engineKey);
		});
	});
};


/**
 * Runs fn for each occurence of engineName (or all engines) in the config
 *
 * @param {string|null} engineName
 * @param {Function}    fn
 */

function forEachEntryPoint(engineName, fn) {
	// if no engineName was given, apply this function to all engines

	if (!engineName) {
		return Object.keys(entryPoints).forEach(function (engineName) {
			forEachEntryPoint(engineName, fn);
		});
	}

	var entryPoint = entryPoints[engineName];

	assert.ok(entryPoint, 'Engine "' + engineName + '" is not configured');

	fn(entryPoint);
}


/**
 * Register a post-login hook for a given engineName. The hook function is called only on successful
 * login and is provided with the state, engineName and a callback function.
 *
 * If the hook wants to prevent login, it just needs to provide an error to the callback. If no
 * engine name is provided the hook will be added on every engine.
 *
 * If more than one post-login hook is registered, they are run in the order they were registered
 * and the first hook that fails will prevent the other hooks from being run.
 *
 * For example one may want to add a banned status to the user, that can be done by checking in
 * archivist if the session's actorId is banned, and returning an error if it is the case.
 *
 * @param {string|null} engineName The engine to target (pass null to target all engines)
 * @param {Function}    hook       The hook function
 * @throws Error                   If engineName doesn't exist
 */

exports.registerPostLoginHook = function (engineName, hook) {
	// deal with optionality of engineName

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	assert.equal(typeof hook, 'function', 'The "hook" argument must be a function');

	forEachEntryPoint(engineName, function (entryPoint) {
		entryPoint.post.push(hook);
	});
};

/**
 * Removes a post-login hook from an engine, make sure that you are providing the same function
 * reference.
 *
 * @param {string|null}   engineName The engine to target (pass null to target all engines)
 * @param {Function}      hook       The hook function
 * @throws Error                     If the engineName doesn't exist
 * @return boolean                   False if the hook was not found, true otherwise
 */

exports.unregisterPostLoginHook = function (engineName, hook) {
	// deal with optionality of engineName

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	assert.equal(typeof hook, 'function', 'The "hook" argument must be a function');

	var removed = false;

	forEachEntryPoint(engineName, function (entryPoint) {
		var index = entryPoint.post.indexOf(hook);

		while (index !== -1) {
			entryPoint.post.splice(index, 1);
			removed = true;

			index = entryPoint.post.indexOf(hook);
		}
	});

	// return true if we managed to unregister the hook from at least one spot
	return removed;
};

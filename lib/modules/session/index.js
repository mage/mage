var assert = require('assert');
var semver = require('semver');

var mage = require('../../mage');

var logger = mage.core.logger.context('session');
var config = mage.core.config;
var timeCodeToSec = mage.core.helpers.timeCodeToSec;

// config

var defaultLanguage = 'en';
var ttlCode = config.get(['module', 'session', 'ttl'], '10m');      // session timeout in time-code
var sessionTTL = timeCodeToSec(ttlCode);                            // session timeout in seconds
var keyLength = config.get(['module', 'session', 'keyLength'], 16); // character length of session keys

// exposed config

exports.sessionTTL = sessionTTL;


// warn about dodgy config

if (sessionTTL < 60) {
	logger.warning('Unreasonably low session TTL: ' + ttlCode + ' (' + sessionTTL + ' seconds).');
}


// calculates expiration times

function getNewExpirationTime() {
	// we use the exported sessionTTL since it may have been overridden from the outside (eg. in a unit test)
	return parseInt(Date.now() / 1000, 10) + exports.sessionTTL;
}


// setup will test if archivist is capable

exports.setup = function (state, cb) {
	try {
		mage.core.archivist.assertTopicAbilities('session', ['actorId'], ['set', 'get', 'del', 'touch']);
	} catch (err) {
		return state.error(null, err, cb);
	}

	cb();
};


// version management

/**
 * This function turns '0.1.2' into '0.1.x'
 *
 * @param   {string} version The version to base the range on
 * @returns {string}         The generated range string
 */

function createCompatibilityRange(version) {
	var chunks = version.split('.', 3);

	// replace the patch and trailing build information with 'x'
	chunks[2] = 'x';

	return chunks.join('.');
}

var appVersion = semver.valid(mage.rootPackage.version);
var appVersionRange;

if (appVersion) {
	appVersionRange = createCompatibilityRange(appVersion);
} else {
	logger.alert(
		'Invalid or missing version information in package.json, you should really look into this.',
		'Your package.json version field:', mage.rootPackage.version
	);
}


/**
 * @deprecated
 */

exports.setBadVersionMessage = function () {
	logger.error('Support for session.setBadVersionMessage() has been removed.');
};


function sessionHasSupportedVersion(session) {
	if (!appVersionRange) {
		// this case has already been logged
		return true;
	}

	if (!session.version) {
		logger.error('Missing version information in session');
		return true;
	}

	var sessionVersion = semver.valid(session.version);

	if (!sessionVersion) {
		logger.error('Invalid version information in this session:', session.version);
		return true;
	}

	var isSupported = semver.satisfies(sessionVersion, appVersionRange);

	logger.verbose(
		'Tested session version', sessionVersion, 'against range', appVersionRange,
		'(valid: ' + (isSupported ? 'yes' : 'no') + ')'
	);

	return isSupported;
}


function parseKey(fullKey) {
	assert.equal(typeof fullKey, 'string', 'invalidSessionKey');

	// find the last occurrence of colon, and split actorId and session key there
	var index = fullKey.lastIndexOf(':');

	assert.notEqual(index, -1, 'invalidSessionKey');

	return {
		actorId: fullKey.substring(0, index),
		sessionKey: fullKey.substring(index + 1)
	};
}

function parseAddress(address) {
	var index = address.indexOf('/');
	if (index === -1) {
		return parseKey(address);
	}
	return parseKey(address.substr(index + 1));
}


/**
 * Session class
 *
 * @param {Object} [meta]       Key/value meta data object to store with the session
 * @param {string} actorId      An actor ID to associate with this session
 * @param {string} language     The language of the user
 * @param {string} key          The session key
 * @param {string} clusterId    The clusterId associated with this session (for mmrp)
 * @param {number} creationTime Time Unix timestamp of the creation time of this session
 * @param {string} version      The game version at the time of registration
 * @constructor
 */

function Session(meta, actorId, language, key, clusterId, creationTime, version) {
	this.meta = meta || undefined;
	this.actorId = '' + actorId;
	this.language = language;
	this.key = key;
	this.clusterId = clusterId;
	this.creationTime = creationTime;
	this.version = version;
}


Session.create = function (meta, actorId, language) {
	// create a session key

	var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	var charCount = chars.length;
	var len = keyLength;
	var key = '';

	while (len--) {
		key += chars[~~(Math.random() * charCount)];
	}

	return new Session(
		meta,
		actorId,
		language || defaultLanguage,
		key,
		mage.core.msgServer.getClusterId(),
		parseInt(Date.now() / 1000, 10),
		mage.rootPackage.version
	);
};


Session.fromData = function (data) {
	return new Session(
		data.meta,
		data.actorId,
		data.language,
		data.key,
		data.clusterId,
		data.creationTime,
		data.version
	);
};


Session.prototype.getFullKey = function () {
	if (this.actorId && this.key) {
		return this.actorId + ':' + this.key;
	}

	return false;
};


// database operations

Session.prototype.expire = function (state, reason) {
	state.archivist.del('session', { actorId: this.actorId });
	state.emit(this.actorId, 'session.unset', reason || 'expired');
};

Session.prototype.extend = function (state) {
	state.archivist.touch('session', { actorId: this.actorId }, getNewExpirationTime());
};

Session.prototype.save = function (state) {
	state.archivist.set('session', { actorId: this.actorId }, this, null, null, getNewExpirationTime());
};


Session.prototype.setOnClient = function (state) {
	state.emit(this.actorId, 'session.set', {
		key: this.getFullKey(),
		actorId: this.actorId,
		meta: this.meta
	});
};


// meta-data setters and getters

Session.prototype.getData = function (key) {
	return this.meta[key];
};


Session.prototype.setData = function (state, key, value) {
	if (value === undefined) {
		delete this.meta[key];
	} else {
		this.meta[key] = value;
	}

	this.save(state);
};


Session.prototype.delData = function (state, key) {
	if (this.meta.hasOwnProperty(key)) {
		delete this.meta[key];
	}

	this.save(state);
};


// returns msgServer compatible addresses/hosts for actors

exports.getActorAddresses = function (state, actorIds, cb) {
	var addresses = {};
	var options = { optional: true, mediaTypes: ['application/json'] };

	var topic = 'session';
	var query = [];

	for (var i = 0; i < actorIds.length; i += 1) {
		var index = { actorId: actorIds[i] };
		query.push({ topic: topic, index: index });
	}

	state.archivist.mget(query, options, function (error, results) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < results.length; i += 1) {
			var data = results[i];
			var actorId = actorIds[i];

			if (data && data.key && data.clusterId) {
				addresses[actorId] = {
					actorId: actorId,
					clusterId: data.clusterId,
					addrName: 'sess/' + actorId + ':' + data.key,
					language: data.language
				};
			}
		}

		cb(null, addresses);
	});
};


function getActorSession(state, actorId, cb) {
	// check DB for session

	var options = { optional: true, mediaTypes: ['application/json'] };

	state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data) {
			logger.debug('No session found for actor:', actorId);
			return cb();
		}

		var session = Session.fromData(data);

		logger.debug('Session found for actor:', actorId);

		return cb(null, session);
	});
}


function emitUnset(state, reason) {
	logger.verbose('Unsetting session:', reason);
	state.emit(null, 'session.unset', reason);
}


// resolve(key) returns a session object to the callback for the given key

function resolve(state, key, cb) {
	logger.debug('Resolving session', key);

	var actorId, sessionKey;

	try {
		var parsed = parseKey(key);
		actorId = parsed.actorId;
		sessionKey = parsed.sessionKey;
	} catch (e) {
		emitUnset(state, e.message);
		return cb();
	}

	getActorSession(state, actorId, function (error, session) {
		if (error) {
			return cb(error);
		}

		try {
			assert(session, 'noSession');
			assert.equal(session.key, sessionKey, 'keyMismatch');
			assert(sessionHasSupportedVersion(session), 'badVersion');
		} catch (e) {
			emitUnset(state, e.message);
			return cb();
		}

		logger.debug('Session resolves successfully, pushing expiration time into the future');

		session.extend(state);

		return cb(null, session);
	});
}


function registerSession(state, session) {
	state.registerSession(session);
	session.save(state);
	session.setOnClient(state);
}

exports.register = function (state, actorId, language, meta) {
	// load the language from the actor properties, and create a session object

	var session = Session.create(meta, actorId, language);

	registerSession(state, session);

	return session;
};


exports.getActorSession = getActorSession;
exports.resolve = resolve;
exports.getNewExpirationTime = getNewExpirationTime;


mage.core.cmd.registerMessageHook('mage.session', false, function (state, cfg, batch, cb) {
	// resolve the session

	resolve(state, cfg.key, function (error, session) {
		if (error) {
			return cb(error);
		}

		if (!session) {
			// a session.unset event will have been registered
			return cb();
		}

		state.registerSession(session);

		cb();
	});
});


mage.core.msgServer.msgStream.addAddressType('session', {
	invalidate: function (address, host, reason) {
		var actorId, state;

		try {
			actorId = parseAddress(address).actorId;
		} catch (error) {
			logger.verbose('Error parsing session key:', error);
			return false;
		}

		if (actorId) {
			state = new mage.core.State();
			state.archivist.del('session', { actorId: actorId });
			state.close();
		}

		if (host) {
			host.deliver(['0', '[["session.unset",' + JSON.stringify(reason || 'unknown') + ']]']);
			host.close();
		}

		return true;
	},
	lookup: function (sessionKey, host, cb) {
		var state = new mage.core.State();

		resolve(state, sessionKey, function (error, session) {
			state.close(function (closeError, response) {
				if (error) {
					return host.respondServerError();
				}

				if (!session) {
					// This is a hack to send events to the client even if they don't have a session.
					// We use it to unset the client's session.

					if (response.myEvents && response.myEvents.length > 0) {
						host.deliver(['0', '[' + response.myEvents.join(',') + ']']);
					}

					host.close();
					return;
				}

				var address = 'sess/' + session.getFullKey();
				var clusterId = session.clusterId;

				cb(clusterId, address);
			});
		});
	}
});

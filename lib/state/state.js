var util = require('util');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var mage;
var logger;
var Archivist;

/**
 * Default description if none is set on a state object
 */
var NO_DESCRIPTION = 'no description';

/**
 * State error class
 *
 * @param {*} message
 * @param {*} details
 */
function StateAccessError(message, details) {
	Error.captureStackTrace(this, this.constructor);
	Object.assign(this, details);

	this.message = message;
	this.name = 'StateAccessError';
};

util.inherits(StateAccessError, Error);

/**
 * Utility method to lookup and cache addresses
 * to send messages to given actorIds
 *
 * @param {*} state
 * @param {*} actorIds
 * @param {*} cb
 */
function lookupAddresses(state, actorIds, cb) {
	if (!mage.session) {
		return cb(new Error('Cannot find actors without the "session" module set up.'));
	}

	const now = Date.now();

	// Loook up only the addresses which we are unknown to us,
	// or the ones which are no longer valid
	var lookup = actorIds.filter((actorId) => {
		const address = state.addressesCache[actorId];

		return !address || now - address.time >= state.cacheTimeout;
	});

	mage.session.getActorAddresses(this, lookup, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		for (let i = 0; i < addresses.length; i += 1) {
			const address = addresses[i];
			const actorId = address.actorId;

			state.addressesCache[actorId] = Object.assign(address, {
				exists: true,
				time: now
			});
		}

		for (let i = 0; i < lookup.length; i += 1) {
			const actorId = lookup[i];

			if (state.addressesCache[actorId] === undefined) {
				state.addressesCache[actorId] = {
					exists: false,
					time: now
				};
			}
		}

		return cb(null, state.addressesCache);
	});
};

/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object}   mageInstance           A mage instance.
 * @param {Object}   mageLogger             A mage logger.
 * @param {Function} archivistConstructor   The archivist constructor.
 */
exports.initialize = function (mageInstance, mageLogger, archivistConstructor) {
	mage = mageInstance;
	logger = mageLogger;
	Archivist = archivistConstructor;
};


/**
 * Extract values from an option object and apply them
 * to a state (or use a default value otherwise)
 *
 * @param {*} state
 * @param {*} opts
 * @param {*} key
 * @param {*} defaultValue
 */
function setFromOpts(state, opts, key, defaultValue) {
	var optsVal = opts[key];

	if (optsVal) {
		state[key] = optsVal;
	} else {
		state[key] = defaultValue;
	}
}

/**
 * State class
 *
 * The state library exposes a constructor that constructs objects which form an interface
 * between an actor, a session and the archivist. Virtually any command that involves reading
 * and modification of data should be managed by a state object.
 *
 * When you’re done using the state class, always make sure to clean it up by calling close() on it.
 * MAGE’s module and command center systems that bridge the communication between client
 * and server use the State object for API responses and server-sent events.
 *
 * @param {*} actorId
 * @param {*} session
 * @param {*} opts
 */
function State(actorId, session, opts = {}) {
	this.actorId = actorId ? ('' + actorId) : undefined;
	this.acl = [];

	// Information for command response output:
	this.errorCode = undefined;   // JSON serialized error code to a user command
	this.response = undefined;    // JSON serialized response to a user command
	this.myEvents = [];           // array of JSON serialized events for this session

	this.addressesCache = {};            // { actorId: { actorId, language, addrName, clusterId }, actorId: false }
	this.otherEvents = {};	// events for other actors: { actorId: [ list of events ], actorId: etc... }
	this.broadcastEvents = [];

	// Available in user commands, gives you the name of the appName where the command is running
	setFromOpts(this, opts, 'appName', undefined);
	setFromOpts(this, opts, 'description', undefined);
	setFromOpts(this, opts, 'cacheTimeout', 500);

	// This is used to carry data around through the execution path
	setFromOpts(this, opts, 'data', {});

	// Register session
	this.session = null;

	if (session) {
		this.registerSession(session);
	};

	// Setup archivist
	this.archivist = new Archivist(this);

	exports.emit('created');
}


exports.State = State;

/**
 * Register a session on this state, also updates the access level for that state
 *
 * @param {Object} session A session object as provided by the session module
 */
State.prototype.registerSession = function (session) {
	this.session = session;
	this.actorId = '' + session.actorId;

	var acl = session.getData('acl');

	this.acl = acl ? acl.slice() : [];

	// in development mode, a user can access everything
	if (mage.isDevelopmentMode('adminEverywhere') && this.acl.indexOf('*') === -1) {
		this.acl.unshift('*');
	}
};

/**
 * Unregister the session from this state, also drops the access level for that state
 */
State.prototype.unregisterSession = function () {
	this.session = undefined;
	this.actorId = undefined;
	this.acl = [];
};

/**
 * Checks that the state's access control level list have the same access to the provided acl
 *
 * @param {string[]} acl Check state access against user access control list.
 * @returns {boolean}
 */
State.prototype.canAccess = function (acl) {
	// user with wildcard can access everything
	if (this.acl.indexOf('*') !== -1) {
		return true;
	}

	// exports.acl was probably forgotten on a user command
	if (!acl) {
		logger.error(new Error('No ACL provided'));
		return false;
	}

	// type check
	if (!Array.isArray(acl)) {
		logger.error(new Error('Provided ACL must be an array'));
		return false;
	}

	// no one gets access if the given ACL list is empty
	if (acl.length === 0) {
		return false;
	}

	// wildcard-access means access for everyone
	if (acl.indexOf('*') !== -1) {
		return true;
	}

	// check if this state has any of the required tags
	for (var i = 0; i < this.acl.length; i++) {
		var access = this.acl[i];

		if (acl.indexOf(access) !== -1) {
			return true;
		}
	}

	// no matches means no access
	return false;
};


/**
 * Set the description for this state
 *
 * Used mostly by command center to mark a state as
 * originating from a given user command.
 */
State.prototype.setDescription = function (description) {
	this.description = description;
};


/**
 * Get the description for this state
 */
State.prototype.getDescription = function () {
	return this.description || NO_DESCRIPTION;
};


/**
 * Mark state as closing, and internally save a copy of the stack trace at this point.
 */
State.prototype.setClosingCallStack = function () {
	if (this._closingCallStack) {
		throw new StateAccessError('State is already marked as closing', {
			originallyClosedAt: this.getClosingDetails()
		});
	}

	this._closingCallStack = new Error().stack;
};


/**
 * Retrieve a copy of the stack trace of when the state was set as closing.
 */
State.prototype.getClosingCallStack = function () {
	if (!this._closingCallStack) {
		throw new StateAccessError('Attempted to access closing call stack but call stack is not set');
	}

	return this._closingCallStack.split('\n').map(function (line) {
		return line.substring(7);
	});
};


/**
 * Mark state as closing
 */
State.prototype.setClosing = function () {
	this.closing = true;
	this.setClosingCallStack();
};


/**
 * Retrieve details about where a given state was originally
 * closed
 */
State.prototype.getClosingDetails = function () {
	return {
		description: this.getDescription(),
		stack: this.getClosingCallStack()
	};
};

/**
 * Parse a list of actorIds, and verify who is online
 */
State.prototype.findActors = function (actorIds, cb) {
	lookupAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		var found = { offline: [], online: [] };

		for (var i = 0; i < actorIds.length; i += 1) {
			var actorId = actorIds[i];

			if (addresses[actorId].exists) {
				found.online.push(actorId);
			} else {
				found.offline.push(actorId);
			}
		}

		return cb(null, found);
	});
};


function parseEvents(isError, events) {
	return events
		.filter((entry) => !isError || entry.alwaysEmit)
		.map((entry) => entry.evt);
}


State.prototype.emitEvents = function (isErrorState, cb) {
	if (!mage.core.msgServer) {
		return cb(new Error('Cannot emit events without msgServer set up.'));
	}

	var events;

	// this function emits all events to players who are not state.actorId

	events = parseEvents(isErrorState, this.broadcastEvents);
	this.broadcastEvents = [];

	if (events.length > 0) {
		mage.core.msgServer.broadcast('[' + events.join(',') + ']');
	}

	events = this.otherEvents;
	this.otherEvents = {};

	var actorIds = Object.keys(events);

	if (actorIds.length === 0) {
		return cb();
	}

	lookupAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < actorIds.length; i += 1) {
			var actorId = actorIds[i];
			var entries = parseEvents(isErrorState, events[actorId]);
			var address = addresses[actorId];

			if (entries.length === 0 || address.exists === false) {
				continue;
			}

			mage.core.msgServer.send(address.addrName, address.clusterId, '[' + entries.join(',') + ']');
		}

		return cb();
	});
};


function serializeEvent(path, data, isJson) {
	if (data === undefined) {
		return '["' + path + '"]';
	}

	if (!isJson) {
		data = JSON.stringify(data);
	}

	return '["' + path + '",' + data + ']';
}


State.prototype.broadcast = function (path, data, options) {
	options = options || {};

	var evt = serializeEvent(path, data, options.isJson);
	var entry = { evt: evt, alwaysEmit: options.alwaysEmit };

	this.broadcastEvents.push(entry);
};


function isSelf(state, actorId) {
	if (actorId === null || actorId === undefined || actorId === true) {
		return true;
	}

	if (String(actorId) === state.actorId) {
		return true;
	}

	return false;
}


State.prototype.emit = function (actorIds, path, data, options) {
	if (!path) {
		throw new Error('Missing path or event name');
	}

	if (!Array.isArray(actorIds)) {
		actorIds = [actorIds];
	}

	options = options || {};

	const len = actorIds.length;

	if (len === 0) {
		return;
	}

	var evt = serializeEvent(path, data, options.isJson);
	var entry = { evt: evt, alwaysEmit: options.alwaysEmit };

	for (var i = 0; i < len; i++) {
		if (isSelf(this, actorIds[i])) {
			this.myEvents.push(entry);
			continue;
		}

		// cast actorId to string
		var actorId = String(actorIds[i]);

		if (!this.otherEvents[actorId]) {
			this.otherEvents[actorId] = [];
		}

		this.otherEvents[actorId].push(entry);
	}
};


State.prototype.error = function (code, logMessage, cb) {
	exports.emit('stateError');

	// Extract the error code or message
	if (code instanceof Error) {
		code = code.code || code.message;
	}

	// Invalid codes are logged, but a different value is set to be returned
	if (!code || typeof code === 'object') {
		logger.error('Invalid state error code:', code, '(falling back to "server")');
		code = 'server';
	}

	// Code must be a string
	code = '' + code;

	// Return error code is set on the state
	this.errorCode = JSON.stringify(code);

	// Log the result
	if (logMessage) {
		logger.error
			.data({
				actorId: this.actorId,
				description: this.description
			})
			.log(logMessage);
	}

	if (cb) {
		cb(code);
	}
};


State.prototype.respond = function (response, isJson) {
	this.response = isJson ? response : JSON.stringify(response);
};


/**
 * Distribute all events currently stacked on
 * this state object.
 *
 * If you wish to also distribute archivist mutations stacked
 * on this state, please have a look at the `distribute` method
 * instead.
 *
 * @param {Function} cb callback function
 */
State.prototype.distributeEvents = function (cb) {
	if (this.actorId) {
		this.otherEvents[this.actorId] = this.myEvents.slice();
		this.myEvents.length = 0;
	}

	this.emitEvents(false, cb);
};

/**
 * Distribute both events and archivist operations
 * currently stacked on this state object.
 *
 * @param {Function} cb callback function
 */
State.prototype.distribute = function (cb) {
	this.archivist.distribute((error) => {
		if (error) {
			return cb(error);
		}

		this.distributeEvents(cb);
	});
};


function respond(isErrorState, state, cb) {
	// extract response events
	const myEvents = parseEvents(isErrorState, state.myEvents);

	// create response data
	const response = {
		response: state.response,
		myEvents: myEvents.length ? myEvents : undefined
	};

	// cleanup
	state.destroy();

	// return the response
	if (cb) {
		cb(null, response);
	}
}

function close(isErrorState, state, cb) {
	// Todo: what if state.emitEvents returns an error?
	state.emitEvents(isErrorState, () => respond(isErrorState, state, cb));
}

State.prototype.close = function (cb) {
	this.setClosing();

	logger.verbose('Closing state:', this.getDescription());

	// Close without distributing, discard changes
	if (this.errorCode) {
		return close(true, this, cb);
	}

	// Commit changes before closing
	return this.archivist.distribute((error) => close(!!error, this, cb));
};

function destroyProperty(state, name) {
	Object.defineProperty(state, name, {
		get: function () {
			throw new StateAccessError('Tried to access attribute on a closing state', {
				property: name,
				originallyClosedAt: state.getClosingDetails()
			});
		},
		set: function () {
			throw new StateAccessError('Tried to set attribute on a closing state', {
				property: name,
				originallyClosedAt: state.getClosingDetails()
			});
		}
	});
}

State.prototype.destroy = function () {
	destroyProperty(this, 'archivist');
	destroyProperty(this, 'errorCode');
	destroyProperty(this, 'response');
	destroyProperty(this, 'myEvents');
	destroyProperty(this, 'otherEvents');
	destroyProperty(this, 'session');

	// For sampler
	exports.emit('destroyed');
};

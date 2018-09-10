'use strict';

var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var mage;
var logger;
var Archivist;

/**
 * Default description if none is set on a state object
 */
var NO_DESCRIPTION = 'no description';

const { BAN_GROUP } = require('../modules/auth');

/**
 * StateError class
 */
class StateError extends Error {
	/**
	 * Constructor
	 *
	 * @param {string} message
	 * @param {object} details
	 */

	constructor(message, details) {
		super(message);
		this.name = 'StateError';
		Object.assign(this, details);
	}
}

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
		return cb(new StateError('Cannot find actors without the "session" module set up.', {
			actorIds: actorIds
		}));
	}

	mage.session.getActorAddresses(state, actorIds, cb);
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
function State(actorId, session, opts) {
	if (!this || this.archivist) {
		throw new Error('`this` context is incorrect, did you forget to use the `new` keyword?');
	}

	opts = opts || {};

	this.actorId = actorId ? ('' + actorId) : undefined;
	this.acl = [];

	// Information for command response output:
	this.errorCode = undefined;   // JSON serialized error code to a user command
	this.response = undefined;    // JSON serialized response to a user command
	this.myEvents = [];           // array of event entries that contain JSON serialized events

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
 * Returns is the user is banned
 */
State.prototype.isBanned = function () {
	return this.acl.includes(BAN_GROUP);
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
		throw new StateError('State is already marked as closing', {
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
		throw new StateError('Attempted to access closing call stack but call stack is not set');
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

			if (addresses[actorId]) {
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
	// Reset the state's events store
	const events = this.otherEvents;
	this.otherEvents = {};

	const broadcastEvents = this.broadcastEvents;
	this.broadcastEvents = [];

	// Extract the list of actorIds we will be sending messages
	// to directly (not by broadcast)
	const actorIds = Object.keys(events);

	// If we have nothing to do at all, return immediately
	if (actorIds.length === 0 && broadcastEvents.length === 0) {
		return cb();
	}

	// We either have messages to broadcast, or messages to send
	// to a number of actorIds; confirm that msgServer is present,
	// or else return an error
	if (!mage.core.msgServer) {
		return cb(new StateError('Cannot emit events without msgServer set up.', {
			events: events,
			broadcastEvents: broadcastEvents
		}));
	}

	// Send all broadcast events
	const parsedBroadcastEvents = parseEvents(isErrorState, broadcastEvents);

	if (parsedBroadcastEvents.length > 0) {
		mage.core.msgServer.broadcast('[' + parsedBroadcastEvents.join(',') + ']');
	}

	// If we have no other messages to send,
	// return early; this is to avoid running
	// additional code that would only delay the return
	if (actorIds.length === 0) {
		return cb();
	}

	lookupAddresses(this, actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < actorIds.length; i += 1) {
			var actorId = actorIds[i];
			var address = addresses[actorId];

			if (!address) {
				continue;
			}

			var entries = parseEvents(isErrorState, events[actorId]);

			if (entries.length === 0) {
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
		const logLevel = logMessage.level || 'error';
		const logEntry = logger[logLevel] || logger.error;

		logEntry
			.data({
				description: this.description,
				actorId: this.actorId
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
		// No response data is sent if we are in an error state
		response: isErrorState ? undefined : state.response,

		// Return the error code if we are in an error state
		errorCode: isErrorState ? state.errorCode : undefined,

		// Return all listed events
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
	state.emitEvents(isErrorState, (error) => {
		if (error) {
			logger.error
				.data(error)
				.data(state.getClosingDetails())
				.details('Events are emitted on a best effort basis; in the case of this error')
				.details('showing up during the execution of a user command, this means that')
				.details('user command may still return successfully, but events won\'t be emitted')
				.log('Failed to emit events to users', error);
		}

		respond(isErrorState, state, cb);
	});
}

State.prototype.close = function (cb) {
	this.setClosing();

	logger.verbose('Closing state:', this.getDescription());

	// Close without distributing, discard changes
	if (this.errorCode) {
		return close(true, this, cb);
	}

	// Commit changes before closing
	// Note: archivist.distribute is expected to be calling
	// `state.error` on its own should an error be returned;
	// therefore, all we should need to care about is whether we
	// are in an error state upon return
	return this.archivist.distribute((error) => close(!!error, this, cb));
};

function destroyProperty(state, name) {
	Object.defineProperty(state, name, {
		get: function () {
			throw new StateError('Tried to access attribute on a closing state', {
				property: name,
				originallyClosedAt: state.getClosingDetails()
			});
		},
		set: function () {
			throw new StateError('Tried to set attribute on a closing state', {
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

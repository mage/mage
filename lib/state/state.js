var util = require('util');
var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();

var mage;
var logger;
var Archivist;

var NO_DESCRIPTION = 'no description';

function StateAccessError(message, details) {
	Error.captureStackTrace(this, this.constructor);
	Object.assign(this, details);

	this.message = message;
	this.name = 'StateAccessError';
};

util.inherits(StateAccessError, Error);

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


function State(actorId, session) {
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId ? ('' + actorId) : undefined;
	this.session = undefined;
	this.acl = [];

	// use registerSession

	if (session) {
		this.registerSession(session);
	}

	// available in user commands, gives you the name of the appName where the command is running

	this.appName = undefined;

	this.data = {};   // may be used to pass data around between functions
	this.description = null;

	this.archivist = new Archivist(this);

	// information for command response output:

	this.errorCode = undefined;   // JSON serialized error code to a user command
	this.response = undefined;    // JSON serialized response to a user command
	this.myEvents = [];           // array of JSON serialized events for this session

	this.addresses = {};            // { actorId: { actorId, language, addrName, clusterId }, actorId: false }
	this.otherEvents = {};	// events for other actors: { actorId: [ list of events ], actorId: etc... }
	this.broadcastEvents = [];

	this.timeout = null;	// timeout
	exports.emit('created');
}


exports.State = State;


State.prototype.setTimeout = function (timeout) {
	this.clearTimeout();

	var that = this;

	this.timeout = setTimeout(function () {
		that.error(null, 'State timed out: ' + that.getDescription(), function () {
			that.close();
		});

		exports.emit('timeOut', timeout);
	}, timeout);
};


State.prototype.clearTimeout = function () {
	if (this.timeout) {
		clearTimeout(this.timeout);
		this.timeout = null;
	}
};

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


State.prototype.setDescription = function (description) {
	this.description = description;
};


State.prototype.getDescription = function () {
	return this.description || NO_DESCRIPTION;
};

/**
 * @summary Mark state as closing, and internally save a copy of the stack trace at this point.
 */
State.prototype.setClosingCallStack = function () {
	if (this._closingCallStack) {
		throw new StateAccessError('State is already marked as closing', {
			description: this.description,
			stack: this._closingCallStack
		});
	}

	this._closingCallStack = new Error().stack;
};

/**
 * @summary Retrieve a copy of the stack trace of when the state was set as closing.
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
 * @summary Mark state as closing
 */
State.prototype.setClosing = function () {
	this.closing = true;
	this.setClosingCallStack();
};

/**
 * @summary Check if the state has been marked as closing.
 */
State.prototype.isClosing = function () {
	return !!this.closing || !!this._closingCallStack;
};

State.prototype.getClosingDetails = function () {
	return {
		description: this.getDescription(),
		stack: this.getClosingCallStack()
	};
};

State.prototype.lookupAddresses = function (actorIds, cb) {
	if (!mage.session) {
		logger.warning('Cannot find actors without the "session" module set up.');
		return cb();
	}

	var lookup = [];
	for (var i = 0; i < actorIds.length; i += 1) {
		var actorId = actorIds[i];

		if (this.addresses[actorId] === undefined) {
			lookup.push(actorId);
		}
	}

	var that = this;

	mage.session.getActorAddresses(this, lookup, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		var actorId, i;

		for (i = 0; i < addresses.length; i += 1) {
			var address = addresses[i];
			actorId = address.actorId;

			that.addresses[actorId] = address;
		}

		for (i = 0; i < lookup.length; i += 1) {
			actorId = lookup[i];

			if (that.addresses[actorId] === undefined) {
				that.addresses[actorId] = false;
			}
		}

		return cb(null, that.addresses);
	});
};


State.prototype.findActors = function (actorIds, cb) {
	this.lookupAddresses(actorIds, function (error, addresses) {
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
	if (!events) {
		return [];
	}

	return events
		.filter((entry) => !isError || entry.alwaysEmit)
		.map((entry) => entry.evt);
}

State.prototype.emitEvents = function (isErrorState, cb) {
	if (!mage.core.msgServer) {
		logger.warning('Cannot emit events without msgServer set up.');
		return cb();
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

	if (events.length === 0) {
		return cb();
	}

	var actorIds = Object.keys(events);

	if (actorIds.length === 0) {
		return cb();
	}

	this.lookupAddresses(actorIds, function (error, addresses) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < actorIds.length; i += 1) {
			var actorId = actorIds[i];
			var entries = parseEvents(isErrorState, events[actorId]);
			var address = addresses[actorId];

			if (entries.length === 0 || !address) {
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

	var sent = {};          // { actorId: true, actorId: true, ... }
	var sentToSelf = false; // indicates whether the event has been sent to the user themselves

	for (var i = 0; i < len; i++) {
		if (isSelf(this, actorIds[i])) {
			if (!sentToSelf) {
				this.myEvents.push(entry);
			}
			sentToSelf = true;
			continue;
		}

		// cast actorId to string
		var actorId = String(actorIds[i]);

		// avoid duplicates
		if (sent[actorId]) {
			continue;
		}

		sent[actorId] = true;

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
	this.otherEvents[this.actorId] = this.myEvents.slice();
	this.myEvents.length = 0;

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
	state.emitEvents(isErrorState, () => respond(isErrorState, state, cb));
}

State.prototype.close = function (cb) {
	if (this.timeout) {
		this.clearTimeout();
		this.timeout = null;
	}

	if (this.isClosing()) {
		throw new StateAccessError('Tried to close an already closing state', {
			originallyClosedAt: this.getClosingDetails()
		});
	}

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

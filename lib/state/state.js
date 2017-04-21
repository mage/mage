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
	this.otherEvents = undefined;	// events for other actors: { actorId: [ list of events ], actorId: etc... }
	this.broadcastEvents = undefined;

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
		this.acl.push('*');
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

	// user with wildcard can access everything
	if (this.acl.indexOf('*') !== -1) {
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
	if (!this._closingCallStack) {
		this._closingCallStack = new Error().stack;
	}
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


State.prototype.emitEvents = function (cb) {
	if (!mage.core.msgServer) {
		logger.warning('Cannot emit events without msgServer set up.');
		return cb();
	}

	var events;

	// this function emits all events to players who are not state.actorId

	events = this.broadcastEvents;

	if (events) {
		this.broadcastEvents = undefined;
		mage.core.msgServer.broadcast('[' + events.join(',') + ']');
	}

	events = this.otherEvents;

	if (!events) {
		return cb();
	}

	this.otherEvents = undefined;

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
			var entries = events[actorId];
			var address = addresses[actorId];

			if (!entries || !address) {
				continue;
			}

			var actorEvents = [];	// what we'll be emitting

			for (var j = 0; j < entries.length; j += 1) {
				var entry = entries[j];

				if (!entry.language || entry.language === address.language) {
					actorEvents.push(entry.evt);
				}
			}

			if (actorEvents.length > 0) {
				mage.core.msgServer.send(address.addrName, address.clusterId, '[' + actorEvents.join(',') + ']');
			}
		}

		return cb();
	});
};


State.prototype.language = function (fallback) {
	return this.session ? this.session.language : (fallback || 'en');
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


State.prototype.broadcast = function (path, data, isJson) {
	var evt = serializeEvent(path, data, isJson);

	if (this.broadcastEvents) {
		this.broadcastEvents.push(evt);
	} else {
		this.broadcastEvents = [evt];
	}
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


State.prototype.emit = function (actorIds, path, data, language, isJson) {
	// language may be omitted
	// if language is provided, it will only emit if the language matches the language used by actorId

	var len;

	if (Array.isArray(actorIds)) {
		len = actorIds.length;
	} else {
		actorIds = [actorIds];
		len = 1;
	}

	if (len === 0) {
		return;
	}

	var evt = serializeEvent(path, data, isJson);
	var sent = {};          // { actorId: true, actorId: true, ... }
	var sentToSelf = false; // indicates whether the event has been sent to the user themselves

	for (var i = 0; i < len; i++) {
		if (isSelf(this, actorIds[i])) {
			if (!sentToSelf) {
				this.myEvents.push(evt);
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

		// language matches will be sorted out when we really emit them

		var entry = { evt: evt, language: language };

		if (!this.otherEvents) {
			this.otherEvents = {};
			this.otherEvents[actorId] = [entry];
		} else {
			if (!this.otherEvents[actorId]) {
				this.otherEvents[actorId] = [entry];
			} else {
				this.otherEvents[actorId].push(entry);
			}
		}
	}
};

// deprecated
State.prototype.emitToActors = State.prototype.emit;


State.prototype.error = function (code, logDetails, cb) {
	exports.emit('stateError');

	if (code === null || code === undefined) {
		code = 'server';
	}

	if (code.code || code.message) {
		// probably an error object, so turn it into a string
		code = code.code || code.message;
	}

	if (typeof code === 'object' || Array.isArray(code)) {
		logger.error('Invalid state error code:', code, '(falling back to "server")');
		code = 'server';
	}

	code = '' + code;

	var channel, args = [];

	var prefix = [];

	if (this.actorId) {
		prefix.push('Actor ' + this.actorId);
	}

	if (this.description) {
		prefix.push(this.description);
	}

	if (prefix.length > 0) {
		args.push('(' + prefix.join(', ') + ')');
	}

	if (logDetails) {
		channel = 'error';
		args.push(logDetails);
	} else {
		channel = 'debug';
		args.push('(error code: ' + JSON.stringify(code) + ')');
	}

	logger[channel].apply(logger, args);

	this.errorCode = JSON.stringify(code);

	if (cb && typeof cb === 'function') {
		cb(code);
	}
};


State.prototype.respond = function (response, isJson) {
	this.response = isJson ? response : JSON.stringify(response);
};


function closeWithError(state, cb) {
	cb(null, {
		errorCode: state.errorCode,
		myEvents: state.myEvents.length ? state.myEvents : undefined
	});
}


function closeWithSuccess(state, cb) {
	state.archivist.distribute(function (error) {
		// archivist errors can only come from the operations before writing anything to a vault,
		// (beforeDistribute hooks, operation validation, etc), so it is still safe to bail out and
		// report an error.

		if (error) {
			return closeWithError(state, cb);
		}

		state.emitEvents(function () {
			// create a response and return it to cb

			cb(null, {
				response: state.response,
				myEvents: state.myEvents.length ? state.myEvents : undefined
			});
		});
	});
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

	var fn;
	var that = this;

	if (this.errorCode) {
		fn = closeWithError;
	} else {
		fn = closeWithSuccess;
	}

	// do the rollback or commit

	fn.call(null, this, function (error, response) {
		// cleanup

		that.destroy();

		// return the response

		if (cb) {
			cb(null, response);
		}
	});
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

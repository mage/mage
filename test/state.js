'use strict';

const assert = require('assert');
const loggingService = require('lib/loggingService');
const mod = require('lib/state/state.js');

const State = mod.State;

let isDevelopmentMode = false;

function FakeArchivist() {}

FakeArchivist.prototype.distribute = function (cb) {
	cb();
};

function actorToAddress(actorId) {
	if (actorId.indexOf('offline') !== -1) {
		return;
	}

	return {
		actorId: actorId,
		language: 'en',
		addrName: 'addr:' + actorId,
		clusterId: 'cluster:' + actorId
	};
}

var fakeMage = {
	isDevelopmentMode: function () {
		return isDevelopmentMode;
	},
	session: {
		getActorAddresses: function (state, actorIds, cb) {
			const response = {};
			for (const actorId of actorIds) {
				response[actorId] = actorToAddress(actorId);
			}

			cb(null, response);
		}
	},
	core: {
		msgServer: {
			broadcast: function (payload) {
				this.sent.push({ payload: payload });
			},
			send: function (addrName, clusterId, payload) {
				this.sent.push({ addrName: addrName, clusterId: clusterId, payload: payload });
			},
			sent: []
		}
	}
};

describe('State class', function () {
	const logger = loggingService.createLogCreator();

	function createSession(actorId, aclData) {
		return {
			actorId,
			getData: function (key) {
				if (key !== 'acl') {
					throw new Error(`session.getData received unknown key ${key}`);
				}

				return aclData;
			}
		};
	}

	function createStateWithSession(actorId, acl) {
		const session = createSession(actorId, acl);
		const state = new State(null, session);

		return { session, state };
	}

	before(() => mod.initialize(fakeMage, logger, FakeArchivist));

	describe('instanciation', function () {
		it('missing `new` keyword will throw', function () {
			try {
				State(); // eslint-disable-line new-cap
			} catch (error) {
				return assert(error.message, '`this` context is incorrect, did you forget to use the `new` keyword?');
			}

			throw new Error('Did not throw');
		});

		it('missing `new` keyword will throw', function () {
			const mage = {
				core: {
					archivist: {},
					State: State
				}
			};
			try {
				mage.core.State(); // eslint-disable-line new-cap
			} catch (error) {
				return assert(error.message, '`this` context is incorrect, did you forget to use the `new` keyword?');
			}

			throw new Error('Did not throw');
		});
		it('Without arguments', function () {
			const state = new State();

			assert.equal(state.actorId, null);
		});

		it('With actorID as the first argument', function () {
			const actorId = 'kwyjibo';
			const state = new State(actorId);

			assert.equal(state.actorId, actorId);
		});

		it('Options are correctly applied', function () {
			const actorId = 'kwyjibo';
			const appName = 'appName';
			const state = new State(actorId, null, { appName });

			assert.equal(state.appName, appName);
		});
	});

	describe('session register/unregister', function () {
		afterEach(() => isDevelopmentMode = false);

		it('session is set on the state object', function () {
			const state = new State();
			const session = createSession('abc');

			state.registerSession(session);

			assert.deepEqual(state.session, session);
		});

		it('setting the session resets the state\'s actorId', function () {
			const state = new State();
			const actorId = 'abc';
			const session = createSession(actorId);

			state.registerSession(session);

			assert.equal(state.actorId, actorId);
		});

		it('session can be passed as an argument upon instanciating a new state', function () {
			const actorId = 'abc';
			const info = createStateWithSession(actorId);
			const state = info.state;
			const session = info.session;

			assert.deepEqual(state.session, session);
			assert.strictEqual(state.actorId, actorId);
		});

		it('session acl data is copied onto the state', function () {
			const acl = ['abc', 'youandme'];
			const info = createStateWithSession('abc', acl);
			const state = info.state;

			assert.deepEqual(state.acl, acl);
		});

		it('If a session has no ACL, state.acl is an empty array', function () {
			const acl = false;
			const info = createStateWithSession('abc', acl);
			const state = info.state;

			assert.deepEqual(state.acl, []);
		});

		it('Unregistering the session resets related attributes on the state object', function () {
			const acl = ['*', 'abc', 'youandme'];
			const info = createStateWithSession('abc', acl);
			const state = info.state;

			state.unregisterSession();

			assert.equal(state.session, undefined);
			assert.equal(state.actorId, undefined);
			assert.deepEqual(state.acl, []);
		});
	});

	describe('canAccess', function () {
		function testCanAccess(stateAcl, canAccessAcl) {
			const info = createStateWithSession(null, stateAcl);

			return info.state.canAccess(canAccessAcl);
		}

		function assertCanAccess(stateAcl, canAccessAcl, expected) {
			assert.strictEqual(testCanAccess(stateAcl, canAccessAcl), expected);
		}

		it('returns true if the State\'s ACL contains a wildcard (*)', function () {
			assertCanAccess(['*'], undefined, true);
		});

		it('returns false if no ACL definition was passed as argument', function () {
			assertCanAccess(['user'], undefined, false);
		});

		it('returns false if ACL is not an array', function () {
			assertCanAccess(['user'], 'not an array', false);
		});

		it('returns false if the ACL array is empty', function () {
			assertCanAccess(['user'], [], false);
		});

		it('returns true if the ACL contains a wildcard (*)', function () {
			assertCanAccess([], ['*'], true);
		});

		it('returns true if any of the value in the arguments are found in the state ACL', function () {
			assertCanAccess(['admin', 'user', 'whatever'], ['user'], true);
		});

		it('returns false if nothing is matched', function () {
			assertCanAccess(['user'], ['admin'], false);
		});
	});

	describe('description', function () {
		it('default desctiption is returned', function () {
			const info = createStateWithSession();
			assert.equal(info.state.getDescription(), 'no description');
		});

		it('set description is returned', function () {
			const info = createStateWithSession();
			const state = info.state;
			const description = 'oh hai';
			state.setDescription(description);

			assert.equal(state.getDescription(), description);
		});
	});

	describe('emit', function () {
		it('Works correctly with an emtpy array of actorIds', function () {
			const state = new State();

			// Should do nothing; we are returning early, and shouldn't be
			// looking or processing any of the other arguments
			state.emit([], 'does.not.matter');
		});

		it('Undefined event name throws', function () {
			const state = new State();
			assert.throws(() => state.emit('test'));
		});

		it('Undefined data is not part of the serialized message', function () {
			const state = new State();
			state.emit('test', 'eventName');

			assert.deepEqual(state.otherEvents.test, [{
				evt: '["eventName"]',
				alwaysEmit: undefined
			}]);
		});

		it('Setting isJson to true disables serialization', function () {
			const state = new State();
			const actualData = 'not really json but oh well';
			state.emit('test', 'eventName', actualData, { isJson: true });

			assert.deepEqual(state.otherEvents.test, [{
				evt: `["eventName",${actualData}]`,
				alwaysEmit: undefined
			}]);
		});
	});

	describe('emitEvents', function () {
		const originalMsgServer = fakeMage.core.msgServer;
		const originalSessionModule = fakeMage.session;

		afterEach(() => fakeMage.core.msgServer = originalMsgServer);
		afterEach(() => fakeMage.session = originalSessionModule);

		it('returns an error if mage.core.msgServer is not set', function (done) {
			const state = new State();

			fakeMage.core.msgServer = undefined;

			state.emit('actor-id', 'eventName', 'data');
			state.emitEvents(null, (error) => {
				assert(error);
				assert.equal(error.message, 'Cannot emit events without msgServer set up.');
				done();
			});
		});

		it('returns no errors if mage.core.msgServer is not set and no events need to be emitted', function (done) {
			const state = new State();

			fakeMage.core.msgServer = undefined;
			state.emitEvents(null, (error) => {
				assert.equal(error, undefined);
				done();
			});
		});

		it('Returns an error if the session module is not set', function (done) {
			const state = new State();

			fakeMage.session = undefined;

			// Make sure one event is in our queue to force session lookup
			state.emit('does-not-matter', 'test', 'one');

			state.emitEvents(null, (error) => {
				assert(error);
				assert.equal(error.message, 'Cannot find actors without the "session" module set up.');
				done();
			});
		});

		it('Addresses not found during lookup are skipped silently', function (done) {
			const state = new State();

			fakeMage.session = {
				// Nothing is found by the session module!
				getActorAddresses: (state, lookup, cb) => cb(null, [])
			};

			// Make sure one event is in our queue to force session lookup
			state.emit('does-not-matter', 'test', 'one');
			state.emitEvents(null, done);
		});

		it('Do not call lookupAddresses if we only broadcast (no emits)', function (done) {
			// This is meant to be an optimization, so to avoid running additional
			// code on an empty list of actor IDs and messages
			const state = new State();

			// lookupAddresses would be called if we have emitted events
			fakeMage.session = {
				getActorAddresses: () => { throw new Error('lookupAddresses was called'); }
			};

			// However, broadcast should be called
			let called = false;
			fakeMage.core.msgServer = {
				broadcast: () => called = true
			};

			// Make sure one event is in our queue to force session lookup
			state.broadcast('does-not-matter', 'test');
			state.emitEvents(null, () => {
				assert.equal(called, true);
				done();
			});
		});
	});

	describe('closing (call stack, details)', function () {
		const originalMsgServer = fakeMage.core.msgServer;

		afterEach(() => fakeMage.core.msgServer = originalMsgServer);

		it('Calling getClosingDetails before setClosing throws', function () {
			const info = createStateWithSession();

			assert.throws(() => info.state.getClosingDetails());
		});

		it('Calling getClosingDetails after setClosing works', function () {
			const info = createStateWithSession();
			const state  = info.state;

			state.setClosing();

			assert.equal(state.closing, true);

			const details = state.getClosingDetails();

			assert.equal(details.description, state.getDescription());
			assert(details.stack);
		});

		it('Calling setClosing more than once throws an error', function () {
			const info = createStateWithSession();
			const state = info.state;

			state.setClosing();

			assert.throws(() => state.setClosing());
		});

		it('Accessing state attributes after closing throws', function () {
			const info = createStateWithSession();
			const state = info.state;

			state.close();

			assert.throws(() => state.errorCode);
		});

		it('Setting state attributes after closing throws', function () {
			const info = createStateWithSession();
			const state = info.state;

			state.close();

			assert.throws(() => state.errorCode = 'this will die');
		});

		it('emitEvents errors on close are logged and then ignored', function (done) {
			// We simulate a case where the msgServer is not present;
			// we should still receive our data back, and no errors should be triggered.
			fakeMage.core.msgServer = null;

			const info = createStateWithSession();
			const state = info.state;

			// In this error case, we expect `state.getClosingDetails` to be
			// called, and its result to be passed on to the logger. We
			// verify this by confirming this method was called.

			let called = false;
			state.getClosingDetails = () => called = true;

			// Emit some data, to make sure we go far enough into emitEvents
			// to trigger an error
			state.emit('test', 'test', 'test');

			state.close(() => {
				assert.equal(called, true);
				done();
			});
		});
	});

	describe('distribute/distributeEvents', function () {
		const actorId = 'it-is-me-mario';

		let state;
		beforeEach(() => state = new State(actorId));

		it('distributeEvents works correctly when no actorId is set', function (done) {
			state = new State(); // No actor id
			state.emit('random', 'first', '123');

			state.emitEvents = function (events, callback) {
				assert.deepEqual(state.myEvents, []);
				assert.deepEqual(state.otherEvents, {
					random: [{
						evt: '["first","123"]',
						alwaysEmit: undefined
					}]
				});

				callback();
			};

			state.distributeEvents(done);
		});

		it('distributeEvents reallocates my events to other events, and emits them through msgStream', function (done) {
			state.emit('random', 'first', '123');
			state.emit(actorId, 'second', '456');

			state.emitEvents = function (events, callback) {
				assert.deepEqual(state.myEvents, []);
				assert.deepEqual(state.otherEvents, {
					random: [{
						evt: '["first","123"]',
						alwaysEmit: undefined
					}],
					[actorId]: [{
						evt: '["second","456"]',
						alwaysEmit: undefined
					}]
				});

				callback();
			};

			state.distributeEvents(done);
		});

		it('distribute will not distribute events if archivist fails to commit changes', function () {
			const message = 'bai bai!';
			const error = new Error(message);

			state.archivist.distribute = (callback) => callback(error);
			state.distributeEvents = () => { throw new Error('distributeEvents was called'); };

			state.distribute(function (returnedError) {
				assert.equal(returnedError.message, message);
			});
		});

		it('distribute will distribute events if archivist succeeds to commit changes', function (done) {
			state.archivist.distribute = (callback) => callback();
			state.distributeEvents = done();
			state.distribute();
		});
	});

	describe('error', function () {
		let state;
		beforeEach(() => state = new State());

		it('Error code is extracted if code is an error with a code attribute', function () {
			const error = new Error('Whoops');
			const code = 'yay';
			error.code = code;

			state.error(error);

			assert.equal(state.errorCode, `"${code}"`);
		});

		it('Error message is extracted if code is an error without a code attribute', function () {
			const error = new Error('Whoops');
			state.error(error);
			assert.equal(state.errorCode, `"${error.message}"`);
		});

		it('"server" is returned instead of objects and arrays', function () {
			state.error({});
			assert.equal(state.errorCode, '"server"');
		});

		it('code values are stringified', function () {
			state.error(1);
			assert.equal(state.errorCode, '"1"');
		});

		it('optional callback is called', function (done) {
			const code = 'yay';

			state.error(code, 'details', function () {
				assert.equal(state.errorCode, `"${code}"`);
				done();
			});
		});

		it('Error code is returned on close', function (done) {
			const error = new Error('Whoops');
			state.error(error);
			state.close((_, response) => {
				assert.deepEqual(response, {
					response: undefined,
					errorCode: `"${error.message}"`,
					myEvents: undefined
				});

				done();
			});
		});
	});

	describe('respond', function () {
		let state;
		beforeEach(() => state = new State());

		it('Data is stringified by default', function () {
			state.respond({ hello: 'world' });
			assert.equal(state.response, '{"hello":"world"}');
		});

		it('Data is not stringified if the second argument is set to true', function () {
			const data = 'this is a raw string';

			state.respond(data, true);
			assert.equal(state.response, data);
		});

		it('Response data is returned on close', function (done) {
			state.respond({ hello: 'world' });
			state.close((error, response) => {
				assert.deepEqual(response, {
					response: '{"hello":"world"}',
					errorCode: undefined,
					myEvents: undefined
				});

				done();
			});
		});
	});

	describe('close (and return data)', function () {
		it('Should bookkeep events', function (done) {
			var state = new State('abc');

			state.emit(null, 'test.1', { hello: 'world' });    // to self
			state.emit('abc', 'test.2', { goodbye: 'world' }); // to self
			state.emit('def', 'test.3', { three: 3 });         // to other user
			state.emit(['def', 'ghi'], 'test.4', { four: 4 }); // to other users
			state.emit('jkl', 'test.7', { seven: 7 });         // to other user

			state.close(function (error, output) {
				assert.ifError(error);

				assert.deepEqual(output.myEvents, [
					'["test.1",{"hello":"world"}]',
					'["test.2",{"goodbye":"world"}]'
				]);

				assert.deepEqual(fakeMage.core.msgServer.sent, [
					{
						addrName: 'addr:def',
						clusterId: 'cluster:def',
						payload: '[["test.3",{"three":3}],["test.4",{"four":4}]]'
					},
					{
						addrName: 'addr:ghi',
						clusterId: 'cluster:ghi',
						payload: '[["test.4",{"four":4}]]'
					},
					{
						addrName: 'addr:jkl',
						clusterId: 'cluster:jkl',
						payload: '[["test.7",{"seven":7}]]'
					}
				]);

				done();
			});
		});

		it('When alwaysEmit is set to true, emit/broadcast even when an error occurs', function (done) {
			var state = new State('stroganoff');
			var emit = { alwaysEmit: true };

			// Clear the queue of sent messages
			fakeMage.core.msgServer.sent = [];

			state.emit(null, 'test.1', { hello: 'world' }); // Should not be emitted
			state.emit(null, 'test.2', { goodbye: 'world' }, emit);
			state.emit('shanata', 'test.3', { three: 3 });  // Should not be emitted
			state.emit('shanata', 'test.4', { four: 4 }, emit);
			state.broadcast('never.emit', { hola: 5 });  // Should not be emitted
			state.broadcast('always.emit', { ohayou: 6 }, emit);

			state.errorCode = 'brokendit';

			state.close(function (error, output) {
				assert.ifError(error);

				assert.deepEqual(output.myEvents, [
					'["test.2",{"goodbye":"world"}]'
				]);

				assert.deepEqual(fakeMage.core.msgServer.sent, [
					{
						payload: '[["always.emit",{"ohayou":6}]]'
					},
					{
						addrName: 'addr:shanata',
						clusterId: 'cluster:shanata',
						payload: '[["test.4",{"four":4}]]'
					}
				]);

				done();
			});
		});
	});

	describe('findActors', function () {
		const originalSessionModule = fakeMage.session;

		afterEach(() => fakeMage.session = originalSessionModule);

		it('Returns an error if the session module is not set', function (done) {
			fakeMage.session = undefined;
			const state = new State();
			state.findActors([], (error) => {
				assert(error);
				assert.equal(error.message, 'Cannot find actors without the "session" module set up.');
				done();
			});
		});

		it('Returns an error if mage.session.getActorAddresses returns an error', function (done) {
			const message = 'whoops I did it again - I played with mage.session module';
			const error = new Error(message);

			fakeMage.session = {
				getActorAddresses: (state, lookup, cb) => cb(error)
			};

			const state = new State();
			state.findActors([], (error) => {
				assert(error);
				assert.equal(error.message, message);
				done();
			});
		});

		it('Should find actors', function (done) {
			var state = new State('abc');
			state.findActors(['def', 'foo', 'offline', 'bar'], function (error, found) {
				assert.ifError(error);

				assert.deepEqual(found, {
					online: ['def', 'foo', 'bar'],
					offline: ['offline']
				});

				done();
			});
		});
	});
});

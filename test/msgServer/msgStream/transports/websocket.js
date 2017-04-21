var websocket = require('lib/msgServer/msgStream/transports/websocket');
var logging = require('lib/loggingService');
var assert = require('assert');
var WebSocket = require('ws');

describe('websocket', function () {
	before(function () {
		logging.filterContexts('Websocket');
	});

	after(function () {
		logging.filterContexts();
	});

	describe('general', function () {
		it('create', function () {
			websocket.create();
		});

		it('getDisconnectStyle() returns "never"', function () {
			var ws = websocket.create();
			assert.equal(ws.getDisconnectStyle(), 'never');
		});

		it('getAddressInfo() returns ws.address', function () {
			var ws = websocket.create();
			assert.equal(ws.getAddressInfo(), ws.address);
		});
	});

	describe('_safeSend', function () {
		function mock(sendFunc, terminateFunc, closeConnectionFunc) {
			var ws = websocket.create();

			ws.client = {
				send: sendFunc,
				terminate: terminateFunc || function () {}
			};

			ws._closeConnection = closeConnectionFunc || function () {};

			return ws;
		}

		it('Calls this.client.send with the data passed as a parameter', function () {
			var sent = 'garbage';
			var received = null;

			var ws = mock(function (sent) {
				received = sent;
			});

			ws._safeSend(sent);
			assert.strictEqual(sent, received);
		});

		it('If ws.client.send throws, ws.client.terminate is called', function () {
			var sendTriggered = false;
			var terminateTriggered = false;

			var ws = mock(function () {
				sendTriggered = true;
				throw new Error('something happened');
			}, function () {
				terminateTriggered = true;
			});

			ws._safeSend();
			assert.equal(sendTriggered, true);
			assert.equal(terminateTriggered, true);
		});

		it('If ws.client.send throws, ws._closeConnection is called', function () {
			var closeTriggered = false;

			var ws = mock(function () {
				throw new Error('something happened');
			}, null, function () {
				closeTriggered = true;
			});

			ws._safeSend();
			assert.equal(closeTriggered, true);
		});
	});

	describe('deliver', function () {
		function mock(safeSendFunc) {
			var ws = websocket.create();
			ws._safeSend = safeSendFunc;
			return ws;
		}

		it('If this.client is not set, deliver bails out', function () {
			var ws = mock(function () {
				throw new Error('deliver tried to send messages by calling _safeSend!');
			});

			ws.deliver([0, 'message']);
		});

		it('If the received array of message is empty, deliver bails out', function () {
			var ws = mock(function () {
				throw new Error('deliver tried to send messages by calling _safeSend!');
			});

			ws.client = true;
			ws.deliver([]);
		});

		it('deliver calls _safeSend with a serialized copy of the messages', function (done) {
			var ws = mock(function (data) {
				assert.equal(data, '{"123":hello,"456":world}');
				done();
			});

			ws.client = true;
			ws.deliver([123, 'hello', 456, 'world']);
		});
	});

	describe('respondBadRequest', function () {
		function mock(closeFunc) {
			var ws = websocket.create();
			ws.close = closeFunc || function () {};

			return ws;
		}

		it('If no reason is specified, the reason will be "Bad request" by default', function () {
			var ws = mock(function (code, reason) {
				assert.equal(code, 1008);
				assert.equal(reason, 'Bad request');
			});

			ws.respondBadRequest();
		});

		it('If a reasons is specified, it will be passed to this.close', function () {
			var ws = mock(function (code, reason) {
				assert.equal(code, 1008);
				assert.equal(reason, 'custom reason');
			});

			ws.respondBadRequest('custom reason');
		});
	});

	describe('respondUnsupportedDataRequest', function () {
		function mock(closeFunc) {
			var ws = websocket.create();
			ws.close = closeFunc || function () {};

			return ws;
		}

		it('If no reason is specified, the reason will be "Unsupported data" by default', function () {
			var ws = mock(function (code, reason) {
				assert.equal(code, 1003);
				assert.equal(reason, 'Unsupported');
			});

			ws.respondUnsupportedDataRequest();
		});

		it('If a reasons is specified, it will be passed to this.close', function () {
			var ws = mock(function (code, reason) {
				assert.equal(code, 1003);
				assert.equal(reason, 'custom reason');
			});

			ws.respondUnsupportedDataRequest('custom reason');
		});
	});

	describe('respondServerError', function () {
		function mock(closeFunc) {
			var ws = websocket.create();
			ws.close = closeFunc || function () {};

			return ws;
		}

		it('If no reason is specified, the reason will be "Bad request" by default', function () {
			var ws = mock(function (code, reason) {
				assert.equal(code, 1008);
				assert.equal(reason, 'Bad request');
			});

			ws.respondBadRequest();
		});
	});

	describe('close', function () {
		function mock(clientCloseConnectionFunc, closeConnectionFunc) {
			var ws = websocket.create();
			ws._closeConnection = closeConnectionFunc || function () {};
			ws.client = {
				close: clientCloseConnectionFunc || function () {}
			};

			return ws;
		}

		it('If client is not set, we bail out', function () {
			var ws = mock(function () {
				throw new Error('this.client.close was called');
			}, function () {
				throw new Error('this._closeConnection was called');
			});

			delete ws.client;
			ws.close();
		});

		it('client.close receives the correct error code and error message', function (done) {
			var ws = mock(function (code, reason) {
				assert.equal(code, 123);
				assert.equal(reason, 'you and me');
				done();
			});

			ws.close(123, 'you and me');
		});

		it('_closeConnection gets called', function (done) {
			var ws = mock(null, done);
			ws.respondServerError();
		});
	});

	describe('setConnection', function () {
		// We create a fake WebSocket connection; because
		// the URL obviously points nowhere, an error event
		// is emitted (which we ignore)
		//
		// We need to do this because setConnection
		// verifies whether the client we pass as an
		// argument is an instance of the WebSocket prototype.
		function mockClient(onFunc, onceFunc) {
			var ws = new WebSocket('ws://fake.url');
			ws.on('error', function () {
				// blackhole
			});

			ws.on = onFunc || function () {};
			ws.once = onceFunc || function () {};
			return ws;
		}

		function mockWebsocket(closeConnectionFunc) {
			var ws = websocket.create();
			ws._closeConnection = closeConnectionFunc || function () {};
			return ws;
		}

		it('Throws if a client object is not passed', function () {
			assert.throws(function () {
				var ws = mockWebsocket();
				ws.setConnection();
			});
		});

		it('Throws if the client is not an instance of WebSocket', function () {
			assert.throws(function () {
				var ws = mockWebsocket();
				ws.setConnection({
					something: 'unrelated'
				});
			});
		});

		it('Client is set as an attribute of the object', function () {
			var client = mockClient();
			var ws = mockWebsocket();
			ws.setConnection(client);
			assert.deepStrictEqual(ws.client, client);

			// TODO: confirm this is the desired behaviour
			// assert.strictEqual(ws.address, undefined);
		});

		it('query.sessionKey triggers the address attributes to be set', function () {
			var client = mockClient();
			var ws = mockWebsocket();
			ws.setConnection(client, {
				sessionKey: 'jump around'
			});

			assert.deepStrictEqual(ws.address, {
				type: 'session',
				address: 'jump around'
			});
		});

		it('on message, if the received data is binary, we close the connection', function (done) {
			var client = mockClient(function (eventName, func) {
				if (eventName === 'message') {
					process.nextTick(func.bind(null, new Buffer('some,garbage,data'), { binary: true }));
				}
			});

			var ws = mockWebsocket();
			ws.setConnection(client);
			ws.respondUnsupportedDataRequest = done.bind(null, null);
		});

		it('on message, we emit a confirm event with an array of messages', function (done) {
			var client = mockClient(function (eventName, func) {
				if (eventName === 'message') {
					process.nextTick(func.bind(null, 'some,garbage,data', {}));
				}
			});

			var ws = mockWebsocket();
			ws.setConnection(client);
			ws.on('confirm', function (data) {
				assert.deepStrictEqual(data, [
					'some',
					'garbage',
					'data'
				]);

				done();
			});
		});

		it('on message, if we receive an empty string, nothing is emitted', function () {
			var client = mockClient(function (eventName, func) {
				if (eventName === 'message') {
					process.nextTick(func.bind(null, false, {}));
				}
			});

			var ws = mockWebsocket();
			ws.setConnection(client);
			ws.on('confirm', function (data) {
				throw new Error('Confirmed was called! Received: ' + data.toString());
			});
		});

		it('on error, a warning is logged', function (done) {
			var client = mockClient(function (eventName, func) {
				var funcString = func.toString();
				if (eventName === 'error' && funcString.indexOf('function logWarning') === 0) {
					assert(funcString.match('logger.warning'));
					// we execute it to make sure no code in it
					// triggers an error
					func(new Error('fake error'));
					done();
				}
			});

			var ws = mockWebsocket();
			ws.setConnection(client);
		});

		it('on close, ws._closeConnection is called', function (done) {
			var client = mockClient(null, function (eventName, func) {
				if (eventName === 'close') {
					process.nextTick(func);
				}
			});

			var ws = mockWebsocket(done);
			ws.setConnection(client);
		});
	});

	describe('_closeConnection', function () {
		function mock(removeAllListenersFunc) {
			var ws = websocket.create();
			ws.client = true; // fake client
			ws.removeAllListeners = removeAllListenersFunc || function () {};
			return ws;
		}

		it('if ws.client is not set, we bail out', function () {
			// If close does not bail out, client should be set to null
			var ws = websocket.create();
			ws.client = 0;
			ws._closeConnection();
			assert.strictEqual(ws.client, 0);
		});

		it('A close event is emitted', function (done) {
			var ws = mock();
			ws.on('close', done);
			ws._closeConnection();
		});

		it('A disconnect event is emitted', function (done) {
			var ws = mock();
			ws.on('disconnect', done);
			ws._closeConnection();
		});

		it('All event listeners are removed', function (done) {
			var ws = mock(done);
			ws._closeConnection();
		});
	});
});

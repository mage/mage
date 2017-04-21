var assert = require('assert');
var mod = require('../lib/state/state.js');
var State = mod.State;

function noop() {}

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
		return false;
	},
	session: {
		getActorAddresses: function (state, actorIds, cb) {
			cb(null, actorIds.map(actorToAddress).filter(Boolean));
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

var logger = {
	verbose: noop,
	warning: noop,
	error: noop,
	alert: noop
};


describe('State class', function () {
	before(function () {
		mod.initialize(fakeMage, logger, FakeArchivist);
	});

	it('It should be constructable', function (done) {
		var session = {
			actorId: 'abc',
			getData: function (/* key */) {
				return undefined;
			}
		};

		var state = new State(null, session);

		assert.strictEqual(state.session, session);
		assert.strictEqual(state.actorId, 'abc');

		state = new State('def', session);

		assert.strictEqual(state.session, session);
		assert.strictEqual(state.actorId, 'abc');

		done();
	});

	it('Should bookkeep events', function (done) {
		var state = new State('abc');

		state.emit(null, 'test.1', { hello: 'world' });    // to self
		state.emit('abc', 'test.2', { goodbye: 'world' }); // to self
		state.emit('def', 'test.3', { three: 3 });         // to other user
		state.emit(['def', 'ghi'], 'test.4', { four: 4 }); // to other users
		state.emit('ghi', 'test.5', { five: 5 }, 'en');    // to other user
		state.emit('ghi', 'test.6', { six: 6 }, 'nl');     // to other user in wrong language (should be dropped)
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
					payload: '[["test.4",{"four":4}],["test.5",{"five":5}]]'
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

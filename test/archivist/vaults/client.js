var assert = require('assert');
var vaultMod = require('lib/archivist/vaults/client');


function devNull() {}

var logger = {
	debug: devNull,
	verbose: devNull,
	alert: console.error,
	error: console.error,
	info: devNull,
	notice: devNull,
	warning: console.warn
};

function createState() {
	return {
		_broadcast: [],
		_emitted: [],
		_reset: function () {
			this._broadcast = [];
			this._emitted = [];
		},
		broadcast: function (event, msg) {
			this._broadcast.push({
				event: event,
				msg: msg
			});
		},
		emit: function (actorIds, event, msg) {
			this._emitted.push({
				actorIds: actorIds,
				event: event,
				msg: msg
			});
		}
	};
}


function createVault(state, cb) {
	var vault = vaultMod.create('myClientVault', logger);
	vault.setup({ state: state }, function (error) {
		assert.ifError(error, 'FileVault#setup returned an error');
		return cb(vault);
	});
}


describe('Client Vault', function () {
	var state, vault;
	var demoKey = 'some.path';
	var demoValue = 'Some serialized value';
	var demoDiff = {
		foo: 'bar'
	};

	it('instantiates', function (done) {
		state = createState();

		createVault(state, function (clientVault) {
			assert.ok(clientVault);
			vault = clientVault;
			done();
		});
	});

	it('can set to one user', function () {
		vault.set('userA', demoKey, demoValue, 10);

		assert.equal(state._emitted.length, 1);

		var emitted = state._emitted[0];

		assert.equal(emitted.actorIds, 'userA');
		assert.equal(emitted.event, 'archivist:set');
		assert.deepEqual(emitted.msg, { key: demoKey, value: demoValue, expirationTime: 10 });

		state._reset();
	});

	it('can set to many users', function () {
		vault.set(['userA', 'userB', 'userC'], demoKey, demoValue, 10);

		assert.equal(state._emitted.length, 1);

		var emitted = state._emitted[0];

		assert.deepEqual(emitted.actorIds, ['userA', 'userB', 'userC']);
		assert.equal(emitted.event, 'archivist:set');
		assert.deepEqual(emitted.msg, { key: demoKey, value: demoValue, expirationTime: 10 });

		state._reset();
	});

	it('can set to all users', function () {
		vault.set('*', demoKey, demoValue, 10);

		assert.equal(state._broadcast.length, 1);

		var broadcast = state._broadcast[0];

		assert.equal(broadcast.event, 'archivist:set');
		assert.deepEqual(broadcast.msg, { key: demoKey, value: demoValue, expirationTime: 10 });

		state._reset();
	});

	it('can applyDiff to one user', function () {
		vault.applyDiff('userA', demoKey, demoDiff, 10);

		assert.equal(state._emitted.length, 1);

		var emitted = state._emitted[0];

		assert.equal(emitted.actorIds, 'userA');
		assert.equal(emitted.event, 'archivist:applyDiff');
		assert.deepEqual(emitted.msg, { key: demoKey, diff: demoDiff, expirationTime: 10 });

		state._reset();
	});

	it('can touch to one user', function () {
		vault.touch('userA', demoKey, 11);

		assert.equal(state._emitted.length, 1);

		var emitted = state._emitted[0];

		assert.equal(emitted.actorIds, 'userA');
		assert.equal(emitted.event, 'archivist:touch');
		assert.deepEqual(emitted.msg, { key: demoKey, expirationTime: 11 });

		state._reset();
	});

	it('can del to one user', function () {
		vault.del('userA', demoKey);

		assert.equal(state._emitted.length, 1);

		var emitted = state._emitted[0];

		assert.equal(emitted.actorIds, 'userA');
		assert.equal(emitted.event, 'archivist:del');
		assert.deepEqual(emitted.msg, { key: demoKey });

		state._reset();
	});
});

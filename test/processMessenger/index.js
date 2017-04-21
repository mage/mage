var assert = require('assert');
var cluster = require('cluster');

// Use a custom script for the workers instead of running mocha
cluster.setupMaster({
	exec: __dirname + '/worker.js'
});

// Run a worker before instantiating the messenger
cluster.fork();

var Messenger = require('lib/processMessenger');
var messenger = new Messenger('test');

describe('processMessenger', function () {
	it('master broadcast/worker echo', function (done) {
		var numberOfWorkers = 3;
		for (var i = 0; i < numberOfWorkers; ++i) {
			cluster.fork();
		}

		var obj = { somekey: 'some value' };

		var received = 0;
		messenger.on('test1', function (data) {
			received++;
			assert.deepEqual(data, obj);
			if (received === numberOfWorkers) {
				done();
			}
		});

		messenger.broadcast('test1', obj);
	});

	it('master can send message to its workers', function (done) {
		var worker = cluster.fork();

		messenger.on('test2', function (data, from) {
			assert.strictEqual(from, worker.id);
			done();
		});

		messenger.send(worker.id, 'test2');
	});

	it('master can not send messages to parent', function (done) {
		assert.throws(
			function () {
				messenger.send('master', 'test2');
			},
			Error
		);
		done();
	});

	it('send require a destination', function (done) {
		assert.throws(
			function () {
				messenger.send(null, 'test2');
			},
			Error
		);
		done();
	});

	it('send require a message', function (done) {
		var worker = cluster.fork();

		assert.throws(
			function () {
				messenger.send(worker.id, null);
			},
			Error
		);
		done();
	});

	it('the namespace is required', function (done) {
		assert.throws(
			function () {
				new Messenger();
			},
			Error
		);
		done();
	});

	it('the namespace should be a string', function (done) {
		assert.throws(
			function () {
				new Messenger({ test: 1 });
			},
			Error
		);
		done();
	});

	it('worker-to-worker communication', function (done) {
		messenger.on('test4.ok', function (data) {
			assert.deepEqual(data.data, { data: 'test' });
			assert.strictEqual(data.from, 8);
			done();
		});
		cluster.fork();
		messenger.on('test4.worker7.ok', function (data, from) {
			assert.strictEqual(from, 7);
			cluster.fork();
		});
		messenger.on('test4.worker8.ok', function (data, from) {
			assert.strictEqual(from, 8);
		});
	});

	it('worker broadcast', function (done) {
		var received = 0;
		messenger.on('test5.worker9.ok', function () {
			if (++received === 2) {
				done();
			}
		});

		messenger.on('test5.ok', function () {
			if (++received === 2) {
				done();
			}
		});

		messenger.on('test5.worker9.ready', function () {
			cluster.fork();
		});
		cluster.fork();
	});

	it('ignore message from another namespace', function (done) {
		var messenger2 = new Messenger('test-othernamespace');
		var worker = cluster.fork();
		messenger2.send(worker.id, 'test6.nok');
		messenger.on('test6.nok', function () {
			done(new Error('Should not receive a message from another namespace.'));
		});
		setTimeout(done, 1000);
	});
});

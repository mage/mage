var EventEmitter = require('events').EventEmitter;
var util = require('util');
var cluster = require('cluster');
var assert = require('assert');

/**
 * Create a new process messenger.
 *
 * @param {string} namespace    The namespace used by this messenger.
 * @constructor
 */
function Messenger(namespace) {
	assert(namespace, 'A namespace is required to use the process messenger.');

	assert(Object.prototype.toString.call(namespace) === '[object String]',
		'The namespace must be a string.');

	this.namespace = namespace;

	this.setupWorker();
	this.setupMaster();
}

util.inherits(Messenger, EventEmitter);

/**
 * Setup the process messenger on the worker.
 *
 * The process messenger will emit an event, each time it will receive a message
 * which belongs to its namespace.
 */
Messenger.prototype.setupWorker = function () {
	if (!cluster.isWorker) {
		return;
	}

	var that = this;

	process.on('message', function (msg) {
		// Ignore the message if it doesn't belong to the namespace
		if (msg.namespace !== that.namespace) {
			return;
		}

		// Emit an event with the message details
		that.emit(msg.name, msg.data, msg.from);
	});
};

/**
 * Setup the process messenger on the worker.
 *
 * It will emit an event, each time it will receive a message if it's the recipient.
 * It will forward broadcast and messages if it's not the recipient.
 */
Messenger.prototype.setupMaster = function () {
	if (!cluster.isMaster) {
		return;
	}

	var that = this;

	// Add a listener to process the message received from the specified worker
	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			// Ignore the message if it doesn't belong to the namespace
			if (msg.namespace !== that.namespace) {
				return;
			}

			// If the address is '*', it's a broadcast message
			// Send the message to all the workers
			if (msg.to === '*') {
				that.broadcast(msg.name, msg.data, msg.from);
			}

			// If the address is 'master', emit an event with the message details
			// If the message is a broadcast message, it should also emit an event
			if (msg.to === 'master' || msg.to === '*') {
				that.emit(msg.name, msg.data, msg.from);
				return;
			}

			// If the master is not the recipient, forward the message
			that.send(msg.to, msg.name, msg.data, msg.from);
		});
	}

	// Add the listener on all the existing workers
	var workers = cluster.workers;
	Object.keys(workers).forEach(function (id) {
		bindMessageListener(workers[id]);
	});
	// Add the listener on all the workers which will be created
	cluster.on('fork', bindMessageListener);
};

/**
 * Send a broadcast message.
 *
 * @param {string}          messageName  The name of the message to send.
 * @param {Object}          data     The data to attach to the message.
 * @param {string|number}   from     Sender of the message.
 */
Messenger.prototype.broadcast = function (messageName, data, from) {
	if (cluster.isWorker) {
		// Send a message to the master
		process.send({
			namespace: this.namespace,
			from: cluster.worker.id,
			to: '*',
			name: messageName,
			data: data
		});
		return;
	}

	// Send a message to all the workers
	var workers = cluster.workers;
	Object.keys(workers).forEach(function (id) {
		// Don't send the broadcast message to the sender
		if (id === from) {
			return;
		}

		workers[id].send({
			namespace: this.namespace,
			from: from || 'master',
			to: id,
			name: messageName,
			data: data
		});
	}, this);
};

/**
 * Send a message.
 *
 * @param {string|number}   to          Recipient.
 * @param {string}          messageName The name of the message to send.
 * @param {Object}          data        The data to attach to the message.
 * @param {string|number}   from        Sender of the message.
 */
Messenger.prototype.send = function (to, messageName, data, from) {
	assert(to, 'You must specify a destination to send a message.');
	assert(messageName, 'You must specify a message name to send a message.');

	var sendingProcess = null;

	if (cluster.isWorker) {
		// Worker must call send() from the process object
		sendingProcess = process;

		// If from is not defined, it should be the id of the worker
		if (!from) {
			from = cluster.worker.id;
		}
	} else {
		var worker = cluster.workers[to];
		assert(worker, 'There is no worker with this id.');

		// Master must call send() from the worker object
		sendingProcess = worker;

		// If from is not defined, it should be the 'master'
		if (!from) {
			from = 'master';
		}
	}

	sendingProcess.send({
		namespace: this.namespace,
		from: from,
		to: to,
		name: messageName,
		data: data
	});
};

module.exports = Messenger;

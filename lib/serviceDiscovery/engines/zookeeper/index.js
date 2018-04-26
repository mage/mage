var util = require('util');
var Service = require('../../service').Service;
var ServiceNode = require('../../node').ServiceNode;
var mage = require('lib/mage');
var requirePeer = require('codependency').get('mage');
var zooKeeper = requirePeer('node-zookeeper-client');
var logger = mage.core.logger.context('zookeeper');
var helpers = require('../../helpers');

var CONNECT_TIMEOUT = 5 * 1000;

/**
 * Creates a zookeeper client, sets up relevant event listeners and connects.
 *
 * @param {Object} options
 * @returns {zooKeeper.client}
 */
function createZooKeeperClient(options) {
	options = options || {};

	if (!options.hosts) {
		throw new Error('Missing configuration server.discoveryService.options.hosts for ZooKeeper');
	}

	// client options, with better defaults than node-zookeeper-client provides

	var clientOpts = options.options || {};

	clientOpts.sessionTimeout = clientOpts.hasOwnProperty('sessionTimeout') ? clientOpts.sessionTimeout : 30000;
	clientOpts.spinDelay = clientOpts.hasOwnProperty('spinDelay') ? clientOpts.spinDelay : 1000;
	clientOpts.retries = clientOpts.hasOwnProperty('retries') ? clientOpts.retries : 3;

	// connect to the database

	var client = zooKeeper.createClient(options.hosts, clientOpts);

	client.on('connected', function () {
		logger.verbose('ZooKeeper connection established');
	});

	client.on('connectedReadOnly', function () {
		logger.error('ZooKeeper connection established to a read-only server');
	});

	client.on('disconnected', function () {
		logger.verbose('ZooKeeper connection dropped');
	});

	client.on('expired', function () {
		logger.verbose('ZooKeeper client session expired');
	});

	client.on('authenticationFailed', function () {
		logger.error('ZooKeeper authentication failed');
	});

	return client;
}

/**
 * This is our service instance for zookeeper
 *
 * @param {string} name    The name of the service we want to announce
 * @param {string} type    The type of service (tcp or udp)
 * @param {Object} options The options to provide to the service
 * @constructor
 */
function ZooKeeperService(name, type, options) {
	this.name = name;
	this.type = type;
	this.options = options;

	this.closed = false;
	this.announcing = false;
	this.discovering = false;

	// this is the base path we will use to announce this service
	this.baseAnnouncePath = ['/mage', this.name, this.type].join('/');

	// those are the nodes we know on the given path
	this.nodes = [];

	// node data is stored apart
	this.services = {};

	this.connectTimer = null;
	this.clearCredentialsTimer = null;

	// Initial setup
	this.reset();
}

util.inherits(ZooKeeperService, Service);


ZooKeeperService.prototype.reset = function () {
	const { options } = this;

	this.client = createZooKeeperClient(options);

	// After reading the code below, you might feel a bit
	// disgusted; this is perfectly normal, but currently
	// unavoidable.
	//
	// The client library we are currently using will simply
	// cycle forever on all zookeeper node if the remote server
	// respond with an invalid session error. While this possibly make
	// sense for larger deployments, it also means that restarting a single
	// ZooKeeper node would mean needing to restart the MAGE cluster.
	//
	// To solve this, we simply replace the client if we cannot achiever
	// a connection for too long.
	//
	// See: https://github.com/mage/mage/issues/108
	this.client.on('connected', function () {
		if (this.connectTimer) {
			clearTimeout(this.connectTimer);
		}

		if (this.clearCredentialsTimer) {
			clearTimeout(this.clearCredentialsTimer);
		}
	});

	this.client.on('disconnected', () => {
		this.clearCredentialsTimer = setTimeout(() => {
			var state = this.client.getState();

			if (state !== zooKeeper.State.SYNC_CONNECTED) {
				logger.verbose('Connection appears unstable, re-setting');
				this.client.close();
				this.reset();
			}
		}, CONNECT_TIMEOUT);
	});

	if (this.closed) {
		return;
	}

	logger.verbose('ZooKeeper client connecting to', options.hosts);
	this.client.connect();

	if (this.discovering !== false) {
		this.discover();
	}

	if (this.announcing !== false) {
		this.announce(this.announcing[0], this.announcing[1], () => false);
	}

	this.connectTimer = setTimeout(() => {
		var state = this.client.getState();

		if (state !== zooKeeper.State.SYNC_CONNECTED) {
			logger.alert.data('connection-options', options).log(
				'Still not connected to ZooKeeper server after', CONNECT_TIMEOUT / 1000, 'seconds.',
				'Please inspect your configuration.'
			);
		}
	}, CONNECT_TIMEOUT);
};

/**
 * Announce our service to the world.
 * Flow:
 * 1. Remove the existing node (just in case, because we've seen lingering ephemeral nodes causing
 *    nasty errors)
 * 2. Create the parent directory
 * 3. Create the node
 *
 * @param {number}   port     The port to announce
 * @param {Object}   metadata Some metadata that will be transferred to clients on the network
 * @param {Function} cb       This callback is called once the announcement is done. If any error
 *                            occurred, it is returned in the first argument
 */
ZooKeeperService.prototype.announce = function (port, metadata, cb) {
	var that = this;
	var ips = helpers.getAnnounceIps(this.options.interface);
	var id = helpers.generateId(port);

	this.announcing = [port, metadata];

	// enrich metadata with some extra stuff from us
	metadata = {
		ips: ips,
		data: metadata
	};

	// check if the parent path exists

	var dataBuffer = new Buffer(JSON.stringify(metadata));
	var announcePath = [this.baseAnnouncePath, id].join('/');

	logger.verbose('Removing', announcePath, '(this can time out or hang forever if zookeeper is not reachable).');

	that.client.remove(announcePath, function (error) {
		// ignore error if remove failed because our node didn't exist to begin with (the common case)

		if (error && error.getCode() !== zooKeeper.Exception.NO_NODE) {
			return cb(error);
		}

		logger.verbose('Creating directory', that.baseAnnouncePath);

		that.client.mkdirp(that.baseAnnouncePath, function (error) {
			if (error) {
				return cb(error);
			}

			logger.verbose('Creating service node', announcePath);

			that.client.create(announcePath, dataBuffer, zooKeeper.CreateMode.EPHEMERAL, function (error) {
				if (error) {
					// Be ultra verbose about what we know should not happen and why.
					// Normal emergency logging happens outside this library, but we want to log
					// this particular message.

					if (error.getCode() === zooKeeper.Exception.NODE_EXISTS) {
						logger.emergency
							.details('That can only mean the following.')
							.details('(1) Double callbacks during the MAGE setup phase.')
							.details('(2) A race condition between two master processes ' +
								'that both identify as ' + announcePath + '.')
							.log('NODE_EXISTS on our node creation should *never* happen, but it just did.');
					}
				}

				cb(error);
			});
		});
	});
};

/**
 * Retrieve the details from a node, then emit the `up` event with the node details
 *
 * @param {string} node
 * @private
 */
ZooKeeperService.prototype.discoverNode = function (node) {
	var that = this;

	// get the data from the node
	this.client.getData([this.baseAnnouncePath, node].join('/'), function (error, data) {
		if (error) {
			that.emitError(error);
			return;
		}

		// parse the metadata
		data = JSON.parse(data);

		// retrieve the host/port from the node name
		var nodeData = node.split(':');
		var host = nodeData[0];
		var port = nodeData[1];

		// store the metadata so that we can retrieve it when the node goes down
		that.services[node] = new ServiceNode(host, port, data.ips, data.data);

		// emit the up signal
		that.emit('up', that.services[node]);
	});
};

/**
 * Called when an event happened on our parent node, it will retrieve the list of children and update the network
 * informations
 *
 * @param {zooKeeper.Event} event
 * @private
 */
ZooKeeperService.prototype.onWatchEvent = function (event) {
	var that = this;
	logger.verbose.data(event).log('ZooKeeper path changed');

	function onWatch(event) {
		that.onWatchEvent(event);
	}

	if ((event.name === 'NODE_CHILDREN_CHANGED') && (event.path === this.baseAnnouncePath)) {
		this.client.getChildren(this.baseAnnouncePath, onWatch, function (error, children) {
			if (error) {
				that.emitError(error);
				return;
			}

			logger.verbose.data(children).log('Updating network');

			that.updateNetwork(children);
		});
	}
};

/**
 * Takes a list of nodes (ip:port as a string) and checks for differences with the currently known nodes on the network.
 *
 * @param {string[]} children
 * @private
 */
ZooKeeperService.prototype.updateNetwork = function (children) {
	// we move new nodes and already known nodes there so that we can list deleted nodes easily
	var newNetwork = [];
	var i;

	for (i = 0; i < children.length; i++) {
		var child = children[i];
		var n;

		if ((n = this.nodes.indexOf(child)) === -1) {
			newNetwork.push(child);

			logger.verbose('New node on the network', child);

			// pull data from the node
			this.discoverNode(child);
		} else {
			newNetwork.push(this.nodes.splice(n, 1)[0]);
		}
	}

	// now everything left are nodes that don't exists anymore on the network, delete them
	for (i = 0; i < this.nodes.length; i++) {
		var node = this.nodes[i];

		logger.verbose('Down node', node);

		// if we know what the node is
		if (this.services[node]) {
			// emit the down signal
			this.emit('down', this.services[node]);

			// we don't need the node's data anymore, remove it
			delete this.services[node];
		}
	}

	logger.verbose.data(newNetwork).log('Network updated!');

	// then switch old network map with new one
	this.nodes = newNetwork;
};

/**
 * Start the discovery process
 */
ZooKeeperService.prototype.discover = function () {
	var that = this;

	logger.debug('Discovering network');

	this.discovering = true;

	function onWatch(event) {
		that.onWatchEvent(event);
	}

	// first retrieve nodes on the network, and put a watcher on that path
	this.client.getChildren(this.baseAnnouncePath, onWatch, function (error, children) {
		if (error) {
			return that.emitError(error);
		}

		// update the network with the found children
		that.updateNetwork(children);
	});
};


ZooKeeperService.prototype.close = function (cb) {
	var state = this.client.getState();

	if (this.connectTimer) {
		clearTimeout(this.connectTimer);
		this.connectTimer = null;
	}

	// manually closing makes the ephemeral nodes disappear instantly instead of several seconds later

	if (state === zooKeeper.State.SYNC_CONNECTED) {
		this.client.close();
	}

	this.closed = true;
	this.discovering = false;
	this.announcing = false;

	setImmediate(cb);
};

ZooKeeperService.prototype.emitError = function (error) {
	if (error.name !== 'CONNECTION_LOSS') {
	// We ignore connection losses since any persisting connnectivity issues
	// should be managed by the other event handlers, and connection loss for in-flight requests
	// will be retried by zookeper.
	//
	// See https://github.com/alexguan/node-zookeeper-client/blob/master/index.js#L138 for more details
		return logger.warning
			.details('node-zookeeper-client will retry the query; you may ignore')
			.details('this warning, unless it happens too frequently')
			.log('Received CONNECTION_LOSS event');
	}

	this.emit('error', error);
};

/**
 * Creates a version of the service using the type and options provided
 *
 * @param {string} name    The name of the service we want to announce/discover
 * @param {string} type    The type of service, udp or tcp
 * @param {Object} options Options to provide to the service
 * @returns {ZooKeeperService}
 */
exports.create = function (name, type, options) {
	return new ZooKeeperService(name, type, options);
};

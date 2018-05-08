/**
 * The Message Server takes care of taking messages from A to B, and uses the following subsystems
 * to achieve that:
 *
 * - Service Discovery (to connect the dots across the network)
 * - MMRP (the messaging protocol over ZMQ)
 * - Store (where messages are kept around until delivered)
 * - Message Stream (which streams the messages to the client)
 */

var assert = require('assert');
var path = require('path');
var EventEmitter = require('events').EventEmitter;

var Store = require('./store').Store;
var msgStream = require('./msgStream');
var MsgStream = msgStream.MsgStream;

var serviceDiscovery = require('../serviceDiscovery');
var processManager = require('../processManager');
var mage = require('../mage');
var logger = mage.core.logger.context('msgServer');


exports = module.exports = new EventEmitter();


var mmrp, mmrpNode, MmrpNode, Envelope, service, store, stream;

exports.listPeerDependencies = function () {
	return {
		'MMRP ZeroMQ transport': ['zmq']
	};
};


// Message Server configuration

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

var cfgMmrp = mage.core.config.get(['server', 'mmrp'], {});
var cfgMsgStream = mage.core.config.get(['server', 'msgStream'], {});
var cfgServiceName = mage.core.config.get(['server', 'serviceName'], null);

/**
 * Throws an error if the message server is not enabled due to missing configuration
 */

function assertMsgServerIsEnabled() {
	assert(cfgMmrp.bind, 'No MMRP bindings configured');
	assert(cfgMsgStream, 'The message stream has been disabled.');
	assert(cfgMsgStream.transports, 'The message stream has no configured transports.');
	assert(serviceDiscovery.isEnabled(), 'Service discovery has not been configured');
}

var isEnabled = true;

try {
	assertMsgServerIsEnabled();
} catch (error) {
	isEnabled = false;
}


// expose subsystems

if (isEnabled) {
	mmrp = require('./mmrp');
	MmrpNode = mmrp.MmrpNode;
	Envelope = mmrp.Envelope;
}

exports.mmrp = mmrp;
exports.msgStream = msgStream;


/**
 * Returns true if MMRP is or will be set up, false otherwise.
 */

exports.isEnabled = function () {
	return isEnabled;
};


/**
 * Returns MmrpNode instance
 * @returns {MmrpNode}
 */

exports.getMmrpNode = function () {
	return mmrpNode;
};


/**
 * Returns the ID that represents this cluster of master/workers
 *
 * @returns {string}
 */

exports.getClusterId = function () {
	if (mmrpNode) {
		return mmrpNode.clusterId;
	}

	return 'local';
};


exports.getPublicConfig = function (baseUrl) {
	if (!isEnabled) {
		return null;
	}

	var cfg = {
		transports: {},
		detect: cfgMsgStream.detect.slice(),
		cors: mage.core.httpServer.getCorsConfig()
	};

	// copy transports, but replace "route" keys with "url" keys

	var types = Object.keys(cfgMsgStream.transports);
	for (var i = 0; i < types.length; i += 1) {
		var type = types[i];
		var transportConfig = cfgMsgStream.transports[type];

		cfg.transports[type] = {
			cors: cfg.cors
		};

		var keys = Object.keys(transportConfig);
		for (var j = 0; j < keys.length; j += 1) {
			var key = keys[j];

			if (key === 'route') {
				cfg.transports[type].url = baseUrl + transportConfig.route;
			} else {
				cfg.transports[type][key] = transportConfig[key];
			}
		}
	}

	return cfg;
};


// Message Server API for cluster-wide user-to-user communication
// --------------------------------------------------------------

function informHostGone(route, address) {
	// inform route that address is no longer being hosted

	if (mmrpNode) {
		mmrpNode.send(new Envelope('msgServer.hostGone', address, route));
	}
}


exports.send = function (address, clusterId, message) {
	if (mmrpNode) {
		var envelope = new Envelope('msgServer.send', [address].concat(message), [clusterId]);

		var bytes = mmrpNode.send(envelope, null, function (error) {
			if (error) {
				informHostGone([mmrpNode.identity], address);
			}
		});

		exports.emit('sendMessage', bytes);
	}
};

exports.broadcast = function (message) {
	if (mmrpNode) {
		var bytes = mmrpNode.broadcast(new Envelope('msgServer.broadcast', message));

		exports.emit('sendMessage', bytes);
	}
};

exports.confirm = function (address, clusterId, msgIds) {
	var message = JSON.stringify({
		msgIds: msgIds,
		address: address
	});

	if (mmrpNode) {
		var bytes = mmrpNode.send(new Envelope('msgServer.confirm', message, [clusterId]), null, function (error) {
			if (error) {
				informHostGone([mmrpNode.identity], address);
			}
		});

		exports.emit('sendMessage', bytes);
	}
};

exports.connect = function (address, clusterId, disconnects) {
	// different transports have different disconnection behavior.
	// for example:
	// - shortpolling disconnects whether or not messages could be delivered
	// - longpolling disconnects after actual messages have been delivered
	// - websocket and eventsource never disconnect after message delivery

	disconnects = disconnects || 'never';

	assert(disconnects === 'never' || disconnects === 'always' || disconnects === 'ondelivery');

	clusterId = clusterId || mmrpNode.clusterId; // connect to own cluster ID

	if (mmrpNode) {
		var msg = [address, disconnects];
		var envelope = new Envelope('msgServer.connect', msg, [clusterId], [mmrpNode.identity], 'TRACK_ROUTE');

		var bytes = mmrpNode.send(envelope, null, function (error) {
			if (error) {
				informHostGone([mmrpNode.identity], address);
			}
		});

		exports.emit('sendMessage', bytes);
	}
};

exports.disconnect = function (address, clusterId) {
	if (mmrpNode) {
		var bytes = mmrpNode.send(new Envelope('msgServer.disconnect', address, [clusterId]), null, function (error) {
			if (error) {
				informHostGone([mmrpNode.identity], address);
			}
		});

		exports.emit('sendMessage', bytes);
	}
};


// MMRP setup
// --------------------------------------------------------------

/**
 * Sets up an MMRP node which has a presence on the network and which other libraries will interface
 * with in order to pass messages around.
 */

function setupMmrp() {
	logger.debug('Setting up MMRP');

	var role = processManager.isMaster ? 'relay' : (processManager.isWorker ? 'client' : 'both');

	mmrpNode = new MmrpNode(role, cfgMmrp.bind);
}


// Store setup
// --------------------------------------------------------------

/**
 * Sets up the store that will keep messages ready for retrieval for addresses that connect to it.
 */

function setupStore() {
	store = new Store();


	mmrpNode.on('delivery.msgServer.connect', function (envelope) {
		if (store && !envelope.routeRemains() && envelope.hasReturnRoute()) {
			var address = String(envelope.messages[0]);
			var disconnects = String(envelope.messages[1]);

			store.connectAddress(envelope.returnRoute, address, disconnects);

			store.forward(address, function (error) {
				if (error) {
					informHostGone(envelope.returnRoute, address);
				}
			});
		}
	});

	mmrpNode.on('delivery.msgServer.disconnect', function (envelope) {
		if (store) {
			store.disconnectAddress(String(envelope.messages[0]));
		}
	});

	mmrpNode.on('delivery.msgServer.confirm', function (envelope) {
		if (store && !envelope.routeRemains()) {
			// this is for us

			var payload = JSON.parse(envelope.messages[0]);

			store.confirm(payload.address, payload.msgIds);
		}
	});

	mmrpNode.on('delivery.msgServer.send', function (envelope) {
		var address = String(envelope.messages[0]);

		if (store && store.managesAddress(address)) {
			logger.verbose('Sending envelope messages into store for address', address);

			store.send(address, envelope.messages.slice(1));

			store.forward(address, function (error) {
				if (error && envelope.hasReturnRoute()) {
					informHostGone(envelope.returnRoute, address);
				}
			});

			if (envelope.routeRemains()) {
				logger.warning('Message store was the endpoint, yet route remains:', envelope.route);
				envelope.consumeRoute();
			}
		} else {
			logger.verbose('Envelope passing by for address', address, '(not hosted here)');
		}
	});

	mmrpNode.on('delivery.msgServer.broadcast', function (envelope) {
		function quietLog(error) {
			if (error) {
				logger.verbose(error);
			}
		}

		if (store) {
			var addresses = store.getAddresses();

			for (var i = 0, len = addresses.length; i < len; i += 1) {
				var address = addresses[i];

				store.send(address, envelope.messages);
				store.forward(address, quietLog);
			}
		}
	});

	store.setForwarder(function (messages, address, route, cb) {
		if (mmrpNode) {
			mmrpNode.send(new Envelope('msgServer.messagepack', [address].concat(messages), route), null, cb);
		} else {
			if (cb) {
				cb();
			}
		}
	});
}


// Message Stream setup
// --------------------------------------------------------------

/**
 * Sets up the message stream which connects the message server with client SDKs.
 */

function setupMsgStream() {
	if (!mmrpNode.isClient) {
		return;
	}

	logger.verbose('Setting up HTTP message stream communication');

	stream = new MsgStream(cfgMsgStream);

	stream.bindToHttpServer(mage.core.httpServer);

	stream.on('connect', function (address, clusterId, disconnects) {
		exports.connect(address, clusterId, disconnects);
	});

	stream.on('disconnect', function (address, clusterId) {
		exports.disconnect(address, clusterId);
	});

	stream.on('confirm', function (address, clusterId, msgIds) {
		exports.confirm(address, clusterId, msgIds);
	});

	mmrpNode.on('delivery.msgServer.messagepack', function (envelope) {
		var address = String(envelope.messages[0]);

		if (address && stream) {
			logger.verbose('Delivering message pack to address', address);

			stream.deliver(address, envelope.messages.slice(1));
			envelope.consumeRoute();
		}
	});

	mmrpNode.on('delivery.msgServer.hostGone', function (envelope) {
		var address = String(envelope.messages[0]);

		if (address && stream) {
			logger.verbose('Announcing host disappeared for address', address);

			stream.hostGone(address);
			envelope.consumeRoute();
		}
	});

	mmrpNode.on('delivery.mmrp.sendError', function (envelope) {
		var originalType = String(envelope.messages[1]);
		if (['msgServer.connect', 'msgServer.send'].indexOf(originalType) < 0) {
			return;
		}

		var address = String(envelope.messages[2]);

		if (address && stream) {
			logger.verbose('Announcing host disappeared for address', address);

			stream.hostGone(address);
			envelope.consumeRoute();
		}
	});
}


// Service Discovery setup
// --------------------------------------------------------------

/**
 * Connects relays to other relays (master to master across the network), and connects
 * clients to relays (worker to master)
 *
 * The rules:
 * - A relay may only talk to a relay that is the same app name and same app version.
 * - A client may only talk to a relay that is its own master process, regardless of app name and
 *   version.
 */

function setupDiscovery() {
	logger.debug('Setting up service discovery');

	var ourMetadata = {
		game: cfgServiceName || mage.rootPackage.name,
		version: mage.rootPackage.version,
		clusterId: mmrpNode.clusterId,
		timestamp: Date.now()
	};

	service = serviceDiscovery.createService('mmrp', 'tcp');

	/**
	 * Returns true if the announced service is the master of this process-cluster, false otherwise.
	 *
	 * @param announced
	 * @returns {boolean}
	 */

	function isNameMatch(announced) {
		return announced.data.game === ourMetadata.game;
	}

	function isVersionMatch(announced) {
		return announced.data.version === ourMetadata.version;
	}

	function createUri(announced) {
		// check that we have a valid ipv4 (no ipv6 love for now)

		var ip = announced.getIp(4, cfgMmrp.network);

		return ip ? 'tcp://' + ip + ':' + announced.port : undefined;
	}


	service.on('error', function (error, service) {
		if (!service) {
			// No service is a problem as ignoring relies on service data being there. Handle this
			// as an alert.
			return logger.alert.data(service).log(error);
		}

		if (!service.data) {
			return logger.verbose.data(service).log('Ignoring error from incompatible source', error);
		}

		if (!isNameMatch(service)) {
			return logger.verbose.data(service).log('Ignoring error from other game', error);
		}

		if (!isVersionMatch(service)) {
			return logger.verbose.data(service).log('Ignoring error from other version', error);
		}

		logger.alert.data(service).log(error);
	});


	service.on('up', function (announced) {
		if (!mmrpNode) {
			return;
		}

		// ignore different mmrp apps

		if (!isNameMatch(announced)) {
			return;
		}

		var uri = createUri(announced);
		var data = announced.data;

		if (!uri) {
			return logger.error.data(data).log(
				'Service "mmrp" up at', announced.host + ':' + announced.port,
				'but could not resolve hostname.'
			);
		}

		// ignore versions that are not exactly the same as us

		if (!isVersionMatch(announced)) {
			return logger.debug.data({
				peer: data,
				us: ourMetadata
			}).log('Ignoring service-up of wrong version:', announced.host + ':' + announced.port);
		}

		// ignore clusterId-less peers

		if (!data.clusterId) {
			return logger.debug.data({
				peer: data,
				us: ourMetadata
			}).log('Ignoring service-up of service without clusterId:', announced.host + ':' + announced.port);
		}

		// relays connect to other relays, and clients connect to their own master process

		mmrpNode.relayUp(uri, data);
	});

	// relays should disconnect from other relays when they disappear

	service.on('down', function (announced) {
		if (!mmrpNode) {
			return;
		}

		if (!announced) {
			return logger.verbose('Unknown service went down.');
		}

		// ignore different mmrp apps

		if (!isNameMatch(announced)) {
			return;
		}

		var uri = createUri(announced);
		var data = announced.data;

		if (!uri) {
			logger.error.data(data).log(
				'Service "mmrp" down at', announced.host + ':' + announced.port,
				'but could not resolve hostname.'
			);
			return;
		}

		// ignore versions that are not exactly the same as us

		if (!isVersionMatch(announced)) {
			logger.debug.data({
				peer: data,
				us: ourMetadata
			}).log('Ignoring service-down of wrong version:', announced.host + ':' + announced.port);
			return;
		}

		mmrpNode.relayDown(uri, data);
	});

	// announce our relay

	if (mmrpNode.isRelay) {
		// extract the port

		var port = mmrpNode.routerPort;

		// hostname is optional and can be read from the OS

		logger.debug('Announcing MMRP relay on port', port);

		// announce the service on the network

		service.announce(port, ourMetadata, function (error) {
			if (error) {
				throw error;
			}

			logger.notice('MMRP relay announced on port', port);

			// start discovering!
			service.discover();
		});
	} else {
		// start discovering!
		service.discover();
	}
}


/**
 * Sets up the message server
 */

exports.setup = function () {
	// check requirements

	try {
		assertMsgServerIsEnabled();
	} catch (error) {
		logger.warning('Cannot set up Message Server:', error.message);
		return;
	}

	setupMmrp();
	setupStore();
	setupMsgStream();
	setupDiscovery();
};

exports.close = function (cb) {
	cb = cb || (() => {});

	if (mmrpNode) {
		logger.verbose('Closing MMRP node');

		mmrpNode.close();
		mmrpNode = null;
	}

	if (store) {
		logger.verbose('Closing store');

		store.close();
		store = null;
	}

	if (stream) {
		logger.verbose('Closing message stream');

		stream.close();
		stream = null;
	}

	if (service) {
		logger.verbose('Closing service discovery');

		service.close(cb);
		service = null;
	} else {
		setImmediate(cb);
	}
};

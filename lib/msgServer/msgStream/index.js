// The message stream connection with the end-user is managed here

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var mage = require('../../mage');
var logger = mage.core.logger.context('msgStream');

var transports = {
	longpolling: require('./transports/http-polling').longpolling,
	shortpolling: require('./transports/http-polling').shortpolling,
	websocket: require('./transports/websocket')
};



// address type handlers (eg: session)

var addressTypes = {};

exports.addAddressType = function (name, api) {
	assert(api, 'No API was provided');
	assert.equal(api.lookup.length, 3, 'Address lookup API must accept 3 arguments (address, host, cb)');
	assert.equal(api.invalidate.length, 3, 'Address invalidate API must accept 3 arguments (address, host, cb)');

	addressTypes[name] = api;
};

function getAddressLookup(type) {
	var api = addressTypes[type];

	if (!api) {
		logger.alert('Unknown address type:', type);
		return;
	}

	return api.lookup;
}

function getAddressInvalidator(type) {
	var api = addressTypes[type];

	if (!api) {
		logger.alert('Unknown address type:', type);
		return;
	}

	return api.invalidate;
}


/**
 * The Message Stream handler which wraps around all supported transport types
 *
 * @param {Object} cfg
 * @constructor
 */

function MsgStream(cfg) {
	assert(cfg, 'Cannot set up a message stream without configuration');
	assert(cfg.transports, 'Cannot set up a message stream without transports configured');

	EventEmitter.call(this);

	this.cfg = cfg;
	this.addressMap = {};
	this.closing = false;
}

util.inherits(MsgStream, EventEmitter);


exports.MsgStream = MsgStream;


MsgStream.prototype.addHost = function (address, type, host) {
	var addressMap = this.addressMap;

	var prevHost = addressMap[address];

	if (prevHost) {
		prevHost.close();
	}

	addressMap[address] = host;

	logger.verbose('Added stream at address', address, 'to address-map');

	host.on('warning', function (warning) {
		// warnings for a single connection are logged at the debug level
		logger.debug(warning);
	});

	host.on('close', function () {
		logger.verbose('Stream at address', address, '(' + type + ') disappeared, removing from address-map');

		delete addressMap[address];
	});
};


MsgStream.prototype.close = function () {
	if (this.closing) {
		return;
	}

	this.closing = true;

	var addresses = Object.keys(this.addressMap);
	var len = addresses.length;

	logger.debug('Closing all', len, 'connection(s)');

	for (var i = 0; i < len; i += 1) {
		var host = this.addressMap[addresses[i]];

		if (host) {
			host.close();
		}
	}
};


MsgStream.prototype.managesAddress = function (address) {
	return this.addressMap.hasOwnProperty(address);
};


MsgStream.prototype.deliver = function (address, msgs) {
	var host = this.addressMap[address];

	if (host) {
		logger.verbose('Delivering messages to', address);

		host.deliver(msgs);
	} else {
		logger.debug('Could not deliver messages to', address, '(address gone)');
	}
};


MsgStream.prototype.hostGone = function (address) {
	var host = this.addressMap[address];
	var types;

	if (host) {
		logger.verbose('Notifying host that its address has gone');
		types = [host.address.type];
	} else {
		// if we don't know the type, just try them all
		logger.verbose('No known host in this process to immediately notify about its address being gone');
		types = Object.keys(addressTypes);
	}

	for (var i = 0; i < types.length; i += 1) {
		var invalidate = getAddressInvalidator(types[i]);
		if (!invalidate) {
			continue;
		}

		if (invalidate(address, host, 'hostGone')) {
			// the host has been invalidated, which doesn't have to happen on another iteration

			if (host) {
				logger.verbose('Host has been notified that its address has gone');
				host = null;
			}
		}
	}
};


// hook up a transport host to the message store through the message server

MsgStream.prototype.connectHostToStore = function (clusterId, address, host) {
	var that = this;

	// confirm previous messages

	if (host.getConfirmIds) {
		var ids = host.getConfirmIds();

		if (ids) {
			this.emit('confirm', address, clusterId, ids);
		}
	}

	// connect to the store

	this.emit('connect', address, clusterId, host.getDisconnectStyle());

	// if any new confirmations come in, we must inform the message server

	host.on('confirm', function (ids) {
		that.emit('confirm', address, clusterId, ids);
	});

	// if the host explicitly disconnects (should only apply to sockets that don't disconnect
	// regularly), we inform the store

	host.on('disconnect', function () {
		that.emit('disconnect', address, clusterId);
	});
};


MsgStream.prototype.handleRequest = function (host) {
	var that = this;

	// resolve the session (or whatever authentication mechanism gets implemented)

	var addressInfo = host.getAddressInfo();

	assert(addressInfo);
	assert(addressInfo.address);
	assert(addressInfo.type);

	var lookupAddress = getAddressLookup(addressInfo.type);

	if (!lookupAddress) {
		host.respondBadRequest('Unknown address type: ' + addressInfo.type);
		return;
	}

	lookupAddress(addressInfo.address, host, function onSuccess(clusterId, address) {
		// remember this transport so we can deliver messages to it later

		that.addHost(address, addressInfo.type, host);

		// connect transport to the store

		that.connectHostToStore(clusterId, address, host);
	});
};


MsgStream.prototype.getTransportConfig = function (transport) {
	if (this.cfg.transports && this.cfg.transports[transport]) {
		return this.cfg.transports[transport];
	}

	return {};
};


MsgStream.prototype.handleWebSocketRequest = function (client, query) {
	// instantiate the transport over HTTP

	var cfg = this.getTransportConfig('websocket');
	var host = transports.websocket.create(cfg);

	// pass ownership of req/res over to the transport

	host.setConnection(client, query);

	// we're now WebSocket agnostic

	logger.verbose('Handling message stream WebSocket request');

	try {
		this.handleRequest(host);
	} catch (badRequestError) {
		logger.warning(badRequestError);
	}
};


function badHttpRequest(req, res, message) {
	res.writeHead(400, {
		'content-type': 'text/plain; charset=UTF-8',
		pragma: 'no-cache'
	});

	if (req.method === 'HEAD') {
		res.end();
	} else {
		res.end(message || 'Unknown error');
	}
}


MsgStream.prototype.handleHttpRequest = function (req, res, query) {
	// instantiate the transport over HTTP

	var transport = transports[query.transport];
	if (!transport) {
		logger.warning.data(req).log('Unknown HTTP transport:', transport);

		return badHttpRequest(req, res, 'Unknown HTTP transport: ' + query.transport);
	}

	// instantiate the host

	var cfg = this.getTransportConfig(query.transport);
	var host = transport.create(cfg);

	if (!host.setConnection) {
		logger.warning.data(req).log('Not an HTTP transport:', transport);

		return badHttpRequest(req, res, 'Not an HTTP transport: ' + transport);
	}

	// pass ownership of req/res over to the transport

	host.setConnection(req, res, query);

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding to HTTP HEAD request');

		// http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
		host.respondToHead();
		return;
	}

	// we're now HTTP agnostic

	logger.verbose.data(req).log('Handling message stream HTTP request');

	try {
		this.handleRequest(host);
	} catch (badRequestError) {
		logger.warning.data(req).log(badRequestError);

		return badHttpRequest(req, res);
	}
};


/**
 * Binds a single transport type to an HTTP server
 *
 * @param {Object} httpServer
 * @param {string} transport
 */

MsgStream.prototype.bindTransportToHttpServer = function (httpServer, transport) {
	var cfg = this.cfg.transports[transport] || {};
	var that = this;

	if (transport === 'websocket') {
		// websocket

		if (!cfg.route) {
			logger.alert('Cannot bind websocket to HTTP server without a route configured');
			return;
		}

		httpServer.addRoute(cfg.route, function (client, urlInfo) {
			that.handleWebSocketRequest(client, urlInfo.query);
		}, 'websocket');
		return;
	}

	if (transport === 'longpolling' || transport === 'shortpolling') {
		if (!cfg.route) {
			logger.alert('Cannot bind', transport, 'to HTTP server without a route configured');
			return;
		}

		// if both longpolling and shortpolling share the same route, one will simply and safely
		// overwrite the other.

		httpServer.addRoute(cfg.route, function (req, res, path, query) {
			try {
				that.handleHttpRequest(req, res, query);
			} catch (error) {
				logger.error('Error while handling HTTP request:', error);
			}
		}, 'simple');
		return;
	}

	logger.verbose('Transport', transport, 'cannot be bound to HTTP (skipping)');
};



/**
 * Binds all possible transport types that are configured to an HTTP server
 *
 * @param {Object} httpServer
 */

MsgStream.prototype.bindToHttpServer = function (httpServer) {
	// bind transports

	var types = Object.keys(this.cfg.transports || {});
	for (var i = 0; i < types.length; i += 1) {
		this.bindTransportToHttpServer(httpServer, types[i]);
	}

	// on server shutdown, close all open connections

	httpServer.server.on('closing', () => this.close());
};

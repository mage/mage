var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('../../../../mage').core.logger.context('msgStream', 'HttpPolling');


function HttpPollingHost(style, cfg) {
	assert(style === 'shortpolling' || style === 'longpolling', 'Invalid HttpPolling style');

	EventEmitter.call(this);

	this.style = style;
	this.timeout = (cfg.heartbeat || 0) * 1000;
	this.res = null;

	this.address = {
		address: null,
		type: null
	};

	this.confirmIds = null;
}

util.inherits(HttpPollingHost, EventEmitter);


exports.longpolling = {
	create: function (cfg) {
		return new HttpPollingHost('longpolling', cfg);
	}
};

exports.shortpolling = {
	create: function (cfg) {
		return new HttpPollingHost('shortpolling', cfg);
	}
};


// Universal transport API:

HttpPollingHost.prototype.getDisconnectStyle = function () {
	return this.style === 'shortpolling' ? 'always' : 'ondelivery';
};


HttpPollingHost.prototype.getAddressInfo = function () {
	return this.address;
};


HttpPollingHost.prototype.getConfirmIds = function () {
	var ids = this.confirmIds;

	this.confirmIds = null;

	return ids;
};


HttpPollingHost.prototype.deliver = function (msgs) {
	if (!this.res) {
		logger.warning('No client to deliver to');
		return;
	}

	logger.verbose('Delivering', msgs.length, 'messages');

	// msgs: [id, content, id, content, id, content, etc...]

	// build a response JSON string
	// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

	if (msgs.length === 0) {
		if (this.style === 'shortpolling') {
			this.res.writeHead(204, {
				pragma: 'no-cache'
			});

			this.res.end();
			this._closeConnection();
		}
		return;
	}

	var props = [];

	for (var i = 0, len = msgs.length; i < len; i += 2) {
		var id = msgs[i];
		var msg = msgs[i + 1];

		props.push('"' + id + '":' + msg);
	}

	var data = '{' + props.join(',') + '}';

	this.res.writeHead(200, {
		'content-type': 'application/json',
		pragma: 'no-cache'
	});

	this.res.end(data);
	this._closeConnection();
};


HttpPollingHost.prototype.respondBadRequest = function (reason) {
	if (this.res.finished) {
		logger.verbose('Cannot respond bad request (client gone)');
		return;
	}

	logger.verbose('Responding bad request:', reason);

	this.res.writeHead(400, {
		'content-type': 'text/plain; charset=UTF-8',
		pragma: 'no-cache'
	});

	if (reason) {
		this.res.end(reason);
	} else {
		this.res.end();
	}
	this._closeConnection();
};


HttpPollingHost.prototype.respondServerError = function () {
	// used when we fail to confirm a session key for example

	if (this.res.finished) {
		logger.verbose('Cannot respond server error (client gone)');
		return;
	}

	logger.verbose('Responding server error');

	this.res.writeHead(500, { // 500: Internal service error
		pragma: 'no-cache'
	});

	this.res.end();
	this._closeConnection();
};


HttpPollingHost.prototype.close = function () {
	logger.verbose('Closing client');

	this._sendHeartbeat();
};


// HTTP transport specific API:

HttpPollingHost.prototype.setConnection = function (req, res, query) {
	logger.verbose('Connection established');

	this.res = res;

	if (query.confirmIds) {
		this.confirmIds = query.confirmIds.split(',');
	}

	if (query.sessionKey) {
		this.address.address = query.sessionKey;
		this.address.type = 'session';
	}

	query = null;

	// set up heartbeat timeout and premature connection-lost handling

	if (this.timeout) {
		req.setTimeout(this.timeout, () => this._sendHeartbeat());
		res.setTimeout(this.timeout, () => this._sendHeartbeat());
	}

	// "close" indicates that the underlying connection was terminated before response.end() was
	// called or able to flush.

	req.on('close', () => {
		logger.debug('Client connection disappeared');
		this._closeConnection();
	});
};


HttpPollingHost.prototype.respondToHead = function () {
	if (this.res.finished) {
		logger.verbose('Cannot respond to HEAD request (client gone)');
		return;
	}

	this.res.writeHead(200, {
		'content-type': 'application/json',
		pragma: 'no-cache'
	});

	this.res.end();
	this._closeConnection();
};


HttpPollingHost.prototype._closeConnection = function () {
	if (this.res.finished) {
		return;
	}

	this.emit('close');
	this.removeAllListeners();
};


HttpPollingHost.prototype._sendHeartbeat = function () {
	if (this.res.finished) {
		return;
	}

	this.res.writeHead(204, {
		pragma: 'no-cache'
	});

	this.res.end();
	this._closeConnection();
};

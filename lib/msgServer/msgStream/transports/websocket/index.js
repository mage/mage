var EventEmitter = require('events').EventEmitter;
var util = require('util');
var WebSocket = require('ws');
var logger = require('../../../../mage').core.logger.context('msgStream', 'WebSocket');


function WebSocketHost() {
	EventEmitter.call(this);

	this.client = null;

	this.address = {
		address: null,
		type: null
	};
}

util.inherits(WebSocketHost, EventEmitter);

exports.create = function (/* cfg */) {
	return new WebSocketHost();
};


// Universal transport API:

WebSocketHost.prototype.getDisconnectStyle = function () {
	return 'never';
};


WebSocketHost.prototype.getAddressInfo = function () {
	return this.address;
};


WebSocketHost.prototype._safeSend = function (data) {
	try {
		this.client.send(data);
	} catch (sendError) {
		logger.verbose('Error sending message:', sendError);

		this.client.terminate();
		this._closeConnection();
	}
};


WebSocketHost.prototype.deliver = function (msgs) {
	if (!this.client) {
		logger.warning('No client to deliver to');
		return;
	}

	logger.verbose('Delivering', msgs.length, 'messages');

	// msgs: [id, content, id, content, id, content, etc...]

	// build a response JSON string
	// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

	if (msgs.length === 0) {
		return;
	}

	var props = [];

	for (var i = 0, len = msgs.length; i < len; i += 2) {
		var id = msgs[i];
		var msg = msgs[i + 1];

		props.push('"' + id + '":' + msg);
	}

	this._safeSend('{' + props.join(',') + '}');
};

WebSocketHost.prototype.respondUnsupportedDataRequest = function (reason) {
	// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
	// The connection is being terminated because the endpoint received data of a type it
	// cannot accept (for example, a text-only endpoint received binary data).
	this.close(
		1003,
		reason || 'Unsupported',
		'Responding unsupported data:' + reason,
		'Cannot respond, received unsupported data'
	);
};

WebSocketHost.prototype.respondBadRequest = function (reason) {
	// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
	// The endpoint is terminating the connection because it received a message that violates its
	// policy. This is a generic status code, used when codes 1003 and 1009 are not suitable.
	this.close(
		1008,
		reason || 'Bad request',
		'Responding bad request:' + reason,
		'Cannot respond bad request'
	);
};


WebSocketHost.prototype.respondServerError = function () {
	// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
	// The server is terminating the connection because it encountered an unexpected condition that
	// prevented it from fulfilling the request.
	this.close(
		1011,
		'Server error',
		'Responding server error',
		'Cannot respond server error'
	);
};


WebSocketHost.prototype.close = function (code, message, closingLog, clientGoneLog) {
	closingLog = closingLog || 'Closing client';
	clientGoneLog = clientGoneLog || 'Cannot close client';

	if (!this.client) {
		logger.verbose(clientGoneLog, '(client gone)');
		return;
	}

	logger.verbose(closingLog);

	this.client.close(code, message);
	this._closeConnection();
};


// HTTP transport specific API:

WebSocketHost.prototype.setConnection = function (client, query) {
	if (!client) {
		throw new Error('A client is required');
	}

	if (client instanceof WebSocket === false) {
		throw new Error('Client object must be a WebSocket instance');
	}

	logger.verbose('Connection established');

	var that = this;

	this.client = client;

	if (query && query.sessionKey) {
		this.address.address = query.sessionKey;
		this.address.type = 'session';
	}

	// "close" indicates that the underlying connection was terminated before response.end() was
	// called or able to flush.

	client.on('message', function (str, flags) {
		if (flags.binary) {
			return that.respondUnsupportedDataRequest('MAGE only supports text data');
		}

		if (str) {
			that.emit('confirm', str.split(','));
		}
	});

	client.on('error', function logWarning(error) {
		logger.warning(error);
	});

	client.once('close', function () {
		// client closed the connection
		logger.verbose('Client at address', that.address.address, 'disconnected');

		that._closeConnection();
	});
};


WebSocketHost.prototype._closeConnection = function () {
	if (!this.client) {
		return;
	}

	this.client = null;
	this.emit('close');
	this.emit('disconnect');
	this.removeAllListeners();
};

var util = require('util');
var path = require('path');
var fs = require('fs');
var cluster = require('cluster');
var loggingService = require('../');
var Writer = require('../Writer');
var mage = require('../../mage');
var requirePeer = require('codependency').get('mage');


var COLLECTOR = 'logCollector.sock';
var ANNOUNCER = 'logChannelAnnouncer.sock';
var logger;


function WebsocketWriter(cfg) {
	Writer.call(this);

	if (!logger) {
		logger = mage.core.logger.context('websocket-logger');
	}

	var ipcPath = (cfg && cfg.path) || './';

	this.pathCollector = path.join(ipcPath, COLLECTOR);
	this.pathAnnouncer = path.join(ipcPath, ANNOUNCER);
	this.uriCollector = 'ipc://' + this.pathCollector;
	this.uriAnnouncer = 'ipc://' + this.pathAnnouncer;

	this.channelClients = {};

	var shouldForward = cluster.isWorker;
	var shouldListen = mage.core.processManager.isMaster;

	if (shouldForward) {
		// the workers send their logs to the master

		this.setupChannelSyncClient();
		this.setupLogForwarder();
	} else if (shouldListen) {
		// the master process collects logs from the workers

		this.setupChannelSyncServer();
		this.setupLogCollector();
		this.setupWebsocketServer();
	} else {
		this.setupWebsocketServer();
	}
}


util.inherits(WebsocketWriter, Writer);


WebsocketWriter.prototype.setupWebsocketServer = function () {
	// create the websocket server

	var id = 0;
	var that = this;

	function reconfigureListeners() {
		var channels = Object.keys(that.channelClients);

		that.setChannels(channels);

		if (that.channelSync) {
			logger.verbose('Requesting log-feedback from workers for channels:', channels);

			that.channelSync.send('channels ' + JSON.stringify(channels));
		}
	}

	function cleanChannels(connId) {
		for (var channel in that.channelClients) {
			delete that.channelClients[channel][connId];

			if (Object.keys(that.channelClients[channel]).length === 0) {
				delete that.channelClients[channel];
			}
		}
	}

	function webSocketHandler(client) {
		var connId = id++;

		client.once('close', function () {
			// a disappearing connection should no longer have its channel configuration matter

			cleanChannels(connId);
			reconfigureListeners();
		});

		client.on('message', function (message) {
			// parse which channels this client wants to hear about

			var channels;

			try {
				channels = loggingService.parseChannelList(JSON.parse(message));
			} catch (e) {
				return client.send('"Syntax error"');
			}

			// update which channels we care for based on the combined requirements
			// of all client connections

			cleanChannels(connId);

			for (var i = 0, len = channels.length; i < len; i++) {
				var channel = channels[i];

				if (!that.channelClients[channel]) {
					that.channelClients[channel] = {};
				}

				that.channelClients[channel][connId] = client;
			}

			reconfigureListeners();

			client.send(JSON.stringify({ listening: true, channels: channels }));

			logger.verbose.details(channels).log('Websocket client changed channel list.');
		});

		// On the first message, log that a connection has been made.
		client.once('message', function () {
			logger.info('Client connected to the logger websocket.');
		});
	}

	mage.core.savvy.addRoute('/savvy/logger', webSocketHandler, 'websocket');
};


WebsocketWriter.prototype.channelFunctionGenerator = function (channel) {
	var that = this;

	if (this.forwarder) {
		// workers report logs to the master process

		return function (entry) {
			that.forwarder.send(channel + ' ' + JSON.stringify(entry));
		};
	} else {
		// the channel function sends logs to all connections that care about this channel

		return function (entry) {
			that.broadcast(channel, entry);
		};
	}
};


WebsocketWriter.prototype.broadcast = function (channel, entry) {
	var conns = this.channelClients[channel];
	if (!conns) {
		return;
	}

	var data = JSON.stringify(entry);

	function sendToConn(connId) {
		var conn = conns[connId];

		conn.send(data, function (error) {
			if (error) {
				conn.close();
				delete conns[connId];
			}
		});
	}

	Object.keys(conns).forEach(sendToConn);
};


WebsocketWriter.prototype.setupChannelSyncServer = function () {
	// channelSync announces which channels to care about, to all workers

	var that = this;

	var zmq = requirePeer('zmq');
	this.channelSync = zmq.socket('pub');

	// this may throw
	this.channelSync.bindSync(this.uriAnnouncer);

	process.on('exit', function () {
		if (that.channelSync.unbindSync) {
			that.channelSync.unbindSync(that.uriAnnouncer);
		} else {
			try {
				fs.unlinkSync(that.pathAnnouncer);
			} catch (error) {
				logger.warning(error);
			}
		}
	});
};


WebsocketWriter.prototype.setupChannelSyncClient = function () {
	var that = this;

	var zmq = requirePeer('zmq');
	this.channelSync = zmq.socket('sub');
	this.channelSync.connect(this.uriAnnouncer);
	this.channelSync.subscribe('channels');

	this.channelSync.on('message', function (channels) {
		try {
			// drop the "channels" prefix and parse the JSON

			channels = JSON.parse(channels.toString().substr(9));
		} catch (error) {
			return logger.error('Syntax error in channel definition', error);
		}

		logger.verbose('Reconfiguring listeners as requested by master for channels:', channels);

		that.setChannels(channels);
	});
};


WebsocketWriter.prototype.setupLogForwarder = function () {
	// workers forward logs to the master
	// the master will collect it and report on the websocket

	var zmq = requirePeer('zmq');
	this.forwarder = zmq.socket('push');
	this.forwarder.connect(this.uriCollector);
};


WebsocketWriter.prototype.setupLogCollector = function () {
	var that = this;

	// the collector receives log messages

	var zmq = requirePeer('zmq');
	this.collector = zmq.socket('pull');

	// this may throw

	this.collector.bindSync(this.uriCollector);

	process.on('exit', function () {
		if (that.collector.unbindSync) {
			that.collector.unbindSync(that.uriCollector);
		} else {
			try {
				fs.unlinkSync(that.pathCollector);
			} catch (error) {
				logger.warning(error);
			}
		}
	});

	this.collector.on('message', function (msg) {
		msg = msg.toString();

		var firstSpace = msg.indexOf(' ');
		var channel = msg.substr(0, firstSpace);
		var entry = JSON.parse(msg.substr(firstSpace + 1));

		that.broadcast(channel, entry);
	});
};

module.exports = WebsocketWriter;
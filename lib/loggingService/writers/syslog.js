var util = require('util');
var Writer = require('../Writer');
var dgram = require('dgram');
var hostname = require('os').hostname();

var workerId = require('lib/mage/worker').getId();

// syslog rfc: http://tools.ietf.org/html/rfc5424

var fallbackChannel = 7;
var channelMap = {
	verbose: 7,  // syslog offers nothing lower than debug
	debug: 7,
	info: 6,
	notice: 5,
	warning: 4,
	error: 3,
	critical: 2,
	alert: 1,
	emergency: 0
};


function SyslogWriter(cfg) {
	Writer.call(this);

	this.maxChannelNameLength = 0;
	this.channelHints = {};

	this.reconfigure(cfg);
}


util.inherits(SyslogWriter, Writer);


SyslogWriter.prototype.destroy = function (cb) {
	if (this.socket) {
		this.socket.close();
		this.socket = null;
	}

	setImmediate(cb);
};


SyslogWriter.prototype.reconfigure = function (cfg) {
	this.host = cfg.host || 'localhost';
	this.port = cfg.port || 514;
	this.appName = cfg.appName || 'mage';
	this.facility = cfg.facility || 1;
	this.format = cfg.format || {};

	if (!this.format.hasOwnProperty('multiLine')) {
		this.format.multiLine = false;
	}

	if (!this.format.hasOwnProperty('indent')) {
		this.format.indent = 2;
	}

	if (!this.socket) {
		this.socket = dgram.createSocket('udp4');
	}
};


SyslogWriter.prototype.generateSyslogPrefix = function (channelName) {
	var severity = channelMap[channelName] || fallbackChannel;
	return '<' + (this.facility * 8 + severity) + '>';
};


SyslogWriter.prototype.channelFunctionGenerator = function (channelName) {
	// create a serializer function that will write its log argument to syslog

	var that = this;

	var channelPrefix = this.generateSyslogPrefix(channelName);
	var protocolVersion = '1';

	var role;

	if (workerId) {
		role = '(w:' + workerId + ')';
	} else {
		role = '(m)';
	}

	var appName = this.appName;
	var pid = process.pid;
	var BOM = new Buffer([32, 0xEF, 0xBB, 0xBF]);  // prefixed with a space
	var nilValue = new Buffer('-');
	var format = this.format;

	function send(buff) {
		if (!that.socket) {
			console.error('Syslog socket is not set up yet');
			return;
		}

		that.socket.send(buff, 0, buff.length, that.port, that.host, function (error, bytesSent) {
			if (error) {
				console.error('Error while sending to syslog:', error);
				return;
			}

			if (bytesSent < buff.length) {
				console.error('Only', bytesSent, 'of', buff.length, 'were sent to syslog.');
				return;
			}
		});
	}


	// generate the function that will do the writing

	return function (entry) {
		// construct a syslog message
		// http://tools.ietf.org/html/rfc5424 chapter 6

		// header

		var header = new Buffer(
			channelPrefix + protocolVersion + ' ' +
			(new Date(entry.timestamp)).toJSON() + ' ' + // JSON-style (http://tools.ietf.org/html/rfc3339)
			hostname + ' ' +
			appName + ' ' +
			pid + ' ' +
			'- '   // MSGID (type of message)
		);

		// structured data (this has the potential to hold entry.data keys)

		var structuredData = nilValue;

		// message

		var msg = role;

		if (entry.contexts) {
			msg += ' [' + entry.contexts.join(' ') + ']';
		}

		msg += ' ' + entry.message;

		if (format.multiLine) {
			if (entry.details) {
				msg += '\n' + entry.details.join('\n');
			}

			if (entry.data) {
				if (format.indent) {
					msg += '\n' + JSON.stringify(entry.data, null, format.indent);
				} else {
					msg += '\n' + JSON.stringify(entry.data);
				}
			}
		} else {
			if (entry.details) {
				msg += ', details: ' + JSON.stringify(entry.details);
			}

			if (entry.data) {
				msg += ', data: ' + JSON.stringify(entry.data);
			}
		}

		msg = new Buffer(msg);

		// construct the final message and send it off

		var buff = Buffer.concat([header, structuredData, BOM, msg]);

		send(buff);
	};
};


module.exports = SyslogWriter;

var util = require('util');
var requirePeer = require('codependency').get('mage');
var Writer = require('../Writer');
var Graylog = requirePeer('graylog2').graylog;


var workerId = require('lib/mage/worker').getId();


function GraylogWriter(cfg) {
	Writer.call(this);

	this.reconfigure(cfg);
}


util.inherits(GraylogWriter, Writer);


GraylogWriter.prototype.reconfigure = function (cfg) {
	if (this.client) {
		this.client.close();
	}

	this.format = {};

	var format = cfg.format;
	if (format) {
		this.format = format;

		if (!this.format.hasOwnProperty('multiLine')) {
			this.format.multiLine = true;
		}

		if (!this.format.hasOwnProperty('embedDetails')) {
			this.format.embedDetails = false;
		}

		if (!this.format.hasOwnProperty('embedData')) {
			this.format.embedData = false;
		}
	}

	this.client = new Graylog(cfg);

	this.client.on('error', function (error) {
		console.error('Graylog writer experienced an error:', error);
	});
};


GraylogWriter.prototype.destroy = function (cb) {
	var client = this.client;
	if (!client) {
		return setImmediate(cb);
	}

	this.client = null;

	// Hard-kill after too much time has passed

	var timeout = setTimeout(function () {
		client.destroy();
		cb();
		cb = null;
	}, 2000);

	// Try to close gracefully

	client.close(function () {
		if (cb) {
			clearTimeout(timeout);
			cb();
		}
	});
};


GraylogWriter.prototype.channelFunctionGenerator = function (channel) {
	var client = this.client;

	// If the channel is not known to Graylog we fall back to the lowest support channel, which is
	// "debug".

	if (!client[channel]) {
		channel = 'debug';
	}

	var format = this.format;
	var pid = process.pid;

	var role;

	if (workerId) {
		role = '(w:' + workerId + ')';
	} else {
		role = '(m)';
	}


	function serializeData(data, prefix, value) {
		if (value && (typeof value === 'object' || Array.isArray(value))) {
			for (var key in value) {
				serializeData(data, prefix.concat(key), value[key]);
			}
		} else {
			data[prefix.join('_')] = value;
		}
	}


	return function (entry) {
		var msg, details, data;
		var timestamp = entry.timestamp;

		msg = role;

		if (entry.contexts) {
			msg += ' [' + entry.contexts.join(' ') + ']';
		}

		msg += ' ' + entry.message;

		if (entry.details) {
			if (format.multiLine) {
				if (format.embedDetails) {
					msg += '\n' + entry.details.join('\n');
				} else {
					details = entry.details.join('\n');
				}
			} else {
				if (format.embedDetails) {
					msg += ', details: ' + JSON.stringify(entry.details);
				} else {
					details = JSON.stringify(entry.details);
				}
			}
		}

		if (entry.data) {
			if (format.embedData) {
				if (format.multiLine) {
					msg += '\n';
				} else {
					msg += ', data: ';
				}

				if (format.indent) {
					msg += JSON.stringify(entry.data, null, format.indent);
				} else {
					msg += JSON.stringify(entry.data);
				}
			} else {
				// serialize the data object into a flattened map

				data = {
					pid: pid
				};

				serializeData(data, [], entry.data);
			}
		}


		// log to graylog

		client[channel](msg, details, data, timestamp);
	};
};

module.exports = GraylogWriter;

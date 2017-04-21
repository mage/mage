var async = require('async');


function Distributor(channelNames) {
	this.contextFilter = null;
	this.logCreators = [];
	this.writers = [];
	this.writerMap = {};
	this.channelNames = [];
	this.channelInput = {};  // channelName -> [LogCreator, LogCreator]

	for (var i = 0; i < channelNames.length; i += 1) {
		this.addChannel(channelNames[i]);
	}
}


// context

Distributor.prototype.setContextFilter = function (contexts) {
	this.contextFilter = contexts ? contexts.slice() : null;
};


// writers

Distributor.prototype.destroyWriters = function (cb) {
	var that = this;

	async.each(
		this.writers,
		function (writer, callback) {
			writer.setChannels([]);

			if (writer.destroy) {
				writer.destroy(callback);
			} else {
				setImmediate(callback);
			}
		}, function (error) {
			that.writers = [];
			that.writerMap = {};

			cb(error);
		}
	);
};


Distributor.prototype.setWriter = function (type, WriterClass, channelNames, cfg) {
	// we enable all channels on the writer, filtering happens at the logCreator level where
	// dummy loggers are put in place, or here in Distributor if a context filter is applied.

	var writer = this.writerMap[type];

	if (!writer) {
		writer = new WriterClass(cfg || {});
		this.writers.push(writer);
		this.writerMap[type] = writer;
	}

	if (writer.reconfigure) {
		writer.reconfigure(cfg || {});
	}

	writer.setChannels(channelNames);
};


// channels:

Distributor.prototype.addChannel = function (name) {
	if (this.isEnabled(name)) {
		return;
	}

	var logCreators = this.logCreators.slice();

	this.channelNames.push(name);
	this.channelInput[name] = logCreators;

	for (var i = 0; i < logCreators.length; i += 1) {
		logCreators[i].enableChannel(name);
	}
};


Distributor.prototype.removeChannel = function (name) {
	if (!this.isEnabled(name)) {
		return;
	}

	var index = this.channelNames.indexOf(name);
	if (index !== -1) {
		this.channelNames.splice(index, 1);
	}

	var logCreators = this.channelInput[name];
	if (logCreators) {
		for (var i = 0; i < logCreators.length; i += 1) {
			logCreators[i].disableChannel(name);
		}

		delete this.channelInput[name];
	}
};


Distributor.prototype.getChannels = function () {
	return this.channelNames.slice();
};


Distributor.prototype.isEnabled = function (name) {
	return this.channelNames.indexOf(name) !== -1;
};

/**
 * @deprecated
 */

Distributor.prototype.isActive = Distributor.prototype.isEnabled;


// log creators and their output

Distributor.prototype.addLogCreator = function (logCreator) {
	this.logCreators.push(logCreator);

	for (var i = 0; i < this.channelNames.length; i += 1) {
		var name = this.channelNames[i];

		this.channelInput[name].push(logCreator);

		if (this.isEnabled(name)) {
			logCreator.enableChannel(name);
		} else {
			logCreator.disableChannel(name);
		}
	}
};


Distributor.prototype.shouldSuppress = function (entry) {
	if (!this.contextFilter) {
		return false;
	}

	for (var i = 0; i < this.contextFilter.length; i += 1) {
		var context = this.contextFilter[i];

		if (entry.contexts && entry.contexts.indexOf(context) !== -1) {
			return false;
		}
	}

	return true;
};


Distributor.prototype.log = function (entry) {
	if (this.shouldSuppress(entry)) {
		return;
	}

	for (var i = 0; i < this.writers.length; i += 1) {
		var writer = this.writers[i];

		writer.log(entry);
	}
};


module.exports = Distributor;

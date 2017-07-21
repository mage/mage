// The LogCreator is the entrance point through which a channel is selected, and therefore is in
// charge of creating functions named after the channel, for example:
//   logCreator.error('my message')
// These channel functions can be called, but also used as API in order to pass context, details
// and data. If a channel is inactive, because no writer cares for it, the channel function returns
// a decoy function which accepts and ignores any additional context, details and data.

var LogEntry = require('./LogEntry');


function LogCreator(distributor) {
	this._contexts = null;
	this._distributor = distributor;

	distributor.addLogCreator(this);
}


LogCreator.prototype.enableChannel = function (name) {
	this.createChannelHandler(name);
};


LogCreator.prototype.disableChannel = function (name) {
	this.createChannelDecoy(name);
};


LogCreator.prototype.addContexts = function () {
	if (this._contexts) {
		this._contexts.push.apply(this._contexts, arguments);
	} else {
		this._contexts = Array.prototype.slice.call(arguments);
	}
};


LogCreator.prototype.context = function () {
	// clones self and augments with context

	var clone = new LogCreator(this._distributor);

	clone.addContexts.apply(clone, this._contexts);
	clone.addContexts.apply(clone, arguments);

	return clone;
};


LogCreator.prototype.createChannelHandler = function (channelName) {
	var that = this;
	var distributor = this._distributor;
	var contexts, details, data;

	var fn = function logMessage() {
		// calling the channel as a function sends off a log entry
		// arguments compose the message

		var entry = new LogEntry(channelName);
		var i;

		entry.addMessageArgs(arguments);

		if (that._contexts) {
			entry.addContexts(that._contexts);
		}

		if (contexts) {
			entry.addContexts(contexts);
			contexts = undefined;
		}

		if (details) {
			for (i = 0; i < details.length; i++) {
				entry.addDetails(details[i]);
			}

			details = undefined;
		}

		if (data) {
			entry.addData(data);

			data = undefined;
		}

		// send the entry to the writers

		distributor.log(entry);

		// return undefined
	};

	fn.context = function () {
		// each given argument is considered a context which will be added

		if (contexts) {
			contexts.push.apply(contexts, arguments);
		} else {
			contexts = Array.prototype.slice.call(arguments);
		}

		return fn;
	};

	fn.details = function () {
		// each call creates one line, the arguments of this call will be joined with a space

		if (details) {
			details.push(arguments);
		} else {
			details = [arguments];
		}

		return fn;
	};

	fn.data = function (label, value) {
		if (!label) {
			return fn;
		}

		if (!data) {
			data = [];
		}

		if (!value) {
			value = label;
			label = 'data';
		}

		data.push({ label, value });

		return fn;
	};

	fn.log = fn;

	this[channelName] = fn;
};


LogCreator.prototype.createChannelDecoy = function (channelName) {
	var decoy = function logMessage() {
		// do nothing
		// return undefined
	};

	decoy.context = function () {
		return decoy;
	};

	decoy.details = function () {
		return decoy;
	};

	decoy.data = function () {
		return decoy;
	};

	decoy.log = decoy;

	this[channelName] = decoy;
};


LogCreator.prototype.simulate = function (engine) {
	var simlib = require('./simulators/' + engine);

	return simlib.create(this);
};


module.exports = LogCreator;

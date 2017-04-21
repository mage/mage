// Writer is the super class for specific Writer types.
//
// Specific writer classes have been implemented for several services, including the obvious
// file and terminal. The Writer super class is in charge of asking the child classes to provide
// functions per relevant channel, so that the Distributor may call "log" on us and have the log
// entry propagate.

function Writer() {
	this.handlers = {}; // key: channelName, value: function that takes a LogEntry to write out
}


Writer.prototype.log = function (entry) {
	var fn = this.handlers[entry.channel];

	if (fn) {
		fn(entry);
	}
};


Writer.prototype.setChannels = function (newChannelNames) {
	// channelNames = ['debug', 'error', ...]

	this.handlers = {};

	// given the new channels, create write functions for them

	for (var i = 0; i < newChannelNames.length; i++) {
		var channelName = newChannelNames[i];

		this.handlers[channelName] = this.channelFunctionGenerator(channelName);
	}
};

module.exports = Writer;

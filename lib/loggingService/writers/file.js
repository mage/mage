var assert = require('assert');
var path = require('path');
var fs = require('fs');
var util = require('util');
var async = require('async');
var isMaster = require('cluster').isMaster;
var Writer = require('../Writer');
var loggingService = require('../');

var DEFAULT_LOGFILE = 'app.log';

var failureLogged = false;

function logWriteError(error) {
	if (!failureLogged) {
		console.error(error);
		failureLogged = true;
	}
}


function FileWriter(cfg) {
	Writer.call(this);

	this.path = cfg.path;
	this.mode = parseInt(cfg.mode || '0666', 8);
	this.jsonIndent = cfg.jsonIndent || 2;
	this.maxChannelNameLength = 0;
	this.channelHints = {};
	this.logStreams = {};
	this.fileNames = {};  // default: { DEFAULT_LOGFILE: "all" }

	// normalize fileNames per channel
	// input format: { fileName: channelRange (string or array), .. }
	// output format: { channelName: [fileName], .. }

	cfg.fileNames = cfg.fileNames || {};

	// by default { app.log: "all" } is part of the configuration

	if (!cfg.fileNames.hasOwnProperty(DEFAULT_LOGFILE)) {
		cfg.fileNames[DEFAULT_LOGFILE] = 'all';
	}

	var fileNames = Object.keys(cfg.fileNames);

	for (var i = 0; i < fileNames.length; i += 1) {
		var fileName = fileNames[i];
		var channelRanges = cfg.fileNames[fileName];
		var channelNames = loggingService.parseChannelList(channelRanges);

		for (var j = 0; j < channelNames.length; j += 1) {
			var channelName = channelNames[j];

			if (this.fileNames[channelName]) {
				this.fileNames[channelName].push(fileName);
			} else {
				this.fileNames[channelName] = [fileName];
			}
		}
	}
}


util.inherits(FileWriter, Writer);


FileWriter.prototype.getChannelHint = function (channelName) {
	var channelHint = this.channelHints[channelName];
	if (!channelHint) {
		// regenerate

		var len = this.maxChannelNameLength - channelName.length;
		var spaces = new Array(len + 1).join(' '); // +1 because spaces generated is length-1

		channelHint = ' ' + spaces + '<' + channelName + '> ';

		this.channelHints[channelName] = channelHint;
	}

	return channelHint;
};


FileWriter.prototype.getFileStream = function (fileName) {
	assert(fileName, 'No file name provided');
	assert(this.path, 'No base path provided');

	var stream = this.logStreams[fileName];
	if (stream) {
		return stream;
	}

	// open the file

	var filePath = path.join(this.path, fileName);
	var options = {
		flags: 'a',
		encoding: 'utf8',
		mode: this.mode
	};

	stream = fs.createWriteStream(filePath, options);

	stream.on('error', logWriteError);

	stream.once('open', function (fd) {
		// If the file already existed, the file mode will not have been set to what it was
		// configured to be. For that reason, we do it once right after opening the file.

		fs.fchmod(fd, options.mode, function (error) {
			if (error) {
				console.error(error);
			}
		});
	});

	this.logStreams[fileName] = stream;

	return stream;
};


FileWriter.prototype.destroy = function (cb) {
	var that = this;

	// end all file streams, in parallel

	var paths = Object.keys(that.logStreams);

	async.each(
		paths,
		function (path, callback) {
			var stream = that.logStreams[path];
			delete that.logStreams[path];

			// only call end() if the stream has been opened (ie: has a file descriptor)
			if (stream && stream.fd) {
				stream.end(callback);
			} else {
				callback();
			}
		},
		cb
	);
};


FileWriter.prototype.getStreams = function (channelName) {
	var fileNames = this.fileNames[channelName] || [];
	var streams = [];

	for (var i = 0; i < fileNames.length; i += 1) {
		var stream = this.getFileStream(fileNames[i]);

		if (streams.indexOf(stream) === -1) {
			streams.push(stream);
		}
	}

	return streams;
};


FileWriter.prototype.channelFunctionGenerator = function (channelName) {
	var streams = this.getStreams(channelName);

	// create a serializer function that will write its log argument to file

	var that = this;

	var jsonIndent = this.jsonIndent;
	var role = isMaster ? 'm' : 'w';
	var prefix = '';

	// Attach the role to the prefix
	prefix += role + '-';

	// Attach the padded PID to the prefix
	// See: https://github.com/mage/mage/issues/123
	prefix += ('' + process.pid + '     ').slice(0, 5) + ' - ';

	// channel hint reset

	if (channelName.length > this.maxChannelNameLength) {
		this.maxChannelNameLength = channelName.length;
		this.channelHints = {};
	}

	// generate the function that will do the writing

	return function (entry) {
		var msg = entry.message;

		// prefix contexts

		if (entry.contexts) {
			msg = '[' + entry.contexts.join(' ') + '] ' + msg;
		}

		// full message, indented

		if (entry.details) {
			msg += '\n' + entry.details.join('\n');
		}

		// additional info, formatted (JSON)

		if (entry.data) {
			for (const dataEntry of entry.data) {
				msg += `\n${dataEntry.label}: ` + JSON.stringify(dataEntry.value, null, jsonIndent);
			}
		}

		// We use the ISOString format for the date, it as written as an UTC date using the format
		// YYYY-MM-DDTHH:mm:ss.sssZ. It has the advantage to be easily parse-able by running
		// new Date(isostring)
		// Read more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString

		var output = prefix + (new Date(entry.timestamp)).toISOString() +
			that.getChannelHint(channelName) + msg + '\n';

		for (var i = 0; i < streams.length; i += 1) {
			streams[i].write(output);
		}
	};
};

module.exports = FileWriter;

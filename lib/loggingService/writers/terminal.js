var util = require('util');
var Writer = require('../Writer');
var isMaster = require('cluster').isMaster;
var chalk = require('chalk');

function TerminalWriter(cfg) {
	Writer.call(this);

	this.maxChannelNameLength = 0;
	this.channelHints = {};
	this.colorApi = null;
	this.reconfigure(cfg);
}


util.inherits(TerminalWriter, Writer);


TerminalWriter.prototype.reconfigure = function (cfg) {
	this.theme = cfg.theme || null;
	this.jsonIndent	= cfg.jsonIndent || 2;
	this.jsonOutput = cfg.jsonOutput || false;

	if (this.theme) {
		this.setTheme(this.theme);
	}
};


TerminalWriter.prototype.themes = {
	dark: {
		emergency: chalk.red.inverse.bold,
		alert: chalk.red,
		critical: chalk.red,
		error: chalk.red,
		warning: chalk.yellow,
		notice: chalk.green,
		info: chalk.blue,
		debug: chalk.blue,
		verbose: chalk.gray,
		time: chalk.gray.underline
	},
	light: {
		emergency: chalk.red.inverse.bold,
		alert: chalk.red.bold,
		critical: chalk.red.bold,
		error: chalk.red.bold,
		warning: chalk.yellow.bold,
		notice: chalk.green.bold,
		info: chalk.green.bold,
		debug: chalk.cyan.bold,
		verbose: chalk.cyan,
		time: chalk.cyan.underline
	},
	default: {
		emergency: chalk.red.inverse.bold,
		alert: chalk.red.bold.underline,
		critical: chalk.red.bold,
		error: chalk.red,
		warning: chalk.yellow,
		notice: chalk.green,
		info: chalk.blue.bold,
		debug: chalk.cyan,
		verbose: chalk.gray,
		time: chalk.magenta
	}
};


TerminalWriter.prototype.getChannelHint = function (channelName) {
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


TerminalWriter.prototype.channelFunctionGenerator = function (channelName) {
	// create a serializer function that will write its log argument to terminal

	var that = this;
	var stream = process.stderr;
	var jsonIndent = this.jsonIndent;
	var jsonOutput = this.jsonOutput;
	var role = isMaster ? 'm' : 'w';
	var prefix = '';
	var indent;
	var colorize;

	// Attach the role to the prefix
	prefix += role + '-';

	// Attach the padded PID to the prefix
	// See: https://github.com/mage/mage/issues/123
	prefix += ('' + process.pid + '     ').slice(0, 5) + ' - ';

	var colorFn = this.colorApi && this.colorApi[channelName];

	// channel hint reset

	if (channelName.length > this.maxChannelNameLength) {
		this.maxChannelNameLength = channelName.length;
		this.channelHints = {};
	}

	// timestamp output

	function getTime(ts) {
		function pad2(n) {
			return n < 10 ? '0' + n : n;
		}

		function pad3(n) {
			return n < 10 ? '00' + n : (n < 100 ? '0' + n : n);
		}

		return pad2(ts.getHours()) + ':' +
			pad2(ts.getMinutes()) + ':' +
			pad2(ts.getSeconds()) + '.' +
			pad3(ts.getMilliseconds());
	}

	if (colorFn) {
		indent = '\n' + chalk.inverse(' ') + ' ';

		colorize = function (str) {
			return colorFn(str).replace(/\n^/gm, indent);
		};
	} else {
		indent = '\n' + '  ';

		colorize = function (str) {
			return str.replace(/\n^/gm, indent);
		};
	}

	return function (entry) {
		if (jsonOutput) {
			stream.write(JSON.stringify(entry) + '\n');
			return;
		}

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

		// colorize the log entry

		msg = colorize(msg);

		var output = prefix + getTime(entry.timestamp) +
			that.getChannelHint(channelName) + msg + '\n';

		stream.write(output);
	};
};


TerminalWriter.prototype.addTheme = function (name, config) {
	this.themes[name] = config;
};


TerminalWriter.prototype.setTheme = function (name) {
	if (!chalk.supportsColor) {
		return;
	}

	var api = this.themes[name];

	if (!api) {
		throw new Error('No color theme found called: ' + name);
	}

	this.colorApi = api;
};


module.exports = TerminalWriter;

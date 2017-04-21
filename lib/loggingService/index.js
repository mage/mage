var mage = require('../mage');
var LogCreator = require('./LogCreator');
var Distributor = require('./Distributor');

// channels:

var channelConfiguration = {
	time: 0,
	verbose: 0,
	debug: 1,
	info: 2,
	notice: 3,
	warning: 4,
	error: 5,
	critical: 6,
	alert: 7,
	emergency: 8
};

var allChannelNames = Object.keys(channelConfiguration);

// create the distributor for log entries to writers

var distributor = new Distributor(allChannelNames);

// allow users to create new LogCreator instances

exports.createLogCreator = function () {
	return new LogCreator(distributor);
};


exports.listPeerDependencies = function () {
	return {
		'Log writer Graylog2': ['graylog2'],
		'Log writer Websocket': ['zmq']
	};
};


var writerPaths = {};


exports.addWriterType = function (typeName, requirePath) {
	writerPaths[typeName] = requirePath;
};


exports.getAllChannelNames = function () {
	return allChannelNames.slice();
};


exports.getLogLevels = function () {
	return channelConfiguration;
};


exports.has = function (channelName) {
	return distributor.isEnabled(channelName);
};


function channelToLogLevel(channelName) {
	return channelConfiguration[channelName] || 0;
}


exports.parseChannelList = function (list) {
	// list formats:
	// - falsy (yields empty array)
	// - "all" (yields all channels)
	// - "debug"
	// - ["time", ">=info"]

	var result = {}, m, operator, channelName, level;

	if (!list) {
		return [];
	}

	if (typeof list === 'string') {
		list = [list];
	}

	if (list.indexOf('all') !== -1) {
		return allChannelNames;
	}

	function addRange(from, through) {
		for (var i = 0, len = allChannelNames.length; i < len; i++) {
			var channelName = allChannelNames[i];

			var level = channelToLogLevel(channelName);

			if (level >= from && level <= through) {
				result[channelName] = true;
			}
		}
	}


	for (var i = 0, len = list.length; i < len; i++) {
		m = list[i].match(/^([<=>]{0,2})([a-z]+)$/i);
		if (!m) {
			continue;
		}

		operator = m[1];
		channelName = m[2];
		level = channelToLogLevel(channelName);

		switch (operator) {
		case '>=':
			addRange(level, Infinity);
			break;
		case '>':
			addRange(level + 1, Infinity);
			break;
		case '<=':
			addRange(0, level);
			break;
		case '<':
			addRange(0, level - 1);
			break;
		default:
			result[channelName] = true;
			break;
		}
	}

	return Object.keys(result);
};


exports.destroy = function (cb) {
	if (mage.core.logger) {
		mage.core.logger.debug('Destroying all log writers');
	}

	distributor.destroyWriters(cb);
};


exports.setup = function (cb) {
	// destroy every existing writer, so we can start over with a fresh configuration

	distributor.destroyWriters(function () {
		// extract configuration

		var cfg = mage.core.config.get(['logging', 'server'], {});
		var cfgTypes = Object.keys(cfg);

		// if nothing is configured, log to terminal

		if (cfgTypes.length === 0) {
			cfg = {
				terminal: {
					channels: ['>=verbose'],
					config: {
						jsonIndent: 2,
						theme: 'default'
					}
				}
			};

			cfgTypes = Object.keys(cfg);
		}

		// register the writers or update existing ones with new channels/configuration

		for (var i = 0; i < cfgTypes.length; i++) {
			var cfgType = cfgTypes[i];
			var info = cfg[cfgType];

			if (!info) {
				continue;
			}

			try {
				exports.addWriter(cfgType, info.channels, info.config);
			} catch (error) {
				mage.core.logger.emergency.data('configuration', info).log('Fatal configuration error:', error);
				return cb(error);
			}
		}

		cb();
	});
};


exports.filterContexts = function (contexts) {
	distributor.setContextFilter(contexts);
};


var verboseTerminal = false;

exports.enableVerboseTerminal = function () {
	verboseTerminal = true;
};


exports.addWriter = function (type, channelList, cfg) {
	// if a writer of this type already exists, reconfigure it

	if (type === 'terminal' && verboseTerminal) {
		channelList = 'all';
	}

	var channelNames = exports.parseChannelList(channelList);

	var writerPath = writerPaths[type];
	if (!writerPath) {
		throw new Error('Logger type ' + type + ' does not exist');
	}

	// creating a new writer

	var WriterClass = require(writerPath);

	distributor.setWriter(type, WriterClass, channelNames, cfg);
};


// register built-ins

exports.addWriterType('file', './writers/file');
exports.addWriterType('terminal', './writers/terminal');
exports.addWriterType('syslog', './writers/syslog');
exports.addWriterType('graylog', './writers/graylog');
exports.addWriterType('websocket', './writers/websocket');

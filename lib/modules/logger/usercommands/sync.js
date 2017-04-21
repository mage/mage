var mage = require('../../../mage');
var loggingService = mage.core.loggingService;

var writerTypes = ['console', 'server'];

var clientConfig;

function getClientConfig() {
	if (clientConfig) {
		return clientConfig;
	}

	var config = mage.core.config.get(['logging', 'html5'], {
		console: {
			channels: ['>=verbose']
		},
		server: {
			channels: ['>=verbose']
		}
	});

	var channelConfig = {};

	for (var i = 0; i < writerTypes.length; i += 1) {
		var writer = writerTypes[i];
		var writerConfig = config[writer];

		if (writerConfig && writerConfig.channels) {
			channelConfig[writer] = loggingService.parseChannelList(writerConfig.channels);
		}
	}

	clientConfig = {
		logLevels: loggingService.getLogLevels(),
		config: channelConfig,
		disableOverride: config.disableOverride
	};

	return clientConfig;
}


exports.acl = ['*'];

exports.execute = function (state, cb) {
	state.respond(getClientConfig());

	cb();
};

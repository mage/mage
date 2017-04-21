var mage = require('../../../mage');
var loggingService = mage.core.loggingService;

exports.acl = ['admin'];

exports.execute = function (state, cb) {
	var channelNames = loggingService.getAllChannelNames();

	state.respond(channelNames);
	cb();
};

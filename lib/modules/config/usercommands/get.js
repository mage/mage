var mage = require('../../../mage');

exports.acl = ['*'];

exports.execute = function (state, appName, baseUrl, cb) {
	const config = mage.config.get(appName, baseUrl);

	state.respond(config);

	cb();
};

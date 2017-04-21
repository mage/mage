var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, cb) {
	// just return the config as is
	state.respond(mage.core.config.get(['module', 'ident'], {}));
	cb();
};

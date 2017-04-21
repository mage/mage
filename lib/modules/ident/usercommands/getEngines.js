var mage = require('../../../mage');

exports.acl = ['*'];

exports.execute = function (state, cb) {
	state.respond(mage.ident.getPublicEngineList());
	cb();
};

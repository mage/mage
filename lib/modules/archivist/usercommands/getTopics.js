var mage = require('../../../mage');


exports.acl = ['admin'];

exports.execute = function (state, cb) {
	state.respond(mage.core.archivist.getTopics());

	cb();
};

var mage = require('../../../mage');
var uuid = require('node-uuid');

exports.acl = ['*'];

exports.execute = function (state, acl, cb) {
	if (!Array.isArray(acl)) {
		return state.error('invalidAclType', 'ACL has to be an array of strings', cb);
	}

	var allowCustomAcl = mage.isDevelopmentMode('customAccessLevel');
	var adminEverywhere = mage.isDevelopmentMode('adminEverywhere');
	var defaultAcl = adminEverywhere ? ['admin'] : ['*'];

	if (!allowCustomAcl && acl.length !== 1 &&  acl[0] !== defaultAcl[0]) {
		return state.error('auth', 'Custom access level is only possible in development mode.', cb);
	}

	var actorId = uuid();

	mage.session.register(state, actorId, null, { acl: acl });

	cb();
};

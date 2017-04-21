var mage = require('../../../mage');

// Unauthenticated login as a particular actor

// If executed by an authenticated user, its session will be tested for admin access.
// Alternatively, developmentMode will need to be turned on.

exports.acl = ['*'];

exports.execute = function (state, actorId, acl, cb) {
	if (!actorId) {
		return state.error(null, 'Missing actorId', cb);
	}

	if (!mage.isDevelopmentMode('loginAs')) {
		return state.error(null, 'Identity change is only allowed in development mode.', cb);
	}

	if (!Array.isArray(acl)) {
		return state.error('invalidAclType', 'ACL has to be an array of strings', cb);
	}

	var allowCustomAcl = mage.isDevelopmentMode('customAccessLevel');
	var adminEverywhere = mage.isDevelopmentMode('adminEverywhere');
	var defaultAcl = adminEverywhere ? ['admin'] : ['*'];

	if (!allowCustomAcl && acl.length !== 1 && acl[0] !== defaultAcl[0]) {
		return state.error('auth', 'Custom access level is only possible in development mode.', cb);
	}

	mage.session.register(state, actorId, null, { acl: acl });

	cb();
};

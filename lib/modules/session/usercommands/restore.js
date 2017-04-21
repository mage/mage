var mage = require('../../../mage');

exports.acl = ['*'];

exports.execute = function (state, sessionKey, cb) {
	mage.session.resolve(state, sessionKey, function (error, session) {
		if (!session) {
			error = error || 'invalidSession';
			return state.error(error, error, cb);
		}

		state.registerSession(session);

		session.setOnClient(state);

		cb();
	});
};

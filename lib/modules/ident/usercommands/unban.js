var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, userId, cb) {
	mage.ident.unban(state, userId, function (error) {
		if (error) {
			return state.error(error, error, cb);
		}

		cb();
	});
};

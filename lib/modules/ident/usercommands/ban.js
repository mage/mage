var mage = require('../../../mage');

exports.execute = function (state, userId, reason, cb) {
	mage.ident.ban(state, userId, reason, function (error) {
		if (error) {
			return state.error(error, error, cb);
		}

		cb();
	});
};

var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, engineName, credentials, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.updateCredentials(state, credentials, function (error) {
		if (error) {
			return state.error('ident', error, cb);
		}

		cb();
	});
};

var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, engineName, credentials, user, options, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.createUser(state, credentials, user, options, function (error, user) {
		if (error) {
			return state.error('ident', error, cb);
		}

		state.respond(user);

		cb();
	});
};

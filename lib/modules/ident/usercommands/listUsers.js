var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, engineName, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	engine.listUsers(state, function (error, users) {
		if (error) {
			return state.error('ident', error, cb);
		}

		state.respond(users);

		cb();
	});
};

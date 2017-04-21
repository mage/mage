var mage = require('../../../mage');

exports.acl = ['*'];

exports.execute = function (state, engineName, command, params, cb) {
	var engine;

	try {
		engine = mage.ident.getEngine(engineName);
	} catch (error) {
		return state.error('ident', error, cb);
	}

	if (!engine.run) {
		return state.error('ident', 'Engine has no run method', cb);
	}

	engine.run(state, command, params || {}, function (error, data) {
		if (error) {
			return state.error('ident', error, cb);
		}

		if (data) {
			state.respond(data);
		}

		cb();
	});
};

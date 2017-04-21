var mage = require('../../../mage');

exports.acl = ['*'];

exports.execute = function (state, clientTime, cb) {
	var delta = 0;

	if (typeof clientTime === 'number') {
		delta = clientTime - Date.now();
	}

	state.respond({
		delta: delta,
		timer: mage.time.getConfig()
	});

	cb();
};

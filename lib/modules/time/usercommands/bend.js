var mage = require('../../../mage');

exports.acl = ['admin'];

exports.execute = function (state, offset, accelerationFactor, startAt, cb) {
	// Some day, this will emit an event to every connected client that the world has changed, but
	// for now, we'll have to make due with an event to just the requesting user.

	mage.time.bend(offset, accelerationFactor, startAt);

	state.respond(mage.time.getConfig());

	cb();
};

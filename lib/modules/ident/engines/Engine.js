var assert = require('assert');

/**
 * Your engine will receive its name, config and a contextualized logger.
 * @constructor
 */

function Engine(/* name, cfg, logger */) {
}

/**
 * The auth method of the engine. That should always be implemented. This function is called by the
 * "mage.ident.check" function on the client.
 *
 * @param {State}    state       The state object
 * @param {Object}   credentials Parameters that are meaningful for your engine come from here
 * @param {Function} cb
 */
Engine.prototype.auth = function (state, credentials, cb) {
	state.error('ident', new Error('auth not implemented by this ident engine'), cb);
};


Engine.prototype.ensureCredentials = function (credentials) {
	assert(credentials, 'invalidCredentials');
	assert.equal(typeof credentials.username, 'string', 'invalidUsername');
	assert.equal(typeof credentials.password, 'string', 'invalidPassword');
};


module.exports = Engine;

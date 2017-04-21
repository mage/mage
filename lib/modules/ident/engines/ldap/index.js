var assert = require('assert');
var util = require('util');
var uuid = require('node-uuid');

var requirePeer = require('codependency').get('mage');
var ldap = requirePeer('ldapjs');

var Engine = require('../Engine');
var mage = require('../../../../mage');

function Ldap(name, cfg, logger) {
	assert.ok(cfg, 'No configuration given.');
	assert.ok(cfg.url, 'No URL configured.');
	assert.equal(typeof cfg.url, 'string', 'The URL must be a string.');
	assert.ok(cfg.baseDn, 'No baseDn configured.');
	assert.equal(typeof cfg.baseDn, 'string', 'The baseDn must be a string.');

	this.name = name;
	this.cfg = cfg;
	this.logger = logger;

	if (!this.cfg.ephemeral) {
		this.topic = cfg.topic || 'ldap';

		mage.core.archivist.assertTopicAbilities(this.topic, ['dn'], ['set', 'get']);
	}
}

util.inherits(Ldap, Engine);

/**
 * Distinguished Names (DNs) escaping according to IBM spec
 *
 * @link http://publib.boulder.ibm.com/infocenter/iseries/v5r3/index.jsp?topic=%2Frzahy%2Frzahyunderdn.htm
 * @param {string} str The DN to escape
 * @returns {string}
 */
function dnEscape(str) {
	return str.replace(/([\\,=\+<>#;"])/g, '\\$1');
}


Ldap.prototype.getUser = function (state, dn, cb) {
	var topic = this.topic;
	var index = { dn: dn };
	var options = { optional: true };

	state.archivist.get(topic, index, options, function (error, user) {
		if (!error && !user) {
			error = 'invalidDn';
		}

		return cb(error, user);
	});
};

Ldap.prototype.createUser = function (state, dn, userId, options, cb) {
	options = options || {};

	// for backward compatibility
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}

	var that = this;

	userId = userId || uuid.v4();

	this.getUser(state, dn, function (error, user) {
		if (user) {
			return cb('alreadyExists');
		}

		if (error && error !== 'invalidDn') {
			return cb(error);
		}

		var newUser = {
			userId: userId,
			dn: dn
		};

		var topic = this.topic;
		var index = { dn: dn };

		// We add here even though we have exists check to avoid race conditions
		state.archivist.add(topic, index, newUser);

		var authSource = {};
		authSource[that.name] = dn;

		options.doNotCreate = that.cfg.doNotCreate;

		mage.ident.addAuthSources(state, userId, authSource, options, function (error) {
			cb(error, userId);
		});
	});
};

Ldap.prototype.auth = function (state, credentials, cb) {
	try {
		this.ensureCredentials(credentials);
	} catch (e) {
		return cb(e);
	}

	var username = credentials.username;
	var password = credentials.password;

	// we need to create a client every time

	this.logger.debug('Connecting to', this.cfg.url);

	var client;

	try {
		client = ldap.createClient({ url: this.cfg.url, connectTimeout: 10000 });
	} catch (error) {
		return cb(error);
	}

	// identify on the network

	var uidAttr = this.cfg.uidAttr || 'uid';
	var dn = uidAttr + '=' + dnEscape(username) + ',' + this.cfg.baseDn;

	client.bind(dn, password, function (error) {
		if (error) {
			return state.error('ident', error.message, cb);
		}

		// disconnect

		client.unbind();

		var userId = uuid.v4();

		cb(null, userId, dn);
	});
};


/**
 * Setup function for ldap engine for the ident module
 *
 * @param {string} name - The name for this engine instance
 * @param {Object} cfg - Configuration for ident module
 * @param {Object} logger - Mage logger
 * @param {Function} cb - Callback function
 */
exports.setup = function (name, cfg, logger, cb) {
	var instance;

	try {
		instance = new Ldap(name, cfg, logger);
	} catch (err) {
		return cb(err);
	}

	cb(null, instance);
};

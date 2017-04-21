var assert = require('assert');
var crypto = require('crypto');
var util = require('util');
var uuid = require('node-uuid');

var mage = require('../../../../mage');

var Engine = require('../Engine');
var hashes = require('./hashes');

var DEFAULT_SALT_SIZE = 32;

function UserPassword(name, cfg, logger) {
	this.name = name;
	this.cfg = cfg;
	this.logger = logger;

	this.topic = this.cfg.topic || this.name;

	mage.core.archivist.assertTopicAbilities(this.topic, ['username'], ['set', 'get']);

	// Set up a hash function based on config

	// Remember that classic hashing is weak, even with a salt,
	// you should use hmac or pbkdf2 if possible

	var hashName;

	for (var id in hashes) {
		if (hashes.hasOwnProperty(id) && this.cfg.hasOwnProperty(id)) {
			hashName = id;
			break;
		}
	}

	assert(hashName, 'You must configure the "' + this.name + '" userpass engine with: "hash", "hmac" or "pbkdf2".');

	this.hashMethod = hashes[hashName](this.cfg[hashName], this.logger);
}

util.inherits(UserPassword, Engine);


UserPassword.prototype.auth = function (state, credentials, cb) {
	try {
		this.ensureCredentials(credentials);
	} catch (e) {
		mage.logger.error.data(e).log('Invalid credentials');
		return cb(e);
	}

	var that = this;

	this.getUser(state, credentials.username, function (error, user) {
		if (error) {
			return cb(error);
		}

		try {
			assert.equal(that.hashMethod(credentials.password, user.salt), user.password, 'invalidPassword');
		} catch (e) {
			return cb(e);
		}

		return cb(null, user.userId);
	});
};


UserPassword.prototype.createUser = function (state, credentials, userId, options, cb) {
	options = options || {};

	// for backward compatibility
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}

	try {
		this.ensureCredentials(credentials);
	} catch (e) {
		return cb(e);
	}

	var username = credentials.username;
	userId = userId || uuid.v4();

	var topic = this.topic;
	var index = { username: username };

	var that = this;

	state.archivist.exists(topic, index, function (error, exists) {
		if (exists) {
			return cb('alreadyExists');
		}

		if (error) {
			mage.logger.error(error);
			return cb(error);
		}

		var newUser = {
			username: username,
			userId: userId
		};

		// create a salt, 32 bytes (256 bits) is a safe default, you just want something that is
		// long enough so that salt + password is probably not in a hash database

		var saltSize = that.cfg.saltSize || DEFAULT_SALT_SIZE;

		crypto.randomBytes(saltSize, function (error, salt) {
			if (error) {
				return cb(error);
			}

			newUser.password = that.hashMethod(credentials.password, salt);
			newUser.salt = salt.toString('hex');

			// We add here even though we have exists check to avoid race conditions
			state.archivist.add(topic, index, newUser);

			var authSource = {};
			authSource[that.name] = username;

			options.doNotCreate = that.cfg.doNotCreate;

			mage.ident.addAuthSources(state, userId, authSource, options, function (error) {
				cb(error, userId);
			});
		});
	});
};


UserPassword.prototype.getUser = function (state, username, cb) {
	if (!username) {
		return cb('invalidUsername');
	}

	var topic = this.topic;
	var index =  { username: username };
	var options = { optional: true, mediaTypes: ['application/json'] };

	state.archivist.get(topic, index, options, function (error, user) {
		if (!user) {
			error = 'invalidUsername';
		}

		cb(error, user);
	});
};


/**
 * Update user credentials
 * Note: this does not handle locking etc, so if you need to manage race
 * conditions you will need to do so before calling this function.
 *
 * @param {State} state
 * @param {Object} credentials
 * @param {Function} cb
 */
UserPassword.prototype.updateCredentials = function (state, credentials, cb) {
	var that = this;

	this.getUser(state, credentials.username, function (error, user) {
		if (error) {
			return cb(error);
		}

		var topic = that.topic;
		var index = { username: credentials.username };

		var saltSize = that.cfg.saltSize || DEFAULT_SALT_SIZE;

		crypto.randomBytes(saltSize, function (error, salt) {
			if (error) {
				return cb(error);
			}

			user.password = that.hashMethod(credentials.password, salt);
			user.salt = salt.toString('hex');

			state.archivist.set(topic, index, user);

			return cb();
		});
	});
};


UserPassword.prototype.listUsers = function (state, cb) {
	var topic = this.topic;

	state.archivist.list(topic, {}, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		var items = indexes.map(function (index) {
			return { topic: topic, index: index };
		});

		state.archivist.mget(items, { mediaTypes: ['application/json'] }, function (error, users) {
			if (error) {
				return cb(error);
			}

			var userIds = users.map(function (user) {
				return user.userId;
			});

			cb(null, userIds);
		});
	});
};


exports.setup = function (name, cfg, logger, cb) {
	var instance;

	logger.context('ident', name);

	try {
		instance = new UserPassword(name, cfg, logger);
	} catch (error) {
		return cb(error);
	}

	cb(null, instance);
};

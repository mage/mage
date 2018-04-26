'use strict';

/** @module auth */

const memoize = require('memoizee');
const uuid = require('node-uuid').v4;
const hashes = require('./hashes');

hashes.register('hash', require('./hashes/types/Hash'));
hashes.register('hmac', require('./hashes/types/Hmac'));
hashes.register('pbkdf2', require('./hashes/types/Pbkdf2'));


// error classes

/**
 * @classdesc UserNotFoundError
 */
class UserNotFoundError extends Error {
	/**
	 * @constructor
	 * @param {string} username
	 */
	constructor(username) {
		super(`User "${username}" not found`);
		this.name = 'UserNotFoundError';
		this.code = 'invalidUsernameOrPassword';
	}
}

/**
 * @classdesc InvalidPasswordError
 */
class InvalidPasswordError extends Error {
	/**
	 * @constructor
	 * @param {string} username
	 */
	constructor(username) {
		super(`Password for user "${username}" incorrect`);
		this.name = 'InvalidPasswordError';
		this.code = 'invalidUsernameOrPassword';
	}
}

/**
 * @classdesc UserAlreadyExistsError
 */
class UserAlreadyExistsError extends Error {
	/**
	 * @constructor
	 * @param {string} username
	 */
	constructor(username) {
		super(`User with username "${username}" already exists`);
		this.name = 'UserAlreadyExistsError';
		this.code = 'userExists';
	}
}


/**
 * Returns the session module (overridden during unit tests)
 *
 * @returns {Object}
 */
/* istanbul ignore next */
exports.getSessionModule = memoize(function () {
	return require('lib/mage').session;
});

/**
 * Returns the hash configuration (overridden during unit tests)
 *
 * @returns {Object}
 */
/* istanbul ignore next */
exports.getHashConfiguration = memoize(function () {
	return require('lib/mage').core.config.get(['module', 'auth', 'hash']);
});

/**
 * Returns the archivist topic that users are stored under (overridden during unit tests)
 *
 * @returns {string}
 */
/* istanbul ignore next */
exports.getArchivistTopic = memoize(function () {
	return require('lib/mage').core.config.get(['module', 'auth', 'topic']);
});

/**
 * Verifies that archivist has the required configuration for the configured topic (overridden during unit tests)
 *
 * @param {string} topic         The topic under which users are stored
 * @param {string[]} index       The index under which users are stored
 * @param {string[]} operations  The archivist operations that must be supported by the vaults this topic uses
 */
/* istanbul ignore next */
exports.checkArchivistConfiguration = function (topic, index, operations) {
	require('lib/mage').core.archivist.assertTopicAbilities(topic, ['username'], operations);
};


/**
 * Module setup
 *
 * @param {State} state
 * @param {Function} cb       Receives (error)
 */
exports.setup = function (state, cb) {
	try {
		exports.checkArchivistConfiguration(exports.getArchivistTopic(), ['username'], ['set', 'get']);
	} catch (error) {
		return state.error(error.code, error, cb);
	}

	return cb();
};


function findUser(state, username, cb) {
	const topic = exports.getArchivistTopic();
	const index = { username: username };
	const options = {
		optional: true,
		mediaTypes: ['application/json']
	};

	state.archivist.get(topic, index, options, cb);
}

function storeUser(state, user) {
	const topic = exports.getArchivistTopic();
	const index = { username: user.username };
	const mediaType = 'application/json';
	const encoding = 'live';

	state.archivist.set(topic, index, user, mediaType, encoding);
}


/**
 * Attempts to authenticate a user with the given credentials.
 * This does not create a session, it merely verifies the credentials and returns userID and ACL information.
 *
 * @param {State} state
 * @param {string} username
 * @param {string} password
 * @param {Function} cb       Receives (error, userId, acl)
 */
exports.authenticate = function (state, username, password, cb) {
	// locate the user in the database

	findUser(state, username, function (error, user) {
		if (error) {
			return cb(error);
		}

		// user not found

		if (!user) {
			return cb(new UserNotFoundError(username));
		}

		// password hash check

		let hash;

		try {
			hash = hashes.create(exports.getHashConfiguration(), user.hash);
		} catch (error) {
			return cb(error);
		}

		hash.isEqual(password, function (error, isEqual) {
			if (error) {
				return cb(error);
			}

			// invalid password

			if (!isEqual) {
				return cb(new InvalidPasswordError(username));
			}

			// successful authentication! return the userId and the user's ACL

			return cb(null, user.userId, user.acl);
		});
	});
};


/**
 * Attempts to login a user with the given credentials
 *
 * @param {State} state
 * @param {string} username
 * @param {string} password
 * @param {Function} cb       Receives (error, session)
 */
exports.login = function (state, username, password, cb) {
	// authenticate username and password

	exports.authenticate(state, username, password, function (error, userId, acl) {
		if (error) {
			return cb(error);
		}

		// create and return a new session

		let session;

		try {
			session = exports.getSessionModule().register(state, userId, null, { acl: acl });
		} catch (error) {
			return cb(error);
		}

		return cb(null, session);
	});
};


/**
 * Registers a session with given user ID and ACL and does not persist any data to represent this user,
 * beyond the session itself.
 *
 * @param {State} state
 * @param {Object} options
 * @param {string|number} [options.userId]   Optional user ID. Default: a new UUID
 * @param {string[]} [options.acl]           Optional ACL array. Default: empty array
 * @returns {Object}                         The created session
 */
exports.loginAnonymous = function (state, options) {
	const userId = (options && options.userId) || uuid();
	const acl = (options && options.acl) || [];

	// create and return a new session

	return exports.getSessionModule().register(state, userId, null, { acl: acl });
};

/**
 * Generates a hashed password.
 * @param {string} password Password to hash
 * @param {Function} cb Receives (error, hashedPassword)
 */
function makePasswordHash(password, cb) {
	try {
		const hash = hashes.create(exports.getHashConfiguration());
		hash.fill(password, function (error) {
			cb(error, hash);
		});
	} catch (error) {
		return cb(error);
	}
}

/**
 * Create a new user with the given credentials. The credentials are first encrypted, then stored.
 *
 * It's strongly advised to provide ACL for this user, as on the subsequent login, these will be the
 * ACL that are provided to the session. The default ACL is an empty array.
 *
 * A user ID may be provided, but if a new UUID will suffice, you don't have to provide one.
 *
 * @param {State} state
 * @param {string} username
 * @param {string} password
 * @param {Object} options
 * @param {string|number} [options.userId]   Optional user ID. Default: a new UUID
 * @param {string[]} [options.acl]           Optional ACL array. Default: empty array
 * @param {Function} cb                      Receives (error, userId)
 */
exports.register = function (state, username, password, options, cb) {
	const userId = (options && options.userId) || uuid();
	const acl = (options && options.acl) || [];

	findUser(state, username, function (error, user) {
		if (error) {
			return cb(error);
		}

		if (user) {
			return cb(new UserAlreadyExistsError(username));
		}

		makePasswordHash(password, function (error, hash) {
			if (error) {
				return cb(error);
			}

			const user = {
				userId: userId,
				username: username,
				acl: acl,
				hash: hash.toJSON()
			};
			storeUser(state, user);

			return cb(null, userId);
		});
	});
};

/**
 * Sets the password for a given user.
 * @param {*} state
 * @param {*} username
 * @param {*} newPassword
 * @param {*} cb Receives (error)
 */
exports.changePassword = function (state, username, newPassword, cb) {
	findUser(state, username, function (error, user) {
		if (error) {
			return cb(error);
		}

		if (!user) {
			return cb(new UserNotFoundError(username));
		}

		makePasswordHash(newPassword, function (error, hash) {
			if (error) {
				return cb(error);
			}

			user.hash = hash;
			storeUser(state, user);
			return cb(null);
		});
	});
};

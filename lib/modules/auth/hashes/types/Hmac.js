'use strict';

const crypto = require('crypto');
const BaseHash = require('../BaseHash');

const BINARY_ENCODING = 'hex';

/**
 * @classdesc HMAC hashing class
 */
class Hmac extends BaseHash {
	/**
	 * @constructor
	 * @param {Object} cfg         Application configuration for the auth module
	 * @param {Object} [hashData]  Previously stored hash data (from Hash.toJSON)
	 */
	constructor(cfg, hashData) {
		super(hashData, BINARY_ENCODING);

		if (!cfg || !cfg.key) {
			throw new Error('Hmac API requires a "key" to be configured');
		}

		this.algorithm = (hashData && hashData.algorithm) || (cfg && cfg.algorithm);
		this.key = Buffer.isBuffer(cfg.key) ? cfg.key : new Buffer(cfg.key, BINARY_ENCODING);

		if (!this.algorithm) {
			throw new Error('Hmac API requires an "algorithm" to be configured');
		}
	}

	/**
	 * Returns a serializable object that contains all data (except password) with which it can be recreated.
	 * However we do not return the key, as it's private and should not be stored in the database.
	 * See: https://www.owasp.org/index.php/Password_Storage_Cheat_Sheet#Leverage_Keyed_functions
	 *
	 * @returns {Object}  The hash and all parameters with which it was generated
	 */
	toJSON() {
		return {
			type: 'hmac',
			algorithm: this.algorithm,
			salt: this._getSalt().toString(BINARY_ENCODING),
			hash: this._getHash().toString(BINARY_ENCODING)
		};
	}

	/**
	 * Generates a hash out of the password and salt
	 *
	 * @protected
	 * @param {string} password
	 * @param {Buffer} salt
	 * @param {Function} cb     Receives (error, hash)
	 */
	_generateHash(password, salt, cb) {
		let result;

		try {
			const hash = crypto.createHmac(this.algorithm, this.key);

			hash.update(salt);
			hash.update(password);

			result = hash.digest();
		} catch (error) {
			return cb(error);
		}

		return cb(null, result);
	}
}

module.exports = Hmac;

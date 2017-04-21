'use strict';

const crypto = require('crypto');
const BaseHash = require('../BaseHash');

const BINARY_ENCODING = 'hex';
const DEFAULT_ITERATIONS = 10000;
const DEFAULT_KEY_LENGTH = 20;


/**
 * @classdesc PBKDF2 hashing class
 *
 * PBKDF2 is the recommended way to hash passwords (see also:
 * https://www.owasp.org/index.php/Password_Storage_Cheat_Sheet#Leverage_an_adaptive_one-way_function), but is slow.
 * We may want to limit password length to a certain length. See this issue in django about why:
 * https://www.djangoproject.com/weblog/2013/sep/15/security/
 */
class Pbkdf2 extends BaseHash {
	/**
	 * @constructor
	 * @param {Object} cfg         Application configuration for the auth module
	 * @param {Object} [hashData]  Previously stored hash data (from Hash.toJSON)
	 */
	constructor(cfg, hashData) {
		super(hashData, BINARY_ENCODING);

		this.algorithm = (hashData && hashData.algorithm) || (cfg && cfg.algorithm);
		this.iterations = (hashData && hashData.iterations) || (cfg && cfg.iterations) || DEFAULT_ITERATIONS;
		this.keyLength = (hashData && hashData.keyLength) || (cfg && cfg.keyLength) || DEFAULT_KEY_LENGTH;

		if (!this.algorithm) {
			throw new Error('Pbkdf2 API requires an "algorithm" to be configured');
		}
	}

	/**
	 * Returns a serializable object that contains all data (except password) with which it can be recreated.
	 *
	 * @returns {Object}  The hash and all parameters with which it was generated
	 */
	toJSON() {
		return {
			type: 'pbkdf2',
			iterations: this.iterations,
			algorithm: this.algorithm,
			keyLength: this.keyLength,
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
		try {
			// can throw in the case of an invalid algoritm
			crypto.pbkdf2(password, salt, this.iterations, this.keyLength, this.algorithm, cb);
		} catch (error) {
			cb(error);
		}
	}
}

module.exports = Pbkdf2;

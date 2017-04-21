'use strict';

const crypto = require('crypto');
const BaseHash = require('../BaseHash');

const BINARY_ENCODING = 'hex';


/**
 * @classdesc Simple hashing class
 *
 * This is the least secure hashing strategy, as over time all hashing algorithms have shown weaknesses.
 * Use with caution (if at all).
 */
class Hash extends BaseHash {
	/**
	 * @constructor
	 * @param {Object} cfg         Application configuration for the auth module
	 * @param {Object} [hashData]  Previously stored hash data (from Hash.toJSON)
	 */
	constructor(cfg, hashData) {
		super(hashData, BINARY_ENCODING);

		this.algorithm = (hashData && hashData.algorithm) || (cfg && cfg.algorithm);

		if (!this.algorithm) {
			throw new Error('Hash API requires an "algorithm" to be configured');
		}
	}

	/**
	 * Returns a serializable object that contains all data (except password) with which it can be recreated.
	 *
	 * @returns {Object}  The hash and all parameters with which it was generated
	 */
	toJSON() {
		return {
			type: 'hash',
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
			const hash = crypto.createHash(this.algorithm);

			hash.update(salt);
			hash.update(password);

			result = hash.digest();
		} catch (error) {
			return cb(error);
		}

		return cb(null, result);
	}
}

module.exports = Hash;

'use strict';

const crypto = require('crypto');

const DEFAULT_SALT_SIZE = 32;


/**
 * @classdesc Base class for hashing algorithm classes
 */
class BaseHash {
	/**
	 * @constructor
	 * @param {Object} [hashData]  Previously stored hash data (from Hash.toJSON)
	 * @param {string} encoding    The encoding used for conversion between Buffers and strings
	 */
	constructor(hashData, encoding) {
		hashData = hashData || {};

		this.salt = hashData.salt ? new Buffer(hashData.salt, encoding) : null;
		this.hash = hashData.hash ? new Buffer(hashData.hash, encoding) : null;
	}

	/**
	 * Generates a salt, hashes the password and remembers the result
	 *
	 * @param {string} password  The password to hash
	 * @param {Function} cb      Receives (error)
	 */
	fill(password, cb) {
		this._generateSalt((error, salt) => {
			if (error) {
				return cb(error);
			}

			this._generateHash(password, salt, (error, hash) => {
				if (error) {
					return cb(error);
				}

				this.salt = salt;
				this.hash = hash;

				return cb();
			});
		});
	}

	/**
	 * Hashes the password with a known salt and compares it to the known hash
	 *
	 * @param {string} password  The password to hash and compare against
	 * @param {Function} cb      Receives (error, boolean)
	 */
	isEqual(password, cb) {
		this._generateHash(password, this.salt, (error, hash) => {
			if (error) {
				return cb(error);
			}

			return cb(null, Buffer.compare(hash, this.hash) === 0);
		});
	}

	/**
	 * Returns the known salt
	 *
	 * @protected
	 * @throws {Error}     Thrown if the salt has not been set
	 * @returns {Buffer}   The known salt
	 */
	_getSalt() {
		if (!this.salt) {
			throw new Error('Salt is missing');
		}

		return this.salt;
	}

	/**
	 * Returns the known hash
	 *
	 * @protected
	 * @throws {Error}     Thrown if the hash has not been set
	 * @returns {Buffer}   The known hash
	 */
	_getHash() {
		if (!this.hash) {
			throw new Error('Hash is missing');
		}

		return this.hash;
	}

	/**
	 * Returns a serializable object that contains all data (except password) with which it can be recreated.
	 *
	 * @abstract
	 * @returns {Object}  The hash and all parameters with which it was generated
	 */
	toJSON() {
		throw new Error('Hash class *must* implement toJSON()');
	}


	/**
	 * Generates a hash out of the password and salt
	 * May be implemented by the hash algorithm class
	 *
	 * @protected
	 * @param {string} password
	 * @param {Buffer} salt
	 * @param {Function} cb     Receives (error, hash)
	 */
	_generateSalt(cb) {
		crypto.randomBytes(DEFAULT_SALT_SIZE, cb);
	}

	/**
	 * Generates a hash out of the password and salt
	 * Must be implemented by the hash algorithm class
	 *
	 * @protected
	 * @abstract
	 * @param {string} password
	 * @param {Buffer} salt
	 * @param {Function} cb     Receives (error, hash)
	 */
	_generateHash() {
		throw new Error('Hash class *must* implement _generateHash(password, salt, cb)');
	}
}

module.exports = BaseHash;

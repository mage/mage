'use strict';

const types = {};

/**
 * Register a class that implements a new hashing type
 *
 * @throws {TypeError}       Throws if name or Class arguments are invalid
 * @param {string} name      The name of the type
 * @param {Function} Class   A class constructor
 */
exports.register = function (name, Class) {
	if (typeof name !== 'string') {
		throw new TypeError(`Expected "name" to be a string, found: ${typeof name}`);
	}

	if (typeof Class !== 'function') {
		throw new TypeError(`Expected "Class" to be a class (constructor), found: ${typeof Class}`);
	}

	types[name] = Class;
};


/**
 * Create a new hash-class instance
 *
 * @throws {Error}             Throws if configuration or hashData arguments are invalid
 * @param {Object} cfg         Configuration for the hash-object
 * @param {Object} [hashData]  Optional hash data if this hash-object is to handle a previously generated hash
 * @returns {Object}
 */
exports.create = function (cfg, hashData) {
	if (!cfg) {
		throw new Error('No hash configuration provided');
	}

	if (!cfg.type) {
		throw new Error('Expected "type" configuration');
	}

	const Class = types[cfg.type];

	if (!Class) {
		throw new Error(`Unsupported hash-type: "${cfg.type}"`);
	}

	return new Class(cfg, hashData);
};

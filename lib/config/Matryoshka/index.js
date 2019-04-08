'use strict';

const deepCopy = require('wizcorp-deep-copy.js');

/**
 * @module Matryoshka
 */

/**
 * Make a matryoshka container for an some data. Objects are nested.
 *
 * @param {*}       value   Any value to be matryoshkaised.
 * @param {string}  source  The source of the data (a file path).
 * @param {boolean} shallow Only wrap at the top level. For internal use only.
 * @alias module:Matryoshka
 */

class Matryoshka {
	constructor(value, source, shallow) {
		this.source = source;

		// Primitive values and arrays are treated as scalars.
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			this.value = value;
			this.type = 'scalar';

			return;
		}

		// Elements in objects are placed in containers.
		this.type = 'object';

		if (shallow) {
			this.value = value;

			return;
		}

		this.value = {};

		for (const key of Object.keys(value)) {
			this.value[key] = new Matryoshka(value[key], source);
		}
	}

	/**
	 * Simple getter. Nothing to see here.
	 *
	 * @return {*} Contained value.
	 */

	getValue() {
		return this.value;
	}

	/**
	 * Get the type of the matryoshka. The two types are:
	 *
	 *  - object
	 *  - scalar
	 *
	 * These reflect the structure of the data. For example, null is not an object in this system, it is
	 * a scalar. The types are exclusive, so arrays are not considered to be objects. This is to aid in
	 * determining how copies are performed etc.
	 *
	 * @return {String} Matryoshka type.
	 */

	getType() {
		return this.type;
	}

	/**
	 * Return the source of origin for contained data.
	 *
	 * @return {string} The source of a value (generally a file)
	 */

	getSource() {
		return this.source;
	}

	/**
	 * Use a path to tunnel down through a Matryoshka instance. It returns the Matryoshka from the point
	 * indexed by the path.
	 *
	 * @param  {string[]}             path   A tunnel path.
	 * @return {Matryoshka|undefined}        The Matryoshka from the point addressed by the path.
	 */

	tunnel(path) {
		if (!Array.isArray(path)) {
			throw new TypeError('Addressing must be done with an array of strings');
		}

		// If the path is empty, just return this Matryoshka. This can happen if the original path was empty.
		if (path.length === 0) {
			return this;
		}

		const pathSegment = path[0];

		if (typeof pathSegment !== 'string') {
			throw new TypeError('Path segment was not a string: ' + pathSegment);
		}

		if (!this.value) {
			return;
		}

		const child = this.value[pathSegment];

		if (child && child instanceof Matryoshka) {
			// Tunnel into the child with the remaining path.
			return child.tunnel(path.slice(1));
		}

		// If the child is not a Matryoshka, then we can't do anything with it.
		return;
	}

	/**
	 * Get the raw form of configuration from a particular key down.
	 *
	 * @param  {string[]} path       A list of keys to dig into the abstract raw object.
	 * @param  {*}        defaultVal In the event that there is no data at the path given, return this.
	 * @return {*}                   The addressed raw value or defaultVal.
	 */

	get(path, defaultVal) {
		const obj = this.tunnel(path);

		return obj ? obj.getRaw() : defaultVal;
	}

	/**
	 * Get the source of the configuration at some depth.
	 *
	 * @param  {string[]} path A path to address data within a Matryoshka instance.
	 * @return {*}             The source information for the addressed key.
	 */

	getSourceWithPath(path) {
		const obj = this.tunnel(path);

		if (obj) {
			return obj.source;
		}
	}

	/**
	 * Get a unique list of all sources of the configuration at a particular depth for itself and all children.
	 *
	 * @param  {string[]} path A path to address data within a Matryoshka instance.
	 * @return {string[]}      The sources information for the addressed key and its children.
	 */

	getAllSourcesWithPath(path) {
		const obj = this.tunnel(path);

		let sources = [];

		if (!obj) {
			return sources;
		}

		sources.push(obj.source);

		if (obj.type !== 'object') {
			return sources;
		}

		for (const key of Object.keys(obj.value)) {
			sources = sources.concat(obj.getAllSourcesWithPath([key]));
		}

		// Returns an array with unique elements from a given array.
		const dedupe = array => Array.from(new Set(array));

		// remove duplicates
		return dedupe(sources);
	}

	/**
	 * Get the raw representation of the data in a matryoshka. As matryoshkas nest, this essentially
	 * dematryoshikisizes.
	 *
	 * @return {*} Get the raw value of something contained in a matryoshka. This is recursive.
	 */

	getRaw() {
		return getRawRecursive(this);
	}

	/**
	 * A copy constructor in C++ parlance. Makes a complete copy. No references in common with original.
	 *
	 * @return {Matryoshka} A fresh, deep copy of the original matryoshka.
	 */

	copy() {
		// Non-objects are subjected to a deep copy (arrays are treated as values).
		if (this.type !== 'object') {
			return new Matryoshka(deepCopy(this.value), this.source, true);
		}

		// Objects need to be copied key-by-key.
		const toReturn = {};

		for (const key of Object.keys(this.value)) {
			toReturn[key] = this.value[key].copy();
		}

		return new Matryoshka(toReturn, this.source, true);
	}

	/**
	 * An extended merge. This can take any number of arguments, in order of increasing importance.
	 * All arguments must be matryoshka.
	 *
	 * @return {Matryoshka} The resulting matryoshka.
	 */

	static merge() {
		if (!arguments.length) {
			throw new Error('Merge takes at least one Matryoshka instance.');
		}

		let merged;

		for (const m of arguments) {
			if (!(m instanceof Matryoshka)) {
				throw new TypeError('Arguments must be matryoshka instances.');
			}

			merged = merge(merged, m);
		}

		return merged;
	}
}

/**
 * Recursively unpeel a matryoshka to recover the raw data.
 *
 * @param  {Matryoshka} matryoshka The matryoshka to unwrap.
 * @return {*}                     The raw representation of the data contained in the matryoshka.
 * @private
 */

function getRawRecursive(matryoshka) {
	if (matryoshka.type !== 'object') {
		return matryoshka.value;
	}

	const returnObj = {};

	for (const key of Object.keys(matryoshka.value)) {
		returnObj[key] = getRawRecursive(matryoshka.value[key]);
	}

	return returnObj;
}

/**
 * Merges a and b together into a new Matryoshka. Does not affect the state of a or b, and b
 * overrides a. At least one is guaranteed to be a Matryoshka.
 *
 * @param  {Matryoshka} a Matryoshka of lesser importance.
 * @param  {Matryoshka} b Matryoshka of greater importance.
 * @return {Matryoshka}   Resultant merge of a and b.
 */

function merge(a, b) {
	// If a is not a matryoshka, then return a copy of b (override).
	if (!(a instanceof Matryoshka)) {
		return b.copy();
	}

	// If b is not a matryoshka, then just keep a.
	if (!(b instanceof Matryoshka)) {
		return a.copy();
	}

	// If we reached here, both a and b are matryoshkas.

	// Types are 'object' (not including array or null) and 'scalar' (everything else).


	// If a field is empty, merge with the other object
	// Ex:
	//		logging:
	//			server:
	//			||
	//			\/
	//		logging: {
	//			server: null
	//		}
	if (a.value === null) {
		return b.copy();
	}

	if (b.value === null) {
		return a.copy();
	}

	// Different types means that no merge is required, and we can just copy b.
	if (a.type !== b.type) {
		return b.copy();
	}

	// Scalar types are shallow, so a merge is really just an override.
	if (b.type === 'scalar') {
		return b.copy();
	}

	// If we reached here, then both a and b contain objects to be compared key-by-key.

	// First assemble a list of keys in one or both objects.
	const aKeys = Object.keys(a.value);
	const bKeys = Object.keys(b.value);
	const uniqueKeys = new Set(aKeys.concat(bKeys));

	const merged = {};

	// Merge key-by-key.
	for (const key of uniqueKeys) {
		merged[key] = merge(a.value[key], b.value[key]);
	}

	// Wrap the merged object in a Matryoshka.
	return new Matryoshka(merged, a.source, true);
}

// The Matryoshka constructor is exposed as the module.
module.exports = Matryoshka;

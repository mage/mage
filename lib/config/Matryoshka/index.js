var deepCopy = require('wizcorp-deep-copy.js');

/**
 * @module Matryoshka
 */

/* jshint latedef: false */


/**
 * Make a matryoshka container for an some data. Objects are nested.
 *
 * @param {*}       value   Any value to be matryoshkaised.
 * @param {string}  source  The source of the data (a file path).
 * @param {boolean} shallow Only wrap at the top level. For internal use only.
 * @alias module:Matryoshka
 */

function Matryoshka(value, source, shallow) {
	if (!(this instanceof Matryoshka)) {
		return new Matryoshka(value, source, shallow);
	}

	this.source = source;

	// Like Arrays, elements in objects are placed in containers.
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		this.type = 'object';

		if (shallow) {
			this.value = value;
			return this;
		}

		this.value = {};

		var keys = Object.keys(value);

		for (var j = 0; j < keys.length; j++) {
			this.value[keys[j]] = new Matryoshka(value[keys[j]], source);
		}

		return this;
	}

	// The remaining case includes the set of all scalar types, including arrays.
	this.value = value;
	this.type = 'scalar';

	return this;
}


/**
 * Simple getter. Nothing to see here.
 *
 * @return {*} Contained value.
 */

Matryoshka.prototype.getValue = function () {
	return this.value;
};


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

Matryoshka.prototype.getType = function () {
	return this.type;
};


/**
 * Return the source of origin for contained data.
 *
 * @return {string} The source of a value (generally a file)
 */

Matryoshka.prototype.getSource = function () {
	return this.source;
};


/**
 * Use a path to tunnel down through a Matryoshka instance. It returns the Matryoshka from the point
 * indexed by the path.
 *
 * @param  {string[]}             path   A tunnel path.
 * @return {Matryoshka|undefined}        The Matryoshka from the point addressed by the path.
 */

Matryoshka.prototype.tunnel = function (path) {
	if (!Array.isArray(path)) {
		throw new TypeError('Addressing must be done with an array of strings');
	}

	// If the path is empty, just return this Matryoshka. This can happen if the original path was empty.
	if (path.length === 0) {
		return this;
	}

	var pathSegment = path[0];

	if (typeof pathSegment !== 'string') {
		throw new TypeError('Path segment was not a string: ' + pathSegment);
	}

	if (!this.value) {
		return;
	}

	var child = this.value[pathSegment];

	// If the child is not a Matryoshka, then we can't do anything with it.
	if (!child || !(child instanceof Matryoshka)) {
		return;
	}

	// Tunnel into the child with the remaining path.
	return child.tunnel(path.slice(1));
};


/**
 * Recursively unpeel a matryoshka to recover the raw data.
 *
 * @param  {Matryoshka} matryoshka The matryoshka to unwrap.
 * @return {*}                     The raw representation of the data contained in the matryoshka.
 * @private
 */

function getRaw(matryoshka) {
	var isMatryoshka = matryoshka instanceof Matryoshka;

	if (!isMatryoshka) {
		return matryoshka;
	}

	if (matryoshka.type === 'object') {
		var returnObj = {};
		var keys = Object.keys(matryoshka.value);

		for (var i = 0; i < keys.length; i++) {
			returnObj[keys[i]] = getRaw(matryoshka.value[keys[i]]);
		}

		return returnObj;
	}

	return matryoshka.value;
}


/**
 * Get the raw form of configuration from a particular key down.
 *
 * @param  {string[]} path       A list of keys to dig into the abstract raw object.
 * @param  {*}        defaultVal In the event that there is no data at the path given, return this.
 * @return {*}                   The addressed raw value or defaultVal.
 */

Matryoshka.prototype.get = function (path, defaultVal) {
	var obj = this.tunnel(path);

	if (obj) {
		return obj.getRaw();
	}

	return defaultVal;
};


/**
 * Get the source of the configuration at some depth.
 *
 * @param  {string[]} path A path to address data within a Matryoshka instance.
 * @return {*}             The source information for the addressed key.
 */

Matryoshka.prototype.getSourceWithPath = function (path) {
	var obj = this.tunnel(path);

	if (obj) {
		return obj.source;
	}
};


/**
 * Get a unique list of all sources of the configuration at a particular depth for itself and all children.
 *
 * @param  {string[]} path A path to address data within a Matryoshka instance.
 * @return {string[]}      The sources information for the addressed key and its children.
 */

Matryoshka.prototype.getAllSourcesWithPath = function (path) {
	var obj = this.tunnel(path);
	var sources = [];

	if (obj) {
		sources.push(obj.source);

		if (obj.type === 'object') {
			var keys = Object.keys(obj.value);
			for (var i = 0; i < keys.length; i++) {
				sources = sources.concat(obj.getAllSourcesWithPath([keys[i]]));
			}
		}
	}

	// remove duplicates

	return sources.filter(function (source, index) {
		return sources.indexOf(source) === index;
	});
};


/**
 * Get the raw representation of the data in a matryoshka. As matryoshkas nest, this essentially
 * dematryoshikisizes.
 *
 * @return {*} Get the raw value of something contained in a matryoshka. This is recursive.
 */

Matryoshka.prototype.getRaw = function () {
	return getRaw(this);
};


/**
 * A copy constructor in C++ parlance. Makes a complete copy. No references in common with original.
 *
 * @return {Matryoshka} A fresh, deep copy of the original matryoshka.
 */

Matryoshka.prototype.copy = function () {
	// Non-objects are subjected to a deep copy (arrays are treated as values).
	if (this.type !== 'object') {
		return new Matryoshka(deepCopy(this.value), this.source, true);
	}

	// Objects need to be copied key-by-key.
	var keys = Object.keys(this.value);
	var toReturn = {};

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		toReturn[key] = this.value[key].copy();
	}

	return new Matryoshka(toReturn, this.source, true);
};


/**
 * Merge two matryoshka instances to produce a third. This does not affect the parents in any way.
 *
 * @param  {Matryoshka} a A matryoshka of lower importance.
 * @param  {Matryoshka} b A matryoshka of higher importance.
 * @return {Matryoshka}   The resultant matryoshka.
 */

function mergeObjects(a, b) {
	if (a.type !== 'object' || b.type !== 'object') {
		throw new TypeError('Arguments must be (non-null, non-array) object containing Matryoshka.');
	}

	var joinKeys = Object.keys(a.value);
	var bKeys = Object.keys(b.value);

	// Add keys from b.value that were not present in a.value;
	for (var i = 0; i < bKeys.length; i++) {
		var bKey = bKeys[i];

		if (joinKeys.indexOf(bKey) === -1) {
			joinKeys.push(bKey);
		}
	}

	var returnObj = {};

	// Compare each key-by-key.
	for (var j = 0; j < joinKeys.length; j++) {
		var key = joinKeys[j];

		returnObj[key] = merge(a.value[key], b.value[key]);
	}

	// Make a new matryoshka with the results.
	return new Matryoshka(returnObj, a.source, true);
}


/**
 * Merges a and b together into a new Matryoshka. Does not affect the state of a or b, and b
 * overrides a.
 *
 * @param  {Matryoshka} a Matryoshka of lesser importance.
 * @param  {Matryoshka} b Matryoshka of greater importance.
 * @return {Matryoshka}   Resultant merge of a and b.
 */

function merge(a, b) {
	var aIsMatryoshka = a instanceof Matryoshka;
	var bIsMatryoshka = b instanceof Matryoshka;

	if (!aIsMatryoshka && !bIsMatryoshka) {
		throw new TypeError('Arguments must be matryoshka instances.');
	}

	// If a is not a matryoshka, then return a copy of b (override).
	if (!aIsMatryoshka) {
		return b.copy();
	}

	// If b is not a matryoshka, then just keep a.
	if (!bIsMatryoshka) {
		return a.copy();
	}

	// If we reached here, both a and b are matryoshkas.

	// Types are 'object' (not including array or null) and 'scalar' (everything else).

	// Different types means that no merge is required, and we can just copy b.
	if (a.type !== b.type) {
		return b.copy();
	}

	// Scalar types are shallow, so a merge is really just an override.
	if (b.type === 'scalar') {
		return b.copy();
	}

	// If we reached here, then both a and b contain objects to be compared key-by-key.
	return mergeObjects(a, b);
}


/**
 * An extended merge. This can take any number of arguments, in order of increasing importance.
 *
 * @return {Matryoshka} The resulting matryoshka.
 */

Matryoshka.merge = function () {
	if (arguments.length < 1) {
		throw new Error('Merge takes at least one Matryoshka instance.');
	}

	var merged = arguments[0].copy();

	for (var i = 1; i < arguments.length; i++) {
		merged = merge(merged, arguments[i]);
	}

	return merged;
};

// The Matryoshka constructor is exposed as the module. The shallow is bound out.
module.exports = Matryoshka;

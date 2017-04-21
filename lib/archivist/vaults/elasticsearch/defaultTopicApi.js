/**
 * Serialize data for storage in Elasticsearch
 *
 * @param {VaultValue} value The value you need to serialize
 * @returns {Object} A json-serializable object
 */
exports.serialize = function (value) {
	var data = value.setEncoding(['live']).data;
	if (Buffer.isBuffer(data)) {
		throw new TypeError('Elasticsearch does not support direct storage' +
			' of buffers, see documentation for more details.');
	}
	return data;
};

/**
 * Deserialize data from Elasticsearch
 *
 * @param {Object} data      The data from Elasticsearch
 * @param {VaultValue} value The value where you need to store the data (using setData or similar)
 */
exports.deserialize = function (data, value) {
	value.setDataFromVault(null, data, 'live');
};

/**
 * A target is where you want to store your stuff, based on the method it is composed to up to 3 elements, _index for
 * the index you are writing on, _type for the type of data, and _id for the ID of the document. _index is set by
 * default from the config, but if you need a specific topic to be in a specific index, this is where you should do it
 *
 * @param {string} topic   We use the topic as the type of document
 * @param {Object} [index] If an index is provided, we try to use it as a key by urlencoding it
 * @returns {Object} The target/option object to provide to the Elasticsearch client
 */
exports.createTarget = function (topic, index) {
	var target = {
		_type: encodeURIComponent(topic) // encode it just in case peoples uses funky topic names
	};

	// iterate on each index
	var props, sortedIds = [];

	if (index) {
		props = Object.keys(index);
		props.sort();

		// we need to sort the index so that we always have the same path for the same index
		for (var i = 0; i < props.length; i++) {
			sortedIds.push(encodeURIComponent(props[i]) + '=' + encodeURIComponent(index[props[i]]));
		}

		target._id = sortedIds.join('&');
	}

	return target;
};

/**
 * The shard function is null by default as Elasticsearch uses the object key for sharding, you can
 * override that here. When you override it, expect a VaultValue to shard on as the argument.
 *
 * @returns {null}
 */
exports.shard = function () {
	return null;
};

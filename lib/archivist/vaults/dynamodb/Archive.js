
function Archive(vault) {
	this.vault = vault;
}

module.exports = Archive;

/**
 * Create an expect block for the Amazon DynamoDB API
 *
 * @param {string[]} keys   A list of attributes we want to check about
 * @param {boolean}  exists Whether we want them to exists or not
 * @return {Object} An Expect structure
 */
function createExpect(keys, exists) {
	var res = {};

	// iterate on each index
	for (var i = 0; i < keys.length; i++) {
		res[keys[i]] = {
			Exists: exists
		};
	}

	return res;
}

Archive.prototype.get = function (api, value, cb) {
	this.vault.get(value.topic, api.createKey(value.index), api.consistent, function (err, data) {
		// if the resource was not found
		if (err) {
			return cb(api.transformError(value, err));
		}

		// no data
		if (!data || !data.Item) {
			return cb();
		}

		// deserialize data back to the value
		try {
			api.deserialize(data.Item, value);
		} catch (error) {
			return cb(error);
		}

		return cb();
	});
};

Archive.prototype.add = function (api, value, cb) {
	var topic = value.topic;
	var data = api.serialize(value);

	// in the case of add, we expect the indexes not to exists
	var expect = createExpect(api.index, false);

	this.vault.put(topic, data, expect, function (err) {
		if (err) {
			return cb(api.transformError(value, err));
		}

		// otherwise everything is fine
		return cb();
	});
};

Archive.prototype.set = function (api, value, cb) {
	var topic = value.topic;
	var data = api.serialize(value);

	this.vault.put(topic, data, function (err) {
		if (err) {
			return cb(api.transformError(value, err));
		}

		// otherwise everything is fine
		return cb();
	});
};

Archive.prototype.del = function (api, value, cb) {
	this.vault.del(value.topic, api.createKey(value.index), function (err) {
		if (err) {
			return cb(api.transformError(value, err));
		}

		return cb();
	});
};


function Archive(vault) {
	this.vault = vault;
}

module.exports = Archive;

Archive.prototype.get = function (api, value, cb) {
	// the target is "where" we want to store stuff
	var target = api.createTarget(value.topic, value.index);

	this.vault.get(target, api.shard(value), function (err, data) {
		if (err) {
			return cb(err);
		}

		if (!data) {
			return cb();
		}

		try {
			api.deserialize(data, value);
		} catch (error) {
			return cb(error);
		}

		return cb();
	});
};

Archive.prototype.add = function (api, value, cb) {
	var target = api.createTarget(value.topic, value.index);

	// setting op_type to create tells elasticsearch to throw if the index exists
	var opType = 'op_type'; // shut up jshint about the key not being camelCase
	target[opType] = 'create';

	// support for ttl
	if (value.expirationTime) {
		var ttl = (value.expirationTime * 1000) - Date.now();

		// if the ttl is negative, just don't store anything
		if (ttl <= 0) {
			return cb();
		}

		target.ttl = ttl;
	}

	// index the value, if it doesn't exists that will create it, if it exists that will fail
	this.vault.index(target, api.serialize(value), api.shard(value), cb);
};

Archive.prototype.set = function (api, value, cb) {
	var target = api.createTarget(value.topic, value.index);

	// support for ttl
	if (value.expirationTime) {
		var ttl = (value.expirationTime * 1000) - Date.now();

		// if the ttl is negative, just don't store anything
		if (ttl <= 0) {
			return cb();
		}

		target.ttl = ttl;
	}

	// index the value, if it doesn't exists that will create it
	this.vault.index(target, api.serialize(value), api.shard(value), cb);
};

Archive.prototype.del = function (api, value, cb) {
	var target = api.createTarget(value.topic, value.index);

	this.vault.del(target, api.shard(value), cb);
};

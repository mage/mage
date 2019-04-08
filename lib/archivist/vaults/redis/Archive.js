// Archivist bindings for the RedisVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;

Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	var check = api.index;
	var chunk = options && options.chunk;
	var index = {};

	for (var i = 0; i < check.length; i++) {
		var prop = check[i];
		index[prop] = partialIndex[prop] ? partialIndex[prop] : '*';
	}

	function map(key) {
		return api.parseKey(key).index;
	}

	this.vault.scan(api.createKey(topic, index), map, (error, data) => {
		if (error) {
			return cb(error);
		}

		if (chunk) {
			if (chunk.length === 2) {
				data = data.slice(chunk[0], chunk[0] + chunk[1]);
			} else {
				data = data.slice(chunk[0]);
			}
		}

		cb(null, data);
	});
};


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createKey(value.topic, value.index), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data === undefined) {
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


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.createKey(value.topic, value.index), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createKey(value.topic, value.index), cb);
};

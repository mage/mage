// Archivist bindings for the FileVault API


function sortIndexes(indexes, sort) {
	function compare(a, b) {
		return a > b ? -1 : (b > a ? 1 : 0);
	}

	// format: [{ name: 'colName', direction: 'asc' }, { name: 'colName2', direction: 'desc' }]
	// direction is 'asc' by default

	indexes.sort(function (a, b) {
		var result = 0;

		for (var i = 0; i < sort.length && result === 0; i++) {
			var prop = sort[i].name;
			var factor = sort[i].direction === 'desc' ? -1 : 1;

			result = factor * compare(a[prop], b[prop]);
		}

		return result;
	});
}


function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	// partialIndex must contain all properties, but the unknowns must be set to undefined

	var check = api.index;
	var sort = options && options.sort;
	var chunk = options && options.chunk;

	var that = this;

	function map(path) {
		var parsed;

		try {
			parsed = api.parseKey(path);
		} catch (error) {
			that.vault.logger.warning(error);
			return;
		}

		if (!parsed || parsed.topic !== topic) {
			return;
		}

		for (var i = 0; i < check.length; i++) {
			var prop = check[i];

			if (partialIndex.hasOwnProperty(prop)) {
				var givenValue = '' + partialIndex[prop];
				var parsedValue = '' + parsed.index[prop];

				if (parsedValue !== givenValue) {
					return;
				}
			}
		}

		return parsed.index;
	}

	this.vault.scan(map, function (error, indexes) {
		if (error) {
			return cb(error);
		}

		if (sort) {
			sortIndexes(indexes, sort);
		}

		if (chunk) {
			if (chunk.length === 2) {
				indexes = indexes.slice(chunk[0], chunk[0] + chunk[1]);
			} else {
				indexes = indexes.slice(chunk[0]);
			}
		}

		cb(null, indexes);
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
	this.vault.set(api.createKey(value.topic, value.index), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createKey(value.topic, value.index), cb);
};

Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.createKey(value.topic, value.index), value.expirationTime, cb);
};

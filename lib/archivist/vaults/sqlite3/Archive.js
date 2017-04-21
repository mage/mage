// Archivist bindings for the SQLiteVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	var partialKey = api.createKey(topic, partialIndex);
	var cols = api.index;
	var sort = options && options.sort;
	var chunk = options && options.chunk;

	var where = {};

	for (var i = 0; i < cols.length; i++) {
		var col = cols[i];

		if (partialKey.pk.hasOwnProperty(col)) {
			where[col] = partialKey.pk[col];
		}
	}

	this.vault.select(partialKey.table, cols, where, sort, chunk, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var indexes = [];

		for (var i = 0; i < rows.length; i++) {
			var parsed = api.parseKey({ table: partialKey.table, pk: rows[i] });

			if (parsed) {
				indexes.push(parsed.index);
			}
		}

		cb(null, indexes);
	});
};


Archive.prototype.get = function (api, value, cb) {
	var key = api.createKey(value.topic, value.index);

	this.vault.select(key.table, null, key.pk, null, null, function (error, result) {
		if (error) {
			return cb(error);
		}

		if (!result || result.length === 0) {
			return cb();
		}

		try {
			api.deserialize(result[0], value);
		} catch (error) {
			return cb(error);
		}

		return cb();
	});
};


Archive.prototype.add = function (api, value, cb) {
	var key = api.createKey(value.topic, value.index);
	var values = api.serialize(value);

	// merge PK into values

	var pkCols = Object.keys(key.pk);
	for (var i = 0; i < pkCols.length; i++) {
		var colName = pkCols[i];

		values[colName] = key.pk[colName];
	}

	this.vault.insert(key.table, values, cb);
};


Archive.prototype.set = function (api, value, cb) {
	var key = api.createKey(value.topic, value.index);
	var values = api.serialize(value);

	this.vault.updateOrInsert(key.table, key.pk, values, cb);
};


Archive.prototype.del = function (api, value, cb) {
	var key = api.createKey(value.topic, value.index);

	this.vault.del(key.table, key.pk, cb);
};

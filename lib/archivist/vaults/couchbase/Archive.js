/**
 * Instantiates an Archive binding for CouchbaseVault
 *
 * @class
 * @classdesc Archivist bindings for the CouchbaseVault API
 *
 * @param {CouchbaseVault} vault The CouchbaseVault instance to wrap
 */

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;



/**
 * Gets a VaultValue from the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to populate
 * @param {Function}   cb
 */

Archive.prototype.get = function (api, value, cb) {
	var flagStyle = this.vault.flagStyle;

	var options = {
		hashkey: api.shard(value)
	};

	this.vault.get(api.createKey(value.topic, value.index), options, function (error, data, cas, flags) {
		if (error) {
			return cb(error);
		}

		if (data === undefined) {
			return cb();
		}

		try {
			api.deserialize(data, api.parseFlags(flags, flagStyle), value);
		} catch (error) {
			return cb(error);
		}

		return cb();
	});
};


/**
 * Sets a VaultValue to the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to write
 * @param {Function}   cb
 */

Archive.prototype.set = function (api, value, cb) {
	var data = api.serialize(value);

	var options = {
		hashkey: api.shard(value),
		expiry: value.expirationTime,
		flags: api.createFlags(value.mediaType, this.vault.flagStyle)
	};

	this.vault.set(api.createKey(value.topic, value.index), data, options, cb);
};


/**
 * Updates the expiration time of a VaultValue on the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue with the new expiration time
 * @param {Function}   cb
 */

Archive.prototype.touch = function (api, value, cb) {
	var options = {
		hashkey: api.shard(value),
		expiry: value.expirationTime
	};

	this.vault.touch(api.createKey(value.topic, value.index), options, cb);
};


/**
 * Deletes a VaultValue from the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to delete
 * @param {Function}   cb
 */

Archive.prototype.del = function (api, value, cb) {
	var options = {
		hashkey: api.shard(value)
	};

	this.vault.remove(api.createKey(value.topic, value.index), options, cb);
};

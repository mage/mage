// Archivist bindings for the ClientVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.set = function (api, value, cb) {
	var diff = value.getDiff();

	if (diff) {
		this.vault.applyDiff(api.shard(value), api.createKey(value.topic, value.index), diff, value.expirationTime);
	} else {
		this.vault.set(api.shard(value), api.createKey(value.topic, value.index),
			api.serialize(value), value.expirationTime);
	}

	setImmediate(cb);
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.shard(value), api.createKey(value.topic, value.index), value.expirationTime);

	setImmediate(cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.shard(value), api.createKey(value.topic, value.index));

	setImmediate(cb);
};

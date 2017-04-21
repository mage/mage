// Archivist bindings for the MantaVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createFolder(value.topic), api.createFileName(value.index), function (error, obj) {
		if (error) {
			return cb(error);
		}

		if (obj === undefined) {
			return cb();
		}

		try {
			api.deserialize(obj, value);
		} catch (error) {
			return cb(error);
		}

		return cb();
	});
};


Archive.prototype.list = function (api, topic, partialIndex, options, cb) {
	var keys = Object.keys(partialIndex || {});
	var keyCount = keys.length;

	function map(fileName) {
		var index = api.parseFileName(fileName);

		if (!index) {
			return;
		}

		for (var i = 0; i < keyCount; i++) {
			if ('' + partialIndex[keys[i]] !== '' + index[keys[i]]) {
				return;
			}
		}

		return index;
	}


	this.vault.ls(api.createFolder(topic), options, map, cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.put(api.createFolder(value.topic), api.createFileName(value.index), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.unlink(api.createFolder(value.topic), api.createFileName(value.index), cb);
};

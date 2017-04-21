// based on node-memcached, this vault does not support sharding
//
// key format: string
//
// references:
// -----------
// node-memcached:     https://github.com/3rd-Eden/node-memcached
// memcached protocol: https://github.com/memcached/memcached/blob/master/doc/protocol.txt


var requirePeer = require('codependency').get('mage');
var Memcached = requirePeer('memcached');
var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-memcached

function MemcachedVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-memcached instance
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new MemcachedVault(name, logger);
};


MemcachedVault.prototype.setup = function (cfg, cb) {
	this.client = new Memcached(cfg.servers, cfg.options);
	this.keyPrefix = cfg.prefix || null;

	var logger = this.logger;
	var name = this.name;

	this.client.on('failure', function (details) {
		logger.emergency('Memcached server went down on vault', name, details);
	});

	this.client.on('reconnecting', function (details) {
		logger.alert('Reconnecting to Memcached server on vault', name, details);
	});

	this.client.on('reconnected', function (details) {
		logger.notice('Reconnected to Memcached server on vault', name, details);
	});

	this.client.on('issue', function (details) {
		logger.alert('Issue occured on Memcached server on vault', name, details);
	});

	this.client.on('remove', function (details) {
		logger.emergency('Memcached server removed from cluster on vault', name, details);
	});

	setImmediate(cb);
};


MemcachedVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.end();
		this.client = null;
	}
};


MemcachedVault.prototype._prefix = function (key) {
	return this.keyPrefix ? this.keyPrefix + key : key;
};

/* unprefix will be used once we support readMany
MemcachedVault.prototype._unprefix = function (key) {
	if (!this.keyPrefix) {
		return key;
	}

	var len = this.keyPrefix.length;

	if (key.substr(0, len) !== this.keyPrefix) {
		throw new Error('Could not unprefix key "' + key + '" with prefix "' + this.keyPrefix + '"');
	}

	return key.substr(len);
};
*/

MemcachedVault.prototype.get = function (key, cb) {
	key = this._prefix(key);

	this.logger.verbose('get:', key);

	this.client.get(key, function (error, data) {
		if (error) {
			return cb(error);
		}

		// handle a special case in node-memcached, where it returns "false" as an indicator
		// for non-existence

		if (data === false) {
			data = undefined;
		}

		cb(null, data);
	});
};


MemcachedVault.prototype.add = function (key, data, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('add:', key);

	this.client.add(key, data, expirationTime || 0, cb);
};


MemcachedVault.prototype.set = function (key, data, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('set:', key);

	this.client.set(key, data, expirationTime || 0, cb);
};


MemcachedVault.prototype.touch = function (key, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('touch:', key);

	this.client.command(function touch() {
		return {
			command: ['touch', key, expirationTime || 0].join(' '),
			key: key,
			type: 'touch',
			callback: cb
		};
	});
};


MemcachedVault.prototype.del = function (key, cb) {
	key = this._prefix(key);

	this.logger.verbose('del:', key);

	this.client.del(key, cb);
};

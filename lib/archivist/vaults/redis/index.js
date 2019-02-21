// based on node-redis, this vault does not support sharding at this time
//
// key format: string
//
// references:
// -----------
// node-redis: https://github.com/mranney/node_redis

var requirePeer = require('codependency').get('mage');
var redis = requirePeer('redis');
var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-redis

function RedisVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-redis instance
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new RedisVault(name, logger);
};


RedisVault.prototype.setup = function (cfg, cb) {
	var cfgOptions = cfg.options || {};

	// this option-alias is really just to silence jshint

	var returnBuffers = 'return_buffers';

	if (!cfgOptions.hasOwnProperty(returnBuffers)) {
		cfgOptions[returnBuffers] = true;
	}

	this.client = redis.createClient(cfg.port, cfg.host, cfgOptions);
	this.keyPrefix = cfg.prefix || null;
	this.db = cfg.db || null;

	var logger = this.logger;
	var name = this.name;

	this.client.on('error', function (error) {
		logger.emergency('Error on Redis server (name: ' + name + '):', error);
	});

	setImmediate(cb);
};

RedisVault.prototype.open = function (cb) {
	if (!this.db) {
		return setImmediate(cb);
	}

	this.client.select(this.db, cb);
};

RedisVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.quit();
		this.client = null;
	}
};


RedisVault.prototype._prefix = function (key) {
	return this.keyPrefix ? this.keyPrefix + key : key;
};

/* unprefix will be used once we support readMany
RedisVault.prototype._unprefix = function (key) {
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

RedisVault.prototype.scan = function (key, map, cb) {
	var set = new Set();
	var result = [];
	key = this._prefix(key);

	this.logger.verbose('scan:', key);

	const rscan = (cursor) => {
		this.client.scan([cursor, 'MATCH', key, 'COUNT', 100], function (error, data) {
			if (error) {
				return cb(error);
			}

			data[1].forEach((entry) => {
				entry = entry.toString();

				if (!set.has(entry)) {
					if (map) {
						entry = map(entry);
					}
					if (entry) {
						result.push(entry);
					}
				}
			});

			if (data[0].toString() !== '0') {
				rscan(data[0]);
			} else {
				cb(null, result);
			}
		});
	};

	rscan(0);
};

RedisVault.prototype.get = function (key, cb) {
	key = this._prefix(key);

	this.logger.verbose('get:', key);

	this.client.get([key], function (error, data) {
		if (error) {
			return cb(error);
		}

		data = data || undefined;

		cb(null, data);
	});
};


function expirationTimeToTTL(expirationTime) {
	if (expirationTime) {
		return Math.ceil(expirationTime - (Date.now() / 1000));
	}
}


RedisVault.prototype.set = function (key, data, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('set:', key);

	var cmd = expirationTime ?
		[key, data, 'EX', expirationTimeToTTL(expirationTime)] :
		[key, data];

	this.client.set(cmd, cb);
};


RedisVault.prototype.touch = function (key, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('touch:', key);

	if (!expirationTime) {
		return cb();
	}

	this.client.expire([key, expirationTimeToTTL(expirationTime)], cb);
};


RedisVault.prototype.del = function (key, cb) {
	key = this._prefix(key);

	this.logger.verbose('del:', key);

	this.client.del([key], cb);
};

// based on node-couchbase, this vault supports sharding
//
// references:
// -----------
// node-couchbase:     https://github.com/couchbase/couchnode
// libcouchbase:       https://github.com/couchbase/libcouchbase

var assert = require('assert');
var mage = require('lib/mage');

var requirePeer = require('codependency').get('mage');
var couchbase = requirePeer('couchbase');
var connstr = requirePeer('couchbase/lib/connstr');
var couchbaseHelpers = require('./couchbaseHelpers.js');

var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');

/**
 * UninitializedError class
 */
class UninitializedError extends Error {
	/**
	 * Constructor
	 *
	 * @param {string} method
	 */

	constructor(method) {
		super(
			`Cannot call "${method}" method on CouchbaseVault: CouchbaseVault is not initialized.\
			Please call open() before using it.`
		);
		this.name = 'UninitializedError';
	}
}

/**
 * Removes properties that are undefined. That makes node-couchbase happy. Hopefully some day, they
 * won't be as strict with undefined.
 *
 * @param {Object} obj
 */

function wash(obj) {
	if (!obj) {
		return {};
	}

	var keys = Object.keys(obj);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		if (obj[key] === undefined) {
			delete obj[key];
		}
	}

	return obj;
}

/**
 * Replace the Couchbase error.code number with its value
 * Eg. {code: 16} -> {code: networkError}
 * See all available values here: https://github.com/couchbase/couchnode/blob/master/lib/errors.js
 *
 * @param {CouchbaseError} error The error
 * @returns {CouchbaseError} The transformed CouchbaseError
 */
function getCouchbaseError(error) {
	if (!error) {
		return;
	}

	for (const [key, value] of Object.entries(couchbase.errors)) {
		if (value === error.code) {
			error.code = key;
			break;
		}
	}

	return error;
}


/**
 * Instantiates the CouchbaseVault (only done through the create() factory function)
 *
 * @class
 * @classdesc A node-couchbase vault (with support for sharding)
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 */

function CouchbaseVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-couchbase bucket
	this.logger = logger;
}


/**
 * Factory function to create a CouchbaseVault
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 * @returns {CouchbaseVault}
 */

exports.create = function (name, logger) {
	return new CouchbaseVault(name, logger);
};


/**
 * Sets up the vault
 *
 * @param {Object}   cfg          Configuration
 * @param {string}   [cfg.prefix] A prefix to apply to all keys
 * @param {Object}   cfg.options  Connection options for node-couchbase
 * @param {Function} cb
 */

CouchbaseVault.prototype.setup = function (cfg, cb) {
	var logger = this.logger;

	this.keyPrefix = cfg.prefix || null;
	this.flagStyle = cfg.flagStyle || 'default';
	this.cfg = cfg;

	if (this.flagStyle !== 'default' && this.flagStyle !== 'node-memcached') {
		var err = new Error('Unknown flagStyle: "' + this.flagStyle + '" (available: "default", "node-memcached")');
		logger.emergency(err);
		return cb(err);
	}

	logger.debug('Setting up couchbase vault, using flagStyle', this.flagStyle);


	// Create cluster configuration instance and connect initiating bucket handshake
	this.cluster = new couchbase.Cluster(connstr.stringify(cfg.options));

	if (cfg.options.username) {
		const passwordAuthenticate = new couchbase.PasswordAuthenticator(cfg.options.username, cfg.options.password);
		this.cluster.authenticate(passwordAuthenticate);
	}

	cb();
};

/**
 * Open the connection to the Couchbase cluster by opening the bucket
 */

CouchbaseVault.prototype.open = function (cb) {
	var logger = this.logger;
	var cfg = this.cfg;

	this.logger.verbose('Opening vault:', this.name);

	if (this.client) {
		this.logger.error('Vault', this.name, ' is already connected');
		return cb();
	}

	this.client = this.cluster.openBucket(cfg.options.bucket, cfg.options.password, (err) => {
		if (err) {
			return cb(getCouchbaseError(err));
		}

		// Setup event handlers
		this.client.on('connect', function () {
			logger.notice('Connected to Couchbase bucket:', cfg.options.bucket);
		});
		this.client.on('error', function (error) {
			logger.emergency('Couchbase server error for bucket ', cfg.options.bucket, ':', getCouchbaseError(error));
		});

		// Enable n1ql by feeding in query hosts. this is required for now since they have not
		// implemented the automatic configuration part of this.
		if (cfg.options.qhosts) {
			this.client.enableN1ql(cfg.options.qhosts);
		}

		// Create pass-through transcoder functions
		this.client.setTranscoder(couchbaseHelpers.encoder, couchbaseHelpers.decoder);

		return cb();
	});
};


/**
 * Closes the connection to the Couchbase cluster
 */

CouchbaseVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client && this.client.connected === true) {
		this.client.disconnect();
		this.client = null;
	}
};


/**
 * Prefixes a key with the configured prefix (if any)
 *
 * @param {string} key
 * @returns {string}
 * @private
 */

CouchbaseVault.prototype._prefix = function (key) {
	return this.keyPrefix ? this.keyPrefix + key : key;
};


/**
 * Retrieves a document from Couchbase
 *
 * @param {string}   key               The key to query
 * @param {object}   [options]         Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   [options.expiry]  A unix timestamp to update expiration with (get-and-touch pattern)
 * @param {Function} cb                Receives error, data, cas, flags
 */

CouchbaseVault.prototype.get = function (key, options, cb) {
	if (!this.client) {
		return cb(new UninitializedError('get'));
	}

	key = this._prefix(key);

	this.logger.verbose('get:', key, 'options:', options);

	this.client.get(key, wash(options), function (error, result) {
		// node-couchbase will yield error "No such key" if the key wasn't found, but we just want
		// to return undefined in that case.

		if (error) {
			if (error.code === couchbase.errors.keyNotFound || error.message !== 'No such key') {
				return cb();
			}

			return cb(getCouchbaseError(error));
		}

		var value = result.value.value;
		var cas = result.cas;
		var flags = result.value.flags;

		var buff = new Buffer(4);
		buff.writeUInt32BE(flags, 0);

		if (!value) {
			return cb();
		}

		cb(null, value, cas, flags);
	});
};


/**
 * (Over)writes a document to Couchbase
 *
 * @param {string}   key               The key to write
 * @param {*}        data              Data to store
 * @param {object}   [options]         Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   [options.expiry]  A unix timestamp to set expiration to
 * @param {number}   [options.flags]   Uint32 flags to identify the mediaType
 * @param {Function} cb
 */

CouchbaseVault.prototype.set = function (key, data, options, cb) {
	if (!this.client) {
		return cb(new UninitializedError('set'));
	}

	key = this._prefix(key);

	this.logger.verbose('set:', key, 'options:', options);

	// Construct object for couchbase transcoder pass-through
	if (options && options.flags) {
		data = { value: data, flags: options.flags };
	}

	this.client.upsert(key, data, wash(options), function (error) {
		cb(getCouchbaseError(error));
	});
};


/**
 * Updates the expiration time on a document
 *
 * @param {string}   key               The key to touch
 * @param {object}   options           Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   options.expiry    A unix timestamp to update expiration with
 * @param {Function} cb
 */

CouchbaseVault.prototype.touch = function (key, options, cb) {
	if (!this.client) {
		return cb(new UninitializedError('touch'));
	}

	key = this._prefix(key);

	this.logger.verbose('touch:', key, 'options:', options);

	this.client.touch(key, options.expiry, wash(options), cb);
};


/**
 * Removes a document from Couchbase
 *
 * @param {string}   key               The key to remove
 * @param {object}   options           Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {Function} cb
 */

CouchbaseVault.prototype.remove = function (key, options, cb) {
	if (!this.client) {
		return cb(new UninitializedError('remove'));
	}

	key = this._prefix(key);

	this.logger.verbose('remove:', key, 'options:', options);

	this.client.remove(key, wash(options), cb);
};


/**
 * Returns an array of all applied migration versions.
 * It also ensures the table for schema migrations exists.
 *
 * @param {Function} cb  Called upon completion, and given the array of versions.
 */

CouchbaseVault.prototype.getMigrations = function (cb) {
	this.logger.debug('Loading applied migrations list');

	this.get('schema_migrations', {}, function (error, result) {
		if (error) {
			return cb(error);
		}

		if (Buffer.isBuffer(result) || typeof result === 'string') {
			result = JSON.parse(result);
		}

		var versions = Object.keys(result || {});
		return cb(null, versions);
	});
};


/**
 * Stores a version in the schema migrations key.
 *
 * @param {string}   version  The version of this migration.
 * @param {*}        report   A report that will be JSON stringified.
 * @param {Function} cb       Called upon completion.
 */

CouchbaseVault.prototype.registerMigration = function (version, report, cb) {
	var that = this;

	that.get('schema_migrations', {}, function (error, result) {
		if (error) {
			return cb(error);
		}

		var versionObjects = result || {};

		if (Buffer.isBuffer(result) || typeof result === 'string') {
			versionObjects = JSON.parse(result);
		}

		// Check if the provided version already exists
		if (versionObjects[version]) {
			return cb(new Error('Version "' + version + '" already exists!'));
		}

		// Add version to object
		versionObjects[version] = {
			version: version,
			migratedAt: parseInt(Date.now() / 1000, 10),
			report: report ? JSON.stringify(report) : ''
		};

		// Set the new migration version data
		that.set('schema_migrations', versionObjects, null, cb);
	});
};


/**
 * Removes a version from the schema migrations key.
 *
 * @param {string}   version  The version of this migration.
 * @param {Function} cb       Called upon completion.
 */

CouchbaseVault.prototype.unregisterMigration = function (version, cb) {
	var that = this;

	that.get('schema_migrations', {}, function (error, result) {
		if (error) {
			return cb(error);
		}

		var versionObjects = result || {};

		if (Buffer.isBuffer(result) || typeof result === 'string') {
			versionObjects = JSON.parse(result);
		}

		// If the version doesnt exist return an error
		if (!versionObjects[version]) {
			return cb(new Error('Version "' + version + '" does not exist!'));
		}

		// Otherwise delete the version from the version data
		delete versionObjects[version];

		// Set the new migration version data
		that.set('schema_migrations', versionObjects, null, cb);
	});
};


/**
 * If the vault is configured to manage couchbase buckets this will create a new bucket if one doesn't already
 * exist. And then waits to make sure the bucket is usable.
 *
 * @param {Function} cb  Called upon completion.
 */
CouchbaseVault.prototype.createDatabase = function (cb) {
	var vaultName = this.name;
	var logger = this.logger;

	var bucketOptions = mage.core.config.get(['archivist', 'vaults', vaultName, 'config', 'options'], false);
	var createBucket = mage.core.config.get(['archivist', 'vaults', vaultName, 'config', 'create'], false);
	if (!createBucket) {
		if (mage.isDevelopmentMode()) {
			logger.warning(`No create configuration found for vault ${vaultName}, please refer to the vault's ` +
				'documentation on how to set it up');
		}

		return cb();
	}

	if (!mage.isDevelopmentMode()) {
		logger.warning(`Create configuration found for ${vaultName} while running in production, this can and will ` +
			'cause issues in the long term, consider disabling/removing it!');
	}

	try {
		assert(createBucket.bucketType, 'Must specify bucketType');
		assert(createBucket.ramQuotaMB, 'Must specify ramQuotaMB');
		assert(createBucket.adminUsername, 'Must specify administration username');
		assert(createBucket.adminPassword, 'Must specify administration password');
	} catch (error) {
		return cb(error);
	}

	var cluster = this.cluster;
	var clusterManager = cluster.manager(createBucket.adminUsername, createBucket.adminPassword);
	clusterManager.listBuckets(function (error, buckets) {
		if (error) {
			return cb(getCouchbaseError(error));
		}

		var bucketExists = false;
		for (var i = 0; i < buckets.length; i += 1) {
			var bucket = buckets[i];
			if (bucket.name === bucketOptions.bucket) {
				bucketExists = true;
				break;
			}
		}

		if (bucketExists) {
			logger.notice('Bucket already exists:', bucketOptions.bucket);
			return cb();
		}

		couchbaseHelpers.createBucket(logger, cluster, bucketOptions, createBucket, cb);
	});
};


/**
 * If the vault is configured to manage couchbase buckets this will destroy a bucket if it exists. Otherwise
 * it will only delete the schema_migrations key, which helps force migrations to be re-run.
 *
 * @param {Function} cb  Called upon completion.
 */
CouchbaseVault.prototype.dropDatabase = function (cb) {
	var vaultName = this.name;
	var logger = this.logger;

	var bucketOptions = mage.core.config.get(['archivist', 'vaults', vaultName, 'config', 'options'], false);
	var createBucket = mage.core.config.get(['archivist', 'vaults', vaultName, 'config', 'create'], false);
	if (!createBucket) {
		return this.remove('schema_migrations', {}, function (error) {
			// code 13 is "key does not exists"
			if (error && error.code !== 13) {
				return cb(error);
			}

			cb();
		});
	}

	try {
		assert(createBucket.adminUsername, 'Must specify administration username');
		assert(createBucket.adminPassword, 'Must specify administration password');
	} catch (error) {
		return cb(error);
	}

	var clusterManager = this.cluster.manager(createBucket.adminUsername, createBucket.adminPassword);
	clusterManager.listBuckets(function (error, buckets) {
		if (error) {
			return cb(getCouchbaseError(error));
		}

		var bucketExists = false;
		for (var i = 0; i < buckets.length; i += 1) {
			var bucket = buckets[i];
			if (bucket.name === bucketOptions.bucket) {
				bucketExists = true;
				break;
			}
		}

		if (!bucketExists) {
			logger.notice('Bucket doesn\'t exist:', bucketOptions.bucket);
			return cb();
		}

		logger.notice('Removing bucket:', bucketOptions.bucket);
		clusterManager.removeBucket(bucketOptions.bucket, cb);
	});
};

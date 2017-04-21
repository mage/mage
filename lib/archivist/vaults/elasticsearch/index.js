var requirePeer = require('codependency').get('mage');
var elasticSearch = requirePeer('es');
var Archive = require('./Archive');

// exports the default topic API
exports.defaultTopicApi = require('./defaultTopicApi');


function ElasticsearchVault(name, logger) {
	this.name = name;
	this.logger = logger;
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;
	this.defaultIndex = null;
}


exports.create = function (name, logger) {
	return new ElasticsearchVault(name, logger);
};

/**
 * Sets up the vault
 *
 * @param {Object}   cfg                 The configuration object
 * @param {string}   cfg.index           The default index to use
 * @param {string}   cfg.server          A server objects that matches the one used by es
 * @param {Function} cb                  A callback called when the function as finished setting up
 * @returns {*}
 */
ElasticsearchVault.prototype.setup = function (cfg, cb) {
	if (!cfg.index) {
		var error = new Error('No default index specified for Elasticsearch vault');

		this.logger.emergency(error);
		return cb(error);
	}

	this.defaultIndex = cfg.index;

	// instantiate the elasticsearch object, providing it with the server info and the default index

	this.client = elasticSearch.createClient({ server: cfg.server, _index: this.defaultIndex });

	// no async stuff, return on next tick
	setImmediate(cb);
};

/**
 * Index a document in Elasticsearch
 *
 * @param {Object}      target          Specifies where we want to store the document
 * @param {string}      [target._index] The index, by default uses the one provided in the config
 * @param {string}      target._type    The type of data you want to store
 * @param {string}      target._id      The id for the document, should be a valid path component
 * @param {Object}      document        The document you want to store
 * @param {string}      [shard]         If a string, overrides how Elasticsearch will shard
 * @param {Function}    cb              A callback that accepts an error
 */
ElasticsearchVault.prototype.index = function (target, document, shard, cb) {
	// if a shard is given, override it
	if (shard) {
		target.routing = shard;
	}

	this.client.index(target, document, function (err) {
		if (err) {
			return cb(err);
		}

		return cb();
	});
};

/**
 * Retrieve a document from Elasticsearch by id
 *
 * @param {Object}      target          Specifies where we want to store the document
 * @param {string}      [target._index] The index, by default uses the one provided in the config
 * @param {string}      target._type    The type of data you want to store
 * @param {string}      target._id      The id for the document, should be a valid path component
 * @param {string}      [shard]         If a string, overrides how Elasticsearch will shard
 * @param {Function}    cb              A callback that takes an error and the document data
 */
ElasticsearchVault.prototype.get = function (target, shard, cb) {
	// if a shard is given, override it
	if (shard) {
		target.routing = shard;
	}

	this.client.get(target, function (err, data) {
		if (err) {
			return cb(err);
		}

		if (!data.exists) {
			return cb();
		}

		// _source contains the original document
		return cb(null, data._source);
	});
};

/**
 * Delete a document from Elasticsearch by id
 *
 * @param {Object}      target          Specifies where we want to store the document
 * @param {string}      [target._index] The index, by default uses the one provided in the config
 * @param {string}      target._type    The type of data you want to store
 * @param {string}      target._id      The id for the document, should be a valid path component
 * @param {string}      [shard]         If a string, overrides how Elasticsearch will shard
 * @param {Function}    cb              A callback called with the error if there is one
 */
ElasticsearchVault.prototype.del = function (target, shard, cb) {
	// if a shard is given, override it
	if (shard) {
		target.routing = shard;
	}

	// delete a document, Elasticsearch returns some data about the deleted document, we just ignore it
	this.client.delete(target, function (err) {
		return cb(err);
	});
};
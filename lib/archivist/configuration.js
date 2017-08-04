var mage = require('../mage');
var async = require('async');
var path = require('path');
var parseTopic = require('./vaultValue').parseTopic;

var ARCHIVIST_SETUP_PATH = path.join(process.cwd(), 'lib/archivist');

var logger;

// configuration for topics
// { topicName: { readOptions: {}, .. }

var topicConfigs = {};
var topicApis = {};

var persistentVaults = {};
var listOrder = [];
var readOrder = [];
var writeOrder = [];


exports.getMigrationsPath = function (vaultName) {
	return path.join(ARCHIVIST_SETUP_PATH, 'migrations', vaultName);
};

exports.getTopicApi = function (topic, vaultName) {
	topic = parseTopic(topic);

	return topicApis[topic] && topicApis[topic][vaultName];
};


exports.getPersistentVault = function (name) {
	return persistentVaults[name];
};


exports.getPersistentVaults = function () {
	return persistentVaults;
};


exports.getListOrder = function () {
	return listOrder;
};


exports.getReadOrder = function () {
	return readOrder;
};


exports.getWriteOrder = function () {
	return writeOrder;
};


function getVaultMod(type) {
	return require('./vaults/' + type);
}


function overrideProperties(target, override) {
	if (override) {
		for (var key in override) {
			if (override.hasOwnProperty(key)) {
				target[key] = override[key];
			}
		}
	}

	return target;
}


exports.getTopicConfig = function (topic) {
	return topicConfigs[topic];
};


exports.getReadOptions = function (topic, override) {
	topic = parseTopic(topic);

	var cfg = topicConfigs[topic];

	if (!cfg) {
		throw new Error('Unknown topic: ' + topic);
	}

	var defaults = cfg.readOptions || {};

	if (!override) {
		return defaults;
	}

	var key, copy = {};

	for (key in defaults) {
		if (defaults.hasOwnProperty(key)) {
			copy[key] = defaults[key];
		}
	}

	for (key in override) {
		if (override.hasOwnProperty(key)) {
			copy[key] = override[key];
		}
	}

	return copy;
};


// Vault creation
// --------------

var vaultLoggers = {};

function getVaultLogger(name) {
	if (!vaultLoggers[name]) {
		vaultLoggers[name] = logger.context('vault:' + name);
	}

	return vaultLoggers[name];
}


function createVault(vaultName, vaultType, vaultConfig, cb) {
	try {
		var vaultMod = getVaultMod(vaultType);
		var vault = vaultMod.create(vaultName, getVaultLogger(vaultName));

		vault.setup(vaultConfig || {}, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, vault);
		});
	} catch (error) {
		logger.emergency('Error setting up', vaultName, 'vault:', error);
		cb(error);
	}
}


exports.createVault = createVault;


exports.closeVaults = function () {
	// if setup had not yet run, logger will be undefined
	// this can happen on very early fatal error shutdown attempts

	if (logger) {
		logger.debug('Closing all vaults...');
	}

	for (var vaultName in persistentVaults) {
		var vault = persistentVaults[vaultName];

		if (vault && vault.close) {
			vault.close();
		}
	}
};


// sanity checks

function assertTopicSanity() {
	// checks for each configured topic if there is at least one vault set up to read or write with

	var topics = Object.keys(topicConfigs);

	topics.forEach(function (topic) {
		var apis = topicApis[topic];
		var vaultNames = Object.keys(apis);

		// now make sure we have at least 1 persistent vault represented in vaultNames

		var found = vaultNames.some(function (vaultName) {
			if (!persistentVaults[vaultName]) {
				return false;
			}

			if (readOrder.indexOf(vaultName) === -1 && writeOrder.indexOf(vaultName) === -1) {
				return false;
			}

			return true;
		});

		if (!found) {
			throw new Error('No readable or writable vaults configured for topic "' + topic + '"');
		}
	});
}


exports.topicExists = function (topic) {
	return !!topicConfigs[parseTopic(topic)];
};


exports.getTopics = function () {
	var result = {};

	var topics = Object.keys(topicConfigs);
	for (var i = 0; i < topics.length; i++) {
		var topic = topics[i];
		var cfg = topicConfigs[topic];

		result[topic] = { index: cfg.index };
	}

	return result;
};


/**
 * Used to confirm the abilities of the topic on this configured system.
 *
 * @param {string}   topic           The topic to test.
 * @param {string[]} [index]         The index signature this topic should conform to.
 * @param {string[]} [operations]    The operations that every vault associated with this topic must
 *                                   support. Values: 'list', 'get', 'add', 'set', 'touch', 'del'
 * @param {boolean} [indexIsPartial] True if the given index signature is allowed to be incomplete.
 */

exports.assertTopicAbilities = function (topic, index, operations, indexIsPartial) {
	topic = parseTopic(topic);

	var api = topicApis[topic];
	var topicConfig = topicConfigs[topic];

	if (!api) {
		throw new Error('Topic "' + topic + '" does not exist!');
	}

	var vaultNames = Object.keys(api);  // all these vaults are known to exist in this environment

	if (vaultNames.length === 0) {
		throw new Error('No vaults are configured for topic "' + topic + '"');
	}

	// compare expected index with configured index

	if (index && !Array.isArray(index)) {
		throw new TypeError(
			'When asserting topic abilities for an index, the index signature must be an array'
		);
	}

	if (index) {
		if (!topicConfig.index) {
			throw new Error(
				'Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", ' +
				'but none was found.'
			);
		}

		if (!indexIsPartial && topicConfig.index.length !== index.length) {
			throw new Error(
				'Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", ' +
				'instead found: ' + JSON.stringify(topicConfig.index)
			);
		}

		var assertIndexes = index.slice().sort();
		var configIndexes = topicConfig.index.slice().sort();
		var i;

		if (indexIsPartial) {
			for (i = 0; i < assertIndexes.length; i++) {
				if (configIndexes.indexOf(assertIndexes[i]) === -1) {
					throw new Error(
						'Expected partial index ' + JSON.stringify(index) + ' for topic ' +
						'"' + topic + '" to comply with index ' + JSON.stringify(topicConfig.index)
					);
				}
			}
		} else {
			for (i = 0; i < configIndexes.length; i++) {
				if (configIndexes[i] !== assertIndexes[i]) {
					throw new Error(
						'Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", ' +
						'key "' + assertIndexes[i] + '" not found, ' +
						'instead found ' + JSON.stringify(topicConfig.index)
					);
				}
			}
		}
	}

	// Compare required operations with supported operations on configured vaults. All vaults that
	// this topic API uses must support all required operations.

	if (!operations) {
		return;
	}

	var operationVaultNames = {
		list: listOrder,
		get: readOrder,
		add: writeOrder,
		set: writeOrder,
		touch: writeOrder,
		del: writeOrder
	};

	operations.forEach(function operationTest(operation) {
		// Get a list of all vault names that could be accessed for this operation.

		var availableVaultNames = operationVaultNames[operation];

		if (!availableVaultNames) {
			throw new Error(
				'Unrecognized operation "' + operation + '". ' +
				'Supported: ' + Object.keys(operationVaultNames).join(', ')
			);
		}

		// Test which of the vaults linked to this topic API do not support this operation.

		var goodVaults = [];
		var badVaults = [];

		vaultNames.forEach(function vaultTest(vaultName) {
			// Check if this vault is configured in (list|read|write)Order. If not, this environment
			// does not use this vault and we should ignore it.

			if (availableVaultNames.indexOf(vaultName) === -1) {
				return;
			}

			// Check if the vault supports the required operation.

			var vault = persistentVaults[vaultName];

			if (!vault) {
				// ignore non-persistent vaults ("client")
				return;
			}

			if (vault.archive && typeof vault.archive[operation] === 'function') {
				goodVaults.push(vaultName);
			} else {
				badVaults.push(vaultName);
			}
		});

		if (badVaults.length > 0) {
			throw new Error(
				'The vaults ' + JSON.stringify(badVaults) + ' are not compatible with the ' +
				'"' + operation + '" operation, required by topic "' + topic + '"'
			);
		}

		if (goodVaults.length === 0) {
			throw new Error(
				'No vault was found for topic "' + topic + '" that supports the ' +
				'"' + operation + '" operation'
			);
		}
	});
};


// SETUP PHASE

function registerVaultOrders(cfg) {
	if (!cfg) {
		throw new Error('Archivist configuration missing');
	}

	if (!cfg.vaults) {
		throw new Error('No "vaults" defined in the archivist configuration');
	}

	if (!Array.isArray(cfg.listOrder)) {
		throw new Error('No "listOrder"-array defined in the archivist configuration');
	}

	if (!Array.isArray(cfg.readOrder)) {
		throw new Error('No "readOrder"-array defined in the archivist configuration');
	}

	if (!Array.isArray(cfg.writeOrder)) {
		throw new Error('No "writeOrder"-array defined in the archivist configuration');
	}

	cfg.listOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" is in listOrder, but is not configured');
		}
	});

	cfg.readOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" is in readOrder, but is not configured');
		}
	});

	cfg.writeOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" is in writeOrder, but is not configured');
		}
	});

	listOrder = cfg.listOrder;
	readOrder = cfg.readOrder;
	writeOrder = cfg.writeOrder;
}


/**
 * @param {string}   topic                The name of the topic.
 * @param {Object}   cfg                  The user defined configuration of the topic.
 * @param {Array}    cfg.index            The names of the index properties. Defaults to [].
 * @param {Object}   cfg.readOptions      Read options for this topic, applied after each "get".
 * @param {Function} cfg.afterLoad        Gets called immediately after each successful "get".
 * @param {Function} cfg.beforeDistribute Gets called immediately before distribution of changes.
 */

function registerTopicConfig(topic, cfg) {
	topic = parseTopic(topic);

	// initialize topicConfig with defaults

	var defaultMediaTypes = ['application/json'];

	var topicConfig = {
		readOptions: {
			mediaTypes: cfg.mediaType ? [cfg.mediaType] : defaultMediaTypes,
			encodings: ['live'],
			optional: false
		}
	};

	// overwrite readOptions with given config

	if (cfg.readOptions) {
		overrideProperties(topicConfig.readOptions, cfg.readOptions);
	}

	// store index

	if (cfg.index && !Array.isArray(cfg.index)) {
		throw new Error('The configured index belonging to topic "' + topic + '" is not an array.');
	}

	topicConfig.index = cfg.index || [];

	// store hooks

	topicConfig.afterLoad = cfg.afterLoad;
	topicConfig.beforeDistribute = cfg.beforeDistribute;

	// store the topic config

	topicConfigs[topic] = topicConfig;
}


function getVaultType(vaultName, vaultConfig) {
	if (vaultName === 'client') {
		return 'client';
	}

	if (vaultConfig && vaultConfig.type) {
		return vaultConfig.type;
	}

	return undefined;
}


function registerTopicApiOnVault(topic, vaultName, topicConfig, vaultConfig) {
	topic = parseTopic(topic);

	// Test if the configured vault is at all present in list/read/write-order. If not, then
	// this environment doesn't require the topic to be stored in the vault that is specified
	// with this topic API.

	if (listOrder.indexOf(vaultName) === -1 &&
		readOrder.indexOf(vaultName) === -1 &&
		writeOrder.indexOf(vaultName) === -1) {
		logger.debug('Vault "' + vaultName + '" is not in list/read/write-order, skipping.');
		return false;
	}

	// Get the vault type from the configuration of this vault.

	var vaultType = getVaultType(vaultName, vaultConfig);

	if (!vaultType) {
		throw new Error('No vault type configured for vault "' + vaultName + '"');
	}

	// Get the module that implements the vault, so it can give a default topic API

	var vaultMod = getVaultMod(vaultType);

	if (!vaultMod) {
		throw new Error('Vault type "' + vaultType + '" does not exist.');
	}

	// Create the API for this topic on this vault.

	var api = {
		index: topicConfig.index || []
	};

	api = overrideProperties(api, vaultMod.defaultTopicApi);
	api = overrideProperties(api, topicConfig.vaults[vaultName]);

	// Register the API.

	if (!topicApis[topic]) {
		topicApis[topic] = {};
	}

	topicApis[topic][vaultName] = api;

	return true;
}


function registerTopicAclTestConditionOnVault(topic, topicConfig) {
	if (!topicConfig.vaults.client) {
		return;
	}

	var aclTest = topicConfig.vaults.client.acl;

	if (typeof aclTest !== 'function') {
		throw new Error('No "acl" test function defined for topic "' + topic + '" on vault "client"');
	}

	var aclTestConfig = {};

	aclTest(function (tags, ops, options) {
		options = options || {};

		if (!tags || (tags && !tags.length)) {
			throw new Error('No tags parameter defined for topic "' + topic + '"');
		}

		if (!ops || (ops && !ops.length)) {
			throw new Error('No ops parameter defined for topic "' + topic + '"');
		}

		tags = Array.isArray(tags) ? tags : [tags];
		ops = Array.isArray(ops) ? ops : [ops];

		tags.forEach(function (tag) {
			if (!tag) {
				throw new Error('Invalid ACL tag "' + tag + '" defined for topic "' + topic + '"');
			}

			if (aclTestConfig[tag]) {
				throw new Error('ACL tag "' + tag + '" for topic "' + topic + '" have been defined');
			}

			aclTestConfig[tag] = {
				ops: ops
			};

			if (options.shard) {
				aclTestConfig[tag].shard = options.shard;
			}
		});
	});

	topicApis[topic].client.acl = aclTestConfig;
}


function registerTopics(cfg, topicConfigs) {
	if (!cfg) {
		throw new Error('Archivist configuration missing');
	}

	// it is not required for any topics to exist

	if (!topicConfigs) {
		return;
	}

	if (!cfg.vaults) {
		throw new Error('No "vaults" defined in the archivist configuration');
	}

	var topics = Object.keys(topicConfigs);

	topics.forEach(function (topic) {
		var topicConfig = topicConfigs[topic];

		// register the topic configuration (readOptions, etc)

		registerTopicConfig(topic, topicConfig);

		// register topic API for vaults to use (serialize, shard, etc)

		var vaultNames = Object.keys(topicConfig.vaults || {});
		var topicHasApi = false;

		vaultNames.forEach(function (vaultName) {
			if (registerTopicApiOnVault(topic, vaultName, topicConfig, cfg.vaults[vaultName])) {
				topicHasApi = true;
			}
		});

		// register the topic acl test condition
		registerTopicAclTestConditionOnVault(topic, topicConfig);

		// if not a single vault can accomodate this topic, we must throw an error

		if (!topicHasApi) {
			throw new Error('None of the mentioned vaults for topic "' + topic + '" is available.');
		}
	});
}


function createPersistentVaults(cfg, cb) {
	if (!cfg) {
		throw new Error('No "vaults" defined in the archivist configuration');
	}

	var vaultNames = Object.keys(cfg);

	logger.debug('Creating persistent vaults', vaultNames);

	async.eachSeries(
		vaultNames,
		function (vaultName, callback) {
			var config = cfg[vaultName];

			createVault(vaultName, config.type, config.config, function (error, vault) {
				if (error) {
					return callback(error);
				}

				persistentVaults[vaultName] = vault;

				callback();
			});
		},
		cb
	);
}


exports.getConfiguration = function () {
	return mage.core.config.get(['archivist']);
};


exports.getTopicConfigs = function () {
	return require(ARCHIVIST_SETUP_PATH);
};


exports.setup = function (_logger, cb) {
	logger = _logger;

	var cfg, topicConfigs;

	try {
		cfg = exports.getConfiguration();
		topicConfigs = exports.getTopicConfigs();

		registerVaultOrders(cfg);
		registerTopics(cfg, topicConfigs);
	} catch (setupError) {
		logger.emergency(setupError);
		return cb(setupError);
	}

	// create the vaults

	createPersistentVaults(cfg.vaults, function (error) {
		if (error) {
			return cb(error);
		}

		try {
			assertTopicSanity();
		} catch (err) {
			logger.emergency(err);
			return cb(err);
		}

		return cb();
	});
};

exports.openVaults = function (_logger, cb) {
	async.eachSeries(
		Object.keys(persistentVaults),
		function (vaultName, callback) {
			const vault = persistentVaults[vaultName];

			if (!vault.open) {
				logger.error(`open method missing for vault ${vault.constructor.name}`);
				return callback();
			}

			vault.open((err) => {
				if (err) {
					logger.alert
					.details('Early errors may mean one of the following:')
					.details('  1. The remote server is down or inaccessible')
					.details('  2. You need to run `npm run archivist:create` to create')
					.details('     and configure storage for your vault backend')
					.details('See error data for more details.')
					.log(`Failed to set up vault ${vaultName}`);
				}

				return callback(err);
			});
		},
		cb
	);
};

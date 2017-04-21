var requirePeer = require('codependency').get('mage');
var aws = requirePeer('aws-sdk');
var Archive = require('./Archive');

exports.defaultTopicApi = require('./defaultTopicApi');

/**
 * Creates a new DynamoDB vault
 *
 * @param {string} name
 * @param {LogCreator} logger
 * @constructor
 */
function DynamoDbVault(name, logger) {
	this.name = name;
	this.logger = logger;
	this.archive = new Archive(this);  // archivist bindings

	this.dynamodb = null;
}

/**
 * Factory function to create a DynamoDbVault
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 * @returns {DynamoDbVault}
 */
exports.create = function (name, logger) {
	return new DynamoDbVault(name, logger);
};

/**
 * Sets up the vault
 *
 * @param {Object}   cfg                 The configuration object
 * @param {string}   cfg.accessKeyId     The access key provided by Amazon
 * @param {string}   cfg.secretAccessKey The secret key provided by Amazon
 * @param {string}   cfg.region          The AWS region you wish to connect to
 * @param {Function} cb
 */
DynamoDbVault.prototype.setup = function (cfg, cb) {
	// config aws
	aws.config.update(cfg);

	// then instanciate the DynamoDB object, this apiVersion is the one we used to write the service
	// please change it when updating to newer versions
	this.dynamodb = new aws.DynamoDB({ apiVersion: '2012-08-10' });

	// no async stuff, return on next tick
	setImmediate(cb);
};

/**
 * Get data from DynamoDB
 *
 * @param {string}   table      The table we want to query
 * @param {Object}   index      An object that represents the index we want to get, see the format in the DynamoDB doc
 *                              for getItem
 * @param {boolean}  consistent Whether we want the get operation to be consistent, will make the query slower
 * @param {Function} cb         A callback that will be called with an error and the data
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property
 */
DynamoDbVault.prototype.get = function (table, index, consistent, cb) {
	this.logger.verbose.data(index).log('Getting data from table', table);

	var params = {
		TableName: table,
		Key: index
	};

	if (consistent) {
		params.ConsistentRead = true;
	}

	this.dynamodb.getItem(params, cb);
};

/**
 * Put data on DynamoDB
 *
 * @param {string}   table     The table where we want to add/update data
 * @param {Object}   data      The data we want to insert, uses the DynamoDB structured format, see link below
 * @param {Object}   [expects] Expected conditions to perform the insertion
 * @param {Function} cb        A callback called with an error if one happened
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property
 */
DynamoDbVault.prototype.put = function (table, data, expects, cb) {
	this.logger.verbose('Storing data on table', table);

	var params = {
		TableName: table,
		Item: data
	};

	// expects is optional
	if (expects instanceof Function) {
		cb = expects;
	} else {
		params.Expected = expects;
	}

	// put the item
	this.dynamodb.putItem(params, cb);
};

/**
 * Delete data from DynamoDB
 *
 * @param {string}   table     The table where we want to delete data
 * @param {Object}   index     The primary key to delete, uses the DynamoDB structured format
 * @param {Object}   [expects] Expected conditions to perform the insertion
 * @param {Function} cb        A callback called with an error if one happened
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#deleteItem-property
 */
DynamoDbVault.prototype.del = function (table, index, expects, cb) {
	this.logger.verbose.data(index).log('Deleting data on table', table);

	var params = {
		TableName: table,
		Key: index
	};

	// expects is optional
	if (expects instanceof Function) {
		cb = expects;
	} else {
		params.Expected = expects;
	}

	// delete the item
	this.dynamodb.deleteItem(params, cb);
};

/**
 * Describe a table structure, useful to check if a table exists
 *
 * @param {string}   table The table name
 * @param {Function} cb    A callback that takes an error and the table description
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#describeTable-property
 */
DynamoDbVault.prototype.describeTable = function (table, cb) {
	this.dynamodb.describeTable({ TableName: table }, cb);
};

/**
 * Delete a table from DynamoDB, note that this operation can take several minutes, you should
 * monitor the table using describeTable for the operation status
 *
 * @param {string}   table The table name
 * @param {Function} cb    A callback that takes an error, and the table description
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#deleteTable-property
 */
DynamoDbVault.prototype.deleteTable = function (table, cb) {
	this.dynamodb.deleteTable({ TableName: table }, cb);
};

/**
 * Create a table in DynamoDB, by default waits for the table to become "ACTIVE" before returning
 * so that the user can start writing right after, it can take several minutes though in production.
 *
 * @param {Object}   params The table description, according to the DynamoDB API
 * @param {boolean}  [wait] Wait for the table to be available, default to true
 * @param {Function} cb     A callback taking an error and the table data
 *
 * @link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#createTable-property
 */
DynamoDbVault.prototype.createTable = function (params, wait, cb) {
	var that = this;

	if (typeof wait === 'function') {
		cb = wait;
		wait = true;
	}

	function pollCreatingTable() {
		that.describeTable(params.TableName, function (err, data) {
			if (err) {
				return cb(err);
			}

			// make a noticeable log in the console
			that.logger.notice.details('Status:', data.Table.TableStatus)
				.log('Waiting for table to be ready:', params.TableName);

			// if Status is not ACTIVE, then the table is not yet ready to be used
			if (data.Table.TableStatus !== 'ACTIVE') {
				return setTimeout(pollCreatingTable, 5000);
			}

			return cb(null, data);
		});
	}

	this.dynamodb.createTable(params, function (err, data) {
		if (err) {
			return cb(err);
		}

		// show some big warning to the user
		var log = that.logger.warning
			.details('Creating a table on DynamoDB in production will take up to several minutes')
			.details('Please do not exit the process while doing a migration or you will end up with')
			.details('a semi done migration, meaning that you will need to apply further changes')
			.details('manually and register the migration in the _migrations table.');

		if (wait) {
			// we are polling, tell the user to wait
			log.details('This function will poll the table every 5 seconds and return once it is')
				.details('ready to be used.');
		} else {
			// user asked for no polling, still tell him about it
			log.details('Manually poll the table using describeTable and check for the')
				.details('Table.TableStatus string to change to ACTIVE before doing any')
				.details('other operation on the table (any attempt to do so will result')
				.details('in an error).');
		}

		log.log('DynamoDB createTable:', params.TableName);

		// now poll the DB every 5 seconds until the table status changes from CREATING to ACTIVE
		if (wait) {
			return setTimeout(pollCreatingTable, 200);
		}

		return cb(null, data);
	});
};

/**
 * Get the list of versions already applied from DynamoDB
 *
 * @param {Function} cb A callback that takes an error and an array of versions
 */
DynamoDbVault.prototype.getMigrations = function (cb) {
	var that = this;

	function getVersions() {
		// because we only have one index, query won't work, we need to scan, as long as you don't
		// have more than 1MB of data in _migrations it should work, otherwise we may need to
		// change that query a little bit
		that.dynamodb.scan({ TableName: '_migrations' }, function (err, data) {
			if (err) {
				return cb(err);
			}

			// extract version informations from the table
			var versions = data.Items.map(function (item) {
				return item.version.S;
			});

			cb(null, versions);
		});
	}

	this.describeTable('_migrations', function (err) {
		if (!err) {
			// table exists, read from it
			return getVersions();
		}

		// we got an error we don't know, abort
		if (err.code !== 'ResourceNotFoundException') {
			return cb(err);
		}

		// table doesn't exists, create it, we use the version number as the primary key
		return that.createTable({
			AttributeDefinitions: [{
				AttributeName: 'version',
				AttributeType: 'S'
			}],
			TableName: '_migrations',
			KeySchema: [{
				AttributeName: 'version',
				KeyType: 'HASH'
			}],
			ProvisionedThroughput: {
				ReadCapacityUnits: 1,
				WriteCapacityUnits: 1
			}
		}, function (err) {
			if (err) {
				return cb(err);
			}

			// get the version and return them to the table
			return getVersions();
		});
	});
};

/**
 * Register a successful migration version
 * With the latest dynamodb, attributes can no longer be an empty string.
 * Report will be an empty object
 *
 * @param {string}   version A valid version number
 * @param {*}        report  Report data, will be JSON.stringify in the DB
 * @param {Function} cb      A callback that can take an error
 */
DynamoDbVault.prototype.registerMigration = function (version, report, cb) {
	report = report || {};

	var item = {
		version: { S: version },
		report: { S: JSON.stringify(report) },
		migratedAt: { N: parseInt(Date.now() / 1000, 10).toString() }
	};

	// silence extra data in callback
	this.put('_migrations', item, null, function (err) {
		return cb(err);
	});
};

/**
 * Delete a version from the migrated versions
 *
 * @param {string}   version A valid version number
 * @param {Function} cb      A callback that can take an error
 */
DynamoDbVault.prototype.unregisterMigration = function (version, cb) {
	var item = {
		version: { S: version }
	};

	// silence extra data in callback
	this.del('_migrations', item, null, function (err) {
		return cb(err);
	});
};

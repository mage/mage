// based on node-mysql, this vault does not support sharding yet
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: timestamp, colName3: 'mediaType' }
//
// references:
// -----------
// node-mysql:

var requirePeer = require('codependency').get('mage');
var mysql = requirePeer('mysql');
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
			`Cannot call "${method}" method on MysqlVault: MysqlVault is not initialized.\
			Please call open() before using it.`
		);
		this.name = 'UninitializedError';
	}
}

// Vault wrapper around node-mysql

function MysqlVault(name, logger) {
	var that = this;

	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	// internals

	this.mysql = null;                 // node-mysql library
	this.config = null;                   // the URI that connections will be established to
	this.pool = null;                  // node-mysql connection pool
	this.logger = logger;

	/* jshint camelcase:false */
	// connection is here for backward compat, please use pool from now on
	this.__defineGetter__('connection', function () {
		logger.debug('Accessing the "connection" property on the mysql vault is deprecated, please' +
			' use the "pool" property');
		return that.pool;
	});
}


exports.create = function (name, logger) {
	return new MysqlVault(name, logger);
};


MysqlVault.prototype.setup = function (cfg, cb) {
	this.mysql = mysql;

	if (cfg.url) {
		this.config = cfg.url;
	}

	if (cfg.options) {
		if (cfg.url) {
			this.logger.warning('Both "url" and "options" are set in the config, using "options"');
		}

		this.config = cfg.options;
	}

	this.pool = this.mysql.createPool(this.config);

	setImmediate(cb);
};

MysqlVault.prototype.open = function (cb) {
	this.logger.verbose('Opening vault:', this.name);

	// Create one connection
	this.pool.getConnection((err) => {
		if (err) {
			this.logger.emergency('Failed to open mysql connection', this.config);
		}

		return cb(err);
	});
};

MysqlVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.pool) {
		this.pool.end();
		this.pool = null;
	}
};


/**
 * Instantiates a fresh database based on the given configuration. The user credentials will have to
 * be set up appropriately. The collation will be set to UTF8_BIN.
 *
 * @param {Function} cb  Called upon completion.
 */

MysqlVault.prototype.createDatabase = function (cb) {
	var cfg = this.pool.config.connectionConfig;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	if (!cfg.database) {
		return cb(new Error('No database configured for vault ' + this.name));
	}

	var sql = 'CREATE DATABASE IF NOT EXISTS ' + this.mysql.escapeId(cfg.database) + ' COLLATE UTF8_BIN';

	this.logger.notice(sql);

	// Create a new pool without a databae configured for database creation. Then execute the create query. When the
	// pool is instantiated the configuration options are copied so we dont have to worry about object mutations.
	var createPool = mysql.createPool(this.config);
	createPool.config.connectionConfig.database = null;
	createPool.query(sql, null, function (queryError) {
		createPool.end(function (endError) {
			return cb(queryError || endError);
		});
	});
};


/**
 * Destroys the database (Use with caution!)
 *
 * @param {Function} cb  Called upon completion.
 */

MysqlVault.prototype.dropDatabase = function (cb) {
	var cfg = this.pool.config.connectionConfig;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	var sql = 'DROP DATABASE IF EXISTS ' + this.mysql.escapeId(cfg.database);

	this.logger.notice(sql);

	// Gracefully close all existing connections on the current pool before dropping the database.
	var that = this;
	this.pool.end(function (error) {
		if (error) {
			return cb(error);
		}

		// Once all connections have been closed, we create a new pool without a database configured so that we can drop
		// the database. Also until this is successfuly executed and the vault pool is re-instantiated, all operations
		// on the pool above (this.pool) will fail.
		var dropPool = mysql.createPool(that.config);
		dropPool.config.connectionConfig.database = null;
		dropPool.query(sql, null, function (queryError) {
			// Regardless of the outcome we restore the vault pool. If the drop is successul this pool will be useless
			// or rather so will throw an error, until the createDatabase function is called.
			that.pool = mysql.createPool(that.config);

			// Regardless of the outcome try and destroy the new pool created for this drop.
			dropPool.end(function (endError) {
				return cb(queryError || endError);
			});
		});
	});
};


/**
 * Creates a table with given columns
 *
 * @param {String} tableName - Name of the table
 * @param {Array} columns - Array of objects corresponding to columns ({ name: columnName, type: fieldType, pk: isKey })
 * @param {Function} cb
 */

MysqlVault.prototype.createTable = function (tableName, columns, cb) {
	var statements = [];
	var primaryKeys = [];
	for (var i = 0; i < columns.length; i += 1) {
		var index = columns[i];

		if (index.pk) {
			primaryKeys.push(mysql.escapeId(index.name));
		}

		statements.push('  ' + mysql.escapeId(index.name) + ' ' + index.type);
	}

	if (primaryKeys.length > 0) {
		statements.push('  PRIMARY KEY (' + primaryKeys.join(', ') + ')');
	}

	var sql =
		'CREATE TABLE ' + mysql.escapeId(tableName) + ' (\n' +
			statements.join(',\n') + '\n' +
		') ENGINE=InnoDB';

	this.logger.notice(sql);

	this.pool.query(sql, null, cb);
};


/**
 * Drops the given table (Use with caution!)
 *
 * @param {String} tableName - Name of the table
 * @param {Function} cb
 */

MysqlVault.prototype.dropTable = function (tableName, cb) {
	var sql = 'DROP TABLE ' + mysql.escapeId(tableName);

	this.logger.notice(sql);

	this.pool.query(sql, null, cb);
};


/**
 * Returns an array of all applied migration versions.
 * It also ensures the table for schema migrations exists.
 *
 * @param {Function} cb  Called upon completion, and given the array of versions.
 */

MysqlVault.prototype.getMigrations = function (cb) {
	this.logger.debug('Loading applied migrations list');

	var that = this;

	var sql =
		'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
		'  version    VARCHAR(255) NOT NULL,\n' +
		'  migratedAt INT UNSIGNED NOT NULL,\n' +
		'  report     TEXT NOT NULL,\n' +
		'  PRIMARY KEY (version)\n' +
		')\n' +
		'ENGINE=InnoDB\n' +
		'DEFAULT CHARACTER SET = utf8\n' +
		'COLLATE = utf8_bin';

	this.pool.query(sql, null, function (error) {
		if (error) {
			return cb(error);
		}

		that.select('schema_migrations', ['version'], null, null, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			rows = rows.map(function (row) {
				return row.version;
			});

			cb(null, rows);
		});
	});
};


/**
 * Stores a version in the schema migrations table. It assumes this table exists.
 *
 * @param {string}   version  The version of this migration.
 * @param {*}        report   A report that will be JSON stringified.
 * @param {Function} cb       Called upon completion.
 */

MysqlVault.prototype.registerMigration = function (version, report, cb) {
	var values = {
		version: version,
		migratedAt: parseInt(Date.now() / 1000, 10),
		report: report ? JSON.stringify(report) : ''
	};

	this.insert('schema_migrations', values, cb);
};


/**
 * Removes a version from the schema migrations table. It assumes this table exists.
 *
 * @param {string}   version  The version of this migration.
 * @param {Function} cb       Called upon completion.
 */

MysqlVault.prototype.unregisterMigration = function (version, cb) {
	var where = {
		version: version
	};

	this.del('schema_migrations', where, cb);
};


MysqlVault.prototype.select = function (table, cols, where, order, limit, cb) {
	if (!this.pool) {
		return cb(new UninitializedError('select'));
	}

	var columns, i, len;

	if (Array.isArray(cols)) {
		len = cols.length;
		if (len === 0) {
			return cb(new Error('MySQL cannot select 0 columns.'));
		}

		columns = new Array(len);

		for (i = 0; i < len; i++) {
			columns[i] = this.mysql.escapeId(cols[i]);
		}

		columns = columns.join(', ');
	}

	var query = 'SELECT ' + (columns || '*') + ' FROM ' + this.mysql.escapeId(table);
	var params = [];

	if (where) {
		var whereCols = [];

		for (var key in where) {
			whereCols.push(this.mysql.escapeId(key) + ' = ?');
			params.push(where[key]);
		}

		if (whereCols.length) {
			query += ' WHERE ' + whereCols.join(' AND ');
		}
	}

	if (order && order.length > 0) {
		// format: [{ name: 'colName', direction: 'asc' }, { name: 'colName2', direction: 'desc' }]
		// direction is 'asc' by default

		query += ' ORDER BY ';

		for (i = 0; i < order.length; i++) {
			if (i > 0) {
				query += ', ';
			}

			query += this.mysql.escapeId(order[i].name) + ' ' + (order[i].direction === 'desc' ? 'DESC' : 'ASC');
		}
	}

	if (limit) {
		query += ' LIMIT ' + parseInt(limit[0], 10);

		if (limit.length === 2) {
			query += ', ' + parseInt(limit[1], 10);
		}
	}

	this.logger.verbose('Executing:', query, params);

	this.pool.query(query, params, cb);
};


MysqlVault.prototype.insert = function (table, values, cb) {
	if (!this.pool) {
		return cb(new UninitializedError('insert'));
	}

	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ?';

	this.logger.verbose('Executing:', query);

	this.pool.query(query, values, cb);
};


MysqlVault.prototype.update = function (table, values, where, cb) {
	if (!this.pool) {
		return cb(new UninitializedError('update'));
	}

	var query = 'UPDATE ' + this.mysql.escapeId(table) + ' SET ? WHERE ?';

	this.logger.verbose('Executing:', query, where);

	this.pool.query(query, [values, where], cb);
};


MysqlVault.prototype.updateOrInsert = function (table, pk, values, cb) {
	if (!this.pool) {
		return cb(new UninitializedError('updateOrInsert'));
	}

	// Merge the key.pk into values, because these too need to be inserted.

	var insertParams = {}, update = [], i, cols, colName, escColName;

	// Run through the PK, and add the values to the insert-list.

	cols = Object.keys(pk);

	for (i = 0; i < cols.length; i++) {
		colName = cols[i];

		insertParams[colName] = pk[colName];
	}

	// Run through the values, and add them to the insert-list.
	// Also, construct the "UPDATE" clause.

	cols = Object.keys(values);

	for (i = 0; i < cols.length; i++) {
		colName = cols[i];
		escColName = this.mysql.escapeId(colName);

		insertParams[colName] = values[colName];

		update.push(escColName + ' = VALUES(' + escColName + ')');
	}

	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ? ON DUPLICATE KEY UPDATE ' + update.join(', ');

	this.logger.verbose('Executing:', query);

	this.pool.query(query, insertParams, cb);
};


MysqlVault.prototype.del = function (table, where, cb) {
	// Ensure `where` is an object
	var isObject = where && (typeof where === 'object') && !Array.isArray(where);
	if (!isObject) {
		return cb(new Error('The WHERE clause must be given as an object'));
	}

	var whereKeys = Object.keys(where);
	var whereKeysLength = whereKeys.length;
	if (whereKeysLength <= 0) {
		return cb(new Error('Nothing to feed the WHERE clause'));
	}

	// Build the query
	var query = 'DELETE FROM ' + this.mysql.escapeId(table) + ' WHERE';
	var args = [];
	for (var i = 0; i < whereKeysLength; i += 1) {
		var key = whereKeys[i];
		var value = where[key];

		query += ((i !== 0) ? ' AND ' : ' ') + this.mysql.escapeId(key) + ' = ?';
		args.push(value);
	}

	this.logger.verbose('Executing:', query, args);

	this.pool.query(query, args, cb);
};

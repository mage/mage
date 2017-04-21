// based on node-sqlite3, this vault does not support sharding yet
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: timestamp, colName3: 'mediaType' }
//
// references:
// -----------
// node-sqlite3:

var requirePeer = require('codependency').get('mage');
var sqlite;

if (!requirePeer) {
	sqlite = require('sqlite3');
} else {
	sqlite = requirePeer('sqlite3');
}

var Archive = require('./Archive');
var helpers = require('./helpers');
exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-sqlite3

function SQLite3Vault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	// internals

	this.sqlite = null;                 // node-sqlite3 library
	this.config = null;                 // the URI that connections will be established to
	this.db = null;
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new SQLite3Vault(name, logger);
};


SQLite3Vault.prototype.setup = function (cfg, cb) {
	this.sqlite = sqlite;
	this.config = cfg;

	var filename = cfg.filename;
	if (filename === null || filename === undefined) {
		this.config.filename = ':memory:';
	}

	this.db = new this.sqlite.Database(this.config.filename, cb);
};


SQLite3Vault.prototype.close = function (cb) {
	this.logger.verbose('Closing vault:', this.name);

	if (this.db) {
		this.db.close(cb);
		this.db = null;
	}
};


/**
 * Instantiates a fresh database based on the given configuration.
 * @param {Function} cb  Called upon completion.
 */

SQLite3Vault.prototype.createDatabase = function (cb) {
	var cfg = this.config;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	if (this.db) {
		return cb();
	}

	this.db = new this.sqlite.Database(cfg.filename, cb);
};


/**
 * Destroys the database (Use with caution!)
 *
 * @param {Function} cb  Called upon completion.
 */

SQLite3Vault.prototype.dropDatabase = function (cb) {
	var cfg = this.config;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	this.close(function (error) {
		if (error) {
			return cb(error);
		}

		if (cfg.filename === ':memory:' || cfg.filename === '') {
			return cb();
		}

		var fs = require('fs');
		fs.unlink(cfg.filename, cb);
	});
};


/**
 * Returns an array of all applied migration versions.
 * It also ensures the table for schema migrations exists.
 *
 * @param {Function} cb  Called upon completion, and given the array of versions.
 */
SQLite3Vault.prototype.getMigrations = function (cb) {
	this.logger.debug('Loading applied migrations list');

	var that = this;

	var sql =
		'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
		'  version    VARCHAR(255) NOT NULL,\n' +
		'  migratedAt INT UNSIGNED NOT NULL,\n' +
		'  report     TEXT NOT NULL,\n' +
		'  PRIMARY KEY (version)\n' +
		')';

	this.db.run(sql, [], function (error) {
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

SQLite3Vault.prototype.registerMigration = function (version, report, cb) {
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

SQLite3Vault.prototype.unregisterMigration = function (version, cb) {
	var where = {
		version: version
	};

	this.del('schema_migrations', where, cb);
};


SQLite3Vault.prototype.select = function (table, cols, where, order, limit, cb) {
	var columns, i, len;

	if (Array.isArray(cols)) {
		len = cols.length;
		if (len === 0) {
			return cb(new Error('SQLite cannot select 0 columns.'));
		}

		columns = [];

		for (i = 0; i < len; i++) {
			columns.push(cols[i]);
		}

		columns = columns.join(', ');
	}

	var query = 'SELECT ' + (columns || '*') + ' FROM ' + helpers.escapeId(table);
	var params = [];

	if (where) {
		var whereCols = [];

		for (var key in where) {
			whereCols.push(key + ' = ?');
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

			query += '? ' + (order[i].direction === 'desc' ? 'DESC' : 'ASC');
			params.push(order[i].name);
		}
	}

	if (limit) {
		query += ' LIMIT ' + parseInt(limit[0], 10);

		if (limit.length === 2) {
			query += ', ' + parseInt(limit[1], 10);
		}
	}

	this.logger.verbose('Executing:', query, params);

	this.db.all(query, params, cb);
};


SQLite3Vault.prototype.insert = function (table, values, cb) {
	values = helpers.parseCols(values);

	var params = values.values;

	var query = 'INSERT INTO ' + table + ' (' +
		values.columns.join(', ') + ') VALUES (' +
		values.fragment.join(', ') + ')';

	this.logger.verbose('Executing:', query, params);

	this.db.run(query, params, cb);
};


SQLite3Vault.prototype.update = function (table, values, where, cb) {
	values = helpers.parsePairs(values);
	where = helpers.parsePairs(where);

	var params = values.values.concat(where.values);

	var query = 'UPDATE ' + helpers.escapeId(table) + ' SET ' +
		values.pairs.join(', ') + ' WHERE ' +
		where.pairs.join(' AND ');

	this.logger.verbose('Executing:', query, params);

	this.db.run(query, params, cb);
};


// Using replace as sqlite does not have an update on duplicate key function
SQLite3Vault.prototype.updateOrInsert = function (table, pk, values, cb) {
	// Merge the key.pk into values, because these too need to be inserted.

	pk = helpers.parseCols(pk);
	values = helpers.parseCols(values);

	var cols = pk.columns.concat(values.columns);
	var frag = pk.fragment.concat(values.fragment);
	var params = pk.values.concat(values.values);

	var query = 'INSERT OR REPLACE INTO ' + helpers.escapeId(table) + ' (' +
		cols.join(', ') + ') VALUES (' + frag.join(', ') + ')';

	this.logger.verbose('Executing:', query, params);

	this.db.run(query, params, cb);
};


SQLite3Vault.prototype.del = function (table, where, cb) {
	var data = helpers.parsePairs(where);
	var params = data.values;

	var query = 'DELETE FROM ' + helpers.escapeId(table) + ' WHERE ' + data.pairs.join(' AND ');

	this.logger.verbose('Executing:', query, params);

	this.db.run(query, params, cb);
};

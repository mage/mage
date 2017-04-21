var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var rimraf = require('rimraf');

var sqliteVaultMod = require('lib/archivist/vaults/sqlite3');
var tmpPath = require('mktemp').createDirSync(path.join(os.tmpdir(), 'mage-sqlite-XXXXXXXXXX'));

var testData = {
	table: 'tests',
	mediaType: 'application/json'
};

function createSimpleData(data) {
	return {
		mediaType: testData.mediaType,
		value: JSON.stringify(data)
	};
}

var counter = 0;

function devNull() {}

var logger = {
	debug: devNull,
	verbose: devNull,
	alert: console.error,
	error: console.error,
	info: devNull,
	notice: devNull,
	warning: console.warn
};

function createVault(options, cb) {
	var name = 'default';
	var vault = sqliteVaultMod.create(name, logger);

	options = options || {};

	// for file test, create a different db everytime
	if (options.filename === 'filetest') {
		options.filename = path.join(tmpPath, counter++ + '.db');
	}

	vault.setup(options, cb);
	return vault;
}

function setupVault(container, cfg, cb) {
	var vault = container.vault = createVault(cfg, function (error) {
		assert.ifError(error);

		var sql =
			'CREATE TABLE IF NOT EXISTS ' + testData.table + ' (' +
			' id INTEGER PRIMARY KEY AUTOINCREMENT,' +
			' value TEXT NOT NULL,' +
			' mediaType VARCHAR(255) NOT NULL' +
			')';

		vault.db.run(sql, [], function (error) {
			return cb(error);
		});
	});
}

function destroyVault(vault, cb) {
	vault.close(function (error) {
		return cb(error);
	});
}

/* BEGIN TESTS */

var storageTypes = {
	memory: ':memory:',
	file: 'filetest',
	anonymousFile: ''
};

function tests(cfg) {
	describe('Basic Instantiation', function () {
		var vault;

		it('should not fail', function (done) {
			vault = createVault(cfg, done);
			assert.ok(vault, 'SQLiteVault instantiation failed.');
		});

		after(function (done) {
			destroyVault(vault, done);
		});
	});

	describe('#createDatabase', function () {
		var vault;

		before(function (done) {
			vault = createVault(cfg, done);
		});

		it('should create a database', function (done) {
			vault.createDatabase(done);
		});

		after(function (done) {
			destroyVault(vault, done);
		});
	});

	describe('#dropDatabase', function () {
		var vault;

		before(function (done) {
			vault = createVault(cfg, done);
		});

		it('should drop a database', function (done) {
			vault.dropDatabase(done);
		});
	});

	describe('#getMigrations', function () {
		var vault;

		before(function (done) {
			vault = createVault(cfg, done);
		});

		it('should get an array of migrations', function (done) {
			vault.getMigrations(function (error, migrations) {
				assert.ifError(error);
				assert(Array.isArray(migrations), 'Not an array');
				return done();
			});
		});

		after(function (done) {
			destroyVault(vault, done);
		});
	});

	describe('#registerMigration', function () {
		var vault;

		before(function (done) {
			vault = createVault(cfg, function () {
				vault.getMigrations(done);
			});
		});

		it('should not fail', function (done) {
			var version = '0.1.8';

			vault.registerMigration(version, 'Registered Migration', function (error) {
				assert.ifError(error);

				vault.getMigrations(function (error, migrations) {
					assert.ifError(error);
					assert.notEqual(migrations.indexOf(version), -1, 'Migration not registered');
					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(vault, done);
		});
	});

	describe('#unregisterMigration', function () {
		var vault;
		var version = '0.1.9';

		before(function (done) {
			vault = createVault(cfg, function () {
				vault.getMigrations(function () {
					vault.registerMigration(version, 'Registered Migration', function (error) {
						assert.ifError(error);
						return done();
					});
				});
			});
		});

		it('should unregister a migration', function (done) {
			vault.unregisterMigration(version, function (error) {
				assert.ifError(error);

				vault.getMigrations(function (error, migrations) {
					assert.ifError(error);
					assert.equal(migrations.indexOf(version), -1, 'Migration not unregistered');
					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(vault, done);
		});
	});

	describe('#insert', function () {
		var container = {};

		before(function (done) {
			setupVault(container, cfg, done);
		});

		it('should insert data', function (done) {
			var vault = container.vault;
			var data = { playerId: 12, hp: 399, level: 23 };
			var table = testData.table;
			var values = createSimpleData(data);

			vault.insert(table, values, function (error) {
				assert.ifError(error);

				vault.select(table, null, null, null, null, function (error, results) {
					assert.ifError(error);
					assert(results.length > 0, 'Entry not inserted');
					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(container.vault, done);
		});
	});

	describe('#update', function () {
		var container = {};
		var lastId;

		before(function (done) {
			setupVault(container, cfg, function (error) {
				assert.ifError(error);

				var vault = container.vault;
				var data = { playerId: 12, hp: 399, level: 23 };
				var table = testData.table;
				var values = createSimpleData(data);

				vault.insert(table, values, function (error) {
					assert.ifError(error);
					lastId = this.lastID;
					return done();
				});
			});
		});

		it('should update data', function (done) {
			var vault = container.vault;
			var data = { playerId: 14, hp: 1000, level: 100 };
			var table = testData.table;
			var where = { id: lastId };
			var values = { value: JSON.stringify(data) };

			vault.update(table, values, where, function (error) {
				assert.ifError(error);

				vault.select(table, null, where, null, null, function (error, results) {
					assert.ifError(error);
					assert(results.length > 0, 'Entry not inserted');

					var newData = JSON.parse(results[0].value);

					assert(Object.keys(data).length === Object.keys(newData).length, 'Data was mangled');

					for (var key in data) {
						assert.equal(data[key], newData[key], 'Data not updated');
					}

					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(container.vault, done);
		});
	});

	describe('#updateOrInsert', function () {
		var container = {};

		before(function (done) {
			setupVault(container, cfg, done);
		});

		it('should insert data', function (done) {
			var vault = container.vault;
			var data = { playerId: 12, hp: 399, level: 23 };
			var table = testData.table;
			var values = createSimpleData(data);
			var pk = { id: 1 };

			vault.updateOrInsert(table, pk, values, function (error) {
				assert.ifError(error);

				vault.select(table, null, pk, null, null, function (error, results) {
					assert.ifError(error);
					assert(results.length > 0, 'Entry not inserted');
					return done();
				});
			});
		});

		it('should update data', function (done) {
			var vault = container.vault;
			var data = { playerId: 14, hp: 1000, level: 100 };
			var table = testData.table;
			var pk = { id: 1 };
			var values = createSimpleData(data);

			vault.updateOrInsert(table, pk, values, function (error) {
				assert.ifError(error);
				vault.select(table, null, pk, null, null, function (error, results) {
					assert.ifError(error);
					assert(results.length > 0, 'Entry not inserted');

					var newData = JSON.parse(results[0].value);

					assert(Object.keys(data).length === Object.keys(newData).length, 'Data was mangled');

					for (var key in data) {
						assert.equal(data[key], newData[key], 'Data not updated');
					}

					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(container.vault, done);
		});
	});


	describe('#delete', function () {
		var container = {};

		before(function (done) {
			setupVault(container, cfg, function (error) {
				assert.ifError(error);

				var vault = container.vault;
				var data = { playerId: 12, hp: 399, level: 23 };
				var table = testData.table;
				var values = createSimpleData(data);

				vault.insert(table, values, done);
			});
		});

		it('should delete data', function (done) {
			var vault = container.vault;
			var table = testData.table;
			var where = { id: 1 };

			vault.del(table, where, function (error) {
				assert.ifError(error);

				vault.select(table, null, where, null, null, function (error, results) {
					assert.ifError(error);
					assert(results.length === 0, 'Entry not deleted');

					return done();
				});
			});
		});

		after(function (done) {
			destroyVault(container.vault, done);
		});
	});
}


describe('#SQLite vault', function () {
	before(function (done) {
		fs.mkdir(tmpPath, '0744', function (error) {
			if (error && error.code === 'EEXIST') {
				return done();
			}

			return done(error);
		});
	});

	var type;

	function test() {
		tests({ filename: type });
	}

	for (var key in storageTypes) {
		type = storageTypes[key];
		describe('#' + key, test);
	}

	after(function (done) {
		rimraf(tmpPath, done);
	});
});

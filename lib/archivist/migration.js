var mage = require('../mage');
var semver = require('semver');
var async = require('async');
var fs = require('fs');
var extname = require('path').extname;
var basename = require('path').basename;
var pathJoin = require('path').join;
var configuration = require('./configuration');
var logger = mage.core.logger.context('migration');


/**
 * Loads a file from the project's /lib/archivist/migrations/VAULT folder
 *
 * @param {Object} vault   The vault for which to load a migration file.
 * @param {string} version The specific version of the migration.
 * @returns {Object}       A module containing an 'up' and optionally a 'down' method.
 */

function loadMigrationFile(vault, version) {
	var migratorPath = pathJoin(configuration.getMigrationsPath(vault.name), version);

	return require(migratorPath);
}


/**
 * @param {Object}   vault    The vault to migrate.
 * @param {string[]} versions The versions, in order, to migrate across.
 * @param {Function} cb       Called on completion.
 */

function migrateUp(vault, versions, cb) {
	if (typeof vault.registerMigration !== 'function') {
		return cb(new Error('Cannot migrate up on vault ' + vault.name));
	}

	async.eachSeries(
		versions,
		function (version, callback) {
			logger.notice('Migrating', vault.name, 'vault to', version);

			var migrator;

			try {
				migrator = loadMigrationFile(vault, version);
			} catch (error) {
				return callback(error);
			}

			if (!migrator.up) {
				return callback(new Error('Cannot migrate ' + vault.name + ' vault up to ' + version));
			}

			migrator.up(vault, function (error, report) {
				if (error) {
					return callback(error);
				}

				vault.registerMigration(version, report, callback);
			});
		},
		cb
	);
}


/**
 * @param {Object}   vault    The vault to migrate.
 * @param {string[]} versions The versions, in order, to migrate across.
 * @param {Function} cb       Called on completion.
 */

function migrateDown(vault, versions, cb) {
	if (typeof vault.unregisterMigration !== 'function') {
		return cb(new Error('Cannot migrate down on vault ' + vault.name));
	}

	async.eachSeries(
		versions,
		function (version, callback) {
			logger.notice('Migrating', vault.name, 'vault down from', version);

			var migrator;

			try {
				migrator = loadMigrationFile(vault, version);
			} catch (error) {
				return callback(error);
			}

			if (!migrator.down) {
				return callback(new Error('Cannot migrate ' + vault.name + ' vault down from ' + version));
			}

			migrator.down(vault, function (error) {
				if (error) {
					return callback(error);
				}

				vault.unregisterMigration(version, callback);
			});
		},
		cb
	);
}


/**
 * Scans the hard disk for available migration files for this vault and returns the version names.
 *
 * @param {string} vaultName  The vault name for which to migrate.
 * @param {Function} cb       Callback that receives the found version numbers that can be migrated to or from.
 */

function getAvailableMigrations(vaultName, cb) {
	var path = configuration.getMigrationsPath(vaultName);

	fs.readdir(path, function (error, files) {
		if (error) {
			if (error.code === 'ENOENT') {
				logger.warning('No migration folder found for vault', vaultName, '(skipping).');
				return cb(null, []);
			}

			return cb(error);
		}

		var result = [];
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			var ext = extname(file);

			if (mage.isCodeFileExtension(ext)) {
				result.push(basename(file, ext));
			}
		}

		cb(null, result);
	});
}


/**
 * Calculates a path of versions to migrate between. The logic is copied from Ruby On Rails
 * ActiveRecord Migrations. Please read the chapter "About the schema_migrations table" at
 * http://api.rubyonrails.org/classes/ActiveRecord/Migration.html that applies to Rails 2.1.
 *
 * @param {string}   target    Version to migrate to.
 * @param {string[]} available An array of available versions that have migration logic.
 * @param {string[]} applied   An array of versions that have been applied up til now.
 * @returns {Object}           { direction: 'up/down', versions: ['v0.0.1', 'v0.2.0'] } sorted appropriately.
 */

function calculateMigration(target, available, applied) {
	available.sort(semver.compare);
	applied.sort(semver.compare);

	var current = applied.length ? applied[applied.length - 1] : 'v0.0.0';

	if (current === target) {
		logger.notice('Already at version:', target);

		return {
			direction: null,
			versions: []
		};
	}

	var direction = semver.gt(target, current) ? 'up' : 'down';
	var range;

	if (direction === 'up') {
		// we migrate up from 0.0.0 to the latest available (no newer than target)

		range = '<=' + target;

		// only upgrade to versions that have never been applied

		available = available.filter(function (version) {
			return applied.indexOf(version) === -1;
		});
	} else {
		// we migrate down to the oldest available (but not target or older)
		// target is excluded because we don't migrate down further _from_ target

		range = '>' + target + ' <=' + current;

		// reverse the order in which migrations will be applied

		available.reverse();

		// only downgrade the versions that have actually been applied

		available = available.filter(function (version) {
			return applied.indexOf(version) !== -1;
		});
	}

	available = available.filter(function (version) {
		return semver.satisfies(version, range);
	});

	return {
		direction: direction,
		versions: available
	};
}


/**
 * This analyzes the strategy for migrating a single vault to a given version. Then executes that
 * strategy.
 *
 * @param {Object}   vault         The vault to migrate
 * @param {string}   targetVersion The version to migrate to
 * @param {Function} cb            A callback to be called after migration of this vault completes
 */

function migrateVaultToVersion(vault, targetVersion, cb) {
	var preventMigrate = mage.core.config.get(['archivist', 'vaults', vault.name, 'config', 'preventMigrate'], false);
	if (preventMigrate) {
		logger.warning(`Vault ${vault.name} has disabled migrate operation (skipping)`);
		return cb();
	}

	if (typeof vault.getMigrations !== 'function') {
		logger.warning('Cannot migrate on vault', vault.name, '(skipping).');
		return cb();
	}

	// load applied versions

	vault.getMigrations(function (error, appliedVersions) {
		if (error) {
			return cb(error);
		}

		getAvailableMigrations(vault.name, function (error, available) {
			if (error) {
				return cb(error);
			}

			logger.debug('Available versions with migration paths:', available);

			var migration = calculateMigration(targetVersion, available, appliedVersions);

			logger.debug('Calculated migration path:', migration);

			if (migration.versions.length === 0) {
				logger.notice('No migrations to apply on vault', vault.name);
				return cb();
			}

			if (migration.direction === 'down') {
				migrateDown(vault, migration.versions, cb);
			} else {
				migrateUp(vault, migration.versions, cb);
			}
		});
	});
}


/**
 * Will migrate all vaults that can be migrated to the given version.
 *
 * @param {string}   targetVersion  A semver compatible version
 * @param {Function} cb             A callback to be called after migration completes
 */

exports.migrateToVersion = function (targetVersion, cb) {
	// migrate to given version

	if (!targetVersion) {
		targetVersion = mage.rootPackage.version;
	}

	var vaults = configuration.getPersistentVaults();
	var vaultNames = Object.keys(vaults);

	async.eachSeries(
		vaultNames,
		function (vaultName, callback) {
			migrateVaultToVersion(vaults[vaultName], targetVersion, callback);
		},
		function (error) {
			// suppress extra arguments to this callback

			cb(error);
		}
	);
};

var async = require('async');
var migrate = require('./archivist-migrate');

exports.setup = function (mage, options, cb) {
	async.series([
		(callback) => mage.core.loggingService.setup(callback),
		(callback) => mage.core.archivist.setup(callback)
	], cb);
};


exports.start = function (mage, options, cb) {
	var vaults = mage.core.archivist.getPersistentVaults();
	var vaultNames = options.vaults ? options.vaults.split(',') : Object.keys(vaults);

	async.eachSeries(vaultNames, function (vaultName, callback) {
		var vault = vaults[vaultName];

		if (!vault) {
			mage.core.logger.warning('Vault not configured:', vaultName);
			return callback();
		}

		var preventCreate = mage.core.config.get(['archivist', 'vaults', vaultName, 'config', 'preventCreate'], false);
		if (preventCreate) {
			mage.core.logger.notice('Vault', vault.name, 'has disabled create operation. Skipping.');
			return callback();
		}

		if (typeof vault.createDatabase === 'function') {
			vault.createDatabase(callback);
		} else {
			mage.core.logger.notice('Vault', vault.name, 'has no create operation. Skipping.');
			callback();
		}
	}, function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		mage.core.archivist.openVaults(function (error) {
			if (error) {
				mage.core.logger.emergency(error);
				return cb(error);
			}

			migrate.start(mage, options, cb);
		});
	});
};


exports.shutdown = function (mage, options, cb) {
	mage.core.archivist.closeVaults();
	mage.core.loggingService.destroy(cb);
};

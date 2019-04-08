var async = require('async');


exports.setup = function (mage, options, cb) {
	async.series([
		(callback) => mage.core.loggingService.setup(callback),
		(callback) => mage.core.archivist.setup(callback),
		(callback) => mage.core.archivist.openVaults(callback)
	], cb);
};


exports.start = function (mage, options, cb) {
	// migrate to given version

	var version = options.version || mage.rootPackage.version;

	mage.core.archivist.migrateToVersion(version, function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		cb(null, { shutdown: true });
	});
};


exports.shutdown = function (mage, options, cb) {
	mage.core.archivist.closeVaults();
	mage.core.loggingService.destroy(cb);
};

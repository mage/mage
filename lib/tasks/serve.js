// Starts all services that allow users to connect

var async = require('async');


exports.setup = function (mage, options, cb) {
	// set up the appMaster logic on the daemonizor, creating a PID file, etc.

	function setupDaemonizerCallbacks(callback) {
		require('../daemon').init();
		callback();
	}

	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
	}

	// Set up the archivist

	function setupArchivist(callback) {
		mage.core.archivist.setup(callback);
	}

	// Set up the msgServer. This will:
	// - connect to peers in the network for master and standalone

	function setupMsgServer(callback) {
		mage.core.msgServer.setup();
		callback();
	}

	// Set up the sampler.

	function setupSampler(callback) {
		mage.core.sampler.setup(callback);
	}

	// Set up the modules

	function setupModules(callback) {
		if (mage.core.processManager.isMaster) {
			return callback();
		}

		mage.setupModules(callback);
	}

	// Create the apps

	function createApps(callback) {
		if (mage.core.processManager.isMaster) {
			return callback();
		}

		try {
			mage.core.app.createApps();
		} catch (error) {
			return callback(error);
		}

		return callback();
	}

	// Set up heapdump on SIGUSR2

	function setupHeapDump(callback) {
		var error;

		try {
			require('heapdump');
		} catch (e) {
			error = e;
		}

		callback(error);
	}

	// Time to run each step!

	async.series([
		setupDaemonizerCallbacks,
		setupLogging,
		setupArchivist,
		setupMsgServer,
		setupSampler,
		setupModules,
		createApps,
		setupHeapDump
	], function (error) {
		if (error) {
			mage.core.logger.emergency('Error during MAGE setup:', error);
			return cb(error);
		}

		cb(null, { allowUserCallback: !mage.core.processManager.isMaster });
	});
};


exports.start = function (mage, options, cb) {
	function exposeSampler(callback) {
		if (mage.core.processManager.isWorker) {
			callback();
		} else {
			mage.core.sampler.expose(callback);
		}
	}

	function startSavvy(callback) {
		mage.core.savvy.start(callback);
	}

	function startHttpServer(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.core.httpServer.start(callback);
		}
	}

	function startProcessManager(callback) {
		mage.core.processManager.start(callback);
	}

	async.series([
		exposeSampler,
		startSavvy,
		startHttpServer,
		startProcessManager
	],
	function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		mage.setRunState('running');

		cb(null, { allowUserCallback: !mage.core.processManager.isMaster });
	});
};


exports.shutdown = function (mage, options, cb) {
	function closeHttpServer(callback) {
		mage.core.httpServer.close(callback);
	}

	function teardownModules(callback) {
		if (mage.core.processManager.isMaster) {
			return callback();
		}

		mage.teardownModules(callback);
	}

	function closeMsgServer(callback) {
		mage.core.msgServer.close(callback);
	}

	function closeVaults(callback) {
		mage.core.archivist.closeVaults();
		callback();
	}

	function closeSampler(callback) {
		mage.core.sampler.close();
		callback();
	}

	function closeLogger(callback) {
		mage.core.loggingService.destroy(callback);
	}

	function killWorkers(callback) {
		if (mage.core.processManager) {
			mage.core.processManager.killWorkers(callback);
		} else {
			callback();
		}
	}

	async.series([
		closeHttpServer,
		teardownModules,
		closeMsgServer,
		closeVaults,
		closeSampler,
		closeLogger,
		killWorkers
	], cb);
};

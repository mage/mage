var mage;
var logger;

var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var semver = require('semver');

var processManager = module.exports = new EventEmitter();
var workerManager;

var numberOfWorkers = false;
var shutdownOnError = true;

var realStartTime = Date.now();

var workersIncrement = 0;

function generateWorkerId() {
	return workersIncrement += 1;
}

// expose information

processManager.isMaster = false;  // true if the process is the master of the cluster (false for single-node mode)
processManager.isWorker = false;  // true if the process is a worker that has a master (false for single-node mode)
processManager.startTime = process.env.CLUSTER_START_TIME ?
	parseInt(process.env.CLUSTER_START_TIME, 10) :
	realStartTime;


processManager.getNumWorkers = function () {
	return workerManager ? workerManager.workers.length : null;
};

processManager.getConfiguredNumWorkers = function () {
	return numberOfWorkers;
};

var WORKER_STARTUP_TIMEOUT = 60 * 1000;
var shutdownGracePeriod = 15;


// EPIPE helper for each process: ignore EPIPE errors that occur on stdout/stderr when piping
// output to another process that is closing.

var epipebomb = require('epipebomb');
epipebomb(process.stdout);
epipebomb(process.stderr);


// The master PID is shared to workers on the environment.

processManager.getMasterPid = function () {
	if (cluster.isMaster) {
		return process.pid;
	}

	return parseInt(process.env.MASTER_PID, 10);
};


// A worker goes through these phases:
// * created: the child process has been created ("fork" event)
// * started: the child process is being executed ("online" event)
// probably:
// * ready: the child process is now accepting requests ("listening" event)
// finally:
// * shutdown: the child process is shutting down (on demand)

var PHASE_CREATED = 0;
var PHASE_STARTED = 1;
var PHASE_READY = 2;
var PHASE_SHUTDOWN = 3;


function WorkerManager(initialMax) {
	EventEmitter.call(this);

	this.max = initialMax;
	this.maxStartupTime = WORKER_STARTUP_TIMEOUT;

	// worker lists

	this.workers = [];
	this.phases = {};

	// setup phases

	this.setupWorkerPhaseManagement();
	this.setupReviver(); // will respawn processes if they died without known cause
}


util.inherits(WorkerManager, EventEmitter);


WorkerManager.prototype.setWorkerPhase = function (worker, phase) {
	this.phases[worker.id] = phase;

	this.emit('phase', worker, phase);
};


WorkerManager.prototype.setupWorkerPhaseManagement = function () {
	// list management and phase logging

	var that = this;
	var workers = this.workers;
	var timers = {};
	var maxStartupTime = this.maxStartupTime;

	function dropStartupTimeout(id) {
		clearTimeout(timers[id]);
		delete timers[id];
	}

	function createStartupTimeout(worker) {
		timers[worker.id] = setTimeout(function () {
			logger.alert(
				'Worker', worker.mageWorkerId, 'took more than', maxStartupTime / 1000,
				'sec to startup, shutting down...'
			);

			dropStartupTimeout(worker.id);

			that.killWorker(worker);
		}, maxStartupTime);
	}

	cluster.on('fork', function (worker) {
		logger.verbose('Worker', worker.mageWorkerId, 'has been created.');

		that.setWorkerPhase(worker, PHASE_CREATED);
		workers.push(worker);

		worker.dropStartupTimeout = function () {
			dropStartupTimeout(worker.id);
		};

		createStartupTimeout(worker);
	});

	cluster.on('online', function (worker) {
		logger.verbose('Worker', worker.mageWorkerId, 'has started.');

		that.setWorkerPhase(worker, PHASE_STARTED);
	});

	cluster.on('listening', function (worker, address) {
		logger.verbose.data(address).log(
			'Worker', worker.mageWorkerId, 'is ready to accept requests.'
		);

		that.setWorkerPhase(worker, PHASE_READY);

		dropStartupTimeout(worker.id);
	});

	cluster.on('disconnect', function (worker) {
		logger.verbose.log('Worker', worker.mageWorkerId, 'is shutting down.');

		that.setWorkerPhase(worker, PHASE_SHUTDOWN);
	});

	cluster.on('exit', function (worker, code, signal) {
		var info = {
			pid: worker.process.pid,
			code: code,
			signal: signal
		};

		if (worker._mageManagedExit || code === 0) {
			logger.verbose
				.data(info)
				.log('Worker', worker.mageWorkerId, 'committed graceful suicide');
		} else {
			logger.alert
				.data(info)
				.log('Worker', worker.mageWorkerId, 'died unexpectedly!', info);
		}

		dropStartupTimeout(worker.id);

		var index = workers.indexOf(worker);
		if (index !== -1) {
			workers.splice(index, 1);
		}

		that.emit('exit', worker, that.phases[worker.id]);

		delete that.phases[worker.id];
	});
};


WorkerManager.prototype.setupReviver = function () {
	var that = this;

	cluster.on('exit', function (worker) {
		// check if the worker was supposed to die

		if (!worker._mageManagedExit) {
			// this exit was not supposed to happen!
			// spawn a new worker to replace the dead one

			var id = worker.mageWorkerId;

			processManager.emit('workerOffline', id);
			that.createWorker(id);
		} else {
			if (!that.workers.length) {
				logger.emergency('All workers have shut down, shutting down master now.');
				process.exit(0);
			}
		}
	});
};


WorkerManager.prototype.createWorker = function (id, cb) {
	// cb is called exactly once: when the worker starts listening, or when listening failed
	id = id || generateWorkerId();

	var worker, success, failure;

	success = function (address) {
		worker.removeListener('exit', failure);
		worker._mageManagedExit = false;

		if (cb) {
			cb(null, worker, address);
		}
	};

	failure = function (code) {
		worker.removeListener('listening', success);

		logger.alert('Worker ' + id + ' (pid: ' + worker.process.pid + ') exited prematurely.');

		if (cb) {
			cb(new Error('Code: ' + code));
		}
	};

	logger.verbose('Forking worker');

	worker = cluster.fork({
		MASTER_PID: process.pid,
		MAGE_WORKER_ID: id,
		CLUSTER_START_TIME: processManager.startTime
	});

	// Override the ID
	worker.mageWorkerId = id;
	worker._mageManagedExit = true;

	worker.once('listening', success);
	worker.once('exit', failure);
};


WorkerManager.prototype.killWorker = function (worker, cb) {
	if (!worker) {
		return cb && cb();
	}

	// make sure we kill the process if we fail to

	var timer = setTimeout(function () {
		logger.error(
			'Failed to gracefully stop worker', worker.mageWorkerId, 'after',
			shutdownGracePeriod, 'seconds. Killing it with SIGKILL (-9)...'
		);

		process.kill(worker.process.pid, 'SIGKILL');
	}, shutdownGracePeriod * 1000);


	worker.once('exit', function () {
		if (timer) {
			clearTimeout(timer);

			if (cb) {
				cb();
			}
		}
	});

	worker._mageManagedExit = true;

	logger.verbose('Killing worker', worker.process.pid);

	process.kill(worker.process.pid, 'SIGTERM');
};


WorkerManager.prototype.killWorkers = function (workers, cb) {
	var that = this;

	async.forEach(
		workers.slice(),
		function (worker, callback) {
			that.killWorker(worker, callback);
		},
		cb
	);
};


WorkerManager.prototype.getWorkersOfPhase = function (phase) {
	var phases = this.phases;

	return this.workers.filter(function (worker) {
		return phases[worker.id] === phase;
	});
};


// setMax will terminate workers if there are more than the new max, but it will not
// spawn workers to conform.

WorkerManager.prototype.setMax = function (max, cb) {
	this.max = max;

	// see if we are running too many workers

	var workers = this.getWorkersOfPhase(PHASE_READY);
	var tooMany = workers.length - this.max;

	if (tooMany > 0) {
		// kill the tooMany workers so we reach max
		// call cb when done

		this.killWorkers(workers.slice(0, tooMany), cb);
	} else {
		cb();
	}
};


WorkerManager.prototype.shutdown = function (cb) {
	logger.verbose('Asking all workers to shut down.');

	this.killWorkers(this.workers, function () {
		logger.notice('Shutdown complete.');

		// close all net-servers

		cluster.disconnect();

		if (cb) {
			cb();
		}
	});
};


WorkerManager.prototype.recycle = function (parallelism, cb) {
	var killList = this.workers.slice().reverse(); // we'll pop, so the oldest worker comes first
	var spawnCount = this.max;
	var spawned = 0;
	var that = this;
	var progress = [0, spawnCount + killList.length];

	function incProgress() {
		progress[0] += 1;

		processManager.emit('recycleProgress', progress[0], progress[1]);
	}

	function createWorker(callback) {
		var processToReplace = killList[killList.length - 1];
		var id = processToReplace ? processToReplace.mageWorkerId : null;

		spawned += 1;

		that.createWorker(id, function (error) {
			if (!error) {
				incProgress();
			}

			callback(error);
		});
	}

	function killWorker(callback) {
		that.killWorker(killList.pop(), function (error) {
			if (!error) {
				incProgress();
			}

			callback(error);
		});
	}

	function recycler(recyclerCallback) {
		var lastOperation = 'kill'; // 'kill', so that the first operation becomes spawn

		async.whilst(
			function test() {
				return killList.length > 0 || spawned < spawnCount;
			},
			function spawnOrKill(callback) {
				if (lastOperation === 'kill' && spawned < spawnCount) {
					// spawn a new worker

					lastOperation = 'spawn';
					createWorker(callback);
				} else {
					// kill an old worker

					lastOperation = 'kill';

					if (killList.length > 0) {
						killWorker(callback);
					} else {
						callback();
					}
				}
			},
			recyclerCallback
		);
	}

	// create recycle workers for parallel execution

	var recycleWorkers = [];

	for (var i = 0; i < parallelism; i++) {
		recycleWorkers.push(recycler);
	}

	async.parallel(recycleWorkers, cb);
};


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object}         mageInstance                   A mage instance
 * @param {Object}         mageLogger                     A mage logger
 * @param {Object}         pmConfig                       Configuration for the process manager
 * @param {number}         pmConfig.shutdownGracePeriod   Number of seconds to wait for shutdown
 * @param {number|boolean} pmConfig.numberOfWorkers       Number of workers or false for single-node
 */

processManager.initialize = function (mageInstance, mageLogger, pmConfig) {
	mage = mageInstance;
	logger = mageLogger;

	// configuration updates

	shutdownGracePeriod = pmConfig.shutdownGracePeriod;
	shutdownOnError = pmConfig.shutdownOnError;

	if (pmConfig.numberOfWorkers === true) {
		// auto-detect the number of cores in the system and spawn as many workers

		numberOfWorkers = require('os').cpus().length;
	} else if (pmConfig.numberOfWorkers) {
		// truthy: a fixed number of workers (test for positive integer)

		if (parseInt(pmConfig.numberOfWorkers, 10) !== pmConfig.numberOfWorkers) {
			throw new Error('Number of workers must be boolean or integer');
		}

		if (pmConfig.numberOfWorkers <= 0) {
			throw new Error('Number of workers cannot be configured as negative');
		}

		numberOfWorkers = pmConfig.numberOfWorkers;
	} else {
		// falsy: it's a standalone app (default)

		numberOfWorkers = false;
	}

	// decide what type of process we are

	if (numberOfWorkers) {
		if (cluster.isMaster) {
			processManager.isMaster = true;
			processManager.isWorker = false;
		} else {
			processManager.isMaster = false;
			processManager.isWorker = true;
		}
	} else {
		processManager.isMaster = false;
		processManager.isWorker = false;
	}


	if (cluster.isMaster) {
		// Quit when the process is disconnected from the terminal (master and worker have to do
		// this for themselves)

		process.on('SIGHUP', function () {
			logger.notice('Caught SIGHUP, shutting down.');
			mage.exit();
		});

		// Quit when CTRL-C is pressed

		var sigIntCounter = 0;

		process.on('SIGINT', function () {
			sigIntCounter += 1;
			logger.notice('Caught SIGINT, shutting down.');
			mage.exit(null, sigIntCounter > 1);
		});

		// Quit when the default kill signal (TERM) is received

		process.on('SIGTERM', function () {
			logger.notice('Caught SIGTERM, shutting down.');
			mage.exit();
		});

		// As long as we respond (by simply existing), the caller will be happy.

		process.on('SIGCONT', function () {
			logger.info('Status request received, we are up and running!');
		});
	} else {
		// Disable SIGINT handler, since a CTRL-C should only be caught by the master, which will
		// shut down all workers

		process.on('SIGINT', function () {});

		// Quit when the process is disconnected from the terminal (master and worker have to do
		// this for themselves)

		process.on('SIGHUP', function () {
			logger.notice('Caught SIGHUP, shutting down.');
			mage.exit();
		});

		// Listen for shutdown requests (generally coming from the master process)

		process.on('SIGTERM', function () {
			logger.debug('Worker received shutdown request.');
			mage.exit();
		});
	}

	process.on('uncaughtException', function (error) {
		logger.emergency('Uncaught exception:', error);

		/**
		 * Exit if:
		 *
		 *   1. If the process manager is not initialized (or the variable is not set)
		 *   2. The current runstate is not 'running' (either setup or quitting)
		 *   3. We shut down on error according to the configuration
		 */
		if (!mage || mage.getRunState() !== 'running' || shutdownOnError) {
			mage.exit(-1);
		}
	});

	process.on('exit', function (code) {
		logger.notice(
			'Terminated with exit code', code, 'after running for',
			(Date.now() - realStartTime) / 1000, 'seconds.'
		);
	});
};


processManager.enableProcessTitle = function () {
	// set the process' title

	var appName = mage.rootPackage.name;
	var appVersion = mage.rootPackage.version;

	var processRole = processManager.isMaster ?
		'master' :
		(processManager.isWorker ? 'worker' : 'single');

	if (semver.lt(process.version, '0.10.0')) {
		var mageVersion = '(MAGE v' + mage.version + ', Node.js ' + process.version + ')';

		process.title = '[' + processRole + '] ' + appName + '/' + appVersion + ' ' + mageVersion;
	} else {
		// even with that we are not sure we'll get all the text in, no way around that
		process.title = processRole[0].toUpperCase() + ':' + appName + '/' + appVersion;
	}
};


/**
 * This function does not have to be called for CLI commands, but must be called when a game wants
 * to be served to clients. It will create workers if so configured, and emit a "started" event on
 * completion.
 *
 * @param {Function} cb   Called when all workers have successfully started up.
 */

processManager.start = function (cb) {
	// if no workers are to be managed, we're done

	if (!processManager.isMaster) {
		logger.debug('Startup phase completed in', process.uptime(), 'sec');

		processManager.emit('started');
		return cb();
	}

	// spawn the workers

	// for the master, we create a WorkerManager

	logger.debug('Starting', numberOfWorkers, 'workers');

	workerManager = new WorkerManager(numberOfWorkers);

	// Start all workers at once
	workerManager.recycle(numberOfWorkers, function (error) {
		if (error) {
			logger.emergency('Error while starting workers:', error);
			process.exit(-1);
		}

		logger.debug('Startup phase completed in', process.uptime(), 'sec');

		processManager.emit('started');
		cb();
	});
};

processManager.getWorkerManager = function () {
	return workerManager;
};

processManager.reload = function (cb) {
	if (workerManager) {
		// Recycle one worker at a time
		workerManager.recycle(1, cb);
	} else {
		cb(new Error('Can only reload master processes'));
	}
};


processManager.killWorkers = function (cb) {
	logger.verbose('Process preparing to shut down.');

	if (workerManager) {
		return workerManager.shutdown(cb);
	}

	setImmediate(cb);
};

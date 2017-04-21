var processManager;
var state;
var httpServer;
var commandCenter;
var archivist;
var msgServer;

var memwatch = require('memwatch-next');


/**
 * Pass in references to the emitters that mageSamplers needs access to.
 *
 * @param {Object} processManagerObj  The process manager library.
 * @param {Object} stateObj           The state library.
 * @param {Object} httpServerObj      The HTTP server library.
 * @param {Object} cmdCenter          The command center library.
 * @param {Object} archivistObj       The archivist core library.
 * @param {Object} msgServerObj       The message server library.
 */

exports.initialize = function (processManagerObj, stateObj, httpServerObj, cmdCenter, archivistObj, msgServerObj) {
	processManager = processManagerObj;
	state = stateObj;
	httpServer = httpServerObj;
	commandCenter = cmdCenter;
	archivist = archivistObj;
	msgServer = msgServerObj;
};


/**
 * Add mage core library loggers to a panopticon instance.
 *
 * @param {Panopticon} panopticon A Panopticon instance.
 */

exports.setupEventCounters = function (panopticon) {
	processManager.on('workerOffline', function () {
		panopticon.inc(null, 'workerOffLine', 1);
	});

	state.on('stateError', function () {
		panopticon.inc(['state'], 'errors', 1);
	});

	state.on('created', function () {
		panopticon.inc(['state'], 'created', 1);
	});

	state.on('destroyed', function () {
		panopticon.inc(['state'], 'destroyed', 1);
	});

	state.on('timeOut', function () {
		panopticon.inc(['state'], 'timeOut', 1);
	});

	archivist.on('vaultError', function (vaultName, typeOrOperation) {
		// these are errors at the vault-level (connections gone bad, DB gone, etc)

		panopticon.inc(['archivist', vaultName, 'errors'], typeOrOperation, 1);
	});

	archivist.on('operation', function (vaultName, operation, duration) {
		panopticon.timedSample(['archivist', vaultName, 'operations'], operation, duration);
	});

	commandCenter.on('openPostConnection', function (app) {
		panopticon.inc(['apps', app.name, 'postConnections'], 'opened', 1);
	});

	commandCenter.on('closePostConnection', function (app) {
		panopticon.inc(['apps', app.name, 'postConnections'], 'closed', 1);
	});

	commandCenter.on('completed', function (app, cmd, duration) {
		panopticon.timedSample(['apps', app.name, 'userCommands'], cmd.name, duration);
	});

	httpServer.on('response-finish', function (req, path, duration) {
		panopticon.timedSample(['httpServer', 'routes', req.method], path, duration);
	});

	var v8stats = [
		'num_full_gc',
		'num_inc_gc',
		'heap_compactions',
		'current_base',
		'estimated_base',
		'usage_trend',
		'min',
		'max'
	];

	memwatch.on('stats', function (stats) {
		// for information on the value of the numbers in stats, see
		// https://github.com/lloyd/node-memwatch/blob/master/src/memwatch.cc#L36

		for (var i = 0; i < v8stats.length; i += 1) {
			var v8stat = v8stats[i];

			panopticon.set(['memory', 'v8heap'], v8stat, stats[v8stat]);
		}
	});

	msgServer.on('sendMessage', function (bytes) {
		panopticon.inc(['msgServer'], 'bytesSent', bytes);
		panopticon.inc(['msgServer'], 'messagesSent', 1);
	});
};


/**
 * Each interval we may want to set some data. A panopticon instance needs to tell us when we can
 * do this. This function registers the listener.
 *
 * @param {Panopticon} panopticon   A Panopticon instance.
 */

exports.perIntervalSets = function (panopticon) {
	panopticon.on('newInterval', function () {
		panopticon.set(null, 'pid', process.pid);

		var numWorkers = processManager.getNumWorkers();

		if (typeof numWorkers === 'number') {
			panopticon.set(null, 'numWorkers', numWorkers);
		}
	});
};

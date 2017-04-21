var Panopticon = require('panopticon');
var EventEmitter = require('events').EventEmitter;
var mageSamplers = require('./mageSamplers');

var SAVVY_ROUTE = new RegExp('^/savvy/sampler(/|$)');

var mage, logger, processManager;

var panoptica = [];

// Data cache to be served. When a panopticon reports on any worker the data is placed in here.

var gatheredData = {};

// Data buffer. This keeps `n` data sets for each panopticon. `n` is determined by configuration.

var bufferedData = [];
var bufferLength = 0;

// A list of current panopticon logging methods. This array is a *copy* of the one used internally
// by Panopticon. i.e. it is not a reference and won't appear to be updated if new Panopticon
// logger methods are added.

var panopticonMethods = Panopticon.getLoggerMethodNames();

// Make this module an event emitter.
exports = module.exports = new EventEmitter();


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} mageInstance  A mage instance.
 * @param {Object} mageLogger    A mage logger.
 * @param {Object} procManager   The process manager library.
 */

exports.initialize = function (mageInstance, mageLogger, procManager) {
	mage = mageInstance;
	logger = mageLogger;
	processManager = procManager;
};


/**
 * Query the current aggregate using a path array. This is on the exports object so that it remains
 * available to the game programmer before mage.setup is called.
 *
 * @param {string[]} path    An array of keys used to address an arbitrary position in an object.
 * @param {Object}   [data]  The object containing all collected data to query through
 */

exports.query = function (path, data) {
	var response = data || gatheredData;

	// Dig into the path.
	for (var i = 0; i < path.length; i++) {
		var subPath = path[i];

		// Return early and respond with 404 if this path doesn't resolve.
		if (!response.hasOwnProperty(subPath)) {
			return undefined;
		}

		// The sub path resolved. Move the reference along and continue.
		response = response[subPath];
	}

	return response;
};


/**
 * Expose a panopticon instance logger method on this module. This newly exposed method forwards
 * its arguments to the equivalent method of all panopticon instances.
 *
 * @param {string} method The name of a panopticon instance logger method.
 */

function exposePanopticonMethod(method) {
	exports[method] = function () {
		for (var i = 0; i < panoptica.length; i++) {
			var panopticon = panoptica[i];

			panopticon[method].apply(panopticon, arguments);
		}
	};
}

// Sampler exposed methods which map to panopticon methods.
panopticonMethods.forEach(exposePanopticonMethod);


/**
 * Register a new logger type with Panopticon, and expose the method on this module to forward data
 * to panoptica.
 *
 * @param {string}   name              New logger name.
 * @param {Function} loggerConstructor A constructor conforming to the Panopticon logger API.
 * @param {Function} [validator]       An optional validator function.
 */

exports.registerMethod = function (name, loggerConstructor, validator) {
	// Register the new logger method with Panopticon.
	Panopticon.registerMethod(name, loggerConstructor, validator);

	// Expose the new logger method on this module.
	exposePanopticonMethod(name);
};


/**
 * A custom panopticon transformer function. This mutates datasets into a format that is more useful
 * to observium.
 *
 * @param  {Object} data A panopticon data aggregate.
 * @param  {string} id   The ID of a cluster member.
 * @return {Object}      Mutated data.
 */

function transformer(data, id) {
	function checkValue(obj) {
		if (!obj || typeof obj !== 'object') {
			return;
		}

		var keys = Object.keys(obj);

		if (keys.indexOf('value') !== -1) {
			obj.values = {};
			obj.values[id] = obj.value;
			delete obj.value;
			return;
		}

		for (var i = 0; i < keys.length; i++) {
			checkValue(obj[keys[i]]);
		}
	}

	checkValue(data);

	return data;
}


/**
 * This function is called when a panopticon emits a data set. It updates the buffer, and emits
 * the events `'panopticonDelivery'`, which forwards the panopticon data set, and `'updatedData'`,
 * which emits all data together.
 *
 * @param {Object} data A panopticon data set.
 */

function delivery(data) {
	var name = data.name;

	// Update the gatheredData object with the new data for this panopticon and emit its update.
	// This emission fires for every delivery, and contains the complete data across all panoptica.
	// This means that data may appear to be repeated (unless you check time stamps of course).

	gatheredData[name] = data;

	exports.emit('updatedData', gatheredData);

	// The delivery is data for this panopticon only, the others are not emitted here. That's also
	// how we keep the data in our buffer.

	var obj = {};
	obj[name] = data;

	if (bufferLength > 0) {
		bufferedData.push(obj);
	}

	exports.emit('panopticonDelivery', obj);

	// Maintain a maximum buffer length for each panopticon (remove the oldest samples).

	if (bufferedData.length > bufferLength) {
		bufferedData.splice(0, bufferedData.length - bufferLength);
	}
}


/**
 * Process a url's path into a path array.
 *
 * @param  {string}   pathname The path from a URL string.
 * @return {string[]} An array with elements that are sub-paths of increasing depth to index.
 */

function pathToQuery(pathname) {
	if (typeof pathname !== 'string') {
		throw new Error('Invalid path: ' + pathname);
	}

	var path = pathname.split('/');

	// Remove the useless '' (zeroth) element and the 'sampler' (first) element.

	var samplerPos = path.indexOf('sampler');
	if (samplerPos !== -1) {
		path = path.slice(samplerPos + 1);
	}

	// If the request had a trailing '/', remove the resulting empty final element in the path.
	if (path[path.length - 1] === '') {
		path.pop();
	}

	return path;
}


/**
 * A simple HTTP request-response handler to wrap exports.query.
 *
 * @param {http.ClientRequest}  req  HTTP client request object.
 * @param {http.ServerResponse} res  HTTP server response object.
 * @param {string}              path The path in the URL.
 */

function requestResponseHandler(req, res, path) {
	if (panoptica.length === 0) {
		// not set up

		res.writeHead(500, { 'content-type': 'text/plain' });
		res.end('Sampler has not been configured with any intervals');
		return;
	}

	var queryPath;

	try {
		queryPath = pathToQuery(path);
	} catch (error) {
		// bad request
		res.writeHead(400, { 'content-type': 'text/plain' });
		res.end('Failed to parse query path: ' + path);
		return;
	}

	var data = exports.query(queryPath);

	if (data === undefined) {
		logger.verbose('Could not find path', queryPath, 'in sampler. Available:', Object.keys(gatheredData));

		res.writeHead(404, { 'content-type': 'text/plain' });
		res.end('There is no data available at "' + queryPath.join('/') + '" at this time.');
		return;
	}

	try {
		data = JSON.stringify(data, null, '  ');
	} catch (jsonError) {
		logger.error('Error serializing sampler data:', jsonError);

		res.writeHead(500, { 'content-type': 'text/plain' });
		res.end('Error while serializing data');
		return;
	}

	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(data);
}


/**
 * Reads the config file for sampler configuration. Based on this it spawns panoptica.
 *
 * @param {Function} cb Callback function.
 */

exports.setup = function (cb) {
	// We need some initialisation data from config.
	var config = mage.core.config.get(['sampler']);
	var error;

	// If no intervals are given, skip the rest.
	if (!config || !config.intervals) {
		logger.debug('No intervals have been set up for sampler, skipping setup.');

		return cb();
	}

	// If there is configuration, but the intervals is not an object, then something was wrong.
	if (typeof config.intervals !== 'object') {
		error = new Error('Configuration "sampler.intervals" should resolve to an object.');
		logger.error.data('sampler.intervals', config.intervals).log(error);

		return cb(error);
	}

	var intervalNames = Object.keys(config.intervals);

	// If configuration exists, but the length of the intervals array is zero, skip the rest.
	if (intervalNames.length === 0) {
		logger.debug('No intervals have been set up for sampler, skipping setup.');

		return cb();
	}

	// This runs once. Are all the intervals finite numbers?
	var allFinite = intervalNames.every(function (name) {
		return Number.isFinite(config.intervals[name]);
	});

	if (!allFinite) {
		error = new Error('Interval values must be finite numbers.');
		logger.error.data('sampler.intervals', config.intervals).log(error);

		return cb(error);
	}

	// Panopticon reports in milliseconds by default. We want seconds, so we pass in a scale factor.
	var scaleFactor = 1000;

	// Once a sampler has submitted a log, we want it to be reset, not deleted between intervals.
	var persist = true;

	// Get the cluster start time. This is used to normalise the panoptica timings.
	var tStart = processManager.startTime;


	// Construct each panopticon and append it into the panoptica array.
	intervalNames.forEach(function (name) {
		var interval = config.intervals[name];

		// Create a new panopticon instance.
		var panopticon = new Panopticon(tStart, name, interval, scaleFactor, persist, transformer);

		// If the configuration indicates that Mage samples should be taken, we set this up here.
		if (config.sampleMage) {
			mageSamplers.setupEventCounters(panopticon);
			mageSamplers.perIntervalSets(panopticon);
		}

		// Initialize the data gathering empty
		gatheredData[name] = {};

		// Listen for deliveries from this panopticon.
		panopticon.on('delivery', delivery);

		panoptica.push(panopticon);

		// This emission fires every time a panoptica is setup and registered to the sampler
		exports.emit('panopticonRegistered', panopticon);
	});

	// Buffer length registration
	bufferLength = config.bufferLength || 0;

	cb();
};


exports.close = function () {
	// Each panopticon involves timers. Upon MAGE shutdown these need to be dealt with.

	for (var i = 0; i < panoptica.length; i++) {
		panoptica[i].stop();
	}

	exports.removeAllListeners();
};


/**
 * Add routes to host the gathered data
 *
 * @param {Function} cb Callback function.
 */

exports.expose = function (cb) {
	// A route external services to query the gathered data with an HTTP request.
	mage.core.savvy.addRoute(SAVVY_ROUTE, requestResponseHandler, 'simple');

	cb();
};

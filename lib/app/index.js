var async = require('async');

var mage = require('../mage');
var logger = mage.core.logger;


// app registration

var appMap = {};
var appList = [];


/**
 * This function creates instances of all configured apps and registers them into appMap and appList.
 */

exports.createApps = function (cb) {
	var appsConfig = mage.core.config.get(['apps']);

	var appNames = Object.keys(appsConfig);

	async.eachLimit(appNames, 5, function (appName, callback) {
		var appConfig = appsConfig[appName];

		if (!appConfig || appConfig.disabled) {
			logger.debug('Not creating app:', appName, appConfig ? '(disabled)' : '(no configuration found)');
			return setImmediate(callback);
		}

		logger.debug('Creating app:', appName);

		var app = {
			name: appName,
			config: appConfig,
			commandCenter: null
		};

		app.commandCenter = new mage.core.cmd.CommandCenter(app);

		app.commandCenter.setup(function (error) {
			if (error) {
				return callback(error);
			}

			appMap[appName] = app;
			appList.push(app);

			callback();
		});
	}, cb);
};


/**
 * Returns an app instance by name
 *
 * @param {string} name The name of the app
 * @returns {Object}
 */

exports.get = function (name) {
	return appMap[name];
};


/**
 * Returns all app instances in a list
 *
 * @returns {Array} All app instances
 */

exports.getAppList = function () {
	return appList;
};


/**
 * Returns all app instances in a key/value object
 *
 * @returns {Object} All app instances
 */

exports.getAppMap = function () {
	return appMap;
};


exports.getPublicConfig = function (baseUrl, app) {
	return {
		url: baseUrl + '/app/' + app.name,
		cors: mage.core.httpServer.getCorsConfig()
	};
};

'use strict';

/** @module app */

const memoize = require('memoizee');


// app registration

const appMap = {};
const appList = [];


/**
 * Returns the configuration for all apps (overridden during unit tests)
 *
 * @returns {Object}
 */
/* istanbul ignore next */
exports.getAppsConfig = memoize(function () {
	return require('lib/mage').core.config.get(['apps']);
});

/**
 * Returns a logger (overridden during unit tests)
 *
 * @returns {Object}
 */
/* istanbul ignore next */
exports.getLogger = memoize(function () {
	return require('lib/mage').core.logger;
});

/**
 * Creates and returns a CommandCenter instance for the given app (overridden during unit tests)
 *
 * @returns {Object}
 */
/* istanbul ignore next */
exports.createCommandCenter = function (app) {
	const CommandCenter = require('lib/mage').core.cmd.CommandCenter;
	return new CommandCenter(app);
};


/**
 * @classdesc App
 */
class App {
	/**
	 * @constructor
	 * @param {string} name     The name of the application
	 * @param {Object} config   The application configuration
	 */
	constructor(name, config) {
		this.name = name;
		this.config = config || {};
		this.commandCenter = exports.createCommandCenter(this);
	}

	/**
	 * Sets up the command center for this app
	 */
	setup() {
		this.commandCenter.setup();
	}
}


/**
 * Creates an instance of a configured app and registers it into appMap and appList
 *
 * @param {string} name  The name of the application
 * @returns {Object}     The created application
 * @throws {Error}       If the app by the given name is not configured to exist or has already been created
 */
exports.createApp = function (name) {
	const logger = exports.getLogger();
	logger.debug('Creating app:', name);

	const appsConfig = exports.getAppsConfig();
	if (!appsConfig.hasOwnProperty(name)) {
		throw new Error(`App "${name}" has not been configured`);
	}

	if (appMap[name]) {
		throw new Error(`App "${name}" has already been created`);
	}

	const app = new App(name, appsConfig[name]);
	app.setup();

	appMap[name] = app;
	appList.push(app);

	return app;
};


/**
 * Creates instances of all configured apps and registers them into appMap and appList.
 */
exports.createApps = function () {
	const logger = exports.getLogger();
	const appsConfig = exports.getAppsConfig();

	const appNames = Object.keys(appsConfig);
	for (const appName of appNames) {
		const appConfig = appsConfig[appName];

		if (appMap[appName]) {
			logger.debug(`Not creating app "${appName}" (already created)`);
			continue;
		}

		if (!appConfig) {
			logger.debug(`Not creating app "${appName}" (no configuration found)`);
			continue;
		}

		if (appConfig.disabled) {
			logger.debug(`Not creating app "${appName}" (disabled)`);
			continue;
		}

		exports.createApp(appName);
	}
};


/**
 * Returns true if the app has been created, false otherwise
 *
 * @param {string} name  The name of the application
 * @returns {boolean}
 * @throws {Error}       If the app by the given name is not configured to exist
 */
exports.isAppCreated = function (name) {
	const appsConfig = exports.getAppsConfig();
	if (!appsConfig.hasOwnProperty(name)) {
		throw new Error(`App "${name}" has not been configured`);
	}

	// If the app has been set up, it exists in the appMap

	return appMap.hasOwnProperty(name);
};


/**
 * Removes an app from the list of known apps. This is mostly useful for unit testing.
 *
 * @param {string} name  The name of the application
 * @throws {Error}       If an application with the given name was not found
 */
exports.removeApp = function (name) {
	const app = appMap[name];
	if (!app) {
		throw new Error(`App "${name}" does not exist or has not yet been set up`);
	}

	delete appMap[name];
	const index = appList.indexOf(app);
	if (index !== -1) {
		appList.splice(index, 1);
	}
};


/**
 * Removes all apps from the list of known apps. This is mostly useful for unit testing.
 */
exports.removeAllApps = function () {
	const apps = exports.getAppList();
	for (const app of apps) {
		exports.removeApp(app.name);
	}
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
 * @returns {Object[]} All app instances
 */
exports.getAppList = function () {
	return appList.slice();
};


/**
 * Returns all app instances in a key/value object
 *
 * @returns {Object} All app instances
 */
exports.getAppMap = function () {
	return appMap;
};

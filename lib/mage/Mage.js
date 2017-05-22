'use strict';

var CODE_EXTENSIONS = [
	'.js',
	'.ts'
];

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var util = require('util');
var path = require('path');
var async = require('async');
var semver = require('semver');

var rootPath = process.cwd();
var applicationModulesPath = path.resolve(rootPath, './lib/modules');


function testEngineVersion(pkg, pkgPath, mage) {
	if (!pkg || !pkg.engines || !pkg.engines.node) {
		return;
	}

	var range = pkg.engines.node;

	if (!semver.satisfies(process.version, range)) {
		console.error('Node.js version', process.version, 'does not satisfy range', range, 'as configured in', pkgPath);
		mage.quit(-1);
	}
}


/**
 * The mage class.
 *
 * @constructor
 * @extends EventEmitter
 */

function Mage(mageRootModule) {
	EventEmitter.call(this);

	this.task = null;

	this._runState = 'init';
	this._modulesList = [];
	this._modulePaths = [
		applicationModulesPath
	];
	this._setupQueue = [];

	// Set up the core object that holds some crucial Mage libraries

	this.core = { modules: {} };

	// Register the Mage version

	var magePath = path.join(path.dirname(__dirname), '..');

	var magePackagePath = path.join(magePath, 'package.json');
	var rootPackagePath = path.join(rootPath, 'package.json');

	var magePackage = require(magePackagePath);
	var rootPackage;

	try {
		rootPackage = require(rootPackagePath);
	} catch (error) {
		console.warn('Could not load your project\'s "package.json"', error);
	}

	var appName = rootPackage && rootPackage.name || path.basename(rootPath);
	var appVersion = rootPackage && rootPackage.version;

	this.version = magePackage.version;

	this.magePackage = {
		name: 'mage',
		version: magePackage.version,
		path: magePath,
		package: magePackage
	};

	this.rootPackage = {
		name: appName,
		version: appVersion,
		path: rootPath,
		package: rootPackage
	};

	// test the supported node version of mage itself as soon as possible

	testEngineVersion(this.magePackage.package, magePackagePath, this);
	testEngineVersion(this.rootPackage.package, rootPackagePath, this);

	require('codependency').register(mageRootModule);
}

util.inherits(Mage, EventEmitter);

/**
 * Example:
 *
 * ```javascript
 * mage.isCodeFileExtension('.js');
 * ```
 *
 * @summary Check if a file is considered like a source code file in MAGE
 * @param {string} ext File extension
 * @returns {boolean} True if the extension is for a source code file
 */
Mage.prototype.isCodeFileExtension = function (ext) {
	return CODE_EXTENSIONS.indexOf(ext) !== -1 && !!require.extensions[ext];
};

/**
 * Requiring Mage's dependencies into games.
 *
 * @param  {String} packageName Package to require.
 * @return {Object|Function} The content of the module.
 */

Mage.prototype.require = function (packageName) {
	return require(packageName);
};


/**
 * Returns the current run state of mage.
 *
 * @return {String} The current run state of mage.
 */

Mage.prototype.getRunState = function () {
	return this._runState;
};


/**
 * Sets mage to a new run state.
 *
 * @param {String} state A new run state to set the mage to.
 */

Mage.prototype.setRunState = function (state) {
	this._runState = state;

	this.emit('runState', state);
};


/**
 * Assigns MAGE a new task that will be run when mage.setup() and mage.start() are called.
 * Therefore, this must be done before setup() is called. It makes sense to assign the task based on
 * commandline arguments which are managed in ./cli.js.
 *
 * @param {string}   name       The name of a task, which should be requireable in the lib/tasks folder
 * @param {*}        [options]  An options argument to pass on the task's setup and start functions
 */

Mage.prototype.setTask = function (name, options) {
	this.task = {
		name: name,
		options: options
	};
};


/**
 * Returns an object containing a setup and start function that each accept a single callback. They
 * decorate the tasks implemented setup and start functions (both optional) which accept three
 * arguments: mage, options, cb. The options argument comes from the options that were passed when
 * setTask was called.
 *
 * If no task was assigned, undefined is returned.
 *
 * @returns {Object}
 */

Mage.prototype.getTask = function () {
	if (!this.task) {
		return;
	}

	var that = this;
	var name = this.task.name;
	var options = this.task.options;

	var api = require('../tasks/' + name);

	return {
		setup: function (cb) {
			if (api.setup) {
				api.setup(that, options, cb);
			} else {
				cb();
			}
		},
		start: function (cb) {
			if (api.start) {
				api.start(that, options, cb);
			} else {
				cb();
			}
		},
		shutdown: function (cb) {
			if (api.shutdown) {
				api.shutdown(that, options, cb);
			} else {
				cb();
			}
		}
	};
};


/**
 * Sets up core libraries.
 */

Mage.prototype.setupCoreLibs = function () {
	var core = this.core;

	// Set up the logging service and Mage internal logger

	var loggingService = require('../loggingService');

	core.loggingService = loggingService;
	core.logger = loggingService.createLogCreator();
	core.logger.addContexts('MAGE');

	// Load the CLI module and attached it to mage
	// CLI has no require-time dependencies outside of access to mage.setTask

	this.cli = require('../cli');

	// Set up the logger with a nice default before we have access to config

	loggingService.addWriter('terminal', ['>=notice'], {});

	core.config = require('../config');

	// Register classes

	core.State = require('../state').State;

	// Add other libraries

	core.processManager = require('../processManager');
	core.ProcessMessenger = require('../processMessenger');
	core.helpers = require('../helpers');
	core.app = require('../app');
	core.serviceDiscovery = require('../serviceDiscovery');
	core.httpServer = require('../httpServer').getHttpServer();
	core.msgServer = require('../msgServer');
	core.savvy = require('../savvy');
	core.archivist = require('../archivist');
	core.cmd = require('../commandCenter');
	core.sampler = require('../sampler');

	// Make this chainable.
	return this;
};


/**
 * Shuts mage down, allowing I/O sensitive subsystems to shut down gracefully.
 * This logic applies to Master and Worker processes alike.
 *
 * @param {Number}  exitCode An exit code for node to return.
 */

Mage.prototype.quit = function (exitCode, hard) {
	if (hard) {
		console.log('Shutting down HARD.');
		process.exit(1);
	}

	if (this.getRunState() === 'quitting') {
		return;
	}

	if (typeof exitCode !== 'number') {
		exitCode = 0;
	}

	if (this.core.logger) {
		this.core.logger.debug('Shutting down Mage...');
	} else {
		console.log('Shutting down Mage...');
	}

	this.setRunState('quitting');

	this.emit('shutdown');

	var task = this.getTask();

	// if something fails before tasks are set up, we can't shutdown anything gracefully

	if (!task) {
		// bail out
		return process.exit(exitCode);
	}

	// graceful shutdown

	task.shutdown(function () {
		if (process.env.DEBUG_MAGE) {
			// 100% graceful shutdown seems to depend on lingering requests. When that array hits 0 length, Node will
			// automatically exit with code 0.

			var handles = process._getActiveHandles();
			var requests = process._getActiveRequests();

			console.log('HANDLES (pid: ' + process.pid + ') [count: ' + handles.length + ']:', handles);
			console.log('REQUESTS (pid: ' + process.pid + ') [count: ' + requests.length + ']:', requests);
		}

		process.exit(exitCode);
	});
};


/**
 * Logs input arguments and quits mage with code -1.
 * @deprecated
 */

Mage.prototype.fatalError = function () {
	this.core.logger.warning('Calls to mage.fatalError are deprecated. Instead just throw your error.');

	if (arguments.length > 0) {
		this.core.logger.emergency.apply(this.core.logger, arguments);
	}

	this.quit(-1);
};


/**
 * Add a search path per argument for modules. Add the most important first.
 *
 * @param  {String} modPath A path to some modules.
 * @return {Object}         The mage itself is returned to allow chaining.
 */

Mage.prototype.addModulesPath = function (modPath) {
	this._modulePaths.push(path.resolve(rootPath, modPath));
	return this;
};


/**
 * Use a module, either from a path you have specified with `addModulesPath`, or from the modules
 * provided by mage. Modules are searched for in the paths in the order the paths were added, and
 * mage internal modules are search last. This function takes any number of module names as
 * arguments. Module names may be substituted for arrays for module names, so you can mix and match.
 *
 * @return {Object} The mage instance itself is returned to allow chaining.
 */

Mage.prototype.useModules = function () {
	var modList = [];

	// Construct a list (use Array#concat, so that an argument can be both an array and a string)
	for (var n = 0; n < arguments.length; n++) {
		modList = modList.concat(arguments[n]);
	}

	// Iterate over the arguments
	for (var i = 0; i < modList.length; i++) {
		var name = modList[i];
		var resolved = null;

		if (typeof name !== 'string') {
			throw new Error('Module names must be strings! Given:' + name);
		}

		// Check for registered modules with the same name

		if (this.core.modules.hasOwnProperty(name)) {
			// this module has already been created and should be ignored
			continue;
		}

		// Check for module that resolves in the search paths
		for (var k = 0; k < this._modulePaths.length; k++) {
			var resolvedPath = path.resolve(this._modulePaths[k], name);

			if (fs.existsSync(resolvedPath)) {
				resolved = resolvedPath;
				break;
			}
		}

		// If no module was found in the search paths, treat it as a mage module
		if (!resolved) {
			resolved = path.join(__dirname, '..', 'modules', name);
		}

		// load configuration

		this.core.config.loadModuleConfig(name, resolved);

		// expose the module

		this.core.logger.debug('Registering module', name);

		this._modulesList.push({ name: name, path: resolved });
		this._setupQueue.push(name);

		var mod = {};

		try {
			mod = require(resolved);
		} catch (error) {
			if (error.code !== 'MODULE_NOT_FOUND') {
				error.module = name;
				error.moduleFile = resolved;
				throw error;
			}

			this.core.logger.warning.data({
				moduleName: name,
				modulePath: resolved
			}).log('Module "' + name + '" has no implementation.');
		} finally {
			this[name] = this.core.modules[name] = mod;
		}
	}

	return this;
};

/**
 * Load all modules in the application's ./lib/modules.
 * @return {Object} The mage instance itself is returned to allow chaining.
 */

Mage.prototype.useApplicationModules = function () {
	var applicationModules = fs.readdirSync(applicationModulesPath).filter(function (file) {
		var fullpath = path.join(applicationModulesPath, file);
		return fs.statSync(fullpath).isDirectory();
	});

	return this.useModules(applicationModules);
};


/**
 * Returns the path of a module registered with mage under a given name.
 *
 * @param  {String}      name Module name.
 * @return {String|Null}      Path to the module. Returns null if the module name is not registered.
 */

Mage.prototype.getModulePath = function (name) {
	for (var i = 0, len = this._modulesList.length; i < len; i++) {
		var mod = this._modulesList[i];

		if (mod.name === name) {
			var modPath = mod.path;

			try {
				// This is required for cases where we might be importing
				// MAGE modules that are also Node.js modules, e.g. they
				// have their own `package.json` file
				modPath = path.dirname(require.resolve(mod.path));
			} catch (error) {
				if (error.code !== 'MODULE_NOT_FOUND') {
					throw error;
				}
			}

			return modPath;
		}
	}

	throw new Error('No module by the name of "' + name + '" has been registered.');
};


/**
 * Returns all registered module names, in order of registration.
 *
 * @return {string[]}   A list of module names, in order of registration.
 */

Mage.prototype.listModules = function () {
	return this._modulesList.map(function (mod) {
		return mod.name;
	});
};


/**
 * Setup logic for registered modules.
 *
 * @param  {Function} cb Takes only an error as an argument. Used for an `async.series`.
 */

Mage.prototype.setupModules = function (cb) {
	// If during the require() of one module, other modules are added through useModules, the
	// _setupQueue array will grow. This is perfectly safe, and should stay guaranteed. For that
	// reason, the next while-loop may NOT be changed to an eachSeries which could potentially
	// slice the array.

	var modules = this.core.modules;
	var logger = this.core.logger;
	var state = new this.core.State();
	var queue = this._setupQueue;

	async.whilst(
		function () {
			return queue.length > 0;
		},
		function (callback) {
			var name = queue.shift();
			var mod = modules[name];

			if (!mod || !mod.setup) {
				return callback();
			}

			var called = false;
			var timeout = setTimeout(function () {
				timeout = false;

				if (!called) {
					throw new Error('Module setup for module "' + name +
						'" timed out; did you forget to call the callback function?');
				}
			}, mod.setupTimeout || 5000);

			var wrappedCallback = function () {
				if (!timeout) {
					return; // Timeout error already occured
				}

				clearTimeout(timeout);

				if (called) {
					throw new Error('Module "' + name +
						'" calls its callback twice during its setup function');
				}

				// Contextualise the error message
				if (arguments[0] instanceof Error) {
					arguments[0].message = 'Failed to setup module "' + name +
						'", module setup returned error: ' + arguments[0].message;
				}

				called = true;
				callback.apply(null, arguments);
			};

			logger.verbose('Setting up module', name);

			mod.setup(state, wrappedCallback);
		},
		function (error) {
			state.close();

			cb(error);
		}
	);
};


/**
 * Sets up mage and its modules. Listen for the `'readyToStart'` event, or pass in a callback.
 *
 * @param {Function}        [cb] An optional callback, called when setup completes. No arguments.
 * @fires Mage:readyToStart
 */

Mage.prototype.setup = function (cb) {
	var that = this;

	var task = this.getTask();

	if (!task) {
		this.setTask('serve', null);
		task = this.getTask();
	}

	this.setRunState('setup');

	task.setup(function (error, options) {
		if (error) {
			if (cb) {
				return cb(error);
			}

			// uncatchable error, shut down mage
			return that.quit(-1);
		}

		options = options || {};


		if (!options.allowUserCallback) {
			return that.start(function (error) {
				if (error) {
					return that.quit(-1);
				}
			});
		}

		// The user is now responsible for calling mage.start()

		// yield all apps to the readyToStart event and the user callback (if there is one)

		var appMap = that.core.app.getAppMap();

		that.emit('readyToStart', appMap);

		if (cb) {
			cb(null, appMap);
		}
	});

	return this;
};


/**
 * @param  {Function} [cb] Optional callback to call when start has completed.
 */

Mage.prototype.start = function (cb) {
	var that = this;

	var task = this.getTask();

	task.start(function (error, options) {
		if (error) {
			if (cb) {
				return cb(error);
			}

			// uncatchable error, will shut down mage
			throw error;
		}

		options = options || {};

		if (options.allowUserCallback && cb) {
			cb();
		}

		if (options.shutdown) {
			that.quit(options.exitCode || 0);
		}
	});

	return this;
};


/**
 * Boot MAGE - set it up, and start it if the setup is successful
 */
Mage.prototype.boot = function (cb) {
	var that = this;

	this.cli.run();

	this.setup(function (error, apps) {
		if (error) {
			if (cb) {
				return cb(error);
			}

			throw error;
		}

		var keys = Object.keys(apps);
		keys.forEach(function (appName) {
			that.emit('setup.' + appName, apps[appName]);
		});

		that.start(cb);
	});
};


/**
 * Returns the development mode boolean value. Configure this with a config file or the
 * DEVELOPMENT_MODE environment variable.
 *
 * When configuring, either set developmentMode to true, or an object with granular settings.
 *
 * @param {string} [feature]  Will limit the dev-mode test to a particular feature.
 * @return {boolean}          If Mage is in dev-mode, then this returns `true`, else `false`.
 */

Mage.prototype.isDevelopmentMode = function (feature) {
	var cfg = this.core.config.get(['developmentMode']);

	if (cfg && typeof cfg === 'object') {
		cfg = feature && cfg.hasOwnProperty(feature) ? cfg[feature] : true;
	}

	return cfg === true;
};


Mage.prototype.getClientConfig = function (appName) {
	// We construct a mageConfig object from our app's configuration. These
	// are the core app config bits that need to make it into every build.
	// The app's URLs need to be hard coded into the build so the app knows
	// which server to connect to.

	const baseUrl = this.core.httpServer.getBaseUrl();
	const app = this.core.app.isAppCreated(appName) ? this.core.app.get(appName) : this.core.app.createApp(appName);

	return {
		appName: app.name,
		appVersion: this.rootPackage.version,
		server: {
			baseUrl: baseUrl,
			msgStream: this.core.msgServer.getPublicConfig(baseUrl),
			commandCenter: app.commandCenter.getPublicConfig(baseUrl),
			savvy: this.core.savvy.getPublicConfig(baseUrl)
		},
		developmentMode: this.isDevelopmentMode()
	};
};


// Set the module.exports to the mage constructor.
module.exports = Mage;

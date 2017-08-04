var jsYaml = require('js-yaml');
var jsonlint = require('jsonlint');
var fs = require('fs');
var path = require('path');
var Matryoshka = require('./Matryoshka');
var loggingService = require('../loggingService');

var cwd = process.cwd();
var configDir = path.join(cwd, 'config');
var supportedTypes = ['.yaml', '.json', '.js'];

var logger;

var configList = [];

var runtimeConfig = new Matryoshka({}, 'runtime');

var aggregate;

var isInitialized = false;

// Set up the logger with a nice default before we have access to config;
// This will be overriden by MAGE once during its instanciation, but
// is needed for cases where we wish to apply dynamic configuration, and
// directly require this module before requiring MAGE.
//
// See: https://mage.github.io/mage/#dynamic-configuration

loggingService.addWriter('terminal', ['>=notice'], {});

/**
 * Attempt to load a config file, and provide some helpful output if the file cannot be parsed.
 *
 * @param  {String} configPath A filesystem path to the configuration file.
 * @return {Object}            The loaded configuration object.
 */

function loadConfigFile(configPath) {
	logger.debug('Loading configuration file at:', configPath);

	var extension = path.extname(configPath);

	if (extension === '.yaml') {
		var options = {
			filename: configPath
		};

		return jsYaml.safeLoad(fs.readFileSync(configPath, { encoding: 'utf8' }), options);
	}

	if (extension === '.js') {
		return require(configPath);
	}

	if (extension === '.json') {
		try {
			return require(configPath);
		} catch (e) {
			try {
				jsonlint.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
			} catch (lintError) {
				if (typeof lintError.message === 'string') {
					lintError.message = lintError.message.replace(/\t/g, ' ');
				}

				throw lintError;
			}

			throw new Error('There was a problem loading a configuration file: ' + configPath);
		}
	}

	throw new Error('Configuration file is an unsupported type [.yaml, .json, .js]: ' + configPath);
}


/**
 * Given a configuration, recursively parses it and tries to match values to environment variables
 * Environment variables can be cast to a specific type by adding using (env_name):(type) as a syntax.
 *
 * @param {Object} config The env configuration to parse
 * @returns {Object}
 */
function loadEnvironment(config) {
	if (typeof (config) !== 'object') {
		return {};
	}

	var castFns = {
		int: function (val) {
			return parseInt(val, 10);
		},
		float: function (val) {
			return parseFloat(val);
		},
		bool: function (val) {
			return val === 'true';
		}
	};

	var finalConf = {};
	for (var key in config) {
		if (!config.hasOwnProperty(key)) {
			continue;
		}

		var val = config[key];

		switch (typeof (val)) {
		case 'object':
			finalConf[key] = loadEnvironment(val);
			break;
		case 'string':
			var type = 'string';
			if (val.indexOf(':') !== -1) {
				var tmp = val.split(':');
				val = tmp[0];
				type = tmp[1];
			}

			if (process.env[val]) {
				var cast = castFns[type] || String;
				finalConf[key] = cast(process.env[val]);
			}
			break;
		default:
			logger.warning('Invalid type for key "' + key + '", should be string, skipping.');
			break;
		}
	}
	return finalConf;
}


/**
 * Given a file name without extension, attempt to load the file. The files are assumed to be in a
 * folder called 'config' that lives in the same directory that you booted your game in.
 *
 * @param  {String}  dir           An absolute path to the directory containing the config file.
 * @param  {String}  name          The file name (without extension).
 * @param  {Boolean} warn          Warn if configuration file was not found.
 * @param  {Boolean} defaultEmpty  Set to true to return undefined rather than a fresh empty config.
 * @param  {Boolean} isEnvironment Set to true if the file describe environment variables
 * @return {Object}                Contains "source" (the complete file path) and "config" keys.
 */
function loadConfig(dir, name, warn, defaultEmpty, isEnvironment) {
	var extensionlessSource = path.join(dir, name);
	var rawSource;
	var rawConfig;

	for (var i = 0; i < supportedTypes.length && !rawConfig; i++) {
		rawSource = extensionlessSource + supportedTypes[i];

		if (fs.existsSync(rawSource)) {
			rawConfig = loadConfigFile(rawSource);
		}
	}

	if (!rawConfig) {
		if (warn) {
			logger.info(
				'No configuration content of name "' + name + '" was loaded from directory:',
				configDir
			);
		}

		if (!defaultEmpty) {
			return;
		}

		rawSource = module.filename;
		rawConfig = {};
	}

	if (rawConfig && isEnvironment) {
		rawConfig = loadEnvironment(rawConfig);
	}

	return { source: rawSource, config: rawConfig };
}


/**
 * Perform the merge of all source Matryoshka and update the aggregate with it.
 *
 * @return {Matryoshka} The merged of the three source containers.
 */

function regenerate() {
	aggregate = Matryoshka.merge.apply(Matryoshka, configList);
}


function parseTrail(path) {
	// Strings can be split on dots into an array of path segments.
	// Empty strings should yield empty array though (a split empty string yields an array with one
	// empty string in it)
	if (typeof path === 'string') {
		return path === '' ? [] : path.split('.');
	}

	// Arrays can just pass through.
	if (Array.isArray(path)) {
		return path;
	}

	// If we didn't return yet, then the path was wrong in some way.
	throw new TypeError('Configuration paths must be arrays or dot delimited strings.');
}


/**
 * Set a highest level key to contain some source object.
 *
 * @param {String} name       The key to assign the content to.
 * @param {String} sourcePath Absolute path to the configuration source file.
 */

exports.setTopLevelDefault = function (name, sourcePath) {
	var obj = {};
	obj[name] = loadConfigFile(sourcePath);

	var moduleConfig = configList[0];

	configList[0] = Matryoshka.merge(moduleConfig, new Matryoshka(obj, sourcePath));
	regenerate();
};


/**
 * Set a batch of top level defaults.
 *
 * @param {String} sourcePath An absolute path to the config file.
 */

exports.setDefaults = function (sourcePath) {
	var moduleConfig = configList[0];

	configList[0] = Matryoshka.merge(
		moduleConfig,
		new Matryoshka(loadConfigFile(sourcePath), sourcePath)
	);

	regenerate();
};


/**
 * Dynamically set a configuration value
 *
 * @param {String} name       The key to assign the content to.
 * @param {*} value 		  Value
 */
exports.set = function (name, value) {
	const obj = {};
	const subpaths = name.split('.');
	const lastSubpath = subpaths.pop();
	const lastSubObj = subpaths.reduce((subObj, subpath) => {
		const newObj = {};
		subObj[subpath] = newObj;

		return newObj;
	}, obj);

	lastSubObj[lastSubpath] = value;

	runtimeConfig = Matryoshka.merge(
		runtimeConfig,
		new Matryoshka(obj, 'runtime')
	);

	configList[configList.length - 1] = runtimeConfig;

	regenerate();
};

/**
 * A helper class to resolve a configuration file and load it. The mod path should be the path to
 * the module folder. The config file is expected to be named config.<extension>.
 *
 * @param {String} modName The module name.
 * @param {String} modPath The absolute path to the module folder.
 */

exports.loadModuleConfig = function (modName, modPath) {
	var obj = { module: {} };
	var loaded = loadConfig(modPath, 'config');

	// An undefined loaded means that there was nothing to load, so just return here.
	if (!loaded) {
		return;
	}

	obj.module[modName] = loaded.config;

	var moduleConfig = configList[0];

	configList[0] = Matryoshka.merge(moduleConfig, new Matryoshka(obj, loaded.source));
	regenerate();
};


/**
 * Get a copy of the raw configuration from a given path.
 *
 * @param  {String[]|String} trail An array of keys, or a string with steps delimited by '.'.
 * @param  {*}               alt   If nothing is resolved, use alt.
 * @return {*}                     The resolved raw configuration object or alt.
 */

exports.get = function (trail, alt) {
	return aggregate.get(parseTrail(trail), alt);
};


/**
 * Get the source of a member of a configuration object.
 *
 * @param  {String[]|String}  trail An array of keys, or a string with steps delimited by '.'.
 * @return {String|Undefined}       The source path of the configuration member.
 */

exports.getSource = function (trail) {
	return aggregate.getSourceWithPath(parseTrail(trail));
};


/**
 * Get a copy of the underlying matryoshka object that stores the configuration aggregate.
 *
 * @param  {String[]|String} trail An array of keys, or a string with steps delimited by '.'.
 * @return {Matryoshka}            A Matryoshka instance containing a copy of the aggregated config.
 */

exports.getMatryoshka = function (trail) {
	var matryoshka = aggregate;

	if (trail) {
		matryoshka = matryoshka.tunnel(parseTrail(trail));
	}

	return matryoshka ? matryoshka.copy() : undefined;
};


/**
 * For proper logging config needs access to the mage logger. We pass it in to this function, which
 * attempts to load configuration files.
 *
 * @param {Object} logObj A mage logger object. Config uses logObj.warn and logObj.info.
 */

exports.initialize = function () {
	if (isInitialized) {
		throw new Error('The config module has already been initialized.');
	}

	isInitialized = true;

	// We create a temporary log creator until MAGE provides us with one;
	// See `setLogger` for more details.
	const temporaryLogger = loggingService.createLogCreator();
	this.setLogger(temporaryLogger);

	var nodeEnv = process.env.NODE_ENV;

	if (!nodeEnv) {
		throw new Error(
			'No value was set for the environment variable "NODE_ENV". ' +
			'This variable is needed for environment specific configuration.'
		);
	}

	var defaultConf = loadConfig(configDir, 'default', true, true, false);

	var moduleConfig = new Matryoshka({}, module.filename);
	var defaultConfig = new Matryoshka(defaultConf.config, defaultConf.source);

	configList.push(moduleConfig);
	configList.push(defaultConfig);

	var devMode;

	if (process.env.DEVELOPMENT_MODE === 'true') {
		devMode = true;
	} else if (process.env.DEVELOPMENT_MODE === 'false') {
		devMode = false;
	}

	var envConfs = nodeEnv.split(',');

	for (var i = 0; i < envConfs.length; i += 1) {
		var userConf = loadConfig(configDir, envConfs[i], true, true, false);

		// The DEVELOPMENT_MODE environment variable can override things.

		if (devMode !== undefined) {
			userConf.config.developmentMode = devMode;
		}

		configList.push(new Matryoshka(userConf.config, userConf.source));
	}

	var envConf = loadConfig(configDir, 'environment', false, true, true);
	var envConfig = new Matryoshka(envConf.config, envConf.source);
	configList.push(envConfig);

	// Push the dynamic runtime config
	configList.push(runtimeConfig);

	// The aggregate will contain the merge of all configs, and will be kept up to date.
	regenerate();

	// Make this chainable.
	return exports;
};

// Method used during testing to set a fixed configuration
// layering
exports.setConfigList = function (newConfigList) {
	configList = newConfigList;
	regenerate();
};

exports.getConfigList = function () {
	return configList;
};

exports.setLogger = function (loggerInstance) {
	logger = loggerInstance.context('config');
};

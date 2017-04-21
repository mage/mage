var async = require('async');
var pathBasename = require('path').basename;
var pathResolve = require('path').resolve;
var pathJoin = require('path').join;
var rl = require('../lib/readline.js');

var magePath = process.cwd();
var appPath = pathResolve(magePath, '../..');

var magePackage = require(pathJoin(magePath, 'package.json'));
var npmArgs = JSON.parse(process.env.npm_config_argv);

// Note: the following will NOT work
// with NPM versions; mage@1.1.1 would break
// not only here, but because template files
// will hard-code the version as repo#version
// (note the hash)
var MAGE_REPO = npmArgs.remain[0];
var MAGE_VERSION = magePackage.version;
var MAGE_PACKAGE_VERSION = magePackage.version;

if (MAGE_REPO.indexOf('#') !== -1 || MAGE_REPO.indexOf('/') !== -1) {
	MAGE_PACKAGE_VERSION = MAGE_REPO;
} else if (MAGE_REPO.indexOf('@') !== -1) {
	MAGE_PACKAGE_VERSION = MAGE_REPO.substring(MAGE_REPO.indexOf('@') + 1);
}

var replacements = {};

function getVar(varName, required) {
	if (required && !replacements.hasOwnProperty(varName)) {
		throw new Error('Found unknown template variable: ' + varName);
	}

	var value = replacements[varName] || '';

	return '' + (typeof value === 'function' ? value() : value);
}

function ask(question, varName, re, cb) {
	rl.ask(question, getVar(varName), function (answer) {
		if (re && !answer.match(re)) {
			return ask(question, varName, re, cb);
		}

		replacements[varName] = answer;

		cb();
	});
}

replacements = {
	APP_NAME: pathBasename(appPath),
	APP_PATH: appPath,
	APP_PATHNAME: pathBasename(appPath),
	APP_DESCRIPTION: '',
	APP_VERSION: '0.0.1',
	APP_AUTHOR: process.env.USER,
	APP_LICENSE: 'Private',
	APP_REPO: '',
	APP_CLIENTHOST_EXPOSE: '',
	MAGE_REPO: MAGE_REPO,
	MAGE_VERSION: MAGE_VERSION,
	MAGE_PACKAGE_VERSION: MAGE_PACKAGE_VERSION,
	MAGE_NODE_VERSION: (magePackage.engines && magePackage.engines.node) ? magePackage.engines.node : '',
	ENV_USER: process.env.USER
};


exports.prepare = function (cb) {
	// ask questions to fill the replacements map

	async.series([
		function (callback) {
			ask('Name your game:', 'APP_NAME',
				/^.{2,}/, callback);
		},
		function (callback) {
			ask('Describe your game:', 'APP_DESCRIPTION',
				null, callback);
		},
		function (callback) {
			ask('Name the author/company:', 'APP_AUTHOR',
				null, callback);
		},
		function (callback) {
			ask('Provide the base URL for your game (you may leave this empty):', 'APP_CLIENTHOST_EXPOSE',
				null, callback);
		},
		function (callback) {
			ask('Please provide a valid GitHub repository URL (if there is one):', 'APP_REPO',
				null, callback);
		}
	], cb);
};

exports.replace = function (varName) {
	return getVar(varName, true);
};

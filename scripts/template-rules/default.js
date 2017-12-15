var async = require('async');
var pathBasename = require('path').basename;
var pathResolve = require('path').resolve;
var pathJoin = require('path').join;
var rl = require('../lib/readline.js');

var magePath = pathResolve(__dirname, '../..');
var appPath = process.cwd();

var magePackage = require(pathJoin(magePath, 'package.json'));
var MAGE_PACKAGE_VERSION = magePackage._from;
var replacements = {};

if (MAGE_PACKAGE_VERSION.substring(0, 5) === 'mage@') {
	MAGE_PACKAGE_VERSION = MAGE_PACKAGE_VERSION.substring(5);
}

if (MAGE_PACKAGE_VERSION === 'latest') {
	MAGE_PACKAGE_VERSION = magePackage.version;
}

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

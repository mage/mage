var path = require('path');
var mage = require('../mage');
var logger = mage.core.logger.context('savvy');
var httpServer = mage.core.httpServer;

// Savvy configuration

mage.core.config.setTopLevelDefault('savvy', path.join(__dirname, 'config.yaml'));

var ROUTE_STR = '/savvy';
var ROUTE_RE = new RegExp('^' + ROUTE_STR + '/');

var SOCK_FILE = mage.core.config.get(['savvy', 'sockfile']);
var SOCK_PATH = path.resolve(SOCK_FILE);

if (process.platform === 'win32') {
	SOCK_PATH = path.join('\\\\.\\pipe', SOCK_PATH);
}

function trimRegExp(re) {
	re = re.toString();
	if (re[0] === '/') {
		re = re.substr(1);
	}

	if (re[re.length - 1] === '/') {
		re = re.substr(0, re.length - 1);
	}

	return re;
}

exports.getPublicConfig = function (baseUrl) {
	return {
		url: baseUrl + '/savvy',
		cors: httpServer.getCorsConfig()
	};
};


exports.getRoute = function () {
	return ROUTE_STR;
};


exports.addRoute = function (pathMatch, fn, type) {
	// enforce a base route of /savvy/

	var base = ROUTE_STR + '/';

	if (typeof pathMatch === 'string') {
		if (pathMatch.indexOf(base) !== 0) {
			throw new Error('Your Savvy route must start with ' + base + '. Instead found: ' + pathMatch);
		}
	} else if (pathMatch instanceof RegExp) {
		var str = trimRegExp(pathMatch);
		var test = trimRegExp(ROUTE_RE);
		var testEsc = trimRegExp(ROUTE_RE).replace(/\//g, '\\/');  // slashes escaped

		// match up the regular expression with the savvy base path

		if (str.indexOf(test) !== 0 && str.indexOf(testEsc) !== 0) {
			throw new Error(
				'Your Savvy route must start with ' + test + ' or ' + testEsc + '. ' +
				'Instead found: ' + pathMatch
			);
		}
	}

	if (mage.core.processManager.isWorker) {
		// we don't add the route, as our role is to proxy
		logger.verbose('Not registering route, as this process can only proxy Savvy requests.');
		return;
	}

	httpServer.addRoute(pathMatch, fn, type);
};


/**
 * Lets Savvy listen for incoming requests.
 *
 * @param {Function} cb
 */

exports.start = function (cb) {
	if (mage.core.processManager.isMaster) {
		// We use the HTTP server API to listen on savvy.sock and deal with incoming requests.

		httpServer.listen({ file: SOCK_PATH }, cb);
	} else {
		// There will be clientHost managed on this process, and we will register our routes on it.
		// If we are a worker, that implies that we're part of a cluster and should proxy the
		// incoming connections to the master process. If we're the master process, it implies that
		// this is a single-node situation and we can simply listen to all routes we care about
		// directly.

		if (mage.core.processManager.isWorker) {
			// there is a master, so we must proxy to it

			httpServer.addRoute(ROUTE_RE, function () {
				return SOCK_PATH;
			}, 'proxy');
		}

		setImmediate(cb);
	}
};

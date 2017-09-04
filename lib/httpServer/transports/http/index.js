var assert = require('assert');
var http = require('http');
var mime = require('mime');
var httpClose = require('http-close');
var url = require('url');
var WebSocketServer = require('ws').Server;
var fs = require('fs');
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var pathRelative = require('path').relative;
var pathSeparator = require('path').sep;
var proxy = require('./proxy.js');
var HttpRouter = require('./HttpRouter.js');
var EventEmitter = require('events').EventEmitter;
var cors = require('./cors.js');
var handlebars = require('handlebars');

module.exports = exports = new EventEmitter();


var logger, expose, server, wsServer, corsConfig;

var isListening = false;

var enableCors;
var allowFolderExposure;
var longRoutes = [];
var longThreshold = 0.5; // The amount of time in seconds after which a request is considered long.
var closeTimeout = 5000;

var quietRoutes = [];

exports.setCorsConfig = function (config) {
	if (!config) {
		corsConfig = undefined;
		enableCors = undefined;
		return;
	}

	// the wildcard origin ONLY works on requests without credentials

	var methods = Array.isArray(config.methods) ? config.methods.join(', ') : config.methods;

	corsConfig = {
		methods: (methods || 'GET, POST, PUT, DELETE, HEAD, OPTIONS').toUpperCase(),
		origin: config.origin || '*',
		credentials: !!config.credentials
	};

	if (!config.maxAge) {
		corsConfig.maxAge = '1728000';  // 1728000 is 20 days
	} else if (typeof config.maxAge === 'string' || typeof config.maxAge === 'number') {
		corsConfig.maxAge = String(config.maxAge);
	}

	enableCors = cors(corsConfig);
};


exports.expose = function (url) {
	if (url === null || url === undefined) {
		// If no base URL has been configured, a relative path can be used client-side.
		// This is good enough for web apps that are hosted by the MAGE server itself.
		// In that case, we return empty string, because can be safely concatenated with
		// paths.

		expose = '';
		return;
	}

	if (typeof url !== 'string') {
		throw new TypeError('Expose URL is not a string: ' + url);
	}

	// drop trailing slashes (for later path concatenation)

	while (url.slice(-1) === '/') {
		url = url.slice(0, -1);
	}

	expose = url;
};


exports.initialize = function (mageLogger, cfg) {
	logger = mageLogger;
	cfg = cfg || {};

	var cfgCors = cfg.clientHost ? cfg.clientHost.cors : null;
	var cfgExpose = cfg.clientHost ? cfg.clientHost.expose : null;
	var cfgLongRoutes = cfg.longRoutes || [];
	var cfgQuietRoutes = cfg.quietRoutes || [];

	if (cfg.longThreshold) {
		longThreshold = cfg.longThreshold / 1000;
	}

	if (cfg.clientHost && cfg.clientHost.closeTimeout) {
		closeTimeout = cfg.clientHost.closeTimeout;
	}

	var i;

	for (i = 0; i < cfgQuietRoutes.length; i += 1) {
		try {
			quietRoutes.push(new RegExp(cfgQuietRoutes[i]));
		} catch (e) {
			mageLogger.alert.data(e).log('Error parsing quietRoutes config.');
		}
	}

	for (i = 0; i < cfgLongRoutes.length; i += 1) {
		try {
			longRoutes.push(new RegExp(cfgLongRoutes[i]));
		} catch (e) {
			mageLogger.alert.data(e).log('Error parsing longRoutes config.');
		}
	}

	exports.expose(cfgExpose);
	exports.setCorsConfig(cfgCors);
};


exports.setFolderExposure = function (allow) {
	allowFolderExposure = allow;
};


// HTTP route handling

var routers = {
	http: new HttpRouter(['simple', 'callback', 'proxy']),
	websocket: new HttpRouter(['websocket', 'proxy'])
};

function createSimpleHandler(fn) {
	return function (req, res, path, urlInfo) {
		fn(req, res, path, urlInfo.query, urlInfo);
	};
}

function createCallbackHandler(fn) {
	return function (req, res, path, urlInfo) {
		fn(req, path, urlInfo.query, function (statusCode, body, headers) {
			if (typeof statusCode !== 'number') {
				logger.error
					.data('request', req)
					.log(new Error('Callback handler received non numeric HTTP code (defaulting to 500)'));

				statusCode = 500;
			}

			res.writeHead(statusCode, headers);
			res.end(body);
		});
	};
}

function createWebSocketHandler(fn) {
	return function (client, urlInfo) {
		fn(client, urlInfo);
	};
}


function createProxyHandler(fn) {
	// a proxy handler must return an endpoint string, which it may do based on the incoming request
	// the format of the endpoint is { host: '', port: 123 } or { path: './foo.sock' }

	return function (req, urlInfo) {
		var endpoint = fn(req, urlInfo);

		var socket = proxy(req, endpoint);

		socket.on('connect', function () {
			logger.verbose('Proxy socket for', urlInfo.pathname, 'to', endpoint, 'connected.');
		});

		socket.on('close', function () {
			logger.verbose('Proxy socket for', urlInfo.pathname, 'to', endpoint, 'closed.');
		});

		socket.on('error', function (error) {
			logger.error('Connection error while proxying', urlInfo.pathname, 'to', endpoint, error);
		});
	};
}


/**
 * @param {string|RegExp} pathMatch
 * @param {Function}      fn
 * @param {string}        type
 */

exports.addRoute = function (pathMatch, fn, type) {
	if (typeof fn !== 'function') {
		throw new TypeError('Route handler must be a function');
	}

	// supported types: callback, simple, websocket, proxy
	// for backwards compatibility, undefined will map to "callback", and boolean true to "simple".

	if (type === undefined) {
		type = 'callback';
	} else if (type === true) {
		type = 'simple';
	}

	var handler;

	switch (type) {
	case 'simple':
		handler = createSimpleHandler(fn);
		routers.http.add(pathMatch, handler, type);
		break;
	case 'callback':
		handler = createCallbackHandler(fn);
		routers.http.add(pathMatch, handler, type);
		break;
	case 'websocket':
		handler = createWebSocketHandler(fn);
		routers.websocket.add(pathMatch, handler, type);
		break;
	case 'proxy':
		handler = createProxyHandler(fn);
		routers.http.add(pathMatch, handler, type);
		routers.websocket.add(pathMatch, handler, type);
		break;
	default:
		throw new Error('Unknown route handler type: ' + type);
	}

	logger.verbose('Added', type, 'route:', pathMatch);
};


exports.delRoute = function (pathMatch) {
	routers.http.del(pathMatch);
	routers.websocket.del(pathMatch);

	logger.verbose('Removed route:', pathMatch);
};


exports.setFavicon = function (buffer, mimetype) {
	if (!Buffer.isBuffer(buffer)) {
		throw new TypeError('The favicon content must be a Buffer object.');
	}

	var headers = {
		'content-type': mimetype || 'image/x-icon',
		'content-length': buffer.length
	};

	exports.addRoute('/favicon.ico', function (req, path, params, cb) {
		logger.debug('Serving favicon.ico');

		cb(200, buffer, headers);
	});
};

exports.hasFavicon = function () {
	return !!routers.http.get('/favicon.ico');
};

exports.enableDefaultFavicon = function () {
	// the mage logo

	var defaultFaviconBuff = new Buffer(
		'AAABAAEAEBAAAAAAAABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA' +
		'AAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AAAAAAAAAAAAJB3uFCQd7iAkHe4oJB3uayQd7uEkHe78JB3u6yQd7sQkHe6HJB3uLwAA' +
		'AAAAAAAAAAAAAAAAAAAkHe51JB3u6iQd7v8kHe7/JB3u/yQd7t4kHe6pJB3u/yQd7v8kHe7/JB3u/yQd' +
		'7v8kHe61JB3uHQAAAAAAAAAAJB3uASQd7mMkHe76JB3u/yQd7v8kHe7/JB3u/yQd7v8kHe7/JB3u7iQd' +
		'7tEkHe7/JB3u/yQd7uskHe4tAAAAAAAAAAAmNe4JJjXukSY17v8mNe7/JjXu/yY17v8mNe6zJjXurSY1' +
		'7oImNe4+JjXuyCY17oAmNe7/JjXu5yY17hUoTe8DKE3vaShN7/EoTe//KE3v/yhN7/8oTe//KE3vuAAA' +
		'AAAoTe8EKE3vBwAAAAAoTe9eKE3v/yhN7/8oTe+SAAAAAAAAAAArXfEvK13x9Ctd8f8rXfH/K13xVytd' +
		'8RUrXfFIK13x/ytd8f8rXfHGK13xAytd8S0rXfHfK13x5wAAAAAAAAAAAAAAAC1u82otbvP/LW7z/y1u' +
		'8/oAAAAALW7ziC1u8/8tbvP/LW7z/y1u8wItbvOcLW7z/y1u8/8AAAAAAAAAAAAAAAAve/UFL3v16i97' +
		'9f8ve/ViAAAAAC979Vwve/X/L3v1/y979eEAAAAAL3v1Hi979dsve/XwAAAAAAAAAAAAAAAAAAAAADOI' +
		'9XsziPX/M4j19jOI9bEAAAAAM4j1FjOI9RsziPUGM4j1UjOI9f8ziPX/M4j1pgAAAAAAAAAAAAAAAAAA' +
		'AAA4lfcIOJX3zDiV9/84lfeqOJX3fTiV92M4lfcpOJX3nziV92I4lff/OJX39jiV9ycAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAADuj+RU7o/nGO6P5/zuj+f87o/nrO6P5rjuj+f87o/n/O6P58juj+UkAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAAAAAAAAAAAAAQbD7BUGw+2hBsPvGQbD7+EGw+/9BsPvhQbD7k0Gw+x0AAAAAAAAAAP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A//8AAP//AAD8HwAAgAcAAMADAADAIQAAwPgAAOOMAADxCAAA84wAAPj4AAD46QAA/AMAAP8H' +
		'AAD//wAA//8AAA==', 'base64');

	exports.setFavicon(defaultFaviconBuff);
};


function deliverFile(filePath, res, headers, cb) {
	var stream;

	try {
		stream = fs.createReadStream(filePath);
	} catch (error) {
		if (error.code === 'ENOENT') {
			res.writeHead(404);
		} else {
			res.writeHead(500);
		}

		res.end();

		return setImmediate(function () {
			cb(error);
		});
	}

	stream.on('open', function () {
		res.writeHead(200, headers);
		stream.pipe(res);
	});

	stream.on('end', cb);

	stream.on('error', function (error) {
		if (error.code === 'ENOENT') {
			res.writeHead(404);
		} else {
			res.writeHead(500);
		}

		res.end();

		cb(error);
	});
}


function deliverFolder(template, absPath, relPath, res, cb) {
	fs.readdir(absPath, function (error, files) {
		if (error) {
			if (error.code === 'ENOENT') {
				res.writeHead(404);
			} else {
				res.writeHead(500);
			}

			res.end();
			return cb(error);
		}

		files.sort();

		var html = template({
			relPath: relPath,
			files: files
		});

		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		res.end(html);
		cb();
	});
}


exports.serveFolder = function (route, folderPath, defaultFile, onFinish) {
	assert.equal(typeof route, 'string', 'Route must be a string');
	assert.equal(typeof folderPath, 'string', 'Folder path must be a string');

	if (typeof defaultFile === 'function') {
		onFinish = defaultFile;
		defaultFile = null;
	} else if (defaultFile) {
		assert.equal(typeof defaultFile, 'string', 'Default file must be a string (eg: "index.html")');
	}

	// turn folderPath into an absolute path if it isn't already

	folderPath = pathResolve(folderPath);

	// ensure there's an onFinish callback that is called after each request

	if (!onFinish) {
		onFinish = function (error) {
			if (!error) {
				return;
			}

			logger.error
				.data('folderPath', folderPath)
				.data('error', error)
				.log('Error while serving from', route);
		};
	}

	// load the template for folder rendering

	var folderTemplate;

	if (allowFolderExposure) {
		folderTemplate = fs.readFileSync(pathJoin(__dirname, 'folderTemplate.html'), { encoding: 'utf8' });
		folderTemplate = handlebars.compile(folderTemplate);
	}


	function deliver(res, reqPath, absPath, defaultFile) {
		fs.stat(absPath, function (error, stats) {
			if (error) {
				logger.warning.data('error', error).log('Stat failed on', absPath);
				res.writeHead(404);
				res.end();
				return onFinish();
			}

			// serve the file

			if (stats.isFile()) {
				var contentType = mime.lookup(absPath);
				var headers;

				if (contentType) {
					headers = {
						'content-type': contentType
					};
				}

				return deliverFile(absPath, res, headers, onFinish);
			}

			// show the directory contents

			if (folderTemplate && stats.isDirectory()) {
				// if there is no trailing slash, the browser will assume this is a file, not a folder
				// to mitigate that, we will redirect (302, like Apache's mod_dir) to the URL with a trailing slash

				if (reqPath.substr(-1) !== '/') {
					res.writeHead(302, { location: reqPath + '/' });
					res.end();
					return;
				}

				if (!defaultFile) {
					return deliverFolder(folderTemplate, absPath, reqPath, res, onFinish);
				}

				// try to deliver the default file (eg: index.html)

				return deliver(res, reqPath, pathJoin(absPath, defaultFile), null);
			}

			// other file types (devices, etc) will not be served

			res.writeHead(404);
			res.end();
			return onFinish();
		});
	}


	// register the route

	if (route[0] !== '/') {
		route = '/' + route;
	}

	var regexp = new RegExp('^' + route + '(/|$)');

	exports.addRoute(regexp, function (req, res, reqPath) {
		// make the path relative to the base route

		if (reqPath.indexOf(route) !== 0) {
			// this should not have been served (bad route)
			var error = new Error('Router served path ' + reqPath + ' on route ' + route);
			res.writeHead(500);
			res.end();
			return onFinish(error);
		}

		var relPath = reqPath.substr(route.length);

		// normalize the path to folderPath

		var absPath = pathJoin(folderPath, relPath);

		// ensure that the resulting normalized path is still a sub-path of folderPath

		if (absPath.indexOf(folderPath + pathSeparator) === -1 && absPath !== folderPath) {
			logger.warning('Requested path', absPath, 'is no child of', folderPath);
			res.writeHead(404);
			res.end();
			return onFinish();
		}

		// stat our path to find out if it's a folder or a file

		deliver(res, reqPath, absPath, defaultFile);
	}, 'simple');
};


exports.serveFile = function (route, filePath, onFinish) {
	assert.equal(typeof route, 'string', 'Route must be a string');
	assert.equal(typeof filePath, 'string', 'File path must be a string');

	if (!onFinish) {
		onFinish = function (error) {
			if (!error) {
				return;
			}

			logger.error
				.data('filePath', filePath)
				.data('error', error)
				.log('Error while serving', route);
		};
	}

	var contentType = mime.lookup(filePath);
	var headers;

	if (contentType) {
		headers = {
			'content-type': contentType
		};
	}

	exports.addRoute(route, function (req, res) {
		deliverFile(filePath, res, headers, onFinish);
	}, 'simple');
};


exports.enableCheckTxt = function (folder) {
	var filePath = pathJoin(folder, 'check.txt');

	exports.serveFile('/check.txt', filePath, function (error) {
		if (!error) {
			return;
		}

		logger.error
			.data('filePath', filePath)
			.data('error', error)
			.log('Error while serving check.txt. ' +
				'Please address this to allow services to monitor your application status.');
	});
};

function isLongRoute(url) {
	for (var i = 0; i < longRoutes.length; i += 1) {
		if (longRoutes[i].test(url)) {
			return true;
		}
	}

	return false;
}

function isQuietRoute(url) {
	for (var i = 0; i < quietRoutes.length; i += 1) {
		if (quietRoutes[i].test(url)) {
			return true;
		}
	}

	return false;
}


function trackHttpResponse(req, res, path, isQuiet) {
	// time the execution

	var start = process.hrtime();

	res.on('finish', function () {
		var duration = process.hrtime(start);
		var durationSec = duration[0] + duration[1] / 1e9;
		var logLevel;

		if (!isQuiet) {
			if (res.statusCode < 400) {
				logLevel = 'info';
			} else if (res.statusCode < 500) {
				logLevel = 'warning';
			} else {
				logLevel = 'error';
			}

			logger[logLevel]
				.data('request', req)
				.data('response', res)
				.data('durationSec', durationSec)
				.log('Completed', req.method, req.url, 'HTTP/' + req.httpVersion, '(' + res.statusCode + ')');
		}

		if (durationSec > longThreshold && !isLongRoute(req.url)) {
			logger.warning('Slow response detected:', req.method, req.url, '(' + durationSec + ' sec)');
		}

		exports.emit('response-finish', req, path, duration);
	});
}


// HTTP request handling

function safeDecodePath(path) {
	if (!path) {
		return undefined;
	}

	try {
		// can throw: echo -e "GET /% HTTP/1.0\n\n" | nc localhost 8080
		return decodeURIComponent(path);
	} catch (error) {
		return undefined;
	}
}


function requestHandler(req, res) {
	var isQuiet = isQuietRoute(req.url);
	var isAsterisk = req.url === '*';  // a system-wide request (see 5.2.1 in http://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html)
	var urlInfo, path, route;

	// parse the URL and find a route

	if (isAsterisk) {
		path = '*';
	} else {
		urlInfo = url.parse(req.url, true, true);
		path = safeDecodePath(urlInfo.pathname);

		route = routers.http.get(path);
	}

	// if the route is supposed to proxy the request elsewhere, do it now

	if (route && route.type === 'proxy') {
		if (!isQuiet) {
			logger.debug('Proxying', req.method, req.url, 'HTTP/' + req.httpVersion);
		}

		route.handler(req, urlInfo);
		return;
	}

	// request logging

	if (!isQuiet) {
		logger.debug('Incoming', req.method, req.url, 'HTTP/' + req.httpVersion);
	}

	// support cross-origin requests

	if (enableCors) {
		enableCors(req, res);
	}

	// response logging

	trackHttpResponse(req, res, path, isQuiet);

	// immediately respond without payload to OPTIONS and "*" requests

	if (isAsterisk || (route && req.method === 'OPTIONS')) {
		res.setHeader('content-length', '0');
		res.writeHead(200);
		res.end();
		return;
	}

	// if no handler was found for this route, return: 404 Not found

	if (!route) {
		res.setHeader('content-length', '0');
		res.writeHead(404);
		res.end();
		return;
	}

	// execute the route handler

	if (!isQuiet) {
		logger.verbose('Following route', route.matcher, 'for', req.url);
	}

	route.handler(req, res, path, urlInfo);
}


/**
 * This method came from the ws-library:
 * https://github.com/einaros/ws/blob/master/lib/WebSocketServer.js#L447
 *
 * @param {net.Socket} socket
 * @param {number} code
 * @param {string} name
 */

function abortConnection(socket, code, name) {
	try {
		var response = [
			'HTTP/1.1 ' + code + ' ' + name,
			'content-type: text/html'
		];

		socket.write(response.concat('', '').join('\r\n'));
	} catch (e) {
		// ignore errors - we've aborted this connection
	} finally {
		// ensure that an early aborted connection is shut down completely
		try {
			socket.destroy();
		} catch (e) {
			// ignore errors - we've aborted this connection
		}
	}
}


function upgradeHandler(req, socket, head) {
	logger.debug('Received HTTP upgrade request:', req.url);

	// test if this is for a websocket or not

	if (req.headers.upgrade.toLowerCase() !== 'websocket') {
		logger.error.data(req).log('Upgrade request is not a websocket type:', req.headers.upgrade);

		return abortConnection(socket, 400, 'Bad Request');
	}

	if (req.method !== 'GET') {
		logger.error.data(req).log('WebSocket upgrade request is not a GET request:', req.method);

		return abortConnection(socket, 400, 'Bad Request');
	}

	var urlInfo = url.parse(req.url, true, true);

	var path = safeDecodePath(urlInfo.pathname);
	var route = routers.websocket.get(path);

	if (!route) {
		logger.warning.data(req).log('No route has been registered for this WebSocket request (404)');

		return abortConnection(socket, 404, 'Not Found');
	}

	// set some good defaults for websocket connections

	socket.setTimeout(0);
	socket.setNoDelay(true);
	socket.setKeepAlive(true, 0);

	// if the route is supposed to proxy the request elsewhere, do it now

	if (route.type === 'proxy') {
		route.handler(req, urlInfo);
		return;
	}

	// only websocket routes can pick up this request now

	if (route.type !== 'websocket') {
		logger.warning.data(req).log('The handler registered on this route is not for websockets (404)');

		return abortConnection(socket, 400, 'Bad Request');
	}

	// handle the upgrade and pass the connection to the route handler

	wsServer.handleUpgrade(req, socket, head, function (client) {
		route.handler(client, urlInfo);
	});
}


// server creation and event handling

server = http.createServer();
wsServer = new WebSocketServer({ noServer: true });

server.on('request', requestHandler);
server.on('upgrade', upgradeHandler);

server.on('listening', function () {
	isListening = true;
});

server.on('close', function () {
	isListening = false;
	logger.notice('HTTP server closed');
});

server.on('error', function () {
	// on error, sockets are automatically closed
	isListening = false;
});


// functions for listening on port or socket file

function bindToFile(filePath, cb) {
	// resolve the path and shorten it to avoid long-path bind errors
	// NOTE: only do so on non-windows systems

	if (process.platform !== 'win32') {
		filePath = pathRelative(process.cwd(), pathResolve(filePath));
	}

	function callback(error) {
		server.removeListener('error', callback);

		if (error) {
			if (error.code === 'EADDRINUSE') {
				error.message =
					filePath + ' already exists. Perhaps the server did not shut down ' +
					'cleanly. Try removing the file and starting again. (' + error.code + ')';
			} else {
				error.message = 'Error while binding to ' + filePath + ' (' + error.code + ')';
			}

			return cb(error);
		}

		logger.notice('HTTP Server bound to', filePath);

		return cb();
	}

	// listen() can throw, despite the error listener
	// this happens in cluster mode if the stdio channels have been closed by the master

	server.on('error', callback);

	try {
		server.listen(filePath, function (error) {
			if (error) {
				return callback(error);
			}

			fs.chmod(filePath, parseInt('777', 8), callback);
		});
	} catch (error) {
		// listen() can throw, despite the error listener
		// this happens in cluster mode if the stdio channels have been closed by the master

		setImmediate(function () {
			callback(error);
		});
	}
}


function bindToPort(port, host, cb) {
	function callback(error) {
		server.removeListener('error', callback);

		var boundAddress = (host || 'INADDR_ANY') + ':' + port;

		if (error) {
			if (error.code === 'EADDRINUSE') {
				error.message = 'Address ' + boundAddress + ' is already in use (' + error.code + ')';
			} else {
				error.message = 'Error while binding to ' + boundAddress + ' (' + error.code + ')';
			}

			return cb(error);
		}

		var resolved = server.address();

		logger.notice('Server running at http://' + resolved.address + ':' + resolved.port);

		return cb();
	}

	// listen() can throw, despite the error listener
	// this happens in cluster mode if the stdio channels have been closed by the master

	server.on('error', callback);

	try {
		if (host) {
			server.listen(port, host, callback);
		} else {
			server.listen(port, callback);
		}
	} catch (error) {
		// listen() can throw, despite the error listener
		// this happens in cluster mode if the stdio channels have been closed by the master

		setImmediate(function () {
			callback(error);
		});
	}
}


/**
 * Starts listening on a given address. If the server is already listening on an address, it will
 * unbind from it first. Either a port (with optional host), or a file path must be provided.
 *
 * @param {Object} binding         The address to bind to.
 * @param {number} [binding.port]  TCP port.
 * @param {string} [binding.host]  TCP host (defaults to INADDR_ANY).
 * @param {string} [binding.file]  Path to a socket file to bind on.
 * @param {Function} cb
 */

exports.listen = function (binding, cb) {
	if (isListening) {
		// close, then listen again with the new arguments

		logger.debug('HTTP server already listening, closing and rebinding with new configuration.');

		return exports.close(function () {
			exports.listen(binding, cb);
		});
	}

	// set up graceful shutdown

	httpClose({ timeout: closeTimeout }, server);

	// listen in cluster mode will not throw catchable errors (due to the asynchronous nature).
	// errors can only be intercepted when listening for the event.

	// deal with errors and success

	function callback(error) {
		if (error) {
			return cb(error);
		}

		return cb(null, server.address());
	}

	// listen

	if (binding.hasOwnProperty('port')) {
		bindToPort(binding.port, binding.host, callback);
	} else if (binding.hasOwnProperty('file')) {
		bindToFile(binding.file, callback);
	} else {
		var error = new Error('No valid binding provided (required: "port" or "file").');

		setImmediate(function () {
			callback(error);
		});
	}
};


exports.close = function (cb) {
	if (!isListening) {
		if (cb) {
			setImmediate(cb);
		}
		return;
	}

	isListening = false;

	logger.debug('Closing WebSocket connections');

	try {
		wsServer.close();
	} catch (wsError) {
		logger.warning('Error while trying to close WebSocket server:', wsError);
	}

	logger.debug('Closing HTTP server');

	// Close the server - stop accepting new requests and drain
	server.close(cb);

	// Let other parts of the system know that the HTTP server
	// is currently closing; this allows, for instance, for msgStream
	// to preemptively close current websocket or long-polling connections
	server.emit('closing');
};


server.once('listening', function () {
	// We need to also listen for process.exit in case that gets called.
	process.once('exit', function () {
		exports.close();
	});
});


exports.server = server;
exports.routers = routers;

exports.getCorsConfig = function () {
	return corsConfig;
};


exports.getBaseUrl = function () {
	return expose;
};


exports.getRouteUrl = function (route) {
	var baseUrl = exports.getBaseUrl();

	if (route[0] !== '/') {
		route = '/' + route;
	}

	return baseUrl + route;
};

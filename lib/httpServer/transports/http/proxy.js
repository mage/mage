var net = require('net');

/**
 * A function to help proxy to get the header that belongs to an HTTP request
 * Once we're on Node 0.12, we'll have access to a more raw representation of headers and trailers,
 * see: https://github.com/joyent/node/commit/e6c81bd67986e672b9b253c62ce6d4a519d3a2e1
 *
 * @param req         The HTTP client request
 * @returns {string}  The generated HTTP request header
 */

function recreateRequestHeader(req) {
	var CRLF = '\r\n';
	var header = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + CRLF;
	var headerKeys = Object.keys(req.headers);

	for (var i = 0; i < headerKeys.length; i++) {
		var key = headerKeys[i];

		header += key + ': ' + req.headers[key] + CRLF;
	}

	header += CRLF;

	return header;
}


/**
 * A proxy function to route connections from one HTTP server to another
 *
 * @param {Object} req  The HTTP client request.
 */

function proxy(req, endpoint) {
	var source = req.connection;
	var target;

	source.pause();

	target = net.connect(endpoint, function proxyHandler() {
		// the header has already been consumed, so we must recreate it and send it first

		target.write(recreateRequestHeader(req));

		target.pipe(source);
		source.pipe(target);

		source.resume();
	});

	target.setTimeout(0);
	target.setNoDelay(true);
	target.setKeepAlive(true, 0);

	return target;
}


module.exports = proxy;

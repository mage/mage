// see:
// http://www.w3.org/TR/cors/
// https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS


/**
 * Returns a function that will make any req/res pair CORS compatible
 *
 * @param {Object} config   CORS configuration
 * @returns {Function}
 */

module.exports = function (config) {
	if (!config) {
		throw new Error('No CORS configuration given');
	}

	return function (req, res) {
		if (config.credentials) {
			res.setHeader('access-control-allow-credentials', 'true');
		}

		if (req.headers.origin) {
			if (config.origin === '*') {
				if (config.credentials) {
					res.setHeader('access-control-allow-origin', req.headers.origin);
					res.setHeader('vary', 'Origin');  // this avoids preflight cache when the origin changes
				} else {
					res.setHeader('access-control-allow-origin', '*');
				}
			} else {
				res.setHeader('access-control-allow-origin', config.origin);
			}
		}

		if (req.method === 'OPTIONS') {
			// This is usually a CORS related preflight scenario, where the browser is trying to figure
			// out if the real (to follow) request will actually be allowed by our server.

			if (config.maxAge) {
				res.setHeader('access-control-max-age', config.maxAge);
			}

			res.setHeader('access-control-allow-methods', config.methods);

			if (req.headers['access-control-request-headers']) {
				res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers']);
			}
		}
	};
};
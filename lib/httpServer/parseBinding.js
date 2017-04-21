var assert = require('assert');
var url = require('url');


function stripLeadingSlash(str) {
	if (str && str[0] === '/') {
		return str.substr(1);
	}

	return str;
}


module.exports = function (binding) {
	assert(binding, 'No binding configured for HTTP Server');

	if (typeof binding === 'string') {
		var parsed = url.parse(binding);

		if (parsed.protocol === 'unix:') {
			return {
				file: stripLeadingSlash(parsed.hostname + parsed.pathname)
			};
		}

		if (parsed.protocol === 'http:' && parsed.hostname === 'unix') {
			return {
				file: stripLeadingSlash(parsed.pathname)
			};
		}

		if (parsed.protocol === 'http:' || parsed.protocol === 'tcp:') {
			return {
				host: parsed.hostname || '0.0.0.0',
				port: typeof parsed.port === 'string' ? parseInt(parsed.port, 10) : (parsed.port || 0)
			};
		}

		throw new Error('Could not parse bind URI: ' + binding);
	}

	if (typeof binding === 'object') {
		if (binding.file) {
			// drop other properties

			return {
				file: binding.file
			};
		}

		if (binding.hasOwnProperty('host') || binding.hasOwnProperty('port')) {
			return {
				host: binding.host || '0.0.0.0',
				port: typeof binding.port === 'string' ? parseInt(binding.port, 10) : (binding.port || 0)
			};
		}
	}

	throw new Error('Could not parse binding configuration: ' + binding);
};

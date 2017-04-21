var mage = require('../../../mage');
var logger = mage.logger.context('client');

var SourceMapConsumer = require('source-map').SourceMapConsumer;

/**
 * This function depends on stack traces being formatted by the stacktrace.js library
 *
 * @param {string}   appName
 * @param {Object}   clientConfig
 * @param {string[]} stack
 */

function prettifyStackTrace(appName, clientConfig, stack) {
	if (!appName || !clientConfig || !Array.isArray(stack)) {
		return;
	}

	var app = mage.core.app.get(appName);
	if (!app) {
		return;
	}

	var responses = app.getResponsesForClientConfig(app.getBestConfig(clientConfig));

	// On the client side, stacktrace.js has turned each entry into "symbol@file:line:col".
	// Now try to source-map our way through it.

	function replacer(match, file, line, col) {
		line = parseInt(line, 10);
		col = parseInt(col, 10);

		for (var i = 0; i < responses.length; i++) {
			var meta = responses[i].meta;
			var sourcemap = meta && meta.sourcemaps && meta.sourcemaps[file];

			if (!sourcemap) {
				continue;
			}

			var smc = new SourceMapConsumer(sourcemap);
			var pos = smc.originalPositionFor({ line: line, column: col });

			if (pos) {
				return pos.name + ' (' + file + ':' + pos.line + ':' + pos.column + ')';
			}
		}

		return match;
	}

	for (var i = 0; i < stack.length; i++) {
		var frame = stack[i];

		if (typeof frame === 'string') {
			// rewrite the stack frame and put it back in the stack

			stack[i] = frame.replace(/^.+?@(.+?):([0-9]+):([0-9]+)$/, replacer);
		}
	}
}


exports.acl = ['*'];

exports.execute = function (state, channel, message, data, cb) {
	var fnLog = logger[channel];
	if (!fnLog) {
		return state.error(null, 'Log channel ' + channel + ' does not exist', cb);
	}

	var version = state.session ? state.session.version : undefined;
	var actorId = state.actorId;

	data = data || {};

	// augment data with actorId and the app version that the session is tied to

	data.actorId = data.actorId || actorId;
	data.version = data.version || version;

	// if data contains an error object, make sure the stack is as readable as possible (sourcemaps)

	if (data.error && data.error.stack && data.clientInfo) {
		try {
			prettifyStackTrace(state.appName, data.clientInfo.clientConfig, data.error.stack);
		} catch (err) {
			logger.error('Error while prettifying stack trace:', err);
		}
	}

	fnLog.data(data).log(message);

	cb();
};

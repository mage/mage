'use strict';

exports.start = function (mage, options, cb) {
	// Make sure all required arguments are provided
	if (!options || !options.app) {
		throw new Error('You must provide an application name --app="{APP NAME}"');
	}

	// Make sure app name is valid and config exists
	const appName = options.app;
	const clientConfig = mage.getClientConfig(appName);
	if (!clientConfig) {
		throw new Error('App not found: "' + appName + '"');
	}

	// Print configuration
	const out = JSON.stringify(clientConfig, null, '  ');
	process.stdout.write(out + '\n');

	// Shutdown
	cb(null, { shutdown: true });
};

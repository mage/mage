'use strict';

function logAndExit(message, mage, callback) {
	mage.logger.error(message);
	callback(1, { shutdown: true });
}

exports.start = function (mage, options, callback) {
	// Make sure all required arguments are provided
	if (!options || !options.app) {
		return logAndExit('Usage: npm run config:client [app name]"', mage, callback);
	}

	// Make sure app name is valid and config exists
	const appName = options.app;

	try {
		const clientConfig = mage.getClientConfig(appName);
		if (!clientConfig) {
			return logAndExit('App not found: "' + appName + '"', mage, callback);
		}

		// Print configuration
		const out = JSON.stringify(clientConfig, null, '  ');
		process.stdout.write(out + '\n');
	} catch (error) {
		return logAndExit('Failed to retrieve app configuration: "' + error.message + '"', mage, callback);
	}

	// Shutdown
	callback(null, { shutdown: true });
};

var mage = require('../../mage');


exports.get = (appName, baseUrl) => {
	const config = mage.getClientConfig(appName, baseUrl);

	return config;
};
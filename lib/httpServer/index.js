var mage = require('../mage');
var path = require('path');
var logger = mage.core.logger.context('httpServer');

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

var httpServer = require('./transports/http');

httpServer.initialize(logger, mage.core.config.get(['server']));
httpServer.setFolderExposure(mage.isDevelopmentMode());

exports.getHttpServer = function () {
	return httpServer || null;
};


var parseBinding = require('./parseBinding.js');


httpServer.start = function (cb) {
	logger.verbose('Starting httpServer...');

	// Add some default routes

	httpServer.enableCheckTxt(mage.rootPackage.path);

	if (!httpServer.hasFavicon()) {
		httpServer.enableDefaultFavicon();
	}

	var binding = mage.core.config.get(['server', 'clientHost', 'bind']);

	try {
		binding = parseBinding(binding);
	} catch (error) {
		return setImmediate(function () {
			cb(error);
		});
	}

	httpServer.listen(binding, cb);
};

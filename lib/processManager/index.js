/**
 * This file wraps the processManager library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var cluster = require('cluster');
var path = require('path');
var mage = require('../mage');
var logger = mage.core.logger.context('processManager');

var processManager = require('./processManager');

// Set library defaults

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

// Extract relevant configuration

var config = {
	numberOfWorkers: mage.core.config.get(['server', 'cluster']) || mage.core.config.get(['server', 'workers'], false),
	shutdownGracePeriod: mage.core.config.get(['server', 'shutdownGracePeriod']),
	shutdownOnError: mage.core.config.get(['server', 'shutdownOnError'], true)
};

// Display deprecation message for server.cluster
// if server.cluster is defined and server.workers is not defined
// and only on master process to prevent duplicated logs
if (cluster.isMaster &&
	mage.core.config.get(['server', 'workers']) === undefined &&
	mage.core.config.get(['server', 'cluster']) !== undefined) {
	logger.warning('server.cluster config is deprecated. Please use workers instead');
}

// Pass the needed components into the state library for normal mage use.
processManager.initialize(mage, logger, config);
processManager.enableProcessTitle();

// Proxy the exports of state onto this library.
module.exports = processManager;

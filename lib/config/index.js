/**
 * This file wraps the config library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('config');

var config = require('./config').initialize(logger);

// Proxy the exports of state onto this library.
module.exports = config;

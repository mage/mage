/**
 * This file wraps the helper library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger  = mage.core.logger;

var helpers = require('./helpers');

// Pass the needed components into the state library for normal mage use.
helpers.initialize(logger);

// Proxy the exports of state onto this library.
module.exports = helpers;
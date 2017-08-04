/**
 * This file wraps the config library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var config = require('./config').initialize();

// Proxy the exports of state onto this library.
module.exports = config;

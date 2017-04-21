/**
 * This file wraps the state library, and feeds in the needed components. This allows the components
 * to be mocked easily for unit testing.
 */

var mage = require('../mage');
var logger = mage.core.logger.context('state');
var Archivist = require('../archivist').Archivist;

var state = require('./state');

// Pass the needed components into the state library for normal mage use.
state.initialize(mage, logger, Archivist);

// Proxy the exports of state onto this library. Note that this makes this module an event emitter!
module.exports = state;

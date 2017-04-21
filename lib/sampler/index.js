/**
 * This file wraps the sampler library, and feeds in the needed components. This allows the
 * components to be mocked easily for unit testing.
 */

var path = require('path');
var mage = require('../mage');
var logger = mage.core.logger.context('sampler');
var processManager = require('../processManager');
var state = require('../state');
var commandCenter = require('../commandCenter');
var msgServer = require('../msgServer');
var archivist = require('../archivist');
var httpServer = mage.core.httpServer;

var sampler = require('./sampler');
var mageSamplers = require('./mageSamplers');

// Set library defaults.
mage.core.config.setTopLevelDefault('sampler', path.join(__dirname, 'config.yaml'));

// Pass the needed components into the sampler library for normal mage use.
sampler.initialize(mage, logger, processManager);

// Pass the needed components into the mage samplers library for tapping into events.
mageSamplers.initialize(processManager, state, httpServer, commandCenter, archivist, msgServer);

// Proxy the exports of sampler onto this module. Note that this makes this module an event emitter!
module.exports = sampler;

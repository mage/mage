/** @module mage */

var Mage = require('./Mage');

// Make a mage instance with the loaded configuration, and assign it as the module.exports.

var mage = module.exports = new Mage(module);
mage.setupCoreLibs();

// Global default settings override.

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent

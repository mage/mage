// MAGE sets listen
require('lib/mage');
process.removeAllListeners('uncaughtException');

// Determine in which order tests will be executed
require('./config');
require('./state');
require('./savvy');
require('./archivist');
require('./commandCenter');
require('./apps');
require('./serviceDiscovery');
require('./processMessenger');
require('./msgServer');
require('./httpServer');
require('./modules');
require('./loggingService');

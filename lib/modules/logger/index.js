var mage = require('../../mage');
var loggingService = mage.core.loggingService;

var logCreator = loggingService.createLogCreator();
logCreator.addContexts(mage.rootPackage.name);

module.exports = logCreator;
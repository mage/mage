var mage = require('lib/mage');

var config = mage.core.config.get(['server', 'serviceDiscovery']) || {};
var registeredEngines = {};


exports.listPeerDependencies = function () {
	return {
		'mDNS Service Discovery': ['mdns2'],
		'Zookeeper Service Discovery': ['node-zookeeper-client']
	};
};

exports.registerEngine = function (name, mod) {
	registeredEngines[name] = mod;
};

exports.getEngine = function () {
	if (!config || !config.engine) {
		return null;
	}

	var engine = registeredEngines[config.engine];

	if (!engine) {
		engine = registeredEngines[config.engine] = require('./engines/' + config.engine);
	}

	return engine;
};

/**
 * Instantiate the service discovery engine and return a light wrapper around the service type the user wants to
 * announce/browse.
 *
 * @param {string} name The name of the service (used for filtering)
 * @param {string} type The type of service (TCP, UDP, etc...)
 * @returns {Service}
 */

exports.createService = function (name, type) {
	var engine = exports.getEngine();

	if (!engine) {
		throw new Error('No service discovery engine has been configured.');
	}

	return engine.create(name, type, config.options);
};


exports.isEnabled = function () {
	return !!exports.getEngine();
};

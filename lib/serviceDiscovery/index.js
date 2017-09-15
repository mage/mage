var mage = require('../mage');

var config = mage.core.config.get(['server', 'serviceDiscovery']) || {};
var engine;

if (config.engine) {
	engine = require('./engines/' + config.engine);
}


exports.listPeerDependencies = function () {
	return {
		'mDNS Service Discovery': ['mdns2'],
		'Zookeeper Service Discovery': ['node-zookeeper-client']
	};
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
	if (!engine) {
		throw new Error('No service discovery engine has been configured.');
	}

	return engine.create(name, type, config.options);
};


exports.isEnabled = function () {
	return !!engine;
};

exports.helpers = require('./helpers');

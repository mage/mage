'use strict';

const os = require('os');
const crypto = require('crypto');
const memoizee = require('memoizee');

const interfaces = os.networkInterfaces();
const ifaceNames = Object.keys(interfaces);

/**
 * Chech if the list is empty
 *
 * @param {*} addresses
 * @param {*} errorMessage
 */
function assertNotEmpty(addresses, errorMessage) {
	if (addresses.length === 0) {
		throw Error(errorMessage);
	}
}

/**
 * Add all valid IP to an existing list of IP
 *
 * @param {*} addresses
 * @param {*} announced
 * @param {*} useInternalAddresses
 */
function pushIps(addresses, announced, useInternalAddresses) {
	if (!useInternalAddresses) {
		addresses = addresses.filter((address) => address.internal === false);
	}

	addresses = addresses
		.filter((address) => address.family === 'IPv4')
		.map((address) => address.address);

	return announced.concat(addresses);
}

/**
 * Return all valid IP for a single interface
 *
 * @param {*} ifaceName
 */
function getAnnouncedIpsForInterface(ifaceName) {
	const addresses = interfaces[ifaceName];

	if (!addresses) {
		throw new Error('Interface ' + ifaceName + ' could not be found');
	}

	const announced = pushIps(addresses, [], true);
	assertNotEmpty(announced, 'Interface ' + ifaceName + ' does not define any IP addresses');

	return announced;
}

/**
 * Builds a list of IP. If ifaceName is not set, we return
 * all public IP of the host (essentially, excluding localhost).
 *
 * @returns {string} The ip list
 */
exports.getAnnounceIps = memoizee(function (ifaceName) {
	// If the interface is specified, we may want to specify localhost
	if (ifaceName) {
		return getAnnouncedIpsForInterface(ifaceName);
	}

	const announced = ifaceNames.reduce((announced, name) => pushIps(interfaces[name], announced, false), []);
	assertNotEmpty(announced, 'Could not find any valid IP addresses');

	// Note: the list of IP **MUST** stay in the order received by
	// `os.networkInterfaces()`; otherwise, running MAGE on a Docker Swarm
	// will break in some cases.
	//
	// This is due to the fact that interfaces have *two* IP addresses:
	//
	//   - One being the IP being used for communication on the overlay network
	//   - One being used locally for local routing on the local swarm node
	//
	// Connecting to that second interface results in MMRP and other services relying
	// on service discovery to essentially connect to themselves.
	return announced;
});

/**
 * Generate a unique ID based of a signature generated
 * from the list of IP found on this host.
 *
 * @param {*} port
 */
exports.generateId = function (port) {
	const generator = crypto.createHmac('sha256', 'secret');
	exports
		.getAnnounceIps()
		.sort()
		.forEach((ip) => generator.update(ip));

	const id = generator.digest('hex').substring(0, 16) + ':' + port;
	return id;
};

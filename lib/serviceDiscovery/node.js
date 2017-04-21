var os = require('os');
var net = require('net');
var mage = require('../mage');
var logger = mage.core.logger.context('serviceDiscovery');
var Netmask = require('netmask').Netmask;

// prebuilt list of local ips
var localIps = { IPv4: [], IPv6: [] };

var interfaces = os.networkInterfaces();
var interfacesKeys = Object.keys(interfaces);

// iterate on each interfaces
for (var i = 0; i < interfacesKeys.length; i++) {
	var iface = interfaces[interfacesKeys[i]];

	// each interface may have more than one ip
	for (var j = 0; j < iface.length; j++) {
		var ip = iface[j];

		// unsupported format
		if (!localIps[ip.family]) {
			continue;
		}

		localIps[ip.family].push(ip.address);
	}
}

/**
 * This the representation of a node on the discovery network
 *
 * @param {string}   host       The hostname for the node
 * @param {number}   port       The port on which the service is reachable
 * @param {string[]} addresses  A list of ips on which the service is reachable
 * @param {Object}   [metadata] The metadata announced by the service
 * @constructor
 */
function ServiceNode(host, port, addresses, metadata) {
	this.host = host;
	this.port = port;
	this.addresses = addresses;
	this.data = metadata || {};
}

/**
 * Return the first IP that match the requested version
 *
 * @param {number}   version   The IP version number (either 4 or 6)
 * @param {string[]} network   Return an IP only if it is in the given networks (https://www.npmjs.org/package/netmask)
 * @returns {string|null}
 * @throws {Error} Throws an error if the version number is invalid
 */
ServiceNode.prototype.getIp = function (version, network) {
	if (!this.addresses) {
		return null;
	}

	var blocks;
	if (network) {
		blocks = network.map(function (subnet) {
			return new Netmask(subnet);
		});
	}

	for (var i = 0; i < this.addresses.length; i++) {
		var address = this.addresses[i];

		// Test the format and the version of the IP address

		if (net.isIP(address) === version) {
			// If no network filter has been defined

			if (!blocks) {
				return address;
			}

			// Check if the address belongs to one of the blocks specified

			for (var j = 0; j < blocks.length; ++j) {
				if (blocks[j].contains(address)) {
					return address;
				}
			}
		}
	}

	return null;
};

/**
 * Returns whether this node is running on the local machine or not, based on the announced ips
 *
 * @returns {boolean}
 */
ServiceNode.prototype.isLocal = function () {
	var ip = this.addresses[0];

	if (!ip) {
		logger.warning.data(this).log('No IP was found/resolved for that service');
		return false;
	}

	var version = 'IPv' + net.isIP(ip);
	if (version === 'IPv0') {
		logger.warning.data(this).log('Invalid IP announced');
		return false;
	}

	// if we find it in the local ips, then we are good!
	if (localIps[version].indexOf(ip) !== -1) {
		return true;
	}

	return false;
};

exports.ServiceNode = ServiceNode;

'use strict';

const os = require('os');
const crypto = require('crypto');
const memoizee = require('memoizee');

const interfaces = os.networkInterfaces();
const ifaceNames = Object.keys(interfaces);

/**
 * Builds a list of every announce-able IP on the server
 *
 * @returns {string} The ip list
 * @todo Support from env variables?
 */
exports.getAnnounceIps = memoizee(function () {
	const announceIps = [];

	for (var i = 0; i < ifaceNames.length; i++) {
		var addresses = interfaces[ifaceNames[i]];

		for (var j = 0; j < addresses.length; j++) {
			var address = addresses[j];

			// skip anything that doesn't interest us
			if (address.internal) {
				continue;
			}

			announceIps.push(address.address);
		}
	}

	return announceIps.sort();
});

exports.generateId = function (port) {
	const generator = crypto.createHmac('sha256', 'secret');
	exports.getAnnounceIps().forEach((ip) => generator.update(ip));

	const id = generator.digest('hex').substring(0, 16) + ':' + port;
	return id;
};

// This module is a gateway between frontend's and the archivist in the
// MAGE backend.

const mage = require('lib/mage');
const ArchivistModuleError = require('./ArchivistModuleError');

exports.logger = mage.core.logger.context('archivist');
exports.getClientVault = function (state, topic, index) {
	let details = topic;

	if (index) {
		details = {
			topic: topic,
			index: index
		};
	}

	const clientVault = state.archivist.getPrivateVault('client');
	if (!clientVault) {
		throw new ArchivistModuleError('Client vault not configured', state, details);
	}

	return clientVault;
};

exports.getTopicApi = function (state, clientVault, topic, index) {
	const topicApi = state.archivist.getTopicApi(topic, clientVault.name);
	if (!topicApi) {
		throw new ArchivistModuleError('Topic does not exist or has no client configuration', state, {
			topic: topic,
			index: index
		});
	}

	return topicApi;
};

exports.getValue = async function (state, topic, index, options) {
	return new Promise((resolve, reject) => {
		state.archivist.getValue(topic, index, options, function (error, value) {
			if (error) {
				return reject(error);
			}

			resolve(value);
		});
	});
};

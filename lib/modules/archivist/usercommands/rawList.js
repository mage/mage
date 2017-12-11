const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, partialIndex, options) {
	const clientVault = archivistModule.getClientVault(state, topic, partialIndex);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, partialIndex);

	if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'list')) {
		throw new ArchivistModuleError('Actor not allowed to list data of topic', state, topic, partialIndex);
	}

	return new Promise((resolve, reject) => {
		state.archivist.list(topic, partialIndex, options, function (error, indexes) {
			if (error) {
				return reject(error);
			}

			resolve(indexes);
		});
	});
};

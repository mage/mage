const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, index, data, mediaType, encoding, expirationTime) {
	const clientVault = archivistModule.getClientVault(state, topic, index);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, index);
	const options = {
		mediaTypes: [mediaType],
		encodings: [encoding]
	};

	return archivistModule.getValue(state, topic, index, options).then((value) => {
		const allowedActors = topicApi.shard(value);

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'set', allowedActors)) {
			throw new ArchivistModuleError('Actor not allowed to set data to topic', state, topic, index);
		}

		state.archivist.set(topic, index, data, mediaType, encoding, expirationTime);
	});
};

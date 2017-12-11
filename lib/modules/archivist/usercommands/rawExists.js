const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, index) {
	const clientVault = archivistModule.getClientVault(state, topic, index);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, index);

	return archivistModule.getValue(state, topic, index, { optiona: true }).then((value) => {
		const allowedActors = topicApi.shard(value);

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'get', allowedActors)) {
			throw new ArchivistModuleError(
				'Actor not allowed to check for the existence of this topic',
				state,
				topic,
				index
			);
		}

		return value.didExist;
	});
};

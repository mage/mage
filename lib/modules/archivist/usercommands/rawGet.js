const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, index, options) {
	const clientVault = archivistModule.getClientVault(state, topic, index);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, index);

	return archivistModule.getValue(state, topic, index, options).then((value) => {
		const allowedActors = topicApi.shard(value);

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'get', allowedActors)) {
			throw new ArchivistModuleError('Actor not allowed access to this value', state, topic, index);
		}

		const key = topicApi.createKey(value.topic, value.index);
		let serialized;

		if (value.didExist !== false) {
			serialized = topicApi.serialize(value);
		}

		return {
			key: key,
			value: serialized
		};
	});
};

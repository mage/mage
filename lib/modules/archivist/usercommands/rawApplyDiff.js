const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, index, diff) {
	const clientVault = archivistModule.getClientVault(state, topic, index);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, index);

	return archivistModule.getValue(state, topic, index, { optional: false }).then((value) => {
		const allowedActors = topicApi.shard(value);

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'set', allowedActors)) {
			throw new ArchivistModuleError('Actor not allowed to set diff on this topic', state, topic, index);
		}

		value.applyDiff(diff);
	});
};

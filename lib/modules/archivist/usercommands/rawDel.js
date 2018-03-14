const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, topic, index) {
	const clientVault = archivistModule.getClientVault(state, topic, index);
	const topicApi =  archivistModule.getTopicApi(state, clientVault, topic, index);

	if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'del')) {
		throw new ArchivistModuleError('Actor not allowed to delete', state, topic, index);
	}

	state.archivist.del(topic, index);
};

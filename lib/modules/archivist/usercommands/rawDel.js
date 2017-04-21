exports.acl = ['*'];

exports.execute = function (state, topic, index, cb) {
	var clientVault = state.archivist.getPrivateVault('client');
	if (!clientVault) {
		return state.error(null, 'Client vault not configured in writeOrder.', cb);
	}

	var topicApi = state.archivist.getTopicApi(topic, clientVault.name);
	if (!topicApi) {
		return state.error(
			null, 'Unable to load topic API on client vault for topic: ' + topic, cb
		);
	}

	if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'del')) {
		return state.error(
			null,
			'Actor ' + state.actorId + ' not allowed to perform delete.',
			cb
		);
	}

	state.archivist.del(topic, index);

	cb();
};

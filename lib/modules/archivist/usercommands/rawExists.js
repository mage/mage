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

	state.archivist.getValue(topic, index, { optional: true }, function (error, value) {
		if (error) {
			return cb(error);
		}

		var allowedActors;

		try {
			allowedActors = topicApi.shard(value);
		} catch (apiError) {
			return state.error(null, apiError, cb);
		}

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'get', allowedActors)) {
			return state.error(
				null,
				'Actor ' + state.actorId + ' not allowed check existence of this topic.',
				cb
			);
		}

		state.respond(value.didExist);

		cb();
	});
};

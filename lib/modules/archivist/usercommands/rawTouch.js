exports.acl = ['*'];

exports.execute = function (state, topic, index, expirationTime, cb) {
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

	state.archivist.getValue(topic, index, {}, function (error, value) {
		if (error) {
			return cb(error);
		}

		var allowedActors;

		try {
			allowedActors = topicApi.shard(value);
		} catch (apiError) {
			return state.error(null, apiError, cb);
		}

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'touch', allowedActors)) {
			return state.error(
				null,
				'Actor ' + state.actorId + ' not allowed set data to topic "' + topic + '".',
				cb
			);
		}

		state.archivist.touch(topic, index, expirationTime);

		cb();
	});
};

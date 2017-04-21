exports.acl = ['*'];

exports.execute = function (state, topic, index, options, cb) {
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

	state.archivist.getValue(topic, index, options, function (error, value) {
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
				'Actor ' + state.actorId + ' not allowed access to this value.',
				cb
			);
		}

		var key;

		try {
			key = topicApi.createKey(value.topic, value.index);
		} catch (apiError) {
			return state.error(null, apiError, cb);
		}

		var serialized;

		if (value.didExist !== false) {
			try {
				serialized = topicApi.serialize(value);
			} catch (apiError) {
				return state.error(null, apiError, cb);
			}
		}

		state.respond({
			key: key,
			value: serialized
		});

		cb();
	});
};

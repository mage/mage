exports.acl = ['*'];

exports.execute = function (state, topic, index, diff, cb) {
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

	state.archivist.getValue(topic, index, { optional: false }, function (error, value) {
		if (error) {
			return cb(error);
		}

		var allowedActors;

		try {
			allowedActors = topicApi.shard(value);
		} catch (apiError) {
			return state.error(null, apiError, cb);
		}

		if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'set', allowedActors)) {
			return state.error(
				null,
				'Actor ' + state.actorId + ' not allowed to set diff value.',
				cb
			);
		}

		try {
			value.applyDiff(diff);
		} catch (e) {
			return state.error(null, e, cb);
		}

		cb();
	});
};

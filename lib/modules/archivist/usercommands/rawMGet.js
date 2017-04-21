exports.acl = ['*'];

exports.execute = function (state, queries, options, cb) {
	var clientVault = state.archivist.getPrivateVault('client');
	if (!clientVault) {
		return state.error(null, 'No client vault found.', cb);
	}

	// We don't care about how the queries are indexed (array, or object), so we unify them first
	// into an array. That way we can process the result as an array too.

	var realQueries = queries;

	if (!Array.isArray(queries)) {
		realQueries = [];

		for (var queryId in queries) {
			realQueries.push(queries[queryId]);
		}
	}

	state.archivist.mgetValues(realQueries, options, function (error, values) {
		if (error) {
			return cb(error);
		}

		var response = [];

		for (var i = 0; i < values.length; i++) {
			var value = values[i];

			var allowedActors, key, serialized;

			var topicApi = state.archivist.getTopicApi(value.topic, clientVault.name);
			if (!topicApi) {
				return state.error(
					null, 'Unable to load topic API on client vault for topic: ' + value.topic, cb
				);
			}

			try {
				allowedActors = topicApi.shard(value);
			} catch (apiError) {
				return state.error(null, apiError, cb);
			}

			if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'get', allowedActors)) {
				return state.error(
					null,
					'Actor ' + state.actorId + ' not allowed access to this value. ',
					cb);
			}

			try {
				key = topicApi.createKey(value.topic, value.index);
			} catch (apiError) {
				return state.error(null, apiError, cb);
			}

			if (value.didExist === false) {
				serialized = undefined;
			} else {
				try {
					serialized = topicApi.serialize(value);
				} catch (apiError) {
					return state.error(null, apiError, cb);
				}
			}

			response.push({
				key: key,
				value: serialized
			});
		}

		state.respond(response);

		cb();
	});
};

const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');

exports.acl = ['*'];

exports.execute = async function (state, queries, options) {
	const clientVault = archivistModule.getClientVault(state);

	// We don't care about how the queries are indexed (array, or object), so we unify them first
	// into an array. That way we can process the result as an array too.

	const realQueries = queries;

	if (!Array.isArray(queries)) {
		realQueries = [];

		for (const queryId in queries) {
			realQueries.push(queries[queryId]);
		}
	}

	return new Promise((resolve, reject) => {
		state.archivist.mgetValues(realQueries, options, function (error, values) {
			if (error) {
				return reject(error);
			}

			resolve(values);
		});
	}).then((values) => {
		const response = [];

		for (let i = 0; i < values.length; i++) {
			const value = values[i];
			const topicApi =  archivistModule.getTopicApi(state, clientVault, value.topic, value.index);
			const allowedActors = topicApi.shard(value);

			if (!clientVault.operationAllowedForSession(state, topicApi.acl, 'get', allowedActors)) {
				throw new ArchivistModuleError(
					'Actor not allowed access to this value',
					state,
					value.topic,
					value.index
				);
			}

			const key = topicApi.createKey(value.topic, value.index);
			let serialized;

			if (value.didExist !== false) {
				serialized = topicApi.serialize(value);
			}

			response.push({
				key: key,
				value: serialized
			});
		}

		return response;
	});
};

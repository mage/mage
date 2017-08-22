/**
 * This is your Archivist topic/index configuration.
 * For more information, please read the Archivist documentation.
 */

exports.ucResponseMeta = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {}
	}
};

exports.ucResponseData = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {}
	}
};

exports.session = {
	index: ['actorId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.actorId;
			},
			acl: function (test) {
				test(['user', 'test'], 'get', { shard: true });
				test(['cms', 'admin'], '*');
			}
		},
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {}
	}
};

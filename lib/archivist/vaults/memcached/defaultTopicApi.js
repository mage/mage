exports.serialize = function (value) {
	// throws exceptions on failure

	return value.setEncoding(['live']).data;
};


exports.deserialize = function (data, value) {
	// let mediaType be detected by the VaultValue

	value.setDataFromVault(null, data, 'live');
};


exports.createKey = function (topic, index) {
	// eg: weapons/actorId:123/bag:main
	// eg: weapons/guildId:123

	var key = topic;
	var props, i;

	if (index) {
		props = Object.keys(index);
		props.sort();

		for (i = 0; i < props.length; i++) {
			key += '/' + props[i] + ':' + index[props[i]];
		}
	}

	return key;
};

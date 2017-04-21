exports.serialize = function (value) {
	// { col: val, col: val, col: val }
	// throws exceptions on failure

	return {
		value: value.setEncoding(['utf8', 'buffer']).data,
		mediaType: value.mediaType
	};
};


exports.deserialize = function (row, value) {
	value.setDataFromVault(row.mediaType, row.value);  // let encoding be detected by the VaultValue
};


exports.createKey = function (topic, index) {
	return {
		table: topic,
		pk: index
	};
};


exports.parseKey = function (key) {
	return {
		topic: key.table,
		index: key.pk
	};
};

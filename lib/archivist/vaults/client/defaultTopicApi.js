exports.serialize = function (value) {
	value.setEncoding(['utf8', 'base64']);

	return {
		mediaType: value.mediaType,
		data: value.data,
		encoding: value.encoding
	};
};


exports.createKey = function (topic, index) {
	return { topic: topic, index: index };
};

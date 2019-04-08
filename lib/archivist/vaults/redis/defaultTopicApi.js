exports.serialize = function (value) {
	// throws exceptions on failure

	// the header is:
	// - 2 bytes to indicate JSON-length in bytes (65535 max header length)
	// - JSON containing: { mediaType: "a/b" }
	// - a single byte "\n" delimiter

	// serialize the value to a buffer

	var data = value.setEncoding(['buffer']).data;

	// create the meta data

	var meta = JSON.stringify({
		mediaType: value.mediaType
	});

	// create a buffer that will fit both the header and the value

	var jsonSize = Buffer.byteLength(meta);
	var headerSize = 2 + jsonSize + 1;

	var output = new Buffer(headerSize + data.length);

	// write the meta JSON length

	output.writeUInt16BE(jsonSize, 0);

	// write the meta JSON and trailing \n

	output.write(meta + '\n', 2, jsonSize + 1, 'utf8');

	// append the value

	data.copy(output, headerSize);

	return output;
};


exports.deserialize = function (data, value) {
	var jsonSize = data.readUInt16BE(0);
	var meta = JSON.parse(data.toString('utf8', 2, 2 + jsonSize));

	data = data.slice(2 + jsonSize + 1);

	value.setDataFromVault(meta.mediaType, data, 'buffer');
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

exports.parseKey = function (key) {
	var index = {};
	var topic;

	if (key) {
		key.split('/').forEach((token) => {
			if (topic) {
				token = token.split(':');
				index[token[0]] = token[1];
			} else {
				topic = token;
			}
		});
	}
	return { topic, index };
};

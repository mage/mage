var qs = require('querystring');
var pathBaseName = require('path').basename;
var mediaTypes = require('../../mediaTypes');


function safeExt(ext) {
	return ext[0] === '.' ? ext : '.' + ext;
}


exports.serialize = function (value) {
	// throws exceptions on failure

	value.setEncoding('buffer');

	var mediaTypeApi = mediaTypes.getMediaType(value.mediaType);
	if (!mediaTypeApi) {
		throw new Error('Unsupported media type: ' + value.mediaType);
	}

	return {
		meta: {
			mediaType: value.mediaType,
			expirationTime: value.expirationTime || undefined,
			ext: safeExt(mediaTypeApi.fileExt) || '.bin'
		},
		content: value.data
	};
};


exports.deserialize = function (data, value) {
	var meta = data.meta;
	var content = data.content;

	// data is: { meta: {}, content: buffer }

	if (!Buffer.isBuffer(content)) {
		throw new Error('FileVault can only read binary');
	}

	// report the value object

	value.setDataFromVault(meta.mediaType, content, 'buffer');
	value.setExpirationTime(meta.expirationTime);
};


function encode(str) {
	// this escapes all potentially harmful characters: ['*', ':', '\\', '/', '<', '>', '|', '"', '?']
	return encodeURIComponent(str).replace(/\*/g, '%2A');
}

function decode(str) {
	return decodeURIComponent(str);
}


exports.createKey = function (topic, index) {
	// URL encoded with the arguments sorted alphabetically
	// eg: weapons#actorId=123&bag=main

	var key = encode(topic);

	if (index) {
		var props = Object.keys(index);
		var len = props.length;

		if (len > 0) {
			props.sort();

			key += '#';

			var sep = '';

			for (var i = 0; i < len; i += 1) {
				key = key.concat(sep, encode(props[i]), '=', encode(index[props[i]]));
				sep = '&';
			}
		}
	}

	return key;
};


exports.parseKey = function (path) {
	var key = pathBaseName(path);

	var hashPos = key.indexOf('#');

	if (hashPos === -1) {
		return {
			topic: decode(key),
			index: {}
		};
	}

	return {
		topic: decode(key.substr(0, hashPos)),
		index: qs.parse(key.substr(hashPos + 1))
	};
};

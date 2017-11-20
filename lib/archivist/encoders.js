'use strict';

// encoding types:
//   live (native JS objects, does not include Buffer instances)
//   utf8 (string)
//   buffer (Buffer object)
//   base64 (base64 encoded binary data)

// All encodings can convert to each other out of the box, except: live!
// "live" is the special case that each media type implements an encoder to.


// encoders

var commonEncoders = {};
var mediaTypeEncoders = {};

class ArchivistEncodingError extends Error {
	constructor(message, from, to, data) {
		super(message);
		this.name = 'ArchivistEncodingError';
		this.from = from;
		this.to = to;
		this.data = data;
	}
}

exports.registerCommonEncoder = function (fromEncoding, toEncoding, fn) {
	if (!fn) {
		throw new Error('No encoder implementation provided for ' + fromEncoding + '-' + toEncoding);
	}

	var name = fromEncoding + '-' + toEncoding;

	commonEncoders[name] = fn;
};


exports.registerMediaTypeEncoder = function (mediaType, fromEncoding, toEncoding, fn) {
	if (!mediaTypeEncoders[mediaType]) {
		mediaTypeEncoders[mediaType] = {};
	}

	mediaTypeEncoders[mediaType][fromEncoding + '-' + toEncoding] = fn;
};


exports.guessEncoding = function (data) {
	if (Buffer.isBuffer(data)) {
		return 'buffer';
	}

	if (typeof data === 'string') {
		return 'utf8';
	}

	return 'live';
};


function getCommonEncoder(fromEncoding, toEncoding) {
	// edge case: from === to

	if (fromEncoding === toEncoding) {
		return function (data) {
			return data;
		};
	}

	// check the simple case, where both "from" and "to" are available as common encodings

	return commonEncoders[fromEncoding + '-' + toEncoding];
}


function getEncoder(mediaType, fromEncoding, toEncoding) {
	// check for a common built-in encoder

	var encoder = getCommonEncoder(fromEncoding, toEncoding);
	if (encoder) {
		return encoder;
	}

	if (!mediaType) {
		return;
	}

	var encoders = mediaTypeEncoders[mediaType];
	if (!encoders) {
		return;
	}

	// check for a direct converter for this mediaType

	encoder = encoders[fromEncoding + '-' + toEncoding];
	if (encoder) {
		return encoder;
	}

	// check if we can construct a converter

	var key, encoderName;
	var encoderA, encoderB;
	var keys = Object.keys(encoders);

	for (var i = 0; i < keys.length; i++) {
		encoderName = keys[i];

		encoder = encoders[encoderName];
		key = encoderName.split('-');
		encoderA = encoderB = null;

		if (key[0] === fromEncoding) {
			// key[0] -> key[1] -> toEncoding

			encoderA = encoder;
			encoderB = getCommonEncoder(key[1], toEncoding);
			break;
		}

		if (key[1] === toEncoding) {
			// fromEncoding -> key[0] -> key[1]

			encoderA = getCommonEncoder(fromEncoding, key[0]);
			encoderB = encoder;
			break;
		}
	}

	if (!encoderA || !encoderB) {
		return;
	}

	// return an encoder based on A and B

	return function (data, options) {
		return encoderB(encoderA(data, options), options);
	};
}

function assertString(fromEncoding, toEncoding, data) {
	if (typeof data !== 'string') {
		throw new ArchivistEncodingError('Invalid data type', fromEncoding, toEncoding, data);
	}
}

function assertBuffer(fromEncoding, toEncoding, data) {
	if (Buffer.isBuffer(data) === false) {
		throw new ArchivistEncodingError('Invalid data type', fromEncoding, toEncoding, data);
	}
};

// add built-in conversions

var register = exports.registerCommonEncoder;

register('utf8', 'buffer', function (data) {
	assertString('utf8', 'buffer', data);
	return new Buffer(data);
});

register('base64', 'buffer', function (data) {
	assertString('base64', 'buffer', data);
	return new Buffer(data, 'base64');
});

register('buffer', 'base64', function (data) {
	assertBuffer('buffer', 'base64', data);
	return data.toString('base64');
});

register('buffer', 'utf8', function (data) {
	assertBuffer('buffer', 'utf8', data);
	return data.toString('utf8');
});

register('utf8', 'base64', function (data) {
	assertString('utf8', 'base64', data);
	return (new Buffer(data, 'utf8')).toString('base64');
});

register('base64', 'utf8', function (data) {
	assertString('base64', 'utf8', data);
	return (new Buffer(data, 'base64')).toString('utf8');
});


exports.getEncoder = getEncoder;

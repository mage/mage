var encoders = require('./encoders');
var mediaTypes = require('./mediaTypes');
var logger;

exports.setup = function (loggerInstance) {
	logger = loggerInstance;
};


function parseTopic(topic) {
	if (topic) {
		topic = topic.valueOf();
	}

	if (typeof topic !== 'string') {
		throw new TypeError('Topic is not a string. Found: ' + topic);
	}

	if (topic.length === 0) {
		throw new Error('No topic given');
	}

	return topic;
}


function parseIndex(index) {
	if (!index) {
		return {};
	}

	if (typeof index !== 'object') {
		throw new TypeError('Index is not an object. Found: ' + index);
	}

	var result = {};
	var keys = Object.keys(index);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var value = index[key];

		if (value) {
			value = value.valueOf();
		}

		var type = typeof value;

		if (type !== 'string' && type !== 'number') {
			throw new TypeError(
				'Index value for "' + key + '" is not a string or number. Found: ' + value
			);
		}

		result[key] = value;
	}

	return result;
}


exports.parseTopic = parseTopic;
exports.parseIndex = parseIndex;


// data: data in a specific encoding
// value: a container for data, that is encoding and mediaType aware
//        and has API for controlling its lifecycle

// topic: a category of data
// index: a pointer to a specific piece of data for a given topic (alt: "index")


function VaultValue(topic, index, mediaType) {
	// mediaType is optional, and may be set on setData

	this.operation = null; // null (no change), 'add', 'set', 'touch', 'delete'
	this.readMisses = [];

	this.topic = parseTopic(topic);
	this.index = parseIndex(index);
	this.expirationTime = undefined;
	this.mediaType = mediaType || undefined;
	this.didExist = undefined;
	this.willExist = undefined;

	this.data = undefined;
	this.encoding = undefined;

	// cache for all differently encoded versions of this.mediaType (holds only data)
	this.encodings = {};

	// data/encoding match the latest selected encoding
	// all encoded versions however can be found in this.encodings[]

	this.liveVersionUninit = undefined;
	this.liveDiff = undefined;
}

exports.VaultValue = VaultValue;


VaultValue.prototype.resetOperation = function () {
	this.liveDiff = undefined;
	this.operation = null;
	this.readMisses = [];
};


VaultValue.prototype.hasOperation = function () {
	return !!this.operation || this.readMisses.length > 0;
};


VaultValue.prototype.getOperationForVault = function (vault) {
	// if this value should still exist, and if there was a read-miss on this vault,
	// we should recreate the full value on this vault

	if (this.didExist && this.readMisses.indexOf(vault) !== -1) {
		return 'add';
	}

	// else we simply execute the scheduled operation

	return this.operation;
};


VaultValue.prototype.registerReadMiss = function (vault) {
	this.readMisses.push(vault);
};


VaultValue.prototype.didNotExist = function () {
	this.didExist = false;
};


VaultValue.prototype.add = function (mediaType, data, encoding) {
	if (this.operation && this.operation !== 'del') {
		throw new Error('Trying to add an already existing value.');
	}

	this.setData(mediaType, data, encoding);
	this.operation = 'add';
	this.readMisses = [];
};


VaultValue.prototype.set = function (mediaType, data, encoding) {
	this.setData(mediaType || this.mediaType, data, encoding);
	this.operation = 'set';
	this.readMisses = [];
};


VaultValue.prototype.touch = function (expirationTime) {
	if (this.operation !== 'del') {
		this.setExpirationTime(expirationTime);

		if (!this.operation) {
			this.operation = 'touch';
		}
	}
};


VaultValue.prototype.del = function () {
	this.data = undefined;
	this.encoding = undefined;
	this.encodings = {};
	this.mediaType = undefined;
	this.expirationTime = undefined;
	this.willExist = false;
	this.readMisses = [];

	this.operation = 'del';
};


VaultValue.prototype.getDiff = function () {
	if (!this.didExist || this.isNewValue) {
		return;
	}

	if (this.liveDiff === undefined && this.encodings.live) {
		var api = mediaTypes.getMediaType(this.mediaType);

		if (api && api.diff && api.diff.get) {
			this.liveDiff = api.diff.get(this.encodings.live);
		}
	}

	return this.liveDiff;
};


VaultValue.prototype.applyDiff = function (diff) {
	var api = mediaTypes.getMediaType(this.mediaType);

	if (!api) {
		throw new Error('Cannot apply diffs to VaultValues of bad mediaType: ' + this.mediaType);
	}

	if (!api.diff || !api.diff.set) {
		throw new Error('MediaType ' + this.mediaType + ' does not support diffs.');
	}

	this.setEncoding(['live']);

	api.diff.set(this.encodings.live, diff);
};


VaultValue.prototype.setExpirationTime = function (expirationTime) {
	this.expirationTime = expirationTime || undefined;
};


function detectEncoding(data, encoding) {
	encoding = encoding || encoders.guessEncoding(data);

	if (encoding && typeof encoding !== 'string') {
		throw new Error('Encoding ' + JSON.stringify(encoding) + ' is not a string.');
	}

	return encoding;
}

function detectMediaType(data, mediaType, encoding) {
	if (!mediaType && encoding === 'live') {
		mediaType = mediaTypes.guessMediaType(data);
	}

	if (mediaType && typeof mediaType !== 'string') {
		throw new Error('MediaType ' + JSON.stringify(mediaType) + ' is not a string.');
	}

	return mediaType;
}


VaultValue.prototype.setDataFromVault = function (mediaType, data, encoding) {
	this.setData(mediaType, data, encoding);
	this.didExist = true;
};

/**
 * Fully resets the data of this vault value to the given data with the given mediaType and encoding
 *
 * @param {string} [mediaType]
 * @param {*} data
 * @param {string} [encoding]
 */

VaultValue.prototype.setData = function (mediaType, data, encoding) {
	// data can be anything, but undefined

	if (data === undefined) {
		throw new Error('Trying to write undefined data');
	}

	// if no encoding is given, we try to detect it

	encoding = detectEncoding(data, encoding);

	if (!encoding) {
		throw new Error('Cannot set data for topic "' + this.topic + '" when encoding is unknown');
	}

	// get the best mediaType possible

	mediaType = detectMediaType(data, mediaType, encoding);

	if (!mediaType) {
		throw new Error(
			'Cannot set data for topic "' + this.topic + '" when mediaType is unknown (encoding ' +
			'is "' + encoding + '", but media type can only be detected when encoding is "live".'
		);
	}

	logger.verbose(
		'Set data for topic', this.topic, 'with mediaType', mediaType, 'and encoding', encoding
	);

	// Some media types are smart enough to trigger operations when their internals change. For that
	// purpose, we allow the mediaType API to initialize live data.
	// - If there was live data that is now being overwritten, we should uninitialize it.
	// - If the new data is live, we should initialize it.
	// - The exception: if we're currently setting a live version that is the same object.
	//   In that case, we do nothing and keep it initialized.

	// If live data being written was already initialized, don't allow uninit/init

	var forbidReinit = (encoding === 'live' && this.encodings.live && data === this.encodings.live);

	// Uninitialize the previous live data

	if (!forbidReinit && this.liveVersionUninit) {
		this.liveVersionUninit();
		this.liveVersionUninit = undefined;
	}

	// Initialize the new value

	this.mediaType = mediaType;
	this.encodings = {};

	if (this.willExist === false) {
		this.isNewValue = true;
	}

	this.willExist = true;


	this.setDataEncoded(data, encoding, forbidReinit);
};


VaultValue.prototype.setDataEncoded = function (data, encoding, forbidReinit) {
	this.data = data;
	this.encoding = encoding;
	this.encodings[encoding] = data;

	// If data is a new value that we were not aware of before, and the encoding is 'live', we
	// should allow the media type API to initialize it.

	if (!forbidReinit && encoding === 'live') {
		var api = mediaTypes.getMediaType(this.mediaType);

		if (api && api.init) {
			this.liveVersionUninit = api.init(data, this);
		}
	}
};


VaultValue.prototype.getEncoder = function (fromEncoding, toEncoding) {
	return encoders.getEncoder(this.mediaType, fromEncoding, toEncoding);
};


VaultValue.prototype.setEncoding = function (toEncodings) {
	if (!Array.isArray(toEncodings)) {
		toEncodings = [toEncodings];
	}

	var i, len = toEncodings.length, a, alen, available, fromEncoding, toEncoding, encoder;

	// strategy:
	// we try to convert to a useful encoding, and return "this".

	// if we already have any of the requested encodings, we set that encoding to the active one.

	for (i = 0; i < len; i++) {
		toEncoding = toEncodings[i];

		// if we have converted to this encoding before, return that version

		if (this.encodings[toEncoding]) {
			this.data = this.encodings[toEncoding];
			this.encoding = toEncoding;
			return this;
		}
	}

	// if we don't, we try to convert in order of requested encodings

	available = Object.keys(this.encodings);
	alen = available.length;

	for (i = 0; i < len && !encoder; i++) {
		toEncoding = toEncodings[i];

		for (a = 0; a < alen && !encoder; a++) {
			fromEncoding = available[a];

			encoder = this.getEncoder(fromEncoding, toEncoding);
		}
	}

	if (!encoder) {
		throw new Error(
			'No encoder found from ' + available.join(', ') + ' ' +
			'to any of: ' + toEncodings.join(', ')
		);
	}

	var data = encoder(this.encodings[fromEncoding]);

	this.setDataEncoded(data, toEncoding);

	return this;
};


VaultValue.prototype.setMediaType = function (toMediaTypes) {
	if (!Array.isArray(toMediaTypes)) {
		toMediaTypes = [toMediaTypes];
	}

	if (toMediaTypes.indexOf(this.mediaType) !== -1) {
		// nothing to do here, we're already an accepted mediaType
		return;
	}

	var currentMediaTypeApi = mediaTypes.getMediaType(this.mediaType);
	if (!currentMediaTypeApi) {
		throw new Error('No API found for mediaType: ' + this.mediaType);
	}

	if (!currentMediaTypeApi.converters) {
		throw new Error(
			'Cannot convert from ' + this.mediaType + ' values to any other mediaType, ' +
			'including: ' + toMediaTypes.join(', ')
		);
	}

	for (var i = 0; i < toMediaTypes.length; i++) {
		var mediaType = toMediaTypes[i];

		// find a converter implementation from the original mediaType to the requested mediaType

		var converter = currentMediaTypeApi.converters[mediaType];
		if (converter) {
			// convert using the found converter and overwrite our current data

			converter(this, this);
			return;
		}
	}

	throw new Error(
		'Unable to convert from mediaType ' + this.mediaType + ' ' +
		'to any of: ' + toMediaTypes.join(', ')
	);
};


VaultValue.prototype.getFileExt = function () {
	var currentMediaTypeApi = mediaTypes.getMediaType(this.mediaType);
	if (currentMediaTypeApi) {
		return currentMediaTypeApi.fileExt;
	}
};

var mediaTypes = require('../../mediaTypes');


// node-memcached implements string: 0, json: 2, binary: 4, numeric: 8

var nodeMcFlagMap = {
	'text/plain': 0,
	'application/json': 2,
	'application/x-tome': 2,
	'application/octet-stream': 4
};

var nodeMcFlagReverseMap = {
	0: 'text/plain',
	2: 'application/json',
	4: 'application/octet-stream'
};


/**
 * Turns uint32 into a max 4 char string.
 * The node.js Buffer class provides a good uint32 conversion algorithm that we want to use.
 *
 * @param {number} flags
 * @returns {string}
 */

function flagsToStr(flags) {
	if (!flags) {
		return;
	}

	var buff = new Buffer(4);
	buff.writeUInt32BE(flags, 0);

	// return a 0-byte terminated or 4-byte string

	switch (0) {
	case buff[0]:
		return;
	case buff[1]:
		return buff.toString('utf8', 0, 1);
	case buff[2]:
		return buff.toString('utf8', 0, 2);
	case buff[3]:
		return buff.toString('utf8', 0, 3);
	default:
		return buff.toString();
	}
}


/**
 * Turns a max 4 char string into a uint32.
 * The node.js Buffer class provides a good uint32 conversion algorithm that we want to use.
 *
 * @param {string} str
 * @returns {number}
 */

function strToFlags(str) {
	if (!str) {
		return;
	}

	var buff = new Buffer([0, 0, 0, 0]);
	buff.write(str, 0, 4, 'ascii');
	return buff.readUInt32BE(0);
}


/**
 * Turns a mediaType into a flags uint32
 *
 * @param {string} mediaType   The mediaType to create flags for.
 * @param {string} [flagStyle] The flag style to use. Use "node-memcached" for legacy compatibility.
 * @returns {*}
 */

exports.createFlags = function (mediaType, flagStyle) {
	// node-memcached compatibility

	if (flagStyle === 'node-memcached' && nodeMcFlagMap.hasOwnProperty(mediaType)) {
		return nodeMcFlagMap[mediaType];
	}

	// file ext approach

	var mediaTypeApi = mediaTypes.getMediaType(mediaType);
	if (mediaTypeApi) {
		return strToFlags(mediaTypeApi.fileExt);
	}

	// fallback to buffer (node-memcached style)

	return nodeMcFlagMap['application/octet-stream'];
};


/**
 * Turns uint32 flags into a mediaType
 *
 * @param {number} flags
 * @returns {string|undefined} The mediaType or undefined if undetectable
 */

exports.parseFlags = function (flags) {
	if (typeof flags !== 'number') {
		return;
	}

	// if the number is 0, 2 or 4, it's likely to have been created by node-memcached (or by
	// us using the node-memcached flagging style)
	// alternatively we assume flags represents a file extension

	if (nodeMcFlagReverseMap[flags]) {
		return nodeMcFlagReverseMap[flags];
	}

	var mediaTypeApi = mediaTypes.getByFileExt(flagsToStr(flags));
	if (mediaTypeApi) {
		return mediaTypeApi.mediaType;
	}
};


/**
 * Serializer for VaultValues for CouchbaseVault instances
 *
 * @param   {VaultValue} value       The VaultValue to serialize
 * @returns {Object}                 An object containing the serialized data and the flags to store with it
 */

exports.serialize = function (value) {
	if (Buffer.isBuffer(value.data)) {
		return value.data;
	}

	// throws exceptions on failure

	return value.setEncoding(['utf8']).data;
};


/**
 * Deserializer for populating VaultValues from a CouchbaseVault
 *
 * @param {*}          data        The serialized data
 * @param {string}     [mediaType] The mediaType as detected through the flags
 * @param {VaultValue} value       The VaultValue to populate
 */

exports.deserialize = function (data, mediaType, value) {
	// encoding should always be utf8, but we do a buffer check just in case

	var encoding = Buffer.isBuffer(data) ? 'buffer' : 'utf8';

	value.setDataFromVault(mediaType, data, encoding);
};


/**
 * Creates a key from a topic and an index
 *
 * @param {string} topic The topic to target
 * @param {Object} index The index to target
 * @returns {string}     The generated key
 */

exports.createKey = function (topic, index) {
	// eg: weapons/actorId:123/bag:main
	// eg: weapons/guildId:123

	var key = topic + '', props, i;

	if (index) {
		props = Object.keys(index);
		props.sort();

		for (i = 0; i < props.length; i++) {
			key += '/' + props[i] + ':' + index[props[i]];
		}
	}

	return key;
};


/**
 * Override this to have a custom shard behavior (takes a VaultValue as first argument)
 *
 * @returns {undefined}
 */

exports.shard = function (/* value */) {
	return undefined;
};

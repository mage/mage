// media types:
//   text/plain
//   application/json
//   application/x-tome
//   application/octet-stream


// Each media type that can exist as a special live instance has to implement at
// least one "anything-live" and one "live-anything" encoder implementation.
// It should only implement those that it can do incredibly efficiently in a single direction.
// Built-in encoding conversion should be relied upon to do the best job outside of the
// scope of the media type.
// Other media types, that have no live representation (but instead exist only in
// string/buffer form) don't need these (or any) encoders.

var encoders = require('../encoders');
var mediaTypes = {};
var detectorList = [];
var fileExtensions = {};


exports.register = function (api) {
	mediaTypes[api.mediaType] = api;

	if (api.detector) {
		detectorList.push(api);
	}

	if (api.fileExt) {
		fileExtensions[api.fileExt] = api;
	}

	// register the encoders for this API

	if (api.encoders) {
		for (var fromTo in api.encoders) {
			if (api.encoders.hasOwnProperty(fromTo)) {
				var parsed = fromTo.split('-');

				encoders.registerMediaTypeEncoder(api.mediaType, parsed[0], parsed[1], api.encoders[fromTo]);
			}
		}
	}
};


exports.getMediaType = function (mediaType) {
	return mediaTypes[mediaType];
};


exports.getByFileExt = function (fileExt) {
	return fileExtensions[fileExt];
};


exports.guessMediaType = function (data) {
	var lastCertainty = 0;
	var result;

	for (var i = 0, len = detectorList.length; i < len; i++) {
		var api = detectorList[i];

		var certainty = api.detector(data);

		if (certainty >= 1) {
			// 100% certain, instantly return
			return api.mediaType;
		}

		if (certainty > lastCertainty) {
			lastCertainty = certainty;
			result = api.mediaType;
		}
	}

	return result;
};


function registerBuiltInMediaTypes() {
	var pathJoin = require('path').join;
	var readdirSync = require('fs').readdirSync;

	var files = readdirSync(pathJoin(__dirname, './definitions'));

	for (var i = 0; i < files.length; i++) {
		exports.register(require('./definitions/' + files[i]));
	}
}

// add all built-in mediaTypes

registerBuiltInMediaTypes();

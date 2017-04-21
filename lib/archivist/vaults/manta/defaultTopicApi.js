var path = require('path');
var qs = require('querystring');

var emptyIndexBaseName = 'void';
var fileExt = '.bin';


exports.serialize = function (value) {
	// throws exceptions on failure

	return {
		data: value.setEncoding(['buffer']).data,
		mediaType: value.mediaType
	};
};


exports.deserialize = function (obj, value) {
	value.setDataFromVault(obj.mediaType || null, obj.data, 'buffer');
};


function encode(str) {
	// this escapes all potentially harmful characters: ['*', ':', '\\', '/', '<', '>', '|', '"', '?']
	return encodeURIComponent(str).replace(/\*/g, '%2A');
}


exports.createFolder = function (topic) {
	return encode(topic);
};


exports.createFileName = function (index) {
	// URL encoded with the arguments sorted alphabetically
	// eg: actorId=123&bag=main

	var props = Object.keys(index || {});
	var len = props.length;

	if (len === 0) {
		return emptyIndexBaseName + fileExt;
	}

	props.sort();

	var fileName = '';
	var sep = '';

	for (var i = 0; i < len; i += 1) {
		fileName = fileName.concat(sep, encode(props[i]), '=', encode(index[props[i]]));
		sep = '&';
	}

	return fileName + fileExt;
};


exports.parseFileName = function (str) {
	var basename = path.basename(str, fileExt);
	if (basename === str) {
		// file ext didn't match apparently
		return;
	}

	if (basename === emptyIndexBaseName) {
		return {};
	}

	return qs.parse(basename);
};

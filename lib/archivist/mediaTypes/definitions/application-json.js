exports.mediaType = 'application/json';
exports.fileExt = 'json';


exports.encoders = {
	'utf8-live': JSON.parse,
	'live-utf8': function (data) {
		return JSON.stringify(data, null, '\t');
	}
};


exports.detector = function (data) {
	if (Buffer.isBuffer(data)) {
		return 0;
	}

	var type = Object.prototype.toString.call(data);

	switch (type) {
	case '[object Object]':
	case '[object Array]':
	case '[object Number]':
	case '[object Boolean]':
	case '[object Null]':
		return 0.5;
	case '[object String]':
		return 0.1;
	default:
		return 0;
	}
};


var Tome = require('tomes').Tome;

exports.converters = {
	'application/x-tome': function (fromValue, toValue) {
		// only live data is different between tome/json
		// as long as the JSON is serialized, they are equal and need no new serialization

		// TODO: this would be easier if we would move this logic to application/x-tome and call it
		// "convertFrom" for application/json

		if (fromValue.encoding === 'live') {
			toValue.setData('application/x-tome', Tome.conjure(fromValue.data), 'live');
		} else {
			toValue.setData('application/x-tome', fromValue.data, fromValue.encoding);
		}
	}
};

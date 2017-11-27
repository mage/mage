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

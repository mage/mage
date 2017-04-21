exports.mediaType = 'text/plain';
exports.fileExt = 'txt';


exports.encoders = {
	'utf8-live': function (data) {
		return data;
	},
	'live-utf8': function (data) {
		return data;
	}
};


exports.detector = function (data) {
	return (typeof data === 'string') ? 0.3 : 0;
};

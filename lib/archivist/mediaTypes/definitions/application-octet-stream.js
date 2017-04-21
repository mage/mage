exports.mediaType = 'application/octet-stream';
exports.fileExt = 'bin';
exports.isBinary = true;


exports.encoders = {
	'base64-live': function (data) {
		return new Buffer(data, 'base64');
	},
	'live-base64': function (data) {
		return data.toString('base64');
	}
};


exports.detector = function (data) {
	return Buffer.isBuffer(data) ? 0.2 : 0;
};

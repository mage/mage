var Tome = require('tomes').Tome;


exports.mediaType = 'application/x-tome';
exports.fileExt = 'tome';


exports.detector = function (data) {
	return Tome.isTome(data) ? 1 : 0;
};


exports.encoders = {
	'utf8-live': function (data) {
		return Tome.conjure(JSON.parse(data));
	},
	'live-utf8': function (tome) {
		return JSON.stringify(tome, null, '\t');
	}
};

exports.diff = {
	get: function (tome) {
		return tome.readAll();
	},
	set: function (tome, diffs) {
		tome.merge(diffs);
	}
};

exports.init = function (tome, value) {
	// init returns the uninitialize function

	function onchange() {
		value.set(null, tome, 'live');
	}

	tome.on('readable', onchange);

	return function () {
		tome.removeListener('readable', onchange);
	};
};

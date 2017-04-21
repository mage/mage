var Timer = require('wizcorp-timer.js');

var server = exports.server = new Timer();


exports.bend = function (offset, accelerationFactor, startAt) {
	server.configure(offset, accelerationFactor, startAt);
};


exports.getConfig = function () {
	return {
		offset: server.offset,
		accelerationFactor: server.accelerationFactor,
		startAt: server.startAt
	};
};


exports.msec = function () {
	return server.msec();
};


exports.now = function (msecOut) {
	return server.now(msecOut);
};


exports.sec = function () {
	return server.sec();
};


exports.translate = function (timestamp, msecOut) {
	return server.translate(timestamp, msecOut);
};


exports.unbend = function () {
	server.configure();
};

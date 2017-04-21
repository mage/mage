var uuid = require('node-uuid');
var util = require('util');
var Engine = require('../Engine');


function Anonymous(logger) {
	this.logger = logger;
}

util.inherits(Anonymous, Engine);


Anonymous.prototype.auth = function (state, credentials, cb) {
	var userId = uuid.v4();

	cb(null, userId);
};


exports.setup = function (name, cfg, logger, cb) {
	cb(null, new Anonymous(logger));
};

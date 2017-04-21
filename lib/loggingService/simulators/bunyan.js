// This Bunyan simulator implements the API as documented at: https://github.com/trentm/node-bunyan

function BunyanSim(logger) {
	this._logger = logger;
	this.serializers = {};
}


BunyanSim.prototype.child = function (options) {
	if (options && options.component) {
		this._logger.verbose('Spawning Bunyan child');

		return new BunyanSim(this._logger.context(options.component));
	}

	return this;
};


BunyanSim.prototype.level = function () {
	this._logger.verbose('Ignoring request to change bunyan log-level');
};


function log(fn, args) {
	var special = args[0];
	var data;
	var offset = 0;
	var forLog = [];

	if (special && typeof special === 'object') {
		if (special instanceof Error) {
			data = { error: special };
		} else {
			data = special;
		}

		offset = 1;
	}

	for (var i = offset; i < args.length; i++) {
		forLog.push(args[i]);
	}

	fn.data(data).log.apply(fn, forLog);
}


// Proxies

BunyanSim.prototype.trace = function () {
	log(this._logger.verbose, arguments);
};

BunyanSim.prototype.debug = function () {
	log(this._logger.verbose, arguments);
};

BunyanSim.prototype.info = function () {
	log(this._logger.debug, arguments);
};

BunyanSim.prototype.warn = function () {
	log(this._logger.warning, arguments);
};

BunyanSim.prototype.fatal = function () {
	log(this._logger.emergency, arguments);
};


exports.create = function (logger) {
	return new BunyanSim(logger);
};

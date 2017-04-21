var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


function applyTTL(memoryVault, trueName, expirationTime) {
	var timers = memoryVault._timers;
	var store = memoryVault._store;

	clearTimeout(timers[trueName]);

	if (store[trueName]) {
		store[trueName].expirationTime = expirationTime;
	}

	if (!expirationTime) {
		return;
	}

	var ttl = expirationTime * 1000 - Date.now();

	timers[trueName] = setTimeout(function expire() {
		memoryVault.logger.verbose('expire:', trueName);

		delete store[trueName];
		delete timers[trueName];
	}, ttl);
}


// MemoryVault

function MemoryVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.logger = logger;

	this._store = {};  // the actual data that we store
	this._timers = {}; // where we keep the expiration timers
}


exports.create = function (name, logger) {
	return new MemoryVault(name, logger);
};


MemoryVault.prototype.setup = function (cfg, cb) {
	setImmediate(cb);
};


MemoryVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	for (var trueName in this._timers) {
		clearTimeout(this._timers[trueName]);
	}

	this._timers = {};
	this._store = {};
};


MemoryVault.prototype.scan = function (map, cb) {
	var result = [];

	for (var trueName in this._store) {
		var entry = this._store[trueName];

		if (map) {
			entry = map(entry);
		}

		if (entry) {
			result.push(entry);
		}
	}

	cb(null, result);
};


MemoryVault.prototype.get = function (trueName, cb) {
	this.logger.verbose('get:', trueName);

	var store = this._store;

	setImmediate(function () {
		cb(null, store[trueName]);
	});
};


MemoryVault.prototype.add = function (trueName, data, expirationTime, cb) {
	this.logger.verbose('add:', trueName);

	var that = this;

	setImmediate(function () {
		if (that._store.hasOwnProperty(trueName)) {
			return cb(new Error('Value already exists when trying to add.'));
		}

		that._store[trueName] = data;
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.set = function (trueName, data, expirationTime, cb) {
	this.logger.verbose('set:', trueName);

	var that = this;

	setImmediate(function () {
		that._store[trueName] = data;
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.touch = function (trueName, expirationTime, cb) {
	this.logger.verbose('touch:', trueName);

	var that = this;

	setImmediate(function () {
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.del = function (trueName, cb) {
	this.logger.verbose('del:', trueName);

	var store = this._store;
	var timers = this._timers;

	setImmediate(function () {
		clearTimeout(timers[trueName]);

		delete store[trueName];
		delete timers[trueName];

		cb();
	});
};

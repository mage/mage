// this vault uses shards to aim at actors (to emit events to)
//
// key format: { topic: string, index: { .. } }
// shard format: actorId | [actorId, actorId, ..] | falsy

var Archive = require('./Archive');

// default topic/index/data handlers

exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around state.emit

function ClientVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.state = null;
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new ClientVault(name, logger);
};

ClientVault.prototype.setup = function (cfg, cb) {
	this.state = cfg.state;

	setImmediate(cb);
};

ClientVault.prototype.open = function (cfg, cb) {
	setImmediate(cb);
};

ClientVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	this.state = null;
};


function allowedShard(actorId, shard) {
	if (shard === true || shard === '*') {
		return true;
	}

	shard = Array.isArray(shard.valueOf()) ? shard : [shard];

	// loop instead of indexOf, because we want to cast the array elements to strings

	for (var i = 0; i < shard.length; i++) {
		if (shard[i]) {
			var shardValue = shard[i].valueOf();

			if (shardValue === true || shardValue === '*' || '' + shardValue === actorId) {
				return true;
			}
		}
	}

	return false;
}


ClientVault.prototype.operationAllowedForSession = function (state, aclTests, op, shard) {
	var hasWildcardTag = state.acl.indexOf('*') !== -1;

	for (var tag in aclTests) {
		// if the user does not have a valid access tag/*, go to next test, and tag access for this test is not *
		if (tag !== '*' && state.acl.indexOf(tag) === -1 && !hasWildcardTag) {
			continue;
		}

		// if the test is not related to the operation, go to next test
		if (aclTests[tag].ops.indexOf(op) === -1 && aclTests[tag].ops.indexOf('*') === -1) {
			continue;
		}

		// if we have to shard and the shard does not lead to this actor, go to next test
		if (shard && aclTests[tag].shard && !allowedShard(state.actorId, shard)) {
			continue;
		}

		// test passed
		return true;
	}

	// tests failed
	return false;
};


function emit(vault, event, actorIds, msg) {
	if (!vault.state || !actorIds || !msg) {
		return;
	}

	if (actorIds === '*') {
		vault.logger.verbose('Broadcasting "' + event + '" to all logged in users');

		vault.state.broadcast(event, msg);
	} else {
		vault.logger.verbose('Emitting "' + event + '" to', actorIds);

		vault.state.emit(actorIds, event, msg);
	}
}


ClientVault.prototype.set = function (actorIds, key, data, expirationTime) {
	emit(
		this,
		'archivist:set',
		actorIds,
		{ key: key, value: data, expirationTime: expirationTime }
	);
};


ClientVault.prototype.applyDiff = function (actorIds, key, diff, expirationTime) {
	emit(
		this,
		'archivist:applyDiff',
		actorIds,
		{ key: key, diff: diff, expirationTime: expirationTime }
	);
};


ClientVault.prototype.touch = function (actorIds, key, expirationTime) {
	emit(
		this,
		'archivist:touch',
		actorIds,
		{ key: key, expirationTime: expirationTime }
	);
};


ClientVault.prototype.del = function (actorIds, key) {
	emit(
		this,
		'archivist:del',
		actorIds,
		{ key: key }
	);
};

// Error codes from couchbase/deps/lcb/include/libcouchbase/error.h:
// 11: Temporary failure received from server. Try again later.
// 16: Generic network failure.
// 22: Data received on socket was not in the expected format.
// 42: The cluster map has changed and this operation could not be completed or retried internally.

// Error codes for N1QL (from god knows where)
// 4300: Index already exists.

var async = require('async');

var requirePeer = require('codependency').get('mage');
var couchbase = requirePeer('couchbase');


// Retry delay for all wait operations
var READY_RETRY_INTERVAL = 500;

/**
 * This function will:
 *
 *   1. Call the callback function with the error as the first argument, or;
 *   2. Simply call the callback if the code is exempted.
 *
 * This is generally going to be used as part of an `async.whilst` call chain,
 * and will either trigger a hard failure if the error code is not ignored, or
 * a retry if it is.
 *
 * @summary Handle an error depending on the error code
 * @param {Error} error - The received error code
 * @param {Array} exemptedCodes - Codes for which we should retry
 * @param {Function} callback - The callback function to trigger in both cases
 */
function handleErrorPerErrorCode(error, exemptedCodes, callback) {
	if (exemptedCodes.indexOf(error.code) === -1) {
		return callback(error);
	} else {
		return setTimeout(callback, READY_RETRY_INTERVAL);
	}
}

/**
 * See https://github.com/couchbase/libcouchbase/blob/master/include/libcouchbase/error.h
 * for more details about the meaning of each error codes.
 *
 * At this point, the credentials used have already been validated; an auth error
 * would mean that the bucket has not been created yet.
 *
 * @summary Handle bucket open errors.
 * @param {Error} error - The received error code
 * @param {Function} callback - The callback function to trigger in both cases
 */
function handleBucketOpenError(error, callback) {
	handleErrorPerErrorCode(error, [
		couchbase.errors.authError,    // LCB_AUTH_ERROR
		couchbase.errors.protocolError // LCB_PROTOCOL_ERROR
	], callback);
}

/**
 * See https://github.com/couchbase/libcouchbase/blob/master/include/libcouchbase/error.h
 * for more details about the meaning of each error codes.
 *
 * @summary Handle bucket mutation errors.
 * @param {Error} error - The received error code
 * @param {Function} callback - The callback function to trigger in both cases
 */
function handleBucketMutationError(error, callback) {
	handleErrorPerErrorCode(error, [
		couchbase.errors.serverBusy,	  // LCB_EBUSY
		couchbase.errors.cLibOutOfMemory, // LCB_ENOMEM
		couchbase.errors.temporaryError,  // LCB_ETMPFAIL
		couchbase.errors.networkError,    // LCB_NETWORK_ERROR

		// TODO: Find out why the following codes are not exposed in couchnode
		42,				  // LCB_MAP_CHANGED
		61				  // LCB_UNKNOWN_MEMCACHED_ERROR
	], callback);
}

/**
 * @summary Warm up Couchbase SET operations on new bucket
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForSet(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for SET...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				return handleBucketOpenError(error, callback);
			}

			bucket.upsert('mage/create/test_key', { mageTestKey: 394649 }, {}, function (error) {
				if (error) {
					return handleBucketMutationError(error, callback);
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * @summary Warm up Couchbase GET operations on new bucket
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForGet(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for GET...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				return handleBucketOpenError(error, callback);
			}

			bucket.get('mage/create/test_key', {}, function (error) {
				if (error) {
					return handleBucketMutationError(error, callback);
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * @summary Warm up Couchbase N1QL operations on new bucket
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForN1QL(logger, cluster, bucketOptions, cb) {
	if (!bucketOptions.qhosts) {
		logger.debug('N1QL not configured for bucket:', bucketOptions.bucket);
		return cb();
	}

	async.series([
		function (callback) {
			logger.debug('Waiting for N1QL index...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						return handleBucketOpenError(error, callback);
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Create primary index on bucket to test N1QL warm-up
					var query = 'CREATE PRIMARY INDEX ON `' + bucketOptions.bucket + '`';
					var n1qlQuery = couchbase.N1qlQuery.fromString(query);
					n1qlQuery.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);

					bucket.query(n1qlQuery, function (error) {
						if (error && error.code !== 4300) {
							return callback(error);
						}

						// Check if the indexes have been created
						var query = 'SELECT RAW keyspace_id FROM system:indexes WHERE is_primary = true';
						var n1qlQuery = couchbase.N1qlQuery.fromString(query);
						n1qlQuery.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);

						bucket.query(n1qlQuery, function (error, indexesKeyspace) {
							if (error) {
								return callback(error);
							}

							if (indexesKeyspace.indexOf(bucketOptions.bucket) !== -1) {
								keepWaiting = false;
							}

							return callback();
						});
					});
				});
			}, callback);
		},
		function (callback) {
			logger.debug('Waiting for N1QL query...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						return handleBucketOpenError(error, callback);
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Attempt to perform query on indexed data
					var query = 'SELECT mageTestKey FROM `' + bucketOptions.bucket + '` WHERE mageTestKey=394649';
					var n1qlQuery = couchbase.N1qlQuery.fromString(query);
					n1qlQuery.consistency(couchbase.N1qlQuery.Consistency.REQUEST_PLUS);

					bucket.query(n1qlQuery, function (error, results) {
						if (error) {
							keepWaiting = false;
							keepWaiting = keepWaiting || /^An unknown error occured/.test(error.message);
							keepWaiting = keepWaiting || /^An unknown N1QL error occured/.test(error.message);

							if (keepWaiting) {
								return setTimeout(callback, READY_RETRY_INTERVAL);
							} else {
								return callback(error);
							}
						}

						if (!results.length) {
							return setTimeout(callback, READY_RETRY_INTERVAL);
						}

						keepWaiting = false;
						return callback();
					});
				});
			}, callback);
		},
		function (callback) {
			logger.debug('Waiting for N1QL drop index...');

			var keepWaiting = true;
			async.whilst(function () {
				return keepWaiting;
			}, function (callback) {
				var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
					if (error) {
						return handleBucketOpenError(error, callback);
					}

					// Enable N1QL support on bucket
					bucket.enableN1ql(bucketOptions.qhosts);

					// Drop previously created primary index
					var query = 'DROP PRIMARY INDEX ON `' + bucketOptions.bucket + '`';
					bucket.query(couchbase.N1qlQuery.fromString(query), function (error) {
						if (error) {
							return callback(error);
						}

						keepWaiting = false;
						return callback();
					});
				});
			}, callback);
		}
	], cb);
}


/**
 * @summary Warm up Couchbase DELETE operations on new bucket
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Function} cb
 */
function waitForDel(logger, cluster, bucketOptions, cb) {
	logger.debug('Waiting for DEL...');

	var keepWaiting = true;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		var bucket = cluster.openBucket(bucketOptions.bucket, bucketOptions.password, function (error) {
			if (error) {
				return handleBucketOpenError(error, callback);
			}

			bucket.remove('mage/create/test_key', {}, function (error) {
				if (error) {
					return handleBucketMutationError(error, callback);
				}

				keepWaiting = false;
				return callback();
			});
		});
	}, cb);
}


/**
 * @summary Create Couchbase bucket.
 * @param {Logger} logger
 * @param {couchbase.Cluster} cluster
 * @param {Object} bucketOptions
 * @param {Object} createBucketData
 * @param {Function} cb
 */
function createBucket(logger, cluster, bucketOptions, createBucketData, cb) {
	logger.notice('Creating bucket:', bucketOptions.bucket);

	var keepWaiting = true;
	var clusterManager = cluster.manager(createBucketData.adminUsername, createBucketData.adminPassword);

	createBucketData.saslPassword = bucketOptions.password;
	async.whilst(function () {
		return keepWaiting;
	}, function (callback) {
		clusterManager.createBucket(bucketOptions.bucket, createBucketData, function (error) {
			if (error) {
				return handleBucketMutationError(error, callback);
			}

			// This is necessary to be able to use the bucket right after a creation. Basically the bucket has
			// a small warm up time, during which connections and operations will fail. To make sure our
			// bucket is ready for use, we wait for it here.
			async.series([
				waitForSet.bind(null, logger, cluster, bucketOptions),
				waitForGet.bind(null, logger, cluster, bucketOptions),
				waitForN1QL.bind(null, logger, cluster, bucketOptions),
				waitForDel.bind(null, logger, cluster, bucketOptions)
			], function (error) {
				if (error) {
					return handleBucketMutationError(error, callback);
				}

				keepWaiting = false;

				logger.notice('Bucket ready for use:', bucketOptions.bucket);
				return callback();
			});
		});
	}, cb);
}


/**
 * See: https://github.com/couchbase/couchnode/pull/49
 *
 * The code itself is mostly copy/pasted from within
 * the Native C code inside couchnode `src/transcoder.cc`
 *
 * @summary Pass-through encoder for couchnode
 * @param {*} value
 * @returns {*}
 */
function encoder(value) {
	var transcoderDoc;
	if (typeof value === 'string' || value instanceof String) {
		transcoderDoc = { value: new Buffer(value), flags: 0 };
	} else if (value instanceof Buffer) {
		transcoderDoc = { value: value, flags: 4 };
	} else {
		if (value.value && value.flags) {
			if (typeof value.value === 'string' || value.value instanceof String) {
				transcoderDoc = { value: new Buffer(value.value), flags: value.flags };
			} else if (value.value instanceof Buffer) {
				transcoderDoc = { value: value.value, flags: value.flags };
			} else {
				transcoderDoc = { value: new Buffer(JSON.stringify(value.value)), flags: value.flags };
			}
		} else {
			try {
				transcoderDoc = { value: new Buffer(JSON.stringify(value)), flags: 2 };
			} catch (error) {
				// TODO: NEED BETTER ERROR HANDLING HERE
				return;
			}
		}
	}

	return transcoderDoc;
}


/**
 * See: https://github.com/couchbase/couchnode/pull/49
 *
 * @summary Pass-through decoder for couchnode
 * @param {*} transcoderDoc
 * @returns {*}
 */
function decoder(transcoderDoc) {
	return transcoderDoc;
}


// Make wait functions public
exports.createBucket = createBucket;
exports.encoder = encoder;
exports.decoder = decoder;

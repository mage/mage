var fs = require('fs');


/**
 * Writes a file data with given write options.
 *
 * @param {String} filePath
 * @param {Object} options
 * @param {String} data
 * @param {Function} cb
 */
exports.writeWithOptions = function (filePath, options, data, cb) {
	var stream;
	var bytes = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);

	try {
		stream = fs.createWriteStream(filePath, options);
	} catch (error) {
		return cb(error);
	}

	function callback(error) {
		if (!error && stream.bytesWritten === bytes) {
			return cb();
		}

		// if the error was that exclusive mode failed due to the file already existing, we bail
		// out normally

		if (error && error.code === 'EEXIST') {
			return cb(error);
		}

		// else we consider this a failed file overwrite attempt, and we must remove the file

		return fs.unlink(filePath, function () {
			if (!error && stream.bytesWritten !== bytes) {
				error = new Error('Bytes written: ' + stream.bytesWritten + ' of ' + bytes);
			}

			return cb(error);
		});
	}

	stream.once('error', callback);
	stream.once('close', callback);

	stream.once('open', function () {
		stream.write(data);
		stream.end();
	});
};


/**
 * Attempts to read a file and on an error will retry up to 5 times. Will yield either an error or
 * the file data.
 *
 * @param {String} filePath
 * @param {Object} logger
 * @param {Function} cb
 */
exports.readWithRetry = function (filePath, logger, cb) {
	var attempts = 0;
	var retryLimit = 5;
	var retryDelay = 50;

	function attemptRead() {
		attempts += 1;

		if (attempts > 1) {
			logger.verbose('Retry attempt', attempts, 'to read from', filePath);
		}

		fs.readFile(filePath, function (error, data) {
			if (!error && (!data || data.length === 0)) {
				if (attempts <= retryLimit) {
					if (attempts === 1) {
						logger.warning('Could not read from file:', filePath,
							'retrying', retryLimit, 'times every', retryDelay, 'msec');
					}

					return setTimeout(attemptRead, retryDelay);
				}
			}

			if (error) {
				return cb(error);
			}

			if (attempts > 1) {
				if (data && data.length > 0) {
					logger.debug('Succeeded to read', filePath, 'on attempt', attempts);
				} else {
					logger.debug('File', filePath, 'still empty after', attempts, 'attempts');
				}
			}

			cb(null, data);
		});
	}

	attemptRead();
};

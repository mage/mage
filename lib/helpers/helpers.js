var fs = require('fs');
var async = require('async');

var logger;

/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object} mageLogger A mage logger.
 */

exports.initialize = function (mageLogger) {
	logger = mageLogger;
};


exports.timeCodeToSec = function (code) {
	// turns a time code into seconds:
	// "[num]d" days
	// "[num]h" hours
	// "[num]m" minutes
	// "[num]s" seconds
	// returns false if parsing failed

	if (typeof code !== 'string') {
		throw new TypeError('Given time code is not a string: ' + code);
	}

	var m;

	if ((m = code.match(/^([1-9][0-9]*)d$/))) {
		return ~~m[1] * 24 * 3600;
	}

	if ((m = code.match(/^([1-9][0-9]*)h$/))) {
		return ~~m[1] * 3600;
	}

	if ((m = code.match(/^([1-9][0-9]*)m$/))) {
		return ~~m[1] * 60;
	}

	if ((m = code.match(/^([1-9][0-9]*)s$/))) {
		return ~~m[1];
	}

	throw new Error('Could not parse time code: ' + code);
};


exports.getFileContents = function (path, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else {
		options = options || {};
	}

	// default encoding is utf8
	options.encoding = options.encoding || 'utf8';

	logger.verbose('Loading contents from:', path);

	// somehow adding extra options is fine for readFile, just know that "encoding" and "flag" are
	// reserved by readFile
	fs.readFile(path, options, function (error, data) {
		if (!options.optional && error) {
			logger.error('Error reading file contents:', path);
			return cb(error);
		}

		cb(null, data || null);
	});
};


exports.readDirectory = function (path, matcher, cb) {
	// returns: { files: [], directories: [] } containing relative paths

	fs.readdir(path, function (error, entries) {
		if (error) {
			logger.error('Error reading directory:', path);
			return cb(error);
		}

		entries.sort();

		var result = { files: [], directories: [] };

		async.forEachSeries(
			entries,
			function (entry, callback) {
				// skip hidden files

				if (entry[0] === '.') {
					return callback();
				}

				var entryPath = path + '/' + entry;

				fs.stat(entryPath, function (error, stats) {
					if (error) {
						logger.error('Error reading directory entry:', entryPath);
						return cb(error);
					}

					if (stats.isDirectory()) {
						result.directories.push(entry);
					} else if (stats.isFile()) {
						// skip files that do not match the matcher

						if (!matcher || entry.match(matcher)) {
							result.files.push(entry);
						}
					}

					callback();
				});
			},
			function (error) {
				if (error) {
					cb(error);
				} else {
					cb(null, result);
				}
			}
		);
	});
};


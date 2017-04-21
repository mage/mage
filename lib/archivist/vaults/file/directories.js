var path = require('path');
var fs = require('fs');
var async = require('async');

var MAX_PARALLEL = 10;

/**
 * Recursively scans a directory for all files. This will then yield an array of all filenames
 * relative to the give rootPath or an error.
 *
 * @param {String} rootPath
 * @param {Function} cb
 */
function recursiveFileList(rootPath, cb) {
	var fileList = [];
	var errorList = [];

	var q = async.queue(function (filename, callback) {
		var filePath = path.join(rootPath, filename);

		fs.stat(filePath, function (error, stat) {
			if (error) {
				errorList.push(error);
				return callback(error);
			}

			// If not a directory then push onto list and continue
			if (!stat.isDirectory()) {
				fileList.push(filename);
				return callback();
			}

			// Otherwise recurse
			fs.readdir(filePath, function (error, files) {
				if (error) {
					errorList.push(error);
					return callback(error);
				}

				// Append list of child file onto our file list
				for (var i = 0; i < files.length; i += 1) {
					q.push(path.join(filename, files[i]));
				}

				callback();
			});
		});
	}, MAX_PARALLEL);

	q.drain = function () {
		if (errorList.length) {
			return cb(errorList);
		}

		cb(null, fileList);
	};

	fs.readdir(rootPath, function (error, files) {
		if (error) {
			return cb(error);
		}

		if (!files.length) {
			return q.drain();
		}

		for (var i = 0; i < files.length; i += 1) {
			q.push(files[i]);
		}
	});
}

exports.recursiveFileList = recursiveFileList;


/**
 * Recursively purges empty folders from subfolderPath and working its way through its parents until
 * reaching rootPath.
 *
 * @param {String} rootPath - root path to which the given subfolder belongs
 * @param {String} subfolderPath - subfolder path relative to the root path
 * @param {Object} logger
 * @param {Function} cb
 */
function purgeEmptyParentFolders(rootPath, subfolderPath, logger, cb) {
	var fullPath = path.join(rootPath, subfolderPath);

	// Don't delete if we have reached the base
	if (!subfolderPath || subfolderPath === '.') {
		return cb();
	}

	fs.rmdir(fullPath, function (error) {
		if (error) {
			return cb(error);
		}

		logger.verbose('Purged empty subfolder:', fullPath);

		return purgeEmptyParentFolders(rootPath, path.dirname(subfolderPath), logger, cb);
	});
}
exports.purgeEmptyParentFolders = purgeEmptyParentFolders;


/**
 * Scans all subdirectories for a given root path and attempts to delete any empty subfolders. It
 * will traverse to the deepest child of each branch and work backwards deleting any empty folders.
 * If there is an error during directory removal, we just ignore it and call the callback.
 *
 * @param {String} rootPath - root path for given subfolder path
 * @param {String} subfolderPath - internal recursion string (pass in null)
 * @param {Object} logger
 * @param {Function} cb
 */
function purgeEmptySubFolders(rootPath, subfolderPath, logger, cb) {
	subfolderPath = subfolderPath || '';
	var fullPath = path.join(rootPath, subfolderPath);

	fs.readdir(fullPath, function (error, files) {
		if (error) {
			return cb();
		}

		async.eachLimit(files, MAX_PARALLEL, function (file, callback) {
			var filepath = path.join(fullPath, file);
			fs.stat(filepath, function (error, stat) {
				if (error || !stat.isDirectory()) {
					return callback();
				}

				// Recurse inwards
				purgeEmptySubFolders(rootPath, path.join(subfolderPath, file), logger, callback);
			});
		}, function () {
			// Do nothing if root path
			if (!subfolderPath) {
				return cb();
			}

			// Otherwise attempt to remove directory
			fs.rmdir(fullPath, function (error) {
				if (error) {
					return cb();
				}

				logger.verbose('Purged empty subfolder:', fullPath);

				return cb();
			});
		});
	});
}

exports.purgeEmptySubFolders = purgeEmptySubFolders;

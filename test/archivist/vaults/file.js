var assert = require('assert');
var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var os = require('os');
var path = require('path');

var fileVaultMod = require('lib/archivist/vaults/file');

var pathId = 0;
var tmpPath = require('mktemp').createDirSync(path.join(os.tmpdir(), 'mage-filevault-XXXXXXXXXX'));

function createPath() {
	pathId += 1;
	return path.join('test/data/',  pathId.toString());
}

function createSimpleData(str) {
	return {
		meta: {
			mediaType: 'application/json',
			expirationTime: Math.floor(Date.now() / 1000) + 10,
			ext: '.json'
		},
		content: new Buffer('{"hello":' + JSON.stringify((str || 'world') + '') + '}')
	};
}

function absPath(relPath) {
	return path.join(tmpPath, relPath);
}

function devNull() {}

var logger = {
	debug: devNull,
	verbose: devNull,
	alert: console.error,
	error: console.error,
	info: devNull,
	notice: devNull,
	warning: console.warn
};

function createVault(cb) {
	var vault = fileVaultMod.create('myFileVault', logger);
	vault.setup({ path: tmpPath }, function (error) {
		assert.ifError(error, 'FileVault#setup returned an error');
		return cb(vault);
	});
}


/* BEGIN TESTS */

describe('File Vault', function () {
	it('can instantiate', function (done) {
		createVault(function (fileVault) {
			assert.ok(fileVault, 'FileVault instantiation failed.');
			done();
		});
	});


	describe('File creation through core API', function () {
		var testFilePath;
		var testFileData;

		beforeEach(function () {
			testFilePath = createPath();
			testFileData = createSimpleData();
		});

		it('can create with "set"', function (done) {
			createVault(function (fileVault) {
				fileVault.set(testFilePath, testFileData, function (error) {
					assert.ifError(error, 'FileVault#set returned an error');

					assert.deepEqual(
						testFileData.content,
						fs.readFileSync(absPath(testFilePath + testFileData.meta.ext)),
						'Write/Read equality mismatch'
					);

					done();
				});
			});
		});

		afterEach(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
		});
	});


	describe('File reading through core API', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			mkdirp.sync(absPath(path.dirname(testFilePath)));
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('can "get" a file', function (done) {
			createVault(function (fileVault) {
				fileVault.get(testFilePath, function (error, data) {
					assert.ifError(error, 'FileVault#get returned an error');
					assert(data, 'No data was returned');
					assert.deepEqual(data.content, testFileData.content, 'Write/Read equality mismatch');
					done();
				});
			});
		});

		after(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
		});
	});


	describe('File overwriting through core API', function () {
		var testFilePath = createPath();
		var testFileDataA = createSimpleData(1);
		var testFileDataB = createSimpleData(2);

		before(function () {
			mkdirp.sync(absPath(path.dirname(testFilePath)));
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileDataA.meta));
			fs.writeFileSync(absPath(testFilePath + testFileDataA.meta.ext), testFileDataA.content);
		});

		it('can overwrite with "set"', function (done) {
			createVault(function (fileVault) {
				fileVault.set(testFilePath, testFileDataB, function (error) {
					assert.ifError(error, 'FileVault#set returned an error');

					var data = fs.readFileSync(absPath(testFilePath + testFileDataB.meta.ext));

					assert.deepEqual(data, testFileDataB.content, 'Write/Read equality mismatch');
					done();
				});
			});
		});

		after(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileDataA.meta.ext));
		});
	});


	describe('File deletion through core API', function () {
		var testFilePath = createPath();
		var testFilePath2 = createPath();
		var testFileData = createSimpleData();

		before(function () {
			mkdirp.sync(absPath(path.dirname(testFilePath)));
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);

			mkdirp.sync(absPath(path.dirname(testFilePath2)));
			fs.writeFileSync(absPath(testFilePath2 + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath2 + testFileData.meta.ext), testFileData.content);
		});

		it('can "del" a file', function (done) {
			createVault(function (fileVault) {
				fileVault.del(testFilePath, function (error) {
					assert.ifError(error, 'FileVault#del returned an error');

					assert.throws(function () {
						fs.statSync(absPath(testFilePath + '.filevault'));
					});

					assert.throws(function () {
						fs.statSync(absPath(testFilePath + testFileData.meta.ext));
					});

					done();
				});
			});
		});

		it('does not purge non-empty folders', function (done) {
			fs.readdir(tmpPath, function (error, files) {
				assert.ifError(error, 'fs#readdir returned an error');

				assert.strictEqual(files.length, 1);

				done();
			});
		});

		it('purges empty folders', function (done) {
			createVault(function (fileVault) {
				fileVault.del(testFilePath2, function (error) {
					assert.ifError(error, 'FileVault#del returned an error');

					fs.readdir(tmpPath, function (error, files) {
						assert.ifError(error, 'fs#readdir returned an error');
						assert.strictEqual(files.length, 0);

						done();
					});
				});
			});
		});

		after(function () {
			// just in case the test failed, we still want to clean up

			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath2 + '.filevault'));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath2 + testFileData.meta.ext));
			} catch (e) {}
		});
	});


	describe('Extension change', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			mkdirp.sync(absPath(path.dirname(testFilePath)));
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('deletes the file with the old extension', function (done) {
			createVault(function (fileVault) {
				var oldExtension = testFileData.meta.ext;
				testFileData.meta.ext = '.banana';

				fileVault.set(testFilePath, testFileData, function (error) {
					assert.ifError(error, 'FileVault#set returned an error');

					fs.statSync(absPath(testFilePath + '.filevault'));
					fs.statSync(absPath(testFilePath + testFileData.meta.ext));

					assert.throws(function () {
						fs.statSync(absPath(testFilePath + oldExtension));
					});

					done();
				});
			});
		});

		after(function () {
			// just in case the test failed, we still want to clean up

			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {}
		});
	});


	describe('Listing files through core API', function () {
		var startIndex = pathId + 1;
		var testFilePaths = [createPath(), createPath(), createPath(), createPath()];
		var testFileData = createSimpleData();

		before(function (done) {
			function writeVault(filePath, callback) {
				mkdirp(absPath(path.dirname(filePath)), function (error) {
					if (error) {
						return callback(error);
					}

					fs.writeFile(absPath(filePath + '.filevault'), JSON.stringify(testFileData.meta), function (error) {
						if (error) {
							return callback(error);
						}

						fs.writeFile(absPath(filePath + testFileData.meta.ext), testFileData.content, callback);
					});
				});
			}

			async.forEachSeries(testFilePaths, writeVault, done);
		});

		it('can "scan" all files in a folder', function (done) {
			createVault(function (fileVault) {
				function map(file) {
					var pattern = path.join('test', 'data');

					if (file.indexOf(pattern) === 0) {
						return parseInt(file.substring(pattern.length + 1), 10);
					}
				}

				fileVault.scan(map, function (error, results) {
					assert.ifError(error, 'FileVault#scan returned an error');

					assert.strictEqual(results.length, testFilePaths.length);

					var expected = [startIndex, startIndex + 1, startIndex + 2, startIndex + 3];
					results.sort();

					assert.deepEqual(results, expected, 'Map did not transform correctly');

					done();
				});
			});
		});

		after(function (done) {
			function removeVault(filePath, callback) {
				fs.unlink(absPath(filePath + '.filevault'), function (error) {
					if (error) {
						return callback(error);
					}

					fs.unlink(absPath(filePath + testFileData.meta.ext), callback);
				});
			}

			async.forEachSeries(testFilePaths, removeVault, done);
		});
	});

	describe('Expiring files', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			testFileData.meta.expirationTime -= 100;
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('does not return data for an expired file', function (done) {
			createVault(function (fileVault) {
				fileVault.get(testFilePath, function (error, data) {
					assert.equal(error, undefined, 'FileVault#get returned an error');
					assert.equal(data, undefined, 'FileVault returned data.');

					done();
				});
			});
		});

		after(function () {
			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {
			}
		});
	});

	// Clean up new temp folder
	after(function () {
		rimraf.sync(tmpPath);
	});
});

/**
 *
 */
var path = require('path');
var merge = require('deepmerge');
var fs = require('fs');
var readline = require('readline');
var readline = require('readline');
var mkdirp = require('mkdirp');
var zlib = require('zlib');
var tar = require('tar-stream');
var cp = require('child_process');
var os = require('os');

var Module = module.constructor;

var protectedPackageJsonAttributes = [
	'name',
	'private',
	'description',
	'version',
	'repository',
	'author',
	'license',
	'bugs',
	'homepage',
	'keywords'
];

var ignored = [
	'Readme.md',
	'README.md',
	'.npmrc'
];

var ignoreFiles = [
	'.gitignore',
	'.retireignore',
	'.dockerignore'
];

/**
 * If a setup script is found, it will be stored here;
 */
var setupScript = '';

/**
 * NPM packages .gitignore as .npmignore if
 * no .npmignore are present, and leaves no traces
 * of the .gitignore file.
 *
 * @param {Object} header
 * @returns {string} file name
 */
function getNameFromHeader(header) {
	var name = header.name.replace(/^package\//, '');
	if (name === '.npmignore') {
		name = '.gitignore';
	}

	return name;
}

/**
 * Merge meta-package's package.json into the current project
 *
 * @param {stream.ReadableStream} stream File stream for the source file
 * @param {string} projectDir
 * @param {Function} callback
 */
function applyPackageJson(stream, projectDir, callback) {
	var destinationPackageJson = path.join(projectDir, 'package.json');

	var sourceContent = '';
	stream.on('data', function (data) {
		sourceContent += data.toString();
	});

	stream.on('end', function () {
		var sourceData = JSON.parse(sourceContent);
		var destinationData = require(destinationPackageJson);
		var cannotBeOverwritten = protectedPackageJsonAttributes.reduce(function (target, attribute) {
			target[attribute] = destinationData[attribute];
			return target;
		}, {});

		var result = merge(destinationData, sourceData);
		Object.assign(result, cannotBeOverwritten);

		fs.writeFile(destinationPackageJson, JSON.stringify(result, null, 2), callback);
	});
}

/**
 * Merge meta-package's ignore files (like .gitignore) into the current project
 *
 * @param {String} name
 * @param {stream.ReadableStream} stream File stream for the source file
 * @param {string} projectDir
 * @param {Function} callback
 */
function applyIgnoreFile(name, stream, destination, callback) {
	var destinationFilename = path.join(destination, name);
	var destinationContent;

	try {
		destinationContent = fs
			.readFileSync(destinationFilename)
			.toString()
			.replace(/\r/g, '')
			.split('\n');
	} catch (error) {
		if (error.code !== 'NOENT') {
			return callback(error);
		}

		destinationContent = [];
	}

	var rl = readline.createInterface({
		input: stream
	});

	rl.on('line', function (line) {
		if (destinationContent.indexOf(line) === -1) {
			destinationContent.push(line);
		}
	});

	rl.on('close', function () {
		fs.writeFile(destinationFilename, destinationContent.join('\n'), callback);
	});
}

/**
 * Save script content in memory for later execution.
 *
 * @param {any} stream
 * @param {any} destination
 * @param {any} callback
 */
function saveScript(stream, destination, callback) {
	stream.on('data', function (data) {
		setupScript += data.toString();
	});

	stream.on('end', callback);
}

function applyFile(stream, destination, callback) {
	var dirname = path.dirname(destination);
	mkdirp(dirname, function () {
		var destinationStream = fs.createWriteStream(destination);

		stream.pipe(destinationStream);
		stream.on('end', callback);
	});
}

/**
 * Load the script's content in memory.
 *
 * @returns {Object} The exported module
 */
function requireSetupScript() {
	var m = new Module();
	m._compile(setupScript, 'metapackage-setup.js');
	return m.exports;
}

/**
 * Execute previously loaded setup script
 *
 * @param {any} callback
 */
function runSetupScript(mage, options, callback) {
	requireSetupScript().setup(mage, options, callback);
}

exports.setup = function (mage, options, cb) {
	mage.core.loggingService.setup(cb);
};

exports.start = function (mage, options, cb) {
	var package = options.package;
	var logger = mage.core.logger;
	var projectDir = process.cwd();
	var tempDir = os.tmpdir();

	logger.notice('Temp directory:', tempDir);
	logger.notice('Project directory:', projectDir);
	logger.info('Downloading', package);

	var pack = cp.spawn('npm', [
		'pack',
		package
	], {
		cwd: tempDir
	});

	// Retrieve the file name from the output
	var tarballFilename = '';
	pack.stdout.on('data', function (data) {
		tarballFilename += data.toString();
	});

	// Log stderr to warning
	readline.createInterface({
		input: pack.stderr
	}).on('line', logger.warning.bind('warning'));

	pack.on('exit', function (exitCode) {
		if (exitCode) {
			return cb(exitCode);
		}

		tarballFilename = tarballFilename.substring(0, tarballFilename.length - 1);
		tarballFilename = path.join(tempDir, tarballFilename);

		logger.info('Extracting', tarballFilename);

		var tarball = fs.createReadStream(tarballFilename);
		var extract = tar.extract();

		extract.on('entry', function (header, stream, next) {
			var name = getNameFromHeader(header);
			var destination = path.join(projectDir, name);

			// Ignored files (file we won't apply)
			if (ignored.indexOf(name) !== -1) {
				logger.debug('Ignoring', name);
				stream.resume();
				return stream.on('end', next);
			}

			// Ignore files (files like .gitignore, .npmignore, etc)
			if (ignoreFiles.indexOf(name) !== -1) {
				logger.info('Merging', name, 'file');
				applyIgnoreFile(name, stream, projectDir, next);
				return stream.on('end', next);
			}

			switch (name) {
			case 'package.json':
				logger.info('Merging package.json');
				applyPackageJson(stream, projectDir, next);
				break;
			case 'index.js':
				saveScript(stream, projectDir, next);
				break;
			default:
				logger.info('Applying file', name, 'to', destination);
				applyFile(stream, projectDir, next);
			}
		});

		function completed() {
			logger.notice('Extraction completed!');
			cb(null, { shutdown: true });
		}

		extract.on('finish', function () {
			if (setupScript === '') {
				return completed();
			}

			runSetupScript(mage, options, completed);
		});

		tarball.pipe(zlib.createGunzip()).pipe(extract);
	});
};

exports.shutdown = function (mage, options, cb) {
	mage.core.loggingService.destroy(cb);
};

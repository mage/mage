#!/usr/bin/env node

var npmArgs = JSON.parse(process.env.npm_config_argv).original;

if (npmArgs.indexOf('--create') === -1 && npmArgs.indexOf('--bootstrap') === -1) {
	process.exit(0);
}

var language = 'javascript';

if (npmArgs.indexOf('--typescript') !== -1 || npmArgs.indexOf('--ts') !== -1) {
	language = 'typescript';
}

var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var mkdirpSync = require('mkdirp').sync;
var async = require('async');
var chalk = require('chalk');
var pretty = require('./lib/pretty.js');
var ask = require('./lib/readline.js').ask;
var EOL = require('os').EOL;

var magePath = process.cwd();
var appPath = path.resolve(magePath, '../..');

var magePackagePath = path.join(magePath, 'package.json');
var appPackagePath = path.join(appPath, 'package.json');

var templateRules = require('./template-rules/default.js');
var projectTemplatePath = 'scripts/templates/' + language + '-project';

pretty.h1('Setting up application');

pretty.info('Parsing MAGE package.json');

var magePackage = require(magePackagePath);


function find(startPath) {
	pretty.info('Scanning: ' + startPath);

	var result = {
		folders: [],
		files: []
	};

	function scan(absPath, relPath) {
		var files = fs.readdirSync(absPath);

		for (var i = 0; i < files.length; i++) {
			var fileName = files[i];
			var foundAbsPath = path.join(absPath, fileName);
			var foundRelPath = path.join(relPath, fileName);

			var stats = fs.statSync(foundAbsPath);

			if (stats.isDirectory()) {
				result.folders.push(foundRelPath);
				scan(foundAbsPath, foundRelPath);
			} else if (stats.isFile()) {
				result.files.push(foundRelPath);
			}
		}
	}

	scan(startPath, '');

	return result;
}


function exec(cmd, args, cwd, cb) {
	var proc = spawn(cmd, args || [], { cwd: cwd || appPath, stdio: 'inherit' });

	var data = '';

	proc.on('data', function (buff) {
		data += buff.toString();
	});

	proc.on('close', function (code) {
		if (code !== 0) {
			pretty.warning(cmd + ' failed with code: ' + code);
			return cb(true);
		}

		cb(null, data);
	});
}

if (fs.existsSync(appPackagePath)) {
	// bootstrapping with an already existing package.json file?

	pretty.warning('Cannot bootstrap an application if a package.json file is already in place.');
	process.exit(1);
}


/**
 * Creates the application skeleton
 *
 * @param {Function} cb
 */

function bootstrap(cb) {
	/**
	 * Copies a file from "from" to "to", and replaces template vars in filenames and file content.
	 * @param {String} from  from-path
	 * @param {String} to    to-path
	 */

	function copy(from, to) {
		var mode = fs.statSync(from).mode;
		var src = fs.readFileSync(from, 'utf8');

		var re = /%([0-9A-Z\_]+)%/g;

		function replacer(_, match) {
			// We support the %PERIOD% variable to allow .gitignore to be created. The reason:
			// npm "kindly" ignores .gitignore files, so we have to use this workaround.
			// More info: https://github.com/isaacs/npm/issues/2958

			if (match === 'PERIOD') {
				return '.';
			}

			return templateRules.replace(match);
		}

		try {
			to = to.replace(re, replacer);
			src = src.replace(re, replacer);
		} catch (error) {
			pretty.warning(error + ' in: ' + from);

			// skip this file
			return;
		}

		var fd = fs.openSync(to, 'w', mode);
		fs.writeSync(fd, src);
		fs.closeSync(fd);
	}

	async.series([
		function (callback) {
			// prompt for information that the template engine needs
			templateRules.prepare(callback);
		},
		function (callback) {
			function tpl(filePath) {
				copy(path.join(magePath, projectTemplatePath, filePath), path.join(appPath, filePath));
			}

			function mkdir(folderPath) {
				mkdirpSync(path.join(appPath, folderPath));
			}

			var found = find(path.join(magePath, projectTemplatePath));

			found.folders.forEach(mkdir);
			found.files.forEach(tpl);

			callback();
		},
		function (callback) {
			var packageInfo = require(appPackagePath);
			var args = Object.keys(packageInfo.dependencies).filter(function (name) {
				return name !== 'mage';
			});

			if (args.length === 0) {
				return callback();
			}

			pretty.h2('Install additional project dependencies');

			args.unshift('install');

			spawn('npm', args, {
				stdio: ['ignore', process.stdout, process.stderr],
				cwd: appPath
			}).on('close', callback);
		},
		function (callback) {
			pretty.h2('Git repository');

			var gitDir;

			try {
				gitDir = fs.readdirSync(path.join(appPath, '.git'));
			} catch (e) {

			}

			if (gitDir) {
				return callback();
			}

			ask('Would you like me to set up Git for this game?', 'yes', function (answer) {
				if (answer.toLowerCase() !== 'yes') {
					return callback();
				}

				pretty.h2('Setting up git');

				var appRepoUrl = templateRules.replace('APP_REPO');

				async.series([
					// exec(cmd, args, cwd, cb)

					function (callback) {
						pretty.info('git init');

						exec('git', ['init'], null, callback);
					},
					function (callback) {
						if (!appRepoUrl) {
							return callback();
						}

						pretty.info('Adding your GitHub URL as remote "origin" ' +
							'(git remote add origin "' + appRepoUrl + '")');

						exec('git', ['remote', 'add', 'origin', appRepoUrl], null, callback);
					},
					function (callback) {
						pretty.info('Staging files for first commit (git add .)');

						exec('git', ['add', '.'], null, callback);
					},
					function (callback) {
						pretty.info('First commit (git commit)');

						var message = 'Automated first commit (by MAGE installer).';

						exec('git', ['commit', '-m', message], null, callback);
					},
					function (callback) {
						pretty.info('Creating a "develop" branch (git checkout -b develop)');

						exec('git', ['checkout', '-b', 'develop'], null, callback);
					},
					function (callback) {
						if (!appRepoUrl) {
							return callback();
						}

						ask('Would you like me to push the first commit to GitHub?', 'yes', function (answer) {
							if (answer.toLowerCase() !== 'yes') {
								return callback();
							}

							pretty.info('Pushing to remote "origin" (git push origin develop master)');

							exec('git', ['push', 'origin', 'develop', 'master'], null, callback);
						});
					}
				], callback);
			});
		},
		function (callback) {
			// For some reason, when using the --prefix flag, an etc folder is added.
			// lets remove it
			// Ref: https://github.com/npm/npm/pull/7249
			fs.rmdir(path.join(appPath, 'etc'), callback);
		},
		function (callback) {
			var msg = [
				'All done! You can now start your game in the foreground by running "npm run develop",',
				'or see startup options by running "npm run help".'
			];

			pretty.chromify(chalk.yellow(msg.join(EOL)), '❖', chalk.magenta.bold);
			callback();
		}
	], cb);
}

// start

pretty.h2('Bootstrapping MAGE v' + magePackage.version + ' application.');

bootstrap(function (error) {
	process.exit(error ? 1 : 0);
});

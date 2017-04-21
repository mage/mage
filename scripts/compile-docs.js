/**
 * This scripts starts a small docker container containing a copy of slate
 * and its dependencies (Ruby and other packages), processes the content
 * present under ./docs-source and outputs a compiled documentation under ./docs.
 *
 * At the moment, we also compile the API documentation using this code.
 */
'use strict';

const cp = require('child_process');
const glob = require('glob');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const path = require('path');

function getCurrentPath() {
	const cwd = process.cwd();

	if (process.platform === 'win32') {
		const drive = cwd[0].toLowerCase();
		const path = cwd.substring(2).replace(/\\/g, '/');

		return '/' + drive + path;
	} else {
		return cwd;
	}
}

const currentPath = getCurrentPath();
const libDocsDir = currentPath + '/docs-sources/includes/mage';

// Base arguments
let args = [
	'run',
	'--rm',
	'-v', currentPath + '/docs-sources:/app/source',
	'-v', currentPath + '/docs:/app/build'
];

// If running in a terminal...
if (process.stdout.isTTY) {
	args.push('-it');
}

// Command to execute
args = args.concat([
	'stelcheck/slate:latest',
	'bundle',
	'exec',
	'middleman',
	'build'
]);

// Append additional flags if present
args = args.concat(process.argv.slice(2));

// Core process. We duplicate the markdown files present across the project, but add an
// underscore to the basename so that Middleman (used by Slate, our documentation generator)
// may pick them up and include them if needed.
rimraf.sync(libDocsDir);
mkdirp.sync(libDocsDir);
glob('**/*.md', function (error, files) {
	if (error) {
		throw error;
	}

	files.forEach(function (file) {
		if (file.indexOf('node_modules') !== -1) {
			return;
		}

		if (file.indexOf('docs-sources') !== -1) {
			return;
		}

		const subpath = path.dirname(file);
		const filename = path.basename(file);
		const destination = path.join(libDocsDir, subpath, '_' + filename);
		const content = fs.readFileSync(file);

		mkdirp.sync(path.dirname(destination));
		fs.writeFileSync(destination, content);
	});

	const proc = cp.spawn('docker', args, {
		stdio: [process.stdin, process.stdout, process.stderr]
	});

	proc.on('error', function (error) {
		console.log('Could not start docker:', error);
		process.exit(1);
	});

	proc.on('exit', function (code) {
		rimraf.sync(libDocsDir);
		return process.exit(code);
	});
});

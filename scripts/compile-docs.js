/**
 * This scripts starts a small docker container containing a copy of slate
 * and its dependencies (Ruby and other packages), processes the content
 * present under ./docs-source and outputs a compiled documentation under ./docs.
 */
'use strict';

const cp = require('child_process');
const fs = require('fs');
const rimraf = require('rimraf');

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

const proc = cp.spawn('docker', args, {
	stdio: [process.stdin, process.stdout, process.stderr]
});

proc.on('error', function (error) {
	console.log('Could not start docker:', error);
	process.exit(1);
});

proc.on('exit', function (code) {
	rimraf.sync(currentPath + '/docs/api');
	fs.closeSync(fs.openSync(currentPath + '/docs/.nojekyll', 'w'));
	return process.exit(code);
});

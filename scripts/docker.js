/**
 * This file can be used to run MAGE tasks into a
 * Docker container. This is useful for CI, for instance.
 *
 * Usage: node docker.js [command to run and arguments]
 *
 * The following environment variables can be used:
 *
 *   * NODE_ENV: set the Node environment in the container
 *   * NODE_VERSION: select the Node.js version to run (default: 4).
 */

'use strict';

const installDeps = 'echo "Installing system dependencies..." && ' +
	'(apt-get -qq update && apt-get -qq install libzmq3-dev) > /dev/null';

const cp = require('child_process');
const nodeVersion = process.env.NODE_VERSION || '4';
const nodeEnv = process.env.NODE_ENV || 'development';
const homeDir = process.env.HOME;
const cmd = process.argv.slice(2).join(' ') || 'bash';

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
	'-w', '/mnt/app',
	'-e', 'NODE_ENV=' + nodeEnv,
	'-e', 'NPM_CONFIG_LOGLEVEL=http',
	'-v', currentPath + ':/mnt/app'
];

if (homeDir) {
	args.push('-v');
	args.push(homeDir + '/.npm:/root/.npm/');
}

// If running in a terminal...
if (process.stdout.isTTY) {
	args.push('-it');
	args.push('-p');
	args.push('8080:8080');
}

args.push('node:' + nodeVersion);
args.push('bash');
args.push('-c');

// The bash command is customised depending on
// which local platform we execute from. This
// is necessary to make sure that file user IDs
// remain consistent between the docker image and
// the local file system on mounted volumes
let bashCommand = installDeps +
	' && useradd -d /tmp';

if (process.platform === 'linux') {
	bashCommand += ' -u ' + process.getuid();
}

bashCommand += ' user && su user -c "' + cmd + '"';

args.push(bashCommand);

const proc = cp.spawn('docker', args, {
	stdio: [process.stdin, process.stdout, process.stderr]
});

proc.on('exit', function (code) {
	return process.exit(code);
});

// Command manager for daemonization

var chalk = require('chalk');
var cluster = require('cluster');
var fs = require('fs');
var net = require('net');
var readline = require('readline');
var path = require('path');
var rimraf = require('rimraf');
var xpipe = require('xpipe');

var interrupt = require('./interrupt');
var mage = require('lib/mage');


// Daemon configuration

mage.core.config.setTopLevelDefault('daemon', path.join(__dirname, 'config.yaml'));

const APP_LOCK_FILE = mage.core.config.get(['daemon', 'pidfile']);
const CMD_LOCK_FILE = './.commandpidfile';
const STDIO_PIPE_PATH = xpipe.eq('./.commandstdio');

var timeouts = mage.core.config.get(['daemon', 'timeouts']) || {};

function disableDaemonizedStdio(isCommandAppAlive) {
	if (!isCommandAppAlive) {
		return;
	}

	// Send stdio to a black hole
	function disable(io) {
		io.write = () => true;
	}

	disable(process.stdout);
	disable(process.stderr);
}

function setDaemonizedStdio(isCommandAppAlive) {
	if (!isCommandAppAlive) {
		return;
	}

	// Forward logs to the command process
	const conn = net.connect(STDIO_PIPE_PATH);

	function enable(io) {
		io.write = conn.write.bind(conn);
	}

	enable(process.stdout);
	enable(process.stderr);
}

function out(str) {
	process.stdout.write(str + '\n');
}

function err(str) {
	process.stderr.write(str + '\n');
}


// signals from commander to master:

var CMD_QUIT = 'SIGTERM';       // please shutdown
var CMD_RELOAD = 'SIGALRM';     // please reload

// signal responses from master to commander:

var RESP_PROGRESS = 'SIGCONT';  // notification of progress (need more time, be patient please)
var RESP_SUCCESS = 'SIGCHLD';   // child completed to execute the request
var RESP_FAILED = 'SIGALRM';    // error response, child failed to execute the request

// exit codes:

var EXIT_SUCCESS = 0; // All is well
var EXIT_FAILED = 1;  // Command failed to execute
var EXIT_TIMEOUT = 2; // No response from MAGE
var EXIT_LOCKED = 3;  // The daemonizer is already doing an operation

// status reports:

var STATUS_RUNNING = 0;
var STATUS_NOTRUNNING = 1;
var STATUS_DISAPPEARED = 2;


// PID file handling

function getFilePid(filename) {
	try {
		return parseInt(fs.readFileSync(filename), 10);
	} catch (e) {
		return null;
	}
}

function setFilePid(filename) {
	var pid = getFilePid(filename);

	function write() {
		fs.writeFileSync(filename, process.pid);
		return true;
	}

	if (!pid) {
		return write();
	}

	// Test if a process with that PID exists. If it doesn't, we can overwrite.
	// Else we bail out in error.

	try {
		// if there is no process with the given PID, process.kill() will throw

		process.kill(pid, 0);
	} catch (error) {
		out(chalk.yellow('Found PID file: ' + pid + ', but process is gone (continuing)'));
		return write();
	}

	return false;
}

function destroyFilePid(filename) {
	try {
		fs.unlinkSync(filename);
		return true;
	} catch (e) {
		return false;
	}
}

function getCommandAppStatus() {
	return !!getFilePid(CMD_LOCK_FILE);
}


function App(runstate, pid) {
	this.runstate = runstate;
	this.pid = pid;

	// Pipes are automatically cleaned up on windows
	if (process.platform !== 'win32') {
		rimraf.sync(STDIO_PIPE_PATH);
	}

	// received output will always be colorized;
	// therefore, we need to strip colors in cases
	// where we are not running in an environment
	// supporting them
	this.logServer = net.createServer((socket) => {
		readline.createInterface(socket).on('line', (line) => {
			if (!chalk.supportsColor) {
				line = chalk.stripColor(line);
			}

			process.stderr.write(line + '\r\n');
		});
	}).listen(STDIO_PIPE_PATH);
}


function sendSignal(app, signal, timeoutMsec, cb) {
	var timeout, sigSuccessHandler, sigProgressHandler, sigFailedHandler;

	function done(exitCode) {
		// cleanup

		clearTimeout(timeout);
		process.removeListener(RESP_SUCCESS, sigSuccessHandler);
		process.removeListener(RESP_PROGRESS, sigProgressHandler);
		process.removeListener(RESP_FAILED, sigFailedHandler);

		// return the exit code

		setImmediate(function () {
			cb(exitCode);
		});
	}

	function createTimer() {
		return setTimeout(function () {
			err(chalk.yellow.bold('Timed out.'));
			done(EXIT_TIMEOUT);
		}, timeoutMsec || 30000);
	}

	// Daemon is in progress and active, need more time
	sigProgressHandler = function () {
		clearTimeout(timeout);
		timeout = createTimer();
	};

	// Daemon is done
	sigSuccessHandler = function () {
		out(chalk.green.bold('Completed succesfully.'));
		done(EXIT_SUCCESS);
	};

	// Request failed
	sigFailedHandler = function () {
		err(chalk.red.bold('Failed.'));
		done(EXIT_FAILED);
	};

	// start waiting

	timeout = createTimer();

	process.on(RESP_PROGRESS, sigProgressHandler);
	process.on(RESP_SUCCESS, sigSuccessHandler);
	process.on(RESP_FAILED, sigFailedHandler);

	if (app && app.pid && signal) {
		try {
			process.kill(app.pid, signal);
		} catch (e) {
			err(chalk.yellow.bold('Process has gone away'));
			done(EXIT_FAILED);
		}
	}
}


function start(app, cb) {
	// Check if already started
	if (app.runstate === STATUS_RUNNING) {
		out(chalk.green.bold('Already running (pid: ' + app.pid + ')'));
		return cb(EXIT_SUCCESS);
	}

	var appName = mage.rootPackage.name;

	// copy the args, but remove the "start" or "restart" command

	var args = process.argv.slice(1).filter(function (arg) {
		return arg !== 'start' && arg !== 'restart' && arg !== 'reload';
	});

	// spawn the process

	var spawn = require('child_process').spawn;

	// We force color output on master and worker,
	// and will filter out colors in the daemonizer
	// if needed
	var child = spawn(process.execPath, args, {
		env: Object.assign({}, process.env, {
			FORCE_COLOR: 1
		}),
		detached: true,
		stdio: 'ignore'
	});

	// assign the PID to the app

	app.pid = child.pid;

	out(chalk.green.bold('Starting "' + appName + ' ' + args.join(' ') + '"... (pid: ' + child.pid + ')'));

	// wait for a signal from the child process before we continue

	sendSignal(app, null, timeouts.start, function (exitCode) {
		app.runstate = STATUS_RUNNING;
		cb(exitCode);
	});
}


function stop(app, cb) {
	if (app.runstate !== STATUS_RUNNING) {
		out(chalk.green.bold('Process is not running'));

		return cb(EXIT_SUCCESS);
	}

	out(chalk.green.bold('Stopping... (pid: ' + app.pid + ')'));

	sendSignal(app, CMD_QUIT, timeouts.stop, function (exitCode) {
		// EXIT_FAILED still means the app shut down, but there was an error during shutdown. The
		// app should have logged the error. Because the app has still shut down, we turn will
		// report a shutdown success by returning EXIT_SUCCESS.

		if (exitCode === EXIT_FAILED) {
			err(chalk.yellow.bold('Application exited in error (check logs)'));
			exitCode = EXIT_SUCCESS;
		}

		if (exitCode === EXIT_SUCCESS) {
			destroyFilePid(APP_LOCK_FILE);

			app.pid = null;
			app.runstate = STATUS_NOTRUNNING;
		}

		cb(exitCode);
	});
}


function reload(app, cb) {
	if (app.runstate !== STATUS_RUNNING || !app.pid) {
		out('Process is not yet running');
		return start(app, cb);
	}

	out(chalk.green.bold('Reloading... (pid: ' + app.pid + ')'));

	sendSignal(app, CMD_RELOAD, timeouts.reload, cb);
}


function status(app, cb) {
	switch (app.runstate) {
	case STATUS_RUNNING:
		out(chalk.green.bold('Status: Running (pid: ' + app.pid + ')'));
		break;
	case STATUS_NOTRUNNING:
		err(chalk.red.bold('Status: Not running'));
		break;
	case STATUS_DISAPPEARED:
		err(chalk.red.bold('Status: Process disappeared (pid: ' + app.pid + ')'));
		break;
	default:
		err(chalk.red.bold('Status: Undefined (pid: ' + app.pid + ')'));
		break;
	}

	// use the runstate value as exit-code

	cb(app.runstate);
}


function notifyCommander(signal) {
	var commandPid = getFilePid(CMD_LOCK_FILE);
	if (commandPid) {
		process.kill(commandPid, signal);
	}
}


function loadAppStatus() {
	// load the PID from the PID file

	var pid = getFilePid(APP_LOCK_FILE);

	if (!pid) {
		// The process is considered not to be running, since there is no known PID.

		return new App(STATUS_NOTRUNNING);
	}

	try {
		// If there is no process with the given PID, process.kill() will throw

		process.kill(pid, 0);

		return new App(STATUS_RUNNING, pid);
	} catch (e) {
		// There is no process with this PID, so we can destroy the PID file.

		destroyFilePid(APP_LOCK_FILE);

		return new App(STATUS_DISAPPEARED, pid);
	}
}


// The user is trying to run a daemonizer command. Lock daemon command execution for the duration of
// the process, and return the app's current state from APP_LOCK_FILE.

function lockAndLoad() {
	// lock command execution

	if (!setFilePid(CMD_LOCK_FILE)) {
		err(chalk.red.bold('A command is already running, aborting...'));

		process.exit(EXIT_LOCKED);

		// abort the normal code flow

		return interrupt();
	}

	process.once('exit', function () {
		// using "exit" ensures that it gets removed, even if there was an exception

		destroyFilePid(CMD_LOCK_FILE);
	});

	return loadAppStatus();
}


function exit(code) {
	process.exit(code || 0);
}


exports.start = function () {
	var app = lockAndLoad();

	start(app, exit);

	interrupt();
};


exports.stop = function () {
	var app = lockAndLoad();

	stop(app, exit);

	interrupt();
};


exports.restart = function () {
	var app = lockAndLoad();

	stop(app, function (code) {
		if (code === EXIT_SUCCESS) {
			start(app, exit);
		} else {
			exit(code);
		}
	});

	interrupt();
};


exports.reload = function () {
	var app = lockAndLoad();

	reload(app, exit);

	interrupt();
};


exports.status = function () {
	var app = lockAndLoad();

	status(app, exit);

	interrupt();
};


function removeSocketFiles() {
	var files = fs.readdirSync('.');

	for (var i = 0; i < files.length; i += 1) {
		var file = files[i];

		if (path.extname(file) === '.sock') {
			var stats = fs.lstatSync(file);

			if (stats.isSocket()) {
				out(chalk.yellow('Removing socket file: ' + file));

				fs.unlinkSync(file);
			}
		}
	}
}


// This is where MAGE really starts
// We set up some critical event listeners on the master process, so that we signal back to
// daemonizer processes to report the status of their requests.

exports.init = function () {
	var processManager = require('../processManager');
	var isCommandAppAlive = getCommandAppStatus();

	// Forward stdio to app process if daemonzied
	setDaemonizedStdio(isCommandAppAlive);

	// Disable stdout/stderr if we are starting daemonized
	processManager.once('started', () => disableDaemonizedStdio(isCommandAppAlive));

	// Upon exiting, forward exit logs if we are daemonized
	process.on(CMD_QUIT, () => {
		var isCommandAppAlive = getCommandAppStatus();
		setDaemonizedStdio(isCommandAppAlive);
	});

	// listen for workers being spawned

	// only the master of a cluster communicates with the daemon commander

	if (!cluster.isMaster) {
		return;
	}

	// lock the app (PID file)

	if (!setFilePid(APP_LOCK_FILE)) {
		err(chalk.red.bold('This application is already running, aborting...'));

		process.exit(EXIT_LOCKED);

		// abort the normal code flow

		return interrupt();
	}

	// remove .sock files that may have remained from a previous session

	try {
		removeSocketFiles();
	} catch (error) {
		err(chalk.red.bold('Error while trying to clean up .sock files:'), error);
	}

	processManager.once('started', function () {
		notifyCommander(RESP_SUCCESS);
	});

	// when the app shuts down, unlock the app (PID file)

	process.once('exit', function (exitCode) {
		destroyFilePid(APP_LOCK_FILE);
		notifyCommander(exitCode === 0 ? RESP_SUCCESS : RESP_FAILED);
	});

	// when being asked to reload (recycle workers), let the processManager know

	process.on(CMD_RELOAD, function () {
		function progress(step, total) {
			if (step < total) {
				notifyCommander(RESP_PROGRESS);
			}
		}

		var isCommandAppAlive = getCommandAppStatus();

		setDaemonizedStdio(isCommandAppAlive);

		processManager.on('recycleProgress', progress);

		processManager.reload(function (error) {
			notifyCommander(error ? RESP_FAILED : RESP_SUCCESS);
			disableDaemonizedStdio(isCommandAppAlive);
			processManager.removeListener('recycleProgress', progress);
		});
	});
};

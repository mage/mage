'use strict';

const async = require('async');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const functionArguments = require('function-arguments');

const EventEmitter = require('events').EventEmitter;
const ResponseCache = require('./responseCache').ResponseCache;
const httpBatchHandler = require('./httpBatchHandler');

let mage;
let logger;
let State;

const DEFAULT_RESPONSE_CACHE_TTL = 3 * 60;  // cache lifetime of the command response in seconds
const COMPRESSION_THRESHOLD = 4096;         // only gzip if the response is at least this many bytes uncompressed
const COMMANDS_DIR_NAME = 'usercommands';     // user command directory inside of module file space
const COMMAND_PATH_SPLITTER = '.';                // what separates the module name and command name
const CONTENT_TYPE_JSON = 'application/json; charset=UTF-8';

exports = module.exports = new EventEmitter();

class UserCommandSetupError extends Error {
	constructor(message, details) {
		super(message);
		Object.assign(this, details);
		this.name = 'UserCommandSetupError';
	}
};


// message hooks

const messageHooks = [];

exports.registerMessageHook = function (name, required, fn) {
	if (typeof name !== 'string') {
		throw new TypeError('Message hook name must be of type "string"');
	}

	if (typeof required !== 'boolean') {
		throw new TypeError('Message hook "required" argument must be of type "boolean"');
	}

	if (typeof fn !== 'function') {
		throw new TypeError('Message hook function must be of type "function"');
	}

	if (fn.length !== 4) {
		throw new TypeError('Message hook function must take 4 arguments: (state, data, batch, cb)');
	}

	messageHooks.push({ name: name, required: required, fn: fn });
};


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object}   mageInstance      A mage instance.
 * @param {Object}   mageLogger        A mage logger.
 * @param {Function} StateConstructor  The State class constructor.
 */

exports.initialize = function (mageInstance, mageLogger, StateConstructor) {
	mage = mageInstance;
	logger = mageLogger;
	State = StateConstructor;

	httpBatchHandler.setup(mageInstance, mageLogger);
};


// CommandCenter implementation

function CommandCenter(app) {
	this.app = app;
	this.exposed = false;
	this.commands = {};
	this.userCommandTimeout = null;

	let ttl;

	if (app.config && app.config.hasOwnProperty('responseCache')) {
		ttl = app.config.responseCache;
	} else {
		ttl = DEFAULT_RESPONSE_CACHE_TTL;
	}

	this.responseCache = new ResponseCache(app.name, ttl);
}

exports.CommandCenter = CommandCenter;


/**
 * Registers a user command from disk
 *
 * @throws {Error}           In the case of disk error or if user command setup failed
 * @param {string} modName   The name of the module
 * @param {string} modName   The path to the module
 * @param {string} cmdFile   The name of the file or folder containing the user command.
 */
CommandCenter.prototype.setupUserCommandFromDisk = function (modName, modPath, cmdFile) {
	const cmdPath = modPath + '/' + COMMANDS_DIR_NAME + '/' + cmdFile;
	const ext = path.extname(cmdFile);

	if (!mage.isCodeFileExtension(ext)) {
		const stats = fs.statSync(cmdPath);

		if (!stats.isDirectory()) {
			// file is not a directory, or a source file, so ignore

			return logger.verbose(cmdPath, 'is not a directory, nor a .js file (skipping)');
		}
	}

	const cmdName = path.basename(cmdFile, ext);
	const logDetails = {
		module: {
			path: cmdPath,
			name: modName,
			command: cmdName
		}
	};

	// Load user command file
	let cmd;

	try {
		cmd = require(cmdPath);  // require() may throw, which we like in this case
	} catch (requireError) {
		// Add the error stack to the details
		const stackInfo = requireError.stack.split('\n');
		stackInfo.shift();
		logDetails.module.stack = stackInfo.map(function (line) {
			return line.substring(7);
		});

		// Wrap the error
		throw new UserCommandSetupError(`Failed to load user command: ${requireError.message}`, logDetails);
	}

	this.setupUserCommand(modName, cmdName, cmd);
};


/**
 * Registers a user command
 *
 * @throws {Error}           If user command setup failed
 * @param {string} modName   The name of the registered module
 * @param {string} cmdName   The name of the user command
 * @param {Object} cmd       The full user command implementation (ie: the result of calling require(userCommandFile))
 */
CommandCenter.prototype.setupUserCommand = function (modName, cmdName, cmd) {
	const logDetails = {
		module: {
			name: modName,
			command: cmdName
		}
	};

	if (typeof modName !== 'string') {
		throw new UserCommandSetupError('Module name must be a string', logDetails);
	}

	if (typeof cmdName !== 'string') {
		throw new UserCommandSetupError('Command name must be a string', logDetails);
	}

	if (!cmd || typeof cmd !== 'object') {
		throw new UserCommandSetupError('Command must be an object', logDetails);
	}

	if (typeof cmd.execute !== 'function') {
		throw new UserCommandSetupError('Command has no "execute" function', logDetails);
	}

	// acl is optional (no one can access on undefined), however when there is one, it has to be an array.
	if (cmd.acl && !Array.isArray(cmd.acl)) {
		throw new UserCommandSetupError('acl configuration must be an array', logDetails);
	}

	// Is command async?
	const isAsync = Object.getPrototypeOf(cmd.execute)[Symbol.toStringTag] === 'AsyncFunction';

	// Legacy warning
	if (cmd.params) {
		logger.warning
			.data(logDetails)
			.log('You no longer need to specify params in your user commands');
	}

	// Parameters extraction
	const params = functionArguments(cmd.execute);
	const firstParameter = params.shift();

	// Sanity check
	if (params.length !== 0 && firstParameter !== 'state') {
		throw new UserCommandSetupError('execute()\'s first argument must be "state"', logDetails);
	}

	if (!isAsync) {
		const lastParameter = params.pop();
		if (lastParameter !== 'cb' && lastParameter !== 'callback') {
			throw new UserCommandSetupError(
				'execute() must be async or its last argument must be "cb" or "callback"',
				logDetails
			);
		}
	}

	// Register the user command
	const execPath = `${modName}${COMMAND_PATH_SPLITTER}${cmdName}`;

	logger.verbose('Exposing command', execPath);

	this.commands[execPath] = {
		execPath: execPath,
		gameModule: modName,
		cmdName: cmdName,
		cmdPathSplitter: COMMAND_PATH_SPLITTER,
		mod: cmd,
		params: params,
		isAsync: isAsync
	};
};


/**
 * Sets up a module's user commands based on its location on disk
 *
 * @throws {Error}           In the case of disk error or if user command setup failed
 * @param {string} modName   The name of the registered module
 */
CommandCenter.prototype.setupMod = function (modName) {
	const modPath = mage.getModulePath(modName);

	if (!modPath) {
		throw new Error(`Could not resolve path of module "${modName}"`);
	}

	let files;

	try {
		files = fs.readdirSync(modPath + '/' + COMMANDS_DIR_NAME);
	} catch (error) {
		if (error.code === 'ENOENT') {
			// no user commands in this module
			return;
		}

		throw error;
	}

	for (const cmdFile of files) {
		this.setupUserCommandFromDisk(modName, modPath, cmdFile);
	}
};


/**
 * Make all user commands in this command center available for execution
 *
 * @throws {Error}   If the command center instance has already been setup or if user command setup failed
 */
CommandCenter.prototype.setup = function () {
	if (this.exposed) {
		throw new Error(`The "${this.app.name}" command center has already been exposed`);
	}

	logger.verbose('Exposing commands for app:', this.app.name);

	const modNames = mage.listModules();
	for (const modName of modNames) {
		this.setupMod(modName);
	}

	logger.notice('Exposed usercommands for app:', this.app.name);

	httpBatchHandler.register(this);

	this.exposed = true;
};


/**
 * Returns the configuration for an app's client
 *
 * @param {string} baseUrl
 * @returns {Object}
 */
CommandCenter.prototype.getPublicConfig = function (baseUrl) {
	const cfg = {
		url: baseUrl + '/' + this.app.name,
		cors: mage.core.httpServer.getCorsConfig(),
		timeout: 15000,
		commands: {}
	};

	const execPaths = Object.keys(this.commands);
	for (const execPath of execPaths) {
		const cmd = this.commands[execPath];

		if (!cfg.commands[cmd.gameModule]) {
			cfg.commands[cmd.gameModule] = [];
		}

		cfg.commands[cmd.gameModule].push({
			name: cmd.cmdName,
			params: cmd.params
		});
	}

	return cfg;
};


/**
 * Serializes a single command response into a string.
 *
 * @param {Object} result              The result of the user command, including pre-serialized arguments
 * @param {string} [result.errorCode]  JSON serialized error code
 * @param {string} [result.response]   JSON serialized response value
 * @param {string[]} [result.myEvents] Array of JSON serialized events for the executing user
 * @returns {string}                   The serialized response.
 */
function serializeCommandResult(result) {
	const out = [];

	out.push(result.errorCode || 'null');
	out.push(result.response || 'null');

	if (result.myEvents && result.myEvents.length) {
		out.push('[' + result.myEvents.join(',') + ']');
	}

	return '[' + out.join(',') + ']';
}


/**
 * Checks if the given content should be compressed or not.
 *
 * @param {string}   content
 * @param {string[]} acceptedEncodings
 * @returns {boolean}
 */
function shouldCompress(content, acceptedEncodings) {
	return content.length >= COMPRESSION_THRESHOLD && acceptedEncodings.indexOf('gzip') !== -1;
}


/**
 * GZIPs a string or buffer.
 *
 * @param {string|Buffer} content
 * @param {Function} cb
 */
function compress(content, cb) {
	const startTime = process.hrtime();

	zlib.gzip(content, function (error, buf) {
		if (error) {
			logger.error('Failed to gzip command response of', content.length, 'chars:', error);
			return cb(error);
		}

		const durationRaw = process.hrtime(startTime);
		const duration = durationRaw[0] + durationRaw[1] / 1e9;

		logger.debug(
			'Gzipped command batch response of', content.length, 'chars down to',
			buf.length, 'bytes in', duration * 1000, 'msec.'
		);

		cb(null, buf);
	});
}


/**
 * Sets the execution timeout of all user commands to the given duration
 *
 * @param {number} timeout   Timeout in milliseconds
 */
CommandCenter.prototype.setUserCommandTimeout = function (timeout) {
	this.userCommandTimeout = timeout;
};

/**
 * Returns the information about the given command, or undefined if it does not exist.
 *
 * @param {string} cmdName  Name of the command
 * @returns {Object}        Command information
 */
CommandCenter.prototype.getCommandInfo = function (cmdName) {
	return this.commands[cmdName];
};

/**
 * Build the param list to pass to the user command function
 *
 * If the given params are an Object, the object will be filtered to keep only
 * the fields with the key specified in the user module.
 *
 * If the params are an Array, the missing parameters will be added with undefined as value,
 * so that the built parameter list will have the expected length.
 * If too many parameters are provided, an exception will be thrown.
 *
 * @throws {Error}                     Will throw an error if there are too many parameters provided.
 * @param {string[]} cmdInfoModParams  Parameters information from the module's user command
 * @param {Object} cmdParams           Parameter values to pass to the user command function (may be mutated)
 * @returns {mixed[]}                  Built parameter value array
 */
CommandCenter.prototype.buildParamList = function (cmdInfoModParams, cmdParams) {
	if (!Array.isArray(cmdInfoModParams)) {
		throw new TypeError('No command parameters array configured.');
	}

	if (Array.isArray(cmdParams)) {
		if (cmdParams.length > cmdInfoModParams.length) {
			throw new Error('Too many parameters provided.');
		}

		const result = cmdParams.slice();

		while (result.length < cmdInfoModParams.length) {
			result.push(undefined);
		}
		return result;
	}

	if (cmdParams && typeof cmdParams === 'object') {
		const result = [];

		for (const paramName of cmdInfoModParams) {
			result.push(cmdParams[paramName]);
		}

		return result;
	}

	throw new TypeError('Command did not receive an array or object of arguments.');
};


/**
 * Executes a single user command in isolation (ie: it will have its own State instance). Errors,
 * events and responses are serialized and returned to the callback. Before execution, the access
 * control list will be used to check for validity.
 *
 * @param {Object}   cmd        A command object.
 * @param {string}   cmd.name   The name of the command.
 * @param {Object}   cmd.params A key/value map of parameter names and their values.
 * @param {Session}  [session]  An optional Session instance.
 * @param {Object}   [metaData] Optional meta data that will be merged into state.data.
 * @param {Function} cb
 */
CommandCenter.prototype.executeCommand = function (cmd, session, metaData, cb) {
	var cmdInfo = this.getCommandInfo(cmd.name);
	if (!cmdInfo) {
		// command not registered in this command center

		logger.error('Attempt to execute unregistered user command:', cmd);

		return cb(null, { errorCode: '"server"' });
	}

	// set up state

	var state = new State();
	state.appName = this.app.name;

	if (this.userCommandTimeout) {
		state.setTimeout(this.userCommandTimeout);
	}

	state.setDescription(cmd.name);

	if (session) {
		state.registerSession(session);
	}

	if (metaData) {
		state.data = metaData;
	}

	// check if access control list grants the proper access
	if (!state.canAccess(cmdInfo.mod.acl)) {
		var errorText = 'User command access level not satisfied for command "' + cmd.name +
			'" on app "' + this.app.name + '".';

		if (cmdInfo.mod.acl) {
			errorText += ' Access level required is "' + cmdInfo.mod.acl.join('/') +
			'" but user access level is "' + state.acl.join('/') + '".';
		} else {
			errorText += ' No acl is defined, therefore no users are allowed to access this user command.';
		}

		logger.info(errorText);

		return state.error('auth', null, function () {
			// close the state and send the response

			state.close(function (closeError, response) {
				cb(null, response);
			});
		});
	}

	var that = this;

	state.archivist.createVault('client', 'client', { state: state }, function () {
		// execute the command

		logger.debug('Executing user command:', cmdInfo.execPath);

		var mod = cmdInfo.mod;

		var paramList;

		try {
			paramList = that.buildParamList(cmdInfo.params, cmd.params);
		} catch (err) {
			return cb(err);
		}

		paramList.unshift(state);

		// time the user command

		var startTime = process.hrtime();

		// function to run upon completion
		function onCommandCompleted() {
			// note: we may not expect an error parameter, the error state should now be known by the state object

			// close the state:
			// - commits and sends events to other players, or:
			// - rolls back

			state.close(function (closeError, response) {
				// use the gathered errors, response, events on the state object to build response JSON for the client
				// at this time, state.close() never returns a closeError.

				var durationRaw = process.hrtime(startTime);
				var duration = durationRaw[0] + durationRaw[1] / 1e9;

				logger.info
					.data({
						durationMsec: 1000 * duration,
						commandName: cmd.name,
						actorId: state.actorId
					})
					.log('Executed user command:', cmd.name);

				exports.emit('completed', that.app, cmd, durationRaw);

				cb(null, response);
			});
		}

		if (cmdInfo.isAsync) {
			mod.execute.apply(mod, paramList).then(function (response) {
				state.respond(response, mod.serialize === false);
			}).catch(function (error) {
				state.error(error.code, error);
			}).then(onCommandCompleted);
		} else {
			// add the final callback on the params list
			paramList.push(onCommandCompleted);

			// call the execute function of the usercommand
			mod.execute.apply(mod, paramList);
		}
	});
};

/**
 * Calls all message hooks required for a batch.
 *
 * @param {State}    state                MAGE state object.
 * @param {Object}   batch                Command batch object.
 * @param {Object}   batch.app            The app object that this batch is for (hooks can filter on app.name).
 * @param {string}   batch.rawData        The raw request data (may be useful for hashing).
 * @param {Object[]} batch.header         Array of header objects that will be passed to message hook functions.
 * @param {Object[]} batch.commands       Array of command objects { name: str, params: Object }
 * @param {string[]} batch.commandNames   Array of all command names in the batch, in order.
 * @param {Function} cb                   Callback on completion.
 */
function processBatchHeader(state, batch, cb) {
	if (messageHooks.length === 0) {
		return cb();
	}

	var hookData = {};
	for (var i = 0; i < batch.header.length; i += 1) {
		var header = batch.header[i];
		if (header.name) {
			hookData[header.name] = header;
		}
	}

	async.eachSeries(
		messageHooks,
		function (hook, cb) {
			var data = hookData[hook.name];

			if (!data) {
				// if the hook wasn't mentioned in the RPC call, and it's not required to be executed, ignore it
				if (!hook.required) {
					return cb();
				}

				data = { name: hook.name };
			}

			hook.fn(state, data, batch, cb);
		},
		function (error) {
			if (error) {
				// error while handling hooks (probably parse errors)

				return cb(error);
			}

			// some hooks may have caused mutations (eg: session touch), so distribute these first

			state.archivist.distribute(cb);
		}
	);
}


/**
 * Executes a batch of commands in series, each in their isolated environment.
 *
 * @param {string[]} acceptedEncodings  A list of compression formats that are allowed to be used.
 * @param {Object}   batch              The batch containing the header and the commands with their parameters.
 * @param {string}   [queryId]          A unique ID for this request, useful for caching.
 * @param {Object}   [metaData]         Optional meta data that will be merged into state.data.
 * @param {Function} transportCb        A callback to the transport that takes content and meta data.
 */
CommandCenter.prototype.executeBatch = function (acceptedEncodings, batch, queryId, metaData, transportCb) {
	var that = this;
	var startTime = process.hrtime();

	var state = new State();

	state.appName = this.app.name;

	exports.emit('openPostConnection', this.app);

	function cb(error, content, options) {
		state.close(function () {
			exports.emit('closePostConnection', that.app);

			transportCb(error, content, options);
		});
	}

	function duration() {
		var durationRaw = process.hrtime(startTime);
		var durationSec = durationRaw[0] + durationRaw[1] / 1e9;

		return durationSec * 1000;
	}

	// process the header

	processBatchHeader(state, batch, function (error) {
		if (error) {
			// The batch cannot be processed (parse errors, etc)
			return cb(error);
		}

		// there may be a session available now

		var session = state.session;

		var headerEvents = state.myEvents;

		// try to load a previously cached response to this query

		that.responseCache.get(state, queryId, function (error, options, content) {
			if (!error && options && content) {
				// successful cache retrieval, return instantly

				logger.warning
					.data({
						batch: batch.commandNames,
						session: session ? session.getFullKey() : null,
						durationMsec: duration(),
						options: options,
						dataSize: content.length
					})
					.log('Re-sending command response');

				return cb(null, content, options);
			}

			// start executing commands and build a serialized output response

			function respond(options, content) {
				// cache the response

				var cached = that.responseCache.set(state, queryId, options, content);

				// send the response back to the client

				cb(null, content, options);

				// log the execution time

				var msg = cached ?
					'Executed and cached user command batch' :
					'Executed user command batch (could not cache)';

				logger.debug
					.data({
						batch: batch.commandNames,
						queryId: queryId,
						durationMsec: duration(),
						options: options,
						dataSize: content.length
					})
					.log(msg);
			}

			// recursively runs each command, until done, then calls respond

			function runCommand(output, cmdIndex) {
				var cmd = batch.commands[cmdIndex];
				if (cmd) {
					return that.executeCommand(cmd, session, metaData, function (error, response) {
						if (error) {
							// should never happen
							return cb(error);
						}

						if (headerEvents && headerEvents.length) {
							response.myEvents = response.myEvents || [];
							response.myEvents = headerEvents.concat(response.myEvents);
							headerEvents = null;
						}

						output += (output ? ',' : '[') + serializeCommandResult(response);

						setImmediate(runCommand, output, cmdIndex + 1);
					});
				}

				// close the output JSON array

				output += ']';

				// turn results array into a reportable response (possibly gzipped)

				var options = {
					mimetype: CONTENT_TYPE_JSON
				};

				if (!shouldCompress(output, acceptedEncodings)) {
					return respond(options, output);
				}

				return compress(output, function (error, compressed) {
					if (error) {
						// error during compression, send the original
						respond(options, output);
					} else {
						options.encoding = 'gzip';

						respond(options, compressed);
					}
				});
			}

			runCommand('', 0);
		});
	});
};

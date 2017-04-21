var tab = require('tabalot');
var fs = require('fs');
var DEFAULT_COMPLETION_FILENAME = '.bash_completion';

/* Utility functions */
function isInCompletion() {
	return process.argv.some(function (arg) {
		return arg === 'completion';
	});
}

function isGettingCompletionScript() {
	var hasTwoDashes = process.argv.some(function (arg) {
		return arg === '--';
	});

	return isInCompletion() && !hasTwoDashes;
}

function isSavingCompletionScript() {
	var isSaving = process.argv.some(function (arg) {
		return arg === '--save';
	});
	return isSaving && isGettingCompletionScript();
}

// Gets the --bash_completion option parameter if provided,
// returns false if the option is not present.
function getBashCompletionFilename() {
	var args = process.argv;
	var l = args.length;
	for (var i = 0; i < l; i++) {
		if (args[i] === '--bash_completion' && args[i + 1]) {
			return args[i + 1];
		}
	}
	return false;
}

// Every tabalot call needs to end with a function that console logs the options
var tabScriptSuffix = function (opts) {
	console.log(opts);
	process.exit(0);
};

// Takes a commander command and run tabalot functions on it to make it "tab completable"
function tabalotScriptFromCommand(command) {
	if (command.options) {
		var options = command.options.map(function (option) {
			return option.long;
		});
		return tab(command._name)(options)(tabScriptSuffix);
	}
	tab(command._name)(tabScriptSuffix);
}

/**
 * This function will operate on argv,
 * and provide Tabalot with the necessary information to generate tab completion
 * Reason: Tabalot only provides a CLI API, but in the way we want to use it (from the Makefile),
 *   getting the necessary CLI parameters would imply parsing package.json.
 *   The application is a better fit for this.
 */
function addCompletionCommands(main, rootPath, argv) {
	if (isGettingCompletionScript()) {
		if (!main) {
			var err = 'FATAL: Tab completion cannot be installed in your project. ';
			err += 'Reason: "main" is undefined in package.json';
			console.error(err);
			process.exit(1);
		}
		argv.push('--bin', main);
		argv.push('--completion', 'node ' + rootPath + '');
	}
	if (isSavingCompletionScript()) {
		argv.push('--dir', rootPath);
	}
	return argv;
}


// Checks whether the tab completion for this project was added to the user's bash completion scripts
function isTabCompletionScriptInFile(projectRootFolder, bashCompletionFile) {
	try {
		var contents = fs.readFileSync(bashCompletionFile, { encoding: 'UTF8' });
		var expected = 'source ' + projectRootFolder + '/' + DEFAULT_COMPLETION_FILENAME;
		return (contents.indexOf(expected) !== -1);
	} catch (exception) {
		if (exception.code === 'ENOENT') {
			console.log('Missing Bash completion file. Mage will now create one.');
		}
		return false;
	}
}


function addTabCompletionToProject(projectRootFolder) {
	var bashCompletionFile = getBashCompletionFilename();

	if (!isTabCompletionScriptInFile(projectRootFolder, bashCompletionFile) && bashCompletionFile && isInCompletion) {
		var contents = '\nsource ' + projectRootFolder + '/' + DEFAULT_COMPLETION_FILENAME + '\n';
		fs.appendFileSync(bashCompletionFile, contents);
	}
}

/**
 * Runs through each option and command of a commander program
 * and then run the necessary methods to make those "tab completable"
 */
function tabifyCommands(program, argv) {
	program.options.forEach(function (option) {
		tab(option.long)(tabScriptSuffix);
	});

	program.commands.forEach(tabalotScriptFromCommand);

	tab.parse(argv.slice(2));
}


exports.tabifyCommands = tabifyCommands;
exports.addCompletionCommands = addCompletionCommands;
exports.addTabCompletionToProject = addTabCompletionToProject;
exports.isInCompletion = isInCompletion;

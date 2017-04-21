/**
 * # prettyPrinter
 *
 * libbash style formatting in node. Bash and JS are fundamentally different, so this is pretty
 * basic and you have to handle padding manually.
 *
 */

var chalk = require('chalk');
var EOL = require('os').EOL;

/**
 * Pad a string on the left with `n` spaces.
 * @param  {Number} n Number of spaces to prepend.
 * @return {String}   Padded string.
 */

function pad(n) {
	return (new Array(n || 0 + 1)).join(' ');
}

var log = console.log;
var error = console.error;


/**
 * Wrap a sting with visual chrome above and below. Automatic length.
 *
 * @param  {String}          content         A basic string to wrap. No whitespace padding needed.
 * @param  {String}          chromeChar      A character to use for the chrome.
 * @param  {String|String[]} outerColorize   A function to style the chrome with.
 */

exports.chromify = function (content, chromeChar, outerColorize) {
	var maxLength = Math.max.apply(null, content.split(EOL).map(function (subString) {
		return subString.length;
	}));

	var chrome = (new Array(maxLength + 3)).join(chromeChar);

	if (outerColorize) {
		chrome = outerColorize(chrome);
	}

	log(EOL + chrome + EOL + ' ' + content.replace(new RegExp(EOL, 'g'), EOL + ' ') + EOL + chrome + EOL + EOL);
};


/**
 * H1 heading format.
 *
 * @param {String} content Content to format and log.
 */

exports.h1 = function (content) {
	exports.chromify(chalk.bold.blue(content), '❖', chalk.blue);
};


/**
 * H2 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h2 = function (content) {
	log(chalk.blue.bold('‣ ' + content) + EOL);
};


/**
 * H3 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h3 = function (content) {
	log(chalk.blue.bold('-- ' + content) + EOL);
};


/**
 * H4 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h4 = function (content) {
	log(chalk.blue.bold('◦◦◦ ' + content) + EOL);
};


/**
 * H5 heading format.
 *
 * @param  {String} content Content to format and log.
 */

exports.h5 = function (content) {
	log(chalk.blue.bold('◘◘◘◘ ' + content) + EOL);
};


/**
 * Information format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.info = function (content, padding, specialChar) {
	var c = specialChar || '⚀';
	log(chalk.gray(pad(padding) + c + ' ' + content));
};


/**
 * Warning format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.warning = function (content, padding) {
	log(chalk.yellow.bold(pad(padding) + '⧫  ' + content));
};


/**
 * Error format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.error = function (content, padding) {
	error(chalk.red.bold(pad(padding) + '✘  ' + content));
};


/**
 * Ok format.
 *
 * @param {String} content Content to format and log.
 * @param {Number} padding Spaces to pad from the left margin.
 */

exports.ok = function (content, padding) {
	log(chalk.green.bold(pad(padding) + '✔  ' + content));
};

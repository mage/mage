var daemon = require('../daemon');

exports.start = function (mage, options) {
	// log real issues to terminal only

	mage.core.loggingService.addWriter('terminal', ['>=warning'], {});

	// get the daemonizer command function

	var fn = daemon[options.command];

	if (!fn) {
		throw new Error('There is no daemonizer command called "' + options.command + '"');
	}

	// call it

	fn.call(daemon);
};

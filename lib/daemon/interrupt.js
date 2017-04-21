function SilentCodeInterruption() {}


module.exports = function interrupt() {
	var listeners = process.listeners('uncaughtException');

	function exceptionHandler() {
		// ignore the SilentCodeInterruption and restore the listeners

		for (var i = 0, len = listeners.length; i < len; i++) {
			process.on('uncaughtException', listeners[i]);
		}
	}

	// remove all listeners temporarily

	process.removeAllListeners('uncaughtException');

	// throw and catch the uncaught silent exception, thereby interrupting the code flow

	process.once('uncaughtException', exceptionHandler);

	throw new SilentCodeInterruption();
};

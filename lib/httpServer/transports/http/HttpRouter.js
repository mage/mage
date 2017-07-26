const resolve = require('path').posix.resolve;

function HttpRouter(types) {
	this.types = types;
	this.exact = {};
	this.re = [];
}

module.exports = HttpRouter;


HttpRouter.prototype.get = function (path) {
	if (!path) {
		return;
	}

	// Clean up the received path

	path = resolve(path);

	// find a handler that was registered to this exact route

	var route = this.exact[path];
	if (route) {
		return route;
	}

	// if no exact route handler found, try the regexp registered routes

	for (var i = 0, len = this.re.length; i < len; i++) {
		if (path.match(this.re[i].matcher)) {
			return this.re[i];
		}
	}
};


HttpRouter.prototype.add = function (pathMatch, fn, type) {
	if (this.types.indexOf(type) === -1) {
		throw new Error('Route type must be of ' + this.types.join(', ') + '. Instead received: ' + type);
	}

	if (typeof fn !== 'function') {
		throw new TypeError('Route handler must be a function');
	}

	// pathMatch is a regexp or string to match on
	// register it as the route

	if (typeof pathMatch === 'string') {
		// add a starting slash

		if (pathMatch[0] !== '/') {
			pathMatch = '/' + pathMatch;
		}

		// strip the final slash

		if (pathMatch.substr(-1) === '/') {
			pathMatch = pathMatch.slice(0, -1);
		}

		this.exact[pathMatch] = { matcher: pathMatch, handler: fn, type: type };
	} else if (pathMatch instanceof RegExp) {
		// remove it if it already exists

		this.del(pathMatch);

		// register the route

		this.re.push({ matcher: pathMatch, handler: fn, type: type });
	} else {
		throw new TypeError('Invalid path matcher: ' + pathMatch);
	}
};


HttpRouter.prototype.del = function (pathMatch) {
	if (typeof pathMatch === 'string') {
		// add a starting slash

		if (pathMatch[0] !== '/') {
			pathMatch = '/' + pathMatch;
		}

		// strip the final slash

		if (pathMatch.substr(-1) === '/') {
			pathMatch = pathMatch.slice(0, -1);
		}

		delete this.exact[pathMatch];
	} else if (pathMatch instanceof RegExp) {
		pathMatch = '' + pathMatch;

		this.re = this.re.filter(function (re) {
			return '' + re.matcher !== pathMatch;
		});
	} else {
		throw new TypeError('Invalid path matcher: ' + pathMatch);
	}
};

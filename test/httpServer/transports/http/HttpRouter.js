var assert = require('assert');

describe('HttpRouter', function () {
	var HttpRouter = require('lib/httpServer/transports/http/HttpRouter');
	var router = new HttpRouter();

	it('get returns undefined if it receives no path as parameter', function () {
		assert.strictEqual(router.get(), undefined);
	});
});

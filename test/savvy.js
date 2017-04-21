var assert = require('assert');
var httpServer = require('../lib/httpServer/transports/http');
var savvy = require('../lib/savvy');

describe('Savvy', function () {
	var route = /^\/savvy\/test/;

	it('only accepts routes inside the Savvy namespace', function () {
		assert.throws(function () {
			savvy.addRoute('/hello/world', function () {}, 'simple');
		});

		assert.throws(function () {
			savvy.addRoute(/^hello/, function () {}, 'simple');
		});

		savvy.addRoute(route, function () {}, 'simple');
		httpServer.delRoute(route);
	});

	it('exposes itself correctly', function () {
		assert.equal(savvy.getRoute(), '/savvy');
	});
});

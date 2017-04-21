var assert = require('assert');
var engine = require('lib/serviceDiscovery/engines/single');

describe('single engine', function () {
	describe('SingleService()', function () {
		it('default constructor', function (done) {
			var options = { a: 1, b: 2 };
			var serviceDiscovery = engine.create('name', 'type', options);

			assert.strictEqual(serviceDiscovery.name, 'name');
			assert.strictEqual(serviceDiscovery.type, 'type');
			assert.deepEqual(serviceDiscovery.options, options);
			assert.deepEqual(serviceDiscovery.services, {});
			assert.strictEqual(serviceDiscovery.isBrowsing, false);

			done();
		});
	});

	describe('discover()', function () {
		it('change the browsing status', function (done) {
			var serviceDiscovery = engine.create('name', 'type', {});
			serviceDiscovery.discover();
			assert.strictEqual(serviceDiscovery.isBrowsing, true);
			done();
		});

		it('emit the up events if services were already announced', function (done) {
			var serviceDiscovery = engine.create('name', 'type', {});

			serviceDiscovery.on('up', function (service) {
				assert.strictEqual(service.port, 1234);
				done();
			});

			serviceDiscovery.announce(1234, {}, function () {
				serviceDiscovery.discover();
			});
		});
	});

	describe('announce()', function () {
		it('register service', function (done) {
			var serviceDiscovery = engine.create('name', 'type', {});
			serviceDiscovery.announce(1234, {}, function () {
				assert.deepEqual(serviceDiscovery.services, {
					1234: {
						host: 'localhost',
						port: 1234,
						addresses: [
							'127.0.0.1',
							'::1'
						],
						data: {}
					}
				});
				done();
			});
		});

		it('announce service if browsing is enabled', function (done) {
			var serviceDiscovery = engine.create('name', 'type', {});
			serviceDiscovery.discover();

			serviceDiscovery.on('up', function (service) {
				assert.deepEqual(service, {
					host: 'localhost',
					port: 1234,
					addresses: [
						'127.0.0.1',
						'::1'
					],
					data: {}
				});
				done();
			});

			serviceDiscovery.announce(1234, {}, function () { });
		});
	});
});

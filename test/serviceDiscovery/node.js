var assert = require('assert');
var ServiceNode = require('lib/serviceDiscovery/node').ServiceNode;

describe('ServiceNode', function () {
	describe('Constructor', function () {
		it('should accept all the arguments', function (done) {
			var host = 'test.local';
			var port = '5678';
			var addresses = [
				'1.2.3.4'
			];
			var metadata = {
				pid: 1234,
				game: 'test',
				version: '5.6.7'
			};
			var service = new ServiceNode(host, port, addresses, metadata);
			assert.strictEqual(service.host, host);
			assert.strictEqual(service.port, port);
			assert.deepEqual(service.addresses, addresses);
			assert.deepEqual(service.data, metadata);
			done();
		});

		it('should build the default value for optional argument', function (done) {
			var host = 'test.local';
			var port = '5678';
			var addresses = [
				'1.2.3.4'
			];
			var service = new ServiceNode(host, port, addresses);
			assert.strictEqual(service.host, host);
			assert.strictEqual(service.port, port);
			assert.deepEqual(service.addresses, addresses);
			assert.deepEqual(service.data, {});
			done();
		});
	});

	describe('getIp()', function () {
		it('should return null if there is no address', function (done) {
			var service = new ServiceNode(null, null, []);
			var ip = service.getIp();
			assert.strictEqual(ip, null);
			done();
		});

		it('should return the IP in the specified version', function (done) {
			var service = new ServiceNode(null, null, [
				'127.0.0.1',
				'::1'
			]);
			var ip = service.getIp(4);
			assert.strictEqual(ip, '127.0.0.1');
			ip = service.getIp(6);
			assert.strictEqual(ip, '::1');
			done();
		});

		it('should filter the address list with the given network list', function (done) {
			var service, ip;
			var network = [
				'10.0.0.0/8',
				'172.16.0.0/12',
				'192.168.0.0/16',
				'127.0.0.0/8'
			];

			service = new ServiceNode(null, null, [
				'1.2.3.4',
				'5.6.7.8',
				'10.20.30.40',
				'::1'
			]);
			ip = service.getIp(4, network);
			assert.strictEqual(ip, '10.20.30.40');

			service = new ServiceNode(null, null, [
				'1.2.3.4',
				'5.6.7.8',
				'172.16.32.64',
				'::1'
			]);
			ip = service.getIp(4, network);
			assert.strictEqual(ip, '172.16.32.64');

			service = new ServiceNode(null, null, [
				'1.2.3.4',
				'5.6.7.8',
				'192.168.144.120',
				'::1'
			]);
			ip = service.getIp(4, network);
			assert.strictEqual(ip, '192.168.144.120');

			service = new ServiceNode(null, null, [
				'1.2.3.4',
				'5.6.7.8',
				'127.0.0.1',
				'::1'
			]);
			ip = service.getIp(4, network);
			assert.strictEqual(ip, '127.0.0.1');

			done();
		});
	});
});

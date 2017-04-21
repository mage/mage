var assert = require('assert');

describe('parseBinding', function () {
	var parse = require('lib/httpServer/parseBinding.js');

	it('should parse URIs', function () {
		var parsed;

		parsed = parse('unix:/foo/server.sock');
		assert.deepEqual(parsed, { file: 'foo/server.sock' });

		parsed = parse('http://unix:/foo/server.sock');
		assert.deepEqual(parsed, { file: 'foo/server.sock' });

		parsed = parse('http://0.0.0.0:0');
		assert.deepEqual(parsed, { host: '0.0.0.0', port: 0 });

		parsed = parse('tcp://127.0.0.1:8080');
		assert.deepEqual(parsed, { host: '127.0.0.1', port: 8080 });

		assert.throws(function () {
			parse('foo://0.0.0.0:0');
		});
	});

	it('should parse objects', function () {
		var parsed;

		parsed = parse({ file: 'foo/server.sock' });
		assert.deepEqual(parsed, { file: 'foo/server.sock' });

		parsed = parse({ host: '0.0.0.0', port: '0' });
		assert.deepEqual(parsed, { host: '0.0.0.0', port: 0 });

		assert.throws(function () {
			parse({});
		});
	});
});

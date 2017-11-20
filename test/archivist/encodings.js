const assert = require('assert');

describe('Encoding', function () {
	const encoders = require('../../lib/archivist/encoders');

	describe('can guess an encoding', function () {
		it('"hello" -> utf8', function () {
			assert.equal(encoders.guessEncoding('hello world'), 'utf8');
		});

		it('"foo" in a Buffer -> buffer', function () {
			assert.equal(encoders.guessEncoding(new Buffer('foo')), 'buffer');
		});

		it('plain JS object -> live', function () {
			assert.equal(encoders.guessEncoding({ a: 'b' }), 'live');
		});
	});

	describe('can do simple conversion between encodings', function () {
		const mediaType = 'some/dummy';

		function enc(from, to, data) {
			const encoder = encoders.getEncoder(mediaType, from, to);
			return encoder(data);
		}

		it('utf8 -> buffer', function () {
			assert.deepStrictEqual(enc('utf8', 'buffer', 'こんにちは'), new Buffer('こんにちは'));
		});

		it('base64 -> buffer', function () {
			assert.deepStrictEqual(enc('base64', 'buffer', 'aGVsbG8='), new Buffer('hello'));
		});

		it('buffer -> base64', function () {
			assert.deepStrictEqual(enc('buffer', 'base64', new Buffer('hello')), 'aGVsbG8=');
		});

		it('buffer -> utf8', function () {
			assert.deepStrictEqual(enc('buffer', 'utf8', new Buffer('hello')), 'hello');
		});

		it('utf8 -> base64', function () {
			assert.deepStrictEqual(enc('utf8', 'base64', 'hello'), 'aGVsbG8=');
		});

		it('base64 -> utf8', function () {
			assert.deepStrictEqual(enc('base64', 'utf8', 'aGVsbG8='), 'hello');
		});
	});
});

var assert = require('assert');
var Matryoshka = require('../lib/config/Matryoshka');

// A shallow array comparison.
function compareArrays(a, b) {
	assert.strictEqual(a.length, b.length);

	for (var i = 0; i < a.length; i++) {
		assert.strictEqual(a[i], b[i]);
	}
}

describe('A matryoshka instance', function () {
	it('should be constructable.', function (done) {
		var matryoshka = new Matryoshka();

		assert(matryoshka instanceof Matryoshka);
		done();
	});

	it('should wrap anything.', function (done) {
		var a = new Matryoshka();
		var b = new Matryoshka(null);
		var c = new Matryoshka(true);
		var d = new Matryoshka(1);
		var e = new Matryoshka('hi');
		var f = new Matryoshka([0, 2, 100]);
		var g = new Matryoshka({ hello: 'world' });

		// Basic value types.
		assert.strictEqual(a.getValue(), undefined);
		assert.strictEqual(b.getValue(), null);
		assert.strictEqual(c.getValue(), true);
		assert.strictEqual(d.getValue(), 1);
		assert.strictEqual(e.getValue(), 'hi');

		// Shallow compare arrays.
		compareArrays(f.getValue(), [0, 2, 100]);

		// Matryoshka nest.
		assert(g.getValue().hello instanceof Matryoshka);

		// The base values should still be values.
		assert.strictEqual(g.getValue().hello.getValue(), 'world');

		done();
	});

	it('can have a source.', function (done) {
		var source = 'right here';
		var matryoshka = new Matryoshka('test', source);

		assert.strictEqual(matryoshka.getSource(), source);
		done();
	});

	it('should treat arrays as values.', function (done) {
		var value = ['I am an array', 10, true, null];
		var matryoshka = new Matryoshka(value);

		// If the array is stored like a value, then the reference should be retained.
		assert.strictEqual(matryoshka.getValue(), value);

		// Copies should NOT be a reference to the original array.
		assert.notStrictEqual(matryoshka.copy().getValue(), value);
		done();
	});

	it('should nest objects.', function (done) {
		var value = {
			a: {
				b: 'stuff'
			},
			b: {
				c: 'something else'
			},
			d: ['a', 'gratuitous', 'array']
		};

		var matryoshka = new Matryoshka(value);

		assert(matryoshka.getValue().a instanceof Matryoshka);
		assert(matryoshka.getValue().b instanceof Matryoshka);
		assert(!(matryoshka.getValue().c instanceof Matryoshka));
		assert.strictEqual(matryoshka.getValue().a.getValue().b.getValue(), value.a.b);
		assert.strictEqual(matryoshka.getValue().b.getValue().c.getValue(), value.b.c);
		assert.strictEqual(matryoshka.getValue().d.getValue(), value.d);

		done();
	});

	it('should return a copy of the original value when getRaw() is used.', function (done) {
		var value = {
			a: {
				b: 'stuff'
			},
			b: {
				c: 'something else'
			},
			d: ['a', 'gratuitous', 'array']
		};

		var matryoshka = new Matryoshka(value);
		var raw = matryoshka.getRaw();

		assert.notStrictEqual(value, raw); // The reference to the original object is not preserved.
		assert.strictEqual(value.a.b, raw.a.b);
		assert.strictEqual(value.b.c, raw.b.c);
		assert.strictEqual(value.d, raw.d); // References are preserved.

		done();
	});

	it('merging two objects preserves the source of the first, values of the second overwrite.', function (done) {
		var a = { key: 'a' };
		var b = { key: 'b' };

		var mA = new Matryoshka(a, 'first source');
		var mB = new Matryoshka(b, 'second source');

		var mC = Matryoshka.merge(mA, mB);

		assert.strictEqual(mC.getSource(), mA.getSource());
		assert.strictEqual(mC.getValue().key.getValue(), mB.getValue().key.getValue());

		done();
	});

	it('merging two scalars should preserve the source and value of the second.', function (done) {
		var a = 'hello';
		var b = 'world';

		var mA = new Matryoshka(a, 'first source');
		var mB = new Matryoshka(b, 'second source');

		var mC = Matryoshka.merge(mA, mB);

		assert.strictEqual(mC.getSource(), mB.getSource());
		assert.strictEqual(mC.getValue(), mB.getValue());

		done();
	});

	it('merging two objects should produce a union if the keys are mutually exclusive.', function (done) {
		var a = { hello: true };
		var b = { world: true };

		var mA = new Matryoshka(a);
		var mB = new Matryoshka(b);

		var mC = Matryoshka.merge(mA, mB);

		assert(mC.getValue().hello.getValue());
		assert(mC.getValue().world.getValue());

		done();
	});
});

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

	it('should handle calls without new.', function (done) {
		var matryoshka = Matryoshka(); // eslint-disable-line new-cap

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

	it('can tell you the type of a matryoshka (arrays are scalars too).', () => {
		var a = new Matryoshka();
		var b = new Matryoshka(null);
		var c = new Matryoshka(true);
		var d = new Matryoshka(1);
		var e = new Matryoshka('hi');
		var f = new Matryoshka([0, 2, 100]);
		var g = new Matryoshka({ hello: 'world' });

		// Basic value types.
		assert.strictEqual(a.getType(), 'scalar');
		assert.strictEqual(b.getType(), 'scalar');
		assert.strictEqual(c.getType(), 'scalar');
		assert.strictEqual(d.getType(), 'scalar');
		assert.strictEqual(e.getType(), 'scalar');
		assert.strictEqual(f.getType(), 'scalar');
		assert.strictEqual(g.getType(), 'object');
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

	it('attempting to tunnel with a non-array throws an error.', function (done) {
		var m = new Matryoshka();

		assert.throws(
			function () {
				m.tunnel('blah');
			},
			/Addressing must be done with an array of strings/
		);

		done();
	});

	it('attempting to tunnel with non-string elements throws an error.', function (done) {
		var m = new Matryoshka({ hello: 'world' });

		assert.throws(
			function () {
				m.tunnel([1234]);
			},
			/Path segment was not a string: 1234/
		);

		done();
	});

	it('should return undefined when the tunnel goes past the end of a matryoshka', function () {
		var m = new Matryoshka({ hello: 'world', bye: null });
		var t1 = m.tunnel(['hello', 'there']);
		var t2 = m.tunnel(['bye', 'you']);

		assert.strictEqual(t1, undefined);
		assert.strictEqual(t2, undefined);
	});

	it('should return a new matryoshka representing the endpoint of a tunnel path', function () {
		var m = new Matryoshka({ a: { b: { c: 'blah', d: ['an', 'array', '!'] } } });
		var t = m.tunnel(['a', 'b']);

		assert.ok(t instanceof Matryoshka);
		assert.deepEqual(t.getRaw(), { c: 'blah', d: ['an', 'array', '!'] });
	});

	it('can be used to tell you where config originates from', function (done) {
		var mA = new Matryoshka({ a: 'hello' }, 'first source');
		var mB = new Matryoshka({ b: 'world' }, 'second source');
		var mC = Matryoshka.merge(mA, mB);

		assert.equal(mC.getSourceWithPath(['a']), 'first source');
		assert.equal(mC.getSourceWithPath(['b']), 'second source');

		done();
	});

	it('can be used to give you a list of sources where config originates from', function (done) {
		var mA = new Matryoshka({ c: { a: 'hello' } }, 'first source');
		var mB = new Matryoshka({ c: { b: 'world' } }, 'second source');
		var mC = new Matryoshka({ d: { e: 'something else' } }, 'third source');

		var merged = Matryoshka.merge(mA, mB, mC);

		assert.deepEqual(merged.getAllSourcesWithPath(['c']).sort(), ['first source', 'second source']);

		done();
	});

	it('returns undefined as the source of paths that go nowhere', function (done) {
		var m = new Matryoshka({ a: 'hello' });

		assert.strictEqual(m.getSourceWithPath(['a', 'b']), undefined);
		assert.deepEqual(m.getAllSourcesWithPath(['a', 'b']), []);

		done();
	});

	it('merging throws when an arguments is not a matryoshka', function (done) {
		assert.throws(
			function () {
				Matryoshka.merge(new Matryoshka({ a: 'hello' }), {});
			},
			/Arguments must be matryoshka instances./
		);

		done();
	});

	it('merging throws when no arguments are given', function (done) {
		assert.throws(
			function () {
				Matryoshka.merge();
			},
			/Merge takes at least one Matryoshka instance./
		);

		done();
	});

	it('merging picks the second of two matryoshka in type conflicts', function (done) {
		var mA = new Matryoshka({ b: { a: 'hello' } }, 'first source');
		var mB = new Matryoshka({ b: ['an', 'array'] }, 'second source');

		var merged = Matryoshka.merge(mA, mB);

		assert.deepEqual(merged.getRaw(), { b: ['an', 'array'] });

		done();
	});
});

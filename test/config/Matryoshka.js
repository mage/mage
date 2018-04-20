'use strict';

const assert = require('assert');
const Matryoshka = require('lib/config/Matryoshka');

describe('Matryoshka', () => {
	it('should be constructable.', () => {
		assert(new Matryoshka() instanceof Matryoshka);
	});

	describe('getValue', () => {
		it('returns the wrapped value for primitive types.', () => {
			const a = new Matryoshka();
			const b = new Matryoshka(null);
			const c = new Matryoshka(true);
			const d = new Matryoshka(1);
			const e = new Matryoshka('hi');

			assert.strictEqual(a.getValue(), undefined);
			assert.strictEqual(b.getValue(), null);
			assert.strictEqual(c.getValue(), true);
			assert.strictEqual(d.getValue(), 1);
			assert.strictEqual(e.getValue(), 'hi');
		});

		it('returns the wrapped value by reference for arrays.', () => {
			const value = [0, 2, 100];
			const m = new Matryoshka(value);

			assert.equal(m.getValue(), value);
		});

		it('returns nested matryoshka for objects.', () => {
			const value = {
				a: {
					b: 'stuff'
				},
				b: {
					c: 'something else'
				},
				d: ['a', 'gratuitous', 'array']
			};

			const m = new Matryoshka(value);

			assert(m.getValue().a instanceof Matryoshka);
			assert(m.getValue().b instanceof Matryoshka);
			assert(!(m.getValue().c instanceof Matryoshka));
			assert.equal(m.getValue().a.getValue().b.getValue(), value.a.b);
			assert.equal(m.getValue().b.getValue().c.getValue(), value.b.c);
			assert.equal(m.getValue().d.getValue(), value.d);
		});
	});

	describe('getType', () => {
		it('returns "scalar" for primitive types.', () => {
			const a = new Matryoshka();
			const b = new Matryoshka(null);
			const c = new Matryoshka(true);
			const d = new Matryoshka(1);
			const e = new Matryoshka('hi');

			assert.equal(a.getType(), 'scalar');
			assert.equal(b.getType(), 'scalar');
			assert.equal(c.getType(), 'scalar');
			assert.equal(d.getType(), 'scalar');
			assert.equal(e.getType(), 'scalar');
		});

		it('returns "scalar" for arrays.', () => {
			const m = new Matryoshka([0, 2, 100]);

			assert.equal(m.getType(), 'scalar');
		});

		it('returns "object" for objects.', () => {
			const m = new Matryoshka({ hello: 'world' });

			assert.equal(m.getType(), 'object');
		});
	});

	describe('getSource', () => {
		it('returns undefined when a Matryoshka is defined without a source.', () => {
			const m = new Matryoshka('test');

			assert.strictEqual(m.getSource(), undefined);
		});

		it('returns the source when a Matryoshka is defined with one.', () => {
			const m = new Matryoshka('test', 'the source');

			assert.strictEqual(m.getSource(), 'the source');
		});

		it('merging two objects preserves the source of the first, values of the second overwrite.', () => {
			const a = { key: 'a' };
			const b = { key: 'b' };

			const mA = new Matryoshka(a, 'first source');
			const mB = new Matryoshka(b, 'second source');

			const mC = Matryoshka.merge(mA, mB);

			assert.strictEqual(mC.getSource(), mA.getSource());
			assert.strictEqual(mC.getValue().key.getValue(), mB.getValue().key.getValue());
		});
	});

	describe('getSourceWithPath', () => {
		it('gets the source of the value at a given path.', () => {
			const mA = new Matryoshka({ a: 'hello' }, 'first source');
			const mB = new Matryoshka({ b: 'world' }, 'second source');
			const mC = Matryoshka.merge(mA, mB);

			assert.equal(mC.getSourceWithPath(['a']), 'first source');
			assert.equal(mC.getSourceWithPath(['b']), 'second source');
		});

		it('returns undefined as the source of paths that go nowhere', () => {
			const m = new Matryoshka({ a: 'hello' });

			assert.strictEqual(m.getSourceWithPath(['a', 'b']), undefined);
		});
	});

	describe('getAllSourcesWithPath', () => {
		it('can be used to give you a list of sources for a value at a given path', () => {
			const mA = new Matryoshka({ c: { a: 'hello' } }, 'first source');
			const mB = new Matryoshka({ c: { b: 'world' } }, 'second source');
			const mC = new Matryoshka({ d: { e: 'something else' } }, 'third source');

			const merged = Matryoshka.merge(mA, mB, mC);

			assert.deepEqual(merged.getAllSourcesWithPath(['c']).sort(), ['first source', 'second source']);
		});

		it('returns an empty array as the sources of a path that goes nowhere', () => {
			const m = new Matryoshka({ a: 'hello' });

			assert.deepEqual(m.getAllSourcesWithPath(['a', 'b']), []);
		});
	});

	describe('tunnel', () => {
		it('throws an error when attempting to tunnel with a non-array.', () => {
			const m = new Matryoshka();

			assert.throws(
				() => m.tunnel('blah'),
				/Addressing must be done with an array of strings/
			);
		});

		it('throws an error when attempting to tunnel with non-string elements.', () => {
			const m = new Matryoshka({ hello: 'world' });

			assert.throws(
				() => m.tunnel([1234]),
				/Path segment was not a string: 1234/
			);
		});

		it('returns undefined when the tunnel goes past the end of a matryoshka', () => {
			const m = new Matryoshka({ hello: 'world', bye: null });
			const t1 = m.tunnel(['hello', 'there']);
			const t2 = m.tunnel(['bye', 'you']);

			assert.strictEqual(t1, undefined);
			assert.strictEqual(t2, undefined);
		});

		it('returns a new matryoshka representing the endpoint of a tunnel path', () => {
			const m = new Matryoshka({ a: { b: { c: 'blah', d: ['an', 'array', '!'] } } });
			const t = m.tunnel(['a', 'b']);

			assert.ok(t instanceof Matryoshka);
			assert.deepEqual(t.getRaw(), { c: 'blah', d: ['an', 'array', '!'] });
		});
	});

	describe('copy', () => {
		it('treats arrays as values.', () => {
			const value = ['I am an array', 10, true, null];
			const matryoshka = new Matryoshka(value);

			// Copies should NOT be a reference to the original array.
			assert.notEqual(matryoshka.copy().getValue(), value);
			assert.deepStrictEqual(matryoshka.copy().getValue(), value);
		});
	});

	describe('getRaw', () => {
		it('returns a copy of the original value.', () => {
			const value = {
				a: {
					b: 'stuff'
				},
				b: {
					c: 'something else'
				},
				d: ['a', 'gratuitous', 'array']
			};

			const matryoshka = new Matryoshka(value);
			const raw = matryoshka.getRaw();

			assert.notEqual(value, raw); // The reference to the original object is not preserved.
			assert.equal(value.a.b, raw.a.b);
			assert.equal(value.b.c, raw.b.c);
			assert.equal(value.d, raw.d); // References are preserved.
		});
	});

	describe('merge (static)', () => {
		it('preserve the source and value of the second of two scalars.', () => {
			const a = 'hello';
			const b = 'world';

			const mA = new Matryoshka(a, 'first source');
			const mB = new Matryoshka(b, 'second source');

			const mC = Matryoshka.merge(mA, mB);

			assert.strictEqual(mC.getSource(), mB.getSource());
			assert.strictEqual(mC.getValue(), mB.getValue());
		});

		it('produces a union of two objects when the keys are mutually exclusive.', () => {
			const a = { hello: true };
			const b = { world: true };

			const mA = new Matryoshka(a);
			const mB = new Matryoshka(b);

			const mC = Matryoshka.merge(mA, mB);

			assert(mC.getValue().hello.getValue());
			assert(mC.getValue().world.getValue());
		});

		it('throws when an argument is not a matryoshka.', () => {
			assert.throws(
				() => Matryoshka.merge(new Matryoshka({ a: 'hello' }), {}),
				/Arguments must be matryoshka instances./
			);
		});

		it('throws when no arguments are given.', () => {
			assert.throws(
				() => Matryoshka.merge(),
				/Merge takes at least one Matryoshka instance./
			);
		});

		it('picks the second of two matryoshka in type conflicts.', () => {
			const mA = new Matryoshka({ b: { a: 'hello' } }, 'first source');
			const mB = new Matryoshka({ b: ['an', 'array'] }, 'second source');

			const merged = Matryoshka.merge(mA, mB);

			assert.deepEqual(merged.getRaw(), { b: ['an', 'array'] });
		});

		describe('null config', function () {
			const a = {
				some: {
					test: null
				}
			};
			const b = {
				some: {
					test: {
						value: 5
					}
				}
			};

			it('overrides null config A with config B from B to A', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mA, mB);

				assert.deepEqual(mC, mB);
			});

			it('overrides null config A with config B from A to B', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mB, mA);

				assert.deepEqual(mC, mB);
			});
		});

		describe('false config', function () {
			const a = {
				some: false
			};
			const b = {
				some: {
					test: {
						value: 5
					}
				}
			};

			it('does not override config B with false config A from B to A', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mA, mB);

				assert.deepEqual(mC, mB);
			});

			it('overrides config B with false config A from A to B', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mB, mA);

				assert.deepEqual(mC, mA);
			});
		});

		describe('undefined config', function () {
			const a = {
				some: {
					test: undefined
				}
			};
			const b = {
				some: {
					test: {
						value: 5
					}
				}
			};

			it('overrides config B with undefined config A from A to B', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mB, mA);

				assert.deepEqual(mC, mA);
			});

			it('does not override config B with undefined config A from B to A', function () {
				const mA = new Matryoshka(a);
				const mB = new Matryoshka(b);

				const mC = Matryoshka.merge(mA, mB);

				assert.deepEqual(mC, mB);
			});
		});
	});
});

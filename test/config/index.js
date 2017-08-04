'use strict';

const assert = require('assert');
const config = require('lib/config');
const Matryoshka = require('lib/config/Matryoshka');

const BASE_VALUE = 10;

function getConfigObject(name) {
	return {
		some: {
			test: {
				[name]: BASE_VALUE
			}
		}
	};
}

describe('config', function () {
	// Matryoshka-specific tests
	require('./Matryoshka');

	describe('set', function () {
		let oldConfigList;

		// Store the old config list so we may restore it after the tests
		before(() => oldConfigList = config.getConfigList());

		// Set a new config lists
		beforeEach(() => config.setConfigList([
			new Matryoshka(getConfigObject('valueOne'), 'module'), // base, module configs
			new Matryoshka(getConfigObject('valueTwo'), 'default'), // default
			new Matryoshka(getConfigObject('valueThree'), 'environment'), // config file(s) (NODE_ENV)
			new Matryoshka(getConfigObject('valueFour'), 'runtime') // Runtime configuration
		]));

		// Reset the old config list once the tests are completed
		after(() => config.setConfigList(oldConfigList));

		it('Overrides a module configuration', function () {
			assert.equal(config.get('some.test.valueOne'), BASE_VALUE);
			config.set('some.test.valueOne', 1);
			assert.equal(config.get('some.test.valueOne'), 1);
		});

		it('Overrides default configuration', function () {
			assert.equal(config.get('some.test.valueTwo'), BASE_VALUE);
			config.set('some.test.valueTwo', 2);
			assert.equal(config.get('some.test.valueTwo'), 2);
		});

		it('Overrides file configuration', function () {
			assert.equal(config.get('some.test.valueThree'), BASE_VALUE);
			config.set('some.test.valueThree', 3);
			assert.equal(config.get('some.test.valueThree'), 3);
		});

		it('Can reset a dynamic configuration value', function () {
			assert.equal(config.get('some.test.valueFour'), BASE_VALUE);
			config.set('some.test.valueFour', 4);
			assert.equal(config.get('some.test.valueFour'), 4);
		});

		it('Setting an object value will also set sub-attributes', function () {
			assert.equal(config.get('some.test.valueFour'), BASE_VALUE);
			config.set('some.test', {
				valueFour: 4
			});
			assert.equal(config.get('some.test.valueFour'), 4);
		});
	});
});

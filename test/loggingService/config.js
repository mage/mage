'use strict';

const path = require('path');

const assert = require('assert');
const sinon = require('sinon');

const deepCopy = require('wizcorp-deep-copy.js');
const loggingService = require('lib/loggingService');
const Distributor = require('lib/loggingService/Distributor');
const config = require('lib/config');
const Matryoshka = require('lib/config/Matryoshka');

const defaultConfig = {
	html5: {
		console: {
			channels: '>=debug'
		},
		server: {
			channels: ['>=error']
		}
	},
	server: {
		terminal: {
			channels: '>=debug',
			config: {
				theme: 'default'
			}
		}
	}
};

const userConfig = {
	server: {
		file: {
			channels: '>=debug',
			config: {
				paths: './logs',
				jsonIndent: 2
			}
		}
	}
};

const oldConfigList = config.getConfigList();

describe('config', () => {
	after(() => config.setConfigList(oldConfigList));

	it('uses default logging.server config if null', () => {
		const loggingServicePath = path.dirname(require.resolve('lib/loggingService'));

		config.set('logging', {
			server: null
		});
		config.setTopLevelDefault('logging', path.join(loggingServicePath, '../loggingService/config.yaml'));

		assert.deepEqual(config.get('logging'), defaultConfig);
	});
});

describe('setup', () => {
	let distributorStub = null;
	let addWriterStub = null;


	describe('addWriter', () => {
		before(() => {
			distributorStub = sinon.stub(Distributor.prototype, 'destroyWriters').callsFake((cb) => cb());
			addWriterStub = sinon.stub(loggingService, 'addWriter').callsFake();
		});

		beforeEach(() => {
			config.setConfigList([
				new Matryoshka({}, 'module')
			]);
		});

		after(() => {
			distributorStub.restore();
			addWriterStub.restore();
			config.setConfigList(oldConfigList);
		});

		afterEach(() => {
			distributorStub.resetHistory();
			addWriterStub.resetHistory();
		});

		it('adds writer with default config', (done) => {
			config.set('logging', defaultConfig);

			loggingService.setup((err) => {
				assert.strictEqual(err, undefined, 'loggingService.setup should not return an error');

				assert(distributorStub.calledBefore(addWriterStub), 'destroyWriters should be called before addWriter');
				assert(addWriterStub.called, 'addWriter should be called');
				assert(addWriterStub.calledOnce, 'addWriter should be called once');
				sinon.assert.calledWithExactly(
					addWriterStub,
					'terminal',
					defaultConfig.server.terminal.channels,
					defaultConfig.server.terminal.config
				);

				done();
			});
		});

		it('adds default terminal logger with presence of file logger in user config', (done) => {
			config.set('logging', defaultConfig);
			config.set('logging', userConfig);

			loggingService.setup((err) => {
				assert.strictEqual(err, undefined, 'loggingService.setup should not return an error');

				assert(addWriterStub.called, 'addWriter should be called');
				assert(addWriterStub.calledTwice, 'addWriter should be called twice');

				sinon.assert.calledWithExactly(
					addWriterStub,
					'terminal',
					defaultConfig.server.terminal.channels,
					defaultConfig.server.terminal.config
				);
				sinon.assert.calledWithExactly(
					addWriterStub,
					'file',
					userConfig.server.file.channels,
					userConfig.server.file.config
				);

				done();
			});
		});

		it('does not add terminal logger if userConfig set terminal to false', (done) => {
			const userConfig2 = deepCopy(userConfig);

			userConfig2.server.terminal = false;

			config.set('logging', defaultConfig);
			config.set('logging', userConfig2);

			loggingService.setup((err) => {
				assert.strictEqual(err, undefined, 'loggingService.setup should not return an error');

				assert(addWriterStub.called, 'addWriter should be called');
				assert(addWriterStub.calledOnce, 'addWriter should be called once');

				sinon.assert.neverCalledWith(
					addWriterStub,
					'terminal'
				);

				done();
			});
		});
	});
});

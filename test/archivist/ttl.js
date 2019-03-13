'use strict';

const assert = require('assert');
const sinon = require('sinon');

const Archivist = require('lib/archivist').Archivist;
const configuration = require('lib/archivist/configuration');

const archivist = new Archivist();

const topic = 'user';
const index = 'userId';
const ttl = 1;

describe('ttl', () => {
	let _requestVaultValueStub = null;
	let getConfigurationSub = null;
	let getTopicConfigSub = null;
	let touchSpy = null;

	before(() => {
		touchSpy = sinon.spy();
		_requestVaultValueStub = sinon.stub(Archivist.prototype, '_requestVaultValue').returns({
			touch: touchSpy,
			set: () => {}
		});
		getConfigurationSub = sinon.stub(configuration, 'getConfiguration').callsFake(() => {
			return {};
		});
		getTopicConfigSub = sinon.stub(configuration, 'getTopicConfig').callsFake(() => {
			return {
				ttl: ttl
			};
		});
		sinon.spy();
	});

	after(() => {
		_requestVaultValueStub.restore();
		getConfigurationSub.restore();
		getTopicConfigSub.restore();
	});

	afterEach(() => {
		_requestVaultValueStub.resetHistory();
		getConfigurationSub.resetHistory();
		getTopicConfigSub.resetHistory();
		touchSpy.resetHistory();
	});

	it('[archivist.set] use ttl config', () => {
		const time = Math.ceil(Date.now() / 1000 + ttl);
		archivist.set(topic, { [index]: 5 });
		assert(touchSpy.called, 'vault.touch should be called');
		assert(touchSpy.calledOnce, 'vault.touch should be called only once');
		assert(touchSpy.calledWithExactly(time), `expected: ${time}, received: ${touchSpy.args}`);
	});

	it('[archivist.set] does not use ttl config if expirationTime in params', () => {
		archivist.set(topic, { [index]: 5 }, {}, 'application/json', 'utf8', 5);
		assert(touchSpy.called, 'vault.touch should be called');
		assert(touchSpy.calledOnce, 'vault.touch should be called only once');
		assert(touchSpy.calledWithExactly(5));
	});
});

'use strict';

const assert = require('assert');
const logging = require('lib/loggingService');
const libCC = require('lib/commandCenter');
const CommandCenter = libCC.CommandCenter;

describe('commandCenter', function () {
	describe('CommandCenter', function () {
		let cc;

		before(function () {
			// Hide "User command response cache disabled" log
			logging.filterContexts('responseCache');
			cc = new CommandCenter({
				name: 'test'
			});
			logging.filterContexts();
		});

		describe('registerMessageHook()', function () {
			it('Tests input types', function () {
				const badHook = function () {
				};

				const goodHook = function (state, data, batch, cb) {
					cb();
				};

				assert.throws(() => { libCC.registerMessageHook(123, false, goodHook); });
				assert.throws(() => { libCC.registerMessageHook('myhook', 123, goodHook); });
				assert.throws(() => { libCC.registerMessageHook('myhook', false, 123); });
				assert.throws(() => { libCC.registerMessageHook('myhook', false, badHook); });
				assert.doesNotThrow(() => { libCC.registerMessageHook('myhook', false, goodHook); });
			});
		});

		describe('setupUserCommand()', function () {
			it('Tests input types', function () {
				const mod = {
					execute: function (state, cb) {
						cb();
					}
				};

				assert.throws(() => { cc.setupUserCommand(123, 'login', mod); });
				assert.throws(() => { cc.setupUserCommand('user', 123, mod); });
				assert.throws(() => { cc.setupUserCommand('user', 'login', 123); });
				assert.throws(() => { cc.setupUserCommand('user', 'login', {}); }); // no execute
				assert.throws(() => { cc.setupUserCommand('user', 'login', { acl: 123, execute: () => {} }); });
				assert.throws(() => { cc.setupUserCommand('user', 'login', { execute: () => {} }); });
				assert.throws(() => { cc.setupUserCommand('user', 'login', { execute: (state) => {} }); }); // eslint-disable-line
			});

			it('Registers a user command', function () {
				const mod = {
					execute: function (state, cb) {
						cb();
					}
				};

				cc.setupUserCommand('user', 'login', mod);
			});

			it('If exports.default is present, its content is used for the user command (for TypeScript)', function () {
				const mod = {
					default: {
						execute: function (state, cb) {
							cb();
						}
					}
				};

				cc.setupUserCommand('user', 'login', mod);
			});

			it('User commands may be classes with static methods', function () {
				class mod {
					static execute(state, cb) {
						cb();
					}
				};

				cc.setupUserCommand('user', 'login', mod);
			});
		});

		describe('getPublicConfig()', function () {
			it('Communicates a user command', function () {
				const mod = {
					execute: function (state, foo, cb) {
						cb();
					}
				};

				cc.setupUserCommand('user', 'login', mod);
				const config = cc.getPublicConfig('');

				assert.equal(config.url, '/test');
				assert.deepEqual(config.commands, {
					user: [
						{ name: 'login', params: ['foo'] }
					]
				});
			});
		});

		describe('buildParamList()', function () {
			const cmdInfoModParams = ['a', 'b', 'c'];

			it('Tests input types', function () {
				assert.throws(() => { cc.buildParamList(123, []); });
				assert.throws(() => { cc.buildParamList([], 123); });
				assert.doesNotThrow(() => { cc.buildParamList([], []); });
				assert.doesNotThrow(() => { cc.buildParamList([], {}); });
			});

			it('should build the param list from an array of the same size', function () {
				const cmdParams = ['1', '2', '3'];
				const paramList = cc.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, cmdParams);
			});

			it('should build the param list from a smaller array', function () {
				const cmdParams = ['1', '2'];
				const paramList = cc.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '2', undefined]);
			});

			it('should throw an exception if the array is too big', function () {
				const cmdParams = ['1', '2', '4', '5'];
				assert.throws(() => { cc.buildParamList(cmdInfoModParams, cmdParams); });
			});

			it('should build the param list from an object', function () {
				const cmdParams = {
					a: '1',
					b: '2',
					c: '3'
				};
				const paramList = cc.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '2', '3']);
			});

			it('should build the param list from an object with missing params', function () {
				const cmdParams = {
					a: '1',
					c: '2',
					e: '3'
				};
				const paramList = cc.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', undefined, '2']);
			});

			it('should build the param list from an object with too many params', function () {
				const cmdParams = {
					a: '1',
					c: '2',
					e: '3',
					b: '4',
					g: '5'
				};
				const paramList = cc.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '4', '2']);
			});
		});
	});
});

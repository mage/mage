var assert = require('assert');
var CommandCenter = require('lib/commandCenter').CommandCenter;
var logging = require('lib/loggingService');

describe('commandCenter', function () {
	describe('CommandCenter', function () {
		var commandCenter;

		before(function () {
			// Hide "User command response cache disabled" log
			logging.filterContexts('responseCache');
			commandCenter = new CommandCenter({
				name: 'test'
			});
			logging.filterContexts();
		});

		describe('buildParamList()', function () {
			var cmdInfoModParams = ['a', 'b', 'c'];

			it('should build the param list from an array of the same size', function (done) {
				var cmdParams = ['1', '2', '3'];
				var paramList = commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, cmdParams);
				done();
			});

			it('should build the param list from a smaller array', function (done) {
				var cmdParams = ['1', '2'];
				var paramList = commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '2', undefined]);
				done();
			});

			it('should throw an exception if the array is too big', function (done) {
				var cmdParams = ['1', '2', '4', '5'];
				try {
					commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				} catch (err) {
					assert.strictEqual(err.message, 'Too many parameters provided.');
					return done();
				}
				done('No error caught.');
			});

			it('should build the param list from an object', function (done) {
				var cmdParams = {
					a: '1',
					b: '2',
					c: '3'
				};
				var paramList = commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '2', '3']);
				done();
			});

			it('should build the param list from an object with missing params', function (done) {
				var cmdParams = {
					a: '1',
					c: '2',
					e: '3'
				};
				var paramList = commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', undefined, '2']);
				done();
			});

			it('should build the param list from an object with too many params', function (done) {
				var cmdParams = {
					a: '1',
					c: '2',
					e: '3',
					b: '4',
					g: '5'
				};
				var paramList = commandCenter.buildParamList(cmdInfoModParams, cmdParams);
				assert.strictEqual(Array.isArray(paramList), true);
				assert.strictEqual(paramList.length, 3);
				assert.deepEqual(paramList, ['1', '4', '2']);
				done();
			});
		});
	});
});

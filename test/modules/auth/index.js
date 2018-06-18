var assert = require('assert');

describe('auth', function () {
	var auth = require('lib/modules/auth');
	var loggingService = require('lib/loggingService');
	var libState = require('lib/state/state.js');
	var State = libState.State;

	// the user object that will be returned on the next archivist.get

	var currentUser;
	var currentDbError;

	before(function () {
		// set up State with mock objects

		var fakeMage = {
			core: {},
			isDevelopmentMode: function () { return true; }
		};

		var fakeLogger = loggingService.createLogCreator();

		function FakeArchivist(/* state */) {
			this.distribute = function (cb) { cb(); };

			this.get = function (topic, index, options, cb) {
				cb(currentDbError, currentUser);
			};
			this.set = function (topic, index, data/* , mediaType, encoding */) {
				currentUser = data;
			};
		}

		libState.initialize(fakeMage, fakeLogger, FakeArchivist);
	});

	// allow auth module configuration override

	var oldFns = {
		getSessionModule: auth.getSessionModule,
		getHashConfiguration: auth.getHashConfiguration,
		getArchivistTopic: auth.getArchivistTopic,
		checkArchivistConfiguration: auth.checkArchivistConfiguration
	};

	var testFns = {
		getSessionModule: function () {
			return {
				register: function (state, userId, language, meta) {
					state.acl = meta.acl;
					return { userId: userId, language: language, meta: meta }; // a fake session object
				}
			};
		},
		getArchivistTopic: function () { return 'auth'; },
		checkArchivistConfiguration: function (/* topic, index, operations */) {}
	};

	beforeEach(function (done) {
		currentUser = undefined;
		currentDbError = undefined;

		auth.getSessionModule = testFns.getSessionModule;
		auth.getArchivistTopic = testFns.getArchivistTopic;
		auth.checkArchivistConfiguration = testFns.checkArchivistConfiguration;

		var state = new State();

		auth.setup(state, function (error) {
			state.close();
			done(error);
		});
	});

	afterEach(function () {
		auth.getSessionModule = oldFns.getSessionModule;
		auth.getHashConfiguration = oldFns.getHashConfiguration;
		auth.getArchivistTopic = oldFns.getArchivistTopic;
		auth.checkArchivistConfiguration = oldFns.checkArchivistConfiguration;
	});

	it('can register without User ID (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);
			done();
		});
	});

	it('can register without ACL (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = {};

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);
			done();
		});
	});

	it('can register with User ID (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var userId = '123';
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'], userId: userId };

		auth.register(state, username, password, options, function (error, newUserId) {
			assert.ifError(error);
			assert.equal(newUserId, userId);
			done();
		});
	});

	it('can register, then login (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, password, function (error, session) {
				assert.ifError(error);
				assert.equal(session.userId, userId);
				done();
			});
		});
	});

	it('can register, then login (hmac)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hmac',
				algorithm: 'sha256',
				key: '12ab' // hex
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, password, function (error, session) {
				assert.ifError(error);
				assert.equal(session.userId, userId);
				done();
			});
		});
	});

	it('can register, then login (pbkdf2)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'pbkdf2',
				iterations: 100,
				algorithm: 'sha256'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, password, function (error, session) {
				assert.ifError(error);
				assert.equal(session.userId, userId);
				done();
			});
		});
	});

	it('detects non-existing hash-algorithm (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'foobar'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error) {
			assert(error);
			done();
		});
	});

	it('detects non-existing hash-algorithm (hmac)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hmac',
				algorithm: 'foobar',
				key: '12ab' // hex
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error) {
			assert(error);
			done();
		});
	});

	it('detects non-existing hash-algorithm (pbkdf2)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'pbkdf2',
				algorithm: 'foobar',
				iterations: 100
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error) {
			assert(error);
			done();
		});
	});

	it('cannot register an already existing username', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.register(state, username, password, options, function (error) {
				assert(error);
				assert.equal(error.code, 'userExists');
				done();
			});
		});
	});

	it('can change an user\'s password, then login', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var newPassword = '4lice';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.changePassword(state, username, newPassword, function (error) {
				assert.ifError(error);

				auth.login(state, username, newPassword, function (error, session) {
					assert.ifError(error);
					assert.equal(session.userId, userId);
					done();
				});
			});
		});
	});

	it('cannot login with the wrong username (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';

		auth.login(state, username, password, function (error) {
			assert(error);
			assert.equal(error.code, 'invalidUsernameOrPassword');
			done();
		});
	});

	it('cannot login with the wrong username (hmac)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hmac',
				algorithm: 'sha256',
				key: '12ab' // hex
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';

		auth.login(state, username, password, function (error) {
			assert(error);
			assert.equal(error.code, 'invalidUsernameOrPassword');
			done();
		});
	});

	it('cannot login with the wrong username (pbkdf2)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'pbkdf2',
				iterations: 100,
				algorithm: 'sha256'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';

		auth.login(state, username, password, function (error) {
			assert(error);
			assert.equal(error.code, 'invalidUsernameOrPassword');
			done();
		});
	});

	it('cannot login with the wrong password (hash)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, 'wrongPassword', function (error) {
				assert(error);
				assert.equal(error.code, 'invalidUsernameOrPassword');
				done();
			});
		});
	});

	it('cannot login with the wrong password (hmac)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hmac',
				algorithm: 'sha256',
				key: '12ab' // hex
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, 'wrongPassword', function (error) {
				assert(error);
				assert.equal(error.code, 'invalidUsernameOrPassword');
				done();
			});
		});
	});

	it('cannot login with the wrong password (pbkdf2)', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'pbkdf2',
				iterations: 100,
				algorithm: 'sha256'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.login(state, username, 'wrongPassword', function (error) {
				assert(error);
				assert.equal(error.code, 'invalidUsernameOrPassword');
				done();
			});
		});
	});

	it('can login anonymously', function (done) {
		var state = new State();
		var options = { acl: ['user'], userId: 'abc' };

		var session = auth.loginAnonymous(state, options);
		assert(session.userId);
		done();
	});

	it('can login anonymously without user ID', function (done) {
		var state = new State();
		var options = { acl: ['user'] };

		var session = auth.loginAnonymous(state, options);
		assert(session.userId);
		done();
	});

	it('can login anonymously without ACL', function (done) {
		var state = new State();
		var options = { userId: 'abc' };

		var session = auth.loginAnonymous(state, options);
		assert(session.userId);
		done();
	});

	it('ban the user, and then unban', function (done) {
		auth.getHashConfiguration = function () {
			return {
				type: 'hash',
				algorithm: 'sha1'
			};
		};

		var state = new State();
		var username = 'bob';
		var password = 'b0b';
		var options = { acl: ['user'] };

		auth.register(state, username, password, options, function (error, userId) {
			assert.ifError(error);
			assert(userId);

			auth.ban(state, username, function (error) {
				assert.ifError(error);

				assert(currentUser.acl.includes('banned'), 'Banned should be added to acl');

				auth.login(state, username, password, function (error) {
					assert(error);
					assert.equal(error, 'banned', 'Should not be able to login after beeing banned');

					auth.unban(state, username, function (error) {
						assert.ifError(error);

						assert(!currentUser.acl.includes('banned'), 'Banned should be removed from acl');
						done();
					});
				});
			});
		});
	});

	describe('errors', function () {
		it('fails module setup() properly', function (done) {
			auth.checkArchivistConfiguration = function () {
				throw new Error('Failure');
			};

			var state = new State();

			auth.setup(state, function (error) {
				assert(error);
				state.close();
				done();
			});
		});

		it('handles database lookup errors properly', function (done) {
			auth.getHashConfiguration = function () {
				return {
					type: 'hash',
					algorithm: 'sha1'
				};
			};

			currentDbError = new Error('Fake database lookup error');

			var state = new State();
			var username = 'bob';
			var password = 'b0b';
			var options = { acl: ['user'] };

			auth.register(state, username, password, options, function (error) {
				assert(error);

				auth.authenticate(state, username, password, function (error) {
					assert(error);

					done();
				});
			});
		});

		it('handles incorrect hash-type errors properly', function (done) {
			auth.getHashConfiguration = function () {
				return {
					type: 'foobar'
				};
			};

			var state = new State();
			var username = 'bob';
			var password = 'b0b';
			var options = { acl: ['user'] };

			// bad type

			auth.register(state, username, password, options, function (error) {
				assert(error);

				auth.getHashConfiguration = function () {
					return {
						type: 'hash',
						algorithm: 'sha1'
					};
				};

				auth.register(state, username, password, options, function (error) {
					assert.ifError(error);

					auth.getHashConfiguration = function () {
						return {
							type: 'foobar'
						};
					};

					// bad type

					auth.authenticate(state, username, password, function (error) {
						assert(error);

						done();
					});
				});
			});
		});

		it('handles incorrect hash-configuration errors properly', function (done) {
			auth.getHashConfiguration = function () {
				return {
					type: 'hash',
					algorithm: 'sha1'
				};
			};

			var state = new State();
			var username = 'bob';
			var password = 'b0b';
			var options = { acl: ['user'] };

			// bad type

			auth.register(state, username, password, options, function (error) {
				assert.ifError(error);

				currentUser.hash.algorithm = 'foobar';

				auth.authenticate(state, username, password, function (error) {
					assert(error);

					done();
				});
			});
		});

		it('handles session registration errors properly', function (done) {
			auth.getSessionModule = function () {
				return {
					register: function () {
						throw new Error('Fake session register error');
					}
				};
			};

			auth.getHashConfiguration = function () {
				return {
					type: 'hash',
					algorithm: 'sha1'
				};
			};

			var state = new State();
			var username = 'bob';
			var password = 'b0b';
			var options = { acl: ['user'] };

			auth.register(state, username, password, options, function (error, userId) {
				assert.ifError(error);
				assert(userId);

				auth.login(state, username, password, function (error) {
					assert(error);
					done();
				});
			});
		});
	});
});

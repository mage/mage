var crypto = require('crypto');

exports.hash = function (cfg) {
	return function (password, salt) {
		var hash = crypto.createHash(cfg);

		if (salt) {
			hash.update(new Buffer(salt, 'hex'));
		}

		hash.update(password);

		return hash.digest('hex');
	};
};

exports.hmac = function (cfg, logger) {
	if (cfg.key === 'somelongkeythatnoonewillguess') {
		logger.warning('You are using the default hmac key, this is unsafe!');
	}

	return function (password, salt) {
		// throwing the salt with the key adds slightly more entropy
		var hash = crypto.createHmac(cfg.algorithm, cfg.key + new Buffer(salt, 'hex'));

		// feed it the salt if there is one
		if (salt) {
			hash.update(new Buffer(salt, 'hex'));
		}

		// feed it the password
		hash.update(password);

		return hash.digest('hex');
	};
};

exports.pbkdf2 = function (cfg, logger) {
	// support for pbkdf2, this is the recommended way to hash passwords but is kinda slow, we may
	// want to limit password length to a certain length, see this issue in django about why:
	// https://www.djangoproject.com/weblog/2013/sep/15/security/

	// do NOT change the iteration count once you use it (maybe store it in the credentials
	// table to prevent issues?) or you will not be able to verify credential entries created
	// with the old iteration count!
	var iterations = cfg.iterations || 12000;

	if (!cfg.iterations) {
		logger.warning(
			'Please set up how many iterations you want to use with pbkdf2,',
			' defaulting to', iterations, 'iterations.');
	}

	return function (password, salt) {
		if (!salt) {
			return false;
		}

		return crypto.pbkdf2Sync(password, new Buffer(salt, 'hex'), iterations, 20).toString('hex');
	};
};

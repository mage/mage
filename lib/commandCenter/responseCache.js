var mage = require('lib/mage');
var logger = mage.core.logger.context('responseCache');


// meta data format:
//
// topic: ucResponseMeta
// index: ['session']
// data:
//   queryId\n
//   JSON-options


function ResponseCache(appName, ttl) {
	this.enabled = false;
	this.ttl = undefined;

	if (typeof ttl === 'number') {
		if (ttl < 1) {
			throw new Error('Response cache *must* expire, 0 TTL not accepted.');
		}

		if (mage.core.archivist.topicExists('ucResponseMeta') || mage.core.archivist.topicExists('ucResponseData')) {
			// touch is not really called, but we do it to enforce TTL support

			mage.core.archivist.assertTopicAbilities('ucResponseMeta', ['session'], ['set', 'get', 'touch']);
			mage.core.archivist.assertTopicAbilities('ucResponseData', ['session'], ['set', 'get', 'touch']);

			this.ttl = ttl;

			this.enabled = true;

			logger.info('User command response enabled for app', appName, 'with TTL:', ttl, 'sec');
		} else {
			logger.warning(
				'Archivist topics "ucResponseMeta" and "ucResponseData" not configured.',
				'User command response cache disabled for app:', appName
			);
		}
	} else {
		logger.warning('Falsy Response Cache TTL configured. User command response cache disabled for app:', appName);
	}
}


ResponseCache.prototype.get = function (state, queryId, cb) {
	// cb expects: error, options, response
	// if either options or response is falsy, it's considered a cache miss

	// graceful abort cases:
	// - if there is no session or queryId, we are unable to use cache
	// - if the TTL is set to 0, it means we don't want cache (useful for ultra stable network environments)

	if (!this.enabled || !state.session) {
		return cb();
	}

	if (!queryId) {
		logger.verbose('No response cache applied (queryId missing)');
		return cb();
	}

	var sessionKey = state.session.getFullKey();

	logger.verbose('Trying to load response cache for session', sessionKey);

	// first we fetch the queryId and options object

	var getOptions = {
		optional: true,
		mediaTypes: undefined  // suppresses annoying defaults (tome)
	};

	state.archivist.get('ucResponseMeta', { session: sessionKey }, getOptions, function (error, info) {
		if (error) {
			return cb(error);
		}

		if (!info) {
			return cb();
		}

		if (typeof info !== 'string') {
			logger.error('Response cache meta information is not a string:', info);
			return cb();
		}

		info = info.split('\n');

		// compare the cached queryId with the given queryId

		queryId += '';
		var cachedQueryId = info[0];

		if (cachedQueryId !== queryId) {
			// a no-match here is the hot path

			logger.verbose('Found a response cache, but query ID did not match:', cachedQueryId, queryId);
			return cb();
		}

		// cache hit!

		logger.verbose('Found a response cache meta data for query ID:', queryId);

		// get the response data

		var getOptions = {
			optional: true,
			mediaTypes: undefined  // suppresses annoying defaults (tome)
		};

		state.archivist.get('ucResponseData', { session: sessionKey }, getOptions, function (error, response) {
			if (error) {
				return cb(error);
			}

			if (!response) {
				logger.error('Response cache was expected, but no valid data was found:', response);
				return cb();
			}

			logger.debug('Loaded command response from cache for query ID:', queryId);

			// parse options

			var options;

			try {
				options = JSON.parse(info[1]);
			} catch (e) {
				logger.error('Error while parsing response cache options');
				return cb();
			}

			cb(null, options, response);
		});
	});
};


ResponseCache.prototype.set = function (state, queryId, options, response) {
	// graceful abort cases:
	// - response cache has not been enabled
	// - if there is no session or queryId, we are unable to use cache
	// - if no data to be cached has been provided
	// - no options or response has been provided in this call

	if (!this.enabled || !state.session || !queryId || !options || !response) {
		return false;
	}

	var sessionKey = state.session.getFullKey();

	var info = queryId + '\n' + JSON.stringify(options);

	var expirationTime = parseInt(Date.now() / 1000, 10) + this.ttl;

	state.archivist.set('ucResponseMeta', { session: sessionKey }, info, 'text/plain', 'utf8', expirationTime);
	state.archivist.set('ucResponseData', { session: sessionKey }, response, null, 'live', expirationTime);

	return true;
};


exports.ResponseCache = ResponseCache;

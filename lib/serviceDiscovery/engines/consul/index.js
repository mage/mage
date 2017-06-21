'use strict';

const async = require('async');
const os = require('os');
const requirePeer = require('codependency').get('mage');
const consul = requirePeer('consul');

const mage = require('../../../mage');
const Service = require('../../service').Service;
const ServiceNode = require('../../node').ServiceNode;

const logger = mage.core.logger.context('serviceDiscovery', 'consul');

// session TTL if we crash hard
const TTL = 30000;

/**
 * Implements the service discovery module for Consul, it uses the KV store with a session
 * since we have to store metadata (which _consul services do not support easily) to store
 * a JSON blob, the session is set with a 30s TTL and is renewed via a set of timers.
 */
class ConsulService extends Service {
	constructor(name, type, options) {
		super();

		if (!options.interface) {
			throw new Error('Missing "interface" option for consul module');
		}

		this.name = name;
		this.type = type;
		this.options = options;
		this.ttl = options.ttl || TTL;
		this.path = ['mage', name, type].join('/');

		// find the first IPv4 in the provided interface
		const ipInfo = (os.networkInterfaces()[options.interface] || []).filter(v => v.family === 'IPv4')[0];

		if (!ipInfo || !ipInfo.address) {
			throw new Error(`No valid IPv4 found on interface ${options.interface}`);
		}

		this._ip = ipInfo.address;
		this._consul = consul(this.options.consul);

		this._services = {};
		this._watch = null;

		this._sessionId = null;
		this._keepaliveTimer = null;

		this._announces = [];
	}

	/**
	 * Creates a new session on the consul KV store, when a session expires associated keys are deleted
	 *
	 * @param {function(Error, string)} cb
	 * @returns {Number}
	 */
	session(cb) {
		if (this._sessionId) {
			return setImmediate(cb.bind(cb, null, this._sessionId));
		}

		this._consul.session.create({
			behavior: 'delete',
			ttl: `${Math.ceil(this.ttl / 1000)}s`
		}, (err, id) => {
			if (id) {
				this._sessionId = id.ID;
				this._keepaliveTimer = setTimeout(this._keepalive.bind(this, this._sessionId), this.ttl);

				logger.debug(`acquired session ID ${this._sessionId}`);
			}

			cb(err, this._sessionId);
		});
	}

	/**
	 * Announce our service on consul
	 *
	 * @param {number}   port
	 * @param {Object}   metadata
	 * @param {Function} cb
	 */
	announce(port, metadata, cb) {
		logger.debug(`announcing service ${this.name} on port ${port}`);
		this._announces.push({port, metadata});
		this.session((err, id) => {
			if (err != null) {
				return cb(err);
			}

			const key = [this.path, os.hostname(), process.pid].join('/');
			this._consul.kv.set({
				key,
				value: JSON.stringify({
					port,
					ip: this._ip,
					data: metadata
				}),
				acquire: id
			}, cb);
		});
	}

	/**
	 * Discover services and start watching for changes
	 */
	discover() {
		if (this._watch) {
			return;
		}

		// first retrieve nodes on the network, and put a watcher on that path
		this._watch = this._consul.watch({ method: this._consul.kv.get, options: {
			recurse: true,
			key: 'mage/'
		}});

		this._watch.on('change', (data) => {
			this._updateNetwork(data || []);
		});

		this._watch.on('error', (error) => {
			logger.error.data(error).log('error while running discovery process');
		});

		logger.debug('discovery started');
	}

	/**
	 * Stop discovery and announcements
	 */
	close() {
		this._announces = [];

		if (this._watch) {
			this._watch.end();
			this._watch = null;
		}

		if (this._keepaliveTimer) {
			clearTimeout(this._keepaliveTimer);
			this._keepaliveTimer = null;
		}

		if (this._sessionId) {
			// just close our session to automatically delete all keys we created
			this._consul.session.destroy(this._sessionId, (err) => {
				logger.error.data(err).log(`failed to release session ${this._sessionId}`);
			});
		}

		logger.debug('stopped discovery process');
	}

	/**
	 * * Look at the values inside the base path and detect nodes that joined and left
	 *
	 * @param keys
	 * @private
	 */
	_updateNetwork(keys) {
		const currentNodes = Object.keys(this._services);

		for (const item of keys) {
			// ignore other services
			if (!item.Key.startsWith(this.path)) {
				continue;
			}

			// we already know of this service
			if (this._services[item.Key]) {
				currentNodes.splice(currentNodes.indexOf(item.Key), 1);
				continue;
			}

			this._registerService(item);
		}

		// any key left in the currentNodes array at this point is gone
		for (const key of currentNodes) {
			this._unregisterService(key);
		}
	}

	/**
	 *
	 * @param item
	 * @private
	 */
	_registerService(item) {
		// extra data from the consul item
		const data = JSON.parse(item.Value);
		const nodeLocation = item.Key.substr(this.path.length + 1).split('/');
		const host = nodeLocation[0];

		// create the service
		const node = new ServiceNode(host, data.port, [data.ip], data.data);

		// store it and emit
		this._services[item.Key] = node;
		this.emit('up', node);
	}

	/**
	 * Unregister a service an tell everyone about it being gone
	 *
	 * @param {string} key
	 * @private
	 */
	_unregisterService(key) {
		this.emit('down', this._services[key]);
		delete this._services[key];
	}

	/**
	 * Used to keep alive our consul session
	 *
	 * @param {string} sessionId
	 * @private
	 */
	_keepalive(sessionId) {
		this._consul.session.renew(sessionId, (err) => {
			if (err) {
				logger.error.data(err).log(`failed to renew session ${this._sessionId}`);

				// session might have expired without us wanting it, renew all announcements
				if (err.statusCode == 404) {
					return this._reannounce();
				}
			}

			this._keepaliveTimer = setTimeout(this._keepalive.bind(this, sessionId), this.ttl);
		});
	}

	/**
	 * This takes care of re-announcing all services in the event that the session
	 * expired (due to network issues, or consul going down)
	 *
	 * @private
	 */
	_reannounce() {
		// reset a bunch of variables
		clearTimeout(this._keepaliveTimer);
		this._keepaliveTimer = null;
		this._sessionId = null;

		// then re-announce everything
		logger.warning('consul session expired, re-announcing');

		const announces = this._announces;
		this._announces = [];

		async.eachSeries(announces, (announce, next) => {
			this.announce(announce.port, announce.metadata, next);
		}, (err) => {
			if (err) {
				logger.error.data(err).log('couldn\'t reannounce services');
			}
		})
	}
}

exports.create = function (name, type, options) {
	return new ConsulService(name, type, options);
};

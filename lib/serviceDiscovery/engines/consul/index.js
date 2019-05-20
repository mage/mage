'use strict';

const async = require('async');
const requirePeer = require('codependency').get('mage');
const consul = requirePeer('consul');

const mage = require('lib/mage');
const MageError = require('../../../mage/MageError');
const Service = require('../../service').Service;
const ServiceNode = require('../../node').ServiceNode;
const helpers = require('../../helpers');

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
		// if no interface is defined, pick the first one we can find
		this._ip = helpers.getAnnounceIps(options.interface)[0];
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
			ttl: `${Math.ceil(this.ttl / 1000)}s`,
			lockdelay: '0s'
		}, (err, id) => {
			if (id) {
				this._sessionId = id.ID;
				this._keepaliveTimer = setTimeout(this._keepalive.bind(this, this._sessionId), this.ttl);

				logger.debug(`Acquired session ID ${this._sessionId}`);
			}

			// transform the error to something more friendly
			if (err) {
				logger.error.data(err).log('Couldn\'t connect to Consul');
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
		logger.debug(`Announcing service ${this.name} on port ${port}`);
		this._announces.push({port, metadata});
		this.session((err, id) => {
			if (err) {
				return cb(err);
			}

			const key = [this.path, helpers.generateId(port)].join('/');

			const doSet = () => {
				this._consul.kv.set({
					key,
					value: JSON.stringify({
						port,
						ip: this._ip,
						data: metadata
					}),
					acquire: id
				}, (err, result) => {
					if (err) {
						return cb(err);
					}

					// If we can contact Consul but we can't set the key, there is no 'err'; the
					// returned result is simply set to false so we need to check for it here
					if (result === false) {
						return cb(new MageError({
							message: 'Could not set Consul KV for service',
							// eslint-disable-next-line max-len
							details: 'Consul was contacted successfully, but the key was unable to be set after deleting existing sessions.  If this persists, check if the Consul KV store is configured correctly.'
						}));
					}

					cb(null);
				});
			};

			this._consul.kv.get(key, (err, data) => {
				// If we didn't find it, just set as normal
				if (err || !data) {
					return doSet();
				}

				// Otherwise we have to delete the old session and take over the key for ourselves
				this._consul.session.destroy(data.Session, (err) => {
					if (err) {
						return cb(err);
					}

					doSet();
				});
			});
		});
	}

	/**
	 * Discover services and start watching for changes
	 */
	discover() {
		if (this._watch) {
			return;
		}

		logger.debug('Starting discovery process');

		// first retrieve nodes on the network, and put a watcher on that path
		this._watch = this._consul.watch({ method: this._consul.kv.get, options: {
			recurse: true,
			key: 'mage/'
		}});

		this._watch.on('change', (data) => {
			this._updateNetwork(data || []);
		});

		this._watch.on('error', (error) => {
			logger.error.data(error).log('Error while running discovery process');
		});
	}

	/**
	 * Stop discovery and announcements
	 */
	close(cb) {
		this._announces.length = 0;

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
				if (err) {
					logger.error.data(err).log(`Failed to release session ${this._sessionId}`);
				}

				logger.debug('Stopped discovery process');
				cb();
			});
		} else {
			logger.debug('Stopped discovery process');
			setImmediate(cb);
		}
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
				// session might have expired without us wanting it, renew all announcements
				if (err.statusCode === 404) {
					logger.warning.data(err).log(`Session ${this._sessionId} not found, reannouncing services`);
					return this._reannounce();
				}

				logger.error.data(err).log(`Failed to renew session ${this._sessionId}`);
			}

			this._keepaliveTimer = setTimeout(this._keepalive.bind(this, sessionId), this.ttl / 2);
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
		logger.warning('Consul session expired, re-announcing');

		const announces = this._announces.splice(0, this._announces.length);
		async.eachSeries(announces, (announce, next) => {
			this.announce(announce.port, announce.metadata, next);
		}, (err) => {
			if (err) {
				logger.error.data(err).log('Couldn\'t reannounce services');
			}
		});
	}
}

exports.create = function (name, type, options) {
	return new ConsulService(name, type, options);
};

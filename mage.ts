/// <reference types="node" />

declare type VaultOperation = 'add' | 'set' | 'del' | 'touch';

import * as commander from 'commander';
import * as config from './lib/config';
import MageError from './lib/mage/MageError';

/**
 * Abstracted data store access interface
 *
 * In general, you will be accessing an archivist instance
 * through a state object:
 *
 * ```javascript
 * state.archivist.set('player', { userId: userId }, { name: 'someone' });
 * ```
 */
declare class Archivist {
    /**
     * Check whether a given exists in any of our vaults
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {ArchivistExistsCallback} callback
     *
     * @memberOf Archivist
     */
    exists(topicName: string, index: mage.archivist.IArchivistIndex, callback: mage.archivist.ArchivistExistsCallback): void;

    /**
     * Retrieve a value
     *
     * This method is a wrapper around `getValue` which directly returns ArchivistValue.value;
     * in most cases, you will want to call `get` instead to get the actual data.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {ArchivistOptions} options
     * @param {Callback} callback
     *
     * @memberOf Archivist
     */
    get<T>(topicName: string, index: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistGetOptions | undefined, callback: mage.archivist.ArchivistGetCallback<T>): void;
    get<T>(topicName: string, index: mage.archivist.IArchivistIndex, callback: mage.archivist.ArchivistGetCallback<T>): void;

    /**
     * Retrieve the VaultValue object for a given key
     *
     * In most cases, you will want to call `get` instead to get the actual data.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {ArchivistOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    getValue(topicName: string, index: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistGetOptions | undefined, callback: mage.archivist.ArchivistGetCallback<mage.archivist.IVaultValue>): void;
    getValue(topicName: string, index: mage.archivist.IArchivistIndex, callback: mage.archivist.ArchivistGetCallback<mage.archivist.IVaultValue>): void;

    /**
     * Retrieve multiple values
     *
     * This method is a wrapper around `mgetValue` which directly returns an array of ArchivistValue.value;
     * in most cases, you will want to call `mget` instead to get the actual data.
     *
     * @param {ArchivistQuery[]} queries
     * @param {ArchivistOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    mget<T>(queries: mage.archivist.IArchivistQuery[], options: mage.archivist.IArchivistGetOptions | undefined, callback: mage.archivist.ArchivistMGetCallback<T>): void;
    mget<T>(queries: mage.archivist.INamedArchivistQuery, options: mage.archivist.IArchivistGetOptions | undefined, callback: mage.archivist.ArchivistNamedMGetCallback<T>): void;
    mget<T>(queries: mage.archivist.IArchivistQuery[], callback: mage.archivist.ArchivistMGetCallback<T>): void;
    mget<T>(queries: mage.archivist.INamedArchivistQuery, callback: mage.archivist.ArchivistNamedMGetCallback<T>): void;

    /**
     * Retrieve multiple VaultValue objects
     *
     * In most cases, you will want to call `mget` instead to get the actual data.
     *
     * @param {ArchivistQuery[]} queries
     * @param {ArchivistOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    mgetValues(queries: mage.archivist.IArchivistQuery[], options: mage.archivist.IArchivistGetOptions | undefined, callback: mage.archivist.ArchivistMGetCallback<mage.archivist.IVaultValue>): void;
    mgetValues(queries: mage.archivist.IArchivistQuery[], callback: mage.archivist.ArchivistMGetCallback<mage.archivist.IVaultValue>): void;

    /**
     * Search the backend vault for matching indexes, and return them
     *
     * In this case, the index can be partial; for instance, `{ userId: 1 }`, would match
     * all the following indexes:
     *
     * ```json
     * { userId: 1, somethingElse: 'hi'}
     * { userId: 1, somethingElse: 'hello'}
     * ```
     *
     * Note that this API returns the list of matching *indexes*, not the data they hold;
     * please see `scan()` if you wish to retrieve the data instead.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} partialIndex
     * @param {ArchivistOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    list(topicName: string, partialIndex: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistListOptions | undefined, callback: mage.archivist.ArchivistListCallback): void;
    list(topicName: string, partialIndex: mage.archivist.IArchivistIndex, callback: mage.archivist.ArchivistListCallback): void;

    /**
     * Scan the backend vault for entries matching a given partial index.
     *
     * In this case, the index can be partial; for instance, `{ userId: 1 }`, would match
     * all the following indexes:
     *
     * ```json
     * { userId: 1, somethingElse: 'hi'}
     * { userId: 1, somethingElse: 'hello'}
     * ```
     *
     * @param {string} topicName
     * @param {ArchivistIndex} partialIndex
     * @param {ArchivistScanOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    scan<T>(topicName: string, partialIndex: mage.archivist.IArchivistIndex, options: mage.archivist.ArchivistScanOptions | undefined, callback: mage.archivist.ArchivistMGetCallback<T>): void;
    scan<T>(topicName: string, partialIndex: mage.archivist.IArchivistIndex, callback: mage.archivist.ArchivistMGetCallback<T>): void;

    /**
     * Add a new topic value by index.
     *
     * Note that if the index already exists, this call will return an error. Use
     * `set` instead if you wish to write the value regardless of whether
     * it already exists.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {*} data
     * @param {ArchivistMediaType} mediaType
     * @param {ArchivistEncoding} encoding
     * @param {number} expirationTime
     *
     * @memberOf Archivist
     */
    add<T>(topicName: string, index: mage.archivist.IArchivistIndex, data: T, mediaType?: mage.archivist.ArchivistMediaType, encoding?: mage.archivist.ArchivistEncoding, expirationTime?: number): void;

    /**
     * Set the value for an existing index.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {*} data
     * @param {ArchivistMediaType} mediaType
     * @param {ArchivistEncoding} encoding
     * @param {number} expirationTime
     *
     * @memberOf Archivist
     */
    set<T>(topicName: string, index: mage.archivist.IArchivistIndex, data: T, mediaType?: mage.archivist.ArchivistMediaType, encoding?: mage.archivist.ArchivistEncoding, expirationTime?: number): void;

    /**
     * Delete a topic by index.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     *
     * @memberOf Archivist
     */
    del(topicName: string, index: mage.archivist.IArchivistIndex): void;

    /**
     * Touch a topic
     *
     * Used to reset the expiration timer.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {number} expirationTime
     *
     * @memberOf Archivist
     */
    touch(topicName: string, index: mage.archivist.IArchivistIndex, expirationTime?: number): void;

    /**
     * Commit all current changes to their respective vault backend(s)
     *
     * @param {*} [options]
     * @param {(preDistributionErrors: Error[], distributionErrors: Error[]) => void} callback
     *
     * @memberOf Archivist
     */
    distribute(callback: mage.archivist.ArchivistDistributeCallback): void;

    /**
     * Clear all the loaded entries from this archivist instance
     *
     * Note that this will not clear mutated entries; please use
     * `reset()` if you wish to clear all data instead.
     *
     * @memberOf Archivist
     */
    clearCache(): void;

    /**
     * Reset the instance; remove all operations that are
     * currently scheduled on the instance
     *
     * @memberOf Archivist
     */
    reset(): void;
}

/**
 * Auth callbacks
 */
declare type AuthenticateCallback = (error: Error|null, userId: string|number, acl: string[]) => void;

declare type LoginCallback = (error: Error|null, session: Session) => void;

declare type RegisterCallback = (error: Error|null, userId: string) => void;

declare type ChangePasswordCallback = (error: Error|null) => void;

declare type BanCallback = (error: Error|null) => void;

declare type UnbanCallback = (error: Error|null) => void;

declare interface ILog extends Function {
    /**
     * String(s) to log
     */
    (...content: string[]): void;

    /**
     * Append additional data to the log entry
     *
     * Note that this can be called multiple times on the same log entry; in such
     * cases, each key-value entry is merged with the previous one.
     *
     * You **must** call `.log()` a the end of the chain for the log entry
     * to be recorded.
     *
     * ```javascript
     * logger.debug.data({ hello: 'world' }).log();
     * ```
     *
     * @param {{[id: string]: any}} data Key-value of data to add to your log entry
     * @returns {this}
     *
     * @memberOf Log
     */
    data(data: {[id: string]: any}): this;

    /**
     * Append additional text information to your log entry
     *
     * This is useful for cases where you would need to explain in more
     * details to the operator of your game server what has happened, and, in the
     * case of an error, how to correct the situation.
     *
     * You **must** call `.log()` a the end of the chain for the log entry
     * to be recorded.
     *
     *  ```javascript
     * logger.debug.data({ hello: 'world' }).log();
     * ```
     *
     * @param {...string[]} content
     * @returns {this}
     *
     * @memberOf Log
     */
    details(...content: string[]): this;

    /**
     * Record the log entry
     *
     * The following are essentially equivalent:
     *
     * ```javascript
     * logger.debug.log('hi')
     * logger.debug('hi')
     * ```
     *
     * Use `log` whenever you have previously chained `data` or `details`
     * method calls:
     *
     * ```javascript
     * logger.error
     *   .data({hello: 'world'})
     *   .details('Something awful has occured. Here is how you can fix the situation')
     *   .log('error. error.error')
     * ```
     *
     * @param {...string[]} content
     *
     * @memberOf Log
     */
    log(...content: string[]): void;
}

declare class Logger {
    /**
     * Add contexts to the current logger instance.
     *
     * Logging contexts should be used to help with the triage and filtering
     * of logs; for instance, you will often want to create one logger context
     * per module.
     *
     * This adds contexts to the current instance. You will not normally want
     * to use this on the global logger instance: instead, you will normally
     * want to use this on a logger instance returned by `mage.logger.context`
     * or something similar.
     *
     * ```javascript
     * import * as mage from mage;
     * const logger = mage.logger.context('mymodule')
     * logger.addContexts('some other context to add')
     * logger.debug('this will be contextualized to mymodule')
     * ```
     *
     * In most cases, simply using `mage.logger.context` is sufficient.
     *
     * @param {...string[]} contexts
     * @returns {Logger}
     *
     * @memberof Logger
     */
    addContexts(...contexts: string[]): void;

    /**
     * Return a contextualized logger instance
     *
     * Logging contexts should be used to help with the triage and filtering
     * of logs; for instance, you will often want to create one logger context
     * per module.
     *
     * Contrarily to `mage.logger.addContexts`, this method returns
     * a new logger with the given context, instead of setting the context
     * on the current logger instance. This can be useful to create a localized logger;
     *
     * ```javascript
     * import * as mage from mage;
     * const logger = mage.logger.context('mymodule')
     * logger.debug('this will be contextualized to mymodule')
     * ```
     *
     * @summary Append a logging context.
     * @param {...string[]} contexts
     * @returns {Logger}
     *
     * @memberOf Logger
     */
    context(...contexts: string[]): Logger;

    /**
     * Disable a log channel
     *
     * This will in effect take all logs sent to this channel,
     * and ignore them; logs sent on this channel will no
     * longer be forwarded to any logger backend.
     *
     * @param {string} channelName The name of the channel to disable
     * @memberof Logger
     */
    disableChannel(channelName: string): void;

    /**
     * Create a channel handler
     *
     * You should only call this if you want to programatically
     * enable a channel which is not currently enabled or if you
     * want to re-enable a channel which was disabled using `disableChannel`.
     *
     * @param {string} channelName The channel to enable
     * @memberof Logger
     */
    enableChannel(channelName: string): void;

    /**
     * Low-level debug information (I/O details, etc). Reserved to MAGE internals
     *
     * @type {ILog}
     * @memberOf Logger
     */
    verbose: ILog;

    /**
     * Game server debugging information
     *
     * @type {ILog}
     * @memberOf Logger
     */
    debug: ILog;

    /**
     * User command request information
     *
     * @type {ILog}
     * @memberOf Logger
     */
    info: ILog;

    /**
     * 	Services state change notification (example: third-party services and databases)
     *
     * @type {ILog}
     * @memberOf Logger
     */
    notice: ILog;

    /**
     * An unusual situation occurred, which requires analysis
     *
     * @type {ILog}
     * @memberOf Logger
     */
    warning: ILog;

    /**
     * A user request caused an error. The user should still be able to continue using the services
     *
     * @type {ILog}
     * @memberOf Logger
     */
    error: ILog;

    /**
     * A user is now stuck in a broken state which the system cannot naturally repair
     *
     * @type {ILog}
     * @memberOf Logger
     */
    critical: ILog;

    /**
     * Internal services (data store API calls failed, etc) or external services are failing
     *
     * @type {ILog}
     * @memberOf Logger
     */
    alert: ILog;

    /**
     * The app cannot boot or stopped unexpectedly
     *
     * @type {ILog}
     * @memberOf Logger
     */
    emergency: ILog;
}

/**
 * There is currently only 1 flag, namely ‘TRACK_ROUTE’.
 *
 * When this flag is active, the returnRoute must be kept
 * around in the envelope as it travels across the network.
 */
declare type MmrpEnvelopeFlag = 'NONE' | 'TRACK_ROUTE' | number

/**
 * Data which may be put into an MMRP envelope
 */
declare type MmrpEnvelopeMessage = string | Buffer

/**
 *
 */
declare type MmrpEnvelopeRoute = string[]

/**
 * MMRP Envelopes are used to encapsulate data to
 * be sent between MAGE nodes.
 *
 * @class MmrpEnvelope
 */
declare class MmrpEnvelope {
    constructor(eventName: string, messages: MmrpEnvelopeMessage[], route?: MmrpEnvelopeRoute, returnRoute?: MmrpEnvelopeRoute, flags?: MmrpEnvelopeFlag | MmrpEnvelopeFlag[]);

    /**
     * Return route
     *
     * This will be set on envelopes received by `.on(`delivery`)`
     * if `envelope.setFlag('TRACK_ROUTE')` was called before
     * sending the envelope.
     *
     * The returnRoute can then be used after reception
     * to send back a reply if needed.
     */
    public returnRoute?: MmrpEnvelopeRoute

    /**
     * List of messages
     *
     * @type {MmrpEnvelopeMessage[]}
     * @memberof MmrpEnvelope
     */
    public messages: MmrpEnvelopeMessage[]

    /**
     * Sets the message part(s) of the envelope
     *
     * The event name is what one will listen to, but prefixed
     * with 'delivery.'. Example:
     *
     * ```javascript
     * mmrpNode.on('delivery.MyEventName', (...args) => console.log(...args))
     * ```
     *
     * @param {string} eventName
     * @param {MmrpEnvelopeMessage} message
     * @param {Function} callback
     *
     * @memberof MmrpEnvelope
     */
    setMessage(eventName: string, message: MmrpEnvelopeMessage): void;

    /**
     * Appends a message part to the envelope
     *
     * @param {MmrpEnvelopeMessage} message
     *
     * @memberof MmrpEnvelope
     */
    addMessage(message: MmrpEnvelopeMessage): void;

    /**
     * Sets the route that the envelope needs to take to reach its destination
     *
     * @param {MmrpEnvelopeRoute} route
     *
     * @memberof MmrpEnvelope
     */
    setRoute(route: MmrpEnvelopeRoute): void;

    /**
     * Prepends a route to the existing envelope route
     *
     * @param {MmrpEnvelopeRoute} route
     *
     * @memberof MmrpEnvelope
     */
    injectRoute(route: MmrpEnvelopeRoute): void;

    /**
     * Removes a route part from the start of the route, if the value matches,
     * or empties the entire route if the given identity is undefined
     *
     * @param {string} [identity]
     *
     * @memberof MmrpEnvelope
     */
    consumeRoute(identity?: string): void;

    /**
     * Returns true if the route has not been fully consumed, false otherwise
     *
     * @returns {boolean}
     *
     * @memberof MmrpEnvelope
     */
    routeRemains(): boolean;

    /**
     * Returns the final address in the route
     *
     * @returns {string}
     *
     * @memberof MmrpEnvelope
     */
    getFinalDestination(): string;

    /**
     * Returns true if this envelope tracks and contains the sender's route, false otherwise
     *
     * @returns {boolean}
     *
     * @memberof MmrpEnvelope
     */
    hasReturnRoute(): boolean;

    /**
     * Set the return route for this message
     *
     * Used whenever a reply is required
     *
     * @param {(string | string[])} route
     *
     * @memberof MmrpEnvelope
     */
    setReturnRoute(route: MmrpEnvelopeRoute): void;

    /**
     * Prepends a route to the existing return route
     *
     * @param {string} route
     *
     * @memberof MmrpEnvelope
     */
    injectSender(route: string): void;

    /**
     * Returns the final portion of the return route
     *
     * This identifies the node on which the original sender
     * resides.
     *
     * @returns {string}
     *
     * @memberof MmrpEnvelope
     */
    getInitialSource(): string;

    /**
     *
     *
     * @param {*} flags
     *
     * @memberof MmrpEnvelope
     */
    setMeta(flags: MmrpEnvelopeFlag | MmrpEnvelopeFlag[]): void;

    /**
     * True if a flag is set
     *
     * @returns {boolean}
     *
     * @memberof MmrpEnvelope
     */
    isFlagged(): boolean;

    /**
     * Retrieves the flags's string representation
     *
     * @returns {string[]}
     *
     * @memberof MmrpEnvelope
     */
    getFlags(): string[];

    /**
     * Set a flag value
     *
     * @param {*} flag
     * @returns {boolean}
     *
     * @memberof MmrpEnvelope
     */
    setFlag(flag: MmrpEnvelopeFlag): boolean;
}

/**
 * MMRP Nodes are created to transmit data encapsulated
 * into MmrpEnvelopes across MAGE servers within a cluster
 *
 * @class MmrpNode
 */
declare class MmrpNode {
    constructor(role: 'relay' | 'client' | 'both', cfg: any, clusterId: string);

    /**
     * Connects the dealer to a particular URI (if not already connected) and sends it a handshake.
     *
     * @param {string} uri
     * @param {string} clusterId
     * @param {Function} [callback]
     */
    connect(uri: string, clusterId: string, callback?: Function): void;

    /**
     * Disconnects the dealer from a given URI (if connected)
     *
     * @param {string} uri
     */
    disconnect(uri: string): void;

    /**
     * Announce a relay as available. It should be connected to if appropriate.
     *
     * @param {string} uri
     * @param {string} clusterId
     * @param {Function} [callback]
     */
    relayUp(uri: string, clusterId: string, callback?: Function): void;

    /**
     * Announce a relay as no longer available. It will disconnect from this relay if connected.
     *
     * @param {string} uri
     */
    relayDown(uri: string): void;

    /**
     * Sends a message along a route of identities
     *
     * @param {MmrpEnvelope} envelope   The envelope to send
     * @param {number} [attempts]   Number of times to try resending of the route does not currently exist
     * @param {Function} cb         Callback that may receive an error if routing failed
     * @return {number}             Number of bytes sent
     */
    send(envelope: MmrpEnvelope, attempts: number | null, callback: Function): number;

    /**
     * Broadcasts an envelope across the entire mesh of relays and clients.
     *
     * @param {Envelope} envelope
     * @param {string} [routingStyle]   "*" (to all relays and clients), "*:c" (to all clients), "*:r" (to all peer relays)
     * @return {number}                 Number of bytes sent
     */
    broadcast(envelope: MmrpEnvelope, routingStyle?: string): number;

    /**
     * Closes all sockets on this node and removes all event listeners as we won't be emitting anymore.
     */
    close(): void;

    on(eventName: string, onEvent: (envelope: MmrpEnvelope) => void): void;
    once(eventName: string, onEvent: (envelope: MmrpEnvelope) => void): void;
    removeAllListeners(eventName: string): void;
    removeListener(eventName: string, callback: Function): void;
}

/**
 * Service discovery service events
 */
declare type ServiceEventName = 'up' | 'down' | 'error'

/**
 * Service discovery callback function for 'up' and 'down' events
 */
declare type ServiceEventHandler = (serviceNode: mage.core.IServiceNode) => void

/**
 * Service discovery callback function for 'error' events
 */
declare type ServiceErrorEventHandler = (error: Error) => void

/**
 * MAGE session class
 *
 * @class Session
 */
declare class Session {
    /**
     * Key/value meta data object to store with the session
     *
     * @type {Object}
     * @memberOf Session
     */
    meta: { [id: string] : string; };

    /**
     * An actor ID to associate with this session
     *
     * @type {string}
     * @memberOf Session
     */
    actorId: string;

    /**
     * The language of the user
     *
     * @type {string}
     * @memberOf Session
     */
    language: string;

    /**
     * The session key
     *
     * @type {string}
     * @memberOf Session
     */
    key: string;

    /**
     * The clusterId associated with this session (for mmrp)
     *
     * @type {string}
     * @memberOf Session
     */
    clusterId: string;

    /**
     * Unix timestamp of the creation time of this session
     *
     * @type {number}
     * @memberOf Session
     */
    creationTime: number;

    /**
     * The game version at the time of registration
     *
     * @type {string}
     * @memberOf Session
     */
    version: string;

    /**
     * Expires the session and communicates it
     * to the client passing the given reason
     *
     * @param state
     * @param reason
     */
    expire(state: mage.core.IState, reason: string): void

    /**
     * Recalculates a new expiration time for
     * the session and saves it
     *
     * @param {mage.core.IState} state
     * @memberof Session
     */
    extend(state: mage.core.IState): void

    /**
     * Returns data for the given key
     *
     * @param {string} key
     * @returns {*}
     * @memberof Session
     */
    getData(key: string): any

    /**
     * Sets data at a given key
     *
     * @param {string} key
     * @param {*} value
     * @memberof Session
     */
    setData(key: string, value: any): void

    /**
     * Deletes the data at a given key
     *
     * @param {string} key
     * @memberof Session
     */
    delData(key: string): void
}

/**
 *
 */
declare type TimeConfig = {
    /**
     * By how much time, in milliseconds, should time be offset?
     *
     * @type {number}
     */
    offset: number;

    /**
     * How fast or slow should time fast? Values smaller than 1 slow down time,
     * and values higher than 1 accelerate time.
     *
     * @type {number}
     */
    accelerationFactor: number;

    /**
     * From which point in time should we consider time accelerated?
     *
     * @type {number}
     */
    startAt: number;
}

declare interface IMageCore {
    /**
     * State class
     *
     * The state library exposes a constructor that constructs objects which form an interface
     * between an actor, a session and the archivist. Virtually any command that involves reading
     * and modification of data should be managed by a state object.
     *
     * When you’re done using the state class, always make sure to clean it up by calling close() on it.
     * MAGE’s module and command center systems that bridge the communication between client
     * and server use the State object for API responses and server-sent events.
     *
     * @type {{ new(): mage.core.IState }}
     */
    State: { new(actorId?: string, session?: Session, options?: mage.core.IStateOptions): mage.core.IState };


    /**
     * Archivist core module
     *
     * This module can be used to access things such as topic
     * configuration and vault backends.
     */
    archivist: {
        /**
         * Retrieve an object containing all the
         * existing vault backend instances
         *
         * @returns {{ [vaultName: string]: any }}
         */
        getPersistentVaults(): { [vaultName: string]: any }

        /**
         * Used to confirm the abilities of the topic on this configured system
         *
         * Not all vaults can implement the full spectrum of internals required
         * by the higher level APIs; this method allows developers to verify
         * whether a given vault backend support the functionalities it needs.
         *
         * @param {string}   topic           The topic to test.
         * @param {string[]} [index]         The index signature this topic should conform to.
         * @param {string[]} [operations]    The operations that every vault associated with this topic must
         *                                   support. Values: 'list', 'get', 'add', 'set', 'touch', 'del'
         * @param {boolean} [indexIsPartial] True if the given index signature is allowed to be incomplete.
         */
        assertTopicAbilities(topicName: string, index?: string[], requiredOperations?: string[], isIndexPartial?: boolean): any

        /**
         * Close all vaults instances
         *
         * @returns {*}
         */
        closeVaults(): any

        /**
         * Check if a topic is defined
         *
         * @param {string} topicName
         * @returns {boolean}
         */
        topicExists(topicName: string): boolean

        /**
         * Retrieve a map of all existing topics
         *
         * @returns {{ [topicName: string]: mage.archivist.ITopic }}
         */
        getTopics(): { [topicName: string]: mage.archivist.ITopic }

        /**
         *
         *
         * @param {string} topicName
         * @returns {*}
         */
        getTopicApi(topicName: string, vaultName: string): mage.archivist.ITopicApi | null

        /**
         * Migrate all current vaults to a given version
         *
         * This will look at the list of available migration scripts
         * and execute them if needed.
         *
         * @returns {*}
         */
        migrateToVersion(targetVersion: string, callback: (error: Error | null) => void): any
    }

    /**
     * Configuration core module
     */
    config: typeof config,

    /**
     * HTTP Server
     *
     * This API can be used to add your own custom routes if needed, as well
     * as to serve files. This can be useful during the development of an HTML5
     * game.
     */
    httpServer: {
        /**
         * Register a route (a string or a regular expression) on the HTTP server
         *
         * Incoming requests will be expected to be handled by the handler function you pass.
         * Based on the type you specify, your handler function will receive different arguments.
         *
         * #### "simple": handler(req, res, path, query, urlInfo)
         *
         *  * req: the IncomingMessage object.
         *  * res: the ServerResponse object.
         *  * path: the path part of the URL.
         *  * query: the parsed query string.
         *  * urlInfo: all information that came out of `url.parse()`.
         *
         * #### "callback": handler(req, path, query, callback)
         *
         *  * req: the IncomingMessage object.
         *  * path: the path part of the URL.
         *  * query: the parsed query string.
         *  * callback: call this when you've constructed your HTTP response.
         *
         * The callback accepts the following arguments in order:
         *
         *  * httpCode: the HTTP status code you want to return.
         *  * out: a string or buffer that you want to send to the client.
         *  * headers: an object with headers.
         *
         * #### "websocket": handler(client, urlInfo)
         *
         *  * client: a WebSocket client connection object. See the [`ws` documentation](https://npmjs.org/package/ws).
         *  * urlInfo: all information that came out of `url.parse()`.
         *
         * #### "proxy": endpoint handler(req, urlInfo)
         *
         *  * req: the IncomingMessage object.
         *  * urlInfo: all information that came out of `url.parse()`.
         *
         * Your handler function *must* return an endpoint object to connect to.
         * For syntax, please read the [`net.createConnection()`](https://nodejs.org/docs/latest/api/net.html#net_net_createconnection)
         * documentation.
         */
        addRoute(pathMatch: string | RegExp, handlerFunction: (...args: any[]) => any, type: 'simple' | 'callback' | 'websocket' | 'proxy'):  void;

        /**
         * Removes the handler function registered on the given route.
         */
        delRoute(pathMatch: string | RegExp): void;

        /**
         * Registers a route to lead directly to a folder on disk
         *
         * If you want to be notified when a request finishes, you may pass
         * an `onFinish` function. It may receive an error as its first argument.
         * If you decide to pass this function, logging the
         * error will be your responsibility.
         *
         * Example:
         *
         * ```javascript
         * mage.core.httpServer.serveFolder('/source', './lib');
         * ```
         *
         * If you provide a `defaultFile` file name argument, serving up a
         * folder by its name will serve up a default file if it
         * exists.
         *
         * Example:
         *
         * ```javascript
         * mage.core.httpServer.serveFolder('/source', './lib', 'index.html');
         * ```
         */
        serveFolder(route: string | RegExp, folderPath:string, defaultFile?: string, onFinish?: (error?: Error) => void): void;

        /**
         * Registers a route to lead directly to a file on disk
         *
         * If you want to be notified when a request finishes, you may pass
         * an `onFinish` function. It may receive an error as its first argument.
         *
         * If you decide to pass this function, logging the error will be your responsibility.
         */
        serveFile(route: string | RegExp, filePath:string, onFinish?: (error?: Error) => void): void;

        /**
         * Registers a route "/favicon.ico" and serves the given buffer as content
         *
         * The mime type defaults to `image/x-icon` and may be overridden.
         */
        setFavicon(buffer: Buffer, mimetype?: string): void;
    }

    /**
     * The core logger is the logger instance used internally
     * by MAGE to log different events; for your application,
     * you should most likely use `mage.logger` instead
     */
    logger: Logger;

    /**
     * Message Server
     *
     * The message server is used for state propagation across
     * multiple MAGE servers in a cluster; it can also be used directly
     * by MAGE developer to transfer data across servers.
     *
     * @memberof Mage
     */
    msgServer: {
        /**
         * Message Server
         */
        mmrp: {
            Envelope: typeof MmrpEnvelope;
            MmrpNode: typeof MmrpNode;
        }

        /**
         * Check whether the Message Server is enabled
         *
         * See https://mage.github.io/mage/api.html#subsystems
         * for mor details on how to enable message server.
         *
         * @returns {boolean}
         */
        isEnabled(): boolean;

        /**
         * Retrieve the underlying MMRP Node instance
         * used by this Message Server instance.
         *
         * @returns {MmrpNode}
         */
        getMmrpNode(): MmrpNode;

        /**
         * Retrieve the unique cluster identifier
         *
         * @returns {string}
         */
        getClusterId(): string;

        /**
         * Retrieve the configuration used by this Message
         * Server instance
         *
         * @returns {*}
         */
        getPublicConfig(): any;

        /**
         * Send a message to a remote Message Server instance
         *
         * @param {string} address
         * @param {string} clusterId
         * @param {MmrpEnvelope} message
         */
        send(address: string, clusterId: string, message: MmrpEnvelope): void;

        /**
         * Broadcast a message to all connected Message Server instance
         *
         * @param {MmrpEnvelope} message
         */
        broadcast(message: MmrpEnvelope): void;

        /**
         * Send a confirmation message
         *
         * @param {string} address
         * @param {string} clusterId
         * @param {string[]} msgIds
         */
        confirm(address: string, clusterId: string, msgIds: string[]): void;

        /**
         * Mark a given address as connected
         *
         * @param {string} address
         * @param {string} clusterId
         * @param {('never' | 'always' | 'ondelivery')} [disconnects]
         */
        connect(address: string, clusterId: string, disconnects?: 'never' | 'always' | 'ondelivery'): void;

        /**
         * Mark a given address as disconnected
         *
         * @param {string} address
         * @param {string} clusterId
         */
        disconnect(address: string, clusterId: string): void;

        /**
         * Close the network connection for this Message Server
         */
        close(): void;
    }

    /**
     * Sampler core module
     *
     * Used for keeping tracks of local server metrics. This is useful
     * for when you wish to expose some information about your server
     * in production (for Zabbix, Nagios, Grafana, etc).
     *
     * See https://mage.github.io/mage/#metrics for more details.
     */
    sampler: {
        /**
         * Set the value of a given metric
         *
         * @param {string[]} path
         * @param {string} id
         * @param {number} value
         */
        set(path: string[], id: string, value: number): void;

        /**
         * Increment a given metric
         *
         * @param {string[]} path
         * @param {string} id
         * @param {number} increment
         */
        inc(path: string[], id: string, increment: number): void;

        /**
         * Keep track of a value
         *
         * When accessing the savvy HTTP interface to collect the data point
         * created by this method, you will have access to:
         *
         *   - max
         *   - min
         *   - average
         *   - standard deviation
         *
         * See https://www.npmjs.com/package/panopticon#panopticonsamplepath-id-n
         *
         * @param {string[]} path
         * @param {string} id
         * @param {number} value
         */
        sample(path: string[], id: string, value: number): void;

        /**
         * Keep track of a value over a period of time
         *
         * Works similarly to `mage.sampler.sample`, but let the user pass
         * a time delta value.
         *
         * See https://www.npmjs.com/package/panopticon#panopticontimedsamplepath-id-dt
         *
         * @param {string[]} path
         * @param {string} id
         * @param {number} delta
         */
        timedSample(path: string[], id: string, delta: number): void;
    }

    /**
     * The Service Discovery library is a library that allows you to announce and discover services
     * on the local network, through different types of engines.
     *
     * To use service discovery, configuration is mandatory;
     * See https://mage.github.io/mage/#service-discovery to learn how to configure service discovery.
     *
     * @memberof Mage
     */
    serviceDiscovery: {
        /**
         * Create a service instance
         *
         * Service instances can be used to announce services as well
         * as listen for service instance appearing and disappearing.
         *
         * @param {string} name
         * @param {('tcp' | 'udp')} type
         * @returns {mage.core.IService}
         */
        createService(name: string, type: 'tcp' | 'udp'): mage.core.IService
    }
}

declare class Mage extends NodeJS.EventEmitter {
    MageError: typeof MageError;

    /**
     * Check if a file is considered like a source code file in MAGE
     *
     * Example:
     *
     * ```javascript
     * mage.isCodeFileExtension('.js');
     * ```
     *
     * @param {string} ext File extension
     * @returns {boolean} True if the extension is for a source code file
     */
    isCodeFileExtension(ext: string): boolean;

    /**
     * The worker ID of the currently worker process
     *
     * Will return false if the process is the master process, or
     * if MAGE is running in single mode.
     *
     * This differs from cluster.worker.id because it will remain consistent
     * if restarted or reloaded.
     */
    workerId?: number;

    /**
     * The current task to execute. Internal value.
     * @memberof Mage
     */
    task: {
        /**
         * The name of the task to execute
         *
         * @type {string}
         */
        name: string;

        /**
         * Options passed to the task
         *
         * @type {*}
         */
        options: any;
    }

    /**
     * The current version of MAGE
     *
     * @type {string}
     * @memberof Mage
     */
    version: string;

    /**
     * Contains information from MAGE’s `package.json` file:
     *
     *   - name: “mage”
     *   - version: The version of MAGE.
     *   - path: The path to MAGE on disk.
     *   - package: The parsed contents of MAGE’s package.json file.
     *
     * @type {any}
     * @memberof Mage
     */
    magePackage: any;

    /**
     * Contains information from your project's `package.json` file:
     *
     *   - name: “mage”
     *   - version: The version of MAGE.
     *   - path: The path to MAGE on disk.
     *   - package: The parsed contents of MAGE’s package.json file.
     *
     * @type {any}
     * @memberof Mage
     */
    rootPackage: any;

    /**
     * Requiring MAGE's dependencies into games
     *
     * This should only be used to load the tomes module (when used).
     *
     * @param {string} packageName
     * @returns {*}
     *
     * @memberOf Mage
     */
    require(packageName: string): any;

    /**
     * Return MAGE's current run state
     *
     * @returns {string}
     *
     * @memberOf Mage
     */
    getRunState(): 'setup' | 'running' | 'quitting';

    /**
     * Set MAGE's current run state
     *
     * @param {('setup' | 'running' | 'quitting')} state
     * @returns {string}
     *
     * @memberOf Mage
     */
    setRunState(state: 'setup' | 'running' | 'quitting'): string;

    /**
     * Set which MAGE task to execute.
     *
     * @param {string} name
     * @param {*} options
     *
     * @memberOf Mage
     */
    setTask(name: string, options: any): void;

    /**
     * Get the task to be executed
     *
     * @returns {mage.core.ITask}
     *
     * @memberOf Mage
     */
    getTask(): mage.core.ITask;

    /**
     * Quit MAGE
     *
     * This will stop ALL MAGE processes regardless of where it
     * is called from. To stop only the local process (similarly
     * to what `process.exit` would do, please see `mage.exit`)
     *
     * @param {number} [exitCode] exit code to use
     * @param {boolean} [hard] If true, exit immediately (exit code will be ignored and set to 1)
     */
    quit(exitCode?: number, hard?: boolean) : never;

    /**
     * Shut down MAGE
     *
     * When setting `hard` to true, MAGE will not try to complete current I/O
     * operations and exit immediately; you should avoid using `hard` unless there
     * are no other options available to you.
     *
     * Note that this will behave similarly to `process.exit`; only the *current*
     * process will be stopped, not the entire server. To stop the entire server,
     * see `mage.quit`
     *
     * @param {number} [exitCode] exit code to use
     * @param {boolean} [hard] If true, exit immediately (exit code will be ignored and set to 1)
     *
     * @memberOf Mage
     */
    exit(exitCode?: number, hard?: boolean) : never;

    // deprecated
    // fatalError(...args: any[]): never;

    /**
     * Add a new lookup path when attempting to load modules
     *
     * @param {string} path
     *
     * @memberOf Mage
     */
    addModulesPath(path: string) : void;

    /**
     * Define which modules to load at runtime
     *
     * @param {string[]} moduleNames
     * @returns {this}
     *
     * @memberOf Mage
     */
    useModules(moduleNames: string[]): this;

    /**
     * Tell MAGE to load all your application's modules
     *
     * MAGE will then load all modules found under your project's
     * `./lib/modules` folder.
     *
     * @returns {this}
     *
     * @memberOf Mage
     */
    useApplicationModules(): this;

    /**
     * Return the path from which a given module was loaded from
     *
     * @param {string} name
     * @returns {string}
     *
     * @memberOf Mage
     */
    getModulePath(name: string): string;

    /**
     * List all loaded modules
     *
     * @returns {string[]}
     *
     * @memberOf Mage
     */
    listModules(): string[];

    /**
     * Setup MAGE modules.
     *
     * You should not need to call this manually
     * unless you are trying to manually set up MAGE
     * for some special use case.
     *
     * @param {Function} cb
     *
     * @memberof Mage
     */
    setupModules(cb: (error: Error|null) => void): void;

    /**
     * Setup MAGE
     *
     * You should not need to call this manually
     * unless you are trying to manually set up MAGE
     * for some special use case.
     *
     * @param {Function} [cb]
     * @returns {IMage}
     *
     * @memberof Mage
     */
    setup(cb?: (error: Error|null) => void): Mage;

    /**
     * Start MAGE
     *
     * You should not need to call this manually
     * unless you are trying to manually set up MAGE
     * for some special use case.
     *
     * @param {Function} [cb]
     * @returns {IMage}
     *
     * @memberof Mage
     */
    start(cb?: (error: Error|null) => void): Mage;

    /**
     * Boot the MAGE server
     *
     * You normally will not have to call this manually; the
     * `mage` binary referred to in your project's `package.json` will
     * call this for you.
     *
     * However, you will need to call this in cases
     * where you wish to create your own binary entry point (when creating a debug console
     * to run MAGE under special conditions, for instance).
     *
     * @param {Function} [callback]
     *
     * @memberof Mage
     */
    boot(allback?: (error: Error|null) => void): void;

    /**
     * Verify if development mode is currently activated, or
     * if a given development mode feature is activated
     *
     * @param {string} [feature]
     * @returns {boolean}
     *
     * @memberOf Mage
     */
    isDevelopmentMode(feature?: string): boolean;

    /**
     * Retrieve a given app's configuration
     *
     * @param {string} appName
     * @param {string} baseUrl
     * @returns {*}
     *
     * @memberof Mage
     */
    getClientConfig(appName: string, baseUrl: string): any;

    /**
     * auth module
     *
     * The auth module can be used to register and authenticate users
     *
     * @memberof Mage
     */
    auth: {
        /**
         * Authenticate a user.
         *
         * In general, you will want to create a session for a user upon authentication;
         * therefore you will generally want to use `login` instead.
         */
        authenticate(state: mage.core.IState, username: string, password: string, callback: AuthenticateCallback): void;

        /**
         * User login
         */
        login(state: mage.core.IState, username: string, password: string, callback: LoginCallback): void;

        /**
         * Login a user as an anonymous user
         *
         * This allows for user-to-user events to be emitted, even if a given user
         * does not exist.
         */
        loginAnonymous(state: mage.core.IState, options: mage.auth.IAuthOptions): Session;

        /**
         * Register a new user
         */
        register(state: mage.core.IState, username: string, password: string, options: mage.auth.IAuthOptions, callback: RegisterCallback): void;

        /**
         * Change a user's password.
         */
        changePassword(state: mage.core.IState, username: string, newPassword: string, callback: ChangePasswordCallback): void;

        /**
         * Ban the user
         */
        ban(state: mage.core.IState, username: string, callback: BanCallback): void;

        /**
         * Unban the user
         */
        unban(state: mage.core.IState, username: string, callback: UnbanCallback): void;
    }

    /**
     * Command-line interface API
     *
     * The cli property is a library that lets you extend and boot up the command-line
     * argument parser.
     *
     * @type {MageCore}
     * @memberOf Mage
     */
    cli: {
        /**
         * Parse the process arguments obtained via process.argv
         *
         * @returns {void}
         */
        run(): void

        /**
         * Commander object which allows you to extend the provided CLI
         *
         * ```javascript
         * var cli = require('mage').cli;
         * cli.program.option('--clown', 'Enables clown mode');
         * cli.run();
         * ```
         *
         * With the previous code, you should obtain the following:
         *
         * ```shell
         * $ ./game --verbose --help
         *
         *   Usage: game [options] [command]
         * ...
         *   Options:
         * ...
         *   --clown                Enables clown mode
         * ```
         */
        program: commander.CommanderStatic
    }

    /**
     * Core modules
     *
     * @type {MageCore}
     * @memberOf Mage
     */
    core: IMageCore

    /**
     * Logger module
     *
     * The logger module should be used to capture log entries; it can be configured to
     * send logs to one or multiple logging backend (syslog, file, etc).
     *
     * See https://mage.github.io/mage/#logging for more details.
     *
     * @type {Logger}
     * @memberOf Mage
     */
    logger: Logger;

    /**
     * Session module
     *
     * The session module can be used to create a session
     * object, which will then normally be accessible through
     * the `state.session` key on the state object received
     * through user commands.
     *
     * @memberOf Mage
     */
    session: {
        /**
         * Register a new session
         *
         * @param {State} state
         * @param {string} actorId
         * @param {string} language
         * @param {*} meta
         */
        register(state: mage.core.IState, actorId: string, language: string, meta: any): void;

        /**
         * Transfer a session and its content to another user
         *
         * Mostly used for testing purposes.
         *
         * @param {State} state
         * @param {string} fromActorId
         * @param {string} toActorId
         * @param {Function} callback
         */
        reassign(state: mage.core.IState, fromActorId: string, toActorId: string, callback: Function): void;
    }

    /**
     * Time module
     *
     * The time module can be used to affect how time is perceived from the MAGE
     * process' perspective. This is mostly useful when either writing tests (like unit tests)
     * or simulations (run an instance of your game server faster to, for instance, play a full
     * week of your game within a few hours).
     *
     * See https://mage.github.io/mage/#time-manipulation for more details.
     * @memberOf Mage
     */
    time: {
        /**
         * Change the current time, and how quickly time advances
         *
         * You may use the offset to specify how far back or forward in time you wish to
         * go, and the acceleration factor to decide how fast (or slow) should time pass.
         *
         * The `startAt` attribute might be a bit confusing; in essence, the only time you should
         * need to set it is when you wish to specify from which time in the past timestamps should be
         * translated based on the acceleration factor. Therefore, unless you use an acceleration factor
         * other than 1, setting this will have no effect.
         *
         * In short, you should almost never have to use the `startAt` attribute.
         *
         * See https://github.com/Wizcorp/timer.js/blob/master/index.js#L37 for more details.
         *
         * @param {number} offset in milliseconds (default: 0)
         * @param {number} accelerationFactor How fast should time move forward. (default: 1)
         * @param {number} startAt From which point in time do we consider time to be accelerated (default: Date.now())
         */
        bend(offset: number, accelerationFactor: number, startAt: number): void;

        /**
         * Return the current time configuration (offset, acceleration factor and acceleration start time)
         *
         * @returns {TimeConfig}
         */
        getConfig(): TimeConfig;

        /**
         * Get the current time according to MAGE, in milliseconds
         *
         * You can use this to instanciate Date objects:
         *
         * ```javascript
         * var date = Date(mage.time.msec());
         * ```
         *
         * @returns {number}
         */
        msec(): number;

        /**
         * Get the current time according to MAGE, in seconds
         *
         * @returns {number}
         */
        sec(): number;

        /**
         * Translate a given timestamp
         *
         * Sometimes, you will need to take a given timestamp and calculate
         * its relative representation according to MAGE time settings. In general,
         * you will only need to use this when using `mage.time.bend`; however,
         * using it when time is not bent will simply have no effect on the passed value.
         *
         * @param {number} timestamp The timestamp to translate
         * @param {boolean} [msecOut] True if the timestamp passed is in milliseconds, false or null if in seconds
         * @returns {number} The translated timestamp according to the current time rules enforced by `mage.time.bend`
         */
        translate(timestamp: number, msecOut?: boolean): number;

        /**
         * Remove the effect of `mage.time.bend`
         *
         * This effectively resets the clock to the current time.
         */
        unbend(): void;
    }
}

declare var mage: Mage;

declare namespace mage {
    namespace archivist {
        /**
         * The media type defines how the data will be deserialized when read from a topic, and
         * how it will be serialized before it is written to a topic.
         */
        type ArchivistMediaType = 'application/json' | 'application/octet-stream' | 'application/x-tome' | 'text/plain' | string;

        /**
         * Defines to what type of data structure a topic instance will be deserialized into. It is also used
         * in some cases to specify to a serialization method what is the data type of the data we are feeding in.
         */
        type ArchivistEncoding = 'utf8' | 'buffer' | 'live';

        /**
         * Callback functions
         */
        type ArchivistExistsCallback = (error: Error|null, doesValueExist: boolean) => void;

        type ArchivistGetCallback<T> = (error: Error|null, value: T) => void;

        type ArchivistMGetCallback<T> = (error: Error|null, value: T[]) => void;

        type ArchivistNamedMGetCallback<T> = (error: Error|null, value: { [name: string]: T }) => void;

        type ArchivistListCallback = (error: Error|null, indexes: mage.archivist.IArchivistIndex[]) => void;

        type ArchivistDistributeCallback = (preDistributionErrors: Error[], distributionErrors: Error[]) => void;

        interface IArchivistGetOptions {
            /**
             * Is the value optional?
             *
             * Default is false; when false, `get` will trigger an error
             * if the value being queried does not exist.
             *
             * @type {boolean}
             */
            optional?: boolean;

            /**
             * Media type
             *
             * @type {ArchivistMediaType[]}
             */
            mediaTypes?: ArchivistMediaType[];

            /**
             * Encoding
             *
             * @type {ArchivistEncoding[]}
             */
            encodings?: ArchivistEncoding[];
        }

        interface IArchivistListSortOption {
            /**
             * Name of the index field to sort on
             *
             * @type {string}
             */
            name: string;

            /**
             * Direction in which to order by
             *
             * @type {('asc' | 'desc')}
             */
            direction?: 'asc' | 'desc';
        }

        interface IArchivistListOptions {
            /**
             * List of sort options
             *
             * @type {ArchivistListSortOption[]}
             */
            sort?: IArchivistListSortOption[];

            /**
             * Pagination option
             *
             * The array needs to be of the following structure:
             *
             * [start, length]
             *
             * Where:
             *
             *   * start: is the entry to start from
             *   * length: how many entries to return from the starting point
             *
             * @type {number[]}
             */
            chunk: number[];
        }

        /**
         * Scans can set options for both listing and getting.
         */
        type ArchivistScanOptions = IArchivistGetOptions & IArchivistListOptions;

        /**
         * Key-value map of index field names and their expected value.
         */
        interface IArchivistIndex { [id: string] : string; }

        /**
         * An IArchivistQuery is a combination of a topic name, and
         * an ArchivistIndex. When making query, it is possible to give only a
         * partial index, that is an index which only defines a value for
         * some (not all) the index's fields.
         */
        interface IArchivistQuery {
            topic: string;
            index: IArchivistIndex;
            options?: IArchivistGetOptions;
        }

        /**
         * An INamedArchivistQuery can be used with mget
         * to retrieve multiple values at once in a key-value map.
         *
         * Note you can also pass IArchivistIndex[] to mget
         * instead if you wish to receive back an interatable array.
         */
        interface INamedArchivistQuery {
           [name: string]: IArchivistQuery
        }

        /**
         * Register what operations are allowed.
         *
         * Note that this is executed directly at configuration time;
         * it is not something which gets executed as a validation function
         * at verification time.
         *
         * To limit what a given user has access to at runtime, please
         * see `ArchivistTopicVaultConfiguration.shard`.
         *
         * @interface AclTest
         * @extends {Function}
         */
        interface IAclTest extends Function {
            (acl: string[], operation: VaultOperation | 'get' | '*', options?: { shard: boolean }): void;
        }

        /**
         * Define how data will be read, serialized and deserialized.
         *
         * Other configuration attributes may be available depending on
         * the vault backend being used by the parent topic.
         *
         * Please see https://mage.github.io/mage/api.html#vaults, and look for the
         * paragraph called "Required topic API" for your current vault; any functions
         * defined there can be overridden for your given topic.
         */
        interface IArchivistTopicVaultConfiguration {
            shard?<T>(value: IVaultValue): T,
            acl?: (test: IAclTest) => void
        }

        /**
         * Define the topic's configuration.
         *
         * @interface ITopic
         */
        interface ITopic {
            index: string[],
            vaults: {[name: string]: IArchivistTopicVaultConfiguration},
            readOptions?: mage.archivist.IArchivistGetOptions,
            afterLoad?: () => void,
            beforeDistribute?: () => void
        }

        /**
         * Contains the index fields, and methods for
         * processing a given topics on a given vault backend
         *
         * @interface ITopicApi
         */
        interface ITopicApi {
            /**
             * List of index fields
             *
             * @type {string[]}
             * @memberof ITopicApi
             */
            index: string[]

            /**
             * Serialize the data
             *
             * @memberof ITopicApi
             */
            serialize?: (value: any) => {mediaType: mage.archivist.ArchivistMediaType, data: any, encoding: string }

            /**
             * Deserialize the data
             *
             * @memberof ITopicApi
             */
            deserialize?: (mediaType: mage.archivist.ArchivistMediaType, data: any, encoding: string) => any

            /**
             * Generate a storage key from the topic name and the index information
             *
             * @memberof ITopicApi
             */
            createKey?: (topicName: string, index: mage.archivist.IArchivistIndex) => any,

            /**
             * Shard function
             *
             *
             * @memberof ITopicApi
             */
            shard?: (value: mage.archivist.IVaultValue) => string | number,

            /**
             * Object containing the ACL information, per level
             *
             * @type {*}
             * @memberof ITopicApi
             */
            acl?: { [level: string]: { ops: VaultOperation | 'get' | '*', shard?: boolean } }
        }

        interface IVaultValue {
            /**
             * The topic of origin
             *
             * @type {string}
             * @memberOf VaultValue
             */
            topic: string;

            /**
             * The index by which this value can be accessed
             *
             * @type {string[]}
             * @memberOf VaultValue
             */
            index: mage.archivist.IArchivistIndex;

            /**
             * Expiration timeout (unix timestamp, in seconds)
             *
             * If undefined, this value will never expire.
             *
             * @type {(number | undefined)}
             * @memberOf VaultValue
             */
            expirationTime?: number;

            /**
             * Archivist media type
             *
             * @type {ArchivistMediaType}
             * @memberOf VaultValue
             */
            mediaType: ArchivistMediaType;

            /**
             * Is the value going to be deleted from our vault backends?
             *
             * @type {boolean}
             * @memberof VaultValue
             */
            didExist: boolean;

            /**
             * Will the value be created in our vault backends?
             *
             * @type {boolean}
             * @memberof VaultValue
             */
            willExist: boolean;

            /**
             * The data stored in this entry
             *
             * @type {*}
             * @memberOf VaultValue
             */
            data: any;

            /**
             * Delete the currently scheduled operation for this vault value
             */
            resetOperation(): void;

            /**
             * Check if an operation has been scheduled on this vault value
             *
             * @returns {boolean}
             *
             * @memberof VaultValue
             */
            hasOperation(): boolean;

            /**
             * Return the operation scheduled for execution on this vault value
             *
             * @param {string} vault
             * @returns {(VaultOperation | null)}
             *
             * @memberof VaultValue
             */
            getOperationForVault(vault: string): VaultOperation | null;

            /**
             * Register a read miss
             *
             * You should not have to call this manually in most cases.
             *
             * @param {string} vault
             *
             * @memberof VaultValue
             */
            registerReadMiss(vault: string): void;

            /**
             * Schedule a data set on the different vault backends
             *
             * @param {string} mediaType
             * @param {*} data
             * @param {string} encoding
             *
             * @memberof VaultValue
             */
            set(mediaType: string, data: any, encoding: string): void;

            /**
             * Schedule the set of the expiration time for the vault value (on supported vault backends)
             *
             * @param {number} expirationTime
             *
             * @memberof VaultValue
             */
            touch(expirationTime: number): void;

            /**
             * Mark the vault value for deletion in the different vault backends
             *
             * @memberof VaultValue
             */
            del(): void;

            /**
             * Retrieve the data diff for this vault value.
             *
             * This will only works on values with a mediaType supporting diffs (so currently, only tomes)
             *
             * @returns {(object[]|null)}
             *
             * @memberof VaultValue
             */
            getDiff(): object[]|null;

            /**
             * Apply a diff to the vault value.
             *
             * This will only works on values with a mediaType supporting diffs (so currently, only tomes)
             *
             * @param {*} diff
             *
             * @memberof VaultValue
             */
            applyDiff(diff: any): void;
        }
    }

    namespace auth {
        interface IAuthOptions {
            userId?: string|number
            acl: string[]
        }
    }

    namespace core {
        /**
         * Tasks are what `mage.cli` will execute for the duration
         * of this MAGE's run cycle.
         *
         * @interface ITask
         */
        interface ITask {
            setup?(cb: (error: Error|null) => void): void;
            start?(cb: (error: Error|null) => void): void;
            shutdown?(cb: (error: Error|null) => void): void;
        }

        /**
         * Defines what lifecycle methods can be exposed by any MAGE modules
         *
         * @interface IModule
         */
        interface IModule {
            setup?(state: IState, cb: (error: Error|null) => void): void;
        }

        /**
         * Defines what user commands may be consisted of
         *
         * @interface IUserCommand
         */
        interface IUserCommand {
            /**
             * What user levels are allowed to access
             * this user command
             */
            acl?: string[];

            /**
             * Timeout for the user command
             *
             * By default, the user command will be allowed
             * to run forever.
             */
            timeout?: number;

            /**
             * The code of the user command itself
             */
            execute<T>(state: IState, ...args: any[]): Promise<T>;
        }

        /**
         * Logger interface
         *
         * This is useful when you wish, for instance, to add a logger
         * instance to a class.
         *
         * ```typescript
         * class MyClass {
         *   private _logger: mage.core.ILogger
         *
         *   constructor() {
         *     this._logger = mage.logger.context('MyClass')
         *   }
         * }
         * ```
         *
         * @interface ILogger
         * @extends {Logger}
         */
        interface ILogger extends Logger {}

        /**
         * IService interface
         *
         * IService is an interface describing the service instance
         * returned by `mage.core.serviceDiscovery.createService`
         *
         * For some examples of how you can use this API, see
         * https://mage.github.io/mage/api.html#examples
         *
         * @export
         * @interface IService
         */
        export interface IService {
            /**
             * Announce the service as a new available service instance
             *
             * @param {number} port
             * @param {*} metadata
             * @param {(error?: Error) => void} callback
             * @memberof IService
             */
            announce(port: number, metadata: any, callback: (error?: Error) => void): void;

            /**
             * Start listening for the presence of service instances
             *
             * @memberof IService
             */
            discover(): void;

            /**
             * Event listener
             *
             * @param {ServiceEventName} eventName
             * @param {(ServiceEventHandler | ServiceErrorEventHandler)} handler
             * @memberof IService
             */
            on(eventName: ServiceEventName, handler: ServiceEventHandler | ServiceErrorEventHandler): void;

            /**
             * Event listener
             *
             * @param {ServiceEventName} eventName
             * @param {(ServiceEventHandler | ServiceErrorEventHandler)} handler
             * @memberof IService
             */
            once(eventName: ServiceEventName, handler: ServiceEventHandler | ServiceErrorEventHandler): void;

            /**
             * Remove all instances of an event listener
             *
             * @param {ServiceEventName} eventName
             * @param {(ServiceEventHandler | ServiceErrorEventHandler)} handler
             * @memberof IService
             */
            removeAllListeners(eventName: ServiceEventName): void;

            /**
             * Remove an instance of an event listener
             *
             * @param {ServiceEventName} eventName
             * @param {(ServiceEventHandler | ServiceErrorEventHandler)} handler
             * @memberof IService
             */
            removeListener(eventName: ServiceEventName, handler: ServiceEventHandler | ServiceErrorEventHandler): void;
        }

        /**
         * IServiceNode interface
         *
         * IServiceNode are received through the `on` and `once` event listeners;
         * they normally contain the network information and metadata necessary for
         * you to be able to connect and use this service instance.
         *
         * @export
         * @interface IServiceNode
         */
        export interface IServiceNode {
            /**
             * Host name
             *
             * @type {string}
             * @memberof IServiceNode
             */
            host: string;

            /**
             * Port number
             *
             * @type {number}
             * @memberof IServiceNode
             */
            port: number;

            /**
             * List of available addresses
             *
             * Some services may be running on machines with more than one
             * network interface; here, you will find a list of all announced
             * IP addresses to connect through those different interfaces.
             *
             * @type {string[]}
             * @memberof IServiceNode
             */
            addresses: string[];

            /**
             * Metadata
             *
             * This data is the same as the one that gets registered
             * through `IService.announce`.
             *
             * @type {*}
             * @memberof IServiceNode
             */
            data: any;

            /**
             * Retrieve an IP from the addresses list
             *
             * The `network` parameter is an array containing the network list
             * where your service is. The CIDR notation is used to represent the networks.
             *
             * This method may return `null` if no addresses could be found within
             * the list of provided networks, or if the node provides no networks.
             *
             * @param {(4 | 6)} version
             * @param {string[]} [networks]
             * @memberof IServiceNode
             */
            getIp(version: 4 | 6, networks?: string[]): string | null;
        }

        /**
         * Options you can pass when you manually create a state object
         */
        export interface IStateOptions {
            /**
             * The name of the application this state was created in
             */
            appName?: string;

            /**
             * A description of what this state is being used for
             */
            description?: string;

            /**
             * State metadata
             *
             * This data can be used to carry data around through the execution path.
             */
            data?: Object
        }

        export interface IState {
            /**
             * Actor ID
             *
             * Depending on how the state object was created, the actor ID
             * may hold different meaning; however, it will in most cases
             * hold the session ID of the user currently executing the user command.
             * This will only apply to users authenticated through the auth module.
             *
             * @type {string}
             * @memberof IState
             */
            actorId: string | null;

            /**
             * Archivist instance
             *
             * When a state is received through a user command, use this archvist instance
             * to make your data transactions. The state will automatically call `distribute`
             * upon a successful user command execution.
             *
             * @type {Archivist}
             * @memberOf State
             */
            archivist: Archivist;

            /**
             * Session instance
             *
             * @type {Session|null}
             * @memberOf State
             */
            session: Session | null;

            /**
             * State metadata
             *
             * This data can be used to carry data around through the execution path.
             */
            data?: Object

            /**
             * Reply to the user
             *
             * This will generally be called in synchronouse user commands to specify
             * what value to return to the end-user.
             *
             * Note that asynchronous user commands as defined in
             * https://mage.github.io/mage/#using-async-await-node-7-6
             * do not require you to call `state.respond`; instead, simply `return`
             * the data you wish to send to the end-user.
             *
             * @param {*} data
             *
             * @memberOf State
             */
            respond(data: any): void;

            /**
             * Return an error to the user
             *
             * This will generally be called in synchronouse user commands to specify
             * that an error has occured, and that no response data is to be expected.
             *
             * Note that asynchronous user commands as defined in
             * https://mage.github.io/mage/#using-async-await-node-7-6
             * do not require you to call `state.error`; instead, you can simply
             * throw an Error. If the Error instance has a `code` attribute, the code
             * will then also be returned as part of the response to the end-user.
             *
             *
             * @param {(string | number)} code
             * @param {Error} error
             * @param {Function} callback
             *
             * @memberOf State
             */
            error(code: string | number, error: Error, callback: Function): void;

            /**
             * Parse a list of actorIds, and verify who is online
             */
            findActors(actorIds: string[], callback: (error: Error | null, actors: {
                online: string[],
                offline: string[]
            }) => void): void;

            /**
             * Send an event to the user
             *
             * Note that the event will be blackholed if an user with a given actorId
             * is not currently connected.
             *
             * @param {(string | string[])} actorId
             * @param {string | number} eventName
             * @param {*} data
             *
             * @memberOf State
             */
            emit<T>(actorId: string | string[], eventName: string | number, data: T, configuration?: mage.core.IStateEmitConfig): void;

            /**
             * Broadcast an event to all connected users
             *
             * @param {string | number} eventName
             * @param {*} data
             *
             * @memberOf State
             */
            broadcast<T>(eventName: string | number, data: T, configuration?: mage.core.IStateEmitConfig): void;

            /**
             * Distribute both events and archivist operations
             * currently stacked on this state object.
             *
             * @memberOf State
             */
            distribute(callback: (error?: Error) => void): void;

            /**
             * Distribute all events currently stacked on
             * this state object.
             *
             * If you wish to also distribute archivist mutations stacked
             * on this state, please have a look at the `distribute` method
             * instead.
             *
             * @memberOf State
             */
            distributeEvents(callback: (error?: Error) => void): void;

            /**
             * Close this state object
             *
             * **Note**: You should never really have to use this method, it is
             * only documented for informational purposes.
             *
             * This will trigger the same thing as `distribute`, but will
             * return the response value set on the state and the
             * events to be returned directly to the actor this state refers
             * to.
             *
             * @memberOf State
             */
            close(callback: (error: Error | null, data: { response: any, events: any }) => void): void;

            /**
             * Register a session on the user
             *
             * @param {*} session
             *
             * @memberOf State
             */
            registerSession(session: any): void;

            /**
             * Forget the current session for the current user
             *
             *
             * @memberOf State
             */
            unregisterSession(): void;

            /**
             * Verify the current user's credentials
             *
             * @param {*} acl
             * @returns {boolean}
             *
             * @memberOf State
             */
            canAccess(acl: any): boolean;

            /**
             * Define a timeout on the state
             *
             * Once the timeout is reached, the state will automatically
             * report an error to the end-user.
             *
             * Note that you do not have to call `clearTimeout` manually when
             * receiving a state in a user command; this will be done automatically for you.
             *
             * @param {number} timeout
             *
             * @memberOf State
             */
            setTimeout(timeout: number): void;

            /**
             * Clear a given state's timeout
             *
             *
             * This will do nothing if a timeout is not set on the state
             *
             * @memberOf State
             */
            clearTimeout(): void;
        }

        /**
         * State emit/broadcast optional configuration
         */
        export interface IStateEmitConfig {

            /**
             * Set if the data to emit has already been stringified
             *
             * In some cases, you might want to emit data that has already been
             * serialized to a JSON string; to do so, set this option to true.
             */
            isJson?: boolean;

            /**
             * Always emit, even on error
             *
             * By default, events will only be emitted if the related call
             * is successful; however, you might want to make sure an event
             * will always be emitted, even on error. Set this configuration
             * entry to `true` to make sure the event will always be emitted.
             */
            alwaysEmit?: boolean;
        }
    }
}

export = mage;

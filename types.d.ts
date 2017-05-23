/// <reference types="node" />

/**
 * The media type defines how the data will be deserialized when read from a topic, and
 * how it will be serialized before it is written to a topic.
 */
declare type ArchivistMediaType = 'application/json' | 'application/octet-stream' | 'application/x-tome' | 'text/plain' | string;

/**
 * Defines to what type of data structure a topic instance will be deserialized into. It is also used
 * in some cases to specify to a serialization method what is the data type of the data we are feeding in.
 */
declare type ArchivistEncoding = 'utf8' | 'buffer' | 'live';

/**
 * Callback functions
 */
declare type ArchivistExistsCallback = (error: Error|null, doesValueExist: boolean) => void;

declare type ArchivistGetCallback<T> = (error: Error|null, value: T) => void;

declare type ArchivistMGetCallback<T> = (error: Error|null, value: T[]) => void;

declare type ArchivistListCallback = (error: Error|null, indexes: mage.archivist.IArchivistIndex[]) => void;

declare type ArchivistDistributeCallback = (preDistributionErrors: Error[], distributionErrors: Error[]) => void;

declare type VaultOperation = 'add' | 'set' | 'del' | 'touch';

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
    exists(topicName: string, index: mage.archivist.IArchivistIndex, callback: ArchivistExistsCallback): void;

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
    get<T>(topicName: string, index: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistGetOptions, callback: ArchivistGetCallback<T>): void;
    get<T>(topicName: string, index: mage.archivist.IArchivistIndex, callback: ArchivistGetCallback<T>): void;

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
    getValue(topicName: string, index: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistGetOptions, callback: ArchivistGetCallback<mage.archivist.IVaultValue>): void;
    getValue(topicName: string, index: mage.archivist.IArchivistIndex, callback: ArchivistGetCallback<mage.archivist.IVaultValue>): void;

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
    mget<T>(queries: mage.archivist.IArchivistQuery[], options: mage.archivist.IArchivistGetOptions, callback: ArchivistMGetCallback<T>): void;
    mget<T>(queries: mage.archivist.IArchivistQuery[], callback: ArchivistMGetCallback<T>): void;

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
    mgetValues(queries: mage.archivist.IArchivistQuery[], options: mage.archivist.IArchivistGetOptions, callback:  ArchivistMGetCallback<mage.archivist.IVaultValue>): void;
    mgetValues(queries: mage.archivist.IArchivistQuery[], callback: ArchivistMGetCallback<mage.archivist.IVaultValue>): void;

    /**
     * Scan the backend vault for matching indexes, and return them
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
     * to fetch the data, you will want to call `mget` using the returned list of indexes.
     *
     * See https://mage.github.io/mage/#key-based-filtering for more details.
     *
     * @param {string} topicName
     * @param {ArchivistIndex} partialIndex
     * @param {ArchivistOptions} [options]
     * @param {Function} callback
     *
     * @memberOf Archivist
     */
    list(topicName: string, partialIndex: mage.archivist.IArchivistIndex, options: mage.archivist.IArchivistListOptions, callback: ArchivistListCallback): void;
    list(topicName: string, partialIndex: mage.archivist.IArchivistIndex, callback: ArchivistListCallback): void;

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
    add<T>(topicName: string, index: mage.archivist.IArchivistIndex, data: T, mediaType: ArchivistMediaType, encoding: ArchivistEncoding, expirationTime: number): void;

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
    set<T>(topicName: string, index: mage.archivist.IArchivistIndex, data: T, mediaType: ArchivistMediaType, encoding: ArchivistEncoding, expirationTime: number): void;

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
     *
     *
     * @param {string} topicName
     * @param {ArchivistIndex} index
     * @param {number} expirationTime
     *
     * @memberOf Archivist
     */
    touch(topicName: string, index: mage.archivist.IArchivistIndex, expirationTime: number): void;

    /**
     *
     *
     * @param {*} [options]
     * @param {(preDistributionErrors: Error[], distributionErrors: Error[]) => void} callback
     *
     * @memberOf Archivist
     */
    distribute(callback: ArchivistDistributeCallback): void;
}

/**
 * Auth callbacks
 */
declare type AuthenticateCallback = (error: Error|null, userId: string|number, acl: string[]) => void;

declare type LoginCallback = (error: Error|null, session: Session) => void;

declare type RegisterCallback = (error: Error|null, session: Session) => void;

declare interface Log extends Function {
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
     * @type {Log}
     * @memberOf Logger
     */
    verbose: Log;

    /**
     * Game server debugging information
     *
     * @type {Log}
     * @memberOf Logger
     */
    debug: Log;

    /**
     * User command request information
     *
     * @type {Log}
     * @memberOf Logger
     */
    info: Log;

    /**
     * 	Services state change notification (example: third-party services and databases)
     *
     * @type {Log}
     * @memberOf Logger
     */
    notice: Log;

    /**
     * An unusual situation occurred, which requires analysis
     *
     * @type {Log}
     * @memberOf Logger
     */
    warning: Log;

    /**
     * A user request caused an error. The user should still be able to continue using the services
     *
     * @type {Log}
     * @memberOf Logger
     */
    error: Log;

    /**
     * A user is now stuck in a broken state which the system cannot naturally repair
     *
     * @type {Log}
     * @memberOf Logger
     */
    critical: Log;

    /**
     * Internal services (data store API calls failed, etc) or external services are failing
     *
     * @type {Log}
     * @memberOf Logger
     */
    alert: Log;

    /**
     * The app cannot boot or stopped unexpectedly
     *
     * @type {Log}
     * @memberOf Logger
     */
    emergency: Log;
}

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

/**
 * Configuration labels can take one of the following formats:
 *
 *   - 'a.b.c'
 *   - ['a', 'b', 'c']
 */
type ConfigurationLabel = string|string[];

declare class Mage extends NodeJS.EventEmitter {
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
     * Shut down MAGE
     *
     * When setting `hard` to true, MAGE will not try to complete current I/O
     * operations and exit immediately; you should avoid using `hard` unless there
     * are no other options available to you.
     *
     * @param {number} [exitCode] exit code to use
     * @param {boolean} [hard] If true, exit immediately (exit code will be ignored and set to 1)
     *
     * @memberOf Mage
     */
    quit(exitCode?: number, hard?: boolean) : never;

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
    }

    /**
     * Core modules
     *
     * @type {MageCore}
     * @memberOf Mage
     */
    core: {
        /**
         * State class
         *
         * @type {{ new(): mage.core.IState }}
         */
        State: { new(): mage.core.IState };

        /**
         * Configuration core module
         */
        config: {
            /**
             * Apply a default configuration from a given configuration file
             * to a configuration sub-path.
             *
             * This will always be applied prior to loading user-land configuration
             * files.
             *
             * Example:
             *
             * ```javascript
             * var moduleName = 'myModule';
             * var configAccessPath = 'modules.' + moduleName
             * var defaultConfigFilePath = path.join(process.cwd(), 'lib/modules', moduleName, 'config.yaml')
             * mage.core.config.setTopLevelDefault(configAccessPath, defaultConfigFilePath);
             * ```
             *
             * @param {string} name
             * @param {string} sourcePath
             */
            setTopLevelDefault(moduleName: string, sourcePath: string): void;

            /**
             * Get the current configuration value for a label
             *
             * @param {ConfigurationLabel} label Configuration label to search for
             * @param {*} [defaultValue] Value to use if not defined in the configuration
             * @returns {*}
             */
            get(label: ConfigurationLabel, defaultValue?: any): any;

            /**
             * Find which configuration file a current configuration value comes from.
             *
             * @param {ConfigurationLabel} label Configuration label to search for
             * @returns {string} The configuration file the value originates from
             */
            getSource(label: ConfigurationLabel): string;
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
    };

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
     * The session module can be used to
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
     * See https://github.com/mage/mage/tree/master/lib/modules/time for more details.
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
         * Key-value map of index field names and their expected value.
         */
        interface IArchivistIndex { [id: string] : string; }

        /**
         * An ArchivistQuery is a combination of a topic name, and
         * an ArchivistIndex. When making query, it is possible to give only a
         * partial index, that is an index which only defines a value for
         * some (not all) the index's fields.
         */
        interface IArchivistQuery {
            topic: string;
            index: IArchivistIndex;
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
             * Schedule a value add to the different vault backends
             *
             * @param {string} mediaType
             * @param {*} data
             * @param {string} encoding
             *
             * @memberof VaultValue
             */
            add(mediaType: string, data: any, encoding: string): void;

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
            acl?: string[];
            execute<T>(state: IState, ...args: any[]): Promise<T>;
        }

        export interface IState {
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
            emit<T>(actorId: string | string[], eventName: string | number, data: T): void;

            /**
             * Broadcast an event to all connected users
             *
             * @param {string | number} eventName
             * @param {*} data
             *
             * @memberOf State
             */
            broadcast<T>(eventName: string | number, data: T): void;

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
    }
}

export = mage;

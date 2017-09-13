/**
 * Configuration labels can take one of the following formats:
 *
 *   - 'a.b.c'
 *   - ['a', 'b', 'c']
 */
declare type ConfigurationLabel = string|string[];

/**
 * MAGE configuration
 *
 * Configuration can be required directly before requiring MAGE in
 * cases where you wish to apply your own custom configuration.
 *
 * ```javascript
 * const config = require('mage/lib/config');
 * config.set('some.path.to.config', 1)
 * config.set(['some', 'other', 'path'], 1)
 * const mage = require('mage');
 *
 * // continue with your test code
 * ```
 *
 * See: https://mage.github.io/mage/#dynamic-configuration
 */
declare class Config {
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

    /**
     * Programatically set a configuration entry
     *
     * @param label Configuration label to set
     * @param value
     */
    set(label: ConfigurationLabel, value: any): void;
}

declare var config: Config;

export = config;

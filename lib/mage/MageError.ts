/**
 * MageError details
 */
declare interface IErrorDetails {
    /**
     * The log level to use when logging this error (default: error)
     *
     * Some types of errors are perfectly normal; for instance,
     * a user failing to authenticate may throw an error, but
     * you might not want to have it logged as an error.
     *
     * Setting the level will allow you to decide whether this
     * error should be ignored, considered benign, or serious.
     */
    level?: 'debug' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency',

    /**
     * The error code
     *
     * This code will generally be the code that will be returned
     * to the client if this error is thrown during a user command
     * request.
     */
    code: string,

    /**
     * The error message
     *
     * This message will be logged to every log backend you have
     * configured in your application.
     */
    message: string,

    /**
     * Error details
     *
     * Additional details you wish to log
     */
    details: any
};

/**
 * MageError class
 *
 * This class can be used to throw errors that
 * should both interrupt the execution flow and be
 * logged by the MAGE logger.
 */
declare class MageError extends Error {
	constructor(data: IErrorDetails);
};

export default MageError;
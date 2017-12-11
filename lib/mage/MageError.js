'use strict';

const mage = require('lib/mage');
const loggingService = require('lib/loggingService');
const logLevels = loggingService.getAllChannelNames();

module.exports = class MageError extends Error {
	constructor(data) {
		super(data.message || 'Mage Error');

		this.code = data.code || 'server';
		this.level = data.level || 'error';
		this.details = data.details;
		this.type = this.constructor.name;

		if (logLevels.indexOf(this.level) === -1) {
			mage.logger.warning
				.data(this)
				.log('Error level is incorrect, setting level to error');
			this.level = 'error';
		}
	}
};

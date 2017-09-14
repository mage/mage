'use strict';

module.exports = class MageError extends Error {
	constructor(data) {
		super(data.message || 'Mage Error');

		this.code = data.code || 'server';
		this.level = data.level || 'error';
		this.details = data.details;
		this.type = 'MageError';
	}
};

'use strict';

exports.getId = function () {
	const id = process.env.MAGE_WORKER_ID;

	if (!id) {
		return false;
	}

	return parseInt(id, 10);
};

// This module is a gateway between frontend's and the archivist in the
// MAGE backend.
const MageError = require('lib/mage').MageError;

class ArchivistModuleError extends MageError {
	constructor(message, state, details) {
		super({
			message: message,
			details: Object.assign({
				actorId: state.actorId,
				acl: state.acl
			}, details)
		});
	}
}

module.exports = ArchivistModuleError;

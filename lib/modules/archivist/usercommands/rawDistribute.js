const ArchivistModuleError = require('../ArchivistModuleError');
const archivistModule = require('../');
const logger = archivistModule.logger;

function executeOperation(archivist, change) {
	switch (change.operation) {
	case 'add':
		archivist.add(change.topic, change.index, change.data,
			change.mediaType, change.encoding, change.expirationTime);
		break;
	case 'set':
		archivist.set(change.topic, change.index, change.data,
			change.mediaType, change.encoding, change.expirationTime);
		break;
	case 'touch':
		archivist.touch(change.topic, change.index, change.expirationTime);
		break;
	case 'del':
		archivist.del(change.topic, change.index);
		break;
	}
}

exports.acl = ['*'];

exports.execute = async function (state, changes) {
	if (!Array.isArray(changes)) {
		throw new ArchivistModuleError('archivist.distribute expected an array of changes', state);
	}

	const issues = [];
	let i, change;
	const toLoad = [];
	const diffs = [];

	// to apply diffs, we need to load their values first
	// for other operations, execute them synchronously

	for (i = 0; i < changes.length; i++) {
		change = changes[i] || {};

		if (change.diff) {
			// we need to load the document before we can apply the diff

			if (Array.isArray(change.diff) && change.diff.length > 0) {
				toLoad.push({ topic: change.topic, index: change.index });
				diffs.push(change.diff);
			}
		} else {
			// execute a synchronous change

			try {
				executeOperation(state.archivist, change);
			} catch (error) {
				logger.error('Error during archivist operation:', error);

				issues.push({
					topic: change.topic,
					index: change.index,
					operation: change.operation,
					error: error.message
				});
			}
		}
	}

	// if there is nothing to do asynchronously, bail out now

	if (toLoad.length === 0) {
		return issues;
	}

	// load all required values, so we can apply diffs on them

	return new Promise((resolve, reject) => {
		state.archivist.mgetValues(toLoad, { optional: true }, function (error, values) {
			if (error) {
				return reject(error);
			}

			resolve(values);
		});
	}).then((values) => {
		for (let i = 0; i < values.length; i++) {
			const value = values[i];
			const diff = diffs[i];

			if (!value) {
				logger.error('Could not load value for diff on:', toLoad[i]);

				issues.push({
					topic: value.topic,
					index: value.index,
					operation: 'diff',
					error: 'Value not found'
				});
				continue;
			}

			try {
				value.applyDiff(diff);
			} catch (err) {
				logger.error('Error during VaultValue#applyDiff:', err);

				issues.push({
					topic: value.topic,
					index: value.index,
					operation: 'diff',
					error: err.message
				});
			}
		}

		return issues;
	});
};

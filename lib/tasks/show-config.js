
exports.start = function (mage, options, cb) {
	var trail = options && options.trail ? options.trail : [];

	var out;
	var matryoshka = mage.core.config.getMatryoshka(trail);

	if (!matryoshka) {
		out = 'undefined';
	} else {
		// find all unique sources and list them on stderr

		var sources = matryoshka.getAllSourcesWithPath([]).sort();

		process.stderr.write('Configuration from:\n  ' + sources.join('\n  ') + '\n\n');

		if (!options.origins) {
			// flatten the matryoshka to just its contents

			matryoshka = matryoshka.get([]);
		}

		out = JSON.stringify(matryoshka, null, '  ');
	}

	process.stdout.write(out + '\n');

	cb(null, { shutdown: true });
};

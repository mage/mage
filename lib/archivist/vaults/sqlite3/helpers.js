// Helper functions

// escapeId function borrowed from node-mysql
function escapeId(val, forbidQualified) {
	if (Array.isArray(val)) {
		return val.map(function (v) {
			return escapeId(v, forbidQualified);
		}).join(', ');
	}

	if (forbidQualified) {
		return '`' + val.replace(/`/g, '``') + '`';
	}

	return '`' + val.replace(/`/g, '``').replace(/\./g, '`.`') + '`';
}

function parseCols(data) {
	var cols = [], values = [], frag = [];

	for (var key in data) {
		if (data.hasOwnProperty(key)) {
			frag.push('?');
			cols.push(escapeId(key));
			values.push(data[key]);
		}
	}

	return {
		columns: cols,
		values: values,
		fragment: frag
	};
}

function parsePairs(data) {
	var pairs = [], values = [];

	for (var key in data) {
		if (data.hasOwnProperty(key)) {
			pairs.push(escapeId(key) + ' = ?');
			values.push(data[key]);
		}
	}

	return {
		pairs: pairs,
		values: values
	};
}


exports.escapeId = escapeId;
exports.parseCols = parseCols;
exports.parsePairs = parsePairs;

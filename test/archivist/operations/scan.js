const assert = require('assert');
const Archivist = require('lib/archivist').Archivist;

const archivist = new Archivist();
const userIndexes = [
	{
		userId: 1
	},
	{
		userId: 2
	},
	{
		userId: 3
	}
];
const userData = [
	{
		username: 'foo'
	},
	{
		username: 'bar'
	},
	{
		username: 'bar2'
	}
];

archivist.list = function (topic, partialIndex, options, cb) {
	return cb(null, userIndexes);
};

archivist.mget = function (queries, options, cb) {
	return cb(null, userData);
};

describe('Scan operation', function () {
	it('return correctly formed data', function (done) {
		archivist.scan('user', {}, function (err, data) {
			assert(!err, 'Should not return an error');
			assert(data.length === 3, 'Should return an array of 3 elements');

			for (let i = 0; i < data.length; ++i) {
				assert(data[i].length === 2, 'Should be an array of 2 elements [index, value]');
				assert(data[i][0].userId === userIndexes[i].userId, 'userId should match');
				assert(data[i][1].username === userData[i].username, 'username should match');
			}

			done();
		});
	});
});

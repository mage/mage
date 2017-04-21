/**
 * Serialize data for storage in DynamoDB, data is serialized to 2 columns data and mediaType for easy storage, if you
 * need more control you may override that topic function to split your data properly in multi-columns
 *
 * @param {VaultValue} value The value to serialize
 * @returns {Object} An item object for usage in DynamoDB.putItem
 */
exports.serialize = function (value) {
	// serialize data
	var res = this.createKey(value.index);

	// just put the encoded data as is in the DB
	value.setEncoding(['utf8', 'buffer']);

	switch (value.encoding) {
	case 'utf8':
		res.data = { S: value.data };
		break;
	case 'buffer':
		res.data = { B: value.data.toString('base64') };
		break;
	default:
		throw new Error('Encoding ' + value.encoding + ' is not supported by DynamoDB');
	}

	// store media type too
	res.mediaType = { S: value.mediaType };

	return res;
};

/**
 * Read data back from the table, if you overrided the serialize method, this is where you should transform it back to
 * a VaultValue
 *
 * @param {Object}     item  The Item from the database
 * @param {VaultValue} value The VaultValue where we want to deserialize stuff
 */
exports.deserialize = function (item, value) {
	// the data object contains only one key that is the type of the object
	var type = Object.keys(item.data)[0];
	var encoding, data;

	// decode stuff
	switch (type) {
	case 'S':
		encoding = 'utf8';
		data = item.data.S;
		break;
	case 'B':
		encoding = 'buffer';
		data = new Buffer(item.data.B, 'base64');
		break;
	}

	// then set data
	value.setDataFromVault(item.mediaType.S, data, encoding);
};

/**
 * Transforms index values into a key object for DynamoDB.getItem, if you want to use special indexes, this is where
 * you need to implement them, serialize will use that method to generate the data object provided to putItem.
 *
 * @param {Object} index An object in the form {index1: value1, index2: ...}
 * @returns {Object}
 */
exports.createKey = function (index) {
	var res = {};

	var keys = Object.keys(index);
	// iterate on each index
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		res[key] = { S: index[key].toString() };
	}

	return res;
};

/**
 * Defaults errors returned by AWS are not really developer friendly so we convert them to something easier to parse.
 * If you need to capture the raw errors, feel free to override/extend that method with a noop or similar.
 *
 * Possible exceptions from AWS:
 * - *ProvisionedThroughputExceededException*: Raised when you exceed the configured throughput during a batchGetItem
 * - *ValidationException*:                    Thrown when invalid data is provided to batchWriteItem
 * - *ThrottlingException*:                    Thrown when you exceed the amount of reads or writes per second
 *                                             configured for your table
 * - *ConditionalCheckFailedException*:        Thrown when a conditional check (such as when using the Expected flag
 *                                             when writing stuff) fails
 * - *ResourceInUseException*:                 A table is currently being created or updated and cannot be accessed
 * - *ResourceNotFoundException*:              Raised when a table doesn't exists
 *
 * @param {Object} value The value provided to the original archivist method
 * @param {Error} error The error object
 */
exports.transformError = function (value, error) {
	if (!error) {
		return null;
	}

	switch (error.code) {
	// happens when trying to access a non existing table
	case 'ResourceNotFoundException':
		return new Error('Table ' + value.topic +
			' does not exist on DynamoDB, please run migration scripts or create it');
	// when using archivist, that one will happen only on duplicate entries
	case 'ConditionalCheckFailedException':
		return new Error('Duplicate entry in table ' + value.topic);
	}

	return error;
};

/**
 * Change that to false if you want your reads on that topic to be non-Consistent (costing only half
 * the amount of read throughput).
 *
 * @type {boolean}
 */
exports.consistent = true;

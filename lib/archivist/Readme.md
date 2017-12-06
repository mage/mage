# Archivist

The archivist rules your data. Its purpose is to help you manage your data,
all through a simple unified API, regardless of which data stores you use.


## Advantages


### Schema Migration

Schema Migration between versions is well supported out of the box. Please read the
[documentation](./Migrations.md).


### Redundant storage

You can configure multiple data stores of the same type, in order to split your data into as many
MySQL databases, couchbase clusters and file systems as you want.

This allows you to write to many stores at once (defined by write-order). It also allows you to
configure a read-order, by which data gets loaded. This is very useful in scenarios like "try
memcached first, else try MySQL".


### Friendly default integration logic with a bunch of database systems

For all built-in data stores, all serialization and access logic is built-in with friendly default
behaviors. That means that you can store into a key/value store like memcached and into an SQL
data store -- through a single API -- without having to program or configure anything specific.


### A solution for static content

The archivist API works equally well for SQL databases, key/value stores and file storage. That
means that it's an out-of-the-box solution for your static content, using an API that is consistent
with how you manage all your other data.


### Highly customizable database integration if needed

Whenever you do want full control over how data gets stored, you have the ability to do so.


## Terminology


### Topics and Indexes

Each document you store is identified by a topic and an index. Topic is always a string, and
index is always a key/value object. Some typical examples of topic/index pairs could be:

```plaintext
topic: "player", index: { actorId: 123 }
topic: "inventory", index: { actorId: "456" }
topic: "cards", index: { actorId: 123, type: "deck" }
```

In SQL terms: consider topic your table, and index your primary key.


### Vaults

Vaults represent the data stores where your data is stored. Each vault type has its own API for
talking to the underlying service, but also exposes a separate `Archive API` that is used internally
to store documents. You generally won't access vaults directly. You can leave that to the archivist.
You will however have to configure them, so that each vault knows where to store data.

See the Vaults section of this documentation to learn more about available vaults and
their capabilities.


### Archivist

The *archivist* directs your documents to-and-from the vaults. It's your primary point of access,
and provides a simple API for reading and writing data. In MAGE, you can always access it through
`state.archivist`.


### Topic API

Topic APIs are APIs that, uniquely per vault, implement how values are stored and read. A lot of
this logic is driven around "topics" and "indexes", that these APIs can translate into logic that
fits the vault in question.

For example, the topic `weapons` with index `{ actorId: 123 }` can be translated into the following
memcached key: `weapons/actorId:123`, or into the following MySQL structure:

```json
{ "table": "weapons", "pk": { "actorId": 123 } }
```

Each vault has friendly defaults, but those can always be overridden with custom logic. For more
information on how to do this, please read "Writing your own Topic API".


### MediaTypes

Each document that is stored, can be stored along with its media type. Think of `image/jpeg`,
`text/plain`, `application/octet-stream`, `application/json`, etc.
Media types can be useful in order to recreate a living version of binary- or string-serialized
data. Archivist comes with built-in knowledge of media types and has the ability to convert between
them.


## Quick start guide

To start using archivist in your game, you will have to execute the following steps.


### Configure your vaults

The archivist configuration sits on the root of your config file under the label `archivist`. It
contains 3 child labels:

* `vaults` describes where you store all your data. The keys are the names you give to your vaults.
* `listOrder` is an array with vault names, describing the order in which we list indexes.
* `readOrder` is an array with vault names, describing the order in which we read data.
* `writeOrder` is an array with vault names, describing the order in which we write data.

The vaults entry is a key/value map, where the key is the unique *name* of the vault. It's up to you
to decide on these names. Perhaps often, the name of the vault will match the type of the vault, but
this is absolutely not required. Choose whatever makes sense for your project. The only name that is
reserved is `client`, which is named that way by the MAGE command center. You will want to make
sure that the `client` vault is represented in your `writeOrder`.

It's important to note that the `listOrder`, `readOrder` and `writeOrder` are system-wide. It's
likely that not every topic will be stored on every vault. Whenever we read or write a given topic,
the configured order is traversed, and vaults not linked to the topic are ignored. You cannot change
the ordering for individual topics.

Each vault entry in the configuration has 2 properties: `type` and `config`. The type property is a
fixed ID that is unique for each type of vault. Read the vault documentation referred to in the
*Vaults* section to see these IDs and how to configure vaults of that type.

Example configuration:

```json
{
	"archivist": {
		"vaults": {
			"static": {
				"type": "file",
				"config": { "path": "/tmp" }
			},
			"memcached": {
				"type": "memcached",
				"config": { "servers": ["localhost:11211"], "prefix": "bob/" }
			},
			"mysql": {
				"type": "mysql",
				"config": { "url": "mysql://bob:secret@localhost/bob_game" }
			}
		},
		"listOrder": ["mysql", "static"],
		"readOrder": ["memcached", "mysql", "static"],
		"writeOrder": ["client", "memcached", "mysql", "static"]
	}
}
```


### Configure your topics

In your game's `lib` folder, please create a new folder called `archivist`. This folder will be
`require`d by MAGE's archivist, in order to receive your topic configuration per vault-name.
Consider doing the whole configuration in one file: `lib/archivist/index.js`.

The format is as follows:

```javascript
exports.myTopicName = {
	mediaType: 'application/json',
	readOptions: {
	},
	index: ['propName', 'propName'],
	vaults: {
		myVaultName: myTopicAPI
	},
	afterLoad: function (state, value, cb) {
		cb();
	}
};
```

Where you do this for each topic you want to store in your vaults. The `index` array must be
provided if your topic depends on an index. This array is the signature of the indexes you will
provide when referring to data.

If `mediaType` is provided, this topic's media type will default to the specified value.

The `readOptions` object may be supplied to overwrite default `options` that are used when reading
from your archivist. The following defaults are defined, and they can be individually replaced:

```json
{
	"mediaTypes": ["application/json", "application/octet-stream"],
	"encodings": ["live"],
	"optional": false
}
```

The `myTopicAPI` object that you provide per vault-name, may be replaced with `true` in order to get all default
behaviors for that vault type. Read about "Advanced usage" to see how you can set up these topic APIs with custom
behaviors.

Finally, you may optionally provide an `afterLoad` function that takes 3 arguments: `state`, `value` and `cb`.
When you provide this function, each database load will call this function before returning to userland code. That gives
you (for example) the opportunity to perform document migration. The document can be found in `value.data`, but you will
have to make sure yourself that it's deserialized before you read from it. You can do this by calling
`value.setEncoding('live');`. After this, `value.data` will contain the unserialized document. You could store a
document schema version number in this document and when you notice it falls behind, migrate the document to the latest
schema. When you're done handling the `afterLoad` logic, you **must** call `cb` to continue. If you pass an error to
`cb`, the `get()` or `mget()` call that the load originated from will receive that error. It is up to you to log it.

In order to keep your configuration maintainable, it makes a lot of sense to
categorize your topics. Imagine for example the following configuration:

```javascript
function dynamicTopic(index) {
	return { index: index, vaults: { mysql: true, memcached: true } };
}

function staticTopic() {
	return { vaults: { file: true } };
}

exports.player = dynamicTopic(['id']);
exports.inventory = dynamicTopic(['playerId']);
exports.cards = dynamicTopic(['playerId']);
exports.cardDefinitions = staticTopic();
exports.itemDefinitions = staticTopic();
```


## Using the Server API

You can always access the archivist through `state.archivist`. If you really need to make your own
instance, you can use the following:

```javascript
var archivist = new mage.core.archivist.Archivist();
```

The following API documentation should tell you how to store, read, delete data and how to set their
expiration time. Keep in mind that there could be vault types that do not support particular
operations. A typical one would be `touch`, which is generally not well supported. But even other
operations may trigger an error. For example, when trying to `write` to a read-only vault, or
opposite.


### Adding new data

```javascript
archivist.add(topic, index, data, mediaType, encoding, expirationTime);
```

Marks the `data` you pass as something you want to store in your vaults, applying the given `topic`
and `index`. If no `mediaType` is given, archivist will try to detect one. If no `encoding` is
given, archivist will try to detect one. If you want to store this data for a limited time, you can
pass an `expirationTime` (unix timestamp in seconds). If a value already existed, you should expect
this call to fail.

This call is very similar to a combination of `archivist.exists` followed by `archivist.set` when
the `exists` value is `false`.


### Getting data

```javascript
archivist.get(topic, index, options, function (error, data) { });
```

Reads data from all vaults configured for this topic, returning the first successful read. Read
errors are considered fatal, and you should abort your operations. However, if a vault is responsive
but simply doesn't hold the value you requested, the next vault in line may still be able to deliver.
If a value has already been read or written to before in this archivist instance, that value has
been cached and will be returned.

The following options are available to you:

* `optional`: (boolean, default: false) Indicates whether it's considered an error if data is not
  found in any of the vaults.
* `mediaTypes`: (array, default: `['application/x-json', 'application/octet-stream']`) Indicates
  that you only accept these media types, in the given order of priority. If data of another media
  type is read, a conversion attempt will be made.
* `encodings`: (array, default: `['live']`) Indicates that you only accept these encodings, in the
  given order of priority. If data of another encoding is read, a conversion attempt will be made
  (eg: JavaScript object to utf8 JSON).

This options object is not required, and your callback may be passed as the third argument.


#### Multi-get

```javascript
archivist.mget(queries, options, function (error, multiData) { });
```

For multi-get operations, please use `mget`. The options are identical to and just as optional as in
the `get` method. There are two supported `queries` formats: the array and the map. In both cases,
the result will map to the input.

##### Array style queries

###### queries

```json
[
	{ "topic": "players", "index": { "id": "abc" } },
	{ "topic": "players", "index": { "id": "def" } },
	{ "topic": "players", "index": { "id": "hij" } }
]
```

###### multiData

The result is an array where the output order matches the input order:

```json
[
	{ "name": "Bob" },
	undefined,
	{ "name": "Harry" }
]
```

##### Object map style queries

###### queries

```json
{
	"a": { "topic": "players", "index": { "id": "abc" } },
	"b": { "topic": "players", "index": { "id": "def" } },
	"c": { "topic": "players", "index": { "id": "hij" } }
}
```

###### multiData

The result is an object map where the keys match the input keys:

```json
{
	"a": { "name": "Bob" },
	"b": undefined,
	"c": { "name": "Harry" }
}
```

### Testing existence of data

```js
archivist.exists(topic, index, function (error, exists) { });
```

This checks if the value exists in a vault or not. The `exists` boolean will reflect the result of
this test.


### Overwriting data

```javascript
archivist.set(topic, index, data, mediaType, encoding, expirationTime);
```

Marks the `data` you pass as something you want to write to all your vaults, applying the given
`topic` and `index`. If no `mediaType` is given, archivist will apply the one it already knows
about this value (if a `get` or `add` happened before), else it will try to detect one. If no
`encoding` is given, archivist will try to detect one. If you want to store this data for a limited
time, you can pass an `expirationTime` (unix timestamp).

If a vault allows for diff-logic to occur, and the data passed allows diffs to be read, this will be
used.


### Deleting data

```javascript
archivist.del(topic, index);
```

Marks data pointed to by `topic` and `index` as something you want to delete. A subsequent `get`
will not yield any data.


### Setting an expiration time

```javascript
archivist.touch(topic, index, expirationTime);
```

Marks data with a new expiration time (unix timestamp in seconds).


### Finding data

```javascript
archivist.list(topic, partialIndex, options, function (error, arrayOfIndexes) { });
```

Returns an array of indexes on the given topic matching the partial index you provide. A partial
index is the same as a normal index object, except you can leave out properties.
The options object is not required, and your callback may be passed as the third argument.

You can, for example, query for all players in the game by using an empty partial index:

```javascript
// A full index for the "players" topic contains only the "id" property.

archivist.list('player', {}, function (error, indexes) {
	/* indexes is now [{ id: 5 }, { id: 20 }, ...] */
});
```

Or for all players that are in a guild:

```javascript
// A full index for the "guildPlayers" topic consists of "guildId" and "userId"

archivist.list('guildPlayers', { guildId: 'abc' }, function (error, indexes) {
	/* indexes is now [{ guildId: 'abc', userId: 5 }, { guildId: 'abc', userId: 20 }, ...] */
});
```

You may pass the following options:

**sort**

An array of sorting rules. Each rule has the format:
```json
{ "name": "fieldName in the index", "direction": "asc or desc" }
```

You may give multiple of these in order of importance. Use `direction` to specify ascending or
descending sort-order.

**chunk**

An array of the format `[start, length]` where both values are integers and `length` is optional.
This will limit the sorted result to the indexes starting at `start` (counts from 0) until
`start + length`. This allows for paginating your results.

Options example (sorted by id (descending), page 3 with 10 results per page):

```json
{
	"sort": [{ "name": "id", "direction": "desc" }],
	"chunk": [20, 10]
}
```


### Distributing changes to all vaults

```javascript
archivist.distribute(function (distributeError, operationErrors) { });
```

This takes all the queued up operations (add, set, del, touch) and executes them on each of
the relevant vaults. This distribution is automatically done by the `state` object in MAGE when it
closes without errors, so you should never have to call this yourself.


### Manually adding data to the archivist memory cache

```javascript
archivist.addToCache(topic, index, data, mediaType, encoding);
```

This manually adds a value to the archivist cache based on its topic and index, so that next
calls to `archivist.get` won't hit the database but pull the entry from memory. This can be used
to cache a large amount of entries retrieved from the database that may be more efficient to retrieve
in a single query instead of many `archivist.get` calls.

For example:

```javascript
mysql.query('SELECT * FROM topicTable WHERE type = ?', type, function (err, rows) {
	if (err) {
		// error
	}

	for (var i = 0; i < rows.length; i++) {
		var row = rows[i];
		// cache the row
		state.archivist.addToCache('topic', { index: row.index }, row.data,
			row.mediaType, row.encoding);
	}

	// now run some heavy computation that uses archivist.get on that data
	heavyComputation(cb);
});
```

## Client API

The archivist is exposed on the browser through a MAGE module called "archivist". You can use it
like any other built-in module:

```javascript
mage.useModules(request, 'archivist');
```

You can now read from and write to the vaults by calling using the APIs described below. It is
important to understand that the Archivist client keeps a cache in memory. When you do a get or mget
operation, and the value has already been read or set before, you will receive the version from the
cache (see the `maxAge` option below to see how you can control this behavior).

The **read methods** available are identical to the server variation:

```javascript
archivist.get(topic, index, options, function (error, data) { });
archivist.mget(queries, options, function (error, data) { });
archivist.list(topic, partialIndex, options, function (error, indexes) { });
```

For `get` and `mget` the client enables one extra read option that the server doesn't have:

* maxAge: A number in seconds. If a value is available in cache, but was set longer ago than this
  many seconds, it will not be used. That means that setting maxAge to `0` will always bypass the
  cache.

These are the **data mutation** operations, again, identical to the server variation:

```javascript
archivist.add(topic, index, data, mediaType, encoding, expirationTime);
archivist.set(topic, index, data, mediaType, encoding, expirationTime);
archivist.touch(topic, index, expirationTime);
archivist.del(topic, index);
archivist.distribute(function (error) { });
```

Unlike on the server, where `distribute()` is called by `State` objects, on the client-side, you
have to do it yourself. Consider the user experience, and call `distribute()` when you have made a
batch of changes and want to send them.


## Advanced vault usage


### Direct access to a vault's native API

If you want to access a vault directly, you can ask the archivist for the instance. Often a vault
will expose its underlying library on a `.client` property. Depending on if you want to list, read
or write data, you can call:

* `archivist.getListVault(vaultName);`
* `archivist.getReadVault(vaultName);`
* `archivist.getWriteVault(vaultName);`

For more information on the APIs exposed by each vault, please refer to their documentation.


### Writing your own Topic APIs

Topic APIs are a collection of APIs that enable a vault to get data to and from its underlying
data store. The total set of APIs is limited, and each vault type has its own required subset. For
more information on the specifics per vault type, please refer to their documentation.

You can integrate these in the way explained in the "Configure your topics" paragraph. Keep in mind
that whenever you choose to implement one of the APIs for a topic, the non-implemented ones will
still exist in their default implementations.

The following APIs can be implemented.


#### Serializing data

The serialize method receives a `VaultValue` instance which can contain data, in an `encoding`,
tagged with a `MediaType` and aware of its `topic` and `index`. When preparing data to be stored
into a vault, the serialize method may have to change the encoding to better fit the requirements of
the vault, and even return completely different/altered data (imagine prepending header/meta
information to the real data). Finally, the returned data is used by the vault.

Example:

```javascript
function serialize(value) {
	return value.setEncoding(['utf8', 'buffer']).data;
}
```


#### Deserializing data

The deserialize method receives the data as it was returned by the vault. It has the duty to
initialize the passed `VaultValue` instance with that data, in the right `encoding` and `MediaType`.
If encoding and/or MediaType are omitted, they will be guessed by the underlying system. This can be
acceptable when the data is returned in deserialized form by the vault.

Example:

```javascript
function deserialize(data, value) {
	value.initWithData(null, data, null);
}
```


#### Generating a key

Every vault needs a key function to access data. Generally, the key function will take the `topic`
and `index` and turn those into something that is appropriate for the vault. This can be a string
(eg. in the case of memcached), but also a rich object (eg. in the case of MySQL). Think of the key
as the minimal information required to find a piece of data in a vault.

Example (typical SQL):

```javascript
function key(topic, index) {
	return {
		table: topic,  // topic is used as the table name
		pk: index      // { columnName: value }
	};
}
```


#### Selecting a shard

The shard method is similar to the key method, except it doesn't pinpoint the exact location of
data, but a general location, in order to facilitate sharding. A good example is the Client vault,
which needs to emit data changes to different users based on certain very specific information.
Incidentally, this is currently the *only* Topic API method you *have to* implement yourself.

Example (Client):

```javascript
function shard(value) {
	// the Client shard is one or more actor IDs

	return value.index.actorId;
}
```

Example (Client, multiple actors):

```javascript
function shard(value) {
	// the Client shard is one or more actor IDs

	value.setEncoding('live');

	return [value.index.actorId].concat(value.data.friendIds);
}
```

Example (Client, static data for all actors):

```javascript
function shard(value) {
	return true;
}
```

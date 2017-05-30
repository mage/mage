## Couchbase vault

The [node-couchbase](https://npmjs.org/package/couchbase) module is supported through the built-in
"couchbase" vault type. It supports sharding by creating hashes on strings that your `shard`
function may provide.

Alternatively, you can also use the [Memcached vault](../memcached/Readme.md) which is based on
[node-memcached](https://npmjs.org/package/memcached).

Read more on Couchbase at [couchbase.com](http://www.couchbase.com/couchbase-server/overview).


### Sharding

The Couchbase vault supports sharding. That is a great way to cluster user data onto a single
vbucket. You can implement this by giving your topic API a shard function, and returning a string or
number to shard on (called our hash-key). In many cases, this will be a user ID. This hash key may
not come from the data you are writing, because we need to be able to generate this value on-read as
well, before we have data in our hands.

Example:

```javascript
exports.user = {
	index: ['userId'],
	vaults: {
		couchbase: {
			shard: function (value) {
				return value.index.userId;
			}
		}
	}
};
```

### Flags

Couchbase allows one to set 4 bytes of meta information (flags) with each document that will be
returned when you retrieve it. People generally use these flags to store the data type. The
Couchbase vault does this too. Two flag styles have been implemented, and through configuration you
can switch between them.

The default flag style turns the file extension that goes with the media type into a binary 4-byte
representation. For example: `txt`, `json`, `tome`, `bin`.

There is an alternative flag style called `node-memcached`. Use this if you want to be compatible
with the Memcached vault.


### Switching between Memcached and Couchbase vaults

You can do this, but there are two limitations you must be aware of. Please ask your system
operators for advice. The two issues to take into account are the following.

#### Flag style

If you roll out this vault and you want to be able to switch to a memcached vault some time in the
future, you need to make sure you set `flagStyle` to `node-memcached`. If you do not do this, the
file types of your documents will not match up once you make the switch! The reason for this is that
we cannot control what the flags look like when using `node-memcached`, as it's built-in.

#### Sharding

The Couchbase vault supports sharding. That is a great way to cluster user data onto a single
vbucket. Please note however, that `node-memcached` using Moxi will not be able to apply the same
sharding logic. Once you start sharding, you cannot switch back to a Memcached vault.


### Configuration

```yaml
type: couchbase
config:
    options:
        user: Administrator         # optional, usually not required
        password: "password"        # optional, usually not required
        hosts: [ "localhost:8091" ] # optional
        bucket: default             # optional
    prefix: "prefix for all keys"   # eg: "bob/"
    flagStyle: default              # "default" or "node-memcached"
```


### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `couchbase.get()`
add       | ✔         | `couchbase.add()`
set       | ✔         | `couchbase.set()`
touch     | ✔         | `couchbase.touch()`
del       | ✔         | `couchbase.remove()`


### Required Topic API

signature                             | required | default implementation
--------------------------------------|----------|-----------------------
`createKey(topic, index)`             |          | "topic/indexProp:indexValue/indexProp:indexValue/..." (index is sorted)
`shard(value)`                        |          | undefined
`createFlags(mediaType, flagStyle)`   |          | either `default` or `node-memcached` compatible style flag creation based on mediaType
`parseFlags(flags, flagStyle)`        |          | will turn both `default` and `node-memcached` style flags into a media type
`serialize(value)`                    |          | returns a `utf8` representation of `value.data`
`deserialize(data, mediaType, value)` |          | writes `data` and `mediaType` into `value`


### Views Migration

Archivist allows for [schema migrations](../../SchemaMigrations.md), and the Couchbase vault
supports this. This should however only be used to migrate document views.

Also as couchbase only allows for 20MB of data per key and as this feature stores all the version
data into a single key, please write short concise reports to avoid breaking that limit.

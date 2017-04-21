## Redis vault

The node-redis module is supported through the built-in "redis" vault type.

### Configuration

```json
{
	"type": "redis",
	"config": {
		"port": 6379,
		"host": "127.0.0.1",
		"options": { "options to pass": "to node-redis" },
		"prefix": "prefix for all your keys"
	}
}
```

The `options` object is described in the [node-redis readme](https://npmjs.org/package/redis).
Both `options` and `prefix` are optional. The option `return_buffers` is turned on by default by the
Archivist, because the default serialization will prepend values with meta data (in order to
preserve mediaType awareness).

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `redis.get()`
add       | ✔         | `redis.set('NX')`
set       | ✔         | `redis.set()`
touch     | ✔         | `redis.expire()`
del       | ✔         | `redis.del()`

### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | "topic/indexProp:indexValue/indexProp:indexValue/..." (index is sorted)
`serialize(value)`         |          | a header containing mediaType followed by a `Buffer` of the data
`deserialize(data, value)` |          | parses data from the default `serialize` function

## Memcached vault

The [node-memcached](https://npmjs.org/package/memcached) module is supported through the built-in
"memcached" vault type.

### Using the Memcached vault for Couchbase clusters

Please note that the Memcached vault **can be used** to interact with Couchbase clusters and
buckets (it does not require you to change the bucket type to "memcached"). Alternatively, the
[Couchbase vault](../couchbase/Readme.md) may be chosen for that, but at this time the library it is
based on ([node-couchbase](https://npmjs.org/package/couchbase)) is a less mature and less tested
library. That should change over time.

### Configuration

```yaml
myvault:
    type: memcached
    config:
        servers:
            - "1.2.3.4:11211"
            - "1.2.3.5:11411"
        options:
            foo: bar
        prefix: "prefix for all your keys"
```

The usage of the `servers` and `options` properties are described in the
[node-memcached readme](https://npmjs.org/package/memcached). Both `options` and `prefix` are
optional.

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `memcached.get()`
add       | ✔         | `memcached.add()`
set       | ✔         | `memcached.set()`
touch     | ✔         | `memcached.touch()`
del       | ✔         | `memcached.del()`

### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | "topic/indexProp:indexValue/indexProp:indexValue/..." (index is sorted)
`serialize(value)`         |          | forced to `live` encoding, node-memcached will serialize and flag type
`deserialize(data, value)` |          | received in `live` encoding

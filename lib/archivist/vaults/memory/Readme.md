## Memory vault

For static content, it often makes a lot of sense to keep your files in memory for quick access.
The "memory" vault makes this possible. The Memory vault keeps data serialized in memory. That
allows synchronization to clients to happen without any (de)serialization steps, saving you precious
CPU and garbage collection cycles.

**A word of warning**

Because the memory vault only lives in JavaScript memory, it does not transcend into other
processes. That means that you can not depend on it to store data for you in one worker, and expect
it to be accessible by another. That is obviously also true between multiple servers.

### Configuration

```json
{
	"type": "memory"
}
```

The memory vault doesn't use any special configuration.

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `for (var trueName in cache) { }`
get       | ✔         | `deserialize(cache[trueName(fullIndex, topic)])`
add       | ✔         | `cache[trueName(fullIndex, topic)] = serialize(data)`
set       | ✔         | `cache[trueName(fullIndex, topic)] = serialize(data)`
touch     | ✔         | `setTimeout()`
del       | ✔         | `delete cache[trueName(fullIndex, topic)]`

### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | rumplestiltskin trueName
`serialize(value)`         |          | VaultValue to internal MemoryData object
`deserialize(data, value)` |          | from MemoryData to VaultValue

# Archivist

Archivist is a key-value abstraction layer generally used with state objects.

The player module created through the previous sections already uses Archivist
to store data on the local file system; more specifically, the auth module used
in the [Actors & Sessions](./index.html#actors-sessions) section of this user guide
uses Archivist behind the scenes to store credentials for newly created users.

## Vaults

> ./config/default.yaml

```yaml
archivist:
    vaults:
        userVault:
            type: file
            config:
                path: ./filevault/userVault
        itemVault:
            type: file
            config:
                path: ./filevault/itemVault
```

<aside class="warning">
Not all vaults support every operations! Below you will find
a short configuration description for each available vault backends
alongside a list of supported operations for that backend.
</aside>

As mentioned, vaults are used by archivist to store data. Currently, the following backend
targets are supported:

| Backend               | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| file                  | Store data to the local disk, in JSON files.                 |
| memory                | Keep data in memory (does not persist).                      |
| client                | Special vault type (client-side archivist support required). |
| couchbase             | [Couchbase](https://www.couchbase.com/) interface            |
| mysql                 | [MySQL](https://www.mysql.com/) interface.                   |
| elasticsearch         | [Elasticsearch](https://www.elastic.co/) interface.          |
| dynamodb              | [AWS DynamoDB](https://aws.amazon.com/dynamodb/) interface.  |
| manta                 | [Joyent Manta](https://apidocs.joyent.com/manta/) interface. |
| redis                 | [Redis](https://redis.io/) interface.                        |
| memcached             | [Memcached](https://memcached.org/) interface.               |

Vaults can have different configuration for different environments, as long as the Archivist
API set used in your project is provided by the different vault backends you wish to use.

### File vault backend

The file vault can be used to store data directly in your project. A ommon
case for the use of the file vault backend is static data storage.

```yaml
type: file
config:
    path: ./filevault
    disableExpiration: true  # optional (default: false)
```

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `fs.readdir(config.path);`
get       | ✔         | `fs.readFile('myfile.filevault' and 'myfile.json');`
add       | ✔         | `fs.writeFile('myfile.filevault' and 'myfile.json');`
set       | ✔         | `fs.writeFile('myfile.filevault' and 'myfile.json');`
touch     | ✔         | `fs.readFile('myfile.filevault'); fs.writeFile('myfile.filevault');`
del       | ✔         | `fs.readFile('myfile.filevault'); fs.unlink('myfile.filevault' and 'myfile.json');`

### Memory

```yaml
type: memory
```

The memory vault backend can be used to keep data in-memory
for the duration of the execution of your MAGE instance. Data
will not be persisted to disk.

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `for (var trueName in cache) { }`
get       | ✔         | `deserialize(cache[trueName(fullIndex, topic)])`
add       | ✔         | `cache[trueName(fullIndex, topic)] = serialize(data)`
set       | ✔         | `cache[trueName(fullIndex, topic)] = serialize(data)`
touch     | ✔         | `setTimeout()`
del       | ✔         | `delete cache[trueName(fullIndex, topic)]`

### Client

This vault is used to send updates to the player, so that their data is
always synchronized in real time.

This vault is always created when an archivist is instantiated by a
`State` object, using a name identical to the type: `client`.

This vault type requires no configuration.

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       |           |
add       | ✔         | `state.emitToActors('archivist:set')`
set       | ✔         | `state.emitToActors('archivist:set' or 'archivist:applyDiff')`
touch     | ✔         | `state.emitToActors('archivist:touch')`
del       | ✔         | `state.emitToActors('archivist:del')`

### Couchbase

```yaml
type: couchbase
config:
    options:
        # List of hosts in the cluster
        hosts: [ "localhost:8091" ]

        # optional
        user: Administrator
        password: "password"

        # optional
        bucket: default

        # optional, useful if you share a bucket with other applications
        prefix: "bob/"
```

`user` and `password` are optional, however, you will need to configure
configure them if you with to create the underlying bucket
through `archivist:create`, or to create views and query indexes
through `archivist:migrate`.

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `couchbase.get()`
add       | ✔         | `couchbase.add()`
set       | ✔         | `couchbase.set()`
touch     | ✔         | `couchbase.touch()`
del       | ✔         | `couchbase.remove()`

### MySQL

```yaml
		mysql:
			type: mysql
			config:
				options:
					host: "myhost"
					user: "myuser"
					password: "mypassword"
					database: "mydb"
```

The available connection options are documented in the [node-mysql readme](https://github.com/felixge/node-mysql#connection-options).
For pool options please look at [Pool options](https://github.com/felixge/node-mysql#pool-options).

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `SELECT FROM table WHERE partialIndex`
get       | ✔         | `SELECT FROM table WHERE fullIndex`
add       | ✔         | `INSERT INTO table SET ?`
set       | ✔         | `INSERT INTO table SET ? ON DUPLICATE KEY UPDATE ?`
touch     |           |
del       | ✔         | `DELETE FROM table WHERE fullIndex`

### Elasticsearch

```yaml
elasticsearch:
    type: elasticsearch
    config:
        # this is the default index used for storage, you can override this in your code if necessary
        index: testgame

        # here is your server configuration
        server:
            hostname: '192.168.2.176'
            port: 9200
            secure: false
```

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `elasticsearch.get`
add       | ✔         | `elasticsearch.index` with op_type set to `create`
set       | ✔         | `elasticsearch.index`
touch     |           |
del       | ✔         | `elasticsearch.del`

### DynamoDB

```yaml
dynamodb:
    type: "dynamodb"
    config:
        accessKeyId: "The access ID provided by Amazon"
        secretAccessKey: "The secret ID provided by Amazon"
        region: "A valid region. Refer to the Amazon doc or ask your sysadmin. Asia is ap-northeast-1"
```

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `DynamoDB.getItem`
add       | ✔         | `DynamoDB.putItem` with `Expect.exists = false` set to the index keys
set       | ✔         | `DynamoDB.putItem`
touch     |           |
del       | ✔         | `DynamoDB.deleteItem`

### Manta

```yaml
type: manta
config:
    # url is optional
    url: "https://us-east.manta.joyent.com"
    user: bob
    sign:
        keyId: "a3:81:a2:2c:8f:c0:18:43:8a:1e:cd:12:40:fa:65:2a"

        # key may be replaced with "keyPath" (path to a private key file),
        # or omitted to fallback to "~/.ssh/id_rsa"
        key: |
          -----BEGIN RSA PRIVATE KEY-----
          ..etc..
          -----END RSA PRIVATE KEY-----
```

`keyId` is the fingerprint of your public key, which can be retrieved by running:

`ssh-keygen -l -f $HOME/.ssh/id_rsa.pub | awk '{print $2}'`

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `manta.ls()`
get       | ✔         | `manta.get()`
add       |           |
set       | ✔         | `manta.put()`
touch     |           |
del       | ✔         | `manta.unlink()`

### Redis

```yaml
type: redis
config:
  port: 6379
  host: "127.0.0.1"
  options: {}
  prefix: "key/prefix/"
```

The `options` object is described in the [node-redis readme](https://npmjs.org/package/redis).
Both `options` and `prefix` are optional. The option `return_buffers` is turned on by default by the
Archivist, because the default serialization will prepend values with meta data (in order to
preserve mediaType awareness).

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `redis.get()`
add       | ✔         | `redis.set('NX')`
set       | ✔         | `redis.set()`
touch     | ✔         | `redis.expire()`
del       | ✔         | `redis.del()`

### Memcached

```yaml
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

operation | supported | implementation
----------|:---------:|---------------
list      |           |
get       | ✔         | `memcached.get()`
add       | ✔         | `memcached.add()`
set       | ✔         | `memcached.set()`
touch     | ✔         | `memcached.touch()`
del       | ✔         | `memcached.del()`

## Topics

> lib/archivist/index.js

```javascript
exports.player = {
  index: ['userId'],
  vaults: {
    userVault: {}
  }
};
```

Topics are essentially Archivist datatypes; they define which vault(s)
to use for storage, the key structure for accessing data, and so on.

In this example, we simply specify a new topic, called items, in which we will be
identifying by itemId.

## Store & retrieve topics

> lib/modules/players/index.js

```javascript
exports.create = function (state, userId, playerData) {
  state.archivist.set('player', { userId: userId }, playerData);
};

exports.list = function (state, callback) {
  var topic = 'player';
  var partialIndex = {};

  state.archivist.list(topic, partialIndex, function (error, indexes) {
    if (error) {
      return callback(error);
    }

    var queries = indexes.map(function (index) {
      return { topic: topic, index: index };
    });

    state.archivist.mget(queries, callback);
  });
};
```

> lib/modules/players/usercommands/register.js

```javascript
var mage = require('mage');
exports.acl = ['*'];
exports.execute = function (state, username, password, callback) {
  mage.players.register(state, username, password, function (error, userId) {
    if (error) {
      return state.error(error.code, error, callback);
    }

    mage.players.create(state, userId, {
      coins: 10,
      level: 1,
      tutorialCompleted: false
    });

    state.respond(userId);

    return callback();
  });
};
```

> lib/modules/players/usercommands/list.js

```javascript
var mage = require('mage')
exports.acl = ['*'];
exports.execute = function (state, callback) {
  mage.players.list(state, function (error, players) {
    // We ignore the error for brievety's sake
    state.respond(players);
    callback();
  });
};
```

Again, in this example we are leaving the ACL permissions entirely open so that you may
try to manually access them; in the real world, however, you would need to make sure to
put the right permissions in here.

In this example, we augment the players module we have previously created with two
methods: `create`, and `list`. In each method, we use `state.archivist` to retrieve
and store data. We then modify the `players.register` user command, and have it create
the player's data upon successful registration. Finally, we add a new user command
called `players.list`, which will let us see a list of all players' data.

You may notice that `players.list` actually calls two functions: `state.archivist.list` and
`state.archivist.mget`; this is because `list` will return a list of indexes, which we
then feed into `mget` (remember, Archivist works with key-value).

You may also notice that while `state.archivist.list` is asynchronous (it requires a callback
function), `state.archivist.set` is not; because states act as transactions, writes
are not executed against your backend storage until the transaction is completed, thus
making write operations synchronous. This will generally be true of all `state.archivist`
APIs; reads will be asynchronous, but writes will be synchronous.

## Testing storage

```shell
curl -X POST http://127.0.0.1:8080/game/players.list \
--data-binary @- << EOF
[]
{}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.list" -Body '[]
{}'
```

We can re-use the previous command to create a new user; once we have done so, we can use
the following command to retrieve the data we have just created.

## Key-based filtering

> lib/archivist/index.js

```javascript
exports.item = {
  index: ['userId', 'itemId'],
  vaults: {
    itemVault: {}
  }
};
```

> lib/modules/items/index.js

```javascript
exports.getItemsForUser = function (state, userId, callback) {
  var topic = 'item';
  var partialIndex = { userId: userId };

  state.archivist.list(topic, partialIndex, function (error, indexes) {
    if (error) {
      return callback(error);
    }

    var queries = indexes.map(function (index) {
      return { topic: topic, index: index };
    });

    state.archivist.mget(queries, callback);
  });
};
```

There are a few ways by which you can split and filter the data
stored in your topics.

In this example, we have an `item` topic with an index of two fields: `userId` and `itemId`.
When a topic index has more than one field, we can use the `partialKey` on a `state.archivist.list`
call to filter the list of keys to return. In the sample code here, we use this
feature to return all items' full keys for a given user.

## Limiting access

> lib/archivist/index.js

```javascript
exports.item = {
  index: ['userId', 'itemId'],
  vaults: {
    client: {
      shard: function (value) {
        return value.index.userId;
      },
      acl: function (test) {
        test(['user', 'test'], 'get', { shard: true });
        test(['cms', 'admin'], '*');
      }
    },
    inventoryVault: {}
  }
};
```

In most cases, you will want to make sure that a given user will
only be able to access data they have the permission to access.

There are primarily two ways to limit access to topics:

  * **shard function**: used to filter what data can be viewed;
  * **acl function**: used to determine if the data can be accessed;

In this example, we use the shard function to limit returned data
to only data which matches the userId.

We then use the acl function to only allow users and tests access to
the `get` API, but full access to CMS users and administrators.

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
Never configure multiple vaults to connect to the same vault backend storage!
This would break how [migration scripts](#migrations) work.
</aside>

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
| sqlite3               | [SQLite](https://www.sqlite.org/) interface.                 |

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

`archivist:create` support is done via `mkdirp` and just requires that the user
running the command has enough rights to create folders in the project's path.

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

    # options only used with archivist:create
    create:
        adminUsername: admin
        adminPassword: "password"
        bucketType: couchbase # can be couchbase or memcached
        romQuotaMB: 100       # how much memory to allocate to the bucket
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

`archivist:create` support requires a separate `create` entry in the `config`,
meanwhile views should be created/managed in migration scripts.

<br><br><br><br><br>

### MySQL

```yaml
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

`archivist:create` support requires that the user is allowed to create databases.

> Sample query to create a basic "people" topic table store.

```sql
CREATE TABLE people (
  personId INT UNSIGNED NOT NULL,
  value TEXT NOT NULL,
  mediaType VARCHAR(255) NOT NULL,
  PRIMARY KEY (personId)
);
```

Queries against your database are done through a combination of the generated keys and serialized
values. A generated key must yield a table name and a primary key. A serialized value must yield a
number of column names with their respective values.

For instance, given a topic `people` and index `{ personId: 1 }`, the destination table will need
to have a `personId` field, but also a `value` field to store data ad a `mediaType` field so that
MAGE may know how to process the stored value.

> Overriding the serializer

```javascript
exports.people.vaults.mysql.serialize = function (value) {
	return {
		value: value.setEncoding(['utf8', 'buffer']).data,
		mediaType: value.mediaType,
		lastChanged: parseInt(Date.now() / 1000)
	};
};
```

If you want to change how this information is stored, by adding columns, etc, you can overload the
serializer method to do so. For example, consider the following example if you want to add a
timestamp to a `lastChanged INT UNSIGNED NOT NULL` column.

<br><br><br><br><br><br><br><br><br><br><br><br><br><br>

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

### SQLite3

```yaml
type: sqlite3
config:
    filename: "./sqlitevault/awesomegame.db"
```

This vault should only be used for development and testing.

Further documentation can be found at [node-sqlite3](https://github.com/mapbox/node-sqlite3).
To avoid confusion, the npm package name is sqlite3, but the project is called node-sqlite3.

If no filename is provided, an in-memory database will be created at runtime and will be destroyed on close.

If an empty string is provided, an temporary database stored on disk will be createdat runtime and destroyed on close.

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `SELECT FROM table WHERE partialIndex`
get       | ✔         | `SELECT FROM table WHERE fullIndex`
add       | ✔         | `INSERT INTO table () VALUES ()`
set       | ✔         | `INSERT OR REPLACE INTO table () VALUES ()`
touch     |           |
del       | ✔         | `DELETE FROM table WHERE fullIndex`

`archivist:create` support requires that the user be allowed to create databases. However, you
will still need to write a [migration script](#migrations) to create the different tables
where your topics will be stored.

See [documentation](#mysql) for the `MySQL` vault on how to structure your tables for usage with archivist.

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

  state.archivist.scan(topic, partialIndex, callback);
};
```

With certain APIs you can provide only a portion of an index and search for
all indexes who have the same value for that option. These indexes are referred
to as *partial indexes*.

There are a few ways by which you can split and filter the data
stored in your topics:

  1. You can use [archivist.list](https://mage.github.io/mage/api/classes/archivist.html#list) to list
     all the indexes matching a given partial index
  2. You can use [archivist.mget](https://mage.github.io/mage/api/classes/archivist.html#mget) to fetch
     multiple indexes at once
  3. You can use [archivist.scan](https://mage.github.io/mage/api/classes/archivist.html#scan), which combines
     both operations mentioned above into one

You will generally want to use `scan` for most of your operations, but in some cases, you will find
that manually fetching the list of indexes using `list` and applying your own custom filtering before
calling `mget` will give you a better result.

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

## Database Creation

Some vaults also support database/vault creation via the `archivist:create` command as long
as admin credentials are properly configured, see each vault's configuration on how to use it.

List of `archivist:create` enabled backends:

* `file`
* `couchbase`
* `mysql`
* `sqlite`

It is not recommended to use those features in production.

## Migrations

MAGE supports database migration scripts similar to [Ruby on Rails 2.1](http://api.rubyonrails.org/classes/ActiveRecord/Migration.html)
which are aligned with your `package.json` version and exposed via the `archivist:migrate`
command.

Running the `archivist:migrate` command will go through each migrations in order up to the current
`package.json` version and apply them. The command also allows specifying an exact version allowing
for testing new migrations or reverting to a previous version.

### How to write migration scripts

Migration scripts are single files per vault and per version. These files are JavaScript modules and
should export two methods: `up` and `down`, to allow migration in two directions. You are strongly
encouraged to implement a `down` migration path, but if it's really impossible, you may leave out
the `down` method. Keep in mind that **this will block rollback operations**. See the sample on the
right side for more details.

```javascript
exports.up = function (vault, cb) {
        var sql =
                'CREATE TABLE inventory (\n' +
                '  actorId VARCHAR(255) NOT NULL PRIMARY KEY,\n' +
                '  value TEXT NOT NULL,\n' +
                '  mediaType VARCHAR(255) NOT NULL\n' +
                ') ENGINE=InnoDB';

        vault.pool.query(sql, null, function (error) {
                if (error) {
                        return cb(error);
                }

                return cb(null, { summary: 'Created the inventory table' });
        });
};

exports.down = function (vault, cb) {
        vault.pool.query('DROP TABLE inventory', null, cb);
};
```

The migration file goes to your game's `lib/archivist/migrations` folder into a subfolder per vault.
This folder should have the exact same name as your vault does. The migration file you provide
should be named after the version in `package.json` and have the extension `.{js,ts}`. Other file
extensions are ignored.

Some typical examples:

* `lib/archivist/migrations/<vaultname>/v0.1.0.js`
* `lib/archivist/migrations/<vaultname>/v0.1.1.js`
* `lib/archivist/migrations/<vaultname>/v0.2.0.js`


The callback of the `up` method allows you to pass a report, that will be stored with the migration
itself inside the version history. In MySQL for example, this is all stored in a `schema_migrations`
table, which is automatically created.

### How to execute migrations

Migrations can be executed by calling some specific CLI commands, which are detailed when you run
`npm run help` or `mage --help`. They allow you to create a database, drop a database, and run migrations.
This is what they look like:

```plaintext
archivist:create [vaults]     create database environments for all configured vaults
archivist:drop [vaults]       destroy database environments for all configured vaults
archivist:migrate [version]   migrates all vaults to the current version, or to the version requested
```

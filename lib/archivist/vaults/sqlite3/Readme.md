## SQLite3 vault

The sqlite3 package is supported through the built-in "sqlite3" vault type.
This vault should really only be used for development and testing. Be forwarned.
Further documenation can be found at [node-sqlite3](https://github.com/mapbox/node-sqlite3).
To avoid confusion, the npm package name is sqlite3, but the project is called node-sqlite3.


### Configuration

#### URL based config
```yaml
		sqlite3:
			type: sqlite3
			config:
				filename: "./sqlitevault/awesomegame.db"
```

Filename takes both absolute and relative (to project root) references.
If no filename is provided, an in memory db will be created that will be destroyed on close.
If an empty string is provided, an temporary db stored on disk will be created and destroyed on close.


### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `SELECT FROM table WHERE partialIndex`
get       | ✔         | `SELECT FROM table WHERE fullIndex`
add       | ✔         | `INSERT INTO table () VALUES ()`
set       | ✔         | `INSERT OR REPLACE INTO table () VALUES ()`
touch     |           |
del       | ✔         | `DELETE FROM table WHERE fullIndex`


### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | `{ table: topic, pk: index }`
`parseKey(key)`       |          | `{ topic: key.table, index: key.pk }`
`serialize(value)`         |          | `{ value: utf8orBufferFromValue, mediaType: value.mediaType }`
`deserialize(data, value)` |          | parses row.value and row.mediaType into Value


### Bootstrapping a database

This is supported through the `./game archivist-create` CLI command. This will create your empty
database. Tables must be created through migration scripts. Running `./game archivist-drop` will
drop the entire database.


### Schema migrations

Archivist allows for [schema migrations](../../SchemaMigrations.md), and the SQLite vault supports
this.


### How to set up your SQLite tables

Queries against your database are done through a combination of the generated keys and serialized
values. A generated key must yield a table name and a primary key. A serialized value must yield a
number of column names with their respective values.

The default topic API that comes with this vault behaves as can seen in the table above. This means
that for example, given a topic `people` and index `{ personId: 1 }`, the following table should
exist:

```sql
CREATE TABLE people (
  personId INT UNSIGNED NOT NULL,
  value TEXT NOT NULL,
  mediaType VARCHAR(255) NOT NULL,
  PRIMARY KEY (personId)
);
```

If you want to change how this information is stored, by adding columns, etc, you can overload the
serializer method to do so. For example, consider the following example if you want to add a
timestamp to a `lastChanged INT UNSIGNED NOT NULL` column.

```javascript
exports.people.vaults.sqlite3.serialize = function (value) {
	return {
		value: value.setEncoding(['utf8', 'buffer']).data,
		mediaType: value.mediaType,
		lastChanged: parseInt(Date.now() / 1000)
	};
};
```

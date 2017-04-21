# Migrations

As much as we need versioning for our application code, we also need versioning for our datastore
formats. This includes things like MySQL schemas & stored procedures, as well as Couchbase document
views. As such migrations are required to safely move between these versions.


## How it works

All migrations in your project are considered versioned identically to the version of your project
itself (the version in your `package.json` file). That means that when you deploy version v1.6.0 of
your game and it contains a datastore change:

- that change should be applied automatically before the game goes live.
- that change must be undone if we ever roll back from version 1.6.0 to a version before it.

The up/down migration flow that archivist applies, is identical to
[Ruby on Rails 2.1](http://api.rubyonrails.org/classes/ActiveRecord/Migration.html).

**In a nutshell:**

*When migrating to a newer version*

- List all available migrations
- Limit the list to versions newer than the installed version and up to (inclusive) the target version.
- Sort them using Semantic Versioning.
- Apply them one by one.

*When migrating down to an older version*

- List all available migrations
- Limit the list to the installed version and older and down to (exclusive) the target version.
- Limit the list further to only versions that were ever applied to this database.
- Sort them using Semantic Versioning in reverse order.
- Apply them one by one.


## How to write migration scripts

Migration scripts are single files per vault and per version. These files are JavaScript modules and
should export two methods: `up` and `down`, to allow migration in two directions. You are strongly
encouraged to implement a `down` migration path, but if it's really impossible, you may leave out
the `down` method. Keep in mind that **this will block rollback operations**.

The migration file goes to your game's `lib/archivist/migrations` folder into a subfolder per vault.
This folder should have the exact same name as your vault does. The migration file you provide
should be named after the version in `package.json` and have the extension `.js`. Files that do not
have a `.js` extension will be ignored in the migration process.

Some typical examples:

```
lib/archivist/migrations/<vaultname>/v0.1.0.js
lib/archivist/migrations/<vaultname>/v0.1.1.js
lib/archivist/migrations/<vaultname>/v0.2.0.js
```

Let's have a look inside one of these files:

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

As you can see, it provides two methods that allow migration in both directions. Both methods
receive the vault that is being migrated (in this case a MySQL type vault), so you can execute
operations on it.

The callback of the `up` method allows you to pass a report, that will be stored with the migration
itself inside the version history. In MySQL for example, this is all stored in a `schema_migrations`
table, which is automatically created.


## How to execute migrations

Migrations can be executed by calling some specific CLI commands, which are detailed when you run
`./game --help`. They allow you to create a database, drop a database, and run migrations. This is
what they look like:

```
archivist-create              create database environments for all configured vaults
archivist-drop                destroy database environments for all configured vaults
archivist-migrate [version]   migrates all vaults to the current version, or to the version requested
```

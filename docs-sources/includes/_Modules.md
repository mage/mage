# Modules

## External helper modules

External helpers modules are optional but simplify the use of the library.
They are different from mage built-in modules and user modules: they don't expose usercommands, they just act as helpers.

Here are the most important:


| Module                                                                           | Description                                                                                                                                       | TypeScript library |
|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|--------------------|
| [mage-console](https://github.com/mage/mage-console)                             | Mage development console with [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop) interface and auto-reload on file change |                    |
| [mage-validator](https://github.com/mage/mage-validator)                         | Validation system for MAGE topics and user command input types                                                                                    | ✔                  |
| [mage-module-shard](https://github.com/mage/mage-module-shard)                   | Helps you to implement modules that act as shards within a MAGE cluster                                                                           | ✔                  |
| [mage-vaulthelper-couchbase](https://github.com/mage/mage-vaulthelper-couchbase) | Helps you to access mage Couchbase backend                                                                                                        | ✔                  |
| [mage-module-maintenance](https://github.com/mage/mage-module-maintenance)       | Helps you implement a maintenance mode for your game cluster                                                                                      | ✔                  |
| [mage-https-devel](https://github.com/mage/mage-https-devel)                     | Toolchain for enabling the use of HTTPS during local development                                                                                  |                    |

## Built-in modules

> lib/index.js

```javascript
// Default modules with a fresh mage install
// (with npx mage create [game name])
mage.useModules([
  'archivist',
  'config',
  'logger',
  'session',
  'time'
]);

```


In the mage library, some modules are already created to provide some facilities such as session and authentication. The full list of available modules is defined as below:

| Module                     | Description                                          |
|----------------------------|------------------------------------------------------|
| archivist                  | Expose usercommands to synchronize data in real time |
| config                     | Expose client config with a usercommand              |
| [auth](#auth-module)       | Authentication facility                              |
| [logger](#logging)         | Logging facility                                     |
| [session](#session-module) | Session facility                                     |
| [time](#time-manipulation) | Time manipulation facility                           |

<aside class="notice">
Note that the built-in archivist module is different from <a href="#archivist">Archivist</a> defined later.
</aside>


To see the default modules on a fresh install of mage and how they can be set up, see the example on the right side.
Note that the `auth` module is **not activated by default**.

### Set up the auth module

To set up the auth module, adding it to `mage.useModules` is not sufficient, a basic configuration is needed.
See the example on the right side for a basic configuration.

Here are the different hash types you can use:

| Type                    | Description                                                   |
| ---------------------   | ------------------------------------------------------------  |
| pbkdf2                  | [pbkdf2 algorithm](https://en.wikipedia.org/wiki/PBKDF2)      |
| hmac                    | [hmac algorithm](https://en.wikipedia.org/wiki/HMAC)          |
| hash                    | Basic hash                                                    |

> `lib/index.js`

```javascript
mage.useModules([
  'auth'
]);
```

> lib/archivist/index.js

```javascript
// a valid topic with ['username'] as an index
exports.auth = {
  index: ['username'],
  vaults: {
    myDataVault: {}
  }
};
```

> config/default.yaml

```yaml
module:
    auth:
        # this should point to the topic you created
        topic: auth

        # configure how user passwords are stored, the values below are the
        # recommended default
        hash:
            # Please see https://en.wikipedia.org/wiki/PBKDF2 for more information
            type: pbkdf2
            algorithm: sha256
            iterations: 10000
```

```yaml
        hash:
          # Please see https://en.wikipedia.org/wiki/HMAC for more information
          type: hmac
          algorithm: sha256
          # Hex key of any length
          key: 89076d50860489076d508604
```

```yaml
        hash:
          # Basic hash
          type: hash
          algorithm: sha1
```

## File structure

```plaintext
mygame/
  lib/
    modules/
      players/    -- the name of our module
        index.js  -- the entry point of the module
        usercommands/
          login.js  -- the user command we use to login
```

Modules are a way to separate concerns; they contain groups of
functionality for a certain subject (users, ranking, shop, etc),
and expose API (called user commands) that are accessible through
the different client SDKs.

## Module setup and teardown

> lib/modules/players/index.js

```javascript
exports.setup = function (state, callback) {
  // load some data
  callSomething('someData', callback);
};

exports.teardown = function (state, callback) {
  // load some data
  callSomething('someData', callback);
};
```

MAGE modules can optionally have the two following hooks:

  * **setup**: When the server is started
  * **teardown**: When the server is about to be stopped

The setup function will run when MAGE boots up allowing your module
to prepare itself, for example by loading vital information from a data store into memory.
This function is optional, so if you do not have a setup phase, you don't need to add it.

Teardown functions in a similar way; you may want to store to database
some data you have been keeping in memory, or send some notifications to your users.

Note that by default, each hook will have 5000 milliseconds to complete; should you need
longer than that, you will need to set `exports.setupTimeout` and `exports.teardownTimeout`
respectively to the value of your choice.

## Module methods

> lib/modules/players/index.js

```javascript
var mage = require('mage');

exports.register = function (state, username, password, callback) {
  var options = {
    acl: ['user']
  };

  mage.auth.register(state, username, password, { options }, callback);
};
```

You will then want to add methods to your modules. These are different from your API endpoints;
they are similar to model methods in an MVC framework, but they are not attached to an object
instance.

This example shows how you could create a quick player registration method.

## User commands

> lib/modules/players/usercommands/register.js

```javascript
var mage = require('mage');

// Who can access this API?
exports.acl = ['*'];

// The API endpoint function
exports.execute = function (state, username, password, callback) {
  mage.players.register(state, username, password, function (error, userId) {
    if (error) {
      return state.error(error.code, error, callback);
    }

    state.respond(userId);

    return callback();
  });
};
```

User commands are the endpoints which the game client will be accessing. They define
what class of users may access them, and what parameters are acceptable.

The name of a user command is composed of its module name and the name of the file.
For instance, in the example here, the name of the user command would be `players.register`.
The parameters this user command accepts are everything between the `state` parameter and the
`callback` parameter; so in this case, `players.register` accepts a `username` parameter, and
a `password` parameter.

Our user command also receives a state object. We won't describe exactly what states are used
for yet, but we can see that they are to be used to respond with an error should one occur.

## Testing your user command

```shell
npm run archivist:create
npm run develop
```

```powershell
npm run archivist:create
npm run develop
```

Before we try to test the code above, we will first need to create a place for the auth module
to store the data. `archivist:create` will do just that.

Once this command completes, we'll start our MAGE project in development mode.

> In a separate terminal window

```shell
curl -X POST http://127.0.0.1:8080/game/players.register \
--data-binary @- << EOF
[]
{"username": "test","password": "secret"}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.register" -Body '[]
{"username": "username", "password": "password"}' | ConvertTo-Json
```

For testing most user commands in MAGE, you would normally need to use one
of the [client SDKs](#client-sdks); however, this example is simple enough
for us to be able to simply query the endpoint manually.

You may notice that the content we send is in line-separated JSON format, and
that the first thing we send is an empty array; this array, under normal
circumstances, would contain credentials and other metadata.

## Login

> lib/modules/players/index.js

```javascript
var mage = require('mage');

exports.register = function (state, username, password, callback) {
  var options = {
    acl: ['user']
  };

  mage.auth.register(state, username, password, options,  function (error, userId) {
    if (error) {
      return callback(error);
    }

    mage.logger.debug('Logging in as', userId);

    mage.auth.login(state, username, password, callback);
  });
};
```

Now that we can register users, we may want to automatically log in the user by calling
`mage.auth.login`. While the registration has not been completed in the database, our `state`
transaction contains the information for the newly registered user, which will allow for
`login` to complete successfully.

For more information about the `auth` module, please refer to the
[API documentation](https://mage.github.io/mage/api/classes/mage.html#auth).

## ACLs

> lib/modules/players/usercommands/notAccessibleToNormalUers.js

```javascript
var mage = require('mage');

// Who can access this API?
exports.acl = ['special'];

// [...]
```

As you may have noticed, `mage.auth.register` receives and `acl` option allowing
to attach to a give user different access rights. User commands can then in return
list what ACL groups are allowed to acces that user command.

For instance, in the example above, a user registered only with the `user` credential
would not be allowed to execute this user command. Only if the 'user' or '*' wildcard ACL
were added to the `exports.acl` array would a normal user be able to execute it.

By standard, `user` is assigned to any registered player, but you may create your own ACL
groups as you see fit.

## User command timeout

> lib/modules/players/usercommands/register.js

```javascript
var mage = require('mage');

// Who can access this API?
exports.acl = ['*'];

exports.timeout = 200

// [...]
```

By default, user command execution will time out after 15,000 milliseconds; however,
in some cases, you may want to increase or reduce that value.

To do so, simply set `exports.timeout` to your desired value.

Keep in mind that the execution of your usercommand may not get interrupted;
we will return an error on the next access to the user command's `state`
(which will in turn ensure that execution is interrupted), but manual operations
unrelated to `state` may still complete.

## Request caching

```shell
curl -X POST http://127.0.0.1:8080/game/players.checkStats?queryId=1 \
--data-binary @- << EOF
[{"key":"be20d767-4067-40d6-92dc-c52067b7d21e:lMftdnXxEFbP3ctq","name":"mage.session"}]
{}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.checkStats?queryId=1" -Body '[{"key":"be20d767-4067-40d6-92dc-c52067b7d21e:lMftdnXxEFbP3ctq","name":"mage.session"}]
{}' | ConvertTo-Json
```

By default, responses to requests from authenticated users which
contain a numerical identifier in the will be automatically cached;
this is so to avoid double-execution when the client disconnects before
the response could be sent and the client wishes to retry.

This comes handy for most operations (trades, purchases and so on),
but may be undesirable in some circumstances (when you serve computed
static data or static data stored in the database).

> lib/modules/players/usercommands/checkStats.js

```javascript
exports.cache = false;
```

To disable this behavior, simply set `cache` to false
in your user command's definition.

## Using async/await (Node 7.6+)

<aside class="notice">
If you are using Node.js 7 but older than 7.6, you can still use
async/await by adding [enable-async](https://www.npmjs.com/package/enable-async)
to your project.
</aside>

> lib/modules/players/index.js

```javascript
'use strict';

const promisify = require('es6-promisify');
const {
  auth
} = require('mage');

exports.register = async function (state, username, password) {
  const options = {
    acl: ['user']
  };

  const register = promisify(auth.register, auth);

  return register(state, username, password, options);
};
```

> lib/modules/players/usercommands/register.js

```javascript
'use strict';

const {
  players
} = require('mage');

module.exports = {
  acl: ['*'],
  async execute(state, username, password) {
    return players.register(state, username, password);
  }
};
```

> lib/modules/players/usercommands/staticData.js

```javascript
'use strict';

module.exports = {
  serialize: false,
  acl: ['*'],
  async execute(state) {
    return '{"static": "data"}';
  }
};
```

If you are using a newer Node.js version, which includes the latest ES2015 and ES2017
language features, you can rewrite the previous API as follows. As you can see, this results not
only in much fewer lines of code, but also into a much simpler, easier to read code.

Let's review what we have done here:

  1. Variable declaration using `const`, which prohibits the variable to be rebound;
  2. Destructuring, to extract the specific MAGE modules and components we want to use;
  3. async/await and Promises, to simplify the expression of asynchronous code paths;

Note that due to legacy, most of MAGE's API are callback-based, which can sometimes conflict with
the latest Promise-based API's; to help with this, we recommend that you install
[es6-promisify](https://www.npmjs.com/package/es6-promisify) in your project, and then use it to
wrap the different MAGE APIs you wish to use.

Also, you can see that the `players.staticData` user command serializes data by itself to JSON
instead of relying on MAGE to serialize the return data. This can be useful when you wish to optimize how MAGE
will serve certain pieces of data which will not change frequently. When you wish to do so, simply make
sure that `exports.serialize` is set to `false`, and to manually return a stringified version of your
data.

## Error management

> lib/modules/players/usercommands/register.js

```javascript
'use strict';

const {
  players,
  MageError
} = require('mage');

class NoHomersError extends MageError {
  constructor(data) {
		super(data);

    // Code to return to the client (default: server)
    this.code = 'server';

    // Log level to use to log this error (default: error)
    this.level = 'warning';

    // Details to log alongside the message (default: undefined)
    this.details = data.details;

    // Error type - traditionally the class name
 		this.type = 'NoHomersError';
 	}
}

module.exports = {
  acl: ['*'],
  async execute(state, username, password) {
    if (username.length > 10) {
      // Using MageError directly
      throw new MageError({
        code: 'username_length_exceeded',
        level: 'warning',
        message: 'Username is more than 10 character',
        details: {
          received: username
        }
      })
    }

    if (username === 'homer') {
      // Using a custom error class inheriting MageError
      throw new NoHomersError({
        message: 'We already have one Homer anyway '
      })
    }

    return await players.register(state, username, password);
  }
};
```

When using `async/await`, you will want to customise the behavior of your errors
in regards to how they will be logged, what data will be logged, what message will be
returned to the user, and so on.

To do so, MAGE provides the `MageError` error class, which can be used as-is or
extended as needed. This error class will allow you to control precisely what you will
log in case of error, and what should be returned to the user.

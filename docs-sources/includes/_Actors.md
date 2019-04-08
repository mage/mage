# Actors & Sessions

MAGE defines users as "actors", who are represented by an ID (the Actor ID).

For an actor to make changes to the database (through a user command) and send events to other users,
it will generally need to be authenticated. During authentication, an actor starts a session and
is assigned a unique session ID.

As long as a session ID is used and reused by an actor, it will stay active. After a long period
of non-activity however, the session will expire and the actor will be "logged out" as it were.

## Session module

> `lib/index.js`

```javascript
mage.useModules([
  'session'
]);
```

Freshly bootstrapped MAGE applications already have the session module activated and configured (including a basic Archivist configuration which will store session-information in memory).

For multi-node MAGE clusters, make sure to change the vault used for sessions to be stored
in a shared memory storage solution such as memcached, redis, etc... Since MAGE will need
to retrieve sessions to route messages to them properly.

## Auth module

Once configured you can just add the `auth` module to your `useModules` call.
Please see [built-in modules](##built-in-modules) part to see how to set up the auth module.

## Logging in

>  lib/modules/players/index.js

```javascript
exports.login = function (state, username, password, callback) {
  mage.auth.login(state, username, password, callback);
};
```

> lib/modules/players/usercommands/login.js

```javascript
var mage = require('mage');
var logger = mage.logger.context('players');

exports.acl = ['*'];

// The API endpoint function
exports.execute = function (state, username, password, callback) {
  mage.players.login(state, username, password, function (error, session) {
    if (error) {
      return state.error(error.code, error, callback);
    }

    logger.debug('Logged in user:', session.actorId);
    callback();
  });
};
```

The auth module allows us to login. For now, let's not bother with user accounts and use the
anonymous login ability instead. As long as we do this as a developer (in development mode),
we can login anonymously and get either user-level or even administrator-level privileges.
In production that would be impossible, and running the same logic would result in "anonymous"
privileges only. You wouldn't be able to do much with that.

The session module will have automatically picked up the session ID that has been assigned to us,
so there is nothing left for us to do.

When you are ready to create user accounts, please read on about how to use and configure the
[auth module](https://github.com/mage/mage/tree/master/lib/modules/auth).

### Testing your login user command

```shell
curl -X POST http://127.0.0.1:8080/game/players.login \
--data-binary @- << EOF
[]
{"username": "test","password": "secret"}
EOF
```

```powershell
 Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/game/players.login" -Body '[]
{"username": "test", "password": "secret"}' | ConvertTo-Json
```

If authentication fails, you will receive `[["invalidUsernameOrPassword",null]]`;
otherwise, you should get back an event object containing your player's session information.

## Changing the password

You can change the password for a given user after registration. It works the same way as registration, except
that the user ID needs to exist or you will get a `UserNotFoundError`. Note that this does not invalidate current
sessions for this account.

>  lib/modules/players/index.js

```javascript
exports.changePassword = function (state, username, newPassword, callback) {
  mage.auth.changePassword(state, username, newPassword, callback);
};
```

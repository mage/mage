# Session Module

Session management.

## API

The session object can often be found on `state.session`. The `Session` class exposes the following API:

**string session.actorId**

The user ID associated with this session.

**string session.language**

The language code associated with this user/session.

**session.expire(State state, string reason)**

Expires the session and communicates it to the client passing the given reason.

**session.extend(State state)**

Recalculates a new expiration time for the session and saves it.

### Session variables

You can store arbitrary data on a session object.

**mixed session.getData(string key)**

Returns data for the given key.

**session.setData(string key, mixed value)**

Sets data at a given key.

**session.delData(string key)**

Deletes the data at a given key.


## User Commands

### isValid(sessionKey, callback(err))

#### Description

Check if a session key still exists in the session datastore. This can be useful in combination
with the [ident module](../ident) if you wish to persist sessions on the client (using cookies or
local storage), and you want to check the validity of the stored session key when the user returns
to the application.

#### Arguments

* **sessionKey** (String): A session key (see [mage.session.getKey()](./client.js#L35)).
* **callback** (Function): A function to call back when the validation has been performed.

The callback function will be passed the following arguments:

* **err** (String): An error string. Will be null if the session is valid.

#### Example

This example shows how to setup persistent session
on the client, so that it may be reused after each
page reload.

```javascript
var mage = require('mage');
var storeKey = 'sessionKey'
var sessionKey = localStorage.getItem(storeKey);

if (sessionKey) {
	mage.session.restore(sessionKey, function (err) {
		if (err) {
			mage.logger.debug('Stored session key is invalid', sessionKey);
			localStorage.removeItem(storeKey);
		}
	});
}

//
// In general, you will have this piece of code
// somewhere in your application to save
// the session key locally whenever it gets
// set
//
mage.eventManager.on('session.set', function (path, session) {
	var sessionKey = session.key;
	mage.logger.debug('Saving session key locally', sessionKey);
	localStorage.setItem(SESSION_KEY, sessionKey);
});

//
// And delete the session key when it expires
//
mage.eventManager.on('session.unset', function (path, reason) {
	mage.logger.debug('Deleting local copy of session key because:', reason);
	localStorage.removeItem(SESSION_KEY);
});
```

### session.restore(sessionKey, callback)

You can restore a session as long as it has not expired by calling session.restore with your
session key.

#### Arguments

* **sessionKey** (String): A session key (see [mage.session.getKey()](./client.js#L35)).
* **callback** (Function): A function to call back when the session has been restored.

The callback function will be passed the following arguments:

* **err** (String): An error string. Will be null if the session is restored successfully.

### session.logout(callback)

You can logout of your existing session causing it to immediately expire.

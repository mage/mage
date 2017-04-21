# Auth

The `auth` module helps with the creation of users and their login process, based on a users' username and password.
It provides a server-side only API that you can wrap your own user commands and other logic around.

## Usage

### Configuration

For starters, you need to ensure an archivist topic has been configured in your `lib/archivist` folder. The index for
this topic is `['username']`, since we will be storing users by their username.

```javascript
exports.myAuthTopic = {
	index: ['username'],
	vaults: {
		userVault: {}
	}
};
```

Once you have configured an archivist topic, you can update your application configuration as follows.

```yaml
module:
  auth:
    topic: myAuthTopic
    hash:
      type: "hash, hmac or pbkdf2"
      # other configuration based on the hash-type
```

**hash example**

```yaml
module:
  auth:
    topic: myAuthTopic
    hash:
      type: hash
      algorithm: "hashAlgo, eg: sha1"
```

**hmac example**

```yaml
module:
  auth:
    topic: myAuthTopic
    hash:
      type: hmac
      algorithm: "hashAlgo, eg: sha256"
      key: "a hex key of any length, eg: 89076d50860489076d508604"
```

**pbkdf2 example**

```yaml
module:
  auth:
    topic: myAuthTopic
    hash:
      type: pbkdf2
      algorithm: 'hashAlgo, eg: sha256'
      iterations: 12000
```

### API

**Registering a new user**

```javascript
mage.auth.register(state, username, password, options, cb);
```

- `options.userId` may be provided if the user ID is to be generated externally
- `options.acl` is an array of acl identifiers, eg: `['user']`
- The callback receives `(error, userId)`

**Logging in an existing user**

```javascript
mage.auth.login(state, username, password, cb);
```

- The callback receives `(error, session)`

**Logging in anonymously**

```javascript
mage.auth.loginAnonymous(state, options);
```

- `options.userId` may be provided if the user ID is to be generated externally
- `options.acl` is an array of acl identifiers, eg: `['user']`
- The callback receives `(error, session)`

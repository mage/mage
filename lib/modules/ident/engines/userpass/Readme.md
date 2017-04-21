# userpass

The `userpass` engine provides a basic username/password identification mechanism to be used with
your app. It uses hash based identification and allows you to store your credentials in archivist.
The archivist topic is the same as the engine name. It can be overridden in the configuration.
Requirements are that the vault you use supports `get` and `set` operations and the index is set to
`[ 'username' ]`. MAGE comes preconfigured with one userpass engine called `mageUsernames`.

## Configuration

This is the engine configuration:

```yaml
config:
	# you can override the archivist topic here, by default it's the same as the engine name.
	#topic: "specialUsers"

	# change the size of salts generated when creating a new user, by default the engine uses
	# 32 bytes which should be more than enough for quite a while but like the pbkdf2 iterations
	# you may want to bump it every few years if you are using a basic hash algo (such as md5 or
	# sha1) as cloud computing and ASICs become cheaper every year making brute force easier
	#saltSize: 32

	# you can enable password hashing by setting a valid hash algo here, see:
	# http://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm
	# for a list of algorithms
	#hash: sha1

	# hmac are supported too
	#hmac:
	#	algorithm: sha256
	#	key: somelongkeythatnoonewillguess

	# pbkdf2 is nowadays the recommended way to store passwords
	# the number of iterations should be adapted to your hardware, at least 10k is recommended but
	# if the servers are good enough you can go to way up, you will need to experiment for that one
	# (maybe we should make a tool to measure the optimal amount of iterations?)
	# it is recommended to bump that number up every year or so for the same reasons given about the
	# salt size
	#pbdkf2:
	#	iterations: 15000
```

## Methods

### auth ( state, credentials, cb )
Credentials must be an object with two properties: `username` and `password`, like this:
``` json
{
	"username": "info@wizcorp.jp",
	"password": "123456"
}
```

Successful authentication with the userpass engine will return the userId of the user in the
callback, in this user's case:
```
"be895324-7325-4239-92ef-1f04c1c225d1"
```


### createUser ( state, credentials, userId, cb )
Credentials must be an object with two properties: `username` and `password`, like this:
``` json
{
	"username": "info@wizcorp.jp",
	"password": "123456"
}
```

If you pass in a userId, MAGE will use that as this user's gobally unique userId. If you leave it
out, MAGE will generate a UUID.

### getUser ( state, username, cb )
Returns the entire user object which looks something like this:
``` json
{
	"username": "info@wizcorp.jp",
	"userId": "be895324-7325-4239-92ef-1f04c1c225d1",
	"password": "5843c8e0dbf4bf3dc4599ad125d2c679e60df4bd",
	"salt": "88dc3d39ce12f617a2d15817ce0a403c4ff6d09e67e4d82f0960a4cc2780b377"
}
```

### updateCredentials ( state, credentials, cb )
Credentials object should contain existing username and new password like this:
``` json
{
	"username": "info@wizcorp.jp",
	"password": "new password"
}
```

### listUsers ( state, cb )
Returns a list of usernames and userIds, like this:
``` json
[ { "username": "info@wizcorp.jp",
	"userId": "be895324-7325-4239-92ef-1f04c1c225d1" } ]
```

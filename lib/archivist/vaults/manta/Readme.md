## Manta vault

The node-manta module is supported through the built-in "manta" vault type.

### About Joyent Manta

From [Joyent Manta documentation](http://apidocs.joyent.com/manta/index.html#sign-up):

To use Joyent Manta Storage Service, you need a Joyent Cloud account. If you don't already have an
account, you can create one at https://my.joyentcloud.com/signup. You will not be charged for Joyent
Manta Storage Service until you use it.

Once you have signed up, you will need to add an SSH public key to your account. Joyent recommends
using RSA keys, as the `node-manta` CLI programs will work with RSA keys both locally, and with the
`ssh agent`. DSA keys will only work if the private key is on the same system as the CLI, and not
password-protected.

### Configuration

Assuming you have set up a public key with Joyent, you can configure the Manta Vault as follows:

```yaml
type: manta
config:
    # url is optional
    url: "https://us-east.manta.joyent.com"
    user: bob
    sign:
        keyId: "a3:81:a2:2c:8f:c0:18:43:8a:1e:cd:12:40:fa:65:2a"

        # key may be replaced with "keyPath" (path to a private key file), or omitted to fallback to
        # "~/.ssh/id_rsa"
        key: |
          -----BEGIN RSA PRIVATE KEY-----
          ..etc..
          -----END RSA PRIVATE KEY-----
```

Where `keyId` is the fingerprint of your public key, which can be retrieved by running:

```shell
ssh-keygen -l -f $HOME/.ssh/id_rsa.pub | awk '{print $2}'
```

And where `key` is your private key. As an alternative to the `key` field, you may provide a
`keyPath` field which points to the file containing your private key.

### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `manta.ls()`
get       | ✔         | `manta.get()`
add       |           |
set       | ✔         | `manta.put()`
touch     |           |
del       | ✔         | `manta.unlink()`

### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createFolder(topic)`      |          | urlencode(topic)
`createFileName(index)`    |          | URL encoded query string or "void", followed by .bin file extension
`parseFileName(fileName)`  |          | Parses query string back into index
`serialize(value)`         |          | `{ data: Buffer, mediaType: value.mediaType }`
`deserialize(data, value)` |          | From serialized to VaultValue with mediaType

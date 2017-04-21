## File vault

For static content, it often makes a lot of sense to store your files on disk, in your repository.
The "file" vault makes this possible.


### Configuration

```yaml
type: file
config:
    path: ./filevault
    disableExpiration: true  # optional (default: false)
```

If your application does not need the file vault to support expirationTime and the `touch` command,
you may turn it off by adding `disableExpiration: true` to your configuration. This can be useful,
because when your filevault holds many files, file expiration tests can take multiple seconds during
the booting of your app. Use with caution.


### Bootstrapping a file vault

This is supported through the `./game archivist-create` CLI command. This will create your empty
folder. Running `./game archivist-drop` will destroy it.


### Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | ✔         | `fs.readdir(config.path);`
get       | ✔         | `fs.readFile('myfile.filevault' and 'myfile.json');`
add       | ✔         | `fs.writeFile('myfile.filevault' and 'myfile.json');`
set       | ✔         | `fs.writeFile('myfile.filevault' and 'myfile.json');`
touch     | ✔         | `fs.readFile('myfile.filevault'); fs.writeFile('myfile.filevault');`
del       | ✔         | `fs.readFile('myfile.filevault'); fs.unlink('myfile.filevault' and 'myfile.json');`


### Required Topic API

signature                  | required | default implementation
---------------------------|----------|-----------------------
`createKey(topic, index)`  |          | `topic#prop=value&prop=value&...` (url encoded)
`parseKey(path)`           |          | from key to `{ topic: '', index: { prop: value } }`
`serialize(value)`         |          | { meta: { mediaType: '', expirationTime: 0, ext: '.json' }, content: Buffer }
`deserialize(data, value)` |          | from serialized to VaultValue with mediaType and expirationTime

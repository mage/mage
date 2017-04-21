# Process Messenger

This module helps you to manage communication between your master process and your workers.

## API

### Messenger(string namespace)

Instantiate a new messenger.
It will use the given `namespace` to prefix all the messages internally.

### messenger.broadcast(string messageName, object data)

This method allows you to send a message to all the workers and the master of your cluster.
When the master send a broadcast message, all the workers will receive an event,
but not the master.
When a worker send a broadcast message, the master and all the workers,
except the sender, will receive an event.

### messenger.send([string|number] destination, string messageName, object data)

This method allows you to send a message between master and workers.

`destination` must be the string `master` to send a message to the master,
or the worker id to send a message to a worker.

## Events

You will receive events with the name of the messages sent,
and the id of the worker or the string `master` which indicates the sender.

```javascript
// On the master
var Messenger = require('processMessenger');
var messenger = new Messenger('namespace');

messenger.on('messageName', function (data, from) {
    // broadcast
    messenger.broadcast('messageName', data);
    // reply
    messenger.send(from, 'messageName', data);
});
```

```javascript
// On the workers
var Messenger = require('processMessenger');
var messenger = new Messenger('namespace');

messenger.on('messageName', function (data, from) {
    console.log('Message received. Name:', messageName, ' - data:', data);
});
messenger.send('master', 'messageName', {});
```

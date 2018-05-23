# Events

We have seen in the [States](#states) section of this user guide that states can be used to emit events between players.
Before explaining how to send events, we will first see how MAGE send events to the clients, and how to configure the server to do so.

## How does it work ?

Events sending and receipt is done via **Message Stream**.

Message Stream is a protocol used by MAGE servers and its clients in order to communicate. This protocol is implemented through different transports, which are the following:

- **short-polling**: The client send a request to the server and get an **instant response** with the events. The client repeats this every X seconds to receive new events.
- **long-polling**: The client send a request to the server and keep the connection open. The server will send a response with the events once one or multiple events destinated to the client are received. Then, the client open a new connection and repeat the process.
- **websocket**: Real time events sending and receipt.

If you need more information about Message Stream protocol, you can read this [documentation](https://github.com/mage/mage/tree/master/lib/msgServer/msgStream).

In your MAGE config file, you can specify the priority of the transports which will be used by the client SDK to receive the events.

> config/default.yaml

```yaml
server:
    msgStream:
        detect:
            - websocket
            - longpolling
            - shortpolling

```

You can also configure longpolling transport:

> config/default.yaml

```yaml
server:
    msgStream:
        transports:
            longpolling:
                heartbeat: 60

```

For the `longpolling` transport, you can specify a `heartbeat` config, which correspond to the number of seconds until a request expire and automatically close.


Now we have seen how to configure your server to send and receive events, we will now see how to send events with the [State](#states) object.

## Sending events

> lib/modules/players/usercommands/annoy.js

```javascript
exports.acl = ['*'];
exports.execute = function (state, actorId, payload, callback) {
  state.emit(actorId, 'annoy', payload);
  callback();
};
```

When a user command is executed, you can stack many events to be emitted
once the user command succeeds. Those events will then be
sent synchronously to the destination.

## Sending asynchronous events

> lib/modules/players/usercommands/bombard.js

```javascript
var State = require('mage').core.State;
exports.acl = ['*'];
exports.execute = function (state, actorId, payload, callback) {
  var asynchronousState = new State();
  var count = 0

  function schedule() {
	setTimeout(function () {
		asynchronousState.emit(actorId, 'annoy', payload);
		count += 1;

		if (count === 100) {
			return asynchronousState.close()
		}

		schedule();
	}, 1000);
  }

  schedule();
  callback();
};
```

In some cases, you might want to emit events not attached to a user command. For instance,
you may want to send an event after a certain amount of time, or once something has changed
in the database. To do so, you will need to create your own State of that. You will also need
to make sure to manually close that state.

For more information, please read the [State API documentation](./api/interfaces/mage.core.istate.html).

## Broadcasting events

> lib/modules/players/usercommands/annoyEveryone.js

```javascript
exports.acl = ['*'];
exports.execute = function (state, payload, callback) {
	state.broadcast('annoy', payload);
	callback();
};
```

<aside class="notice">
`state.emit()` can also take an array of actorIds. You should use this
instead of broadcast if you need to send an event to a filtered
group of actors.
</aside>

In some rare case, you might want to emit events to all users. For instance,
you might want to warn connected users of an upcoming maintenance, or
of other events which might affect them.

In such cases, you will want to use `state.broadcast` to send the event to
everyone. Keep in mind that broadcasting to all may affect your overall load
if you have many players connected simultaneously.

# Events

We have seen in the [States](#states) section of this user guide that
states can be used to emit events between players. Let's dig a bit deeper
into how this can be used.

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

For more information, please read the [State API documentation](./api.html#states).

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

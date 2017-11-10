# State

The state library exposes a constructor that constructs objects which form an interface between an
actor, a session and the archivist. Virtually any command that involves reading and modification of
data should be managed by a state object.

The state constructor is exposed on `mage.core.State`. When you're done using the state class,
always make sure to clean it up by calling `close()` on it. MAGE's module and command center systems
that bridge the communication between client and server use the State object for API responses and
server-sent events. We explain more about that and the concepts behind the State class in the
[walkthrough](../../docs/walkthrough/Readme.md).


## Methods

### State(string actorId, string session)

The constructor. Pass an `actorId` to bind the state to the actor. That way events that are emitted
to this actor will batch up inside this state object, waiting to pulled out for delivery. This is
what MAGE's command center does when returning a response following a user command execution.

**Please note: you probably do not want to bind the state object to an actorId.**

When you do not pass an actorId, emitting events to it will asynchronously be delivered via MAGE's
message stream system. If you pass a `session` object, it can be used for access level and user
language settings.

### state.registerSession(Object session)

Will register the actorId and session. This is called from the constructor if a session was passed.

**Please note: you probably do not want to bind the state object to a session.**

### boolean state.canAccess(string accessLevel)

Returns `true` if the registered session is authorised at the given access level. Returns `false` otherwise.

### state.setDescription(string desc)

Tags the state with a description that is used whenever an error is logged from the state object.

### string state.getDescription()

Returns the registered description.

### string state.language()

Returns the language of the registered session. Returns `en` if none is known.

### state.emit(string actorId|string actorIds[], string path, data, string language, boolean isJson)

Emits an event to the given actorId's client.

* actorId: The actorId or actorIds (array) to emit to.
* path: The event name (or dot separated path).
* data: Any data you want to send with this event.
* language: A language code that may be given if the data is bound to a single language only.
* isJson: If the data is a pre-serialized JSON string, pass `true`.

### state.broadcast(string path, data, boolean isJson)

Broadcast an event to all the actors.

* path: The event name (or dot separated path).
* data: Any data you want to send with this event.
* isJson: If the data is a pre-serialized JSON string, pass `true`.

### state.findActors(string actorIds[], Function callback)

This looks up all actors' sessions, to see which actors are online and which are not. This can be useful when managing
a pool of users in a room for example. The callback function receives an error argument (in case of database failure),
and a `found` argument which is the following object:

```js
var found = {
	online: ['someActorId', 'someActorId3'],
	offline: ['someActorId2']
};
```

These lists will contain all actorIds you have passed into the function, but divided into an `online` and an `offline`
group.

### state.error(string code, string logDetails, Function callback)

Marks the state as in-error. No archivist mutations will be distributed, and the registered actor
will receive the error `code` as the first argument in the client-side callback. Pass `null` as a
code for the default "server" error code. Pass `logDetails` to write it to the logger's
error-channel. If you want to call a callback function immediately after, pass it as the third
argument.

### state.respond(data)

This is the response that will be sent to the actor's client-side callback as the second argument.
This only has meaning if the state originated in the command center.

### state.close(Function callback)

Call this when you're done with the state object. All archivist mutations will now be distributed to
their data stores and events will be sent to the client. If an error has been registered, all
archivist changes, all events, and the response will be discarded. Error or no error, *always* make
sure to close the state object when you're done with it.


## Usage example

```javascript
var State = mage.core.State;

var state = new State('abc');

state.archivist.get('player', { id: state.actorId }, function (error, player) {
	if (!error) {
		state.emit(state.actorId, 'myevent', { hello: 'world', youAre: player });

		console.log('Player:', player);
	}

	state.close();
});
```

## Read more

* [Events](../../docs/walkthrough/Events.md)

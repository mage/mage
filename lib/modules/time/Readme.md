# Time module

The time module controls client and server time, and the synchronisation between the two. It allows
one to bend time by changing the speed at which it flows (eg: 1 virtual minute passes in 1 real
second) and by allowing it to shift (eg: pretend that "now" is yesterday).

The purpose of this time bending ability is to aid in testing and QA, by allowing math that is based
on time to flow at a different pace than the game normally would.


## API

Whenever an API expects a `timestamp (int)` as an argument, either milliseconds or seconds are
accepted. A range test is automatically done to detect which of the two is being used.

When an API has an `msecOut (bool)` argument, given the value `true` there will return a timestamp
in milliseconds, seconds otherwise.


### Timer API

The Timer class does all the timing work, and is exposed on the server side as `mage.time.server`.
The client exposes two timers:

* `mage.time.server` to keep track of the virtual time on the server. The clock on the client is
  not taken into account.
* `mage.time.client` to keep track of the virtual time on the client. Time bending rules apply,
  but any disagreement between client and server about what time it really is, is ignored in favor
  of the client.

It exposes a few functions, and both the server and client module wrap some convenience functions
around these timers.

**timer.now(bool msecOut)**

Returns the unix timestamp of the current time, allowing for time bending rules to affect the
output. To create a `Date` object from it, you can run:

```javascript
var date = new Date(mage.time.now(true));
```

**timer.translate(int timestamp, bool msecOut)**

Translate a timestamp other than "now" to the time bending rules that have been set up.

**timer.interval(int msecOrSec)**

Accelerates the given interval by the configured accelerationFactor. Given an acceleration factor of
`2x`, for example `timer.interval(500)` would return `250`. This function is often useful when
setting up a callback with `setTimeout` or `setInterval`.


### Server API

In addition to the exposed timer, the following functions are available for your convenience:

**time.now(bool msecOut)**

Identical to calling `mage.time.server.now()`.

**time.translate(int timestamp, bool msecOut)**

Identical to calling `mage.time.server.translate()`.


### Client API

In addition to the exposed timers, the following functions are available for your convenience:

**time.now(bool msecOut)**
**time.getServerTime(bool msecOut)** (deprecated)

Identical to calling `mage.time.server.now()`.

**time.translate(int timestamp, bool msecOut)**
**time.clientTimeToServerTime(int timestamp, bool msecOut)** (deprecated)

Identical to calling `mage.time.server.translate()`.

**time.getClientTime(bool msecOut)**

Identical to calling `mage.time.client.now()`.

**time.serverTimeToClientTime(int timestamp, bool msecOut)**

Identical to calling `mage.time.client.translate()`.

**time.getOffset()**

Returns the number of milliseconds that the client time is ahead the server time.


### Time bending

*The server module exposes the following functions:*

**time.bend(int offset, float accelerationFactor[, int startAt])**

* `offset` is the number of milliseconds by which the time should be advanced from "now".
* `accelerationFactor` is the number by which every passing second will be multiplied.
* `startAt` is the timestamp at which the acceleration starts. Defaults to time `bend()` is called.

**time.unbend()**

Reverts all time bending settings.


*As administrator, you can bend time using the following user command:*

**time.bend(int offset, float accelerationFactor, int startAt, callback)**

See above.

To apply the new rules to your game session, please run:

**time.synchronize(callback)**

The callback will receive at most 1 argument: `error`.

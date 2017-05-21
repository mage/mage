Time manipulation
=================

<aside class="warning">
When running MAGE in a cluster, make sure all the server's clocks
are synchronised! MAGE is not responsible for maintaining clock
synchronicity between servers
</aside>

> lib/modules/myModule/index.js

```javascript
const {
  time,
  logger
} = require('mage')

// Accelerate time by a factor of 5
time.bend(0, 5)

exports.method = function (state) {
  const now = time.sec();

  if (now > lastLogin + (60 * 60 * 24)) {
    // do daily login bonus
  }

  state.archivist.set('someTopic', { userId: state.actorId }, {
    time: now
  });
}
```

Some types of games are meant to be played over fixed period of time;
some game features may also be time-sensitive. For instance, you might want
to give daily bonuses on player log in.

However, during testing, you probably do not want to wait for a whole day to
see if your player will be awarded a bonus. To deal with this issue, you can
use the MAGE built-in `mage.time` module. This module allows developer
to slow down or accelerate time from the MAGE process' perspective.

This feature is often refered to as *time bending*

Note that this does not affect existing APIs (such as `setTimeout`,
`setInterval`, or the `Date` class); instead, you will need to use the
the time module to compute a time value from the server's perspective,
then use that value as a setTimeout/setInterval/new Date call argument.

For more information on how to use the time library, see the
[time module API documentation](./api/classes/mage.html#time). You may also
want to have a look at the following libraries whenever dealing with time
and time bending:

  - [Moment.js](https://momentjs.com/)
  - [safe-timers](https://www.npmjs.com/package/safe-timers)

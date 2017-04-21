# Logging

Logging is an important part of running production-ready game servers. MAGE
ships with its own logging API, which developers can use and configure
in different ways depending on the environment they are running the server
on.

## Log levels (channels)

```javascript
var mage = require('mage');
var logger = mage.core.logger;
logger.debug('hello world');
logger.info.data({
  debug: 'data'
}).log('trying to do something');

logger.error('It broke', new Error('this error stack will be parsed and formatted'));
```

Log channels define the level of priority and importance of
a log entry. Just like in most systems, the level of verbosity
of a MAGE server can be configured; during development, you
will probably want to show debug logs, while in production
seeing warnings and errors will be sufficient.

The following channels are provided in MAGE

| Channel   | Description                                                                                   |
|-----------|-----------------------------------------------------------------------------------------------|
| verbose   | Low-level debug information (I/O details, etc). Reserved to MAGE internals.                   |
| debug     | Game server debugging information.                                                            |
| info      | User command request information                                                              |
| notice    | Services state change notification (example: third-party services and databases)              |
| warning   | An unusual situation occurred, which should required analysis.                                |
| error     | A user request caused an error. The user should still be able to continue using the services. |
| critical  | A user is now stuck in a broken state which the system cannot naturally repair.               |
| alert     | Internal services (data store API calls failed, etc) or external services are failing.        |
| emergency | The app cannot boot or stopped unexpectedly.                                                  |

## Log contexts

> lib/modules/players/index.js

```javascript
var mage = require('mage');
exports.logger = mage.logger.context('players');
```

> lib/modules/players/usercommands/log.js

```javascript
var mage = require('mage');
var logger = mage.players.logger.context('log');

exports.acl = ['*']

exports.execute = function (state, callback) {
	logger.debug('This log is very contextualized');
	callback();
};
```

> Log output

```plaintext
w-12345 - 23:59:59.999    <debug> [gameName players log] This log is very contextualized
```

In addition to the channel, you may want to set a logger context to help you
sort out log output. Developers are free to use contexts as they see fit.

In this example, we first attach the `players` context to the logger that will
be used at the module level, and then expose it; then, in a user command,
we add an additional context specific to the user command, and use the resulting
logger to simply log a message.

In the terminal, you would then see the following log output. Notice that the
context is now appended to the terminal output.

## Log backends

The following logging backends are provided:

| type       | Description               |
| ---------- | ------------------------- |
| terminal   | Log to the console        |
| file       | Log to local files        |
| syslog     | Log to syslog through UDP |
| graylog    | Log to GELF               |

Please see the [Logging configuration](./api.html#configuration67)
section of the API documentation for more details.

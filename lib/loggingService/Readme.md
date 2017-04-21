# Logging

## Terminology

### Channel

Loggers have multiple channels (described at the bottom of this file) that define the verbosity or
severity of a log entry.

### Message

The message is the primary line of information you are logging. In every case, whenever you pass a
message into a logger, you are encouraged to send multiple arguments and not do any serialization
(JSON or other) yourself. The reason for this is that some messages may be surpressed by the
configuration, based on verbosity, and needless serialization would needlessly hurt performance.

Loggers can serialize any data type, including Error instances (which will yield a stack trace).

### Contexts

A logger can be given one or more contexts in order to make the source of a log-call a bit clearer.

### Details

Additional details can be passed into a logger to clarify a situation with more human readable
output where needed. This is especially helpful when observing log output in a terminal.

### Data

Loggers may be passed additional key/value data. This helps certain logging services (like Graylog2)
which allow users to query for data.


## API

The `logger` module is a logger instance that exposes multiple methods. Loggers expose several
methods.

### logger.context(context1, .., contextN)

Returns a new logger object that has the given contexts on top of the ones that logger had. The
typical use case for this is that your module (eg: 'shop') has the following code at the top:

```javascript
var logger = mage.logger.context('shop');
// all logging should now be done on logger
```

### logger.&lt;channel&gt;(arg1, .., argN)

Each channel name is a method on a logger. This allows you to write:

```javascript
mage.logger.emergency('Crucial file missing');
mage.logger.warning('Stamina too low to quest:', stamina, 'quest:', questId);
mage.logger.verbose('Reading from file:', filePath);
```

At the same time, the channel is not just a function, but an object that exposes a few more
methods. All those methods can be chained. Because you are no longer using the channel name as a
function, you have to call the `log` method at the end of the chain to provide the log message (see
examples below).

### logger.&lt;channel&gt;.details(arg1, .., argN)

To provide additional human readable details. This function can be called multiple times to provide
multiple lines of information.

### logger.&lt;channel&gt;.context(context1, .., contextN)

This adds the contexts to this one log entry, on top of the ones that were already set before.

### logger.&lt;channel&gt;.data(key, value)

Add a queryable key/value pair to the log entry.

### logger.&lt;channel&gt;.data(valueMap)

Add many key/value pairs to the queryable data of this log entry.

### logger.simulator(name)

This will return a shim for any of the supported 3rd party logger libraries. This can be useful when
interfacing with 3rd party modules that have a strong dependency on these loggers.


## Examples

### try-catch block

```javascript
try {
	throw new Error('You are too grey for me');
} catch (error) {
	mage.logger.error(error);
}
```

### Passing rich data that certain logging services may be able to query

```javascript
mage.logger.debug
	.data({
		playerId: 'abc',
		questId: questId,
		conditions: {
			stamina: player.stamina,
			xp: player.xp
		}
	})
	.log('Trying to run quest', questId);
```

### Passing details

```javascript
mage.logger.debug
  .details('Used Facebook mobile login')
  .details('URL', facebookServiceUrl)
  .log('User logged in', actorId);
```

## HTML5 Client API

If configured, the client module will also expose all the channels, so you can log just like you do
on the server. The API is however limited to logging a `message`. At this time, contexts, details
and key/value data are not supported. Stack traces of Error objects are automatically logged in the
data part however. The client can log to console, but also to the server.

## Built-in Logging Channels

The built-in channels are designed to be granular and meaningful; this should help production
operation by allowing you to throw alerts properly (only 3-4 emergencies or alerts a minute should
alert operation, but it might take 100's of user errors a minute to trigger the same alerting).

| Channel   | Description                                                                                   |
|-----------|-----------------------------------------------------------------------------------------------|
| verbose   | Low-level debug information (I/O details, etc). Reserved to MAGE internals.                   |
| debug     | Game server debugging information.                                                            |
| info      | User command request information                                                              |
| notice    | Services state change notification (example: third-party services and databases)              |
| warning   | An unusual situation occured, which should required analysis.                                 |
| error     | A user request caused an error. The user should still be able to continue using the services. |
| critical  | A user is now stuck in a broken state which the system cannot naturally repair.               |
| alert     | Internal service (datastore API calls failed, etc) or external service are failing.           |
| emergency | The app cannot boot or stopped unexpectedly.                                                  |

## Configuration

The logger allows for logging in different "writers". At this time, the following are available on
the server:

* terminal: log to the console
* file: write to log files on disk
* syslog: write to syslog through UDP
* graylog: www.graylog2.com
* websocket: streams the log on a [Savvy](../savvy/Readme.md) websocket

And the following are available on the client:

* console: outputs to console.log/warn/error
* server: send log entries to the server to be reported in server-side writers

Configuration happens in your config file in:

```yaml
logging:
    server: {}
    html5: {}
```

Any time you see a channel range configuration, it may be a string describing a range of channels,
or an array of multiple of these strings. A range may contain `>`, `>=`, `<` and `<=` comparison
operators. The special string `all` represents all channels.

### Server: Terminal

```yaml
logging:
    server:
        terminal:
            channels: [">=info"]
            config:
                jsonIndent: 2
                jsonOutput: false # defaults to false, useful when piping output to another app
                theme: default
```

Available themes: `default`, `dark`, `light`.

### Server: File

```yaml
logging:
    server:
        file:
            channels: [">=debug"]
            config:
                path: "./logs"

                # optional:
                jsonIndent: 2
                mode: "0600"    # make sure this is a string!

                fileNames:
                    "app.log": "all"    # this is configured by default and you may override it
                    "access.log": "info"
                    "error.log": ">=warning"
```

### Server: Syslog

```yaml
logging:
    server:
        syslog:
            channels: [">=debug"]
            config:
                host: localhost          # host to connect to (IP or hostname)
                port: 514                # UDP port to connect to
                appName: myGame
                facility: 1              # see syslog documentation
                format:
                    multiLine: true      # allow newline characters
                    indent: 2            # indentation when serializing data in multiLine mode
```

### Server: Graylog

```yaml
logging:
    server:
        graylog:
            channels: [">=info"]
            config:
                servers:
                    - { host: "192.168.100.85", port: 12201 }
                    - { host: "192.168.100.86", port: 12201 }
                facility: Application identifier
                format:
                    multiLine: true      # allow newline characters
                    embedDetails: false  # embed log details into the message
                    embedData: false     # embed data into the message
```

### Server: WebSocket

```yaml
logging:
    server:
        websocket: {}
```

Please note that channels are not supported in the websocket configuration. The channel description
array is to be passed as JSON into the connection once it has been established.

### HTML5: All writers

MAGE will override the client's console object with it's own version that supports logging to the
server and hiding output on the client. If you do not want this behavior you can set disableOverride
to true, but MAGE will no longer be able to collect logs from the client.

### HTML5: Console

Logs to the browser's console.

```yaml
logging:
    html5:
        disableOverride: false
        console:
            channels: [">=verbose"]
        server:
            channels: [">=error"]
```

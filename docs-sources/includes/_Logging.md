# Logging

Logging is an important part of running production-ready game servers. MAGE
ships with its own logging API, which developers can use and configure
in different ways depending on the environment they are running the server
on.

## Log levels (channels)

```javascript
var mage = require('mage');
var logger = mage.logger;
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
| verbose   | Low-level debug information (I/O details, etc); reserved to MAGE internals                    |
| debug     | Game server debugging information                                                             |
| info      | User command request information                                                              |
| notice    | Services state change notification (example: third-party services and databases)              |
| warning   | An unusual situation occurred, which requires analysis                                        |
| error     | A user request caused an error. The user should still be able to continue using the services  |
| critical  | A user is now stuck in a broken state which the system cannot naturally repair                |
| alert     | Internal services (data store API calls failed, etc) or external services are failing         |
| emergency | The app cannot boot or stopped unexpectedly                                                   |

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

### Terminal

<aside class="warning">
By default, the logger will log to the terminal. To disable this behaviour, set terminal to false in your config.
</aside>

> Disable terminal logging

```yaml
logging:
    server:
        terminal: false
```


> Terminal config example

```yaml
logging:
    server:
        terminal:
            channels: [">=info"]
            config:
                jsonIndent: 2
                jsonOutput: false
                theme: default
```

The terminal log backend can be configured for pretty-logging, which makes reading
log entries in your console more visually comfortable.

The following themes are available:

   - default
   - dark
   - light

The terminal log backend may also be configured for piping logs to an external
process. For instance, you may be deploying your MAGE in PaaS or IaaS which
simply forwards and parses stdout/stderr output.

In such case, you can turn the `jsonOutput` configuration entry to `true`;
each log line outputed will then be outputed as a JSON object.


### File

> File config example

```yaml
logging:
    server:
        file:
            channels: [">=debug"]
            config:
                path: "./logs"
                jsonIndent: 2
                mode: "0600"    # make sure this is a string!
                fileNames:
                    "app.log": "all"    # this is configured by default and you may override it
                    "error.log": ">=warning"
```

The file log backend allows you to output logs to a set of file of your choice. Simply
specify a log directory where you want your log files to go, and a set of filenames to log to.
You can control which log level will go in which file by setting the log level range
as a value, or specify `all` if you wish to write all logs to a single file.

<br><br><br><br><br><br><br><br>

### Syslog

> Syslog config example

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

The syslog log backend allows you to forward your logs to a remote
syslog server using the UDP protocol.

MAGE does not currently support forwarding to syslog TCP servers; because
of this, it also does not support using TLS.

Since only UDP is supported, it also means that some logs may not arrive to
destination.

<br><br><br><br><br><br><br><br>

### Graylog

> Graylog config example

```yaml
logging:
    server:
        graylog:
            channels: [">=info"]
            config:
                servers:
                    - { host: "192.168.100.85", port: 12201 }
                facility: Application identifier
                format:
                    multiLine: true      # allow newline characters
                    embedDetails: false  # embed log details into the message
                    embedData: false     # embed data into the message
```

The syslog log backend allows you to forward your logs to a remote
graylog2 server, or to any other services capable to consuming
the [GELF protocol](http://docs.graylog.org/en/2.2/pages/gelf.html).

Such services include:

  - [Logstash](https://www.elastic.co/guide/en/logstash/5.4/plugins-inputs-gelf.html)
  - [Fluentd](https://github.com/MerlinDMC/fluent-plugin-input-gelf)

You may choose to embed details and data into the message, instead of having them
as separate attributes. If so, respectively turn `embedDetails` and `embedData` to `true`.

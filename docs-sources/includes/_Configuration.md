# Configuration

## Format

The configuration for your game is allowed to exist in the
[YAML format](http://en.wikipedia.org/wiki/YAML) with the `.yaml` file extension, the
[JSON format](http://en.wikipedia.org/wiki/JSON) with the `.json` file extension, or the
[JSON5 format](http://json5.org/) with the `.json5` file extension.

In a nutshell, YAML is the more human readable format, while JSON is more JavaScript-like in how it
represents its variable types. JSON5 represents a good middle-ground between both previous formats.

## Location

> config/

```plaintext
config
├── custom.yaml
├── default.yaml
├── development.yaml
└── production.yaml
```

The files are located in your game's `config` folder.

Configuration files will be loaded in the following order:

  1. `config/default.yaml`: The base configuration file for your project
  2. `config/[NODE_ENV].yaml`: Configuration for a specific environment
  3. `config/custom.yaml`: Configuration for your local setup

If you want to load multiple configuration files, you may comma-separate them in your `NODE_ENV`
like this: `NODE_ENV=bob,test`. They will be loaded in order, the latter overriding the former.

Custom configuration is generally used during development; in some cases, developers will need
to specify their own credentials or personalized configuration. Newly created projects will
include a custom file; however, this file will also be added to your `.gitignore` file to
avoid any conflicts between each developer's configuration.

## Development

<aside class="warning">
Make sure these are turned off on your production environments!
</aside>

> This turns on all options

```yaml
developmentMode: true
```

> Alternatively, take control by toggling the individual options. The ones you leave out are
> considered to be set to true. Set any of the following to false to change the default
> development mode behavior.

```yaml
developmentMode:
    archivistInspection: true  # Archivist will do heavy sanity checks on queries and mutations.
```

To run your game in development, MAGE has a `developmentMode` configuration flag. This enables or
disables certain behaviors which make development a bit more convenient. If you want more granular
control over which of these behaviors are turned on or off, you can specify them in an object.

## Environment-based configuration

```yaml
server:
    clientHost:
      bind: MAGE_APP_BIND:string

    mmrp: MAGE_APP_MMRP:bool
```

You may also add a `config/environment.yaml` file to your project: this file serves
as a means to connect environment variables to specific configuration entries. Environment
variables will supersede any configuration set through configuration files.

In this example, we connect `MAGE_APP_BIND` and `MAGE_APP_MMRP` to our configuration.
Note you may also optionally specify the type to cast the environment variable into.
In this case for instance, we set `MAGE_APP_MMRP` as a boolean because we might want to
disable MMRP it by running `MAGE_APP_MMRP=false npm run mage` or otherwise setting
the value into the environment.

## Dynamic configuration

> test/index.js

```javascript
const config = require('mage/lib/config');
config.set('some.path.to.config', 1)

const mage = require('mage');

// continue with your test code
```

The moment `mage` is required or imported, it will automatically set up
the configuration management API as well as read configuration files. However,
in some cases - such as unit testing - you might want to forcibly disable
certain services, or enforce fixed behaviors.

To do so, you have the option of requiring MAGE's configuration before,
fix your configuration; once you require MAGE, your dynamic configuration
will then be applied.

You may dynamically set a new configuration at any time while the MAGE server is
running; however, keep in mind that most modules only read configuration entries
at runtime, and therefore dynamically changing the configuration after MAGE has
been initialized will likely not have any effects.
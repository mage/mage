# Configuration

## Format

The configuration for your game is allowed to exist in either the
[YAML format](http://en.wikipedia.org/wiki/YAML) with the `.yaml` file extension, or the
[JSON format](http://en.wikipedia.org/wiki/JSON) with the `.json` file extension.

In a nutshell, YAML is the more human readable format, while JSON is more JavaScript-y in how it
represents its variable types.

## Location

The files are located in your game's `config` folder. Here you will find a `default.yaml`
configuration file, that you can use to collect all configuration that every single environment
should use (that is, configuration that is not unique to a single developer's environment).

MAGE will also read the `NODE_ENV` [environment variable](http://en.wikipedia.org/wiki/Environment_variables).
It will try to read a configuration file named after its value (which should probably be set to your
user name). If for example, my user name is `bob`, my `NODE_ENV` value would also be `bob`, and I
would place all configuration for my environment in `config/bob.yaml` or `config/bob.json`.

That personalized configuration file augments `default.yaml` and overwrites any values that were
already present.

If you want to load multiple configuration files, you can comma-separate them in your `NODE_ENV`
like this: `NODE_ENV=bob,test`. They will be loaded in order, the latter overriding the former.

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
    loginAs: true              # Allows unsecure login as another user.
    customAccessLevel: true    # Allows unsecure login with any access level (eg: admin).
    adminEverywhere: true      # Changes the default access level from "anonymous" to "admin".
    archivistInspection: true  # Archivist will do heavy sanity checks on queries and mutations.
    buildAppsOnDemand: true    # The web-builder will build apps on-demand for each HTTP request.
```

To run your game in development, MAGE has a `developmentMode` configuration flag. This enables or
disables certain behaviors which make development a bit more convenient. If you want more granular
control over which of these behaviors are turned on or off, you can specify them in an object.

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
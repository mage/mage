# MAGE

The first line of code in your project is probably the following.

```javascript
var mage = require('mage');
```

You're going to write that a lot, as its the entry point into everything in the framework, including
the modules you write and register. You can require "mage" from anywhere in your project.

## Properties

### Object mage.task

The name and options for the task that the command line interface has decided MAGE should execute.
This defaults to the "serve" task, which means to serve applications to clients. All
[tasks](../tasks) available to MAGE are implemented through the CLI. You can run your application
with `--help` to get an idea of which tasks you can activate. You can manually change the task
through the `setTask` API documented under "Methods".

### Object mage.core

Contains all the subsystems that MAGE has access to. These are integrated into the system mode
deeply than [modules](../../docs/walkthrough/Modules.md) are, which you use to add application logic
to the MAGE app.

The subsystems in "core" are documented in the [API documentation](../../docs/api/Readme.md).

### string mage.version

The version of MAGE.

### Object mage.magePackage

Contains information from MAGE's `package.json` file:

- name: "mage"
- version: The version of MAGE.
- path: The path to MAGE on disk.
- package: The parsed contents of MAGE's `package.json` file.

### Object mage.rootPackage

Contains information from your project's `package.json` file:

- name: The "name" field of package.json, or the folder name of your project.
- version: The version of your project (or "no-version").
- path: The path to your project on disk.
- package: The parsed contents of your project's `package.json` file.

### Module mage.cli

The `cli` property is a library that lets you extend and boot up the command-line argument parser.
For more information, please read the [CLI documentation](../cli/Readme.md).


## Methods

### Module mage.require(moduleName)

Calls Node.js' `require` function from the MAGE context. This can be useful when you want to
directly require one of MAGE's own dependencies.

### string mage.getRunState()

Returns the lifecycle phase that MAGE is currently in. This can be any of the following.

- init: before starting up
- setup: while starting up
- running: while the project is running and is ready to serve requests
- quitting: while shutting down

Every time the run-state changes, the "runState" event is emitted, with the current run-state as the
only argument.

### mage.quit(number exitCode)

Shuts down MAGE and all its processes.

### mage.exit(number exitCode)

Shuts down MAGE and exits the current process with the given exit code, or 0 if none has been passed.

> Please note that if you run this in a worker process, it only shuts down the worker, not the
> entire project.

### Mage mage.addModulesPath(string path)

Adds this path on the disk as a lookup path for modules when using `useModules()`.
Returns the mage object to allow API chaining.

### Mage mage.useModules(string moduleName, ...)

Takes any number of arguments that each represent a module's name. Arguments may also be an array
with module names. The modules you refer to are instantly imported from the known module paths (see:
`addModulesPath`, or from the MAGE built-in modules, and exposed as `mage.ModuleName` as well as
`mage.core.modules.ModuleName`.　Returns the mage object to allow API chaining.

### string mage.getModulePath(string moduleName)

If a name by this name has been registered through `useModules()`, this method will return the path
on disk where that module was loaded from.

### string[] mage.listModules()

Returns all registered module names, in order of registration.

### Mage mage.setup(Function callback)

Sets up the task that MAGE has been assigned. By default this is to serve the application to
clients. This function considers all errors fatal and will shut down the process if that happens.
Once setup has completed, this functions calls back to `callback(error, appMap)`

> Please note: while there are no errors returned, the Node.js convention of "errors first" is still
> applied. You may safely ignore this argument.

The second argument returned in the callback is a map, by name, of application objects that
are now available to you. For example:

```javascript
appMap = {
  game: { ... },
  dev: { ... },
  cms: { ... },
  support: { ... }
};
```

The `setup` function returns the mage object to allow API chaining.

### Mage mage.start(Function callback)

This will start the application and expose it to the world. That means that from this moment on,
the HTTP server will be accepting connections and serve your applications. When these final
operations have completed, the callback will be called. In the case of error, MAGE will not return
the error to your callback. It will shut down instead. The `start` function returns the mage object
to allow API chaining.

### boolean mage.isDevelopmentMode([string feature])

Returns `true` if MAGE is running in development mode, `false` otherwise. If you pass a particular
feature by name, the boolean will reflect on that feature being in development mode or not. For more
information on these features, please read the documentation on
[Configuration](../../docs/walkthrough/Configuration.md).

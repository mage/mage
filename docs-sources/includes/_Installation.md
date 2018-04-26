# Installation

## Naming your environment

>  You can replace "development" with something else if you want

```shell
export NODE_ENV=development
```

```powershell
set-item env:NODE_ENV=development
```

When MAGE creates a new project, it will set up a configuration file for your environment. The name
of your environment is decided by the `NODE_ENV` environment variable. If your system administrator
has not already prepared it for you on the system you are developing on, you can do it yourself by
adding the above line your shell's profile file (`.bashrc`, `.zshrc`, `profile.ps1`, and so on).

The MAGE installer will create a `development.yaml` configuration file, and will use that from there on,
whenever you start up the game.

## Setting up a new MAGE project

### As a JavaScript project

> Replace my-gameserver with how you wish to name your game

```shell
# Note: use npx, not npm!
npx mage create my-gameserver
cd my-gameserver
```

```powershell
# Note: use npx, not npm!
npx mage create my-gameserver
cd my-gameserver
```

> Then use the following command to start your game server (ctrl+c to exit)

```shell
npm run develop
```

```powershell
npm run develop
```

Running the following steps is the easiest way to create a new project. Do this **from inside an
empty folder** that is named after the game you are developing.

You can also specify which version you wish to install by adding `@[version number]` at
the end of the line.

### As a TypeScript project

```shell
# Note: use npx, not npm!
npx mage create my-gameserver --typescript
cd my-gameserver
```

```powershell
npx mage create my-gameserver --typescript
cd my-gameserver
```

MAGE can also create TypeScript projects; to do so, all you need to do is to
add the `typescript` or `ts` flag to the previous command.

## Upgrading MAGE in an existing project

> In some cases, you may want to `npm run clean` first.

```shell
npm install --save mage@1.2.3
```

```powershell
npm install --save mage@1.2.3
```

To upgrade to a new version of MAGE, simply re-run install with the `--save` flag,
and specify the version you wish to now use.

## Versioning of MAGE

MAGE version numbering follows [Semantic Versioning](http://semver.org/) or "semver" logic.

That means that given a version number MAJOR.MINOR.PATCH, we increment the:

  * MAJOR version when we make incompatible API changes,
  * MINOR version when we add functionality in a backwards-compatible manner, and
  * PATCH version when we make backwards-compatible bug fixes.


## Working with master (latest) and development

<aside class="warning">
The master branch will be frequently updated, which may end up breaking your application.
You should try to avoid using this pre-release version, and instead use a versioned
copy of MAGE for your project.
</aside>

```shell
npm install --save mage/mage#master
```

```powershell
npm install --save mage/mage#master
```

You may choose, for the duration of your application development, to work on a pre-release version
of MAGE. To do so, you can use the `master` branch when running `npm install`.

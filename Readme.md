<img src="https://github.com/mage/mage/raw/master/logo.png" alt="MAGE logo" width="250" height="250" />

[![GitHub tag](https://img.shields.io/github/tag/mage/mage.svg?style=flat-square)](https://github.com/mage/mage/releases/latest)
[![npm](https://img.shields.io/npm/v/mage.svg?style=flat-square)](https://www.npmjs.com/package/mage)
[![npm](https://img.shields.io/npm/dt/mage.svg?style=flat-square)](https://www.npmjs.com/package/mage)
[![Gitter](https://img.shields.io/gitter/room/mage/mage.svg?style=flat-square)](https://gitter.im/mage/mage)

[![Build Status: Linux & macOS](https://img.shields.io/travis/mage/mage.svg?style=flat-square&label=ci%20linux%2Fmacos)](https://travis-ci.org/mage/mage)
[![Build Status: Windows](https://img.shields.io/appveyor/ci/mage/mage/master.svg?style=flat-square&label=ci%20windows)](https://ci.appveyor.com/project/mage/mage/branch/master)
[![Coveralls branch](https://img.shields.io/coveralls/mage/mage/master.svg?style=flat-square)](https://coveralls.io/github/mage/mage)

MAGE is a Game Server Framework for Node.js. It allows game developers to quickly create
highly interactive games that are performant and scalable.

Features
---------

  - Supports both JavaScript and TypeScript
  - Easily create transactional API endpoints
  - Supports multiple storage backends
  - Built-in distributed mode
  - Rich ecosystem of SDKs, modules and tools

See [our user documentation](https://mage.github.io/mage/#introduction) for more details.

Client SDKs
------------

We officially support the following client-side SDKs:

| Name             | Language             | Location                                           |
| ---------------- | -------------------- | -------------------------------------------------- |
| mage-js-sdk      | JavaScript (browser) | [GitHub](https://github.com/mage/mage-sdk-js)      |
| mage-sdk-unity   | C# (For Unity)       | [GitHub](https://github.com/mage/mage-sdk-unity)   |

Install
-------

### Linux, macOS

```bash
# Replace my-gameserver with how you wish to name your game
export NODE_ENV=development
npx mage create my-gameserver
cd my-gameserver
```

Then follow the indications on screen as they appear.

### Windows

```powershell
# Replace my-gameserver with how you wish to name your game
set-item env:NODE_ENV=development
npx mage create my-gameserver
cd my-gameserver
```

Then follow the indications on screen as they appear.

### TypeScript

Optionally, you may also create a TypeScript project. Simply
add the `--typescript` flag to the previous `npm` command.

```shell
npx mage create my-gameserver --typescript
```

See Also
---------

* [About MAGE](https://wizcorp.jp/mage)
* [Documentation](https://mage.github.io/mage)

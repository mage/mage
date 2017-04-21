<img src="./logo.png" alt="MAGE logo" width="250" height="250" />

A server-side development solution for high-end,
highly scalable applications and games.

MAGE runs on [Node.js](http://nodejs.org/).
It also offers tools and libraries to deal with
message passing at scale, datastore interactions.

Install
-------

**Note**: There are more installation options currently available: here
we only list the normal bootstrap process. For more details, please refer
to the [documentation on the install process](./docs/Install.md)


### Linux, macOS

```bash
# Replace my-gameserver with how you wish to name your game
export NODE_ENV=development
npm install mage --bootstrap --prefix my-gameserver
cd my-gameserver
npm run develop
```

Then follow the indications on screen as they appear.

### Windows

```powershell
# Replace my-gameserver with how you wish to name your game
set-item env:NODE_ENV=development
npm install mage --bootstrap --prefix my-gameserver
cd my-gameserver
npm run develop
```

Then follow the indications on screen as they appear.

See Also
---------

* [About MAGE](https://wizcorp.jp/mage)
* [Documentation](./docs/Readme.md)
* [Node.js Documentation](http://nodejs.org/api/)

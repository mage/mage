# Templates

MAGE allows you to create meta-packages (or templates), which you can
publish on NPM and then apply to your newly created projects. This is
useful for setting up  things such as unit tests, linting, and so on.

In most of these cases, you will want to install the latest version of
whatever packages you need, add a few NPM scripts, drop some new files
and add rules to your `.gitignore` file.

You can apply as many meta-packages as you want to a project. While
in theory, you may apply meta-packages to newly created projects, you
may apply them at any time of your choosing.

## Creating a meta-package

### Standards and best practices

  1. Prefix your meta-package name with the `mage-tpl-prefix`
  2. Add a `Readme.md` to your meta-package to describe what the
     meta-package does and how to install it
  3. Avoid putting packages in the `package.json`; instead, install them through
     a subprocess executed by an `index.js` setup script

### package.json

The meta-package's `package.json` will be merged with your project's `package.json`.

### index.js

```javascript
var cp = require('child_process');
var readline = require('readline');

var packages = [
  'mocha',
  'istanbul',
  'nyc'
];

function log(stream, logger) {
  readline.createInterface({
    input: stream
  }).on('line', logger);
}

exports.setup = function (mage, options, callback) {
  const logger = mage.core.logger;
  const npm = cp.spawn('npm', [
    'install',
    '--save-dev'
  ].concat(packages));

  log(npm.stdout, logger.debug.bind(logger));
  log(npm.stderr, logger.warning.bind(logger));

  npm.on('exit', callback);
};
```

`index.js` is an optional component of your meta-package which can contain a setup script
to do things such as present the user with a wizard, install peer dependencies, and so on.

The setup script will be the last thing to be executed during `apply`; you can also use it
to print useful post-apply steps the user should be following.

### .gitignore and other ignore files

`.gitignore` files and other `.*ignore` files will be merged with existing ones if present.

### Other files

The following files will **always be ignored**; they will not
be applied to your project:

  * `Readme.md`

Other files will be dropped in place; if a file already exists at that location,
the user will be presented with a request to choose which file to keep.

## Applying a meta-package

```shell
npm run apply mage-tpl-mocha
npm run apply mage-tpl-eslint@0.0.1
npm run apply stelcheck/mage-tpl-retire#git/branch
```

```powershell
npm run apply mage-tpl-mocha
npm run apply mage-tpl-eslint@0.0.1
npm run apply stelcheck/mage-tpl-retire#git/branch
```

Newly created MAGE projects will include an `apply` comand, which
you can use to apply meta-packages to your project; meta-package names
are interpreted in the same way as durin an `npm install` (version, GitHub shorthand, etc)/
# Command Center

The Command Center handles the exposure and processing of MAGE module user commands (ie: RPC).

MAGE currently only supports the MAGE user command custom protocol, through [httpBatchHandler](./httpBatchHandler.js)
It uses the following endpoint: `/<appname>/`.

## Access from the client

MAGE automatically adds functions to your modules to have easy access to your user commands. If you have a `gift` user
command in a `gifting` module, you can use `mage.gifting.gift()`.

If you want to use the command directly, you have to use the `msgServer` module.

```js
var mage = require('mage');
mage.msgServer.sendCommand('gifting.gift', parameters, callback);
```

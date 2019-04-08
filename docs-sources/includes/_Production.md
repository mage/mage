# Production

In a production environment, you should set `NODE_ENV` to `production`
and provide MAGE with a configuration file called
`config/production.yaml` or `config/production.json`.

## developmentMode

The `developmentMode` entry MUST be turned off. You may also choose to run the game with an
environment variable which explicitly turns it off, just in case the configuration went wrong, by
running it like this:

```shell
DEVELOPMENT_MODE=false npm start
```

```powershell
&{ $env:DEVELOPMENT_MODE="false"; npm start }
```

## server

The "server" entry in the configuration must be set up properly. That *probably* means:

  * `workers` should be set to a number to indicate a worker count, or even better, to `true` (meaning
    that as many workers will be spawned as the CPU has cores).
  * `serviceDiscovery.engine` should be appropriately selected for this environment.
  * `mmrp` must be set up to allow all MAGE servers to communicate with each other on the network.
  * `sampler` collects performance metrics. Are you going to use them or should you turn it off?

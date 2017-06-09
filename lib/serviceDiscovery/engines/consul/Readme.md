## Consul discovery engine

Consul is a Service Discovery and distributed KV store created by HashiCorp. 

### Requirements

You need to install the consul module in your project:

```bash
npm install --save consul@'^0.29.0'
```

### Limitations

This discovery engine needs to know on which interface your service is exposed, we might support
auto-detection at a later time but for now if you cannot satisfy this need we recommend that you
use a different service.

### Configuration

In the `server.serviceDiscovery.options` object the following options exists:
 - __interface (required)__: The interface to advertise, such as `eth0` or `enp4s0`.
 - __ttl (optional)__: The interval at which we should renew our consul session in milliseconds. If the server
            crashes hard the advertisement will be removed after this TTL expires. Defaults to 30000.
 - __consul (optional)__: Options to pass to the `node-consul` module, see [the documentation](https://github.com/silas/node-consul#consuloptions).

_Sample configuration_:

```yaml
server:
    serviceDiscovery:
        engine: consul
        options:
            # Our advertised interface
            interface: enp4s0
            # Manually increase the TTL to 60s
            ttl: 60000
            # By default will connect to the local agent, override
            # this here
            consul:
                host: consul.service.dc.consul
```

### Debugging

Depending on the configuration of the consul server an UI should be available, at the top click
on the `KEY/VALUE` button and go inside the `mage/` folder to find discovery keys.

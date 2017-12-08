# Clustering

At some point during development, you will want to start looking into
deploying multiple instances of your game servers; once you do, you will need
to change your configuration to tell MAGE instances:

  1. How they can find each others (through service discovery);
  2. How they can connect to each others (through MAGE's Message Relay Protocol, or MMRP).

This section will cover how you can configure these two services for different
development and production use-cases.

## Cluster identification

```yaml
server:
    serviceName: applicationName-environmentID
```

Currently the message server system will identify itself as being a part of a cluster by using the application root package name and version. However in environment where multiple instances of the same application and version are run, there will be conflicts with the messaging system. (e.g. inside single box which houses multiple test environments).

To prevent pollution and contamination of messages, the server.serviceName configuration entry needs to be set, to give each environment a unique identifier.

## Service discovery

```yaml
server:
    serviceDiscovery: false
```

Service discovery takes care of letting each MAGE servers where they can find
the other servers.

| Engine               | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| single               | In-memory discovery service (useful during development)            |
| mdns                 | Bonjour/MDNS-based service discovery                               |
| zookeeper            | [ZooKeeper](https://zookeeper.apache.org/)-based service discovery |
| consul               | [Consul](https://www.consul.io/)-based service discovery           |


By default, service discovery is disabled. To enable it, you will need
to specify what engine you wish to use, and what configuration you wish
to use for that engine.

### Single

```yaml
server:
    serviceDiscovery:
        engine: single
```

The single engine can be used during development to locally allow the use of the service
discovery API. It will only find the local server.

<br><br>

### Bonjour/MDNS

```yaml
server:
    serviceDiscovery:
        engine: mdns
        options:
            # Provide a unique identifier. You will need to configure
            # this when you have multiple instances of your game cluster
            # running on the same network, so to avoid MAGE servers from one
            # cluster from connecting to your cluster.
            description: "UniqueIdOnTheNetwork"
```

The MDNS engine will use MDNS broadcasts to let all MAGE servers on a given network
when new servers appear or disappear.

This engine is very convenient, since it allows for service discovery without having to
configure any additonal services. However, note that certain network (such as the ones
provided by AWS) wil not allow broadcasts, and so you will not be able to use this engine
in such case.

<br><br><br><br>

### ZooKeeper

```yaml
server:
    serviceDiscovery:
        engine: zookeeper
        options:
            # The interface to announce the IP for. By default, all
            # IP are announced
            interface: eth0

            # List of available ZooKeeper nodes (comma-separated)
            hosts: "192.168.1.12:2181,192.168.3.18:2181"

            # Additional options to pass to the client library.
            # See https://github.com/alexguan/node-zookeeper-client#client-createclientconnectionstring-options
            # for more details
            options:
                sessionTimeout: 30000
```

The zookeeper engine will use ZooKeeper to announce MAGE servers.

<br><br><br><br><br><br><br><br><br><br><br><br>

### Consul

```yaml
server:
    serviceDiscovery:
        engine: consul
        options:
            # Interface to announce
            interface: enp4s0

            # optional
            consul:
                host: consul.service.dc.consul
```

The consul engine will use Consul to announce MAGE servers.

## MAGE Message Relay Protocol (MMRP)

```yaml
server:
    mmrp:
        bind:
            host: "*"  # asterisk for 0.0.0.0, or a valid IP address
            port: "*"  # asterisk for any port, or a valid integer
        network:
            - "192.168.2"  # formatted according to https://www.npmjs.com/package/netmask
```

MMRP (MAGE Message Relay Protocol) is the messaging layer between node instances. It is used to enable communication between multiple MAGE instances and between the different node processes run by MAGE. In the end, it allows messages to flow from one user to another.

MMRP depends on [service discovery](./index.html#service-discovery)
to announce relays on the network to each process. The protocol and library
used to communicate between processes is [ZeroMQ](http://zeromq.org/).

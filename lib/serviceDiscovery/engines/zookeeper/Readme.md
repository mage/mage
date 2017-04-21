## ZooKeeper discovery engine

Apache ZooKeeper is a project from the Apache Software Foundation that provides distributed
datastores for large distributed systems. It is part of the Hadoop eco-system. It uses a
hierarchical tree for storing data similar to a file-system.

### Configuration

In the `server.serviceDiscovery.options` object the following options exists:

- **hosts**: A string that contains a list of host:port separated with commas.
- **options**: The `options` object accepted by [createClient](https://github.com/alexguan/node-zookeeper-client#client-createclientconnectionstring-options).

The `node-zookeeper-client` library applies 0 retries as a default, which we override with `3`.
You can tweak these settings further by configuring the `options` above.

### Limitations

ZooKeeper is written in Java so is very heavy, moreover watchers and other niceties are far too
lightweight and causes a lot more work than should be necessary when events happen (like having to
manually build the difference when nodes change).

### Debugging

When debugging, it is possible to retrieve the zookeeper install file and connects using the
`bin/zkCli.sh` file provided in the SDK using the following command:

`bin/zkCli.sh -server <serverip>:<port>`

The CLI will then connect and display a list of commands available, the important ones are:

- `ls <path>`, show the children list for that path.
- `get <path>`, retrieve the metadata and details for a particular node.

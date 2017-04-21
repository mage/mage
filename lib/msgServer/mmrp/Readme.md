# MMRP

## General concept

MMRP (MAGE Message Relay Protocol) is the messaging layer between node instances. It is used to
enable communication between multiple MAGE instances and between the different node processes run by
MAGE. In the end, it allows messages to flow from one user to another.

Imagine a network set up like the following, where 3 servers each host a
[process-cluster](http://nodejs.org/docs/latest/api/cluster.html).

```plaintext
 Cluster 1                Cluster 2                Cluster 3
  +-----+                  +-----+                  +-----+
  |     |                  |     |                  |     |
  |  M  +------------------+  M  +------------------+ M/W |
  |     |                  |     |                  |     |
  +--+--+                  ++---++                  +-----+
     |                      |   |
     |                   +--+   +--+
     |                   |         |
  +--+--+             +--+--+   +--+--+
  |     |             |     |   |     |
  |  W  |             |  W  |   |  W  |
  |     |             |     |   |     |
  +-----+             +-----+   +-----+


M: MAGE master / MMRP relay
W: MAGE worker / MMRP client
```

Each MAGE master will instantiate an MMRP relay, and each worker an MMRP client. If MAGE is running
in single-node mode (that is, the cluster consists of only a single process), it will instantiate
MMRP as both a relay and as a client. Through this topology, messages can be sent between all
processes (or nodes) in the MAGE network.

MMRP depends on [service discovery](../../serviceDiscovery/Readme.md) to announce relays on the
network to each process. The protocol and library used to communicate between processes is
[ZeroMQ](http://zeromq.org/).


## MMRP Nodes

### Node API

#### Construction

To get started, you must have access to an MMRP node object, or create one like this:

```javascript
var MmrpNode = mage.core.msgServer.mmrp.MmrpNode;

var role = 'relay'; // or 'client', or 'both'
var cfg = { host: '*', port: '*' };
var clusterId = require('os').hostname();

var node = new MmrpNode(role, cfg, clusterId);
```

#### node.relayUp(uri, clusterId)

Notify the node that another relay has become available at a particular URI with a particular
clusterId. If the node is a relay, it should connect to it. If the node is a client, it should
connect to it only if it's the relay of the same clusterId as the client.

#### node.relayDown(uri)

Notify the node that another relay has become unavailable. If we are connected to it, we should use
this as an advice to disconnect.

#### node.send(envelope, attempts)

Sends an envelope across the network according to the route inside it. If attempts is passed, the
node will try to resend the envelope if routing failed. Retrying should normally not be needed, as
ZeroMQ manages connections and buffers for you.

#### node.broadcast(envelope)

Will broadcast the envelope to every node on the network.


### Node events

#### delivery

When an envelope is received, a delivery is always fired, *even* if the envelope is not intended for
this cluster or even this node in the cluster! It is up to the receiver to decide to act on it or
not. You can listen for the event based on the type of the envelope that is being delivered.

For example, if the type of the envelope is `"my.special.namespace"`, a total of four events will
be emitted with the envelope as the sole argument, in the following order:

- delivery.my.special.namespace
- delivery.my.special
- delivery.my
- delivery


## Envelopes

MMRP communicates by sending envelopes from node to node. An envelope is a type of object that is
instantiated by MMRP when it receives one, and you must instantiate yourself when you want to send
one. The public API for that is described below.


### Envelope API

#### Construction

You can get a hold of the Envelope class through MMRP, and instantiate it as follows.

```javascript
var Envelope = mage.core.msgServer.mmrp.Envelope;

var type = 'something.i.made.up';
var message = ['hello', 'world'];
var route = ['someClusterId', 'someAddressOnThatCluster'];
var returnRoute = [];
var flags = ['TRACK_ROUTE'];

var envelope = new Envelope(type, message, route, returnRoute, flags);
```

#### To and from ZeroMQ

To create an envelope from an array received through ZeroMQ, call:

```javascript
var envelope = Envelope.fromArgs(myArgs);
```

To turn an envelope into an array that can be sent through ZeroMQ, call:

```javascript
var args = envelope.toArgs();
```


#### The message

##### envelope.setMessage(type, message)

Resets the envelope's type and message, where message is either a string, buffer or an array of
strings and buffers.

##### envelope.addMessage(message)

Adds the message to the list of messages currently wrapped inside the envelope. The message must be
a buffer or a string.


#### The route

##### envelope.setRoute(route)

Resets the route of the envelope. The route must be an array, or a string (that becomes a 1-element
array) or falsy (to empty the route).

##### envelope.consumeRoute(identity)

Removes the identity from the start of the route, if it's there. If no identity is given, the entire
route is emptied.

##### envelope.routeRemains()

Returns true if there is a route left, false otherwise.

##### envelope.getFinalDestination()

Returns the final address in the route.


#### The return route

##### envelope.setReturnRoute(route)

Like the `setRoute(route)` function, and applying the same rules to its only argument, this sets
the return route of the message. In other words, if we want to send something back to the sender of
this envelope, we should use this returnRoute.

##### envelope.injectSender(identity)

Prepends an identity to the returnRoute.

##### envelope.getInitialSource()

Returns the envelope's original sender identity.


#### Flags

There is currently only 1 flag, namely 'TRACK_ROUTE'. When this flag is active, the returnRoute must
be kept around in the envelope as it travels across the network.

##### envelope.isFlagged(flag)

Returns true if a flag is turned on for this envelope, false otherwise. The flag may be a string, or
its integer representation.

##### envelope.getFlags()

Returns an array with string representations of all flags that are turned on.

##### envelope.setFlag(flag)

Turns a flag on.

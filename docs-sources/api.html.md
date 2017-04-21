---
title: MAGE API Documentation

toc_footers:
  - <a href='./index.html'>User Guide</a>
  - <a href='https://github.com/mage/mage'>GitHub</a>
  - <a href='https://wizcorp.jp/mage'>MAGE website</a>
  - <a href='https://wizcorp.jp/'>Wizcorp website</a>

# All includes here are hooked directly into MAGE's Readme
# files, which are left on-location in the code base.
includes:
  # The MAGE object
  - mage/lib/mage/Readme

  # State management
  - mage/lib/state/Readme

  # Archivists
  - mage/lib/archivist/Readme

  # Archivist vaults
  - mage/lib/archivist/vaults/Readme
  - mage/lib/archivist/vaults/file/Readme
  - mage/lib/archivist/vaults/memory/Readme
  - mage/lib/archivist/vaults/redis/Readme
  - mage/lib/archivist/vaults/mysql/Readme
  - mage/lib/archivist/vaults/memcached/Readme
  - mage/lib/archivist/vaults/couchbase/Readme
  - mage/lib/archivist/vaults/dynamodb/Readme
  - mage/lib/archivist/vaults/elasticsearch/Readme
  - mage/lib/archivist/vaults/manta/Readme
  - mage/lib/archivist/vaults/client/Readme

  # Service Discovery
  - mage/lib/serviceDiscovery/Readme
  - mage/lib/serviceDiscovery/engines/single/Readme
  - mage/lib/serviceDiscovery/engines/mdns/Readme
  - mage/lib/serviceDiscovery/engines/zookeeper/Readme

  # HTTP server and transports
  # Ignored since its just a link to the file below
  # - mage/lib/httpServer/Readme
  - mage/lib/httpServer/transports/http/Readme

  # Message server, MMRP and message stream
  - mage/lib/msgServer/Readme
  - mage/lib/msgServer/mmrp/Readme
  - mage/lib/msgServer/msgStream/Readme


  # Command Center
  - mage/lib/commandCenter/Readme

  # Configuration
  - mage/lib/config/Readme

  # Logging and logging backends
  - mage/lib/loggingService/Readme

  - mage/lib/sampler/Readme
  - mage/lib/savvy/Readme

  # Process management
  - mage/lib/processManager/Readme

  # CLI
  - mage/lib/cli/Readme

search: true
---

Here you will find the complete MAGE API documentation. If you are
just getting started, you might want to have a look at the
[User Guide](./index.html) first.

## Modules

```javascript
mage.useModules([
	'session'
]);
```

In addition to the MAGE API, the following core modules are also available for use.

  * [Sessions](https://github.com/mage/mage/tree/master/lib/modules/session)
  * [Auth](https://github.com/mage/mage/tree/master/lib/modules/auth)
  * [Time](https://github.com/mage/mage/tree/master/lib/modules/time)

In each case, you will need to make sure to add the module name to your `mage.useModules()` call.

/**
 * This is your Archivist topic/index configuration.
 * For more information, please read the Archivist documentation.
 */
import * as mage from 'mage';

exports.ucResponseMeta = <mage.archivist.ITopic> {
  index: ['session'],
  vaults: {
    // Please add one or more vault references here (they must support key expiration)
    volatileVault: {}
  }
};

exports.ucResponseData = <mage.archivist.ITopic> {
  index: ['session'],
  vaults: {
    // Please add one or more vault references here (they must support key expiration)
    volatileVault: {}
  }
};

exports.session = <mage.archivist.ITopic> {
  index: ['actorId'],
  vaults: {
    client: {
      shard: function (value: mage.archivist.IVaultValue) {
        return value.index.actorId;
      },
      acl: function (test) {
        test(['user', 'test'], 'get', { shard: true });
        test(['cms', 'admin'], '*');
      }
    },
    // Please add one or more vault references here (they must support key expiration)
    volatileVault: {}
  }
};

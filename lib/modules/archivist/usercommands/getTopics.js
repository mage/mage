const mage = require('lib/mage');

exports.acl = ['admin'];

exports.execute = async () => mage.core.archivist.getTopics();

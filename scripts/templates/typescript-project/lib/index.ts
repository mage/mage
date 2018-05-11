import * as mage from 'mage';

// Here you can define which MAGE modules you wish to load.
// For a complete list of available modules, see:
// https://github.com/mage/mage/tree/master/lib/modules
mage.useModules([
	'archivist',
	'config',
	'logger',
	'session',
	'time'
]);

// Here, you will load your application-specific modules.
// Alternatively, you could also load each modules manually
// in the same way you would load MAGE modules (see below).
mage.useApplicationModules();

export = mage;

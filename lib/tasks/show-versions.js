var codependency = require('codependency');
var requirePeer = codependency.get('mage');

/**
 * Merges a and b into a new object and returns it. In the case of conflict, b wins.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {Object}
 */

function objMerge(a, b) {
	var obj = {};

	Object.keys(a).forEach(function (key) {
		obj[key] = a[key];
	});

	Object.keys(b).forEach(function (key) {
		obj[key] = b[key];
	});

	return obj;
}


function gatherCoreSystemsDeps(mage) {
	// gather all peer deps information from each core system

	var deps = {};

	var systems = Object.keys(mage.core);
	systems.forEach(function (systemName) {
		var system = mage.core[systemName];

		if (typeof system.listPeerDependencies === 'function') {
			// the function must return an array of:
			// { description: 'Archivist MySQL vault', packages: ['mysql'] }

			deps = objMerge(deps, system.listPeerDependencies());
		}
	});

	// Since modules are not set up, we're adding one hardcoded exception here, which is the ldapjs
	// peer dependency of the "ident" module. Clearly, this is not very elegant, but in the long
	// term, this should be dealt with by externalizing all MAGE built-in modules as independent
	// NPM modules.

	deps['Ident module LDAP engine'] = ['ldapjs'];

	return deps;
}


exports.start = function (mage, options, cb) {
	var out = [];
	var exitCode = 0;

	// The application itself

	out.push(mage.rootPackage.name + ': v' + mage.rootPackage.version);

	// The MAGE version

	out.push('MAGE: v' + mage.version);
	out.push('');

	// Node.js and subsytems

	Object.keys(process.versions).forEach(function (key) {
		out.push(key + ': v' + process.versions[key]);
	});

	out.push('');

	// All optional peer dependencies supported by MAGE

	var peerDeps = gatherCoreSystemsDeps(mage);
	Object.keys(peerDeps).forEach(function (description) {
		var packages = peerDeps[description];

		var supported = [];
		var installed = [];

		for (var j = 0; j < packages.length; j += 1) {
			var packageName = packages[j];
			var resolved = requirePeer.resolve(packageName);

			var supportedRange = resolved.supportedRange;

			supported.push(packageName + '@' + supportedRange);

			if (resolved.isInstalled) {
				var version = resolved.installedVersion;

				if (resolved.isValid) {
					installed.push(packageName + '@' + version);
				} else {
					exitCode = 1;
					installed.push(packageName + '@' + version + ' (invalid!)');
				}
			}
		}

		out.push(description + ':');
		out.push('  supported: ' + supported.join(', '));
		out.push('  installed: ' + (installed.join(', ') || 'none'));
		out.push('');
	});

	// output to terminal

	process.stdout.write(out.join('\n'));

	cb(null, { shutdown: true, exitCode: exitCode });
};

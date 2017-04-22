'use strict';

const assert = require('assert');

describe('apps', function () {
	const libApp = require('lib/app');

	// allow lib/app configuration override

	let currentAppsConfig;
	let currentCommandCenterSetup;

	const oldFns = {
		getAppsConfig: libApp.getAppsConfig,
		getLogger: libApp.getLogger,
		createCommandCenter: libApp.createCommandCenter
	};

	const testFns = {
		getAppsConfig: function () {
			return currentAppsConfig;
		},
		getLogger: function () {
			return {
				debug: function () {}
			};
		},
		createCommandCenter: function (app) {
			return {
				setup: function () {
					currentCommandCenterSetup(app);
				}
			};
		}
	};

	beforeEach(function () {
		libApp.getAppsConfig = testFns.getAppsConfig;
		libApp.getLogger = testFns.getLogger;
		libApp.createCommandCenter = testFns.createCommandCenter;
	});

	afterEach(function () {
		libApp.getAppsConfig = oldFns.getAppsConfig;
		libApp.getLogger = oldFns.getLogger;
		libApp.createCommandCenter = oldFns.createCommandCenter;

		libApp.removeAllApps();
	});

	it('creates apps', function () {
		currentAppsConfig = {
			app1: {},
			app2: {}
		};

		const setupComplete = {
			app1: null,
			app2: null
		};

		currentCommandCenterSetup = function (app) {
			setupComplete[app.name] = app;
		};

		libApp.createApps();

		assert(setupComplete.app1);
		assert(setupComplete.app2);
		assert.strictEqual(Object.keys(setupComplete).length, 2);

		assert.strictEqual(libApp.get('app1'), setupComplete.app1);
		assert.strictEqual(libApp.get('app2'), setupComplete.app2);
	});

	it('skips disabled and unconfigured apps', function () {
		currentAppsConfig = {
			app3: {},
			app4: { disabled: true },
			app5: null
		};

		const setupComplete = {
			app3: null,
			app4: null,
			app5: null
		};

		currentCommandCenterSetup = function (app) {
			setupComplete[app.name] = app;
		};

		libApp.createApps();

		assert(setupComplete.app3);
		assert.strictEqual(setupComplete.app4, null);
		assert.strictEqual(setupComplete.app5, null);
		assert.strictEqual(Object.keys(setupComplete).length, 3);

		assert.strictEqual(libApp.get('app3'), setupComplete.app3);
		assert.strictEqual(libApp.get('app4'), undefined);
		assert.strictEqual(libApp.get('app5'), undefined);
	});

	it('getters and deletion', function () {
		currentAppsConfig = {
			app7: {},
			app8: {}
		};

		currentCommandCenterSetup = function (/* app */) {};

		libApp.createApps();

		const app7 = libApp.get('app7');
		const app8 = libApp.get('app8');

		assert(app7);
		assert(app8);

		assert.strictEqual(libApp.getAppMap().app7, app7);
		assert.strictEqual(libApp.getAppMap().app8, app8);

		let apps = libApp.getAppList();
		assert.equal(apps.length, 2);

		assert(apps[0] === app7 || apps[0] === app8);
		assert(apps[1] === app7 || apps[1] === app8);
		assert(apps[0] !== apps[1]);

		libApp.removeApp('app7');

		// app7 should now be gone, only app8 remains

		assert.strictEqual(libApp.getAppMap().app7, undefined);
		assert.strictEqual(libApp.getAppMap().app8, app8);

		apps = libApp.getAppList();
		assert.equal(apps.length, 1);

		assert(apps[0] === app8);

		libApp.removeAllApps();

		// app8 should now be gone too, no apps remain

		assert.strictEqual(libApp.getAppMap().app8, undefined);

		apps = libApp.getAppList();
		assert.equal(apps.length, 0);

		assert.throws(() => {
			libApp.removeApp('non-existing-app');
		});
	});

	it('knows app readiness', function () {
		currentAppsConfig = {
			app9: {},
			app10: { disabled: true }
		};

		let created = 0;

		currentCommandCenterSetup = function (/* app */) {
			created += 1;
		};

		// call createApps() multiple times, should not crash or create apps more than once
		libApp.createApps();
		libApp.createApps();
		libApp.createApps();
		assert.equal(created, 1);
		assert.equal(libApp.isAppCreated('app9'), true);
		assert.equal(libApp.isAppCreated('app10'), false);

		libApp.createApp('app10');
		assert.equal(created, 2);

		assert.throws(() => {
			libApp.createApp('non-existing-app');
		});

		assert.throws(() => {
			libApp.isAppCreated('non-existing-app');
		});

		assert.throws(() => {
			libApp.createApp('app9'); // already created
		});
	});
});

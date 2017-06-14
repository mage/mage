var cluster = require('cluster');

if (cluster.isWorker) {
	var Messenger = require('../../lib/processMessenger');
	var messenger = new Messenger('test');

	if (cluster.worker.id <= 4) {
		messenger.on('test1', function (data) {
			messenger.send('master', 'test1', data);
		});
	} else if (cluster.worker.id === 5) {
		messenger.on('test2', function () {
			messenger.send('master', 'test2');
		});
	} else if (cluster.worker.id === 7) {
		messenger.on('test4.worker', function (data, from) {
			messenger.send('master', 'test4.ok', {
				data: data,
				from: from
			});
		});
		messenger.send('master', 'test4.worker7.ok');
	} else if (cluster.worker.id === 8) {
		messenger.send(7, 'test4.worker', { data: 'test' });
	} else if (cluster.worker.id === 9) {
		messenger.on('test5.ok', function () {
			messenger.send('master', 'test5.worker9.ok');
		});
		messenger.send('master', 'test5.worker9.ready');
	} else if (cluster.worker.id === 10) {
		messenger.broadcast('test5.ok', { data: 'test' });
	} else if (cluster.worker.id === 11) {
		var messenger2 = new Messenger('test-othernamespace');
		messenger.on('test6.nok', function () {
			messenger.send('master', 'test6.nok');
		});
		messenger2.send('master', 'test6.nok');
	}
}

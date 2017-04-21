var fs = require('fs');

var deleteFolderRecursive = function (path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file) {
			var curPath = path + '/' + file;
			if (fs.lstatSync(curPath).isDirectory()) {
				deleteFolderRecursive(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});

		fs.rmdirSync(path);
	}
};

const paths = process.argv.slice(2);
if (!paths) {
	console.error('Usage: node rmrf.js [path] [... other paths]');
	process.exit(1);
}

paths.forEach(deleteFolderRecursive);

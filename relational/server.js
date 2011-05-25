var Backbone = require('./model');
console.log(Backbone);

var browserify = require('browserify')({
    base: __dirname,
    require: ['underscore', 'backbone', 'backbone-rel']
});
require('http').createServer(function(req, res) {
	if (req.url === '/') req.url = '/index.html';
	require('fs').readFile(__dirname + req.url, function(err, data) {
		if (err) {
			browserify(req, res, function() {
				res.writeHead(404); res.end();
			});
		} else {
			var mime = 'text/html';
			if (req.url.slice(-3) === '.js') mime = 'text/javascript';
			if (req.url.slice(-4) === '.css') mime = 'text/css';
			res.writeHead(200, {'content-type': mime, 'content-length': data.length});
			res.end(data);
		}
	});
}).listen(8080);

require('repl').start('node> ').context.foo1 = Backbone.foo1;
process.stdin.on('close', process.exit);

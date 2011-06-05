var assert = require('assert');
var http = require('http');

function server(port, cb) {
	var srv = http.createServer(function(req, res) {
		res.writeHead(200);
		res.end('Hello!');
	});
	srv.listen(port, cb);
	return srv;
}

function client(port, cb) {
	var req = http.request({
		method: 'GET',
		host: 'localhost',
		port: port,
		path: '/foo',
		//headers: {
		//	Host: 'localhost'
		//}
	}, function(res) {
		var buf = '';
		res.setEncoding('utf8');
		res.on('end', function() {
			console.log(buf);
			cb && cb();
		});
		res.on('data', function(chunk) {
			buf += chunk;
		});
	});
	req.end();
	return req;
}

module.exports = {
	'smoke test': t = function(be) {
		console.log('ARG', arguments);
		/*be(function() {
			assert.ok(true);
		});*/
		server(15101, function() {
			client(15101, be);
			be();
		});
	}
};

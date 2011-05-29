var Bison = require('bison');
var encode = Bison.encode;
var decode = Bison.decode;
var EOM = '-=!=-', EOM_length = EOM.length;

/*exports = module.exports = function(stream) {
	stream
};*/

var net = require('net');
var conns = {};
net.createServer(function(conn) {
	conn.id = Math.random().toString();
	conns[conn.id] = conn;
	var buffer = '', idx;
	conn.on('error', function() {
		console.log('ERROR', arguments);
	});
	conn.on('data', function(data) {
		buffer += data.toString();
		var start = 0;
		while ((idx = buffer.indexOf(EOM, start)) != -1) {
			var message = buffer.substr(start, idx - start);
			message = decode(message);
			this.emit('message', message);
			start = idx + EOM_length;
		}
		buffer = buffer.substr(start);
	});
	conn.on('message', function(message) {
		console.log('MESSAGE', message);
	});
}).listen(function() {
	var client = net.createConnection(this.address().port);
	_write = client.write;
	client.write = function(data) {
		_write.call(client, encode(data) + EOM)
	};
	client.on('connect', function() {

    process.stdin.resume();
    process.stdin.on('data', function (data) {
      data = data.toString().trim();
      client.write({
        input: data
      })
    });

	});
});

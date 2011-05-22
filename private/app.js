'use strict';

var Server = require('./server');
//var Private = require('./private');

/**
 * HTTP server
 */

var node1 = Server().http.listen(3001);
var node2 = Server().http.listen(3002);
var node3 = Server().http.listen(3003);

/** REPL for tests.
 * N.B. fails to work under nodester.com!
 */

var repl = require('repl').start('node> ');
process.stdin.on('close', process.exit);
repl.context.n1 = node1;
repl.context.n2 = node2;
repl.context.n3 = node3;

repl.context.stress = function() {
	for (var i = 0; i < 1000; ++i) {
		node1.invoke('ping', 'foooooo');
	}
};

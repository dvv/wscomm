'use strict';

//var Base = require('./base');
var Context = require('./context');

var D = Context.extend(function(socket) {
}).methods({
});

var socket = {
	send: function() {
		console.log('SEND', arguments);
	}
};
var encode = JSON.stringify;

var d = new Context({a:1});
d.on('all', console.log);
d.on('send', function(changes, options) {
	// notify remote end that context has changed
	// send serialized context to the remote end
	var s = encode({
		cmd: 'context',
		// `reset` controls whether to send the whole context replacing
		// the current one
		// N.B. no changes means to force sending the whole context.
		// this allows to group changes in "package" and send them
		// in one go
		params: [changes && !options.reset ? changes : this, options]
	});
	// N.B. we have "insight" here of how socket.io serializes JSON ;)
	// FIXME: this should be fixed
	socket.send('~j~' + s);
});

console.log(d);

var repl = require('repl').start('node> ');
repl.context.d = d;
//repl.context.Base = Base;
repl.context.Context = Context;

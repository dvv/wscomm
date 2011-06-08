'use strict';

var model = require('./js/model.js');


/**
 * HTTP middleware
 */

var Connect = require('connect');
var sessionHandler;
var stack = [
	Connect.favicon(),
	Connect.static(__dirname),
	sessionHandler = require('cookie-sessions')({
		session_key: 'sid',
		secret: 'change-me-in-production-env',
		path: '/',
		timeout: 86400000
	}),
	require('./lib/body')(),
	require('./lib/rest')('/', {
		context: {
			Foo: {
				query: function(ctx, query, next) {
					console.log('QRY', arguments);
					next(null, [{}]);
				}
			}
		}
	}),
	auth()
];

/**
 * Handle authentication
 */

function auth(url) {

	return function handler(req, res, next) {
		if (req.url === '/auth') {
			// session exist?
			if (req.session) {
				// ...remove session
				delete req.session;
			// no session so far?
			} else {
				// ...signin!
				// put authentication logic here
				// ???
				// set the session so that we can persist the shared context
				req.session = {
					user: {
						id: 'dvv',
						email: 'try@find.me'
					}
				};
			}
			// go home
			res.writeHead(302, {location: '/'});
			res.end();
		} else {
			next();
		}
	};

}

var http = Connect.apply(Connect, stack);
http.listen(3000);

var IO = require('Socket.IO-node');
var ws = IO.listen(http, {
	//transports: ['xhr-polling'],
	transports: ['websocket'],
	//log: false
});
// reuse cookie session middleware
ws.set('authorization', function(data, next) {
	sessionHandler(data.request, {}, function() {
		console.log('SESSION', data.request.session);
		next(null, data.request.session);
	});
});

//console.log(ws);
ws.sockets.on('connection', function(client) {

	console.log('CLIENT');//, client);
	//ws.sockets.emit('this', { will: 'be received by everyone' });
	client.on('private message', function(from, msg) {
		console.log('I received a private message by ', from, ' saying ', msg);
	});
	client.on('message', function() {
		console.log('I received a message', arguments);
	});
	client.on('foo', function() {
		console.log('FOO', arguments);
	});
	client.on('event', function() {
		console.log('EVENT', arguments);
	});
	client.on('disconnect', function() {
		ws.sockets.emit('user disconnected');
	});

});


//var Spine = require('spine');
var repl = require('repl').start('node> ').context;
repl.app = model;
repl.ws = ws;
repl.c = function(){return ws.sockets.sockets[Object.keys(ws.sockets.sockets)[0]];};
repl.s = function(){repl.c().json.send({a:1,b:new Date()});};
process.stdin.on('close', process.exit);

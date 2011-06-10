'use strict';

var model = require('./public/js/model.js');


/**
 * HTTP middleware
 */

var Stack = require('./lib');
var sessionHandler;
var stack = [
	// serve static content
	Stack.static(__dirname + '/public', 'index.html', {
		maxAge: 0,
		//cacheThreshold: 16384
	}),
	// dynamic content requires session
	sessionHandler = require('cookie-sessions')({
		session_key: 'sid',
		secret: 'change-me-in-production-env',
		path: '/',
		timeout: 86400000
	}),
	// process request body
	Stack.body(),
	// process RESTful access
	Stack.rest('/', {
		context: {
			Foo: {
				query: function(ctx, query, next) {
					console.log('QRY', arguments);
					next(null, [{}]);
				}
			}
		}
	}),
	// handle signin/signout
	auth(),
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

var http = Stack.listen(stack, 3000);
var io = require('./lib/wscomm');
var ws = io.WSComm(http, {
	// we support only these transports
	transports: ['websocket'],
	// reuse cookie session middleware
	authorization: function(data, next) {
		sessionHandler(data.request, {}, function() {
			console.log('SESSION', data.request.session);
			next(null, data.request.session);
		});
	}
});

ws.of('').on('connection', function(client) {

	console.log('CLIENT');

	client.update({func: io.THIS_IS_FUNC});

	client.emit('ready', function(x) {
		console.log('READY CONFIRMED', x, this.id);
	});
	//ws.sockets.emit('this', { will: 'be received by everyone' });
	//client.on('private message', function(from, msg) {
	//	console.log('I received a private message by ', from, ' saying ', msg);
	//});

});

var repl = require('repl').start('node> ').context;
repl.app = model;
repl.ws = ws;
repl.c = function(){return ws.sockets.sockets[Object.keys(ws.sockets.sockets)[0]];};
repl.x = function(){return c().context;};
repl.u1 = function(){repl.c().update({baz:3});};
repl.u = function(){repl.c().emit('update', {baz:3});};
repl.i = function(){repl.c().emit('invoke', 'test', function(x){console.log('ACK', arguments);});};
repl.s = function(){repl.c().json.send({a:1,b:new Date()});};
process.stdin.on('close', process.exit);

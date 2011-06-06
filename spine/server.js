var IO = require('Socket.IO-node');
var Connect = require('connect');
var Session = require('cookie-sessions');

/**
 * HTTP middleware
 */

var sessionHandler;
var stack = [
	Connect.favicon(),
	Connect.static(__dirname),
	sessionHandler = Session({
		session_key: 'sid',
		secret: 'change-me-in-production-env',
		path: '/',
		timeout: 86400000
	}),
	auth()
];

/**
 * Handle authentication
 */

function auth(url) {

	return function handler(req, res, next) {
		if (req.url === '/auth') {
			// put authentication logic here
			// ???
			// set the session so that we can persist the shared context
			req.session = {
				user: {
					id: 'dvv',
					email: 'try@find.me'
				}
			};
			// go home
			res.writeHead(302, {location: '/'});
			res.end();
		} else {
			next();
		}
	};

}

var http1 = Connect.apply(Connect, stack);
http1.listen(3000);

var ws = IO.listen(http1, {
	transports: ['xhr-polling'],
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
	client.on('disconnect', function() {
		ws.sockets.emit('user disconnected');
	});

});

var repl = require('repl').start('node> ').context;
repl.ws = ws;
repl.c = function(){return ws.sockets.sockets[Object.keys(ws.sockets.sockets)[0]];};

process.stdin.on('close', process.exit);

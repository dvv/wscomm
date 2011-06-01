var IO = require('Socket.IO-node');
var Connect = require('connect');
var Session = require('cookie-sessions');

/**
 * HTTP middleware
 */

var stack = [
	Connect.favicon(),
	Connect.static(__dirname),
	// TODO: reuse in websocket auth
	Session({
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
	transports: ['websocket', 'xhr-polling'],
	//log: false
});
console.log(ws);
ws.sockets.on('connection', function(client) {

	console.log('CLIENT', client);
	ws.sockets.emit('this', { will: 'be received by everyone' });
	client.on('private message', function(from, msg) {
		console.log('I received a private message by ', from, ' saying ', msg);
	});
	client.on('disconnect', function() {
		ws.sockets.emit('user disconnected');
	});

});

require('repl').start('node> ').context.ws = ws;
process.stdin.on('close', process.exit);

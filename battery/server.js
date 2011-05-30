'use strict';

/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

var _ = require('underscore');
var Element = require('./element');
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
var e1 = new Element(http1);
e1.id = 3000;
http1.listen(3000);
var http2 = Connect.apply(Connect, stack);
var e2 = new Element(http2);
e2.id = 3002;
http2.listen(3002);

require('repl').start('node> ').context.e = [e1, e2];
process.stdin.on('close', process.exit);

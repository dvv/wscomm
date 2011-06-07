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

//var Spine = require('spine');
require('repl').start('node> ').context.app = model;

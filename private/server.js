'use strict';

var Private = require('./private');

/**
 * middleware
 */

var Connect = require('connect');
var Cookie = require('cookie-sessions');

// secure sessions stored in cookie 'sid'
// TODO: externalize
var sessionOptions = {
	session_key: 'sid',
	secret: 'change-me-in-production-env',
	path: '/',
	timeout: 86400000
};

/**
 * Listen to specified URL and respond with status 200
 * to signify this server is alive
 */

function health(url) {

	return function handler(req, res, next) {
		if (req.url === url) {
			res.writeHead(200);
			res.end();
		} else {
			next();
		}
	};

}

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
					id: nonce(),
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

/**
 * HTTP server middleware
 */

var middleware = [
	Connect.favicon(),
	// respond 200 to signify this server is alive
	health('/haproxy?monitor'),
	Connect.static(__dirname),
	Connect.logger(),
	// handle cookie session
	Cookie(sessionOptions),
	// handle auth, which should set req.session.user.id
	auth(),
];

function run() {
	var node = new Private(middleware, {
		session: sessionOptions
	});
	return node;
}

/**
 * Expose interface
 */

exports = module.exports = run;

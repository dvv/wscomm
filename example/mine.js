'use strict';

/**
 * middleware
 */

var M = require('f').stack;
var stack = M(
	//
	// secure cookie sessions
	//
	M.session({
		session_key: 'sid',
		secret: 'change-me-in-production-env',
		path: '/',
		timeout: 86400000
	}),
	//
	// body parser
	//
	M.body(),
	//
	// public contents
	//
	M.static('/', __dirname, null, {
		cacheThreshold: 65536 * 2
	}),
	//
	// authentication
	//
	// ???
	//
	// root
	//
	M.mount('GET', '/', function(req, res, next) {
		if (!req.session) req.session = {};
		if (!req.session.uid) req.session.uid = Math.random();
		res.send(req.session);
	}),
	//
	// haproxy monitors this server's health
	//
	M.health('/haproxy?monitor')
);

/**
 * HTTP server
 */

var Http = require('http');
var http1 = Http.createServer(stack);
http1.listen(3001);
var http2 = Http.createServer(stack);
http2.listen(3002);
var http3 = Http.createServer(stack);
http3.listen(3003);

/**
 * WebSocket server
 */

var wscontext = {
	middleware: stack,
	generateSessionId1: function() {
		this.sessionId = Ws.nonce() + Ws.nonce() + Ws.nonce();
		// we patched Listener.prototype._onConnection to always
		// have access to headers, particularly to Cookie:
		var sid = this.listener.req.headers.cookie;
		sid = sid && sid.match(new RegExp('(?:^|;) *' +
			'sid' + '=([^;]*)'));
		sid = sid && sid[1];
		this.clientId = sid;
		return this;
	}
};

var Ws = require('wscomm');
var ws1 = Ws.listen(http1, wscontext);
var ws2 = Ws.listen(http2, wscontext);
var ws3 = Ws.listen(http3, wscontext);

/**
 * Persistence layer
 */
var db = require('redis').createClient();

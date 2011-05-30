'use strict';

/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

var _ = require('underscore');
var Redis = require('redis');
var Bison = require('bison');
var Ws = require('socket.io');
require('./ws-patch');
var Context = require('./context');

/**
 * Utility functions
 *
 * @api private
 */

//
// simple nonce generator
//
function rnd() {
	return Math.floor(Math.random() * 1e9).toString(36);
}
function nonce() {
	return (Date.now() & 0x7fff).toString(36) + rnd() + rnd() + rnd();
}

/**
 * Constructs new battery element
 *
 * @api public
 */

function Element(httpServer) {

	var self = this;

	// persistence
	var db = this.db = Redis.createClient();

	// socket.io server
	this.http = httpServer;
	var ws = this.ws = Ws.listen(this.http, {
		transports: ['websocket', 'xhr-polling'],
		log: false
	});
	// assign unique id
	ws.id = nonce();
	// on new connection...
	ws.on('clientConnect', function(client) {
		// determine client id from the session
		//console.log('SESS', client.listener.req.session);
		// TODO: from session!
		var cid = client.clientId = 'dvv';
		// fetch initial context
		var context = client.context = new Context(null, client);
		// setup initial content
		db.get('c:' + cid, function(err, result) {
			if (result) result = Context.decode(result);
			context.update(result);//, {silent: true});
console.error('NEW CONTEXT FOR', client.sessionId, context);
			// notify neighbors
			self.broadcast(client, {cmd: 'entered'});
		});
	});
	// on new message...
	ws.on('clientMessage', function(message, client) {
		if (!message) return;
		console.error('MESSAGE', message);
		var fn;
		// remote side calls this side method
		if (message.cmd === 'call') {
			// do call the method, if it's a callable indeed
			client.context.invoke.apply(client.context, message.params);
			// broadcast the message
			//self.broadcast(client, message);
		// remote context has changed
		} else if (message.cmd === 'update') {
			var changes = message.params[0];
			var options = message.params[1] || {};
			// update context
			client.context.update.apply(client.context, message.params);//changes, options);
			// persist context
			db.set('c:' + client.clientId, Context.encode(client.context), function(err, result) {
				// notify neighbors
				self.broadcast(client, {cmd: 'updated'});
			});
		}
	});
	// on connection closed...
	ws.on('clientDisconnect', function(client) {
		// notify neighbors
		self.broadcast(client, {cmd: 'left'});
	});

	// pub/sub network
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.psubscribe('*');
	// on pub/sub message...
	this.sub.on('pmessage', function(pattern, channel, message) {
		//console.log('BUS', pattern, channel);
		//if (!message) return;
		message = Bison.decode(message);
		if (channel === 'battery') {
			self.onBroadcast(message);
		}
	});
}

/**
 * Broadcasts data to all battery elements
 *
 * @api private
 */

Element.prototype.broadcast = function(client, data, callback) {
return;
sent++;
if (callback) {
	// publish data to 'battery' pub/sub channel
	this.pub.publish('battery', Bison.encode({
		bid: this.id,
		//cid: client.clientId,
		from: client.sessionId,
		data: data
	}), callback || function(){});
} else {
	this.pub.publish('battery', Bison.encode({
		bid: this.id,
		//cid: client.clientId,
		from: client.sessionId,
		data: data
	}));
}
};

/**
 * Handles broadcast message
 *
 * @api private
 */

Element.prototype.onBroadcast = function(message) {
	message.rid = this.id;
	console.error('BCASTED', message);
return;
	var data = message.data;
	if (!data) return;
recved++;
	var clients = this.ws.clients;
	var cid = clients[data.from]; if (cid) cid = cid.clientId;
	if (data.cmd === 'set') {
		for (var i in clients) {
			//if (clients[i].clientId === cid) {
				this.onMessage.call(clients[i], data);
			//}
		}
	} else if (data.cmd === 'call') {
		for (var i in clients) {
			this.onMessage.call(clients[i], data);
		}
	}
	/*for (var i in clients) {
		this.onMessage.call(clients[i], message);
	}*/
};

/**
 * Handles client message
 *
 * @api private
 */

Element.prototype.onMessage = function(message) {
	cliented++;
	message.to = this.sessionId;
	message.context = this.context;
	console.error('MESSAGE', message);
	if (message.data.cmd === 'call') {
		this.context.invoke.apply(this.context, message.data.params);
	}
	//this.send(message);
};

//
//
//
//
//
//

var Connect = require('connect');
var Session = require('cookie-sessions');

var stack = [
	Connect.favicon(),
	Connect.static(__dirname),
	Session({
		session_key: 'sid',
		secret: 'change-me-in-production-env',
		path: '/',
		timeout: 86400000
	}),
	auth()
];

var http1 = Connect.apply(Connect, stack);
var e1 = new Element(http1);
e1.id = 3000;
http1.listen(3000);
var http2 = Connect.apply(Connect, stack);
var e2 = new Element(http2);
e2.id = 3002;
http2.listen(3002);

var Sync = require('sync');
var freemem = require('os').freemem;
var recved = 0, sent = 0, cliented = 0;

setInterval(function() {
	//console.log('FREE', Date.now(), freemem(), sent, recved, cliented, e1.pub.command_queue.length, e1.sub.command_queue.length);
}, 2000);

setInterval(function() {
	//e1.broadcast({clientId: 'dvv', sessionId: '111111111111111111111111111'}, {foo: 'foo'});
}, 1);

/*
Sync(function(){
while (true) {
	e1.broadcast.sync(e1, {clientId: 'dvv', sessionId: '111111111111111111111111111'}, {foo: 'foo'});
}
});
*/

setInterval(function() {
	//e1.pub.publish('cmd', '{"f":"fooo"}');
}, 100);

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

require('repl').start('node> ').context.e = [e1, e2];
process.stdin.on('close', process.exit);

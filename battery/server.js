'use strict';

var Sync = require('sync');

var Redis = require('redis');
var Connect = require('connect');
var Ws = require('socket.io');
var Session = require('cookie-sessions');
require('./ws-patch');

/*
var ClientProto = require('socket.io/lib/socket.io/client').prototype;
var _write = ClientProto._write;
ClientProto._write = function() {
	console.log('WRITE', this.sessionId, arguments);
	_write.apply(this, arguments)
};
*/

var freemem = require('os').freemem;
var recved = 0, sent = 0, cliented = 0;

function Element(stack) {
	var self = this;
	var db = this.db = Redis.createClient();
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.http = Connect.apply(Connect, stack);
	var ws = this.ws = Ws.listen(this.http, {
		transports: ['websocket', 'xhr-polling'],
		log: false
	});
	//this.http.on('request', ws.check.bind(ws));
	ws.on('clientConnect', function(client) {
		//console.log('SESS', client.listener.req.session);
		var cid = client.clientId = 'dvv';
		db.get('c:' + cid, function(err, result) {
			client.context = result;
			self._broadcast(client, {cmd: 'entered'});
		});
	});
	ws.on('clientMessage', function(message, client) {
		self._broadcast(client, message);
	});
	ws.on('clientDisconnect', function(client) {
		self._broadcast(client, {cmd: 'left'});
	});
	this.sub.psubscribe('*');
	this.sub.on('pmessage', function(pattern, channel, message) {
		//console.log('BUS', pattern, channel);
		recved++;
		//if (!message) return;
		if (typeof message === 'string') try {
			message = JSON.parse(message);
		} catch (err) {
			console.error('BAD JSON', message);
			return;
		}
		var clients = ws.clients;
		if (channel === 'bus') {
			for (var i in clients) {
				self.onMessage.call(clients[i], message);
			}
		}
	});
}
Element.prototype._broadcast = function(client, data, callback) {
	sent++;
	/*this.pub.publish('bus', JSON.stringify({
		//cid: client.clientId,
		from: client.sessionId,
		data: data
	}), callback || function(){});*/
	this.pub.publish('bus', JSON.stringify({
		//cid: client.clientId,
		from: client.sessionId,
		data: data
	}));
};
Element.prototype.onMessage = function(message) {
	cliented++;
	message.to = this.sessionId;
	message.context = this.context;
	//console.log('MESSAGE', message);
	this.send(message);
};

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

var e1 = new Element(stack);
e1.id = 3000;
e1.http.listen(3000);
var e2 = new Element(stack);
e2.id = 3002;
e2.http.listen(3002);

setInterval(function() {
	console.log('FREE', Date.now(), freemem(), sent, recved, cliented, e1.pub.command_queue.length, e1.sub.command_queue.length);
}, 2000);

setInterval(function() {
	//e1._broadcast({clientId: 'dvv', sessionId: '111111111111111111111111111'}, {foo: 'foo'});
}, 1);

//Sync(function(){
while (true) {
	e1._broadcast.sync(e1, {clientId: 'dvv', sessionId: '111111111111111111111111111'}, {foo: 'foo'});
}
//});

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

require('repl').start('node> ');//.context.run = run;
process.stdin.on('close', process.exit);

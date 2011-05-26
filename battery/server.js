'use strict';

var Redis = require('redis');
var Connect = require('connect');
var Ws = require('socket.io');

function Element(stack) {
	var self = this;
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.subscribe('bus');
	this.sub.on('message', this.onBusMessage.bind(this));
	this.http = Connect.apply(Connect, stack);
	var ws = this.ws = Ws.listen(this.http, {
		transports: ['websocket', 'xhr-polling'],
		//log: false
	});
	ws.cids = {};
	ws.on('connection', function(client) {
		var sid = client.sessionId;
		var cid = client.clientId = 'dvv';
		client.on('disconnect', function() {
			delete ws.cids[cid][sid];
			//self.propagate('disconnected', client, {});
		});
		client.on('message', function(message) {
			self.propagate('realmessage', client, message);
		});
		client.on('realmessage', self.onMessage.bind(this));
		//client.on('connected', self.onMessage.bind(this));
		//client.on('disconnected', self.onMessage.bind(this));
		if (!ws.cids[cid]) ws.cids[cid] = {};
		ws.cids[cid][sid] = client;
		//self.propagate('connected', client, {});
	});
}
Element.prototype.propagate = function(type, client, data) {
	this.pub.publish('bus', JSON.stringify({
		type: type,
		cid: client.clientId,
		sid: client.sessionId,
		data: data
	}));
};
Element.prototype.onBusMessage = function(channel, message) {
	if (!message) return;
	try {
		message = JSON.parse(message);
	} catch (err) {
		console.error('BAD JSON', message);
		return;
	}
	console.log('BUSMESSAGE', this.id, message);
	var sender = message.cid;
	var clients = this.ws.cids[sender] || {};
	console.log('BUSMESSAGE', this.id, message, Object.keys(clients));
	for (var cid in clients) {
		var client = clients[cid];
		client.emit(message.type, message.data);
	}
};
Element.prototype.onMessage = function(message) {
	console.log('MESSAGE', this.clientId, message);
};

var stack = [
	Connect.favicon(),
	Connect.static(__dirname),
];

var e1 = new Element(stack);
e1.http.listen(3000);

'use strict';

var Redis = require('redis');
var Http = require('http');
var Ws = require('socket.io');

function Element() {
	var self = this;
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.subscribe('bus');
	this.sub.on('message', this.onBusMessage.bind(this));
	this.http = Http.createServer();
	this.on('request', this.onRequest);
	var ws = this.ws = Ws.listen(this.http, {
		transports: ['websocket', 'xhr-polling'],
		log: true
	});
	ws.cids = {};
	ws.on('connection', function(client) {
		var sid = client.sessionId;
		var cid = client.clientId = 'dvv';
		client.on('disconnect', function() {
			delete ws.cids[cid][sid];
		});
		!ws.cids[cid] && ws.cids[cid] = {};
		ws.cids[cid][sid] = client;
		self.pub.publish('bus', {
			msg: 'connection',
			cid: client.clientId,
			data: {
			}
		});
	});
}
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
	for (var cid in clients) {
		var client = clients[cid];
		client.emit('message', message.data);
	}
};
Element.prototype.onRequest = function(req, res) {
	console.log('REQUEST', req.url);
};
Element.prototype.onMessage = function(message) {
	console.log('MESSAGE', this.id, message);
};

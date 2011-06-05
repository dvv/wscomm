'use strict';

/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

var _ = require('underscore');
var Redis = require('redis');
var Ws = require('wscomm');

/**
 * Constructs new battery element
 *
 * @api public
 */

var Element = module.exports = function(httpServer) {

	var element = this;

	// persistence
	var db = this.db = Redis.createClient();

	// socket.io server
	this.http = httpServer;
	var ws = this.ws = Ws.listen(this.http, {
		transports: ['websocket', 'xhr-polling'],
		log: false
	});
	// assign unique id
	ws.id = Ws.nonce();
	// on new connection...
	ws.on('clientConnect', function(client) {
		// determine client id from the session
		//console.log('SESS', client.listener.req.session);
		// TODO: from session!
		var cid = client.clientId = 'dvv';
		// fetch initial context
		db.get('c:' + cid, function(err, result) {
			if (result) result = Ws.decode(result);
			_.extend(result, {
				post: function(str) {
					console.error('POST', str, this);
					//this.fn('PONG', str);
					//client.rpc('fn', 'PONG', str);
					ws.invoke('dvv', 'fn', 'PONG', str);
				}
			});
			client.update(result, {ready: true});
			// notify neighbors
			///element.broadcast({cmd: 'entered'}, client);
		});
	});
	// replace message handler
	ws.removeAllListeners('clientMessage');
	// process client messages
	ws.on('clientMessage', function(message, client) {
		client.handleMessage(message);
		if (message.cmd === 'update') {
			// persist context
			db.set('c:' + client.clientId, Ws.encode(client.context, true), function(err, result) {
				// notify neighbors
console.error('SAVEFROM', client.sessionId, client.context);
				element.broadcast(message, client);
			});
		}
	});
	// on connection closed...
	ws.on('clientDisconnect', function(client) {
		// notify neighbors
		///element.broadcast({cmd: 'left'}, client);
	});
	// upgrade `invoke` method to support broadcasting
	// N.B. this makes impossible to filter clients by filtering functions
	ws.localInvoke = ws.invoke;
	ws.invoke = function() {
		element.broadcast({cmd: 'invoke', params: Array.prototype.slice.call(arguments)});
	};

	// pub/sub network
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.psubscribe('*');
	// on pub/sub message...
	this.sub.on('pmessage', function(pattern, channel, message) {
		message = JSON.parse(message);
		if (channel === 'battery') {
			element.onBroadcast(message);
		}
	});

};

/**
 * Broadcasts message to all battery elements
 *
 * @api private
 */

Element.prototype.broadcast = function(message, client) {

	// publish to broadcast channel
	this.pub.publish('battery', JSON.stringify({
		// element id
		eid: this.id,
		// client id
		cid: client && client.clientId,
		// client session id
		sid: client && client.sessionId,
		// payload, usually initial message
		message: message
	}));

};

/**
 * Handles broadcast message
 *
 * @api private
 */

Element.prototype.onBroadcast = function(data) {

data.rid = this.id;
console.error('BCASTED', data);

	var clients = this.ws.clients;

	// unpack original message
	var message = data.message;
	// unpack original client id
	var cid = data.cid;
	// unpack original client session id
	var sid = data.sid;

	// spread updates
	if (message.cmd === 'update') {
		// for every client of this element...
		for (var i in clients) {
			var client = clients[i];
			// if client id equals original client id and
			// client session id doesn't equal original client session id
			if (client.clientId === cid && client.sessionId !== sid) {
				// execute client message handler
				client.handleMessage(message);
			}
		}
	// spread invocation
	} else if (message.cmd === 'invoke') {
		this.ws.localInvoke.apply(this.ws, message.params);
	}

};

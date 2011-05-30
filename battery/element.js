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
			client.update(result, {ready: true});
			// notify neighbors
			element.broadcast({cmd: 'entered'}, client);
		});
	});
	// replace message handler
	ws.removeAllListeners('clientMessage');
	// broadcast all client messages
	ws.on('clientMessage', element.broadcast.bind(element));
	// on connection closed...
	ws.on('clientDisconnect', function(client) {
		// notify neighbors
		element.broadcast({cmd: 'left'}, client);
	});

	// pub/sub network
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.psubscribe('*');
	// on pub/sub message...
	this.sub.on('pmessage', function(pattern, channel, message) {
		message = Bison.decode(message);
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
	this.pub.publish('battery', Bison.encode({
		// element id
		eid: this.id,
		// client id
		cid: client.clientId,
		// client session id
		sid: client.sessionId,
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

//data.rid = this.id;
//console.error('BCASTED', data);

	// unpack original message
	var message = data.message;
	// unpack original client id
	var cid = data.cid;
	// unpack original client session id
	var sid = data.sid;

	// for every client of current element...
	var clients = this.ws.clients;
	for (var i in clients) {
		var client = clients[i];
		// if client id equals original client id...
		if (client.clientId === cid) {
			// execute client message handler
			client.handleMessage(message);
			// if context changed and client session id
			// equals original client session id...
			if (message.cmd === 'update' && client.sessionId === sid) {
				// persist the context
//console.error('SAVE', sid, client.context);
				// persist context
				this.db.set('c:' + cid, Ws.encode(client.context, true), function(err, result) {
					// context saved
					// ...
				});
			}
		}
	}

};

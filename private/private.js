'use strict';

var _ = require('underscore');
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


var IO = require('socket.io');
require('./ws-patch');
var Redis = require('redis');
var Backbone = require('backbone');
var Capsule = require('capsule');

/**
 * well-known useful functions
 */

var slice = Array.prototype.slice;
var push = Array.prototype.push;
var hasOwn = Object.prototype.hasOwnProperty;

//
// safely determine whether `prop` is an own property of `obj`
//
function has(obj, prop) {
	return hasOwn.call(obj, prop);
}

//
// determine loosely if obj is callable
//
function callable(obj) {
	// N.B. RegExp in V8 is also of type function,
	// however we can punt on this
	return typeof obj === 'function'; // && obj.call;
}

//
// simple nonce generator
//
function rnd() {
	return Math.floor(Math.random() * 1e9).toString(36);
}
function nonce() {
	return (Date.now() & 0x7fff).toString(36) + rnd() + rnd() + rnd();
}

//
// safely get a deep property of `obj` descending using elements
// in `path`
//
function drill(obj, path) {
	var part;
	if (_.isArray(path)) {
		for (var i = 0, l = path.length; i < l; i++) {
			part = path[i];
			obj = obj && has(obj, part) && obj[part] || null;
		}
		return obj;
	} else if (path == null) {
		return obj;
	} else {
		return obj && has(obj, path) && obj[path] || null;
	}
}

//
// invoke deep method of `this` identified by `path` with
// optional parameters
//
function caller(path) {
	var fn = drill(this, path);
	callable(fn) && fn.apply(this, slice.call(arguments, 1));
}

//
// invoke `caller` for each element of `list` filtered with `filter`
//
function invoke(list, filter, path) {
	var args = slice.call(arguments, 2);
	// filter the list if the filtering function is given
	if (callable(filter)) {
		list = _.filter(list, filter);
	// if `filter` is array, use it as list
	} else if (_.isArray(filter)) {
		list = filter;
	// else make list from `filter`
	} else if (Object(filter) === filter) {
		list = [filter];
	}
	// return the filtered list unless arguments to make call are given
	if (!args.length) return list;
	// for each item in list perform RPC call
	_.each(list, function(item) {
		// FIXME: pluck for context first?
		item.context.rpc.apply(item.context, args);
	});
}

var Model = require('./model');

/**
 * WebSocket server prototype
 */

var Private = Backbone.Model.extend({

	/**
	 * Prototype methods
	 */

	initialize: function(middleware, options) {

		// cache this
		var node = this;

		// default options
		if (!options) options = {};
		_.defaults(options, {
		});
		this.options = options;

		// HTTP
		this.http = Connect.apply(null, middleware);

		// WebSocket
		this.ws = IO.listen(this.http, {
			transports: ['websocket', 'xhr-polling'],
			log: false
		});

		// new client connection
		this.ws.on('connection', _.bind(this.onConnection, this));
		this.ws.__defineGetter__('ws', function() {
			return _.toArray(this.clients);
		});
		this.ws.__defineGetter__('app', function() {
			return this.ws[0].app;
		});

		// persistence and broadcasting
		this.db = this.pub = Redis.createClient();

		// listen to broadcast messages
		this.sub = Redis.createClient();
		this.sub.subscribe('bcast');
		// N.B. we bind so that to have this node as `this` in the handler
		this.sub.on('message', _.bind(this.onBroadcast, this));

	},

	/**
	 * Handle client connection
	 */

	onConnection: function(client) {

		var app;

		function sendClientChanges(changes) {
			client.send(changes);
		}

		client.on('disconnect', function() {
			if (app) app.unbind('publish', sendClientChanges);
		});

		client.on('message', function(message) {
			var model, collection;

			console.log('MESSAGE', message);

			switch (message.event) {

			case 'session':

				// get session
				var sid = client.listener.req.headers.cookie;
				sid = sid && sid.match(new RegExp('(?:^|;) *' +
					//this.options.session.session_key + '=([^;]*)'));
					sessionOptions.session_key + '=([^;]*)'));
				sid = sid && sid[1];
				// deserialize cookie manually to extract `user.id` key
				if (sid) try {
					//client.session = Cookie.deserialize(
					//	this.options.session.secret, this.options.session.timeout, sid);
					client.session = Cookie.deserialize(
						sessionOptions.secret, sessionOptions.timeout, sid);
					// extract client id from the session
					client.clientId = client.session.user.id;
					console.log('SESSION', client.session);
				} catch (err) {
					console.log('NO SESSION', err.stack);
				}

				app = client.app = new Model.AppModel({
				});
				app.socket = client;

				// send initial context
				client.send({
					event: 'initial',
					app: app.xport()
				});

				// bind to the root `publish` events to send any changes to this client
				app.bind('publish', sendClientChanges);
				break;

			case 'set':
				app.modelGetter(message.id).set(message.change);
				break;

			case 'delete':
				model = app.modelGetter(message.id);
				if (model && model.collection) model.collection.remove(model);
				break;

			case 'add':
				collection = app.modelGetter(message.id);
				if (collection) collection.add(message.data);
				break;

			}

		});

	},

	/**
	 * Invoke method found at `path` with `args`
	 */

	invoke: function(path, args) {

		//console.log('INVOKING', arguments);
		this.pub.publish('bcast', Private.encode({
			cmd: 'invoke',
			args: slice.call(arguments)
		}));

	},

	/**
	 * Handle invocation message, sent by `Private::invoke()`
	 */

	onBroadcast: function(pattern, message) {

		//console.log('BCASTEDMESSAGE', arguments);
		if (!message) return;
		message = Private.decode(message);

		if (message.cmd === 'invoke') {
			// FIXME: null means all clients. howto use filters?
			var args = [this.ws.clients, null];
			push.apply(args, message.args);
			invoke.apply(this.ws, args);
		}

	}

/**
 * Class methods
 */

}, {

	encode: function(obj) {

		try {
			var str = JSON.stringify(obj);
		} catch(err) {
			// ...silently fail
			str = '';
		}
		return str;

	},

	decode: function(str) {

		// JSON.parse can throw...
		try {
			var obj = JSON.parse(str);
		} catch(err) {
			// ...silently fail
			obj = {};
		}
		return obj;

	}

});

/**
 * Expose interface
 */

exports = module.exports = Private;

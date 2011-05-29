
/*!
 *
 * WebSocket context
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

//
// N.B. depends on underscore.js to normalize client side JS engines.
// we recommend you to look at ender.js to pack microlibs
//

(function(_, Context, undefined) {
'use strict';

//
// in browser?
//
var CLIENT_SIDE = typeof window !== 'undefined';

//
// upgrade socket prototype to support functions calls over the wire
// and state exchange between the two sides
//

var SocketProto = CLIENT_SIDE ?
	io.Socket.prototype :
	require('socket.io/lib/socket.io/client').prototype;

//
// invoke a remote function by `path`
//
SocketProto.rpc = function(path /*, args...*/) {
	// do the call
	var msg = {
		cmd: 'call',
		params: slice.call(arguments)
	};
	this.send(msg);
};

//
// socket message arrived
//
SocketProto.onMessage = function(message) {
	if (!message) return;
	var self = this;
	console.log('MESSAGE', message);
	var fn;
	// remote side calls this side method
	if (message.cmd === 'call') {
		// do call the method, if it's a callable indeed
		this.context.invoke.apply(this.context, message.params);
	// remote context has changed
	} else if (message.cmd === 'context' && CLIENT_SIDE) {
		var changes = message.params[0];
		var options = message.params[1] || {};
		// revive functions from THIS_IS_FUNC signatures
		Context.reviveFunctions(changes, function(path) {
			return _.bind(self.rpc, self, path);
		});
		// update the context
		this.context.update(changes, options);
		// remote context first initialized?
		options.ready && this.context.emit('ready', this);
	}
};

//
// setup websocket communication
//

if (CLIENT_SIDE) {

	//
	// browser
	//

	// N.B. we export constructor, not singleton,
	// to allow having multiple instances

	var WSComm = function(host, options) {
		// set default options
		if (!options) options = {};
		_.defaults(options, {
			// N.B. bundlers may use RegExp("location['p'+'ort']") as anchor
			// to supply custom hardcoded port inplace
			port: location['p'+'ort'],
			secure: location.protocol === 'https:',
			transports: ['websocket', 'xhr-polling'],
			rememberTransport: false
		});
		// create socket
		var socket = new io.Socket(host, options);
		// attach message handlers
		socket.on('message', socket.onMessage);
		// create shared context
		// TODO: pass initial context?
		var context = new Context();
		// make connection. upon connection, context will emit 'ready' event
		socket.connect();
		// return the context
		return context;
	};

	// ender.js shim
	if (typeof module !== 'undefined' && module.exports) {
		module.exports.WSComm = WSComm;
	// or poison the global
	} else {
		window.WSComm = WSComm;
	}

} else {

	//
	// server
	//

	// TODO: move out to a separate file!

	//var IO = require('Socket.IO-node'); // upcoming 0.7.0
	var IO = require('socket.io');

	var ListenerProto =
		require('socket.io/lib/socket.io/listener').prototype;

	var older = IO.version.substring(0,3) === '0.6';
	// patch older socket.io
	if (older) {
		(function() {
			// patch listener to always provide request object
			var onConnection = ListenerProto._onConnection;
			ListenerProto._onConnection =
				function(transport, req, res, httpUpgrade, head) {
					// memo the request
					this.req = req;
					onConnection.apply(this, arguments);
				};
		})();
	}

	//
	// invoke callable at `path` for each client of `this` socket
	// which passed `filter` test
	//
	ListenerProto.invoke = function(filter, path) {
		var list = this.clients;
		var args = slice.call(arguments, 1);
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
			item.rpc.apply(item, args);
		});
	};

	// debugging only
	ListenerProto.__defineGetter__('ctx', function() {return _.toArray(this.clients)[0].context;});

	var listen = function(server, options) {

		// set default options
		if (!options) options = {};
		_.defaults(options, {
			transports: ['websocket', 'xhr-polling']
		});

		// start websocket listener
		var ws = IO.listen(server, options);
		// on client connection...
		(older ? ws : ws.sockets).on('connection', function(client) {
			// initialize shared context
			client.createContext();
			// attach message handler
			client.on('message', client.onMessage);
			// the rest initialization is left for user code
		});

		// return the listener
		return older ? ws : ws.sockets;
	};

	// expose interface
	module.exports = {
		listen: listen
	};

}

//
// expose
//
if (typeof module !== 'undefined' && module.exports) {
	module.exports = WSComm;
} else {
	this.WSComm = WSComm;
}

}(
	typeof window !== 'undefined' ? this._ : require('underscore'),
	typeof window !== 'undefined' ? this.Context : require('./context')
);

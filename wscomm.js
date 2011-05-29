/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

//
// N.B. depends on underscore.js to normalize client side JS engines.
// we recommend you to look at ender.js to pack microlibs
//

(function(_, undefined) {
'use strict';

//
// well-known useful functions
//
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
function caller(path /*, args... */) {
	var fn = drill(this, path);
	callable(fn) && fn.apply(this, slice.call(arguments, 1));
}

//
// constant to denode in JSON that an object key is function
//
var THIS_IS_FUNC = '~-=(){}=-~';

//
// serialize an object.
// replace functions in `obj` with THIS_IS_FUNC signatures
//
function encode(obj, onlyVariables) {
	function replacer(k, v) {
		// vetoed properties no pasaran!
		if (v && v.veto) {
			v = undefined;
		} else if (callable(v) && !onlyVariables) {
			v = THIS_IS_FUNC;
		// raw remote functions no pasaran!
		} else if (v === THIS_IS_FUNC) {
			v = undefined;
		}
		return v;
	}
	// should circular dependency occur, send nothing.
	// FIXME: until socket.io has tunable parsers (we opened the issue!)
	// even if we JSON.decycle(obj), the remote end won't parse ok
	// FIXME: until socket.io has tunable stringifier
	// we must workaround it
	try {
		var str = JSON.stringify(obj, replacer);
	} catch(err) {
		// ...silently fail
		str = '{}';
	}
	return str;
}

//
// deserialize a string to the object.
//
function decode(str) {
	// JSON.parse can throw...
	try {
		var obj = JSON.parse(str);
	} catch(err) {
		obj = {};
	}
	return obj;
}

//
// shared context prototype. should provide on/un/emit/update
// N.B. anything put in prototype won't be shared with remote end.
function Context() {}
// eventing, stolen deliberately from Backbone :)
// TODO: inhibit syncing of underscored properties?
Context.prototype.on = function(ev, callback) {
	var calls = this._callbacks || (this._callbacks = {veto: true});
	var list  = this._callbacks[ev] || (this._callbacks[ev] = []);
	list.push(callback);
	return this;
};
Context.prototype.un = function(ev, callback) {
	var calls;
	if (!ev) {
		this._callbacks = {veto: true};
	} else if (calls = this._callbacks) {
		if (!callback) {
			calls[ev] = [];
		} else {
			var list = calls[ev];
			if (!list) return this;
			for (var i = 0, l = list.length; i < l; i++) {
				if (callback === list[i]) {
					list.splice(i, 1);
					break;
				}
			}
		}
	}
	return this;
};
Context.prototype.emit = function(ev) {
	var list, calls, i, l;
	if (!(calls = this._callbacks)) return this;
	if (list = calls[ev]) {
		for (i = 0, l = list.length; i < l; i++) {
			list[i].apply(this, Array.prototype.slice.call(arguments, 1));
		}
	}
	if (list = calls['all']) {
		for (i = 0, l = list.length; i < l; i++) {
			list[i].apply(this, arguments);
		}
	}
	return this;
};

Context.prototype.sync = function(changes, options) {
	if (!options) options = {};
	this.update(changes, options);
	// notify remote end that context has changed
	// send serialized context to the remote end
	var s = encode({
		cmd: 'context',
		// `reset` controls whether to send the whole context replacing
		// the current one
		// N.B. no changes means to force sending the whole context.
		// this allows to group changes in "package" and send them
		// in one go
		params: [changes && !options.reset ? changes : this, options]
	});
	// N.B. we have "insight" here of how socket.io serializes JSON ;)
	// FIXME: this should be fixed
	this.getSocket().send('~j~' + s);
	return this;
};

//
// update `this` with `changes` resetting it first
// if `options.reset` is truthy.
// if `options.send` is given send the changes to remote side
// TODO: this could be overridden to support custom context prototypes.
// Think of Backbone
//
Context.prototype.update = function(changes, options) {
	if (!options) options = {};
	var context = this;

//
// deeply extend the `dst` with properties of `src`.
// if a property of `src` is set to null then remove corresponding
// `dst` property.
// N.B. arrays are cloned
//
function extend(dst, src) {
	var changed = false;
	function _ext(dst, src) {
		if (!src) return dst;
		for (var prop in src) if (has(src, prop)) {
			var v = src[prop];
			var isValueArray = _.isArray(v);
			var d = dst[prop];
			// value is not ordinal?
			if (Object(v) === v) {
				// value is array?
				if (isValueArray) {
					// put its copy, not reference
					v = v.slice();
				// value is object?
				} else {
					// destination has no such property? create one
					if (!has(dst, prop)) dst[prop] = {};
				}
			}
			// value is ordinal. update property if value is actually new.
			// emit context's "change:<property>" event
			if (!_.isEqual(v, d) && !options.silent) {
				changed = true;
//console.log('CHEMIT', prop, v, d, dst);
				context.emit('change:' + prop, v, d, dst);
			}
			// destination is not ordinal?
			if (Object(d) === d && !isValueArray) {
				// recurse to merge
//console.log('RECURSE', _.extend({},d), _.extend({},v));
				_ext(d, v);
			// new value is undefined or null?
			} else if (v == null) {
				// remove the property
				delete dst[prop];
			} else {
				dst[prop] = v;
			}
		}
	}
	_ext(dst, src);
	// emit "change" event if anything has changed
	changed && context.emit('change', src);
}

	// N.B. do not overwrite `context`, only mangle! That's why
	// this way of purging old context
	if (options.reset) {
		// we don't remove (and change as well) vetoed properties
		/*for (var i in context) if (has(context, i)) {
			if (!context[i] || !context[i].veto) delete context[i];
		}*/
		for (var i in context) delete context[i];
	}
	// apply changes
	extend(context, changes);
	return this;
};

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
// revive functions from THIS_IS_FUNC signatures
//
SocketProto.reviveFunctions = function(obj) {
	var socket = this;
	function revive(obj, root) {
		// iterate over objects only
		if (obj !== Object(obj)) return;
		for (var prop in obj) if (has(obj, prop)) {
			// glue the path
			var path = root.concat([prop]);
			// "function" signature is met?
			if (obj[prop] === THIS_IS_FUNC) {
				// bind RPC caller
				obj[prop] = _.bind(socket.rpc, socket, path);
				// veto passing this function to remote side
				obj[prop].veto = true;
			// vanilla object
			} else {
				// recurse
				revive(obj[prop], path);
			}
		}
	}
	revive(obj, []);
};

//
// socket message arrived
//
SocketProto.onMessage = function(message) {
	if (!message) return;
	console.log('MESSAGE', message);
	var fn;
	// remote side calls this side method
	if (message.cmd === 'call') {
		// do call the method, if it's a callable indeed
		caller.apply(this.context, message.params);
	// remote context has changed
	} else if (message.cmd === 'context' && CLIENT_SIDE) {
		var changes = message.params[0];
		var options = message.params[1] || {};
		// revive functions from THIS_IS_FUNC signatures
		this.reviveFunctions(changes);
		// update the context
		this.context.update(changes, options);
		// remote context first initialized?
		options.ready && this.context.emit('ready', this);
	}
};

//
// create shared context using `this` socket as transport layer
// `context` is template initial object
// N.B. should be overridden
//
SocketProto.createContext = function() {
	// cache
	var socket = this;
	// create shared context
	this.context = new Context();
	this.context.getSocket = function() { return socket; };
	this.context.getSocket.veto = true;
	// export the context
	return this.context;
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
		var context = socket.createContext();
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
		listen: listen,
		nonce: nonce,
		encode: encode,
		decode: decode
	};

}

})(typeof window !== 'undefined' ? this._ : require('underscore'));

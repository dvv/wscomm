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
function invoke(path /*, args... */) {
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
	// N.B. should circular dependency occur, pretend obj is empty
	try {
		var str = JSON.stringify(obj, replacer);
	} catch(err) {
		// ...silently fail
		str = '{}';
	}
	return str;
}

//
// deserialize a string to the object
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
// update this object with `changes`, firing 'change' events.
// if `options.reset` is truthy, remove all properties first.
// if `options.silent` is truthy, inhibit firing 'change' events
//
SocketProto.update = function(changes, options) {
	if (!options) options = {};
	var self = this;
	var context = this.context;
	var changed = false;

	//
	// deeply extend the `dst` with properties of `src`.
	// if a property of `src` is set to null then remove
	// corresponding property from `dst`.
	// N.B. arrays are cloned
	//
	function extend(dst, src) {
		function _ext(dst, src, root) {
			if (Object(src) !== src) return dst;
			for (var prop in src) if (src.hasOwnProperty(prop)) {
				// compose the path to this property
				var path = root.concat([prop]);
				var v = src[prop];
				var isValueArray = _.isArray(v);
				var d = dst[prop];
				// value is not ordinal?
				if (Object(v) === v) {
					// value is array?
					if (isValueArray) {
						// ...put its copy, not reference
						v = v.slice();
					// value is object?
					} else {
						// destination has no such property?
						if (!dst.hasOwnProperty(prop)) {
							// ...create one
							dst[prop] = {};
						}
					}
				}
				// value and destination are null/undefined? just skip
				if (v == null && d == null) continue;
				// value is a THIS_IS_FUNC signature? make live function
				if (v === THIS_IS_FUNC) {
					// bind RPC caller
					v = _.bind(self.rpc, self, path);
					// veto passing this function to remote side
					v.veto = path;
				}
				// value is ordinal. update property if value is
				// actually new.
				// emit self's "change:<property>" event
				if (!_.isEqual(v, d) && !options.silent) {
					changed = true;
					// FIXME: whould not be needed in 0.7
					if (CLIENT_SIDE) {
						self.emit('change:' + prop, [v, d, dst]);
					} else {
						self.emit('change:' + prop, v, d, dst);
					}
				}
				// destination is not ordinal?
				if (Object(d) === d && !isValueArray) {
					// ...recurse to merge
					_ext(d, v, path);
				// new value is undefined or null?
				} else if (v == null) {
					// ...remove the property
					delete dst[prop];
				} else {
					dst[prop] = v;
				}
			}
		}
		_ext(dst, src, []);
		// emit "change" event if anything has changed
		if (CLIENT_SIDE) {
			changed && self.emit('change', [src, options]);
		} else {
			changed && self.emit('change', src, options);
		}
	}

	// purge old properties properties
	if (options.reset) {
		for (var i in context) delete context[i];
	}

	// apply changes
	extend(context, changes);

	// notify remote end that context has changed
	if (changed || options.send) {
		// `options.reset` means to send the whole context.
		// falsy changes means to send the whole context
		if (options.reset || !changes) changes = context;
		// send serialized context to the remote end.
		// serialize functions as well
		var s = encode({
			id: nonce(),
			cmd: 'update',
			//params: [changes, options]
			params: [changes, {reset: options.reset, silent: options.ready}]
		});
		// N.B. we have "insight" here of how socket.io serializes JSON ;)
		// FIXME: this should be fixed
console.error('SENDINGUPDATESTO', this.sessionId, s);
		this.send('~j~' + s);
	}

	// remote context first initialized?
	if (CLIENT_SIDE) {
		options.ready && this.emit('ready', [this]);
	} else {
		options.ready && this.emit('ready', this);
	}

	// allow for chaining
	return this;
};

//
// invoke a remote function by `path`
//
SocketProto.rpc = function(path /*, args...*/) {
	// do the call
	var msg = {
		cmd: 'call',
		params: slice.call(arguments)
	};
console.error('SENDINGTO', this.sessionId, msg);
	this.send(msg);
};

//
// socket message arrived
//
// N.B. this overrides original client-side handler
//
SocketProto.handleMessage = function(message) {
	if (!message) return;
console.error('MESSAGE', CLIENT_SIDE ? this.transport.sessionid : this.sessionId, message);
	// remote side calls this side method
	if (message.cmd === 'call') {
		// do call the method, if it's a callable indeed
		invoke.apply(this.context, message.params);
	// remote context has changed
	} else if (message.cmd === 'update') {
		this.update.apply(this, message.params);
	}
};

//
// create shared context using `this` socket as transport layer
//
SocketProto.createContext = function(constructor) {
	// create shared context
	this.context = new (constructor || Context)();
	return this.context;
};

//
// mark `this` socket as belonging to named `groups`
//
SocketProto.enter = function(groups) {
	var sid = this.sessionId;
	var g = this.listener.groups;
	_.each(groups, function(group) {
		if (!g[group]) g[group] = {};
		g[group][sid] = this;
	}, this);
};

//
// mark `this` socket as not belonging to named `groups`
//
SocketProto.leave = function(groups) {
	var sid = this.sessionId;
	var g = this.listener.groups;
	_.each(groups, function(group) {
		if (g[group]) delete g[group][sid];
	});
};

//
// default shared context prototype.
// N.B. anything put in prototype won't be shared with remote end.
function Context() {}

//
// setup websocket communication
//

if (CLIENT_SIDE) {

	//
	// browser
	//

if (false) {
	// patch inconsistent client-side event emitter
	// FIXME: won't be needed in 0.7
	var _emit = SocketProto.emit;
	SocketProto.emit = function(name /*, args... */) {
		_emit.call(this, name, slice.call(arguments, 1));
	};
}

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
		// attach message handler
		socket.on('message', socket.handleMessage);
		// create shared context
		var context = socket.createContext(options.proto);
		// make connection.
		// upon connection, context will emit 'ready' event
		socket.connect();
		// return the context
		// FIXME: if we return context, we loose .update()
		//return context;
		return socket;
	};

	// ender.js shim
	if (typeof module !== 'undefined' && module.exports) {
		module.exports.WSComm = WSComm;
	// or poison the global
	} else {
		this.WSComm = WSComm;
	}

} else {

	//
	// server
	//

	var IO = require('socket.io');
	require('./ws-patch');

var ListenerProto =
	require('socket.io/lib/socket.io/listener').prototype;

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
	// else treat `filter` as group name
	} else if (typeof filter === 'string') {
		list = this.groups[filter];
	}
	// return the filtered list unless arguments to make call are given
	if (!args.length) return list;
	// for each item in list perform RPC call
	_.each(list, function(item) {
		item.rpc.apply(item, args);
	});
};

	var listen = function(server, options) {

		// set default options
		if (!options) options = {};
		_.defaults(options, {
			transports: ['websocket', 'xhr-polling']
		});

		// start websocket listener
		var ws = IO.listen(server, options);
		ws.groups = {};
		// level ground logic
		ws
		.on('clientConnect', function(client) {
			// initialize shared context
			client.createContext(options.proto);
			// populate groups
			client.enter(client.context.groups);
		})
		.on('clientMessage', function(message, client) {
			client.handleMessage(message);
		})
		.on('clientDisconnect', function(client) {
			// depopulate groups
			client.leave(client.context.groups);
			// flush shared context
			delete client.context;
		});

		// N.B. the rest of logic is left for user code.
		// just add another listeners!

		// return the listener
		return ws;
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

/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

(function(io, undefined) {
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
// call `iterator` bound to `context` for each element in `obj`
//
function each(obj, iterator, context) {
	if (obj == null) return;
	if (Array.isArray(obj)) {
		obj.forEach(iterator, context);
	} else {
		for (var key in obj) {
			if (has(obj, key)) {
				iterator.call(context, obj[key], key, obj);
			}
		}
	}
}

//
// copies properties of `additional` to `target`
//
function extend(target, additional) {
	for (var key in additional) {
		if (has(additional, key)) {
			target[key] = additional[key];
		}
	}
	return target;
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
// debugging helper
//
function dump() {
	console.log('DUMP', arguments);
}

//
// safely get a deep property of `obj` descending using elements
// in `path`
//
function drill(obj, path) {
	var part;
	if (Array.isArray(path)) {
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
console.log('INVOKE', arguments);
	var fn = drill(this, path);
	callable(fn) && fn.apply(this, slice.call(arguments, 1));
}

//
// constant to denode in JSON that an object key is function
//
var THIS_IS_FUNC = '~-=(){}=-~';

//
// upgrade socket prototype to support functions calls over the wire
// and state exchange between the two sides
//

var SocketProto = io.Socket.prototype;

SocketProto.emitter = (this.of ? this.of('') : this).emit;

/***


***/

//
// update this object with `changes`, firing 'change' events.
// if `options.reset` is truthy, remove all properties first.
// if `options.silent` is truthy, inhibit firing 'change' events
//
SocketProto.update = function(changes, options, callback) {
console.log('INUPDATE', arguments);
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
				var isValueArray = Array.isArray(v);
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
					v = self.emitter.bind(self, 'invoke', path);
					// veto passing this function to remote side
					v.veto = path;
				}
				// value is ordinal. update property if value is
				// actually new.
				// emit self's "change:<property>" event
				// FIXME: mimick!
				if (/*!_.isEqual(v, d) &&*/ !options.silent) {
					changed = true;
					self.emit('change:' + prop, v, d, dst);
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
		changed && self.emit('change', src, options);
	}

	// purge old properties properties
	if (options.reset) {
		for (var i in context) delete context[i];
	}

	// apply changes
	extend(context, changes);
console.log('EXTENDED', context, changes);

	// notify remote end that context has changed
	if (changed || options.send) {
		// `options.reset` means to send the whole context.
		// falsy changes means to send the whole context
		if (options.reset || !changes) changes = context;
		// send serialized context to the remote end.
		// serialize functions as well
		// FIXME: functions not serialized!!!
console.log('EMITTING UPDATE', changes, {
			reset: options.reset,
			silent: options.ready
		});
		this.emitter('update', changes, {
			reset: options.reset,
			silent: options.ready
		});
	}

	// remote context first initialized?
	options.ready && this.emit('ready', this);

	// continue
	callable(callback) && callback();

	// allow for chaining
	return this;
};

//
// invoke a remote function by `path`
//
SocketProto.rpc = function(path /*, args...*/) {
	this.emitter('invoke', slice.call(arguments));
};

//
// update event arrived
//
SocketProto.onUpdate = function(changes, options, callback) {
console.error('ONUPDATE', this.id, changes, options);
	this.update.apply(this, arguments);
};

//
// invoke event arrived
//
SocketProto.onInvoke = function(args) {
console.error('ONINVOKE', this.id, args);
	invoke.apply(this.context, args);
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
// default shared context prototype.
// N.B. anything put in prototype won't be shared with remote end.
function Context() {
	this.test = dump;
	this.func = THIS_IS_FUNC;
}

//
// setup websocket communication
//

if (!io.Manager) {

	//
	// browser
	//

	// N.B. we export constructor, not singleton,
	// to allow having multiple instances

	io.WSComm = function(options) {
		// set default options
		options = extend({
			host: location.hostname,
			port: location.port,
			secure: location.protocol === 'https:',
			transports: ['websocket', 'xhr-polling'],
			'auto connect': false,
			reconnect: false
		}, options || {});
		// create socket
		var socket = new io.Socket(options);
		// attach event handlers
		socket.on('update', SocketProto.onUpdate);
		socket.on('invoke', SocketProto.onInvoke);
		socket.on('change', dump);
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

} else {

	//
	// server
	//

/// ///////////////////////////////////////
///
//
// invoke callable at `path` for each client of `this` socket
// which passed `filter` test
//
io.Manager.prototype.invoke = function(filter, path) {
	var list = this.clients;
	var args = slice.call(arguments, 1);
	// filter the list if the filtering function is given
	if (callable(filter)) {
		list = list.filter(filter);
	// if `filter` is array, use it as list
	} else if (Array.isArray(filter)) {
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
	each(list, function(item) {
		item.rpc.apply(item, args);
	});
};
///
/// ///////////////////////////////////////

	io.WSComm = function(server, options) {

		// set default options
		options = extend({
			transports: ['websocket']
		}, options || {});

		// start websocket listener
		var ws = io.listen(server);
		extend(ws.settings, options);
		ws.groups = {};

		// level ground logic
		ws.sockets.on('connection', function(client) {
			// initialize shared context
			client.createContext(options.proto);
			// enter rooms
			///client.join(client.context.groups);
			client.on('update', SocketProto.onUpdate);
			client.on('invoke', SocketProto.onInvoke);
			client.on('change', dump);
			client.on('disconnect', function() {
				// leave rooms
				///client.leave(client.context.groups);
				// flush shared context
				delete client.context;
			});
		});

		// N.B. the rest of logic is left for user code.
		// just add another listeners!

		// return the listener
		return ws;
	};

	//
	// expose socket.io
	//
	module.exports = io;

}

})(typeof window !== 'undefined' ? window.io : require('socket.io'));

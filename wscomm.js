'use strict';

/*
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

//
// in browser?
//
var CLIENT_SIDE = typeof window !== 'undefined';

//
// well-known useful functions
//
var slice = Array.prototype.slice;
var push = Array.prototype.push;

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
// safely determine whether `prop` is an own property of `obj`
//
function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
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
	_.isFunction(fn) && fn.apply(this, slice.call(arguments, 1));
}

//
// invoke `caller` for each element of `list` filtered with `filter`
//
function invoke(list, filter, path) {
	var args = slice.call(arguments, 2);
	// filter the list if the filtering function is given
	if (_.isFunction(filter)) list = _.filter(list, filter);
	// return the filtered list unless arguments to make call are given
	if (!args.length) return list;
	_.each(list, function(item) {
		//caller.apply(item.context, args);
		// FIXME: pluck for context first?
		item.context.rpc.apply(item.context, args);
	});
}

//
// upgrade `this` socket to support functions calls over the wire
// and state exchange between the two sides
//
function createContext() {

	// cache
	var socket = this;
	var options = this.listener ? this.listener.options : this.options;

	// constants
	var THIS_IS_FUNC = '~-=(){}=-~';
	var THIS_IS_FUNC_LEN = THIS_IS_FUNC.length;

	// shared context prototype
	function Context() {};
	// N.B. anything put in prototype won't be shared with remote end.
	// extend shared context
	Context.prototype.extend = function(changes, reset) {
		socket.update(changes, reset, true);
	};
	// called at client-side when server-side sets the context
	Context.prototype.ready = options.ready;
	// called before change occurs in to property.
	// signature is function(prop, oldvalue, newvalue).
	// return something other than undefined to inhibit assigning to
	// the `prop`
	Context.prototype.change = options.change;
	// called before updating the shared context.
	// return value other than undefined means validation is rejected
	Context.prototype.validate = function(changes, reset) {
		if (_.isFunction(changes)) {
			this.constructor.prototype.validate = changes;
			return;
		}
		return undefined;
	};
	// invoke a remote function by `path`
	Context.prototype.rpc = function(path, callback /*, args...*/) {
		var args = slice.call(arguments, 1);
		// register callback, if any
		if (_.isFunction(callback)) {
			// consume `callback` argument
			args.shift();
			// N.B. callbacks are deleted once they are fired.
			// unless a callback is fired, it holds the memory.
			// we should introduce expiration for callbacks
			var id = nonce();
			socket.cbs[id] = callback;
		}
		// RPC
		var msg = {cmd: 'call', id: id, method: path, params: args};
		socket.send(msg);
	};
	// client-side only methods
	if (CLIENT_SIDE) {
		// softly disconnect to allow reconnection
		Context.prototype.reconnect = function() {
			socket.disconnect(true);
		};
	}

	// create shared context
	this.context = new Context();
	// callbacks
	this.cbs = {};

	//
	// serialize an object.
	// replace functions in `obj` with THIS_IS_FUNC signatures
	//
	this.encode = function(obj, onlyVariables) {
		var self = this;
		function replacer(k, v) {
			// N.B. live remote functions no pasaran!
			if (_.isFunction(v) && !v.live) {
				v = THIS_IS_FUNC;
			}
			if (onlyVariables && v === THIS_IS_FUNC) v = undefined;
			return v;
		}
		// should circular dependency occur, send nothing.
		// FIXME: until socket.io has tunable parsers (we opened the issue!)
		// even if we JSON.decycle(obj), the remote end won't parse ok
		// FIXME: until socket.io has tunable stringifier
		// we must workaround it
		try {
			var s = JSON.stringify(obj, replacer);
		} catch(err) {
			// ...silently fail
			s = '';
		}
		return s;
	}

	//
	// deserialize a string to the object.
	// replace THIS_IS_FUNC signatures with functions
	//
	this.decode = function(str) {
		var obj = JSON.parse(str);
		if (options.liveFunctions) {
			this.parseWithFunctions(obj);
		}
		return obj;
	};

	//
	// revive functions from THIS_IS_FUNC signatures
	//
	this.parseWithFunctions = function(obj) {
		var context = this.context;
		function revive(obj, root) {
			// iterate over objects only
			if (obj !== Object(obj)) return;
			for (var prop in obj) if (has(obj, prop)) {
				// glue the path
				var path = root.concat([prop]);
				// "function" signature is met?
				if (obj[prop] === THIS_IS_FUNC) {
					// bind RPC caller
					obj[prop] = _.bind(context.rpc, context, path);
					// mark function as live remote function
					obj[prop].live = true;
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
	// deeply extend the `dst` with properties of `src`.
	// if a property of `src` is set to null then remove corresponding
	// `dst` property.
	// N.B. arrays are cloned
	//
	function extend(dst, src) {
		if (!src) return dst;
		for (var prop in src) if (has(src, prop)) {
			var v = src[prop];
			var d = dst[prop];
			// value is not ordinal?
			if (Object(v) === v) {
				// value is array?
				if (Array.isArray(v)) {
					// put its copy, not reference
					dst[prop] = v.slice();
					continue;
				// value is object?
				} else {
					// destination has no such property? create one
					if (!has(dst, prop)) dst[prop] = {};
					// destination has such property and it's not ordinal?
					if (Object(d) === d) {
						// recurse to merge
						extend(d, v);
						continue;
					}
				}
			}
			// value is ordinal.
			// first validate the supposed change
			if (_.isFunction(socket.context.change) &&
				// if `change` function returns something then inhibit
				// the property assignment
				socket.context.change(prop, v, d) !== undefined)
				continue;
			// new value is undefined or null?
			if (v == null) {
				// remove the property
				delete dst[prop];
			} else {
				dst[prop] = v;
			}
		}
		return dst;
	}

	//
	// update the context
	//
	this.update = function(changes, reset, send) {
		var context = this.context;
		// validate the changes
		// FIXME: should validate _the resulting context_, not changes
		/*
		var errors = context.validate(changes, reset);
		if (errors !== undefined) {
			// N.B. exceptions are evil in async environment
			return new Error('Changes not passed validation: ' + errors);
		}
		*/
		// N.B. do not overwrite `context`, only mangle! That's why
		// this way of purging old context
		if (reset) {
			// N.B. we don't care of filtering own properties, because
			// critical methods live in prototype!
			for (var i in context) delete context[i];
		}
		extend(context, changes);
		// notify remote end that context has changed
		if (send) {
			// persist changes
			if (_.isFunction(options.save)) {
				options.save.call(this);
			}
			// send serialized context to the remote end
			var s = this.encode({
				cmd: 'context',
				// N.B. no changes means to force sending the whole context.
				// this allows to group changes in "package" and send them
				// in one go
				params: reset || !changes ? [context, true] : [changes]
			});
			this.send('~j~' + s);
		}
	};

	//
	// send the reply to remote side. it will result in calling the
	// callback associated with this message `id`, at the remote side
	//
	function reply(id /*, args... */) {
		// nothing to do unless `id` is set
		if (!id) return;
		var args = slice.call(arguments, 1);
		this.send({cmd: 'reply', id: id, params: args});
	};

	//
	// attach message handler
	//
	this.on('message', function(message) {
		if (!message) return;
		//console.log('MESSAGE', message);
		var fn;
		// remote side calls this side method
		if (message.cmd === 'call' &&
			(fn = drill(this.context, message.method))) {
			// the signature of remotely callable method is
			// function(callback[, arg1[, arg2[, ...]]]). so we always place
			// a callback stub to fit the signature
			var args = [_.bind(reply, this, message.id)];
			// optional arguments come from message.params
			if (message.params) {
				push.apply(args, message.params);
			}
			// non-revived remote functions is wrapped by rpc helper.
			// FIXME: decision is welcome whether functions defined at remote
			// side can be called by that remote side per se?!
			// Talking to NowJS people revealed it's quite welcome
			if (fn === THIS_IS_FUNC) {
				args.unshift(message.method);
				fn = this.context.rpc;
			}
			// do call the method, if it's a function indeed
			if (_.isFunction(fn)) {
				fn.apply(this.context, args);
			}
		// uniquely identified reply from the remote side arrived.
		// given reply id, lookup and call corresponding callback
		} else if (message.cmd === 'reply' && message.id &&
			(fn = this.cbs[message.id])) {
			// remove the callback to please GC
			delete this.cbs[message.id];
			// callback
			fn.apply(this.context, message.params);
		// remote context has changed
		} else if (message.cmd === 'context') {
			// optionally make remote functions real live functions
			if (options.liveFunctions) {
				this.parseWithFunctions(message.params[0]);
			}
			this.update.apply(this, message.params);
			// fire 'ready' callback
			if (CLIENT_SIDE) {
				_.isFunction(this.context.ready) &&
					this.context.ready.call(this, message.params[1]);
			// persist the context
			} else {
				// TODO: !
			}
		}
	});

	//
	// handle disconnect and reconnect
	//
	this.on('disconnect', function() {
		// execute `options.onDisconnect` callback
		if (_.isFunction(options.onDisconnect)) {
			options.onDisconnect.call(this);
		}
	});
	this.on('reconnect', function() {
		// execute `options.onReconnect` callback
		if (_.isFunction(options.onReconnect)) {
			options.onReconnect.call(this);
		}
	});

	// export the context
	return this.context;
}

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
			port: location.port,
			secure: location.protocol === 'https:',
			transports: ['websocket', 'xhr-polling'],
			rememberTransport: false
		});
		// create socket
		var socket = new io.Socket(host, options);
		// upgrade socket to context
		var ctx = createContext.call(socket);
		// make connection
		socket.connect();
		// return context
		return ctx;
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

	var listen = function(server, options) {

		// set default options
		if (!options) options = {};
		_.defaults(options, {
			transports: ['websocket', 'xhr-polling']
		});

		var IO = require('socket.io');
		// patch listener to always provide request object
		var onConnection = IO.Listener.prototype._onConnection;
		IO.Listener.prototype._onConnection =
			function(transport, req, res, httpUpgrade, head) {
				// memo the request
				this.req = req;
				onConnection.apply(this, arguments);
			};
		// patch client session id generator
		if (options.generateSessionId) {
			var Client = require('socket.io/lib/socket.io/client');
			Client.prototype._generateSessionId = function() {
				var sid;
				// function is given? use return value
				if (_.isFunction(options.generateSessionId)) {
					sid = options.generateSessionId.call(this);
				// string is given? use as name of cookie,
				// whose value is session id
				} else {
					// we patched Listener.prototype._onConnection to always
					// have access to headers, particularly to Cookie:
					sid = this.listener.req.headers.cookie;
					sid = sid && sid.match(new RegExp('(?:^|;) *' +
						options.generateSessionId + '=([^;]*)'));
					sid = sid && sid[1];
				}
				this.sessionId = sid || nonce() + nonce() + nonce();
				console.log('SESSION', this.sessionId);
				return this;
			};
		}
		// start websocket listener
		var ws = IO.listen(server, options);

		// on client connection...
		ws.on('connection', function(socket) {
			// upgrade socket to context
			createContext.call(socket);
			// initialize the context
			_.isFunction(socket.listener.options.ready) &&
				socket.listener.options.ready.call(socket, true);
			// FIXME: this is _really_ too much for single server
			// and too few for multi-server.
			// kinda safer broadcaster is needed
			socket.invoke = ws.invoke;
		});

		// FIXME: purely debugging helpers
		//
		//
		Object.defineProperties(ws, {
			everyone: {
				get: function() {
					return _.toArray(this.clients);
				}
			},
			contexts: {
				get: function() {
					return _.reduce(this.clients, function(acc, item) {
						acc[item.sessionId] = item.context;
						return acc;
					}, {});
					//return _.pluck(this.everyone, 'context');
				}
			},
			fc: {
				get: function() {
					return this.everyone[0].context;
				}
			}
		});
		//
		//
		//

		// remote function invocation helper.
		// invoke(filterFunc, path-to-method, arg1, arg2, ...)
		ws.invoke = _.bind(invoke, ws, ws.clients);

		return ws;
	};

	module.exports = {
		listen: listen
	};

}

})(typeof window !== 'undefined' ? this._ : require('underscore'));

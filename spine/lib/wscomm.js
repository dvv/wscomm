/*!
 *
 * Shared context for socket.io
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

(function(io, undefined) {
'use strict';

//
// N.B. we rely on es5 features. es5-shim should be loaded for old
// browsers. TODO: provide bundled?
//

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
	// N.B. RegExp in V8 is also of type 'function'!
	return typeof obj === 'function' && obj.call;
}

//
// safely get a deep property of `obj` descending using elements
// in `path`
//
function get(obj, path) {
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
console.error('INVOKE', arguments);
	var fn = get(this, path);
	callable(fn) && fn.apply(this, slice.call(arguments, 1));
}

//
// perform a deep comparison to check if two objects are equal
//
// thanks developmentcloud/underscore
//
function deepEqual(a, b) {
	// check object identity
	if (a === b) return true;
	// different types?
	var atype = typeof a
	var btype = typeof b;
	if (atype !== btype) return false;
	// basic equality test (watch out for coercions)
	if (a == b) return true;
	// one is falsy and the other truthy
	if ((!a && b) || (a && !b)) return false;
	// check dates' integer values
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}
	// both are NaN?
	if (a !== a && b !== b) return false;
	// compare regular expressions
	if (a.source && b.source && a.test && b.test && a.exec && b.exec)
		return a.source === b.source &&
			a.global === b.global &&
			a.ignoreCase === b.ignoreCase &&
			a.multiline === b.multiline;
	// if a is not an object by this point, we can't handle it
	if (atype !== 'object') return false;
	// check for different array lengths before comparing contents
	if (a.length && (a.length !== b.length)) return false;
	// nothing else worked, deep compare the contents
	var aKeys = Object.keys(a)
	var bKeys = Object.keys(b);
	// different object sizes?
	if (aKeys.length != bKeys.length) return false;
	// recursive comparison of contents
	for (var key in a) {
		if (!(key in b) || !deepEqual(a[key], b[key])) return false;
	}
	// they are equal
	return true;
}

//
// constant to denote in JSON that an object key is function
//
var THIS_IS_FUNC = '~-=(){}=-~';

//
// upgrade io.Socket
//

var SocketProto = io.Socket.prototype;

//
// disambiguate event handling
//

SocketProto.emitRemote = function() {
	var obj = this.of ? this.of('') : this;
	obj.emit.apply(obj, arguments);
};

SocketProto.emitLocal = function() {
	var emit = this.of ? this.emit : this.$emit;
	emit.apply(this, arguments);
};

//
// create shared context
//

SocketProto.createContext = function(proto) {
	this.context = proto || {};
	// attach event handlers
	if (this.of) {
		this.of('').on('update', this.update.bind(this));
		this.of('').on('invoke', invoke.bind(this.context));
	} else {
		this.on('update', this.update);
		this.on('invoke', invoke.bind(this.context));
	}
	// provide shortcut functions
	this.invoke = this.emitRemote.bind(this, 'invoke');
};

//
// update `this.context` with `changes`.
// if `options.reset` is truthy, remove all properties first.
// if `options.silent` is truthy, inhibit firing 'change' event
//
SocketProto.update = function(changes, options, callback) {
console.error('UPDATE', arguments, this);

	if (!options) options = {};
	var self = this;
	var context = this.context;
	var achanges = [];
	var ochanges = {};

	//
	// deeply extend the `dst` with properties of `src`.
	// if a property of `src` is set to null then remove
	// corresponding property from `dst`.
	// N.B. arrays are cloned
	//
	function extend(dst, src) {
		function _ext(dst, src, root, ochanges) {
			if (Object(src) !== src) return dst;
			for (var prop in src) if (has(src, prop)) {
				// compose the path to this property
				var path = root.concat([prop]);
				// cache new value
				var v = src[prop];
				var isValueArray = Array.isArray(v);
				var isValueCallable = callable(v);
				// value is not ordinal?
				if (Object(v) === v) {
					// value is array?
					if (isValueArray) {
						// ...put its copy, not reference
						v = v.slice();
					// value is object?
					} else {
						// destination has no such property?
						if (!has(dst, prop)) {
							// ...create one
							dst[prop] = {};
						}
					}
				}
				var d = dst[prop];
				// value and destination are null/undefined? just skip
				if (v == null && d == null) continue;
				// recursion needed?
				if (Object(d) === d && !isValueArray && !isValueCallable) {
					// make room for real changes
					if (!has(ochanges, prop)) {
						var newly = true;
						ochanges[prop] = {};
					}
					_ext(d, v, path, ochanges[prop]);
					// if no real changes occured, drop corresponding key
					if (newly && !Object.keys(ochanges[prop]).length) {
						delete ochanges[prop];
					}
					/*var chg = {};
					_ext(d, v, path, chg);
					if (Object.keys(chg).length) ochanges[prop] = chg;*/
					continue;
				}
				// test if property is really to be changed
				if (deepEqual(v, d)) continue;
				// we are here iff property needs to be changed
				achanges.push([path, v]);
				// new value is undefined or null?
				if (v == null) {
					// ...remove the property
					delete dst[prop];
				} else {
					// update the property.
					// honor remote functions denoted as THIS_IS_FUNC signatures
					dst[prop] = v === THIS_IS_FUNC ?
						self.emitRemote.bind(self, 'invoke', path) :
						v;
					// callables go to remote side as THIS_IS_FUNC signatures
					// which we make live functions there (see above).
					// N.B. recovered functions don't go in changes
					if (v !== THIS_IS_FUNC) {
						ochanges[prop] = isValueCallable ? THIS_IS_FUNC : v;
					}
				}
			}
		}
		_ext(dst, src, [], ochanges);
	}

	// purge old properties properties
	if (options.reset) {
		for (var i in context) delete context[i];
	}
	// apply changes
	if (Array.isArray(changes)) {
		changes.forEach(function(c) {
			// N.B. c === `null` purges the current context
			if (c === null) {
				for (var i in context) delete context[i];
			}
			// N.B. false positives may occur in ochanges, since deepEqual()
			// tests the value of previous assignment step:
			// update([{a:1},{a:2},{a:1}]) will always report change to "a"
			extend(context, c);
		});
	} else {
		extend(context, changes);
	}
	// emit "change" event
	if (!options.silent && achanges.length) {
		console.log('CHANGED', achanges, ochanges, changes);
		this.emitLocal('change', achanges, ochanges);
		// notify remote end of actual changes
		if (Object.keys(ochanges).length) {
			this.emitRemote('update', ochanges, options, callback);
		} else if (callable(callback)) {
			callback(null, ochanges);
		}
	}

	// allow chaining
	return this;
};

//
// setup shared context
//

io.dump = function() {
	console.log('DUMP', arguments);
};

if (!io.Manager) {

	//
	// browser
	//

	// N.B. we export constructor, not singleton,
	// to allow having multiple instances

	io.Context = function(options) {
		// set default options
		options = extend({
			host: location.hostname,
			port: location.port,
			secure: location.protocol === 'https:',
			transports: ['websocket', 'xhr-polling'],
			//reconnect: false
		}, options || {});
		// create socket
		var client = new io.Socket(options);
		// create shared context
		client.createContext(options.context);
		return client;
	};

} else {

	//
	// server
	//

	io.Context = function(server, options) {

		// set default options
		options = extend({
			transports: ['websocket'] // N.B. others are incomplete so far
		}, options || {});

		// start manager
		var ws = io.listen(server);
		extend(ws.settings, options);

		// level ground logic
		ws.of('').on('connection', function(client) {
			// create shared context
			client.createContext(options.context);
			client.on('disconnect', function() {
				// flush shared context
				delete client.context;
			});
		});

		// N.B. the rest of logic is left to user code.
		// just add another event listeners!

		// return manager
		return ws;
	};

	//
	// expose socket.io
	//
	module.exports = io;

}

})(typeof window !== 'undefined' ? window.io : require('socket.io'));

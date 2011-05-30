
/*!
 *
 * Context class
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

!function(_, Base, undefined) {
'use strict';

//
// constant to denode in JSON that an object key is function
//
var THIS_IS_FUNC = '~-=(){}=-~';

var Context = Base.extend(function(initial, socket) {

console.error('CONTEXTINIT', initial);

	this.on('send', function(changes, options) {
		// send serialized context to the remote end
		var s = JSON.stringify({
			cmd: 'update',
			params: [changes, options]
		});
		// N.B. we have "insight" here of how socket.io serializes JSON ;)
		// FIXME: this should be fixed
		socket.send('~j~' + s);
	});
	this.on('all', function() {console.error('EVENT', socket.sessionId, arguments);});

}).statics({

	//
	// serialize an object, replacing own functions with
	// THIS_IS_FUNC signature
	//
	encode: function(obj, onlyVariables) {
		function replacer(k, v) {
			// vetoed properties no pasaran!
			if (v && v.veto) {
				v = undefined;
			} else if (_.isFunction(v) && !onlyVariables) {
				v = THIS_IS_FUNC;
			// raw remote functions no pasaran!
			} else if (v === THIS_IS_FUNC) {
				v = undefined;
			}
			return v;
		}
		// should circular dependency occur, pretend empty object
		try {
			var str = JSON.stringify(obj, replacer);
		} catch(err) {
			// ...silently fail
			str = '{}';
		}
		return str;
	},

	//
	// deserialize a string into the object
	//
	decode: function (str) {
		// JSON.parse can throw...
		try {
			var obj = JSON.parse(str);
		} catch(err) {
			obj = {};
		}
		return obj;
	},

	//
	// replace THIS_IS_FUNC signatures with live functions
	// using `binder`
	//
	reviveFunctions: function(obj, binder) {
		function revive(obj, root) {
			// iterate over objects only
			if (obj !== Object(obj)) return;
			for (var prop in obj) if (obj.hasOwnProperty(prop)) {
				// glue the path
				var path = root.concat([prop]);
				// "function" signature is met?
				if (obj[prop] === THIS_IS_FUNC) {
					// bind the caller
					obj[prop] = binder(path);
					// veto passing bound functions to remote side
					obj[prop].veto = true;
				// vanilla object
				} else {
					// recurse
					revive(obj[prop], path);
				}
			}
		}
		revive(obj, []);
	}

}).methods({

	/*_settings: {},
	_set: function(key, value) {
		this._settings[key] = value;
	},
	_get: function(key) {
		return this._settings[key];
	},*/

});

//
// expose
//
if (typeof module !== 'undefined' && module.exports) {
	module.exports = Context;
} else {
	this.Context = Context;
}

}(
	typeof window !== 'undefined' ? this._ : require('underscore'),
	typeof window !== 'undefined' ? this.Base : require('./base')
);

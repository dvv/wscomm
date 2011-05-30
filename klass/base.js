
/*!
 *
 * Base class
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

!function(_, klass, undefined) {
'use strict';

var Base = klass(function() {

	//
	// event callbacks
	//
	this._callbacks = {};

}).statics({

	//
	// safely get a deep property of `obj` descending using elements
	// in `path`
	//
	drill: function(obj, path) {
		var part;
		if (_.isArray(path)) {
			for (var i = 0, l = path.length; i < l; i++) {
				part = path[i];
				obj = obj && obj.hasOwnProperty(part)
					&& obj[part] || null;
			}
			return obj;
		} else if (path == null) {
			return obj;
		} else {
			return obj && obj.hasOwnProperty(path)
				&& obj[path] || null;
		}
	}

}).methods({

	//
	// add event handler
	//
	on: function(ev, callback) {
		var calls = this._callbacks;
		var list  = calls[ev] || (calls[ev] = []);
		list.push(callback);
		return this;
	},

	//
	// remove event handler
	//
	un: function(ev, callback) {
		var calls = this._callbacks;
		if (!ev) {
			for (var i in calls) delete calls[i];
		} else {
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
	},

	//
	// fire event
	//
	emit: function(ev /*, args... */) {
		var list, i, l;
		var calls = this._callbacks;
		if (list = calls[ev]) {
			for (i = 0, l = list.length; i < l; i++) {
				list[i].apply(this,
					Array.prototype.slice.call(arguments, 1));
			}
		}
		if (list = calls['all']) {
			for (i = 0, l = list.length; i < l; i++) {
				list[i].apply(this, arguments);
			}
		}
		return this;
	},

	//
	// update this object with `changes`, firing 'change' events.
	// if `options.reset` is truthy, remove all properties first.
	// if `options.silent` is truthy, inhibit firing 'change' events
	// if `options.send` is truthy, fire 'send' event afterwards
	//
	update: function(changes, options) {
		if (!options) options = {};
		var self = this;
		var changed = false;

		//
		// deeply extend the `dst` with properties of `src`.
		// if a property of `src` is set to null then remove
		// corresponding property from `dst`.
		// N.B. arrays are cloned
		//
		function extend(dst, src) {
			function _ext(dst, src) {
				if (Object(src) !== src) return dst;
				for (var prop in src) if (src.hasOwnProperty(prop)) {
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
					// value is ordinal. update property if value is
					// actually new.
					// emit self's "change:<property>" event
					if (!_.isEqual(v, d) && !options.silent) {
						changed = true;
						self.emit('change:' + prop, v, d, dst);
					}
					// destination is not ordinal?
					if (Object(d) === d && !isValueArray) {
						// ...recurse to merge
						_ext(d, v);
					// new value is undefined or null?
					} else if (v == null) {
						// ...remove the property
						delete dst[prop];
					} else {
						dst[prop] = v;
					}
				}
			}
			_ext(dst, src);
			// emit "change" event if anything has changed
			changed && self.emit('change', src, options);
		}

		// purge properties
		if (options.reset) {
			for (var i in this) delete this[i];
		}

		// apply changes
		extend(this, changes);

		// FIXME: consider moving to 'change' event
		// notify of changes.
		// `options.reset` means to send this whole object.
		// falsy changes means to send this whole object.
		if (changed) {// && options.send) {
			if (options.reset || !changes) changes = this;
			this.emit('send', changes, options);
		}

		// allow for chaining
		return this;
	},

	//
	// invoke this object's deep method identified by `path` with
	// optional parameters
	//
	invoke: function(path /*, args... */) {
		var fn = Base.drill(this, path);
		_.isFunction(fn) && fn.apply(this,
			Array.prototype.slice.call(arguments, 1));
	},

});

//
// expose
//
if (typeof module !== 'undefined' && module.exports) {
	module.exports = Base;
} else {
	this.Base = Base;
}

}(
	typeof window !== 'undefined' ? this._ : require('underscore'),
	typeof window !== 'undefined' ? this.klass : require('klass')
);

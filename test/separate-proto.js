'use strict';

var _ = require('underscore');
var Redis = require('redis');

////////////////////////////


  // Shared empty constructor function to aid in prototype-chain creation.
  var ctor = function(){};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var inherits = function(parent, protoProps, staticProps) {
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call `super()`.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Add static properties to the constructor function, if supplied.
    if (staticProps) _.extend(child, staticProps);

    // Correctly set child's `prototype.constructor`, for `instanceof`.
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };

  // The self-propagating extend function that Backbone classes use.
  var extend = function(protoProps, classProps) {
    var child = inherits(this, protoProps, classProps);
    child.extend = extend;
    return child;
  };



////////////////////////////

var db = Redis.createClient();

function Base() {
}
Base.extend = extend;

var Context = Base.extend({
	sync: function(changes, reset) {
		if (reset) {
			for (var i in this) delete this[i];
		}
		_.extend(this, changes);
		db.set('x', this);
	}
});

var ctx = new Context();
console.log(ctx);

require('repl').start('node> ').context.ctx = ctx;
process.stdin.on('close', process.exit);

/*

ctx
	foo
	bar
	...
	__proto__
		sync
		rpc
		any-live-remote-fn

*/


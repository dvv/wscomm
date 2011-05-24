'use strict';

!function(undefined) {

if (typeof window === 'undefined') {
	var server = true;
	var _ = require('underscore');
	var Backbone = require('backbone');
	var Capsule = require('./capsule');
	var exports = module.exports;
} else {
	var server = false;
	var _ = this._;
	var Backbone = this.Backbone;
	var Capsule = this.Capsule;
	var exports = this;
}

var AModel = Capsule.Model.extend({
	initialize: function(spec) {
		this.register();
		this.addChildModel('B', ABModel);
	}
});

var ABModel = Capsule.Model.extend({
	initialize: function(spec) {
		this.register();
		this.set({foo: 'foo', bar: [1, false, true, null, new Date()]});
	},
	method: function() {
		console.log('METHOD CALLED');
	}
});

var Bar = Capsule.Model.extend({
	initialize: function(spec) {
		this.register();
	}
});

var Bars = Capsule.Collection.extend({
	model: Bar
});

var Foo = Capsule.Model.extend({
	initialize: function(spec) {
		this.register();
		this.addChildCollection('bars', Bars);
	}
});

exports.AppModel = Capsule.Model.extend({
	type: 'app',
	initialize: function(spec) {
		this.register();
		//this.addChildCollection('members', exports.Members);
		this.addChildModel('A', AModel);
		this.addChildModel('C', Foo);
	}
});

}();

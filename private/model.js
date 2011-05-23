'use strict';

if (typeof window === 'undefined') {
	var server = true;
	var _ = require('underscore');
	var Backbone = require('backbone');
	var Capsule = require('capsule');
	exports = module.exports;
} else {
	var server = false;
	exports = window;
}

exports.AppModel = Capsule.Model.extend({
	type: 'app',
	initialize: function(spec) {
		this.register();
		//this.addChildCollection('members', exports.Members);
		this.addChildModel('activityLog', exports.AModel);
	}
});

exports.AModel = Capsule.Model.extend({
	initialize: function(spec) {
		this.register();
	}
});

'use strict';

!function(undefined) {

if (typeof window === 'undefined') {
	var server = true;
	var _ = require('underscore');
	var exports = module.exports;
} else {
	var server = false;
	var _ = this._;
	var exports = this;
}

exports.Model = function() {
};
exports.Model.prototype.ping = function() {
	console.log('PING', arguments);
};

function invoke(path, args) {
	console.log('INVOKE', arguments);
}

exports.Model.define = function(key, value) {
	if (server) {
		this[key] = _.bind(invoke, null, key);
	} else {
		this.prototype[key] = value;
	}
}

}();

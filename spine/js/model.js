'use strict';

(function(undefined) {

if (typeof window === 'undefined') {
	var Spine = require('spine');
	var db = require('redis').createClient();
	var Persist = {
		extended: function() {
			this.fetch(this.proxy(this.redisGet));
			this.bind('save', this.proxy(function(record) {
				//var result = JSON.stringify(record);
				var commands = this.attributes.filter(function(attr) {
					return record[attr] != null;
				}).map(function(attr) {
					return ['set', this.name + '/' + record.id + ':' + attr, record[attr]];
				}, this);
				//commands.push(['sadd', this.name, record.id]);
				commands.push(['zadd', this.name, Date.now(), record.id]);
				console.log('SAVE', commands);
				db.multi(commands).exec();
			}));
		},
		redisGet: function(options) {
			if (!options) options = {};
			var attrs = options.attributes || this.attributes;
			console.log('FETCH', arguments);
			var self = this;
			var args = [self.name];
			for (var i = 0; i < attrs.length; ++i) {
				args.push('get');
				args.push(this.name + '/*:' + attrs[i]);
			}
			db.sort(args, function(err, result) {
				console.log('FETCHED', arguments);
				if (!result) return;
				result = JSON.parse(result);
				self.refresh(result);
			});
		}
	};
	var exports = module.exports;
} else {
	var Spine = this.Spine;
	var Persist = Spine.Model.Local;
	Spine.Model.Local.storage = sessionStorage;
	Spine.Model.extend({
		url: function() { return '/' + this.name; }
	});
	var exports = this;
}

var Foo = exports.Foo = Spine.Model.setup('Foo', ['foo', 'bar']);
Foo.extend(Persist);
Foo.include({
	validate: function() {
		if (!this.foo) return 'foo must be';
	}
});

})();

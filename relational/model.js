if (typeof window === 'undefined') {
	var _ = require('underscore');
	var Backbone = exports = module.exports = require('backbone-rel');
} else {
	var Backbone = this.Backbone;
	var _ = this._;
}

Backbone.catchAll = function() {
	console.log('EVENT', arguments);
};

var Foo = Backbone.Foo = Backbone.RelationalModel.extend({
	url: 'Foo',
	relations: [{
		type: Backbone.HasMany,
		key: 'bars',
		relatedModel: 'Bar',
		//includeInJSON: false,
		//reverseRelation: {
		//	key: 'foo'
		//}
	}],
	initialize: function() {
		this.bind('all', _.bind(Backbone.catchAll, this));
	}
});

var Bar = Backbone.Bar = Backbone.RelationalModel.extend({
	url: 'Bar',
	relations: [{
		type: Backbone.HasMany,
		key: 'bazs',
		relatedModel: 'Baz',
		//includeInJSON: false,
		//reverseRelation: {
		//	key: 'bar'
		//}
	}],
	initialize: function() {
		this.bind('all', _.bind(Backbone.catchAll, this));
	}
});

var Baz = Backbone.Bar = Backbone.RelationalModel.extend({
	url: 'Baz',
	initialize: function() {
		this.bind('all', _.bind(Backbone.catchAll, this));
	}
});

var bar1 = new Bar({
	id: 'bar1'
});

var bar2 = new Bar({
	id: 'bar2'
});

var foo1 = Backbone.foo1 = new Foo({
	id: 'foo1',
	bars: [bar1, bar2],
	hz: {a: 'b', c: 'd'}
});

foo1.get('bars').add(bar1).add(bar2);

/*foo1.bind('all', function() {
	console.log('EVENT', arguments);
});*/

_sync = Backbone.sync;
Backbone.sync = function(method, model, success, error) {
	console.log('SYNC', method, model.toJSON(), model);
	_sync.apply(this, arguments);
};

/*var repl = require('repl').start('node> ');
process.stdin.on('close', process.exit);
repl.context.foo1 = foo1;

console.log(foo1.get('bars'));
*/

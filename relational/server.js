var Backbone = require('backbone-rel');
//console.log(Backbone);

var Foo = global.Foo = Backbone.RelationalModel.extend({
	relations: [{
		type: Backbone.HasMany,
		key: 'bars',
		relatedModel: 'Bar',
		includeInJSON: true,
		reverseRelation: {
			key: 'foo'
		}
	}]
});

var Bar = global.Bar = Backbone.RelationalModel.extend();

var bar1 = new Bar({
	id: 'bar1'
});

var bar2 = new Bar({
	id: 'bar2'
});

var foo1 = new Foo({
	id: 'foo1',
	hz: {a: 'b', c: 'd'}
});

//foo1.get('bars').add(bar1).add(bar2);

foo1.bind('change', function() {
	console.log('CHANGE', arguments);
});

var repl = require('repl').start('node> ');
process.stdin.on('close', process.exit);
repl.context.foo1 = foo1;

console.log(foo1.get('bars'));

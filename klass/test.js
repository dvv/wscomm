'use strict';

var Base = require('./base');

var d = new Base({a:1});
d.on('all', function() {
	console.error('dALL', arguments);
});

var e = new Base({b:1});
e.on('all', function() {
	console.error('eALL', arguments);
});

console.log(d);

var repl = require('repl').start('node> ');
repl.context.d = d;
repl.context.e = e;
repl.context.Base = Base;

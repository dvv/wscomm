var bison = require('bison');

var s = '0';
for (var i = 0; i < 12; ++i) s += s;

var obj = {foo: s};

var t1 = Date.now();
var n = 10000;
for (var i = 0; i < n; ++i) {
	//JSON.parse(JSON.stringify(obj));
	bison.decode(bison.encode(obj));
}
var t2 = Date.now();
console.log('DONE', n*1000/(t2-t1));

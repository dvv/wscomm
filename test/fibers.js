function step1(a1, a2, next) {
	next(null, a1 + a2);
}

function testAsync(next) {
	step1(0, 1, function(err, result) {
		step1(result, 1, function(err, result) {
			step1(result, 1, function(err, result) {
				step1(result, 1, function(err, result) {
					i++;
					next(null);
				});
			});
		});
	});
}

/*
var n = 1530;
var i = 0;
function cb(err) {
	if (i < n) {
		testAsync(cb);
	} else {
		var t2 = Date.now();
		console.log('DONE', 1000*n/(t2-t1));
	}
}
var t1 = Date.now();
testAsync(cb);
*/

/*
var i = 0;
var Async = require('async');
Async.whilst(function() {
	return i < n;
}, testAsync,
function() {
	console.log('DONE!');
});
*/

var S = require('sync');
S(function(){

var n = 10000;
var t1 = Date.now();
for (var i = 0; i < n; ++i) {
	var c = 0;
	for (var j = 0; j < 4; ++j) c += step1.sync(null, 0, 1);
}
var t2 = Date.now();
console.log('DONE', 1000*n/(t2-t1));

});

S(function(){

function async(a, b, next) {
	next(null, 'foo');
}

console.log(async.sync(null, 1, 2));

});

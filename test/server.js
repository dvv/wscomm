var Sync = require('sync');
var Redis = require('redis');
var freemem = require('os').freemem;

var db = Redis.createClient();

var load = '0';
for (var i = 0; i < 10; ++i) load += load;

var count = 0;

var publish = function(data) {
	for (var i = 0; i < 100; ++i) {
		db.publish('bus', data);
		count++;
	}
}.async();

Sync(function(){

var n = 1000000;
var t1 = Date.now();
for (var i = 0; i < n; ++i) {
	publish.sync(null, load)
	if (i % 10000 === 0) {
		console.log('TICK', Date.now()-t1, count, freemem());
	}
}

});

/*setInterval(function() {
	console.log('TICK', Date.now()-t1, count, freemem());
}, 100);*/

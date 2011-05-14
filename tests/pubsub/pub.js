'use strict';

var freemem = require('os').freemem;
var encode = JSON.stringify;

var published = 0;

// bnoguchi/redis-node
//var pub = require('redis-node').createClient(); go();

// mranney/node_redis
var pub = require('redis').createClient().on('ready', go);

// fictorial/redis-client
//var pub = require('redis-client').createClient(); go();

function go() {
	while (true) {
		var s = encode({
			cid: 0,
			cmd: Math.random(),
			data: Math.random()
		});
		pub.publish('timeline', s);
		published++;
		if (published % 100000 === 0) console.error('published', published, 'freemem', freemem());
	}
}

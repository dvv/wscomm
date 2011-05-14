'use strict';

var pub = require('redis').createClient()
	.on('ready', function() {
		while (true) {
			pub.rpush('timeline', JSON.stringify({
				cid: 0,
				cmd: Math.random(),
				data: Math.random()
			}));
		}
	});

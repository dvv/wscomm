'use strict';

var cid = Math.random().toString().substring(2);

var recv = 0;
var bcasted = 0;

var sub = require('redis').createClient()
	.on('ready', function() {
		this.emit('timeline');
	})
	.on('timeline', function() {
		var self = this;
		this.blpop('timeline', 0, function(err, result) {
			var message = result[1];
			if (message && message.charAt(0) === '{') {
				message = JSON.parse(message);
				++recv;
				if (message.cid !== cid) {
					++bcasted;
				}
			}
			self.emit('timeline');
		});
	});

setInterval(function() {
	console.log('bcasted to ', cid, bcasted, recv);
}, 1000);

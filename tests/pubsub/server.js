'use strict';

var codec = require('../codec');

var cid = Math.random().toString().substring(2);

var recv = 0;
var bcasted = 0;

var sub = require('redis').createClient()
	.on('ready', function() {
		this.subscribe('timeline');
	})
	.on('message', function(channel, message) {
		//if (!message || message.charAt(0) !== '{') return;
		if (!message) return;
		message = codec.decode(message);
		++recv;
		//console.log('MSG', message);
		if (message.cid !== cid) {
			this.emit('bcast', message);
		}
	})
	.on('bcast', function(message) {
		//console.log('BCAST', message);
		++bcasted;
	});

setInterval(function() {
	console.log('bcasted to ', cid, bcasted, recv);
}, 1000);

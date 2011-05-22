var S = require('sync');
var free = require('os').freemem;

var _ = require('underscore');
var Redis = require('redis');
var Ws = require('socket.io');

function exec() {
	console.log('EXEC', arguments);
}

var n = 0;

function Node() {
	var node = this;
	this.db = Redis.createClient();
	this.pub = Redis.createClient();
	this.sub = Redis.createClient();
	this.sub.subscribe('bcast');
	this.sub.on('message', function(channel, message) {
		if (!message) return;
		try {
			message = JSON.parse(message);
		} catch(err) {}
		if (message.cmd === 'invoke') {
			//console.log('INVOKE', message.args);
			//exec.apply(null, message.args);
			n++;
			//if (n % 1000 === 0) console.log('GOT', n, free());
		}
	});
	this.client = {};
	this.server = {};
	// hash of filtering functions
	this.groups = {
		all: _.identity
	};
}
Node.prototype.invoke = function(path) {
	this.pub.publish.sync(this.pub, 'bcast', JSON.stringify({
		cmd: 'invoke',
		args: Array.prototype.slice.call(arguments)
	}));
};
Node.prototype.group = function(name, filter) {
	// getter
	if (arguments.length < 2) {
		filter = this.groups[name];
		var list = this.ws.clients;
		return filter ? _(list).filter(filter) : [];
	// setter
	} else {
		filter ? this.groups[name] = filter : delete this.groups[name];
	}
};

var node1 = new Node();
for (var i = 0; i < 10; ++i) new Node();
/*var node2 = new Node();
var node3 = new Node();
var node4 = new Node();*/

S(function(){

var load = '0';
for (var i = 0; i < 8; ++i) load += load;

var t1 = Date.now();
for (var i = 0; i < 100000; ++i) {
	node1.invoke(['a','b'], 1, 2, 3, load);
	if (i % 10000 === 0) console.log((Date.now()-t1)/1000, i, free());
}

});

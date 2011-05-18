'use strict';

var _ = require('underscore');
var Path = require('path');
var Fs = require('fs');
var Ws = require('./wscomm');

var callable = _.isFunction;
function call(obj) {
	if (callable(obj)) obj.apply(this, Array.prototype.slice.call(arguments, 1));
}

//
// given session id, return the context
// N.B. it can be reused in vanilla middleware
//
function getContext(sid) {

	// memorize the socket
	var socket = this;

	// N.B. in functions:
	// `this` === context

	// anonymous user capability
	var caps = {
		signin: function(next, sid) {
			var self = this;
			function register(context) {
				// reset the context
				self.sync(context, true);
				callable(next) && next();
			}
			// context getter is a function?
			if (callable(getContext)) {
				// getter's arity is > 1? --> assume it's node-style async
				if (getContext.length > 1) {
					getContext.call(socket, sid, function(err, result) {
						register(result);
					});
				// else assume it's sync
				} else {
					register(getContext.call(socket, sid));
				}
			// context is already baked
			// N.B. in this case there's no means to pass the socket into context's closures
			} else {
				register(getContext || {});
			}
		},
		user: {
		}
	};

	// authenticated user capability
	if (sid) _.extend(caps, {
		user: {
			id: sid
		},
		Foo: {
			get: function(next, index) {
				console.log('Foo.get', arguments);
				callable(next) && next({result: 'resulting'});
			},
			Bar: {
				deep: function(next, index) {
					console.log('Foo.Bar.deep', arguments);
					callable(next) && next({error: 'erroring'});
				}
			}
		},
		post: function(next, msg) {
			var groups = _.keys(this.groups || {});
			var r = socket.invoke(function(client) {
				//console.log('POSTCLIENT', client.context);
				if (!client.context.groups) return false;
				var g = _.keys(client.context.groups);
				return _.intersect(groups, g).length;
			}, 'ping', this.name + ' ['+groups.join()+']' + ' says ' + msg);
			//console.log('Post', r, arguments);
			callable(next) && next();
		},
		groups: {},
		join: function(next, group) {
			var groups = this.groups;
			// N.B. here might be the auth logic
			groups[group] = {};
			this.sync({groups: groups});
			callable(next) && next();
		},
		leave: function(next, group) {
			var groups = this.groups;
			_.each(Array.prototype.slice.call(arguments, 1), function(g) {
				delete groups[g];
			}, this);
			// N.B. removing a hash key from shared context is done by
			// resetting the whole key, and then extending it.
			// this allows for keeping interface clean
			this.sync([{groups: null}, {groups: groups}]);
			callable(next) && next();
		}
	});

	return caps;
}

//
// setup middleware
//
var count = 0;
function middleware(req, res) {
	req.url = Path.normalize(req.url);
	if (req.url === '/') req.url = '/index.html';
	Fs.readFile(__dirname + req.url, function(err, data) {
		if (err) {
			res.writeHead(404);
			res.end();
		} else {
			var mime = req.url.slice(-3) === '.js' ? 'text/javascript' : 'text/html';
			if (req.url === '/wscomm.js') {
				Fs.readFile(__dirname + '/socket.io.js', function(err, sio) {
					data = sio.toString('utf8') + data.toString('utf8').replace(/location\[\'p\'\+\'ort\'\]/, 3001 + (count++ % 2));
					res.writeHead(200, {'content-type': mime, 'content-length': data.length});
					res.end(data);
				});
				return;
			}
			res.writeHead(200, {'content-type': mime, 'content-length': data.length});
			res.end(data);
		}
	});
}

//
// setup persistence
//
var db = require('redis').createClient();

//
// websocket context
//
var wscontext = {
	//generateSessionId: 'sid',
	generateSessionId: function() {
		return false;
	},
	save: function() {
		// backup the context, pruning both local and remote functions
		var s;
		db.set('session:' + this.sessionId, s = this.encode(this.context, true));
		console.log('SAVED!', s);
	},
	onContext: function() {
		// `this` is the socket; here is the only place to memo it.
		// setup initial context
		var self = this;
		var caps = getContext.call(this, this.sessionId);
		db.get('session:' + this.sessionId, function(err, result) {
			if (result) {
				var session = self.decode(result);
				// set the context
				self.update(session, true);
			}
			// update context with caps
			self.update(caps);
			// send the resulting context
			self.update(null, false, true);
		});
	},
	onDisconnect: function() {
		// TODO: should we `this.save()` here, just in case ;)
		console.log('DISCONNECTED1!', this.sessionId);
	}
};

// REPL for tests
var repl = require('repl').start('node> ');
process.stdin.on('close', process.exit);

//
// run load balancer
//
if (true) {
	var http = require('http').createServer();
	http.on('request', middleware);
	http.listen(3000);
}

//
// run HTTP server 1
//
if (true) {
	var http1 = require('http').createServer();
	http1.on('request', middleware);
	http1.listen(3001);
	// websocket
	var ws1 = Ws.listen(http1, _.extend({}, wscontext, {
	}));
	repl.context.ws1 = ws1;
}

//
// run HTTP server 2
//
if (true) {
	var http2 = require('http').createServer();
	http2.on('request', middleware);
	http2.listen(3002);
	// websocket
	var ws2 = Ws.listen(http2, _.extend({}, wscontext, {
	}));
	repl.context.ws2 = ws2;
}

//
// reuse the middleware and context for HTTPS server
//
if (false) {
	var https = require('https').createServer({
		key: require('fs').readFileSync('key.pem', 'utf8'),
		cert: require('fs').readFileSync('cert.pem', 'utf8'),
		//ca: ...
	});
	https.on('request', middleware);
	https.listen(4000);
	// secure websocket
	var wss = Ws.listen(https, wscontext);
	repl.context.wss = wss;
}

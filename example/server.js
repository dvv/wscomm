'use strict';

var _ = require('underscore');
var Fs = require('fs');
var Ws = require('./wscomm');
var Redis = require('redis');

//
// well-known useful functions
//
var slice = Array.prototype.slice;
var push = Array.prototype.push;

var callable = _.isFunction;
function call(obj) {
	if (callable(obj)) obj.apply(this, Array.prototype.slice.call(arguments, 1));
}

//
// given session id, return the context
// N.B. it can be reused in vanilla middleware
//
function getContext(sid) {

	// memorize the node
	var node = this;

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
					getContext.call(node, sid, function(err, result) {
						register(result);
					});
				// else assume it's sync
				} else {
					register(getContext.call(node, sid));
				}
			// context is already baked.
			// N.B. in this case there's no means to pass the node into
			// context's closures
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
			/*var r = node.invoke(function(client) {
				//console.log('POSTCLIENT', client.context);
				if (!client.context.groups) return false;
				var g = _.keys(client.context.groups);
				return _.intersect(groups, g).length;
			}, 'ping', this.name + ' ['+groups.join()+']' + ' says ' + msg);*/
			var r = node.invoke('ping', this.name + ' ['+groups.join()+']' + ' says ' + msg);
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

/**
 * middleware
 */

// secure sessions stored in cookie 'sid'
var Cookie = require('cookie-sessions');
var sessionOptions = {
	session_key: 'sid',
	secret: 'change-me-in-production-env',
	path: '/',
	timeout: 86400000
};

var connect = require('connect');
function middleware() {
	return [
		connect.favicon(),
		health('/haproxy?monitor'),
		serveWsComm,
		connect.static(__dirname),
		connect.logger(),
		Cookie(sessionOptions),
		// handle auth, which should set req.session.user.id
		auth(),
	];
}

/**
 * Listen to specified URL and respond with status 200
 * to signify this server is alive
 */

function health(url) {
	return function handler(req, res, next) {
		if (req.url === url) {
			res.writeHead(200);
			res.end();
		} else {
			next();
		}
	};
}

/**
 * Serve socket.io.js and wscomm.js bundled in one file.
 * N.B. use only in development, to avoid caching of both
 */

function serveWsComm(req, res, next) {
	if (req.url === '/wscomm.js') {
		Fs.readFile(__dirname + '/wscomm.js', function(err, data) {
			Fs.readFile(__dirname + '/socket.io.js', function(err, sio) {
				data = sio.toString('utf8') + data.toString('utf8');
				res.writeHead(200, {'content-type': 'text/javascript', 'content-length': data.length});
				res.end(data);
			});
		});
	} else {
		next();
	}
}

/**
 * Handle authentication
 */

function auth(url) {
	return function handler(req, res, next) {
		console.log('SESS', req.session);
		if (req.url === '/auth') {
			// put authentication logic here
			// ???
			// set the session so that we can persist the shared context
			req.session = {
				user: {
					id: Ws.nonce(),
					email: 'try@find.me'
				}
			};
			// go home
			res.writeHead(302, {location: '/'});
			res.end();
		} else {
			next();
		}
	}
}

/**
 * WSComm server prototype
 */

function Node(httpStack, httpPort) {

	// cache this
	var node = this;

	// HTTP
	this.http = connect.apply(null, httpStack);
	this.http.listen(httpPort);

	// WebSocket
	this.ws = Ws.listen(this.http, {
		save: function(callback) {
			// backup the context, pruning both local and remote functions
			var s;
			node.db.set(['session:' + this.clientId, s = Ws.encode(this.context, true)], callback);
			console.log('SAVED!', s);
		},
		load: function(callback) {
		},
		// `obj[property]` being `oldValue` is changing to `value`
		onChange: function(property, value, oldValue, obj) {
			console.log('CHANGE', arguments);
			node.pub.publish('bcast', Ws.encode({cmd: 'change', property: property}));
		},
		onContext: function() {
			// `this` is the socket; here is the only place to memo it.
			var self = this;
			// get session
			// N.B. we patched Listener.prototype._onConnection to always
			// have access to headers, particularly to Cookie:
			var sid = this.listener.req.headers.cookie;
			sid = sid && sid.match(new RegExp('(?:^|;) *' +
				sessionOptions.session_key + '=([^;]*)'));
			sid = sid && sid[1];
			// deserialize cookie manually to extract `user.id` key
			if (sid) try {
				this.session = Cookie.deserialize(
					sessionOptions.secret, sessionOptions.timeout, sid);
				// extract client id from the session
				this.clientId = this.session.user.id;
				console.log('REUSED', this.session, this.clientId);
			} catch (err) {
				console.log('FAILED TO PARSE SESSION', err.stack);
			}
			// setup initial context
			var caps = getContext.call(node, this.clientId);
			var ctx = [];
			// honor session
			//if (this.session) ctx.push(this.session);
			node.db.get('session:' + this.clientId, function(err, result) {
				if (result) {
					var session = Ws.decode(result);
					// honor saved context
					ctx.push(session);
				}
				// honor caps
				ctx.push(caps);
				// send the resulting context
				self.context.sync(ctx, true);
				console.log('CONNECTED!', self.clientId, self.context);
			});
		},
		onDisconnect: function() {
			// TODO: should we `this.save()` here, just in case ;)
			console.log('DISCONNECTED!', this.clientId);
		}
	});

	// persistence
	this.db = Redis.createClient();

	// publish broadcast messages
	this.pub = Redis.createClient();

	// listen to broadcast messages
	this.sub = Redis.createClient();
	this.sub.subscribe('bcast');
	// N.B. we bind so that to have this node as `this` in the handler
	this.sub.on('message', _.bind(this.onBroadcast, this));

}
Node.prototype.invoke = function(path, args) {
	//console.log('INVOKING', arguments);
	this.pub.publish('bcast', Ws.encode({
		cmd: 'invoke',
		args: slice.call(arguments)
	}));
};
Node.prototype.onBroadcast = function(pattern, message) {
	//console.log('BCASTEDMESSAGE', arguments);
	if (!message) return;
	message = Ws.decode(message);
	if (message.cmd === 'change') {
		console.log('CHANGE ARRIVED', this.ws, message);
	} else if (message.cmd === 'invoke') {
		// FIXME: null means all clients. howto use filters?
		var args = [this.ws.clients, null];
		push.apply(args, message.args);
		Ws.invoke.apply(this.ws, args);
	}
};

/**
 * HTTP server
 */

var stack = middleware();
var node1 = new Node(stack, 3001);
var node2 = new Node(stack, 3002);
var node3 = new Node(stack, 3003);

/** REPL for tests.
 * N.B. fails to work under nodester.com!
 */

var repl = require('repl').start('node> ');
process.stdin.on('close', process.exit);
repl.context.n1 = node1;
repl.context.n2 = node2;
repl.context.n3 = node3;

repl.context.stress = function() {
	for (var i = 0; i < 1000; ++i) {
		node1.invoke('ping', 'foooooo');
	}
};

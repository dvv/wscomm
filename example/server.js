'use strict';

var _ = require('underscore');
var Fs = require('fs');
var Ws = require('./wscomm');
var Redis = require('redis');

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
		signin: function(sid) {
			var self = this;
			function register(context) {
				// reset the context
				self.sync(context, true);
			}
			// context getter is a function?
			if (typeof getContext === 'function') {
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
			get: function(index) {
				console.log('Foo.get', arguments);
				this.sync({result: 'hehe', error: null});
			},
			Bar: {
				deep: function(index) {
					console.log('Foo.Bar.deep', arguments);
					this.sync({result: null, error: 'olala'});
				}
			}
		},
		post: function(msg) {
			console.log('POST', msg);
			var groups = this.groups || [];
			/*var r = node.invoke(function(client) {
				//console.log('POSTCLIENT', client.context);
				if (!client.context.groups) return false;
				var g = _.keys(client.context.groups);
				return _.intersect(groups, g).length;
			}, 'ping', this.name + ' ['+groups.join()+']' + ' says ' + msg);*/
			var r = node.invoke('ping', this.name + ' ['+groups.join()+']' + ' says ' + msg);
			//console.log('Post', r, arguments);
		},
		groups: [],
		join: function(group) {
			var groups = this.groups;
			// N.B. here might be the auth logic
			if (!~_.indexOf(groups, group)) {
				groups.push(group);
				this.sync({groups: groups});
			}
		},
		leave: function(group) {
			var groups = _.without(this.groups, group);
			this.sync({groups: groups});
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
					id: 'dvv',//Ws.nonce(),
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

	// WebSocket shared context
	this.ws = Ws.listen(this.http, {
	});
	this.ws.on('connection', function(client) {
		// get session
		// N.B. we patched Listener.prototype._onConnection to always
		// have access to headers, particularly to Cookie:
		var sid = client.listener.req.headers.cookie;
		sid = sid && sid.match(new RegExp('(?:^|;) *' +
			sessionOptions.session_key + '=([^;]*)'));
		sid = sid && sid[1];
		// deserialize cookie manually to extract `user.id` key
		if (sid) try {
			client.session = Cookie.deserialize(
				sessionOptions.secret, sessionOptions.timeout, sid);
			// extract client id from the session
			client.clientId = client.session.user.id;
			console.log('REUSED', client.session, client.clientId);
		} catch (err) {
			console.log('FAILED TO PARSE SESSION', err.stack);
		}
		// setup initial context
		var context = client.context;
		// TODO: this should be new App(...), and be reused at client side!
		var caps = getContext.call(node, client.clientId);
		// honor session
		node.db.get('session:' + client.clientId, function(err, result) {
			if (result) {
				var session = Ws.decode(result);
				// honor saved context
				context.update(session, {silent: true});
			}
			// honor caps
			context.update(caps, {silent: true});
			// send the resulting context
			//context.update(null, {send: true, ready: true});
			context.sync(null, {ready: true});
			console.log('CONNECTED!', client.clientId, client.context);
		});
		// client disconnected
		client.on('disconnect', function() {
			console.log('DISCONNECTED!', arguments);
		});

client.on('message', function(message) {
	if (!message) return;
	// remote context has changed
	if (message.cmd === 'context') {
console.log('CONTEXTCHANGED');
message.client = client.clientId;
node.pub.publish('bcast', message);
	}
});


		// context `obj[property]` being `oldValue` is changing to `value`
		context.on('change', function() {
			var args = Array.prototype.slice.call(arguments);
			console.log('CHANGE', args);
			// backup the context, pruning all functions
			node.db.set(['session:' + client.clientId, Ws.encode(this, true)], function() {
				/// notify neighbors
				///node.pub.publish('bcast', Ws.encode({cmd: 'change', client: client.clientId, args: args}));
			});
		});
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
		args: Array.prototype.slice.call(arguments)
	}));
};
Node.prototype.onBroadcast = function(pattern, message) {
	var node = this;
	console.log('BCASTEDMESSAGE', arguments);
	if (!message) return;
	message = Ws.decode(message);
	if (message.cmd === 'context') {
		var changes = message.params[0];
		var options = message.params[1] || {};
		console.log('CHANGE ARRIVED', node.id, message.client, changes);
		_.each(this.ws.clients, function(client) {
			if (client.clientId !== message.client) return;
			var context = client.context;
			// revive functions from THIS_IS_FUNC signatures
			client.reviveFunctions(changes);
			// update the context
			context.update(changes, options);
			// remote context first initialized?
			options.ready && context.emit('ready', client);
		});
	} else if (message.cmd === 'invoke') {
		// FIXME: null means all clients. howto use filters?
		this.ws.invoke.apply(this.ws, [null].concat(message.args));
	}
};

/**
 * HTTP server
 */

var stack = middleware();
var node1 = new Node(stack, 3000); node1.id = 3000;
var node2 = new Node(stack, 3002); node2.id = 3002;
var node3 = new Node(stack, 3003); node3.id = 3003;

/**
 * REPL for tests.
 * N.B. REPL fails to work under nodester.com!
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

'use strict';

/**
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

//
// bundled creationix/Stack
//

function errorHandler(req, res, err) {
	if (err) {
		var reason = err.stack || err;
		console.error('\n' + reason + '\n');
		res.writeHead(500, {'Content-Type': 'text/plain'});
		res.end(reason + '\n');
	} else {
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.end();
	}
};
function Stack(layers) {
	var error = errorHandler;
	var handle = error;
	layers.reverse().forEach(function (layer) {
		var child = handle;
		handle = function (req, res) {
			try {
				layer(req, res, function (err) {
					if (err) { return error(req, res, err); }
					child(req, res);
				});
			} catch (err) {
				error(req, res, err);
			}
		};
	});
	return handle;
}

module.exports = Stack;

Stack.listen = function(layers) {
	var http = require('http').createServer(Stack(layers));
	http.listen.apply(http, Array.prototype.slice.call(arguments, 1));
	return http;
};

Stack.static = require('./static');
Stack.body = require('./body');
Stack.rest = require('./rest');

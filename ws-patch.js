'use strict';

var _ = require('underscore');
var IO = require('socket.io');

var ListenerProto =
	require('socket.io/lib/socket.io/listener').prototype;

//
// patch old socket.io
//

if (IO.version.substring(0,3) === '0.6') {

	// patch listener to always provide request object
	// so that to have access to headers, particularly to Cookie:
	var onConnection = ListenerProto._onConnection;
	ListenerProto._onConnection =
		function(transport, req, res, httpUpgrade, head) {
			// memo the request
			this.req = req;
			onConnection.apply(this, arguments);
		};

	// patch ws/wss logic
	var WSTpt = require('socket.io/lib/socket.io/transports/websocket');
	WSTpt.prototype._isSecure = function() {
		// N.B. we always "mirror" security: https -> wss, http -> ws
		return this.request.headers.origin.substring(0, 6) === 'https:';
	};

}

//
// invoke callable at `path` for each client of `this` socket
// which passed `filter` test
//
ListenerProto.invoke = function(filter, path) {
	var list = this.clients;
	var args = slice.call(arguments, 1);
	// filter the list if the filtering function is given
	if (callable(filter)) {
		list = _.filter(list, filter);
	// if `filter` is array, use it as list
	} else if (_.isArray(filter)) {
		list = filter;
	// else make list from `filter`
	} else if (Object(filter) === filter) {
		list = [filter];
	}
	// return the filtered list unless arguments to make call are given
	if (!args.length) return list;
	// for each item in list perform RPC call
	_.each(list, function(item) {
		item.rpc.apply(item, args);
	});
};

// debugging only
ListenerProto.__defineGetter__('ctx', function() {return _.toArray(this.clients)[0].context;});

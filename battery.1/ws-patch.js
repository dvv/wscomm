'use strict';

var IO = require('socket.io');

//
// patch old socket.io
//

if (IO.version.substring(0,3) === '0.6') {

	// patch listener to always provide request object
	// so that to have access to headers, particularly to Cookie:
	var onConnection = IO.Listener.prototype._onConnection;
	IO.Listener.prototype._onConnection =
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

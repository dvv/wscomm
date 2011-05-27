/*! Socket.IO.js build:0.6.2, development. Copyright(c) 2011 LearnBoost <dev@learnboost.com> MIT Licensed */
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * @namespace
 */
var io = this.io = {
  
  /**
   * Library version.
   */
  version: '0.6.2'
};/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Set when the `onload` event is executed on the page. This variable is used by
   * `io.util.load` to detect if we need to execute the function immediately or add
   * it to a onload listener.
   *
   * @type {Boolean}
   * @api private
   */
  pageLoaded = false;
  
  /**
   * @namespace
   */
  io.util = {
    /**
     * Executes the given function when the page is loaded.
     *
     * Example:
     *
     *     io.util.load(function(){ console.log('page loaded') });
     *
     * @param {Function} fn
     * @api public
     */
    load: function(fn){
      if (document.readyState === 'complete' || pageLoaded) return fn();
      if ('attachEvent' in window){
        window.attachEvent('onload', fn);
      } else {
        window.addEventListener('load', fn, false);
      }
    },
    
    /**
     * Defers the function untill it's the function can be executed without
     * blocking the load process. This is especially needed for WebKit based
     * browsers. If a long running connection is made before the onload event
     * a loading indicator spinner will be present at all times untill a
     * reconnect has been made.
     *
     * @param {Function} fn
     * @api public
     */
    defer: function(fn){
      if (!io.util.webkit) return fn();
      io.util.load(function(){
        setTimeout(fn,100);
      });
    },
    
    /**
     * Inherit the prototype methods from one constructor into another.
     *
     * Example:
     *
     *     function foo(){};
     *     foo.prototype.hello = function(){ console.log( this.words )};
     *     
     *     function bar(){
     *       this.words = "Hello world";
     *     };
     *     
     *     io.util.inherit(bar,foo);
     *     var person = new bar();
     *     person.hello();
     *     // => "Hello World"
     *
     * @param {Constructor} ctor The constructor that needs to inherit the methods.
     * @param {Constructor} superCtor The constructor to inherit from.
     * @api public
     */
    inherit: function(ctor, superCtor){
      // no support for `instanceof` for now
      for (var i in superCtor.prototype){
        ctor.prototype[i] = superCtor.prototype[i];
      }
    },
    
    /**
     * Finds the index of item in a given Array.
     *
     * Example:
     *
     *     var data = ['socket',2,3,4,'socket',5,6,7,'io'];
     *     io.util.indexOf(data,'socket',1);
     *     // => 4
     *
     * @param {Array} arr The array
     * @param item The item that we need to find
     * @param {Integer} from Starting point
     * @api public
     */
    indexOf: function(arr, item, from){
      for (var l = arr.length, i = (from < 0) ? Math.max(0, l + from) : from || 0; i < l; i++){
        if (arr[i] === item) return i;
      }
      return -1;
    },
    
    /**
     * Checks if the given object is an Array.
     *
     * Example:
     *
     *     io.util.isArray([]);
     *     // => true
     *     io.util.isArray({});
     *    // => false
     *
     * @param obj
     * @api public
     */
    isArray: function(obj){
      return Object.prototype.toString.call(obj) === '[object Array]';
    },
    
    /**
     * Merges the properties of two objects.
     *
     * Example:
     *
     *     var a = {foo:'bar'}
     *       , b = {bar:'baz'};
     *     
     *     io.util.merge(a,b);
     *     // => {foo:'bar',bar:'baz'}
     *
     * @param {Object} target The object that receives the keys
     * @param {Object} additional The object that supplies the keys
     * @api public
     */
    merge: function merge(target, additional, deep, lastseen){
      var seen = lastseen || []
        , depth = typeof deep == 'undefined' ? 2 : deep
        , prop;
      
      for (prop in additional){
        if (additional.hasOwnProperty(prop) && this.indexOf(seen, prop) < 0){
          if (typeof target[prop] !== 'object' || !depth){
            target[prop] = additional[prop];
            seen.push(additional[prop]);
          } else {
            this.merge(target[prop], additional[prop], depth - 1, seen);
          }
        }
      }
      
      return target;
    }
  };
  
  /**
   * Detect the Webkit platform based on the userAgent string.
   * This includes Mobile Webkit.
   *
   * @type {Boolean}
   * @api public
   */
  io.util.webkit = /webkit/i.test(navigator.userAgent);
  
  io.util.load(function(){
    pageLoaded = true;
  });

})();/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * Message frame for encoding and decoding responses from the Socket.IO server.
   *
   * @const
   * @type {String}
   */
  frame = '~m~',
  
  /**
   * Transforms the message to a string. If the message is an {Object} we will convert it to
   * a string and prefix it with the `~j~` flag to indicate that message is JSON encoded.
   *
   * Example:
   *
   *     stringify({foo:"bar"});
   *     // => "~j~{"foo":"bar"}"
   *
   * @param {String|Array|Object} message The messages that needs to be transformed to a string.
   * @throws {Error} When the JSON.stringify implementation is missing in the browser.
   * @returns {String} Message.
   * @api private
   */
  stringify = function(message){
    if (Object.prototype.toString.call(message) == '[object Object]'){
      if (!('JSON' in window)){
        var error = 'Socket.IO Error: Trying to encode as JSON, but JSON.stringify is missing.';
        if ('console' in window && console.error){
          console.error(error);
        } else {
          throw new Error(error);
        }
        return '{ "$error": "'+ error +'" }';
      }
      return '~j~' + JSON.stringify(message);
    } else {
      return String(message);
    }
  },
  
  /**
   * This is the transport template for all supported transport methods. It provides the
   * basic functionality to create a working transport for Socket.IO.
   *
   * Options:
   *   - `timeout`  Transport shutdown timeout in milliseconds, based on the heartbeat interval.
   *
   * Example:
   *
   *     var transport = io.Transport.mytransport = function(){
   *       io.Transport.apply(this, arguments);
   *     };
   *     io.util.inherit(transport, io.Transport);
   *     
   *     ... // more code here
   *     
   *     // connect with your new transport
   *     var socket = new io.Socket(null,{transports:['mytransport']});
   *
   * @constructor
   * @param {Object} base The reference to io.Socket.
   * @param {Object} options The transport options.
   * @property {io.Socket|Object} base The reference to io.Socket.
   * @property {Object} options The transport options, these are used to overwrite the default options
   * @property {String} sessionid The sessionid of the established connection, this is only available a connection is established
   * @property {Boolean} connected The connection has been established.
   * @property {Boolean} connecting We are still connecting to the server.
   * @api public
   */
  Transport = io.Transport = function(base, options){
    this.base = base;
    this.options = {
      timeout: 15000 // based on heartbeat interval default
    };
    io.util.merge(this.options, options);
  };

  /**
   * Send the message to the connected Socket.IO server.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.send = function(){
    throw new Error('Missing send() implementation');
  };
  
  /**
   * Establish a connection with the Socket.IO server..
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api public
   */
  Transport.prototype.connect = function(){
    throw new Error('Missing connect() implementation');
  };

  /**
   * Disconnect the established connection.
   *
   * @throws {Error} When the io.Transport is inherited, it should override this method.
   * @api private
   */
  Transport.prototype.disconnect = function(){
    throw new Error('Missing disconnect() implementation');
  };
  
  /**
   * Encode the message by adding the `frame` to each message. This allows
   * the client so send multiple messages with only one request.
   *
   * @param {String|Array} messages Messages that need to be encoded.
   * @returns {String} Encoded message.
   * @api private
   */
  Transport.prototype.encode = function(messages){
    var ret = '', message;
    messages = io.util.isArray(messages) ? messages : [messages];
    for (var i = 0, l = messages.length; i < l; i++){
      message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
      ret += frame + message.length + frame + message;
    }
    return ret;
  };
  
  /**
   * Decoded the response from the Socket.IO server, as the server could send multiple
   * messages in one response.
   *
   * @param (String} data The response from the server that requires decoding
   * @returns {Array} Decoded messages.
   * @api private
   */
  Transport.prototype.decode = function(data){
    var messages = [], number, n;
    do {
      if (data.substr(0, 3) !== frame) return messages;
      data = data.substr(3);
      number = '', n = '';
      for (var i = 0, l = data.length; i < l; i++){
        n = Number(data.substr(i, 1));
        if (data.substr(i, 1) == n){
          number += n;
        } else {
          data = data.substr(number.length + frame.length);
          number = Number(number);
          break;
        }
      }
      messages.push(data.substr(0, number)); // here
      data = data.substr(number);
    } while(data !== '');
    return messages;
  };
  
  /**
   * Handles the response from the server. When a new response is received
   * it will automatically update the timeout, decode the message and
   * forwards the response to the onMessage function for further processing.
   *
   * @param {String} data Response from the server.
   * @api private
   */
  Transport.prototype.onData = function(data){
    this.setTimeout();
    var msgs = this.decode(data);
    if (msgs && msgs.length){
      for (var i = 0, l = msgs.length; i < l; i++){
        this.onMessage(msgs[i]);
      }
    }
  };
  
  /**
   * All the transports have a dedicated timeout to detect if
   * the connection is still alive. We clear the existing timer
   * and set new one each time this function is called. When the
   * timeout does occur it will call the `onTimeout` method.
   *
   * @api private
   */
  Transport.prototype.setTimeout = function(){
    var self = this;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(function(){
      self.onTimeout();
    }, this.options.timeout);
  };
  
  /**
   * Disconnect from the Socket.IO server when a timeout occurs.
   * 
   * @api private
   */
  Transport.prototype.onTimeout = function(){
    this.onDisconnect();
  };
  
  /**
   * After the response from the server has been parsed to individual
   * messages we need to decode them using the the Socket.IO message
   * protocol: <https://github.com/learnboost/socket.io-node/>.
   *
   * When a message is received we check if a session id has been set,
   * if the session id is missing we can assume that the received message
   * contains the sessionid of the connection.
   
   * When a message is prefixed with `~h~` we dispatch it our heartbeat
   * processing method `onHeartbeat` with the content of the heartbeat.
   *
   * When the message is prefixed with `~j~` we can assume that the contents
   * of the message is JSON encoded, so we parse the message and notify
   * the base of the new message.
   *
   * If none of the above, we consider it just a plain text message and
   * notify the base of the new message.
   *
   * @param {String} message A decoded message from the server.
   * @api private
   */
  Transport.prototype.onMessage = function(message){
    if (!this.sessionid){
      this.sessionid = message;
      this.onConnect();
    } else if (message.substr(0, 3) == '~h~'){
      this.onHeartbeat(message.substr(3));
    } else if (message.substr(0, 3) == '~j~'){
      this.base.onMessage(JSON.parse(message.substr(3)));
    } else {
      this.base.onMessage(message);
    }
  },
  
  /**
   * Send the received heartbeat message back to server. So the server
   * knows we are still connected.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */
  Transport.prototype.onHeartbeat = function(heartbeat){
    this.send('~h~' + heartbeat); // echo
  };
  
  /**
   * Notifies the base when a connection to the Socket.IO server has
   * been established. And it starts the connection `timeout` timer.
   *
   * @api private
   */
  Transport.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.base.onConnect();
    this.setTimeout();
  };
  
  /**
   * Notifies the base when the connection with the Socket.IO server
   * has been disconnected.
   *
   * @api private
   */
  Transport.prototype.onDisconnect = function(){
    this.connecting = false;
    this.connected = false;
    this.sessionid = null;
    this.base.onDisconnect();
  };
  
  /**
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
   *
   * @returns {String} Connection url
   * @api private
   */
  Transport.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'https' : 'http') 
      + '://' + this.base.host 
      + ':' + this.base.options.port
      + '/' + this.base.options.resource
      + '/' + this.type
      + (this.sessionid ? ('/' + this.sessionid) : '/');
  };

})();/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io;
  
  /**
   * Create a new `Socket.IO client` which can establish a persisted
   * connection with a Socket.IO enabled server.
   *
   * Options:
   *   - `secure`  Use secure connections, defaulting to false.
   *   - `document`  Reference to the document object to retrieve and set cookies, defaulting to document.
   *   - `port`  The port where the Socket.IO server listening on, defaulting to location.port.
   *   - `resource`  The path or namespace on the server where the Socket.IO requests are intercepted, defaulting to 'socket.io'.
   *   - `transports`  A ordered list with the available transports, defaulting to all transports.
   *   - `transportOption`  A {Object} containing the options for each transport. The key of the object should reflect
   *      name of the transport and the value a {Object} with the options.
   *   - `connectTimeout`  The duration in milliseconds that a transport has to establish a working connection, defaulting to 5000.
   *   - `tryTransportsOnConnectTimeout`  Should we attempt other transport methods when the connectTimeout occurs, defaulting to true.
   *   - `reconnect`  Should reconnection happen automatically, defaulting to true.
   *   - `reconnectionDelay`  The delay in milliseconds before we attempt to establish a working connection. This value will
   *      increase automatically using a exponential back off algorithm. Defaulting to 500.
   *   - `maxReconnectionAttempts`  Number of attempts we should make before seizing the reconnect operation, defaulting to 10.
   *   - `maxReconnectionDuration`  Number of milliseconds for the maximum allowed duration for reconnect attempts.
   *   - `rememberTransport` Should the successfully connected transport be remembered in a cookie, defaulting to true.
   *
   * Examples:
   *
   * Create client with the default settings.
   *
   *     var socket = new io.Socket();
   *     socket.connect();
   *     socket.on('message', function(msg){
   *       console.log('Received message: ' + msg );
   *     });
   *     socket.on('connect', function(){
   *       socket.send('Hello from client');
   *     });
   *
   * Create a connection with server on a different port and host.
   *
   *     var socket = new io.Socket('http://example.com',{port:1337});
   *     var socket = new io.Socket('https://example.com:1337');
   *     var socket = new io.Socket('http://example.com', {secure:true});
   *     var socket = new io.Socket(':1337');
   *
   * @constructor
   * @exports Socket as io.Socket
   * @param {String} [host] The host where the Socket.IO server is located, it defaults to the host that runs the page.
   * @param {Objects} [options] The options that will configure the Socket.IO client. 
   * @property {String} host The supplied host arguments or the host that page runs.
   * @property {Object} options The passed options combined with the defaults.
   * @property {Boolean} connected Whether the socket is connected or not.
   * @property {Boolean} connecting Whether the socket is connecting or not.
   * @property {Boolean} reconnecting Whether the socket is reconnecting or not.
   * @property {Object} transport The selected transport instance.
   * @api public
   */
  var Socket = io.Socket = function SocketIO(){
    var args = Array.prototype.slice.call(arguments, 0)
      , fragments = typeof args[0] === 'string' ? args[0].split(':') : false
      , options = typeof args[args.length -1] !== 'string' ? args[args.length -1] : {};
    
    this.host = document.domain;
    this.options = {
      secure: false
    , document: document
    , port: document.location.port || 80
    , resource: 'socket.io'
    , transports: ["websocket","xhr-polling"]
    , transportOptions: {
        'xhr-polling': {
          timeout: 25000 // based on polling duration default
        }
      , 'jsonp-polling': {
          timeout: 25000
        }
      }
    , connectTimeout: 5000
    , tryTransportsOnConnectTimeout: true
    , reconnect: true
    , reconnectionDelay: 500
    , maxReconnectionAttempts: 10
    , maxReconnectionDuration: Infinity
    , rememberTransport: true
    };
    
    // check if we need to parse down fragments
    if (fragments && fragments.length){
      if (+fragments[fragments.length -1]){
        this.options.port = fragments.pop();
      }
      if (fragments[0]){
        this.options.secure = fragments[0] === 'https';
        this.host = fragments.join(':');
      }
    }
    
    io.util.merge(this.options, options);
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.events = {};
    this.transport = this.getTransport();
    if (!this.transport && 'console' in window) console.error('No transport available');
  };
  
  /**
   * Find an available transport based on the options supplied in the constructor. For example if the
   * `rememberTransport` option was set we will only connect with the previous successfully connected transport.
   * The supplied transports can be overruled if the `override` argument is supplied.
   *
   * Example:
   *
   * Override the existing transports.
   *
   *     var socket = new io.Socket();
   *     socket.getTransport(['jsonp-polling','websocket']);
   *     // returns the json-polling transport because it's availabe in all browsers.
   *
   * @param {Array} [override] A ordered list with transports that should be used instead of the options.transports.
   * @returns {Null|Transport} The available transport.
   * @api private
   */
  Socket.prototype.getTransport = function(override){
    var transports = override || this.options.transports, match;
    if (this.options.rememberTransport && !override){
      match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
      if (match){
        this.rememberedTransport = true;
        match = decodeURIComponent(match[1]);
        // Sort the transports to put the remembered transport first.
        transports = transports.sort(function(a,b){ return b === match ? 1 : -1})
      }
    } 
    for (var i = 0, transport; transport = transports[i]; i++){
      if (io.Transport[transport] 
        && io.Transport[transport].check() 
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck())){
        return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
      }
    }
    return null;
  };
  
  /**
   * Establish a new connection with the Socket.IO server. This is done using the selected transport by the
   * getTransport method. If the `connectTimeout` and the `tryTransportsOnConnectTimeout` options are set
   * the client will keep trying to connect to the server using a different transports when the timeout occurs.
   *
   * Example:
   *
   * Create a Socket.IO client with a connect callback (We assume we have the WebSocket transport avaliable).
   *
   *     var socket = new io.Socket();
   *     socket.connect(function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.connect = function(fn){
    if (this.transport && !this.connected){
      if (this.connecting) this.disconnect(true);
      this.connecting = true;
      this.emit('connecting', [this.transport.type]);
      this.transport.connect();
      if (this.options.connectTimeout){
        var self = this;
        this.connectTimeoutTimer = setTimeout(function(){
          if (!self.connected){
            self.disconnect(true);
            if (self.options.tryTransportsOnConnectTimeout && !self.rememberedTransport){
              if(!self.remainingTransports) self.remainingTransports = self.options.transports.slice(0);
              var transports = self.remainingTransports;
              while(transports.length > 0 && transports.splice(0,1)[0] != self.transport.type){}
              if(transports.length){
                self.transport = self.getTransport(transports);
                self.connect();
              }
            }
            if(!self.remainingTransports || self.remainingTransports.length == 0) self.emit('connect_failed');
          }
          if(self.remainingTransports && self.remainingTransports.length == 0) delete self.remainingTransports;
        }, this.options.connectTimeout);
      }
    }
    if (fn && typeof fn == 'function'){
      this.once('connect',fn);
    }
    return this;
  };
  
  /**
   * Sends the data to the Socket.IO server. If there isn't a connection to the server
   * the data will be forwarded to the queue.
   *
   * @param {Mixed} data The data that needs to be send to the Socket.IO server.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.send = function(data){
    if (!this.transport || !this.transport.connected) return this.queue(data);
    this.transport.send(data);
    return this;
  };
  
  /**
   * Disconnect the established connect.
   *
   * @param {Boolean} [soft] A soft disconnect will keep the reconnect settings enabled.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.disconnect = function(soft){
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    if (!soft) this.options.reconnect = false;
    this.transport.disconnect();
    return this;
  };
  
  /**
   * Adds a new eventListener for the given event.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("connect", function(transport){
   *       console.log("Connected to server using the " + socket.transport.type + " transport.");
   *     });
   *     // => "Connected to server using the WebSocket transport."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.on = function(name, fn){
    if (!(name in this.events)) this.events[name] = [];
    this.events[name].push(fn);
    return this;
  };
  
  /**
   * Adds a one time listener, the listener will be removed after the event is emitted.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.once("custom:event", function(){
   *       console.log("I should only log once.");
   *     });
   *     socket.emit("custom:event");
   *     socket.emit("custom:event");
   *     // => "I should only log once."
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.once = function(name, fn){
    var self = this
      , once = function(){
        self.removeEvent(name, once);
        fn.apply(self, arguments);
      };
    once.ref = fn;
    self.on(name, once);
    return this;
  };
  
  /**
   * Emit a event to all listeners.
   *
   * Example:
   *
   *     var socket = new io.Socket();
   *     socket.on("custom:event", function(){
   *       console.log("Emitted a custom:event");
   *     });
   *     socket.emit("custom:event");
   *     // => "Emitted a custom:event"
   *
   * @param {String} name The name of the event.
   * @param {Array} args Arguments for the event.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.emit = function(name, args){
    if (name in this.events){
      var events = this.events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++)
        events[i].apply(this, args === undefined ? [] : args);
    }
    return this;
  };

  /**
   * Removes a event listener from the listener array for the specified event.
   *
   * Example:
   *
   *     var socket = new io.Socket()
   *       , event = function(){};
   *     socket.on("connect", event);
   *     socket.removeEvent("connect", event);
   *
   * @param {String} name The name of the event.
   * @param {Function} fn The function that is called once the event is emitted.
   * @returns {io.Socket}
   * @api public
   */
  Socket.prototype.removeEvent = function(name, fn){
    if (name in this.events){
      for (var a = 0, l = this.events[name].length; a < l; a++){
        if (this.events[name][a] && (this.events[name][a] == fn || this.events[name][a].ref && this.events[name][a].ref == fn)){
          this.events[name].splice(a, 1);
        }
      }
    }
    return this;
  };
  
  /**
   * Queues messages when there isn't a active connection available. Once a connection has been
   * established you should call the `doQueue` method to send the queued messages to the server.
   *
   * @param {Mixed} message The message that was originally send to the `send` method.
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.queue = function(message){
    if (!('queueStack' in this)) this.queueStack = [];
    this.queueStack.push(message);
    return this;
  };
  
  /**
   * If there are queued messages we send all messages to the Socket.IO server and empty
   * the queue.
   *
   * @returns {io.Socket}
   * @api private
   */
  Socket.prototype.doQueue = function(){
    if (!('queueStack' in this) || !this.queueStack.length) return this;
    this.transport.send(this.queueStack);
    this.queueStack = [];
    return this;
  };
  
  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */
  Socket.prototype.isXDomain = function(){
    var locPort = window.location.port || 80;
    return this.host !== document.domain || this.options.port != locPort;
  };
  
  /**
   * When the transport established an working connection the Socket.IO server it notifies us
   * by calling this method so we can set the `connected` and `connecting` properties and emit
   * the connection event.
   *
   * @api private
   */
  Socket.prototype.onConnect = function(){
    this.connected = true;
    this.connecting = false;
    this.doQueue();
    if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
    this.emit('connect');
  };
  
  /**
   * When the transport receives new messages from the Socket.IO server it notifies us by calling
   * this method with the decoded `data` it received.
   *
   * @param data The message from the Socket.IO server.
   * @api private
   */
  Socket.prototype.onMessage = function(data){
    this.emit('message', [data]);
  };
  
  /**
   * When the transport is disconnected from the Socket.IO server it notifies us by calling
   * this method. If we where connected and the `reconnect` is set we will attempt to reconnect.
   *
   * @api private
   */
  Socket.prototype.onDisconnect = function(){
    var wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    this.queueStack = [];
    if (wasConnected){
      this.emit('disconnect');
      if (this.options.reconnect && !this.reconnecting) this.onReconnect();
    }
  };
  
  /**
   * The reconnection is done using an exponential back off algorithm to prevent
   * the server from being flooded with connection requests. When the transport
   * is disconnected we wait until the `reconnectionDelay` finishes. We multiply 
   * the `reconnectionDelay` (if the previous `reconnectionDelay` was 500 it will
   * be updated to 1000 and than 2000>4000>8000>16000 etc.) and tell the current
   * transport to connect again. When we run out of `reconnectionAttempts` we will 
   * do one final attempt and loop over all enabled transport methods to see if 
   * other transports might work. If everything fails we emit the `reconnect_failed`
   * event.
   *
   * @api private
   */
  Socket.prototype.onReconnect = function(){
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options.reconnectionDelay;
    
    var self = this
      , tryTransportsOnConnectTimeout = this.options.tryTransportsOnConnectTimeout
      , rememberTransport = this.options.rememberTransport;
    
    function reset(){
      if(self.connected) self.emit('reconnect',[self.transport.type,self.reconnectionAttempts]);
      self.removeEvent('connect_failed', maybeReconnect).removeEvent('connect', maybeReconnect);
      self.reconnecting = false;
      delete self.reconnectionAttempts;
      delete self.reconnectionDelay;
      delete self.reconnectionTimer;
      delete self.redoTransports;
      self.options.tryTransportsOnConnectTimeout = tryTransportsOnConnectTimeout;
      self.options.rememberTransport = rememberTransport;
      
      return;
    };
    
    function maybeReconnect(){
      if (!self.reconnecting) return;
      if (!self.connected){
        if (self.connecting && self.reconnecting) return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
        
        if (self.reconnectionAttempts++ >= self.options.maxReconnectionAttempts){
          if (!self.redoTransports){
            self.on('connect_failed', maybeReconnect);
            self.options.tryTransportsOnConnectTimeout = true;
            self.transport = self.getTransport(self.options.transports); // override with all enabled transports
            self.redoTransports = true;
            self.connect();
          } else {
            self.emit('reconnect_failed');
            reset();
          }
        } else {
          self.reconnectionDelay *= 2; // exponential back off
          self.connect();
          self.emit('reconnecting', [self.reconnectionDelay,self.reconnectionAttempts]);
          self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
        }
      } else {
        reset();
      }
    };
    this.options.tryTransportsOnConnectTimeout = false;
    this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);
    
    this.on('connect', maybeReconnect);
  };
  
  /**
   * API compatiblity
   */
  Socket.prototype.fire = Socket.prototype.emit;
  Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
  Socket.prototype.removeListener = Socket.prototype.removeEventListener = Socket.prototype.removeEvent;
  
})();/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an persistent
   * connection with the Socket.IO server. This transport will also be inherited by the
   * FlashSocket fallback as it provides a API compatible polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */
  WS = io.Transport.websocket = function(){
    io.Transport.apply(this, arguments);
  };
  
  io.util.inherit(WS, io.Transport);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {String}
   * @api public
   */
  WS.prototype.type = 'websocket';
  
  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.connect = function(){
    var self = this;
    this.socket = new WebSocket(this.prepareUrl());
    this.socket.onmessage = function(ev){ self.onData(ev.data); };
    this.socket.onclose = function(ev){ self.onDisconnect(); };
    this.socket.onerror = function(e){ self.onError(e); };
    return this;
  };
  
  /**
   * Send a message to the Socket.IO server. The message will automatically be encoded
   * in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.send = function(data){
    if (this.socket) this.socket.send(this.encode(data));
    return this;
  };
  
  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */
  WS.prototype.disconnect = function(){
    if (this.socket) this.socket.close();
    return this;
  };
  
  /**
   * Handle the errors that `WebSocket` might be giving when we
   * are attempting to connect or send messages.
   *
   * @param {Error} e The error.
   * @api private
   */
  WS.prototype.onError = function(e){
    this.base.emit('error', [e]);
  };
  
  /**
   * Generate a `WebSocket` compatible URL based on the options
   * the user supplied in our Socket.IO base.
   *
   * @returns {String} Connection url
   * @api private
   */
  WS.prototype.prepareUrl = function(){
    return (this.base.options.secure ? 'wss' : 'ws') 
    + '://' + this.base.host 
    + ':' + this.base.options.port
    + '/' + this.base.options.resource
    + '/' + this.type
    + (this.sessionid ? ('/' + this.sessionid) : '');
  };
  
  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */
  WS.check = function(){
    // we make sure WebSocket is not confounded with a previously loaded flash WebSocket
    return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
  };
  
  /**
   * Check if the `WebSocket` transport support cross domain communications.
   *
   * @returns {Boolean}
   * @api public
   */
  WS.xdomainCheck = function(){
    return true;
  };
  
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * A small stub function that will be used to reduce memory leaks.
   *
   * @type {Function}
   * @api private
   */
  empty = new Function,
  
  /**
   * We preform a small feature detection to see if `Cross Origin Resource Sharing`
   * is supported in the `XMLHttpRequest` object, so we can use it for cross domain requests.
   *
   * @type {Boolean}
   * @api private
   */ 
  XMLHttpRequestCORS = (function(){
    if (!('XMLHttpRequest' in window)) return false;
    // CORS feature detection
    var a = new XMLHttpRequest();
    return a.withCredentials != undefined;
  })(),
  
  /**
   * Generates the correct `XMLHttpRequest` for regular and cross domain requests.
   *
   * @param {Boolean} [xdomain] Create a request that can be used cross domain.
   * @returns {XMLHttpRequest|false} If we can create a XMLHttpRequest we will return that.
   * @api private
   */
  request = function(xdomain){
    if ('XDomainRequest' in window && xdomain) return new XDomainRequest();
    if ('XMLHttpRequest' in window && (!xdomain || XMLHttpRequestCORS)) return new XMLHttpRequest();
    if (!xdomain){
      try {
        var a = new ActiveXObject('MSXML2.XMLHTTP');
        return a;
      } catch(e){}
    
      try {
        var b = new ActiveXObject('Microsoft.XMLHTTP');
        return b;
      } catch(e){}
    }
    return false;
  },
  
  /**
   * This is the base for XHR based transports, the `XHR-Polling` and the `XHR-multipart` 
   * transports will extend this class.
   *
   * @constructor
   * @extends {io.Transport}
   * @property {Array} sendBuffer Used to queue up messages so they can be send as one request.
   * @api public
   */
  XHR = io.Transport.XHR = function(){
    io.Transport.apply(this, arguments);
    this.sendBuffer = [];
  };
  
  io.util.inherit(XHR, io.Transport);
  
  /**
   * Establish a connection
   *
   * @returns {Transport}
   * @api public
   */
  XHR.prototype.connect = function(){
    this.get();
    return this;
  };
  
  /**
   * Check if we need to send data to the Socket.IO server, if we have data in our buffer
   * we encode it and forward it to the sendIORequest method.
   *
   * @api private
   */
  XHR.prototype.checkSend = function(){
    if (!this.posting && this.sendBuffer.length){
      var encoded = this.encode(this.sendBuffer);
      this.sendBuffer = [];
      this.sendIORequest(encoded);
    }
  };
  
  /**
   * Send data to the Socket.IO server.
   *
   * @param data The message
   * @returns {Transport}
   * @api public
   */
  XHR.prototype.send = function(data){
    if (io.util.isArray(data)){
      this.sendBuffer.push.apply(this.sendBuffer, data);
    } else {
      this.sendBuffer.push(data);
    }
    this.checkSend();
    return this;
  };
  
  /**
   * Posts a encoded message to the Socket.IO server.
   *
   * @param {String} data A encoded message.
   * @api private
   */
  XHR.prototype.sendIORequest = function(data){
    var self = this;
    this.posting = true;
    this.sendXHR = this.request('send', 'POST');
    this.sendXHR.onreadystatechange = function(){
      var status;
      if (self.sendXHR.readyState == 4){
        self.sendXHR.onreadystatechange = empty;
        try { status = self.sendXHR.status; } catch(e){}
        self.posting = false;
        if (status == 200){
          self.checkSend();
        } else {
          self.onDisconnect();
        }
      }
    };
    this.sendXHR.send('data=' + encodeURIComponent(data));
  };
  
  /**
   * Disconnect the established connection.
   *
   * @returns {Transport}.
   * @api public
   */
  XHR.prototype.disconnect = function(){
    // send disconnection signal
    this.onDisconnect();
    return this;
  };
  
  /**
   * Handle the disconnect request.
   *
   * @api private
   */
  XHR.prototype.onDisconnect = function(){
    if (this.xhr){
      this.xhr.onreadystatechange = empty;
      try {
        this.xhr.abort();
      } catch(e){}
      this.xhr = null;
    }
    if (this.sendXHR){
      this.sendXHR.onreadystatechange = empty;
      try {
        this.sendXHR.abort();
      } catch(e){}
      this.sendXHR = null;
    }
    this.sendBuffer = [];
    io.Transport.prototype.onDisconnect.call(this);
  };
  
  /**
   * Generates a configured XHR request
   *
   * @param {String} url The url that needs to be requested.
   * @param {String} method The method the request should use.
   * @param {Boolean} multipart Do a multipart XHR request
   * @returns {XMLHttpRequest}
   * @api private
   */
  XHR.prototype.request = function(url, method, multipart){
    var req = request(this.base.isXDomain());
    if (multipart) req.multipart = true;
    req.open(method || 'GET', this.prepareUrl() + (url ? '/' + url : ''));
    if (method == 'POST' && 'setRequestHeader' in req){
      req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded; charset=utf-8');
    }
    return req;
  };
  
  /**
   * Check if the XHR transports are supported
   *
   * @param {Boolean} xdomain Check if we support cross domain requests.
   * @returns {Boolean}
   * @api public
   */
  XHR.check = function(xdomain){
    try {
      if (request(xdomain)) return true;
    } catch(e){}
    return false;
  };
  
  /**
   * Check if the XHR transport supports corss domain requests.
   * 
   * @returns {Boolean}
   * @api public
   */
  XHR.xdomainCheck = function(){
    return XHR.check(true);
  };
  
  XHR.request = request;
  
})();
/**
 * socket.io-node-client
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function(){
  var io = this.io,
  
  /**
   * A small stub function that will be used to reduce memory leaks.
   *
   * @type {Function}
   * @api private
   */
  empty = new Function(),
  
  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */
  XHRPolling = io.Transport['xhr-polling'] = function(){
    io.Transport.XHR.apply(this, arguments);
  };
  
  io.util.inherit(XHRPolling, io.Transport.XHR);
  
  /**
   * The transport type, you use this to identify which transport was chosen.
   *
   * @type {string}
   * @api public
   */
  XHRPolling.prototype.type = 'xhr-polling';
  
  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */
  XHRPolling.prototype.connect = function(){
    var self = this;
    io.util.defer(function(){ io.Transport.XHR.prototype.connect.call(self) });
    return this;
  };
  
   /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */
  XHRPolling.prototype.get = function(){
    var self = this;
    this.xhr = this.request(+ new Date, 'GET');
    this.xhr.onreadystatechange = function(){
      var status;
      if (this.readyState == 4){
      //if (self.xhr.readyState == 4){
        this.onreadystatechange = empty;
        //self.xhr.onreadystatechange = empty;
        try { status = this.status; } catch(e){}
        //try { status = self.xhr.status; } catch(e){}
        if (status == 200){
          self.onData(this.responseText);
          //self.onData(self.xhr.responseText);
          self.get();
        } else {
          self.onDisconnect();
        }
      }
    };
    this.xhr.send(null);
  };
  
  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */
  XHRPolling.check = function(){
    return io.Transport.XHR.check();
  };
  
  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */
  XHRPolling.xdomainCheck = function(){
    return io.Transport.XHR.xdomainCheck();
  };

})();

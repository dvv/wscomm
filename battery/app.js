'use strict';

/*!
 *
 * Copyright(c) 2011 Vladimir Dronnikov <dronnikov@gmail.com>
 * MIT Licensed
 *
 */

var _ = require('underscore');

/*

Wanted: object with prototyped methods

*/

function invoke() {
	console.log('INVOKE', arguments);
}

var CLIENT_SIDE = typeof window !== 'undefined';

function App() {
}
App.prototype.define = function(name, fn, side) {
	this[name] = (side === 's' ^ CLIENT_SIDE) ? fn : _.bind(invoke, this, name);
};

function cfn() {
	console.log('CFN', this, arguments);
}

function sfn() {
	console.log('SFN', this, arguments);
}

var app = new App();
app.define('cfn', cfn, 'c')
app.define('sfn', sfn, 's')
require('repl').start('node> ').context.app = app;

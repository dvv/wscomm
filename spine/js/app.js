'use strict';

console.log('APPLOADED');

var Foo = Spine.Model.setup('Foo', ['foo', 'bar']);
Foo.extend(Spine.Model.Local);

var runProfile;

var App = Spine.Controller.create({
	elements: {
		'#content': 'body'
	},
	events: {
		'click #content': 'click'
	},
	init: function() {
		//
		// ???
		//
		this.model.bind('refresh change', this.render);
		//
		// define routes
		//
		this.routes({
			'/users/:id': function(id) {
				// Activate controller or something
				console.log('/users/', id)
			},
			'profile': runProfile = function() {
				console.log('SHOULD DISPLAY PROFILE IN #content', this, this.body)
			}
		});
		//
		// goto initial page
		//
		this.navigate('profile', true);
	},
	template: function(items) {
		return $('#contactsTemplate').tmpl(items);
	},
	render: function() {
		console.log('APPRENDER', this, arguments);
		this.el.html(this.template(this.model.all()));
		return this;
	},
	click: function() {
		console.log('CLICK', this, arguments);
	},
	proxied: ['render']
}).init();
// let the history begin
Spine.Route.setup();

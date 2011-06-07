'use strict';

///----------------------

if (!window.console) console = {log: alert};

///----------------------

$.extend(doT.templateSettings, {
	evaluate: /<\?([\s\S]+?)\?>/g,
	interpolate: /<\?-([\s\S]+?)\?>/g,
	encode: /<\?=([\s\S]+?)\?>/g
});
var template = doT.template;

///----------------------

//$('body').data({foo:'bar'});
//alert($('body').data());

//console.log('APPLOADED');
Spine.Events.debug = true;

var runProfile;

var App = Spine.Controller.create({
	el: '#content',
	elements: {
		'#content': 'body',
		'.list ol': 'listEl',
		'.form': 'form'
	},
	events123: {
		'click #content': 'click'
	},
	model: Foo,
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
				console && console.log('/users/', id)
			},
			'profile': runProfile = function() {
				console && console.log('SHOULD DISPLAY PROFILE IN #content', this, this.body)
			}
		});
		//
		// goto initial page
		//
		this.navigate('profile', true);
		//
		// ???
		//
		this.list = Spine.List.create({
			selectFirst: true,
			template: function(items) {
				return template('<?$.each(it,function(i, item){?><li class="item" data-id="<?-item.id?>"><?-JSON.stringify(item)?></li><?});?>')(items);
      }
    }).init({el: this.listEl});
		this.list.bind('change', this.change);
		this.model.bind('refresh change', this.render);
	},
	template: template('shitter <?-JSON.stringify(it)?>'),
	render: function() {
		//console.log('APPRENDER');
		//this.el.html(this.template(this.model.all()));
		this.list.render(this.model.records);
		this.form.html(template('<?-JSON.stringify(it)?>')(this.current));
	},
	click: function() {
		console.log('CLICK', this, arguments);
	},
	change: function (item) {
		this.current = item;
		this.render();
	},
	proxied: ['render', 'change']
}).init();

var users  = Spine.Controller.create({
	el: '#users'
}).init();
var groups = Spine.Controller.create({
	el: '#groups'
}).init();
Spine.Manager.init(users, groups);
users.active();

// let the history begin
Spine.Route.setup();

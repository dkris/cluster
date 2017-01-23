Handlebars.templates = {};

Handlebars.registerHelper('appsLoaded', function(apps) {
	if (apps.length === 0) {
		return 'No apps loaded on server'
	} else if (apps.length === 1) {
		return apps[0].appName + ' recently added';
	} else {
		return apps[apps.length - 1].appName + ' recently added';
	}
});



Handlebars.templates.mesosInfo = Handlebars.compile('<div class="{{class}} {{sub-class}}" role="alert">{{message}}</div>');

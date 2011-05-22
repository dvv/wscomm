var Connect = require('connect');
var Komainu = require('komainu');

var sp = Komainu.createSecurityProvider();
sp.addCredentials('test', 'test', 'LOGGED_IN_USER') // test purposes only

Connect(
	Connect.cookieParser(),
	Connect.session({secret:'mySecretKey'}),
	sp.secure()
).listen(3001);

console.log('Secure connect server listening on port 3000');

var server = require('router').create();
var render = require('../render');

server.get('/', function(request, response) {
	response.end('hi');
});

server.get('/css/*', render.less('./{*}'));

server.get('/js',render.mud('./js.js'));

server.get('/markdown',render.markdown('./index.md'));

server.get('/index', render.template('./index.html',{css:'less.css'}));

server.get('/test', render.file('./test.js'));

server.listen(9020);
console.log('server running in port 9020');
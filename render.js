var common = require('common');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var ghm = require('github-flavored-markdown');
var lesslib = require('less');
var mudlib = require('mud');

var rendermarkdown = function(filename, callback) {
	common.step([
		function(next) {
			fs.readFile(filename, 'utf-8', next);
		},
		function(result) {
			callback(null, ghm.parse(result));
		}
	], callback);
};
var renderless = function(filename, callback) {
	common.step([
		function(next) {
			fs.readFile(filename, 'utf-8', next);
		},
		function(result, next) {
			lesslib.render(result, next);
		},
		function(css) {
			callback(null, css);
		}
	], callback);
};
var rendermud = function(filename, callback) {
	mudlib.resolve(filename, {inline:true}, callback);
};

var aejs = require('async-ejs')
	.add('markdown',rendermarkdown)
	.add('less', renderless)
	.add('mud', rendermud);

var template = function(template, locals) {
	var getOptions = typeof locals === 'function' ? locals : function(params, callback) {
		for(var i in locals) {
			params[i] = params[i] || locals[i];
		}
		callback(null, params);
	};
	
	return function(request, response) {
		common.step([
			function(next) {
				getOptions(request.params || {}, next);
			},
			function(locals, next) {
				aejs.renderFile(template, {locals: locals}, next);
			},
			function(src) {
				response.writeHead(200, {
					'content-type': 'text/html',
					'content-length': Buffer.byteLength(src)
				});
				response.end(src);
			}
		], function(err) {
			response.writeHead(500);
			response.end(err.stack);
		});
	}
};
exports.template = template;

var render = function(fn, location, options) {
	return function(request, response) {
		common.step([
			function(next) {
				var url = common.format(location, request.params);
				fn(url, next);
			},
			function(result, next) {
				var headers = {
					'content-type':options.contentType,
					'content-length':Buffer.byteLength(result),
				};
				if (options.cacheMaxAge !== undefined) {
					headers['cache-control'] = 'public, max-age=' + options.cacheMaxAge;
				}
				response.writeHead(options.status, headers);
				response.end(result);
			}
		], function(err) {
				if(err.errno in {9:1,2:1}) {
					response.writeHead(404);
				} else {
					response.writeHead(500);
				}
				response.end();	
		});
	};	
};

var mud = function(location, options) {
	options = options || {};
	options.status = options.status || 200;
	options.contentType = 'application/javascript';
	
	return render(rendermud, location, options);
};
exports.mud = mud;

var markdown = function(location, options) {
	options = options || {};
	options.status = options.status || 200;
	options.contentType = 'text/html';
	
	return render(rendermarkdown, location, options);
};
exports.markdown = markdown;

var less = function(location, options) {
	options = options || {};
	options.status = options.status || 200;
	options.contentType = 'text/css';
	
	return render(renderless, location, options);
};
exports.less = less;

var file = function(location, options) {
	options = options || {};
	options.status = options.status || 200;
	
	return function(request, response) {
		var url = common.format(location, request.params);

		var onnotfound = function() {
			response.writeHead(404);
			response.end();
		};

		if (/\/\.\.\//.test(url)) { // security check
			onnotfound();
			return;
		}
		
		fs.stat(url, common.fork(onnotfound, function(stat) {
			var headers = {
				'content-type':mime.lookup(url),
				'content-length':stat.size,
				'date':new Date().toUTCString(),
				'last-modified':stat.mtime.toUTCString()
			};
			
			if (options.cacheMaxAge !== undefined) {
				headers['cache-control'] = 'public, max-age=' + options.cacheMaxAge;
			}
			
			response.writeHead(options.status, headers);
			fs.createReadStream(url).pipe(response);
		}));
	};
};
exports.file = file;
var common = require('common');
var mime = require('mime');
var fs = require('fs');
var path = require('path');
var rex = require('rex');
var jade = require('jade');
var stylus = require('stylus');

var configs = {};

var onfile = function(fn) {
	return function(filename, callback) {
		fs.readFile(filename, 'utf-8', common.fork(callback, function(file) {
			fn(file, callback);
		}));
	};
};

var onsecure = function(fn) {
	return function(request, response) {
		if (/(^|\/)\.\.(\/|$)/.test(path.normalize(request.url))) {
			response.writeHead(403);
			response.end();
			return;
		}
		fn(request, response);
	};
};

var normalize = function(locals) {
	locals.params = locals;
	locals.bleeting = true;
	return locals;
};

exports.stylus = function(location) {
	return onsecure(function(request, response) {
		common.step([
			function(next) {
				fs.readFile(common.format(location, request.params), 'utf-8', next);
			},
			function(src, next) {
	            stylus.render(src, next);
			},
			function(str) {
				response.writeHead(200, {
					'content-type': 'text/html; charset=utf-8',
					'content-length': Buffer.byteLength(str)
				});
				response.end(str);
			}
		], function(err) {
			response.writeHead(500);
			response.end(err.stack);
		});
	});
};
exports.rex = function(location) {
	return onsecure(function(request, response) {
		common.step([
			function(next) {
            	rex.parse(common.format(location, request.params), next);
			},
			function(src) {
				response.writeHead(200, {
					'content-type': 'text/javascript; charset=utf-8',
					'content-length': Buffer.byteLength(src)
				});
				response.end(src);
			}
		], function(err) {
			response.writeHead(500);
			response.end(err.stack);
		});
	});
};
exports.jade = function(location, locals) {
	return onsecure(function(request, response) {
		common.step([
			function(next) {
				fs.readFile(common.format(location, request.params), 'utf-8', next);
			},
			function(src) {
			    var str = jade.compile(src, {self:true})(locals);
				response.writeHead(200, {
					'content-type': 'text/html; charset=utf-8',
					'content-length': Buffer.byteLength(str)
				});
				response.end(str);
			}
		], function(err) {
			response.writeHead(500);
			response.end(err.stack);
		});
	});
};
exports.file = function(location, options) {
	options = options || {};
	options.status = options.status || 200;

	var base = options.cacheMaxAge && {'cache-control':'public, max-age='+options.cacheMaxAge};
	
	return onsecure(function(request, response) {
		var filename = common.format(location, request.params);

		var onnotfound = function() {
			response.writeHead(404);
			response.end();
		};

		fs.stat(filename, common.fork(onnotfound, function(stat) {
			var type = mime.lookup(filename);
			var headers = {
				'content-type':type+((/^text\//.test(type) || type === 'application/javascript') ? '; charset=utf-8' : ''),
				'content-length':stat.size,
				'date':new Date().toUTCString(),
				'last-modified':stat.mtime.toUTCString()
			};

			response.writeHead(options.status, base ? common.join(headers, base) : headers);
			fs.createReadStream(filename).pipe(response);
		}));
	});
};
exports.config = function(name, options) {
	configs[name] = options;
	return exports;
};

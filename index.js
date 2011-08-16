var common = require('common');
var aejs = require('async-ejs');

var mime = require('mime');
var fs = require('fs');
var path = require('path');
var rex = require('rex');
var markdown = require('github-flavored-markdown');
var less = require('less');

var configs = {};

var onfile = function(fn) {
	return function(filename, callback) {
		fs.readFile(filename, 'utf-8', common.fork(callback, function(file) {
			fn(file, callback);
		}));
	};
};

var aejs = require('async-ejs')
	.add('less', onfile(function(file, callback) {
		less.render(file, callback);
	}))
	.add('markdown', onfile(function(file, callback) {
		callback(null, markdown.parse(file));
	}))
	.create('rex', function(options) {
		return rex.parser(common.join(options.rex, configs.rex));
	});

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

exports.renderTemplate = function(template, locals, callback) {
	if (!callback) {
		callback = locals;
		locals = {};
	}
	aejs.renderFile(template, {locals:normalize(locals)}, callback);
};

exports.template = function(template, locals) {
	var get = typeof locals === 'function' ? locals : function(request) {
		return common.join(locals, request.params);
	};

	return onsecure(function(request, response) {
		common.step([
			function(next) {
				var params = get(request, response, next);

				if (params && typeof params === 'object') {
					next(null, params); // shortcut
				}
			},
			function(locals, next) {
				aejs.renderFile(common.format(template, request.params), {locals:normalize(locals)}, next);
			},
			function(src) {
				response.writeHead(200, {
					'content-type': 'text/html; charset=utf-8',
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

var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var common = require('common');

var noop = function() {};
var fns = {file:noop};

exports.fn = fns;

var renderFile = function(file, options, callback) {
	if (!callback) {
		callback = options;
		options = {};
	}
	options.cwd = path.dirname(file);
	
	common.step([
		function(next) {
			fs.readFile(file, 'utf-8', next);
		},
		function(template) {
			render(template, options, callback);
		}
	], callback);
};
exports.renderFile = renderFile;

var render = function(src, options, callback) {
	if (!callback) {
		callback = options;
		options = {};
	}
	options.locals = options.locals || {};
	options.visited = options.visited || {};
	options.cwd = options.cwd || '.';
	
	fns.file = function(filename, callback) {
		filename = path.join(options.cwd, filename);
		
		if (options.visited[filename]) {
			callback(new Error('circular file reference: '+filename));
			return;
		}
		options.visited[filename] = true;
		renderFile(filename, options, callback);
	};
	
	common.step([
		function(next) {
			var args = [];
						
			Object.keys(fns).forEach(function(name) {
				options.locals[name] = function() {
					args.push([name].concat(Array.prototype.slice.call(arguments)));
				};
			});

			var result = ejs.render(src, options);
			
			if (!args.length) {
				callback(null, result);
				return;
			}
			
			args.forEach(function(arg) {
				var name = arg.shift();
				
				arg.push(next.parallel());
				fns[name].apply(fns, arg);
			});
		},
		function(results, next) {
			var i = 0;
			
			Object.keys(fns).forEach(function(name) {
				options.locals[name] = function() {
					return results[i++];
				}
			});
			
			src = ejs.render(src, options);
		
			callback(null,src);
		}
	], callback);
};
exports.render = render;

var add = function(name, fn) {
	if (typeof name === 'object') {
		for (var i in name) {
			add(i, name[i]);
		}
		return exports;
	}
	fns[name] = fn;
	
	return exports;
};
exports.add = add;
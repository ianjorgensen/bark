var common = require('common');
var ejs = require('ejs');
var fs = require('fs');

var adds = {};
var creates = {};

adds.raw = function(filename, callback) {
	fs.readFile(filename, 'utf-8', callback);
};
creates.file = function(locals, options) {
	return function(filename, locals, callback) {
		var opt = common.join(options);

		if (!callback) {
			callback = locals;
			locals = options.locals;
		} else {
			locals = common.join(options.locals, locals);
		}

		opt.locals = locals;

		exports.renderFile(filename, opt, callback);
	};
};

exports.add = function(name, fn) {
	adds[name] = fn;
	return exports;	
};
exports.create = function(name, fn) {
	creates[name] = fn;
	return exports;	
};
exports.renderFile = function(filename, options, callback) {
	if (!callback) {
		callback = options;
		options = {};
	}
	fs.readFile(filename, 'utf-8', common.fork(callback, function(src) {
		exports.render(src, options, callback);
	}));
};
exports.render = function(src, options, callback) {
	if (!callback) {
		callback = options;
		options = {};
	}

	options.locals = options.locals || {};
	
	var fns = options.fns;

	if (!fns) {
		options.fns = fns = {};

		for (var i in adds) {
			fns[i] = adds[i];
		}
		for (var i in creates) {
			fns[i] = creates[i](options.locals, options);
		}
	}
	
	common.step([
		function(next) {
			var args = [];
						
			Object.keys(fns).forEach(function(name) {
				options.locals[name] = function() {
					args.push([name].concat(Array.prototype.slice.call(arguments)));
				};
			});

			var clone = common.join(options);

			clone.locals = common.join(clone.locals);

			var result = ejs.render(src, clone);
			
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
		
			callback(null, src);
		}
	], callback);
};
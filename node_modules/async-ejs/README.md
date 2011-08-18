# async-ejs
ejs with the ability to add asynchronous functions

## Install 
	    
	npm install async-ejs

## Usage
Say you have
 
	/index.ejs
	/base.ejs

If base wants to load the content of index.ejs it can do

```js
Template stuff here
<%- file('index.ejs') %>
more template stuff
```	

On the server you need to 

```js
var aejs = require('async-ejs');

aejs.renderFile('./base.ejs', function(err, result) {
	// yay async!
});
```	

## Interface
render a string

```js
aejs.render(src, options?, callback);
```

render a file

```js
aejs.renderFile(filename, options?, callback);
```

add a function to render

```js
aejs.add(name,fn);
```

## Example
Call a unix command from a template and 

```js
var aejs = require('async-ejs').add(exec,require('child_process').exec);
```

now you in your template you can call any unix process and render its output

	Template stuff
	Time: <%- exec('date') %>
	Load CNN: <%- exec('curl -L cnn.com') %>
	Load another template: <%- file('filename') %>
	More template stuff
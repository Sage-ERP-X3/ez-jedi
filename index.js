"use strict";
var fs = require('fs');
var fsp = require('path');
require('ez-streams'); // will load streamline
if (fs.existsSync(fsp.join(__dirname, 'lib'))) {
	module.exports = require('./lib/' + require('streamline-runtime').runtime + '/jedi');
} else {
	module.exports = require('./src/jedi');	
}

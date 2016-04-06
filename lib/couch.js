/********************************
 * REQUIRE MODULE
 ********************************/
var config = require('../config.js');
var couch = require('nano')(config.db.url);


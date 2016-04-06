/******************************
 * SYSTEM INCLUDES
 ******************************/
var express = require('express');
var http = require('http');
var path = require('path');
var fs = require('fs');
var socketio = require('socket.io');

/******************************
 * SETUP EXPRESS
 ******************************/
var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
app.use(app.router);
app.use(express.static(__dirname + '/public'));

/******************************
 * ROUTES
 ******************************/
var routes = require('./routes');

app.get('/', routes.index);
app.post('/analysis', routes.analysis);
app.post('/dbCreate', routes.createdb);
app.post('/dbDelete', routes.deletedb);
app.post('/dbInsert', routes.dbInsert);
app.post('/imageTools', routes.imageTools);
app.post('/delinTools', routes.delinTools);
app.post('/laneTools', routes.laneTools);

/******************************
 * SERVER OPEN
 ******************************/
var httpServer = http.createServer(app);
var io = socketio(httpServer);
io.on('connection', function(client) {
	client.on('disconnect', function(){ 
		console.log('client socket disconnected.');
	});
});

httpServer.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
	routes.initSocket(io);
});

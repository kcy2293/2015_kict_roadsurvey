var config = require('./config.js');
var couch = require('nano')(config.db.url);
var db = couch.db.use("test123");
var fs = require('fs');


var Canvas = require('canvas');
var Image = Canvas.Image;

/*

	ctx.font = '30px Impact';
	ctx.rotate(.1);
	ctx.fillText("Awesome!", 50, 100);

	var te = ctx.measureText('Awesome!');
	ctx.strokeStyle = 'rgba(0,0,0,0.5)';
	ctx.beginPath();
	ctx.lineTo(50, 102);
	ctx.lineTo(50 + te.width, 102);
	ctx.stroke();
	*/

//console.log('<img src="' + canvas.toDataURL() + '" />');

/*
db.attachment.get("20150915_052312580", "TEGRA7_RGB_20150915_052312580.jpg", function(err, body) {
	if (!err) {
		var img = new Image;
		img.src = body;
		console.log("width : " + img.width + " , height : " + img.height);
		//console.log('<img src="' + canvas.toDataURL() + '" />');

		var canvas = new Canvas(img.width, img.height);
		var ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0, img.width, img.height);
		console.log(ctx);
		fs.writeFileSync('test.jpg', body);
		fs.writeFileSync('./src.txt', '<img src="' + canvas.toDataURL() + '" />');
	}
});
*/

var config = require('./config.js');
var couch = require('nano')(config.db.url);
var fs = require('fs');

var db = couch.db.use("test123");
// 데이터베이스로부터 모든 데이터를 추출한다. 
var job1 = function() {
	return new Promise(function(resolve, reject) {
		db.list(function(err, body) {
			if (err) {
				reject(err);
			}

			var docs = {};
			docs.keys = [];

			body.rows.forEach(function(doc) {
				if ((doc.id).indexOf('design') < 0) {
					docs.keys.push(doc.id);
				}
			});
			db.fetch(docs, function(err, body) {
				if (err) {
					reject(err);
				} else {
					resolve(body.rows);
				}
			});
		});
	})
};

var job2 = function(data) {

	var laneBuffer = 16;
	var delinBuffer = 4;
	var delinNearBuffer = 8;
	var seagullBuffer = 8;
	var seagullNearBuffer = 16;

	var updateData = {};
	updateData.docs = [];

	data.forEach(function(doc) {
		var appData = doc.doc.TrackedResult;
		var updateDoc = JSON.parse(JSON.stringify(doc.doc));

		{// road
			updateDoc.PostProcess.RoadProcessInfo = {};
			updateDoc.PostProcess.RoadProcessInfo.ROIArea = appData.DetectedRoadInfo.ROIArea;
		}

		{// lane
			updateDoc.PostProcess.LaneProcessInfo = {};
			updateDoc.PostProcess.LaneProcessInfo.Right_ROIArea = [];
			updateDoc.PostProcess.LaneProcessInfo.RightNear_ROIArea = [];
			var points = JSON.parse(JSON.stringify(appData.DetectedLaneInfo.Right));
			points.sort( function(a, b) {
				if (a.y === b.y) {
					return b.x - a.x;
				}
				return b.y - a.y;
			});
			var sortedPoints = [];
			if (points[0].x > points[1].x) {
				sortedPoints.push(points[1]);
				sortedPoints.push(points[0]);
			} else {
				sortedPoints.push(points[0]);
				sortedPoints.push(points[1]);
			}

			if (points[2].x < points[3].x) {
				sortedPoints.push(points[3]);
				sortedPoints.push(points[2]);
			} else {
				sortedPoints.push(points[2]);
				sortedPoints.push(points[3]);
			}

			sortedPoints[0].x = Number(sortedPoints[0].x) - laneBuffer;
			sortedPoints[1].x = Number(sortedPoints[1].x) + laneBuffer;
			sortedPoints[2].x = Number(sortedPoints[2].x) + laneBuffer;
			sortedPoints[3].x = Number(sortedPoints[3].x) - laneBuffer;

			sortedPoints[0].type = "RN";
			sortedPoints[1].type = "RN";
			sortedPoints[2].type = "RN";
			sortedPoints[3].type = "RN";

			updateDoc.PostProcess.LaneProcessInfo.Right_ROIArea[0] = appData.DetectedLaneInfo.Right;
			updateDoc.PostProcess.LaneProcessInfo.RightNear_ROIArea[0] = sortedPoints;
		}

		{//delinator
			updateDoc.PostProcess.DelinatorProcessInfo = {};
			updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea = [];
			updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea = [];

			var points = appData.DetectedDelinatorInfo.Right;

			points.forEach(function(point, i) {
				updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea[i] = [];
				updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea[i].push({
					'x' : Number(point.x) - delinBuffer,
					'y' : Number(point.y) - delinBuffer,
					'type' : 'D'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea[i].push({
					'x' : Number(point.x) + delinBuffer,
					'y' : Number(point.y) - delinBuffer,
					'type' : 'D'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea[i].push({
					'x' : Number(point.x) - delinBuffer,
					'y' : Number(point.y) + delinBuffer,
					'type' : 'D'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delin_ROIArea[i].push({
					'x' : Number(point.x) + delinBuffer,
					'y' : Number(point.y) + delinBuffer,
					'type' : 'D'
				});

				updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea[i] = [];
				updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea[i].push({
					'x' : Number(point.x) - delinNearBuffer,
					'y' : Number(point.y) - delinNearBuffer,
					'type' : 'DN'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea[i].push({
					'x' : Number(point.x) + delinNearBuffer,
					'y' : Number(point.y) - delinNearBuffer,
					'type' : 'DN'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea[i].push({
					'x' : Number(point.x) - delinNearBuffer,
					'y' : Number(point.y) + delinNearBuffer,
					'type' : 'DN'
				});
				updateDoc.PostProcess.DelinatorProcessInfo.delinNear_ROIArea[i].push({
					'x' : Number(point.x) + delinNearBuffer,
					'y' : Number(point.y) + delinNearBuffer,
					'type' : 'DN'
				});
			});
		}

		{//seagull
			updateDoc.PostProcess.SeagullSignProcessInfo = {};
			updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea = [];
			updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea = [];

			var points = appData.DetectedSeagullSignInfo.Right;

			points.forEach(function(point, i) {
				updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea[i] = [];
				updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea[i].push({
					'x' : Number(point.x) - seagullBuffer,
					'y' : Number(point.y) - seagullBuffer,
					'type' : 'S'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea[i].push({
					'x' : Number(point.x) + seagullBuffer,
					'y' : Number(point.y) - seagullBuffer,
					'type' : 'S'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea[i].push({
					'x' : Number(point.x) - seagullBuffer,
					'y' : Number(point.y) + seagullBuffer,
					'type' : 'S'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gull_ROIArea[i].push({
					'x' : Number(point.x) + seagullBuffer,
					'y' : Number(point.y) + seagullBuffer,
					'type' : 'S'
				});

				updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea[i] = [];
				updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea[i].push({
					'x' : Number(point.x) - seagullNearBuffer,
					'y' : Number(point.y) - seagullNearBuffer,
					'type' : 'SN'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea[i].push({
					'x' : Number(point.x) + seagullNearBuffer,
					'y' : Number(point.y) - seagullNearBuffer,
					'type' : 'SN'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea[i].push({
					'x' : Number(point.x) - seagullNearBuffer,
					'y' : Number(point.y) + seagullNearBuffer,
					'type' : 'SN'
				});
				updateDoc.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea[i].push({
					'x' : Number(point.x) + seagullNearBuffer,
					'y' : Number(point.y) + seagullNearBuffer,
					'type' : 'SN'
				});
			});
		}


		updateData.docs.push(updateDoc);
	});

	return updateData;
};

var job3 = function(data) {
	db.bulk(data, function(err, result) {
		console.log("bulk insert...");
		console.log(result);
	});
};

job1().then(job2).then(job3);

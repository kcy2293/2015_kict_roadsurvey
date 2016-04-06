/********************************
 * GLOBAL VARIABLES
 ********************************/
var fs = require('fs');
var dir = require('node-dir');
var async = require('async');
var path = require('path');
var Promise = require('promise');

var socket = null;

/******************************
 * SETUP DATABASE
 ******************************/
var config = require('../config.js');
var couch = require('nano')(config.db.url);

// create history db table
couch.db.get('history', function(err, body) {
	if (err) {
		if (err.error === 'not_found') {
			couch.db.create('history', function(err, body) {
				if(err) {
					console.error('create history db error!');
				} else {
					console.log('history create..');
				}
			});
		} else {
			console.error('COUCH DB DOSE NOT EXIST : ' + config.db.url);
			process.exit(1);
		}
	}
});

/**************************************
 * 생성된 웹소켓 바인딩
 **************************************/
exports.initSocket = function(io) {
  socket = io;
};

/**************************************
 * 초기화면
 **************************************/
exports.index = function(req, res) {
	couch.db.list(function(err, dbbody) {
		var dbs = [];
		var count = 0;

		dbbody.forEach(function(db) {

			if (db.substr(0, 1) != '_' && db != "history" && db.indexOf("obd_") < 0) {
				dbs.push(db);
			}
			count++;


			if (dbbody.length == count) {
				var database = couch.db.use(dbs[0]);
				var docs = {id:[],lat:[],lon:[],lum:[],dev:[], dlen:[], slen:[]};
				try {
					var resourceDir = fs.readdirSync(config.resource.path);
				} catch(err) {
					console.error(err);
				}

				database.view('GPSLatLon', 'GPSLatLon', function(err, body) {
					if (err) {
						createView(database);
					} else {
						body.rows.forEach(function(doc) {
							docs.id.push(doc.key);
							docs.lat.push(doc.value[0]);
							docs.lon.push(doc.value[1]);
							docs.lum.push(doc.value[2]);
							docs.dev.push(doc.value[3]);
							docs.dlen.push(doc.value[4]);
							docs.slen.push(doc.value[5]);
						});
					}

					res.render('vworld' ,
						{ docslist:JSON.stringify(docs), 
						  db: database.config.db, 
						  dirList: JSON.stringify(resourceDir),
						  dblist:JSON.stringify(dbs)}
					);
				});
			}
		});
	});
};
/**************************************
 * 데이터베이스 뷰 생성  
 **************************************/
function createView(database) {
	database.insert({
		"views": {
			'GPSLatLon' : {
				"map" : function(doc) {
					var delinLen;
					var seagullLen;
					if (doc.PostProcess.DelinatorProcessInfo) {
						delinLen = doc.PostProcess.DelinatorProcessInfo.delin_ROIArea.length || 0;
					} else {
						delinLen = doc.TrackedResult.DetectedDelinatorInfo.Right.length || 0;
					}

					if (doc.PostProcess.SeagullSignProcessInfo) {
						seagullLen = doc.PostProcess.SeagullSignProcessInfo.gull_ROIArea.length || 0;
					} else {
						seagullLen = doc.TrackedResult.DetectedSeagullSignInfo.Right.length || 0;
					}

					emit(doc._id,[ 
						doc.Platform.GPS.Latitude, 
						doc.Platform.GPS.Longitude, 
						doc.TrackedResult.DetectedRoadInfo.Luminance.MeanY, 
						doc.Platform.Device.name,
						delinLen,
						seagullLen
					]); 
				}
			}
		}
	}, '_design/GPSLatLon', function(err, res){
		if (err) {
			console.error('Cannot create view');
		} else {
			console.log("GPSLatLon View create!");
		}
	});
}

/**************************************
 * 데이터베이스 생성
 **************************************/
exports.createdb = function(req, res) {
	var dbname = req.body.dbname;
	couch.db.create(dbname, function(err, body) {
		if (err) {
			console.error(err);
			res.writeHead(err.status_code, {'Content-Type': 'text/plain'});
			res.end();
		} else {
			res.writeHead(201, {'Content-Type': 'text/plain'});
			res.end();
		}
	});
};

/**************************************
 * 데이터베이스 삭제
 **************************************/
exports.deletedb = function(req, res) {
	var dbname = req.body.dbname;
	couch.db.destroy(dbname, function(err, body) {
		if (err) {
			res.writeHead(err.status_code, {'Content-Type': 'text/plain'});
			res.end();
		} else {
			res.writeHead(201, {'Content-Type': 'text/plain'});
			res.end();
		}
	});
};

/**************************************
 * 데이터베이스로 자료입력
 **************************************/
exports.dbInsert = function(req, res) {
	require('date-format-lite');
	var database = couch.db.use(req.body.dbname);
	var dirName = config.resource.path + req.body.dirname;
	async.waterfall([
		/**********************************
		 * STEP.1 extract sub-directory
		 **********************************/
		function(callback) {
			socket.emit('progressMsg', '해당 폴더를 분석중입니다...');
			var dirList = [];
			dir.subdirs(dirName, function(err, subDirs) {
				for (var i=0, len = subDirs.length ; i < len ; i++) {
					var pos = subDirs[i].indexOf('META');
					if (pos > 0) {
						dirList.push(subDirs[i].substring(0, pos));
					}
				}

				if (dirList.length == 0) {
					console.log("DB INSERT ERROR STEP 1 : META 폴더가 존재하지 않습니다.");
					callback("실패 : META 폴더가 존재하지 않습니다.");
				} else {
					callback(null, dirList);
				}
			});
		},
		/***********************************************
		 * STEP.2 extract file information(list, image)
		 ***********************************************/
		function (dirList, callback) {
			socket.emit('progressMsg', '파일과 이미지 정보를 추출중입니다...');
			var fileInfoList = [];
			var fileCnt = 0;
			try {
				for (var i=0, len=dirList.length ; i < len ; i++) {
					var metaDir = dirList[i] + 'META/';
					var fileArr = fs.readdirSync(metaDir);
					fileCnt += fileArr.length;
					var fileInfo = {
						metaDir	: metaDir,
						camDir 	: dirList[i] + 'RGB/',
						LumiDir 	: dirList[i] + 'YUV/',
						TrackDir	: dirList[i] + 'TRACKING/',
						BirdViewDir : dirList[i] + 'BIRDVIEW/',
						fileList	: fileArr
					};

					fileInfoList.push(fileInfo);
				}
			} catch (err) {
				console.error("DB INSERT ERROR STEP 2 : " + err);
				callback("실패 : 파일 정보 추출에 실패하였습니다. ");
			}

			if (fileInfoList.length == 0) {
				console.log("DB INSERT ERROR STEP 2 : META 파일이 존재하지 않습니다.");
				callback("실패 : META 파일이 존재하지 않습니다.");
			} else {
				callback(null, fileInfoList, fileCnt);
			} 
		},
		/**********************************
		 * STEP.3 insert data to db
		 **********************************/
		function(fileInfoList, fileCnt, callback) {
			socket.emit('progressMsg', '데이터베이스에 데이터를 입력중입니다...');
			var okMsg = [];
			var errMsg = [];
			var count = 0;

			for (var i=0, len=fileInfoList.length ; i < len ; i++) {
				dataInsert( function(err, success) {
					if (err) {
						errMsg.push(err);
					} else {
						okMsg.push(success);
					}
					count = errMsg.length + okMsg.length;
					socket.emit('cntNow', (count / fileCnt) * 100);

					if (count == fileCnt) {
						callback(null, okMsg, errMsg);
					}
				});

				function dataInsert (result) {
					var fileList = fileInfoList[i].fileList;
					for ( var j = 0 , fileLen = fileList.length ; j < fileLen ; j++) {
						if (fileList[j].indexOf("json") < 0) {
							result("JSON 파일 아닙니다");
							continue;
						}
						if (fileList[j].indexOf("swp") > 0) {
							result("JSON 파일 아닙니다");
							continue;
						}

						var filePath = fileInfoList[i].metaDir + fileList[j];
						try {
							var jsObj = JSON.parse(fs.readFileSync(filePath));
						} catch(err) {
							console.error("DB INSERT ERROR STEP 3 : " + err.code + " - " + filePath);
							result(filePath + " : JSON 파일 읽기 오류입니다. ");
							continue;
						}

						var key	= jsObj.Platform.Camera.SysTime;
						var temp = (jsObj.Platform.Camera.File).split("/");
						var camImg = temp[temp.length-1];
						try {
							var camImgData = fs.readFileSync(fileInfoList[i].camDir+camImg);
						} catch(err) {
							console.error("DB INSERT ERROR STEP 3 : " + err.code + " - " + fileInfoList[i].camDir+camImg);
							result(camImg + " 이미지 데이터가 존재하지 않습니다. ", null);
							continue;
						}

						var device = camImg.split("_")[0];
						jsObj.Platform.Device.name = device;
						temp = (jsObj.TrackedResult.DetectedRoadInfo.Luminance.YUV).split("/");
						var LumiImg = temp[temp.length-1];
						try {
							var LumiImgData = fs.readFileSync(fileInfoList[i].LumiDir+LumiImg);
						} catch(err) {
							console.error("DB INSERT ERROR STEP 3 : " + err.code + " - " + fileInfoList[i].LumiDir+LumiImg);
							result(LumiImg + " 이미지 데이터가 존재하지 않습니다. ", null);
							continue;
						}
						temp = (jsObj.TrackedResult.File).split("/");
						var TrackImg = temp[temp.length-1];
						try {
							var TrackImgData = fs.readFileSync(fileInfoList[i].TrackDir+TrackImg);
						} catch(err) {
							console.error("DB INSERT ERROR STEP 3 : " + err.code + " - " + fileInfoList[i].TrackDir+TrackImg);
							result(TrackImg + " 이미지 데이터가 존재하지 않습니다. ", null);
							continue;
						}

						temp = (jsObj.Tracking.WarpPerspectiveInfo.BirdView).split("/");
						var BirdViewImg = temp[temp.length-1];
						try {
							var BirdViewImgData = fs.readFileSync(fileInfoList[i].BirdViewDir+BirdViewImg);
						} catch(err) {
							console.error("DB INSERT ERROR STEP 3 : " + err.code + " - " + fileInfoList[i].BirdViewDir+BirdViewImg);
							result(BirdViewImg + " 이미지 데이터가 존재하지 않습니다. ", null);
							continue;
						}

						var attachImg = [
							{ name: camImg,   data: camImgData,  content_type: 'image/jpg' },
							{ name: LumiImg,  data: LumiImgData, content_type: 'image/jpg' },
							{ name: TrackImg, data: TrackImgData,content_type: 'image/jpg' },
							{ name: BirdViewImg, data: BirdViewImgData,content_type: 'image/jpg' }
						];

						jsObj.PostProcess = {
							"RoadProcessInfo" : "",
							"LaneProcessInfo" : "",
							"DelinatorProcessInfo" : "",
							"SeagullSignProcessInfo" : ""
						};

						database.multipart.insert(jsObj, attachImg, key, function(err, body) {
							if (err) {
								result("이미지 데이터 저장에 실패하였습니다.", null);
							} else {
								result(null, body.ok+','+body.id);
							}
						});
					}
				}
			}
		}
	],
	/**************************************************
	* STEP 4. render result msg & insert history table
	***************************************************/
	function(err, okMsg, errMsg) {
		if (err) {
			res.writeHead(503, {'Content-Type': 'text/plain'});
			res.end(err);
		} else {
			if (errMsg.length != 0) {
				createView(database);
				res.writeHead(202, {'Content-Type': 'text/plain'});
				res.end("성공 : " + okMsg.length +" , 실패 : " + errMsg.length);
			} else {
				setHistory(function() {
					database.view('GPSLatLon', 'GPSLatLon', function(err, body) {
						if (err) {
							createView(database);
						}
						res.writeHead(201, {'Content-Type': 'text/plain'});
						res.end();
					});
				});

				function setHistory( doAfter ) {
					var date = new Date();
					var historyKey = date.format("YYYYMMDD_hhmmssms");
					var historyVal = {"dbName":req.body.dbName,"resouce":dirName};
					var history = couch.db.use('history');

					history.insert(historyVal, historyKey, function(err, body, header) {
						if (err) {
							console.error(key + ' history insert error');
						} else {
							doAfter();
						}
					});
				} 
			}
		}
	});
};

/**************************************************
 * 이미지 편집 툴 페이지 생성 (노면밝기 이미지툴)
 **************************************************/
exports.imageTools = function(req, res) {
	res.render('imageEditor',{
		imgPath: req.body.imgPath
		, updateUrl: req.body.updateUrl
	});
};

/**************************************************
 * 이미지 편집 툴 페이지 생성 (선형유도시설 밝기 편집툴)
 **************************************************/
exports.delinTools = function(req, res) {
	res.render('delinEditor',{
		imgPath: req.body.imgPath
		, updateUrl: req.body.updateUrl
	});
};

/**************************************************
 * 이미지 편집 툴 페이지 생성 (차선 밝기 편집툴)
 **************************************************/
exports.laneTools = function(req, res) {
	res.render('laneEditor',{
		imgPath: req.body.imgPath
		, updateUrl: req.body.updateUrl
	});
};

/**************************************
 * 분석 배치
 **************************************/
exports.analysis = function(req, res) {
	res.end();
	var dbname = req.body.dbname;

	if (dbname == null || dbname == undefined) {
		socket.emit('err-analysis', "dbname is null");
	}
	var db = couch.db.use(dbname);
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
					if (i >= 20) {
						return;
					}
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
					if (i >= 20) {
						return;
					}
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
			if (!err) {
				console.log("bulk update success : " + result.length);
				socket.emit('end-analysis');
			} else {
				console.error(err);
				socket.emit('err-analysis', err);
			}
		});
	};

	job1()
		.then(job2)
		.then(job3)
		.catch(function(err) {
			console.log("catch error : " + err);
			socket.emit('err-analysis', err);
		});
	/*

	job1().then(function(data) {
		console.log(data);
		console.log(data.length);
		socket.emit('end-analysis');
	}).catch(function(err) {
		console.log(err);
		socket.emit('err-analysis', err);
	});
	*/
};

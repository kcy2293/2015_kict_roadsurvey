/*************************
 * GLOBAL VARIABLES
 *************************/
var saveDialog;
var delinInfo = [];
var seaGullInfo = [];
var delinNearInfo = [];
var seaGullInfo = [];
var delinMeanY = 0.0;
var savePolygon;
var selectedColor = Cookies.get("selectedColor") || "#000";

/**************
 * 실행 순서
 **************/
createDialog();

function createCanvas() {
	var canvas = document.createElement("canvas");
	var img = new Image;
	img.crossOrigin = 'anonymous';
	img.onload = function() {
		canvas.width = img.width;
		canvas.height = img.height;
		canvas.getContext('2d').drawImage(img, 0, 0);
	}

	img.src = imgpath;
	$("#testCanvas").append(canvas);
}

/********************
 * CLEAR 버튼 클릭시
 ********************/
$("#clear").click(function() {
	var len = local.paths.length;
	for (var i = 0 ; i < len  ; i++) {
		var jlen = local.paths[i].points.length;
		for (var j = 0; j < jlen ; j++) {
			if (local.paths[i].points[j].box) {
				local.paths[i].points[j].box.remove();
			}
		}
		local.paths[i].points.splice(0, jlen);
		updatePath(local.paths[i]);
		updateExport();
	}

	local.paths = new Array();
	local.oldExportStr = "";
	local.currentPath = 0;
	local.drag = -1;
	local.seletedIdx = -1;

	$("#exportArea").val("");
	$("#pathListbox")
		.find("option")
		.remove()
		.end()
		.append($('<option>').text("[New]")); 

});

/********************
 * SAVE 버튼 클릭시
 ********************/
$("#save").click(function() {

	// save 버튼 클릭시 테스티 및 전송 데이터 초기화
	delinInfo = [];
	delinNearInfo = [];
	seaGullInfo = [];
	seaGullNearInfo = [];

	$("#testCanvas").children().remove();

	var polygonStr = $("#exportArea").val();
	if (polygonStr !== '') {
		var polygons = extractArea(polygonStr);
		savePolygon = extractPolygon(polygonStr);

		//console.log(polygons);

		for (var n = 0, plen = polygons.length ; n < plen ; n++) {
			var polygon = polygons[n];
			var polyLen = polygon.length;

			if (polyLen > 3) {
				var minPoint = polygon[0].slice();
				var maxPoint = polygon[0].slice();

				/*
				for(var i = 0 ; i < polyLen ; i++) {
					var currX = polygon[i][0];
					var currY = polygon[i][1];

					console.log(" i = " + i + " , currX = " + currX + " , currY = " + currY );
				}
				*/

				for(var i = 1 ; i < polyLen ; i++) {
					var currX = polygon[i][0];
					var currY = polygon[i][1];

					// compare x
					if ( currX < minPoint[0] ) {
						minPoint[0] = currX;
					} else if ( currX > maxPoint[0] ) {
						maxPoint[0] = currX;
					}

					// compare y
					if ( currY < minPoint[1] ) {
						minPoint[1] = currY;
					} else if ( currY > maxPoint[1] ) {
						maxPoint[1] = currY;
					}
				}

				//console.log("minPoint = " + minPoint + " , maxPoint + " + maxPoint);

				clippingPath(n, polygon, minPoint, maxPoint);
			}
		}

		var delinInfoLen = delinInfo.length;
		var seaGullInfoLen = seaGullInfo.length;

		var popupText = "";
		popupText +=
			"<div class='tableTitle'>델리네이터</div>" + 
			"<div class='popupTable'><table>" + 
					"<tr><td>no.</td><td>자체밝기</td><td>주변밝기</td><td>대비</td></tr>";


		for (var i = 0 ; i < delinInfoLen ; i++) {
			var contrast = (Number(delinInfo[i].meanY) / Number(delinNearInfo[i].meanY)).toFixed(2);
			delinInfo[i].contrast = contrast;

			popupText += 
				"<tr><td>" + (i+1) + "</td><td> " + delinInfo[i].meanY + "</td><td>" +
				delinNearInfo[i].meanY + "</td><td>" + contrast + "</td></tr>";
		}

		popupText += "</table></div>";
		popupText +=
			"<br/>" + 
			"<div class='tableTitle'>갈매기표지</div>" + 
			"<div class='popupTable'><table>" + 
					"<tr><td>no.</td><td>자체밝기</td><td>주변밝기</td><td>대비</td></tr>";
		for (var i = 0 ; i < seaGullInfoLen ; i++) {
			var contrast = (Number(seaGullInfo[i].meanY) / Number(seaGullNearInfo[i].meanY)).toFixed(2);
			seaGullInfo[i].contrast = contrast;

			popupText +=
				"<tr><td>" + (i+1) + "</td><td> " + seaGullInfo[i].meanY + "</td><td>" +
				seaGullNearInfo[i].meanY + "</td><td>" + contrast + "</td></tr>";
		}

		popupText += "</table></div>";

		var infoHeight = (delinInfoLen + seaGullInfoLen) * 25 + 200;
		if (infoHeight > 700) infoHeight = 700;
		saveDialog.dialog({"height" : infoHeight});

		/*
		if (delinInfoLen > 0) {
			popupText += 
				  "<p>표지병 자체밝기 : "+ delinInfo[0].meanY + "</p>" +
				  "<p>표지병 주변밝기 : "+ delinNearInfo[0].meanY + "</p>";
		} 
		if (seaGullInfoLen > 0) {
			popupText += 
				  "<p>갈매기표지 자체밝기 : "+ seaGullInfo[0].meanY + "</p>" +
				  "<p>갈매기표지 주변밝기 : "+ seaGullNearInfo[0].meanY + "</p>";
		}
		*/
		$("#confirmMsg").html(popupText);
		saveDialog.dialog("open","parameter");

	} else {
		updateDoc(function(succeed) {
			window.close();
		});
	}
});

/************************
 * 다이얼로그 모달 생성
 ************************/
function createDialog() {
	saveDialog = $("#saveInfo").dialog( {
		autoOpen: false,
		height: 310,
		width: 350,
		modal: true,
		open: function() {
			$("#editToolSource").trigger('click');
		},
		close: function() {
			$("#addToolSource").trigger('click');
		},
		buttons: {
			"저장": function() {
				updateDoc(function(succeed) {
					if (succeed === false) {
						saveDialog.dialog("close");
						alert("밝기값 정도 업데이트 실패!! 관리자에게 문의바랍니다");
					} else {
						/*
						var wannaClose = window.confirm("현재 창을 닫으시겠습니까?");
						if (wannaClose === true) {
							opener.location.reload();
							window.close();
						} 
						*/
							//opener.location.reload();
							window.close();
					}
				});
			},
			"취소": function() {
				saveDialog.dialog("close");
			}
		}
	});
}

/************************
 * 데이터 SAVE
 ************************/
function updateDoc(todo) {
	if (updateUrl != null) {
		var updateData;
		$.ajax({
			url: updateUrl, 
			dataType: 'JSON', 
			jsonpCallback: 'callback', 
			type: 'GET', 
			success: function(data) {
				if (typeof data === 'string') {
					updateData = $.parseJSON(data);
				} else {
					updateData = data;
				}
				//console.log(updateData);

				/*
				updateData.PostProcess = { 
					DelinatorProcessInfo : { 
						delineator : null,
						screenPos : null
					}, 
					SeagullSignInfo : {
						delineator : null,
						screenPos : null
					}
				};
				*/

				var delinRoi = [];
				var delinNearRoi = [];
				var seaGullRoi = [];
				var seaGullNearRoi = [];

				if (!savePolygon) savePolygon = [];

				for (var i = 0, len = savePolygon.length ; i < len ; i++) {
					var type = savePolygon[i][0].type;
					if (type === "D") {
						delinRoi.push(savePolygon[i]);
					}
					else if (type === "DN") {
						delinNearRoi.push(savePolygon[i]);
					}
					else if (type === "S") {
						seaGullRoi.push(savePolygon[i]);
					}
					else if (type === "SN") {
						seaGullNearRoi.push(savePolygon[i]);
					}
				}

				updateData.PostProcess.DelinatorProcessInfo = {};
				updateData.PostProcess.DelinatorProcessInfo.delin_Luminance = JSON.stringify(delinInfo);
				updateData.PostProcess.DelinatorProcessInfo.delin_ROIArea = delinRoi;
				updateData.PostProcess.DelinatorProcessInfo.delinNear_Luminance = JSON.stringify(delinNearInfo);
				updateData.PostProcess.DelinatorProcessInfo.delinNear_ROIArea = delinNearRoi;

				updateData.PostProcess.SeagullSignProcessInfo = {};
				updateData.PostProcess.SeagullSignProcessInfo.gull_Luminance = JSON.stringify(seaGullInfo);
				updateData.PostProcess.SeagullSignProcessInfo.gull_ROIArea = seaGullRoi;
				updateData.PostProcess.SeagullSignProcessInfo.gullNear_Luminance = JSON.stringify(seaGullInfo);
				updateData.PostProcess.SeagullSignProcessInfo.gullNear_ROIArea = seaGullNearRoi;

				if (updateData != null) {
					$.ajax({
						url: updateUrl, 
						type: "PUT", 
						contentType: "application/json; charset=utf-8" , 
						dataType: "json" , 
						data: JSON.stringify(updateData) , 
						success: function(result) {
							if (result.ok === true) {
								alert('DB에 업데이트가 완료되었습니다');
								todo(true);
							} else {
								console.error(result);
								alert('데이터 업데이터에 실패하였습니다. 다시 시도해주세요.');
								todo(false);
							}
						}, 
						error: function(err) {
							console.error(err);
							todo(false);
						}
					});
				}
			}, 
			error: function(err) {
				console.error(err);
				todo(false);
			}
		});
	} else {
		todo(false);
	}
}
/************************************************************
 * 해당 영역만 추출하기 위해 캔버스를 생성한다. 
 *************************************************************/
function getNewContext() {
	var canvas = document.createElement("canvas");
	canvas.width = $("#traceImage").width();
	canvas.height = $("#traceImage").height();
	$("#testCanvas").append(canvas);
	var context = canvas.getContext('2d');

	return context;
}

/************************************************************
 * 넘겨받은 polygon data를 바탕으로 clip image를 구성하고
 * 최소,최대 x,y 값을 바탕으로 픽셀데이터를 추출, 계산한다.
*************************************************************/
function clippingPath(index, polygon, minPoint, maxPoint) {
	var clipImg = $("#traceImage")[0];
	var clipContext = getNewContext();

	clipContext.save();
	clipContext.beginPath();
	clipContext.moveTo(polygon[0][0], polygon[0][1]);
	for(var j = 1, jLen = polygon.length; j < jLen ; j++) {
		clipContext.lineTo(polygon[j][0], polygon[j][1]);
	}
	clipContext.closePath();
	clipContext.clip();
	clipContext.drawImage(clipImg, 0, 0);
	clipContext.restore();


	var maxX = maxPoint[0];
	var maxY = maxPoint[1];

	var count = 0;
	var totalY = 0.0;
	var minLum = 256.0;
	var maxLum = 0.0;

	var xGap = maxX - minPoint[0];
	var yGap = maxY - minPoint[1];

	var clipImgData = clipContext.getImageData(minPoint[0], minPoint[1], xGap, yGap);

	var pixels = clipImgData.data;
	var lumData = [];

	for (var i = 0, len = xGap*yGap ; i < len ; i++) {
		var R = parseInt(pixels[i*4]);
		var G = parseInt(pixels[i*4+1]);
		var B = parseInt(pixels[i*4+2]);

		var y = R *  0.299000 + G *  0.587000 + B *  0.114000;
		y = Math.floor(y*100) / 100;

		lumData.push(y);
		totalY += y;
		if (y < minLum) {
			minLum = y;
		}
		if (y > maxLum) {
			maxLum = y;
		}

		count++;
	}

	var meanY = (totalY / count).toFixed(2);
	var data = {"meanY" : meanY, "MinY" : minLum, "MaxY" : maxLum, "clickPos" : local.clickPos[index], "lumData" : lumData };

	var type = polygon[0][2] || "D" ;

	if (type === "D") {
		delinInfo[delinInfo.length] = data;
	} else if (type ==="S") {
		seaGullInfo[seaGullInfo.length] = data;
	} else if (type === "DN") {
		delinNearInfo[delinNearInfo.length] = getNearLumData(lumData, type);
	} else if (type ==="SN") {
		seaGullNearInfo[seaGullNearInfo.length] = getNearLumData(lumData, type);
	}
}

/**************************************************************
 * 주변밝기에서 중심밝기를 제외한다.
 **************************************************************/
function getNearLumData(lumData, type) {
	var nearLumData = [];

	var boundary, len;
	if (type === "DN") {
		boundary = local.boundaryD;
		len = local.nearD * 2;
	} else if(type =="SN") {
		boundary = local.boundaryS;
		len = local.nearS * 2;
	}
	var br = len - boundary;

	var totalY = 0.0;
	for (var i = 0 ; i < len ; i++) {
		for (var j = 0 ; j < len ; j++) {
			if ( (boundary <= j && j < br) && (boundary <= i && i < br) ) {
				continue;
			}
			var data = lumData[i*len + j];
			nearLumData.push(data);
			totalY += data;
		}
	}

	var meanY = (totalY / nearLumData.length).toFixed(2);
	var result = {"meanY" : meanY, "lumData" : nearLumData};

	return result;
}

/**************************************************************
 * polygonString을 받아서 이미지와 매칭되는 좌표들로 변환한다.
 **************************************************************/
function extractArea(polygonStr) {
	var image = $("#traceImage");
	var grid = $("#drawAreaSource");

	var imagePosLeft = image.offset().left;
	var imagePosTop = image.offset().top;

	function polygon(param, type) {
		var imgLocArr = [];
		for(var i = 0, len = param.length ; i < len ; i++) {
			var x = param[i][0];
			var y = param[i][1];

			var imgLocX = Math.floor(toX(x) - imagePosLeft + grid.offset().left);
			var imgLocY = Math.floor(toY(y) - imagePosTop + grid.offset().top);

			var imgLoc = [imgLocX, imgLocY, type];
			imgLocArr.push(imgLoc);
		}
		return imgLocArr;
	}

	function toX(x) { return x * local.gridSize + local.centerX; }
	function toY(y) { return -y * local.gridSize + local.centerY; }

	var polygons = polygonStr.split('\n');
	var pArr = [];
	for (var i = 0, len = polygons.length ; i < len ; i++) {
		var str = polygons[i];
		if (str != "") {
			pArr.push(eval(str));
		}
	}
	return pArr;
}

/**************************************************************
 * polygonString을 받아서 좌표데이터 자체를 추출
 **************************************************************/
function extractPolygon(polygonStr) {
	var image = $("#traceImage");
	var grid = $("#drawAreaSource");

	var imagePosLeft = image.offset().left;
	var imagePosTop = image.offset().top;
	var centerX = grid.width();
	centerX -= centerX % 128;
	centerX /= 2;
	centerX += grid.offset().left;
	var centerY  = local.imgHeight - grid.offset().top * 3;
	centerY -= centerY % 128;
	centerY /= 2;
	centerY += grid.offset().top;

	var index = 0;
	function polygon(param, type) {
		var imgLocArr = [];
		for(var i = 0, len = param.length ; i < len ; i++) {
			var imgLocX = toX(param[i][0]) - imagePosLeft;
			var imgLocY = toY(param[i][1]) - imagePosTop;
			var imgLoc = {"x" : imgLocX, "y" : imgLocY, "color" : local.colorSet[index], "type" : type};
			imgLocArr.push(imgLoc);
		}
		return imgLocArr;
	}

	function toX(x) { return x * local.gridSize + centerX; }
	function toY(y) { return -y * local.gridSize + centerY; }

	var polygons = polygonStr.split('\n');
	var pArr = [];

	for (var i = 0, len = polygons.length ; i < len ; i++) {
		index = i;
		var str = polygons[i];
		if (str != "") {
			pArr.push(eval(str));
		}
	}
	return pArr;
}

/********************
 * color picker 클릭시
 ********************/
$('.color-box').colpick({
	layout:'hex',
	submit: 0,
	color: selectedColor,
	onChange: function(hsb, hex, rgb, el, bySetColor) {
		$(el).css('background-color', '#'+hex);
		selectedColor = '#' + hex;
		Cookies.set("selectedColor", selectedColor, {expires: 1});
	}
})
.css('background-color', selectedColor);


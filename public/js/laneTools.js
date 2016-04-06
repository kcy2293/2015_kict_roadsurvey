/*************************
 * GLOBAL VARIABLES
 *************************/
var selectedColor = Cookies.get("selectedColor") || "#000";
var laneRInfo =[];
var laneRNearInfo = [];
var savePolygon = "";
var srcContext;
var thresholdVal = 1.15;

var srcCanvas = document.createElement("canvas");
var srcContext = srcCanvas.getContext('2d');
var img = new Image;
img.crossOrigin = 'anonymous';
img.onload = function() {
	srcCanvas.width = img.width;
	srcCanvas.height = img.height;
	srcContext.drawImage(img, 0, 0);
};
img.src = imgpath;

/************************
 * 다이얼로그 모달 생성
 ************************/
var	saveDialog = $("#saveInfo").dialog( {
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
						alert("업데이트 URL이 필요합니다. 관리자에게 문의바랍니다!");
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

/********************
 * SAVE 버튼 클릭시
 ********************/
$("#save").click(function() {

	laneRInfo =[];
	laneRNearInfo = [];
	$("#testCanvas").children().remove();

	var polygonStr = $("#exportArea").val();
	if (polygonStr !== '') {
		var polygons = extractArea(polygonStr);
		savePolygon = extractPolygon(polygonStr);

		var nearPolygon = polygons[1];
		if (nearPolygon[0][2] != "RN") {
			nearPolygon = polygons[0];
		}

		var coord = [];
		for (var n = 0, plen = nearPolygon.length ; n < plen ; n++) {
			console.log(nearPolygon[n]);
			coord.push({x:nearPolygon[n][0], y: nearPolygon[n][1]});
		}

		coord.sort( function(a, b) {
			if (a.y === b.y) {
				return a.x - b.x;
			}
			return a.y - b.y;
		});

		var box = {};

		if(coord[0].x < coord[1].x) {
			box.toplx = coord[0].x;
			box.toply = coord[0].y;
			box.toprx = coord[1].x;
			box.topry = coord[1].y;
		} else {
			box.toplx = coord[1].x;
			box.toply = coord[1].y;
			box.toprx = coord[0].x;
			box.topry = coord[0].y;
		}

		if (coord[2].x < coord[3].x) {
			box.btmlx = coord[2].x;
			box.btmly = coord[2].y;
			box.btmrx = coord[3].x;
			box.btmry = coord[3].y;
		} else {
			box.btmlx = coord[3].x;
			box.btmly = coord[3].y;
			box.btmrx = coord[2].x;
			box.btmry = coord[2].y;
		}

		box.lx = (box.toplx < box.btmlx) ? box.toplx : box.btmlx;
		box.rx = (box.toprx > box.btmrx) ? box.toprx : box.btmrx;
		box.ty = (box.toply < box.topry) ? box.toply : box.topry;
		box.by = (box.btmly > box.btmry) ? box.btmly : box.btmry;
		box.xGap = box.rx - box.lx;
		box.yGap = box.by - box.ty;

		var context = runAdaptiveThres(box);
		var srcData = srcContext.getImageData(0, 0, img.width, img.height).data;
		var adapData = context.getImageData(0, 0, img.width, img.height).data;
		var testContext = getNewContext();

		var w = img.width;
		var h = img.height;

		var nearLum = [];
		var roadLum = [];
		var nearTotalLum = 0;
		var roadTotalLum = 0;

		for (var i = 0, len = w * h ; i < len ; i++) {
			var R = adapData[i*4];
			var G = adapData[i*4+1];
			var B = adapData[i*4+2];

			var x = i % w;
			var y = Number.parseInt(i / w);

			if ((R == 0) && (G == 0) && (B == 255)) {
			} else if ((R == 0) && (G == 0) && (B == 0)) {
				// BLACK ==> Near
				testContext.beginPath();
				testContext.fillStyle = "red";
				//testContext.fillStyle = "rgba(" + srcData[i*4] + "," + srcData[i*4+1] + "," + srcData[i*4+2] + "," + srcData[i*4+3] + ")";
				testContext.fillRect(x, y, 1, 1);

				var lum = srcData[i*4] *  0.299 + srcData[i*4+1] *  0.587 + srcData[i*4+2] *  0.114;
				nearLum.push(lum);
				nearTotalLum += lum;

			} else if ((R == 255) && (G == 255) && (B == 255)) {
				// WHITE ==> Road
				testContext.beginPath();
				testContext.fillStyle = "green";
				//testContext.fillStyle = "rgba(" + srcData[i*4] + "," + srcData[i*4+1] + "," + srcData[i*4+2] + "," + srcData[i*4+3] + ")";
				testContext.fillRect(x, y, 1, 1);

				var lum = srcData[i*4] *  0.299 + srcData[i*4+1] *  0.587 + srcData[i*4+2] *  0.114;
				roadLum.push(lum);
				roadTotalLum += lum;
			}
		}

		var roadMeanLum = 0;
		if ( roadLum.length != 0 ) {
			roadMeanLum = roadTotalLum / roadLum.length;
		}
		console.log("roadLumCount : " + roadLum.length);
		console.log("roadTotalLum : " + roadTotalLum);
		console.log("roadMeanLum : " + roadMeanLum);

		var nearMeanLum = 0;
		if ( nearLum.length != 0 ) {
			nearMeanLum = nearTotalLum / nearLum.length;
		}

		console.log("nearLumCount : " + nearLum.length);
		console.log("nearTotalLum : " + nearTotalLum);
		console.log("nearMeanLum : " + nearMeanLum);

		var contrast = 0;
		if (nearMeanLum != 0) {
			contrast = roadMeanLum / nearMeanLum
		}

		laneRInfo[laneRInfo.length] = {
			"meanY" : roadMeanLum.toFixed(4),
			"contrast" : contrast.toFixed(4),
			"lumData" : roadLum

		};
		laneRNearInfo[laneRNearInfo.length] = {
			"meanY" : nearMeanLum.toFixed(4),
			"lumData" : nearLum
		};

		$("#confirmMsg").html(
			  "<p>차선 평균 밝기 : " + roadMeanLum.toFixed(4)
			+ "</p><p>차선 주변 평균 밝기 : "+ nearMeanLum.toFixed(4)
			+ "</p><p>대비 : " + contrast.toFixed(4)
			+ "</p><p>해당 정보를 업데이트 하시겠습니까?</p>"
		);

		saveDialog.dialog("open","parameter");

	} else {
		updateDoc(function(succeed) {
			window.close();
		});
	}
});
function runAdaptiveThres(box) {
	var traceImg = $("#traceImage")[0];
	var thCanvas = document.createElement("canvas");
	thCanvas.width = traceImg.width;
	thCanvas.height = traceImg.height;
	var context = thCanvas.getContext('2d');
	context.rect(0, 0, img.width, img.height);
	context.fillStyle = "#0000ff";
	context.fill();

	var selectedImgData = srcContext.getImageData(+box.lx, +box.ty, +box.xGap, +box.yGap);
	var thresholdedImgData = computeAdaptiveThreshold(selectedImgData, 0.85);

	context.putImageData(thresholdedImgData, +box.lx, +box.ty);

	var finalCtx = getNewContext();
	finalCtx.rect(0, 0, img.width, img.height);
	finalCtx.fillStyle = "#0000ff";
	finalCtx.fill();

	finalCtx.beginPath();
	finalCtx.moveTo(box.toplx, box.toply);
	finalCtx.lineTo(box.toprx, box.topry);
	finalCtx.lineTo(box.btmrx, box.btmry);
	finalCtx.lineTo(box.btmlx, box.btmly);
	finalCtx.closePath();
	finalCtx.lineWidth=1;
	finalCtx.stroke();
	finalCtx.clip();
	finalCtx.drawImage(thCanvas, 0, 0);
	finalCtx.restore();

	var thCanvas2 = document.createElement("canvas");
	thCanvas2.width = traceImg.width;
	thCanvas2.height = traceImg.height;
	var context2 = thCanvas2.getContext('2d');
	var thresholdedImgData2 = computeAdaptiveThreshold(selectedImgData, 1.00);
	context2.putImageData(thresholdedImgData2, +box.lx, +box.ty);
	var fc2 = getNewContext();
	fc2.rect(0, 0, img.width, img.height);
	fc2.fillStyle = "#0000ff";
	fc2.fill();
	fc2.beginPath();
	fc2.moveTo(box.toplx, box.toply);
	fc2.lineTo(box.toprx, box.topry);
	fc2.lineTo(box.btmrx, box.btmry);
	fc2.lineTo(box.btmlx, box.btmly);
	fc2.closePath();
	fc2.lineWidth=1;
	fc2.stroke();
	fc2.clip();
	fc2.drawImage(thCanvas2, 0, 0);
	fc2.restore();

	var thCanvas3 = document.createElement("canvas");
	thCanvas3.width = traceImg.width;
	thCanvas3.height = traceImg.height;
	var context3 = thCanvas3.getContext('2d');
	var thresholdedImgData3 = computeAdaptiveThreshold(selectedImgData, 1.15);
	context3.putImageData(thresholdedImgData3, +box.lx, +box.ty);
	var fc3 = getNewContext();
	fc3.rect(0, 0, img.width, img.height);
	fc3.fillStyle = "#0000ff";
	fc3.fill();
	fc3.beginPath();
	fc3.moveTo(box.toplx, box.toply);
	fc3.lineTo(box.toprx, box.topry);
	fc3.lineTo(box.btmrx, box.btmry);
	fc3.lineTo(box.btmlx, box.btmly);
	fc3.closePath();
	fc3.lineWidth=1;
	fc3.stroke();
	fc3.clip();
	fc3.drawImage(thCanvas3, 0, 0);
	fc3.restore();

	return finalCtx;
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
	var count = 0;
	var totalY = 0.0;
	var minLum = 256.0;
	var maxLum = 0.0;

	var xGap = maxPoint[0] - minPoint[0];
	var yGap = maxPoint[1] - minPoint[1];

	var selectedImgData = srcContext.getImageData(minPoint[0], minPoint[1], xGap, yGap);

	// adaptive threshold
	var thresholdedImgData = computeAdaptiveThreshold(selectedImgData, 1.15);
	var thresContext = getNewContext("th");
	thresContext.putImageData(thresholdedImgData, minPoint[0], minPoint[1]);
	thresContext.fillStyle = '#EE8888';
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
	$("#pathListbox")
		.find("option").selected;

	local.rightTool.status = 0;
});

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

	function toX(x) { return x * 8 + centerX; }
	function toY(y) { return -y * 8 + centerY; }

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
}).css('background-color', selectedColor);

/***********************
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
				var laneRRoi =[];
				var laneRNearRoi = [];

				if (!savePolygon) savePolygon = [];

				for (var i = 0, len = savePolygon.length ; i < len ; i++) {
					var type = savePolygon[i][0].type;
					if (type === "R") {
						laneRRoi.push(savePolygon[i]);
					}
					else if (type === "RN") {
						laneRNearRoi.push(savePolygon[i]);
					}
				}

				updateData.PostProcess.LaneProcessInfo = {};
				updateData.PostProcess.LaneProcessInfo.Right_Luminance = laneRInfo;
				updateData.PostProcess.LaneProcessInfo.Right_ROIArea = laneRRoi;
				updateData.PostProcess.LaneProcessInfo.RightNear_Luminance = laneRNearInfo;
				updateData.PostProcess.LaneProcessInfo.RightNear_ROIArea = laneRNearRoi;

				if (updateData != null) {
					$.ajax({
						url: updateUrl, 
						type: "PUT", 
						contentType: "application/json; charset=utf-8" , 
						dataType: "json" , 
						data: JSON.stringify(updateData) , 
						success: function(result) {
							if (result.ok === true) {
								//alert('DB에 업데이트가 완료되었습니다');
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

/*********************************
 * COMPUTE ADAPTIVE THRESHOLD
 *********************************/
function computeAdaptiveThreshold(sourceImageData, ratio, callback) {
	var integral = buildIntegral_Gray(sourceImageData);

	var width = sourceImageData.width;
	var height = sourceImageData.height;
	var s = width >> 4; // in fact it's s/2, but since we never use s...

	var sourceData = sourceImageData.data;
	var result = createImageData(width, height);
	var resultData = result.data;
	var resultData32 = new Uint32Array(resultData.buffer);

	var x = 0,
		y = 0,
		lineIndex = 0;

	for (y = 0; y < height; y++, lineIndex += width) {
		for (x = 0; x < width; x++) {

			var value = sourceData[(lineIndex + x) << 2];
			var x1 = Math.max(x - s, 0);
			var y1 = Math.max(y - s, 0);
			var x2 = Math.min(x + s, width - 1);
			var y2 = Math.min(y + s, height - 1);
			var area = (x2 - x1 + 1) * (y2 - y1 + 1);
			var localIntegral = getIntegralAt(integral, width, x1, y1, x2, y2);
			if (value * area > localIntegral * ratio) {
				resultData32[lineIndex + x] = 0xFFFFFFFF;
			} else {
				resultData32[lineIndex + x] = 0xFF000000;
			}
		}
	}
	return result;
}

function createImageData(width, height) {
	var canvas = document.createElement('canvas');
	return canvas.getContext('2d').createImageData(width, height);
}

function buildIntegral_Gray(sourceImageData) {
	var sourceData = sourceImageData.data;
	var width = sourceImageData.width;
	var height = sourceImageData.height;
	var integral = new Int32Array(width * height)
		var x = 0,
			y = 0,
			lineIndex = 0,
			sum = 0;
	for (x = 0; x < width; x++) {
		sum += sourceData[x << 2];
		integral[x] = sum;
	}

	for (y = 1, lineIndex = width; y < height; y++, lineIndex += width) {
		sum = 0;
		for (x = 0; x < width; x++) {
			sum += sourceData[(lineIndex + x) << 2];
			integral[lineIndex + x] = integral[lineIndex - width + x] + sum;
		}
	}
	return integral;
}

function getIntegralAt(integral, width, x1, y1, x2, y2) {
	var result = integral[x2 + y2 * width];
	if (y1 > 0) {
		result -= integral[x2 + (y1 - 1) * width];
		if (x1 > 0) {
			result += integral[(x1 - 1) + (y1 - 1) * width];
		}
	}
	if (x1 > 0) {
		result -= integral[(x1 - 1) + (y2) * width];
	}
	return result;
}

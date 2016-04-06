/*************************
 * GLOBAL VARIABLES
 *************************/
var selectedColor = Cookies.get("selectedColor") || "#000";
var laneRInfo =[];
var laneRNearInfo = [];
var savePolygon = "";

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
						var wannaClose = window.confirm("현재 창을 닫으시겠습니까?");
						if (wannaClose === true) {
							opener.location.reload();
							window.close();
						} 
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

		for (var n = 0, plen = polygons.length ; n < plen ; n++) {
			var polygon = polygons[n];
			var polyLen = polygon.length;

			if (polyLen > 3) {
				var minPoint = polygon[0].slice();
				var maxPoint = polygon[0].slice();

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

				clippingPath(n, polygon, minPoint, maxPoint);
			}
		}

		var laneRInfoLen = laneRInfo.length;

		laneRInfo[0].contrast = (Number(laneRInfo[0].meanY) / Number(laneRNearInfo[0].meanY)).toFixed(2);

		if(laneRInfoLen > 0) {
			$("#confirmMsg").html(
				  "<p>오른쪽 자체밝기 : " + laneRInfo[0].meanY
				+ "</p><p>주변밝기 : "+laneRNearInfo[0].meanY
				+ "</p><p>대비 : " + laneRInfo[0].contrast
				+ "</p><p>해당 정보를 업데이트 하시겠습니까?</p>"
			);

			saveDialog.dialog("open","parameter");
		}
	} else {
		alert('ROI 영역을 지정하세요');
		return false;
	}
});

/************************************************************
 * 해당 영역만 추출하기 위해 캔버스를 생성한다. 
 *************************************************************/
function getNewContext(type) {
	var canvas = document.createElement("canvas");
	canvas.width = $("#traceImage").width();
	canvas.height = $("#traceImage").height();
	$("#testCanvas").append(canvas);
	$("#testCanvas > canvas:eq("+( $("#testCanvas > canvas").length - 1) +")").attr("id","canvas"+type);
	var context = canvas.getContext('2d');

	return context;
}

/************************************************************
 * 넘겨받은 polygon data를 바탕으로 clip image를 구성하고
 * 최소,최대 x,y 값을 바탕으로 픽셀데이터를 추출, 계산한다.
*************************************************************/
function clippingPath(index, polygon, minPoint, maxPoint) {
	var clipImg = $("#traceImage")[0];
	var clipContext = getNewContext(polygon[0][2]);

	var maxX = maxPoint[0];
	var maxY = maxPoint[1];

	var count = 0;
	var totalY = 0.0;
	var minLum = 256.0;
	var maxLum = 0.0;

	var xGap = maxX - minPoint[0];
	var yGap = maxY - minPoint[1];

	clipContext.save();

	clipContext.beginPath();
	clipContext.rect(minPoint[0], minPoint[1], xGap, yGap);
	clipContext.fillStyle = "#0000ff";
	clipContext.fill();

	//clipContext.globalComositeOperation ="xor"; // "source-out"; //xor
	clipContext.beginPath();
	clipContext.moveTo(polygon[0][0], polygon[0][1]);
	for(var j = 1, jLen = polygon.length; j < jLen ; j++) {
		clipContext.lineTo(polygon[j][0], polygon[j][1]);
	}
	clipContext.closePath();
	clipContext.clip();
	clipContext.drawImage(clipImg, 0, 0);
	clipContext.restore();

	var clipImgData = clipContext.getImageData(minPoint[0], minPoint[1], xGap, yGap);
	var pixels = clipImgData.data;
	var lumData = [];

	for (var i = 0, len = xGap*yGap ; i < len ; i++) {
		var R = parseInt(pixels[i*4]);
		var G = parseInt(pixels[i*4+1]);
		var B = parseInt(pixels[i*4+2]);

		if ((R == 0) && (G == 0) && (B == 0)) {
		} else {
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
	}

	var meanY = (totalY / count).toFixed(2);
	var data = {"meanY" : meanY, "MinY" : minLum, "MaxY" : maxLum, "lumData" : lumData };
	var type = polygon[0][2] || "L" ;

	if (type === "R") {
		laneRInfo[laneRInfo.length] = data;
	// Add by vlt1009
	} else if (type ==="RN") {
	
		var preCanvas = document.getElementById('canvasR');
		var currentCanvas = document.getElementById('canvasRN');
		var unionContext = getNewContext("Union"+type);
		$("#testCanvas > canvas:eq("+( $("#testCanvas > canvas").length - 1) +")").attr("style","color:red;");
		unionContext.save();
		unionContext.drawImage(currentCanvas,0, 0);
		unionContext.globalCompositeOperation = "xor"; //"destination-out";
		unionContext.drawImage(preCanvas, 0, 0);
		unionContext.restore();

		var clipImgData = unionContext.getImageData(minPoint[0], minPoint[1], xGap, yGap);
		var pixels = clipImgData.data;
			var lumData = [];
			totalY = 0.0;
			for (var i = 1, len = xGap*yGap ; i < len ; i++) {
				var R = parseInt(pixels[i*4]);
				var G = parseInt(pixels[i*4+1]);
				var B = parseInt(pixels[i*4+2]);
				if (R !== 0 && G !== 0 && B !== 0) {
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
			}

			var meanY = (totalY / count).toFixed(2);
			var data = {"meanY" : meanY, "MinY" : minLum, "MaxY" : maxLum, "lumData" : lumData };

			if (type ==="RN") {
				laneRNearInfo[laneRNearInfo.length] = data;
			}

	}
}

/**************************************************************
 * 주변밝기에서 중심밝기를 제외한다.
 **************************************************************/
function getNearLumData(lumData) {
	var nearLumData = [];
	/*var len = local.near * 2;

	var boundary = local.boundary;
	var br = len - boundary; */

	var len = local.near * 2;

	var boundary = local.boundary;
	var br = len - boundary; 

	var totalY = 0.0;
	for (var i = 0 ; i < len ; i++) {
		for (var j = 0 ; j < len ; j++) {
			if ( (boundary <= j && j < br) && (boundary <= i && i < br) ) {
				continue;
			}
			else {
				var data = lumData[i*len + j];
				nearLumData.push(data);
				totalY += data;
			}
		}
	}

	var meanY = (totalY / nearLumData.length).toFixed(2);
	var result = {"meanY" : meanY, "lumData" : nearLumData};

	return result;
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
	var index = 0;
	function polygon(param, type) {
		var imgLocArr = [];
		for(var i = 0, len = param.length ; i < len ; i++) {
			var imgLoc = {"x" : param[i][0], "y" : param[i][1], "color" : local.colorSet[index], "type" : type};
			imgLocArr.push(imgLoc);
		}
		return imgLocArr;
	}

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

				for (var i = 0, len = savePolygon.length ; i < len ; i++) {
					var type = savePolygon[i][0].type;
					if (type === "R") {
						laneRRoi.push(savePolygon[i]);
					}
					else if (type === "RN") {
						laneRNearRoi.push(savePolygon[i]);
					}
				}

				updateData.lane = { "right" : {}, "rightPos" :[], "rightNearData" : [], "rightNearPos" : [] };

				if (laneRRoi.length !== 0) {
					updateData.lane.right = laneRInfo;
					updateData.lane.rightPos = laneRRoi;
					updateData.lane.rightNearData = laneRNearInfo;
					updateData.lane.rightNearPos = laneRNearRoi;
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

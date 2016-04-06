/*************************
 * GLOBAL VARIABLES
 *************************/
var selectedColor = Cookies.get("selectedColor") || "#000";
var savePolygon;

/************************
 * 다이얼로그 모달 생성
 ************************/
var saveDialog = $("#saveInfo").dialog( {
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
				updateDoc(meanY, minLum, maxLum, function(succeed) {
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

/************************
 * 데이터 SAVE
 ************************/
function updateDoc(meanY, minLum, maxLum, todo) {
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

				updateData.PostProcess.RoadProcessInfo = {};

				updateData.PostProcess.RoadProcessInfo.Luminance = { MeanY : meanY, MinY : minLum, MaxY : maxLum};
				updateData.PostProcess.RoadProcessInfo.ROIArea = savePolygon;

				//console.log(JSON.stringify(updateData));

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

/************************
 * CLEAR 버튼 클릭시
 ************************/
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
	local.leftTool.status = 0;
	local.rightTool.status = 0;
});

/************************
 * SAVE 버튼 클릭시
 ************************/
$("#save").click(function() {

	$("#testCanvas").children().remove();
	var polygonStr = $("#exportArea").val();
	if (polygonStr !== '') {

		var polygon = extractArea(polygonStr);
		var polyLen = polygon.length;

		savePolygon = extractPolygon(polygonStr);

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

			clippingPath(polygon, minPoint, maxPoint);

			return true;
		}
	}

	alert('ROI 영역을 지정하세요');
	return false;
});

/************************************************************
 * 넘겨받은 polygon data를 바탕으로 clip image를 구성하고
 * 최소,최대 x,y 값을 바탕으로 픽셀데이터를 추출, 계산한다.
*************************************************************/
function clippingPath(polygon, minPoint, maxPoint) {
	var maxX = maxPoint[0];
	var maxY = maxPoint[1];

	var count = 0;
	var totalY = 0.0;
	minLum = 256.0;
	maxLum = 0.0;

	//console.time('function #getImageData');
	var xGap = maxX - minPoint[0];
	var yGap = maxY - minPoint[1];

	var clipImg = $("#traceImage")[0];
	var clipContext = getNewContext();

	clipContext.save();

	clipContext.beginPath();
	clipContext.rect(minPoint[0], minPoint[1], xGap, yGap);
	clipContext.fillStyle = "#0000ff";
	clipContext.fill();

	clipContext.beginPath();
	clipContext.moveTo(polygon[0][0], polygon[0][1]);

	for(var i = 1, polyLen = polygon.length; i < polyLen ; i++) {
		clipContext.lineTo(polygon[i][0], polygon[i][1]);
	}
	clipContext.closePath();
	clipContext.lineWidth=2;
	clipContext.stroke();
	clipContext.clip();
	clipContext.drawImage(clipImg, 0, 0);
	clipContext.restore();

	var clipImgData = clipContext.getImageData(minPoint[0], minPoint[1], xGap, yGap);

	var pixels = clipImgData.data;

	for (var i = 0, len = xGap*yGap ; i < len ; i++) {
		var R = parseInt(pixels[i*4]);
		var G = parseInt(pixels[i*4+1]);
		var B = parseInt(pixels[i*4+2]);
		if ((R == 0) && (G == 0) && (B == 255)) {
		} else {
			var y = R *  0.299000 + G *  0.587000 + B *  0.114000;
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

	maxLum = (maxLum).toFixed(2);
	minLum = (minLum).toFixed(2);
	meanY = (totalY / count).toFixed(2);

	$("#confirmMsg").html(
		"<p>총 픽셀 수 : "+ count +"</p>"
		+ "<p>평균 밝기 Y값 : " + meanY + "</p>"
		+ "<p>최대 밝기 Y값 : " + maxLum + "</p>"
		+ "<p>최소 밝기 Y값 : " + minLum + "</p>"
		+ "<br/><p>밝기값 정보를 업데이트 하시겠습니까?</p>"
	);

	saveDialog.dialog("open","parameter");
}

/************************************************************
 * 해당 영역만 추출하기 위해 캔버스를 생성한다. 
 *************************************************************/
function getNewContext(type) {
	var canvas = document.createElement("canvas");
	canvas.width = $("#traceImage").width();
	canvas.height = $("#traceImage").height();
	$("#testCanvas").append(canvas);
	return canvas.getContext('2d');
}

/**************************************************************
 * polygonString을 받아서 이미지와 매칭되는 좌표들로 변환한다.
 **************************************************************/
function extractArea(polygonStr) {
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

	function polygon(param) {
		var imgLocArr = [];
		for(var i = 0, len = param.length ; i < len ; i++) {
			var x = param[i][0];
			var y = param[i][1];

			var imgLocX = toX(x) - imagePosLeft;
			var imgLocY = toY(y) - imagePosTop;
			var imgLoc = [imgLocX, imgLocY];
			imgLocArr.push(imgLoc);
		}
		return imgLocArr;
	}

	function toX(x) { return x * 8 + centerX; }
	function toY(y) { return -y * 8 + centerY; }

	return eval(polygonStr);
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
	//var centerY  = $(window).height() - grid.offset().top * 3;
	var centerY  = local.imgHeight - grid.offset().top * 3;
	centerY -= centerY % 128;
	centerY /= 2;
	centerY += grid.offset().top;

	function polygon(param) {
		var imgLocArr = [];
		for(var i = 0, len = param.length ; i < len ; i++) {

			var imgLocX = toX(param[i][0]) - imagePosLeft;
			var imgLocY = toY(param[i][1]) - imagePosTop;

			var imgLoc = {"x" : imgLocX, "y" : imgLocY, "color" : selectedColor};

			imgLocArr.push(imgLoc);
		}
		return imgLocArr;
	}

	function toX(x) { return x * 8 + centerX; }
	function toY(y) { return -y * 8 + centerY; }


	return eval(polygonStr);
}

/************************
 * CLICKED COLOR PICKER
 ************************/
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


var local = {};
$().ready(function () {
	var imggg = $('<img src="' + imgpath +'"/>').load( function() {
		local.gridSize = 8;
		local.subGridSize = 8;
		local.paths = new Array();
		local.oldExportStr = "";

		local.currentPath = 0;
		local.drag = -1;
		local.selectedIdx = -1;

		local.clickBuf = 2;
		local.colorSet = [];

		$("#drawAreaSource").width(this.width + 200);
		local.imgHeight = this.height + 200;
		local.imgWidth = this.width;

		local.drawWidth = $("#drawAreaSource").width();
		local.drawWidth -= local.drawWidth % (local.gridSize * local.subGridSize * 2);
		local.drawHeight = local.imgHeight - $("#drawAreaSource").offset().top * 3;
		local.drawHeight -= local.drawHeight % (local.gridSize * local.subGridSize * 2);

		local.centerX = local.drawWidth / 2;
		local.centerY = local.drawHeight / 2;

		local.drawArea = Raphael("drawAreaSource", local.drawWidth+1, local.drawHeight+1);
		$("#wrapper").css("float", "left");

		local.minGridWidth = -4;
		local.minGridHeight = -4;
		local.maxGridWidth;
		local.maxGridHeight;

		var str = "";
		for(x=0;x<local.drawWidth+1;x+=local.gridSize) {
			str += "M"+(x+0.5)+",0L"+(x+0.5)+","+(local.drawHeight+1);
			local.maxGridWidth = x;
		}
		for(x=0;x<local.drawHeight+1;x+=local.gridSize) {
			str += "M0,"+(x+0.5)+"L"+(local.drawWidth+1)+","+(x+0.5);
			local.maxGridHeight = x;
		}
		local.grid = local.drawArea.path(str).attr("stroke", "#C0C0ff").attr("stroke-opacity", "0.3");

		var str = "";
		for(x=0;x<local.drawWidth+1;x+=local.gridSize*local.subGridSize)
			str += "M"+(x+0.5)+",0L"+(x+0.5)+","+(local.drawHeight+1);
		for(x=0;x<local.drawHeight+1;x+=local.gridSize*local.subGridSize)
			str += "M0,"+(x+0.5)+"L"+(local.drawWidth+1)+","+(x+0.5);
		local.grid = local.drawArea.path(str).attr("stroke", "#A0A0ff").attr("stroke-opacity", "0.3");
		local.axes = local.drawArea.path("M0,"+(local.centerY+0.5)+"L"+(local.drawWidth+1)+","+(local.centerY+0.5)+"M"+(local.centerX+0.5)+",0L"+(local.centerX+0.5)+","+(local.drawWidth+1));


		local.editTool = Raphael("editToolSource", 24, 24);
		local.editTool.path("M8,3L8,20L12,17L14,23L18,20L15,15L18,13Z").attr("fill", "#E0E0E0");
		$("#editToolSource").click(function() { setSelectedTool(local.editTool); });

		local.rightTool = Raphael("addToolSource", 24, 24);
		local.rightTool.path("M10,2L14,2L14,10L22,10L22,14L14,14L14,22L10,22L10,14L2,14L2,10L10,10Z").attr("fill", "#80E080");
		//local.rightTool.path("M6,4L12,22L18,22L12,4Z").attr("fill", "#80E080");
		local.rightTool.type = "R";
		local.rightTool.status = 0;
		$("#addToolSource").click(function() { setSelectedTool(local.rightTool); });

		local.remTool = Raphael("remToolSource", 24, 24);
		local.remTool.path("M22,10L22,14L2,14L2,10Z").attr("fill", "#E08080");
		$("#remToolSource").click(function() { setSelectedTool(local.remTool); });

		$("#traceImage").load(function () {
			$("#traceImage").css("width", "");
			$("#traceImage").css("width", $("#traceImage").width());
			$("#traceImage").css("left", local.centerX - $("#traceImage").width() / 2 + $("#drawAreaSource").offset().left);
			$("#traceImage").css("top", local.centerY - $("#traceImage").height() / 2 + $("#drawAreaSource").offset().top);
		});
		$("#traceImage").attr("src", $("#traceImageURL").val());

		$("#pathListbox").prop("selectedIndex", 0);
		$("#pathListbox").change(function() {

			if (local.paths[local.currentPath] != undefined) {
				for(var i=0; i<local.paths[local.currentPath].points.length; i++)
				{
					if (local.paths[local.currentPath].points[i].box != undefined)
						local.paths[local.currentPath].points[i].box.remove();
					local.paths[local.currentPath].points[i].box = undefined;
				}
				if ( local.paths[local.currentPath].path != undefined) 
					local.paths[local.currentPath].path.attr("stroke-width", 2);
			}

			local.currentPath = $("#pathListbox").prop("selectedIndex");
			local.selectedIdx = -1;

			if (local.paths[local.currentPath] != undefined) {
				for(var i=0; i<local.paths[local.currentPath].points.length; i++)
				{
					if (local.paths[local.currentPath].points[i].box != undefined)
						local.paths[local.currentPath].points[i].box.remove();
					local.paths[local.currentPath].points[i].box = local.drawArea.rect(toX(local.paths[local.currentPath].points[i].x) - local.gridSize / 2, toY(local.paths[local.currentPath].points[i].y) - local.gridSize / 2, local.gridSize, local.gridSize);
				}
				if ( local.paths[local.currentPath].path != undefined) 
					local.paths[local.currentPath].path.attr("stroke-width", 3);
			}
		});

		setSelectedTool(local.rightTool);
		setTimeout(function(){
			loadPaths();
		}, 300);
	});
}); // end of $().ready();

function loadPaths() {
	$.ajax({ 
		url: updateUrl, 
		dataType: 'JSON',
		type: 'GET',
		success: function(data) {
			if (data.PostProcess.LaneProcessInfo != "") {
				if (data.PostProcess.LaneProcessInfo.Right_ROIArea != undefined) {
					var gridPos = getGridxy(data.PostProcess.LaneProcessInfo.Right_ROIArea[0]);
					//drawROIArea(data.PostProcess.LaneProcessInfo.Right_ROIArea[0]);
					drawROIArea(gridPos);
					if (data.PostProcess.LaneProcessInfo.RightNear_ROIArea != undefined) {
						var gridNearPos = getGridxy(data.PostProcess.LaneProcessInfo.RightNear_ROIArea[0]);
						drawROIArea(gridNearPos);
					} else {
						drawNearPoints();
					}
				}

				local.rightTool.status = 3;
			}
		}, error: function(err) {
			alert("기존 ROI 영역을 추출하지 못하였습니다. 다시 시도하여주세요");
			console.error(err);
		}
	});
}

function getGridxy(data) {
	var newPos = [];
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

	for (var i = 0, len = data.length ; i < len ; i++) {
		var gridxy = {};
		var newX =  Math.round((Number(data[i].x) + imagePosLeft - centerX) / local.gridSize);
		var newY = -Math.round((Number(data[i].y) + imagePosTop - centerY) / local.gridSize);
		gridxy.x = newX;
		gridxy.y = newY;
		gridxy.color = data[i].color || selectedColor;
		gridxy.type = data[i].type || "R";

		newPos.push(gridxy);
	}

	return newPos;
}

function drawROIArea(pos) {
	$("#pathListbox > option:eq(" + (local.paths.length) +")" ).prop('selected', 'selected').trigger('change');
	for (var i = 0, len = pos.length ; i < len ; i++) {
		if (local.paths.length <= local.currentPath) {	//New path
			$('#pathListbox option:eq('+local.currentPath+')').text('Path:' + (local.currentPath + 1));
			$('#pathListbox').append($('<option>').text("[New]")); 
			local.paths[local.currentPath] = {points: new Array(), prefix: "polygon(", postfix: ");\n", type: pos[i].type};
			local.colorSet[local.currentPath] = selectedColor;
		}

		var box = local.drawArea.rect(toX(pos[i].x) - local.gridSize / 2, toY(pos[i].y) - local.gridSize / 2, local.gridSize, local.gridSize);
		box.attr("stroke", pos.color);
		local.paths[local.currentPath].points.push({x: pos[i].x, y: pos[i].y, type: 0, box: box, prevCP: {x: 0, y: 0}, nextCP: {x: 0, y: 0}});
		if (local.paths[local.currentPath].path == undefined) {
			local.paths[local.currentPath].path = local.drawArea.path("").attr("stroke-width", 2);
		}
		updatePath(local.paths[local.currentPath]);
		updateExport();
	}
}

function drawNearLane(points) {
	$("#pathListbox > option:eq(" + (local.paths.length) +")" ).prop('selected', 'selected').trigger('change');

	for (var i = 0, len = points.length ; i < len ; i++) {
		if (local.paths.length <= local.currentPath) {	//New path
			$('#pathListbox option:eq('+local.currentPath+')').text('Path:' + (local.currentPath + 1));
			$('#pathListbox').append($('<option>').text("[New]")); 
			var typed = local.paths[local.currentPath-1].type + "N";
			local.paths[local.currentPath] = {points: new Array(), prefix: "polygon(", postfix: ");\n", type: typed};
			local.colorSet[local.currentPath] = selectedColor;
		}

		var box = local.drawArea.rect(toX(points[i].x) - local.gridSize / 2, toY(points[i].y) - local.gridSize / 2, local.gridSize, local.gridSize);
		box.attr("stroke", selectedColor);
		local.paths[local.currentPath].points.push({x: points[i].x, y: points[i].y, type: 0, box: box, prevCP: {x: 0, y: 0}, nextCP: {x: 0, y: 0}});
		if (local.paths[local.currentPath].path == undefined) {
			local.paths[local.currentPath].path = local.drawArea.path("").attr("stroke-width", 2);
		}
		updatePath(local.paths[local.currentPath]);
		updateExport();
	}
}

function setSelectedTool(tool) {
	if (local.currentToolSelection != undefined)
		local.currentToolSelection.remove();
	local.currentTool = tool;
	local.currentToolSelection = local.currentTool.path("M0.5,0.5L0.5,23.5L23.5,23.5L23.5,0.5Z");
	local.selectedIdx = -1;

	if (tool == local.rightTool) {
		var pathsListPos = getPathListPos(tool);
		$("#pathListbox > option:eq(" + pathsListPos +")" ).prop('selected', 'selected').trigger('change');
	}
} // end of setSelectedTool

function getPathListPos(tool) {
	var index = local.paths.length;

	if (index === 0) {
		return index;
	} else {
		for (var i = 0, len = local.paths.length ; i < len ; i++) {
			if (local.paths[i].type === tool.type) {
				index = i;
			}
		}
		return index;
	}
}

$(document).mousedown(function(e) {
	if (!eventOnDrawArea(e)) return;

	var scroll_x = $(window).width() - 5;
	var scroll_y = $(window).height() - 5;
	if (e.clientX > scroll_x) return;
	if (e.clientY > scroll_y) return;

	local.drag = -1;

	if (local.currentTool == local.rightTool) {
		if (local.currentTool.status === 0) {
			//$('#pathListbox').append($('<option>').text('Path:' + (local.currentPath + 1)));
			$('#pathListbox option:eq('+local.currentPath+')').text('Path:' + (local.currentPath + 1));
			$('#pathListbox').append($('<option>').text("[New]")); 

			if (local.currentTool == local.rightTool) {
			local.paths[local.currentPath] = {points: new Array(), prefix: "polygon(", postfix: ");\n", type: "R"};
			}
			local.currentTool.status = 1;
			local.colorSet[local.currentPath] = selectedColor;
		}

		if (local.currentTool.status === 1) {
			var box = local.drawArea.rect(toX(e.x) - local.gridSize / 2, toY(e.y) - local.gridSize / 2, local.gridSize, local.gridSize);
			box.attr("stroke", selectedColor);
			local.paths[local.currentPath].points.push({x: e.x, y: e.y, type: 0, box: box, prevCP: {x: 0, y: 0}, nextCP: {x: 0, y: 0}});
			if (local.paths[local.currentPath].path == undefined) {
				local.paths[local.currentPath].path = local.drawArea.path("").attr("stroke-width", 2);
			}
			updatePath(local.paths[local.currentPath]);
			updateExport();

			var plen = local.paths[local.currentPath].points.length;
			if (plen == 4) {
				local.currentTool.status = 2;
			}
		}
	}

	if (local.currentTool == local.editTool) {
		if (local.paths[local.currentPath] == undefined) return;
		
		if (local.selectedIdx > -1 && local.paths[local.currentPath].points[local.selectedIdx].type == 1)
		{
			var p = local.paths[local.currentPath].points[local.selectedIdx];
			if (p.nextCP.x + p.x == e.x && p.nextCP.y + p.y == e.y)
			{
				local.dragType = 1;
				local.drag = local.selectedIdx;
				return;
			}
			if (p.prevCP.x + p.x == e.x && p.prevCP.y + p.y == e.y)
			{
				local.dragType = 2;
				local.drag = local.selectedIdx;
				return;
			}
		}
		
		for(var i=0;i<local.paths[local.currentPath].points.length;i++)
		{
			if (local.paths[local.currentPath].points[i].x == e.x && local.paths[local.currentPath].points[i].y == e.y)
			{
				if (local.selectedIdx > -1)
					local.paths[local.currentPath].points[local.selectedIdx].box.attr("stroke", "#000000");

				local.drag = i;
				local.dragType = 0;
				local.selectedIdx = i;
				local.paths[local.currentPath].points[local.selectedIdx].box.attr("stroke", "#ff0000");
				showSelectedCP();
			}
		}
	}

	if (local.currentTool == local.remTool) {
		if (local.paths[local.currentPath] == undefined) return;
		
		for(var i=0;i<local.paths[local.currentPath].points.length;i++)
		{
			if (local.paths[local.currentPath].points[i].x == e.x && local.paths[local.currentPath].points[i].y == e.y)
			{
				local.paths[local.currentPath].points[i].box.remove();
				local.paths[local.currentPath].points.splice(i, 1);
			}
		}
		updatePath(local.paths[local.currentPath]);
		updateExport();
	}

}); // end of mousedown

$(document).mousemove(function(e) {
	if (!eventOnDrawArea(e)) return;

	$('#cursorCoordinates').text('x = '+e.x + ', y = ' + e.y);
	
	if (local.currentTool == local.editTool)
	{
		if (local.drag != -1)
		{
			var p = local.paths[local.currentPath].points[local.drag];
			switch(local.dragType)
			{
			case 0:
				p.x = e.x;
				p.y = e.y;
				p.box.attr({x: toX(e.x) - local.gridSize / 2, y: toY(e.y) - local.gridSize / 2});
				break;
			case 1:
				p.nextCP.x = e.x - p.x;
				p.nextCP.y = e.y - p.y;
				break;
			case 2:
				p.prevCP.x = e.x - p.x;
				p.prevCP.y = e.y - p.y;
				break;
			}
			updatePath(local.paths[local.currentPath]);
			showSelectedCP();
			updateExport();
		}
	}
});

$(document).mouseup(function(e) {
	local.drag = -1;
	if (!eventOnDrawArea(e)) return;

	if (local.currentTool == local.rightTool) {
		if (local.currentTool.status === 2) {
			drawNearPoints();
		}
	}
});

function drawNearPoints() {
	var points = clone(local.paths[local.currentPath].points);
	points.sort( function(a, b) {
		if (a.y === b.y) {
			return a.x - b.x;
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

	sortedPoints[0].x -= local.clickBuf;
	sortedPoints[1].x += local.clickBuf;
	sortedPoints[2].x += local.clickBuf;
	sortedPoints[3].x -= local.clickBuf;

	drawNearLane(sortedPoints);

	local.currentTool.status = 3;

	if (local.rightTool.status === 0) {
		setSelectedTool(local.rightTool);
	}
}

function clone(param) {
	var clonedArray = $.map(param, function (obj) {
		  return $.extend(true, {}, obj);
	});
	return clonedArray;

}

function updatePath(path, color) {
	var currentColor = color || selectedColor;

	var points = path.points;
	var str = "";
	if (points.length > 1) {
		var p0 = points[points.length-1];
		str += "M" + toX(p0.x) + "," + toY(p0.y);
		for(var i=0; i<points.length; i++) {
			var p1 = points[i];
			if (p0.type == 1 || p1.type == 1) {
				var x1 = p0.x + p0.nextCP.x;
				var y1 = p0.y + p0.nextCP.y;
				var x2 = p1.x + p1.prevCP.x;
				var y2 = p1.y + p1.prevCP.y;
				str += "C" + toX(x1) + "," + toY(y1) + " " + toX(x2) + "," + toY(y2) + " " + toX(p1.x) + "," + toY(p1.y);
			} else{
				str += "L" + toX(p1.x) + "," + toY(p1.y);
			}
			var p0 = p1;
		}
		str += "Z";
	}
	path.path.attr("path", str);
	path.path.attr("stroke", currentColor);

} // end of updatePath

function updateExport() {
	var maxInterpolateSteps = 100;
	var str = "";

	for(var i=0; i<local.paths.length; i++) {
		str += local.paths[i].prefix + "[";
		if (local.paths[i].points.length > 0) {
			for(var j=0; j<local.paths[i].points.length; j++) {
				var p0 = local.paths[i].points[j];
				var p1 = local.paths[i].points[(j+1)%local.paths[i].points.length];
				str += "[" + p0.x + "," + p0.y;
				if (p0.type == 1 || p1.type == 1) {
					var q0 = {x: p0.x + p0.nextCP.x, y: p0.y + p0.nextCP.y};
					var q1 = {x: p1.x + p1.prevCP.x, y: p1.y + p1.prevCP.y};
					var prevPoint = p0;
					str += "/*1:" + p0.prevCP.x + "," + p0.prevCP.y + "," + p0.nextCP.x + "," + p0.nextCP.y + "*/";
					for(var n=1;n<maxInterpolateSteps;n+=1) {
						var k = n / maxInterpolateSteps;
						var r0 = interpolate(p0, q0, k);
						var r1 = interpolate(q0, q1, k);
						var r2 = interpolate(q1, p1, k);
						var b0 = interpolate(r0, r1, k);
						var b1 = interpolate(r1, r2, k);
						var s = interpolate(b0, b1, k);
						if (distance(s, prevPoint) >= 1) {
							prevPoint = s;
							str += "] ,[";
							str += (Math.round(s.x * 100) / 100) + "," + (Math.round(s.y * 100) / 100)
						}
					}
				}
				str += "]";
				if (j < local.paths[i].points.length - 1)
					str += ",";
			}
		} else {
			str += "[]";
		}
		//str += "]" + local.paths[i].postfix;
		str += "],'" + local.paths[i].type + "'" + local.paths[i].postfix;
	}

	$("#exportArea").val(str);
	local.oldExportStr = str;
} // end of updateExport

function showSelectedCP() {
	if (local.nextCPbox != undefined)
	{
		local.nextCPbox.remove();
		local.nextCPbox = undefined;
		local.prevCPbox.remove();
		local.prevCPbox = undefined;
	}
	if (local.selectedIdx < 0) return;
	var p = local.paths[local.currentPath].points[local.selectedIdx];
	if (p.type == 1)
	{
		local.nextCPbox = local.drawArea.rect(toX(p.x + p.nextCP.x) - local.gridSize / 2, toY(p.y + p.nextCP.y) - local.gridSize / 2, local.gridSize, local.gridSize).attr("stroke", "#8080FF");
		local.prevCPbox = local.drawArea.rect(toX(p.x + p.prevCP.x) - local.gridSize / 2, toY(p.y + p.prevCP.y) - local.gridSize / 2, local.gridSize, local.gridSize).attr("stroke", "#8080FF");
	}
}

function interpolate(p0, p1, f)
{
	return {x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f};
}

function distance(p0, p1)
{
	return Math.sqrt((p0.x-p1.x)*(p0.x-p1.x) + (p0.y-p1.y)*(p0.y-p1.y));
}

function toX(x) { return x * local.gridSize + local.centerX; }
function toY(y) { return -y * local.gridSize + local.centerY; }

function eventOnDrawArea(e) {
	if (local.drawArea == undefined) return false;

	var das = $("#drawAreaSource");

	if (e.pageY > local.drawArea.height) return false;

	var toolbox = $("#toolbox");
	if (e.pageX < (das.offset().left + (local.boundary * (local.gridSize / 2)))) return false;
	if (e.pageY < (das.offset().top + (local.boundary * (local.gridSize / 2)))) return false;
	if (e.pageX > das.offset().left + local.drawWidth - (local.boundary * (local.gridSize / 2))) return false;
	if (e.pageY > das.offset().top + local.drawHeight - (local.boundary * (local.gridSize / 2))) return false;
	if (e.pageX >= toolbox.offset().left && e.pageX <= toolbox.offset().left + toolbox.width() && 
		e.pageY >= toolbox.offset().top && e.pageY <= toolbox.offset().top + toolbox.height()) return false;
	if (e.preventDefault) e.preventDefault();
	e.stopPropagation();
	e.x = Math.round(((e.pageX - das.offset().left) - local.centerX) / local.gridSize);
	e.y = -Math.round(((e.pageY - das.offset().top) - local.centerY) / local.gridSize);
	return true;
} // end of eventOnDrawArea

/*************************
 * GLOBAL VARIABLES
 *************************/
var docsTotal = docslist.id.length;
var dbhost = "http://" + location.hostname + ":5984/";
var viewNm = "GPSLatLon";

var currentPage = Number(Cookies.get("currentPage")) || 1;
var pagingCount = Number(Cookies.get("pagingCount")) || 10;
var selectedNo = Number(Cookies.get("selectedNo")) || 0;
var lastSelectedDb = Cookies.get("selectedDb") || dbname;
var selectedMarkerPoint = selectedNo;

var polyline;
var multiopt;
var uniqDays = [];
var uniqDevice = [];
var currentDoc;
var currentDocId;

/*************************
 * 초기화 작업
 *************************/
initSocket();
initDBList();
initDIRList();

if (lastSelectedDb != $("#dblistSelect").val() ) {
	currentPage = 1;
	Cookies.set("currentPage", currentPage, {expires: 1});
	Cookies.set("selectedDb", dbname, {expires: 1});
}

$("#rname").val($("#dblistSelect").val());
if(docsTotal !== 0) {
	var pIndex = (currentPage-1) * pagingCount;
	fillTable(pIndex, pagingCount);
	setMap(pIndex, pagingCount);
	imgNjson(docslist.id[pIndex + selectedNo]);
	setPaging();
	getUniqSelector();
	$("#"+docslist.id[pIndex + selectedNo]).css("background","lightBlue");
	setLegend();
	$("#listSize").val(pagingCount);
	changeMarker(selectedNo);
}

/*************************
 * 웹소켓 초기화
 *************************/
function initSocket() {
	var socket = io.connect();
	socket
		.on('connect', function() {
		})
		.on('cntNow', function(data) {
			$("#progressbar").progressbar({
				value: data
			});
		})
		.on('progressMsg', function(msg) {
			$("#importMsg").text(msg);
		})
		.on('err-analysis', function(msg) {
			$("#overlay").remove();
		})
		.on('end-analysis', function() {
			$("#overlay").remove();
			window.location.href="/";
		});
}


/*************************
 * 데이터베이스 목록 세팅
 *************************/
function initDBList() {
	dblist.forEach(function(entry, index) {
		$("#dblistSelect").append('<option value='+entry+'>'+ entry +'</option>');
		$("#dblistform").append('<option value='+entry+'>'+ entry +'</option>');
		$("#dblist").append('<option value='+entry+'>'+ entry +'</option>');
	});
}

/*************************
 * 자료입력 폴더목록 세팅
 *************************/
function initDIRList() {
	dirlist.forEach(function(entry, index) {
		$("#dirlistform").append('<option value='+entry+'>'+ entry +'</option>');
	});
}

/*************************
 * 결과 테이블 세팅
 *************************/
function fillTable(start, end) {
	var max = start + end;
	for (var i = start ; i < max ; i++) {
		if (docslist.lon[i] != null && docslist.lat[i] != null) {
			var id = docslist.id[i];
			var lum = docslist.lum[i];
			var dlen = docslist.dlen[i];
			var slen = docslist.slen[i];

			if (lum == 'NaN') {
				lum = 0.0;
			}

			// parcing id to date and time
			datetime = id.split("_");
			date = datetime[0];
			time = datetime[1];

			// make time string format (hour:minute:second)
			hour = time.substr(0,2);
			minute = time.substr(2,2);
			second = time.substr(4,2);
			time = hour+":"+minute+":"+second;

			lum = Math.round(lum*100)/100;

			$('#docsTable > tbody')
				.append(
					'<tr id="'+docslist.id[i]+'">' +
					'<td>'+ (i+1) +'</td>' +
					'<td>'+ date + '</td>' +
					'<td>'+ time + '</td>' +
					'<td>'+ lum + '</td>' +
					'<td>'+ dlen + '</td>' +
					'<td>'+ slen +'</td></tr>');
		}
	}
}
/*************************
 * 결과 데이터를 맵에 표현
 *************************/
function setMap(start, end) {
	if (polyline != null) {
		polyline.clearAddon();
		map.removeLayer(polyline);
	}

	var positions = [];
	for(var s = parseInt(start), limit=parseInt(start)+parseInt(end); s < limit; s++) {
		if (docslist.lon[s] !== undefined && docslist.lat[s] !== '0.0' ) {
			var latlon = L.latLng(docslist.lat[s], docslist.lon[s]);
			positions.push(latlon);
		} 
	}

	var polylineOptions = {
		stroke: false,
		newPolylines: false,
		maxMarkers: 1000
	}

	if(positions.length !== 0) {
		polyline = L.Polyline.PolylineEditor(positions, polylineOptions).addTo(map)
		map.fitBounds(polyline);
	} else {
		map.setView([38,127],0);
	}
}

/*************************
 * JSON 및 이미지 구체화
 *************************/
function imgNjson(doc) {
	currentDocId = doc;
	setImage(doc);
	setJson(doc);
}

/*************************
 * Image 탭에 이미지 처리
 *************************/
function setImage(doc) {
	$( "#RGBImg").attr("src", dbhost+dbname+"/" + doc +"/TEGRA7_RGB_"+ doc +".jpg");
	$( "#YUVImg").attr("src", dbhost+dbname+"/" + doc +"/TEGRA7_YUV_"+ doc +".jpg")
	$( "#TRACKINGImg").attr("src", dbhost+dbname+"/" + doc +"/TEGRA7_TRACKING_"+ doc +".jpg") ;

	$( "#DELINImg").attr("src", dbhost+dbname+"/" + doc +"/TEGRA7_RGB_"+ doc +".jpg") ;
	$( "#LaneImg").attr("src", dbhost+dbname+"/" + doc +"/TEGRA7_RGB_"+ doc +".jpg") ;
}
/*************************
 * JSON Tree 생성 처리
 *************************/
function setJson(doc) {
	$( "#jsonInfo" ).jstree('destroy');
	var jsonUrl = dbhost +dbname+"/" + doc ;
	$.ajax({
			url:jsonUrl,
			//beforeSend: function(xhr) { xhr.withCredentials = true; },
			dataType: 'JSON',
			jsonpCallback: 'callback',
			type: 'GET',
			success:function(data){
				if(typeof data == 'string') {
					data = $.parseJSON(data);
				}
				delete data._rev; delete data._attachments;

				var jstreeData = [];
				currentDoc = data;
				extract(data, null, 0);

				function extract(metaJson, parentVal, index) {
					if (metaJson.length === undefined) {
						var keys = Object.keys(metaJson);
						for (var i = 0, klen = keys.length ; i < klen ; i++) {

							// root & each parent
							if (parentVal === null) {
								if (keys[i] === '_id') {
									addTree(metaJson[keys[0]], '#', metaJson[keys[0]], true);
								} else {
									// this is node
									if (metaJson[keys[i]].length === undefined) {
										addTree( keys[i], metaJson[keys[0]], keys[i], false);
										extract( metaJson[keys[i]], keys[i], i);
									}
									// this is leaf
									else {
									  if (Array.isArray(metaJson[keys[i]])) {
											addTree( keys[i], metaJson[keys[0]], keys[i], false);
											var arr = metaJson[keys[i]];
											for (var arrIdx = 0, arrLen = arr.length ; arrIdx < arrLen ; arrIdx++) {
											  addTree( keys[i] + '' + arrIdx , keys[i], arrIdx + ' : ' + JSON.stringify(arr[arrIdx]), false);
											}
										} else {
											addTree( keys[i], metaJson[keys[0]], keys[i]+ ' : ' +metaJson[keys[i]], false);
										}
									}
								}
							}
							// no root  
							else {
								// this is node
								if (metaJson[keys[i]].length === undefined) {
									addTree(index+'_'+keys[i], parentVal, keys[i], false);
									extract(metaJson[keys[i]], index+'_'+keys[i], index);
								}
								// this is leaf
								else {
									var data = metaJson[keys[i]];
									try {
										data = JSON.parse(metaJson[keys[i]]);
									} catch (e) {
									}

									//if (Array.isArray(metaJson[keys[i]])) {
									if (Array.isArray(data)) {
										addTree(parentVal+'_'+index+'_'+keys[i], parentVal, keys[i], false);
										var arr = data;
										for (var arrIdx = 0, arrLen = arr.length ; arrIdx < arrLen ; arrIdx++) {
											addTree( parentVal+'_'+index+'_'+keys[i] + '_'+arrIdx , parentVal+ '_'+index+'_'+keys[i], arrIdx + ' : ' + JSON.stringify(arr[arrIdx]), false);
										}
									} else {
										addTree(index+'_'+keys[i]+metaJson[keys[i]], parentVal, keys[i]+ ' : ' +metaJson[keys[i]]);
									}
								}
							}
						}
					} else {
						addTree(index+'_'+metaJson, parentVal, metaJson, false);
					}
				}

				function addTree(id, pid, text, opened) {
					jstreeData.push({
						"id" : id,
						"parent" : pid,
						"text" : text,
						"state" : {
							"opened": opened
						}
					});
				}


				// make a jstree
				$('#jsonInfo').jstree(
					{ 'core' : {
							'data' : jstreeData
						}
					});
			},
			error: function (err) {
				console.log("json meta detail info Error!! -");
				console.log(err);
			}
	});
}

/*************************
 * 결과 테이블 페이지 처리
 *************************/
function setPaging() {
	$("#paging").paginate({
		count : Math.ceil(docsTotal/pagingCount),
		start : currentPage,
		display	: 9,
		border : false,
		text_color : '#888',
		background_color : '#EEE',	
		text_hover_color : 'black',
		background_hover_color : '#CFCFCF',
		images : false,
		mouse : 'press',
		onChange : function(page) {
			if (isPlaying == 1)  return false;
			currentPage = page;
			$('#docsTable > tbody > tr').remove();
			var pIndex = (page-1) * pagingCount;
			fillTable(pIndex, pagingCount); 
			setMap(pIndex, pagingCount); 
			imgNjson(docslist.id[pIndex]); 
			$("#"+docslist.id[pIndex]).css("background","lightBlue");
			Cookies.set("currentPage", page, {expires: 1});
			Cookies.get("selectedNo", 0);
			changeMarker(0);
		}
	});
}

/*************************
 * 검색조건 생성
 *************************/
function getUniqSelector() {

	$("#from").datepicker({
		defaultDate: "+1w",
		changeYear: true,
		changeMonth: true,
		numberOfMonths: 1,
		onSelect: function( selectedDate ) {
			$("#to").datepicker("option", "minDate", selectedDate);
			$(this).parent().find('input:checkbox').attr('checked', true);
		}
	});

	$("#to").datepicker({
		defaultDate: "+1w",
		changeYear: true,
		changeMonth: true,
		numberOfMonths: 1,
		buttonImage: "/images/calendar.gif",
		onSelect: function( selectedDate ) {
			$("#from").datepicker("option", "maxDate", selectedDate);
			$(this).parent().find('input:checkbox').attr('checked', true);
		}
	});

	uniqDays = [];
	uniqDevice = [];
	for (var i = 0, len = docsTotal ; i < len ; i++) { 
		var surveyDay = (docslist.id[i].split("_"))[0];
		var device = docslist.dev[i];

		getUniq(uniqDays, surveyDay);
		getUniq(uniqDevice, device);
	}

	function getUniq(arr, target) {
		if (arr.length != 0) {
			var isin = false;
			for(var j = 0, alen = arr.length ; j < alen ; j++) {
				if (arr[j] === target) {
					isin = true;
					return;
				}
			}
			if (!isin) {
				arr.push(target);
			}
		} else {
			arr.push(target);
		}
	}

	var daysLen = uniqDays.length;
	if (daysLen === 0) {
		$("#from").attr("disabled", true);
		$("#to").attr("disabled", true);
	} else if (daysLen === 1) {
		$("#from").val(uniqDays[0]);
		$("#to").val(uniqDays[0]);
		$("#from").attr("disabled", true);
		$("#to").attr("disabled", true);
	} else {
		$("#from").attr("disabled", false);
		$("#to").attr("disabled", false);
		$("#from").val("");
		$("#to").val("");

		uniqDays.sort();

		$("#from").datepicker("option", "maxDate", uniqDays[daysLen-1]);
		$("#from").datepicker("option", "minDate", uniqDays[0]);
		$("#to").datepicker("option", "maxDate", uniqDays[daysLen-1]);
		$("#to").datepicker("option", "minDate", uniqDays[0]);
	}

	uniqDevice.forEach(function(entry, index) {
	  $("#deviceList").append('<option value='+entry+'>'+entry+'</option>');
	});

}

/*************************
 * 맵에 범례 표시
 *************************/
function setLegend() {
	var legend = L.control( {position: 'bottomright'} );
	legend.onAdd = function (map) {
		var div = L.DomUtil.create('div', 'info legend');
		div.innerHTML +=
		"<i style='background: #ff0000'></i> 불량 (Y < 25)<br>" 
		+ "<i style='background: #0000ff'></i> 적정 (25 ≤ Y ≤ 40)<br>"  
		+ "<i style='background: #00ff00'></i> 양호 (40 ≤ Y)<br>";

		return div;
	};

	legend.addTo(map);
}


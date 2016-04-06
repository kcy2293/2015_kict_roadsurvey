/* -----------------------------------------------------
 * 1. 전체 영역 이벤트
 * ----------------------------------------------------- */
	/************************
	 * 화면 레이아웃 구성
	 ************************/
	$('body').layout({
		west__applyDefaultStyles: true,
		center__applyDefaultStyles: true,
		west__size: "360"
	});

	$('.ui-layout-west').css("overflow-x", "hidden");

	$('#inner').layout({
		applyDefaultStyles: true
		,south__size: "350"
	});

	/************************
	 * 맵 구성
	 ************************/
	var map = L.map('map1', {
	  crs: L.Proj.CRS.TMS.Daum,
	  continuousWorld: true,
	  worldCopyJump: false,
	  zoomControl: true
	});

	L.Proj.TileLayer.TMS.provider('DaumMap.Street').addTo(map);
	L.control.scale().addTo(map);
	map.setView([36,127.5], 1);

	var legend = L.control( {position: 'bottomright'} );
	legend.onAdd = function (map) {
		var div = L.DomUtil.create('div', 'info legend');
		div.innerHTML +=
		"<i style='background: #ff0000'></i> 0&nbsp;&ndash;&nbsp;25<br>" 
		+ "<i style='background: #00ff00'></i> 25&nbsp;&ndash;&nbsp;40<br>"  
		+ "<i style='background: #00ff00'></i> 40&nbsp;&ndash;&nbsp;255<br>";
	}

/* -----------------------------------------------------
 * 2. 왼쪽 메뉴 영역 이벤트
 * ----------------------------------------------------- */
	/*******************************
	 * 데이터베이스명 변경 클릭
	 *******************************/
	$("#dblistSelect").change(function() {
		dbname = $(this).val();
		Cookies.set("selectedDb", dbname, {expires: 1});
		$("#docsTable > tbody > tr").remove();
		currentPage = 1;
		$("#rname").val(dbname);
		defaultView( dbname );
	});

	function defaultView(whichDB) {
		$.ajax({
			dataType: "json",
			url: dbhost + whichDB +  "/_design/" + viewNm + "/_view/" + viewNm ,
			success: function(data){
				docsTotal = data.total_rows;
				docslist = {id:[],lat:[],lon:[],lum:[],dev:[],cnt:[],dln:[]};
				data.rows.forEach(function(doc) {
					docslist.id.push(doc.key);
					docslist.lat.push(doc.value[0]);
					docslist.lon.push(doc.value[1]);
					docslist.lum.push(doc.value[2]);
					docslist.dev.push(doc.value[3]);
					docslist.cnt.push(doc.value[4]);
					docslist.dln.push(doc.value[5]);
				});

				$('#docsTable > tbody > tr').remove();
				fillTable(0, pagingCount) ;
				setMap(0, pagingCount);
				imgNjson(docslist.id[0]);
				setPaging();
				getUniqSelector();
				$("#"+docslist.id[0]).css("background","lightBlue");
			}
		});
	}

	/*******************************
	 * 데이터베이스 메뉴 관리 버튼
	 *******************************/
	$("#mngMenu")
		.button({ text: false, icons: {primary: "ui-icon-gear" }})
		.click(function() {
			var menu= $( this ).parent().next().toggle().position({
				my: "right top",
				at: "right bottom",
				of: this
			});
			$(document).one( "click", function() { menu.hide(); });

			var menuList = $(".ui-menu li");
			menuList.mouseover(function() {
				$(this).addClass("ui-state-hover");
			});
			menuList.mouseout(function() {
				$(this).removeClass("ui-state-hover");
			});

			var selectedDB = $("#dblistSelect").val();
			// create
			menuList.eq(0).click(function(e) {
				createdialog.dialog( "open" );
			});

			// delete
			menuList.eq(1).click(function(e) {
				if (selectedDB !== null) {
					$("#removedb-form p").text('\"'+ selectedDB +'\" DB를 삭제하시겠습니까?');
					rmdialog.dialog( "open" );
				}
			});

			// import
			menuList.eq(2).click(function(e) {
				if (selectedDB !== null)  {
					importdialog.dialog( "open" );
				} 
			});

			// analysis
			menuList.eq(3).click(function(e) {

				var dbname = $("#rname").val();

				if(dbname) {
					var over = '<div id="overlay">' +
							   '<img id="loading" src="/images/loader.gif">' +
							   '</div>';
					$(over).appendTo('body');

					$.ajax({
						type: "post",
						url: '/analysis',
						data: {
							dbname : dbname
						},
						success: function(data) {
							//console.log(data);
						},
						error: function(err) {
							//console.error(err);
						}
					});
				}
			});

			return false;
		})
		.parent()
			.buttonset()
			.next()
				.hide()
				.menu();

	/*******************************
	 * 검색조건 메뉴
	 *******************************/
	// 검색조건 calendar
	$.datepicker.regional["ko"] = {
		closeText: '닫기',
		prevText: '이전달',
		nextText: '다음달',
		currentText: '오늘',
		monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
		monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
		dayNames: ['일','월','화','수','목','금','토'],
		dayNamesShort: ['일','월','화','수','목','금','토'],
		dayNamesMin: ['일','월','화','수','목','금','토'],
		weekHeader: 'Wk',
		dateFormat: 'yymmdd', 
		firstDay: 0,
		isRTL: false,
		showMonthAfterYear: true,
		yearSuffix: '년'
	};
	$.datepicker.setDefaults($.datepicker.regional['ko']);

	// device list
	$("#deviceList").click(function() {
		var deviceName = $(this).val();

		var checkBox = $(this).parent().find('input:checkbox');
		if (deviceName === 'clear') {
			checkBox.attr("checked", false);
		} else {
			checkBox.attr("checked", true);
		}
	});
	// 검색 버튼 클릭
	$( "#search-db" ).click(function() {
		var checkbox = $("input:checkbox");
		var isChecked = false;
		for (var i = 0, len = checkbox.length ; i < len ; i++) {
			isChecked |= checkbox[i].checked;
		}

		if (!isChecked) {
			alert('검색하려는 조건 앞에 체크를 하세요.');
			checkbox[0].focus();
			return false;
		}

		// 일자선택 검색
		var dayToStrArr = "";
		var dayChecked = false;
		if (checkbox[0].checked) {
			dayChecked = true;
			var fromDate = $("#from").val().trim();
			var toDate = $("#to").val().trim();

			if (fromDate ==="" || toDate === "") {
				alert('일자를 입력하세요.');
				$("#from").focus();
				checkbox[0].checked = false;
				return false;
			}

			var rangeDate = getDateList(fromDate, toDate);
			var uniqRange = [];
			for (var i = 0, len = uniqDays.length ; i < len ; i++) {
				var date = uniqDays[i];
				for (var j = 0, jlen = rangeDate.length ; j < jlen ; j++) {
					if (date === rangeDate[j]) {
						uniqRange.push(date);
						break;
					} 
				}
			}

			var msgDialog = $("#msgDialog");
			var msgBox = msgDialog.find("p");
			msgBox.html("");

			dayToStrArr = JSON.stringify(uniqRange);
			dayToStrArr = dayToStrArr.substring(1, dayToStrArr.length -1);

			if (dayToStrArr.length == 0) {
				msgBox.html("검색결과가 없습니다.");
				msgDialog.dialog( "open" );
				return false;
			}
		}

		// 기기명 선택 검색
		var searchDevice = "";
		var devChecked = false;
		if (checkbox[1].checked) {
			devChecked = true;
			searchDevice = $("#deviceList").val();
			if (searchDevice === 'clear') {
				alert('검색 기기를 선택하여주세요.');
				$("#deviceList").focus();
				return false;
			}
		}

		var mapFunc =
			" function(doc) { " ;

			if (dayChecked) {
				mapFunc = mapFunc
				+ "var dateStr = doc._id.substring(0,8);" 
				+ "var arr = ["+ dayToStrArr + "];" 
				+ "if (arr.indexOf(dateStr) > -1) { " ;
			} 
			if (devChecked) {
				mapFunc = mapFunc
				+ "  if (doc.device === '" + searchDevice + "') { " ;
			}
			mapFunc += "emit(doc._id, [ doc.GPS.Latitude, doc.GPS.Longitude, doc.Luminance.MeanY, doc.device]);" 
			if (dayChecked) {
				mapFunc = mapFunc
				+ " } ";
			} 
			if (devChecked) {
				mapFunc = mapFunc
				+ " } ";
			}
			mapFunc = mapFunc
			+ " } ";

		$.ajax({
			type: "post",
			contentType: "application/json; charset=utf-8",
			url: dbhost + dbname + "/_temp_view",
			dataType: "json",
			data: JSON.stringify({
				"map": mapFunc
			}),
			success: function(data) {
				docsTotal = data.total_rows;
				docslist = {id:[],lat:[],lon:[],lum:[],dev:[]};
				data.rows.forEach(function(doc) {
					docslist.id.push(doc.key);
					docslist.lat.push(doc.value[0]);
					docslist.lon.push(doc.value[1]);
					docslist.lum.push(doc.value[2]);
					docslist.dev.push(doc.value[3]);
				});

				if(docsTotal !== 0) {
					$('#docsTable > tbody > tr').remove();
					fillTable(0, pagingCount) ;
					setMap(0, pagingCount);
					imgNjson(docslist.id[0]);
					setPaging();
					$("#"+docslist.id[0]).css("background","lightBlue");

					$("#msgDialog").find("p").html("총 " + docsTotal + "건이 검색되었습니다.")
					$("#msgDialog").dialog("open");

				} else {
					msgBox.html("검색결과가 없습니다.");
					msgDialog.dialog( "open" );
				}
			},
			error: function(req, status, errorThrown) {
				console.log("ERR : " + status + ", " + req);
			}
		});
	});

	function getDateList(start, end) {
		var itr = moment.twix(getDate(start), getDate(end)).iterate("days");
		var range = [];
		while(itr.hasNext()) {
			var next = itr.next();
			range.push(next.format("YYYYMMDD").toString());
		}

		return range;
	}

	function getDate(input) {
		return new Date(input.substr(0,4)+"/"+input.substr(4,2)+"/"+input.substr(6,2));
	}

	/*******************************
	 * 결과 메뉴 - play & stop 버튼
	 *******************************/
	var animate;
	var isPlaying = 0;
	$("#btnAnimate")
		.button({ text: false, icons: { primary: "ui-icon-play" } })
		.css("width", "20px").css("height", "20px")
		.click(function () {

			if (isPlaying == 1)  return false;
			else isPlaying = 1;

			var count = -1;
			var list = $("#docsTable tbody tr");
			var listLen = list.length;

			if (listLen == 0) {
				return ;
			}

			animate = setInterval(function() {
				count++;
				if ( count === list.length ) {
					clearInterval(animate);
					isPlaying = 0;
				} else {
					list.removeClass("ui-selected");
					list.removeAttr( 'style' );
					$(list[count]).addClass("ui-selected");
					$(list[count]).css("background", "lightBlue");

					imgNjson($(".ui-selected" ).attr("id"));
					changeMarker($(".ui-selected").index());
				}
			}, 1000);
		});

	$("#stopAnimate")
		.button({ text: false, icons: { primary: "ui-icon-stop" } })
		.css("width", "20px").css("height", "20px")
		.click(function() {
			if (animate !== null) {
				isPlaying = 0;
				clearInterval(animate);
			}
		});
	
	function changeMarker(pos) {
		if (polyline != null) {
			map.fitBounds(polyline);
			var points = polyline.getPoints();
			var marker = points[pos];
			selectedMarkerPoint = pos;

			if (selectedMarkerPoint != null) {
				points[selectedMarkerPoint].setIcon(smallIcon);
			}

			marker.setIcon(bigIcon);

			var idx = pos + ((currentPage - 1)*pagingCount);
			var lum = Math.round(docslist.lum[idx]*100)/100;

			var dln = 0;
			var cnt = 0;

			if (dln == 0) {
				var popup = L.popup().setContent('<p>No.'+ (idx+1) +'</p><p>노면밝기 '+lum+'</p>'); 
			} else {
				var popup = L.popup().setContent('<p>No.'+ (idx+1) +'<br/>노면밝기 '+lum+'<br/>시설개수 ' + cnt + '<br/>시설밝기 ' + dln + '</p>');
			}
			marker.bindPopup(popup).openPopup();
		}
	}
	/***********************************
	 * 결과 메뉴 - 결과 데이터 다운로드
	 ***********************************/
	$("#btnExport")
		.button({ text:false, icons: { primary: "ui-icon-arrowthickstop-1-s" } })
		.css("width", "20px").css("height", "20px")
		.click(function () {
            $("#docsTable").btechco_excelexport({
                containerid: "docsTable"
               , datatype: $datatype.Table
            });
		});
	/*******************************
	 * 결과 메뉴 - 결과 갯수 클릭시
	 *******************************/
	$("#listSize").change(function() {
		if (isPlaying == 1)  return false;
		$("#docsTable > tbody > tr").remove();
		var tIndex = (currentPage-1)*pagingCount + selectedNo;
		pagingCount = parseInt(this.value);
		currentPage = parseInt(tIndex / pagingCount) + 1;
		selectedNo = tIndex % pagingCount;
		Cookies.set("currentPage", currentPage, {expires: 1});
		Cookies.set("selectedNo", selectedNo, {expires: 1});
		Cookies.set("pagingCount", pagingCount, {expires: 1});

		var pIndex = (currentPage-1) * pagingCount;
		fillTable(pIndex, pagingCount);
		setMap(pIndex, pagingCount);
		imgNjson(docslist.id[pIndex + selectedNo]);
		$("#"+docslist.id[pIndex + selectedNo]).css("background","lightBlue");
		setPaging();
		changeMarker(selectedNo);
	});
	/*******************************
	 * 결과 메뉴 - 각 항목 클릭시
	 *******************************/
	$("#docsTable").selectable({
		filter:'tbody tr',
		selected: function(event, ui){
			$("table tr").removeAttr( 'style' );
			var doc = $(".ui-selected" ).attr("id");
			imgNjson(doc);
			var tIndex = $(".ui-selected").index();
			changeMarker(tIndex);
			$("#"+docslist.id[(currentPage-1)*pagingCount + tIndex]).css("background","lightBlue");
			Cookies.set("selectedNo", tIndex, {expires: 1});
			selectedNo = tIndex;
		}
	});

/* -----------------------------------------------------
 * 3. 화면 아래 영역 이벤트
 * ----------------------------------------------------- */

	/*******************************
	 * JSON 데이터 다운로드
	 *******************************/
	$("#jsonDownload")
		.button({ text:false, icons: { primary: "ui-icon-arrowthickstop-1-s" } })
		.css("height", "30px")
		.click(function() {
			if (currentDoc !== null) {
				var json = JSON.stringify(currentDoc);
				window.URL = window.URL || window.webkitURL;
				var blob = new Blob([json],{type: "application/json"});
				var blobURL = window.URL.createObjectURL(blob);

				$("#download_link").attr("href", blobURL).attr("download", currentDocId + ".json");
				var down = $("#export_file");
				down.trigger('click');
			}
		});

	/*******************************
	 * IMAGE 다운로드
	 *******************************/
	$("#imgDownload")
		.button({ text:false, icons: { primary: "ui-icon-arrowthickstop-1-s" } })
		.css("height", "30px")
		.click(function() {
			var currentImg= $("div[aria-expanded|='true']").find("img");
			var imgName = currentImg.attr("name");
			var blobURL = currentImg.attr("src");

			$("#download_link").attr("href", blobURL).attr("download", imgName);
			var down = $("#export_file");
			down.trigger('click');
		});

	/*******************************
	 * 이미지 보기 탭
	 *******************************/
	$( "#imagesView" ).tabs();

	/*******************************
	 * 이미지 클릭시 새창 띄우기
	 *******************************/
	$("div[id^=tabs-]").on("click", function() {
		openImageTools($(this).find("img").attr("src"),"\/imageTools", "scad");
	});

	$("#delin").on("click", function() {
		openImageTools($(this).find("img").attr("src"),"\/delinTools", "delinScad");
	});

	$("#lane").on("click", function() {
		openImageTools($(this).find("img").attr("src"),"\/laneTools", "laneScad");
	});

	function openImageTools(imgSrc, url, target) {
		if (isPlaying == 1)  return false;
		var form = $("#openPost");
		form.attr("action", url);
		form.attr("target", target);
		$("#imgPath").val(imgSrc);
		var updateUrl = dbhost +dbname+"/" + currentDocId;
		$("#updateUrl").val(updateUrl);

		//window.open("", target, 'height='+screen.height+', width='+screen.width);

		// test #1
		window.open("", target);
		form.submit();
	}

/* -----------------------------------------------------
 * 4. 다이얼로그 팝업 관련 이벤트 처리
 * ----------------------------------------------------- */
	/*******************************
	 * DB 생성
	 *******************************/
	var inputbox = $("#inputbox");
	var tips = $(".validateTips");
	function createdb() {
		var valid = checkRegexp(
			inputbox, 
			/^[a-z]([0-9a-z_\s])+$/i, 
			"DB명은 반드시 영문소문자(a-z)로 시작하는 이름이여야 합니다.");

		if (valid) {
			$.ajax( {
				type: 'POST',
				url: '/dbCreate',
				data: {
					dbname : inputbox.val() + ''
				},
				error: function(err) {
					if (err.status === 412) {
						updateTips("에러 : 존재하는 DB명입니다");
					} else {
						updateTips("에러 : " + err.error);
					}
					inputbox.val('').focus();
				},
				success: function(result) {
					Cookies.set("selectedDb", inputbox.val(), {expires: 1});
					window.location.href="/";
				}
			});
		}
		return valid;
	}

	var createdialog = $( "#createdb" ).dialog( {
		autoOpen: false,
		width: 350,
		height: 260,
		modal: true,
		open : function() {
			tips.css("visibility","hidden");
			inputbox.removeClass("ui-state-error");
			inputbox.keypress(function(e) {
				if (e.keyCode == 13) {
					var isValid = createdb();
					if (!isValid) {
						e.preventDefault();
					}
				}
			});
		},
		buttons: {
			"생성" : createdb,
			"닫기": function() {
				createdialog.dialog( "close" );
			}
		},
		close: function(){
			inputbox.val("");
		}
	});

	function updateTips( t ) {
		tips
			.css("visibility", "visible")
			.text( t )
			.addClass("ui-state-highlight");
	}
	function checkRegexp( o, regexp, n ) {
		if ( !( regexp.test( o.val() ) ) ) {
			o.addClass( "ui-state-error" );
			updateTips( n );
			return false;
		} else {
			return true;
		}
	}

	/*******************************
	 * DB 삭제
	 *******************************/
	var rmdialog = $( "#removedb" ).dialog( {
		autoOpen: false,
		height: 200,
		modal: true,
		open : function() {
			$("#deleteMsg")
				.text("'" + $("#rname").val() + "' db의 모든 데이터가 삭제됩니다. 삭제하시겠습니까?")
				.addClass("ui-state-highlight");
		},
		buttons: {
			"삭제" : function() {
				$.ajax( {
					type: 'POST',
					url: '/dbDelete',
					data: {
						dbname : $("#rname").val()
					},
					error: function(err) {
						$("#deleteMsg")
							.text("Delete Err : " + err.statusText );
					},
					success: function(result) {
						Cookies.set("selectedDb", "", {expires: 1});
						window.location.href="/";
					}
				});
			},
			"닫기" : function() {
				$(this).dialog( "close" );
			}
		}
	});
	/*******************************
	 * 자료입력
	 *******************************/
	var doRefreshPage = false;
	var importdialog = $( "#importdb" ).dialog( {
		autoOpen: false,
		width: 360,
		height: 300,
		modal: true,
		open : function() {
			$("#progressbar").css("display","none");
			var dbname = $("#dblistSelect").val();
			$("#dblistform").val(dbname);
		},
		buttons: {
			"실행" : function() {
				$("#progressbar")
					.css("display","block")
					.progressbar({ value: false });
				$("#importMsg").text('');
				$.ajax( {
					type: 'POST',
					url: '/dbInsert',
					data: {
						'dbname': $("#dblistform").val() + '',
						'dirname': $("#dirlistform").val() + ''
					},
					error: function(err) {
						$("#importMsg")
							.text(err.responseText)
					},
					complete: function(result) {
						switch(result.status) {
							case 201 :
								window.location.href="/";
								break;
							case 202:
								$("#importMsg")
									.text(result.responseText)
								doRefreshPage = true;
								break;
						}
					}
				});
			},
			"닫기" : function() {
				$(this).dialog( "close" );
				$("#rname").val($("#dblistSelect").val());
			}
		}, 
		close: function() {
			if (doRefreshPage) {
				window.location.href="/";
			}
		}
	});

	/*******************************
	 * DB 생성 및 삭제 아이콘 클릭
	 *******************************/
	$( "#btnCreate" ).on("click", function() {
		createdialog.dialog( "open" );
	});
	$( "#btnDelete" ).on("click", function() {
		$("#rname").val($("#dblistform").val());
		rmdialog.dialog( "open" );
	});


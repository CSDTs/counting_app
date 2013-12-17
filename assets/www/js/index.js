/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
	
	bluetoothSerial: null,
	
	dbShell: null,
	
    // deviceready Event Handler
    onDeviceReady: function() {
		//listener for if the phone is offline (has no internet connection)--temporarily disabled for performance reasons
		//document.addEventListener("offline", app.phoneOffline, false);
		
		document.addEventListener("pause", app.onPause, false);
		
		//bluetoothSerial lib
		app.bluetoothSerial = cordova.require('bluetoothSerial');
		
		//check to see if Bluetooth is enabled
		app.bluetoothSerial.isEnabled(app.bluetoothSuccess, function() {
			navigator.notification.alert("Please enable Bluetooth!");
		});
		
		//open DB for sensor data and create tables (dropping them if they already exist)
		app.dbShell = window.openDatabase("sensorcaching", "1.0", "Sensorcaching Test Database", 200000);
		app.dbShell.transaction(app.populateDB, app.errorCB, app.successDB);
    },
	
	//called when app is paused (goes into background, etc.)
	onPause: function() {
		app.bluetoothSerial.unsubscribe();
		app.bluetoothSerial.disconnect();
		$("#uploadData").addClass("disabled");
		$("#connectBt").removeClass("disabled");
	},
	
	//drops tables if they exist, then reforms them
	populateDB: function (tx) {
		tx.executeSql('DROP TABLE IF EXISTS sensorcaching');
		tx.executeSql('CREATE TABLE IF NOT EXISTS sensorcaching (data, sensor_id, timestamp)');
	},
	
	 // Transaction error callback
    //
     errorCB: function(err) {
        console.log("Error processing SQL: "+err);
    },

    // Transaction success callback
    //
     successCB: function() {
		console.log("SQL processing success");
    },
	
	//callback for phone being offline
	phoneOffline: function() {
		navigator.notification.alert("You have no data connection; this will be a problem for uploading data!");
		//console.log("offline!");
		document.addEventListener("online", app.phoneOnline, false);
		document.addEventListener("offline", app.phoneOnline, false);
	},
	
	//callback for phone being online
	phoneOnline: function() {
		navigator.notification.alert("Hey, your phone is online again; excellent!");
		//console.log("online!");
		document.removeEventListener("online", app.phoneOnline, false);
		document.addEventListener("offline", app.phoneOffline, false);
	},
	
	//callback if bluetooth is enabled
	bluetoothSuccess: function() {
		console.log("Bluetooth enabled");
		
		//if we're in upload.html, populate the bluetooth device list
		//NOTE: this is super hacky--hopefully will get better, once html is moved to single-page design
		if (window.location.pathname.indexOf("upload.html") != -1) {
			app.bluetoothSerial.list(function(list) {
				$(list).each(function(i, v) {
					//console.log(v['name']);
					$("#bluetoothId").append("<option value='" + v['address'] + "'>" + v['name'] + "</option>");
				});
				$("#bluetoothId").removeProp("disabled");
			});
			$("#connectBt").click(function(e) {
				e.preventDefault();
				app.bluetoothSerial.connect($("#bluetoothId").val(), app.btConnectSuccess, app.btConnectFailure);
			});
		}
	},
	
	//Bluetooth connect to sensor callback: downloads data, and sends it to SQL database
	btConnectSuccess: function() {
		navigator.notification.alert("Sensor connected, remember to press 'connect' button on sensor.");
		$("#uploadData").removeClass("disabled");
		$("#connectBt").addClass("disabled");
		//writes chars needed to kickstart uploading
		app.bluetoothSerial.write("$#");
		//"subscribes" app to serial data coming from bluetooth, and downloads it whenever it sees a newline (every line of data from file)
		app.bluetoothSerial.subscribe('\n', function(data) {
			//console.log(data);
			//$("#data").val($("#data").val() + data + "\n");
			var data_split = data.split(",");
			//console.log(data_split);
			if (data_split.length == 4 && (data_split[1].indexOf("timestamp") == -1)) {
				var timeStr = $.trim(data_split[1]);
				timeStr = timeStr.substr(1, timeStr.length -2);
				//console.log(timeStr);
				app.dbShell.transaction(function(tx) {
						tx.executeSql("INSERT INTO sensorcaching (sensor_id, data, timestamp) VALUES ('" + data_split[0] + "', '" + data_split[2] + "', '" + timeStr + "');"); 
					}, app.errorCB, app.successCB);
			}
		}, function() {
			//called if there's a read error during subscription to Bluetooth data buffer
			navigator.notification.alert("Bluetooth read error");
		});
	},
	
		// this is called when an error happens in a transaction
	errorHandler: function(transaction, error) {
	   alert('Error: ' + error.message + ' code: ' + error.code);
	 
	},
	
	nullHandler: function(){},
	
	//callback for pressing of "upload" button
	uploadButton: function() {
		try	{
		app.dbShell.transaction(function(transaction) {
			transaction.executeSql('SELECT * FROM sensorcaching;', [],
				function(transaction, result) {
					if (result != null && result.rows != null) {
						for (var i = 0; i < result.rows.length; i++) {
							var row = result.rows.item(i);
							//console.log('row: ' + i + ": " + row.sensor_id + '. ' + row.data + ' ' + row.timestamp);
							if (row.timestamp.length >= 10) {
								$.post("http://www.communitysensors.rpi.edu/sensor-maps/new_store_data.php", { c_sensor_id: row.sensor_id, c_user_temp: row.data, c_date_time: row.timestamp}, function(data) {
									//console.log(data);
								}).fail(function() {
									alert( "$.post failed!" );
								});
							} else {
								console.log("previous row is bad timestamp");
							}
						}
						navigator.notification.alert("All data uploaded!");
					}
				}, app.errorHandler);
			}, app.errorHandler, app.nullHandler);
		} catch (err) {
			console.log("Caught error: " + err);
		}
		app.bluetoothSerial.unsubscribe();
		app.bluetoothSerial.disconnect();
		$("#uploadData").addClass("disabled");
		$("#connectBt").removeClass("disabled");
		/*app.bluetoothSerial.available(function (numBytes) {
			console.log("There are " + numBytes + " bytes available to read.");
		}, function () {
			console.log("available failure");
		});*/
		app.dbShell.transaction(function(tx) {
				tx.executeSql("DELETE FROM sensorcaching;"); 
			}, app.errorCB, app.successCB);
	},
	
	btConnectFailure: function() {
		navigator.notification.alert("Bluetooth not connected!");
		$("#uploadData").addClass("disabled");
		$("#connectBt").removeClass("disabled");
		app.bluetoothSerial.unsubscribe();
	}
};


app.initialize();

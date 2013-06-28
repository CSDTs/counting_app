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
	//db: null,
	
    // deviceready Event Handler
    onDeviceReady: function() {
		//document.addEventListener("offline", app.phoneOffline, false);
		app.bluetoothSerial = cordova.require('bluetoothSerial');
		app.bluetoothSerial.isEnabled(app.bluetoothSuccess, function() {
			navigator.notification.alert("Please enable Bluetooth!");
		});
		//app.db = window.openDatabase("sensordata", "1.0", "Sensor Data", 200000);
		//app.db.transaction(app.sqlSetup, app.errorCB, app.successCB);
    },
	
	sqlSetup: function() {
		tx.executeSql('DROP TABLE IF EXISTS sensordata');
        tx.executeSql('CREATE TABLE IF NOT EXISTS sensordata (sensor_id, data, timestamp)');
	},
	
	// Transaction error callback
    //
    errorCB: function(tx, err) {
        alert("Error processing SQL: "+err);
    },

    // Transaction success callback
    //
    successCB: function() {
        alert("success!");
    },
	
	phoneOffline: function() {
		navigator.notification.alert("You have no data connection; this will be a problem for uploading data!");
		console.log("offline!");
		document.addEventListener("online", app.phoneOnline, false);
		document.addEventListener("offline", app.phoneOnline, false);
	},
	
	phoneOnline: function() {
		navigator.notification.alert("Hey, your phone is online again; excellent!");
		console.log("online!");
		document.removeEventListener("online", app.phoneOnline, false);
		document.addEventListener("offline", app.phoneOffline, false);
	},
	
	bluetoothSuccess: function() {
		console.log("Bluetooth enabled");
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
	
	btConnectSuccess: function() {
		navigator.notification.alert("Bluetooth connected!");
		$("#uploadData").removeClass("disabled");
		app.bluetoothSerial.write("$#");
		app.bluetoothSerial.subscribe('\n', function(data) {
			console.log(data);
			$("#data").val($("#data").val() + data + "\n");
			$data_split = data.split(",");
			/*app.db.transaction(function(tx) {tx.executeSql("INSERT INTO sensordata (sensor_id, data, timestamp) VALUES ('" + data['sensor_id'] + "', '" + data['data'] + "', " + data['timestamp'] + ";")}, 
				app.errorCB, appsuccessCB);*/
			if ($data_split[1].indexOf("timestamp") == -1 && $data_split[1].length >= 12) {
				$.post("http://www.communitysensors.rpi.edu/sensor-maps/new_store_data.php", { c_sensor_id: $data_split[0], c_user_temp: $data_split[2], c_date_time: $data_split[1]}, function(data) {
					console.log(data);
				});
			}
				
		}, function() {
			navigator.notification.alert("Bluetooth read error");
		});

	},
	
	uploadButton: function() {
		app.bluetoothSerial.available(function (numBytes) {
			console.log("There are " + numBytes + " bytes available to read.");
			if (numBytes == 0) {
				alert("All data uploaded!");
			}
		}, function () {
			console.log("available failure");
		});
		app.bluetoothSerial.unsubscribe();
		app.bluetoothSerial.disconnect();
	},
	
	btConnectFailure: function() {
		navigator.notification.alert("Bluetooth not connected!");
		$("#uploadData").addClass("disabled");
		app.bluetoothSerial.unsubscribe();
	}
};

app.initialize();
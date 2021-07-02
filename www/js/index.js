var photoArea_width = 602;
var photoArea_height = 607;

var CUSTOM_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
var CUSTOM_READ = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
var CUSTOM_WRITE = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';


var connectStateBLE = false;
var saveDevice;

var tracker = createDeviceTracker();

// Connected device.
var mDevice = null
var mPollingTimer = null
var testCount = 0
var connectErrorCount = 0

var captureImage = 0;
var printFinishFlag = 0;

var bmp = 0;
var bmpRaw = 0;
var bmpRawBitLength = 0;
var TR_uint8 = 0;
var TR_bufferCount = 0;
var bmpSplit = 0;
var TR_dataBuffer = [];
var TR_dataBufferCount = 0;

var firstRunOpenCV = 1;
var finishImageProcessing = 0;

function initiateTestSequence()
{
	testCount = 0

	console.log('Initiate test sequence')
	runTestSequence()
}

function runTestSequence()
{
	if (testCount < 10)
	{
		++testCount

		console.log('Running test sequence')
		console.log('testCount: ' + testCount)
		console.log('connectErrorCount: ' + connectErrorCount)

		findDevice()
		setTimeout(disconnectDevice, 20000)
		setTimeout(runTestSequence, 30000)
	}
	else
	{
		console.log('Test sequence done')
		console.log('testCount: ' + testCount)
		console.log('connectErrorCount: ' + connectErrorCount)

	}
}
// End of code used for testing.

function findDevice()
{
	disconnectDevice()

	// Used for debugging/testing.
	//scanForDevice()
	//return

	searchForBondedDevice({
		name: 'UART_Service',
		serviceUUIDs: [CUSTOM_SERVICE],
		onFound: connectToDevice,
		onNotFound: scanForDevice,
		})
}

function disconnectDevice()
{
	evothings.ble.stopScan()
	clearInterval(mPollingTimer)
	if (mDevice) { evothings.ble.close(mDevice) }
	mDevice = null
	showMessage('Disconnected')
}

/**
 * Search for bonded device with a given name.
 * Useful if the address is not known.
 */
function searchForBondedDevice(params)
{
	console.log('Searching for bonded device')
	evothings.ble.getBondedDevices(
		// Success function.
		function(devices)
		{
			for (var i in devices)
			{
				var device = devices[i]
				if (device.name == params.name)
				{
					console.log('Found bonded device: ' + device.name)
					params.onFound(device)
					return // bonded device found
				}
			}
			params.onNotFound()
		},
		// Error function.
		function(error)
		{
			params.onNotFound()
		},
		{ serviceUUIDs: params.serviceUUIDs })
}

function scanForDevice()
{
	showMessage('Scanning for HexiWear')

	// Start scanning. Two callback functions are specified.
	evothings.ble.startScan(
		onDeviceFound,
		onScanError)

	// This function is called when a device is detected, here
	// we check if we found the device we are looking for.
	function onDeviceFound(device)
	{
		console.log('Found device: ' + device.name)

		if (device.advertisementData.kCBAdvDataLocalName == 'UART_Service')
		{
			showMessage('Found UART_Service Sensor Tag')

			// Stop scanning.
			evothings.ble.stopScan()

			// Connect directly.
			// Used for debugging/testing.
			//connectToDevice(device)
			//return

			// Bond and connect.
			evothings.ble.bond(
				device,
				function(state)
				{
					// Android returns 'bonded' when bonding is complete.
					// iOS will return 'unknown' and show paring dialog
					// when connecting.
					if (state == 'bonded' || state == 'unknown')
					{
						connectToDevice(device)
					}
					else if (state == 'bonding')
					{
						showMessage('Bonding in progress')
					}
					else if (state == 'unbonded')
					{
						showMessage('Bonding aborted')
					}
				},
				function(error)
				{
					showMessage('Bond error: ' + error)
				})
		}
	}

	// Function called when a scan error occurs.
	function onScanError(error)
	{
		showMessage('Scan error: ' + error)
	}
}

function connectToDevice(device)
{
	showMessage('Connecting to device...')

	// Save device.
	mDevice = device

	// Android connect error 133 might be prevented by waiting a
	// little before connect (to make sure previous BLE operation
	// has completed).
	setTimeout(
		function()
		{
			evothings.ble.connectToDevice(
				device,
				onConnected,
				onDisconnected,
				onConnectError)
		},
	    500)

	function onConnected(device)
	{
    tracker.addDevice(device);

		showMessage('Connected')
    connectStateBLE = true;
    saveDevice = device;

    service = evothings.ble.getService(device, CUSTOM_SERVICE);
    readCharacteristic1 = evothings.ble.getCharacteristic(service, CUSTOM_READ);
    writeCharacteristic1 = evothings.ble.getCharacteristic(service, CUSTOM_WRITE);

    //enableLuxometerNotifications(device, readCharacteristic1);
		//testIfBonded()
	}

	function onDisconnected(device)
	{
		showMessage('Device disconnected')
	}

	// Function called when a connect error or disconnect occurs.
	function onConnectError(error)
	{
		++connectErrorCount
		showMessage('Connect error: ' + error)

		// If we get Android connect error 133, we wait and try to connect again.
		// This can resolve connect problems on Android when error 133 is seen.
		// In a production app you may want to have a function for aborting or
		// maximising the number of connect attempts. Note that attempting reconnect
		// does not block the app however, so you can still do other tasks and
		// update the UI of the app.
		if (133 == error)
		{
			showMessage('Reconnecting...')
			setTimeout(function() { connectToDevice(device) }, 1000)
		}
	}
}

function testIfBonded()
{
	console.log('test if bonded')

	// Read encrypted characteristic to test if device is bonded.
	// This will fail (on iOS) if not bonded.
	var service = evothings.ble.getService(mDevice, WEATHER_SERVICE)
	var characteristic = evothings.ble.getCharacteristic(service, WEATHER_TEMPERATURE)
	evothings.ble.readCharacteristic(
		mDevice,
		characteristic,
		function(data)
		{
		console.log('bonded')
			// We are bonded. Continue to read device data.
			readDevice()
		},
		function(errorCode)
		{
			// Not bonded, try again.
			console.log('not bonded')
			showMessage('Device not bonded. Please Connect again.')
		})
}

function readDevice()
{
	showMessage('Reading device data')

	// Read static device data.
	readCharacteristic(
		mDevice,
		INFO_SERVICE,
		INFO_MANUFACTURER,
		'device-manufacturer',
		dataToAscii)

	readCharacteristic(
		mDevice,
		INFO_SERVICE,
		INFO_FIRMWARE,
		'device-firmware',
		dataToAscii)

	// Periodically read accelerometer.
	clearInterval(mPollingTimer)
	mPollingTimer = setInterval(
		function()
		{
			readAccelerometer()
			readTemperature()
		},
		1000)
}

function readCharacteristic(device, serviceUUID, characteristicUUID, elementId, dataConversionFunction)
{
	var service = evothings.ble.getService(device, serviceUUID)
	var characteristic = evothings.ble.getCharacteristic(service, characteristicUUID)
	evothings.ble.readCharacteristic(
		device,
		characteristic,
		function(data)
		{
			document.getElementById(elementId).innerHTML =
				dataConversionFunction(data)
		},
		function(errorCode)
		{
			showMessage('readCharacteristic error: ' + errorCode)
		})
}

function readAccelerometer()
{
	readCharacteristic(
		mDevice,
		MOTION_SERVICE,
		MOTION_ACCELEROMETER,
		'device-accelerometer',
		convert3x16bitDataToString)
}

function readTemperature()
{
	readCharacteristic(
		mDevice,
		WEATHER_SERVICE,
		WEATHER_TEMPERATURE,
		'device-temperature',
		convertTemperatureDataToString)
}

function dataToAscii(data)
{
	return String.fromCharCode.apply(null, new Uint8Array(data))
}

function convert3x16bitDataToString(data)
{
	var array = new Int16Array(data)
	return array[0] + ' ' + array[1] + ' ' + array[2]
}

function convertTemperatureDataToString(data)
{
	return (new Int16Array(data)[0]) / 100.0
}

function showMessage(text)
{
	//document.querySelector('#message').innerHTML = text
	console.log(text)
}

function writeandreaddata(sendData){
  if(connectStateBLE === true)
  {
      console.log('send Data = ' + sendData);
      console.log('>>>>>>>>>>>>>>>>>>  ' + sendData.length);
      var uint1=new Uint8Array(sendData.length);
      console.log('uint1 length: ' + uint1.length);

      for(var i=0,j=sendData.length;i<j;++i){
        uint1[i]=sendData.charCodeAt(i);
      }
      evothings.ble.writeCharacteristic(saveDevice, writeCharacteristic1, uint1, writeAndReadDataSuccess, writeAndReadDataError)

      function writeAndReadDataSuccess()
      {
        console.log('success');
        //evothings.ble.enableNotification(saveDevice, writeCharacteristic1, ReadNotification, ReadNotificationError)
      }

      function ReadNotification(readDataArray)
      {
        //console.log('ReadNotification Data = ' + evothings.ble.fromUtf8(readDataArray));
        var readData = evothings.ble.fromUtf8(readDataArray);

        //----------------------------------------------------------------------------
    }

      function ReadNotificationError(error)
      {
        console.log('Read Notification Error: ' + error)

      }

      function writeAndReadDataError(error)
      {
        console.log('Write and Read Data error: ' + error)

      }
  }
}

function createDeviceTracker()
{
  var tracker = {}

  var connectedDevices = {}

  tracker.addDevice = function(device)
  {
    connectedDevices[device.address] = device
  }

  tracker.closeAllDevices = function()
  {
    for (var address in connectedDevices)
    {
      var device = connectedDevices[address]
      evothings.ble.close(device)
    }
    connectedDevices = {}
  }

  return tracker
}

var loadCanvasImage = (imgPath) => {
  var canvas = document.getElementById("c_capture");
  if(canvas.getContext){
    var draw = canvas.getContext("2d");
    
    var img = new Image();
    img.src = imgPath;
    img.onload = function(){
      draw.drawImage(img, 0, 0, photoArea_width, photoArea_height);
    }
  }
}

var onConfirmExit = (button) => {
	if(button === 2){
		return;
	} else {
		disconnectDevice();
		setTimeout(() => {
			navigator.app.exitApp();
		}, 1000);
	}
}

var reloadTakePicturePage = () => {
	$('.page1').hide();
	$('.page2').hide();
	$('.home').show();
	CameraPreview.startCamera({x: 0, y: 64, width: photoArea_width, height: photoArea_height, toBack: true, previewDrag: false, tapPhoto: false});
}

var imageProcessing = () => {
		console.log('start imageProcessing');
	
		let imgElement = document.getElementById('c_capture');
		let mat = cv.imread(imgElement);
		let gray = new cv.Mat();
		let dsize = new cv.Size(640, 640);
		
		cv.resize(mat, mat, dsize, 0, 0, cv.INTER_AREA);
		cv.cvtColor(mat, gray, cv.COLOR_RGB2GRAY, 0);
		// cv.threshold(gray, gray, 100, 200, cv.THRESH_BINARY);
		cv.adaptiveThreshold(gray, gray, 200, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 3, 2);
		cv.imshow('c_capture', gray);
		mat.delete();

		var canvas = document.getElementById("c_capture");
		bRes = Canvas2Image.saveAsBMP(canvas, true);
		console.log('finish imageProcessing');
	
		//console.log(bRes.src);

		setTimeout(() => {
			$('.page1').hide();
			$('.page2').show();
			setTimeout(() => {
				transmitToESP32();
			}, 1000);
		}, 1000);
		
		

		// setTimeout(() => {
		// 	loadingPageSet();
		// 	setTimeout(() => {
		// 		transmitToESP32();
		// 	},1000);
		// }, 10);	
}

var loadingPageSet = () => {
	setTimeout(() => {
		$('.page1').hide();
		$('.page2').show();
		setTimeout(() => {
			$('.page2 button.p_reshot').attr("disabled", true);
			$(".page2 #resultpreview").attr("src", captureImage);
		}, 100);
	}, 100);	
}

var transmitToESP32 = () => {
	// $('.page2 button.p_reshot').attr("disabled", true);
	$(".page2 #resultpreview").attr("src", captureImage);
	if(connectStateBLE === true){
		var add = 10;

		// setTimeout(() => {
		// 	bmp = 0;
		// 	bmpRaw = 0;
		// 	bmpRawBitLength = 0;
		// 	TR_uint8 = 0;
		// 	TR_bufferCount = 0;
		// 	bmpSplit = 0;
		// 	TR_dataBuffer = [];
		// 	TR_dataBufferCount = 0;

		// 	//bmp = bRes.src;
		// 	bmpSplit = bRes.src.split(',');
		// 	console.log("bmpSplit: " + bmpSplit[1]);
		// 	bmp = bmpSplit[1];
		// 	bmpRaw = atob(bmp);
		// 	console.log(bmpRaw);
		// 	bmpRawBitLength = bmpRaw.length;
		// 	TR_uint8 = new Uint8Array(((bmpRawBitLength - 54) / 3));
			
		// 	// console.log("bmpRawBitLength: " + bmpRawBitLength);
		// 	// console.log("bmpRawBitLength / 3 " + bmpRawBitLength / 3);
		// 	// console.log("TR_uint8: " + TR_uint8.length);

		// 	for (var i = 54; i < bmpRawBitLength; i++){
		// 		if(i % 3 == 0){
		// 			// console.log(TR_bufferCount);
		// 			TR_uint8[TR_bufferCount] = bmpRaw.charCodeAt(i);
		// 			TR_bufferCount++;
		// 			// if(TR_bufferCount % 300 == 0){
		// 			// 	for(var j = 0; j < 300; j++){
		// 			// 		TR_dataBuffer[TR_dataBufferCount] += String(TR_uint8[j]);
		// 			// 	}
		// 			// 	TR_dataBufferCount++;
		// 			// }
		// 			// console.log(bmpRaw.charCodeAt(i));
		// 		}
		// 	}
		// }, 10);		

	} else {
		
		// alert("블루투스 연결을 확인해주세요");

		bmp = 0;
		bmpRaw = 0;
		bmpRawBitLength = 0;
		TR_uint8 = 0;
		TR_bufferCount = 0;
		bmpSplit = 0;
		TR_dataBuffer = '';
		TR_dataBufferCount = 0;

		//bmp = bRes.src;
		bmpSplit = bRes.src.split(',');
		console.log("bmpSplit: " + bmpSplit[1]);
		bmp = bmpSplit[1];
		bmpRaw = atob(bmp);
		bmpRawBitLength = bmpRaw.length;
		//console.log("bmpRawBitLength: " + bmpRawBitLength);
		TR_uint8 = new Uint8Array(((bmpRawBitLength - 54) / 3)); // 409600개
		
		// console.log("bmpRawBitLength: " + bmpRawBitLength);
		// console.log("TR_uint8: " + TR_uint8.length);

		for (var i = 54; i < bmpRawBitLength; i++){
			if(i % 3 == 0){
				// console.log(TR_bufferCount);
				if(bmpRaw.charCodeAt(i) == 0){
					TR_uint8[TR_bufferCount] = 1;	
				} else {
					TR_uint8[TR_bufferCount] = 0;	
				}
				TR_bufferCount++;

				// TR_uint8[TR_bufferCount] = bmpRaw.charCodeAt(i);
				// if(TR_bufferCount % 300 == 0){
				// 	for(var j = 0; j < 300; j++){
				// 		TR_dataBuffer[TR_dataBufferCount] += String(TR_uint8[j]);
				// 	}
				// 	TR_dataBufferCount++;
				// }
				// console.log(bmpRaw.charCodeAt(i));
			}
		}
		for (var j = 0; j < TR_uint8.length; j++){
			TR_dataBuffer += TR_uint8[j];
		}
		setTimeout(()=> {
			console.log(TR_uint8);
		}, 1000)
		
		
		var xhttp = new XMLHttpRequest();
		//var TCPdata = '01010101001 '
		var TCPdata = TR_dataBuffer;
		//var a = TR_uint8;
		url = 'http://192.168.4.1/$' + TCPdata;
	
		xhttp.open("GET", url, true);
		xhttp.send();
		console.log('transmit start');
		setTimeout(() => {
			var add = 10;
			var intervalID = setInterval(() => {
				console.log('update progressbar');
				const progress = document.querySelector('.progress-percent');
				progress.style.opacity = 1;
				progress.style.width = add + '%';
				console.log(add);
				if(printFinishFlag == 1 || add == 110){
					clearInterval(intervalID);
					printFinishFlag = 0;
					add = 10;
					progress.style.width = 10 + '%';
					reloadTakePicturePage();
				}
				add += 10;
			},1000)
		}, 10);
		// reloadTakePicturePage();
	}
	$('.page2 button.p_reshot').attr("disabled", false);
}

var initPageSet = () => {
	CameraPreview.startCamera({x: 0, y: 64, width: photoArea_width, height: photoArea_height, toBack: true, previewDrag: false, tapPhoto: false});
	$('.home').show();
	$('.page1').hide();
	$('.page2').hide();	
}

var takePicturePageSet = () => {
	$('.home button.shotbutton').attr("disabled", true);
}

var takePictureSequence = () => {
	setTimeout(() => {
		console.log(3);
		$("#capture").attr("src", "image/count3.png");
		setTimeout(() => {
			console.log(2);
			$("#capture").attr("src", "image/count2.png");
			setTimeout(() => {
				console.log(1);
				$("#capture").attr("src", "image/count1.png");
				setTimeout(() => {
					console.log('shot');

					CameraPreview.takePicture(function(imgData){
						$("#capture").attr("src", "image/empty.png");
						captureImage = 0;
						captureImage = 'data:image/jpeg;base64,' + imgData;
						CameraPreview.stopCamera();
						loadCanvasImage(captureImage);

						$('.home button.shotbutton').attr("disabled", false);
						page1Load();

					});
				}, 1000)
			}, 1000)      
		}, 1000)
	}, 1000)
}

var page1Load = () => {
	setTimeout(() => {
		$('.home').hide();
		$('.page1').show();
		setTimeout(() => {
			$('.page1 button.printbutton').attr("disabled", false);
		}, 10);
	}, 10);
	
}

var printPhotoSequence = () => {
	imageProcessing();
}

var loadingPageSet = () => {
	$('.home').hide();
	$('.page1').hide();
	$('.page2').hide();
}

document.addEventListener('deviceready', function(){

    $(document).ready(() => {   
		loadingPageSet();
		cv['onRuntimeInitialized']=()=>{
			initPageSet();
		}
			//findDevice();

        $('.home button.shotbutton').click(() =>{
			takePicturePageSet();
			takePictureSequence();
        });

		$('button.p_reshot').click(() => {
			reloadTakePicturePage();
		});

		$('.page1 button.printbutton').click(() => {
			$('.page1 button.printbutton').attr("disabled", true);
			console.log('start print');
			printPhotoSequence();
		});

		$('button.dot').click(() => {
			navigator.notification.confirm('앱을 종료하는게 확실한가요?', onConfirmExit, '확인', ['네','아니요']);
		});

    });
  }, false);
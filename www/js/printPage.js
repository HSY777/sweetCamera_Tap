document.addEventListener('deviceready', function(){

    $(document).ready(() => {    
        // CameraPreview.takePicture(function(imgData){
        // captureImage = 0;
        // captureImage = 'data:image/jpeg;base64,' + imgData;
        // $("#capture").attr("src", captureImage);
        // });

        $('button.dot').click(() => {
			navigator.notification.confirm('앱을 종료하는게 확실한가요?', onConfirmExit, '확인', ['네','아니요']);
		});

    });
  }, false);
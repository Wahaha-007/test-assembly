// Date : 16 Sep 24
// Purpose : To use webview and use tensorflow inside it for hand/finger  prediction
// To run program (in Expo) : 
// อย่าลืมไปกด Run forward port ที่ Desktop ก่อนนะ ไม่งั้นติดต่อ port 8081 ไม่ได้ จะไม่เจอ Metro Bundler
// 
// $ npx expo start

import React, { useRef, useState } from 'react';
import { View, StyleSheet, Button, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';

export default function App() {
  const [facing, setFacing] = useState('front'); // Toggle camera front/back
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState(null); // Store captured photo URI
  const cameraRef = useRef(null);
  const webViewRef = useRef(null); // WebView reference

  // Check camera permissions
  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  // Function to toggle camera front/back
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Photo capture (use real capture logic later)
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        // 1. Capture photo from camera -> Var address (URI)
        let photo = await cameraRef.current.takePictureAsync(
          {
            skipProcessing: true,
            quality: 0.5, // Optionally adjust the quality (0-1)
            base64: true, // If you need a base64 encoded string for the image
          }
        );

        const base64Image = `data:image/jpeg;base64,${photo.base64}`;
        setCapturedPhoto(base64Image);
        webViewRef.current.postMessage(JSON.stringify({ image: base64Image }));
      } catch (error) {
        console.error("Error capturing picture:", error);
      }
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'log') {
        console.log('WebView Log:', ...message.message);
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        animateShutter={false}>
        <View style={styles.buttonContainer}>
          <Button title="Flip Camera" onPress={toggleCameraFacing} />
          <Button title="Take Picture" onPress={takePicture} />
        </View>
      </CameraView>

      <WebView
        ref={webViewRef}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleWebViewMessage}
        source={{
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose"></script>
              <script>
								let model

                // 1. Capture console.log and send it to React Native
                (function() {
                  const originalConsoleLog = console.log;
                  console.log = function(...args) {
                    originalConsoleLog.apply(console, args);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: args }));
                  };
                })();
								  
								// 2. Function to load the model once
								async function loadHandposeModel() {
									model = await handpose.load();
									console.log('Handpose model loaded');
								}

                /// 2. Main function for Model prediction
                window.onload = function() {

								  // 2.1. Load the model when the WebView is initialized once
    							loadHandposeModel();

									// 2.2 Detect New Image message, every time new image present
                  document.addEventListener('message', function(event) {
										// console.log('Message RN -> WV');
										const data = JSON.parse(event.data);
										if (data.image) {
											const image = new Image();
											image.crossOrigin = 'anonymous'; // Handle CORS
											image.src = data.image;
											image.onload = async () => {

												// console.log('Image loaded');

												// Set the target width and height for resizing
												const MAX_WIDTH = 320;  // Adjust the width for optimal performance
												const MAX_HEIGHT = 240;

												// Calculate the new dimensions while preserving the aspect ratio
												let targetWidth, targetHeight;
												if (image.width > image.height) {
													targetWidth = MAX_WIDTH;
													targetHeight = image.height * (MAX_WIDTH / image.width);
                          } else {
                            targetHeight = MAX_HEIGHT;
                            targetWidth = image.width * (MAX_HEIGHT / image.height);
                          }

												const canvas = new OffscreenCanvas(targetWidth, targetHeight);
												const ctx = canvas.getContext('2d');
												
												// Create a canvas element to render the resized image
												// const canvas = document.createElement('canvas');
												// const ctx = canvas.getContext('2d');

												// canvas.width = targetWidth;
												// canvas.height = targetHeight;

												// Draw the resized image onto the canvas
												ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
												console.log('Resized image:', targetWidth, 'x', targetHeight);
												
												const predictions = await model.estimateHands(canvas);
												console.log(predictions);
												document.body.innerHTML += '<pre>' + JSON.stringify(predictions, null, 2) + '</pre>';
											};
											image.onerror = (error) => {
												console.error('Image loading error:', error);
											};
										}
									});
                  console.log('Web view script is loaded.');
                };
              </script>
            </head>
            <body>
              <h1>TensorFlow.js in WebView</h1>
            </body>
            </html>
          `,
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  webView: {
    flex: 1,
    marginTop: 20,
  },
});
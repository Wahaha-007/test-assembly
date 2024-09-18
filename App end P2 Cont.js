import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text } from 'react-native';

import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';

export default function App() {
	const [facing, setFacing] = useState('front'); // Toggle camera front/back
	const [permission, requestPermission] = useCameraPermissions();
	const cameraRef = useRef(null);
	const webViewRef = useRef(null); // WebView reference
	//const [processing, setProcessing] = useState(false);
	const [capturedFrame, setCapturedFrame] = useState(null); // Store captured frame
	const processingRef = useRef(false); // Use ref to track processing status

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

	// Capture frames from the video at a specific frequency
	const startFrameExtraction = async () => {
		if (cameraRef.current) {
			processingRef.current = true; // Set ref to true
			const intervalId = setInterval(async () => {
				console.log(processingRef.current);
				if (processingRef.current) {
					const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
					const base64Image = `data:image/jpeg;base64,${photo.base64}`;
					webViewRef.current.postMessage(JSON.stringify({ image: base64Image }));
				}
			}, 1000 / 2); // 2 frames per second

			setCapturedFrame(intervalId);
		}
	};

	// Stop frame extraction
	const stopFrameExtraction = () => {
		clearInterval(capturedFrame);
		processingRef.current = false; // Set ref to false
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
			<CameraView style={styles.camera} facing={facing} ref={cameraRef}>
				<View style={styles.buttonContainer}>
					<Button title="Flip Camera" onPress={toggleCameraFacing} />
					{!processingRef.current ? (
						<Button title="Start" onPress={startFrameExtraction} />
					) : (
						<Button title="Stop" onPress={stopFrameExtraction} />
					)}
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
								let model;
								let worker;

                // 1. Capture console.log and send it to React Native
                (function() {
                  const originalConsoleLog = console.log;
                  console.log = function(...args) {
                    originalConsoleLog.apply(console, args);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: args }));
                  };
                })();
								  

                /// 2. Main function for Model prediction
                window.onload = async function() {
									console.log('Web view script is loading.');		
									
								  // 2.1. Load the model when the WebView is initialized once									
									model = await handpose.load();
									console.log('Handpose model loaded');

									// 2.2 Detect New Image message, every time new image present

									// Initialize worker thread for predictions
                  worker = new Worker(URL.createObjectURL(new Blob([\`
                    self.onmessage = async function(event) {
                      const canvasData = event.data;
                      const predictions = await model.estimateHands(canvasData);
                      self.postMessage(predictions);
                    }
                  \`])));
									console.log(worker);

                  document.addEventListener('message', function(event) {
										console.log('Message RN -> WV');
										const data = JSON.parse(event.data);
										if (data.image) {
											processImage(data.image);
											console.log(data.image);
										}
									});	
									console.log('Web view script is loaded.');		
								};

								async function processImage(imageData) {
                  const start = performance.now();
                  const image = new Image();
                  image.src = imageData;
									image.crossOrigin = 'anonymous'; // Handle CORS
	
									image.onload = async () => {
										const canvas = new OffscreenCanvas(320, 240);
										const ctx = canvas.getContext('2d');
										ctx.drawImage(image, 0, 0, 320, 240);
										
										// Send the canvas data to the worker
                    worker.postMessage(canvas);
                   	worker.onmessage = function(predictions) {
                      console.log(predictions.data);
                      drawLandmarks(predictions.data);
                      const end = performance.now();
                      console.log('Prediction took:', (end - start).toFixed(2), 'ms');
                    };
                  };
                }
        				
								// Draw landmarks on canvas
                function drawLandmarks(predictions) {
                  const canvas = document.createElement('canvas');
                  document.body.appendChild(canvas);
                  const ctx = canvas.getContext('2d');
                  canvas.width = 320;
                  canvas.height = 240;

                  if (predictions && predictions.length > 0) {
                    predictions.forEach(prediction => {
                      prediction.landmarks.forEach((point, index) => {
                        ctx.beginPath();
                        ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
                        ctx.fillStyle = 'red';
                        ctx.fill();

                        // Draw line between points
                        if (index > 0) {
                          const prevPoint = prediction.landmarks[index - 1];
                          ctx.moveTo(prevPoint[0], prevPoint[1]);
                          ctx.lineTo(point[0], point[1]);
                          ctx.strokeStyle = 'blue';
                          ctx.stroke();
                        }
                      });
                    });
                  }
                }
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
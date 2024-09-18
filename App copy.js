import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text } from 'react-native';

import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';

import { GLView } from 'expo-gl';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as handpose from '@tensorflow-models/handpose';

export default function App() {
	const [facing, setFacing] = useState('front'); // Toggle camera front/back
	const [permission, requestPermission] = useCameraPermissions();
	const cameraRef = useRef(null);
	const webViewRef = useRef(null); // WebView reference

	const processingRef = useRef(false); // Use ref to track processing status
	const isCapturingRef = useRef(false);
	const isHandposeLoadedRef = useRef(false);

	useEffect(() => {
		// Initialize TensorFlow.js
		tf.ready().then(async () => {
			console.log('TensorFlow is ready');
			await loadHandposeModel(); // Load the handpose model once
		});
	}, []);

	// Load Handpose model only once
	const loadHandposeModel = async () => {
		await handpose.load().then((model) => {
			global.handposeModel = model; // Store the model globally for reuse
			isHandposeLoadedRef.current = true;
			console.log('Handpose model loaded');
		});
	};

	// Start the frame extraction and send frames to WebView
	const onContextCreate = async (gl) => {
		console.log("GL context created.");

		const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

		// Create an offscreen canvas for converting WebGL buffer to image
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		const loop = () => {

			console.log(isCapturingRef.current, ",", processingRef.current, ",", isHandposeLoadedRef.current);
			if (isCapturingRef.current && !processingRef.current && cameraRef.current && isHandposeLoadedRef.current) {
				processingRef.current = true;

				// Render the camera view onto a WebGL texture
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				cameraRef.current.render();

				// Read the WebGL frame buffer
				const pixels = new Uint8Array(width * height * 4); // RGBA
				// gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

				// Create an ImageData object from the pixel buffer
				const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);

				// Draw the ImageData onto the canvas
				ctx.putImageData(imageData, 0, 0);

				const base64Image = canvas.toDataURL('image/jpeg', 0.5); // quality 0.5

				console.log(base64Image);

				// Send the base64 image to WebView for handpose detection
				// webViewRef.current.postMessage(JSON.stringify({ image: base64Image }));

				// End the WebGL frame
				gl.endFrameEXP();
				console.log("Sent to Webview");

				processingRef.current = false; // Reset processing flag
			}

			// Add a delay before the next frame (e.g., 500ms)
			setTimeout(() => {
				requestAnimationFrame(loop);
			}, 1000); // 500ms delay for debugging
		};

		loop(); // Start the animation loop
	};


	// Function to toggle camera front/back
	const toggleCameraFacing = () => {
		setFacing(current => (current === 'back' ? 'front' : 'back'));
	};

	// Start capturing frames
	const startCapture = () => {
		isCapturingRef.current = true;
		console.log('Started capturing frames');
	};

	// Stop capturing frames
	const stopCapture = () => {
		isCapturingRef.current = false;
		console.log('Stopped capturing frames');
	};

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
			<GLView style={styles.camera} onContextCreate={onContextCreate} />

			<CameraView style={styles.camera} facing={facing} ref={cameraRef}>
				<View style={styles.buttonContainer}>
					<Button title="Flip Camera" onPress={toggleCameraFacing} />
					{!isCapturingRef.current ? (
						<Button title="Start" onPress={startCapture} />
					) : (
						<Button title="Stop" onPress={stopCapture} />
					)}
				</View>
			</CameraView>

			<WebView
				ref={webViewRef}
				style={styles.webView}
				originWhitelist={['*']}
				javaScriptEnabled={true}
				domStorageEnabled={true}
				// onMessage={handleWebViewMessage}
				onMessage={(event) => console.log(event.nativeEvent.data)}
				source={{
					html: `
            <!DOCTYPE html>
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
              <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose"></script>
              <script>
                let model;

                // Load the handpose model
                async function loadModel() {
                  model = await handpose.load();
                  console.log('Handpose model loaded');
                }
                loadModel();

								(function() {
                  const originalConsoleLog = console.log;
                  console.log = function(...args) {
                    originalConsoleLog.apply(console, args);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: args }));
                  };
                })();

                window.onload = function() {
                  document.addEventListener('message', function(event) {
                    const data = JSON.parse(event.data);
										console.log("Got Data",data.image);
                    if (data.image) {
                      const image = new Image();
                      image.src = data.image;
                      image.onload = async () => {
												console.log("Image Loaded");
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0, 320, 240); // Resize for faster processing
                        const predictions = await model.estimateHands(canvas);
                        console.log('Predictions:', predictions);
                        if (predictions.length > 0) {
                          const landmarks = predictions[0].landmarks;
                          ctx.beginPath();
                          ctx.strokeStyle = 'red';
                          landmarks.forEach(([x, y]) => {
                            ctx.lineTo(x, y);
                          });
                          ctx.stroke();
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'predictions', data: predictions }));
                        }
                      };
                    }
                  });
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
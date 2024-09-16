// Date : 16 Sep 24
// Purpose : To Chat with GPT and gradually develop program for WebAssembly
// To run program (in Expo) : 
// อย่าลืมไปกด Run forward port ที่ Desktop ก่อนนะ ไม่งั้นติดต่อ port 8081 ไม่ได้ จะไม่เจอ Metro Bundler
// 
// $ npx expo start

import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

export default function App() {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const cameraRef = useRef(null);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };


  // useRef เหมือน useState แต่ง่ายกว่าคือเปลี่ยนเฉย ไม่มี ReRender เลยเอามาใช้อ้างถึง GUI Element เองได้ด้วย
  // ใช้คู่กับ .current เป็นหลักล่ะ
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync(
          // {
          //   quality: 1, // Optionally adjust the quality (0-1)
          //   base64: true, // If you need a base64 encoded string for the image
          //   exif: true,  // If you want to include EXIF data
          //   skipProcessing: false, // Set to true to skip extra processing (e.g., rotation)
          // }
        );
      } catch (error) {
        console.error("Error capturing picture:", error);
      }
      setCapturedPhoto(photo.uri);
    }
  };

  // Example of return photo object
  // {
  //   "uri": "file:///path/to/image.jpg",
  //   "width": 4000,
  //   "height": 3000,
  //   "base64": "<base64-encoded-image-data>",
  //   "exif": {
  //     "GPSLatitude": 37.7749,
  //     "GPSLongitude": -122.4194
  //   }
  // }

  return (
    <View style={styles.container}>
      {capturedPhoto ? (
        <View style={styles.previewContainer}>
          <Text style={styles.message}>Captured Photo:</Text>
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
          <Button title="Retake" onPress={() => setCapturedPhoto(null)} />
        </View>
      ) : (
        <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
              <Text style={styles.text}>Flip Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={takePicture}>
              <Text style={styles.text}>Take Picture</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    fontSize: 18,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 20,
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
    // backgroundColor: '#fff',
    marginHorizontal: 10,
    padding: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});

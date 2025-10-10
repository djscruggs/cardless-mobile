import { CameraView, useCameraPermissions } from 'expo-camera';
import * as React from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { Button, Text, View } from '@/components/ui';

type IdPhotoCaptureProps = {
  onPhotoTaken: (photo: { uri: string; base64?: string }) => void;
  isLoading?: boolean;
};

/* eslint-disable max-lines-per-function */
export function IdPhotoCapture({
  onPhotoTaken,
  isLoading = false,
}: IdPhotoCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [isTakingPhoto, setIsTakingPhoto] = React.useState(false);

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    try {
      setIsTakingPhoto(true);
      console.log('📸 Taking photo...');

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo) {
        console.log('✅ Photo taken:', {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          hasBase64: !!photo.base64,
        });
        onPhotoTaken(photo);
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-center text-lg">
          Camera permission is required to capture your ID
        </Text>
        <Button
          label="Grant Camera Permission"
          onPress={requestPermission}
          testID="grant-camera-permission"
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.overlay} className="flex-1 justify-end p-6">
        {/* Instruction overlay */}
        <View className="mb-4 rounded-lg bg-black/70 p-4">
          <Text className="text-center text-white">
            Position your ID within the frame
          </Text>
          <Text className="mt-2 text-center text-sm text-white/70">
            Make sure all text is clearly visible
          </Text>
        </View>

        {/* Capture button */}
        <Button
          label={isTakingPhoto ? 'Capturing...' : 'Capture ID Photo'}
          onPress={handleTakePhoto}
          disabled={isTakingPhoto || isLoading}
          loading={isTakingPhoto || isLoading}
          testID="capture-id-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
});

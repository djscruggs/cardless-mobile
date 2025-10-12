import { CameraView, useCameraPermissions } from 'expo-camera';
import * as React from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Text, View } from '@/components/ui';

type SelfiePhotoCaptureProps = {
  onPhotoTaken: (photo: { uri: string; base64?: string }) => void;
  isLoading?: boolean;
};

/* eslint-disable max-lines-per-function */
export function SelfiePhotoCapture({
  onPhotoTaken,
  isLoading = false,
}: SelfiePhotoCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const [isTakingPhoto, setIsTakingPhoto] = React.useState(false);
  const [capturedPhoto, setCapturedPhoto] = React.useState<{
    uri: string;
    base64?: string;
  } | null>(null);

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    try {
      setIsTakingPhoto(true);
      console.log('📸 Taking selfie...');

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo) {
        console.log('✅ Selfie taken:', {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          hasBase64: !!photo.base64,
        });
        setCapturedPhoto(photo);
      }
    } catch (error) {
      console.error('❌ Error taking selfie:', error);
      Alert.alert('Error', 'Failed to take selfie. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleSubmit = () => {
    if (capturedPhoto) {
      onPhotoTaken(capturedPhoto);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
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
          Camera permission is required to capture your selfie
        </Text>
        <Button
          label="Grant Camera Permission"
          onPress={requestPermission}
          testID="grant-camera-permission"
        />
      </View>
    );
  }

  // Show preview after photo is taken
  if (capturedPhoto) {
    return (
      <View className="flex-1 bg-black">
        <Image source={{ uri: capturedPhoto.uri }} style={styles.preview} />
        <View style={styles.overlay} className="flex-1 justify-between p-6">
          <View className="mt-16">
            <View className="rounded-lg bg-black/70 p-4">
              <Text className="text-center text-lg font-semibold text-white">
                Review Your Selfie
              </Text>
              <Text className="mt-2 text-center text-sm text-white/80">
                Make sure your face is clearly visible
              </Text>
            </View>
          </View>

          <View className="space-y-3">
            <Button
              label="Submit Photo"
              onPress={handleSubmit}
              disabled={isLoading}
              loading={isLoading}
              testID="submit-selfie-button"
            />
            <Button
              label="Retake Photo"
              variant="outline"
              onPress={handleRetake}
              disabled={isLoading}
              testID="retake-selfie-button"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <View style={styles.overlay} className="flex-1 justify-between p-6">
        {/* Face guide overlay */}
        <View style={styles.guideContainer} pointerEvents="none">
          <Svg height="100%" width="100%" style={styles.svg}>
            <Circle
              cx="50%"
              cy="45%"
              r="35%"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeDasharray="10,5"
              fill="none"
              opacity={0.8}
            />
          </Svg>
        </View>

        {/* Top instructions */}
        <View className="mt-16">
          <View className="rounded-lg bg-black/70 p-4">
            <Text className="text-center text-lg font-semibold text-white">
              Position Your Face
            </Text>
            <Text className="mt-2 text-center text-sm text-white/80">
              Center your face in the circle
            </Text>
          </View>
        </View>

        {/* Bottom instructions and button */}
        <View>
          <View className="mb-4 rounded-lg bg-black/70 p-4">
            <Text className="text-center text-white">
              Tips for best results:
            </Text>
            <Text className="mt-2 text-center text-sm text-white/70">
              • Face the camera directly
            </Text>
            <Text className="text-center text-sm text-white/70">
              • Ensure good lighting
            </Text>
            <Text className="text-center text-sm text-white/70">
              • Remove sunglasses
            </Text>
            <Text className="text-center text-sm text-white/70">
              • Keep eyes open
            </Text>
          </View>

          <Button
            label={isTakingPhoto ? 'Capturing...' : 'Capture Selfie'}
            onPress={handleTakePhoto}
            disabled={isTakingPhoto || isLoading}
            loading={isTakingPhoto || isLoading}
            testID="capture-selfie-button"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  preview: {
    flex: 1,
    resizeMode: 'contain',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  guideContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

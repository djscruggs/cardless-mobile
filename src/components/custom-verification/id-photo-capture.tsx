import { CameraView, useCameraPermissions } from 'expo-camera';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { Button, Text, View } from '@/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type IdPhotoCaptureProps = {
  onPhotoTaken: (photos: {
    front: { uri: string; base64?: string };
    back?: { uri: string; base64?: string };
  }) => void;
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
  const [step, setStep] = React.useState<'front' | 'back' | 'review'>('front');
  const [frontPhoto, setFrontPhoto] = React.useState<{
    uri: string;
    base64?: string;
  } | null>(null);
  const [backPhoto, setBackPhoto] = React.useState<{
    uri: string;
    base64?: string;
  } | null>(null);

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) return;

    try {
      setIsTakingPhoto(true);
      console.log(`📸 Taking ${step} photo...`);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo) {
        console.log(`✅ ${step} photo taken:`, {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          hasBase64: !!photo.base64,
        });

        if (step === 'front') {
          setFrontPhoto(photo);
          setStep('back');
        } else if (step === 'back') {
          setBackPhoto(photo);
          setStep('review');
        }
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleSkipBack = () => {
    setStep('review');
  };

  const handleSubmit = () => {
    if (frontPhoto) {
      onPhotoTaken({
        front: frontPhoto,
        back: backPhoto || undefined,
      });
    }
  };

  const handleRetakeFront = () => {
    setFrontPhoto(null);
    setBackPhoto(null);
    setStep('front');
  };

  const handleRetakeBack = () => {
    setBackPhoto(null);
    setStep('back');
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

  // Show review screen with swipeable photos
  if (step === 'review' && frontPhoto) {
    return (
      <View className="flex-1 bg-black">
        {/* Swipeable Photos */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroller}
        >
          {/* Front Photo */}
          <View style={[styles.photoPage, { width: SCREEN_WIDTH }]}>
            <Image source={{ uri: frontPhoto.uri }} style={styles.fullPhoto} />
            <View className="absolute inset-x-4 top-4">
              <View className="rounded-lg bg-black/70 px-4 py-2">
                <Text className="text-center text-sm font-semibold text-white">
                  Front of ID
                </Text>
              </View>
            </View>
          </View>

          {/* Back Photo (if captured) */}
          {backPhoto && (
            <View style={[styles.photoPage, { width: SCREEN_WIDTH }]}>
              <Image source={{ uri: backPhoto.uri }} style={styles.fullPhoto} />
              <View className="absolute inset-x-4 top-4">
                <View className="rounded-lg bg-black/70 px-4 py-2">
                  <Text className="text-center text-sm font-semibold text-white">
                    Back of ID
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Swipe Indicator */}
        <View className="absolute inset-x-0 top-20 items-center">
          <View className="rounded-full bg-black/50 px-4 py-2">
            <Text className="text-xs text-white/70">
              {backPhoto ? '← Swipe to view both photos →' : ''}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <View className="mb-4 rounded-lg bg-black/70 p-4">
            <Text className="text-center text-lg font-semibold text-white">
              Review Your Photos
            </Text>
            <Text className="mt-2 text-center text-sm text-white/80">
              Make sure all text is clearly visible
            </Text>
            {!backPhoto && (
              <Text className="mt-2 text-center text-xs text-yellow-400">
                ℹ️ Back photo not captured (optional but recommended)
              </Text>
            )}
          </View>

          <View className="space-y-3">
            <Button
              label={isLoading ? 'Processing...' : 'Submit for Processing'}
              onPress={handleSubmit}
              disabled={isLoading}
              loading={isLoading}
              className="bg-blue-600"
              testID="submit-id-button"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Retake Front"
                  onPress={handleRetakeFront}
                  disabled={isLoading}
                  className="bg-red-600"
                  testID="retake-front-button"
                />
              </View>
              <View className="flex-1">
                <Button
                  label={backPhoto ? 'Retake Back' : 'Add Back'}
                  onPress={handleRetakeBack}
                  disabled={isLoading}
                  className="bg-red-600"
                  testID="retake-back-button"
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Camera view for front or back
  return (
    <View className="flex-1">
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.overlay} className="flex-1 justify-end p-6">
        {/* Instruction overlay */}
        <View className="mb-4 rounded-lg bg-black/70 p-4">
          <Text className="text-center text-lg font-semibold text-white">
            {step === 'front' ? 'Capture Front of ID' : 'Capture Back of ID'}
          </Text>
          <Text className="mt-2 text-center text-white">
            Position your ID within the frame
          </Text>
          <Text className="mt-1 text-center text-sm text-white/70">
            Make sure all text is clearly visible
          </Text>
          {step === 'back' && (
            <Text className="mt-2 text-center text-xs text-yellow-400">
              ℹ️ Back photo is recommended for better verification
            </Text>
          )}
        </View>

        {/* Capture button */}
        <View className="space-y-3">
          <Button
            label={
              isTakingPhoto
                ? 'Capturing...'
                : step === 'front'
                  ? 'Capture Front'
                  : 'Capture Back'
            }
            onPress={handleTakePhoto}
            disabled={isTakingPhoto || isLoading}
            loading={isTakingPhoto || isLoading}
            className="bg-blue-600"
            testID={`capture-${step}-button`}
          />
          {step === 'back' && (
            <Button
              label="Skip Back Photo"
              onPress={handleSkipBack}
              disabled={isTakingPhoto || isLoading}
              className="bg-gray-600"
              testID="skip-back-button"
            />
          )}
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
  photoScroller: {
    flex: 1,
  },
  photoPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

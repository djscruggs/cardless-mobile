import { CameraView, useCameraPermissions } from 'expo-camera';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Button, Text, View } from '@/components/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle) as any;

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
  const [showSetup, setShowSetup] = React.useState(true);
  const [capturedPhoto, setCapturedPhoto] = React.useState<{
    uri: string;
    base64?: string;
  } | null>(null);

  // Animation for the scanning effect
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedCircleProps = useAnimatedProps<any>(() => ({
    rotation: rotation.value,
  }));

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
      <View className="flex-1 items-center justify-center bg-charcoal-900 p-6">
        <View className="mb-8 size-24 items-center justify-center rounded-full bg-teal-500/20">
          <Text className="text-5xl">📸</Text>
        </View>
        <Text className="mb-3 text-center text-2xl font-bold text-white">
          Camera Access Needed
        </Text>
        <Text className="mb-8 text-center text-base text-neutral-400">
          We need access to your camera to capture your selfie for identity
          verification
        </Text>
        <Button
          label="Grant Camera Permission"
          onPress={requestPermission}
          testID="grant-camera-permission"
          className="bg-teal-500"
        />
      </View>
    );
  }

  // Show setup screen before starting liveness check
  if (showSetup) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-900 p-6">
        {/* Icon */}
        <View className="mb-8 size-32 items-center justify-center">
          <Svg height="128" width="128" viewBox="0 0 128 128">
            {/* Face outline with teal color */}
            <Circle
              cx="64"
              cy="64"
              r="56"
              stroke="#00FFE1"
              strokeWidth="3"
              fill="none"
            />
            {/* Simplified face icon */}
            <Circle cx="48" cy="56" r="4" fill="#00FFE1" />
            <Circle cx="80" cy="56" r="4" fill="#00FFE1" />
            {/* Smile arc */}
            <Circle
              cx="64"
              cy="64"
              r="20"
              stroke="#00FFE1"
              strokeWidth="3"
              fill="none"
              strokeDasharray="31.4 62.8"
              transform="rotate(0 64 64)"
            />
            {/* Scanning lines effect */}
            <AnimatedCircle
              cx="64"
              cy="64"
              r="56"
              stroke="#00FFE1"
              strokeWidth="2"
              fill="none"
              strokeDasharray="8 8"
              opacity={0.6}
              animatedProps={animatedCircleProps}
              origin="64, 64"
            />
          </Svg>
        </View>

        {/* Title */}
        <Text className="mb-3 text-center text-3xl font-bold text-white">
          Set Up FaceSign
        </Text>

        {/* Instructions */}
        <Text className="mb-8 text-center text-base text-neutral-400">
          First, position your face in the camera frame. Then follow the
          instructions given.
        </Text>

        {/* Privacy links */}
        <View className="mb-8 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4">
          <View className="flex-row items-center">
            <Text className="text-2xl">ℹ️</Text>
            <View className="ml-3 flex-1">
              <Text className="text-sm text-neutral-300">
                Learn about{' '}
                <Text
                  className="text-teal-500 underline"
                  onPress={() =>
                    Linking.openURL('https://idos.network/facesign')
                  }
                >
                  FaceSign
                </Text>
                , view our{' '}
                <Text
                  className="text-teal-500 underline"
                  onPress={() =>
                    Linking.openURL('https://idos.network/privacy')
                  }
                >
                  Privacy Policy
                </Text>
                {' and our '}
                <Text
                  className="text-teal-500 underline"
                  onPress={() => Linking.openURL('https://idos.network/terms')}
                >
                  Terms & Conditions
                </Text>
                .
              </Text>
            </View>
          </View>
        </View>

        {/* Start button */}
        <Button
          label="Start Liveness Check"
          onPress={() => setShowSetup(false)}
          testID="start-liveness-check"
          className="bg-teal-500"
        />
      </View>
    );
  }

  // Show preview after photo is taken
  if (capturedPhoto) {
    return (
      <View className="flex-1 bg-charcoal-900">
        <Image source={{ uri: capturedPhoto.uri }} style={styles.preview} />
        <View style={styles.overlay} className="flex-1 justify-between p-6">
          <View className="mt-16">
            <View className="rounded-xl border border-teal-500/30 bg-charcoal-900/95 p-5">
              <Text className="text-center text-xl font-bold text-white">
                Review Your Selfie
              </Text>
              <Text className="mt-2 text-center text-sm text-teal-400">
                Make sure your face is clearly visible and well-lit
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
              className="bg-teal-500"
            />
            <Button
              label="Retake Photo"
              variant="outline"
              onPress={handleRetake}
              disabled={isLoading}
              testID="retake-selfie-button"
              className="border-teal-500 bg-transparent"
              textClassName="text-teal-400"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-charcoal-900">
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      <View style={styles.overlay} className="flex-1 justify-between p-6">
        {/* Face guide overlay with animated scanning effect */}
        <View style={styles.guideContainer} pointerEvents="none">
          <Svg height="100%" width="100%" style={styles.svg}>
            {/* Main face circle outline */}
            <Circle
              cx="50%"
              cy="45%"
              r="35%"
              stroke="#00FFE1"
              strokeWidth="3"
              fill="none"
              opacity={0.9}
            />
            {/* Animated scanning circle */}
            <AnimatedCircle
              cx="50%"
              cy="45%"
              r="35%"
              stroke="#00FFE1"
              strokeWidth="2"
              strokeDasharray="15 10"
              fill="none"
              opacity={0.6}
              animatedProps={animatedCircleProps}
              origin="50%, 45%"
            />
          </Svg>
        </View>

        {/* Top instructions */}
        <View className="mt-16">
          <View className="rounded-xl border border-teal-500/30 bg-charcoal-900/90 p-5">
            <Text className="text-center text-xl font-bold text-white">
              Position Your Face
            </Text>
            <Text className="mt-2 text-center text-sm text-teal-400">
              Center your face in the circle and follow the instructions
            </Text>
          </View>
        </View>

        {/* Bottom instructions and button */}
        <View>
          <View className="mb-4 rounded-xl border border-teal-500/20 bg-charcoal-900/90 p-5">
            <Text className="mb-3 text-center font-semibold text-white">
              Tips for best results:
            </Text>
            <Text className="text-center text-sm text-neutral-300">
              • Face the camera directly
            </Text>
            <Text className="text-center text-sm text-neutral-300">
              • Ensure good lighting
            </Text>
            <Text className="text-center text-sm text-neutral-300">
              • Remove sunglasses
            </Text>
            <Text className="text-center text-sm text-neutral-300">
              • Keep eyes open
            </Text>
          </View>

          <Button
            label={isTakingPhoto ? 'Capturing...' : 'Capture Selfie'}
            onPress={handleTakePhoto}
            disabled={isTakingPhoto || isLoading}
            loading={isTakingPhoto || isLoading}
            testID="capture-selfie-button"
            className="bg-teal-500"
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

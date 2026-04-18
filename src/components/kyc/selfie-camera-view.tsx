import { CameraView, useCameraPermissions } from 'expo-camera';
import React from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  onCapture: (base64: string, videoUri: string) => void;
};

function OvalOverlay({ sh, ow, oh }: { sh: number; ow: number; oh: number }) {
  const dark = 'rgba(0,0,0,0.45)';
  return (
    <View
      style={[StyleSheet.absoluteFill, { flexDirection: 'column' }]}
      pointerEvents="none"
    >
      <View
        style={{ height: (sh - oh) / 2, backgroundColor: dark, width: '100%' }}
      />
      <View style={{ flexDirection: 'row', height: oh }}>
        <View style={{ flex: 1, backgroundColor: dark }} />
        <View
          style={{
            width: ow,
            height: oh,
            borderRadius: ow / 2,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#FFFFFF',
            overflow: 'hidden',
          }}
        />
        <View style={{ flex: 1, backgroundColor: dark }} />
      </View>
      <View style={{ flex: 1, backgroundColor: dark, width: '100%' }} />
    </View>
  );
}

/* eslint-disable max-lines-per-function */
export function SelfieCameraView({ onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = React.useState(false);
  const cameraRef = React.useRef<CameraView>(null);
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  const recordingRef = React.useRef<Promise<
    { uri: string } | undefined
  > | null>(null);

  const { width: sw, height: sh } = Dimensions.get('window');
  const ow = sw * 0.55;
  const oh = sh * 0.75;

  React.useEffect(() => {
    let active = true;
    const startRecording = async () => {
      // Wait a tick for the camera to be ready
      await new Promise((r) => setTimeout(r, 500));
      if (!active || !cameraRef.current) return;
      recordingRef.current = cameraRef.current.recordAsync({ maxDuration: 30 });
    };
    startRecording();
    return () => {
      active = false;
      cameraRef.current?.stopRecording();
    };
  }, []);

  const handleCapture = React.useCallback(async () => {
    if (captured || !cameraRef.current) return;
    setCaptured(true);

    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 75,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
      }),
    ]).start();

    const [photo, videoResult] = await Promise.all([
      cameraRef.current.takePictureAsync({ quality: 0.9, base64: true }),
      (async () => {
        cameraRef.current?.stopRecording();
        return recordingRef.current;
      })(),
    ]);

    if (photo?.base64 && videoResult?.uri) {
      onCapture(photo.base64, videoResult.uri);
    } else if (photo?.base64) {
      onCapture(photo.base64, '');
    }
  }, [captured, flashOpacity, onCapture]);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-8">
        <Text className="text-center text-base text-gray-600">
          Camera access is required to take a selfie.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="rounded-lg bg-blue-600 px-6 py-4"
        >
          <Text className="font-semibold text-white">Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mode="video"
      />
      <OvalOverlay sh={sh} ow={ow} oh={oh} />
      <View style={styles.tipContainer} pointerEvents="none">
        <Text style={styles.tipText}>
          Remove glasses if you can. Make sure your face is well-lit and fully
          visible.
        </Text>
      </View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: flashOpacity, backgroundColor: '#FFFFFF' },
        ]}
        pointerEvents="none"
      />
      <View style={styles.ctaContainer}>
        <Pressable onPress={handleCapture} style={styles.ctaButton}>
          <Text style={styles.ctaLabel}>Take Selfie</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tipContainer: {
    position: 'absolute',
    bottom: 112,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tipText: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
  ctaContainer: { position: 'absolute', bottom: 32, left: 16, right: 16 },
  ctaButton: {
    height: 64,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

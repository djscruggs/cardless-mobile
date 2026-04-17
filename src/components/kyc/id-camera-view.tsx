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

type QualityState = 'waiting' | 'bad' | 'marginal' | 'good';
type BadReason = 'not-detected' | 'blurry';

type Props = {
  side: 'front' | 'back';
  onCapture: (base64: string, videoUri?: string) => void;
};

const GUIDE_ASPECT = 3.37;
const ANALYSIS_INTERVAL_MS = 200;

const BORDER_COLORS: Record<QualityState, string> = {
  waiting: '#FFFFFF',
  bad: '#DC2626',
  marginal: '#D97706',
  good: '#16A34A',
};

const BADGE_STYLES: Record<
  QualityState,
  { bg: string; text: string; label: string } | null
> = {
  waiting: null,
  bad: { bg: '#DC2626', text: '#FFFFFF', label: '' },
  marginal: {
    bg: '#D97706',
    text: '#FFFFFF',
    label: 'Almost there, adjust position',
  },
  good: { bg: '#16A34A', text: '#FFFFFF', label: 'Looks good!' },
};

const CORNER_ARM = 20;
const CORNER_STROKE = 3;

const arrowPositions = [
  { top: 8, alignSelf: 'center' as const },
  { bottom: 8, alignSelf: 'center' as const },
  { left: 8, top: '50%' as const },
  { right: 8, top: '50%' as const },
];

// ─── sub-components ──────────────────────────────────────────────────────────

type DarkOverlayProps = { sw: number; sh: number; gw: number; gh: number };
function DarkOverlay({ sw, sh, gw, gh }: DarkOverlayProps) {
  const half = 'rgba(0,0,0,0.45)';
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlayContainer]}
      pointerEvents="none"
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: (sh - gh) / 2,
          backgroundColor: half,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: (sh - gh) / 2,
          backgroundColor: half,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: (sh - gh) / 2,
          left: 0,
          width: (sw - gw) / 2,
          height: gh,
          backgroundColor: half,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: (sh - gh) / 2,
          right: 0,
          width: (sw - gw) / 2,
          height: gh,
          backgroundColor: half,
        }}
      />
    </View>
  );
}

type GuideRectProps = {
  sw: number;
  sh: number;
  gw: number;
  gh: number;
  quality: QualityState;
};
function GuideRect({ sw, sh, gw, gh, quality }: GuideRectProps) {
  const borderColor = BORDER_COLORS[quality];
  const shadow =
    quality === 'good'
      ? {
          shadowColor: '#16A34A',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }
      : {};
  return (
    <View
      style={[
        styles.guideRect,
        {
          width: gw,
          height: gh,
          borderColor,
          top: (sh - gh) / 2,
          left: (sw - gw) / 2,
          ...shadow,
        },
      ]}
      pointerEvents="none"
    >
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <View key={c} style={[styles.corner, styles[c]]} pointerEvents="none" />
      ))}
    </View>
  );
}

type PositioningOverlayProps = {
  sw: number;
  sh: number;
  gw: number;
  gh: number;
  opacity: Animated.Value;
  hidden: boolean;
};
function PositioningOverlay({
  sw,
  sh,
  gw,
  gh,
  opacity,
  hidden,
}: PositioningOverlayProps) {
  if (hidden) return null;
  return (
    <Animated.View
      style={[
        styles.positioningOverlay,
        {
          opacity,
          top: (sh - gh) / 2,
          left: (sw - gw) / 2,
          width: gw,
          height: gh,
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.positioningText}>Align your ID with the frame</Text>
      {(['↑', '↓', '←', '→'] as const).map((arrow, i) => (
        <Text key={i} style={[styles.arrow, arrowPositions[i]]}>
          {arrow}
        </Text>
      ))}
    </Animated.View>
  );
}

type QualityBadgeProps = {
  sh: number;
  gh: number;
  quality: QualityState;
  badReason: BadReason;
};
function QualityBadge({ sh, gh, quality, badReason }: QualityBadgeProps) {
  const badge =
    quality === 'bad'
      ? {
          bg: '#DC2626',
          text: '#FFFFFF',
          label:
            badReason === 'blurry' ? 'Hold steady - too blurry' : 'Move closer',
        }
      : BADGE_STYLES[quality];
  if (!badge) return null;
  return (
    <View
      style={[
        styles.badge,
        { top: (sh + gh) / 2 + 12, backgroundColor: badge.bg },
      ]}
      pointerEvents="none"
    >
      <Text style={{ color: badge.text, fontSize: 12, fontWeight: '600' }}>
        {badge.label}
      </Text>
    </View>
  );
}

// ─── hook ────────────────────────────────────────────────────────────────────

function useQualityDetection(cameraRef: React.RefObject<CameraView | null>) {
  const [quality, setQuality] = React.useState<QualityState>('waiting');
  const [badReason, setBadReason] = React.useState<BadReason>('not-detected');
  const [overlayHidden, setOverlayHidden] = React.useState(false);
  const captured = React.useRef(false);

  const measureBlur = React.useCallback(async (): Promise<boolean> => {
    if (!cameraRef.current) return false;
    try {
      const probe = await cameraRef.current.takePictureAsync({
        quality: 0.05,
        base64: true,
        skipProcessing: true,
      });
      if (!probe?.base64) return false;
      const raw = probe.base64;
      const step = Math.floor(raw.length / 200);
      let sum = 0,
        sumSq = 0,
        n = 0;
      for (let i = 0; i < raw.length; i += step) {
        const v = raw.charCodeAt(i);
        sum += v;
        sumSq += v * v;
        n++;
      }
      const mean = sum / n;
      return sumSq / n - mean * mean > 120;
    } catch {
      return true;
    }
  }, [cameraRef]);

  const analyzeFrame = React.useCallback(async () => {
    if (captured.current || overlayHidden) return;
    const isSharp = await measureBlur();
    if (!isSharp) {
      setBadReason('blurry');
      setQuality('bad');
      return;
    }
    setBadReason('not-detected');
    setQuality('good');
  }, [overlayHidden, measureBlur]);

  React.useEffect(() => {
    const timer = setInterval(analyzeFrame, ANALYSIS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [analyzeFrame]);

  return {
    quality,
    badReason,
    overlayHidden,
    setOverlayHidden,
    capturedRef: captured,
  };
}

// ─── main component ───────────────────────────────────────────────────────────

/* eslint-disable max-lines-per-function */
export function IdCameraView({ side, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  const overlayOpacity = React.useRef(new Animated.Value(0.85)).current;
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  // TODO: wire up video URI to upload when backend endpoint is ready
  const videoUri = React.useRef<string | undefined>(undefined);

  const { quality, badReason, overlayHidden, setOverlayHidden, capturedRef } =
    useQualityDetection(cameraRef);

  const { width: sw, height: sh } = Dimensions.get('window');
  const gw = sw * 0.8;
  const gh = gw / GUIDE_ASPECT;

  React.useEffect(() => {
    if (quality === 'good' && !overlayHidden) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setOverlayHidden(true));
    }
  }, [quality, overlayHidden, overlayOpacity, setOverlayHidden]);

  const handleCapture = React.useCallback(async () => {
    if (quality !== 'good' || capturedRef.current || !cameraRef.current) return;
    capturedRef.current = true; // eslint-disable-line react-compiler/react-compiler
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
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.9,
      base64: true,
    });
    if (photo?.base64) onCapture(photo.base64, videoUri.current);
  }, [quality, capturedRef, flashOpacity, onCapture]);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-8">
        <Text className="text-center text-base text-gray-600">
          Camera access is required to capture your ID.
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

  const ctaEnabled = quality === 'good' && !capturedRef.current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />
      <DarkOverlay sw={sw} sh={sh} gw={gw} gh={gh} />
      <GuideRect sw={sw} sh={sh} gw={gw} gh={gh} quality={quality} />
      <PositioningOverlay
        sw={sw}
        sh={sh}
        gw={gw}
        gh={gh}
        opacity={overlayOpacity}
        hidden={overlayHidden}
      />
      <QualityBadge sh={sh} gh={gh} quality={quality} badReason={badReason} />
      <View
        style={[styles.tipContainer, { top: (sh + gh) / 2 + 48 }]}
        pointerEvents="none"
      >
        <Text style={styles.tipText}>
          {side === 'front'
            ? "Make sure all text is readable and there's no glare"
            : 'Include the barcode - it helps us verify your information'}
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
        <Pressable
          onPress={handleCapture}
          disabled={!ctaEnabled}
          style={[
            styles.ctaButton,
            { backgroundColor: ctaEnabled ? '#2563EB' : '#9CA3AF' },
          ]}
        >
          <Text style={styles.ctaLabel}>
            {side === 'front' ? 'Capture Front' : 'Capture Back'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: { pointerEvents: 'none' },
  guideRect: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderColor: '#FFFFFF',
  },
  tl: {
    top: -CORNER_STROKE,
    left: -CORNER_STROKE,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
  },
  tr: {
    top: -CORNER_STROKE,
    right: -CORNER_STROKE,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
  },
  bl: {
    bottom: -CORNER_STROKE,
    left: -CORNER_STROKE,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
  },
  br: {
    bottom: -CORNER_STROKE,
    right: -CORNER_STROKE,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
  },
  positioningOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positioningText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1,
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1,
  },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tipContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  tipText: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
  ctaContainer: { position: 'absolute', bottom: 32, left: 16, right: 16 },
  ctaButton: {
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

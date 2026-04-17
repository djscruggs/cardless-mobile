import * as ScreenOrientation from 'expo-screen-orientation';
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui';

type Props = {
  children: React.ReactNode;
};

// Shows a blocking "rotate your phone" interstitial until landscape is detected.
// Re-shows if user rotates back to portrait.
export function OrientationGate({ children }: Props) {
  const [isLandscape, setIsLandscape] = React.useState(false);

  React.useEffect(() => {
    const check = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      setIsLandscape(
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      );
    };

    check();

    const sub = ScreenOrientation.addOrientationChangeListener((e) => {
      const o = e.orientationInfo.orientation;
      setIsLandscape(
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      );
    });

    return () => ScreenOrientation.removeOrientationChangeListener(sub);
  }, []);

  if (isLandscape) return <>{children}</>;

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-8">
      <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
        <Path
          d="M17 1H7C5.9 1 5 1.9 5 3v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14z"
          fill="#2563EB"
        />
        <Path d="M9 21h6" stroke="#2563EB" strokeWidth={1.5} />
      </Svg>
      <Text className="text-center text-xl font-semibold text-gray-900">
        Rotate your phone
      </Text>
      <Text className="text-center text-sm text-gray-500">
        Landscape mode gives us a better view of your ID
      </Text>
    </View>
  );
}

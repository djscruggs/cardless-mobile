import { useRouter } from 'expo-router';
import React from 'react';
import { Image } from 'react-native';

import {
  Button,
  FocusAwareStatusBar,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { credentialStorage, useIsFirstTime } from '@/lib';
export default function Onboarding() {
  const [, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();
  const [hasCredential, setHasCredential] = React.useState(false);

  React.useEffect(() => {
    const credential = credentialStorage.getCredential();
    setHasCredential(credential !== null);
  }, []);
  return (
    <View className="flex h-full items-center justify-start px-4">
      <FocusAwareStatusBar />
      <View className="w-full items-center pt-8">
        <Text className="my-0 text-center text-5xl font-bold text-logoblue">
          Cardless ID
        </Text>
        <Text className="mb-2 text-center text-lg text-gray-600">
          Your private digital identity
        </Text>
        <Image
          source={require('../../../assets/hero.png')}
          style={{ width: 400, height: 300 }}
          resizeMode="cover"
        />
      </View>
      <View className="w-full px-8 pt-6">
        <Text className="my-1 text-left text-lg">
          🔒 Privacy-first identity verification
        </Text>
        <Text className="my-1 text-left text-lg">
          ✓ No personal data shared with websites
        </Text>
        <Text className="my-1 text-left text-lg">
          📱 Simple QR code verification
        </Text>
        <Text className="my-1 text-left text-lg">🚫 No database</Text>
        <Text className="my-1 text-left text-lg">🛡️ Impossible to hack</Text>
      </View>
      {!hasCredential && (
        <SafeAreaView className="mt-6">
          <Button
            label="Let's Get Started "
            onPress={() => {
              setIsFirstTime(false);
              router.replace('/(app)');
            }}
          />
        </SafeAreaView>
      )}
    </View>
  );
}

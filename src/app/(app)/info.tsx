import { useRouter } from 'expo-router';
import React from 'react';

import { Cover } from '@/components/cover';
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
    <View className="flex h-full items-center  justify-center pb-6">
      <FocusAwareStatusBar />
      <View className="w-full flex-1">
        <Cover />
      </View>
      <View className="justify-end ">
        <Text className="my-3 text-center text-5xl font-bold">Cardless ID</Text>
        <Text className="mb-2 text-center text-lg text-gray-600">
          Your private digital identity
        </Text>

        <Text className="my-1 pt-6 text-left text-lg">
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

import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function VerificationComplete() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meetsRequirement?: string }>();
  const meetsRequirement = params.meetsRequirement === 'true';

  return (
    <View className="flex-1 items-center justify-center p-6">
      <FocusAwareStatusBar />
      <Text className="mb-4 text-center text-5xl">
        {meetsRequirement ? '✅' : '❌'}
      </Text>
      <Text className="mb-3 text-center text-2xl font-bold dark:text-white">
        {meetsRequirement ? 'Verification Sent' : 'Requirement Not Met'}
      </Text>
      <Text className="mb-8 text-center text-base text-gray-600 dark:text-gray-400">
        {meetsRequirement
          ? 'Your age verification proof has been submitted successfully.'
          : 'You do not meet the age requirement for this request.'}
      </Text>
      <Button label="Back to Home" onPress={() => router.replace('/(app)')} />
    </View>
  );
}

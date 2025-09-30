import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function Scan() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <FocusAwareStatusBar />
      <View className="items-center">
        <Ionicons name="qr-code-outline" size={120} color="#9CA3AF" />
        <Text className="mt-6 text-center text-2xl font-bold">
          QR Code Scanner
        </Text>
        <Text className="mt-4 text-center text-base text-gray-600 dark:text-gray-400">
          Scan a QR code from a website to verify your age
        </Text>
        <Text className="mt-8 text-center text-sm text-gray-500 dark:text-gray-500">
          (Camera integration to be implemented)
        </Text>
      </View>
    </View>
  );
}

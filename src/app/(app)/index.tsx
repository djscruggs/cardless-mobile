import React from 'react';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function MyID() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <FocusAwareStatusBar />
      <View className="w-full max-w-md rounded-lg border-2 border-gray-300 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <View className="my-8 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-gray-100 p-8 dark:border-gray-600 dark:bg-gray-700">
          <Text className="text-center text-gray-500 dark:text-gray-400">
            DID Credential
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-400 dark:text-gray-500">
            (To be implemented)
          </Text>
        </View>
        <View className="mt-4 space-y-2">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Status: <Text className="font-semibold">Not Verified</Text>
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            Wallet Address: <Text className="font-semibold">Not Connected</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

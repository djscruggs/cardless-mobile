import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  currentStep: 1 | 2 | 3 | 4;
  visible: boolean;
};

export function StepIndicator({ currentStep, visible }: Props) {
  if (!visible) return null;

  return (
    <View className="items-center gap-2">
      <Text className="text-xs uppercase tracking-widest text-gray-500">
        Step {currentStep} of 4
      </Text>
      <View className="h-1 w-full flex-row gap-1">
        {([1, 2, 3, 4] as const).map((s) => (
          <View
            key={s}
            className={`h-full flex-1 rounded-full ${s <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
          />
        ))}
      </View>
    </View>
  );
}

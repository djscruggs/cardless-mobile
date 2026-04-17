import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';

type Props = {
  label: string;
  imageUri: string;
  circular?: boolean;
  onRetake: () => void;
};

export function ReviewCard({
  label,
  imageUri,
  circular = false,
  onRetake,
}: Props) {
  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
      <Text className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        {label}
      </Text>
      <Image
        source={{ uri: imageUri }}
        style={
          circular
            ? { width: 100, height: 100, borderRadius: 50, alignSelf: 'center' }
            : { width: '100%', aspectRatio: 16 / 9, borderRadius: 8 }
        }
        resizeMode="cover"
      />
      <Pressable onPress={onRetake} className="mt-2 self-end">
        <Text className="text-sm text-blue-600">Retake</Text>
      </Pressable>
    </View>
  );
}

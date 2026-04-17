import React from 'react';
import { View } from 'react-native';

type Props = {
  top: React.ReactNode;
  middle: React.ReactNode;
  bottom: React.ReactNode;
};

export function KycLayout({ top, middle, bottom }: Props) {
  return (
    <View className="flex-1 bg-white">
      <View className="h-20 justify-end px-4 pb-2">{top}</View>
      <View className="flex-1">{middle}</View>
      <View className="px-4 pb-8">{bottom}</View>
    </View>
  );
}

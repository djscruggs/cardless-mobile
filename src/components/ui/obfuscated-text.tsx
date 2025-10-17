import Clipboard from '@react-native-clipboard/clipboard';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Text } from './text';

interface ObfuscatedTextProps {
  value: string;
  visibleChars?: number;
  testID?: string;
}

/**
 * Component that displays obfuscated text with inline view and copy links
 * Shows first N characters followed by "..."
 */
export function ObfuscatedText({
  value,
  visibleChars = 4,
  testID,
}: ObfuscatedTextProps) {
  const [isRevealed, setIsRevealed] = React.useState(false);

  const obfuscatedValue = React.useMemo(() => {
    if (!value) return '';
    return `${value.slice(0, visibleChars)}...`;
  }, [value, visibleChars]);

  const handleToggleView = () => {
    setIsRevealed(!isRevealed);
  };

  const handleCopy = () => {
    Clipboard.setString(value);
    showMessage({
      message: 'Copied to clipboard',
      type: 'success',
      duration: 2000,
    });
  };

  return (
    <View>
      <Text
        className="text-xl font-semibold dark:text-white"
        testID={testID ? `${testID}-value` : undefined}
      >
        {isRevealed ? value : obfuscatedValue}
      </Text>
      <View className="mt-1 flex-row gap-3">
        <Pressable onPress={handleToggleView}>
          <Text className="mr-4 text-sm text-blue-600 dark:text-blue-400">
            {isRevealed ? 'hide' : 'view'}
          </Text>
        </Pressable>
        <Pressable onPress={handleCopy}>
          <Text className="text-sm text-blue-600 dark:text-blue-400">copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

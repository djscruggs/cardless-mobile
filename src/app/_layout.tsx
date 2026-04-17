/* eslint-disable max-lines-per-function */
// Import crypto polyfill first (required for algosdk)
import 'react-native-get-random-values';
// Import URL polyfill for React Native
import 'react-native-url-polyfill/auto';
// Import  global CSS file
import '../../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { APIProvider } from '@/api';
import { hydrateAuth, loadSelectedTheme } from '@/lib';
import { useThemeConfig } from '@/lib/use-theme-config';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

hydrateAuth();
loadSelectedTheme();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

export default function RootLayout() {
  const router = useRouter();

  // Handle deep linking for age verification requests
  React.useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);

      // Parse the URL
      const { hostname, path, queryParams } = Linking.parse(url);

      // Handle age verification requests
      // Supports 2 formats:
      // 1. https://cardlessid.org/app/wallet-verify?nonce=<NONCE>&minAge=<MIN_AGE> (spec)
      // 2. cardlessid://verify?nonce=<NONCE>&minAge=<MIN_AGE> (deep link variant)
      const isWalletVerify =
        path === '/app/wallet-verify' ||
        hostname === 'verify' ||
        path === 'verify';

      if (isWalletVerify) {
        const nonce = queryParams?.nonce as string | undefined;
        const minAge = queryParams?.minAge as string | undefined;

        if (nonce && minAge) {
          Alert.alert(
            'Age Verification Request',
            'A website is requesting age verification.',
            [
              {
                text: 'Verify',
                onPress: () => {
                  router.push({
                    pathname: '/(app)/scan',
                    params: { nonce, minAge },
                  });
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          console.error('❌ Deep link missing nonce or minAge:', url);
          Alert.alert('Error', 'Invalid verification request');
        }
      }
    };

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      style={styles.container}
      className={theme.dark ? `dark` : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <APIProvider>
            <BottomSheetModalProvider>
              {children}
              <FlashMessage position="top" />
            </BottomSheetModalProvider>
          </APIProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

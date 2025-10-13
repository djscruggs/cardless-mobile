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
      // Supports 3 formats:
      // 1. cardlessid://verify?challenge=chal_123 (CardlessID CDN integration)
      // 2. cardlessid://verify?session=age_123 (Demo mode)
      // 3. cardlessid://verify?data=<base64-json> (Standalone mode)
      if (hostname === 'verify' || path === 'verify') {
        const challengeId = queryParams?.challenge as string | undefined;
        const sessionId = queryParams?.session as string | undefined;
        const encodedData = queryParams?.data as string | undefined;

        // Mode 1: Challenge-based (CardlessID CDN)
        if (challengeId) {
          Alert.alert(
            'Age Verification Request',
            'A website is requesting age verification via CardlessID.',
            [
              {
                text: 'Verify',
                onPress: () => {
                  router.push({
                    pathname: '/(app)/scan',
                    params: { challenge: challengeId },
                  });
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
        // Mode 2: Session-based (Demo)
        else if (sessionId) {
          Alert.alert(
            'Age Verification Request',
            'Demo age verification request.',
            [
              {
                text: 'Verify',
                onPress: () => {
                  router.push({
                    pathname: '/(app)/scan',
                    params: { session: sessionId },
                  });
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
        // Mode 3: Standalone (backward compatibility)
        else if (encodedData) {
          try {
            // Decode the base64 data - just validate it's valid JSON
            const decodedData = atob(encodedData);
            JSON.parse(decodedData);

            Alert.alert(
              'Age Verification Request',
              'A website is requesting age verification.',
              [
                {
                  text: 'Verify',
                  onPress: () => {
                    router.push({
                      pathname: '/(app)/scan',
                      params: { request: encodedData },
                    });
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          } catch (error) {
            console.error('❌ Error parsing deep link data:', error);
            Alert.alert('Error', 'Invalid verification request');
          }
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

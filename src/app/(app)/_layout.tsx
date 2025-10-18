import { Ionicons } from '@expo/vector-icons';
import { SplashScreen, Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image } from 'react-native';

import { credentialStorage, useAuth, useIsFirstTime } from '@/lib';

const LogoIcon = () => (
  <Image
    source={require('../../../assets/favicon.png')}
    style={{ width: 24, height: 24 }}
  />
);

const useSplashScreen = (status: string) => {
  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }
  }, [hideSplash, status]);
};

export default function TabLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  const [hasCredential, setHasCredential] = useState(false);
  useSplashScreen(status);

  useEffect(() => {
    const checkCredential = async () => {
      const credential = await credentialStorage.getCredential();
      setHasCredential(credential !== null);
    };
    checkCredential();
  }, []);

  return (
    <Tabs initialRouteName={hasCredential || !isFirstTime ? 'index' : 'info'}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          headerTitle: 'My Cardless ID',
          tabBarIcon: LogoIcon,
          tabBarButtonTestID: 'myid-tab',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <Ionicons name="qr-code-outline" size={24} color={color} />
          ),
          tabBarButtonTestID: 'scan-tab',
        }}
      />
      <Tabs.Screen
        name="faq"
        options={{
          title: 'FAQ',
          tabBarIcon: ({ color }) => (
            <Ionicons name="help-circle" size={24} color={color} />
          ),
          tabBarButtonTestID: 'faq-tab',
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: 'Info',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={color}
            />
          ),
          tabBarButtonTestID: 'info-tab',
        }}
      />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="style" options={{ href: null }} />
      <Tabs.Screen name="create-identity" options={{ href: null }} />
      <Tabs.Screen name="verify-identity" options={{ href: null }} />
      <Tabs.Screen name="custom-verify" options={{ href: null }} />
    </Tabs>
  );
}

import algosdk from 'algosdk';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { wallet } from '@/lib';
import {
  checkAgeRequirement,
  signProof,
  submitProof,
} from '@/lib/proof-signing';

const ISSUER_ADDRESS = 'CARDLESSID_ISSUER_ADDRESS_PLACEHOLDER';
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* eslint-disable max-lines-per-function */
export default function Scan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ nonce?: string; minAge?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = React.useState(false);

  const handleVerification = React.useCallback(
    async (nonce: string, minAge: number) => {
      try {
        const mnemonic = await wallet.getWalletMnemonic();
        if (!mnemonic) {
          Alert.alert(
            'No Wallet',
            'Please set up your wallet and verify your identity first.',
            [
              {
                text: 'Get Started',
                onPress: () => router.push('/(app)/custom-verify'),
              },
              { text: 'Cancel', onPress: () => setScanned(false) },
            ]
          );
          return;
        }

        const account = algosdk.mnemonicToSecretKey(mnemonic);
        const walletAddress = algosdk.encodeAddress(account.addr.publicKey);

        const meetsRequirement = await checkAgeRequirement(
          walletAddress,
          minAge,
          ISSUER_ADDRESS
        );

        if (!meetsRequirement) {
          Alert.alert(
            'No Valid Credential',
            'You need to verify your identity before you can use age verification.',
            [
              {
                text: 'Verify Identity',
                onPress: () => router.push('/(app)/custom-verify'),
              },
              { text: 'Cancel', onPress: () => setScanned(false) },
            ]
          );
          return;
        }

        Alert.alert(
          'Age Verification Request',
          `A website is requesting age verification (${minAge}+). Proceed?`,
          [
            {
              text: 'Send Verification',
              onPress: async () => {
                try {
                  const proof = signProof({
                    nonce,
                    minAge,
                    meetsRequirement: true,
                    account,
                  });
                  await submitProof(nonce, proof);
                  showMessage({
                    message: 'Verification sent successfully',
                    type: 'success',
                  });
                  router.push(
                    '/(app)/verification-complete?meetsRequirement=true' as any
                  );
                } catch (error: unknown) {
                  const axiosError = error as {
                    response?: { data?: { error?: string }; status?: number };
                  };
                  const serverError = axiosError?.response?.data?.error;
                  const status = axiosError?.response?.status;

                  if (status === 400 && serverError === 'invalid nonce') {
                    Alert.alert(
                      'Session Expired',
                      'This verification request has expired. Please re-scan the QR code.',
                      [{ text: 'OK', onPress: () => setScanned(false) }]
                    );
                  } else if (
                    status === 400 &&
                    serverError === 'signature verification failed'
                  ) {
                    Alert.alert(
                      'Verification Failed',
                      'Signature check failed.',
                      [{ text: 'OK', onPress: () => setScanned(false) }]
                    );
                  } else if (status === 451) {
                    Alert.alert(
                      'Not Available',
                      'This service is not available in your region.',
                      [{ text: 'OK', onPress: () => setScanned(false) }]
                    );
                  } else {
                    Alert.alert('Error', 'Failed to send verification.', [
                      { text: 'OK', onPress: () => setScanned(false) },
                    ]);
                  }
                }
              },
            },
            { text: 'Cancel', onPress: () => setScanned(false) },
          ]
        );
      } catch (error) {
        console.error('❌ Error handling verification:', error);
        Alert.alert('Error', 'Failed to process verification request.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
      }
    },
    [router]
  );

  // Handle deep link params (routed from _layout.tsx)
  React.useEffect(() => {
    if (params.nonce && params.minAge) {
      const minAge = parseInt(params.minAge, 10);
      handleVerification(params.nonce, minAge);
    }
  }, [params.nonce, params.minAge, handleVerification]);

  const handleBarCodeScanned = React.useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned) return;
      setScanned(true);

      try {
        const url = new URL(data);
        const nonce = url.searchParams.get('nonce');
        const minAgeStr = url.searchParams.get('minAge');

        if (!nonce || !minAgeStr) {
          Alert.alert(
            'Invalid QR Code',
            'This QR code is not a valid age verification request.',
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
          return;
        }

        // Check nonce age client-side for fast feedback (server enforces TTL too)
        const nonceTimestampMs = extractNonceTimestamp(nonce);
        if (nonceTimestampMs && Date.now() - nonceTimestampMs > NONCE_TTL_MS) {
          Alert.alert(
            'QR Code Expired',
            'This verification request has expired. Please ask the site to generate a new QR code.',
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
          return;
        }

        await handleVerification(nonce, parseInt(minAgeStr, 10));
      } catch {
        Alert.alert('Invalid QR Code', 'Could not process this QR code.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
      }
    },
    [scanned, handleVerification]
  );

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <FocusAwareStatusBar />
        <Text>Requesting camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <FocusAwareStatusBar />
        <View className="items-center">
          <Text className="mb-6 text-center text-xl font-bold">
            Camera Access Required
          </Text>
          <Text className="mb-8 text-center text-base text-gray-600 dark:text-gray-400">
            We need your permission to use the camera to scan QR codes
          </Text>
          <Button label="Grant Camera Permission" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FocusAwareStatusBar />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View className="flex-1 items-center justify-end p-8">
        <View className="mb-8 rounded-lg bg-black/50 p-4">
          <Text className="text-center text-base text-white">
            Scan the age verification QR code
          </Text>
        </View>
        {scanned && (
          <Button
            label="Tap to Scan Again"
            onPress={() => setScanned(false)}
            variant="secondary"
          />
        )}
      </View>
    </View>
  );
}

/**
 * Attempts to extract an embedded timestamp from the nonce for client-side
 * expiry pre-check. Returns null if the nonce format doesn't include one.
 */
function extractNonceTimestamp(nonce: string): number | null {
  try {
    // Common pattern: nonce includes a base64url-encoded payload with `iat`
    const parts = nonce.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      );
      if (typeof payload.iat === 'number') return payload.iat * 1000;
    }
  } catch {
    // nonce format doesn't encode a timestamp — that's fine
  }
  return null;
}

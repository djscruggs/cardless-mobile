import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import {
  getChallengeDetails,
  getSessionDetails,
  respondToChallenge,
  respondToSession,
} from '@/api/challenge';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { credentialStorage, wallet } from '@/lib';

// Standalone mode - direct callback to website
type StandaloneScanRequest = {
  type: 'age_verification';
  minBirthDate: string; // ISO date string - user must be born before this date
  returnUrl: string; // URL to send response to
  requestId?: string; // Optional request identifier
};

/* eslint-disable max-lines-per-function */
export default function Scan() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    request?: string;
    challenge?: string;
    session?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = React.useState(false);
  const [hasCredential, setHasCredential] = React.useState<boolean | null>(
    null
  );

  // Check if user has a credential on mount
  React.useEffect(() => {
    const credential = credentialStorage.getCredential();
    setHasCredential(!!credential);
  }, []);

  /**
   * Handle CardlessID Challenge Verification (Centralized Mode)
   * This is used when websites integrate via CardlessID CDN
   */
  const handleChallengeVerification = React.useCallback(
    async (challengeId: string) => {
      try {
        // 1. Fetch challenge details from CardlessID
        const challenge = await getChallengeDetails(challengeId);

        if (challenge.status !== 'pending') {
          Alert.alert(
            'Challenge Expired',
            'This verification request has expired or already been completed'
          );
          setScanned(false);
          return;
        }

        // 2. Check user credentials
        const personalData = credentialStorage.getPersonalData();
        if (!personalData) {
          Alert.alert(
            'No Credential',
            'Please verify your identity first before you can use age verification.',
            [
              {
                text: 'Verify Identity',
                onPress: () => router.push('/verify-identity'),
              },
              { text: 'Cancel', onPress: () => setScanned(false) },
            ]
          );
          return;
        }

        // 3. Calculate user age
        const userBirthDate = new Date(personalData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - userBirthDate.getFullYear();
        const monthDiff = today.getMonth() - userBirthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < userBirthDate.getDate())
        ) {
          age--;
        }

        const approved = age >= challenge.minAge;

        console.log('🔍 Challenge age check:', {
          userAge: age,
          requiredAge: challenge.minAge,
          approved,
        });

        // 4. Show confirmation
        Alert.alert(
          'Age Verification Request',
          challenge.websiteName
            ? `${challenge.websiteName} is requesting age verification.\n\n${
                approved
                  ? `You meet the requirement (${challenge.minAge}+). Send verification?`
                  : `You do not meet the requirement (${challenge.minAge}+).`
              }`
            : approved
              ? `You meet the age requirement (${challenge.minAge}+). Send verification?`
              : `You do not meet the age requirement (${challenge.minAge}+).`,
          [
            {
              text: 'Send Verification',
              onPress: async () => {
                try {
                  const walletAddress = wallet.getWalletAddress();
                  if (!walletAddress) {
                    throw new Error('No wallet address');
                  }

                  // Send response to CardlessID (NOT directly to website)
                  await respondToChallenge({
                    challengeId: challenge.challengeId,
                    approved,
                    walletAddress,
                  });

                  showMessage({
                    message: 'Verification sent successfully',
                    type: 'success',
                  });
                  router.push('/');
                } catch (error) {
                  console.error('❌ Error responding to challenge:', error);
                  Alert.alert('Error', 'Failed to send verification', [
                    { text: 'OK', onPress: () => setScanned(false) },
                  ]);
                }
              },
            },
            { text: 'Cancel', onPress: () => setScanned(false) },
          ]
        );
      } catch (error) {
        console.error('❌ Error handling challenge:', error);
        Alert.alert('Error', 'Failed to load verification request', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
      }
    },
    [router]
  );

  /**
   * Handle Session Verification (Demo Mode)
   * This is used for the age-verify demo page
   */
  const handleSessionVerification = React.useCallback(
    async (sessionId: string) => {
      try {
        const session = await getSessionDetails(sessionId);

        if (session.status !== 'pending') {
          Alert.alert(
            'Session Expired',
            'This verification session has expired or already been completed'
          );
          setScanned(false);
          return;
        }

        const personalData = credentialStorage.getPersonalData();
        if (!personalData) {
          Alert.alert('No Credential', 'Please verify your identity first.', [
            {
              text: 'Verify Identity',
              onPress: () => router.push('/verify-identity'),
            },
            { text: 'Cancel', onPress: () => setScanned(false) },
          ]);
          return;
        }

        const userBirthDate = new Date(personalData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - userBirthDate.getFullYear();
        const monthDiff = today.getMonth() - userBirthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < userBirthDate.getDate())
        ) {
          age--;
        }

        const approved = age >= session.minAge;

        Alert.alert(
          'Age Verification (Demo)',
          approved
            ? `You meet the requirement (${session.minAge}+). Send verification?`
            : `You do not meet the requirement (${session.minAge}+).`,
          [
            {
              text: 'Send Verification',
              onPress: async () => {
                try {
                  const walletAddress = wallet.getWalletAddress();
                  if (!walletAddress) throw new Error('No wallet address');

                  await respondToSession({
                    sessionId,
                    approved,
                    walletAddress,
                  });

                  showMessage({
                    message: 'Verification sent successfully',
                    type: 'success',
                  });
                  router.push('/');
                } catch (error) {
                  console.error('❌ Error responding to session:', error);
                  Alert.alert('Error', 'Failed to send verification', [
                    { text: 'OK', onPress: () => setScanned(false) },
                  ]);
                }
              },
            },
            { text: 'Cancel', onPress: () => setScanned(false) },
          ]
        );
      } catch (error) {
        console.error('❌ Error handling session:', error);
        Alert.alert('Error', 'Failed to load verification session', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
      }
    },
    [router]
  );

  /**
   * Handle Standalone Verification
   * This is when the app directly callbacks to a website
   * (Not the recommended approach, but supported for backward compatibility)
   */
  const handleStandaloneScanRequest = React.useCallback(
    async (scanRequest: StandaloneScanRequest) => {
      if (scanRequest.type !== 'age_verification') {
        Alert.alert('Invalid QR Code', 'This QR code is not recognized.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        return;
      }

      const credential = credentialStorage.getCredential();
      const personalData = credentialStorage.getPersonalData();

      if (!credential || !personalData) {
        Alert.alert(
          'No Credential',
          'You need to verify your identity first before you can use age verification.',
          [
            {
              text: 'Verify Identity',
              onPress: () => router.push('/verify-identity'),
            },
            { text: 'Cancel', onPress: () => setScanned(false) },
          ]
        );
        return;
      }

      const walletAddress = wallet.getWalletAddress();
      if (!walletAddress) {
        Alert.alert('Error', 'Wallet not found', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        return;
      }

      const userBirthDate = new Date(personalData.birthDate);
      const minBirthDate = new Date(scanRequest.minBirthDate);
      const meetsRequirement = userBirthDate <= minBirthDate;

      console.log('🔍 Standalone age check:', {
        userBirthDate: userBirthDate.toISOString(),
        minBirthDate: minBirthDate.toISOString(),
        meetsRequirement,
      });

      Alert.alert(
        'Age Verification Request',
        meetsRequirement
          ? 'You meet the age requirement. Send verification?'
          : 'You do not meet the age requirement for this content.',
        [
          {
            text: 'Send Verification',
            onPress: async () => {
              try {
                const response = await fetch(scanRequest.returnUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    verified: meetsRequirement,
                    walletAddress,
                    requestId: scanRequest.requestId,
                    timestamp: new Date().toISOString(),
                  }),
                });

                if (response.ok) {
                  showMessage({
                    message: 'Verification sent successfully',
                    type: 'success',
                  });
                  router.push('/');
                } else {
                  throw new Error('Failed to send verification');
                }
              } catch (error) {
                console.error('❌ Error sending verification:', error);
                Alert.alert('Error', 'Failed to send verification', [
                  { text: 'OK', onPress: () => setScanned(false) },
                ]);
              }
            },
          },
          { text: 'Cancel', onPress: () => setScanned(false) },
        ]
      );
    },
    [router]
  );

  // Handle deep link requests
  React.useEffect(() => {
    if (params.challenge) {
      handleChallengeVerification(params.challenge);
    } else if (params.session) {
      handleSessionVerification(params.session);
    } else if (params.request) {
      try {
        const decodedData = atob(params.request);
        const scanRequest: StandaloneScanRequest = JSON.parse(decodedData);
        handleStandaloneScanRequest(scanRequest);
      } catch (error) {
        console.error('❌ Error processing deep link request:', error);
        Alert.alert('Error', 'Invalid verification request');
      }
    }
  }, [
    params.challenge,
    params.session,
    params.request,
    handleChallengeVerification,
    handleSessionVerification,
    handleStandaloneScanRequest,
  ]);

  const handleBarCodeScanned = React.useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned) return;

      setScanned(true);
      console.log('📷 QR Code scanned:', data);

      try {
        // Try parsing as URL first (CardlessID format)
        if (data.startsWith('http://') || data.startsWith('https://')) {
          const url = new URL(data);

          // Check for challenge-based verification (CardlessID CDN integration)
          if (
            url.pathname === '/app/age-verify' ||
            url.pathname === '/app/wallet-verify'
          ) {
            const challengeId = url.searchParams.get('challenge');
            const sessionId = url.searchParams.get('session');

            if (challengeId) {
              await handleChallengeVerification(challengeId);
              return;
            } else if (sessionId) {
              await handleSessionVerification(sessionId);
              return;
            }
          }
        }

        // Fallback: Try parsing as JSON (standalone format)
        const scanRequest: StandaloneScanRequest = JSON.parse(data);
        await handleStandaloneScanRequest(scanRequest);
      } catch (error) {
        console.error('❌ Error processing QR code:', error);
        Alert.alert('Invalid QR Code', 'Could not process this QR code.', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
      }
    },
    [
      scanned,
      handleChallengeVerification,
      handleSessionVerification,
      handleStandaloneScanRequest,
    ]
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

  // Show explainer if no credential
  if (hasCredential === false) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <FocusAwareStatusBar />
        <View className="w-full max-w-md items-center rounded-lg border-2 border-blue-300 bg-white p-6 dark:border-blue-700 dark:bg-gray-800">
          <Text className="mb-4 text-center text-3xl">📱</Text>
          <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
            Verify Your Identity First
          </Text>
          <Text className="mb-6 text-center text-base text-gray-700 dark:text-gray-300">
            Before you can use the QR code scanner for age verification, you
            need to verify your identity and create your decentralized ID.
          </Text>

          <View className="mb-6 w-full rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <Text className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
              What you&apos;ll need:
            </Text>
            <Text className="text-sm text-blue-800 dark:text-blue-300">
              • A government-issued ID (driver&apos;s license or passport)
            </Text>
            <Text className="text-sm text-blue-800 dark:text-blue-300">
              • A selfie for identity verification
            </Text>
            <Text className="text-sm text-blue-800 dark:text-blue-300">
              • About 2-3 minutes to complete
            </Text>
          </View>

          <Button
            label="Verify Now"
            onPress={() => router.push('/(app)/custom-verify')}
            testID="verify-now-button"
          />
        </View>
      </View>
    );
  }

  // Still loading credential check
  if (hasCredential === null) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <FocusAwareStatusBar />
        <Text>Loading...</Text>
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
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <View className="flex-1 items-center justify-end p-8">
        <View className="mb-8 rounded-lg bg-black/50 p-4">
          <Text className="text-center text-base text-white">
            Position the QR code within the frame
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

import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import { useCheckStatus, useIssueCredential, useStartSession } from '@/api';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';
import { credentialStorage } from '@/lib';

type VerificationStep =
  | 'start'
  | 'sdk-running'
  | 'polling'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'issuing';

/* eslint-disable max-lines-per-function */
export default function VerifyIdentity() {
  const router = useRouter();
  const [step, setStep] = React.useState<VerificationStep>('start');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = React.useState(0);

  const { mutate: startSession, isPending: isStarting } = useStartSession();
  const { mutate: issueCredential, isPending: isIssuing } =
    useIssueCredential();
  const { refetch: checkStatus } = useCheckStatus({
    variables: { sessionId: sessionId || '' },
    enabled: false, // Manual polling only
  });

  // Polling configuration
  const maxPollingAttempts = 90; // 3 minutes with 2s intervals
  const pollingIntervalMs = 2000;

  // Polling effect
  React.useEffect(() => {
    if (step !== 'polling' || !sessionId) return;

    const pollStatus = async () => {
      try {
        console.log(
          `🔄 Polling status... (attempt ${pollingAttempts + 1}/${maxPollingAttempts})`
        );

        const result = await checkStatus();

        if (!result.data) {
          console.log('⚠️ No data returned from status check');
          return;
        }

        const status = result.data.status;
        console.log('📊 Status:', status, 'Ready:', result.data.ready);

        if (status === 'approved' && result.data.ready) {
          console.log('✅ Verification approved!');
          setStep('approved');
          return;
        }

        if (status === 'rejected') {
          console.log('❌ Verification rejected');
          setStep('rejected');
          return;
        }

        if (status === 'expired') {
          console.log('⏰ Session expired');
          setStep('expired');
          return;
        }

        // Still pending, continue polling
        setPollingAttempts((prev) => prev + 1);
      } catch (error) {
        console.error('❌ Error checking status:', error);
        setPollingAttempts((prev) => prev + 1);
      }
    };

    // Check if we've exceeded max attempts
    if (pollingAttempts >= maxPollingAttempts) {
      console.log('⏰ Polling timeout - max attempts reached');
      setStep('expired');
      showErrorMessage('Verification timeout - please try again');
      return;
    }

    // Start polling
    const timeoutId = setTimeout(pollStatus, pollingIntervalMs);

    return () => clearTimeout(timeoutId);
  }, [step, sessionId, pollingAttempts, checkStatus, maxPollingAttempts]);

  const handleStartVerification = () => {
    console.log('🚀 Starting verification session...');
    startSession(
      { provider: 'mock' },
      {
        onSuccess: (response) => {
          console.log('✅ Session started:', response);
          setSessionId(response.sessionId);
          setStep('sdk-running');

          // Simulate mock SDK completion (in real app, this would launch actual SDK)
          // For mock provider, we immediately move to polling
          setTimeout(() => {
            console.log('📱 Mock SDK "completed"');
            setStep('polling');
          }, 2000);
        },
        onError: (error) => {
          console.error('❌ Error starting session:', error);
          const responseData = error.response?.data as
            | { error?: string; message?: string }
            | undefined;
          const errorMessage =
            responseData?.error ||
            responseData?.message ||
            'Failed to start verification';
          showErrorMessage(errorMessage);
        },
      }
    );
  };

  const handleIssueCredential = () => {
    if (!sessionId) {
      showErrorMessage('No session ID available');
      return;
    }

    console.log('📝 Issuing credential for session:', sessionId);
    setStep('issuing');

    // TODO: Get actual wallet address
    const walletAddress =
      '55MFIU3EEXNLAE3KWVVC2FWKOWPTIMMFAJAY4TONNIFRZZYETL2IL3QRCE';

    issueCredential(
      {
        verificationSessionId: sessionId,
        walletAddress,
      },
      {
        onSuccess: async (response) => {
          console.log('✅ Credential issued successfully:', response);
          await credentialStorage.saveCredential(response);
          showMessage({
            message: 'Identity verified and credential issued!',
            type: 'success',
          });
          router.back();
        },
        onError: (error) => {
          console.error('❌ Error issuing credential:', error);
          const responseData = error.response?.data as
            | { error?: string; message?: string }
            | undefined;
          const errorMessage =
            responseData?.error ||
            responseData?.message ||
            'Failed to issue credential';
          showErrorMessage(errorMessage);
          setStep('approved'); // Go back to approved state so user can retry
        },
      }
    );
  };

  const getStepMessage = () => {
    switch (step) {
      case 'start':
        return 'Ready to start verification';
      case 'sdk-running':
        return 'Opening verification SDK...';
      case 'polling':
        return `Checking verification status... (${pollingAttempts}/${maxPollingAttempts})`;
      case 'approved':
        return 'Verification approved! Ready to issue credential.';
      case 'rejected':
        return 'Verification was rejected. Please try again.';
      case 'expired':
        return 'Verification session expired. Please start over.';
      case 'issuing':
        return 'Issuing credential...';
      default:
        return '';
    }
  };

  const getStepColor = () => {
    switch (step) {
      case 'approved':
        return 'text-green-600 dark:text-green-400';
      case 'rejected':
      case 'expired':
        return 'text-red-600 dark:text-red-400';
      case 'polling':
      case 'sdk-running':
      case 'issuing':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Verify Identity',
          headerBackTitle: 'Back',
        }}
      />
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 items-center p-4">
          <View className="w-full max-w-md space-y-6">
            <View className="rounded-lg border-2 border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
                Identity Verification
              </Text>

              <View className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                <Text className={`text-center font-medium ${getStepColor()}`}>
                  {getStepMessage()}
                </Text>
              </View>

              {step === 'start' && (
                <Button
                  label="Start Verification"
                  loading={isStarting}
                  onPress={handleStartVerification}
                  testID="start-verification-button"
                />
              )}

              {step === 'approved' && (
                <Button
                  label="Issue Credential"
                  loading={isIssuing}
                  onPress={handleIssueCredential}
                  testID="issue-credential-button"
                />
              )}

              {(step === 'rejected' || step === 'expired') && (
                <Button
                  label="Try Again"
                  onPress={() => {
                    setStep('start');
                    setSessionId(null);
                    setPollingAttempts(0);
                  }}
                  testID="retry-button"
                />
              )}

              {sessionId && (
                <View className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <Text className="text-center text-xs text-gray-500 dark:text-gray-400">
                    Session ID: {sessionId}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

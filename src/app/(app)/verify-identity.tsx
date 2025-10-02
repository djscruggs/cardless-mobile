import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';

import {
  type IdentityData,
  useCheckStatus,
  useIssueCredential,
  useMockVerify,
  useStartSession,
} from '@/api';
import {
  Button,
  ControlledInput,
  ControlledSelect,
  FocusAwareStatusBar,
  ScrollView,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';
import { credentialStorage } from '@/lib';

const US_STATES = [
  { label: 'California', value: 'CA' },
  { label: 'New York', value: 'NY' },
  { label: 'Texas', value: 'TX' },
  { label: 'Florida', value: 'FL' },
  // Add more as needed
];

const ID_TYPES = [
  { label: 'Government ID', value: 'government_id' },
  { label: 'Passport', value: 'passport' },
];

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  birthDate: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/, 'Date must be in MM-DD-YYYY format'),
  governmentId: z.string().min(1, 'Government ID is required'),
  idType: z.enum(['passport', 'government_id'], {
    required_error: 'Please select an ID type',
  }),
  state: z.string().min(2, 'Please select a state'),
});

type FormType = z.infer<typeof schema>;

type VerificationStep =
  | 'form'
  | 'starting'
  | 'verifying'
  | 'polling'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'issuing';

/* eslint-disable max-lines-per-function */
export default function VerifyIdentity() {
  const router = useRouter();
  const [step, setStep] = React.useState<VerificationStep>('form');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = React.useState(0);

  const { control, handleSubmit } = useForm<FormType>({
    resolver: zodResolver(schema),
  });

  const { mutate: startSession, isPending: isStarting } = useStartSession();
  const { mutate: mockVerify, isPending: isVerifying } = useMockVerify();
  const { mutate: issueCredential, isPending: isIssuing } =
    useIssueCredential();
  const { refetch: checkStatus } = useCheckStatus({
    variables: { sessionId: sessionId || '' },
    enabled: false,
  });

  const maxPollingAttempts = 90;
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

        setPollingAttempts((prev) => prev + 1);
      } catch (error) {
        console.error('❌ Error checking status:', error);
        setPollingAttempts((prev) => prev + 1);
      }
    };

    if (pollingAttempts >= maxPollingAttempts) {
      console.log('⏰ Polling timeout - max attempts reached');
      setStep('expired');
      showErrorMessage('Verification timeout - please try again');
      return;
    }

    const timeoutId = setTimeout(pollStatus, pollingIntervalMs);

    return () => clearTimeout(timeoutId);
  }, [step, sessionId, pollingAttempts, checkStatus, maxPollingAttempts]);

  const onSubmit = (data: FormType) => {
    console.log('🚀 Starting verification session...');
    setStep('starting');

    // Convert MM-DD-YYYY to YYYY-MM-DD for API
    const [month, day, year] = data.birthDate.split('-');
    const isoDate = `${year}-${month}-${day}`;

    const identityData: IdentityData = {
      ...data,
      birthDate: isoDate,
    };

    // STEP 1: Start session on main server
    startSession(
      { provider: 'mock' },
      {
        onSuccess: (response) => {
          console.log('✅ Session started:', response);
          setSessionId(response.sessionId);
          setStep('verifying');

          // STEP 2: Call mock provider /verify endpoint
          mockVerify(
            {
              authToken: response.authToken,
              providerSessionId: response.providerSessionId,
              identityData,
              approved: true, // Can be set to false to test rejection
            },
            {
              onSuccess: () => {
                console.log('✅ Verification submitted to mock provider');
                console.log('⏳ Waiting for manual approval on provider...');
                setStep('polling');
              },
              onError: (error) => {
                console.error('❌ Error calling mock provider:', error);
                const responseData = error.response?.data as
                  | { error?: string; message?: string }
                  | undefined;
                const errorMessage =
                  responseData?.error ||
                  responseData?.message ||
                  'Failed to submit verification';
                showErrorMessage(errorMessage);
                setStep('form');
              },
            }
          );
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
          setStep('form');
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
          setStep('approved');
        },
      }
    );
  };

  const handleReset = () => {
    setStep('form');
    setSessionId(null);
    setPollingAttempts(0);
  };

  const getStepMessage = () => {
    switch (step) {
      case 'form':
        return 'Enter your identity information';
      case 'starting':
        return 'Starting verification session...';
      case 'verifying':
        return 'Submitting to verification provider...';
      case 'polling':
        return `Waiting for approval... (${pollingAttempts}/${maxPollingAttempts})`;
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
      case 'starting':
      case 'verifying':
      case 'issuing':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const isLoading = isStarting || isVerifying || isIssuing;

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
        <View className="flex-1 p-4">
          <View className="rounded-lg border-2 border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
              Identity Verification
            </Text>

            <View className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
              <Text className={`text-center font-medium ${getStepColor()}`}>
                {getStepMessage()}
              </Text>
            </View>

            {step === 'form' && (
              <>
                <ControlledInput
                  name="firstName"
                  label="First Name"
                  control={control}
                  testID="firstName"
                />
                <ControlledInput
                  name="middleName"
                  label="Middle Name (Optional)"
                  control={control}
                  testID="middleName"
                />
                <ControlledInput
                  name="lastName"
                  label="Last Name"
                  control={control}
                  testID="lastName"
                />
                <ControlledInput
                  name="birthDate"
                  label="Birth Date (MM-DD-YYYY)"
                  control={control}
                  placeholder="01-31-1990"
                  testID="birthDate"
                />
                <ControlledSelect
                  name="idType"
                  label="ID Type"
                  control={control}
                  options={ID_TYPES}
                  testID="idType"
                />
                <ControlledInput
                  name="governmentId"
                  label="Government ID Number"
                  control={control}
                  testID="governmentId"
                />
                <ControlledSelect
                  name="state"
                  label="State"
                  control={control}
                  options={US_STATES}
                  testID="state"
                />
                <Button
                  label="Start Verification"
                  loading={isLoading}
                  onPress={handleSubmit(onSubmit)}
                  testID="start-verification-button"
                />
              </>
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
                onPress={handleReset}
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
      </ScrollView>
    </>
  );
}

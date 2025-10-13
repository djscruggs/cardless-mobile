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
import {
  credentialStorage,
  initializeWallet,
  useNFTWorkflow,
  wallet,
} from '@/lib';
import { Env } from '@/lib/env';

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
  | 'issuing'
  | 'nft-workflow';

/* eslint-disable max-lines-per-function */
export default function VerifyIdentity() {
  const router = useRouter();
  const [step, setStep] = React.useState<VerificationStep>('form');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = React.useState(0);
  const [isLoadingDummyData, setIsLoadingDummyData] = React.useState(false);
  const [nftData, setNftData] = React.useState<{
    assetId: number;
    requiresOptIn: boolean;
  } | null>(null);
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null);
  const [privateKey, setPrivateKey] = React.useState<Uint8Array | undefined>(
    undefined
  );

  const { control, handleSubmit, setValue } = useForm<FormType>({
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

  const nftWorkflow = useNFTWorkflow({
    assetId: nftData?.assetId,
    walletAddress: walletAddress || '',
    privateKey,
    onComplete: () => {
      showMessage({
        message: 'Identity verified and credential issued!',
        type: 'success',
      });
      router.push('/');
    },
    onError: (error) => {
      console.error('❌ NFT workflow error:', error);
      setStep('approved'); // Allow retry
    },
  });

  // Initialize wallet on mount
  React.useEffect(() => {
    const init = async () => {
      console.log('🔐 Starting wallet initialization...');
      console.log('🔍 APP_ENV:', Env.APP_ENV);
      console.log('🔍 DEV_WALLET_ADDRESS:', Env.DEV_WALLET_ADDRESS);

      // In development, use DEV_WALLET_ADDRESS if available
      if (
        Env.APP_ENV === 'development' &&
        Env.DEV_WALLET_ADDRESS &&
        Env.DEV_WALLET_MNEMONIC
      ) {
        console.log('🔐 Using development wallet from env');
        // Save dev wallet to storage
        await wallet.saveWallet(
          Env.DEV_WALLET_ADDRESS,
          Env.DEV_WALLET_MNEMONIC
        );
        setWalletAddress(Env.DEV_WALLET_ADDRESS);
        console.log('✅ Wallet set to:', Env.DEV_WALLET_ADDRESS);

        // Load private key
        const key = await wallet.getWalletPrivateKey();
        setPrivateKey(key || undefined);
      } else {
        // Otherwise, initialize/create wallet
        console.log('🔐 Generating new wallet...');
        const address = await initializeWallet();
        console.log('🔐 Wallet initialized:', address);
        setWalletAddress(address);
        console.log('✅ Wallet state updated');

        // Load private key
        const key = await wallet.getWalletPrivateKey();
        setPrivateKey(key || undefined);
      }
    };
    init();
  }, []);

  // Start NFT workflow when nftData is set and step is nft-workflow

  React.useEffect(() => {
    if (step === 'nft-workflow' && nftData?.assetId) {
      console.log('🚀 Starting NFT workflow with assetId:', nftData.assetId);
      nftWorkflow.startWorkflow();
    }
  }, [step, nftData?.assetId]);

  const maxPollingAttempts = 90;
  const pollingIntervalMs = 2000;

  const loadDummyData = React.useCallback(async () => {
    try {
      setIsLoadingDummyData(true);
      const randomId = Math.floor(Math.random() * 30) + 1; // 1-30
      const response = await fetch(`https://dummyjson.com/users/${randomId}`);
      const data = await response.json();

      console.log('📋 Loaded dummy data:', data);

      // Map DummyJSON data to form fields
      setValue('firstName', data.firstName);
      setValue('lastName', data.lastName);
      setValue('middleName', data.maidenName || '');

      // Generate random birth date (21-80 years ago)
      const yearsAgo = Math.floor(Math.random() * 60) + 21;
      const birthYear = new Date().getFullYear() - yearsAgo;
      const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(
        2,
        '0'
      );
      const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(
        2,
        '0'
      );
      setValue('birthDate', `${birthMonth}-${birthDay}-${birthYear}`);

      // Generate random government ID
      const govId = `D${Math.floor(Math.random() * 10000000)
        .toString()
        .padStart(7, '0')}`;
      setValue('governmentId', govId);

      // Set random ID type and state
      setValue('idType', 'government_id');
      const states = ['CA', 'NY', 'TX', 'FL'];
      setValue('state', states[Math.floor(Math.random() * states.length)]);

      setIsLoadingDummyData(false);
    } catch (error) {
      console.error('❌ Error loading dummy data:', error);
      setIsLoadingDummyData(false);
      showErrorMessage('Failed to load dummy data');
    }
  }, [setValue]);

  // Load random dummy data on mount
  React.useEffect(() => {
    loadDummyData();
  }, [loadDummyData]);

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
          console.log(
            '🔍 Debug - sessionId:',
            sessionId,
            'walletAddress:',
            walletAddress
          );
          showMessage({
            message: 'Verification approved! Installing...',
            type: 'success',
          });
          setStep('approved');
          // Automatically trigger credential issuance
          setTimeout(() => {
            console.log(
              '⏰ Timeout triggered, calling handleIssueCredential...'
            );
            handleIssueCredential();
          }, 500); // Small delay to show success message
          return;
        }

        if (status === 'rejected') {
          console.log('❌ Verification rejected');
          showMessage({
            message: 'Verification was rejected',
            type: 'danger',
          });
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

    if (!walletAddress) {
      showErrorMessage('No wallet address available');
      return;
    }

    console.log('📝 Issuing credential for session:', sessionId);
    console.log('🔍 Wallet address at time of issue:', walletAddress);
    setStep('issuing');

    issueCredential(
      {
        verificationSessionId: sessionId,
        walletAddress,
      },
      {
        onSuccess: async (response) => {
          console.log('✅ Credential issued successfully:', response);
          await credentialStorage.saveCredential(response);

          // Check if NFT workflow is required
          if (response.nft && response.nft.requiresOptIn) {
            console.log('🔵 NFT requires opt-in, starting workflow...');
            console.log(
              '🔍 Raw assetId from API:',
              response.nft.assetId,
              typeof response.nft.assetId
            );

            // Convert assetId to number if it's a string
            const assetId =
              typeof response.nft.assetId === 'string'
                ? parseInt(response.nft.assetId, 10)
                : response.nft.assetId;

            console.log('🔍 Converted assetId:', assetId, typeof assetId);

            setNftData({
              assetId,
              requiresOptIn: response.nft.requiresOptIn,
            });
            setStep('nft-workflow');
            // NFT workflow will be started by useEffect when nftData changes
          } else {
            // No NFT workflow needed, we're done
            showMessage({
              message: 'Identity verified and credential issued!',
              type: 'success',
            });
            router.push('/');
          }
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
        return 'Verification approved!';
      case 'rejected':
        return 'Verification was rejected. Please try again.';
      case 'expired':
        return 'Verification session expired. Please start over.';
      case 'issuing':
        return 'Issuing credential...';
      case 'nft-workflow':
        if (nftWorkflow.state === 'opting-in') {
          return 'Finalizing...';
        } else if (nftWorkflow.state === 'transferring') {
          return 'Transferring...';
        } else if (nftWorkflow.state === 'complete') {
          return 'Received!';
        } else if (nftWorkflow.state === 'error') {
          return 'Error with NFT workflow. Please retry.';
        }
        return 'Setting up NFT credential...';
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
      case 'nft-workflow':
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
                <View className="mb-4">
                  <Button
                    label="Load New Random Identity"
                    variant="secondary"
                    loading={isLoadingDummyData}
                    onPress={loadDummyData}
                    testID="load-dummy-data-button"
                  />
                </View>
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

            {/* Approved state automatically triggers credential issuance */}

            {(step === 'rejected' || step === 'expired') && (
              <Button
                label="Try Again"
                onPress={handleReset}
                testID="retry-button"
              />
            )}

            {(step === 'starting' ||
              step === 'verifying' ||
              step === 'polling') && (
              <Button
                label="Reset / Start Over"
                variant="outline"
                onPress={handleReset}
                testID="reset-button"
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

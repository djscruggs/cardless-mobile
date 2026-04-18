import { Env } from '@env';
import { type AxiosError } from 'axios';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useIssueCredential } from '@/api/credentials';
import type { ExtractedData, LivenessResult } from '@/api/custom-verification';
import { useUploadId, useUploadSelfie } from '@/api/custom-verification';
import { useCheckStatus, useStartSession } from '@/api/verification';
import {
  IdCameraView,
  KycLayout,
  OrientationGate,
  ReviewCard,
  SelfieCameraView,
  StepIndicator,
} from '@/components/kyc';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';
import {
  credentialStorage,
  initializeWallet,
  secureDocumentStorage,
} from '@/lib';

type VerificationStep =
  | 'start-session'
  | 'capture-id'
  | 'uploading-id'
  | 'polling-status'
  | 'review-data'
  | 'capture-selfie'
  | 'uploading-selfie'
  | 'liveness-failed'
  | 'match-result'
  | 'success'
  | 'fraud-detected'
  | 'error';

/* eslint-disable max-lines-per-function */
export default function CustomVerify() {
  const router = useRouter();
  const isDevelopment = Env.APP_ENV !== 'production';
  const [step, setStep] = React.useState<VerificationStep>('start-session');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [verificationToken, setVerificationToken] = React.useState<
    string | null
  >(null);
  const [extractedData, setExtractedData] =
    React.useState<ExtractedData | null>(null);
  const [idPhotoData, setIdPhotoData] = React.useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_livenessResult, setLivenessResult] =
    React.useState<LivenessResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_matchConfidence, setMatchConfidence] = React.useState<number>(0);
  const [matchSuccess, setMatchSuccess] = React.useState<boolean>(false);
  const [fraudSignals, setFraudSignals] = React.useState<
    { type: string; result: string }[]
  >([]);
  const [tokenCreatedAt, setTokenCreatedAt] = React.useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = React.useState<number>(600); // 10 minutes in seconds
  const [capturePhase, setCapturePhase] = React.useState<'front' | 'back'>(
    'front'
  );
  const [frontPhotoUri, setFrontPhotoUri] = React.useState<string | null>(null);
  const [backPhotoUri, setBackPhotoUri] = React.useState<string | null>(null);
  const [selfieUri, setSelfieUri] = React.useState<string | null>(null);

  const { mutate: uploadId } = useUploadId();
  const { mutate: uploadSelfie } = useUploadSelfie();
  const { mutate: issueCredential, isPending: isIssuingCredential } =
    useIssueCredential();
  const { mutate: startSession, isPending: isStartingSession } =
    useStartSession();

  // Poll verification status every 2s when in polling-status step
  const { data: statusData } = useCheckStatus({
    variables: { sessionId: sessionId ?? '' },
    enabled: step === 'polling-status' && !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 2000;
    },
  });

  // Transition out of polling-status when status resolves
  React.useEffect(() => {
    if (step !== 'polling-status' || !statusData) return;

    if (statusData.status === 'completed') {
      if (statusData.verificationToken && statusData.extractedData) {
        setVerificationToken(statusData.verificationToken);
        setExtractedData(statusData.extractedData as ExtractedData);
        setTokenCreatedAt(Date.now());
        setStep('review-data');
        showMessage({ message: 'ID processed successfully!', type: 'success' });
      } else {
        showErrorMessage('Verification completed but data is missing');
        setStep('error');
      }
    } else if (statusData.status === 'failed') {
      showErrorMessage('Verification failed. Please try again.');
      setStep('error');
    }
  }, [statusData, step]);

  // Start session on mount
  React.useEffect(() => {
    if (step !== 'start-session') return;

    startSession(
      { provider: isDevelopment ? 'mock' : 'aws-rekognition' } as Parameters<
        typeof startSession
      >[0],
      {
        onSuccess: (response) => {
          setSessionId(response.sessionId);
          setStep('capture-id');
        },
        onError: () => {
          showErrorMessage(
            'Failed to start verification session. Please try again.'
          );
          setStep('error');
        },
      }
    );
  }, [startSession, isDevelopment]);

  // Timer effect for token expiration (10 minutes)
  React.useEffect(() => {
    if (!tokenCreatedAt) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - tokenCreatedAt) / 1000);
      const remaining = Math.max(0, 600 - elapsed); // 600 seconds = 10 minutes
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        showErrorMessage('Verification token expired. Please start over.');
        setTimeout(() => {
          handleStartOver();
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [tokenCreatedAt]);

  const handlePhotoTaken = async (photos: {
    front: { uri: string; base64?: string };
    back?: { uri: string; base64?: string };
  }) => {
    console.log('📸 ID Photos captured:', {
      front: photos.front.uri,
      back: photos.back?.uri,
    });

    if (!photos.front.base64) {
      showErrorMessage('Failed to capture front photo data');
      return;
    }

    setStep('uploading-id');

    // Convert to data URL format if needed
    const frontImageData = photos.front.base64.startsWith('data:')
      ? photos.front.base64
      : `data:image/jpeg;base64,${photos.front.base64}`;

    const backImageData = photos.back?.base64
      ? photos.back.base64.startsWith('data:')
        ? photos.back.base64
        : `data:image/jpeg;base64,${photos.back.base64}`
      : undefined;

    // CRITICAL: Store front ID photo locally for later use in selfie comparison
    setIdPhotoData(frontImageData);

    uploadId(
      {
        image: frontImageData,
        backImage: backImageData,
        mimeType: 'image/jpeg',
      },
      {
        onSuccess: (response) => {
          console.log('✅ ID uploaded successfully:', response);

          if (response.fraudDetected || !response.success) {
            if (response.fraudCheck && !response.fraudCheck.passed) {
              setFraudSignals(response.fraudCheck.signals || []);
            }
            setStep('fraud-detected');
            return;
          }

          if (response.isExpired) {
            showMessage({
              message: 'Warning: Your ID appears to be expired',
              type: 'warning',
              duration: 4000,
            });
          }

          if (
            response.lowConfidenceFields &&
            response.lowConfidenceFields.length > 0
          ) {
            showMessage({
              message: `Low confidence on: ${response.lowConfidenceFields.join(', ')}`,
              type: 'warning',
              duration: 4000,
            });
          }

          // If server returned token+data directly (legacy), use them;
          // otherwise poll status endpoint per spec.
          if (response.verificationToken && response.extractedData) {
            setVerificationToken(response.verificationToken);
            setExtractedData(response.extractedData);
            setTokenCreatedAt(Date.now());
            setStep('review-data');
            showMessage({
              message: 'ID processed successfully!',
              type: 'success',
            });
          } else {
            // Transition to polling — sessionId already set above from start-session
            setStep('polling-status');
          }
        },
        onError: (error) => {
          console.error('❌ Error uploading ID:', error);
          const axiosError = error as AxiosError<{
            error?: string;
            message?: string;
            fraudDetected?: boolean;
            fraudScore?: number;
            fraudSignals?: { type: string; result: string }[];
          }>;
          const responseData = axiosError.response?.data;

          // Handle fraud detection separately
          if (responseData?.fraudDetected) {
            console.warn('⚠️ Fraud detected:', responseData);
            // Store fraud signals for dev display
            if (Array.isArray(responseData.fraudSignals)) {
              setFraudSignals(responseData.fraudSignals);
            }
            setStep('fraud-detected');
            return;
          }

          const errorMessage =
            responseData?.error ||
            responseData?.message ||
            'Failed to process ID. Please try again.';
          showErrorMessage(errorMessage);
          setStep('error');
        },
      }
    );
  };

  const handleSelfieCapture = async (photo: {
    uri: string;
    base64?: string;
    videoUri?: string;
  }) => {
    console.log('📸 Selfie captured:', { uri: photo.uri });

    if (!photo.base64) {
      showErrorMessage('Failed to capture selfie data');
      return;
    }

    if (!idPhotoData) {
      showErrorMessage('ID photo missing. Please start over.');
      handleStartOver();
      return;
    }

    if (!sessionId) {
      showErrorMessage('Session missing. Please start over.');
      handleStartOver();
      return;
    }

    setStep('uploading-selfie');

    const selfieData = photo.base64.startsWith('data:')
      ? photo.base64
      : `data:image/jpeg;base64,${photo.base64}`;

    uploadSelfie(
      {
        sessionId,
        image: selfieData,
        idPhoto: idPhotoData,
        videoUri: photo.videoUri,
      },
      {
        onSuccess: (response) => {
          console.log('✅ Selfie uploaded successfully:', response);

          if (!response.success) {
            // Liveness check failed
            setLivenessResult(response.livenessResult || null);
            setStep('liveness-failed');
            return;
          }

          // Store match results
          setMatchSuccess(response.match);
          setMatchConfidence(response.confidence);
          setLivenessResult(response.livenessResult || null);
          setStep('match-result');

          if (response.match) {
            showMessage({
              message: 'Face match confirmed!',
              type: 'success',
            });
          }
        },
        onError: (error) => {
          console.error('❌ Error uploading selfie:', error);
          const axiosError = error as AxiosError<{
            error?: string;
            message?: string;
            success?: boolean;
            issues?: string[];
            livenessResult?: LivenessResult;
          }>;
          const responseData = axiosError.response?.data;

          // Handle liveness check failure (comes as 400 error)
          if (
            responseData?.error === 'Liveness check failed' ||
            responseData?.livenessResult
          ) {
            console.warn('⚠️ Liveness check failed:', responseData);
            setLivenessResult(responseData.livenessResult || null);
            setStep('liveness-failed');
            return;
          }

          // Handle other errors
          const errorMessage =
            responseData?.error ||
            responseData?.message ||
            'Failed to process selfie. Please try again.';
          showErrorMessage(errorMessage);
          setStep('error');
        },
      }
    );
  };

  const handleStartOver = () => {
    setExtractedData(null);
    setSessionId(null);
    setVerificationToken(null);
    setIdPhotoData(null);
    setLivenessResult(null);
    setMatchConfidence(0);
    setMatchSuccess(false);
    setFraudSignals([]);
    setTokenCreatedAt(null);
    setTimeRemaining(600);
    setCapturePhase('front');
    setFrontPhotoUri(null);
    setBackPhotoUri(null);
    setSelfieUri(null);
    setStep('start-session');
  };

  const handleRetakeSelfieFromReview = () => {
    setSelfieUri(null);
    setStep('capture-selfie');
  };

  // Called by IdCameraView when a photo is taken
  const handleIdFrameCaptured = React.useCallback(
    (base64: string) => {
      const dataUri = base64.startsWith('data:')
        ? base64
        : `data:image/jpeg;base64,${base64}`;

      if (capturePhase === 'front') {
        setFrontPhotoUri(dataUri);
        // Passports skip back capture
        if (extractedData?.idType === 'passport') {
          handlePhotoTaken({ front: { uri: dataUri, base64: dataUri } });
        } else {
          setCapturePhase('back');
        }
      } else {
        setBackPhotoUri(dataUri);
        handlePhotoTaken({
          front: { uri: frontPhotoUri!, base64: frontPhotoUri! },
          back: { uri: dataUri, base64: dataUri },
        });
      }
    },
    [capturePhase, extractedData, frontPhotoUri, handlePhotoTaken]
  );

  // Called by SelfieCameraView when selfie is taken
  const handleSelfieCaptured = React.useCallback(
    (base64: string, videoUri: string) => {
      const dataUri = base64.startsWith('data:')
        ? base64
        : `data:image/jpeg;base64,${base64}`;
      setSelfieUri(dataUri);
      handleSelfieCapture({ uri: dataUri, base64: dataUri, videoUri });
    },
    [handleSelfieCapture]
  );

  const handleContinueToSelfie = () => {
    setStep('capture-selfie');
  };

  const handleVerificationComplete = async () => {
    if (!extractedData || !sessionId || !verificationToken) {
      showErrorMessage('Missing verification data');
      return;
    }

    try {
      // Initialize wallet
      const walletAddress = await initializeWallet();
      if (!walletAddress) {
        showErrorMessage('Failed to initialize wallet');
        return;
      }

      // Issue credential using verification token + identity data
      issueCredential(
        {
          verificationToken,
          walletAddress,
          // Identity data for server-side hash verification
          firstName: extractedData.firstName,
          middleName: extractedData.middleName || '', // Ensure empty string instead of undefined
          lastName: extractedData.lastName,
          birthDate: extractedData.birthDate,
          governmentId: extractedData.governmentId,
          idType: extractedData.idType,
          state: extractedData.state?.toUpperCase(), // MUST be uppercase per server requirements
          expirationDate: extractedData.expirationDate,
        },
        {
          onSuccess: async (response) => {
            console.log('✅ Credential issued successfully:', response);

            // Save credential
            await credentialStorage.saveCredential(response);

            // Store document ID securely
            const docType =
              extractedData.idType === 'passport' ? 'passport' : 'governmentId';
            await secureDocumentStorage.storeDocumentId(
              docType,
              extractedData.governmentId
            );

            // Clear sensitive data
            setIdPhotoData(null);

            showMessage({
              message: 'Identity created successfully!',
              type: 'success',
            });

            // Navigate back to home
            router.replace('/(app)/');
          },
          onError: (error) => {
            console.error('❌ Error issuing credential:', error);
            const axiosError = error as AxiosError<{
              error?: string;
              message?: string;
            }>;
            const responseData = axiosError.response?.data;
            const errorText =
              responseData?.error || responseData?.message || '';

            // Handle new server error types
            if (errorText.includes('token expired')) {
              showErrorMessage(
                'Verification expired (10 min limit). Please start over.'
              );
              // Reset to initial state after a delay
              setTimeout(() => {
                handleStartOver();
              }, 3000);
              return;
            }

            if (errorText.includes('invalid format')) {
              showErrorMessage(
                'Verification error. Please update your app or contact support.'
              );
              setStep('error');
              return;
            }

            if (errorText.includes('Invalid')) {
              // Validation error from server
              showErrorMessage(`Validation error: ${errorText}`);
              setStep('error');
              return;
            }

            // Generic error
            const errorMessage = errorText || 'Failed to create identity';
            showErrorMessage(errorMessage);
            setStep('error');
          },
        }
      );
    } catch (error) {
      console.error('❌ Error in verification completion:', error);
      showErrorMessage('Failed to complete verification');
      setStep('error');
    }
  };

  const stepNumber = ((): 1 | 2 | 3 | 4 => {
    if (step === 'capture-id' && capturePhase === 'back') return 2;
    if (step === 'capture-selfie' || step === 'uploading-selfie') return 3;
    if (
      step === 'review-data' ||
      step === 'match-result' ||
      step === 'success' ||
      step === 'liveness-failed' ||
      step === 'fraud-detected' ||
      step === 'error'
    )
      return 4;
    return 1;
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />

      {/* ── Step: start-session ── */}
      {(step === 'start-session' || isStartingSession) && (
        <KycLayout
          top={<StepIndicator currentStep={1} visible={false} />}
          middle={
            <View className="flex-1 items-center justify-center gap-3">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-center text-gray-700">
                Starting session...
              </Text>
            </View>
          }
          bottom={<View />}
        />
      )}

      {/* ── Steps 1 & 2: ID Capture ── */}
      {step === 'capture-id' && (
        <OrientationGate>
          <View className="flex-1">
            <View className="absolute inset-x-0 top-8 z-10 px-4">
              <Text className="text-center text-lg font-semibold text-white">
                {capturePhase === 'front'
                  ? 'Front of your ID'
                  : 'Back of your ID'}
              </Text>
            </View>
            <IdCameraView
              side={capturePhase}
              onCapture={handleIdFrameCaptured}
            />
          </View>
        </OrientationGate>
      )}

      {/* ── Step 5: Processing (uploading / polling) ── */}
      {(step === 'uploading-id' ||
        step === 'polling-status' ||
        step === 'uploading-selfie') && (
        <KycLayout
          top={<StepIndicator currentStep={stepNumber} visible />}
          middle={
            <View className="flex-1 items-center justify-center gap-3">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-center text-base font-medium text-gray-700">
                Verifying your identity...
              </Text>
              <Text className="text-center text-sm text-gray-500">
                This usually takes a few seconds
              </Text>
            </View>
          }
          bottom={<View />}
        />
      )}

      {/* ── Step 3: Selfie ── */}
      {step === 'capture-selfie' && (
        <View className="flex-1">
          <View className="absolute inset-x-0 top-8 z-10 items-center gap-1 px-4">
            <Text className="text-center text-lg font-semibold text-white">
              Take a selfie
            </Text>
            <Text className="text-center text-sm text-white/80">
              Look directly at the camera
            </Text>
          </View>
          <SelfieCameraView onCapture={handleSelfieCaptured} />
        </View>
      )}

      {/* ── Step 4: Review & Confirm ── */}
      {step === 'review-data' && extractedData && (
        <KycLayout
          top={
            <View className="gap-1">
              <StepIndicator currentStep={4} visible />
              <Text className="text-center text-lg font-semibold text-gray-900">
                Review your photos
              </Text>
              <Text className="text-center text-sm text-gray-500">
                Make sure everything looks clear before submitting
              </Text>
            </View>
          }
          middle={
            <ScrollView className="flex-1 px-4 pt-2">
              {frontPhotoUri && (
                <ReviewCard
                  label="ID Front"
                  imageUri={frontPhotoUri}
                  onRetake={() => {
                    setCapturePhase('front');
                    setFrontPhotoUri(null);
                    setBackPhotoUri(null);
                    setStep('capture-id');
                  }}
                />
              )}
              {backPhotoUri && (
                <ReviewCard
                  label="ID Back"
                  imageUri={backPhotoUri}
                  onRetake={() => {
                    setCapturePhase('back');
                    setBackPhotoUri(null);
                    setStep('capture-id');
                  }}
                />
              )}
              {selfieUri && (
                <ReviewCard
                  label="Selfie"
                  imageUri={selfieUri}
                  circular
                  onRetake={handleRetakeSelfieFromReview}
                />
              )}
              {tokenCreatedAt && (
                <View
                  className={`mb-2 rounded-lg p-3 ${timeRemaining < 120 ? 'bg-red-50' : timeRemaining < 300 ? 'bg-yellow-50' : 'bg-blue-50'}`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${timeRemaining < 120 ? 'text-red-800' : timeRemaining < 300 ? 'text-yellow-800' : 'text-blue-800'}`}
                  >
                    Complete within: {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </ScrollView>
          }
          bottom={
            <View className="gap-2">
              <Button
                label="Submit for Verification"
                onPress={handleContinueToSelfie}
                testID="continue-button"
              />
              <Pressable onPress={handleStartOver} className="py-2">
                <Text className="text-center text-sm text-gray-500">
                  Start over
                </Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* ── Step 6a: Success ── */}
      {step === 'match-result' && matchSuccess && (
        <KycLayout
          top={<StepIndicator currentStep={4} visible />}
          middle={
            <ScrollView className="flex-1 px-4 pt-4">
              <View className="items-center gap-2 pb-4">
                <Text className="text-5xl text-green-600">✓</Text>
                <Text className="text-2xl font-semibold text-gray-900">
                  Identity Verified
                </Text>
                <Text className="text-sm text-gray-500">
                  Here&apos;s what we captured:
                </Text>
              </View>
              <View className="rounded-xl border border-gray-200 bg-white">
                {[
                  [
                    'Full Name',
                    `${extractedData?.firstName ?? ''} ${extractedData?.middleName ? extractedData.middleName + ' ' : ''}${extractedData?.lastName ?? ''}`,
                  ],
                  ['Date of Birth', extractedData?.birthDate ?? ''],
                  ['ID Number', extractedData?.governmentId ?? ''],
                  ['Expiration', extractedData?.expirationDate ?? '—'],
                  ['State', extractedData?.state ?? '—'],
                ].map(([label, value], i, arr) => (
                  <View
                    key={label}
                    className={`flex-row items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-200' : ''}`}
                  >
                    <Text className="text-xs uppercase tracking-wide text-gray-500">
                      {label}
                    </Text>
                    <Text className="text-sm text-gray-900">{value}</Text>
                  </View>
                ))}
              </View>
              <Text className="mt-4 px-2 text-center text-xs italic text-gray-500">
                This information will be stored in your local wallet and is
                never shared without your permission.
              </Text>
            </ScrollView>
          }
          bottom={
            <Button
              label={isIssuingCredential ? 'Creating Identity...' : 'Continue'}
              onPress={handleVerificationComplete}
              disabled={isIssuingCredential}
              loading={isIssuingCredential}
              testID="continue-to-credential-button"
            />
          }
        />
      )}

      {/* ── Step 6b: Failure (match fail / liveness / fraud / error) ── */}
      {((step === 'match-result' && !matchSuccess) ||
        step === 'liveness-failed' ||
        step === 'fraud-detected' ||
        step === 'error') && (
        <KycLayout
          top={<StepIndicator currentStep={4} visible />}
          middle={
            <ScrollView className="flex-1 px-4 pt-4">
              <View className="items-center gap-2 pb-4">
                <Text className="text-5xl text-red-600">✗</Text>
                <Text className="text-2xl font-semibold text-gray-900">
                  Verification Failed
                </Text>
                <Text className="text-center text-base text-gray-600">
                  {step === 'liveness-failed'
                    ? "We couldn't verify that you're a live person."
                    : step === 'fraud-detected'
                      ? "We're unable to verify your identity at this time."
                      : step === 'match-result'
                        ? "The face in your selfie doesn't match the ID photo."
                        : "We weren't able to verify your identity. This can happen if photos were blurry or didn't match."}
                </Text>
              </View>
              <Text className="text-center text-sm text-gray-500">
                Common fixes: better lighting, remove glare, make sure your full
                face is fully visible.
              </Text>
              {isDevelopment && fraudSignals.length > 0 && (
                <View className="mt-4 rounded-lg bg-yellow-50 p-4">
                  <Text className="mb-2 font-semibold text-yellow-900">
                    Debug Info (Dev Only):
                  </Text>
                  {fraudSignals.map((signal, i) => (
                    <Text key={i} className="font-mono text-xs text-yellow-800">
                      • {signal.type}: {signal.result}
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>
          }
          bottom={
            <View className="gap-2">
              <Button
                label="Try Again"
                onPress={handleStartOver}
                testID="try-again-button"
              />
              <Pressable
                onPress={() =>
                  Linking.openURL('https://cardlessid.org/support/user-help')
                }
                className="py-2"
              >
                <Text className="text-center text-sm text-gray-500">
                  Get help
                </Text>
              </Pressable>
            </View>
          }
        />
      )}
    </>
  );
}

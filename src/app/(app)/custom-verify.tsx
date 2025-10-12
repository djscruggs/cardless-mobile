import { Env } from '@env';
import { type AxiosError } from 'axios';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import { useIssueCredential } from '@/api/credentials';
import type { ExtractedData, LivenessResult } from '@/api/custom-verification';
import { useUploadId, useUploadSelfie } from '@/api/custom-verification';
import {
  IdPhotoCapture,
  SelfiePhotoCapture,
} from '@/components/custom-verification';
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
  | 'capture-id'
  | 'uploading-id'
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
  const [step, setStep] = React.useState<VerificationStep>('capture-id');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [verificationToken, setVerificationToken] = React.useState<
    string | null
  >(null);
  const [extractedData, setExtractedData] =
    React.useState<ExtractedData | null>(null);
  const [idPhotoData, setIdPhotoData] = React.useState<string | null>(null);
  const [livenessResult, setLivenessResult] =
    React.useState<LivenessResult | null>(null);
  const [matchConfidence, setMatchConfidence] = React.useState<number>(0);
  const [matchSuccess, setMatchSuccess] = React.useState<boolean>(false);
  const [fraudSignals, setFraudSignals] = React.useState<
    { type: string; result: string }[]
  >([]);

  const { mutate: uploadId, isPending: isUploadingId } = useUploadId();
  const { mutate: uploadSelfie, isPending: isUploadingSelfie } =
    useUploadSelfie();
  const { mutate: issueCredential, isPending: isIssuingCredential } =
    useIssueCredential();

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

          // Check for fraud detection in success response (shouldn't happen but defensive)
          if (response.fraudDetected || !response.success) {
            console.warn('⚠️ Fraud detected in success handler');
            setStep('fraud-detected');
            return;
          }

          // Validate required fields
          if (
            !response.sessionId ||
            !response.verificationToken ||
            !response.extractedData
          ) {
            showErrorMessage('Invalid response from server');
            setStep('error');
            return;
          }

          setSessionId(response.sessionId);
          setVerificationToken(response.verificationToken);
          setExtractedData(response.extractedData);

          if (response.isExpired) {
            showMessage({
              message: 'Warning: Your ID appears to be expired',
              type: 'warning',
              duration: 4000,
            });
          }

          // Check fraud check results
          if (response.fraudCheck && !response.fraudCheck.passed) {
            console.warn('⚠️ Fraud check failed:', response.fraudCheck);
            setFraudSignals(response.fraudCheck.signals || []);
            setStep('fraud-detected');
            return;
          }

          // Show warnings for low confidence or suspicious signals
          if (
            response.fraudCheck?.signals &&
            response.fraudCheck.signals.length > 0
          ) {
            showMessage({
              message: 'Warning: Document quality issues detected',
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

          setStep('review-data');
          showMessage({
            message: 'ID processed successfully!',
            type: 'success',
          });
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
        idPhoto: idPhotoData, // Send stored ID photo!
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
    setStep('capture-id');
  };

  const handleRetakeId = () => {
    setExtractedData(null);
    setSessionId(null);
    setVerificationToken(null);
    setIdPhotoData(null);
    setStep('capture-id');
  };

  const handleRetakeSelfie = () => {
    setLivenessResult(null);
    setMatchConfidence(0);
    setMatchSuccess(false);
    setStep('capture-selfie');
  };

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
          middleName: extractedData.middleName,
          lastName: extractedData.lastName,
          birthDate: extractedData.birthDate,
          governmentId: extractedData.governmentId,
          idType: extractedData.idType,
          state: extractedData.state,
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
            const errorMessage =
              responseData?.error ||
              responseData?.message ||
              'Failed to create identity';
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

  const getStepMessage = () => {
    switch (step) {
      case 'capture-id':
        return 'Capture Your ID';
      case 'uploading-id':
        return 'Processing ID...';
      case 'review-data':
        return 'Review ID Data';
      case 'capture-selfie':
        return 'Capture Selfie';
      case 'uploading-selfie':
        return 'Verifying...';
      case 'liveness-failed':
        return 'Liveness Check Failed';
      case 'match-result':
        return matchSuccess ? 'Verification Successful' : 'Face Does Not Match';
      case 'success':
        return 'Verified!';
      case 'fraud-detected':
        return 'Verification Unavailable';
      case 'error':
        return 'Something Went Wrong';
      default:
        return '';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Custom Verification',
          headerBackTitle: 'Back',
        }}
      />
      <FocusAwareStatusBar />

      {/* ID Capture */}
      {(step === 'capture-id' || step === 'uploading-id') && (
        <IdPhotoCapture
          onPhotoTaken={handlePhotoTaken}
          isLoading={isUploadingId}
        />
      )}

      {/* Data Review */}
      {step === 'review-data' && extractedData && (
        <ScrollView>
          <View className="flex-1 p-4">
            <View className="rounded-lg border-2 border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
                {getStepMessage()}
              </Text>
              <View className="mb-4 rounded-t-lg bg-gray-50 p-4 dark:bg-gray-900">
                <View className="mb-6 space-y-3">
                  <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Name
                    </Text>
                    <Text className="mt-1 text-lg font-medium dark:text-white">
                      {extractedData.firstName}{' '}
                      {extractedData.middleName
                        ? `${extractedData.middleName} `
                        : ''}
                      {extractedData.lastName}
                    </Text>
                  </View>

                  <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Date of Birth
                    </Text>
                    <Text className="mt-1 text-lg font-medium dark:text-white">
                      {extractedData.birthDate}
                    </Text>
                  </View>

                  <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      ID Type
                    </Text>
                    <Text className="mt-1 text-lg font-medium dark:text-white">
                      {extractedData.idType === 'drivers_license'
                        ? "Driver's License"
                        : extractedData.idType === 'passport'
                          ? 'Passport'
                          : 'Government ID'}
                    </Text>
                  </View>

                  <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      ID Number
                    </Text>
                    <Text className="mt-1 text-lg font-medium dark:text-white">
                      {extractedData.governmentId}
                    </Text>
                  </View>

                  {extractedData.state && (
                    <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        State
                      </Text>
                      <Text className="mt-1 text-lg font-medium dark:text-white">
                        {extractedData.state}
                      </Text>
                    </View>
                  )}

                  {extractedData.expirationDate && (
                    <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        Expiration Date
                      </Text>
                      <Text className="mt-1 text-lg font-medium dark:text-white">
                        {extractedData.expirationDate}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="space-y-3">
                <Button
                  label="Continue to Selfie"
                  onPress={handleContinueToSelfie}
                  testID="continue-button"
                />
                <Button
                  label="Retake Photo"
                  variant="outline"
                  onPress={handleRetakeId}
                  testID="retake-button"
                />
              </View>

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
      )}

      {/* Selfie Capture */}
      {(step === 'capture-selfie' || step === 'uploading-selfie') && (
        <SelfiePhotoCapture
          onPhotoTaken={handleSelfieCapture}
          isLoading={isUploadingSelfie}
        />
      )}

      {/* Liveness Check Failed */}
      {step === 'liveness-failed' && (
        <ScrollView>
          <View className="flex-1 items-center justify-center p-4">
            <View className="w-full max-w-md rounded-lg border-2 border-red-300 bg-white p-6 dark:border-red-700 dark:bg-gray-800">
              <Text className="mb-4 text-center text-2xl font-bold text-red-600 dark:text-red-400">
                {getStepMessage()}
              </Text>

              <Text className="mb-4 text-center text-gray-700 dark:text-gray-300">
                We couldn&apos;t verify that you&apos;re a live person. Please
                try again.
              </Text>

              {livenessResult?.issues && livenessResult.issues.length > 0 && (
                <View className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <Text className="mb-2 font-semibold text-red-900 dark:text-red-200">
                    Issues detected:
                  </Text>
                  {livenessResult.issues.map((issue, index) => (
                    <Text
                      key={index}
                      className="text-sm text-red-800 dark:text-red-300"
                    >
                      • {issue}
                    </Text>
                  ))}
                </View>
              )}

              <View className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <Text className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                  Tips for better results:
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Ensure good lighting
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Face the camera directly
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Keep eyes open and visible
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Remove sunglasses or hats
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Hold device steady
                </Text>
              </View>

              <View className="space-y-3">
                <Button
                  label="Try Again"
                  onPress={handleRetakeSelfie}
                  testID="retry-selfie-button"
                />
                <Button
                  label="Start Over"
                  variant="outline"
                  onPress={handleStartOver}
                  testID="start-over-button"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Match Result */}
      {step === 'match-result' && (
        <ScrollView>
          <View className="flex-1 items-center justify-center p-4">
            <View
              className={`w-full max-w-md rounded-lg border-2 p-6 ${
                matchSuccess
                  ? 'border-green-300 bg-white dark:border-green-700 dark:bg-gray-800'
                  : 'border-red-300 bg-white dark:border-red-700 dark:bg-gray-800'
              }`}
            >
              <Text
                className={`mb-4 text-center text-2xl font-bold ${
                  matchSuccess
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {getStepMessage()}
              </Text>

              {matchSuccess ? (
                <>
                  <View className="mb-6 items-center">
                    <Text className="text-6xl">✓</Text>
                  </View>

                  <Text className="mb-4 text-center text-gray-700 dark:text-gray-300">
                    Your identity has been verified! Tap below to create your
                    decentralized identity credential.
                  </Text>

                  <View className="mb-6 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <Text className="text-center text-sm text-green-800 dark:text-green-300">
                      Match Confidence: {(matchConfidence * 100).toFixed(1)}%
                    </Text>
                    {livenessResult && (
                      <Text className="mt-1 text-center text-sm text-green-800 dark:text-green-300">
                        Liveness Score:{' '}
                        {(livenessResult.confidence * 100).toFixed(1)}%
                      </Text>
                    )}
                  </View>

                  <Button
                    label={
                      isIssuingCredential
                        ? 'Creating Identity...'
                        : 'Create Identity'
                    }
                    onPress={handleVerificationComplete}
                    disabled={isIssuingCredential}
                    loading={isIssuingCredential}
                    testID="continue-to-credential-button"
                  />
                </>
              ) : (
                <>
                  <View className="mb-6 items-center">
                    <Text className="text-6xl">✗</Text>
                  </View>

                  <Text className="mb-4 text-center text-gray-700 dark:text-gray-300">
                    The face in your selfie doesn&apos;t match the ID photo.
                  </Text>

                  <View className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                    <Text className="text-center text-sm text-red-800 dark:text-red-300">
                      Match Confidence: {(matchConfidence * 100).toFixed(1)}%
                    </Text>
                  </View>

                  <View className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                    <Text className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                      Please ensure:
                    </Text>
                    <Text className="text-sm text-blue-800 dark:text-blue-300">
                      • Same person in both photos
                    </Text>
                    <Text className="text-sm text-blue-800 dark:text-blue-300">
                      • Good lighting in both images
                    </Text>
                    <Text className="text-sm text-blue-800 dark:text-blue-300">
                      • Face clearly visible
                    </Text>
                    <Text className="text-sm text-blue-800 dark:text-blue-300">
                      • ID photo shows your face
                    </Text>
                  </View>

                  <View className="space-y-3">
                    <Button
                      label="Retake Selfie"
                      onPress={handleRetakeSelfie}
                      testID="retry-selfie-button"
                    />
                    <Button
                      label="Start Over"
                      variant="outline"
                      onPress={handleStartOver}
                      testID="start-over-button"
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Fraud Detected */}
      {step === 'fraud-detected' && (
        <ScrollView>
          <View className="flex-1 items-center justify-center p-4">
            <View className="w-full max-w-md rounded-lg border-2 border-orange-300 bg-white p-6 dark:border-orange-700 dark:bg-gray-800">
              <Text className="mb-4 text-center text-2xl font-bold text-orange-600 dark:text-orange-400">
                {getStepMessage()}
              </Text>

              <Text className="mb-6 text-center text-gray-700 dark:text-gray-300">
                We&apos;re unable to verify your identity at this time. This may
                happen if the document quality is insufficient or if there are
                issues with the photo.
              </Text>

              <View className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <Text className="mb-2 font-semibold text-blue-900 dark:text-blue-200">
                  What you can do:
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Ensure your ID is an original, unaltered document
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Take a clear, well-lit photo
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Avoid glare or shadows on the document
                </Text>
                <Text className="text-sm text-blue-800 dark:text-blue-300">
                  • Make sure all text is clearly visible
                </Text>
              </View>

              {isDevelopment && fraudSignals.length > 0 && (
                <View className="mb-6 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                  <Text className="mb-2 font-semibold text-yellow-900 dark:text-yellow-200">
                    🔧 Debug Info (Dev Only):
                  </Text>
                  {fraudSignals.map((signal, index) => (
                    <Text
                      key={index}
                      className="font-mono text-xs text-yellow-800 dark:text-yellow-300"
                    >
                      • {signal.type}: {signal.result}
                    </Text>
                  ))}
                </View>
              )}

              <View className="mb-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
                <Text className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Need Help?
                </Text>
                <Text className="text-sm text-gray-700 dark:text-gray-300">
                  If you believe this is an error, please contact our support
                  team for assistance with manual verification.
                </Text>
              </View>

              <View className="space-y-3">
                {isDevelopment && (
                  <Button
                    label="Try Again (Dev Only)"
                    onPress={handleStartOver}
                    testID="dev-retry-button"
                  />
                )}
                <Button
                  label="Contact Support"
                  onPress={() => {
                    // TODO: Open support contact method
                    showMessage({
                      message: 'Support contact coming soon',
                      type: 'info',
                    });
                  }}
                  testID="contact-support-button"
                />
                <Button
                  label="Go Back"
                  variant="outline"
                  onPress={() => router.back()}
                  testID="go-back-button"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Error State */}
      {step === 'error' && (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-center text-xl font-bold text-red-600 dark:text-red-400">
            {getStepMessage()}
          </Text>
          <Button
            label="Start Over"
            onPress={handleStartOver}
            testID="try-again-button"
          />
        </View>
      )}
    </>
  );
}

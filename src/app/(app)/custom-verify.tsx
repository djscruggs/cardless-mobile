import { type AxiosError } from 'axios';
import { Stack } from 'expo-router';
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import type { ExtractedData } from '@/api/custom-verification';
import { useUploadId } from '@/api/custom-verification';
import { IdPhotoCapture } from '@/components/custom-verification';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';

type VerificationStep = 'capture' | 'uploading' | 'review' | 'error';

/* eslint-disable max-lines-per-function */
export default function CustomVerify() {
  const [step, setStep] = React.useState<VerificationStep>('capture');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [extractedData, setExtractedData] =
    React.useState<ExtractedData | null>(null);

  const { mutate: uploadId, isPending: isUploading } = useUploadId();

  const handlePhotoTaken = async (photo: { uri: string; base64?: string }) => {
    console.log('📸 Photo captured:', { uri: photo.uri });

    if (!photo.base64) {
      showErrorMessage('Failed to capture photo data');
      return;
    }

    setStep('uploading');

    // Convert to data URL format if needed
    const imageData = photo.base64.startsWith('data:')
      ? photo.base64
      : `data:image/jpeg;base64,${photo.base64}`;

    uploadId(
      {
        image: imageData,
        mimeType: 'image/jpeg',
      },
      {
        onSuccess: (response) => {
          console.log('✅ ID uploaded successfully:', response);
          setSessionId(response.sessionId);
          setExtractedData(response.extractedData);

          if (response.isExpired) {
            showMessage({
              message: 'Warning: Your ID appears to be expired',
              type: 'warning',
              duration: 4000,
            });
          }

          if (
            response.fraudSignals.some((signal) => signal.result === 'FAIL')
          ) {
            showMessage({
              message: 'Warning: Potential fraud signals detected',
              type: 'warning',
              duration: 4000,
            });
          }

          setStep('review');
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
          }>;
          const responseData = axiosError.response?.data;
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

  const handleRetake = () => {
    setExtractedData(null);
    setSessionId(null);
    setStep('capture');
  };

  const handleContinue = () => {
    // TODO: Continue to selfie capture
    showMessage({
      message: 'Selfie capture coming soon!',
      type: 'info',
    });
  };

  const getStepMessage = () => {
    switch (step) {
      case 'capture':
        return 'Capture your ID';
      case 'uploading':
        return 'Processing your ID...';
      case 'review':
        return 'Review extracted information';
      case 'error':
        return 'Something went wrong';
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

      {(step === 'capture' || step === 'uploading') && (
        <IdPhotoCapture
          onPhotoTaken={handlePhotoTaken}
          isLoading={isUploading}
        />
      )}

      {step === 'review' && extractedData && (
        <ScrollView>
          <View className="flex-1 p-4">
            <View className="rounded-lg border-2 border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
                {getStepMessage()}
              </Text>

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

              <View className="space-y-3">
                <Button
                  label="Continue to Selfie"
                  onPress={handleContinue}
                  testID="continue-button"
                />
                <Button
                  label="Retake Photo"
                  variant="outline"
                  onPress={handleRetake}
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

      {step === 'error' && (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-center text-xl font-bold text-red-600 dark:text-red-400">
            {getStepMessage()}
          </Text>
          <Button
            label="Try Again"
            onPress={handleRetake}
            testID="try-again-button"
          />
        </View>
      )}
    </>
  );
}

import { Env } from '@env';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Modal, TextInput } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import {
  Button,
  FocusAwareStatusBar,
  ObfuscatedText,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { credentialStorage } from '@/lib';

/* eslint-disable max-lines-per-function */
export default function MyID() {
  const router = useRouter();
  const [credential, setCredential] =
    React.useState<Awaited<ReturnType<typeof credentialStorage.getCredential>>>(
      null
    );
  const [personalData, setPersonalData] =
    React.useState<
      Awaited<ReturnType<typeof credentialStorage.getPersonalData>>
    >(null);
  const [verificationQuality, setVerificationQuality] =
    React.useState<
      Awaited<ReturnType<typeof credentialStorage.getVerificationQuality>>
    >(null);
  const [blockchain, setBlockchain] =
    React.useState<Awaited<ReturnType<typeof credentialStorage.getBlockchain>>>(
      null
    );
  const [duplicateDetection, setDuplicateDetection] =
    React.useState<
      Awaited<ReturnType<typeof credentialStorage.getDuplicateDetection>>
    >(null);
  const [showJSONModal, setShowJSONModal] = React.useState(false);
  const [isDeveloperInfoExpanded, setIsDeveloperInfoExpanded] =
    React.useState(false);
  const isDevelopment = Env.APP_ENV !== 'production';
  console.log(credential);
  useFocusEffect(
    React.useCallback(() => {
      const loadCredentials = async () => {
        setCredential(await credentialStorage.getCredential());
        setPersonalData(await credentialStorage.getPersonalData());
        setVerificationQuality(
          await credentialStorage.getVerificationQuality()
        );
        setBlockchain(await credentialStorage.getBlockchain());
        setDuplicateDetection(await credentialStorage.getDuplicateDetection());
      };
      loadCredentials();
    }, [])
  );

  const handleCreateIdentity = () => {
    router.push('/(app)/create-identity');
  };

  const handleVerifyIdentity = () => {
    router.push('/(app)/verify-identity');
  };

  const handleCustomVerify = () => {
    router.push('/(app)/custom-verify');
  };

  const handleClearCredential = async () => {
    await credentialStorage.clearCredential();
    setCredential(null);
    setPersonalData(null);
    setVerificationQuality(null);
    setBlockchain(null);
    setDuplicateDetection(null);
  };

  const handleViewRawJSON = () => {
    setShowJSONModal(true);
  };

  const handleViewTransaction = () => {
    if (blockchain?.transaction?.explorerUrl) {
      Linking.openURL(blockchain.transaction.explorerUrl);
    }
  };

  const handleCopyJSON = () => {
    Clipboard.setString(getFormattedJSON());
    showMessage({
      message: 'JSON copied to clipboard',
      type: 'success',
    });
  };

  const getFormattedJSON = () => {
    const jsonData = {
      credential,
      personalData,
      verificationQuality,
      blockchain,
      duplicateDetection,
    };
    return JSON.stringify(jsonData, null, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View className="flex-1">
      <FocusAwareStatusBar />
      <Modal
        visible={showJSONModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJSONModal(false)}
      >
        <View className="flex-1 bg-white dark:bg-gray-900">
          <View className="flex-row items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <Text className="text-lg font-semibold dark:text-white">
              Raw JSON Data
            </Text>
            <View className="flex-row">
              <Button
                label="Copy"
                variant="secondary"
                className="mr-2"
                onPress={handleCopyJSON}
                testID="copy-json-button"
              />
              <Button
                label="Close"
                onPress={() => setShowJSONModal(false)}
                testID="close-json-modal"
              />
            </View>
          </View>
          <ScrollView className="flex-1 p-4">
            <TextInput
              value={getFormattedJSON()}
              multiline
              selectTextOnFocus
              className="font-mono text-sm dark:text-white"
              style={{ minHeight: 400 }}
            />
            <View style={{ height: 200 }} />
          </ScrollView>
        </View>
      </Modal>
      <ScrollView>
        <View className="flex-1 items-center p-4">
          <View className="w-full max-w-md content-stretch rounded-lg border-2 border-gray-300 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {credential && personalData ? (
              <>
                <View className="space-y-6">
                  <View className="mb-2 items-center">
                    <Text className="text-center text-2xl font-bold dark:text-white">
                      {personalData.firstName}{' '}
                      {personalData.middleName && personalData.middleName + ' '}
                      {personalData.lastName}
                    </Text>
                  </View>

                  <View className="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                    <View className="flex-row items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Date of Birth
                      </Text>
                      <Text className="text-xl font-semibold dark:text-white">
                        {formatDate(personalData.birthDate)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 py-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        ID Type
                      </Text>
                      <Text className="text-xl font-semibold dark:text-white">
                        {personalData.idType === 'government_id'
                          ? 'Government ID'
                          : 'Passport'}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 py-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        ID Number
                      </Text>
                      <Text className="mt-5 text-xl">
                        <ObfuscatedText
                          value={personalData.governmentId}
                          testID="government-id"
                        />
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 py-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        State
                      </Text>
                      <Text className="text-xl font-semibold dark:text-white">
                        {personalData.state}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between pt-3">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Issued
                      </Text>
                      <Text className="text-xl font-semibold dark:text-white">
                        {formatDate(credential.issuanceDate)}
                      </Text>
                    </View>
                    <View className="mt-2">
                      <Text className="mt-1 text-center text-sm font-medium text-green-600 dark:text-green-400">
                        ✓ Verified Identity
                      </Text>
                    </View>
                  </View>
                </View>

                {isDevelopment && (
                  <View className="mt-6 border-t border-gray-200 bg-red-50 p-4 dark:border-gray-700">
                    <Button
                      label={
                        isDeveloperInfoExpanded
                          ? '▼ Developer Info'
                          : '▶ Developer Info'
                      }
                      variant="secondary"
                      onPress={() =>
                        setIsDeveloperInfoExpanded(!isDeveloperInfoExpanded)
                      }
                      testID="toggle-developer-info"
                    />
                    {isDeveloperInfoExpanded && (
                      <View className="mt-4 space-y-3">
                        {duplicateDetection && (
                          <View className="mb-4 rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900">
                            <Text className="text-center font-semibold dark:text-white">
                              {duplicateDetection.isDuplicate
                                ? `⚠️ ${duplicateDetection.duplicateCount} Duplicate${duplicateDetection.duplicateCount > 1 ? 's' : ''} Found`
                                : '✓ No Duplicates'}
                            </Text>
                            <Text className="mt-1 text-center text-sm dark:text-gray-300">
                              {duplicateDetection.message}
                            </Text>
                          </View>
                        )}
                        {blockchain?.transaction?.explorerUrl && (
                          <Button
                            label="View Blockchain Transaction"
                            variant="default"
                            onPress={handleViewTransaction}
                            testID="view-transaction-button"
                          />
                        )}
                        <Button
                          label="View Raw JSON"
                          variant="default"
                          onPress={handleViewRawJSON}
                          testID="view-json-button"
                        />
                        <Button
                          label="Clear Credential"
                          variant="destructive"
                          onPress={handleClearCredential}
                          testID="clear-credential-button"
                        />
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <View className="my-8 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-gray-100 p-8 dark:border-gray-600 dark:bg-gray-700">
                  <Text className="text-center text-gray-500 dark:text-gray-400">
                    No ID Installed
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-100">
                    Click Verify Identity to get started
                  </Text>
                </View>
                <View className="mt-6 space-y-3">
                  <Button
                    label="Custom Verification (Photo ID)"
                    onPress={handleCustomVerify}
                    testID="custom-verify-button"
                  />
                  <Button
                    label="Verify Identity (Mock)"
                    variant="secondary"
                    onPress={handleVerifyIdentity}
                    testID="verify-identity-button"
                  />
                  <Button
                    label="Create Identity (Dev)"
                    variant="secondary"
                    onPress={handleCreateIdentity}
                    testID="create-identity-button"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

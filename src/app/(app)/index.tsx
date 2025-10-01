import { Env } from '@env';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Modal, TextInput } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { credentialStorage } from '@/lib';

/* eslint-disable max-lines-per-function */
export default function MyID() {
  const router = useRouter();
  const [credential, setCredential] =
    React.useState<ReturnType<typeof credentialStorage.getCredential>>(null);
  const [personalData, setPersonalData] =
    React.useState<ReturnType<typeof credentialStorage.getPersonalData>>(null);
  const [blockchain, setBlockchain] =
    React.useState<ReturnType<typeof credentialStorage.getBlockchain>>(null);
  const [showJSONModal, setShowJSONModal] = React.useState(false);
  const isDevelopment = Env.APP_ENV !== 'production';

  useFocusEffect(
    React.useCallback(() => {
      setCredential(credentialStorage.getCredential());
      setPersonalData(credentialStorage.getPersonalData());
      setBlockchain(credentialStorage.getBlockchain());
    }, [])
  );

  const handleCreateIdentity = () => {
    router.push('/(app)/create-identity');
  };

  const handleClearCredential = async () => {
    await credentialStorage.clearCredential();
    setCredential(null);
    setPersonalData(null);
    setBlockchain(null);
  };

  const handleViewRawJSON = () => {
    setShowJSONModal(true);
  };

  const handleViewCredentialTx = () => {
    if (blockchain?.credentialTransaction?.explorerUrl) {
      Linking.openURL(blockchain.credentialTransaction.explorerUrl);
    }
  };

  const handleViewVerificationTx = () => {
    if (blockchain?.verificationTransaction?.explorerUrl) {
      Linking.openURL(blockchain.verificationTransaction.explorerUrl);
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
      blockchain,
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
          <View className="w-full max-w-md rounded-lg border-2 border-gray-300 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {credential && personalData ? (
              <>
                <View className="mb-6">
                  <Text className="text-center text-3xl font-bold dark:text-white">
                    Cardless ID
                  </Text>
                  <Text className="mt-1 text-center text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ Verified Credential
                  </Text>
                </View>

                <View className="space-y-6">
                  <View className="items-center">
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
                      <Text className="text-base font-semibold dark:text-white">
                        {formatDate(personalData.birthDate)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        ID Type
                      </Text>
                      <Text className="text-base font-semibold dark:text-white">
                        {personalData.idType === 'drivers_license'
                          ? "Driver's License"
                          : 'Passport'}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        ID Number
                      </Text>
                      <Text className="text-base font-semibold dark:text-white">
                        {personalData.governmentId}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        State
                      </Text>
                      <Text className="text-base font-semibold dark:text-white">
                        {personalData.state}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Issued
                      </Text>
                      <Text className="text-base font-semibold dark:text-white">
                        {formatDate(credential.issuanceDate)}
                      </Text>
                    </View>
                  </View>
                </View>

                {isDevelopment && (
                  <View className="mt-6 space-y-3 border-t border-gray-200 bg-red-50 p-4 dark:border-gray-700">
                    <Text className="mb-4 text-center text-2xl font-bold dark:text-white">
                      Developer Info
                    </Text>
                    {blockchain?.verificationTransaction?.explorerUrl && (
                      <Button
                        label="View Verification Tx"
                        variant="default"
                        onPress={handleViewVerificationTx}
                        testID="view-verification-tx-button"
                      />
                    )}
                    {blockchain?.credentialTransaction?.explorerUrl && (
                      <Button
                        label="View Credential Tx"
                        variant="default"
                        onPress={handleViewCredentialTx}
                        testID="view-credential-tx-button"
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
              </>
            ) : (
              <>
                <View className="my-8 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-gray-100 p-8 dark:border-gray-600 dark:bg-gray-700">
                  <Text className="text-center text-gray-500 dark:text-gray-400">
                    No Credential
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-400 dark:text-gray-500">
                    Create your identity to get started
                  </Text>
                </View>
                <View className="mt-6">
                  <Button
                    label="Create Identity"
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

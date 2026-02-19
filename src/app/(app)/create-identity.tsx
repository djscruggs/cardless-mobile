import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';

import { useIssueCredential } from '@/api';
import {
  Button,
  ControlledInput,
  ControlledSelect,
  FocusAwareStatusBar,
  ScrollView,
  showErrorMessage,
  View,
} from '@/components/ui';
import {
  credentialStorage,
  initializeWallet,
  secureDocumentStorage,
} from '@/lib';

const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
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

/* eslint-disable max-lines-per-function */
export default function CreateIdentity() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = React.useState<string | null>(null);
  const [isLoadingDummyData, setIsLoadingDummyData] = React.useState(false);
  const { control, handleSubmit, setValue } = useForm<FormType>({
    resolver: zodResolver(schema),
  });
  const { mutate: issueCredential, isPending } = useIssueCredential();

  // Load dummy data from DummyJSON
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
      const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA'];
      setValue('state', states[Math.floor(Math.random() * states.length)]);

      setIsLoadingDummyData(false);
    } catch (error) {
      console.error('❌ Error loading dummy data:', error);
      setIsLoadingDummyData(false);
      showErrorMessage('Failed to load dummy data');
    }
  }, [setValue]);

  // Initialize wallet on mount
  React.useEffect(() => {
    const init = async () => {
      const address = await initializeWallet();
      setWalletAddress(address);
    };
    init();
  }, []);

  // Load random dummy data on mount
  React.useEffect(() => {
    loadDummyData();
  }, [loadDummyData]);

  const onSubmit = (data: FormType) => {
    if (!walletAddress) {
      showErrorMessage('Wallet not initialized');
      return;
    }

    // Convert MM-DD-YYYY to YYYY-MM-DD for API
    const [month, day, year] = data.birthDate.split('-');
    const isoDate = `${year}-${month}-${day}`;

    console.log('📝 Form data:', data);
    console.log('📅 Converted date:', isoDate);

    issueCredential(
      { ...data, birthDate: isoDate, walletAddress },
      {
        onSuccess: async (response) => {
          console.log('✅ Credential issued successfully:', response);
          await credentialStorage.saveCredential(response);

          // Store document ID securely
          const docType =
            data.idType === 'passport' ? 'passport' : 'governmentId';
          await secureDocumentStorage.storeDocumentId(
            docType,
            data.governmentId
          );

          showMessage({
            message: 'Identity created successfully',
            type: 'success',
          });
          router.back();
        },
        onError: (error) => {
          console.error('❌ Error issuing credential:', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
          });
          const responseData = error.response?.data as
            | { error?: string; message?: string }
            | undefined;
          const errorText = responseData?.error || responseData?.message || '';

          // Handle specific server validation errors
          if (errorText.includes('Invalid')) {
            showErrorMessage(`Validation error: ${errorText}`);
            return;
          }

          const errorMessage = errorText || 'Error creating identity';
          showErrorMessage(errorMessage);
        },
      }
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Identity',
          headerBackTitle: 'Back',
        }}
      />
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 p-4">
          <View className="mb-4">
            <Button
              label={
                isLoadingDummyData ? 'Loading...' : 'Load Random Test Data'
              }
              onPress={loadDummyData}
              variant="secondary"
              disabled={isLoadingDummyData}
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
            label="Middle Name"
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
            label="Create Identity"
            loading={isPending}
            onPress={handleSubmit(onSubmit)}
            testID="create-identity-button"
          />
        </View>
      </ScrollView>
    </>
  );
}

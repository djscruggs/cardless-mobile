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
import { credentialStorage } from '@/lib';

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
  { label: "Driver's License", value: 'drivers_license' },
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
  idType: z.enum(['passport', 'drivers_license'], {
    required_error: 'Please select an ID type',
  }),
  state: z.string().min(2, 'Please select a state'),
});

type FormType = z.infer<typeof schema>;

/* eslint-disable max-lines-per-function */
export default function CreateIdentity() {
  const router = useRouter();
  const { control, handleSubmit } = useForm<FormType>({
    resolver: zodResolver(schema),
  });
  const { mutate: issueCredential, isPending } = useIssueCredential();

  const onSubmit = (data: FormType) => {
    // TODO: Generate or retrieve wallet address
    const walletAddress =
      '55MFIU3EEXNLAE3KWVVC2FWKOWPTIMMFAJAY4TONNIFRZZYETL2IL3QRCE';

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
          const errorMessage =
            responseData?.error ||
            responseData?.message ||
            'Error creating identity';
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

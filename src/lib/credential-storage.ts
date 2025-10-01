import type { CredentialResponse } from '@/api';

import { getItem, removeItem, setItem } from './storage';

const CREDENTIAL_KEY = 'cardless_credential';
const PERSONAL_DATA_KEY = 'cardless_personal_data';

export const credentialStorage = {
  getCredential: () =>
    getItem<CredentialResponse['credential']>(CREDENTIAL_KEY),

  getPersonalData: () =>
    getItem<CredentialResponse['personalData']>(PERSONAL_DATA_KEY),

  saveCredential: async (response: CredentialResponse) => {
    await setItem(CREDENTIAL_KEY, response.credential);
    await setItem(PERSONAL_DATA_KEY, response.personalData);
  },

  clearCredential: async () => {
    await removeItem(CREDENTIAL_KEY);
    await removeItem(PERSONAL_DATA_KEY);
  },

  hasCredential: () => {
    return credentialStorage.getCredential() !== null;
  },
};

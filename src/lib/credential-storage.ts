import type { CredentialResponse } from '@/api';

import { getItem, removeItem, setItem } from './storage';

const CREDENTIAL_KEY = 'cardless_credential';
const PERSONAL_DATA_KEY = 'cardless_personal_data';
const BLOCKCHAIN_KEY = 'cardless_blockchain';

export const credentialStorage = {
  getCredential: () =>
    getItem<CredentialResponse['credential']>(CREDENTIAL_KEY),

  getPersonalData: () =>
    getItem<CredentialResponse['personalData']>(PERSONAL_DATA_KEY),

  getBlockchain: () =>
    getItem<CredentialResponse['blockchain']>(BLOCKCHAIN_KEY),

  saveCredential: async (response: CredentialResponse) => {
    await setItem(CREDENTIAL_KEY, response.credential);
    await setItem(PERSONAL_DATA_KEY, response.personalData);
    if (response.blockchain) {
      await setItem(BLOCKCHAIN_KEY, response.blockchain);
    }
  },

  clearCredential: async () => {
    await removeItem(CREDENTIAL_KEY);
    await removeItem(PERSONAL_DATA_KEY);
    await removeItem(BLOCKCHAIN_KEY);
  },

  hasCredential: () => {
    return credentialStorage.getCredential() !== null;
  },
};

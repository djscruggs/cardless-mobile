import type { CredentialResponse } from '@/api';

import { getItem, removeItem, setItem } from './storage';

const CREDENTIAL_KEY = 'cardless_credential';
const PERSONAL_DATA_KEY = 'cardless_personal_data';
const BLOCKCHAIN_KEY = 'cardless_blockchain';
const DUPLICATE_DETECTION_KEY = 'cardless_duplicate_detection';

export const credentialStorage = {
  getCredential: () =>
    getItem<CredentialResponse['credential']>(CREDENTIAL_KEY),

  getPersonalData: () =>
    getItem<CredentialResponse['personalData']>(PERSONAL_DATA_KEY),

  getBlockchain: () =>
    getItem<CredentialResponse['blockchain']>(BLOCKCHAIN_KEY),

  getDuplicateDetection: () =>
    getItem<CredentialResponse['duplicateDetection']>(DUPLICATE_DETECTION_KEY),

  saveCredential: async (response: CredentialResponse) => {
    await setItem(CREDENTIAL_KEY, response.credential);
    await setItem(PERSONAL_DATA_KEY, response.personalData);
    if (response.blockchain) {
      await setItem(BLOCKCHAIN_KEY, response.blockchain);
    }
    if (response.duplicateDetection) {
      await setItem(DUPLICATE_DETECTION_KEY, response.duplicateDetection);
    }
  },

  clearCredential: async () => {
    await removeItem(CREDENTIAL_KEY);
    await removeItem(PERSONAL_DATA_KEY);
    await removeItem(BLOCKCHAIN_KEY);
    await removeItem(DUPLICATE_DETECTION_KEY);
  },

  hasCredential: () => {
    return credentialStorage.getCredential() !== null;
  },
};

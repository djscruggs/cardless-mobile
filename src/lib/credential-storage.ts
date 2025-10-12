import type { CredentialResponse } from '@/api';

import { secureDocumentStorage } from './secure-document-storage';
import { getItem, removeItem, setItem } from './storage';

const CREDENTIAL_KEY = 'cardless_credential';
const PERSONAL_DATA_KEY = 'cardless_personal_data';
const VERIFICATION_QUALITY_KEY = 'cardless_verification_quality';
const NFT_KEY = 'cardless_nft';
const BLOCKCHAIN_KEY = 'cardless_blockchain';
const DUPLICATE_DETECTION_KEY = 'cardless_duplicate_detection';

export const credentialStorage = {
  getCredential: () =>
    getItem<CredentialResponse['credential']>(CREDENTIAL_KEY),

  getPersonalData: () =>
    getItem<CredentialResponse['personalData']>(PERSONAL_DATA_KEY),

  getVerificationQuality: () =>
    getItem<CredentialResponse['verificationQuality']>(
      VERIFICATION_QUALITY_KEY
    ),

  getNFT: () => getItem<CredentialResponse['nft']>(NFT_KEY),

  getBlockchain: () =>
    getItem<CredentialResponse['blockchain']>(BLOCKCHAIN_KEY),

  getDuplicateDetection: () =>
    getItem<CredentialResponse['duplicateDetection']>(DUPLICATE_DETECTION_KEY),

  saveCredential: async (response: CredentialResponse) => {
    await setItem(CREDENTIAL_KEY, response.credential);
    await setItem(PERSONAL_DATA_KEY, response.personalData);
    if (response.verificationQuality) {
      await setItem(VERIFICATION_QUALITY_KEY, response.verificationQuality);
    }
    if (response.nft) {
      await setItem(NFT_KEY, response.nft);
    }
    if (response.blockchain) {
      await setItem(BLOCKCHAIN_KEY, response.blockchain);
    }
    if (response.duplicateDetection) {
      await setItem(DUPLICATE_DETECTION_KEY, response.duplicateDetection);
    }
  },

  updateNFT: async (nft: CredentialResponse['nft']) => {
    if (nft) {
      await setItem(NFT_KEY, nft);
    }
  },

  clearCredential: async () => {
    await removeItem(CREDENTIAL_KEY);
    await removeItem(PERSONAL_DATA_KEY);
    await removeItem(VERIFICATION_QUALITY_KEY);
    await removeItem(NFT_KEY);
    await removeItem(BLOCKCHAIN_KEY);
    await removeItem(DUPLICATE_DETECTION_KEY);

    // Also clear encrypted document IDs from secure storage
    try {
      await secureDocumentStorage.clearAll();
    } catch (error) {
      console.error('Error clearing secure document storage:', error);
      // Continue anyway - don't throw
    }
  },

  hasCredential: () => {
    return credentialStorage.getCredential() !== null;
  },
};

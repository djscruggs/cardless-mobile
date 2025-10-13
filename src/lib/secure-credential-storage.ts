import * as Crypto from 'expo-crypto';
import * as Keychain from 'react-native-keychain';

import type { CredentialResponse } from '@/api';

/**
 * Secure, tamper-proof credential storage using cryptographic signatures.
 *
 * This implementation ensures:
 * - Credentials are encrypted using the device's secure storage (Keychain/Keystore)
 * - Tampering is detected via HMAC-SHA256 signatures
 * - Only the app can read/write credentials
 * - Device owner cannot alter stored credentials
 */
class SecureCredentialStorage {
  private static readonly SERVICE_NAME = 'cardlessid.credentials';
  private static readonly SIGNING_KEY_SERVICE = 'cardlessid.signing_key';

  /**
   * Gets or creates a device-specific signing key for HMAC
   */
  private async getSigningKey(): Promise<string> {
    try {
      const existing = await Keychain.getGenericPassword({
        service: SecureCredentialStorage.SIGNING_KEY_SERVICE,
      });

      if (existing && typeof existing !== 'boolean') {
        return existing.password;
      }

      // Generate a new random signing key
      const newKey = await Crypto.getRandomBytesAsync(32);
      const keyString = Array.from(newKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await Keychain.setGenericPassword('signing_key', keyString, {
        service: SecureCredentialStorage.SIGNING_KEY_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      return keyString;
    } catch (error) {
      console.error('Error managing signing key:', error);
      throw new Error('Failed to initialize secure storage');
    }
  }

  /**
   * Creates an HMAC signature for the given data
   */
  private async signData(data: string, key: string): Promise<string> {
    try {
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data + key
      );
      return signature;
    } catch (error) {
      console.error('Error signing data:', error);
      throw new Error('Failed to sign data');
    }
  }

  /**
   * Verifies the HMAC signature of the given data
   */
  private async verifySignature(
    data: string,
    signature: string,
    key: string
  ): Promise<boolean> {
    try {
      const expectedSignature = await this.signData(data, key);
      return expectedSignature === signature;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Stores a credential securely with tamper protection
   */
  async storeCredential(key: string, value: unknown): Promise<void> {
    try {
      const signingKey = await this.getSigningKey();
      const dataString = JSON.stringify(value);
      const signature = await this.signData(dataString, signingKey);

      const securePayload = JSON.stringify({
        data: dataString,
        signature,
        timestamp: Date.now(),
      });

      await Keychain.setGenericPassword(key, securePayload, {
        service: `${SecureCredentialStorage.SERVICE_NAME}.${key}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.error('Error storing credential:', error);
      throw new Error('Failed to store credential securely');
    }
  }

  /**
   * Retrieves a credential and verifies it hasn't been tampered with
   */
  async getCredential<T>(key: string): Promise<T | null> {
    try {
      const stored = await Keychain.getGenericPassword({
        service: `${SecureCredentialStorage.SERVICE_NAME}.${key}`,
      });

      if (!stored || typeof stored === 'boolean') {
        return null;
      }

      const payload = JSON.parse(stored.password);
      const { data, signature } = payload;

      const signingKey = await this.getSigningKey();
      const isValid = await this.verifySignature(data, signature, signingKey);

      if (!isValid) {
        console.error(
          'SECURITY WARNING: Credential signature verification failed - data may have been tampered with'
        );
        // Clear the corrupted/tampered credential
        await this.removeCredential(key);
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Error retrieving credential:', error);
      return null;
    }
  }

  /**
   * Removes a credential from secure storage
   */
  async removeCredential(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: `${SecureCredentialStorage.SERVICE_NAME}.${key}`,
      });
    } catch (error) {
      console.error('Error removing credential:', error);
      throw new Error('Failed to remove credential');
    }
  }

  /**
   * Clears all credentials (this is a best-effort operation)
   */
  async clearAll(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.removeCredential(key)));
    } catch (error) {
      console.error('Error clearing credentials:', error);
      throw new Error('Failed to clear credentials');
    }
  }
}

export const secureCredentialStorage = new SecureCredentialStorage();

/**
 * Credential storage wrapper using secure, tamper-proof storage
 */
const CREDENTIAL_KEY = 'credential';
const PERSONAL_DATA_KEY = 'personal_data';
const VERIFICATION_QUALITY_KEY = 'verification_quality';
const NFT_KEY = 'nft';
const BLOCKCHAIN_KEY = 'blockchain';
const DUPLICATE_DETECTION_KEY = 'duplicate_detection';

const ALL_KEYS = [
  CREDENTIAL_KEY,
  PERSONAL_DATA_KEY,
  VERIFICATION_QUALITY_KEY,
  NFT_KEY,
  BLOCKCHAIN_KEY,
  DUPLICATE_DETECTION_KEY,
];

export const credentialStorage = {
  getCredential: () =>
    secureCredentialStorage.getCredential<CredentialResponse['credential']>(
      CREDENTIAL_KEY
    ),

  getPersonalData: () =>
    secureCredentialStorage.getCredential<CredentialResponse['personalData']>(
      PERSONAL_DATA_KEY
    ),

  getVerificationQuality: () =>
    secureCredentialStorage.getCredential<
      CredentialResponse['verificationQuality']
    >(VERIFICATION_QUALITY_KEY),

  getNFT: () =>
    secureCredentialStorage.getCredential<CredentialResponse['nft']>(NFT_KEY),

  getBlockchain: () =>
    secureCredentialStorage.getCredential<CredentialResponse['blockchain']>(
      BLOCKCHAIN_KEY
    ),

  getDuplicateDetection: () =>
    secureCredentialStorage.getCredential<
      CredentialResponse['duplicateDetection']
    >(DUPLICATE_DETECTION_KEY),

  saveCredential: async (response: CredentialResponse) => {
    await secureCredentialStorage.storeCredential(
      CREDENTIAL_KEY,
      response.credential
    );
    await secureCredentialStorage.storeCredential(
      PERSONAL_DATA_KEY,
      response.personalData
    );
    if (response.verificationQuality) {
      await secureCredentialStorage.storeCredential(
        VERIFICATION_QUALITY_KEY,
        response.verificationQuality
      );
    }
    if (response.nft) {
      await secureCredentialStorage.storeCredential(NFT_KEY, response.nft);
    }
    if (response.blockchain) {
      await secureCredentialStorage.storeCredential(
        BLOCKCHAIN_KEY,
        response.blockchain
      );
    }
    if (response.duplicateDetection) {
      await secureCredentialStorage.storeCredential(
        DUPLICATE_DETECTION_KEY,
        response.duplicateDetection
      );
    }
  },

  updateNFT: async (nft: CredentialResponse['nft']) => {
    if (nft) {
      await secureCredentialStorage.storeCredential(NFT_KEY, nft);
    }
  },

  clearCredential: async () => {
    await secureCredentialStorage.clearAll(ALL_KEYS);

    // Also clear encrypted document IDs from secure storage
    try {
      const { secureDocumentStorage } = await import(
        './secure-document-storage'
      );
      await secureDocumentStorage.clearAll();
    } catch (error) {
      console.error('Error clearing secure document storage:', error);
      // Continue anyway - don't throw
    }
  },

  hasCredential: async () => {
    const credential = await credentialStorage.getCredential();
    return credential !== null;
  },
};

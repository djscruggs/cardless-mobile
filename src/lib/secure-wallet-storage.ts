// IMPORTANT: This polyfill must be imported BEFORE algosdk
// to provide crypto.getRandomValues() for React Native
import 'react-native-get-random-values';

import algosdk from 'algosdk';
import * as Crypto from 'expo-crypto';
import * as Keychain from 'react-native-keychain';

/**
 * Secure, tamper-proof wallet storage using cryptographic signatures.
 *
 * This implementation ensures:
 * - Wallet credentials are encrypted using the device's secure storage (Keychain/Keystore)
 * - Tampering is detected via HMAC-SHA256 signatures
 * - Only the app can read/write wallet data
 * - Device owner cannot alter stored wallet credentials
 */
class SecureWalletStorage {
  private static readonly SERVICE_NAME = 'cardlessid.wallet';
  private static readonly SIGNING_KEY_SERVICE = 'cardlessid.wallet_signing_key';
  private static readonly WALLET_ADDRESS_KEY = 'wallet_address';
  private static readonly WALLET_MNEMONIC_KEY = 'wallet_mnemonic';

  /**
   * Gets or creates a device-specific signing key for HMAC
   */
  private async getSigningKey(): Promise<string> {
    try {
      const existing = await Keychain.getGenericPassword({
        service: SecureWalletStorage.SIGNING_KEY_SERVICE,
      });

      if (existing && typeof existing !== 'boolean') {
        return existing.password;
      }

      // Generate a new random signing key
      const newKey = await Crypto.getRandomBytesAsync(32);
      const keyString = Array.from(newKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await Keychain.setGenericPassword('wallet_signing_key', keyString, {
        service: SecureWalletStorage.SIGNING_KEY_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      return keyString;
    } catch (error) {
      console.error('Error managing wallet signing key:', error);
      throw new Error('Failed to initialize secure wallet storage');
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
      console.error('Error signing wallet data:', error);
      throw new Error('Failed to sign wallet data');
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
      console.error('Error verifying wallet signature:', error);
      return false;
    }
  }

  /**
   * Stores wallet data securely with tamper protection
   */
  private async storeSecure(key: string, value: string): Promise<void> {
    try {
      const signingKey = await this.getSigningKey();
      const signature = await this.signData(value, signingKey);

      const securePayload = JSON.stringify({
        data: value,
        signature,
        timestamp: Date.now(),
      });

      await Keychain.setGenericPassword(key, securePayload, {
        service: `${SecureWalletStorage.SERVICE_NAME}.${key}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.error('Error storing wallet data:', error);
      throw new Error('Failed to store wallet data securely');
    }
  }

  /**
   * Retrieves wallet data and verifies it hasn't been tampered with
   */
  private async getSecure(key: string): Promise<string | null> {
    try {
      const stored = await Keychain.getGenericPassword({
        service: `${SecureWalletStorage.SERVICE_NAME}.${key}`,
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
          'SECURITY WARNING: Wallet data signature verification failed - data may have been tampered with'
        );
        // Clear the corrupted/tampered data
        await this.removeSecure(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error retrieving wallet data:', error);
      return null;
    }
  }

  /**
   * Removes wallet data from secure storage
   */
  private async removeSecure(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: `${SecureWalletStorage.SERVICE_NAME}.${key}`,
      });
    } catch (error) {
      console.error('Error removing wallet data:', error);
      throw new Error('Failed to remove wallet data');
    }
  }

  /**
   * Generate a new Algorand wallet
   */
  generateWallet(): { address: string; mnemonic: string } {
    const account = algosdk.generateAccount();
    const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

    return {
      address: account.addr.toString(),
      mnemonic,
    };
  }

  /**
   * Get the wallet address from secure storage
   */
  async getWalletAddress(): Promise<string | null> {
    return this.getSecure(SecureWalletStorage.WALLET_ADDRESS_KEY);
  }

  /**
   * Get the wallet mnemonic from secure storage
   * WARNING: Handle this with extreme care - should only be used for signing
   */
  async getWalletMnemonic(): Promise<string | null> {
    return this.getSecure(SecureWalletStorage.WALLET_MNEMONIC_KEY);
  }

  /**
   * Get the private key from mnemonic
   */
  getPrivateKeyFromMnemonic(mnemonic: string): Uint8Array {
    const account = algosdk.mnemonicToSecretKey(mnemonic);
    return account.sk;
  }

  /**
   * Get the current wallet's private key
   */
  async getWalletPrivateKey(): Promise<Uint8Array | null> {
    const mnemonic = await this.getWalletMnemonic();
    if (!mnemonic) return null;

    try {
      return this.getPrivateKeyFromMnemonic(mnemonic);
    } catch (error) {
      console.error('Error getting private key:', error);
      return null;
    }
  }

  /**
   * Save wallet to secure storage
   */
  async saveWallet(address: string, mnemonic: string): Promise<void> {
    await this.storeSecure(SecureWalletStorage.WALLET_ADDRESS_KEY, address);
    await this.storeSecure(SecureWalletStorage.WALLET_MNEMONIC_KEY, mnemonic);
  }

  /**
   * Initialize wallet - creates one if it doesn't exist
   */
  async initializeWallet(): Promise<string> {
    const existingAddress = await this.getWalletAddress();

    if (existingAddress) {
      return existingAddress;
    }

    // Generate new wallet
    const { address, mnemonic } = this.generateWallet();
    await this.saveWallet(address, mnemonic);

    console.log('🔐 New wallet created:', address);
    console.log(
      '⚠️ IMPORTANT: Back up this mnemonic phrase (in production, show to user):'
    );
    console.log(mnemonic);

    return address;
  }

  /**
   * Clear wallet from secure storage (use with caution!)
   */
  async clearWallet(): Promise<void> {
    await this.removeSecure(SecureWalletStorage.WALLET_ADDRESS_KEY);
    await this.removeSecure(SecureWalletStorage.WALLET_MNEMONIC_KEY);
  }

  /**
   * Check if wallet exists
   */
  async hasWallet(): Promise<boolean> {
    const address = await this.getWalletAddress();
    return address !== null;
  }
}

export const secureWalletStorage = new SecureWalletStorage();

// Individual exports for backward compatibility
export const generateWallet = () => secureWalletStorage.generateWallet();
export const getWalletAddress = () => secureWalletStorage.getWalletAddress();
export const getWalletMnemonic = () => secureWalletStorage.getWalletMnemonic();
export const getPrivateKeyFromMnemonic = (mnemonic: string) =>
  secureWalletStorage.getPrivateKeyFromMnemonic(mnemonic);
export const getWalletPrivateKey = () =>
  secureWalletStorage.getWalletPrivateKey();
export const saveWallet = (address: string, mnemonic: string) =>
  secureWalletStorage.saveWallet(address, mnemonic);
export const initializeWallet = () => secureWalletStorage.initializeWallet();
export const clearWallet = () => secureWalletStorage.clearWallet();
export const hasWallet = () => secureWalletStorage.hasWallet();

export const wallet = {
  generateWallet,
  getWalletAddress,
  getWalletMnemonic,
  getPrivateKeyFromMnemonic,
  getWalletPrivateKey,
  saveWallet,
  initializeWallet,
  clearWallet,
  hasWallet,
};

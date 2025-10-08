import * as Keychain from 'react-native-keychain';

/**
 * Secure storage for sensitive document IDs using iOS Keychain / Android Keystore
 */
class SecureDocumentStorage {
  private static readonly SERVICE_PREFIX = 'cardlessid.document';

  /**
   * Store a document ID securely in the device's secure storage
   */
  async storeDocumentId(
    documentType: 'governmentId' | 'passport',
    value: string
  ): Promise<void> {
    try {
      await Keychain.setGenericPassword(documentType, value, {
        service: `${SecureDocumentStorage.SERVICE_PREFIX}.${documentType}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.error('Error storing document ID:', error);
      throw new Error('Failed to store document ID securely');
    }
  }

  /**
   * Retrieve a document ID from secure storage
   */
  async getDocumentId(
    documentType: 'governmentId' | 'passport'
  ): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${SecureDocumentStorage.SERVICE_PREFIX}.${documentType}`,
      });

      if (credentials && typeof credentials !== 'boolean') {
        return credentials.password;
      }

      return null;
    } catch (error) {
      console.error('Error retrieving document ID:', error);
      return null;
    }
  }

  /**
   * Remove a document ID from secure storage
   */
  async removeDocumentId(
    documentType: 'governmentId' | 'passport'
  ): Promise<void> {
    try {
      await Keychain.resetGenericPassword({
        service: `${SecureDocumentStorage.SERVICE_PREFIX}.${documentType}`,
      });
    } catch (error) {
      console.error('Error removing document ID:', error);
      throw new Error('Failed to remove document ID');
    }
  }

  /**
   * Clear all stored document IDs
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        this.removeDocumentId('governmentId'),
        this.removeDocumentId('passport'),
      ]);
    } catch (error) {
      console.error('Error clearing document IDs:', error);
      throw new Error('Failed to clear document IDs');
    }
  }
}

export const secureDocumentStorage = new SecureDocumentStorage();

# Secure Credential Storage

## Overview

Credentials stored locally on the device are protected against tampering and unauthorized modification. The implementation ensures that credentials are:

1. **Encrypted** - Stored using the device's secure storage (iOS Keychain / Android Keystore)
2. **Tamper-proof** - Cryptographically signed to detect any modifications
3. **App-only access** - Cannot be read or modified by other apps or the device owner

## Implementation

### Architecture

The secure credential storage system uses a multi-layered approach:

```
┌─────────────────────────────────────┐
│   Application Layer                 │
│   (credentialStorage API)           │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Security Layer                    │
│   - HMAC-SHA256 signing             │
│   - Signature verification          │
│   - Device-specific signing key     │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Platform Layer                    │
│   iOS Keychain / Android Keystore  │
│   - Hardware-backed encryption      │
│   - OS-level access control         │
└─────────────────────────────────────┘
```

### Security Mechanisms

#### 1. Encryption at Rest

All credential data is stored in the device's secure storage:

- **iOS**: Uses Keychain Services with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility
- **Android**: Uses Android Keystore System with hardware-backed encryption when available

This ensures:

- Data is encrypted at rest
- Data is only accessible when device is unlocked
- Data never leaves the device during backup/restore
- Other apps cannot access the data

#### 2. Cryptographic Signing

Each credential is signed using HMAC-SHA256:

```typescript
signature = HMAC - SHA256(credentialData + deviceSigningKey);
```

The signing key:

- Is generated once per app installation
- Is stored securely in the device's keychain
- Is unique per device
- Never leaves the device

#### 3. Integrity Verification

When retrieving credentials:

1. The stored signature is compared with a freshly computed signature
2. If signatures don't match, the credential is considered compromised
3. Tampered credentials are automatically deleted
4. The app is notified that no valid credential exists

### Storage Format

Credentials are stored with the following structure:

```typescript
{
  data: string,          // JSON-encoded credential data
  signature: string,     // HMAC-SHA256 signature
  timestamp: number      // When the credential was stored
}
```

## API Usage

### Storing Credentials

```typescript
import { credentialStorage } from '@/lib';

// Save a complete credential response
await credentialStorage.saveCredential(credentialResponse);

// Update specific fields (e.g., NFT data)
await credentialStorage.updateNFT(nftData);
```

### Retrieving Credentials

```typescript
// Get individual components
const credential = await credentialStorage.getCredential();
const personalData = await credentialStorage.getPersonalData();
const nft = await credentialStorage.getNFT();

// Check if credential exists
const hasCredential = await credentialStorage.hasCredential();
```

### Clearing Credentials

```typescript
// Clear all stored credentials
await credentialStorage.clearCredential();
```

## Security Properties

### What's Protected

✅ **Tampering Detection**: Any modification to stored credentials is detected
✅ **Encryption**: Credentials are encrypted using hardware-backed keys when available
✅ **Isolation**: Other apps cannot access the credentials
✅ **No Backups**: Credentials are not included in device backups

### What's Not Protected

❌ **Physical Access**: If someone has root/jailbreak access, they may bypass these protections
❌ **Malware**: If the device is compromised by malware running as the app, credentials may be accessible
❌ **Debugging**: When running in debug mode with a debugger attached, credentials may be visible

## Migration from Old Storage

The old MMKV-based storage has been completely replaced. On first launch after the update:

1. The new secure storage system initializes
2. A device-specific signing key is generated
3. Any new credentials are stored using the secure system

**Note**: Old credentials stored in MMKV are NOT automatically migrated for security reasons. Users will need to re-verify their identity to obtain a new credential stored with the secure system.

## Platform-Specific Details

### iOS

- Uses `Keychain Services` API
- Accessibility level: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- Stored items are tied to the app's keychain access group
- Survives app reinstalls only if using the same provisioning profile

### Android

- Uses `react-native-keychain` which wraps Android Keystore
- Encryption keys are stored in Android Keystore System
- Uses AES encryption with hardware-backed keys when available
- Survives app reinstalls only if backup/restore is configured

## Testing Tamper Detection

To verify the tamper detection works:

1. Store a credential normally
2. Use a debugger or tool to modify the stored data in the keychain
3. Try to retrieve the credential
4. The app should detect the tampering and clear the credential

## Performance Considerations

- **Write Operations**: ~10-50ms per credential field (includes encryption + signing)
- **Read Operations**: ~10-30ms per credential field (includes decryption + verification)
- All operations are asynchronous and non-blocking

## Dependencies

- `expo-crypto`: For HMAC-SHA256 signing and random key generation
- `react-native-keychain`: For secure storage (iOS Keychain / Android Keystore)

## Future Enhancements

Possible future improvements:

1. **Biometric Protection**: Require Face ID/Touch ID to access credentials
2. **Time-based Expiry**: Automatically invalidate credentials after a certain period
3. **Remote Invalidation**: Allow server-side revocation of credentials
4. **Multi-device Sync**: Securely sync credentials across user's devices
5. **Attestation**: Verify the app hasn't been tampered with before allowing credential access

## Security Audit

This implementation should be audited by a security professional before production deployment. Key areas to review:

- [ ] Cryptographic implementation
- [ ] Key management
- [ ] Platform-specific security configurations
- [ ] Error handling and information leakage
- [ ] Side-channel resistance

## References

- [iOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Android Keystore System](https://developer.android.com/training/articles/keystore)
- [HMAC-SHA256 Specification](https://tools.ietf.org/html/rfc2104)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)

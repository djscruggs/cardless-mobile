# Cardless ID — Mobile Integration (Single Page)

**Base URL:** `https://cardlessid.org`

---

## Overview

Two flows:

| Flow                    | API Key? | When                       |
| ----------------------- | -------- | -------------------------- |
| **Age Verification**    | No       | Every verification request |
| **Credential Issuance** | Yes      | Once per user (KYC)        |

---

## 1. Age Verification Flow

No API key needed. The wallet reads an on-chain credential, signs a proof, and submits it. No personal data is transmitted.

### Deep Link / QR Format

```
https://cardlessid.org/app/wallet-verify?nonce=<NONCE>&minAge=<MIN_AGE>
```

The `nonce` is HMAC-signed and expires in **5 minutes**. The wallet must submit before expiry.

### Sign the Proof

```typescript
import algosdk from 'algosdk';

interface SignedProofPayload {
  nonce: string;
  walletAddress: string;
  minAge: number;
  meetsRequirement: boolean;
  timestamp: number; // Date.now()
}

interface SignedProof {
  payload: SignedProofPayload;
  signature: string; // base64url ed25519 signature
}

function signProof(
  nonce: string,
  minAge: number,
  meetsRequirement: boolean,
  account: algosdk.Account
): SignedProof {
  const payload: SignedProofPayload = {
    nonce,
    walletAddress: algosdk.encodeAddress(account.addr.publicKey),
    minAge,
    meetsRequirement,
    timestamp: Date.now(),
  };
  const message = Buffer.from(JSON.stringify(payload));
  const sigBytes = algosdk.signBytes(message, account.sk);
  return { payload, signature: Buffer.from(sigBytes).toString('base64url') };
}
```

Before signing, check the credential NFT on Algorand (read-only, no gas). If no valid credential is found, do not sign — the user must complete KYC first.

### Submit the Proof

```
POST /api/v/submit
Content-Type: application/json

{ "nonce": "...", "signedProof": { "payload": {...}, "signature": "..." } }
```

Response: `{ "success": true }`

The proof is stored for 60 seconds (TTL cache). The verifier site polls `GET /api/v/result/:nonce` to retrieve it.

### React Native End-to-End Example

```typescript
async function handleVerificationDeepLink(url: string): Promise<void> {
  const params = new URL(url).searchParams;
  const nonce = params.get('nonce');
  const minAge = parseInt(params.get('minAge') ?? '18', 10);
  if (!nonce) throw new Error('Missing nonce in deep link');

  const account = await loadAccountFromSecureStorage();
  const meetsRequirement = await checkAgeRequirement(account.addr, minAge);
  const signedProof = signProof(nonce, minAge, meetsRequirement, account);
  await submitProof(nonce, signedProof);
  navigation.navigate('VerificationComplete', { meetsRequirement });
}
```

---

## 2. Credential Issuance Flow (API Key Required)

Only needed if you are building a **delegated issuer app** that performs KYC.

### Getting an API Key

1. Contact: https://cardlessid.org/contact
2. Provide: org name, contact email, use case, expected monthly volume, Algorand wallet address (optional)
3. You receive: API key, issuer Algorand address, testnet access

### Authentication

All issuance endpoints require the API key header:

```http
X-API-Key: your_api_key_here
```

The age verification endpoints (`/api/v/*`) do **not** require an API key.

### Testnet vs Mainnet

- **Testnet:** 1,000 requests/hour (generous for development)
- **Mainnet:** Varies by plan
- Use `provider: "mock"` for testnet/dev, `provider: "aws-rekognition"` for production

### Step 1 — Start Verification Session

```
POST /api/verification/start
X-API-Key: <key>

{ "provider": "mock" }
```

Response:

```json
{
  "sessionId": "session_12345",
  "authToken": "auth_token_for_provider_sdk",
  "expiresAt": "2025-01-15T10:30:00Z",
  "provider": "mock",
  "providerSessionId": "provider_session_id"
}
```

### Step 2 — Capture ID & Selfie

Use the verification provider SDK with the `authToken`. Exact implementation depends on the provider. Capture ID photo, selfie, and submit.

### Step 3 — Poll Verification Status

```
GET /api/verification/status/:sessionId
X-API-Key: <key>
```

Response (completed):

```json
{
  "status": "completed",
  "verificationToken": "signed_token_xyz",
  "extractedData": {
    "firstName": "John",
    "lastName": "Doe",
    "birthDate": "1990-01-15",
    "governmentId": "D1234567",
    "idType": "drivers_license",
    "state": "CA"
  }
}
```

Poll every 2 seconds until `status` is `"completed"` or `"failed"`.

### Step 4 — Request Credential

```
POST /api/credentials
X-API-Key: <key>
Content-Type: application/json

{
  "verificationToken": "signed_token_xyz",
  "walletAddress": "ALGORAND_WALLET_ADDRESS_58_CHARS",
  "firstName": "John", "lastName": "Doe", "birthDate": "1990-01-15",
  "governmentId": "D1234567", "idType": "drivers_license", "state": "CA"
}
```

Response:

```json
{
  "success": true,
  "credential": { "@context": [...], "type": ["VerifiableCredential", "BirthDateCredential"], ... },
  "personalData": { "firstName": "John", "lastName": "Doe", "birthDate": "1990-01-15" },
  "nft": { "assetId": "123456", "requiresOptIn": true }
}
```

### Step 5 — Store Credential Securely

**iOS (Keychain):**

```swift
let query: [String: Any] = [
  kSecClass as String: kSecClassGenericPassword,
  kSecAttrAccount as String: key,
  kSecValueData as String: credential,
  kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
]
SecItemDelete(query as CFDictionary)
SecItemAdd(query as CFDictionary, nil)
```

**Android (EncryptedSharedPreferences):**

```kotlin
val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
val prefs = EncryptedSharedPreferences.create(
  context, "cardless_credentials", masterKey,
  EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
  EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
prefs.edit().putString("credential_id", credentialJson).apply()
```

Never store credentials in plain text, unencrypted UserDefaults/SharedPreferences, or log credential contents or API keys.

---

## Anti-Spoofing: Two-Layer Verification

| Layer                            | What it checks                            | What it blocks                  |
| -------------------------------- | ----------------------------------------- | ------------------------------- |
| **Layer 1** — ed25519 signature  | Payload signed by claimed wallet key      | Tampered payloads, wrong key    |
| **Layer 2** — on-chain NFT check | Wallet holds a Cardless ID credential NFT | Fresh keypairs with no real KYC |

Integrators should use `verifyProofOnChain()` (not just `verifyProof()`) to enforce both layers:

```typescript
import { verifyProofOnChain } from '@cardlessid/verify';

const result = await verifyProofOnChain(proof);
if (result.valid && result.payload.meetsRequirement) {
  grantAccess();
}
```

---

## Security Requirements

- All API calls must use HTTPS
- Never log API keys in production builds
- Certificate pinning recommended
- Obtain explicit user consent before identity verification
- Allow users to delete their credentials

---

## Error Handling

| Code | Meaning                                                                               |
| ---- | ------------------------------------------------------------------------------------- |
| 200  | Success                                                                               |
| 400  | Invalid request (`invalid nonce`, `signature verification failed`, `minAge mismatch`) |
| 401  | Missing or invalid API key                                                            |
| 404  | Resource not found                                                                    |
| 429  | Rate limit exceeded                                                                   |
| 451  | Service unavailable in EEA region                                                     |
| 500  | Server error                                                                          |

**Age verification error codes:**

| Error                               | Cause                              | Recovery                            |
| ----------------------------------- | ---------------------------------- | ----------------------------------- |
| 400 `invalid nonce`                 | Nonce expired (>5 min) or tampered | Ask user to re-scan QR              |
| 400 `signature verification failed` | Wrong key or malformed signature   | Check signing implementation        |
| 400 `minAge mismatch`               | Proof minAge ≠ nonce minAge        | Ensure minAge comes from QR/nonce   |
| 451                                 | EEA geo-block                      | Show "not available in your region" |

---

## Issuer Revocation

- **Soft revocation:** API key revoked; existing credentials remain valid; reinstatable
- **Hard revocation:** API key + issuer address permanently removed; all credentials ever issued are invalidated

---

## Support

- Docs: https://cardlessid.org/docs
- Contact: https://cardlessid.org/contact

# CardlessID NFT Credential Client Implementation Guide

## Overview

CardlessID uses **non-transferable NFTs** (also called "soulbound tokens") on the Algorand blockchain to issue verifiable age credentials. This guide explains how client applications (mobile wallets) should interact with the CardlessID system.

### ⚠️ Important: NFT is Just an On-Chain Artifact

**The NFT is for verification purposes only. The client workflow barely changes.**

**What stays the same**:
- ✅ Client stores W3C Verifiable Credential + personal data locally (encrypted)
- ✅ Client performs age verification calculations locally
- ✅ Client only shares true/false responses (NEVER actual birth date)
- ✅ Privacy model is identical

**What changes**:
- 📦 Client receives `assetId` instead of `transactionId` (just a different number)
- 📦 Client must opt-in to the NFT (one extra transaction)
- 📦 Verifiers check asset ownership instead of searching transactions (backend change only)

**Bottom line**: The NFT is just a more efficient way to mark a wallet as verified. The actual credential data and privacy-preserving verification logic all happens client-side, exactly as before.

## Architecture

### Credential Storage
- **Blockchain**: Credentials are issued as Algorand Standard Assets (ASAs/NFTs)
- **Non-transferable**: Each NFT is frozen after issuance to prevent transfers
- **Minimal Disclosure**: NO age/birth information stored on-chain (privacy best practice)
- **Metadata**: Only credential ID and composite hash stored in NFT metadata
- **Revocable**: Issuer maintains clawback rights to revoke credentials if needed

### Why NFTs?
1. **Easy verification**: Simple asset ownership check via Algorand Indexer API
2. **Standard queries**: Use Algorand's native asset APIs
3. **Built-in uniqueness**: Each NFT has a unique asset ID
4. **Revocation**: Can revoke credentials by clawing back the NFT
5. **Cost-effective**: ~0.003-0.004 ALGO per credential

## API Endpoints

### Base URL
- **Testnet**: `https://your-domain.com/api`
- **Mainnet**: `https://your-domain.com/api`

---

## Credential Issuance Flow

### Step 1: Request Credential Issuance

After identity verification is complete, request a credential to be minted.

**Endpoint**: `POST /api/credentials`

**Request Body**:
```json
{
  "verificationSessionId": "session_xxx",
  "walletAddress": "AAAAA...ZZZZZ"
}
```

**Response**:
```json
{
  "success": true,
  "credential": {
    "@context": [...],
    "id": "urn:uuid:xxx",
    "type": ["VerifiableCredential", "BirthDateCredential"],
    "issuer": {
      "id": "did:algorand:ISSUER_ADDRESS"
    },
    "credentialSubject": {
      "id": "did:algorand:USER_ADDRESS",
      "cardlessid:compositeHash": "hash..."
    },
    "proof": {...}
  },
  "personalData": {
    "firstName": "John",
    "lastName": "Doe",
    "birthDate": "1990-01-01",
    ...
  },
  "nft": {
    "assetId": 123456789,
    "requiresOptIn": true,
    "instructions": {
      "step1": "Client must opt-in to the asset",
      "step2": "Call POST /api/credentials/transfer with assetId and walletAddress",
      "step3": "Asset will be transferred and frozen (non-transferable)"
    }
  },
  "blockchain": {
    "transaction": {
      "id": "TX_ID",
      "explorerUrl": "https://testnet.explorer.perawallet.app/tx/TX_ID"
    },
    "network": "testnet"
  }
}
```

**Important**: Store both the `credential` (with proof) and `personalData` locally in the wallet. The blockchain only stores the NFT with minimal metadata (credential ID, composite hash). NO age or birth information is stored on-chain for privacy.

---

### Step 2: Opt-in to the NFT Asset

Before the NFT can be transferred to your wallet, you must opt-in to the asset.

**Client Action**: Submit an asset transfer transaction of 0 units to yourself.

**Using algosdk**:
```typescript
import algosdk from 'algosdk';

const algodClient = new algosdk.Algodv2(
  '',
  'https://testnet-api.algonode.cloud',
  443
);

async function optInToAsset(
  walletAddress: string,
  privateKey: Uint8Array,
  assetId: number
): Promise<string> {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: walletAddress,
    to: walletAddress,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(privateKey);
  const response = await algodClient.sendRawTransaction(signedTxn).do();

  // Wait for confirmation
  await algosdk.waitForConfirmation(algodClient, response.txid, 4);

  return response.txid;
}
```

**Cost**: 0.001 ALGO transaction fee + 0.1 ALGO minimum balance increase (locked while you hold the asset)

---

### Step 3: Request NFT Transfer

After opting in, call the transfer endpoint to receive the NFT.

**Endpoint**: `POST /api/credentials/transfer`

**Request Body**:
```json
{
  "assetId": 123456789,
  "walletAddress": "AAAAA...ZZZZZ"
}
```

**Response**:
```json
{
  "success": true,
  "assetId": 123456789,
  "walletAddress": "AAAAA...ZZZZZ",
  "transactions": {
    "transfer": {
      "id": "TRANSFER_TX_ID",
      "explorerUrl": "https://testnet.explorer.perawallet.app/tx/TRANSFER_TX_ID"
    },
    "freeze": {
      "id": "FREEZE_TX_ID",
      "explorerUrl": "https://testnet.explorer.perawallet.app/tx/FREEZE_TX_ID"
    }
  },
  "message": "Credential NFT transferred and frozen (non-transferable)"
}
```

After this step:
- The NFT is in your wallet
- The NFT is **frozen** (cannot be transferred)
- You now hold a verifiable credential

---

## Verification Flow

### Checking Wallet Verification Status

Any party can check if a wallet has valid credentials.

**Endpoint**: `GET /api/wallet/status/{walletAddress}`

**Response**:
```json
{
  "verified": true,
  "credentialCount": 1,
  "issuedAt": "2025-10-03T12:34:56.789Z",
  "credentials": [
    {
      "assetId": 123456789,
      "frozen": true,
      "issuedAt": "2025-10-03T12:34:56.789Z",
      "credentialId": "urn:uuid:xxx"
    }
  ],
  "latestCredential": {
    "assetId": 123456789,
    "frozen": true,
    "credentialId": "urn:uuid:xxx",
    "compositeHash": "abc123..."
  },
  "network": "testnet"
}
```

### Client-Side Verification

For **privacy-preserving age verification** (e.g., "Are you 21+?"), the client should:

1. **Read the credential locally** (stored with personalData)
2. **Calculate if user meets age requirement** (using stored birthDate)
3. **Return only true/false** (never expose actual birth date)
4. **Optionally provide cryptographic proof** using the stored credential proof

**Example Flow**:
```typescript
interface StoredCredential {
  credential: any; // W3C VC with proof
  personalData: {
    birthDate: string;
    firstName: string;
    lastName: string;
  };
  nft: {
    assetId: number;
  };
}

function checkAgeRequirement(
  storedCredential: StoredCredential,
  minimumAge: number
): boolean {
  const birthDate = new Date(storedCredential.personalData.birthDate);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)
    ? age - 1
    : age;

  return actualAge >= minimumAge;
}

// Usage
const meetsRequirement = checkAgeRequirement(storedCredential, 21);
// Return to verifier: { meetsRequirement: true, walletAddress: "..." }
```

---

## Local Storage Schema

Wallet apps should store credentials securely with this structure:

```typescript
interface WalletCredentialStorage {
  credentials: Array<{
    // W3C Verifiable Credential (for cryptographic proof)
    credential: {
      "@context": string[];
      id: string;
      type: string[];
      issuer: { id: string };
      issuanceDate: string;
      credentialSubject: {
        id: string;
        "cardlessid:compositeHash": string;
      };
      proof: {
        type: string;
        created: string;
        verificationMethod: string;
        proofPurpose: string;
        proofValue: string;
      };
    };

    // Personal data (NEVER share this publicly)
    personalData: {
      firstName: string;
      middleName?: string;
      lastName: string;
      birthDate: string; // ISO 8601 format
      governmentId: string;
      idType: string;
      state: string;
    };

    // NFT information
    nft: {
      assetId: number;
      network: "testnet" | "mainnet";
      frozen: boolean;
      issuedAt: string;
    };
  }>;
}
```

**Security Notes**:
- Encrypt personal data at rest
- Never transmit birth date or full personal data
- Only share: wallet address + true/false age verification result
- Optionally share cryptographic proof for zero-knowledge verification

---

## Querying NFT Details Directly

Clients can also query NFT details directly from Algorand.

### Using Algorand Indexer API

```typescript
import algosdk from 'algosdk';

const indexerClient = new algosdk.Indexer(
  '',
  'https://testnet-idx.algonode.cloud',
  443
);

async function getWalletCredentials(
  walletAddress: string,
  issuerAddress: string
): Promise<Array<{ assetId: number; frozen: boolean }>> {
  const accountInfo = await indexerClient
    .lookupAccountByID(walletAddress)
    .do();

  const credentials = [];

  for (const asset of accountInfo.account.assets || []) {
    if (asset.amount > 0) {
      // Get asset details
      const assetInfo = await indexerClient
        .lookupAssetByID(asset['asset-id'])
        .do();

      // Check if created by our issuer
      if (assetInfo.asset.params.creator === issuerAddress) {
        credentials.push({
          assetId: asset['asset-id'],
          frozen: asset['is-frozen'] || false,
        });
      }
    }
  }

  return credentials;
}
```

---

## Age Verification Protocol

### QR Code Flow

When a verifier (e.g., age-restricted website) needs to verify age:

1. **Verifier creates QR code** with verification request:
   ```json
   {
     "type": "age-verification",
     "minimumAge": 21,
     "sessionId": "session_xxx",
     "callbackUrl": "https://verifier.com/api/verify-response"
   }
   ```

2. **User scans QR code** with CardlessID wallet app

3. **Wallet checks credentials locally**:
   - Read stored birth date
   - Calculate if user meets minimum age
   - Generate response (true/false only)

4. **Wallet submits response** to callback URL:
   ```json
   {
     "sessionId": "session_xxx",
     "meetsRequirement": true,
     "walletAddress": "AAAAA...ZZZZZ",
     "proof": {
       "credentialId": "urn:uuid:xxx",
       "assetId": 123456789,
       "signature": "..."
     }
   }
   ```

5. **Verifier confirms on blockchain**:
   - Check that wallet owns the NFT asset
   - Verify asset was issued by trusted CardlessID issuer
   - Grant access based on result

---

## Costs Summary

| Action | Cost | Locked Balance | Notes |
|--------|------|----------------|-------|
| NFT Creation | 0.001 ALGO | 0.1 ALGO | Paid by issuer |
| Opt-in | 0.001 ALGO | 0.1 ALGO | Paid by recipient |
| Transfer | 0.001 ALGO | - | Paid by issuer |
| Freeze | 0.001 ALGO | - | Paid by issuer |
| **Total (User)** | **0.001 ALGO** | **0.1 ALGO** | ~$0.03-0.04 USD |

The 0.1 ALGO locked balance is returned if the user opts out of the asset (but this revokes the credential).

---

## Credential Revocation

If a credential needs to be revoked (e.g., identity fraud detected):

**Action**: Issuer uses clawback to reclaim the NFT

```typescript
async function revokeCredential(
  issuerAddress: string,
  issuerPrivateKey: Uint8Array,
  holderAddress: string,
  assetId: number
): Promise<string> {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: issuerAddress,
    to: issuerAddress, // Send back to issuer
    amount: 1,
    assetIndex: assetId,
    revocationTarget: holderAddress, // Claw back from this address
    suggestedParams,
  });

  const signedTxn = txn.signTxn(issuerPrivateKey);
  const response = await algodClient.sendRawTransaction(signedTxn).do();

  await algosdk.waitForConfirmation(algodClient, response.txid, 4);

  return response.txid;
}
```

After revocation:
- User no longer owns the NFT
- Verification checks will fail
- User's locally stored data remains but is invalid

---

## Testing

### Testnet Setup

1. **Get testnet ALGO**: https://bank.testnet.algorand.network/
2. **Set environment variable**: `VITE_ALGORAND_NETWORK=testnet`
3. **View transactions**: https://testnet.explorer.perawallet.app/

### Sample Testnet Credentials

For testing, you can check these example credentials:
- **Issuer Address**: Check `VITE_APP_WALLET_ADDRESS` in your environment
- **Test Wallet**: Create a wallet and fund with testnet ALGO
- **Asset ID**: Retrieved from credential issuance response

---

## Security Best Practices

### For Wallet Apps
1. **Encrypt credentials** at rest using device keychain/keystore
2. **Never expose birth date** - only return true/false age checks
3. **Verify issuer** before trusting credentials
4. **Validate NFT ownership** on-chain before relying on local data
5. **Implement PIN/biometric** protection for credential access

### For Verifiers
1. **Always check blockchain** - don't trust client claims without verification
2. **Verify issuer address** matches trusted CardlessID issuer
3. **Check NFT is frozen** to ensure it's non-transferable
4. **Rate limit verification** requests to prevent abuse
5. **Don't store personal data** - only store wallet address and verification result

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Asset not opted in" | User hasn't opted in to NFT | Complete Step 2 (opt-in) |
| "Account does not exist" | Wallet has 0 ALGO | Fund wallet with minimum 0.1 ALGO |
| "Asset frozen" | Trying to transfer frozen NFT | This is expected - NFTs are non-transferable |
| "Invalid address format" | Malformed Algorand address | Validate address format (58 chars, base32) |
| "Insufficient balance" | Not enough ALGO for fees | Ensure wallet has at least 0.2 ALGO |

---

## Support

For questions or issues:
- **Documentation**: https://github.com/your-org/cardlessid
- **Issues**: https://github.com/your-org/cardlessid/issues
- **API Status**: Check `/api/hello` endpoint

---

## Appendix: Full Example Implementation

See [`/examples/mobile-wallet`](./examples/mobile-wallet) for a complete React Native implementation example.

---

**Last Updated**: October 2025
**Version**: 2.0 (NFT-based)

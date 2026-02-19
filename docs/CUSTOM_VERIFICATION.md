---
{}
---

# Custom Verification Platform

This document describes the custom identity verification platform that uses a hybrid approach: **Google Document AI** for fraud detection, **AWS Textract** for ID text extraction, and **AWS Rekognition** for face comparison and liveness detection.

## Overview

The custom verification platform provides a complete end-to-end identity verification flow:

1.  **ID Photo Capture**: User photographs front (and optionally back) of their government-issued ID
2.  **Fraud Detection**: Google Document AI checks both sides for fake/tampered documents (fast fail-early check, 2 API calls)
3.  **Text Extraction**: AWS Textract extracts identity information from both sides in a single call (only if fraud check passes)
4.  **Data Confirmation**: User reviews and confirms extracted data (read-only)
5.  **Selfie Capture**: User takes a selfie with face centering guide
6.  **Liveness Detection**: AWS Rekognition analyzes face quality to ensure live person
7.  **Face Comparison**: AWS Rekognition compares ID photo with selfie
8.  **Credential Issuance**: If verified, user receives their NFT credential

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ├──1. Upload ID Photo
       │
┌──────▼──────────────────┐
│  /api/custom-           │
│  verification/upload-id │
└──────┬──────────────────┘
       │
       ├──2. Check for fraud (fast)
       │
┌──────▼─────────────────────┐
│  Google Document AI        │
│  (Fraud Detection)         │
└──────┬─────────────────────┘
       │
       ├──✓ Pass → 3. Extract data
       │  ✗ Fail → Block (400)
       │
┌──────▼─────────────────┐
│  AWS Textract          │
│  (AnalyzeID)           │
└──────┬─────────────────┘
       │
       ├──4. Return extracted data
       │
┌──────▼──────┐
│   Client    │
│  (Review)   │
└──────┬──────┘
       │
       ├──5. Upload Selfie
       │
┌──────▼──────────────────────┐
│  /api/verification/  │
│  upload-selfie               │
└──────┬──────────────────────┘
       │
       ├──6a. Check Liveness
       │
┌──────▼────────────────┐
│  AWS Rekognition      │
│  (DetectFaces)        │
└──────┬────────────────┘
       │
       ├──6b. Compare Faces
       │
┌──────▼────────────────┐
│  AWS Rekognition      │
│  (CompareFaces)       │
└──────┬────────────────┘
       │
       ├──7. Return match result
       │
┌──────▼──────────┐
│  Credential     │
│  Issuance       │
└─────────────────┘
```

## Setup

**📚 For detailed AWS setup instructions, see [AWS_SETUP.md](./AWS_SETUP.md)**

This section provides a quick overview. Refer to the dedicated AWS setup guide for complete instructions, IAM configuration, and troubleshooting.

### 1\. Google Document AI Configuration (Fraud Detection)

#### Required Service

- **Google Document AI** - ID fraud detection processor

#### Setup Steps

1. Create a Google Cloud project
2. Enable Document AI API
3. Create two processors:
   - **ID Fraud Detector** processor (for fraud signals)
   - **ID Proofing** processor (optional, for full Google-based extraction)
4. Get processor endpoints (format: `projects/PROJECT/locations/LOCATION/processors/PROCESSOR_ID`)
5. Create service account and download JSON credentials
6. Set environment variables:
   ```bash
   ID_FRAUD_ENDPOINT=projects/.../processors/FRAUD_PROCESSOR_ID
   GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'
   # OR
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   ```

> **Note**: If Google Document AI is not configured, fraud detection is skipped and the system uses AWS Textract only. For production, fraud detection is strongly recommended.

### 2\. AWS Services Configuration

#### Required Services

- **AWS Textract** - ID text extraction
- **AWS Rekognition** - Face comparison and liveness detection

#### Quick Start

1. Create an AWS account
2. Create IAM user with these permissions:
   - `textract:AnalyzeID`
   - `rekognition:CompareFaces`
   - `rekognition:DetectFaces`
3. Get access key and secret key
4. Install SDKs (already included in this project):
   - `@aws-sdk/client-textract`
   - `@aws-sdk/client-rekognition`
   - `@google-cloud/documentai`

#### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REKOGNITION_THRESHOLD=85
AWS_TEXTRACT_CONFIDENCE_THRESHOLD=80

# Enable AWS services
FACE_COMPARISON_PROVIDER=aws-rekognition
```

**For development/testing only:**

```bash
# Use mock services (no AWS account needed)
FACE_COMPARISON_PROVIDER=mock
```

### 2\. Photo Storage Configuration

```bash
PHOTO_STORAGE_DIR=./storage/photos
```

Create the storage directory:

```bash
mkdir -p storage/photos
```

**Important**: Add `storage/` to `.gitignore` to prevent committing user photos.

## API Endpoints

### Upload ID Photos

**POST** `/api/verification/upload-id`

Uploads and processes ID photos (front required, back recommended) with fraud detection (Google Document AI) and text extraction (AWS Textract).

**Processing Flow**:

1. Check for fraud with Google Document AI (if configured)
   - If both sides provided: checks both front and back (2 API calls)
   - Combines fraud signals from both sides
2. If fraud detected → return 400 error immediately
3. If passed → extract data with AWS Textract (never Google for parsing)
   - If both sides provided: processes both in a single API call
   - Merges data from both sides (front takes priority, back supplements)

**Request Body** (FormData):

```
image: string (required - base64 data URL for front of ID)
backImage: string (recommended - base64 data URL for back of ID)
mimeType: string (optional - defaults to 'image/jpeg')
```

**Success Response (200)**:

```json
{
  "success": true,
  "sessionId": "custom_1234567890",
  "extractedData": {
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "birthDate": "1990-01-15",
    "governmentId": "D1234567",
    "idType": "drivers_license",
    "state": "CA",
    "expirationDate": "2028-01-15"
  },
  "lowConfidenceFields": [],
  "isExpired": false,
  "warnings": null,
  "bothSidesProcessed": true,
  "fraudCheck": {
    "passed": true,
    "signals": [
      { "type": "fraud_signals_is_identity_document", "result": "PASS" },
      { "type": "fraud_signals_suspicious_words", "result": "PASS" },
      { "type": "fraud_signals_image_manipulation", "result": "PASS" }
    ]
  }
}
```

**Fraud Detected Response (400)**:

```json
{
  "success": false,
  "error": "Document verification failed - potential fraud detected",
  "fraudDetected": true,
  "fraudSignals": [
    { "type": "fraud_signals_suspicious_words", "result": "SUSPICIOUS" },
    { "type": "fraud_signals_image_manipulation", "result": "SUSPICIOUS" }
  ]
}
```

**Notes**:

- **Both sides supported**: Pass `backImage` to process front and back of ID in a single request
- Google fraud detection runs first to fail fast on fake IDs (saves AWS costs)
- If Google Document AI is not configured, fraud detection is skipped
- **Fraud detection only**: Google checks both sides for fraud (2 calls), AWS Textract extracts all data (1 call)
- AWS Textract can process both sides in a single API call (no extra cost per page)
- Data is merged with front taking priority, back supplementing missing fields
- Low confidence fields are quality warnings, not fraud indicators
- System automatically extracts state, infers document type, and checks expiration
- Back of ID often contains barcode with additional verification data

### Upload Selfie

**POST** `/api/verification/upload-selfie`

Uploads a selfie, performs liveness detection, and compares it with the ID photo using AWS Rekognition.

**Request Body** (FormData):

```
sessionId: string
image: string (base64 data URL)
```

**Response (Success)**:

```json
{
  "success": true,
  "match": true,
  "confidence": 0.92,
  "livenessResult": {
    "isLive": true,
    "confidence": 0.95,
    "qualityScore": 0.88
  },
  "sessionId": "session_1234567890_abc123"
}
```

**Response (Liveness Check Failed)**:

```json
{
  "success": false,
  "error": "Liveness check failed",
  "issues": ["Image too dark", "Face turned too far to the side"],
  "livenessResult": {
    "isLive": false,
    "confidence": 0.42,
    "qualityScore": 0.55
  }
}
```

### Get Session Status

**GET** `/api/verification/session/:sessionId`

**SECURITY:** This endpoint returns only session metadata, NOT verified identity data. Verified data is transient and only accessible during credential creation with a valid `verificationToken`.

**Response**:

```json
{
  "success": true,
  "session": {
    "id": "session_1760055469389_xvmuj",
    "provider": "custom",
    "status": "approved",
    "createdAt": 1760055469389,
    "expiresAt": 1760057269389,
    "metadata": {
      "fraudCheckPassed": true,
      "bothSidesProcessed": true,
      "extractionMethod": "aws-textract",
      "hasVerifiedData": true,
      "dataIntegrityProtected": true
    }
  }
}
```

**Field Descriptions:**

- `status`: Session status (`pending`, `approved`, `rejected`)
- `metadata.fraudCheckPassed`: Whether document passed fraud detection
- `metadata.bothSidesProcessed`: Whether front and back were processed
- `metadata.hasVerifiedData`: Whether session contains verified identity data
- `metadata.dataIntegrityProtected`: Whether data is protected with HMAC

**Why No Identity Data?**

Verified identity data (firstName, lastName, birthDate, etc.) is **transient** - the server keeps only the **HMAC hash**, not the actual data:

1. ✅ **Returned once** in the `/upload-id` response for client-side storage
2. ✅ **Hash stored** server-side for integrity verification (not the data itself)
3. ✅ **Client submits data** during credential creation for hash verification
4. ❌ **NOT stored** in session after initial verification
5. ❌ **NOT exposed** via any public API endpoints

**Security Benefits:**

- **Prevents session hijacking** - Stealing sessionId gets you nothing (no PII stored)
- **Minimizes data exposure** - Server breach doesn't expose identity data
- **Hash-based verification** - Server can verify data authenticity without storing it
- **Client accountability** - Client must submit and affirm the data they're using

## Client Integration Guide

This section shows the exact steps external clients (mobile wallets, web apps) need to take to integrate with the verification system.

### Complete Verification Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├──1. Upload ID Photos (front + back)
       │   POST /api/verification/upload-id
       │   • Send: front image (required), back image (optional)
       │   • Receive: verificationToken, sessionId, extractedData
       │
       ├──2. Show extracted data to user for confirmation
       │   • Display: firstName, lastName, birthDate, etc.
       │
       ├──3. Upload Selfie + ID Photo
       │   POST /api/verification/upload-selfie
       │   • Receive: match result, confidence
       │
       ├──4. If match successful, request credential
       │   POST /api/credentials
       │   • Send: verificationToken + walletAddress
       │   • Receive: W3C credential + NFT assetId
       │
       └──5. Store credential locally + opt-in to NFT
```

### Step 1: Upload ID Photos (Front & Back)

**Endpoint:** `POST /api/verification/upload-id`

**Request (FormData):**

```javascript
const formData = new FormData();
formData.append('image', frontImageBase64); // Required: front of ID (base64)
formData.append('backImage', backImageBase64); // Recommended: back of ID (base64)
formData.append('mimeType', 'image/jpeg'); // Optional: defaults to image/jpeg

fetch('/api/verification/upload-id', {
  method: 'POST',
  body: formData,
});
```

**Notes:**

- `image` parameter is **required** (front of ID)
- `backImage` parameter is **recommended** for better fraud detection and data extraction
- Both images should be base64-encoded strings (with or without data URI prefix)
- Sending both sides triggers more comprehensive fraud checks (2 Google calls + 1 AWS call)
- Sending front only uses single-side verification (1 Google call + 1 AWS call)

**Response (Success - 200):**

```json
{
  "success": true,
  "sessionId": "custom_1234567890",
  "verificationToken": "session_xxx:hmac_xxx:signature_xxx",
  "extractedData": {
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "birthDate": "1990-01-15",
    "governmentId": "D1234567",
    "idType": "drivers_license",
    "state": "CA",
    "expirationDate": "2028-01-15"
  },
  "lowConfidenceFields": [],
  "isExpired": false,
  "warnings": null,
  "bothSidesProcessed": true,
  "fraudCheck": {
    "passed": true,
    "signals": []
  }
}
```

**What to Store:**

```typescript
// Store these securely (sessionStorage recommended - cleared on tab close)
const { verificationToken, sessionId, extractedData } = response;

// For credential creation later (REQUIRED)
sessionStorage.setItem('verificationToken', verificationToken);
sessionStorage.setItem('sessionId', sessionId);

// For display to user (store in memory or sessionStorage)
sessionStorage.setItem('extractedData', JSON.stringify(extractedData));
```

**⚠️ IMPORTANT: Do NOT fetch session data again**

The session endpoint (`/api/verification/session/:sessionId`) returns only metadata, NOT identity data. The `extractedData` from the upload response is the ONLY time verified data is exposed. Store it client-side for display.

**Response (Fraud Detected - 400):**

```json
{
  "success": false,
  "error": "Document verification failed - potential fraud detected",
  "fraudDetected": true,
  "fraudSignals": [
    {
      "type": "fraud_signals_image_manipulation",
      "result": "SUSPICIOUS",
      "side": "front"
    }
  ]
}
```

### Step 2: Display Data for Confirmation

Show the extracted data to the user in a **read-only** form for confirmation:

```typescript
const extractedData = JSON.parse(sessionStorage.getItem('extractedData'));

// Display to user (read-only):
// - First Name: John
// - Middle Name: Michael
// - Last Name: Doe
// - Birth Date: 1990-01-15
// - Government ID: D1234567
// - ID Type: drivers_license
// - State: CA
// - Expiration Date: 2028-01-15

// User confirms → proceed to Step 3
```

### Step 3: Upload Selfie for Face Comparison

**Endpoint:** `POST /api/verification/upload-selfie`

**Request (FormData):**

```javascript
const formData = new FormData();
formData.append('sessionId', sessionId); // From Step 1
formData.append('image', selfieBase64); // User's selfie
formData.append('idPhoto', frontImageBase64); // ID photo from Step 1 (stored client-side)

fetch('/api/verification/upload-selfie', {
  method: 'POST',
  body: formData,
});
```

**Response (Match Success - 200):**

```json
{
  "success": true,
  "match": true,
  "confidence": 0.92,
  "livenessResult": {
    "isLive": true,
    "confidence": 0.95,
    "qualityScore": 0.88,
    "issues": []
  },
  "sessionId": "custom_1234567890"
}
```

**Response (No Match - 200):**

```json
{
  "success": true,
  "match": false,
  "confidence": 0.45,
  "error": "Face in selfie does not match ID photo",
  "sessionId": "custom_1234567890"
}
```

**Response (Liveness Failed - 400):**

```json
{
  "success": false,
  "error": "Liveness check failed",
  "issues": ["Image too dark", "Eyes appear closed"],
  "livenessResult": {
    "isLive": false,
    "confidence": 0.42,
    "qualityScore": 0.55
  }
}
```

### Step 4: Request Credential Issuance

**Only proceed if face match was successful!**

**Endpoint:** `POST /api/credentials`

**Request:**

```javascript
// Submit full identity data + verification token
// Server will verify data hasn't been tampered with by comparing hash
// IMPORTANT: Complete within 10 minutes of receiving the token
fetch('/api/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    verificationToken: verificationToken, // From Step 1 - REQUIRED (expires in 10 minutes)
    walletAddress: userAlgorandAddress, // User's Algorand wallet (must be valid Algorand address)
    // Identity data from Step 1 (for verification against stored hash)
    // MUST match extracted data exactly, with proper formatting:
    firstName: extractedData.firstName, // Max 100 characters
    middleName: extractedData.middleName || '', // Empty string if not provided (max 100 chars)
    lastName: extractedData.lastName, // Max 100 characters
    birthDate: extractedData.birthDate, // YYYY-MM-DD format (required)
    governmentId: extractedData.governmentId, // Max 50 characters
    idType: extractedData.idType, // 'drivers_license' | 'passport' | 'government_id'
    state: extractedData.state?.toUpperCase(), // MUST be 2 uppercase letters (e.g., "CA", "NY")
    expirationDate: extractedData.expirationDate, // YYYY-MM-DD format (if provided)
  }),
});
```

**Response (Success - 200):**

```json
{
  "success": true,
  "credential": {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": "urn:uuid:abc123",
    "type": ["VerifiableCredential", "BirthDateCredential"],
    "issuer": {
      "id": "did:algo:ISSUER_ADDRESS"
    },
    "issuanceDate": "2025-10-12T12:34:56.789Z",
    "credentialSubject": {
      "id": "did:algo:USER_WALLET_ADDRESS",
      "cardlessid:compositeHash": "hash_of_identity_data"
    },
    "proof": {
      "type": "Ed25519Signature2020",
      "created": "2025-10-12T12:34:56.789Z",
      "verificationMethod": "did:algo:ISSUER_ADDRESS#key-1",
      "proofPurpose": "assertionMethod",
      "proofValue": "z123..."
    }
  },
  "personalData": {
    "firstName": "John",
    "middleName": "Michael",
    "lastName": "Doe",
    "birthDate": "1990-01-15",
    "governmentId": "D1234567",
    "idType": "drivers_license",
    "state": "CA"
  },
  "nft": {
    "assetId": "123456789",
    "requiresOptIn": true,
    "network": "testnet"
  },
  "blockchain": {
    "transaction": {
      "id": "TX_ID",
      "explorerUrl": "https://testnet.explorer.perawallet.app/tx/TX_ID"
    }
  }
}
```

**Response (Token Invalid - 403):**

```json
{
  "error": "Invalid or tampered verification token"
}
```

**Response (Data Tampering Detected - 400):**

```json
{
  "error": "Data tampering detected - the identity information you submitted does not match what was verified"
}
```

**Response (Token Expired - 400):**

```json
{
  "error": "Token verification failed: token expired"
}
```

**Response (Invalid Token Format - 400):**

```json
{
  "error": "Token verification failed: invalid format"
}
```

**Response (Validation Error - 400):**

```json
{
  "error": "Invalid state - must be 2-letter code"
}
// OR
{
  "error": "Invalid birthDate format - use YYYY-MM-DD"
}
// OR
{
  "error": "Invalid Algorand wallet address"
}
```

**How Data Integrity Works:**

1. **After ID verification** - Server computes HMAC hash of identity data
2. **Token creation** - Hash is embedded in signed `verificationToken`
3. **Credential request** - Client sends identity data + token
4. **Server verification** - Server:
   - Validates token signature
   - Extracts expected hash from token
   - Computes hash of submitted identity data
   - Compares hashes
5. **If hashes match** → Data is authentic, create credential
6. **If hashes don't match** → Data was tampered with, reject with 400 error

This ensures clients cannot modify any identity information after verification without detection.

### Step 5: Store Credential & Opt-in to NFT

**Store Locally (Encrypted):**

```typescript
interface StoredCredential {
  credential: any; // W3C VC from response
  personalData: any; // Personal data from response
  nft: {
    assetId: string;
    network: string;
  };
}

// Store in encrypted local storage
const credentialData: StoredCredential = {
  credential: response.credential,
  personalData: response.personalData,
  nft: response.nft,
};

await secureStorage.setItem('cardlessid_credential', credentialData);
```

**Opt-in to NFT:**

```typescript
import algosdk from 'algosdk';

const algodClient = new algosdk.Algodv2(
  '',
  'https://testnet-api.algonode.cloud',
  443
);

const suggestedParams = await algodClient.getTransactionParams().do();

const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
  from: walletAddress,
  to: walletAddress,
  amount: 0,
  assetIndex: Number(response.nft.assetId),
  suggestedParams,
});

// Sign and submit transaction
const signedTxn = txn.signTxn(privateKey);
await algodClient.sendRawTransaction(signedTxn).do();
```

**Transfer NFT to Wallet:**

```javascript
// After opt-in completes
fetch('/api/credentials/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    assetId: response.nft.assetId,
    walletAddress: walletAddress,
  }),
});
```

### Complete Example Implementation

```typescript
class CardlessIDClient {
  private baseUrl = 'https://your-domain.com';
  private verificationToken: string | null = null;
  private sessionId: string | null = null;
  private idPhotoBase64: string | null = null;

  // Step 1: Upload ID
  async uploadId(frontImage: string, backImage?: string): Promise<any> {
    const formData = new FormData();
    formData.append('image', frontImage);
    if (backImage) {
      formData.append('backImage', backImage);
    }
    formData.append('mimeType', 'image/jpeg');

    const response = await fetch(`${this.baseUrl}/api/verification/upload-id`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    // Store for later steps
    this.verificationToken = data.verificationToken;
    this.sessionId = data.sessionId;
    this.idPhotoBase64 = frontImage; // Store for selfie comparison

    return data.extractedData;
  }

  // Step 2: Upload Selfie
  async uploadSelfie(selfieImage: string): Promise<boolean> {
    const formData = new FormData();
    formData.append('sessionId', this.sessionId!);
    formData.append('image', selfieImage);
    formData.append('idPhoto', this.idPhotoBase64!);

    const response = await fetch(
      `${this.baseUrl}/api/verification/upload-selfie`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    return data.match === true;
  }

  // Step 3: Request Credential
  async requestCredential(
    walletAddress: string,
    identityData: any // Data from Step 1 (stored client-side)
  ): Promise<any> {
    // Submit identity data + token for hash verification
    // IMPORTANT: Must complete within 10 minutes of receiving token
    const response = await fetch(`${this.baseUrl}/api/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken: this.verificationToken,
        walletAddress: walletAddress,
        // Identity data for server to verify against stored hash
        firstName: identityData.firstName,
        middleName: identityData.middleName || '', // Ensure empty string if undefined
        lastName: identityData.lastName,
        birthDate: identityData.birthDate, // Must be YYYY-MM-DD
        governmentId: identityData.governmentId,
        idType: identityData.idType,
        state: identityData.state?.toUpperCase(), // Must be uppercase
        expirationDate: identityData.expirationDate, // Must be YYYY-MM-DD if provided
      }),
    });

    const data = await response.json();

    if (!data.success) {
      // Handle specific error types
      const errorMsg = data.error || '';
      if (errorMsg.includes('token expired')) {
        throw new Error(
          'Verification expired (10 min limit). Please start over.'
        );
      } else if (errorMsg.includes('invalid format')) {
        throw new Error('Verification error. Please update your app.');
      } else if (errorMsg.includes('Invalid')) {
        throw new Error(`Validation error: ${errorMsg}`);
      }
      throw new Error(data.error);
    }

    // Clear sensitive data
    this.verificationToken = null;
    this.sessionId = null;
    this.idPhotoBase64 = null;

    return {
      credential: data.credential,
      personalData: data.personalData,
      nft: data.nft,
    };
  }
}

// Usage Example
const client = new CardlessIDClient();

// 1. Upload ID photos (front and back)
const frontPhoto = await captureIdFront(); // Capture/select front of ID
const backPhoto = await captureIdBack(); // Capture/select back of ID

const extractedData = await client.uploadId(frontPhoto, backPhoto);
console.log('Extracted:', extractedData);

// Store extracted data - needed for credential creation later
const identityData = extractedData;

// 2. Show data to user for confirmation
showConfirmationUI(extractedData);

// 3. User takes selfie
const selfiePhoto = await captureSelfie();
const matched = await client.uploadSelfie(selfiePhoto);
if (!matched) {
  throw new Error('Face does not match ID');
}

// 4. Request credential (pass identity data for verification)
const credential = await client.requestCredential(
  userWalletAddress,
  identityData
);

// 5. Store locally (encrypted)
await secureStorage.set('credential', credential);

// 6. Opt-in to NFT on Algorand
await optInToAsset(credential.nft.assetId);
```

### Security Notes for Clients

**Required:**

- ✅ Store `verificationToken` securely (sessionStorage or encrypted storage)
- ✅ Store `extractedData` from upload-id response (needed for credential creation)
- ✅ Send both `verificationToken` AND identity data when requesting credentials
- ✅ Server will verify submitted data matches stored hash before creating credential
- ✅ Clear ID photo from memory after selfie upload
- ✅ Encrypt stored credentials at rest
- ✅ Never expose birth date - only return age verification boolean

**Data Integrity Protection:**

- **Hash verification:** Server compares hash of submitted data against stored hash
- **Token format:** `sessionId:dataHmac:timestamp:signature` (4 parts)
- **Cannot be forged:** Server secret required to create valid tokens
- **Tamper detection:** Any modification to identity data is detected and rejected
- **Token expiration:** 10 minutes from token creation (enforced via timestamp in token)

**Why Submit Data Again?**

The verified identity data must be submitted with the credential request because:

1. Session endpoint doesn't expose identity data (security)
2. Server needs to verify data hasn't been tampered with
3. Hash comparison proves data authenticity
4. Creates accountability trail (client affirms the data they're using)

## Security Considerations

### Data Integrity & Anti-Tampering

**HMAC-Based Data Integrity** - The system uses HMAC (Hash-based Message Authentication Code) to ensure verified identity data cannot be tampered with:

### How It Works

**Step 1: Verification (ID Upload)**

```
Client uploads ID → Server verifies → Extracts identity data
Server computes: HMAC hash of (firstName|middleName|lastName|birthDate|governmentId|idType|state|expirationDate)
Server stores: Hash in session metadata (dataHmac field)
Server creates: Signed token = sessionId:dataHmac:signature
Server returns: Token + extractedData to client
```

**Step 2: Client Storage**

```
Client stores in sessionStorage:
  - verificationToken (signed token with hash)
  - extractedData (identity data for display/submission)
```

**Step 3: Credential Creation**

```
Client submits:
  - verificationToken
  - walletAddress
  - Full identity data (firstName, lastName, etc.)

Server verifies:
  1. Token signature valid? (prevents token forgery)
  2. Extract expected hash from token
  3. Compute hash of submitted data
  4. Hashes match?
     ✓ YES → Data authentic, create credential
     ✗ NO → Data tampered, reject with 400 error
```

### Why We Keep Only the Hash

The server session stores:

- ✅ **HMAC hash** of identity data (for verification)
- ✅ **Session metadata** (status, timestamps, fraud check results)
- ❌ **NOT the actual identity data** (firstName, lastName, birthDate, etc.)

**Benefits:**

- Identity data is **transient** - only returned once in upload-id response
- Session endpoint can't expose PII (it doesn't have it)
- Hash proves data authenticity without storing sensitive data
- Minimizes data exposure in case of session database breach

### Security Properties

**Prevents Data Tampering:**

- Client receives: `{ firstName: "John", ... }` + hash
- Client modifies: `{ firstName: "Jane", ... }`
- Client submits modified data + original token
- Server computes: hash(modified data) ≠ hash(original data)
- **Result**: Rejected with "Data tampering detected"

**Prevents Session Hijacking:**

- Attacker steals sessionId from URL/logs
- Attacker queries session endpoint → Only gets metadata, no identity data
- Attacker can't create credential without:
  - Valid verificationToken (needs signature secret)
  - Original identity data (not stored anywhere on server)
- **Result**: Session theft is useless

**Setup:**

```bash
# Generate secure random secret (32+ bytes recommended)
openssl rand -base64 32

# Add to .env
DATA_INTEGRITY_SECRET=your_generated_secret_here
```

**Security Notes:**

- Uses HMAC-SHA256 for cryptographic hashing
- Uses timing-safe comparison to prevent timing attacks
- Token includes cryptographic signature (prevents forgery)
- Hash proves data integrity without storing actual data
- Rotate DATA_INTEGRITY_SECRET periodically in production

### Photo Storage

- Photos are stored temporarily on the server filesystem
- Photos should be deleted after credential issuance
- On verification failure, photos are immediately deleted
- Never commit the `storage/` directory to git

### API Keys

- Keep all service account JSON files in `.gitignore`
- Never commit API keys or credentials
- Use environment variables for all sensitive data
- Rotate keys regularly in production
- **Important**: Rotate `DATA_INTEGRITY_SECRET` regularly

### Data Privacy

- Extract only necessary fields from ID documents
- Don't store raw Document AI responses long-term
- Implement proper session expiration
- Follow GDPR/CCPA requirements for user data
- Verified data never sent in cleartext during credential creation

## Error Handling

### Google Document AI Errors

Common errors and solutions:

- **Document AI endpoints not configured**: Set `ID_FRAUD_ENDPOINT` environment variable
- **Credentials not found**: Set `GOOGLE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- **Invalid credentials format**: Ensure JSON is properly formatted service account key
- **Document validation failed**: Image quality too low or not a valid ID document
- **Fraud detected**: Document appears tampered, fake, or manipulated - block verification

**Note**: If Google Document AI is not configured, fraud detection is gracefully skipped with a warning.

### AWS Textract Errors

Common errors and solutions:

- **AWS credentials not configured**: Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- **AccessDeniedException**: IAM user lacks `textract:AnalyzeID` permission
- **InvalidParameterException**: Image format or size issue - check image is valid JPEG/PNG
- **ProvisionedThroughputExceededException**: Too many requests - implement rate limiting
- **Low quality image**: Ask user to retake photo with better lighting
- **Missing required fields**: Textract couldn't extract firstName, lastName, birthDate, or governmentId

### AWS Rekognition Errors

- **No face detected in ID photo**: Ensure ID includes a clear face photo
- **No face detected in selfie**: Ensure face is centered and clearly visible
- **Liveness check failed**: User will see specific issues (too dark, eyes closed, sunglasses, etc.)
- **Face in selfie does not match ID photo**: Faces are genuinely different or quality too low
- **AccessDeniedException**: IAM user lacks `rekognition:CompareFaces` or `rekognition:DetectFaces` permission
- **InvalidParameterException**: Image format or size issue

**See [AWS_SETUP.md](./AWS_SETUP.md#troubleshooting) for detailed troubleshooting steps.**

## Development & Testing

### Mock Mode

For development without external services:

```bash
FACE_COMPARISON_PROVIDER=mock
```

This provides:

- Simulated face comparison (80% success rate)
- No external API calls
- Adjustable via `FACE_MATCH_THRESHOLD`

### Testing the Flow

1.  Start the development server: `npm run dev`
2.  Navigate to `/app/custom-verify`
3.  Use test ID photos from `public/test-ids/` (if available)
4.  Complete the verification flow
5.  Check console for detailed logs

## Production Deployment

### Pre-deployment Checklist

- Google Document AI processor created and tested
- Service account credentials configured
- Face comparison service configured (AWS or Azure)
- Photo storage directory created with proper permissions
- All API keys added to production environment
- `.gitignore` includes credentials and storage directory
- Session cleanup cron job configured
- Error monitoring configured
- Rate limiting implemented

### Monitoring

Monitor these metrics:

- Document AI success rate
- Face match success rate
- API response times
- Storage usage
- Session expiration cleanup

### Cost Optimization

**Hybrid Approach Pricing:**

**Google Document AI (Fraud Detection):**

- ID Fraud Detection: ~$0.10 per page
- First 1,000 pages/month free

**AWS Services:**

- AWS Textract AnalyzeID: ~$0.065 per ID
- AWS Rekognition CompareFaces: ~$0.001 per comparison
- AWS Rekognition DetectFaces: ~$0.001 per detection

**Per verification costs (single side):**

- 1 Google fraud check: $0.10 (or free if under 1,000/month)
- 1 AWS Textract call: $0.065 (only if fraud check passes)
- 1 Liveness check (DetectFaces): $0.001
- 1 Face comparison: $0.001
- **Total: ~$0.167 per complete verification** (or $0.067 within free tier)

**Per verification costs (both sides):**

- 2 Google fraud checks: $0.20 (or free if under 1,000/month)
- 1 AWS Textract call (both pages): $0.065 (Textract processes both in one call)
- 1 Liveness check (DetectFaces): $0.001
- 1 Face comparison: $0.001
- **Total: ~$0.267** (or $0.067 within free tier)
- **Note**: Google only used for fraud detection, AWS Textract handles all data extraction

**Cost Savings:**

- Fraud detected (blocked): $0.10 (saved $0.067 on Textract + face checks)
- Within free tier: $0.067 (Google free, AWS only)
- Fraud detection typically rejects 2-10% of attempts, reducing overall costs

**Free Tier Benefits:**

- Google Document AI: 1,000 pages/month ongoing
- AWS Textract: 1,000 pages/month for first 3 months
- AWS Rekognition: 5,000 images/month for first 12 months

**Optimization Tips:**

- Fraud detection runs first to fail fast on fake IDs (saves AWS costs)
- If Google not configured, system falls back to AWS-only (no fraud detection)
- **Architecture**: Google for fraud detection (2 calls), AWS Textract for data extraction (1 call for both sides)
- AWS Textract processes both sides in one call - no extra cost for back side
- Cache extracted ID data to avoid re-processing
- Use image compression before upload (maintains quality)
- Monitor usage with AWS CloudWatch and Google Cloud Monitoring
- First 1,000 verifications/month are effectively free with both free tiers

**See [AWS_SETUP.md](./AWS_SETUP.md#cost-considerations) for detailed AWS cost analysis.**

## Troubleshooting

### "AWS credentials not configured"

Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your `.env.local` file. Restart the development server after making changes.

### "Unable to access camera"

Ensure:

- HTTPS is enabled (required for camera access)
- User has granted camera permissions
- Camera is not in use by another app

### "Liveness check failed"

The error message will include specific issues:

- **Image too dark/bright**: Improve lighting conditions
- **Image not sharp enough**: Hold device steady, ensure camera is focused
- **Eyes appear closed**: Keep eyes open during photo
- **Face turned too far**: Face camera directly
- **Sunglasses detected**: Remove sunglasses or eyewear

### "Face comparison failed" or "Face does not match"

Check:

- Same person in both photos
- Good lighting in both images
- Face clearly visible (not obscured)
- ID photo includes face (not just back of ID)
- Consider adjusting `AWS_REKOGNITION_THRESHOLD` (default 85)

### "Session not found"

- Session may have expired (30 minute default)
- Check Firebase Realtime Database connection
- Verify session ID is correct

**For more troubleshooting, see [AWS_SETUP.md](./AWS_SETUP.md#troubleshooting)**

## Future Enhancements

Potential improvements:

- ✅ Liveness detection for selfies (implemented)
- ✅ ID expiration date detection (implemented)
- Multi-language support for Textract
- Video-based liveness with head movement detection
- Progressive image quality checks
- Webhook notifications for verification events
- Admin dashboard for verification review and audit
- Fraud detection integration (third-party service)
- Custom confidence threshold configuration per field
- Support for international IDs and passports

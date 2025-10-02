# Verification API Documentation

## Overview

The verification system uses a session-based flow with pluggable identity verification providers.

## Architecture

```
Mobile App → Start Session → Provider SDK → Webhook → Issue Credential
```

## API Endpoints

### 1. Start Verification Session

**POST** `/api/verification/start`

Create a new verification session and get auth token for mobile SDK.

```json
// Request (optional)
{
  "provider": "mock" | "idenfy" | "stripe_identity"
}

// Response
{
  "sessionId": "session_1727890123_abc123",
  "authToken": "mock_token_...",
  "expiresAt": "2025-10-01T16:30:00.000Z",
  "provider": "mock"
}
```

### 2. Check Session Status

**GET** `/api/verification/status/:sessionId`

Poll to check if verification is complete.

```json
// Response
{
  "sessionId": "session_1727890123_abc123",
  "status": "pending" | "approved" | "rejected" | "expired",
  "provider": "mock",
  "ready": true,  // true if can issue credential
  "expiresAt": "2025-10-01T16:30:00.000Z",
  "credentialIssued": false
}
```

### 3. Webhook (Provider → Server)

**POST** `/api/verification/webhook?provider=mock`

Verification provider calls this when verification completes.

```json
// Request (provider-specific format)
{
  "providerSessionId": "mock_session_xxx",
  "status": "approved",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1990-01-01",
  "governmentId": "D1234567",
  "idType": "government_id",
  "state": "CA"
}

// Response
{
  "success": true,
  "sessionId": "session_1727890123_abc123",
  "status": "approved"
}
```

### 4. Issue Credential

**POST** `/api/credentials`

Issue credential after verification is approved.

```json
// Request
{
  "verificationSessionId": "session_1727890123_abc123",
  "walletAddress": "ALGORAND_ADDRESS_HERE"
}

// Response
{
  "success": true,
  "credential": { ... },
  "personalData": { ... },
  "blockchain": { ... },
  "duplicateDetection": { ... }
}
```

## Testing with Mock Provider

### Step 1: Start Session

```bash
curl -X POST http://localhost:5173/api/verification/start \
  -H "Content-Type: application/json" \
  -d '{"provider": "mock"}'
```

Response:

```json
{
  "sessionId": "session_1727890123_abc123",
  "authToken": "mock_token_...",
  "expiresAt": "2025-10-01T16:30:00.000Z",
  "provider": "mock"
}
```

### Step 2: Simulate Webhook (Approve Verification)

```bash
curl -X POST 'http://localhost:5173/api/verification/webhook?provider=mock' \
  -H "Content-Type: application/json" \
  -d '{
    "providerSessionId": "mock_session_session_1727890123_abc123",
    "status": "approved",
    "firstName": "John",
    "middleName": "",
    "lastName": "Doe",
    "birthDate": "1990-01-15",
    "governmentId": "D1234567",
    "idType": "government_id",
    "state": "CA"
  }'
```

### Step 3: Check Status

```bash
curl http://localhost:5173/api/verification/status/session_1727890123_abc123
```

Response:

```json
{
  "sessionId": "session_1727890123_abc123",
  "status": "approved",
  "ready": true,
  "provider": "mock"
}
```

### Step 4: Issue Credential

```bash
curl -X POST http://localhost:5173/api/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "verificationSessionId": "session_1727890123_abc123",
    "walletAddress": "YOUR_ALGORAND_ADDRESS_HERE"
  }'
```

## Mobile App Flow

**How it works:**

1. Mobile app requests a verification session from YOUR server
2. YOUR server creates a session and gets a token from the verification provider
3. Mobile app launches the provider's SDK with the token
4. User completes verification in the provider's SDK (may take several minutes)
5. **Provider sends webhook to YOUR server** when verification completes
6. Mobile app polls YOUR server to check if webhook was received
7. If approved, mobile app requests credential issuance

**Important:** The mobile app ONLY communicates with YOUR server. It never polls the provider directly. The provider sends a webhook to your server when verification is complete.

**Session Timeout:** 30 minutes from creation

```typescript
// 1. Start verification session on YOUR server
const { sessionId, authToken, provider } = await fetch(
  '/api/verification/start',
  {
    method: 'POST',
    body: JSON.stringify({ provider: 'idenfy' }), // or 'mock' for testing
  }
).then((r) => r.json());

// 2. Launch provider SDK with the auth token
// User completes ID verification (takes 1-5 minutes typically)
await IdenfyReactNative.start({ authToken });
// SDK closes automatically when user finishes

// 3. Poll YOUR server to check if provider's webhook arrived
// The provider sends a webhook to YOUR server when verification completes
let status;
let attempts = 0;
const maxAttempts = 90; // 3 minutes with 2s intervals

do {
  const response = await fetch(`/api/verification/status/${sessionId}`);
  status = await response.json();

  if (status.status !== 'pending') break;

  await new Promise((r) => setTimeout(r, 2000)); // Wait 2 seconds
  attempts++;
} while (attempts < maxAttempts);

// 4. If approved, issue credential
if (status.ready) {
  const credential = await fetch('/api/credentials', {
    method: 'POST',
    body: JSON.stringify({
      verificationSessionId: sessionId,
      walletAddress: myWalletAddress,
    }),
  }).then((r) => r.json());

  // Store credential locally in wallet
  await saveCredentialToWallet(credential);
} else {
  // Handle rejection or timeout
  console.error('Verification failed:', status.status);
}
```

## Adding New Providers

1. Create provider class in `app/utils/verification-providers/`
2. Implement `IVerificationProvider` interface
3. Register in `app/utils/verification-providers/index.ts`
4. Set environment variable: `VERIFICATION_PROVIDER=your_provider`

See `mock.ts` for reference implementation.

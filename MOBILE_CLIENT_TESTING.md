# Mobile Client Testing with Mock Provider

## Setup

**Terminal 1 - Main Server:**

```bash
npm run dev
```

**Terminal 2 - Mock Provider Server:**

```bash
node scripts/mock-provider-server.cjs
```

## Mobile Client Flow

Your mobile app should use these endpoints:

### Full Flow Example

```typescript
// In your React Native app

const MAIN_SERVER = 'http://localhost:5173'; // Your main server
const MOCK_PROVIDER = 'http://localhost:3001'; // Mock provider server

// STEP 1: Start verification session on YOUR server
const startVerification = async () => {
  const response = await fetch(`${MAIN_SERVER}/api/verification/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'mock' }),
  });

  const { sessionId, authToken, providerSessionId } = await response.json();

  console.log('Session started:', sessionId);

  // STEP 2: Call mock provider's /verify endpoint with identity data
  // (In production, you'd launch the real SDK here)
  await fetch(`${MOCK_PROVIDER}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authToken,
      providerSessionId,
      identityData: {
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        governmentId: 'D1234567',
        idType: 'government_id',
        state: 'CA',
      },
      approved: true, // Only used if AUTO_APPROVE=true
    }),
  });

  console.log('Verification started on provider...');
  console.log('Now waiting for manual approval on provider console');

  // STEP 3: Poll YOUR server for status
  return pollForStatus(sessionId);
};

const pollForStatus = async (sessionId: string) => {
  let attempts = 0;
  const maxAttempts = 90; // 3 minutes

  while (attempts < maxAttempts) {
    const response = await fetch(
      `${MAIN_SERVER}/api/verification/status/${sessionId}`
    );
    const status = await response.json();

    console.log(`Status check #${attempts + 1}:`, status.status);

    if (status.status === 'approved') {
      console.log('✅ Verification approved!');
      return { approved: true, sessionId, ready: status.ready };
    } else if (status.status === 'rejected') {
      console.log('❌ Verification rejected');
      return { approved: false, sessionId };
    } else if (status.status === 'expired') {
      console.log('⏰ Session expired');
      return { approved: false, sessionId };
    }

    // Still pending, wait 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Verification timeout');
};

// STEP 4: Issue credential if approved
const issueCredential = async (sessionId: string, walletAddress: string) => {
  const response = await fetch(`${MAIN_SERVER}/api/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verificationSessionId: sessionId,
      walletAddress,
    }),
  });

  const credential = await response.json();

  if (credential.success) {
    console.log('✅ Credential issued!');
    // Save credential locally in your wallet
    return credential;
  } else {
    throw new Error(credential.error);
  }
};

// Complete flow
const completeVerificationFlow = async (walletAddress: string) => {
  try {
    // Start verification
    const { approved, sessionId, ready } = await startVerification();

    if (!approved) {
      throw new Error('Verification failed');
    }

    if (!ready) {
      throw new Error('Session not ready for credential');
    }

    // Issue credential
    const credential = await issueCredential(sessionId, walletAddress);

    return credential;
  } catch (error) {
    console.error('Verification flow failed:', error);
    throw error;
  }
};
```

## What Happens

1. **Mobile app** → **Your server**: "Start verification"
2. **Your server** → **Mobile app**: Session ID + auth token + provider session ID
3. **Mobile app** → **Mock provider**: "Verify this user" (with identity data)
4. **Mock provider**: Shows prompt on its console for manual approval
5. **You**: Type `a` (approve), `r` (reject), or `d` (delay) in provider console + press ENTER
6. **Mock provider** → **Your server**: Webhook with result
7. **Mobile app** → **Your server**: Poll status (every 2 seconds)
8. **Your server** → **Mobile app**: "approved"
9. **Mobile app** → **Your server**: "Issue credential"
10. **Your server** → **Mobile app**: Credential + blockchain transaction

## Testing Scenarios

### Happy Path (Approval)

1. Run the flow
2. When prompted, type `a` + ENTER in provider console
3. Credential should be issued

### Rejection

1. Run the flow
2. When prompted, type `r` + ENTER in provider console
3. App should handle rejection gracefully

### Delays (Slow User)

1. Run the flow
2. When prompted, type `d` + ENTER (can repeat multiple times)
3. Test your app's polling logic and timeouts

### Timeout (User Never Completes)

1. Run the flow
2. Don't respond to the prompt (or keep typing `d`)
3. After 90 polling attempts (3 minutes), your app should timeout

## Environment Variables

- `AUTO_APPROVE=true` - Provider auto-approves after 3 seconds (for automated testing)
- `AUTO_APPROVE=false` - Manual mode (default) - you control approval
- `SERVER_URL` - Your main server URL (default: http://localhost:5173)

## Notes

- In production, you'd replace the mock provider `/verify` call with the real provider's SDK (e.g., `IdenfyReactNative.start()`)
- The polling logic remains the same for production
- The mock provider helps you test edge cases (rejections, delays, timeouts) that are hard to reproduce with real ID verification

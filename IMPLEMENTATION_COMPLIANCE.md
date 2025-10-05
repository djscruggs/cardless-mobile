# Implementation Compliance Review

## Current Status: ⚠️ PARTIALLY COMPLIANT

The current implementation differs significantly from DEEP_LINKING.md and WALLET_README.md. This document outlines the gaps and recommended fixes.

## Issues Found

### 1. Deep Link Format Mismatch ❌

**Expected (per DEEP_LINKING.md):**
```
cardlessid://verify?challenge=chal_123
cardlessid://verify?session=age_123
https://cardlessid.com/app/wallet-verify?challenge=chal_123
```

**Current Implementation:**
```
cardlessid://verify?data=<base64-encoded-json>
```

**Impact:** Incompatible with the documented wallet app API.

**Fix Required:** Update deep link handler to support both formats.

---

### 2. API Endpoint Integration Missing ❌

**Expected (per WALLET_README.md):**
- `GET /api/integrator/challenge/details/{challengeId}`
- `POST /api/integrator/challenge/respond`
- `GET /api/age-verify/session/:id`
- `POST /api/age-verify/respond`

**Current Implementation:**
- Custom `returnUrl` callback only
- No integration with cardlessid.com API

**Impact:** Cannot work with the documented CardlessID verification system.

**Fix Required:** Add API client for challenge/session based verification.

---

### 3. QR Code Format Different ❌

**Expected (per DEEP_LINKING.md):**
```
QR Code contains: https://cardlessid.com/app/age-verify?challenge=chal_123
```

**Current Implementation:**
```json
QR Code contains: {
  "type": "age_verification",
  "minBirthDate": "2003-01-01",
  "returnUrl": "https://example.com/callback"
}
```

**Impact:** Incompatible QR codes with documented system.

**Fix Required:** Support both formats - URL-based (for cardlessid.com) and JSON-based (for standalone use).

---

### 4. Response Format Mismatch ⚠️

**Expected:**
```json
{
  "challengeId": "chal_123",
  "approved": true,
  "walletAddress": "ALGO_ADDRESS"
}
```

**Current:**
```json
{
  "verified": true,
  "walletAddress": "ALGO_ADDRESS",
  "requestId": "...",
  "timestamp": "..."
}
```

**Impact:** Response won't be accepted by documented API endpoints.

**Fix Required:** Map current format to expected format when calling cardlessid.com APIs.

---

## Recommended Solutions

### Option 1: Dual-Mode Support (Recommended)

Support **both** the documented CardlessID integration AND standalone verification:

#### Mode A: CardlessID Integration (per docs)
- Deep links: `cardlessid://verify?challenge=chal_123`
- API calls to cardlessid.com
- Response format: `{challengeId, approved, walletAddress}`

#### Mode B: Standalone Verification (current)
- Deep links: `cardlessid://verify?data=<base64>`
- Custom returnUrl callbacks
- Response format: `{verified, walletAddress, ...}`

**Advantages:**
- ✅ Fully compliant with documentation
- ✅ Backward compatible with existing implementation
- ✅ Flexible for different use cases

**Implementation:**
```typescript
// Detect mode from deep link params
if (params.challenge || params.session) {
  // Mode A: CardlessID integration
  handleChallengeVerification(params.challenge);
} else if (params.data) {
  // Mode B: Standalone verification
  handleStandaloneVerification(params.data);
}
```

---

### Option 2: Update Documentation (Alternative)

Update DEEP_LINKING.md and WALLET_README.md to match the current implementation.

**Advantages:**
- ✅ No code changes needed
- ✅ Simpler implementation

**Disadvantages:**
- ❌ Breaking change for anyone following current docs
- ❌ May conflict with existing cardlessid.com infrastructure

---

## Specific Code Changes Needed (Option 1)

### 1. Update Deep Link Handler

**File:** `src/app/_layout.tsx`

```typescript
React.useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const url = event.url;
    const { hostname, path, queryParams } = Linking.parse(url);

    if (hostname === 'verify' || path === 'verify') {
      // Check for challenge-based verification (CardlessID integration)
      if (queryParams?.challenge) {
        handleChallengeVerification(queryParams.challenge as string);
      }
      // Check for session-based verification (demo mode)
      else if (queryParams?.session) {
        handleSessionVerification(
          queryParams.session as string,
          queryParams.minAge as string
        );
      }
      // Fallback to standalone verification (current implementation)
      else if (queryParams?.data) {
        handleStandaloneVerification(queryParams.data as string);
      }
    }
  };

  // ... rest of handler
}, [router]);
```

### 2. Add CardlessID API Client

**New File:** `src/api/cardlessid/index.ts`

```typescript
import axios from 'axios';

const API_BASE = 'https://cardlessid.com/api';

export type ChallengeDetails = {
  challengeId: string;
  minAge: number;
  expiresAt: string;
  status: 'pending' | 'responded' | 'expired';
};

export type ChallengeResponse = {
  challengeId: string;
  approved: boolean;
  walletAddress: string;
};

export async function getChallengeDetails(
  challengeId: string
): Promise<ChallengeDetails> {
  const response = await axios.get(
    `${API_BASE}/integrator/challenge/details/${challengeId}`
  );
  return response.data;
}

export async function respondToChallenge(
  response: ChallengeResponse
): Promise<void> {
  await axios.post(`${API_BASE}/integrator/challenge/respond`, response);
}

export async function getSessionDetails(sessionId: string) {
  const response = await axios.get(`${API_BASE}/age-verify/session/${sessionId}`);
  return response.data;
}

export async function respondToSession(data: {
  sessionId: string;
  approved: boolean;
  walletAddress: string;
}) {
  await axios.post(`${API_BASE}/age-verify/respond`, data);
}
```

### 3. Add Challenge Verification Handler

**New File:** `src/lib/challenge-verification.ts`

```typescript
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import {
  getChallengeDetails,
  respondToChallenge,
} from '@/api/cardlessid';
import { credentialStorage, wallet } from '@/lib';

export async function handleChallengeVerification(challengeId: string) {
  try {
    // 1. Fetch challenge details from cardlessid.com
    const challenge = await getChallengeDetails(challengeId);

    if (challenge.status !== 'pending') {
      Alert.alert('Error', 'This verification request has expired or already been completed');
      return;
    }

    // 2. Check user credentials
    const personalData = credentialStorage.getPersonalData();
    if (!personalData) {
      Alert.alert('No Credential', 'Please verify your identity first');
      return;
    }

    // 3. Calculate user age
    const userBirthDate = new Date(personalData.birthDate);
    const today = new Date();
    let age = today.getFullYear() - userBirthDate.getFullYear();
    const monthDiff = today.getMonth() - userBirthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < userBirthDate.getDate())) {
      age--;
    }

    const approved = age >= challenge.minAge;

    // 4. Show confirmation
    Alert.alert(
      'Age Verification',
      approved
        ? `You meet the age requirement (${challenge.minAge}+). Send verification?`
        : `You do not meet the age requirement (${challenge.minAge}+).`,
      [
        {
          text: 'Send Verification',
          onPress: async () => {
            try {
              const walletAddress = wallet.getWalletAddress();
              if (!walletAddress) throw new Error('No wallet address');

              await respondToChallenge({
                challengeId: challenge.challengeId,
                approved,
                walletAddress,
              });

              showMessage({
                message: 'Verification sent successfully',
                type: 'success',
              });
            } catch (error) {
              console.error('Error responding:', error);
              Alert.alert('Error', 'Failed to send verification');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  } catch (error) {
    console.error('Error handling challenge:', error);
    Alert.alert('Error', 'Failed to load verification request');
  }
}
```

### 4. Update QR Code Scanner

**File:** `src/app/(app)/scan.tsx`

```typescript
const handleBarCodeScanned = React.useCallback(
  async ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Try parsing as URL first (CardlessID format)
      if (data.startsWith('http://') || data.startsWith('https://')) {
        const url = new URL(data);

        // Check if it's a CardlessID verification URL
        if (url.pathname === '/app/age-verify' || url.pathname === '/app/wallet-verify') {
          const challengeId = url.searchParams.get('challenge');
          const sessionId = url.searchParams.get('session');

          if (challengeId) {
            await handleChallengeVerification(challengeId);
            return;
          } else if (sessionId) {
            await handleSessionVerification(sessionId, url.searchParams.get('minAge') || '21');
            return;
          }
        }
      }

      // Fallback: Try parsing as JSON (standalone format)
      const scanRequest: ScanRequest = JSON.parse(data);
      await handleScanRequest(scanRequest);
    } catch (error) {
      console.error('❌ Error processing QR code:', error);
      Alert.alert('Invalid QR Code', 'Could not process this QR code.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  },
  [scanned, handleScanRequest]
);
```

---

## Testing Checklist

After implementing changes:

### CardlessID Integration Mode
- [ ] Deep link with `challenge` parameter works
- [ ] Can fetch challenge details from cardlessid.com
- [ ] Age calculation is correct
- [ ] Response format matches API expectations
- [ ] API response is successful

### Standalone Mode
- [ ] JSON QR codes still work
- [ ] Custom returnUrl callbacks work
- [ ] Backward compatibility maintained

### Universal Links (Future)
- [ ] HTTPS URLs in QR codes
- [ ] App opens from browser
- [ ] Fallback to web works

---

## Priority Recommendations

1. **Immediate:** Add dual-mode support (Option 1) to maintain compliance
2. **Short-term:** Test with actual cardlessid.com API
3. **Long-term:** Implement universal links for production

---

## Questions for CardlessID Team

1. Is the cardlessid.com API (challenge/respond endpoints) already deployed?
2. Should we support both modes, or migrate entirely to challenge-based?
3. Are there test credentials/API keys for development?
4. What's the timeline for universal links requirement?

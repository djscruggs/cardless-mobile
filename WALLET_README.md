# Building a CardlessID-Compatible Wallet App

Quick reference for wallet app developers.

## What You're Building

A mobile wallet app that:
1. Stores users' age credentials (birth date)
2. Scans QR codes for age verification requests
3. Responds with yes/no (without revealing actual age)

## Quick Start

### 1. Set Up Deep Linking

Your app needs to handle these URLs:

**Universal Links (recommended):**
```
https://cardlessid.com/app/wallet-verify?challenge=chal_123...
https://cardlessid.com/app/wallet-verify?session=age_123...
```

**Custom Scheme (fallback):**
```
cardlessid://verify?challenge=chal_123...
cardlessid://verify?session=age_123...
```

See [DEEP_LINKING.md](../DEEP_LINKING.md) for setup instructions.

### 2. Implement API Calls

**Fetch verification details:**
```http
GET https://cardlessid.com/api/integrator/challenge/details/{challengeId}
```

**Submit response:**
```http
POST https://cardlessid.com/api/integrator/challenge/respond

{
  "challengeId": "chal_123...",
  "approved": true,
  "walletAddress": "ALGORAND_ADDRESS"
}
```

### 3. User Flow

```
User scans QR → App opens → Fetch details → Show consent screen
              → User approves/declines → Submit response → Success!
```

## Full Documentation

👉 **[Complete Wallet App Developer Guide](../WALLET_APP_GUIDE.md)**

Includes:
- ✅ Detailed API documentation
- ✅ iOS (Swift) example code
- ✅ Android (Kotlin) example code
- ✅ React Native example code
- ✅ Deep linking setup (iOS & Android)
- ✅ Testing guide
- ✅ Security requirements

## Key Files

| File | Purpose |
|------|---------|
| [WALLET_APP_GUIDE.md](../WALLET_APP_GUIDE.md) | Complete implementation guide |
| [DEEP_LINKING.md](../DEEP_LINKING.md) | Deep linking setup (iOS & Android) |
| [Integration Guide](https://cardlessid.com/docs/integration-guide) | Web docs (for context) |
| [Credential Schema](https://cardlessid.com/docs/credential-schema) | W3C credential format |

## API Endpoints Reference

### For Integrator Challenges

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrator/challenge/details/:id` | GET | Get challenge details (public) |
| `/api/integrator/challenge/respond` | POST | Submit verification response |

### For Demo Sessions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/age-verify/session/:id` | GET | Get session details |
| `/api/age-verify/respond` | POST | Submit verification response |

## Example Implementation

### Minimal iOS Example

```swift
// 1. Handle deep link
func application(_ app: UIApplication, open url: URL, ...) -> Bool {
    if let challengeId = extractChallengeId(from: url) {
        handleVerification(challengeId: challengeId)
        return true
    }
    return false
}

// 2. Fetch & verify
func handleVerification(challengeId: String) async {
    let details = try await fetch("/api/integrator/challenge/details/\(challengeId)")
    let userAge = calculateUserAge()
    let approved = userAge >= details.minAge

    // 3. Submit
    try await post("/api/integrator/challenge/respond", body: [
        "challengeId": challengeId,
        "approved": approved,
        "walletAddress": getUserWalletAddress()
    ])
}
```

## Testing

1. Visit: https://cardlessid.com/app/age-verify
2. Set age requirement and generate QR
3. Scan with your app
4. Verify the flow works end-to-end

## Requirements

Your app MUST:
- ✅ Store user credentials securely
- ✅ Only share yes/no (not actual birth date)
- ✅ Get explicit user consent
- ✅ Use HTTPS for all API calls
- ✅ Handle expired challenges
- ✅ Validate challenge status

## Support

- **Full Guide**: [WALLET_APP_GUIDE.md](../WALLET_APP_GUIDE.md)
- **GitHub**: https://github.com/cardlessid/cardlessid
- **Email**: support@cardlessid.com

## License

MIT - Build freely!

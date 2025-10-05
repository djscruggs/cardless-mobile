# Deep Linking Setup for CardlessID

This document explains how the CardlessID wallet app integrates with the verification system using deep links.

## Overview

When a user scans a QR code for age verification, their phone needs to know to open the CardlessID wallet app. This is accomplished through **deep linking**.

## Two Approaches

### 1. Custom URL Schemes (Simple, but deprecated)

**Format:** `cardlessid://verify?challenge=chal_123...`

**Pros:**
- Simple to implement
- Works immediately after app install

**Cons:**
- Not verified by OS (any app can register `cardlessid://`)
- Security risk (malicious apps could hijack)
- No fallback to website
- iOS shows confirmation dialog

**Current Implementation:**
```javascript
// In age-verify.tsx
const deepLinkUrl = `cardlessid://verify?challenge=${challengeId}`;
```

### 2. Universal Links / App Links (Recommended for Production)

**Format:** `https://cardlessid.com/app/age-verify?challenge=chal_123...`

**Pros:**
- ✅ Secure (verified by OS using cryptographic signatures)
- ✅ Seamless (opens app directly, no confirmation)
- ✅ Fallback (opens website if app not installed)
- ✅ Works across platforms (iOS, Android, Web)
- ✅ Better user experience

**Cons:**
- Requires server-side configuration files
- Requires app to be signed and published

## Universal Links Setup (iOS)

### 1. Create Apple App Site Association File

File must be served at:
```
https://cardlessid.com/.well-known/apple-app-site-association
```

Content:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.cardlessid.wallet",
        "paths": [
          "/app/age-verify",
          "/app/wallet-verify"
        ]
      }
    ]
  }
}
```

**Important:**
- No `.json` extension
- Must be served with `Content-Type: application/json`
- Must be accessible via HTTPS
- Replace `TEAM_ID` with your Apple Team ID

### 2. Configure iOS App (Xcode)

**Add Associated Domains capability:**
```
Signing & Capabilities → + Capability → Associated Domains

Add domain:
applinks:cardlessid.com
```

**Handle incoming links (Swift):**
```swift
// AppDelegate.swift or SceneDelegate.swift
func application(_ application: UIApplication,
                continue userActivity: NSUserActivity,
                restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {

    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else {
        return false
    }

    // Parse URL
    // url = https://cardlessid.com/app/age-verify?challenge=chal_123...

    if url.path == "/app/age-verify" {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
        if let challengeId = components?.queryItems?.first(where: { $0.name == "challenge" })?.value {
            // Navigate to verification screen with challengeId
            navigateToVerification(challengeId: challengeId)
            return true
        }
    }

    return false
}
```

### 3. Test Universal Links

**Test from Safari:**
```
https://cardlessid.com/app/age-verify?challenge=test_123
```

Should open the app directly (no prompt).

**Debug:**
```bash
# Check if Apple can fetch your file
curl -v https://cardlessid.com/.well-known/apple-app-site-association

# Must return 200 OK and valid JSON
```

## App Links Setup (Android)

### 1. Create Asset Links File

File must be served at:
```
https://cardlessid.com/.well-known/assetlinks.json
```

Content:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cardlessid.wallet",
      "sha256_cert_fingerprints": [
        "YOUR_APP_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

**Get your SHA256 fingerprint:**
```bash
# For debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# For release keystore
keytool -list -v -keystore /path/to/release.keystore -alias your-alias
```

### 2. Configure Android App (AndroidManifest.xml)

```xml
<activity android:name=".VerificationActivity">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data
            android:scheme="https"
            android:host="cardlessid.com"
            android:pathPrefix="/app/age-verify" />

        <data
            android:scheme="https"
            android:host="cardlessid.com"
            android:pathPrefix="/app/wallet-verify" />
    </intent-filter>
</activity>
```

**Important:** `android:autoVerify="true"` enables App Links verification.

### 3. Handle incoming links (Kotlin/Java)

```kotlin
// VerificationActivity.kt
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val data: Uri? = intent?.data

    // data = https://cardlessid.com/app/age-verify?challenge=chal_123...

    if (data != null && data.path == "/app/age-verify") {
        val challengeId = data.getQueryParameter("challenge")
        if (challengeId != null) {
            // Navigate to verification screen
            showVerification(challengeId)
        }
    }
}
```

### 4. Test App Links

**Test with ADB:**
```bash
adb shell am start -a android.intent.action.VIEW \
  -d "https://cardlessid.com/app/age-verify?challenge=test_123" \
  com.cardlessid.wallet
```

**Verify setup:**
```bash
adb shell dumpsys package d
# Look for "cardlessid.com" in the output
```

## Current Implementation

Our current code generates both formats:

```typescript
// In age-verify.tsx
const deepLinkUrl = isIntegratorMode && challengeId
  ? `cardlessid://verify?challenge=${challengeId}`
  : sessionId
  ? `cardlessid://verify?session=${sessionId}&minAge=${minAge}`
  : "";

const webFallbackUrl = isIntegratorMode && challengeId
  ? `${window.location.origin}/app/wallet-verify?challenge=${challengeId}`
  : sessionId
  ? `${window.location.origin}/app/wallet-verify?session=${sessionId}`
  : "";
```

## Recommended Production Implementation

### Update SDK to Return Both URLs

```javascript
// In create.ts
const baseUrl = new URL(request.url).origin;

return Response.json({
  challengeId: challenge.id,
  // Universal Link (preferred)
  qrCodeUrl: `${baseUrl}/app/age-verify?challenge=${challenge.id}`,
  // Deep link (fallback)
  deepLinkUrl: `cardlessid://verify?challenge=${challenge.id}`,
  // Direct web URL
  webUrl: `${baseUrl}/app/wallet-verify?challenge=${challenge.id}`,
  expiresAt: challenge.expiresAt,
  createdAt: challenge.createdAt,
});
```

### Mobile Detection and Fallback

```javascript
// In age-verify.tsx
const handleMobileTap = () => {
  if (isIntegratorMode && challengeId) {
    // Try Universal Link first (seamless if app installed)
    const universalLink = `${window.location.origin}/app/wallet-verify?challenge=${challengeId}`;
    window.location.href = universalLink;

    // Fallback to custom scheme after delay (if universal link didn't work)
    setTimeout(() => {
      window.location.href = `cardlessid://verify?challenge=${challengeId}`;
    }, 2000);
  }
};
```

## Server Configuration

### Nginx

```nginx
location /.well-known/apple-app-site-association {
    default_type application/json;
    add_header 'Access-Control-Allow-Origin' '*';
}

location /.well-known/assetlinks.json {
    default_type application/json;
    add_header 'Access-Control-Allow-Origin' '*';
}
```

### React Router / Vite

The files are already in `public/.well-known/` and will be served automatically.

**Verify they're accessible:**
```bash
curl https://cardlessid.com/.well-known/apple-app-site-association
curl https://cardlessid.com/.well-known/assetlinks.json
```

## QR Code Contents

### Current (Custom Scheme)
```
cardlessid://verify?challenge=chal_1234567890_abc123
```

### Recommended (Universal Link)
```
https://cardlessid.com/app/age-verify?challenge=chal_1234567890_abc123
```

**Benefits of HTTPS in QR code:**
- Works on web browsers (opens website)
- Opens app if installed (via universal links)
- More trustworthy (users see real domain)
- Better for debugging (can test in browser)

## Flow Diagram

```
User scans QR code
       |
       v
QR contains: https://cardlessid.com/app/age-verify?challenge=chal_123
       |
       v
   [Phone OS checks]
       |
       ├─> App installed?
       |   ├─> YES: Open app directly
       |   |         └─> App handles /app/age-verify route
       |   |
       |   └─> NO: Open in browser
       |             └─> Shows web verification UI
       |                 └─> "Open in App" button
       |                     └─> Falls back to cardlessid:// scheme
```

## Testing Checklist

- [ ] HTTPS association file accessible
- [ ] Valid JSON format
- [ ] Correct Team ID / Package name
- [ ] App signed with matching certificate
- [ ] Intent filters configured
- [ ] App handles incoming URLs
- [ ] Fallback to web works
- [ ] QR code scannable
- [ ] Universal link opens app (if installed)
- [ ] Universal link opens web (if app not installed)

## Troubleshooting

**iOS: Universal Links not working**
- Check file is at `/.well-known/apple-app-site-association` (no .json)
- Verify HTTPS and valid SSL certificate
- Check Team ID matches
- Try deleting and reinstalling app
- Test in Safari, not in-app browsers

**Android: App Links not working**
- Verify SHA256 fingerprint is correct
- Check `android:autoVerify="true"` is set
- Test with ADB command
- Check logcat for verification errors
- May take time for Google to verify

**General:**
- Clear browser cache
- Test on real device (simulators may behave differently)
- Check server logs for 404s on association files

## Migration Path

1. **Phase 1 (Current):** Use custom URL schemes (`cardlessid://`)
2. **Phase 2:** Add universal links support to wallet app
3. **Phase 3:** Update QR codes to use HTTPS URLs
4. **Phase 4:** Remove custom URL scheme fallback

## Resources

- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
- [Branch.io Deep Linking Guide](https://branch.io/what-is-deep-linking/)

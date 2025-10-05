# Age Verification Scan Feature

## Overview

The scan feature allows users to verify their age to websites by scanning QR codes. The app checks if the user meets the age requirement and sends a verification response to the requesting website.

## How It Works

### Flow 1: In-App QR Scan

1. User opens the Cardless ID app
2. User navigates to the "Scan" tab
3. User scans a QR code displayed on a website
4. App processes the request and shows confirmation dialog
5. User approves, and verification is sent to the website

### Flow 2: Deep Link from Browser

1. User clicks a QR code or button on a mobile website
2. Browser opens the Cardless ID app via deep link (`cardlessid://verify?data=...`)
3. App shows confirmation dialog to open scanner
4. App processes the request and user approves
5. Verification is sent to the website

### Flow 3: Deep Link When App is Closed

1. User scans QR code with their phone's camera (outside the app)
2. Phone recognizes the deep link and opens Cardless ID
3. App processes the request automatically
4. User approves verification

## QR Code Format

QR codes must contain JSON data with the following structure:

```json
{
  "type": "age_verification",
  "minBirthDate": "2003-01-01",
  "returnUrl": "https://example.com/api/verify-callback",
  "requestId": "optional-unique-id"
}
```

### Fields

- **type** (required): Must be `"age_verification"`
- **minBirthDate** (required): ISO date string (YYYY-MM-DD). Users born on or before this date will pass verification.
- **returnUrl** (required): HTTPS URL where the verification response will be sent
- **requestId** (optional): Unique identifier for tracking the request

## Deep Link Format

For browser-based flows, encode the JSON as base64 and use this format:

```
cardlessid://verify?data=<base64-encoded-json>
```

Example:

```javascript
const scanRequest = {
  type: 'age_verification',
  minBirthDate: '2003-01-01',
  returnUrl: 'https://example.com/api/verify-callback',
  requestId: 'req-123',
};

const encodedData = btoa(JSON.stringify(scanRequest));
const deepLink = `cardlessid://verify?data=${encodedData}`;
```

## Verification Response

When the user approves, the app sends a POST request to the `returnUrl` with this payload:

```json
{
  "verified": true,
  "walletAddress": "ALGORAND_ADDRESS_HERE",
  "requestId": "req-123",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### Response Fields

- **verified** (boolean): `true` if user meets age requirement, `false` otherwise
- **walletAddress** (string): The user's Algorand wallet address (for verification tracking)
- **requestId** (string): The same requestId from the original request (if provided)
- **timestamp** (string): ISO timestamp of when verification was performed

## Testing

### Generate Test QR Codes

1. Open `test-qr-generator.html` in your browser
2. Set the minimum age requirement (e.g., 18, 21, 25)
3. Enter your callback URL
4. Click "Generate QR Code"
5. Scan with the Cardless ID app

### Test Deep Links

On the same page, click the "Open in Cardless ID" button (on mobile) to test the deep link flow.

### Setup Local Callback Server

For testing callbacks locally:

```bash
# Example using Express.js
npm install express
```

```javascript
// test-server.js
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/verify-callback', (req, res) => {
  console.log('✅ Received verification:', req.body);
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Test server listening on http://localhost:3000');
});
```

For testing from mobile devices on the same network, use your computer's local IP:

```
http://192.168.1.100:3000/api/verify-callback
```

## Security Considerations

1. **HTTPS Required**: Production returnUrl must use HTTPS
2. **Wallet Address**: The wallet address can be used to verify on the blockchain that the credential exists
3. **User Consent**: Users must explicitly approve each verification request
4. **Privacy**: Only the verification result (true/false) and wallet address are sent - no personal information

## Implementation Example

### Website Integration

```html
<!-- On your website -->
<div id="age-gate">
  <h2>Age Verification Required</h2>
  <p>You must be 21+ to access this content</p>

  <!-- QR Code for desktop -->
  <div id="qr-code"></div>

  <!-- Button for mobile -->
  <a href="#" id="verify-button" style="display: none;">
    Verify with Cardless ID
  </a>
</div>

<script>
  // Generate verification request
  const scanRequest = {
    type: 'age_verification',
    minBirthDate: new Date(new Date().getFullYear() - 21, 0, 1)
      .toISOString()
      .split('T')[0],
    returnUrl: 'https://yoursite.com/api/age-verify',
    requestId: generateUniqueId(),
  };

  const qrData = JSON.stringify(scanRequest);

  // Desktop: Show QR code
  if (window.innerWidth > 768) {
    QRCode.toCanvas(document.getElementById('qr-code'), qrData, {
      width: 256,
    });
  } else {
    // Mobile: Show deep link button
    const encodedData = btoa(qrData);
    const deepLink = `cardlessid://verify?data=${encodedData}`;

    const button = document.getElementById('verify-button');
    button.href = deepLink;
    button.style.display = 'block';
  }
</script>
```

### Server-Side Verification Handler

```javascript
// Express.js example
app.post('/api/age-verify', async (req, res) => {
  const { verified, walletAddress, requestId, timestamp } = req.body;

  // Validate request
  if (!verified) {
    return res.status(403).json({
      success: false,
      message: 'Age verification failed',
    });
  }

  // Optional: Verify wallet on Algorand blockchain
  // This ensures the credential actually exists
  const credentialExists = await checkAlgorandCredential(walletAddress);

  if (!credentialExists) {
    return res.status(403).json({
      success: false,
      message: 'Invalid credential',
    });
  }

  // Store verification for this session
  req.session.ageVerified = true;
  req.session.walletAddress = walletAddress;

  res.json({ success: true });
});
```

## Requirements

- User must have completed identity verification first
- Camera permissions must be granted
- For testing, the app needs to be rebuilt after adding expo-camera:
  ```bash
  npm run prebuild
  npm run ios
  # or
  npm run android
  ```

## Troubleshooting

### Camera Not Working

- Check that camera permissions are granted in device settings
- Rebuild the app after installing expo-camera: `npm run prebuild && npm run ios`

### Deep Links Not Opening App

- Verify the app scheme is configured correctly in `app.config.ts`
- Check that the app is installed on the device
- Ensure the deep link format is correct: `cardlessid://verify?data=...`

### Verification Not Sent

- Check console logs for errors
- Verify returnUrl is accessible
- Make sure returnUrl accepts POST requests with JSON body
- For local testing, ensure the device can reach the callback URL

---
{}
---

# Custom Verification Platform

This document describes the custom identity verification platform that uses Google Document AI for ID extraction and face comparison for identity verification.

## Overview

The custom verification platform provides a complete end-to-end identity verification flow:

1.  **ID Photo Capture**: User photographs their government-issued ID
2.  **Document AI Processing**:
    - Google Document AI fraud detection checks for fraudulent documents
    - Google Document AI parser extracts identity information (name, DOB, etc.)
3.  **Data Confirmation**: User reviews and confirms extracted data (read-only)
4.  **Selfie Capture**: User takes a selfie with face centering guide
5.  **Face Comparison**: System compares ID photo with selfie
6.  **Credential Issuance**: If verified, user receives their NFT credential

## Architecture

```
┌─────────────┐
│   Client    │
│  (Mobile)   │
└──────┬──────┘
       │
       ├──1. Upload ID Photo
       │
┌──────▼──────────────────┐
│  /api/custom-           │
│  verification/upload-id │
└──────┬──────────────────┘
       │
       ├──2a. Check for fraud
       │
┌──────▼─────────────────┐
│  Google Document AI    │
│  (Fraud Detection)     │
│  ID_FRAUD_ENDPOINT     │
└──────┬─────────────────┘
       │
       ├──2b. Extract ID data
       │
┌──────▼─────────────────┐
│  Google Document AI    │
│  (ID Parser)           │
│  ID_PARSE_ENDPOINT     │
└──────┬─────────────────┘
       │
       ├──3. Return extracted data + fraud signals
       │
┌──────▼──────┐
│   Client    │
│  (Review)   │
└──────┬──────┘
       │
       ├──4. Upload Selfie
       │
┌──────▼──────────────────────┐
│  /api/custom-verification/  │
│  upload-selfie               │
└──────┬──────────────────────┘
       │
       ├──5. Compare Faces
       │
┌──────▼────────────────┐
│  Face Comparison      │
│  Service              │
│  (AWS/Azure/Mock)     │
└──────┬────────────────┘
       │
       ├──6. Return match result
       │
┌──────▼──────────┐
│  Credential     │
│  Issuance       │
└─────────────────┘
```

## Setup

### 1\. Google Document AI Configuration

#### Create Document AI Processors

You need **two separate processors** for the verification system:

1.  Go to [Google Cloud Console](https://console.cloud.google.com/ 'Google Cloud Console')
2.  Create a new project or select existing one
3.  Enable the Document AI API
4.  Navigate to Document AI > Processors

**Processor 1: Fraud Detection**

1.  Create a new processor (choose "Fraud Detection Processor" or "Identity Document Fraud Detection")
2.  Note the processor endpoint URL for `ID_FRAUD_ENDPOINT`

**Processor 2: ID Parser**

1.  Create another processor (choose "Identity Document Parser" or "ID Proofing Parser")
2.  Note the processor endpoint URL for `ID_PARSE_ENDPOINT`

Endpoint format: `https://us-documentai.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}:process`

#### Set up Service Account

1.  Go to IAM & Admin > Service Accounts
2.  Create a service account with "Document AI API User" role
3.  Create and download a JSON key file
4.  Save the JSON file to your project (e.g., `./google-credentials.json`)
5.  Add to `.gitignore` to keep it secure

#### Environment Variables

```bash
# Google Document AI - Two processors required
ID_FRAUD_ENDPOINT=https://us-documentai.googleapis.com/v1/projects/{PROJECT_ID}/locations/us/processors/FRAUD_PROCESSOR_ID:process
ID_PARSE_ENDPOINT=https://us-documentai.googleapis.com/v1/projects/{PROJECT_ID}/locations/us/processors/PARSER_PROCESSOR_ID:process

# Google Service Account Credentials
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
# OR use JSON string for deployment:
# GOOGLE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'
```

**How it works:**

- **ID_FRAUD_ENDPOINT**: First API call checks for fraudulent documents and returns fraud signals
- **ID_PARSE_ENDPOINT**: Second API call extracts identity data (name_full, date_of_birth, document_id, etc.)

### 2\. Face Comparison Service Configuration

Choose one of the following providers:

#### Option A: Mock (Development)

No setup required. Provides random confidence scores for testing.

```bash
FACE_COMPARISON_PROVIDER=mock
FACE_MATCH_THRESHOLD=0.85
```

#### Option B: AWS Rekognition (Production)

1.  Create an AWS account
2.  Enable Amazon Rekognition service
3.  Create IAM user with Rekognition permissions
4.  Install SDK: `npm install @aws-sdk/client-rekognition`

```bash
FACE_COMPARISON_PROVIDER=aws-rekognition
FACE_MATCH_THRESHOLD=0.85
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

#### Option C: Azure Face API (Production)

1.  Create an Azure account
2.  Create a Face API resource
3.  Get endpoint URL and subscription key
4.  Install SDK: `npm install @azure/cognitiveservices-face @azure/core-auth`

```bash
FACE_COMPARISON_PROVIDER=azure-face
FACE_MATCH_THRESHOLD=0.85
AZURE_FACE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_FACE_KEY=your-subscription-key
```

### 3\. Photo Storage Configuration

```bash
PHOTO_STORAGE_DIR=./storage/photos
```

Create the storage directory:

```bash
mkdir -p storage/photos
```

**Important**: Add `storage/` to `.gitignore` to prevent committing user photos.

## API Endpoints

### Upload ID Photo

**POST** `/api/custom-verification/upload-id`

Uploads and processes an ID photo with Google Document AI.

**Request Body** (FormData):

```
image: string (base64 data URL)
mimeType: string (e.g., 'image/jpeg')
```

**Response**:

```json
{
  "success": true,
  "sessionId": "session_1234567890_abc123",
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
  "fraudSignals": [],
  "photoUrl": "./storage/photos/session_1234567890_abc123_id.jpg",
  "isExpired": false,
  "warnings": []
}
```

**Note**: The system automatically:

- Extracts state from address if not directly provided
- Infers document type (passport vs government_id)
- Checks for expired IDs and returns warnings
- Detects fraud signals from the fraud detection processor

### Upload Selfie

**POST** `/api/custom-verification/upload-selfie`

Uploads a selfie and compares it with the ID photo.

**Request Body** (FormData):

```
sessionId: string
image: string (base64 data URL)
```

**Response**:

```json
{
  "success": true,
  "match": true,
  "confidence": 0.92,
  "sessionId": "session_1234567890_abc123"
}
```

### Get Session

**GET** `/api/custom-verification/session/:sessionId`

Retrieves verification session data. This endpoint returns the complete verification session including all extracted data, fraud signals, and verification results.

**Response**:

```json
{
  "success": true,
  "session": {
    "id": "session_1760055469389_xvmuj",
    "provider": "custom",
    "providerSessionId": "custom_1760055469389",
    "status": "approved",
    "createdAt": 1760055469389,
    "expiresAt": 1760057269389,
    "verifiedData": {
      "firstName": "JOHN",
      "middleName": "MICHAEL",
      "lastName": "DOE",
      "birthDate": "1990-05-15",
      "governmentId": "D1234567",
      "idType": "drivers_license",
      "state": "CA",
      "expirationDate": "2030-05-15"
    },
    "documentAiData": {
      "fraudSignalsCount": 4,
      "fraudSignals": [
        {
          "type": "fraud_signals_is_identity_document",
          "result": "PASS"
        },
        {
          "type": "fraud_signals_suspicious_words",
          "result": "PASS"
        },
        {
          "type": "fraud_signals_image_manipulation",
          "result": "PASS"
        },
        {
          "type": "fraud_signals_online_duplicate",
          "result": "PASS"
        }
      ],
      "hasData": true
    },
    "idPhotoUrl": "storage/photos/session_1760055469389_xvmuj_id.jpg",
    "selfiePhotoUrl": "storage/photos/session_1760055469389_xvmuj_selfie.jpg",
    "faceMatchResult": {
      "match": true,
      "confidence": 0.92
    }
  }
}
```

**Fraud Signal Types:**

- `fraud_signals_is_identity_document`: Verifies the document is actually an ID document
- `fraud_signals_suspicious_words`: Checks for suspicious text or watermarks
- `fraud_signals_image_manipulation`: Detects signs of photo editing or tampering
- `fraud_signals_online_duplicate`: Checks if the ID image appears in fraud databases

Each fraud signal returns either `PASS` or `FAIL`. Any `FAIL` results indicate potential fraud.

## Client Usage

### React Component

Navigate to `/app/custom-verify` to start the verification flow.

The verification process is handled by these components:

- `IdPhotoCapture`: Camera/upload interface for ID photo
- `IdentityForm`: Read-only form showing extracted data
- `SelfieCapture`: Camera interface with face guide overlay
- `VerificationResult`: Shows result and handles credential issuance

### Example Flow

```tsx
// 1. Start verification
navigate('/app/custom-verify');

// 2. User takes ID photo
// 3. System extracts data automatically
// 4. User confirms data
// 5. User takes selfie with face guide
// 6. System compares faces
// 7. If match: redirect to credential creation
// 8. If no match: restart process
```

## Security Considerations

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

### Data Privacy

- Extract only necessary fields from ID documents
- Don't store raw Document AI responses long-term
- Implement proper session expiration
- Follow GDPR/CCPA requirements for user data

## Error Handling

### Document AI Errors

Common errors and solutions:

- **Invalid endpoint**: Check both `ID_FRAUD_ENDPOINT` and `ID_PARSE_ENDPOINT` format
- **Authentication failed**: Verify `GOOGLE_APPLICATION_CREDENTIALS` path or `GOOGLE_CREDENTIALS_JSON`
- **Quota exceeded**: Check Google Cloud quotas and billing
- **Low quality image**: Ask user to retake photo
- **Missing processor**: Ensure both fraud detection and parser processors are created
- **Fraud detection failed**: First API call failed, check fraud processor configuration
- **Parsing failed**: Second API call failed, check parser processor configuration

### Face Comparison Errors

- **No face detected**: Ensure good lighting and face visibility
- **Low confidence**: May need multiple attempts or better photos
- **Service unavailable**: Check API credentials and quotas

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

- Google Document AI: ~$1.50 per 1,000 pages **per processor** (note: we make 2 API calls per ID)
- AWS Rekognition: ~$0.001 per image
- Azure Face API: ~$0.001 per transaction

**Per verification costs:**

- 2 Document AI calls (fraud + parser): ~$0.003 per verification
- 1 Face comparison call: ~$0.001 per verification
- **Total: ~$0.004 per complete verification**

Consider:

- Image compression before upload
- Batch processing where possible
- Caching successful verifications
- Skip fraud detection for low-risk scenarios (though not recommended)

## Troubleshooting

### "Document AI endpoint not configured"

Set both `ID_FRAUD_ENDPOINT` and `ID_PARSE_ENDPOINT` in your environment variables. Both are required for the system to work.

### "Unable to access camera"

Ensure:

- HTTPS is enabled (required for camera access)
- User has granted camera permissions
- Camera is not in use by another app

### "Face comparison failed"

Check:

- `FACE_COMPARISON_PROVIDER` is set correctly
- API credentials are valid
- Images are properly formatted
- Faces are clearly visible in both photos

### "Session not found"

- Session may have expired (30 minute default)
- Check Firebase Realtime Database connection
- Verify session ID is correct

## Future Enhancements

Potential improvements:

- Multi-language support for Document AI
- Liveness detection for selfies
- ✅ Document fraud detection (implemented via ID_FRAUD_ENDPOINT)
- ✅ ID expiration date detection (implemented)
- Progressive image quality checks
- Webhook notifications
- Admin dashboard for verification review
- Fraud signal threshold configuration
- Custom fraud rules engine

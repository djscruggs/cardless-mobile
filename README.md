<h1 align="center">
  Cardless ID Mobile App
</h1>

## Overview

A React Native mobile wallet application for storing and presenting decentralized identity credentials issued by cardlessid.org. The app enables age verification for adult websites without exposing personal information.

### Privacy & Data Storage

**No personal data is ever stored in a database.** All user credentials are stored exclusively on the user's device. The only data written to the Algorand blockchain is a cryptographic hash of the credential for verification purposes.

During the identity verification process, minimal data is temporarily held in memory on the verification server to complete the verification flow. This data is **immediately wiped** once verification is complete, whether approved or rejected. No traces of personal information remain on any server after verification.

## Current State

This app currently uses a **mock verification server** for testing identity verification flows. The mock server simulates third-party identity verification providers (like iDenfy or Stripe Identity) and allows manual approval/rejection of verification requests.

**Server Repository:** [https://github.com/djscruggs/cardlessid](https://github.com/djscruggs/cardlessid)

## Features

- ✅ Identity verification flow with mock provider
- ✅ Credential issuance and storage
- ✅ Blockchain transaction recording (Algorand testnet)
- ✅ Duplicate detection
- ✅ QR code scanning for verification requests
- ✅ Developer mode for testing

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- iOS Simulator (macOS) or Android Emulator
- Server running at https://github.com/djscruggs/cardlessid

### Installation

```bash
npm install
```

### Running the App

**iOS Simulator:**

```bash
pnpm ios
```

**Android Emulator:**

```bash
pnpm android
```

### Environment Configuration

The app uses environment variables for API endpoints. Configure them in the appropriate `.env` file:

- `.env.local` - Local development (uses this if it exists)
- `.env.staging` - Staging environment
- `.env.production` - Production environment

**Environment Variables:**

- `CREDENTIAL_API_URL` - Main credential/verification server (default: `http://192.168.0.12:5173`)
- `MOCK_PROVIDER_API_URL` - Mock identity provider server (default: `http://192.168.0.12:3001`)
- `ALGORAND_NETWORK` - Algorand network (`testnet` or `mainnet`)

Update your `.env.local` file with your local server IP address if different from the defaults.

## Testing Verification Flow

See [MOBILE_CLIENT_TESTING.md](MOBILE_CLIENT_TESTING.md) for detailed instructions on testing with the mock provider server.

**Quick Start:**

1. Start main server: `npm run dev` (in cardlessid repo)
2. Start mock provider: `node scripts/mock-provider-server.cjs` (in cardlessid repo)
3. Open app and tap "Verify Identity"
4. Form auto-populates with random data from DummyJSON
5. Submit verification
6. Approve/reject in mock provider console
7. Issue credential when approved

## Project Structure

```
src/
├── api/              # API clients and hooks
│   ├── credentials/  # Credential issuance
│   └── verification/ # Verification session management
├── app/              # Expo Router screens
│   ├── (app)/        # Main app screens
│   └── (auth)/       # Authentication screens
├── components/       # Reusable components
└── lib/              # Utilities and storage
```

## Future Plans

- Replace mock provider with real identity verification service (iDenfy, Stripe Identity, etc.)
- Mainnet deployment
- Additional credential types
- Multi-language support

## Based On

This project is based on [Obytes starter](https://starter.obytes.com) - a production-ready React Native template.

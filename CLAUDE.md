# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Cardless ID is a React Native (Expo) mobile wallet for storing and presenting **decentralized identity credentials** issued by cardlessid.org. It enables age verification without exposing personal information. All credentials are stored device-only; only a cryptographic hash is written to the Algorand blockchain.

Backend repo: [https://github.com/djscruggs/cardlessid](https://github.com/djscruggs/cardlessid)

## Commands

```bash
# Install (pnpm only - enforced by preinstall hook)
pnpm install

# Run
pnpm ios                    # iOS simulator
pnpm android                # Android emulator
pnpm start                  # Expo dev server

# Lint / Type-check / Test
pnpm lint                   # ESLint on .ts/.tsx
pnpm type-check             # tsc --noemit
pnpm test                   # Jest
pnpm test:watch             # Jest watch mode
pnpm check-all              # lint + type-check + lint:translations + test

# Run single test file
pnpm test src/path/to/file.test.ts

# EAS builds (CI)
pnpm build:development:ios
pnpm build:staging:android
pnpm build:production:ios

# iOS rebuild after worklets error
export LANG=en_US.UTF-8
rm -rf ios/build && rm -rf ~/Library/Developer/Xcode/DerivedData/CardlessID-*
cd ios && pod install && cd ..
pnpm ios
```

## Environment Configuration

`APP_ENV` controls which env file is loaded (`development` | `staging` | `production`). `.env.local` takes precedence over `.env.<APP_ENV>`.

Required client env vars (validated by Zod in `env.js`):

- `API_URL` – CardlessID server base URL
- `CARDLESS_API_KEY` – API authentication key
- `MOCK_PROVIDER_API_URL` – Mock identity provider (default: `http://localhost:3001`)
- `ALGORAND_NETWORK` – `localnet` | `testnet` | `mainnet` (optional, defaults to `testnet`)

Access in source: `import { Env } from '@env'` (maps to `src/lib/env.js`).
**Never** add env vars to `src/lib/env.js` — add them to `env.js` at root and `app.config.ts` `extra` field.

## Architecture

### Routing — Expo Router file-based

```
src/app/
  _layout.tsx           # Root: providers, deep link handler
  (app)/
    _layout.tsx         # App shell with Stack navigator
    index.tsx           # My ID (home) – displays credential or onboarding
    custom-verify.tsx   # Photo ID + selfie verification flow (primary)
    verify-identity.tsx # Mock verification flow (dev/testing)
    create-identity.tsx # Direct credential creation (dev only)
    scan.tsx            # QR code scanner for age verification requests
    settings.tsx        # App settings
```

Deep links (`cardlessid://verify?...`) are handled in the root `_layout.tsx` and route to `scan.tsx`.

### API Layer (`src/api/`)

All API calls use `react-query-kit` for typed hooks. Three axios clients:

- `src/api/common/client.tsx` – default client (`API_URL` + `CARDLESS_API_KEY`)
- `src/api/verification/client.ts` – same base, with verbose interceptor logging
- `src/api/custom-verification/client.ts` – same base, FormData-aware logging

API modules follow the pattern: `client.ts` + `types.ts` + `use-<action>.ts` hooks.

Key API modules:

- `credentials/` – `useIssueCredential`, `useTransferNFT`
- `verification/` – `useStartSession`, `useCheckStatus`, `useMockVerify`
- `custom-verification/` – `useUploadId`, `useUploadSelfie`

### Custom Verification Flow (primary user path)

`custom-verify.tsx` manages a step machine:
`capture-id` → `uploading-id` → `review-data` → `capture-selfie` → `uploading-selfie` → `match-result` → (credential issued) → home

- Upload ID photo → server extracts data + returns `verificationToken` (expires 10 min)
- Upload selfie + stored ID photo → server checks liveness + face match
- On match success, call `useIssueCredential` with token + identity data → credential stored

### Credential Storage (`src/lib/secure-credential-storage.ts`)

`SecureCredentialStorage` uses `react-native-keychain` (iOS Keychain / Android Keystore) with HMAC-SHA256 tamper detection. Exported singleton: `credentialStorage` with methods: `saveCredential`, `getCredential`, `getPersonalData`, `clearCredential`, etc.

`src/lib/secure-document-storage.ts` stores encrypted document IDs separately.

### Wallet / Algorand (`src/lib/`)

- `algorand.ts` – `algodClient`, `indexerClient` via AlgoNode; `optInToAsset`, `getWalletCredentials`
- `secure-wallet-storage.ts` – stores Algorand wallet keys
- `use-nft-workflow.ts` – React hook orchestrating opt-in + NFT transfer

The app creates an Algorand wallet per device. Credentials are issued as ASAs (NFTs) on the blockchain.

### State Management

- **Auth**: Zustand store in `src/lib/auth/` (`useAuth`, `signIn`, `signOut`, `hydrateAuth`)
- **Credential data**: Loaded from Keychain on screen focus (`useFocusEffect`) — not kept in global state
- **Server state**: TanStack Query via `react-query-kit` hooks

### UI / Styling

- **NativeWind** (Tailwind for React Native) + `tailwind-variants`
- Component library in `src/components/ui/` — use `View`, `Text`, `ScrollView`, `Button` etc. from `@/components/ui` (not from react-native directly)
- Dark mode supported via Tailwind `dark:` prefix + `useThemeConfig`
- `react-native-flash-message` for toasts (`showMessage`, `showErrorMessage`)
- `@gorhom/bottom-sheet` for modals
- Fonts: Inter (loaded via `expo-font`)

### Path Aliases

- `@/*` → `src/*`
- `@env` → `src/lib/env.js`

### Testing

Jest with `jest-expo` preset. Tests match `**/*.test.ts?(x)` or `**/*.spec.ts?(x)`. Module alias `@/` is mapped to `src/` in `jest.config.js`.

### Key Conventions

- `APP_ENV !== 'production'` gates developer-only UI (debug panels, "Dev Only" buttons, fraud signal display)
- The app scheme is `cardlessid://` — used for deep linking
- `state` for driver's license **must be uppercase 2-letter** before sending to server
- `middleName` must be `''` (empty string) not `undefined` when absent — server validation requires it
- NFT `assetId` comes from server as `string` due to JSON BigInt limitations; cast to `Number()` when needed for Algorand SDK calls

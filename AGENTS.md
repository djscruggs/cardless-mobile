# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

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
pnpm lint                   # ESLint on .js/.jsx/.ts/.tsx
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

#### API Module Directory Structure

Each API domain directory must contain:

- `client.ts` — axios instance with `baseURL: Env.API_URL` and `X-API-Key: Env.CARDLESS_API_KEY` header
- `types.ts` — named request/response types (e.g., `StartSessionRequest`, `StartSessionResponse`); nested objects get their own named types
- `use-<action>.ts` — one file per hook, wrapping `createQuery` (GET) or `createMutation` (POST)
- `index.ts` — barrel file using `export * from './module-name'` for every sibling module

The top-level `src/api/index.tsx` re-exports all domain modules. Import from `@/api`, not from deep paths.

#### react-query-kit Hooks

Use `createQuery` for GET endpoints and `createMutation` for POST endpoints. Always provide three explicit generic type parameters: `<Response, Variables, AxiosError>`. Use `fetcher` (not the deprecated `queryFn`) for queries, and `mutationFn` for mutations. Set `queryKey` to a simple string array.

```ts
export const useCheckStatus = createQuery<
  SessionStatusResponse,
  Variables,
  AxiosError
>({
  queryKey: ['verification-status'],
  fetcher: (variables: Variables) => {
    return verificationClient
      .get(`/api/verification/status/${variables.sessionId}`)
      .then((response) => response.data);
  },
});
```

#### Axios Client Setup

Every axios client must include both request and response interceptors with emoji-coded logging: `🔵` for outgoing requests (method, URL, data), `🟢` for successful responses (status, data), `🔴` for errors (message, status, URL). Never create an axios client without these debug interceptors.

#### Mutation Error Handling

In `onError` callbacks, cast `error.response?.data` to `{ error?: string; message?: string } | undefined` and build a fallback chain: `responseData?.error || responseData?.message || 'Fallback message'`. Pass the result to `showErrorMessage()`.

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

#### Secure Storage Dual-Export Pattern

All secure storage modules (`secure-wallet-storage.ts`, `secure-credential-storage.ts`, `secure-document-storage.ts`) follow the same export pattern: implement as a class with private methods, export a singleton instance, and also export individual functions that delegate to the singleton for backward compatibility.

```ts
class SecureWalletStorage {
  async getWalletAddress(): Promise<string | null> { ... }
}

export const secureWalletStorage = new SecureWalletStorage();

// Individual exports for backward compatibility
export const getWalletAddress = () => secureWalletStorage.getWalletAddress();
```

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

### Coding Patterns

#### State Machine Pattern for Async Workflows

Use a string union type for workflow steps instead of multiple boolean state variables. Derive convenience booleans (`isLoading`, `isComplete`, `hasError`) from the single state value.

```ts
type NFTWorkflowState = 'idle' | 'opting-in' | 'transferring' | 'complete' | 'error';
const [state, setState] = React.useState<NFTWorkflowState>('idle');

return {
  state,
  isLoading: state === 'opting-in' || state === 'transferring',
  isComplete: state === 'complete',
  hasError: state === 'error',
};
```

#### Form Validation with Zod + react-hook-form

Define a Zod schema at module level, derive the form type with `z.infer<typeof schema>`, and use `zodResolver(schema)` with `useForm`. Use `ControlledInput`/`ControlledSelect` components from the UI library for controlled fields.

```ts
const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  idType: z.enum(['passport', 'government_id'], { required_error: 'Please select an ID type' }),
});
type FormType = z.infer<typeof schema>;

const { control, handleSubmit } = useForm<FormType>({ resolver: zodResolver(schema) });
```

## Code Style and Structure

- Write concise, technical TypeScript code with accurate examples
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Ensure components are modular, reusable, and maintainable
- Component Modularity: Break down components into smaller, reusable pieces. Keep components focused on a single responsibility and shouldn't be more than 80 lines of code.
- To install new packages use `npx expo install <package-name>`

## Tech Stack

- Expo
- React Native
- TypeScript
- Nativewind (Tailwind CSS for React Native)
- Expo Router
- React Query with React Query Kit
- Zustand
- React Native Keyboard Controller
- React Native SVG
- React Native MMKV

## Naming Conventions

- Favor named exports for components and utilities
- Use kebabCase for all file names and directories (e.g., visa-form.tsx)

## TypeScript Usage

- Use TypeScript for all code; prefer types over interfaces
- Avoid enums; use const objects with 'as const' assertion
- Use functional components with TypeScript interfaces
- Define strict types for message passing between different parts of the extension
- Use absolute imports for all files @/...
- Avoid try/catch blocks unless there's good reason to translate or handle error in that abstraction
- Use explicit return types for all functions

## Syntax and Formatting

- Use "function" keyword for pure functions
- Avoid unnecessary curly braces in conditionals
- Use declarative JSX
- Implement proper TypeScript discriminated unions for message types

## UI and Styling Guidelines

- Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props
- Leverage react-native-reanimated and react-native-gesture-handler for performant animations and gestures
- Avoid unnecessary re-renders by memoizing components and using useMemo and useCallback hooks appropriately
- Make sure to use defined colors and fonts in the tailwind config file

Here is a simple example of how a component should be written:

```tsx
import * as React from 'react';

import { Text, View, Image, SafeAreaView } from '@/components/ui';

// Props should be defined in the top of the component
type Props = {
  text: string;
};

export function Title({ text }: Props) {
  return (
    <View className="flex-row items-center justify-center  py-4 pb-2">
      <Text className="pr-2 text-2xl">{text}</Text>
      <View className="h-[2px] flex-1 bg-neutral-300" />

      <Image
        source={require('@/assets/logo.png')}
        style={{ width: 24, height: 24 }}
        contentFit="contain"
      />
    </View>
  );
}
```

## Error Handling

- Log errors appropriately for debugging
- Provide user-friendly error messages

## Git Usage

Commit Message Prefixes:

- "fix:" for bug fixes
- "feat:" for new features
- "perf:" for performance improvements
- "docs:" for documentation changes
- "style:" for formatting changes
- "refactor:" for code refactoring
- "test:" for adding missing tests
- "chore:" for maintenance tasks

Rules:

- Use lowercase for commit messages
- Keep the summary line concise with a maximum of 100 characters
- Reference issue numbers when applicable

## Documentation

- Maintain clear README with the following sections:
  - Setup (how to install and run the project)
  - Usage (listing all the commands and how to use them)
  - Stack (the tech stack used in the project)
  - Folder Structure (the folder structure of the project only the important ones inside src)

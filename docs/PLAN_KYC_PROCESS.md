# Plan: KYC Process UI Redesign

Spec: `docs/FEATURE_KYC_PROCESS.md`
Target file: `src/app/(app)/custom-verify.tsx`
New components: `src/components/kyc/`

---

## What changes vs. what stays

**Stays (business logic is correct):**

- All step state machine values and transitions
- All API calls (`useStartSession`, `useUploadId`, `useUploadSelfie`, `useCheckStatus`, `useIssueCredential`)
- `handlePhotoTaken`, `handleSelfieCapture`, `handleVerificationComplete`, `handleStartOver`
- Token expiration timer

**Changes (UI only — no logic changes):**

- Replace ad-hoc layout with spec's 3-zone layout (top/middle/bottom)
- Replace existing `IdPhotoCapture` and `SelfiePhotoCapture` components with new spec-compliant ones
- Add step indicator component (hidden during camera, visible otherwise)
- Redesign each step screen to match spec exactly

---

## New Components (`src/components/kyc/`)

### `StepIndicator.tsx`

Props: `currentStep: 1|2|3|4`, `visible: boolean`

- "Step X of 4" in gray-500, small caps, centered
- 4-segment progress bar: gray-200 background, blue-600 filled segments
- Renders null when `visible=false`

### `OrientationGate.tsx`

Props: `onLandscape: () => void`

- Uses `expo-screen-orientation` to detect landscape
- Shows rotating-phone SVG + "Rotate your phone" when portrait
- Calls `onLandscape` when landscape detected; re-gates if user rotates back

### `IdCameraView.tsx` (replaces `IdPhotoCapture`)

Props: `side: 'front'|'back'`, `onCapture: (base64: string) => void`

- Landscape camera viewport via `expo-camera`
- 4 overlay layers (outer dark, guide rect, positioning overlay, quality badge)
- Quality detection loop (~200ms): blur + position → WAITING/BAD/MARGINAL/GOOD states
- Guide border color changes per state
- CTA button enabled only in GOOD state
- White flash (150ms) on capture
- Step indicator HIDDEN, title visible

### `SelfieCameraView.tsx` (replaces `SelfiePhotoCapture`)

Props: `onCapture: (base64: string) => void`

- Portrait, front camera
- White oval overlay (55% width × 75% height), dashed white border, no quality check
- CTA always enabled — "Take Selfie"
- White flash on capture, step indicator HIDDEN

### `ReviewCard.tsx`

Props: `label: string`, `imageUri: string`, `circular?: boolean`, `onRetake: () => void`

- rounded-xl card, gray-200 border, white bg, 12px padding
- Thumbnail (full-width or circular for selfie)
- "Retake" text button (blue, right-aligned)

### `KycLayout.tsx`

Props: `top: ReactNode`, `middle: ReactNode`, `bottom: ReactNode`

- 3-zone layout: fixed top (~80px), flex middle, fixed bottom (64px)
- max-width 480px centered

---

## Step-by-step screen changes

| Step                              | Current              | Spec change                                                       |
| --------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `start-session`                   | Centered text        | Keep as-is (non-spec interstitial)                                |
| `capture-id` (front)              | `IdPhotoCapture`     | `OrientationGate` → `IdCameraView side="front"`                   |
| `capture-id` (back)               | same component       | `OrientationGate` → `IdCameraView side="back"`                    |
| `uploading-id` / `polling-status` | Centered text        | Step 5 Processing screen (spinner, non-dismissible)               |
| `review-data`                     | Scrollable form      | Step 4 Review: 3 `ReviewCard`s (front, back, selfie) + submit CTA |
| `capture-selfie`                  | `SelfiePhotoCapture` | `SelfieCameraView`                                                |
| `uploading-selfie`                | Centered text        | Step 5 Processing screen                                          |
| `match-result` (success)          | Custom card          | Step 6a: green checkmark, extracted data table, "Continue"        |
| `match-result` (failure)          | Custom card          | Step 6b: red X, error reason, "Try Again"                         |
| `liveness-failed`                 | Custom card          | Map to Step 6b                                                    |
| `fraud-detected`                  | Custom card          | Map to Step 6b with "contact support" secondary                   |
| `error`                           | Minimal              | Step 6b generic                                                   |

### Step number mapping

- Steps 1 & 2 = `capture-id` (front/back) — need sub-step tracking (`capturePhase: 'front'|'back'`)
- Step 3 = `capture-selfie`
- Step 4 = `review-data`
- Step 5 = `uploading-id` | `polling-status` | `uploading-selfie`
- Step 6a = `match-result` (success) → `handleVerificationComplete`
- Step 6b = `match-result` (fail) | `liveness-failed` | `fraud-detected` | `error`

---

## State additions to `custom-verify.tsx`

```ts
const [capturePhase, setCapturePhase] = React.useState<'front' | 'back'>(
  'front'
);
const [frontPhotoUri, setFrontPhotoUri] = React.useState<string | null>(null);
const [backPhotoUri, setBackPhotoUri] = React.useState<string | null>(null);
const [selfieUri, setSelfieUri] = React.useState<string | null>(null);
```

- `IdCameraView` captures front → sets `frontPhotoUri` + `capturePhase='back'`
- `IdCameraView` captures back → calls existing `handlePhotoTaken({front, back})`
- `SelfieCameraView` captures → sets `selfieUri` + calls existing `handleSelfieCapture`
- Review step shows all 3 uris; retake resets the relevant uri + phase

---

## Design tokens (add to NativeWind config if not present)

All colors already in Tailwind defaults:

- `blue-600` = #2563EB ✓
- `gray-900/500/200` ✓
- `green-600` = #16A34A ✓
- `amber-600` = #D97706 ✓
- `red-600` = #DC2626 ✓

Border radius: `rounded-xl` = 12px, `rounded-lg` = 8px ✓ — no config changes needed.

---

## Quality detection implementation

`IdCameraView` frame analysis at ~200ms via `onCameraReady` + `requestAnimationFrame` loop:

- **Blur**: take a small sample of pixel variance from the camera frame — low variance = blurry. Simplest viable approach: use `expo-camera`'s `takePictureAsync({ quality: 0.1 })` as a probe, run a JS-side sharpness heuristic on the small image. Alternative: skip blur detection in v1 (only check position).
- **Position**: detect a dominant rectangle in the guide area — approximate with aspect-ratio check on largest high-contrast region.

**Recommendation**: v1 ships with position-only detection (WAITING → BAD/GOOD based on whether a card-aspect-ratio object fills ~70% of guide). Blur detection added in v2. Note this in plan as open question.

---

## Video recording (spec note)

Spec requires silent continuous video from Step 1 camera init through selfie capture for server-side liveness. This requires `expo-camera`'s `recordAsync()` API.

**Open question**: Does the server currently accept/expect a video upload? Not reflected in `useUploadSelfie` or `useUploadId` API types. Flag for backend alignment before implementing.

---

## Files to create/modify

| File                                      | Action                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `src/components/kyc/StepIndicator.tsx`    | NEW                                                 |
| `src/components/kyc/OrientationGate.tsx`  | NEW                                                 |
| `src/components/kyc/IdCameraView.tsx`     | NEW                                                 |
| `src/components/kyc/SelfieCameraView.tsx` | NEW                                                 |
| `src/components/kyc/ReviewCard.tsx`       | NEW                                                 |
| `src/components/kyc/KycLayout.tsx`        | NEW                                                 |
| `src/components/kyc/index.ts`             | NEW                                                 |
| `src/app/(app)/custom-verify.tsx`         | MODIFY (UI only, logic preserved)                   |
| `src/components/custom-verification/`     | KEEP (existing components untouched until replaced) |

---

## Resolved questions

1. **Video upload**: Backend doesn't accept video yet but will. Implement `recordAsync` in `IdCameraView` now; store the video URI in state. Wire up the upload when the endpoint is ready (stub the call with a TODO comment).
2. **Blur detection**: Implement in v1.
3. **Back of ID**: Not required for passports — `capturePhase` stays `'front'` only when `idType === 'passport'`. Skip back capture and go straight to selfie.
4. **"Get help" link (Step 6b)**: `https://cardlessid.org/support/user-help` — open with `Linking.openURL`.
5. **Max width 480px**: Skip — phone-only, always full-width.

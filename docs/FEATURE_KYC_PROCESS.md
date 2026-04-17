Build a mobile-first ID verification flow. Design should feel immediately
familiar to anyone who has done KYC before - think Stripe Identity or Persona.
No flashy animations, no novel patterns. Trustworthy and boring in the best
possible way.

## Design System

- Background: white (#ffffff)
- Primary accent: #2563EB (blue-600)
- Text primary: #111827 (gray-900)
- Text secondary: #6B7280 (gray-500)
- Success: #16A34A (green-600)
- Warning: #D97706 (amber-600)
- Error: #DC2626 (red-600)
- Border/divider: #E5E7EB (gray-200)
- Font: system-ui / Inter fallback
- Border radius: 12px for cards, 8px for buttons
- Max width: 480px, centered, full height on mobile

## Global Layout

Each step is a full-screen view with three zones:

- TOP: Step indicator + title (fixed, ~80px)
- MIDDLE: Main content / camera viewport (fills remaining space)
- BOTTOM: Primary CTA button, fixed, 64px tall, full width, blue,
  white text. Secondary action (e.g. "Need help?") as a small text
  link below the button.

### Step Indicator Visibility

The step indicator ("Step X of 4" text + progress bar) is HIDDEN
during any active camera view. This includes:

- Steps 1 & 2 camera view (after the landscape gate clears)
- Step 3 selfie camera view

The step indicator IS shown on:

- The landscape orientation gate interstitial (Steps 1 & 2)
- Step 4 (Review & Confirm)
- Step 5 (Processing)
- Steps 6a & 6b (Success / Failure)

The title and any visible tip text remain during camera views -
only the "Step X of 4" counter and the progress bar are hidden.

Step indicator style when visible: "Step X of 4" in gray-500,
small caps, centered. Below it: a thin 4-segment progress bar
in gray-200, with completed segments filled in blue-600.

## Steps 1 & 2: ID Capture (Front and Back)

### Landscape Orientation Gate

Before the camera view loads for Steps 1 and 2, check device
orientation. If the device is in portrait mode, show a blocking
interstitial instead of the camera:

- Step indicator visible here (see above)
- Centered rotating-phone icon (system icon or simple SVG, 48px, blue-600)
- Title: "Rotate your phone" (gray-900, 20px, semibold)
- Subtitle: "Landscape mode gives us a better view of your ID"
  (gray-500, small)
- No button - resolves automatically when the user rotates to landscape.

Once landscape is detected, dismiss the interstitial and show
the camera view. If the user rotates back to portrait mid-capture,
re-show the interstitial.

### Camera View

Step indicator: HIDDEN (see Global Layout).
Title remains visible: "Front of your ID" / "Back of your ID"

Camera viewport fills the screen in landscape. Over the live
feed, render the following layers in order:

LAYER 1 - OUTER OVERLAY:
Semi-transparent dark overlay (rgba(0,0,0,0.45)) covering
everything outside the ID guide rectangle.

LAYER 2 - ID GUIDE RECTANGLE:
Credit-card aspect ratio (3.37:1 width:height), ~80% of viewport
width. Rendered as a dashed border (dash: 8px, gap: 4px, stroke: 2px).
Border color is the quality indicator - see Quality States below.

Corner brackets: at each corner of the rectangle, solid white
L-shaped brackets (20px arm length, 3px stroke) sit on top of
the dashed border to reinforce the corners visually.

LAYER 3 - POSITIONING OVERLAY:
A translucent instructional overlay that lives inside the guide
rectangle. Contains:

- Centered text: "Align your ID with the frame"
  Style: white, 15px, medium weight, text-shadow: 1px blur
  rgba(0,0,0,0.6) so it reads against any background.
- Four small inward-pointing arrows (~12px) at the midpoint of
  each side of the guide rectangle, nudging the user to center.
  Same white + text-shadow treatment.

Overall overlay opacity: 0.85 while visible.

BEHAVIOR:

- Visible (fade in 150ms) in WAITING, BAD, and MARGINAL states.
- As soon as GOOD state is detected, fade out (250ms ease-out).
- Once hidden, do NOT bring it back even if quality briefly dips.
  Avoid distracting flicker while the user holds steady.
  Only resets if the user taps "Retake" and the step restarts.

LAYER 4 - QUALITY BADGE:
A small pill badge centered just below the guide rectangle.
Appears and changes with quality state (see below).

### Quality States (real-time, ~200ms update cycle)

Analyze each camera frame for two signals:

1. BLUR: is the image in sharp focus?
2. POSITION: is a rectangular object roughly centered and
   filling ~70-90% of the guide rectangle?

STATE: WAITING (initial / nothing detected)

- Guide border: white dashed
- Badge: none
- Positioning overlay: visible
- CTA button: disabled, gray

STATE: BAD (blurry, or ID not detected in frame)

- Guide border: #DC2626 red dashed
- Badge: red pill, white text
  "Move closer" if nothing detected
  "Hold steady - too blurry" if blur is the issue
- Positioning overlay: visible
- CTA button: disabled, gray

STATE: MARGINAL (detected but borderline)

- Guide border: #D97706 amber dashed
- Badge: amber pill - "Almost there, adjust position"
- Positioning overlay: visible
- CTA button: disabled, gray

STATE: GOOD (sharp focus, ID fills the guide, well-positioned)

- Guide border: #16A34A green dashed, with subtle green glow
  (shadow: 0 0 8px rgba(22,163,74,0.5))
- Badge: green pill - "Looks good!"
- Positioning overlay: fade out (250ms), then hidden
- CTA button: enabled, blue

### Capture Behavior

CTA only tappable in GOOD state. On tap:

- Brief white flash overlay (150ms)
- Freeze the frame
- Advance to Step 2 (after front), or Step 3 (after back)

Tip text (gray-500, small, below badge area):
Step 1: "Make sure all text is readable and there's no glare"
Step 2: "Include the barcode - it helps us verify your information"

NOTE: From Step 1 through Step 3, the app silently records a
continuous video of the entire session using the device camera.
This video is NOT shown to the user at any point. It is used
purely for liveness verification server-side. Start recording
when the Step 1 camera initializes; stop when the selfie in
Step 3 is captured.

## Step 3: Selfie

Return to portrait orientation. No lock, no gate needed.
Step indicator: HIDDEN during camera view (see Global Layout).

Title: "Take a selfie"
Subtitle: "Look directly at the camera"

Switch to front-facing camera.

Camera viewport: full-width container.
Overlay: centered white oval, tall portrait proportions
(~55% of viewport width, ~75% of viewport height).
Dashed border, always white - no quality checking on selfie step.
Same dark semi-transparent overlay outside the oval.
No positioning overlay on this step.

Tip (gray-500, small): "Remove glasses if you can. Make sure
your face is well-lit and fully visible."

CTA button: always enabled - "Take Selfie"

On capture: white flash (150ms), freeze frame, stop video
recording, advance to Step 4.

## Step 4: Review & Confirm

Step indicator: VISIBLE.
Title: "Review your photos"
Subtitle: "Make sure everything looks clear before submitting"

Show three stacked cards (rounded-xl, gray-200 border,
white background, 12px padding):

Card 1: "ID Front" label (gray-500, small), thumbnail of
captured image (rounded-lg, full width of card),
"Retake" text button (blue, small, right-aligned below image)

Card 2: "ID Back" - same layout

Card 3: "Selfie" - same layout but image cropped to a circle
(profile photo style), centered.

Tapping "Retake" on any card returns to that specific step.
For ID steps, re-show the landscape gate first, and reset
the positioning overlay.

CTA button: "Submit for Verification"
Secondary link below: "Start over"

## Step 5: Processing

Step indicator: VISIBLE.
Full-screen white with centered content:

- Spinning circle loader (blue, 40px)
- "Verifying your identity..." in gray-700, medium weight
- "This usually takes a few seconds" in gray-500, small

No button. Non-dismissible.

## Step 6a: Success

Step indicator: VISIBLE.
Full-screen white, centered:

- Large green checkmark icon (48px, green-600)
- Title: "Identity Verified" (gray-900, 24px, semibold)
- Subtitle: "Here's what we captured:" (gray-500)
- White card (rounded-xl, border gray-200) with extracted
  fields as label/value rows:
  Full Name | [value]
  Date of Birth | [value]
  ID Number | [value]
  Expiration | [value]
  Address | [value]
  Label: gray-500 small caps, left-aligned.
  Value: gray-900, right-aligned.
  Thin gray-200 divider between rows.

- Note below card (gray-500, small, italic):
  "This information will be stored in your local wallet
  and is never shared without your permission."

CTA button: "Continue"

## Step 6b: Failure

Step indicator: VISIBLE.
Full-screen white, centered:

- Red X icon (48px, red-600)
- Title: "Verification Failed" (gray-900, 24px, semibold)
- Error message in gray-600: use server-provided reason if
  available, otherwise: "We weren't able to verify your identity.
  This can happen if photos were blurry or didn't match."
- Tip in gray-500, small: "Common fixes: better lighting,
  remove glare, make sure your full face is fully visible."

CTA button: "Try Again" (restarts from Step 1)
Secondary link: "Get help"

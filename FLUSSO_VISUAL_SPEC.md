# FLUSSO — Complete Visual Specification for Ad Production
> Version: April 2026 · Source-accurate description of every screen, animation, feature, and interaction in the Flusso iOS app.

---

## GLOBAL DESIGN LANGUAGE

### Color System
The app supports **dark mode** (default) and **light mode**. All colours below are for **dark mode** unless noted.

| Token | Dark mode hex | Light mode hex | Usage |
|---|---|---|---|
| `bg` | `#0B1F33` | `#F5FAFF` | Screen background |
| `surface` | `#153250` | `#EAF4FF` | Card surfaces |
| `card` | `#153250` | `#EAF4FF` | Cards |
| `border` | `rgba(255,255,255,0.14)` | `#D6E6F5` | Card outlines |
| `text` | `rgba(255,255,255,0.92)` | `#0B1F33` | Primary text |
| `muted` | `rgba(255,255,255,0.68)` | `#5C6F82` | Secondary text |
| `accent` | `#1C7ED6` (Ocean blue, user-changeable) | same | Buttons, highlights |
| `success` | `#2EC4B6` (Teal) | same | Positive states |

**Accent color options (user-selectable in Settings):**
Ocean `#1C7ED6` · Teal `#2EC4B6` · Sky `#38BDF8` · Emerald `#22C55E` · Violet `#A855F7` · Amber `#F97316` · Rose `#F43F5E` · Gold `#FACC15`

Default accent = Ocean Blue `#1C7ED6`.

### Typography
- All fonts are system default (SF Pro on iOS)
- Sizes use a responsive `s()` scaling function — treat as logical `dp`/`pt`
- Common weights: `"900"` (ultra-black headings), `"700"` (bold), `"600"` (semibold), `"500"` (medium)

### Layout Unit: `s()`
`s(1)` ≈ 1 logical pixel at standard phone density. On large phones, slightly larger. On iPad, capped to avoid blowout.

### Navigation Transitions
- All **setup/onboarding screens** transition with **cross-fade** (`animation: "fade"`)
- **Social screens** slide in from the right (`animation: "slide_from_right"`)  
- **Main tab navigation** — no animation (direct swap)
- **Paywall** fades in with `animation: "fade"`

---

## BOTTOM TAB BAR

The custom tab bar is a **floating pill bar** that sits near the bottom of the screen above the safe area.

### Visual Layout
- **Background**: `colors.card` (dark: `#153250`, light: `#EAF4FF`)  
- **Border**: 1px `colors.border`
- **Shadow**: subtle drop shadow using `colors.shadow`
- **Shape**: rounded pill, horizontally centred, does NOT span full width edge-to-edge (has horizontal margins)
- **Height**: approximately 62dp, with internal padding

### Tab Items (left to right)
1. **Home** — icon: `home-outline` (Ionicons)
2. **Tasks** — icon: `checkbox-outline` (Ionicons)
3. **Focus** — CENTER button (see below)
4. **Calendar** — icon: `calendar-outline` (Ionicons)
5. **Account** — icon: `person-circle-outline` (Ionicons)

### Active Tab State
Active tab shows a **"pill" chip** containing the icon + label:
- Background: `colors.overlay` = `rgba(28,126,214,0.15)` — subtle blue fill
- Border: 1px `colors.border`
- Icon size: 18dp, color: `colors.text`
- Label: `fontSize: s(12)`, `fontWeight: "700"`, `color: colors.text`
- Both icon and label side by side inside the pill

### Inactive Tab State
- Icon only (no label), size 22dp, color: `colors.muted` (dimmer)

### Center Focus Button (special, floats above the bar)
- **Shape**: circle, ~52dp diameter
- **Background**: `colors.accent` (Ocean Blue `#1C7ED6`)
- **Icon**: the Flusso app icon (`assets/icon.png`), resized to fit (~32dp)
- **Shadow**: colored shadow using `colors.shadow`
- **Border**: 1px `colors.border`
- Slightly elevated above the bar plane (floats)
- Press: `opacity: 0.9`

### Notification Badge
When there are pending friend requests or shared invites, the **Account tab** shows a red badge:
- Badge: circular red dot `#FF3B30`, positioned top-right of the icon
- Shows count (or "99+") in white text, `fontSize: s(9)`, `fontWeight: "900"`

### Auto-Hide Behavior
The tab bar automatically **slides down** (hides) after inactivity in landscape or scroll, then **springs back** when the user interacts. The animation uses `Animated.spring` with `useNativeDriver: true`.

---

## SCREEN 1 — SIGN IN SCREEN

### Background
Three stacked `LinearGradient` layers, creating a **deep ocean / navy blue** atmosphere:
- **Layer 1 (base)**: `#03045E` → `#023E8A` → `#0077B6`, top-left to bottom-right diagonal
- **Layer 2 (midtone cross-current)**: `transparent` → `rgba(0,150,199,0.45)` → `rgba(72,202,228,0.28)` → `transparent`, crosses opposite diagonal
- **Layer 3 (highlight sweep)**: `rgba(144,224,239,0.18)` → `transparent` → `rgba(0,96,199,0.22)`, upper-right to lower-left

Overall feel: deep underwater blue with soft cyan light refracting from upper-right.

### Screen Background Color (fallback)
`#03045E` — very deep navy

### Layout (vertically & horizontally centred)
Everything is centred inside a single `View`. On iPad: `maxWidth: 480dp`, centered.

**Elements (top to bottom):**

1. **Logo + App Name row** (centered horizontally):
   - Flusso app icon: `64×64dp` (`assets/icon.png`)
   - App name "Flusso": white (`#F4F6F2`), `fontSize: s(36)`, `fontWeight: "600"`, to the right of the icon
   - Row slightly offset: `top: s(-50)`, `right: s(20)` — this means the row appears slightly above center and slightly right-of-center

2. **Hero Illustration**: `assets/AuthScreen.png`
   - Square image, size: `min(s(300), 320)` — approximately 300dp on phone
   - Centered horizontally

3. **"Log In" button** (red):
   - Full width (minus default horizontal padding)
   - `backgroundColor: #db1717` — vivid red
   - White text
   - Rendered via `LoginBox` component

4. **"Sign Up" button** (dark navy):
   - `backgroundColor: #002640` — very dark teal-navy
   - White text
   - Below the Log In button with a small gap

5. **Legal text** (centered, below buttons):
   - Gray-white ~55% opacity
   - "By signing up, you agree to our **Terms of Service** and **Privacy Policy**."
   - **Terms of Service** and **Privacy Policy** are tappable links in a slightly brighter color

### Login/Signup Bottom Sheet (Modal)
When "Log In" or "Sign Up" is tapped, a **bottom sheet** slides up from below:

**Backdrop**: full-screen translucent black overlay; tapping it closes the sheet.

**Sheet animation**: `Animated.timing`, 250ms, slides from `translateY: height` (off-screen bottom) to `translateY: height * 0.35` (sits in the lower ~65% of the screen).

**Sheet Contents** (one of two modes):

**Login mode options:**
1. "Log in with Email" — envelope icon (Fontisto `email`)
2. "Log in with Google" — Google icon (FontAwesome `google`)  
3. "Log in with Apple" _(iOS only)_ — official Apple button (`expo-apple-authentication`), white, pill shape, `height: s(44)`

**Signup mode options:** same layout, "Sign up with..." wording.

**Each option row** (except Apple which uses the native button):
- `TouchableOpacity` with `activeOpacity: 0.85`
- Height: approx 54dp
- `backgroundColor: #fff` (white on dark/light)
- Text: `#000`, `fontSize: s(15)`, `fontWeight: "600"`
- Left icon: outlined icon, `color: #000`, `size: s(20)`
- Icon sits in a small left-side icon wrapper

**Close**: tap the backdrop. Sheet slides back down (250ms).

**Loading states**: "Signing in…" text replaces the Google label during auth.

---

## SCREEN 2 — EMAIL LOGIN / SIGN UP

### Background
`#F4F6F2` — off-white, light mode only (this screen is always light).

### Layout
Safe area view, `KeyboardAvoidingView` (padding mode on iOS).

**Header area** (top of screen, `marginTop: s(20)`, `marginBottom: s(40)`):

1. **Back button**: white circle `40×40dp`, `borderRadius: s(20)`, contains a left-arrow (`Ionicons "arrow-back"`, size `s(24)`, color `#0A1630`). Positioned in top-left.

2. **Title**: `"Create Account"` or `"Welcome Back"` — `fontSize: s(32)`, `fontWeight: "900"`, `color: #0A1630`

3. **Subtitle**: `"Sign up to get started"` or `"Log in to continue to FlowApp"` — `fontSize: s(16)`, `color: #5C6680`, `fontWeight: "600"`

**Form fields** (stacked, `marginBottom: s(24)` between groups):

- **Label**: small uppercase-style label above field, `#5C6680`, `fontSize: s(13)`
- **Input field**: `borderRadius: s(12)`, `backgroundColor: #fff`, `borderWidth: 1`, `borderColor: #D0D8E8`, `height: s(50)`, `paddingHorizontal: s(14)`, text `#0A1630`, placeholder `#8B92A8`
- **Error state**: border changes to red `#FF3B30`, red error text appears below the field

Fields (Sign Up): Email, Password, Confirm Password  
Fields (Login): Email, Password

**Submit button** (full-width, `borderRadius: s(14)`, navy background `#0A1630`, white text, `height: s(52)`):
- Text: `"Sign Up"` or `"Log In"`, `fontSize: s(17)`, `fontWeight: "700"`
- Loading: `ActivityIndicator` (white)
- Press opacity: `0.8`

**Forgot Password link** (Login only, centered below button):
- Text: "Forgot Password?", `color: #1C7ED6`, `fontSize: s(14)`, `fontWeight: "600"`

**Footer** (pinned near bottom of screen):
- "Already have an account? **Log In**" / "Don't have an account? **Sign Up**"
- Toggle link color: `#1C7ED6`

---

## SCREEN 3 — FORGOT PASSWORD

### Background & Layout
Identical to Email Login: `#F4F6F2` light background, same header structure with back button.

**Title**: `"Forgot Password?"` — `fontSize: s(32)`, `fontWeight: "900"`, `color: #0A1630`  
**Subtitle**: `"Enter your email address and we'll send you a link to reset your password"` — `color: #5C6680`

**Form**: single "Email" field, same styling as Email Login.

**CTA button**: `"Send Reset Email"`, same navy style as login button.

**Success state** (after sending):
- The entire form is replaced with:
  - Large green checkmark icon: `Ionicons "checkmark-circle"`, size `s(64)`, `color: #22C55E`, centered
  - Success message text: gray, multi-line, explaining check spam folder
  - `"Back to Login"` button: same navy style

---

## SCREEN 4 — VERIFY EMAIL

### Background
`#F4F6F2` — same white. Screen has `SafeAreaView`.

### Layout (centered card)
On iPhone: full width with padding. On iPad: `maxWidth: 480dp`, centered.

**Elements (top to bottom, centered):**

1. **Icon**: `Ionicons "mail-unread-outline"`, size `s(48)`, color `#1C7ED6` (Ocean blue)

2. **Title**: `"Verify your email"`, `fontSize: s(28)`, `fontWeight: "900"`, `color: #0A1630`

3. **Body text**: multi-line, mentions the user's email address (bold), instructions to click link, check spam

4. **Primary CTA button** (blue, full-width):
   - Label: `"I've verified"` with `Ionicons "checkmark-circle-outline"` icon left
   - Color: `#1C7ED6`, `height: s(52)`, rounded, white text
   - Loading: spinner

5. **Resend button** (outlined/ghost, full-width):
   - Label: `"Resend verification email"` with refresh icon
   - Color: `#1C7ED6` (teal-blue border + text)
   - Cooldown state: `"Resend in 60s"` in gray

6. **Footer row** (two links separated by `·`):
   - `"Verify later"` — right-arrow icon, gray
   - `"Log out"` — log-out icon, gray

---

## SCREEN 5 — ONBOARDING FLOW (Q0–Q9)

All 10 screens share:
- **Background**: triple `LinearGradient` layers in deep blue-purple gradients
- **Screen transitions**: cross-fade (no slide), 380ms
- **CTA button** (shared style): full-width minus 40dp, `height: s(48)`, `borderRadius: s(14)`, `backgroundColor: #F4F6F2` (white), dark text, `fontWeight: "700"`, anchored to safe-area bottom + `s(16)`

---

### Q0 — Welcome Splash
**Background**: `#000612` → `#010E48` → `#052480` (deep navy), plus overlays.

**No buttons, no interaction** — pure auto-advancing cinematic intro.

**Elements (all centered):**
1. `"WELCOME TO"` — all caps, `rgba(244,246,242,0.65)`, `fontSize: s(13)`, `fontWeight: "600"`, `letterSpacing: s(2.5)`, `marginBottom: s(22)`
2. **App icon** — `assets/icon.png`, `90×90dp`, `borderRadius: s(22)`, `marginBottom: s(18)`
3. **Brand name "Flusso"** — two text nodes in a row: `"Flu"` + `"sso"`, Manrope, `fontSize: s(54)`, `fontWeight: "700"`, `letterSpacing: s(-1.5)`, color `#F4F6F2`

**Animation sequence:**
- **t=0ms**: Screen fades in from black (380ms)
- **t=260ms**: "WELCOME TO" drops from `translateY: -s(12)` + fades in (310ms)
- **t=750ms**: Logo **springs** in — scale `0.55 → 1` + fade (280ms); spring `friction 5, tension 80`
- **t=1270ms**: "Flu" slides in from `translateX: -s(56)`, "sso" from `+s(56)`, both reach 0 (430ms ease-out); name fades simultaneously
- **t=2770ms**: Screen fades to black, auto-navigates to Q1

#### Designer Recreation Brief (Video-Production Ready)

Use this when recreating the intro as a standalone motion piece for ad/editorial video.

**Intent and mood**
- Tone: premium, calm, "deep-water" minimalism.
- Visual pacing: deliberate reveal in three beats (context -> icon -> brand lockup).
- Motion language: soft ease-outs + one organic spring moment (logo arrival).

**Master frame and safe composition**
- Primary design frame: portrait `1080x1920`.
- Keep all key title/logo/name elements inside a centered safe region of `1080x1420` (about 250px top and bottom breathing room).
- Horizontal center is strict for all three elements.
- Vertical rhythm (relative, from top of the content block):
  - Line 1 (`WELCOME TO`)
  - 22dp gap
  - Icon block (`90dp` square)
  - 18dp gap
  - Wordmark line (`Flu` + `sso`)

**Sizing spec (from source implementation)**
- Source scale unit is `s()` (phone baseline width 350).
- On a common modern phone width (~390pt), multiply by `~1.114`.
- Practical phone render equivalents:
  - `WELCOME TO` size: `s(13)` -> ~14.5pt
  - Icon visible size: `s(90)` -> ~100pt square
  - Icon corner radius: `s(22)` -> ~24.5pt (about 24% roundness relative to icon width)
  - Brand text size: `s(54)` -> ~60pt
  - Initial text Y offset: `s(12)` -> ~13pt upward
  - Split reveal X offsets: `s(56)` -> ~62pt left/right
- Icon source file: `assets/icon.png`, intrinsic raster `1536x1024`.
  - In-app display crops to rounded square via view bounds.
  - For motion recreation, treat icon as a rounded-square tile, centered, no stroke.

**Typography and lockup**
- Line 1: uppercase tracking headline
  - Content: `WELCOME TO`
  - Color: `rgba(244,246,242,0.65)`
  - Weight: 600
  - Tracking: `s(2.5)` (wide, airy)
- Brand line:
  - Text split into two animated chunks: `Flu` and `sso`
  - Font: Manrope (fallback: SF Pro Display Semibold if unavailable)
  - Weight: 700
  - Color: `#F4F6F2`
  - Tracking: slight negative (`s(-1.5)`) for a compact premium wordmark feel

**Background construction (3-layer gradient stack)**
- Base gradient (full frame):
  - Colors: `#000612` -> `#010E48` -> `#052480`
  - Direction: top-left to bottom-right (`start 0,0` -> `end 1,1`)
- Overlay gradient 1 (full frame):
  - Colors: `transparent` -> `rgba(0,90,200,0.48)` -> `rgba(30,150,230,0.30)` -> `transparent`
  - Direction: upper-right sweep to lower-left (`start 1,0.15` -> `end 0,0.85`)
- Overlay gradient 2 (full frame):
  - Colors: `rgba(60,160,255,0.20)` -> `transparent` -> `rgba(0,50,200,0.26)`
  - Direction: upper-mid to lower-left (`start 0.6,0` -> `end 0.1,1`)

**Motion choreography (exact order from app)**
- Stage 0: Global scene fade-in
  - Property: whole content group opacity `0 -> 1`
  - Duration: `380ms`
  - Ease: linear timing (default)
- Stage 1: "WELCOME TO" entrance
  - Start: after `260ms` delay
  - Opacity: `0 -> 1` over `310ms`
  - Position: `Y -s(12) -> 0` over `310ms`
  - Ease: `out(quad)`
- Stage 2: Icon entrance (hero beat)
  - After `180ms` pause
  - Opacity: `0 -> 1` over `280ms`
  - Scale: `0.55 -> 1.00` with spring
  - Spring feel: medium snap, soft settle (`friction 5`, `tension 80`)
- Stage 3: Wordmark split reveal
  - After `240ms` pause (post logo settle)
  - Opacity of whole wordmark: `0 -> 1` over `280ms`
  - Left chunk (`Flu`): `X -s(56) -> 0` over `430ms`
  - Right chunk (`sso`): `X +s(56) -> 0` over `430ms`
  - Ease: `out(quad)`
- Hold
  - Final composed frame hold: `1500ms`
- Outro
  - Whole content opacity `1 -> 0` over `360ms`
  - Immediately transitions to next onboarding screen

**Timing map for editors (approx, at 30fps)**
- 00:00-00:11: scene fade-in
- 00:08-00:17: `WELCOME TO` reveal (overlaps with scene fade)
- 00:23-00:33: icon pop/spring
- 00:38-00:51: `Flu | sso` converge + fade
- 00:52-01:37: hold
- 01:38-01:48: fade out
- Total clip length target: ~`4.8s` (spring solver may vary by a few frames)

**Rendering notes for professional recreation**
- Keep motion blur subtle or off for UI-faithful recreation.
- Do not add extra glows, lens flares, or particle effects; original is clean and restrained.
- Preserve centered symmetry; perceived quality depends on precise alignment.
- If producing 16:9 exports, center-crop from a taller master and preserve full logo + wordmark stack.

---

### Q1 — Name Entry
**Background**: Same navy gradient as Q0.

**Progress bar** (top of screen, safe area + `s(12)`):
- Track: full width minus 40dp, `height: s(6)`, pill shape, `backgroundColor: #0c4191`
- Fill: `width: "11%"`, `backgroundColor: #F4F6F2` (white)
- Label: `"1 of 9"`, right-aligned, `color: rgba(244,246,242,0.8)`, `fontSize: s(12)`, below track

**Content** (`marginTop: safe area + s(70)`):
1. **Question**: `"What's your name?"` — `#F4F6F2`, `fontSize: s(28)`, `fontWeight: "700"`
2. **Subtitle**: personalization note — 60% white, `fontSize: s(13)`
3. **Text input**: `height: s(52)`, `borderRadius: s(14)`, `paddingHorizontal: s(14)`, background `rgba(255,255,255,0.10)` (glass), white text, placeholder "Enter your name" at 50% opacity

**CTA**: `"Next"` — standard white button, disabled (`opacity: 0.45`) when fewer than 2 characters.
- Text color: `#002640`

**Transition overlay** (on submit):
- Full-screen `#000612` fades in over 250ms
- Centered message fades in + rises from +12dp: `"Alright [name]. Let us look at your focus."` — `#F4F6F2`, `fontSize: s(24)`, `fontWeight: "700"`, centered, `lineHeight: s(32)`, `paddingHorizontal: s(32)`
- After 900ms, navigates to Q2

---

### Q2 — Movement (Animated Task Theater)
**Background**: teal/dark-cyan gradient — `#001820` → `#003840` → `#006065`.

**No progress bar. Full-screen animation.**

Content area slides up from +24dp on mount (420ms ease-out).

**Center stage** (vertically centered, `gap: s(28)` between sections):

**5 task "pill" cards** stacked vertically with `gap: s(10)`, centered:
- Each: `minWidth: s(196)`, `paddingHorizontal: s(18)`, `paddingVertical: s(11)`, `borderRadius: s(10)`
- Background: `#0f3f87` (solid mid-blue), border `1px rgba(255,255,255,0.14)`
- Text: `#F4F6F2`, `fontSize: s(14)`, `fontWeight: "600"`, centered
- Labels: "reply emails" / "complete assignment" / "prepare meeting" / "organize notes" / "read article"
- **Fade in one by one**, staggered 300ms, 320ms duration per card

**Strikethrough animation** on each card:
- A horizontal bar: `height: s(2)`, `rgba(244,246,242,0.80)`, centered in the bubble
- Animates `scaleX: 0 → 1` (expands from left), 300ms per card, staggered 180ms apart
- Creates the visual of tasks being crossed off one by one

**Progress section** (appears after all strikes complete):
- `"TODAY'S PROGRESS"` label — `rgba(244,246,242,0.45)`, `fontSize: s(11)`, uppercase, `letterSpacing: 1`
- Track: `width: 240dp`, `height: s(6)`, pill, `rgba(255,255,255,0.10)` background
- Fill: animates from 0 → ~15% wide (36dp of 240dp), 1100ms ease-out, `rgba(244,246,242,0.50)` (50% white)

**3 cycling narrative captions** (bottom of stage):
- Pill background: `rgba(2,12,55,0.82)`, `borderRadius: s(12)`, `paddingHorizontal: s(20)`, `paddingVertical: s(12)`
- Each fades in + rises 10dp (350ms), holds ~1950ms, fades out 300ms
1. `"You start the day with a full list."`
2. `"One by one, tasks get done."`
3. `"But what actually moved forward?"`

**Final punchline**: `"Movement does not always mean progress."` — `#F4F6F2`, centered, `fontWeight: "700"`

**CTA**: `"Continue"` — white standard button, text color `#002640`.

---

### Q3 — Why (Scattered Tasks / The Void)
**Background**: deep navy-indigo — `#020B30` → `#05186A` → `#082490`, plus overlays. Content slides up +24dp.

**Center canvas**: ~260×260dp, centered.

**5 task chips** positioned absolutely, scattered with rotations:
- Each: `paddingHorizontal: s(16)`, `paddingVertical: s(9)`, `borderRadius: s(10)`, background `#0d2845` (dark navy), border `1px rgba(140,100,255,0.35)` (purple tint)
- Text: `#F4F6F2`, `fontSize: s(13)`, `fontWeight: "600"`
- Same 5 task labels as Q2, scattered at various angles (-19° to +15°)
- All fade in to **55% opacity** (not full), staggered 220ms

**Ghost objective card** (absolute, centered in canvas):
- `width: s(190)`, `paddingHorizontal: s(20)`, `paddingVertical: s(16)`, `borderRadius: s(14)`
- Background: `rgba(255,255,255,0.04)` (nearly invisible translucent white)
- Border: `1px rgba(160,110,255,0.50)` — medium purple
- Content: `"OBJECTIVE"` (small caps, 70% purple) + horizontal divider + `"???"` (20% white, large spacing)
- Springs in (scale `0.82→1` + fade) between narrative lines 1 and 2
- Fades out before narrative line 2 ends

**Animation sequence**: same 3-caption cycle pattern as Q2, tasks dim to 12% at the end.

**Final punchline**: `"Scattered effort rarely produces meaningful progress."`

---

### Q4 — Quote (Motivational Quote)
**Background**: deep purple/violet — `#0C0020` → `#200048` → `#360070`.

**Progress bar**: `height: s(4)`, fill `"44%"`, lavender `rgba(200,160,255,0.70)`, no step counter.

**Content** (slides up +28dp):

1. **Quote card** (slides up 32dp + fades):
   - `borderRadius: s(20)`, `paddingVertical: s(24)`, `paddingHorizontal: s(22)`
   - Background: `rgba(100,40,255,0.10)` (faint purple glass)
   - Border: `1px rgba(180,140,255,0.22)` (soft purple)
   - **Quote text**: `"You'll never change your life until you change something you do daily."` — `#F4F6F2`, `fontSize: s(20)`, `fontWeight: "900"`, `lineHeight: s(28)`
   - **Accent stripe**: `marginTop: s(16)`, `width: s(48)`, `height: s(3)`, full-pill, `rgba(200,160,255,0.80)` (bright lavender)
   - **Attribution**: `"— John C. Maxwell"` — 55% white, `fontSize: s(13)`, `fontWeight: "700"`, `marginTop: s(10)`

2. **Support text**: `"Daily actions shape long-term outcomes."` — 88% white, `fontSize: s(16)`, `fontWeight: "600"`

3. **Prompt text**: `"Let us define what consistent focus looks like for you."` — 55% white, `fontSize: s(14)`

**CTA**: `"Continue"`, text color `#0E0340` (very dark purple).

---

### Q5 — Reflection (Multi-Select)
**Background**: deeper violet/magenta — `#0A0018` → `#1A0038` → `#2C0058`.
**Progress bar fill**: `"55%"`, same lavender style.

**Question**: `"When focus works best for you, what usually helps?"` — `#F4F6F2`, `fontSize: s(24)`, `fontWeight: "800"`

**5 selectable option cards** (gap `s(12)`):

**Default state:**
- `minHeight: s(54)`, `borderRadius: s(14)`, `paddingHorizontal: s(16)`, `paddingVertical: s(14)`
- Background: `rgba(110,60,200,0.22)` (muted purple glass)
- Border: `1px rgba(180,140,255,0.20)`
- Text: `#F4F6F2`, `fontSize: s(15)`, `fontWeight: "600"`, on the left
- Checkbox circle on the right: `26×26dp`, `borderRadius: s(13)`, 2px border `rgba(200,160,255,0.35)` (empty ring)

**Selected state:**
- Border widens to 2px, brightens: `rgba(210,180,255,0.85)`
- Background: `rgba(150,100,255,0.28)` (more saturated)
- Checkbox: filled white `#F4F6F2`, checkmark `Ionicons "check"` inside, color `#120840` (dark purple)

**Options (top to bottom):**
1. "Clear priorities"
2. "Time blocks for deep work"
3. "Visible progress"
4. "A quiet environment"
5. "A strong goal or purpose"

**Multi-select**: any combination allowed. CTA disabled (`opacity: 0.4`) when nothing selected.

---

### Q6 — Directed Focus (Animated Task-Objective Sorting)
**Background**: deep indigo — `#0D0530` → `#180860` → `#240C90`. No progress bar.

**Fixed canvas**: 310dp wide × 400dp tall, centered.

**3 Objective cards** (absolute positioned, spring in staggered 140ms):
- `height: s(46)`, `borderRadius: s(10)`, 1px border
- Eyebrow: `"OBJECTIVE"` — `rgba(255,255,255,0.52)`, `fontSize: s(8)`, uppercase, `letterSpacing: s(1.2)`
- Title: `#F4F6F2`, `fontSize: s(13)`, `fontWeight: "700"`

| Card | Color | Label |
|---|---|---|
| Top-left (narrow) | Red `rgba(190,50,70,0.88)` / pink border | "Get Fit" |
| Right-center (wide) | Purple `rgba(80,20,200,0.88)` / lavender border | "Ace Calculus Finals" |
| Bottom-left (medium) | Blue `rgba(12,72,180,0.88)` / sky border | "Save Money" |

**9 task chips** (absolute positioned, animate flying to their objective cards):
- `height: s(28)`, `borderRadius: s(8)`, `backgroundColor: rgba(58,32,162,0.85)` (uniform purple), 1px border
- Text: `rgba(244,246,242,0.92)`, `fontSize: s(11)`
- Under "Get Fit": "Chest day", "Meal Prep", "Morning run"
- Under "Ace Calculus Finals": "Review Notes", "Past Finals", "Study group"
- Under "Save Money": "Make Budget", "Track Expenses", "Make a Portfolio"
- Chips **fly across the canvas** to land under their objective card with spring animation

---

### Q7 — Model (Focus Level Selector)
**Background**: deep purple-to-black. Progress bar `"66%"`.

**Content**: the user selects their daily focus commitment level.

**4 option cards**, tappable (single-select):
- Large cards with ~`height: s(78)`, `borderRadius: s(16)`, full width
- Default: glass-tint background, 1px border
- Selected: `borderWidth: 2`, accent-colored border + slightly brighter background
- Each card contains: level name (large bold), daily minutes subtitle (muted)

**Options:**
1. **Casual** — 30 min/day
2. **Regular** — 60 min/day
3. **Serious** — 120 min/day
4. **Determined** — 180 min/day

CTA: `"Continue"` — white button.

---

### Q8 — Focus Commit
**Background**: deep navy. Progress bar `"88%"`.

Summarizes the user's commitment. CTA confirms and moves to Q9.

---

### Q9 — Closing
**Background**: same deep navy. Progress bar at `"100%"` (full).

Closing message / motivational wrap-up. CTA: `"Start Flusso"` or similar — navigates to Main App.

---

## SCREEN 6 — PAYWALL

### Background
Two gradient layers:
- **Base**: `#000612` → `#010E22` → `#000A18` — very deep dark navy, near-black
- **Teal atmospheric glow**: `rgba(46,196,182,0.13)` fading from top-center, stopping at ~45% height

### Entrance Animation
On mount: `opacity: 0→1` (500ms) + `translateY: 32→0` (500ms), using `Animated.parallel`.

### Scroll Layout (single centered column, `paddingTop: safeArea + s(28)`)
Max width on iPad `480dp`, centered. Phone: full width with `paddingHorizontal: s(22)`.

**Elements (top to bottom):**

1. **"Most Popular" badge pill** (centered, top of column):
   - Background: `rgba(255,184,0,0.12)` — amber glow
   - 1px amber border
   - Icon: `Ionicons "flame"`, `s(12)`, `color: #FFB800` (gold)
   - Text: `"MOST POPULAR  ·  14-DAY FREE TRIAL"`, uppercase, amber, `fontSize: s(11)`, `fontWeight: "800"`, `letterSpacing: 1`

2. **Hero headline** (two lines, left-aligned):
   - Line 1: `"Unlock everything."` — `#F4F6F2`, `fontSize: s(30)`, `fontWeight: "900"`
   - Line 2: `"Start your 14-day free trial."` — `#F4F6F2`, `fontSize: s(22)`, `fontWeight: "700"`, slightly muted (80%)

3. **Social proof row** (centered):
   - 5 star emojis ⭐⭐⭐⭐⭐
   - Text: `"  Loved by focused people everywhere"` — muted white, `fontSize: s(13)`

4. **Benefits card** (full-width card):
   - Background: `rgba(46,196,182,0.06)` — very faint teal
   - Border: `1px rgba(46,196,182,0.18)` — subtle teal
   - `borderRadius: s(18)`, `padding: s(4)`
   - **5 benefit rows**, each separated by a hairline divider:

   | Icon (`#2EC4B6` teal) | Title (white, bold) | Subtitle (muted) |
   |---|---|---|
   | `flash` | Deep Focus, on demand | Unlimited sessions + ambient audio |
   | `trophy` | Goals that actually stick | Objectives, tasks & progress tracking |
   | `calendar` | Your life in one place | Events, birthdays & smart reminders |
   | `musical-notes` | Spotify, built right in | Your playlist, synced to your flow |
   | `people` | Accountability network | Friends, shared goals & social streaks |
   
   Each row: icon on left in small teal circle, text in center column, `checkmark-circle` (teal, 70% opacity) on far right.

5. **"CHOOSE YOUR PLAN"** label — `rgba(244,246,242,0.50)`, uppercase, small, centered, `letterSpacing: 1`

6. **Two plan cards** (side by side, equal width):

   **Annual card (left, recommended):**
   - `"BEST VALUE"` or `"SAVE X%"` badge at top — teal `#2EC4B6`, pill-shaped
   - Radio button in top-left corner (filled teal when selected)
   - `"Yearly"` label — white, `fontWeight: "700"`
   - Price: large bold white, e.g. `"$39.99/year"`
   - Breakdown: `"Only USD 0.77/week"` — muted, small
   - When selected: `borderWidth: 2`, `borderColor: #2EC4B6` + `backgroundColor: rgba(46,196,182,0.10)`

   **Monthly card (right):**
   - No special badge
   - `"Monthly"` label
   - Price: `"$6.99/mo"`, `/mo` in smaller secondary size
   - When selected: same teal border/glow

7. **Primary CTA button** (full-width):
   - `LinearGradient` fill: `#2FD9CA → #1EB8AB` (left to right): a bright teal-to-teal gradient
   - `borderRadius: s(14)`, `height: s(56)`
   - Icon: `Ionicons "arrow-forward"`, `s(18)`, `color: #001A18` (very dark teal-near-black)
   - Label: `"Start My 14-Day Free Trial"` — dark text `#001A18`, `fontSize: s(17)`, `fontWeight: "900"`
   - Loading: `ActivityIndicator` dark color
   - Disabled: `opacity: 0.5`

8. **Sub-label** (centered, below CTA):
   - `"Then $39.99/year — cancel anytime"` — muted white, `fontSize: s(13)`

9. **Trust pills row** (3 pills, centered, horizontal):
   - Each pill: `borderRadius: s(18)`, `borderWidth: 1`, `borderColor: rgba(46,196,182,0.22)`, background `rgba(46,196,182,0.07)`
   - Teal icon + small text
   - `"Secure payment"` · `"Cancel anytime"` · `"No hidden fees"`

10. **Restore purchases** link — teal text, centered, `fontSize: s(14)`

11. **Legal row** — `"Terms · Privacy Policy"`, tiny muted links

12. **"Sign out & go back"** — bottom, very faint `← Sign out & go back`, gray, `fontSize: s(13)`

---

## SCREEN 7 — DASHBOARD (Home)

### Background
`colors.bg` — dark: `#0B1F33`, light: `#F5FAFF`

### Layout
`SafeAreaView` with `edges: ["top"]`, `ScrollView` with `padding: spacing.lg` (~16dp), `paddingBottom: s(100)` (clearance for tab bar).

**Header row** (top of scroll content):
- Left: 
  - `"Dashboard"` — `colors.text`, `fontSize: s(22)`, `fontWeight: "900"`
  - Below: `"{greeting}, {name}"` — `colors.muted`, `fontSize: s(14)`, single line. Greeting = "Good Morning/Afternoon/Evening" based on hour.
- Right: **search button** — `IconCircleButton` with `Ionicons "search"` icon

**Quote of the Day** (below header):
- Quote text: `colors.text`, `fontSize: s(15)`, `fontWeight: "600"`, italic-style, max 3 lines, `"…"`
- Attribution: `"— Author"`, `colors.muted`, `fontSize: s(13)`

**Stats Row (phone layout — 2 cards top, 1 full-width below):**

Top-left: **Streak card**
- Background: `colors.card` with orange icon circle `rgba(255,159,64,0.15)`
- Icon: `Ionicons "flame"`, `s(22)`, color `#FF9F40` (orange-gold)
- Number: current streak days, `colors.text`, `fontWeight: "900"`, `fontSize: s(20)`
- Label: `"X days streak"` or `"1 day streak"`, `colors.muted`, `fontSize: s(13)`
- **Not tappable** (static)

Top-right: **Focus Minutes card** (tappable → Focus tab)
- Orange circle replaced by accent-tinted circle with `Ionicons "timer-outline"` in accent color
- Number: minutes focused today
- Label: `"minutes focused"`
- `opacity: 0.9` on press

Bottom (full-width): **Tasks Completed card** (tappable → Tasks tab)
- Teal circle: `rgba(75,192,192,0.15)` with `Ionicons "checkmark-circle"`, `#4BC0C0`
- `"{X} tasks completed today"`
- Right: `Ionicons "chevron-forward"` in muted color

**Stats Row (iPad layout — 3 cards side by side):**
All three in a single `flexDirection: "row"`, `gap: s(10)`. Same styles as above.

**iPad Quick Access Grid (tablet only)** — 2×2 grid of action tiles:
- Each tile: `borderRadius: radius.xl`, `backgroundColor: colors.card`, `padding: s(20)`, `gap: s(10)`
- Icon in a colored circle (44dp), bold title, muted subtitle
- Tiles: **Focus Zone** (accent/blue), **My Tasks** (teal), **Calendar** (indigo `#6366F1`), **Settings** (amber)

**"Up Next" Card**:
- `Card` component: `backgroundColor: colors.card`, border, rounded
- Header: `"Up Next"` (left, bold) + `"See More"` link (right, accent color)
- **If a task exists**: task row with:
  - Empty circle checkbox on left (border: accent color)
  - Task title, bold, `colors.text`
  - Optional badges: `"Today"` badge (accent tint + icon) or importance flag
  - `Ionicons "chevron-forward"` on right
- **If no tasks**: `"Add your first task"` row with + circle icon (accent)

**Primary CTA Button** (full-width, at bottom of scroll):
- `PrimaryButton` component: dark background (from theme), white text
- Left icon: `Ionicons "flash"`, `s(18)`, `colors.bg` (inverted)
- Label: `"Start Focus Session"`
- `borderRadius: radius.xl`
- Taps → navigates to Focus tab

### Add Task Bottom Sheet (opens from "Up Next" empty state or add action)
`BottomSheet` component — slides up from bottom with `animationType: "slide"` (iOS native).

**Backdrop**: `rgba(0,0,0,0.55)`, tapping it closes the sheet.

**Sheet**: `backgroundColor: colors.card`, top corners rounded `radius.xl`, `maxHeight: 90%`, scrollable.

Sheet content:
- **Header row**: `"Add task"` (bold, `colors.text`) + `"×"` close button (right)
- **Title field**: label `"Title"` + text input, `borderRadius: radius.lg`, glass surface
- **Notes field** (optional): multiline text input, `height: s(86)`
- **Row with two dropdowns** (side by side):
  - `"Objective"` — shows selected objective name, chevron toggle
  - `"Date"` — shows date or `"No date"`, chevron toggle

When "Objective" dropdown opens — inline list of objective chips appears below:
When "Date" dropdown opens — horizontal date picker row appears (days of the week + offset)

- **Save button**: accent-colored, full-width, `"Save"` label

---

## SCREEN 8 — TASKS & OBJECTIVES

### Background
`colors.bg` — dark: `#0B1F33`, light: `#F5FAFF`

### Top Navigation
- **Title**: `"Tasks"` (left) with segmented control toggle between `"Tasks"` and `"Objectives"` modes
- Segmented control: rounded pill tabs, active tab has accent fill, inactive muted

### Tasks Mode

**Sort/Filter Tabs** (horizontal pill tabs below header):
- `"My Day"` · `"Important"` · `"Objectives"` · `"Planned"`
- Active: accent background, white text; Inactive: muted background

**Task List** (SectionList):
- Sections: `"Overdue"` · `"Today"` · `"Tomorrow"` · `"Upcoming"` · `"Later"`
- Section headers: uppercase, muted, `fontSize: s(11)`, `fontWeight: "800"`, `letterSpacing: 1.1`

**Each Task Row** (`Animated.View`):
- Background: `colors.surface`, `borderRadius: radius.xl`, 1px `colors.border`, `padding: s(12)`
- **Left**: circle checkbox (`26×26dp`, `borderRadius: s(13)`, 2px border in objective's color)
- **Center**: task title (bold `s(15)`) + metadata row below
- **Metadata row**: objective bookmark pill + date pill (color-coded: red=overdue, blue=today, neutral=other) + delete button
- **Right**: edit pencil icon + star icon (filled gold `#FFD700` if importance ≥ 3, outline if not)

**Task completion animation:**
1. Checkbox fills with green `#4CAF50` + checkmark appears
2. `Animated.parallel`:
   - Scale: `1 → 1.1 → 0.8` (bounce then shrink)
   - Opacity: `1 → 0` (fades out, 350ms with 150ms delay)
3. Audio: `Completed.mp3` plays at `0.7` volume
4. After animation, `onToggleDone` fires and row disappears

**Star / Importance toggle**: tap star → Ionicons "star" (filled gold) ↔ "star-outline" (muted)

**+ Add Task FAB** (floating action, bottom-right of screen): circular, accent color, `"+"` icon

**Add/Edit Task Bottom Sheet**: same `BottomSheet` component as Dashboard, with additional fields: **Importance** (4 options: Low/Medium/High/Critical) + **Objective** picker + **Date** picker

### Objectives Mode

**Each Objective Card**:
- Full-width card, `borderRadius: radius.xl`, left accent stripe in the objective's color
- Colored circle icon with initials or category icon
- Title (bold) + category label + progress stats (`"X/Y tasks"`)
- Progress bar: thin horizontal bar, fill in objective's color, track in border color
- Chevron → expands task list below

**Objective color palette** (user-selectable when creating):
Blue `#007AFF` · Teal `#21afa1` · Green `#34C759` · Yellow `#FFCC00` · Orange `#FF9500` · Red `#FF3B30` · Gray `#8E8E93` · Purple `#AF52DE`

**Create Objective Bottom Sheet** (full-featured):
- Title input
- Category picker: Academic / Career / Personal / Health & Fitness / Skill Development / Creative / Misc
- Color picker: 8 colored circles, tap to select, selected one has a white ring
- Optional: share with friends (friend picker list)

**Shared Objectives** (if any):
- Shows member avatars overlapping (grouped)
- "Vote to complete" button (social voting UI)

**Training Plans** (special tab within Objectives):
- Planning wizard to create workout plans with sessions and exercises
- Each plan shows as a card with session breakdown

**Habits** (another section):
- Habit cards with frequency settings and completion dots

---

## SCREEN 9 — FOCUS ZONE

### State 1: Room Selection Screen

**Background**: `assets/focus/mountainMOB.png` (mountain image) as `ImageBackground`
- **Gradient overlay**: `rgba(0,0,0,0.22)` → `rgba(0,0,0,0.88)`, top-to-bottom — makes the image dark at bottom

**Top Bar**:
- Pill-shaped back button: `"← Dashboard"` — background `rgba(255,255,255,0.10)`, border `rgba(255,255,255,0.14)`, white text, `borderRadius: s(20)`, `paddingHorizontal: s(14)`, `paddingVertical: s(8)`

**Content (scrollable list)**:
- Title: `"Choose Your Focus Room"` — white, `fontSize: s(24)`, `fontWeight: "800"`
- Subtitle: `"Select an environment to begin"` — `rgba(255,255,255,0.55)`, `fontSize: s(14)`
- `"Training Room"` link pill (teal): for scrolling to that option

**Room Cards** (5 environment cards + 1 Training Room card):

Each room card:
- `Pressable`, `height: ~180dp` (flexible), `borderRadius: s(18)`, full-width minus padding
- `ImageBackground` with room photo (fills card), border radius applied to image
- **Gradient overlay on image**: `rgba(0,0,0,0.08)` → `rgba(0,0,0,0.78)`, top to bottom
- Bottom-right of card:
  - Room name: `"Mountain"` / `"Forest"` / `"Ocean"` / `"Space"` / `"Skyline"`, white, `fontSize: s(20)`, `fontWeight: "800"`
  - `"Enter Room →"` button: pill-shaped, `backgroundColor: rgba(255,255,255,0.22)`, border `rgba(255,255,255,0.35)`, white text + right arrow icon

**Training Room card** (special, last in list):
- No photo — gradient only: `#070e1e → #0c1a34 → #0a1625` (very dark navy)
- `borderRadius: s(18)`
- Left: barbell icon in a `rgba(74,157,255,0.18)` circle (blue tinted) + `"Training Room"` label + `"Set-based workout execution"` subtitle (very muted)
- Right: `"Enter Room →"` same button style
- Press `opacity: 0.9`

**Gap between cards**: `gap: s(14)`

---

### State 2: Inside a Focus Room (Portrait)

**Background**: selected room image as `ImageBackground` + `rgba(0,0,0,0.22)→rgba(0,0,0,0.88)` overlay

**Top Bar** (3 pill buttons in a row):
1. `"← Leave Room"` — standard semi-transparent pill
2. **Spotify pill** — when disconnected: gray; when connected: `rgba(29,185,84,0.22)` background + `rgba(29,185,84,0.35)` border, Spotify green `#1DB954` icon, text `#76eea0` (light green)
3. `"Settings"` pill with `Ionicons "options-outline"`

**Spotify Mini Player** (when connected, below top bar):
- Full-width minus padding, appears as a small card
- Album art (square thumbnail left) + track name + artist + playback controls

**Timer Card** (center, fills remaining space):
- `Pressable` — tap entire card to start/pause timer
- `backgroundColor: rgba(255,255,255,0.06)` (glass effect), `borderRadius: s(24)`, `padding: s(20)`
- Top: **phase tag** — `"Work"` / `"Break"` / task name label, small pill style

**Timer display** (center of card, very large):
- **Countdown (Pomodoro)**: `MM:SS` format — e.g. `"25:00"`, `fontSize: s(76)`, white, `fontWeight: "900"`, `letterSpacing: -1`
- **Stopwatch (Timer mode)**: `H:MM:SS` format, `fontSize: s(56)` (slightly smaller)
- **Clock mode**: current time (12h or 24h), `fontSize: s(76)`
- When hidden: no timer shown, only `"Tap to start"` text in very faint white

**Running indicator row** (below timer number):
- Small dot: when stopped = `rgba(255,255,255,0.35)` static; when running = `rgba(74,255,157,0.90)` **pulsing green dot**
- Sub-label: `"Focusing…"` / `"Recovering…"` / `"Tap to start"` / `"Session ended · tap to restart"`, muted white

**Reset button** (below timer, when visible):
- `"↺ Reset timer"` or `"↺ Reset session"` — small, `opacity: 0.55`, white

**Bottom control strip** (below timer card):
- **3 `AnimToggle` buttons** in a row:
  1. **Music** — `Ionicons "musical-notes"` or `"volume-mute"`. ON = plays ambient music OFF = muted
  2. **Visible / Hidden** — `Ionicons "eye"` or `"eye-off"`. Controls timer visibility
  3. **Timer / Clock** — `Ionicons "time-outline"` or `"stopwatch-outline"`. Switches display mode
  
  Each `AnimToggle`:
  - Pill shape, ~`height: s(40)`, rounded, icon + label
  - OFF state: `rgba(255,255,255,0.12)` tint, muted
  - ON state: brighter background `rgba(255,255,255,0.22)`, white border, white text
  - Toggle animation: `Animated.spring` on background color interpolation

**Pomodoro Phase Dot** (optional): shows `"Work"` dots bar under the phase tag when multiple sessions tracked

---

### Landscape (Immersive) Layout

**Left column**: timer fills the left ~60% of screen, very large
**Right column** (controls, 40% width):
- Leave / Settings pills
- Spotify pill
- Spotify mini player (if connected)
- Phase label (e.g., `"WORK"` all caps, muted)
- 3 AnimToggles in a row

**Immersive mode button** (bottom-right corner): `Ionicons "expand-outline"` / `"contract-outline"`
- Tap: controls column fades out + rises (`translateY: -12dp`), timer font scales up to fill screen
- Animation: `Animated.spring`, `tension 65, friction 14`
- Timer font in immersive: up to 62% screen height (massive)

**Album art background** (landscape + immersive + Spotify connected):
- Fades in behind the timer after entering immersive mode
- `Animated.timing`, 600ms

---

### Focus Room Leave Confirmation Modal

When leaving mid-session, a modal appears:
- Centered overlay card, `borderRadius: s(20)`, dark background
- `"Leave Focus Room?"` title
- Warning message
- Two buttons: `"Cancel"` (ghost) + `"Leave & Save"` (accent/red)

### Focus Room Tutorial (first time entering)
Full-screen overlay with tooltips showing how to use the timer.

### Settings Panel (Modal)
Slides in as a bottom sheet or full-screen panel.

**Two tabs**: `"Timer"` and `"Tasks"`

**Timer tab**:
- Timer mode toggle: `"Pomodoro"` / `"Stopwatch"`
- Focus duration stepper (for pomodoro): 5–240 min
- Break duration stepper: 1–60 min
- `"Done"` button

**Tasks tab**:
- Sort mode: `"My Day"` / `"Planned"` / `"Important"` / `"Objectives"`
- Task list for selecting which task to link to the session
- Objective sections with expand/collapse

---

## SCREEN 10 — TRAINING ROOM

### Background
`LinearGradient`: `#050810 → #0a1628 → #0f2040` — very dark navy-blue-black

### Top Bar (same style as Focus Room)
- `"← Back"` or `"← Leave"` pill
- Spotify pill (green when connected)
- `"Settings"` pill (only visible after selecting a session)

### Phase: SELECT

**Header area** (centered, top padding):
- Barbell icon in a blue circle badge (`rgba(74,157,255,0.15)` background, `s(60)×s(60)` circle)
- `"Training Room"` title — white, `fontSize: s(22)`, `fontWeight: "800"`
- `"Select a session to begin your workout"` subtitle — muted white

**Session cards** (one per training plan, from Tasks data):
Each card:
- Background: `rgba(255,255,255,0.06)` glass, `borderRadius: s(16)`, 1px `rgba(255,255,255,0.10)` border
- Left: plan name in small tag + session title in larger bold white + date below
- Right: `"Start →"` badge — `rgba(74,157,255,0.15)` teal-blue background, `#4A9DFF` text + arrow icon

**Settings strip** (bottom of list, tappable):
- `"⚙ 4 sets · 1m 30s rest"` — muted text + chevron right

**Empty state** (if no training plans):
- Barbell icon (very faint), `"No training sessions found"`, descriptive gray text

---

### Phase: PICK EXERCISE

**Header**: `"Choose Exercise"` + count of done exercises in subtitle

**FROM YOUR PLAN** section (uppercase label):
- Chip grid of exercise names from the plan
- Each chip: `borderRadius: s(12)`, blue tint, barbell icon left + exercise name + right-arrow

**Completed exercises** (separate section if any done):
- Same chips but with `✓` indicator

**Custom exercise input** (below):
- `"+ Add custom exercise"` text input field + `"Add"` button

---

### Phase: WORK

**Large set display** (centered, takes up center of screen):
- Set number: `"SET 1 of 4"` (or current set of total) — large, `fontSize: s(48)` or similar
- Exercise name: bold, white
- Session duration counter (top-right area): `"1m 23s"` counting up

**Bottom section**:
- `"Done ✓"` primary button — accent-blue, full-width, `borderRadius: s(14)`, bold white text
- Opens the **Set Log sheet** (below)

**Set Log Modal** (slides up):
- `"Reps"` input — number keyboard
- `"Weight"` input — number keyboard + unit toggle `kg/lbs`  
- `"Notes"` input — short text
- `"Save Set"` button

After saving last set of an exercise → **Exercise Decision sheet** appears:
- `"+ Add Another Exercise"` option
- `"End Workout"` option

---

### Phase: REST

Large centered timer showing `"MM:SS"` counting down from the rest duration.
- `"REST"` label above in muted text
- Progress bar below number: fills from 100% → 0% as rest depletes, color `#4A9DFF` (blue)
- `"+ 15s"` add-time button
- `"Skip →"` link

---

### Phase: READY (between sets)

A pulsing button: `"Start Set"` — `Animated.loop` scale `1 → 1.06 → 1`, period 1.3s

---

### Phase: COMPLETE

**Trophy animation** (center of screen):
- Trophy emoji or `Ionicons "trophy"` icon **springs in** from scale 0 → 1 (spring `friction 5, tension 80`)
- `"Workout Complete!"` headline
- Summary stats: exercises done, sets, duration
- `"Return"` button

---

## SCREEN 11 — CALENDAR

### Background
`colors.bg` — same dark/light theme

### Top App Bar (`TopAppBar` component)
- Title: displays the current month + year, e.g. `"April 2026"`, with `< >` nav arrows
- Right: search toggle + filter options

### Calendar Area

**Month Strip** (`MonthStrip` component):
- Full-width horizontal calendar view
- **Week view** (default): shows the current week's 7 days in a horizontal strip
  - Each day cell: day-of-week abbreviation (Mon/Tue/etc.) above, date number below
  - **Today**: highlighted with accent-colored circle
  - **Selected day**: filled circle behind the number in accent color
  - Days with events: small colored dots below the number
- **Month view** (expanded): full 5/6-week calendar grid
  - Same day cells, just in a grid layout
  - Tapping the arrow at the top of the strip toggles month collapse/expand

**Agenda List** (below the strip):
- Shows events/tasks for the selected day
- **Section headers**: date label (e.g., `"Monday, Apr 14"`) with item count badge
- Each item type has different icon + accent:
  - Event: `calendar-outline`, color from event's chosen color
  - Task: `checkbox-outline`, task objective's color
  - Birthday: `gift-outline`, warm color
  - Holiday: `sparkles-outline`, purple `#A855F7`
  - Contact date: `heart-outline` (anniversary) or `gift-outline` (birthday)

**Event item row**:
- Thin colored left border (event's color)
- Title (bold) + subtitle (time range or "All day")
- Small colored dot matching event type
- Long-press or tap → edit/delete options

### Create Event Sheet (`CreateSheet` component)
Tapping `"+"` opens a `BottomSheet`:
- `"New Event"` title
- Name input
- Date picker (calendar inline or date wheel)
- Time picker
- All-day toggle (iOS-style `Switch`)
- Color picker (8 colored circle options)
- Reminder dropdown
- Share with friends picker (if friends exist)
- `"Save"` and `"Cancel"` buttons

### Side Drawer (`SideDrawer`)
Tapping the filter icon opens a right-side drawer:
- Toggles for each item type: Events / Tasks / Birthdays / Holidays (iOS `Switch` for each)
- Contacts sync control (if enabled)

---

## SCREEN 12 — ACCOUNT / SETTINGS

### Tab Bar (3 tabs at top)
- `"Settings"` | `"Profile"` | `"Achievements"`
- Segmented control, active: accent background, inactive: muted

---

### Profile Tab

**Profile Card** (top):
- Avatar (photo or initials):
  - If photo: circular `borderRadius: size*0.38`, accent-tinted border
  - If no photo: **InitialsAvatar** — circle with accent-tinted background `accent+"22"`, accent border `accent+"44"`, white initials text (first+last name initial), `fontWeight: "900"`, `fontSize: size*0.38`
  - Size: `s(46)` normal, `s(60)` in edit modal
- Name (bold, large) + email (muted, smaller)
- **Friend tag** badge: `"#{6-char-tag}"` — accent-colored text, small bold, with `@` icon
- `"Edit"` button (pencil icon, top-right of card area)

**Stats Row** (3 mini stat cards horizontally):
- `"Done"` tasks count + label
- **Focus Ring card** (SVG ring):
  - SVG `Circle` with:
    - Track ring: `R=22px`, `strokeWidth: 4`, track color `muted+"28"` (faint)
    - Progress arc: same `R`, `strokeWidth: 4`, `strokeLinecap: "round"`, stroke color interpolated via multi-stop gradient:
      - 0%: `#1C7ED6` (cool blue)
      - 35%: `#38BDF8` (sky)
      - 60%: `#F97316` (orange)
      - 80%: `#EF4444` (red)
      - 100%: `#FF3B30` (fire red)
    - Rotated so 0% = top (`rotation: -90`)
    - Center text: `"{pct}%"`, `fill: ringColor` (matches arc color), `fontSize: 11`, bold
  - Below SVG: `"Focus goal"` label + pencil edit hint (top-right)
- Streak days count + label

**Weekly Activity Chart** (line chart using `react-native-svg`):
- 7-column chart, Mon → Sun, labeled at bottom
- Focus minutes plotted as polyline (connected line + dots)
- Tasks done plotted as a second polyline / bar
- Today's column highlighted (bolder, vertical accent line)
- Future days dimmed/faded

**Objectives section** (collapsible):
- List of active objectives with colored left strip + progress fractions

**Edit Profile Modal** (when edit tapped):
- Camera icon overlay on avatar → tap to pick photo from library
- Name text input (pre-filled)
- `"Save"` button

---

### Settings Tab

**Appearance section:**
- Row: `"Dark Mode"` — iOS-style `Switch`, toggles `dark ↔ light`
- Row: `"Accent Color"` — shows a colored circle of current accent, tapping opens the **Accent Picker**

**Accent Picker (Bottom Sheet)**:
- `"Accent Color"` title
- 8×1 row of circles (palette), each 38dp diameter:
  - Ocean `#1C7ED6` · Teal `#2EC4B6` · Sky `#38BDF8` · Emerald `#22C55E` · Violet `#A855F7` · Amber `#F97316` · Rose `#F43F5E` · Gold `#FACC15`
- Selected: white ring around the circle
- Tap → applies immediately

**Goals section:**
- Row: `"Daily Focus Goal"` — shows current minutes, tap to edit
- Row: `"Daily Task Goal"` — shows count, tap to edit

**Notifications section** (expandable):
- Expand icon on the right, tapping shows sub-rows:
  - Focus reminders toggle
  - Task deadline reminders toggle
  - Streak reminders toggle

**Display section:**
- Row: `"24-Hour Clock"` — `Switch` toggle

**Data section:**
- Row: `"Contact Birthdays & Anniversaries"` — `Switch`; shows "Synced X contacts" sub-label + sync/clear buttons when enabled

**Subscription section:**
- Row: `"Manage Subscription"` — opens Apple Customer Center
- Row: `"Restore Purchases"` — spinner during restore

**Account section:**
- Row: `"Email"` — shows email + verification badge (`"Verified ✓"` in green or `"Unverified"` in amber)
- Row: `"Log Out"` — destructive action, `Alert.alert` confirmation
- Row: `"Delete Account"` — opens modal requiring password re-entry

---

### Achievements Tab

**Tier indicator** (top):
- `"Tier {N}"` badge — shows current trophy tier
- Progress summary: `"{N}/{total} badges unlocked"`

**Tier navigation pills** (if multiple tiers exist): pill buttons to switch viewed tier

**Badge grid** (7 badges per tier):
Each badge:
- Circular icon: `Ionicons` icon, `s(28)`, colored per completion:
  - **Unlocked**: accent-colored circle + icon
  - **Locked**: muted gray tint + icon
- Title (bold, ~`fontSize: s(13)`)
- Progress fraction: `"3/5"` in muted text
- Progress bar: thin, accent fill

**Badge categories include:**
- Task completion milestones (1, 5, 10, 25, 50... tasks)
- Streak milestones (3, 7, 14, 30 days)
- Focus session milestones (first session, 10 sessions, 50 sessions...)
- Early Bird (sessions before 8am)
- Night Owl (sessions after 8pm)
- Marathon sessions (30min, 120min, 180min sessions)
- Objectives completed milestones

---

## SCREEN 13 — SOCIAL SCREEN

### Navigation
Navigated to from the **Account tab** (tap `"👥 Social"` or society icon link), or via `navigation.navigate("Social")`. Slides in from right.

### Background
`colors.bg`

### Header
- Back arrow `← ` + `"Community"` or `"Friends"` title
- `"+ Add Friend"` button (right, accent color) → navigates to AddFriend screen

### 3 Tabs (segmented control)
1. **Friends** | 2. **Leaderboard** | 3. **Shared**

---

### Friends Tab

**Pending Requests section** (if any):
- Section header: `"PENDING (N)"`
- Each pending request card:
  - Avatar (initials-based, accent-colored circle) + name + tag
  - `"Accept"` button (green success color) + `"Decline"` button (red)

**Friends List**:
Each friend row:
- Avatar circle (initials, accent-tinted)
- Display name (bold) + `"#{tag}"` (accent colored, small)
- Focus bar: thin horizontal bar showing their focus minutes today relative to the group max; bar color = accent
- `"X min today"` label on the right
- Long-press or kebab → `"Remove friend"` option

**Empty state** (no friends yet):
- Large faint icon `"person-outline"` + `"No friends yet"` + description

---

### Leaderboard Tab

**Range selector** (horizontal pill tabs):
- `"Today"` | `"Week"` | `"Month"` | `"Year"`

**Each leaderboard entry**:
- **Rank number** or medal emoji (top 3 get colored circles: 🥇 gold, 🥈 silver, 🥉 bronze)
- Avatar + name + tag
- `"X min"` focus time label (right-aligned)
- Focus bar showing relative progress
- Top 3 entries have special medal background colors

**Current user row**: highlighted (slightly different background, bold name)

**Pull-to-refresh**: `RefreshControl` (spinner)

---

### Shared Tab

**Sub-sections:**
- `"SHARED OBJECTIVES"` — collaborative objectives with friend(s)
- `"SHARED EVENTS"` — events shared from calendar

Each shared item card:
- Title + participant avatars (overlapping circles) + date/description
- Invite card (pending): `"Accept"` + `"Decline"` buttons

---

## SCREEN 14 — ADD FRIEND

### Background
`colors.bg`

### Header
- `← ` (back chevron) + `"Add Friend"` title, `fontSize: s(18)`, `fontWeight: "800"`
- Hairline bottom border

### Search Input Field
- Card: `backgroundColor: colors.card`, `borderRadius: s(12)`, 1px border
- Left: `"#"` prefix in accent color, bold, `fontSize: s(16)` — non-editable prefix
- Input: monospace-style, `fontWeight: "800"`, `letterSpacing: s(2)`, `autoCapitalize: "characters"`, `maxLength: 6`
- Right: `Ionicons "close-circle"` (clear button) when text present

Below input: `"Example: #A4K92T"` hint text, centered, muted, small

**Live search** — debounced 350ms after 6 chars

**States:**

Searching: `ActivityIndicator` centered

Not found: `Ionicons "person-outline"` large faint icon + `"No user found for #XXXXXX"`

Found (result card):
- `backgroundColor: colors.card`, `borderRadius: s(14)`, 1px border
- Avatar circle (initials-based, accent-tinted, `40×40dp`)
- Name (bold, `s(14)`) + `"#{tag}"` (accent, small)
- `"Add"` button: `borderRadius: s(10)`, accent tint, `Ionicons "person-add-outline"` + `"Add"` text

Sent state: `"✓ Sent"` green badge replaces Add button, `backgroundColor: success+"18"`, `borderColor: success+"44"`

Empty (before typing):
- Large `"@"` icon faint + `"Find by tag"` heading + `"Enter a 6-character friend tag to find the exact person."`

---

## SCREEN 15 — SEARCH (Global)

Accessed from the Dashboard search icon. Slides into view as a modal screen.

### Background
`colors.bg`

### Layout
`SafeAreaView`, pad `spacing.lg`.

**Search input** (large, top of screen):
- `Ionicons "search"` icon left
- Text input: `autoFocus: true`, placeholder `"Search tasks, objectives, actions..."`, muted placeholder
- `× ` clear button when text present

**Filter pills** (horizontal scroll, below search):
- `"All"` · `"Tasks"` · `"Objectives"` · `"Actions"` 
- Active: `backgroundColor: accent + "18"`, accent border + text; Inactive: muted

**Results list** (live-filtered as user types):

Each result item:
- Background: `colors.surface`
- Left: colored circle with type icon
  - Task: `checkmark-circle-outline`, color based on importance (green/blue/orange/red)
  - Objective: `flag-outline`, objective's color
  - Action: `flash-outline`, accent
- Title (bold) + subtitle (deadline badge / progress)
- Kind label badge (small pill): `"Task"` / `"Objective"` / `"Action"`

**Actions** (always shown, no filtering needed):
Tapping actions like `"Toggle Dark Mode"` → immediate theme toggle.

---

## MODALS & OVERLAYS

### Streak Celebration Modal
Shown automatically when user logs in with a streak.

- **Backdrop**: dark translucent overlay, `opacity: 0 → 1` animates in 220ms
- **Card** (centered, dark background `#111`-ish, rounded `s(28)`):
  - **🔥 flame emoji**: springs in from scale 0 (spring `tension 120, friction 6`) + subtle infinite loop pulse (`scale 1 → 1.07 → 1`, 900ms each)
  - **Streak number** (large, center): counts up from previous streak → new streak (650ms `Animated.timing`)
  - `"X day streak"` label fades in + rises from +10dp (300ms, 800ms delay)
  - **7 weekday dots** (Mon–Sun), stagger-in (1000ms base, 80ms per dot):
    - Active days: orange-gold `#FF9F40` circle + faint orange glow shadow blur
    - Inactive days: ice-blue `#B8D8F0` circle
    - Day label below each: `"Mo"/"Tu"/"We"/"Th"/"Fr"/"Sa"/"Su"`, same color as dot
  - Warning/encouragement text fades in at 1700ms:
    - ≥7 days: `"🏆 Amazing! Keep the flame alive!"`
    - < 7 days: `"Don't break it tomorrow. Watch out! 👀"`
- **"Tap anywhere to continue"** below card, fades in with warning text
- **Dismiss**: tap anywhere → `overlayOpacity: 0` (220ms fade) then `onDismiss()`

### Achievement Toast
(from `AchievementContext`) — small floating card slides in from top or bottom with an icon + `"Achievement Unlocked!"` + badge name.

### Bottom Sheet Component
All bottom sheets share:
- `Modal` with `animationType: "slide"`, `transparent: true`
- Backdrop: `rgba(0,0,0,0.55)`
- Sheet card: `colors.card`, top corners `radius.xl`, 1px border, `maxHeight: 90%`
- iPad: centered with `maxWidth: 480dp`, all corners rounded (floating card style), margin from keyboard

---

## FOCUS ROOM TUTORIAL OVERLAY
Shown once on first entry to a Focus Room.

Full-screen overlay with:
- Dark backdrop
- Spotlight cutouts highlighting UI elements one at a time
- Text tooltips with arrows pointing to the highlighted element
- `"Next"` + `"Skip"` buttons
- Final screen: `"Got it!"` to dismiss

---

## TRAINING ROOM TUTORIAL OVERLAY
Same pattern as Focus Room Tutorial, shown once on first Training Room entry.

---

## SPOTIFY MINI PLAYER COMPONENT

Small card (`SpotifyMiniPlayer`) that appears in Focus Zone and Training Room when Spotify is connected.

**Layout** (horizontal):
- Album art: square ~`40×40dp`, `borderRadius: s(8)`
- Track info: track name (bold, white, truncated) + artist (muted, smaller)
- Controls: `⏮ ⏯ ⏭` playback buttons in white

**In landscape Focus Room**: compact version (no track text visible, just art + buttons)

---

## SHARED UI COMPONENTS

### `Card`
- `backgroundColor: colors.card`
- `borderRadius: radius.lg`
- 1px `colors.border`
- `padding: s(14)` or as specified

### `PrimaryButton`
- Full-width, `height: s(52)`, `borderRadius: radius.xl`
- Background: dark/navy (from theme)
- Text: white, `fontWeight: "700"`
- Optional left icon

### `IconCircleButton`
- Circle `36×36dp`, `borderRadius: s(18)`
- Background: `colors.surface`
- Icon centered

### `SegmentedControl`
- Horizontal pill container, `backgroundColor: colors.surface`, `borderRadius: s(10)`
- Each tab: fills proportional width, text label
- Active: `backgroundColor: colors.accent`, white text, `borderRadius: s(8)` (inset)
- Inactive: transparent background, muted text
- Transition: the active background slides/fades

### `AnimToggle` (Focus Zone specific)
- Pill-shaped button, `height: s(38)`, `minWidth: s(80)`, `borderRadius: s(19)`
- Icon (Ionicons) + label text
- OFF state: `backgroundColor: rgba(255,255,255,0.10)`, muted white text
- ON state: `backgroundColor: rgba(255,255,255,0.22)`, `borderColor: rgba(255,255,255,0.28)`, white text
- Spring animation on toggle

### `Stepper` (Training Room)
- Three elements in a row: `−` button, value text, `+` button
- Buttons: `borderRadius: s(8)`, `backgroundColor: rgba(255,255,255,0.10)`, white icon
- Value: white, `fontWeight: "700"`, between buttons

---

## GLOBAL TRANSITIONS SUMMARY

| Action | Animation |
|---|---|
| Any onboarding Q→Q | Push: cross-fade 350ms |
| Open bottom sheet | Slide up (OS native "slide") |
| Close bottom sheet | Slide down |
| Open modal | Cross-fade (or OS native) |
| Tab switch | Instant (no animation) |
| Open Social/AddFriend | Slide from right |
| Enter Paywall | Cross-fade |
| Focus Room enter/leave | Instant (manual state change) |
| Immersive mode enter | Spring (controls fade, timer grows) |
| Achievement badge populate | Stagger pop-in from scale 0.6 |
| Task completion | Scale bounce + fade out |
| Streak count-up | Number interpolation 650ms |
| Streak modal open | Overlay fade + spring elements in sequence |
| Spotify connection | Pill color crossfade to green |
| Tab bar hide/show | Spring translateY |

---

## ASSET INVENTORY

| Asset | File | Usage |
|---|---|---|
| App icon (rounded square) | `assets/icon.png` | Tab bar center button, Q0 splash, Sign-in header |
| Auth hero illustration | `assets/AuthScreen.png` | Sign-in screen |
| Mountain background | `assets/focus/mountainMOB.png` | Focus room + Room selection BG |
| Forest background | `assets/focus/forest1.png` | Focus room option |
| Ocean background | `assets/focus/Ocean1.png` | Focus room option |
| Space background | `assets/focus/space.png` | Focus room option |
| Skyline background | `assets/focus/skylineMOB.png` | Focus room option |
| Timer cue sound | `assets/focus/timer_cue.mp3` | Phase transition sound |
| Task complete sound | `assets/Completed.mp3` | Task checkbox + set completion |

---

*End of Flusso Visual Specification*

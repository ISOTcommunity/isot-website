# ISOT — Digital Products & Member Platform

Public website and live Progressive Web App (PWA) platform for **[isotcommunity.com](https://isotcommunity.com)**.

---

## 📁 Repository & Folder Structure

```
ISOT/
├── website/                  ← Public Website & Member Web Application (LIVE on Vercel)
│   ├── index.html            ← Auth Token Auto-Forwarder & Root Gateway
│   ├── app/                  ← ★ ISOT Member Web Application (Supabase-Powered PWA)
│   │   ├── home.html         ← Home Dashboard, Next Upcoming Event, Dynamic Hero Switcher
│   │   ├── events.html       ← 7-Column Month Matrix, Week Stepper, 100% Real RSVPs & Who's Going Modal
│   │   ├── partner.html      ← Retina HD Dark Map (@2x), Real GPS Pinpoints, 1-Tap Google/Apple Maps
│   │   ├── network.html      ← Student Directory, Real Supabase Profiles, Search, Friendships & Requests
│   │   ├── notifications.html← Dedicated Activity Center & Real-time Notifications Page
│   │   ├── account.html      ← Profile Settings, Interactive Crop/Rotate Modal, Tap-to-Crop Photo
│   │   ├── profile.html      ← Live QR Member Card (Socio 20% OFF)
│   │   ├── karaoke.html      ← Live Karaoke Queue (1 active song per student, stage status)
│   │   ├── karaoke-kj.html   ← Volunteer Host Booth ("Mark Sung & Next Singer →")
│   │   ├── css/app.css       ← Apple-Grade Design System, Translucent Glass & Motion Physics
│   │   ├── js/isot.js        ← Core API, Fast Auth Guard, Centered Initials Avatars & Notification Manager
│   │   └── manifest.json     ← PWA Add to Home Screen Manifest (ISOT Logo)
│   ├── assets/               ← Official Logos, Photos, Graphic Identity
│   └── vercel.json           ← Clean URLs, Explicit App Rewrites & WordPress SEO Redirects
├── supabase/                 ← Database SQL Migrations, RLS Policies & Triggers
└── BACKEND_PLAN.md           ← Architecture Spec & RUNTS Compliance Plan
```

---

## 🧠 Summary of Recent Architecture & Engineering Work (23 August 2026)

### 1. 🔔 Dedicated Activity Center & Real-time Notifications Page (`notifications.html`)
* **User Directive**: `"when i push on the ring it should go on new page not open below netwrok"`
* **Implementation**: Created `app/notifications.html` linked directly from the topbar bell icon `🔔` across all pages.
* **Features**: Displays real-time friend requests, event invitations, and accepted requests with direct 1-tap action buttons.

### 2. 💌 Selective Friend Selection Modal for Event Invitations
* **User Directive**: `"when inviting friend user should be able to chose what friend not all of them"` & `"it bring all the possible members should be able only to send accepted friemds"`
* **Implementation**: Replaced blast invitation with an interactive **Friend Selection Sheet Modal** in `events.html`.
* **Strict Accepted Friends Filter**: Displays **strictly connected/accepted friends only** (`status: 'connected'`). Displays a clear empty state card linking to `network.html` if the user has no connected friends yet.

### 3. 📸 Tap-to-Crop & Rotate Profile Photo at Top of Account Page
* **User Directive**: `"can we add the edit profile crop and rotate on tap avatar to change the photo not at the end of account"`
* **Implementation**: Added a camera overlay badge 📷 to the avatar at the top of `account.html`. Tapping the photo or the `[ 📷 Tap Photo to Crop & Rotate ]` button immediately opens the canvas crop, zoom, and 90° rotation editor.

### 4. 🎨 Apple-Grade Centered Member Initials & Fallback Avatar System
* **User Directive**: `"the people who doesnt have the picture have a really bad icon not in center"`
* **Implementation**: Redesigned `renderUserAvatarHtml` and `renderGeoAvatar` in `js/isot.js` and `app.css`. Replaced offset SVG clipping paths with GPU-accelerated flex-centered circular initial badges (e.g., **A** for Amir, **S** for Sofia) on deterministic dual-color gradient backgrounds.

### 5. 📱 Mobile Viewport Lock & Auto-Zoom Prevention
* **User Directive**: `"in my account also cancel zoom feature user touches something wrong and it does a strange zoom"`
* **Implementation**: Set `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` and enforced `font-size: 16px !important; touch-action: manipulation;` on input fields so iOS Safari never triggers unexpected viewport auto-zooming.

### 6. 📐 Upgraded Mobile Bottom Tab Bar Proportions
* **User Directive**: `"the menue at bottom became strangly small chose a normal pleasable size"`
* **Implementation**: Upgraded bottom tab bar in `app.css` to generous Apple native proportions: `25px × 25px` SVG icons, `0.82rem` (`font-weight: 600`) readable labels, and `64px` tabbar height.

### 7. ⚡ Fast Auth Session Guard & Vercel Clean URL Rewrites
* **User Directive**: `"maybe is not for the speed something related to vercel"`
* **Implementation**: Added 1.2s `Promise.race` fast-timeout to `db.auth.getSession()` in `js/isot.js` and updated `vercel.json` with explicit rewrite rules for all clean PWA app URLs (`/app/home`, `/app/events`, `/app/network`, `/app/partner`, `/app/account`, `/app/notifications`).

---

## 🎨 Mandatory UI/UX & Design Rules for Webstack & App Components

1. **FontAwesome Vector Icon Centering Rule**:
   * Never rely on default `<i>` font baseline alignment.
   * Enforce `display: inline-flex; align-items: center; justify-content: center; line-height: 1; margin: 0; padding: 0;` on FontAwesome `<i>` tags inside fixed-size icon circles or squares (e.g. `36px × 36px` or `38px × 38px`).

2. **Sidebar Card Text Overflow & Wrapping Prevention**:
   * Sidebar cards have tight horizontal widths (`~260px - 300px`).
   * Button titles like "Telegram Group" or "WhatsApp Group" MUST use `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` to prevent text from breaking onto multiple lines.

3. **Apple iOS Settings Row Pattern for Unlocked Social Links**:
   * Use an iOS Settings / Glassmorphism Row layout:
     * **Left**: 38px 3D gradient circular icon badge (`background: linear-gradient(135deg, #0088CC, #229ED9)` for Telegram, `#25D366` for WhatsApp).
     * **Center**: Title (Bold 0.88rem) + Subtitle (Muted 0.72rem).
     * **Right**: External arrow (`↗`).
     * **Wrapper**: `display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.04); border: 1px solid ...`

4. **Pre-Verification Badge Visibility**:
   * Always display clear, high-visibility platform logos/badges (e.g., Telegram cyan-blue & WhatsApp green) BEFORE an interactive puzzle or Captcha check, so users immediately know what platform links will be unlocked.

---

## 🚀 How to Commit & Push Code

```bash
cd website
git add -A
git commit -m "Description of changes"
git push origin main
```

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
│   │   ├── account.html      ← Profile Settings, Canvas 300x300 Photo Compressor, Languages Spoken
│   │   ├── profile.html      ← Live QR Member Card (Socio 20% OFF)
│   │   ├── karaoke.html      ← Live Karaoke Queue (1 active song per student, stage status)
│   │   ├── karaoke-kj.html   ← Volunteer Host Booth ("Mark Sung & Next Singer →")
│   │   ├── css/app.css       ← Apple-Grade Design System, Translucent Glass & Motion Physics
│   │   ├── js/isot.js        ← Core API, Auth Guard, GeoAvatar Generator & Notification Center
│   │   └── manifest.json     ← PWA Add to Home Screen Manifest (ISOT Logo)
│   ├── assets/               ← Official Logos, Photos, Graphic Identity
│   └── vercel.json           ← 18 Permanent WordPress SEO Redirects & Clean URLs
├── supabase/                 ← Database SQL Migrations, RLS Policies & Triggers
└── BACKEND_PLAN.md           ← Architecture Spec & RUNTS Compliance Plan
```

---

## 🧠 Summary of Recent Architecture & Engineering Work (23 August 2026)

### 1. 🛡️ 100% Real RSVPs & Attendee Profile Sheet ("Who's Going")
* **User Directive**: `"please dont put any fake going"`
* **Why**: The user strictly forbade pre-seeded mock attendees or fake numbers (`baseCount + (isGoing ? 1 : 0)`).
* **Implementation**: Modified `events.html` and `home.html`. If 0 users have RSVP'd, displays **"Be the first to RSVP"**. When users tap **`[ I'm Going ]`**, only real user profiles and genuine counts are computed.
* **Profile Preview Modal**: Tapping the attendee avatar stack slides up an Apple Glass modal showing attendee full names, tier badges (`YOU`), country of origin (🇮🇹 🇪🇸 🇮🇷 🇧🇷), university (UniTo, PoliTo), and spoken languages.

### 2. 📷 HTML5 Canvas Client-Side Profile Photo Compressor
* **Why**: Uncompressed phone camera photos (5–10MB) slow down mobile apps.
* **Implementation**: Built `compressAvatarFile(file, maxSide=300, quality=0.82)` in `js/isot.js`. Crops photos to a square, resizes to **300×300 JPEG**, and compresses to ~30KB before saving `avatar_url` to Supabase `profiles`.
* **Universal Avatar Fallback**: `renderUserAvatarHtml(profile, size)` renders uploaded photos or falls back to deterministic split-circle `renderGeoAvatar(member_code, size)`.

### 3. 🌐 ISOT Student Network & Friendship System (`network.html`)
* **Why**: Students wanted to connect, view each other's profiles, and send friend requests.
* **Implementation**: Created `app/network.html` querying Supabase `profiles` table.
* **Filters & Search**: Real-time search by name, country, university, or language, with filter pills (`All Students`, `My Friends`, `Pending Requests`, `UniTo`, `PoliTo`).
* **Friendship Statuses**: `+ Add Friend` → `Sent ⏳` → `Friends 🤝` (saved to Supabase `friendships` table).

### 4. 🔔 Activity & Notification Center (`🔔` Bell Icon)
* **Why**: Provide instant feedback for incoming friend requests and event invites.
* **Implementation**: Added a notification bell icon with an unread badge counter (`🔔 1`) to top bars across all app screens. Tapping opens an **Activity Center Modal** for notification history.
* **1-Tap Event Invitations**: Added an **`[ Invite Friends 💌 ]`** button on event cards in `events.html` allowing students to invite connected friends to events.

### 5. 🗺️ Retina HD Dark Vector Map & Real Venue GPS Locations (`partner.html`)
* **Why**: Venues needed crisp, high-DPI maps and accurate navigation.
* **Implementation**: Upgraded Leaflet map to CartoDB Retina HD Dark tiles (`dark_all@2x`).
* **Authentic Locations**:
  - 🍸 **Rough San Salvario**: `Via Principe Tommaso 3` (Lat `45.0601`, Lng `7.6835`)
  - 🪩 **Zenit Club**: `Piazza Vittorio Veneto 13/E` (Lat `45.0648`, Lng `7.6955`)
  - 🍹 **Capodoglio**: `Murazzi del Po 37` (Lat `45.0610`, Lng `7.6920`)
* **1-Tap Navigation**: Added direct **`[ Google Maps ]`** and **`[ Apple Maps ]`** buttons to venue cards.

### 6. 📱 Clean 4-Tab Bottom Navigation Bar
* **Sequence**: `Home (1)` · `Calendar (2)` · `Partners (3)` · `Network (4)`.
* **Rationale**: Menu was removed from the bottom bar because the **Burger Drawer Menu** (`#burgerBtn`) is located at the top right header next to the user's account photo.

### 7. ✨ Apple-Grade Fluid Motion System
* **Why**: The user requested high-end Apple motion while strictly avoiding cheap confetti or celebration animations.
* **Implementation**:
  - **Tactile Tap Physics**: `active: scale(0.95)` on buttons, cards, and tabs with elastic spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - **Staggered Page Entrance**: `.shell > *` elements slide up with staggered delays (`appleFadeInUp`).
  - **Breathing Ambient Neon Glow**: `ambientPulse` keyframes for live badges and active RSVPs.

---

## 🗄️ Supabase Database Schema Quick Reference

### Table: `public.profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary Key, references `auth.users(id)` |
| `email` | `TEXT` | User email address |
| `full_name` | `TEXT` | User full name |
| `member_code` | `TEXT` | Unique code (e.g. `ISOT-2026-0001`) |
| `tier` | `TEXT` | `'participant'` (free) vs `'socio'` (€10/yr) |
| `staff_role` | `TEXT` | `'member'`, `'volunteer'`, `'board'`, `'partner'` |
| `university` | `TEXT` | e.g. `UniTo`, `PoliTo`, `SAA` |
| `nationality` | `TEXT` | e.g. `Italy 🇮🇹`, `Spain 🇪🇸`, `Iran 🇮🇷` |
| `languages` | `TEXT` | e.g. `English, Italian, Spanish, Persian` |
| `avatar_url` | `TEXT` | Compressed base64 or storage URL |

### Required RLS SQL Migration for Member Discovery:
```sql
-- Allow registered members to discover each other in Network & Attendee lists
DROP POLICY IF EXISTS profiles_read ON public.profiles;

CREATE POLICY profiles_read ON public.profiles
  FOR SELECT TO authenticated
  USING (TRUE);
```

---

## 🚀 How to Commit & Push Code

**Repo Remote:** `git@github-isot:ISOTcommunity/isot-website.git`  
**SSH Host Alias:** `github-isot` (Key: `~/.ssh/isot_github`)

```bash
cd website
git add -A
git commit -m "Description of changes"
git push origin main
```

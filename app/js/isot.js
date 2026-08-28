/* ISOT App — Client Core, Auth Guard, Geometry Generator & Helper API
 * Stack: Standalone Vanilla JS + Supabase Client
 */

/* eslint-disable no-unused-vars */

const ISOT_CONFIG = {
  SUPABASE_URL: 'https://ywmdaekblhabyajzusfm.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw',
};

const isConfigured = () =>
  !ISOT_CONFIG.SUPABASE_URL.startsWith('REPLACE_') &&
  !ISOT_CONFIG.SUPABASE_ANON_KEY.startsWith('REPLACE_');

const db = isConfigured() && window.supabase
  ? window.supabase.createClient(ISOT_CONFIG.SUPABASE_URL, ISOT_CONFIG.SUPABASE_ANON_KEY)
  : null;

/* ---------------------------------------------------------------
 * Double-Tap Zoom Prevention (Mobile Webview & Safari)
 * ------------------------------------------------------------- */
(function preventDoubleTapZoom() {
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) {
      const tag = e.target ? e.target.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
      }
    }
    lastTouch = now;
  }, { passive: false });
})();

/* ---------------------------------------------------------------
 * Identity Palette for Deterministic Geometry Avatars
 * ------------------------------------------------------------- */
const IDENTITY_PALETTE = [
  '#7397B1', // Steel blue
  '#3E6B7E', // Teal
  '#EBC17F', // Warm amber
  '#DE8E28', // Deep orange
  '#B64226', // Terracotta
  '#A0689A', // Mauve
  '#BBC1F9', // Lavender
  '#3F35A0', // Deep indigo
];

/**
 * Renders user photo avatar if profile.avatar_url exists, otherwise renders crisp centered Initials / User Icon
 */
function renderUserAvatarHtml(profile, size = 44) {
  const s = size;
  const name = profile ? (profile.full_name || 'Member') : 'Member';
  const initial = name.trim().charAt(0).toUpperCase() || 'M';
  const code = profile ? (profile.member_code || 'ISOT-2026') : 'ISOT-2026';

  if (profile && profile.avatar_url) {
    return `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;border:1.5px solid var(--pink);display:block;flex-shrink:0;" />`;
  }

  // Deterministic color selection from Identity Palette
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % IDENTITY_PALETTE.length;
  const color1 = IDENTITY_PALETTE[index];
  const color2 = IDENTITY_PALETTE[(index + 3) % IDENTITY_PALETTE.length];

  const fontSize = Math.max(12, Math.round(s * 0.42));

  return `
    <div class="geo-avatar" style="width:${s}px;height:${s}px;border-radius:50%;background:linear-gradient(135deg, ${color1}, ${color2});display:inline-flex;align-items:center;justify-content:center;color:#FFF;font-weight:700;font-size:${fontSize}px;border:1.5px solid rgba(255,255,255,0.25);box-shadow:0 4px 12px rgba(0,0,0,0.3);flex-shrink:0;user-select:none;text-transform:uppercase;">
      ${initial}
    </div>
  `;
}

function renderGeoAvatar(memberCode, size = 44) {
  return renderUserAvatarHtml({ member_code: memberCode, full_name: 'Member' }, size);
}

/**
 * Renders a unified Apple-Grade Member Card HTML component
 * used consistently across Home, Events ("Who's Going"), Network, and Profile pages.
 */
function renderMemberCardHtml(profile, isCurrentUser = false) {
  if (!profile) return '';

  const name = escapeHtml(profile.full_name || 'Member');
  const nation = escapeHtml(profile.nationality || 'International Student');
  const uni = escapeHtml(profile.university || 'Turin Student');
  const langs = escapeHtml(profile.languages || 'English, Italian');
  const tier = profile.tier === 'socio' ? 'badge-socio' : 'badge-participant';
  const tierText = TIER_LABEL[profile.tier] || 'Member';

  return `
    <div class="card card-glass student-card" style="display:flex;align-items:center;gap:14px;padding:14px;margin-bottom:10px;">
      <div style="flex-shrink:0;">
        ${renderUserAvatarHtml(profile, 48)}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-weight:700;color:#FFF;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
          <span class="badge ${tier}" style="font-size:0.62rem;padding:2px 8px;">${tierText}</span>
          ${isCurrentUser ? `<span class="badge badge-socio" style="font-size:0.62rem;padding:2px 6px;">YOU</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          <span class="meta-pill" style="font-size:0.73rem;padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:12px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-earth-americas text-pink"></i> ${nation}
          </span>
          <span class="meta-pill" style="font-size:0.73rem;padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:12px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-graduation-cap text-gold"></i> ${uni}
          </span>
          <span class="meta-pill" style="font-size:0.73rem;padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:12px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-comments text-green"></i> ${langs}
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Compresses an uploaded image file down to maxSide x maxSide pixels (default 300x300)
 * returns a lightweight JPEG data URL (~30-40KB)
 */
function compressAvatarFile(file, maxSide = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = img.width;
        const h = img.height;

        const minSide = Math.min(w, h);
        const sx = (w - minSide) / 2;
        const sy = (h - minSide) / 2;

        canvas.width = maxSide;
        canvas.height = maxSide;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSide, maxSide);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------
 * Category Characters System
 * ------------------------------------------------------------- */
const CATEGORY_ASSETS = {
  drinks: '../assets/LOGOS/Drink.jpeg',
  drink: '../assets/LOGOS/Drink.jpeg',
  aperitivo: '../assets/LOGOS/Drink.jpeg',
  social: '../assets/LOGOS/Tog.jpeg',
  together: '../assets/LOGOS/Tog.jpeg',
  tog: '../assets/LOGOS/Tog.jpeg',
  party: '../assets/LOGOS/Party.jpeg',
  nightlife: '../assets/LOGOS/Party.jpeg',
  career: '../assets/LOGOS/Busines.jpeg',
  busines: '../assets/LOGOS/Busines.jpeg',
  workshops: '../assets/LOGOS/Busines.jpeg',
  sports: '../assets/LOGOS/Sport.jpeg',
  sport: '../assets/LOGOS/Sport.jpeg',
  trips: '../assets/LOGOS/Sport.jpeg',
  karaoke: '../assets/LOGOS/Karaoke.png',
};

const CATEGORY_LABELS = {
  social: 'Together & Social',
  drinks: 'Drinks & Aperitivo',
  party: 'Party & Nightlife',
  career: 'Career & Workshops',
  sports: 'Sports & Trips',
  karaoke: 'Karaoke Night'
};

/**
 * Renders Category Character Badge HTML
 */
function getCategoryBadgeHtml(catKey, size = 40) {
  const key = String(catKey || 'social').toLowerCase().trim();
  const assetSrc = CATEGORY_ASSETS[key] || CATEGORY_ASSETS.social;
  const isKaraoke = key === 'karaoke';
  return `
    <div class="cat-badge" style="width:${size}px;height:${size}px;overflow:hidden">
      <img src="${assetSrc}" alt="${key} category" style="${isKaraoke ? 'transform:scale(1.85);object-fit:cover;' : 'object-fit:cover;'}" />
    </div>
  `;
}

/* ---------------------------------------------------------------
 * Auth Guard
 * ------------------------------------------------------------- */
async function requireAuth(opts = {}) {
  __authState = 'pending';
  if (!db) {
    showGateError(
      'Not configured yet',
      'Supabase credentials missing from js/isot.js.'
    );
    return new Promise(() => {});
  }

  // getSession() reads local storage first, so it is fast. Racing it against a 1.2s
  // timer meant a slow phone on bar wifi was treated as signed out.
  let session = null;
  try {
    const { data } = await db.auth.getSession();
    session = data?.session || null;
  } catch (e) {
    session = null;
  }

  // If returning from OAuth redirect with ?code= or #access_token=, wait for auth state event
  const hasOAuthParams = location.hash.includes('access_token=') || location.search.includes('code=');
  if (!session && hasOAuthParams) {
    session = await new Promise((resolve) => {
      let done = false;
      const { data: { subscription } } = db.auth.onAuthStateChange((event, sess) => {
        if (sess && !done) {
          done = true;
          subscription.unsubscribe();
          resolve(sess);
        }
      });
      setTimeout(async () => {
        if (!done) {
          done = true;
          subscription.unsubscribe();
          const res = await db.auth.getSession();
          resolve(res.data?.session || null);
        }
      }, 3500);
    });
  }

  if (!session) {
    // No session means not signed in. This previously returned a fabricated "guest"
    // profile so the app would always render — which meant requireAuth did not
    // require auth, and anyone opening /app/home was let in as "ISOT Member".
    // It also made sign-out look broken: you were bounced to login, but any guarded
    // page still rendered.
    // The query string has to come too. A poster scan is /checkin?v=<token>; sending
    // only "checkin" to the login page loses the token, and the student signs in to be
    // told there is no check-in code. login.html re-validates before using any of this.
    const here = (location.pathname.split('/').pop() || 'home.html') + location.search;
    __authState = 'leaving';          // gate stays up until the navigation lands
    location.replace('login.html?next=' + encodeURIComponent(here));
    return new Promise(() => {});
  }

  let profile = null;
  try {
    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) profile = data;
  } catch (e) {
    console.warn('Profile fetch note:', e);
  }

  // The row can legitimately be missing for a moment right after signup, while the
  // handle_new_user trigger commits. Retry briefly.
  //
  // What we must NOT do is invent one. This previously fell back to a profile with
  // member_code hardcoded to 'ISOT-2026-0001' — so a failed fetch rendered someone
  // else's member code on the card, and a bartender scanning it would have validated
  // the wrong person.
  if (!profile) {
    for (let attempt = 0; attempt < 3 && !profile; attempt++) {
      await new Promise(r => setTimeout(r, 600));
      try {
        const { data } = await db.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) profile = data;
      } catch (e) { /* keep trying */ }
    }
  }

  // Still nothing. The account exists in auth.users but has no profiles row.
  //
  // handle_new_user() swallows its own exceptions on purpose — a failed profile insert
  // must never block account creation — so this state is reachable and silent: signup
  // succeeds, the confirmation email arrives, and then every guarded page hangs here.
  // Repair it instead of dead-ending someone who has just confirmed their email.
  let repairError = null;
  if (!profile) {
    try {
      // Returns { ok, reason } rather than throwing, so a failure arrives as data and
      // can be shown to the person it happened to.
      const { data: res, error } = await db.rpc('ensure_my_profile');
      if (error) {
        repairError = error.message;
      } else if (res && res.ok === false) {
        repairError = res.reason || 'profile could not be created';
      } else {
        const { data, error: readErr } = await db.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) profile = data;
        else if (readErr) repairError = 'created but not readable: ' + readErr.message;
      }
    } catch (e) {
      repairError = String(e && e.message ? e.message : e);
    }
  }

  if (!profile) {
    // The cause used to go to console.warn, which nobody standing in a bar can read —
    // so every report of this arrived as "it says my profile is missing" and no more.
    // Put the actual reason on the screen: whoever hits it can photograph it.
    showGateError(
      'We could not finish setting up your account',
      (repairError
        ? 'Show this to Amir: ' + repairError
        : 'Your account exists but has no profile record.') +
      ' · ' + (session.user.email || 'no email on account')
    );
    return new Promise(() => {});
  }

  // Remembered so sendNotification can stamp actor_id without re-fetching.
  window.__isotProfileId = profile.id;

  const isBoard = profile.staff_role === 'board';
  const isStaff = isBoard || profile.staff_role === 'volunteer';

  if (opts.board && !isBoard)                  return denyAccess('This page is for board members.');
  if (opts.staff && !isStaff)                  return denyAccess('This page is for volunteers and board members.');
  if (opts.socio && profile.tier !== 'socio' && !isBoard)
    return denyAccess('This page is for ISOT members. Membership is €10/year.');
  if (opts.partner && profile.staff_role !== 'partner' && !isBoard)
    return denyAccess('This page is for venue partners.');

  __authState = 'done';
  const gateEl = document.getElementById('gate');
  if (gateEl) gateEl.remove();

  initBurgerMenu(profile);

  // Populate the bell. No page called loadNotifications(), so localNotifications was
  // always empty and the unread badge never appeared anywhere in the app. Not awaited:
  // a count is not worth delaying the page for, and it repaints itself when it lands.
  loadNotifications().catch(e => console.warn('notifications:', e));

  return profile;
}

/* ---------------------------------------------------------------
 * Gate lifecycle
 *
 * #gate is the full-screen spinner every guarded page opens with. It must come
 * down when requireAuth() resolves — and it must NOT come down before that.
 *
 * This used to remove the gate unconditionally after 1.2s "so mobile safari never
 * freezes on a turning circle". That was wrong in two ways:
 *
 *   1. A page whose script is suspended at `await requireAuth()` has none of its
 *      own event listeners attached yet. Uncovering it gave the user a page whose
 *      buttons did nothing — and on complete-profile.html the <button type="submit">
 *      fell through to a NATIVE form submit, which reloaded the same URL. That is
 *      the "I press Finish and it just loads the same page" bug.
 *
 *   2. It erased gate ERRORS. showGateError() and denyAccess() both write into the
 *      gate and then hang forever on purpose; 1.2s later the message vanished and
 *      the page rendered underneath as though access had been granted.
 *
 * So: an error gate is permanent, a pending gate stays until auth decides, and the
 * "never freeze" promise is kept by a watchdog that shows a real message instead.
 * ------------------------------------------------------------- */
let __authState = 'idle';   // idle | pending | leaving | error | done

setTimeout(() => {
  const gate = document.getElementById('gate');
  if (!gate) return;
  if (gate.dataset.error === '1') return;                    // a message must stay put
  if (__authState === 'pending' || __authState === 'leaving') return;  // not our call yet
  gate.style.transition = 'opacity 0.3s ease';
  gate.style.opacity = '0';
  setTimeout(() => gate.remove(), 300);
}, 1200);

// Kept promise: never spin forever. Say what happened instead of exposing a dead page.
setTimeout(() => {
  if (__authState === 'pending' && document.getElementById('gate')) {
    showGateError(
      'Still connecting',
      'Signing you in is taking longer than usual. Check your connection and reload the page.'
    );
  }
}, 15000);

/* While the gate is up the page's own submit handler is not attached yet, so a
 * <button type="submit"> would do a native form submit and reload the page. */
document.addEventListener('submit', (e) => {
  if (document.getElementById('gate')) e.preventDefault();
}, true);

/* ---------------------------------------------------------------
 * Account Burger Drawer Component (Apple Glass Slide-In)
 * ------------------------------------------------------------- */
function initBurgerMenu(profile) {
  if (!profile || document.getElementById('burgerDrawer')) return;

  const isStaff = profile.staff_role === 'volunteer' || profile.staff_role === 'board';
  const isBoard = profile.staff_role === 'board';

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.id = 'burgerBackdrop';

  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'burgerDrawer';

  drawer.innerHTML = `
    <div class="drawer-header">
      <div style="display:flex;align-items:center;gap:8px">
        <img src="../assets/LOGOS/scritta isot.png" alt="ISOT" style="height:20px;" />
        <span style="font-weight:700;font-size:0.95rem;color:#FFF">Account</span>
      </div>
      <button type="button" id="closeDrawerBtn" style="background:transparent;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;padding:6px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="drawer-user-card">
      ${renderUserAvatarHtml(profile, 44)}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:#FFF;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(profile.full_name || 'Member')}
        </div>
        <div class="dim" style="font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(profile.email || '')}
        </div>
        <span class="badge ${profile.tier === 'socio' ? 'badge-socio' : 'badge-participant'}" style="margin-top:4px;display:inline-block">
          ${TIER_LABEL[profile.tier] || 'Community'}
        </span>
      </div>
    </div>

    <div class="drawer-nav">
      <div class="drawer-section-title">My Account Settings</div>
      <a href="profile.html" class="drawer-item">
        <i class="fa-solid fa-qrcode text-pink"></i>
        <span>My Member Card &amp; QR</span>
      </a>
      <a href="account.html" class="drawer-item">
        <i class="fa-solid fa-user-gear text-pink"></i>
        <span>Account &amp; Profile Settings</span>
      </a>

      <div class="drawer-section-title">App Navigation</div>
      <a href="home.html" class="drawer-item">
        <i class="fa-solid fa-house"></i>
        <span>App Hub</span>
      </a>
      ${isBoard ? `
      <a href="admin.html" class="drawer-item">
        <i class="fa-solid fa-sliders text-pink"></i>
        <span>Admin panel</span>
      </a>` : ''}
      <a href="karaoke.html" class="drawer-item">
        <i class="fa-solid fa-microphone"></i>
        <span>Karaoke Queue</span>
      </a>
      <a href="partner.html" class="drawer-item">
        <i class="fa-solid fa-store"></i>
        <span>Partner Venues &amp; Map</span>
      </a>
      <a href="../blog.html" class="drawer-item">
        <i class="fa-solid fa-book-open"></i>
        <span>Turin Student Guides</span>
      </a>
      <a href="assembly.html" class="drawer-item">
        <i class="fa-solid fa-check-to-slot"></i>
        <span>General Assembly &amp; Voting</span>
      </a>

      ${isStaff ? `
        <div class="drawer-section-title">Volunteer &amp; Board Staff</div>
        <a href="scan.html" class="drawer-item">
          <i class="fa-solid fa-camera text-gold"></i>
          <span>Door Scanner</span>
        </a>
        <a href="karaoke-kj.html" class="drawer-item">
          <i class="fa-solid fa-sliders text-gold"></i>
          <span>KJ Controller</span>
        </a>
      ` : ''}


    </div>

    <div class="drawer-footer">
      <button type="button" class="btn btn-outline" id="drawerSignOutBtn" style="width:100%;color:#FCA5A5;border-color:rgba(239,68,68,0.3)">
        <i class="fa-solid fa-right-from-bracket" style="margin-right:8px"></i> Sign Out
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  function toggle(open) {
    backdrop.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  backdrop.addEventListener('click', () => toggle(false));
  document.getElementById('closeDrawerBtn')?.addEventListener('click', () => toggle(false));
  document.getElementById('drawerSignOutBtn')?.addEventListener('click', () => signOut());

  document.querySelectorAll('#burgerBtn, [data-open-drawer]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggle(true);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) toggle(false);
  });
}

function denyAccess(message) {
  showGateError('Not available to you', message, true);
  return new Promise(() => {});
}

function showGateError(title, message, showHome = false) {
  const gate = document.getElementById('gate');
  if (!gate) return;
  // Sticky: the 1.2s fallback below must not wipe this and reveal the page behind it.
  gate.dataset.error = '1';
  __authState = 'error';
  gate.innerHTML = `
    <div class="card" style="max-width:380px;margin:20px;text-align:center">
      <h2 style="margin-bottom:10px">${escapeHtml(title)}</h2>
      <p class="muted" style="font-size:0.9rem;margin-bottom:${showHome ? '20px' : '0'}">${escapeHtml(message)}</p>
      ${showHome ? '<a class="btn btn-outline" href="home.html">Back</a>' : ''}
    </div>`;
}

async function signOut() {
  // Sign-out has to actually leave. Previously this fired signOut() and redirected
  // without checking it worked — so if the call failed, the session survived in
  // localStorage and the next guarded page signed you straight back into the old
  // account. That is exactly what happens in a home-screen PWA, where the app stays
  // resident and nothing forces a clean reload.
  try {
    await db?.auth.signOut();                    // revoke server-side
  } catch (e) {
    console.warn('signOut (global) failed:', e);
  }

  try {
    await db?.auth.signOut({ scope: 'local' });  // clear locally even if the network failed
  } catch (e) { /* already gone */ }

  // Belt and braces: purge any Supabase token still sitting in storage.
  try {
    for (const store of [localStorage, sessionStorage]) {
      Object.keys(store)
        .filter(k => k.startsWith('sb-') || k.includes('supabase.auth'))
        .forEach(k => store.removeItem(k));
    }
  } catch (e) { /* private mode */ }

  // Verify before leaving, so we never redirect while still signed in.
  try {
    const { data } = await db.auth.getSession();
    if (data?.session) console.warn('session survived sign-out; storage cleared anyway');
  } catch (e) { /* ignore */ }

  // Cache-bust so a resident PWA cannot serve a page rendered for the old user.
  location.replace('login.html?signedout=' + Date.now());
}

/* ---------------------------------------------------------------
 * Navigation Helpers
 * ------------------------------------------------------------- */
function homeFor(profile) {
  if (profile.staff_role === 'partner')   return 'partner.html';
  if (profile.staff_role === 'volunteer') return 'home.html';
  return 'home.html';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function setAlert(el, message, type = 'error') {
  if (!el) return;
  if (!message) { el.hidden = true; return; }
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.hidden = false;
}

function busy(btn, label = 'Working…') {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = original; };
}

function passesBotCheck(form) {
  if (form.querySelector('.hp')?.value) return false;
  const city = form.querySelector('[name="city"]')?.value.trim().toLowerCase();
  return city === 'turin' || city === 'torino';
}

const TIER_LABEL = { socio: 'ISOT Member', participant: 'Community' };
const ROLE_LABEL = { board: 'Board', volunteer: 'Volunteer', partner: 'Venue partner' };

/* ---------------------------------------------------------------
 * Google sign-in + password recovery
 * ------------------------------------------------------------- */

function appUrl(page) {
  return new URL(page, location.href).href;
}

async function signInWithGoogle(btn) {
  const restore = btn ? busy(btn, 'Opening Google…') : () => {};
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: appUrl('complete-profile.html'),
      // Without prompt=select_account, Google silently reuses whichever account the
      // browser is already signed into and never shows the chooser. Someone with two
      // Google accounts gets signed in as the wrong one with no visible choice — and
      // since ISOT keys members on the auth user, that quietly creates a SECOND member
      // record for the same person. It happened to the president's own account.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) { restore(); throw error; }
}

async function sendPasswordReset(email) {
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: appUrl('reset.html'),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

function googleButtonHtml(label = 'Continue with Google') {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin:18px 0">
      <span style="flex:1;height:1px;background:var(--border-light)"></span>
      <span class="dim" style="font-size:0.78rem">or</span>
      <span style="flex:1;height:1px;background:var(--border-light)"></span>
    </div>
    <button type="button" class="btn btn-outline" id="googleBtn">
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.1 35.7 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z"/>
      </svg>
      ${escapeHtml(label)}
    </button>`;
}

/* ---------------------------------------------------------------
 * Global Notification & Event Invitation System
 * ------------------------------------------------------------- */
// Notifications live on the server and belong to their recipient. This array is only a
// render cache for the current user's own rows, refilled by loadNotifications().
// It used to be seeded from localStorage, which is how a notification the user *sent*
// ended up displayed as one they had *received*.
let localNotifications = [];

/** Fetch this user's notifications. RLS restricts the rows to auth.uid(). */
async function loadNotifications() {
  if (!db) return [];
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Could not load notifications:', error.message);
    return [];
  }
  localNotifications = data || [];
  updateNotificationBellUI();
  return localNotifications;
}

/** Mark one as read. */
async function markNotificationRead(id) {
  if (!db) return;
  const { error } = await db.from('notifications').update({ read: true }).eq('id', id);
  if (error) { console.error('Could not mark read:', error.message); return; }
  const n = localNotifications.find(x => x.id === id);
  if (n) n.read = true;
  updateNotificationBellUI();
}

function getUnreadNotificationsCount() {
  return localNotifications.filter(n => !n.read).length;
}

function sendNotification(recipientId, type, title, message, eventId = null, eventDate = null) {
  const currentProfileId = window.__isotProfileId || null;
  const notif = {
    id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    recipientId,
    type, // 'friend_request', 'event_invite', 'friend_accept'
    title,
    message,
    eventId,
    read: false,
    created_at: new Date().toISOString()
  };

  // Do NOT put it in our own list. This is the bug that made a friend request sent to
  // someone else appear in the sender's own notifications: the object was unshifted into
  // localNotifications regardless of who recipientId was, and the database insert
  // underneath failed silently because the notifications table did not exist.
  //
  // A notification belongs to its recipient, so it only goes to the server. The recipient
  // reads it back with loadNotifications(), filtered to their own id by RLS.
  if (!db) {
    console.warn('Cannot send notification: no database connection.');
    return { ok: false, error: 'offline' };
  }

  return db.from('notifications').insert({
    user_id: recipientId,          // who should see it
    actor_id: currentProfileId,    // who caused it — RLS requires this to be us
    type,
    title,
    message,
    event_id: eventId,
    // The rule id alone cannot say WHICH Monday karaoke — a recurring event needs the
    // occurrence date too, or the invite cannot be resolved back to a real night.
    event_date: eventDate,
    read: false,
  }).then(({ error }) => {
    if (error) {
      console.error('Notification failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });
}

function updateNotificationBellUI() {
  const bellBadge = document.getElementById('notifBellBadge');
  if (bellBadge) {
    const unread = getUnreadNotificationsCount();
    if (unread > 0) {
      bellBadge.style.display = 'inline-flex';
      bellBadge.textContent = unread;
    } else {
      bellBadge.style.display = 'none';
    }
  }
}

function openNotificationCenterModal() {
  let modal = document.getElementById('notifCenterModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'notifCenterModal';
    modal.onclick = closeNotificationCenterModal;
    modal.innerHTML = `
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div class="eyebrow"><i class="fa-solid fa-bell text-pink"></i> Activity Center</div>
            <h2 style="font-size:1.3rem;color:#FFF;margin-top:2px">Notifications &amp; Invites</h2>
          </div>
          <button type="button" onclick="closeNotificationCenterModal()" style="background:transparent;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div id="notifListContainer"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  renderNotificationsList();
  modal.classList.add('active');

  // Mark as read on the server, not in localStorage — otherwise the badge clears on this
  // device and comes straight back on the next one.
  const unread = localNotifications.filter(n => !n.read).map(n => n.id);
  if (db && unread.length) {
    db.from('notifications').update({ read: true }).in('id', unread)
      .then(({ error }) => {
        if (error) return console.error('Could not mark read:', error.message);
        localNotifications.forEach(n => { n.read = true; });
        updateNotificationBellUI();
      });
  }
}

function closeNotificationCenterModal() {
  const modal = document.getElementById('notifCenterModal');
  if (modal) modal.classList.remove('active');
}

function renderNotificationsList() {
  const container = document.getElementById('notifListContainer');
  if (!container) return;

  if (!localNotifications.length) {
    container.innerHTML = `
      <div class="card card-glass" style="text-align:center;padding:30px">
        <i class="fa-solid fa-bell-slash text-pink" style="font-size:1.8rem;margin-bottom:10px"></i>
        <h3 style="font-size:1rem;color:#FFF;margin-bottom:4px">No Notifications Yet</h3>
        <p class="dim" style="font-size:0.82rem">You'll see friend requests and event invites here!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = localNotifications.map(n => `
    <div class="card card-glass" style="margin-bottom:10px;padding:12px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-weight:700;color:#FFF;font-size:0.9rem;display:flex;align-items:center;gap:6px">
          <i class="${n.type === 'event_invite' ? 'fa-solid fa-envelope-open-text text-pink' : 'fa-solid fa-user-plus text-green'}"></i>
          ${escapeHtml(n.title)}
        </div>
        <span class="dim" style="font-size:0.7rem">${new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <p class="dim" style="font-size:0.82rem;margin-bottom:8px">${escapeHtml(n.message)}</p>
      ${n.eventId ? `<a href="events.html" class="btn btn-pink" style="width:auto;padding:4px 12px;font-size:0.75rem;display:inline-flex">View Event Schedule 📅</a>` : ''}
    </div>
  `).join('');
}

/* ---------------------------------------------------------------
 * Show / hide password
 *
 * Runs on every page and attaches to any input[type=password], so pages added
 * later get it without remembering to wire anything up. Matters most on signup
 * and reset, where someone is typing a password they cannot check — on a phone,
 * one-handed, often in a bar.
 * ------------------------------------------------------------- */

const PW_EYE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const PW_EYE_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7c2 0 3.8.7 5.2 1.6M22 12s-3.5 7-10 7c-2 0-3.8-.7-5.2-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>`;

function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.pwToggle) return;          // already wired
    input.dataset.pwToggle = '1';

    // Wrap the input so the button can sit inside its right edge
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';                          // never submits the form
    btn.className = 'pw-toggle';
    btn.innerHTML = PW_EYE;
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('aria-pressed', 'false');
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? PW_EYE : PW_EYE_OFF;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      btn.setAttribute('aria-pressed', String(!showing));
      // Keep the caret where it was rather than jumping to the start
      const pos = input.value.length;
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  });
}

/**
 * Garante Privacy & ePrivacy Compliant Cookie Consent Banner
 */
function initCookieConsentBanner() {
  if (localStorage.getItem('isot_cookie_consent')) return;

  const banner = document.createElement('div');
  banner.id = 'isotCookieBanner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    max-width: 440px;
    margin: 0 auto;
    z-index: 99999;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(238, 9, 121, 0.4);
    border-radius: 20px;
    padding: 18px 20px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    color: #F8FAFC;
    font-family: var(--font-body, sans-serif);
    font-size: 0.85rem;
    line-height: 1.5;
  `;

  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
      <span style="font-size:1.4rem">🛡️</span>
      <div>
        <div style="font-weight:700;color:#FFF;font-size:0.92rem;margin-bottom:2px">Privacy &amp; Cookie Preferences</div>
        <div style="color:#CBD5E1">We use essential session storage and anonymized cookieless analytics to secure your profile and improve student integration.</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end">
      <a href="/privacy.html" target="_blank" style="color:#EE0979;font-weight:600;font-size:0.8rem;text-decoration:none;padding:6px 10px;">Privacy Policy ➔</a>
      <button type="button" id="acceptCookieBtn" style="background:#EE0979;color:#FFF;border:none;border-radius:9999px;padding:8px 18px;font-weight:600;font-size:0.82rem;cursor:pointer;box-shadow:0 4px 12px rgba(238,9,121,0.4)">
        Got It / Accept
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('acceptCookieBtn')?.addEventListener('click', () => {
    localStorage.setItem('isot_cookie_consent', 'accepted');
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(20px)';
    banner.style.transition = 'all 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();
    initCookieConsentBanner();
  });
} else {
  initPasswordToggles();
  initCookieConsentBanner();
}

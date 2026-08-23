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
 * Generates an Apple-grade deterministic dual-color split circle SVG avatar
 * based on the member's unique `member_code`.
 */
function renderGeoAvatar(memberCode, size = 44) {
  const codeStr = String(memberCode || 'ISOT-2026-0000');
  let hash = 0;
  for (let i = 0; i < codeStr.length; i++) {
    hash = (hash << 5) - hash + codeStr.charCodeAt(i);
    hash |= 0;
  }

  const index1 = Math.abs(hash) % IDENTITY_PALETTE.length;
  const index2 = Math.abs(hash >> 3) % IDENTITY_PALETTE.length;
  const color1 = IDENTITY_PALETTE[index1];
  const color2 = index1 === index2 ? IDENTITY_PALETTE[(index2 + 1) % IDENTITY_PALETTE.length] : IDENTITY_PALETTE[index2];

  return `
    <svg class="geo-avatar" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="leftHalf-${codeStr}">
          <rect x="0" y="0" width="50" height="100"/>
        </clipPath>
        <clipPath id="rightHalf-${codeStr}">
          <rect x="50" y="0" width="100" height="100"/>
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill="${color1}" clip-path="url(#leftHalf-${codeStr})"/>
      <circle cx="50" cy="50" r="50" fill="${color2}" clip-path="url(#rightHalf-${codeStr})"/>
      <circle cx="50" cy="50" r="14" fill="#000000" opacity="0.15"/>
    </svg>
  `;
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
  return `
    <div class="cat-badge" style="width:${size}px;height:${size}px">
      <img src="${assetSrc}" alt="${key} category" />
    </div>
  `;
}

/* ---------------------------------------------------------------
 * Auth Guard
 * ------------------------------------------------------------- */
async function requireAuth(opts = {}) {
  if (!db) {
    showGateError(
      'Not configured yet',
      'Supabase credentials missing from js/isot.js.'
    );
    return new Promise(() => {});
  }

  let { data: { session } } = await db.auth.getSession();

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
    const rawPage = location.pathname.split('/').pop().replace(/\.html$/i, '') || 'home';
    const cleanTarget = (rawPage === 'login' || rawPage === 'signup') ? 'home.html' : rawPage + '.html';
    location.replace('login.html?next=' + encodeURIComponent(cleanTarget));
    return new Promise(() => {});
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    showGateError('Profile missing', 'Your account exists but has no profile row. Make sure migration 004 has been run in Supabase.');
    return new Promise(() => {});
  }

  const isBoard = profile.staff_role === 'board';
  const isStaff = isBoard || profile.staff_role === 'volunteer';

  if (opts.board && !isBoard)                  return denyAccess('This page is for board members.');
  if (opts.staff && !isStaff)                  return denyAccess('This page is for volunteers and board members.');
  if (opts.socio && profile.tier !== 'socio' && !isBoard)
    return denyAccess('This page is for ISOT members. Membership is €10/year.');
  if (opts.partner && profile.staff_role !== 'partner' && !isBoard)
    return denyAccess('This page is for venue partners.');

  document.getElementById('gate')?.remove();
  initBurgerMenu(profile);
  return profile;
}

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
      ${renderGeoAvatar(profile.member_code, 44)}
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
      <a href="complete-profile.html" class="drawer-item">
        <i class="fa-solid fa-user-gear text-pink"></i>
        <span>Account &amp; Profile Settings</span>
      </a>

      <div class="drawer-section-title">App Navigation</div>
      <a href="home.html" class="drawer-item">
        <i class="fa-solid fa-house"></i>
        <span>App Hub</span>
      </a>
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

      ${isBoard ? `
        <a href="dashboard.html" class="drawer-item">
          <i class="fa-solid fa-chart-line text-gold"></i>
          <span>Board Analytics Dashboard</span>
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
  gate.innerHTML = `
    <div class="card" style="max-width:380px;margin:20px;text-align:center">
      <h2 style="margin-bottom:10px">${escapeHtml(title)}</h2>
      <p class="muted" style="font-size:0.9rem;margin-bottom:${showHome ? '20px' : '0'}">${escapeHtml(message)}</p>
      ${showHome ? '<a class="btn btn-outline" href="home.html">Back</a>' : ''}
    </div>`;
}

async function signOut() {
  await db?.auth.signOut();
  location.replace('login.html');
}

/* ---------------------------------------------------------------
 * Navigation Helpers
 * ------------------------------------------------------------- */
function homeFor(profile) {
  if (profile.staff_role === 'board')     return 'dashboard.html';
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
    options: { redirectTo: appUrl('complete-profile.html') },
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

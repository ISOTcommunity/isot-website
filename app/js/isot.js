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
  social: '../assets/LOGOS/Tog.jpeg',
  party: '../assets/LOGOS/Party.jpeg',
  career: '../assets/LOGOS/Busines.jpeg',
  sports: '../assets/LOGOS/Sport.jpeg',
};

/**
 * Renders Category Character Badge HTML or Karaoke character SVG
 */
function getCategoryBadgeHtml(catKey) {
  const key = String(catKey || 'social').toLowerCase();
  if (key === 'karaoke') {
    // Custom Karaoke Category Character SVG (Asterisk with sunglasses & microphone)
    return `
      <div class="cat-badge">
        <svg viewBox="0 0 100 100" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="42" fill="#EBC17F"/>
          <rect x="25" y="44" width="50" height="12" rx="6" fill="#3F35A0"/>
          <circle cx="36" cy="50" r="9" fill="#000"/>
          <circle cx="64" cy="50" r="9" fill="#000"/>
          <path d="M 40 68 Q 50 78 60 68" stroke="#3F35A0" stroke-width="4" fill="none" stroke-linecap="round"/>
          <rect x="70" y="25" width="4" height="24" rx="2" fill="#B64226"/>
          <ellipse cx="72" cy="22" rx="6" ry="8" fill="#3F35A0"/>
        </svg>
      </div>
    `;
  }

  const assetSrc = CATEGORY_ASSETS[key] || CATEGORY_ASSETS.social;
  return `
    <div class="cat-badge">
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

  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    location.replace('login.html?next=' + encodeURIComponent(location.pathname.replace(/^\//, '')));
    return new Promise(() => {});
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    showGateError('Profile missing', 'Your account exists but has no profile row.');
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
  return profile;
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

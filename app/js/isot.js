/* ISOT app — Supabase client, auth guard, shared helpers.
 *
 * The anon key is public by design: RLS is what protects the data, which is why
 * the policies in supabase/001_schema.sql are not optional. The service_role key
 * bypasses RLS entirely and must never appear in this repo — Edge Function env only.
 */

/* eslint-disable no-unused-vars */

const ISOT_CONFIG = {
  // Supabase project "isot" — eu-central-1 (Frankfurt).
  // This anon key is public on purpose; RLS is the protection.
  SUPABASE_URL: 'https://ywmdaekblhabyajzusfm.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw',
};

const isConfigured = () =>
  !ISOT_CONFIG.SUPABASE_URL.startsWith('REPLACE_') &&
  !ISOT_CONFIG.SUPABASE_ANON_KEY.startsWith('REPLACE_');

const db = isConfigured()
  ? window.supabase.createClient(ISOT_CONFIG.SUPABASE_URL, ISOT_CONFIG.SUPABASE_ANON_KEY)
  : null;

/* ---------------------------------------------------------------
 * Auth guard
 *
 * Every authenticated page calls this first. It resolves with the
 * signed-in profile, or redirects and never resolves.
 *
 *   const me = await requireAuth();                  // any signed-in user
 *   const me = await requireAuth({ staff: true });   // volunteer or board
 *   const me = await requireAuth({ board: true });   // board only
 *   const me = await requireAuth({ socio: true });   // soci only
 * ------------------------------------------------------------- */
async function requireAuth(opts = {}) {
  if (!db) {
    showGateError(
      'Not configured yet',
      'Supabase credentials are missing from js/isot.js. Add the project URL and anon key, then redeploy.'
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
    showGateError('Profile missing', 'Your account exists but has no profile row. Tell Amir — the signup trigger may not have run.');
    return new Promise(() => {});
  }

  const isBoard = profile.staff_role === 'board';
  const isStaff = isBoard || profile.staff_role === 'volunteer';

  if (opts.board && !isBoard)                  return denyAccess('This page is for board members.');
  if (opts.staff && !isStaff)                  return denyAccess('This page is for volunteers and board members.');
  if (opts.socio && profile.tier !== 'socio' && !isBoard)
    return denyAccess('This page is for ISOT members. Membership is €10/year and includes voting rights.');
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
 * Helpers
 * ------------------------------------------------------------- */

/** Where a user lands after signing in, based on what they are. */
function homeFor(profile) {
  if (profile.staff_role === 'board')   return 'dashboard.html';
  if (profile.staff_role === 'partner') return 'partner.html';
  if (profile.staff_role === 'volunteer') return 'scan.html';
  return 'profile.html';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Inline feedback. `type` is 'error' | 'success' | 'info'. */
function setAlert(el, message, type = 'error') {
  if (!el) return;
  if (!message) { el.hidden = true; return; }
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.hidden = false;
}

/** Swaps a button into a loading state and returns a restore function. */
function busy(btn, label = 'Working…') {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = original; };
}

/**
 * Bot filter, matching the public site: a hidden honeypot plus a question only
 * someone who knows ISOT answers. Pure client-side — it stops drive-by bots,
 * not a determined human, which is the right level here.
 */
function passesBotCheck(form) {
  if (form.querySelector('.hp')?.value) return false;
  const city = form.querySelector('[name="city"]')?.value.trim().toLowerCase();
  return city === 'turin' || city === 'torino';
}

const TIER_LABEL = { socio: 'ISOT Member', participant: 'Community' };
const ROLE_LABEL = { board: 'Board', volunteer: 'Volunteer', partner: 'Venue partner' };

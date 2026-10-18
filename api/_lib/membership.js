// ISOT — shared helpers for the membership functions (checkout, webhook)
//
// WHY NO SDKs
// The site has no package.json and no build step; every function here is a plain Node
// file. Stripe and Supabase are both plain HTTPS APIs, so fetch is enough and nothing has
// to be installed or kept up to date.
//
// SECRETS (Vercel → Settings → Environment Variables, never in this file)
//   STRIPE_SECRET_KEY           sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET       whsec_…, from the webhook endpoint in Stripe
//   SUPABASE_SERVICE_ROLE_KEY   bypasses RLS: server only, never sent to a browser
//
// Underscore folder: Vercel does not expose files under api/_lib as endpoints.

const crypto = require('crypto');

const SUPABASE_URL = 'https://ywmdaekblhabyajzusfm.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw';
const SITE_URL = 'https://isotcommunity.com';

// The Assembly sets the quota (Statute Art. 8). Change it here when it does.
const QUOTA_CENTS = 1000;
const PRODUCT_NAME = 'ISOT APS – Quota associativa';

// ISOT's own identity on the Stripe page, set per session the same way the
// Hospitality Certificate site does it. The account-level branding in the Stripe
// dashboard still drives receipts and the customer portal.
const BRANDING = {
  branding_settings: {
    display_name: 'ISOT APS',
    icon: { type: 'url', url: `${SITE_URL}/assets/apple-touch-icon.png` },
    button_color: '#D4AF50',
  },
};

// ---------------------------------------------------------------- Stripe

// Stripe's API takes form encoding with bracketed keys: a[b][0][c]=…
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? formEncode(params) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error?.message || `Stripe ${res.status}`);
    err.type = json.error?.type;
    err.status = res.status;
    throw err;
  }
  return json;
}

// Branding can never cost a payment: if Stripe rejects it, create the session without it.
async function createCheckoutSession(params) {
  try {
    return await stripe('POST', 'checkout/sessions', { ...params, ...BRANDING });
  } catch (err) {
    if (err.type !== 'invalid_request_error') throw err;
    console.error('[stripe] branding_settings rejected, retrying without:', err.message);
    return stripe('POST', 'checkout/sessions', params);
  }
}

// Stripe-Signature: t=<unix>,v1=<hex hmac of "t.rawBody">. Five-minute tolerance.
function verifyStripeSignature(rawBody, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2)
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const given = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return given.some((sig) => {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

// ---------------------------------------------------------------- Supabase

function serviceHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

// PostgREST as the service role. path e.g. "membership_applications?id=eq.<uuid>"
async function db(method, path, body, prefer) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: serviceHeaders(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(json?.message || `Supabase ${res.status}`);
    err.code = json?.code;
    throw err;
  }
  return json;
}

// Who is calling: the app sends the signed-in user's access token.
async function userFromRequest(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: auth },
  });
  if (!res.ok) return null;
  return res.json();
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = {
  SUPABASE_URL,
  ANON_KEY,
  SITE_URL,
  QUOTA_CENTS,
  PRODUCT_NAME,
  stripe,
  createCheckoutSession,
  verifyStripeSignature,
  db,
  userFromRequest,
  readRawBody,
};

// ISOT — Stripe webhook: the only place a membership payment is recorded
//
// Stripe → https://isotcommunity.com/api/stripe-webhook
// Events to subscribe in the Stripe dashboard:
//   checkout.session.completed   admission paid → application 'paid' (waits for the Board)
//                                renewal paid   → new membership year (record_renewal)
//   invoice.paid                 yearly auto-renew charge → new membership year
//   invoice.payment_failed       yearly charge failed → 'charge_failed' email, which is the
//                                Art. 5 written reminder (api/membership-reminders takes over)
//
// Never trust the browser's return from Stripe: only a signed event changes the database.
// Every write is idempotent — Stripe redelivers events, and a redelivery must not create a
// second year or a second receipt (stripe_payment_ref is UNIQUE; record_renewal returns the
// existing row).
//
// Payment never admits anyone (Statute Art. 6): approve_application() is the Board's.

const { verifyStripeSignature, db, readRawBody } = require('./_lib/membership');
const { sendEmail } = require('./_lib/email');

const DAY = 86400000;

// An email failing must never make Stripe retry a payment we already recorded.
async function quietly(fn) {
  try { await fn(); } catch (err) { console.error('[stripe-webhook] email', err); }
}

async function onCheckoutCompleted(s) {
  const meta = s.metadata || {};
  if (s.payment_status !== 'paid') return 'not paid yet';

  if (meta.kind === 'admission') {
    // Only a 'submitted' application moves to 'paid'; a redelivery finds it already paid.
    const rows = await db('PATCH',
      `membership_applications?id=eq.${meta.application_id}&status=eq.submitted`,
      {
        status: 'paid',
        paid_at: new Date((s.created || Date.now() / 1000) * 1000).toISOString(),
        stripe_session_id: s.id,
        stripe_payment_intent: s.payment_intent || s.invoice || null,
        stripe_customer_id: s.customer || null,
        stripe_subscription_id: s.subscription || null,
        amount_eur: (s.amount_total || 0) / 100,
      },
      'return=representation');
    if (!rows.length) return 'already recorded';
    await quietly(() => sendEmail('application_received', rows[0].email, rows[0]));
    return 'application paid';
  }

  if (meta.kind === 'renewal') {
    await db('POST', 'rpc/record_renewal', {
      p_membership: meta.membership_id,
      p_payment_ref: s.payment_intent,
      p_auto_renew: false,
    });
    return 'renewal recorded';
  }

  return 'not a membership payment';
}

async function onInvoicePaid(inv) {
  // The first invoice of a subscription is the admission itself (handled above).
  // Only the yearly cycle is a renewal.
  if (inv.billing_reason !== 'subscription_cycle') return 'not a renewal cycle';
  const sub = inv.subscription || inv.parent?.subscription_details?.subscription;
  if (!sub) return 'no subscription';

  const [m] = await db('GET',
    `memberships?stripe_subscription_id=eq.${encodeURIComponent(sub)}&status=eq.active&order=valid_until.desc&limit=1&select=id`);
  if (!m) {
    // Charged, but no active membership: e.g. the Board never approved, or it lapsed.
    // Log loudly — the Board must refund and cancel this subscription by hand.
    console.error('[stripe-webhook] yearly charge without an active membership', sub, inv.id);
    return 'no active membership for subscription';
  }

  await db('POST', 'rpc/record_renewal', {
    p_membership: m.id,
    p_payment_ref: inv.id,
    p_auto_renew: true,
  });
  return 'auto-renewal recorded';
}

async function onInvoiceFailed(inv) {
  if (inv.billing_reason !== 'subscription_cycle') return 'not a renewal cycle';
  const sub = inv.subscription || inv.parent?.subscription_details?.subscription;
  if (!sub) return 'no subscription';
  const [m] = await db('GET',
    `memberships?stripe_subscription_id=eq.${encodeURIComponent(sub)}&status=eq.active&order=valid_until.desc&limit=1` +
    '&select=id,profile_id,member_name,valid_until,profiles(email,full_name),membership_applications(email)');
  if (!m) return 'no active membership for subscription';
  const done = await db('GET', `membership_notices?membership_id=eq.${m.id}&kind=eq.charge_failed&select=id`);
  if (done.length) return 'reminder already sent';

  const to = m.profiles?.email || m.membership_applications?.email;
  if (!to) return 'no email';
  const lapse = new Date(Date.now() + 60 * DAY).toISOString().slice(0, 10);
  const id = await sendEmail('charge_failed', to,
    { member_name: m.profiles?.full_name || m.member_name, valid_until: m.valid_until, lapse_date: lapse });
  await db('POST', 'membership_notices',
    { membership_id: m.id, profile_id: m.profile_id, kind: 'charge_failed', sent_to: to, provider_id: id },
    'resolution=ignore-duplicates');
  return 'charge_failed reminder sent';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const raw = await readRawBody(req);
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) {
    return res.status(400).json({ error: 'bad signature' });
  }

  const event = JSON.parse(raw);
  try {
    let result = 'ignored';
    if (event.type === 'checkout.session.completed') result = await onCheckoutCompleted(event.data.object);
    else if (event.type === 'invoice.paid') result = await onInvoicePaid(event.data.object);
    else if (event.type === 'invoice.payment_failed') result = await onInvoiceFailed(event.data.object);
    console.log('[stripe-webhook]', event.type, event.id, result);
    return res.status(200).json({ received: true, result });
  } catch (err) {
    // 500 makes Stripe retry, which is what we want for a database hiccup.
    console.error('[stripe-webhook]', event.type, event.id, err);
    return res.status(500).json({ error: 'processing failed' });
  }
};

// The signature is over the exact bytes Stripe sent, so the body must not be parsed first.
module.exports.config = { api: { bodyParser: false } };

// ISOT — Stripe Checkout for the membership quota
//
// POST, with the signed-in user's Supabase token (Authorization: Bearer …)
//   { kind: 'admission', application_id, plan: 'one_off' | 'yearly' }
//   { kind: 'renewal',   membership_id }
// → { url } of the Stripe page to send the browser to.
//
// Payment never admits anyone (Statute Art. 6). An admission payment only moves the
// application to 'paid' — the Board approves it afterwards. That is done by the webhook
// (api/stripe-webhook.js), never here: the browser coming back from Stripe proves nothing.
//
// Renewal (decided 18 Oct 2026): open from 30 days before the anniversary until the
// membership lapses 60 days after it. Yearly auto-renew members never come here; Stripe
// charges them on the anniversary.

const {
  SITE_URL, QUOTA_CENTS, PRODUCT_NAME,
  createCheckoutSession, db, userFromRequest,
} = require('./_lib/membership');

const DAY = 86400000;

function lineItem(recurring) {
  return {
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: QUOTA_CENTS,
      product_data: { name: PRODUCT_NAME },
      recurring: recurring ? { interval: 'year' } : undefined,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (body.kind === 'admission') {
      const [app] = await db('GET',
        `membership_applications?id=eq.${encodeURIComponent(body.application_id)}&profile_id=eq.${user.id}&select=*`);
      if (!app) return res.status(404).json({ error: 'application not found' });
      if (app.status !== 'submitted') return res.status(409).json({ error: `application is already ${app.status}` });

      const yearly = body.plan === 'yearly';
      const meta = { kind: 'admission', application_id: app.id, profile_id: user.id };

      const session = await createCheckoutSession({
        mode: yearly ? 'subscription' : 'payment',
        line_items: [lineItem(yearly)],
        customer_email: app.email,
        client_reference_id: app.id,
        metadata: meta,
        // On a subscription the metadata must also sit on the subscription itself, so
        // the yearly invoices can be traced back to this member.
        subscription_data: yearly ? { metadata: meta } : undefined,
        payment_intent_data: yearly ? undefined : { metadata: meta },
        locale: 'auto',
        success_url: `${SITE_URL}/app/apply.html?paid=1`,
        cancel_url: `${SITE_URL}/app/apply.html?cancelled=1`,
      });

      await db('PATCH', `membership_applications?id=eq.${app.id}`,
        { stripe_session_id: session.id, payment_plan: yearly ? 'yearly' : 'one_off' });

      return res.status(200).json({ url: session.url });
    }

    if (body.kind === 'renewal') {
      const [m] = await db('GET',
        `memberships?id=eq.${encodeURIComponent(body.membership_id)}&profile_id=eq.${user.id}&status=eq.active&select=*`);
      if (!m) return res.status(404).json({ error: 'no active membership to renew' });
      if (m.auto_renew) return res.status(409).json({ error: 'this membership renews automatically' });

      const anniversary = new Date(`${m.valid_until}T00:00:00Z`).getTime();
      const now = Date.now();
      if (now < anniversary - 30 * DAY) return res.status(409).json({ error: 'renewal opens 30 days before your anniversary' });
      if (now > anniversary + 60 * DAY) return res.status(409).json({ error: 'membership has lapsed: please apply again' });

      // A renewal already paid for this year: don't take the money twice.
      const next = await db('GET',
        `memberships?profile_id=eq.${user.id}&kind=eq.renewal&valid_from=eq.${m.valid_until}&select=id`);
      if (next.length) return res.status(409).json({ error: 'already renewed' });

      const meta = { kind: 'renewal', membership_id: m.id, profile_id: user.id };
      const session = await createCheckoutSession({
        mode: 'payment',
        line_items: [lineItem(false)],
        customer_email: user.email,
        client_reference_id: m.id,
        metadata: meta,
        payment_intent_data: { metadata: meta },
        locale: 'auto',
        success_url: `${SITE_URL}/app/profile.html?renewed=1`,
        cancel_url: `${SITE_URL}/app/profile.html`,
      });
      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: 'kind must be admission or renewal' });
  } catch (err) {
    console.error('[membership-checkout]', err);
    return res.status(500).json({ error: 'could not start the payment' });
  }
};

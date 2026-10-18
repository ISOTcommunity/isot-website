// ISOT — Stripe customer portal for yearly auto-renew members
//
// POST, signed in → { url }. Lets a member cancel automatic renewal or change the card.
// Cancelling stops future charges only; the current year is not refunded (Art. 6, 8).
// The portal itself is configured once in Stripe: Settings → Billing → Customer portal.

const { SITE_URL, stripe, db, userFromRequest } = require('./_lib/membership');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });
    const [m] = await db('GET',
      `memberships?profile_id=eq.${user.id}&status=eq.active&stripe_customer_id=not.is.null&order=valid_until.desc&limit=1&select=stripe_customer_id`);
    if (!m) return res.status(404).json({ error: 'no card payment on file' });
    const session = await stripe('POST', 'billing_portal/sessions',
      { customer: m.stripe_customer_id, return_url: `${SITE_URL}/app/profile.html` });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[membership-portal]', err);
    return res.status(500).json({ error: 'could not open the payment portal' });
  }
};

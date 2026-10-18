// ISOT — Board: reject or withdraw a membership application, with the refund
//
// POST, Board only (Authorization: Bearer <token of a board account>)
//   { application_id, action: 'reject', reason }   Statute Art. 6: reasoned, in writing,
//                                                    within 30 days, fee refunded in full
//   { action: 'withdraw', application_id }          applicant withdrew before the decision
//
//   { action: 'approve', application_id }         Board admitted the applicant
//
// Approval runs approve_application() (073) AS THE CALLING BOARD MEMBER — their own token
// is forwarded, so the database's is_board() check and decided_by stay theirs — and then
// sends the welcome email.
//
// The refund has to go through Stripe with the secret key, which is why this is a
// server function. A yearly plan's subscription is cancelled too, so it never charges
// again. Cash and bank-transfer applications are refunded by hand: the response says so.

const { SUPABASE_URL, ANON_KEY, stripe, db, userFromRequest } = require('./_lib/membership');
const { sendEmail } = require('./_lib/email');

async function refundStripe(app) {
  let ref = app.stripe_payment_intent;
  if (ref && ref.startsWith('in_')) {
    // Subscription first payment: the session gave an invoice, not a payment intent.
    // Refund the customer's latest charge instead, which is that invoice's payment.
    ref = null;
  }
  if (ref) {
    return stripe('POST', 'refunds', { payment_intent: ref, metadata: { application_id: app.id } });
  }
  if (app.stripe_customer_id) {
    const charges = await stripe('GET', `charges?customer=${encodeURIComponent(app.stripe_customer_id)}&limit=1`);
    const charge = charges.data && charges.data[0];
    if (charge && !charge.refunded) {
      return stripe('POST', 'refunds', { charge: charge.id, metadata: { application_id: app.id } });
    }
  }
  throw new Error('no Stripe payment found to refund');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });
    const [me] = await db('GET', `profiles?id=eq.${user.id}&select=staff_role`);
    if (me?.staff_role !== 'board') return res.status(403).json({ error: 'board only' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action;
    if (action === 'approve') {
      const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/approve_application`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: req.headers.authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_application: body.application_id }),
      });
      const out = await rpc.json().catch(() => null);
      if (!rpc.ok) return res.status(409).json({ error: out?.message || 'could not admit' });
      const [m] = await db('GET', `memberships?id=eq.${out}&select=valid_until`);
      const [app] = await db('GET', `membership_applications?id=eq.${encodeURIComponent(body.application_id)}&select=*`);
      let emailed = true;
      try { await sendEmail('admitted', app.email, { ...app, valid_until: m.valid_until }); }
      catch (err) { console.error('[membership-decision] email', err); emailed = false; }
      return res.status(200).json({ ok: true, membership_id: out, emailed });
    }
    if (!['reject', 'withdraw'].includes(action)) return res.status(400).json({ error: 'action must be approve, reject or withdraw' });
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (action === 'reject' && !reason) return res.status(400).json({ error: 'a rejection must give the reason (Statute Art. 6)' });

    const [app] = await db('GET', `membership_applications?id=eq.${encodeURIComponent(body.application_id)}&select=*`);
    if (!app) return res.status(404).json({ error: 'application not found' });
    if (!['submitted', 'paid'].includes(app.status)) return res.status(409).json({ error: `application is already ${app.status}` });

    let refunded = false;
    let manualRefund = false;
    if (app.status === 'paid') {
      if (['one_off', 'yearly'].includes(app.payment_plan)) {
        await refundStripe(app);
        refunded = true;
      } else {
        manualRefund = true;
      }
    }
    if (app.stripe_subscription_id) {
      await stripe('DELETE', `subscriptions/${encodeURIComponent(app.stripe_subscription_id)}`).catch((e) => {
        if (!/No such subscription|canceled/i.test(e.message)) throw e;
      });
    }

    await db('PATCH', `membership_applications?id=eq.${app.id}`, {
      status: action === 'reject' ? 'rejected' : 'withdrawn',
      decided_at: new Date().toISOString(),
      decided_by: user.id,
      rejection_reason: action === 'reject' ? reason : null,
      refunded_at: refunded ? new Date().toISOString() : null,
    });

    // Art. 6: the rejection and its reason are communicated in writing.
    let emailed = true;
    try {
      await sendEmail(action === 'reject' ? 'rejected' : 'withdrawn', app.email,
        { ...app, rejection_reason: reason, refunded });
    } catch (err) {
      console.error('[membership-decision] email', err);
      emailed = false;
    }

    return res.status(200).json({ ok: true, refunded, manual_refund: manualRefund, emailed });
  } catch (err) {
    console.error('[membership-decision]', err);
    return res.status(500).json({ error: err.message || 'could not record the decision' });
  }
};

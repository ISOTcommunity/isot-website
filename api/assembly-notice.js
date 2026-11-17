// POST /api/assembly-notice  { subject, text, test }
//
// The written notice of meeting for the General Assembly (Statute, art. 10: sent to each
// member individually, also by e-mail or the Association's platform). Board only.
// test: true sends it to the caller alone. Otherwise it goes to every member who can vote
// (socio with a paid, valid membership year), by e-mail and as an app notification.

const { db, userFromRequest } = require('./_lib/membership');
const { sendEmail } = require('./_lib/email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });
    const [me] = await db('GET', `profiles?id=eq.${user.id}&select=staff_role,email,full_name`);
    if (me?.staff_role !== 'board') return res.status(403).json({ error: 'board only' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const subject = String(body.subject || '').trim().slice(0, 160);
    const text = String(body.text || '').trim().slice(0, 6000);
    if (!subject || !text) return res.status(400).json({ error: 'subject and text are required' });
    if (/\[[^\]]*\]/.test(text)) return res.status(400).json({ error: 'fill in the parts in [brackets] first' });

    let people;
    if (body.test) {
      people = [{ id: user.id, email: me.email, full_name: me.full_name }];
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const paid = await db('GET', `memberships?status=eq.active&valid_until=gte.${today}&select=profile_id`);
      const ids = [...new Set(paid.map((m) => m.profile_id).filter(Boolean))];
      people = ids.length
        ? await db('GET', `profiles?id=in.(${ids.join(',')})&tier=eq.socio&select=id,email,full_name`)
        : [];
    }

    const sent = [];
    const failed = [];
    for (const person of people) {
      try {
        await sendEmail('assembly_notice', person.email, { subject, text });
        sent.push(person.full_name);
      } catch (err) {
        console.error('[assembly-notice]', person.id, err);
        failed.push(person.full_name);
      }
    }
    if (!body.test && sent.length) {
      await db('POST', 'notifications', people.map((person) => ({
        user_id: person.id, actor_id: user.id, type: 'system', title: subject,
        message: 'The notice of meeting was sent to your e-mail. Details and voting: Menu → General Assembly & Voting.',
      }))).catch((err) => console.error('[assembly-notice] notifications', err));
    }
    return res.status(200).json({ ok: true, test: !!body.test, sent, failed, sent_at: new Date().toISOString() });
  } catch (err) {
    console.error('[assembly-notice]', err);
    return res.status(500).json({ error: err.message || 'could not send the notice' });
  }
};

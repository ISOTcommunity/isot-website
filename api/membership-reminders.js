// ISOT — daily renewal reminders and lapses (Vercel Cron, see vercel.json)
//
// Schedule (Amir, 18 Oct 2026; Statute Art. 5), per active membership, day 0 = anniversary:
//   one-off members
//     day -30          renewal_open
//     day   0          sollecito      the formal written reminder: the 60 days start here
//     sollecito +30    overdue        "still a member, renew by <lapse date>"
//     sollecito +55    last_notice
//     sollecito +60    lapse → record_lapse(), tier back to participant, 'lapsed' email
//   yearly auto-renew members
//     day -7           charge_upcoming
//     a failed charge sends 'charge_failed' (api/stripe-webhook), which counts as their
//     sollecito; from there the same +30 / +55 / +60 steps apply.
//
// The later steps count from the day the sollecito was actually SENT, not from the
// anniversary: if this job was down on day 0, nobody loses days they were owed. Each
// notice is sent once (UNIQUE membership_id + kind) and logged as proof.
//
// Vercel calls this with "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
// ?dry=1 lists what would be sent without sending anything.

const { db } = require('./_lib/membership');
const { sendEmail } = require('./_lib/email');

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const days = (fromIso, to = Date.now()) => Math.floor((to - new Date(`${fromIso}T00:00:00Z`).getTime()) / DAY);

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorised' });
  }
  const dry = req.query?.dry === '1';

  const members = await db('GET',
    'memberships?status=eq.active&select=id,profile_id,member_name,valid_until,auto_renew,' +
    'profiles(email,full_name),membership_applications(email)');
  const ids = members.map((m) => m.id);
  const notices = ids.length
    ? await db('GET', `membership_notices?membership_id=in.(${ids.join(',')})&select=membership_id,kind,sent_at`)
    : [];
  const sent = {};
  for (const n of notices) (sent[n.membership_id] ||= {})[n.kind] = n.sent_at;

  const log = [];

  for (const m of members) {
    const to = m.profiles?.email || m.membership_applications?.email;
    if (!to || !m.valid_until) { log.push({ id: m.id, skipped: 'no email or date' }); continue; }
    const s = sent[m.id] || {};
    const d = days(m.valid_until);
    const reminderAt = s.sollecito || s.charge_failed;          // start of the Art. 5 term
    const lapseDate = reminderAt ? iso(new Date(reminderAt).getTime() + 60 * DAY) : iso(Date.now() + 60 * DAY);
    const data = { member_name: m.profiles?.full_name || m.member_name, valid_until: m.valid_until, lapse_date: lapseDate };

    let kind = null;
    let lapse = false;
    if (reminderAt) {
      const since = days(iso(reminderAt));
      if (since >= 60) { kind = 'lapsed'; lapse = true; }
      else if (since >= 55 && !s.last_notice) kind = 'last_notice';
      else if (since >= 30 && !s.overdue) kind = 'overdue';
    } else if (!m.auto_renew) {
      if (d >= 0) kind = 'sollecito';
      else if (d >= -30 && !s.renewal_open) kind = 'renewal_open';
    } else if (d >= -7 && d < 0 && !s.charge_upcoming) {
      kind = 'charge_upcoming';
    }
    if (!kind || (s[kind] && !lapse)) continue;

    if (dry) { log.push({ id: m.id, to, kind, day: d }); continue; }

    try {
      if (lapse) {
        await db('POST', 'rpc/record_lapse', { p_membership: m.id });
      }
      const providerId = await sendEmail(kind, to, data);
      await db('POST', 'membership_notices',
        { membership_id: m.id, profile_id: m.profile_id, kind, sent_to: to, provider_id: providerId },
        'resolution=ignore-duplicates');
      log.push({ id: m.id, kind, ok: true });
    } catch (err) {
      console.error('[membership-reminders]', m.id, kind, err);
      log.push({ id: m.id, kind, error: err.message });
    }
  }

  console.log('[membership-reminders]', JSON.stringify(log));
  return res.status(200).json({ dry, checked: members.length, actions: log });
};

// ISOT — membership emails (Resend HTTP API)
//
// RESEND_API_KEY in Vercel env. Sent from info@isotcommunity.com, the domain already
// verified for the app's auth mail (see RESEND_SETUP.md): replies reach a person.
//
// The day-0 'sollecito' is the formal written reminder of Statute Art. 5 — the 60 days
// before a membership lapses run from it. It is written in Italian and English, and every
// one sent is logged in membership_notices with Resend's message id, as proof.

const FROM = 'ISOT APS <info@isotcommunity.com>';
const SITE = 'https://isotcommunity.com';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const itDate = (iso) => iso.split('-').reverse().join('/');
const enDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#080808;padding:20px 28px;color:#fff;font-size:20px;font-weight:700">ISOT <span style="color:#D4AF50">APS</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55">
<h1 style="font-size:19px;margin:0 0 14px">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;color:#777;font-size:12px;line-height:1.5">
ISOT APS – International Students of Turin · C.F. 97916340017 · Torino<br>
Registered in RUNTS as a Social Promotion Association · <a href="${SITE}" style="color:#777">isotcommunity.com</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#D4AF50;color:#080808;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`;
const p = (s) => `<p style="margin:0 0 12px">${s}</p>`;
const small = (s) => `<p style="margin:16px 0 0;color:#666;font-size:13px">${s}</p>`;

const RENEW = `${SITE}/app/profile.html`;
const APPLY = `${SITE}/app/apply.html`;

// m: { member_name, valid_until (anniversary, YYYY-MM-DD), lapse_date (YYYY-MM-DD, renewal reminders) }
const TEMPLATES = {
  renewal_open: (m) => ({
    subject: 'Your ISOT APS membership renewal is open',
    html: layout('Time to renew your membership', [
      p(`Hi ${esc(m.member_name)},`),
      p(`Your ISOT APS membership year ends on <b>${enDate(m.valid_until)}</b>. You can renew now: the €10 annual fee keeps you a member of the General Assembly for another year, counted from your anniversary, so renewing early costs you nothing.`),
      button(RENEW, 'Renew for €10'),
      small('Prefer to pay automatically every year? You can switch to yearly payment when you renew.'),
    ].join('')),
  }),

  sollecito: (m) => ({
    subject: 'ISOT APS – Sollecito di pagamento della quota associativa / Membership fee reminder',
    html: layout('Sollecito di pagamento della quota associativa', [
      p(`Gentile ${esc(m.member_name)},`),
      p(`con la presente La informiamo che la quota associativa annuale di ISOT APS (€ 10,00) è scaduta il <b>${itDate(m.valid_until)}</b>.`),
      p(`Ai sensi dell'art. 5 dello Statuto, in caso di mancato versamento entro sessanta (60) giorni dal presente sollecito, cioè entro il <b>${itDate(m.lapse_date)}</b>, la qualifica di socio decade automaticamente. Il socio decaduto può presentare una nuova domanda di ammissione.`),
      button(RENEW, 'Rinnova / Renew – € 10'),
      '<hr style="border:none;border-top:1px solid #eee;margin:22px 0">',
      p(`Dear ${esc(m.member_name)},`),
      p(`This is the formal written reminder that your ISOT APS annual membership fee (€10) was due on <b>${enDate(m.valid_until)}</b>.`),
      p(`Under Article 5 of the Statute, if the fee is not paid within sixty (60) days of this reminder, that is by <b>${enDate(m.lapse_date)}</b>, your membership lapses automatically and you return to the ISOT Community. You can apply again at any time.`),
      small('If you have already paid, please ignore this message. Il Consiglio Direttivo / The Board of ISOT APS'),
    ].join('')),
  }),

  overdue: (m) => ({
    subject: 'Your ISOT APS membership renewal is overdue',
    html: layout('Your renewal is overdue', [
      p(`Hi ${esc(m.member_name)},`),
      p(`You're still an ISOT APS Member, but your €10 annual fee is overdue. Please renew by <b>${enDate(m.lapse_date)}</b> to keep your membership. After that date it lapses and you'd need to apply again.`),
      button(RENEW, 'Renew for €10'),
    ].join('')),
  }),

  last_notice: (m) => ({
    subject: 'Last notice: your ISOT APS membership ends in 5 days',
    html: layout('Your membership ends in 5 days', [
      p(`Hi ${esc(m.member_name)},`),
      p(`This is the last reminder: unless the €10 annual fee is paid by <b>${enDate(m.lapse_date)}</b>, your ISOT APS membership lapses (Statute Art. 5).`),
      button(RENEW, 'Renew now'),
    ].join('')),
  }),

  lapsed: (m) => ({
    subject: 'Your ISOT APS membership has lapsed',
    html: layout('Your membership has lapsed', [
      p(`Hi ${esc(m.member_name)},`),
      p('The annual fee was not paid within 60 days of the written reminder, so your ISOT APS membership has lapsed (Statute Art. 5). You are still part of the ISOT Community: the app, the events and your ISOT card all keep working.'),
      p('To become an ISOT APS Member again, send a new application. The Board will decide on it as usual.'),
      button(APPLY, 'Apply again'),
    ].join('')),
  }),

  charge_upcoming: (m) => ({
    subject: 'Your ISOT APS membership renews in 7 days',
    html: layout('Automatic renewal in 7 days', [
      p(`Hi ${esc(m.member_name)},`),
      p(`On <b>${enDate(m.valid_until)}</b> we'll charge your €10 annual ISOT APS membership fee to the card you used last time. Nothing to do if that's fine.`),
      p('To stop automatic renewal, open the payment portal from your profile before that date. The current year is not refunded.'),
      button(RENEW, 'Manage my membership'),
    ].join('')),
  }),

  charge_failed: (m) => ({
    subject: 'ISOT APS – Pagamento non riuscito / Your membership payment failed',
    html: layout('Pagamento della quota non riuscito / Payment failed', [
      p(`Gentile ${esc(m.member_name)},`),
      p(`il rinnovo automatico della quota associativa annuale (€ 10,00) non è andato a buon fine. Questo messaggio vale come sollecito ai sensi dell'art. 5 dello Statuto: in mancanza di pagamento entro il <b>${itDate(m.lapse_date)}</b> la qualifica di socio decade.`),
      '<hr style="border:none;border-top:1px solid #eee;margin:22px 0">',
      p(`Dear ${esc(m.member_name)},`),
      p(`Your automatic €10 membership renewal could not be charged. This message is the formal written reminder under Article 5 of the Statute: unless the fee is paid by <b>${enDate(m.lapse_date)}</b>, your membership lapses.`),
      button(RENEW, 'Pay / Paga – € 10'),
    ].join('')),
  }),

  // ---- application lifecycle (no membership row yet)
  application_received: (a) => ({
    subject: 'We received your ISOT APS membership application',
    html: layout('Application received', [
      p(`Hi ${esc(a.first_name)},`),
      p("Thank you: we've received your application and the €10 fee. The Board decides at its next meeting and we'll email you the result."),
      p('If the application is not accepted, the fee is refunded in full. You can also withdraw it for a full refund until the Board decides, by replying to this email.'),
      button(APPLY, 'See my application'),
    ].join('')),
  }),

  admitted: (a) => ({
    subject: "Welcome: you're an ISOT APS Member",
    html: layout('Welcome to ISOT APS', [
      p(`Hi ${esc(a.first_name)},`),
      p("The Board has admitted you as a member of ISOT APS. You are now a member of the General Assembly: you'll receive the notices of meeting and can vote on the association's decisions."),
      p(`Your membership year runs until <b>${enDate(a.valid_until)}</b>. Your card in the app now reads ★ ISOT APS MEMBER.`),
      button(`${SITE}/app/profile.html`, 'Open my card'),
    ].join('')),
  }),

  rejected: (a) => ({
    subject: 'Your ISOT APS membership application',
    html: layout('About your application', [
      p(`Hi ${esc(a.first_name)},`),
      p("The Board has decided not to accept your membership application. As set out in Article 6 of the Statute, here is the reason:"),
      `<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #D4AF50;background:#faf7ee">${esc(a.rejection_reason)}</blockquote>`,
      p(a.refunded ? 'Your €10 fee has been refunded in full to your card. It may take a few days to appear.' : 'Your €10 fee will be refunded in full within 30 days.'),
      p('You can appeal to the Members\' Assembly within 60 days of this message by replying to this email. You remain part of the ISOT Community: the app and the events stay open to you.'),
    ].join('')),
  }),

  withdrawn: (a) => ({
    subject: 'Your ISOT APS membership application was withdrawn',
    html: layout('Application withdrawn', [
      p(`Hi ${esc(a.first_name)},`),
      p(a.refunded ? 'We have withdrawn your application as you asked and refunded the €10 fee in full.' : 'We have withdrawn your application as you asked. Any fee paid will be refunded in full.'),
      p('You remain part of the ISOT Community, and you can apply again whenever you like.'),
    ].join('')),
  }),
};

async function sendEmail(kind, to, data) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const t = TEMPLATES[kind](data);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: t.subject, html: t.html, reply_to: 'info@isotcommunity.com' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json.message || 'send failed'}`);
  return json.id;
}

module.exports = { sendEmail, TEMPLATES };

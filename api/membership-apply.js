// ISOT — submit an online membership application (domanda di ammissione)
//
// POST, signed in (Authorization: Bearer <Supabase access token>), JSON body:
//   first_name, last_name, birth_date (YYYY-MM-DD), birth_place, codice_fiscale?,
//   residence_address, residence_city, phone?, guardian_name? (required under 18),
//   nationality, id_document?, id_issued_by?, id_expiry?, status_kind, institution, course,
//   study_level, student_number, grad_year, occupation, consent_media, consent_news,
//   accepts_statute, accepts_fee, accepts_board, truthful_ack, privacy_ack: true, signed_name
// → { application_id }  — the app then calls api/membership-checkout to pay.
//
// What happens:
//   1. validate; one open application per account (unique index in 073)
//   2. insert membership_applications (status 'submitted'), email from the account
//   3. build the admission PDF — same layout as the paper form — stamped with the
//      electronic signature: typed name + time + IP (firma elettronica semplice).
//      Statute Art. 6 allows applications "anche secondo le modalità previste dal
//      Regolamento interno", so the Regolamento should name this online form.
//   4. store it in the private 'admission-forms' bucket (Board-only) and keep the path
//
// Since 076 (23 Oct 2026) the online form asks everything the paper form asks. The ID
// document stays optional (data minimisation). If 076 has not been run yet, the extra
// fields are dropped and the application is saved with the original ones.

const { db, userFromRequest } = require('./_lib/membership');
const { buildAdmissionPdf } = require('./_lib/admission-pdf');

const SUPABASE_URL = 'https://ywmdaekblhabyajzusfm.supabase.co';
const PRIVACY_VERSION = '2026-10';

const clean = (s, max = 200) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '');

function ageOn(birth, today = new Date()) {
  const b = new Date(`${birth}T00:00:00Z`);
  let a = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

const itDate = (iso) => iso.split('-').reverse().join('/');

function romeStamp(d) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d) + ' (Europe/Rome)';
}

async function uploadPdf(path, bytes) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/admission-forms/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${res.status}: ${await res.text()}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const f = {
      first_name: clean(b.first_name, 80),
      last_name: clean(b.last_name, 80),
      birth_date: clean(b.birth_date, 10),
      birth_place: clean(b.birth_place, 120),
      codice_fiscale: clean(b.codice_fiscale, 16).toUpperCase() || null,
      residence_address: clean(b.residence_address, 240),
      phone: clean(b.phone, 30) || null,
      guardian_name: clean(b.guardian_name, 120) || null,
      signed_name: clean(b.signed_name, 160),
    };
    const extra = {
      nationality: clean(b.nationality, 80),
      id_document: clean(b.id_document, 80) || null,
      id_issued_by: clean(b.id_issued_by, 120) || null,
      id_expiry: /^\d{4}-\d{2}-\d{2}$/.test(clean(b.id_expiry, 10)) ? clean(b.id_expiry, 10) : null,
      residence_city: clean(b.residence_city, 80) || null,
      status_kind: ['student', 'graduate', 'researcher', 'other'].includes(b.status_kind) ? b.status_kind : null,
      institution: clean(b.institution, 160) || null,
      course: clean(b.course, 160) || null,
      study_level: ['bachelor', 'masters', 'phd', 'master', 'erasmus', 'other'].includes(b.study_level) ? b.study_level : null,
      student_number: clean(b.student_number, 30) || null,
      grad_year: /^(19|20)\d{2}$/.test(String(b.grad_year || '')) ? Number(b.grad_year) : null,
      occupation: clean(b.occupation, 160) || null,
      accepts_fee: b.accepts_fee === true,
      accepts_board: b.accepts_board === true,
      truthful_ack: b.truthful_ack === true,
      consent_media: typeof b.consent_media === 'boolean' ? b.consent_media : null,
      consent_news: typeof b.consent_news === 'boolean' ? b.consent_news : null,
    };

    const missing = ['first_name', 'last_name', 'birth_date', 'birth_place', 'residence_address', 'signed_name']
      .filter((k) => !f[k]);
    if (!extra.nationality) missing.push('nationality');
    if (!extra.status_kind) missing.push('status_kind');
    else if (extra.status_kind === 'other' ? !extra.occupation : !extra.institution) {
      missing.push(extra.status_kind === 'other' ? 'occupation' : 'institution');
    }
    if (missing.length) return res.status(400).json({ error: 'missing fields', fields: missing });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birth_date) || isNaN(Date.parse(f.birth_date))) {
      return res.status(400).json({ error: 'birth_date must be YYYY-MM-DD', fields: ['birth_date'] });
    }
    const age = ageOn(f.birth_date);
    if (age < 14 || age > 110) return res.status(400).json({ error: 'check the date of birth', fields: ['birth_date'] });
    if (age < 18 && !f.guardian_name) return res.status(400).json({ error: 'a parent or guardian must co-sign under 18', fields: ['guardian_name'] });
    if (f.codice_fiscale && !/^[A-Z0-9]{16}$/.test(f.codice_fiscale)) {
      return res.status(400).json({ error: 'codice fiscale has 16 letters and digits', fields: ['codice_fiscale'] });
    }
    if (b.accepts_statute !== true || b.privacy_ack !== true || !extra.accepts_fee || !extra.accepts_board || !extra.truthful_ack) {
      return res.status(400).json({ error: 'tick all five declarations', fields: ['accepts_statute', 'accepts_fee', 'accepts_board', 'truthful_ack', 'privacy_ack'] });
    }

    // An application already waiting: send them on to pay it rather than duplicating.
    const open = await db('GET',
      `membership_applications?profile_id=eq.${user.id}&status=in.(submitted,paid)&select=id,status`);
    if (open.length) return res.status(409).json({ error: `you already have an application (${open[0].status})`, application_id: open[0].id, status: open[0].status });

    const member = await db('GET', `memberships?profile_id=eq.${user.id}&status=eq.active&select=id`);
    if (member.length) return res.status(409).json({ error: 'you are already an ISOT APS member' });

    const now = new Date();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';

    const base = {
      profile_id: user.id,
      channel: 'online',
      ...f,
      email: user.email,
      accepts_statute: true,
      privacy_ack: true,
      privacy_version: PRIVACY_VERSION,
      signed_at: now.toISOString(),
      signed_ip: ip,
      status: 'submitted',
    };
    let app;
    try {
      [app] = await db('POST', 'membership_applications', { ...base, ...extra }, 'return=representation');
    } catch (err) {
      // 076 not run yet: the new columns don't exist. Save what the table has; the PDF
      // still shows every answer.
      if (!/column|schema cache|PGRST204/i.test(String(err.message || err))) throw err;
      [app] = await db('POST', 'membership_applications', base, 'return=representation');
      app = { ...app, ...extra };
    }

    const pdf = buildAdmissionPdf({
      ...app,
      birth_date: itDate(app.birth_date),
      id_expiry: app.id_expiry ? itDate(String(app.id_expiry)) : '',
      signed_at_display: romeStamp(now),
    });
    const path = `${now.getUTCFullYear()}/${app.id}.pdf`;
    await uploadPdf(path, pdf);
    await db('PATCH', `membership_applications?id=eq.${app.id}`, { pdf_path: path });

    return res.status(200).json({ application_id: app.id });
  } catch (err) {
    console.error('[membership-apply]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'you already have an open application' });
    return res.status(500).json({ error: 'could not save the application' });
  }
};

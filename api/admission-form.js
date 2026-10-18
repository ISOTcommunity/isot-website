// ISOT — the admission form PDF
//
// GET /api/admission-form
//   the blank form, to print for people applying in person. Same layout as the online one.
// GET /api/admission-form?application=<id>   (Authorization: Bearer <token>)
//   the applicant's own signed copy. The bucket is Board-only, so the copy is read here
//   with the service role after checking the application belongs to the caller.

const { db, userFromRequest } = require('./_lib/membership');
const { buildAdmissionPdf } = require('./_lib/admission-pdf');

const SUPABASE_URL = 'https://ywmdaekblhabyajzusfm.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const id = req.query?.application;

  if (!id) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ISOT_APS_Domanda_di_ammissione.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buildAdmissionPdf(null));
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) return res.status(401).json({ error: 'sign in first' });

    const [app] = await db('GET',
      `membership_applications?id=eq.${encodeURIComponent(id)}&profile_id=eq.${user.id}&select=pdf_path`);
    if (!app?.pdf_path) return res.status(404).json({ error: 'not found' });

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/admission-forms/${app.pdf_path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!file.ok) return res.status(404).json({ error: 'not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ISOT_APS_Domanda_di_ammissione.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    console.error('[admission-form]', err);
    return res.status(500).json({ error: 'could not load the form' });
  }
};

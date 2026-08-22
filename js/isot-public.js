/* Public site — Supabase client for the two things the marketing site writes:
 * contact enquiries and partner enquiries. No auth, no session handling.
 * The anon key is public by design; RLS allows INSERT on contact_messages only. */

const ISOT_PUBLIC = {
  SUPABASE_URL: 'https://ywmdaekblhabyajzusfm.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw',
};

const isotDb = window.supabase.createClient(ISOT_PUBLIC.SUPABASE_URL, ISOT_PUBLIC.SUPABASE_ANON_KEY);

/**
 * Send an enquiry. Returns { ok: true } or { ok: false, error }.
 * kind is 'contact' or 'partner'.
 */
async function sendEnquiry(kind, { name, email, message }) {
  const { error } = await isotDb.from('contact_messages').insert({
    kind, name, email, message,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

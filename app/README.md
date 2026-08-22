# ISOT member app

`app.isotcommunity.com` — the auth-gated half of ISOT. The public site lives in a
separate repo (`ISOTcommunity/isot-website`, serving isotcommunity.com).

Static HTML + the Supabase JS client. **No build step, no framework, no CDN at runtime** —
every dependency is vendored in `vendor/`.

## Setup

1. **Run the schema.** Supabase → SQL editor → paste `supabase/001_schema.sql` → run once.
2. **Add credentials.** Supabase → Project Settings → API. Put the project URL and the
   **anon** key into `js/isot.js`.
3. **Promote yourself.** Sign up through the app, then in the SQL editor:
   ```sql
   UPDATE profiles SET tier = 'socio', staff_role = 'board', board_position = 'Presidente'
   WHERE email = 'you@example.com';
   ```
   RLS blocks self-promotion by design — the SQL editor bypasses it.
4. **Get the poster tokens** for the printed venue QR codes:
   ```sql
   SELECT name, self_checkin_token FROM venues;
   ```

## Local development

```bash
npx serve . -p 3500
```

## Pages

| Page | Who | Status |
|---|---|---|
| `login` · `signup` | anyone | ✅ built |
| `index` | signed in | ✅ built — routes by tier and role |
| `profile` | signed in | ✅ built — QR badge, membership, editable details |
| `checkin` | signed in | ⬜ poster QR landing (Mode B) |
| `karaoke` | signed in | ⬜ live queue, add a song, already-sung check |
| `scan` | volunteer, board | ⬜ camera scanner (Mode A) |
| `karaoke-kj` | volunteer, board | ⬜ run the queue |
| `dashboard` | board | ⬜ attendance, members, payments |
| `assembly` | socio | ⬜ motions, voting, proxies |
| `partner` | partner | ⬜ own venue only |

Every authenticated page starts with `await requireAuth()` from `js/isot.js`, which
resolves with the profile or redirects and never resolves. Pass `{ staff: true }`,
`{ board: true }`, `{ socio: true }`, or `{ partner: true }` to narrow it.

## Two dimensions, one account

`tier` is legal status, `staff_role` is a job. They are independent.

- **`participant`** — free. Attends events. **Not an association member, no governance rights.**
- **`socio`** — €10/year. Member of the Assemblea Generale: votes, stands for the board, holds proxies.

CTS Art. 24 requires equal rights among *soci*, so an APS cannot have two classes of member.
The free tier is therefore **not** a membership tier. "ISOT Community" is fine as marketing
language on the public site, but never call the free tier a *member* in the database, on a
receipt, or in anything that could reach RUNTS.

`staff_role` is `volunteer`, `board`, or `partner` — orthogonal to tier. A volunteer may be
a participant or a socio.

## Security

The **anon key is public by design** and belongs in the source — RLS is what protects the data,
which is why the policies in `supabase/001_schema.sql` are not optional. The **service_role key
bypasses RLS entirely**: Edge Function environment variables only, never in this repo.

`tier`, `staff_role`, `board_position`, `partner_venue_id` and `member_code` cannot be
self-assigned — a trigger silently reverts any non-board attempt.

## Deploy

Vercel, connected to `ISOTcommunity/isot-app`, custom domain `app.isotcommunity.com`.
No build command, no output directory — it is static files.

## Spec

`../BACKEND_PLAN.md` — full schema, RLS reasoning, both check-in flows, karaoke, the
assembly flow, build order, and the verification table.

# Local audit evidence

All screenshots and measurements use synthetic accounts and stubbed Supabase responses. No production member data is included. External backend, analytics, weather and tile requests are blocked; Font Awesome assets are allowed. Grey maps and missing fixture metrics are not production defects.

`390px/` contains the successful second layout run for every HTML entry route, plus the long-name Home reproduction. `measurements.json` records that run. `probes.json` records targeted local reproductions using real page functions. There were no page JavaScript errors in the successful layout run. The first temporary fixture had a syntax error; its outputs were replaced and excluded.

Reproduction (requires an existing Node/Playwright installation and Chrome; no app package/build changes):

1. From repository root, run `python3 -m http.server 8765 --bind 127.0.0.1`.
2. Run `node docs/codex/evidence/isot-audit.cjs`, then `node docs/codex/evidence/isot-probes.cjs`.
3. Set `ISOT_PLAYWRIGHT_MODULE` to an existing Playwright module path if necessary, `ISOT_CHROME` for a different Chrome executable, and `ISOT_AUDIT_OUT` for a temporary output directory. Defaults output to the OS temp directory under `isot-audit`; original handover evidence is not overwritten.

Do not replace the stub with a real backend. These harnesses deliberately invoke vote, consent and run functions; their safety relies on the synthetic client and external request blocking. They are a reproducible review aid, not a product test suite or a full simulator of Supabase.

Additional checks: repository `app/check.sh` passed; public `/app/scan` header returned `camera=()`; default contrast was calculated with the sRGB relative-luminance formula. Service-worker offline behavior, physical devices and real database policy/function definitions remain outside this evidence.

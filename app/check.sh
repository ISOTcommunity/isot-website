#!/bin/bash
# Syntax-check every script in the app before committing.
#
# Two outages in one afternoon came from a single stray brace — once in
# js/isot.js (which took down every authenticated page, because they all call
# requireAuth from it) and once in events.html. Both would have been caught here
# in about a second.
#
#   ./check.sh
#
# Exits non-zero if anything fails, so it can gate a commit.

cd "$(dirname "$0")" || exit 1

NODE="${NODE:-$(command -v node || echo "$HOME/.nvm/versions/node/v24.18.0/bin/node")}"
[ -x "$NODE" ] || { echo "node not found — set NODE=/path/to/node"; exit 1; }

fail=0

echo "── standalone scripts ──"
for f in js/*.js sw.js; do
  [ -f "$f" ] || continue
  printf "  %-28s " "$f"
  if out=$("$NODE" --check "$f" 2>&1); then
    echo "OK"
  else
    echo "BROKEN"
    echo "$out" | head -4 | sed 's/^/      /'
    fail=1
  fi
done

echo ""
echo "── inline <script> blocks ──"
for f in *.html; do
  [ -f "$f" ] || continue
  printf "  %-28s " "$f"
  python3 - "$f" <<'PY'
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', s, re.S)
open('/tmp/isot_check.js', 'w').write('\n;\n'.join(blocks))
PY
  if out=$("$NODE" --check /tmp/isot_check.js 2>&1); then
    echo "OK"
  else
    echo "BROKEN"
    echo "$out" | head -4 | sed 's/^/      /'
    fail=1
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "✅ everything parses"
else
  echo "❌ fix the above before pushing — a syntax error in js/isot.js takes down every"
  echo "   authenticated page, since they all depend on requireAuth() from it."
fi
exit $fail

/* Turin transport strikes — shared by the Home card and the GTT page.
 *
 * Two sources, merged:
 *   1. /api/strikes — reads the official strike register of Italy's Ministry of
 *      Transport (scioperi.mit.gov.it) on the server, once an hour. That is the same
 *      register Scioperometro and the news are built from, so nobody has to type strikes
 *      in by hand.
 *   2. data/strikes.json — ISOT's own list, edited by hand. For anything the register
 *      misses or words badly, and the fallback if the register is unreachable.
 * Same day + same kind from both sources is shown once, with the hand-written wording.
 */
const GTT_GUARANTEED = 'GTT usually guarantees service 6:00–9:00 and 12:00–15:00.';

const STRIKE_KIND = {
  local:   { icon: 'fa-bus',          label: 'Buses, trams & metro' },
  general: { icon: 'fa-circle-exclamation', label: 'General strike' },
  rail:    { icon: 'fa-train',        label: 'Trains' },
  air:     { icon: 'fa-plane',        label: 'Flights' }
};
const STRIKE_SCOPE = { turin: 'Turin', region: 'Piemonte', national: 'All of Italy' };

function romeDateStr(d = new Date()) {
  // YYYY-MM-DD in Turin, whatever the phone's own timezone is
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

async function loadStrikes() {
  const get = async (url) => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  };
  const [auto, manual] = await Promise.all([get('/api/strikes'), get('data/strikes.json')]);

  const today = romeDateStr();
  const list = [];
  const seen = new Set();
  const add = (s, source) => {
    if (!s || !s.date || !STRIKE_KIND[s.kind]) return;
    const end = s.end || s.date;
    if (end < today) return;
    const key = `${s.date}|${s.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ ...s, end, source });
  };
  ((manual && manual.strikes) || []).forEach(s => add(s, 'isot'));
  ((auto && auto.strikes) || []).forEach(s => add(s, 'mit'));
  list.sort((a, b) => a.date.localeCompare(b.date));

  return {
    strikes: list,
    autoOk: !!(auto && auto.source === 'mit'),
    checkedAt: auto && auto.checked_at
  };
}

// Does it stop buses, trams and metro in Turin?
function affectsGtt(s) {
  return s.kind === 'local' || s.kind === 'general';
}

function strikeDayLabel(dateStr) {
  const today = romeDateStr();
  const tomorrow = romeDateStr(new Date(Date.now() + 864e5));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// The one line for the Home card: the next strike that touches Turin, if any is close.
// Returns { alert, html }.
function gttStatusHtml(result) {
  const today = romeDateStr();
  const soon = romeDateStr(new Date(Date.now() + 2 * 864e5));
  const next = result.strikes.find(s => s.date <= soon && s.end >= today &&
    (affectsGtt(s) || s.kind === 'rail'));
  if (!next) {
    return { alert: false, html: `<i class="fa-solid fa-bus"></i><span>GTT: no strikes announced for the next days</span>` };
  }
  const on = next.date <= today ? 'Today' : strikeDayLabel(next.date);
  const what = affectsGtt(next) ? 'GTT strike' : 'Train strike';
  return { alert: true, html: `<i class="fa-solid ${STRIKE_KIND[next.kind].icon}"></i>
    <span><strong>${on}: ${what}.</strong> ${affectsGtt(next) ? 'Guaranteed 6–9 and 12–15.' : escapeHtml(next.title || '')}</span>` };
}

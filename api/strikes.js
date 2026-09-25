// ISOT — upcoming transport strikes that matter in Turin (JSON)
//
// WHY A FUNCTION
// Strikes in Italy must be registered with the Ministry of Transport, and the register
// (scioperi.mit.gov.it) is public. It is the source Scioperometro and the news use.
// A phone cannot read it directly (no CORS), so this reads it on the server, keeps only
// what touches someone living in Turin, and lets Vercel's cache hold the answer for an
// hour. Nobody has to type strikes in by hand; app/data/strikes.json is only for
// corrections and for anything the register misses.
//
// WHAT COUNTS AS "TOUCHES TURIN"
//   local transport, trains, flights, general strikes
//   that are national, or in Piemonte / Torino
// Everything else (Milan's ATM, a Sicilian rail strike, ports, motorways) is dropped.
//
// The register's page is HTML, not an API. The table is read by its column headers
// ("Inizio", "Rilevanza", "Regione", ...); if the headers ever change, a stricter
// keyword reading takes over. If the register cannot be read at all, the answer says
// so ({ source: 'unavailable' }) and the app falls back to the hand-kept list.

const REGISTER_URL = 'https://scioperi.mit.gov.it/mit2/public/scioperi';
const WINDOW_DAYS = 45;

function decode(s) {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function rowsOf(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(body))) {
    const cells = [];
    const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    let c;
    let isHeader = false;
    while ((c = cellRe.exec(tr[0]))) {
      if (c[1].toLowerCase() === 'th') isHeader = true;
      cells.push(decode(c[2]));
    }
    if (cells.length) rows.push({ cells, isHeader });
  }
  return rows;
}

// dd/mm/yyyy → yyyy-mm-dd
function isoDates(text) {
  const out = [];
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  let m;
  while ((m = re.exec(text))) {
    out.push(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  return out;
}

function kindOf(text) {
  const t = text.toLowerCase();
  if (/aere|aeroport|\benav\b|handling|volo|easyjet|ryanair|ita airways|wizz/.test(t)) return 'air';
  if (/ferrov|\btren|\brfi\b|trenitalia|\bitalo\b|\bfs\b|mercitalia/.test(t)) return 'rail';
  if (/pubblico locale|\btpl\b|autoferrotranv|\bgtt\b|metropolitan|autobus|\btram/.test(t)) return 'local';
  if (/sciopero generale|generale|tutti i settori|tutte le categorie|pubblic[io] e privat/.test(t)) return 'general';
  return null;
}

function scopeOf(text) {
  const t = text.toLowerCase();
  if (/\btorino\b/.test(t)) return 'turin';
  if (/\bpiemonte\b/.test(t)) return 'region';
  if (/\bnazionale\b/.test(t)) return 'national';
  return null;
}

// A national local-transport strike stops GTT too. `strict` is for rows read without
// column headers, where "nazionale" may only be part of a union's name: there a local
// strike must name Torino or Piemonte itself.
function relevant(kind, scope, strict = false) {
  if (!kind || !scope) return false;
  if (strict && kind === 'local') return scope === 'turin' || scope === 'region';
  return true;
}

function col(headers, ...names) {
  return headers.findIndex(h => names.some(n => h.includes(n)));
}

function parseRegister(html, today) {
  const rows = rowsOf(html);
  const headerRow = rows.find(r => r.isHeader && r.cells.some(c => /inizio/i.test(c)));
  const last = new Date(Date.parse(today) + WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  const out = [];

  if (headerRow) {
    const h = headerRow.cells.map(c => c.toLowerCase());
    const iStart = col(h, 'inizio');
    const iEnd = col(h, 'fine');
    const iRel = col(h, 'rilevanza');
    const iReg = col(h, 'regione');
    const iProv = col(h, 'provincia');
    const iSector = col(h, 'settore');
    const iCat = col(h, 'categoria');
    const iMode = col(h, 'modalit');
    const iState = col(h, 'stato');
    for (const r of rows) {
      if (r.isHeader || r.cells.length < h.length - 1) continue;
      const cell = i => (i >= 0 && r.cells[i]) || '';
      if (/revocat|sospes|differit/i.test(cell(iState))) continue;
      const start = isoDates(cell(iStart))[0];
      if (!start) continue;
      const end = isoDates(cell(iEnd))[0] || start;
      const where = `${cell(iRel)} ${cell(iReg)} ${cell(iProv)}`;
      // Rilevanza says national/regional/local; the region and province say where
      let scope = scopeOf(`${cell(iProv)} ${cell(iReg)}`);
      if (!scope && /nazionale/i.test(cell(iRel))) scope = 'national';
      const kind = kindOf(`${cell(iSector)} ${cell(iCat)}`);
      if (!relevant(kind, scope) || end < today || start > last) continue;
      out.push({
        date: start, end, kind, scope,
        title: tidy(cell(iCat) || cell(iSector)).slice(0, 140),
        note: tidy(cell(iMode)).slice(0, 140),
        where: where.trim().slice(0, 80)
      });
    }
    return out;
  }

  // No recognisable header: read each row as text, conservatively.
  for (const r of rows) {
    const text = r.cells.join(' | ');
    if (/revocat|sospes|differit/i.test(text)) continue;
    const dates = isoDates(text).filter(d => d >= today).sort();
    if (!dates.length) continue;
    const kind = kindOf(text);
    const scope = scopeOf(text);
    if (!relevant(kind, scope, true)) continue;
    if (dates[dates.length - 1] < today || dates[0] > last) continue;
    out.push({ date: dates[0], end: dates[dates.length - 1], kind, scope, title: '', note: '' });
  }
  return out;
}

// The register is in Italian; the app is in English. Only the fixed phrases are
// translated, never the names of companies or unions.
function tidy(text) {
  return text
    .replace(/intera giornata/gi, 'all day')
    .replace(/(\d+)\s*ore\b/gi, '$1 hours')
    .replace(/dalle (?:ore )?(\d{1,2}(?:[.:]\d{2})?) alle (?:ore )?(\d{1,2}(?:[.:]\d{2})?)/gi, 'from $1 to $2')
    .replace(/fasce garantite/gi, 'guaranteed hours')
    .replace(/^personale (?:navigante )?(.+)$/i, '$1 staff')
    .trim();
}

function romeToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const today = romeToday();
  try {
    const r = await fetch(REGISTER_URL, {
      headers: { 'User-Agent': 'ISOT Community app (isotcommunity.com)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('register ' + r.status);
    const strikes = parseRegister(await r.text(), today);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(JSON.stringify({ source: 'mit', checked_at: new Date().toISOString(), strikes }));
  } catch (err) {
    // Short cache: try the register again in five minutes, not in an hour
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).send(JSON.stringify({ source: 'unavailable', error: String(err.message || err), strikes: [] }));
  }
}

module.exports = handler;
module.exports.parseRegister = parseRegister;

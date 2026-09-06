// ISOT — public calendar feed (iCalendar / .ics)
//
// WHY A FUNCTION AND NOT A FILE
// The site is static, and a static .ics would be stale the moment the board edits an
// event. This reads the same calendar_between() the app and the public page read, so a
// subscriber's calendar tracks the database rather than the last deploy.
//
// Anon key only, and calendar_between is granted to anon — this exposes exactly what
// isotcommunity.com/events already shows. No member data passes through here.

const SUPABASE_URL = 'https://ywmdaekblhabyajzusfm.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWRhZWtibGhhYnlhanp1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDM2NDYsImV4cCI6MjEwMjcxOTY0Nn0.PyMpTzffZ12j1HoheuRQMYH8d0WvfYkLXGfd1wJXTWw';

// RFC 5545 wants CRLF, and lines folded at 75 octets. Calendar clients are strict about
// both — Outlook in particular rejects a feed with long unfolded lines.
function fold(line) {
  const out = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); }
  out.push(s);
  return out.join('\r\n');
}

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

module.exports = async function handler(req, res) {
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  const to = new Date();
  to.setMonth(to.getMonth() + 6);
  const iso = (d) => d.toISOString().slice(0, 10);

  let events = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calendar_between`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_from: iso(from), p_to: iso(to) }),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    events = await r.json();
  } catch (err) {
    // A calendar client polling this must not be handed a broken file. 503 makes it
    // retry and keep the copy it already has.
    res.status(503).setHeader('Content-Type', 'text/plain');
    return res.send('Calendar temporarily unavailable');
  }

  const now = stamp(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ISOT Community//Turin//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ISOT Community — Turin',
    'X-WR-CALDESC:Events for international students in Turin. isotcommunity.com',
    'X-WR-TIMEZONE:Europe/Rome',
    // Times are emitted with TZID rather than converted to UTC, so a client renders
    // them correctly across the October DST change without this file doing offset maths.
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const e of events) {
    const date = String(e.event_date).replace(/-/g, '');
    const start = String(e.start_time || '00:00:00').slice(0, 8).replace(/:/g, '');

    // Duration is not in the feed's payload, so a night runs to 02:00 the next day —
    // long enough to read as an evening, short enough not to blank out a whole day in
    // someone else's calendar.
    const endDate = new Date(`${e.event_date}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

    const where = [e.venue_name, e.venue_address, 'Torino'].filter(Boolean).join(', ');
    const desc = [e.headline, e.notes || e.description,
                  e.register_url ? `Tickets / sign-up: ${e.register_url}` : null,
                  'More at https://isotcommunity.com/events']
      .filter(Boolean).join('\n\n');

    lines.push(
      'BEGIN:VEVENT',
      // Stable per occurrence, so an edit updates the existing entry in a subscriber's
      // calendar instead of adding a duplicate.
      `UID:${e.event_id}-${e.event_date}@isotcommunity.com`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Europe/Rome:${date}T${start}`,
      `DTEND;TZID=Europe/Rome:${endStr}T020000`,
      fold(`SUMMARY:${esc(e.title)}`),
      fold(`LOCATION:${esc(where)}`),
      fold(`DESCRIPTION:${esc(desc)}`),
      'URL:https://isotcommunity.com/events',
      `CATEGORIES:${esc((e.category || 'social').toUpperCase())}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="isot-turin.ics"');
  // Ten minutes. Calendar clients poll on their own schedule anyway, and this keeps an
  // edit in the admin panel reaching subscribers the same day rather than the next.
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(lines.join('\r\n'));
};

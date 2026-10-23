// ISOT — the online admission form as a PDF (domanda di ammissione a socio)
//
// buildAdmissionPdf(data) draws the signed copy of an online application in the same
// design as the paper form (assets/docs/ISOT_Membership_Application.pdf): Night Blue
// header with the logo, the colour bar, four numbered sections, English first with the
// Italian alongside, the Board box at the bottom. The electronic signature (typed name,
// time, IP) sits where the handwritten one would go.
//
// WHY HAND-WRITTEN PDF
// No build step and no dependencies on this site (see api/_lib/membership.js). Fonts are
// the standard Helvetica family, WinAnsi encoded: accented Latin names (é, ñ, ç, ü…) print
// correctly; other scripts become '?', so the form asks for names in Latin letters.
// Images are JPEGs embedded as-is (api/_lib/admission-images.js).

const IMG = require('./admission-images');

const W = 595.28; // A4 in points
const H = 841.89;
const M = 40;     // side margin

// ISOT Colour System v2.2
const C = {
  night: [12, 26, 74], blue: [61, 123, 255], violet: [127, 74, 255], magenta: [224, 60, 245],
  coral: [255, 90, 60], amber: [255, 184, 31], green: [31, 212, 127], milk: [231, 220, 201],
  white: [255, 255, 255], gray: [90, 100, 136], line: [138, 147, 179],
  cream: [245, 241, 234], lavender: [243, 238, 255], soft: [238, 241, 250],
};
const rgb = (c) => c.map((v) => (v / 255).toFixed(3)).join(' ');

// WinAnsi (cp1252) covers Latin-1 plus a few extras; everything else becomes '?'.
const CP1252_EXTRA = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '·': 0xb7 };
function toWinAnsi(str) {
  const out = [];
  for (const ch of String(str ?? '')) {
    const c = ch.codePointAt(0);
    if (CP1252_EXTRA[ch]) out.push(CP1252_EXTRA[ch]);
    else if (c >= 0x20 && c <= 0x7e) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else out.push(0x3f);
  }
  const bytes = [];
  for (const b of out) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c);
    bytes.push(b);
  }
  return Buffer.from(bytes).toString('latin1');
}

// Rough Helvetica widths: enough to place text after a label and to wrap paragraphs.
function tw(str, size, bold) {
  let em = 0;
  for (const ch of String(str)) {
    if (ch === ' ') em += 0.278;
    else if (/[il.,;:'|!]/.test(ch)) em += 0.25;
    else if (/[A-Z]/.test(ch)) em += bold ? 0.72 : 0.67;
    else if (/[mwMW]/.test(ch)) em += 0.83;
    else if (/[0-9]/.test(ch)) em += 0.556;
    else em += bold ? 0.58 : 0.52;
  }
  return em * size;
}

function wrap(text, size, width, bold) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = (line + ' ' + word).trim();
    if (tw(next, size, bold) > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const FONT = { r: 'F1', b: 'F2', i: 'F3' };

function canvas() {
  const ops = [];
  // all coordinates below are from the TOP of the page
  const Y = (t) => (H - t).toFixed(2);
  return {
    ops,
    text(x, t, size, str, style = 'r', color = C.night) {
      ops.push(`${rgb(color)} rg BT /${FONT[style]} ${size} Tf ${x.toFixed(2)} ${Y(t)} Td (${toWinAnsi(str)}) Tj ET`);
      return x + tw(str, size, style === 'b');
    },
    box(x, t, w, h, fill, stroke, dash) {
      if (fill) ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${Y(t + h)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
      if (stroke) ops.push(`${dash ? '[3 2] 0 d ' : ''}${rgb(stroke)} RG 1 w ${x.toFixed(2)} ${Y(t + h)} ${w.toFixed(2)} ${h.toFixed(2)} re S [] 0 d`);
    },
    line(x1, t, x2, color = C.line, width = 0.7) {
      ops.push(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${Y(t)} m ${x2.toFixed(2)} ${Y(t)} l S`);
    },
    circle(cx, ct, r, color) {
      const k = 0.5523 * r, cy = H - ct;
      ops.push(`${rgb(color)} rg ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ` +
        `${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ` +
        `${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c f`);
    },
    // checkbox; ticked = filled violet with a white tick
    check(x, t, on) {
      if (on) {
        ops.push(`${rgb(C.violet)} rg ${x} ${Y(t + 8)} 8 8 re f`);
        ops.push(`1 1 1 RG 1.3 w ${x + 1.8} ${Y(t + 4.2)} m ${x + 3.4} ${Y(t + 6)} l ${x + 6.4} ${Y(t + 2)} l S`);
      } else {
        ops.push(`${rgb(C.night)} RG 0.9 w ${x} ${Y(t + 8)} 8 8 re S`);
      }
    },
    image(name, x, t, w, h) { ops.push(`q ${w} 0 0 ${h} ${x} ${Y(t + h)} cm /${name} Do Q`); },
  };
}

// data: an application row, plus birth_date / id_expiry as dd/mm/yyyy and signed_at_display
function buildAdmissionPdf(data = {}) {
  const p = canvas();
  const v = (k) => (data && data[k] != null && data[k] !== '' ? String(data[k]) : '');
  const R = W - M;

  // ── header ────────────────────────────────────────────────────────────────────
  p.box(0, 0, W, 100, C.night);
  p.image('Im1', M - 6, 22, 62, 62);
  p.text(116, 38, 22, 'Membership', 'b', C.white);
  p.text(116, 62, 22, 'application', 'b', C.magenta);
  p.text(116, 76, 9, 'Domanda di ammissione a socio/a · ISOT APS', 'i', C.milk);
  p.text(116, 87, 6.4, 'ISOT APS – International Students of Turin · APS registered in RUNTS, DD n. 1572/A2202C, 06/10/2026', 'r', [184, 192, 221]);
  p.text(116, 95, 6.4, 'Via Napione 33/A, 10124 Torino · C.F. 97916340017 · info@isotcommunity.com', 'r', [184, 192, 221]);
  p.image('Im2', R - 62, 18, 62, 62);
  const bar = [C.blue, C.violet, C.magenta, C.coral, C.amber, C.green];
  bar.forEach((c, i) => p.box((W / 6) * i, 100, W / 6 + 0.5, 5, c));

  let t = 122;
  let x = p.text(M, t, 8, 'To the Board of ISOT APS', 'b');
  x = p.text(x + 3, t, 8, '/ Al Consiglio Direttivo di ISOT APS', 'i', C.gray);
  p.text(x + 6, t, 8, `· Online application ${v('id').slice(0, 8)}`, 'r', C.gray);

  const section = (n, en, it, color) => {
    t += 20;
    p.circle(M + 8, t - 3, 8, color);
    p.text(M + 5.3, t, 9, String(n), 'b', C.white);
    const x1 = p.text(M + 22, t, 10, en, 'b');
    const x2 = p.text(x1 + 6, t, 8, it, 'i', C.gray);
    p.line(x2 + 6, t - 3, R, color, 1);
    t += 8;
  };

  // a labelled value on an underline: bold English, Italian in grey, value in large type
  const field = (x0, x1, en, it, value) => {
    let x = p.text(x0, t + 7, 7.5, en, 'b');
    if (it) x = p.text(x + 3, t + 7, 7.5, it, 'i', C.gray);
    if (value) p.text(x0, t + 19, 10, value, 'r');
    p.line(x0, t + 22, x1);
  };
  const row = (cols) => {          // cols: [[weight, en, it, value], …]
    const total = cols.reduce((s, c) => s + c[0], 0);
    const gap = 12;
    const span = R - M - gap * (cols.length - 1);
    let x0 = M;
    for (const [wgt, en, it, value] of cols) {
      const w = (span * wgt) / total;
      field(x0, x0 + w, en, it, value);
      x0 += w + gap;
    }
    t += 28;
  };

  // ── 1 personal details ────────────────────────────────────────────────────────
  section(1, 'PERSONAL DETAILS', 'Dati anagrafici', C.blue);
  row([[1, 'First name', 'Nome', v('first_name')], [1, 'Last name', 'Cognome', v('last_name')]]);
  row([[1.2, 'Born in', 'Nato/a a', v('birth_place')], [0.6, 'on', 'il', v('birth_date')], [0.9, 'Nationality', 'Cittadinanza', v('nationality')]]);
  row([[1, 'Codice fiscale', '(if assigned)', v('codice_fiscale')], [1, 'ID (type, no.)', 'Documento', v('id_document')]]);
  row([[1.4, 'Issued by', 'Rilasciato da', v('id_issued_by')], [0.6, 'Expiry', 'Scadenza', v('id_expiry')]]);
  row([[0.8, 'Living in', 'Residente a', v('residence_city')], [1.6, 'Address, postcode', 'Indirizzo, CAP', v('residence_address')]]);
  row([[1, 'Phone', 'Telefono', v('phone')], [1.4, 'E-mail', '', v('email')]]);
  if (v('guardian_name')) row([[1, 'Parent or guardian (under 18)', 'Genitore o tutore', v('guardian_name')]]);

  // ── 2 status ──────────────────────────────────────────────────────────────────
  section(2, 'STATUS', 'Posizione accademica / professionale', C.green);
  t += 2;
  [['student', 'Student', 'Studente/ssa'], ['graduate', 'Graduate', 'Laureato/a'],
    ['researcher', 'Researcher, lecturer', 'Ricercatore/docente'], ['other', 'Working or other', 'Lavoratore/trice o altro']]
    .forEach(([k, en, it], i) => {
      const cx = M + (i % 2) * ((R - M) / 2), ct = t + Math.floor(i / 2) * 13;
      p.check(cx, ct, v('status_kind') === k);
      const xe = p.text(cx + 12, ct + 7, 8, en, 'b');
      p.text(xe + 3, ct + 7, 7.5, it, 'i', C.gray);
    });
  t += 13;
  t += 14;
  const kind = v('status_kind');
  const levels = { bachelor: 'Bachelor / Triennale', masters: "Master's / Magistrale", phd: 'PhD / Dottorato', master: 'Master', erasmus: 'Erasmus / exchange', other: 'Other / Altro' };
  if (kind === 'other') {
    row([[1, 'Occupation', 'Occupazione', v('occupation')]]);
  } else {
    row([[1.1, kind === 'researcher' ? 'At' : 'University / institution', kind === 'researcher' ? 'Presso' : 'Ateneo / istituto', v('institution')],
      [1, 'Degree course', 'Corso', v('course')]]);
    if (kind === 'graduate') row([[1, 'Level', 'Livello', levels[v('study_level')] || ''], [0.6, 'Year of graduation', 'Anno', v('grad_year')]]);
    else if (kind === 'student') row([[1, 'Level', 'Livello', levels[v('study_level')] || ''], [0.7, 'Student no.', 'Matricola', v('student_number')]]);
  }

  // ── 3 declarations ────────────────────────────────────────────────────────────
  section(3, 'REQUEST AND DECLARATIONS', 'Richiesta e dichiarazioni', C.violet);
  const decl = [
    ['accepts_statute', 'I have read and accept the Statute and internal Regulations and share their aims;', "di aver letto e di accettare lo Statuto e il Regolamento interno e di condividerne le finalità;"],
    ['accepts_fee', 'I will pay the yearly membership fee (now €10), non-transferable and non-refundable after admission;', "di versare la quota associativa annuale (oggi € 10,00), non trasmissibile e non rimborsabile dopo l'ammissione;"],
    ['accepts_board', 'I know the Board decides on admission (Statute, art. 6) and the fee is refunded if I am not admitted;', "che l'ammissione è decisa dal Consiglio Direttivo (Statuto, art. 6) e che, se non ammesso/a, la quota sarà restituita;"],
    ['truthful_ack', 'the information given is true and I will report any change;', 'che i dati forniti sono veritieri e di comunicare ogni variazione;'],
    ['privacy_ack', "I have read the privacy notice (isotcommunity.com/privacy, EU Reg. 2016/679) and consent to the use of my data for membership and the members' register.", "di aver letto l'informativa privacy e di acconsentire al trattamento dei dati per il rapporto associativo e il libro soci."],
  ];
  const inner = R - M - 34;
  const lines = decl.map(([, en, it]) => [wrap(en, 8, inner), wrap(it, 7.5, inner, false)]);
  const boxH = 24 + lines.reduce((s, [a, b]) => s + (a.length + b.length) * 9.5 + 4, 0);
  p.box(M, t, R - M, boxH, C.cream);
  let x2 = p.text(M + 10, t + 13, 8, 'I apply', 'b');
  x2 = p.text(x2 + 2, t + 13, 8, 'to become a member of ISOT APS and', 'r');
  x2 = p.text(x2 + 2, t + 13, 8, 'declare:', 'b');
  p.text(x2 + 4, t + 13, 7.5, 'Chiedo di essere ammesso/a come socio/a e dichiaro:', 'i', C.gray);
  let tt = t + 22;
  decl.forEach(([k], i) => {
    p.check(M + 10, tt, data[k] === true);
    const [en, it] = lines[i];
    for (const l of en) { p.text(M + 24, tt + 7, 8, l, 'r'); tt += 9.5; }
    for (const l of it) { p.text(M + 24, tt + 7, 7.5, l, 'i', C.gray); tt += 9.5; }
    tt += 4;
  });
  t += boxH;

  // ── 4 optional consents ───────────────────────────────────────────────────────
  section(4, 'OPTIONAL CONSENTS', 'Consensi facoltativi', C.coral);
  t += 2;
  for (const [k, en, it] of [['consent_media', 'Photos and videos of activities on ISOT channels', 'Foto e video sui canali ISOT'],
    ['consent_news', 'Event news by email, WhatsApp', 'Comunicazioni su eventi']]) {
    let xx = p.text(M, t + 7, 8, en, 'b');
    xx = p.text(xx + 3, t + 7, 7.5, it, 'i', C.gray);
    const yes = data[k] === true, no = data[k] === false;
    p.check(R - 90, t, yes); p.text(R - 78, t + 7, 8, 'Yes / Sì', 'b');
    p.check(R - 30, t, no); p.text(R - 18, t + 7, 8, 'No', 'b');
    t += 15;
  }

  // ── signature ─────────────────────────────────────────────────────────────────
  t += 8;
  p.box(M, t, R - M, 40, C.soft);
  p.box(M, t, 4, 40, C.blue);
  let xs = p.text(M + 12, t + 12, 8, 'Signed electronically', 'b');
  p.text(xs + 4, t + 12, 7.5, 'Firmato elettronicamente (firma elettronica semplice)', 'i', C.gray);
  p.text(M + 12, t + 25, 10.5, `${v('signed_name')}  ·  ${v('signed_at_display')}`, 'b');
  p.text(M + 12, t + 35, 7, `IP ${v('signed_ip')}  ·  online application ${v('id')}`, 'r', C.gray);
  t += 52;

  // ── Board box ─────────────────────────────────────────────────────────────────
  p.box(M, t, R - M, 74, C.lavender, C.violet, true);
  let xb = p.text(M + 10, t + 13, 8.5, 'FOR THE BOARD ONLY', 'b', C.violet);
  p.text(xb + 4, t + 13, 7.5, '· Riservato al Consiglio Direttivo', 'i', C.gray);
  const bl = (y, parts) => { let xx = M + 10; for (const [s, st, gap] of parts) { xx = p.text(xx, y, 8, s, st, st === 'i' ? C.gray : C.night) + 3; if (gap) { p.line(xx, y + 2, xx + gap); xx += gap + 10; } } };
  bl(t + 30, [['Fee €', 'b', 60], ['on', 'b'], ['il', 'i', 80], ['Method', 'b'], ['Stripe · cash · bank transfer', 'r', 0], ['Receipt no.', 'b', 60]]);
  bl(t + 47, [['Board decision of', 'b'], ['Delibera CD del', 'i', 90], ['Admitted', 'b', 0], ['·  Not admitted', 'b'], ['(reason within 30 days)', 'i']]);
  bl(t + 64, [['Register no.', 'b'], ['N. libro soci', 'i', 80], ["President's signature", 'b'], ['Firma del Presidente', 'i', 130]]);

  // ── footer ────────────────────────────────────────────────────────────────────
  p.box(0, H - 22, W, 22, C.night);
  const xf = p.text(M, H - 8, 7, 'ISOT', 'b', C.amber);
  p.text(xf + 3, H - 8, 7, '· Live globally, connect locally.', 'r', [205, 211, 234]);
  p.text(R - 250, H - 8, 7, 'Online application, signed electronically · isotcommunity.com', 'r', [205, 211, 234]);

  return assemble(p.ops.join('\n'));
}

function assemble(content) {
  const img = (i) => `<< /Type /XObject /Subtype /Image /Width ${i.w} /Height ${i.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${i.data.length} >>\nstream\n${i.data.toString('latin1')}\nendstream`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 9 0 R >> /XObject << /Im1 10 0 R /Im2 11 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Title (${toWinAnsi('ISOT APS – Membership application')}) /Producer (isotcommunity.com) >>`,
    '<< >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    img(IMG.logo),
    img(IMG.character),
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { buildAdmissionPdf };

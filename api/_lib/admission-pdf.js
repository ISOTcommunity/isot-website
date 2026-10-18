// ISOT — the admission form as a PDF (domanda di ammissione a socio)
//
// ONE FORM, TWO WAYS IN
// buildAdmissionPdf(null) is the blank form printed for people applying in person.
// buildAdmissionPdf(data) is the same page filled from the online form, with the
// electronic signature (typed name, time, IP) where the handwritten one would go.
// Same layout either way, so the Board reviews one kind of document.
//
// WHY HAND-WRITTEN PDF
// No build step and no dependencies on this site (see api/_lib/membership.js). One A4
// page of text and lines is a few hundred bytes of PDF operators; a library is not
// worth installing for it. Fonts are the standard Helvetica pair, WinAnsi encoded:
// accented Latin names (é, ñ, ç, ü…) print correctly; other scripts are replaced
// with '?', so the form asks for the name as written on the passport in Latin letters.

const W = 595.28; // A4 in points
const H = 841.89;
const M = 48;     // margin

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
  // PDF string escapes
  const bytes = [];
  for (const b of out) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c);
    bytes.push(b);
  }
  return Buffer.from(bytes).toString('latin1');
}

// Helvetica average width is ~0.5em; good enough to wrap a paragraph inside the margins.
function wrap(text, size, width) {
  const max = Math.floor(width / (size * 0.5));
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

function page() {
  const ops = [];
  let y = H - M;
  const api = {
    text(x, yy, size, str, bold = false, gray = 0) {
      ops.push(`${gray} g BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${toWinAnsi(str)}) Tj ET`);
    },
    line(x1, y1, x2, y2, width = 0.6) {
      ops.push(`0.55 G ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    },
    rect(x, yy, w, h) {
      ops.push(`0.55 G 0.6 w ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    },
    fill(x, yy, w, h, gray) {
      ops.push(`${gray} g ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    },
    para(str, size = 9, bold = false, gray = 0, indent = 0) {
      for (const l of wrap(str, size, W - 2 * M - indent)) { api.text(M + indent, y, size, l, bold, gray); y -= size * 1.35; }
    },
    gap(n) { y -= n; },
    get y() { return y; },
    set y(v) { y = v; },
    ops,
  };
  return api;
}

const ORG = 'ISOT APS – International Students of Turin';
const ORG_LINE = 'C.F. 97916340017 · Torino · Iscritta al RUNTS, sezione APS (DD n.1572/A2202C del 06/10/2026)';

// data: null for the blank form, or an application row (+ signed_* fields)
function buildAdmissionPdf(data) {
  const p = page();
  const v = (k) => (data && data[k] ? String(data[k]) : '');

  // header band
  p.fill(0, H - 86, W, 86, 0.03);
  p.text(M, H - 44, 18, 'ISOT APS', true, 1);
  p.text(M + 92, H - 44, 10, 'International Students of Turin', false, 0.85);
  p.text(M, H - 64, 8, ORG_LINE, false, 0.75);
  p.y = H - 118;

  p.text(M, p.y, 14, 'Domanda di ammissione a socio', true); p.gap(16);
  p.text(M, p.y, 10, 'Membership application', false, 0.35); p.gap(18);
  p.para('Al Consiglio Direttivo di ISOT APS  /  To the Board of ISOT APS', 9, true); p.gap(6);

  // fields: two columns where they fit
  const field = (x, w, label, value) => {
    p.text(x, p.y, 7.5, label, false, 0.4);
    if (value) p.text(x + 2, p.y - 14, 11, value);
    p.line(x, p.y - 18, x + w, p.y - 18);
  };
  const colW = (W - 2 * M - 20) / 2;
  const row2 = (l1, k1, l2, k2) => { field(M, colW, l1, v(k1)); field(M + colW + 20, colW, l2, v(k2)); p.gap(34); };
  const row1 = (l, k) => { field(M, W - 2 * M, l, v(k)); p.gap(34); };

  row2('Nome / First name', 'first_name', 'Cognome / Last name', 'last_name');
  row2('Data di nascita / Date of birth', 'birth_date', 'Luogo di nascita / Place of birth', 'birth_place');
  row2('Codice fiscale (se disponibile / if available)', 'codice_fiscale', 'Telefono / Phone', 'phone');
  row1('Indirizzo di residenza / Residential address', 'residence_address');
  row1('Email', 'email');

  p.gap(2);
  p.para('Il/La sottoscritto/a chiede di essere ammesso/a come socio/a di ISOT APS. Dichiara di aver letto e di accettare lo Statuto e il Regolamento dell\'Associazione e di attenersi alle deliberazioni dei suoi organi (Statuto, art. 6), e versa contestualmente la quota associativa annuale di € 10,00.', 9);
  p.gap(2);
  p.para('I apply to become a member of ISOT APS. I declare that I have read and accept the Statute and the Regulations of the Association and will abide by the decisions of its bodies (Statute, art. 6), and I pay the annual membership fee of € 10.00 with this application.', 8.5, false, 0.35);
  p.gap(8);

  const box = (checked, it, en) => {
    p.rect(M, p.y - 2, 9, 9);
    if (checked) p.text(M + 1.6, p.y - 0.6, 9, 'X', true);
    p.text(M + 16, p.y, 9, it);
    p.text(M + 16, p.y - 11, 8, en, false, 0.35);
    p.gap(26);
  };
  box(data?.accepts_statute, 'Accetto lo Statuto e il Regolamento di ISOT APS.', 'I accept the Statute and the Regulations of ISOT APS.');
  box(data?.privacy_ack, 'Ho letto l\'informativa privacy (GDPR art. 13): isotcommunity.com/privacy', 'I have read the privacy notice (GDPR art. 13): isotcommunity.com/privacy');

  p.para('L\'ammissione è deliberata dal Consiglio Direttivo alla prima riunione utile. In caso di rigetto la decisione è motivata e comunicata per iscritto entro 30 giorni e la quota è restituita integralmente.', 8.5);
  p.para('Admission is decided by the Board at its next meeting. If the application is rejected, the reasons are given in writing within 30 days and the fee is refunded in full.', 8, false, 0.35);
  p.gap(10);

  // minors
  p.text(M, p.y, 7.5, 'Se minorenne, genitore o tutore / If under 18, parent or guardian (nome e firma / name and signature)', false, 0.4);
  if (v('guardian_name')) p.text(M + 2, p.y - 14, 11, v('guardian_name'));
  p.line(M, p.y - 18, W - M, p.y - 18);
  p.gap(36);

  // signature
  if (data && data.signed_at) {
    p.fill(M, p.y - 30, W - 2 * M, 42, 0.95);
    p.text(M + 8, p.y - 2, 8, 'Firmato elettronicamente / Signed electronically', true);
    p.text(M + 8, p.y - 15, 10, `${v('signed_name')}  ·  ${v('signed_at_display')}`);
    p.text(M + 8, p.y - 26, 7.5, `IP ${v('signed_ip')}  ·  domanda online / online application ${v('id')}`, false, 0.4);
    p.gap(52);
  } else {
    field(M, colW, 'Luogo e data / Place and date', '');
    field(M + colW + 20, colW, 'Firma / Signature', '');
    p.gap(40);
  }

  // Board box
  const top = p.y;
  p.rect(M, top - 74, W - 2 * M, 84);
  p.y = top - 4;
  p.text(M + 8, p.y, 8, 'RISERVATO AL CONSIGLIO DIRETTIVO  /  FOR THE BOARD', true, 0.3); p.gap(18);
  p.text(M + 8, p.y, 8.5, 'Quota ricevuta il / Fee received on ____________   mezzo / method:  Stripe  ·  contanti  ·  bonifico', false, 0.2); p.gap(18);
  p.text(M + 8, p.y, 8.5, 'Delibera del Consiglio del / Board decision of ____________      ammesso/a   ·   non ammesso/a', false, 0.2); p.gap(18);
  p.text(M + 8, p.y, 8.5, 'N. libro soci / Register no. ________      Firma del Presidente / President\'s signature ______________________', false, 0.2);

  p.text(M, 26, 7, `${ORG}  ·  isotcommunity.com  ·  Modulo di ammissione v2026-10`, false, 0.5);

  return assemble(p.ops.join('\n'));
}

function assemble(content) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Title (${toWinAnsi('ISOT APS – Domanda di ammissione')}) /Producer (isotcommunity.com) >>`,
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

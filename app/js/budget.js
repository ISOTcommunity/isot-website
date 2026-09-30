// Budget Builder. Everything stays in this browser (localStorage); nothing is sent to ISOT.

const INCOME = [
  { id: 'family', per: 'month' },
  { id: 'job', per: 'month' },
  { id: 'freelance', per: 'month' },
  { id: 'cashIn', per: 'month' },
  { id: 'otherIn', per: 'month' },
];
// group: which rule bucket a line counts towards
const COSTS = [
  { id: 'rent', per: 'month', group: 'housing' },
  { id: 'bills', per: 'month', group: 'housing' },
  { id: 'food', per: 'month', group: 'essential' },
  { id: 'transport', per: 'year', group: 'essential' },
  { id: 'phone', per: 'month', group: 'essential' },
  { id: 'health', per: 'year', group: 'essential' },
  { id: 'permesso', per: 'year', group: 'essential' },
  { id: 'fees', per: 'year', group: 'essential' },
  { id: 'study', per: 'month', group: 'essential' },
  { id: 'flights', per: 'year', group: 'other' },
  { id: 'fun', per: 'month', group: 'fun' },
  { id: 'cash', per: 'month', group: 'cash' },
  { id: 'save', per: 'month', group: 'save' },
];
const GROUP_COLOR = { housing: '#3D7BFF', essential: '#1FD47F', other: '#FF5A3C', fun: '#FFB81F', cash: '#E03CF5', save: '#B191FF' };
const KEY = 'isot-budget-v1';
const LANG_KEY = 'isot-budget-lang';

const $ = id => document.getElementById(id);
let LANG = 'en';
try { LANG = localStorage.getItem(LANG_KEY) || ((navigator.language || '').startsWith('it') ? 'it' : 'en'); } catch (_) {}
const t = (key, vars) => budgetT(LANG, key, vars);
const eur = n => (n < 0 ? '−' : '') + '€' + Math.round(Math.abs(n)).toLocaleString(LANG === 'it' ? 'it-IT' : 'en-GB');
const pct = (a, b) => b > 0 ? a / b * 100 : 0;
const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

let goals = [];   // [{ name, target, saved, by: 'YYYY-MM' }]

// ── Static text ────────────────────────────────────────────────────────────
function applyStaticText() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
}

function rowHtml(item) {
  const [label, hint] = (BUDGET_T[LANG].rows[item.id] || BUDGET_T.en.rows[item.id]);
  return `
    <div class="row">
      <label for="v_${item.id}">${label}<small>${hint}</small></label>
      <div class="money"><span>€</span><input type="number" inputmode="decimal" min="0" id="v_${item.id}" placeholder="0"></div>
      <select id="p_${item.id}" aria-label="${label}">
        <option value="month"${item.per === 'month' ? ' selected' : ''}>${t('opt_month')}</option>
        <option value="year"${item.per === 'year' ? ' selected' : ''}>${t('opt_year')}</option>
      </select>
    </div>`;
}

function buildRows() {
  $('incomeRows').innerHTML = INCOME.map(rowHtml).join('');
  $('costRows').innerHTML = COSTS.map(rowHtml).join('');
}

// ── Goals ──────────────────────────────────────────────────────────────────
function monthsUntil(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) return null;
  const [y, m] = ym.split('-').map(Number);
  const now = new Date();
  return (y * 12 + m) - (now.getFullYear() * 12 + now.getMonth() + 1);
}

function buildGoals() {
  $('goals').innerHTML = goals.map((g, i) => `
    <div class="goal" data-i="${i}">
      <div class="goal-head">
        <input type="text" class="goal-name" data-f="name" maxlength="40" value="${esc(g.name || '')}" placeholder="${esc(t('goal_name_ph'))}" aria-label="${esc(t('goal_name'))}">
        <button type="button" class="goal-x" data-remove="${i}" aria-label="${esc(t('goal_remove'))}"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="goal-grid">
        <label>${t('goal_target')}<div class="money"><span>€</span><input type="number" inputmode="decimal" min="0" data-f="target" value="${esc(g.target ?? '')}" placeholder="0"></div></label>
        <label>${t('goal_saved')}<div class="money"><span>€</span><input type="number" inputmode="decimal" min="0" data-f="saved" value="${esc(g.saved ?? '')}" placeholder="0"></div></label>
        <label>${t('goal_by')}<input type="month" class="goal-date" data-f="by" value="${esc(g.by || '')}"></label>
      </div>
      <div class="bar"><div class="fill" data-out="bar" style="background:var(--pink)"></div></div>
      <div class="rule-note" data-out="line"></div>
    </div>`).join('');
}

function readGoalsFromDom() {
  goals = [...document.querySelectorAll('.goal')].map(el => {
    const g = {};
    el.querySelectorAll('[data-f]').forEach(inp => { g[inp.dataset.f] = inp.value; });
    return g;
  });
}

// ── State ──────────────────────────────────────────────────────────────────
function monthly(id) {
  const v = parseFloat($('v_' + id).value) || 0;
  return $('p_' + id).value === 'year' ? v / 12 : v;
}

function readState() {
  const st = { v: {}, p: {} };
  [...INCOME, ...COSTS].forEach(i => { st.v[i.id] = $('v_' + i.id).value; st.p[i.id] = $('p_' + i.id).value; });
  ['edisuYear', 'edisuMonths', 'efSaved', 'taxPct'].forEach(id => { st[id] = $(id).value; });
  ['hasEdisu', 'edisuDorm', 'edisuMeals'].forEach(id => { st[id] = $(id).checked; });
  st.housingType = $('housingType').value;
  st.goals = goals;
  return st;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(readState())); } catch (_) {} }
function loadState() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  return st;
}
function applyState(st) {
  if (!st) return;
  [...INCOME, ...COSTS].forEach(i => {
    if (st.v && st.v[i.id] != null) $('v_' + i.id).value = st.v[i.id];
    if (st.p && st.p[i.id]) $('p_' + i.id).value = st.p[i.id];
  });
  ['edisuYear', 'edisuMonths', 'efSaved', 'taxPct'].forEach(id => { if (st[id] != null) $(id).value = st[id]; });
  ['hasEdisu', 'edisuDorm', 'edisuMeals'].forEach(id => { $(id).checked = !!st[id]; });
  if (st.housingType) $('housingType').value = st.housingType;
  goals = Array.isArray(st.goals) ? st.goals.slice(0, 8) : [];
}

// ── Rules ──────────────────────────────────────────────────────────────────
function ruleHtml({ name, value, valueText, bandFrom, bandTo, max, status, note }) {
  const scale = v => Math.max(0, Math.min(100, v / max * 100));
  const col = status === 'ok' ? 'var(--green)' : status === 'warn' ? 'var(--gold)' : 'var(--red)';
  return `
    <div class="rule">
      <div class="rule-top"><span class="rule-name">${name}</span><span class="rule-val ${status}">${valueText}</span></div>
      <div class="bar">
        <div class="band" style="left:${scale(bandFrom)}%;width:${scale(bandTo) - scale(bandFrom)}%"></div>
        <div class="fill" style="width:${scale(value)}%;background:${col};opacity:.85"></div>
      </div>
      <div class="rule-note">${note}</div>
    </div>`;
}

function render() {
  const hasEdisu = $('hasEdisu').checked;
  $('edisuBox').hidden = !hasEdisu;
  const edisuMonths = Math.min(12, Math.max(1, parseInt($('edisuMonths').value, 10) || 12));
  const edisuMonthly = hasEdisu ? (parseFloat($('edisuYear').value) || 0) / edisuMonths : 0;

  // Freelance: the tax & INPS reserve comes off the top; the rest is what you can plan with
  const freelance = monthly('freelance');
  $('taxBox').hidden = freelance <= 0;
  const taxPct = Math.min(80, Math.max(0, parseFloat($('taxPct').value) || 0));
  const taxReserve = freelance * taxPct / 100;

  const income = INCOME.reduce((s, i) => s + monthly(i.id), 0) + edisuMonthly - taxReserve;
  const byGroup = { housing: 0, essential: 0, other: 0, fun: 0, cash: 0, save: 0 };
  COSTS.forEach(c => { byGroup[c.group] += monthly(c.id); });
  const spending = byGroup.housing + byGroup.essential + byGroup.other + byGroup.fun + byGroup.cash;
  const out = spending + byGroup.save;
  const left = income - out;
  const essentials = byGroup.housing + byGroup.essential;

  $('sIn').textContent = eur(income);
  $('sOut').textContent = eur(out);
  $('sLeft').textContent = eur(left);
  $('sLeft').className = 'v ' + (left < 0 ? 'bad' : left < income * 0.03 ? 'warn' : 'ok');

  const taxLine = $('taxLine');
  taxLine.hidden = freelance <= 0;
  taxLine.innerHTML = taxPct > 0 ? `<i class="fa-solid fa-landmark"></i> ${t('tax_line', { x: eur(taxReserve) })}`
    : `<span class="warn"><i class="fa-solid fa-triangle-exclamation"></i> ${t('tax_missing')}</span>`;

  const base = Math.max(income, out) || 1;
  const shown = Object.entries(byGroup).filter(([, v]) => v > 0);
  $('stack').innerHTML = shown.map(([g, v]) => `<div style="width:${v / base * 100}%;background:${GROUP_COLOR[g]}" title="${t('g_' + g)}"></div>`).join('');
  $('legend').innerHTML = shown.map(([g, v]) => `<span><i style="background:${GROUP_COLOR[g]}"></i>${t('g_' + g)} ${eur(v)}</span>`).join('');

  // rules
  const rules = [];
  if (income > 0) {
    const h = pct(byGroup.housing, income);
    rules.push(ruleHtml({
      name: t('r_housing'), value: h, valueText: `${Math.round(h)}% · ${eur(byGroup.housing)}`, bandFrom: 0, bandTo: 35, max: 70,
      status: h <= 35 ? 'ok' : h <= 45 ? 'warn' : 'bad',
      note: h <= 35 ? t('r_housing_ok', { x: eur(income * 0.35) }) : t('r_housing_bad', { a: eur(income * 0.30), b: eur(income * 0.35) }),
    }));
    const e = pct(essentials, income);
    rules.push(ruleHtml({
      name: t('r_ess'), value: e, valueText: `${Math.round(e)}% · ${eur(essentials)}`, bandFrom: 0, bandTo: 50, max: 100,
      status: e <= 55 ? 'ok' : e <= 70 ? 'warn' : 'bad',
      note: e <= 55 ? t('r_ess_ok') : t('r_ess_bad'),
    }));
    const f = pct(byGroup.fun, income);
    rules.push(ruleHtml({
      name: t('r_fun'), value: f, valueText: `${Math.round(f)}% · ${eur(byGroup.fun)}`, bandFrom: 5, bandTo: 10, max: 25,
      status: f >= 5 && f <= 10 ? 'ok' : f <= 15 ? 'warn' : 'bad',
      note: f < 5 ? t('r_fun_low', { x: eur(income * 0.10) }) : f <= 10 ? t('r_fun_ok') : t('r_fun_high', { x: eur(income * 0.10) }),
    }));
    const s = pct(byGroup.save, income);
    const step = s < 5 ? 5 : s < 10 ? 10 : 20;
    rules.push(ruleHtml({
      name: t('r_save'), value: s, valueText: `${Math.round(s)}% · ${eur(byGroup.save)}`, bandFrom: 10, bandTo: 20, max: 30,
      status: s >= 10 ? 'ok' : s >= 5 ? 'warn' : 'bad',
      note: s >= 20 ? t('r_save_top') : t('r_save_next', { p: step, x: eur(income * step / 100) }),
    }));
  }
  $('rules').innerHTML = rules.length ? rules.join('') : `<p class="rule-note">${t('rules_empty')}</p>`;

  // goals
  readGoalsFromDom();
  let goalsMonthly = 0;
  document.querySelectorAll('.goal').forEach((el, i) => {
    const g = goals[i];
    const target = parseFloat(g.target) || 0, have = parseFloat(g.saved) || 0;
    const need = Math.max(0, target - have);
    const months = monthsUntil(g.by);
    let line = '';
    if (target > 0 && need === 0) line = `<span class="ok">${t('goal_done')}</span>`;
    else if (target > 0 && months !== null && months < 1) line = `<span class="warn">${t('goal_past')}</span>`;
    else if (target > 0 && months !== null) {
      const per = need / months;
      goalsMonthly += per;
      line = t('goal_line', { m: `<strong>${eur(per)}</strong>`, n: months });
    }
    el.querySelector('[data-out="line"]').innerHTML = line;
    el.querySelector('[data-out="bar"]').style.width = target > 0 ? Math.min(100, have / target * 100) + '%' : '0%';
  });
  $('goalsSummary').innerHTML = goalsMonthly <= 0 ? ''
    : byGroup.save >= goalsMonthly ? `<span class="ok">${t('goals_sum_ok', { g: eur(goalsMonthly), s: eur(byGroup.save) })}</span>`
    : `<span class="warn">${t('goals_sum_gap', { g: eur(goalsMonthly), s: eur(byGroup.save), d: eur(goalsMonthly - byGroup.save) })}</span>`;

  // emergency fund: 3–6 months of essentials, plus a flight home
  const flightBuffer = monthly('flights') * 12 / 2;
  const efLow = essentials * 3 + flightBuffer, efHigh = essentials * 6 + flightBuffer;
  const saved = parseFloat($('efSaved').value) || 0;
  $('efRange').textContent = essentials > 0 ? `${eur(efLow)} – ${eur(efHigh)}` : '€0';
  $('efFill').style.width = efLow > 0 ? Math.min(100, saved / efLow * 100) + '%' : '0%';
  $('efNote').textContent = essentials <= 0 ? t('ef_fill')
    : saved >= efHigh ? t('ef_full')
    : saved >= efLow ? t('ef_min', { x: eur(efHigh - saved) })
    : byGroup.save > 0 ? t('ef_togo_rate', { x: eur(efLow - saved), s: eur(byGroup.save), n: Math.ceil((efLow - saved) / byGroup.save) })
    : t('ef_togo', { x: eur(efLow - saved) });

  // freedom number
  $('freedom').textContent = eur(spending * 300);
  $('freedomNote').textContent = spending > 0
    ? t('free_note', { a: eur(Math.max(0, spending - 100)), b: eur(spending), c: eur(100 * 300) })
    : t('free_fill');

  // tips
  const tips = [];
  if (freelance > 0) tips.push(t('t_freelance'));
  if (hasEdisu) tips.push(t('t_edisu', { x: eur(edisuMonthly) }));
  if (hasEdisu && $('edisuDorm').checked) tips.push(t('t_dorm'));
  if ($('edisuMeals').checked || $('housingType').value === 'edisu') tips.push(t('t_meals'));
  if (monthly('transport') === 0) tips.push(t('t_gtt'));
  if (monthly('permesso') === 0) tips.push(t('t_permesso'));
  if (monthly('health') === 0) tips.push(t('t_health'));
  if (monthly('cash') > 0 || monthly('cashIn') > 0) tips.push(t('t_cash'));
  if (income > 0 && left > income * 0.05) tips.push(t('t_unassigned', { x: eur(left) }));
  if (income > 0 && left < 0) tips.push(t('t_over', { x: eur(-left) }));
  if (byGroup.fun > 0) tips.push(t('t_card'));
  $('tips').innerHTML = tips.length ? tips.map(x => `<div class="tip"><i class="fa-solid fa-lightbulb"></i><div>${x}</div></div>`).join('')
    : `<p class="rule-note">${t('t_fine')}</p>`;

  save();
}

// ── Fill with AI: prompt out, JSON back ─────────────────────────────────────
const AI_FIELDS = {
  family: 'Money from family',
  job: 'Salary from an employer (after tax)',
  freelance: 'Payments from clients for freelance work (Partita IVA), before tax',
  cashIn: 'Cash deposits that are income (tips, cash jobs)',
  otherIn: 'Any other income: grants, uni refunds, anything else',
  rent: 'Rent or dorm fee',
  bills: 'Electricity, gas, wifi, condo fees',
  food: 'Supermarkets (Esselunga, Carrefour, Lidl, Pam, Coop, Conad...), bakeries, canteen/mensa',
  transport: 'GTT, metro, trains (Trenitalia, Italo), bike or scooter sharing, taxis. Spread a yearly pass over 12 months',
  phone: 'Phone and internet plans (Iliad, Ho., WindTre, TIM, Vodafone...)',
  health: 'Pharmacy, doctors, health insurance, SSN registration (spread yearly costs over 12 months)',
  permesso: 'Permesso di soggiorno, post office kit, marca da bollo, Questura fees (spread over 12 months)',
  fees: 'University tuition fees (spread over 12 months)',
  study: 'Books, printing, stationery, laptop and study software',
  flights: 'Flights and long trips home (Ryanair, Wizz, ITA, easyJet...), spread over 12 months',
  fun: 'Bars, restaurants, delivery (Glovo, Deliveroo, Just Eat), nights out, cinema, shopping, subscriptions (Spotify, Netflix)',
  cash: 'ATM cash withdrawals',
  save: 'Money moved into savings or investments (Revolut vaults, savings accounts, trading apps)',
};
const AI_KEYS = [...Object.keys(AI_FIELDS), 'edisu_year'];

function aiPrompt() {
  return `You are helping an international student in Turin, Italy, build a monthly budget.

I have attached my bank statement(s). Read every transaction and work out my AVERAGE PER MONTH in euros for each category below, over the whole period the statements cover.

Rules:
- Ignore top-ups, transfers between my own accounts, currency exchanges and card refunds: they are not income or spending.
- If money arrives from a person or account that looks like family, count it as "family".
- If something is paid once a year (GTT yearly pass, permesso, insurance, tuition), divide it by 12.
- If an amount is in another currency, convert it to euros at a normal rate.
- If you are not sure where something goes, put it in the closest category and mention it in "notes".
- If I receive the EDISU scholarship, put the full YEARLY amount in "edisu_year" (not in "otherIn").
- Round to whole euros. Use 0 for anything that does not appear.
- Write "notes" in ${LANG === 'it' ? 'Italian' : 'English'}.

Categories:
${Object.entries(AI_FIELDS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
- edisu_year: EDISU scholarship, full amount per year

Reply with ONLY this JSON inside one code block, no other text:
\`\`\`json
{
  "months_covered": 0,
  ${AI_KEYS.map(k => `"${k}": 0`).join(',\n  ')},
  "notes": "short notes on anything unclear"
}
\`\`\``;
}

let aiParsed = null;

function parseAiAnswer(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(t('ai_none'));
  let obj;
  try { obj = JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); }
  catch (_) { throw new Error(t('ai_format')); }
  const out = {};
  for (const k of AI_KEYS) {
    const v = Number(String(obj[k] ?? 0).replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(v) || v < 0 || v > 200000) throw new Error(t('ai_badnum', { k, v: obj[k] }));
    out[k] = Math.round(v);
  }
  out.months = Number(obj.months_covered) || null;
  out.notes = typeof obj.notes === 'string' ? obj.notes.slice(0, 500) : '';
  return out;
}

function labelFor(k) {
  if (k === 'edisu_year') return t('edisu_amt');
  return (BUDGET_T[LANG].rows[k] || BUDGET_T.en.rows[k] || [k])[0];
}

function showAiPreview(d) {
  const rows = AI_KEYS.filter(k => d[k] > 0)
    .map(k => `<tr><td>${esc(labelFor(k))}</td><td>${eur(d[k])} ${k === 'edisu_year' ? t('per_yr') : t('per_mo')}</td></tr>`).join('');
  $('aiPreview').innerHTML = `
    <div style="font-size:0.84rem;font-weight:700;margin-bottom:4px">${t('ai_found')}${d.months ? ' ' + t('ai_months', { n: d.months }) : ''}:</div>
    <table>${rows || `<tr><td>${t('ai_nothing')}</td><td></td></tr>`}</table>
    ${d.notes ? `<p class="rule-note" style="margin-top:8px"><strong>${t('ai_notes')}</strong> ${esc(d.notes)}</p>` : ''}
    <p class="rule-note" style="margin-top:8px">${t('ai_check')}</p>
    <button type="button" class="btn btn-pink" id="aiApply" style="width:100%;justify-content:center;margin-top:10px"><i class="fa-solid fa-check"></i> ${t('ai_apply')}</button>`;
  $('aiPreview').hidden = false;
  $('aiApply').addEventListener('click', applyAi);
}

function applyAi() {
  if (!aiParsed) return;
  for (const k of Object.keys(AI_FIELDS)) {
    $('v_' + k).value = aiParsed[k] || '';
    $('p_' + k).value = 'month';
  }
  if (aiParsed.edisu_year > 0) {
    $('hasEdisu').checked = true;
    $('edisuYear').value = aiParsed.edisu_year;
    if (!$('edisuMonths').value) $('edisuMonths').value = 12;
  }
  render();
  $('aiPreview').hidden = true;
  $('aiPaste').value = '';
  $('aiMsg').innerHTML = `<span class="ok"><i class="fa-solid fa-circle-check"></i> ${t('ai_done')}</span>`;
  $('monthCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copyPrompt() {
  const text = aiPrompt();
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  $('aiMsg').innerHTML = `<span class="ok"><i class="fa-solid fa-circle-check"></i> ${t('ai_copied')}</span>`;
}

// ── Language switch: rebuild the dynamic parts, keep every number ──────────
function setLang(lang) {
  readGoalsFromDom();
  const st = readState();
  LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  applyStaticText();
  buildRows();
  applyState(st);
  buildGoals();
  $('aiMsg').textContent = '';
  $('aiPreview').hidden = true;
  render();
}

async function initBudget() {
  const me = await requireAuth();
  $('headerAvatar').innerHTML = renderUserAvatarHtml(me, 36);
  if (typeof markSeen === 'function') markSeen('budget');

  applyStaticText();
  buildRows();
  applyState(loadState());
  buildGoals();

  const main = document.querySelector('main');
  main.addEventListener('input', render);
  main.addEventListener('change', render);
  $('housingType').addEventListener('change', () => {
    if ($('housingType').value === 'edisu') { $('hasEdisu').checked = true; $('edisuDorm').checked = true; }
    render();
  });
  $('addGoal').addEventListener('click', () => {
    readGoalsFromDom();
    if (goals.length >= 8) return;
    goals.push({ name: '', target: '', saved: '', by: '' });
    buildGoals();
    render();
    const last = document.querySelector('.goal:last-child .goal-name');
    if (last) last.focus();
  });
  $('goals').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    readGoalsFromDom();
    goals.splice(Number(b.dataset.remove), 1);
    buildGoals();
    render();
  });
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $('aiCopy').addEventListener('click', copyPrompt);
  $('aiRead').addEventListener('click', () => {
    $('aiPreview').hidden = true;
    try {
      aiParsed = parseAiAnswer($('aiPaste').value);
      $('aiMsg').textContent = '';
      showAiPreview(aiParsed);
    } catch (e) {
      aiParsed = null;
      $('aiMsg').innerHTML = `<span class="bad"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(e.message)}</span>`;
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm(t('reset_confirm'))) return;
    try { localStorage.removeItem(KEY); } catch (_) {}
    location.reload();
  });
  render();
  const gate = $('gate'); if (gate) gate.remove();
}

document.addEventListener('DOMContentLoaded', initBudget);

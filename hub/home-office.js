// hub/home-office.js: Home office → 🏫 Field trips (tracker + 🧾 invoices), 🏢 Studio buyouts (requests + 🧾 invoices),
// 🕘 Activity log and 🎁 Donations & giveaways. Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.
// (Nov 11 2026) Field trips and Buyouts follow “Parties & events”, Donations “World site & deals” on access.html (perm_can).
const _hoArea = {};
async function hoAreaLoad(area) {
  const [v, e] = await Promise.all([sb.rpc('perm_can', { p_area: area, p_level: 'view' }), sb.rpc('perm_can', { p_area: area, p_level: 'edit' })]);
  _hoArea[area] = { view: v.data === true, edit: e.data === true };
}
function hoA(area, level) { const a = _hoArea[area]; return !!(a && a[level]); }

// ---------- Home office → 🏫 Field trips (world_field_trips.sql + field_trip_tracker.sql): a spreadsheet / project tracker ----------
// World's Field Trips form adds a row (and emails events@4cats.com); + Add a request adds rows for ones by email or phone.
// Every column is edited right in the table and saves straight away. Follow-ups due today or earlier are highlighted.
let _ft = { status: 'open', rows: null, err: '', q: '', studio: '', sort: 'created_at', desc: true, add: null, saving: {}, from: '', to: '' };
// (Nov 11 2026) the columns in your own order: drag a heading left or right (kept on this computer). New default: trip date, then studio.
const FT_DEFAULT_ORDER = ['booked_date', 'studio_id'];
function ftCols() {
  let order = null; try { order = JSON.parse(localStorage.getItem('ft_col_order') || 'null'); } catch (e) { }
  const byKey = {}; FT_COLS.forEach(c => { byKey[c[0]] = c; });
  const keys = (Array.isArray(order) ? order : FT_DEFAULT_ORDER).filter(k => byKey[k]);
  FT_COLS.forEach(c => { if (!keys.includes(c[0])) keys.push(c[0]); });
  return keys.map(k => byKey[k]);
}
let _ftDrag = null;
function ftColDrop(target) {
  if (!_ftDrag || _ftDrag === target) return;
  const keys = ftCols().map(c => c[0]), from = keys.indexOf(_ftDrag); keys.splice(from, 1); keys.splice(keys.indexOf(target), 0, _ftDrag);
  try { localStorage.setItem('ft_col_order', JSON.stringify(keys)); } catch (e) { }
  _ftDrag = null; ftDraw();
}
function ftColReset() { try { localStorage.removeItem('ft_col_order'); } catch (e) { } ftDraw(); }
// "Wed, Nov 4th, 2026"
function ftNiceDate(d) {
  if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'), n = x.getDate();
  const th = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return x.toLocaleDateString('en-CA', { weekday: 'short' }) + ', ' + x.toLocaleDateString('en-CA', { month: 'short' }) + ' ' + n + th + ', ' + x.getFullYear();
}
const FT_STATUS = [['new', 'New'], ['contacted', 'Contacted'], ['invoiced', 'Invoiced'], ['booked', 'Booked'], ['declined', 'Declined']];
const FT_SOURCE = [['form', '🌐 Form'], ['email', '✉️ Email'], ['phone', '📞 Phone'], ['other', 'Other']];
// [field, heading, input type, width]
const FT_COLS = [['status', 'Status', 'status', 112], ['follow_up', 'Follow up', 'date', 128], ['school', 'School', 'text', 170], ['contact_name', 'Contact', 'text', 140],
  ['email', 'Email', 'email', 190], ['phone', 'Phone', 'tel', 120], ['studio_id', 'Studio', 'studio', 150], ['preferred_date', 'Date wanted', 'text', 120],
  ['ages', 'Ages / grade', 'text', 100], ['students', 'Students', 'num', 72], ['adults', 'Adults', 'num', 64], ['project', 'Project', 'text', 150],
  ['booked_date', 'Trip date', 'date', 150], ['booked_time', 'Time', 'time', 104], ['quote', 'Quote $', 'money', 86], ['invoice_sent', 'Invoice sent', 'date', 128],
  ['invoice_due', 'Invoice due', 'date', 128], ['paid_on', 'Paid', 'date', 128], ['assigned_to', 'Who’s on it', 'text', 110], ['staff_note', 'Staff note', 'text', 220],
  ['notes', 'Their questions', 'notes', 200], ['source', 'From', 'source', 98], ['created_at', 'Received', 'ro', 96]];

// =====================================================================================================================
// 🧾 Field trip invoices (field_trip_invoices.sql): from a tracker row, hold the time and email the invoice (World's invoice page:
// project, children, terms, $100 deposit before tax or pay in full, Stripe). After the trip: the balance invoice, or paid at the studio.
// =====================================================================================================================
const FTI_ST = { sent: '⏳ Invoice sent', deposit_paid: '✓ Deposit paid', paid: '✓ Paid', balance_sent: '🧾 Balance sent', closed: '✓ Paid (studio)', cancelled: 'Cancelled', released: 'Released (unpaid)' };
const ftiDl = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
function ftInvOf(reqId) { return (_ft.inv || []).filter(i => i.request_id === reqId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null; }
function ftInvCell(r) {
  if (_ft.inv === null) return _ft.invErr && /hub_ft_invoices/.test(_ft.invErr) ? '<span class="fd-sm">Run field_trip_invoices.sql</span>' : '';
  const i = ftInvOf(r.id), ed = hoA('parties_events', 'edit'), b = (a, l) => `<option value="${a}">${l}</option>`;
  if (!i || ['cancelled', 'released'].includes(i.status)) return (i ? `<span class="cust-st">${esc(FTI_ST[i.status])}</span> ` : '') + (ed ? `<button class="ho-btn sm" onclick="ftInvNew('${escAttr(r.id)}')">🧾 Invoice</button>` : '');
  const what = i.status === 'sent' ? `deposit due ${ftiDl(i.pay_by)}` : i.status === 'balance_sent' ? `$${Number(i.balance || 0).toFixed(2)} due ${ftiDl(i.balance_due)}` : i.status === 'deposit_paid' ? `trip ${ftiDl(i.day)}` : '';
  const stLabel = i.pay_on_day && i.status === 'deposit_paid' ? '🤝 Paying on the day' : null;   // (Nov 13 2026)
  return `<span class="cust-st cust-${i.status === 'sent' || i.status === 'balance_sent' ? 'held' : 'booked'}" title="${escAttr(`${i.school || ''} · ${i.day} ${String(i.at).slice(0, 5)} · ${i.students} children · ${i.project || 'project to choose'}${i.agreed_at ? ' · terms agreed by ' + i.agreed_name : ''} · paid so far $${Number(i.paid_total || 0).toFixed(2)} before tax`)}">${esc(stLabel || FTI_ST[i.status] || i.status)}</span> <span class="fd-sm">${esc(what)}</span>
    ${ed && ['sent', 'deposit_paid', 'balance_sent'].includes(i.status) ? `<select class="fti-act" onchange="if (this.value) { const a = this.value; this.value = ''; ftInvAct('${escAttr(i.id)}', a); }"><option value="">Actions…</option>${
      i.status === 'sent' ? b('send', i.sent_at ? 'Resend invoice' : 'Send invoice') + b('extend', 'Extend the deposit date') + b('pay_on_day', '🤝 Paying in full on the day (no deposit)') + b('cancel', 'Cancel')
      : i.status === 'deposit_paid' ? b('balance', 'Send the balance invoice') + b('paid_studio', 'Paid at the studio') + b('cancel', 'Cancel')
      : b('send', 'Resend the balance invoice') + b('paid_studio', 'Paid at the studio')}</select>` : ''}`;
}
let _ftProjects = null;
async function ftInvNew(reqId) {
  const r = (_ft.rows || []).find(x => x.id === reqId) || {};
  if (_ftProjects === null) { try { const d = await fetch(`${SUPABASE_URL}/functions/v1/public-studio-data?view=fieldtrips&studio=${encodeURIComponent(_sessionStudioId || 'BC-YYJ-OB')}`, { headers: { Authorization: 'Bearer ' + SUPABASE_ANON_KEY, apikey: SUPABASE_ANON_KEY } }).then(x => x.json()); _ftProjects = ((d && d.pricing && d.pricing.projects) || []); } catch (e) { _ftProjects = []; } }
  const pb = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return localDateStr(d); })();
  const st = Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b]));
  openDutySheet(`<h3>🧾 Field trip invoice</h3><p class="ho-intro">Holds the time (workshops in it close) and emails ${esc(r.email || 'the contact')} the invoice: they confirm the project and children, agree to the terms, and pay the deposit or the full estimate. Unpaid by the deposit date, it\u2019s released.</p>
    <div class="me-form">
      <label>School / group<input id="fi-school" value="${escAttr(r.school || '')}"></label>
      <label>Contact<input id="fi-contact" value="${escAttr(r.contact_name || '')}"></label>
      <label>Email<input id="fi-email" type="email" value="${escAttr(r.email || '')}"></label>
      <label>Phone<input id="fi-phone" value="${escAttr(r.phone || '')}"></label>
      <label>Studio<select id="fi-studio">${st.map(x => `<option value="${x}"${x === r.studio_id ? ' selected' : ''}>${esc(STUDIO_NAMES[x])}</option>`).join('')}</select></label>
      <label>Date<input id="fi-day" type="date" value="${escAttr(r.booked_date || '')}"></label>
      <label>Start time<input id="fi-at" type="time" step="900" value="${escAttr(String(r.booked_time || '').slice(0, 5))}"></label>
      <label>Children<input id="fi-students" type="number" min="1" value="${escAttr(r.students || 10)}"></label>
      <label>Adults<input id="fi-adults" type="number" min="0" value="${escAttr(r.adults || 0)}"></label>
      <label>Project<select id="fi-project"><option value="">Let them choose</option>${(_ftProjects || []).map(p => `<option value="${escAttr(p.label)}"${String(r.project || '').toLowerCase().includes(String(p.label).toLowerCase()) ? ' selected' : ''}>${esc(p.label)} ($${Number(p.price).toFixed(2)} each)</option>`).join('')}</select></label>
      <label>Deposit (before tax)<input id="fi-deposit" type="number" min="0" step="0.01" value="100"></label>
      <label>Deposit due by<input id="fi-pay" type="date" value="${escAttr(pb)}"></label>
      <label>Note (optional, on the invoice)<input id="fi-note" maxlength="300"></label>
    </div><div id="fi-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="fi-go" onclick="ftInvCreate('${escAttr(reqId)}')">Hold the time and email the invoice</button></div>`);
}
async function ftInvCreate(reqId) {
  const v = id => ((document.getElementById(id) || {}).value || '').trim(), msg = document.getElementById('fi-msg'), btn = document.getElementById('fi-go');
  const p = { request_id: reqId, school: v('fi-school'), contact_name: v('fi-contact'), email: v('fi-email'), phone: v('fi-phone'), studio_id: v('fi-studio'), day: v('fi-day'), at: v('fi-at'),
    students: v('fi-students'), adults: v('fi-adults'), project: v('fi-project'), deposit: v('fi-deposit'), pay_by: v('fi-pay'), note: v('fi-note') };
  if (!p.day || !p.at) { msg.innerHTML = '<div class="me-msg err">Choose the date and start time.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  const { data, error } = await sb.rpc('hub_ft_invoice_create', { p });
  if (error) { btn.disabled = false; btn.textContent = 'Try again'; msg.innerHTML = `<div class="me-msg err">${esc(/hub_ft_invoice_create/.test(error.message) ? 'Run field_trip_invoices.sql in Supabase first.' : error.message)}</div>`; return; }
  const r = await ftInvEmail(data.id);
  closeDutySheet(); alert(r.ok ? 'Held, and the invoice was emailed to ' + p.email + '.' : 'Held, but the invoice email didn\u2019t send: ' + r.error + ' (use Send).'); ftLoad();
}
async function ftInvEmail(id) {
  const ses = await sb.auth.getSession(), tk = ses && ses.data && ses.data.session && ses.data.session.access_token;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/custom-party-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (tk || SUPABASE_ANON_KEY) }, body: JSON.stringify({ ft_id: id }) }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  return r && r.ok ? { ok: true, link: d.link } : { ok: false, error: d.error || 'please try again' };
}
async function ftInvAct(id, action) {
  const i = (_ft.inv || []).concat((_cust && _cust.ft) || []).find(x => x.id === id) || {};
  if (action === 'send') { const r = await ftInvEmail(id); if (r.ok && r.link) { try { await navigator.clipboard.writeText(r.link); } catch (e) {} } alert(r.ok ? 'Emailed (and the link copied).' : 'The email didn\u2019t send: ' + r.error); ftAfter(); return; }
  let date = null, n = null;
  if (action === 'extend') { date = prompt('New deposit due date (YYYY-MM-DD):', String(i.pay_by || '')); if (!date) return; }
  if (action === 'balance') { n = prompt(`How many children came? (at least ${10} are charged)`, String(i.students || '')); if (!n) return; n = parseInt(n, 10); if (!(n > 0)) { alert('Enter a number.'); return; } }
  if (action === 'paid_studio' && !confirm('Mark this field trip as paid in full at the studio?')) return;
  if (action === 'pay_on_day' && !confirm(`${i.school || 'This school'} pays in full on the day, with no deposit?\n\nThis books the field trip now (the party form opens for the trip details) and it won't be released at the deposit date. On the day, use “Paid at the studio” or “Send the balance invoice”.`)) return;   // (Nov 13 2026)
  if (action === 'cancel' && !confirm(i.status === 'sent' ? 'Cancel this invoice? The time is released and its workshops reopen.' : 'Cancel this field trip? (The deposit is non-refundable under the terms.)')) return;
  const { data, error } = await sb.rpc('hub_ft_invoice_action', { p_id: id, p_action: action, p_date: date, p_students: n });
  if (error) { alert(error.message); return; }
  if (action === 'pay_on_day') alert('Booked: paying in full on the day. The party form is on the day view now.');
  if (action === 'balance') { const r = await ftInvEmail(id); alert(r.ok ? `Balance invoice emailed: $${Number(data.balance || 0).toFixed(2)} + tax, due ${ftiDl(data.balance_due)}.` : 'Saved, but the email didn\u2019t send: ' + r.error + ' (use Resend).'); }
  ftAfter();
}
function ftAfter() { if (paneVisible('ft-pane')) ftLoad(); if (_plan && paneVisible('plan-pane')) customLoad(true).then(() => renderPlanDay()); }


// =====================================================================================================================
// 🏢 Studio buyouts (studio_buyouts.sql): requests from World's Private Studio Buyout page (#buyout), and ones added by hand.
// Each with its estimate (World settings → Studio buyouts). Status, follow-up and staff note save as you change them.
// (Stage 2: 🧾 Invoice holds the studio and emails the deposit invoice.)
// =====================================================================================================================
let _bo = { rows: null, status: 'open', err: '', add: null };
let _boMove = null;   // (an unpaid invoice being moved to a new date or time: released just before the new hold)
const BO_STATUS = [['new', 'New'], ['contacted', 'Contacted'], ['invoiced', 'Invoiced'], ['booked', 'Booked'], ['declined', 'Declined']];
async function openBoPane() {
  await hoAreaLoad('parties_events'); if (!hoA('parties_events', 'view')) { alert('Studio buyouts need “Parties & events” on the Access page.'); return; }
  showOnlyPane('bo-pane'); setActiveNav('nav-bo'); boLoad();
}
async function boLoad() {
  _bo.rows = null; boDraw();
  try { const iv = await sb.rpc('hub_buyouts', { p_studio: null }); _bo.inv = iv.error ? null : (iv.data || []); } catch (e) { _bo.inv = null; }
  const { data, error } = await sb.rpc('hub_buyout_requests', { p_status: _bo.status });
  _bo.rows = error ? [] : (data || []); _bo.err = error ? (/hub_buyout_requests/.test(error.message) ? 'Run studio_buyouts.sql in Supabase first.' : error.message) : '';
  boDraw(); boBadge();
}
async function boBadge() {
  try { const r = await sb.rpc('hub_buyout_new_count'); const b = document.getElementById('bo-badge'); if (b && !r.error) { b.textContent = r.data || ''; b.style.display = r.data ? '' : 'none'; } } catch (e) {}
}
function boDraw() {
  const el = document.getElementById('bo-pane'); if (!el) return;
  const ed = hoA('parties_events', 'edit'), R = _bo.rows, money = n => n == null ? '' : '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const dl = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🏢 Studio buyouts</div><span class="spacer"></span>
      ${ed ? `<button class="ho-btn primary" onclick="_bo.add=_bo.add?null:{};boDraw()">${_bo.add ? 'Close' : '+ Add a request'}</button>` : ''}<button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Requests for the whole studio from World's <b>Private Studio Buyout</b> page, and ones added by hand. The estimate uses each studio's tier (World settings → Studio buyouts). Changes save straight away.</div>`;
  if (_bo.add) {
    const st = Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b]));
    h += `<div class="ft-add"><b>New request</b>
      <label>Studio<select id="boa-studio"><option value="">Choose…</option>${st.map(x => `<option value="${x}">${esc(STUDIO_NAMES[x])}</option>`).join('')}</select></label>
      <label>Name<input id="boa-name"></label><label>Email<input id="boa-email" type="email"></label><label>Phone<input id="boa-phone"></label>
      <label>Group / occasion<input id="boa-occasion"></label><label>Dates wanted<input id="boa-dates" placeholder="2027-03-06, or mid-March"></label>
      <label>Length<select id="boa-min"><option value="90">90 min</option><option value="120">2 hours</option><option value="150">2.5 hours</option><option value="180">3 hours</option></select></label>
      <label>Guests<input id="boa-guests" type="number" min="1"></label><label>Observers<input id="boa-obs" type="number" min="0" value="0"></label>
      <label>From<select id="boa-src"><option value="email">✉️ Email</option><option value="phone">📞 Phone</option><option value="other">Other</option></select></label>
      <label class="ft-add-wide">Notes<textarea id="boa-notes" rows="2"></textarea></label>
      <button class="ho-btn primary" onclick="boAddGo()">Add it</button></div>`;
  }
  h += `<div class="act-filters"><select onchange="_bo.status=this.value;boLoad()">${[['open', 'Open (new, contacted, invoiced)'], ...BO_STATUS, ['all', 'All']].map(o => `<option value="${o[0]}"${o[0] === _bo.status ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
    <span class="fd-sm">${R ? `${R.length} request${R.length === 1 ? '' : 's'}` : ''}</span></div>`;
  if (_bo.err) h += `<div class="goal-note">${esc(_bo.err)}</div>`;
  else if (R === null) h += '<div class="goal-note">Loading…</div>';
  else if (!R.length) h += '<div class="goal-note">No buyout requests here.</div>';
  else h += '<div class="bo-list">' + R.map(r => `<div class="bo-row bo-${escAttr(r.status)}">
      <div class="bo-main"><div><b>${esc(STUDIO_NAMES[r.studio_id] || r.studio_id || 'No studio')}</b> · ${esc(r.name || '')} <span class="goal-note">${esc(r.email || '')}${r.phone ? ' · ' + esc(r.phone) : ''}</span></div>
        ${boHeldLine(r)}<div class="bo-facts">📅 ${boDatesHtml(r)}${r.start_time ? ' · ' + esc(r.start_time) : ''} · ⏱ ${r.minutes === 90 ? '90 min' : (r.minutes / 60) + ' h'} · 👥 ${r.guests != null ? esc(r.guests) : '?'} guests${r.observers ? ' + ' + esc(r.observers) + ' observers' : ''}${r.estimate != null ? ` · 💲 about <b>${money(r.estimate)}</b> + tax` : ''}</div>
        ${r.organization || r.occasion ? `<div class="goal-note">${esc([r.organization, r.occasion].filter(Boolean).join(' · '))}</div>` : ''}
        ${r.project ? `<div class="goal-note">🎨 ${esc(r.project)}</div>` : ''}${r.notes ? `<div class="bo-notes">${esc(r.notes)}</div>` : ''}
        <div class="goal-note">Received ${esc(dl(r.created_at))}${r.source && r.source !== 'form' ? ' · by ' + esc(r.source) : ' · World form'}</div></div>
      <div class="bo-side">${boInvCell(r)}${ed ? `<button class="ho-btn sm" onclick="boEditOpen('${escAttr(r.id)}')">✏️ Edit request</button><select onchange="boSet('${escAttr(r.id)}','status',this.value)">${BO_STATUS.map(o => `<option value="${o[0]}"${o[0] === r.status ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
        <label class="fd-sm">Follow up <input type="date" value="${escAttr(r.follow_up || '')}" onchange="boSet('${escAttr(r.id)}','follow_up',this.value)"></label>
        <input class="bo-note" placeholder="Staff note" value="${escAttr(r.staff_note || '')}" onchange="boSet('${escAttr(r.id)}','staff_note',this.value)">` : `<span class="cust-st">${esc((BO_STATUS.find(o => o[0] === r.status) || [0, r.status])[1])}</span>`}</div></div>`).join('') + '</div>';
  el.innerHTML = h;
}
async function boSet(id, field, value) {
  const { data, error } = await sb.rpc('hub_buyout_request_set', { p_id: id, p_field: field, p_value: value || '' });
  if (error) { alert(error.message); return; }
  const i = (_bo.rows || []).findIndex(r => r.id === id); if (i !== -1 && data) _bo.rows[i] = data;
  if (field === 'status') boBadge();
}
async function boAddGo() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const p = { studio_id: v('boa-studio'), name: v('boa-name'), email: v('boa-email'), phone: v('boa-phone'), occasion: v('boa-occasion'), dates: v('boa-dates'),
    minutes: v('boa-min'), guests: v('boa-guests'), observers: v('boa-obs'), source: v('boa-src'), notes: v('boa-notes') };
  if (!p.studio_id) { alert('Choose the studio.'); return; }
  const { error } = await sb.rpc('hub_buyout_request_add', { p });
  if (error) { alert(error.message); return; }
  _bo.add = null; boLoad();
}


// ---- 🧾 a buyout's invoice (studio_buyout_invoices.sql): make it from the request (holds the studio), then its stages ----
const BOI_ST = { sent: '⏳ Deposit invoice sent', deposit_paid: '✓ Deposit paid', balance_sent: '🧾 Balance sent', paid: '✓ Paid', closed: '✓ Paid (studio)', cancelled: 'Cancelled', released: 'Released (unpaid)' };
function boInvOf(r) { return (_bo.inv || []).find(i => i.id === r.buyout_id) || (_bo.inv || []).filter(i => i.request_id === r.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null; }
function boInvCell(r) {
  if (_bo.inv === null) return '';
  const i = boInvOf(r), ed = hoA('parties_events', 'edit'), dl = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
  if (!i || ['cancelled', 'released'].includes(i.status)) return (i ? `<span class="cust-st">${esc(BOI_ST[i.status])}</span>` : '') + (ed ? `<button class="ho-btn primary" onclick="boInvNew('${escAttr(r.id)}')">🧾 Invoice</button>` : '');
  const what = i.status === 'sent' ? `deposit due ${dl(i.pay_by)}` : i.status === 'balance_sent' ? `$${Number(i.balance || 0).toFixed(2)} due ${dl(i.balance_due)}` : i.status === 'deposit_paid' ? `${dl(i.day)} · balance a week before` : '';
  const o = (a, l) => `<option value="${a}">${l}</option>`;
  return `<div><span class="cust-st cust-${i.status === 'sent' || i.status === 'balance_sent' ? 'held' : 'booked'}" title="${escAttr(`${i.day} ${String(i.at).slice(0, 5)} · ${i.minutes} min · ${i.guests} guests${i.observers ? ' + ' + i.observers + ' observers' : ''} · total about $${Number((i.price || {}).total || 0).toFixed(2)} before tax · paid $${Number(i.paid_total || 0).toFixed(2)}${i.agreed_at ? ' · terms agreed by ' + i.agreed_name : ''}${i.closed_n ? ' · ' + i.closed_n + ' times closed' : ''}`)}">${esc(BOI_ST[i.status] || i.status)}</span> <span class="fd-sm">${esc(what)}</span></div>
    ${ed && ['sent', 'deposit_paid', 'balance_sent'].includes(i.status) ? `<select class="fti-act" onchange="if (this.value) { const a = this.value; this.value = ''; boInvAct('${escAttr(i.id)}', a); }"><option value="">Actions…</option>${
      i.status === 'sent' ? o('send', i.sent_at ? 'Resend the invoice' : 'Send the invoice') + o('move', 'Change the date or time') + o('extend', 'Extend the deposit date') + o('cancel', 'Cancel (release the studio)')
      : i.status === 'deposit_paid' ? o('balance', 'Final numbers → send the balance') + o('paid_studio', 'Paid at the studio') + o('cancel', 'Cancel')
      : o('send', 'Resend the balance invoice') + o('balance', 'Change the final numbers') + o('paid_studio', 'Paid at the studio')}</select>` : ''}`;
}
// ✏️ (Nov 11 2026) The date and time actually invoiced (held), shown plainly on the card, and ticked among the dates wanted
function boActiveInv(r) { const i = boInvOf(r); return i && !['cancelled', 'released'].includes(i.status) ? i : null; }
function boHeldLine(r) {
  const i = boActiveInv(r); if (!i) return '';
  const d = new Date(String(i.day).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const mins = i.final_minutes || i.minutes, g = i.final_guests ?? i.guests, ob = i.final_observers ?? i.observers;
  return `<div class="bo-held" style="margin:4px 0;padding:6px 10px;border-radius:8px;background:#fff6db;display:inline-block">🧾 Invoiced for <b>${esc(d)} · ${esc(shortTime(i.at))}</b> · ${mins === 90 ? '90 min' : esc(mins / 60) + ' h'} · ${esc(g)} guests${ob ? ' + ' + esc(ob) + ' observers' : ''}${STUDIO_NAMES[i.studio_id] && i.studio_id !== r.studio_id ? ' · at ' + esc(STUDIO_NAMES[i.studio_id]) : ''}</div>`;
}
function boDatesHtml(r) {
  const i = boActiveInv(r), txt = esc(r.dates || 'no date yet');
  return i && i.day && txt.includes(String(i.day).slice(0, 10)) ? txt.replace(String(i.day).slice(0, 10), `<b>${esc(String(i.day).slice(0, 10))} ✓</b>`) : txt;
}
// ✏️ Edit a request's details (hub_buyout_request_set; the estimate updates itself)
const BO_EDIT = [['studio_id', 'Studio'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['organization', 'Group / organization'], ['occasion', 'Occasion'],
  ['dates', 'Dates wanted'], ['start_time', 'Start time'], ['minutes', 'Length'], ['guests', 'Guests'], ['observers', 'Observers'], ['project', 'Project'], ['notes', 'Notes']];
function boEditOpen(id) {
  const r = (_bo.rows || []).find(x => x.id === id); if (!r) return;
  const st = Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b]));
  const f = ([k, l]) => k === 'studio_id' ? `<label>${l}<select id="be-${k}">${st.map(x => `<option value="${x}"${x === r.studio_id ? ' selected' : ''}>${esc(STUDIO_NAMES[x])}</option>`).join('')}</select></label>`
    : k === 'minutes' ? `<label>${l}<select id="be-${k}">${[90, 120, 150, 180].map(m => `<option value="${m}"${(r.minutes || 90) === m ? ' selected' : ''}>${m === 90 ? '90 min' : m / 60 + ' hours'}</option>`).join('')}</select></label>`
    : k === 'notes' ? `<label>${l}<textarea id="be-${k}" rows="3">${esc(r.notes || '')}</textarea></label>`
    : `<label>${l}<input id="be-${k}"${k === 'guests' || k === 'observers' ? ' type="number" min="0"' : k === 'email' ? ' type="email"' : ''} value="${escAttr(r[k] ?? '')}"${k === 'dates' ? ' placeholder="2027-03-06, 2027-03-13"' : k === 'start_time' ? ' placeholder="11:00am"' : ''}></label>`;
  const inv = boActiveInv(r);
  openDutySheet(`<h3>✏️ Edit the request</h3><p class="ho-intro">${esc(r.name || 'This request')}${inv ? '. <b>It already has an invoice:</b> changing the request doesn’t change the invoice. To move the invoiced date or time, use Actions → Change the date or time.' : '.'}</p>
    <div class="me-form">${BO_EDIT.map(f).join('')}</div><div id="be-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="be-go" onclick="boEditSave('${escAttr(id)}')">Save</button></div>`);
}
async function boEditSave(id) {
  const r = (_bo.rows || []).find(x => x.id === id) || {}, btn = document.getElementById('be-go'), msg = document.getElementById('be-msg');
  const changes = BO_EDIT.map(([k]) => [k, ((document.getElementById('be-' + k) || {}).value || '').trim()]).filter(([k, v]) => String(r[k] ?? '') !== v);
  if (!changes.length) { closeDutySheet(); return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  for (const [k, v] of changes) {
    const { error } = await sb.rpc('hub_buyout_request_set', { p_id: id, p_field: k, p_value: v });
    if (error) { btn.disabled = false; btn.textContent = 'Save'; msg.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  }
  closeDutySheet(); boLoad();
}
// 🔁 Change an unpaid invoice's date or time: the old hold is released first (so the times it closed reopen), then the new one is
// held and its invoice emailed, the same as making an invoice. If the new time can't be held, the old one is already released.
function boMoveOpen(i) {
  if (!i || i.status !== 'sent') { alert('Only an invoice whose deposit isn’t paid yet can be moved here.'); return; }
  if (!confirm('Change the date or time of this buyout?\n\nNext you’ll choose the new date and time. The current hold is released when you press “Hold the studio and email the invoice”, and the family gets the updated invoice.')) return;
  boInvNew(i.request_id, { day: i.day, at: i.at, minutes: i.minutes, guests: i.guests, observers: i.observers, name: i.contact_name, email: i.email, phone: i.phone,
    organization: i.organization, occasion: i.occasion, project: i.project, studio_id: i.studio_id, pay_by: i.pay_by, __move: i.id });
}
// "6:15pm" (World's request form) or "18:15" → "18:15" for a time box
function boTime24(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i); if (!m) return '';
  let h = +m[1]; if (m[3]) { h = h % 12 + (/pm/i.test(m[3]) ? 12 : 0); }
  return String(h).padStart(2, '0') + ':' + m[2];
}
function boInvNew(reqId, pre) {
  const r = Object.assign({}, (_bo.rows || []).find(x => x.id === reqId) || {}, pre || {});
  const firstDate = r.day || (String(r.dates || '').match(/\d{4}-\d{2}-\d{2}/) || [''])[0], pb = r.pay_by || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return localDateStr(d); })();
  _boMove = (pre && pre.__move) || null;
  const st = Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b]));
  openDutySheet(`<h3>🧾 Studio buyout invoice${_boMove ? ': new date or time' : ''}</h3><p class="ho-intro">Holds the whole studio (everything else closes from 15 minutes before to 15 minutes after) and emails ${esc(r.email || 'the contact')} the deposit invoice: they confirm the project, agree to the terms and pay the deposit. Unpaid by the deposit date, it's released.</p>
    <div class="me-form">
      <label>Studio<select id="bi-studio">${st.map(x => `<option value="${x}"${x === r.studio_id ? ' selected' : ''}>${esc(STUDIO_NAMES[x])}</option>`).join('')}</select></label>
      <label>Date<input id="bi-day" type="date" value="${escAttr(firstDate)}"></label><label>Start time<input id="bi-at" type="time" step="900" value="${escAttr(r.at ? String(r.at).slice(0, 5) : boTime24(r.start_time))}"></label>
      <label>Length<select id="bi-min">${[90, 120, 150, 180].map(m => `<option value="${m}"${(r.minutes || 90) === m ? ' selected' : ''}>${m === 90 ? '90 min' : m / 60 + ' hours'}</option>`).join('')}</select></label>
      <label>Guests (making art)<input id="bi-guests" type="number" min="0" value="${escAttr(r.guests || '')}"></label><label>Observers<input id="bi-obs" type="number" min="0" value="${escAttr(r.observers || 0)}"></label>
      <label>Contact<input id="bi-contact" value="${escAttr(r.name || '')}"></label><label>Email<input id="bi-email" type="email" value="${escAttr(r.email || '')}"></label><label>Phone<input id="bi-phone" value="${escAttr(r.phone || '')}"></label>
      <label>Group / organization<input id="bi-org" value="${escAttr(r.organization || '')}"></label><label>Occasion<input id="bi-occ" value="${escAttr(r.occasion || '')}"></label>
      <label>Project (they can confirm it)<input id="bi-proj" value="${escAttr(r.project || '')}"></label>
      <label>Deposit due by<input id="bi-pay" type="date" value="${escAttr(pb)}"></label>
      <label>Deposit (before tax; blank = the 90-minute price)<input id="bi-dep" type="number" min="0" step="0.01" placeholder="the 90-minute price"></label>
    </div><div id="bi-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="bi-go" onclick="boInvCreate('${escAttr(reqId)}', false)">${_boMove ? 'Release the old time, hold the new one and email' : 'Hold the studio and email the invoice'}</button></div>`);
}
async function boInvCreate(reqId, force) {
  const v = id => ((document.getElementById(id) || {}).value || '').trim(), msg = document.getElementById('bi-msg'), btn = document.getElementById('bi-go');
  const p = { request_id: reqId, studio_id: v('bi-studio'), day: v('bi-day'), at: v('bi-at'), minutes: v('bi-min'), guests: v('bi-guests'), observers: v('bi-obs'), contact_name: v('bi-contact'),
    email: v('bi-email'), phone: v('bi-phone'), organization: v('bi-org'), occasion: v('bi-occ'), project: v('bi-proj'), pay_by: v('bi-pay'), deposit: v('bi-dep'), force: !!force };
  if (!p.day || !p.at) { msg.innerHTML = '<div class="me-msg err">Choose the date and start time.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Holding the studio…';
  if (_boMove) {   // 🔁 moving: release the old hold first (its closed times reopen), then hold the new one below
    btn.textContent = 'Releasing the old time…';
    const c = await sb.rpc('hub_buyout_action', { p_id: _boMove, p_action: 'cancel' });
    if (c.error) { btn.disabled = false; btn.textContent = 'Release the old time, hold the new one and email'; msg.innerHTML = `<div class="me-msg err">${esc(c.error.message)}</div>`; return; }
    _boMove = null; btn.textContent = 'Holding the new time…';
  }
  const { data, error } = await sb.rpc('hub_buyout_create', { p });
  if (error) {
    btn.disabled = false; btn.textContent = 'Hold the studio and email the invoice';
    const busy = /Already booked then|Too many for this studio/.test(error.message);
    msg.innerHTML = `<div class="me-msg err">${esc(/hub_buyout_create/.test(error.message) ? 'Run studio_buyout_invoices.sql in Supabase first.' : error.message)}</div>` +
      (busy ? `<button class="ho-btn" onclick="boInvCreate('${escAttr(reqId)}', true)">Go ahead anyway</button>` : '');
    return;
  }
  const r = await boInvEmail(data.id);
  closeDutySheet(); alert(r.ok ? `Held: ${data.closed && data.closed.length ? data.closed.length + ' other times closed. ' : ''}The invoice was emailed to ${p.email}.` : 'Held, but the invoice email didn\u2019t send: ' + r.error + ' (use Actions → Send).'); boLoad();
}
async function boInvEmail(id) {
  const ses = await sb.auth.getSession(), tk = ses && ses.data && ses.data.session && ses.data.session.access_token;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/custom-party-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (tk || SUPABASE_ANON_KEY) }, body: JSON.stringify({ bo_id: id }) }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  return r && r.ok ? { ok: true, link: d.link } : { ok: false, error: d.error || 'please try again' };
}
async function boInvAct(id, action) {
  const i = (_bo.inv || []).concat((_cust && _cust.bo) || []).find(x => x.id === id) || {};
  if (action === 'move') { boMoveOpen(i); return; }
  if (action === 'send') { const r = await boInvEmail(id); if (r.ok && r.link) { try { await navigator.clipboard.writeText(r.link); } catch (e) {} } alert(r.ok ? 'Emailed (and the link copied).' : 'The email didn\u2019t send: ' + r.error); boAfter(); return; }
  let date = null, g = null, o = null, m = null;
  if (action === 'extend') { date = prompt('New deposit due date (YYYY-MM-DD):', String(i.pay_by || '')); if (!date) return; }
  if (action === 'balance') {
    g = prompt('Final number of guests making art:', String(i.final_guests ?? i.guests ?? '')); if (g == null) return; g = parseInt(g, 10); if (!(g >= 0)) { alert('Enter a number.'); return; }
    o = prompt('Final number of observers (not making art):', String(i.final_observers ?? i.observers ?? 0)); if (o == null) return; o = parseInt(o, 10) || 0;
    m = prompt('Length in minutes (90, 120, 150, 180…):', String(i.final_minutes ?? i.minutes ?? 90)); if (m == null) return; m = Math.max(90, parseInt(m, 10) || 90);
  }
  if (action === 'paid_studio' && !confirm('Mark this buyout as paid in full at the studio?')) return;
  if (action === 'cancel' && !confirm(i.status === 'sent' ? 'Cancel this buyout? The studio is released and its other times reopen.' : 'Cancel this buyout? (The deposit is non-refundable under the terms.)')) return;
  const { data, error } = await sb.rpc('hub_buyout_action', { p_id: id, p_action: action, p_date: date, p_guests: g, p_observers: o, p_minutes: m });
  if (error) { alert(error.message); return; }
  if (action === 'balance') { const r = await boInvEmail(id); alert(r.ok ? `Balance invoice emailed: $${Number(data.balance || 0).toFixed(2)} + tax, due ${data.balance_due}.` : 'Saved, but the email didn\u2019t send: ' + r.error + ' (use Resend).'); }
  boAfter();
}
function boAfter() { if (paneVisible('bo-pane')) boLoad(); if (_plan && paneVisible('plan-pane')) customLoad(true).then(() => renderPlanDay()); }

async function openFtPane() {
  await hoAreaLoad('parties_events'); if (!hoA('parties_events', 'view')) { alert('Field trips need “Parties & events” on the Access page.'); return; }
  showOnlyPane('ft-pane'); setActiveNav('nav-ft'); ftLoad();
}
async function ftLoad() {
  _ft.rows = null; ftDraw();
  try { const iv = await sb.rpc('hub_ft_invoices', { p_studio: null }); _ft.inv = iv.error ? null : (iv.data || []); _ft.invErr = iv.error ? iv.error.message : ''; } catch (e) { _ft.inv = null; }
  let data = null, error = null;
  try { ({ data, error } = await sb.rpc('hub_field_trips', { p_status: _ft.status })); } catch (e) { error = e; }
  if (data && !Array.isArray(data)) data = [];
  _ft.err = error ? (/hub_field_trips/i.test(error.message) ? 'Run world_field_trips.sql in Supabase to switch this on.' : error.message) : '';
  _ft.rows = error ? [] : (data || []); ftDraw();
  const b = document.getElementById('ft-badge'), n = (_ft.status === 'open' ? _ft.rows : []).filter(r => r.status === 'new').length;
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
}
function ftCell(r, c) {
  const [f, , type, w] = c, v = r[f], id = escAttr(r.id), on = `onchange="ftSave('${id}','${f}',this.value)"`, ro = !hoA('parties_events', 'edit') ? 'disabled' : '';
  if (type === 'ro') return `<td class="ft-ro">${v ? esc(new Date(v).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })) : ''}</td>`;
  if (type === 'status') return `<td><select class="ft-in ft-st-${escAttr(v || 'new')}" ${ro} ${on}>${FT_STATUS.map(o => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></td>`;
  if (type === 'source') return `<td><select class="ft-in" ${ro} ${on}>${FT_SOURCE.map(o => `<option value="${o[0]}"${o[0] === (v || 'form') ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></td>`;
  if (type === 'studio') return `<td><select class="ft-in" ${ro} ${on}><option value="">—</option>${Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b])).map(s => `<option value="${s}"${s === v ? ' selected' : ''}>${esc(STUDIO_NAMES[s])}</option>`).join('')}</select></td>`;
  if (type === 'notes') return `<td><textarea class="ft-in ft-notes-in" rows="1" ${ro} ${on} title="${escAttr(v || '')}">${esc(v || '')}</textarea></td>`;
  if (f === 'booked_date') return `<td><label class="ft-dwrap"><span class="ft-dlabel">${v ? esc(ftNiceDate(v)) : '<span class="goal-note">Set date</span>'}</span>
    <input class="ft-in ft-dpick" type="date" value="${escAttr(v || '')}" ${ro} ${on} onclick="try{this.showPicker()}catch(e){}"></label></td>`;
  const t = type === 'num' ? 'number' : type === 'money' ? 'number" step="0.01' : type === 'text' ? 'text' : type;
  const val = type === 'time' && v ? String(v).slice(0, 5) : v == null ? '' : v;
  return `<td><input class="ft-in" type="${t}" value="${escAttr(val)}" ${ro} ${on}${type === 'email' && v ? ` title="${escAttr(v)}"` : ''}></td>`;
}
function ftDraw() {
  const el = document.getElementById('ft-pane'); if (!el) return;
  try { ftDrawPage(el); }
  catch (e) {   // never a blank page: say what went wrong
    console.error('Field trips:', e);
    el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🏫 Field trips</div></div><p class="fd-msg">The Field trips page couldn’t be shown: ${esc(e && e.message || String(e))}</p><button class="ho-btn" onclick="ftLoad()">Try again</button>`;
  }
}
function ftDrawPage(el) {
  const F = _ft, R = F.rows, today = new Date().toLocaleDateString('en-CA'), q = F.q.trim().toLowerCase();
  // keep the table's scroll where it was
  const w0 = el.querySelector('.ft-wrap'), keep = w0 ? [w0.scrollTop, w0.scrollLeft] : null;
  let rows = (R || []).filter(r => (!F.from || (r.booked_date && r.booked_date >= F.from)) && (!F.to || (r.booked_date && r.booked_date <= F.to))
    && (!F.studio || r.studio_id === F.studio) && (!q || [r.school, r.contact_name, r.email, r.project, r.staff_note, r.notes].some(x => String(x || '').toLowerCase().includes(q))));
  const key = r => { const v = r[F.sort]; return v == null || v === '' ? (F.desc ? '' : '\uffff') : typeof v === 'number' ? String(v).padStart(10, '0') : String(v).toLowerCase(); };
  rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * (F.desc ? -1 : 1));
  const due = rows.filter(r => r.follow_up && r.follow_up <= today && !['booked', 'declined'].includes(r.status)).length;
  const A = F.add;
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🏫 Field trips</div><span class="spacer"></span>
      ${hoA('parties_events', 'edit') ? `<button class="ho-btn primary" onclick="_ft.add=_ft.add?null:{source:'email'};ftDraw()">${A ? 'Close' : '+ Add a request'}</button>` : ''}<button class="ho-btn" onclick="ftCsv()">⬇ Download</button><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Every field trip request: World's form adds a row (and emails events@4cats.com), and <b>+ Add a request</b> adds ones that come by email or phone. Click any cell to change it; it saves straight away. Rows with a follow-up date today or earlier are highlighted.</div>`;
  if (A) h += `<div class="ft-add"><b>New request</b>
      <label>School<input id="fta-school" value="${escAttr(A.school || '')}"></label><label>Contact<input id="fta-contact" value="${escAttr(A.contact_name || '')}"></label>
      <label>Email<input id="fta-email" type="email" value="${escAttr(A.email || '')}"></label><label>Phone<input id="fta-phone" type="tel" value="${escAttr(A.phone || '')}"></label>
      <label>Studio<select id="fta-studio"><option value="">Choose…</option>${Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b])).map(s => `<option value="${s}"${s === A.studio_id ? ' selected' : ''}>${esc(STUDIO_NAMES[s])}</option>`).join('')}</select></label>
      <label>Date wanted<input id="fta-date" value="${escAttr(A.preferred_date || '')}" placeholder="e.g. Feb 12 or mid-March"></label><label>Students<input id="fta-students" type="number" min="0" value="${escAttr(A.students || '')}"></label>
      <label>From<select id="fta-source">${FT_SOURCE.filter(o => o[0] !== 'form').map(o => `<option value="${o[0]}"${o[0] === A.source ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>
      <label class="ft-add-wide">Their questions or details<textarea id="fta-notes" rows="2">${esc(A.notes || '')}</textarea></label>
      ${A.msg ? `<p class="fd-msg">${esc(A.msg)}</p>` : ''}<button class="ho-btn primary" onclick="ftAddGo()">Add it</button></div>`;
  h += `<div class="act-filters"><select onchange="_ft.status=this.value;ftLoad()">${[['open', 'Open (new, contacted, invoiced)'], ...FT_STATUS, ['all', 'All']].map(o => `<option value="${o[0]}"${o[0] === F.status ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select onchange="_ft.studio=this.value;ftDraw()"><option value="">Every studio</option>${Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b])).map(s => `<option value="${s}"${s === F.studio ? ' selected' : ''}>${esc(STUDIO_NAMES[s])}</option>`).join('')}</select>
      <input type="search" id="ft-q" placeholder="Search school, contact, project, notes" value="${escAttr(F.q)}" oninput="_ft.q=this.value;ftDraw();const i=document.getElementById('ft-q');i.focus();i.setSelectionRange(i.value.length,i.value.length)">
      <label class="fd-sm">Trip date from <input type="date" value="${escAttr(F.from)}" onchange="_ft.from=this.value;ftDraw()"></label>
      <label class="fd-sm">to <input type="date" value="${escAttr(F.to)}" onchange="_ft.to=this.value;ftDraw()"></label>
      ${F.from || F.to ? `<button class="ho-btn sm" onclick="_ft.from='';_ft.to='';ftDraw()">Clear dates</button>` : ''}
      <button class="ho-btn sm" onclick="ftColReset()" title="Put the columns back in the usual order">↺ Columns</button>
      <span class="fd-sm">${R ? `${rows.length} request${rows.length === 1 ? '' : 's'}${due ? ` · <b class="ft-due-n">${due} to follow up</b>` : ''}` : ''}</span></div>`;
  if (F.err) h += `<div class="goal-note">${esc(F.err)}</div>`;
  else if (R === null) h += '<div class="goal-note">Loading…</div>';
  else if (!rows.length) h += '<div class="goal-note">No field trip requests here.</div>';
  else h += `<div class="ft-topscroll" id="ft-topscroll"><div></div></div><div class="fd-tbl-wrap ft-wrap"><table class="fd-tbl ft-tbl"><thead><tr><th style="min-width:200px">Invoice</th>${ftCols().map(c => `<th style="min-width:${c[3]}px" class="ft-dragth" draggable="true" title="Drag to move this column" ondragstart="_ftDrag='${c[0]}';event.dataTransfer.effectAllowed='move'" ondragover="event.preventDefault()" ondrop="event.preventDefault();ftColDrop('${c[0]}')"><button class="fd-th${F.sort === c[0] ? ' on' : ''}" onclick="ftSort('${c[0]}')">${esc(c[1])}${F.sort === c[0] ? (F.desc ? ' ▼' : ' ▲') : ''}</button></th>`).join('')}${hoA('parties_events', 'edit') ? '<th></th>' : ''}</tr></thead><tbody>` +
    rows.map(r => `<tr class="${r.follow_up && r.follow_up <= today && !['booked', 'declined'].includes(r.status) ? 'ft-due' : ''} ft-r-${escAttr(r.status || 'new')}"><td class="ft-inv">${ftInvCell(r)}</td>${ftCols().map(c => ftCell(r, c)).join('')}` +
      (hoA('parties_events', 'edit') ? `<td class="ft-x">${F.saving[r.id] === 1 ? '…' : F.saving[r.id] === 2 ? '✓' : `<button title="Delete this row" onclick="ftDel('${escAttr(r.id)}')">🗑</button>`}</td>` : '') + '</tr>').join('') + '</tbody></table></div>';
  el.innerHTML = h;
  const w1 = el.querySelector('.ft-wrap'); if (w1 && keep) { w1.scrollTop = keep[0]; w1.scrollLeft = keep[1]; }
  // the top scrollbar: as wide as the table, and in step with the table's own
  const top = el.querySelector('#ft-topscroll'), tbl = el.querySelector('.ft-tbl');
  if (top && w1 && tbl) {
    top.firstChild.style.width = tbl.scrollWidth + 'px'; top.scrollLeft = w1.scrollLeft;
    let busy = false;
    top.onscroll = () => { if (busy) return; busy = true; w1.scrollLeft = top.scrollLeft; busy = false; };
    w1.addEventListener('scroll', () => { if (busy) return; busy = true; top.scrollLeft = w1.scrollLeft; busy = false; });
  }
}
function ftSort(k) { if (_ft.sort === k) _ft.desc = !_ft.desc; else { _ft.sort = k; _ft.desc = ['created_at', 'quote', 'students', 'adults'].includes(k); } ftDraw(); }
async function ftSave(id, field, value) {
  if (!hoA('parties_events', 'edit')) { alert('Changing field trips needs “Parties & events” (Edit) on the Access page.'); return; }
  _ft.saving[id] = 1; ftDraw();
  const { data, error } = await sb.rpc('hub_field_trip_save', { p: { id, [field]: value } });
  if (error) { delete _ft.saving[id]; ftDraw(); alert('Not saved: ' + (/hub_field_trip_save/.test(error.message) ? 'run field_trip_tracker.sql first.' : error.message)); return; }
  const i = _ft.rows.findIndex(r => r.id === id); if (i >= 0 && data) _ft.rows[i] = data;
  _ft.saving[id] = 2; ftDraw(); setTimeout(() => { if (_ft.saving[id] === 2) { delete _ft.saving[id]; ftDraw(); } }, 1200);
}
async function ftAddGo() {
  const g = id => (document.getElementById(id) || {}).value || '', A = _ft.add;
  Object.assign(A, { school: g('fta-school').trim(), contact_name: g('fta-contact').trim(), email: g('fta-email').trim(), phone: g('fta-phone').trim(), studio_id: g('fta-studio'),
    preferred_date: g('fta-date').trim(), students: g('fta-students'), source: g('fta-source'), notes: g('fta-notes').trim(), msg: '' });
  if (!A.school || !A.contact_name) { A.msg = 'Add the school and the contact’s name.'; ftDraw(); return; }
  if (!A.email && !A.phone) { A.msg = 'Add an email or a phone number.'; ftDraw(); return; }
  const p = {}; ['school', 'contact_name', 'email', 'phone', 'studio_id', 'preferred_date', 'students', 'source', 'notes'].forEach(k => { if (A[k] !== '') p[k] = A[k]; });
  const { error } = await sb.rpc('hub_field_trip_save', { p });
  if (error) { A.msg = 'Not added: ' + (/hub_field_trip_save/.test(error.message) ? 'run field_trip_tracker.sql first.' : error.message); ftDraw(); return; }
  _ft.add = null; ftLoad();
}
async function ftDel(id) {
  const r = (_ft.rows || []).find(x => x.id === id); if (!r) return;
  if (!confirm(`Delete the request from ${r.school || 'this school'}? This can't be undone.`)) return;
  const { error } = await sb.rpc('hub_field_trip_delete', { p_id: id });
  if (error) { alert('Not deleted: ' + error.message); return; }
  _ft.rows = _ft.rows.filter(x => x.id !== id); ftDraw();
}
function ftCsv() {
  const rows = (_ft.rows || []), cols = ftCols().map(c => c[0]), q = x => { const s = x == null ? '' : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [ftCols().map(c => c[1]).join(',')].concat(rows.map(r => cols.map(k => q(k === 'studio_id' ? (STUDIO_NAMES[r[k]] || r[k]) : r[k])).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'field-trips-' + new Date().toLocaleDateString('en-CA') + '.csv'; a.click();
}

// ---------- Home office → 🕘 Activity log (admins: staff_activity_log.sql) ----------
// What staff and admins changed (Hub, World settings, admin.html), newest first, kept a year. Filter by area, action,
// studio, person, class or session (search) and dates; download the filtered list as a spreadsheet.
let _act = { f: { area: '', action: '', studio: '', actor: '', q: '', from: '', to: '' }, rows: null, facets: null, err: '' };
function openActPane() {
  if (!_hoCan.view) { alert('The activity log is for home office admins.'); return; }
  showOnlyPane('act-pane', 'ft-pane'); setActiveNav('nav-act');
  if (!_act.f.from) { const d = new Date(); d.setDate(d.getDate() - 7); _act.f.from = localDateStr(d); }
  actDraw(); actLoad();
  if (!_act.facets) sb.rpc('staff_activity_facets').then(r => { if (!r.error) { _act.facets = r.data; actDraw(); } });
}
async function actLoad() {
  _act.rows = null; actDraw();
  const { data, error } = await sb.rpc('staff_activity_list', { p: Object.assign({ limit: 1000 }, _act.f) });
  _act.err = error ? (/staff_activity_list/i.test(error.message) ? 'Run staff_activity_log.sql in Supabase to switch this on.' : error.message) : '';
  _act.rows = error ? [] : (data || []); actDraw();
}
function actDetails(d) {
  if (!d || typeof d !== 'object') return '';
  const show = v => v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 80);
  return Object.keys(d).filter(k => d[k] !== undefined).map(k => {
    const v = d[k], name = ({ spaces_left_cache: 'spots left', capacity: 'spots', session_date: 'date', session_time: 'time', returned_at: 'cancelled', qty: 'spots booked',
      show: 'shown on World', publish: 'published', kids_only: 'kids only', duration_minutes: 'minutes', world_item_id: 'workshop', move_note: 'note', expires_on: 'until', starts_on: 'from' })[k] || k.replace(/_/g, ' ');
    return Array.isArray(v) && v.length === 2 ? `<span class="act-ch"><b>${esc(name)}</b> ${esc(show(v[0]))} → ${esc(show(v[1]))}</span>` : `<span class="act-ch"><b>${esc(name)}</b> ${esc(show(v))}</span>`;
  }).join('');
}
function actDraw() {
  const el = document.getElementById('act-pane'); if (!el) return;
  const F = _act.f, fac = _act.facets || { actions: [], actors: [] }, R = _act.rows;
  const areas = [...new Set((fac.actions || []).map(a => a[0]))].sort();
  const actions = (fac.actions || []).filter(a => !F.area || a[0] === F.area).map(a => a[1]).sort();
  const studios = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const sel = (id, all, opts, cur) => `<select id="${id}" onchange="actFilter()"><option value="">${all}</option>${opts.map(o => `<option value="${escAttr(o[0])}"${o[0] === cur ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🕘 Activity log</div><span class="spacer"></span>
      ${R && R.length ? '<button class="ho-btn" onclick="actCsv()">Download spreadsheet</button>' : ''}<button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">What staff and admins changed in the Hub, World settings and admin.html, newest first. Kept for a year.</div>
    <div class="act-filters">${sel('act-area', 'All areas', areas.map(a => [a, a]), F.area)}${sel('act-action', 'All actions', actions.map(a => [a, a]), F.action)}
      ${sel('act-studio', 'All studios', studios.map(x => [x, STUDIO_NAMES[x] || x]), F.studio)}${sel('act-actor', 'Everyone', (fac.actors || []).sort().map(a => [a, a]), F.actor)}
      <input type="search" id="act-q" placeholder="Class, session, customer or change…" value="${escAttr(F.q)}" onkeydown="if(event.key==='Enter')actFilter()">
      <label>From <input type="date" id="act-from" value="${escAttr(F.from)}" onchange="actFilter()"></label><label>To <input type="date" id="act-to" value="${escAttr(F.to)}" onchange="actFilter()"></label>
      <button class="ho-btn" onclick="actFilter()">Show</button></div>
    ${_act.err ? `<div class="goal-note" style="color:#b91c1c">${esc(_act.err)}</div>` : ''}
    ${R === null ? '<div class="goal-note">Loading…</div>' : !R.length ? '<div class="ho-intro">Nothing matches.</div>' : `<div class="goal-note" style="margin:4px 0">${R.length}${R.length >= 1000 ? '+' : ''} entries</div>
    <div class="oc-wrap"><table class="oc-table act-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Studio</th><th>What</th><th>Changes</th></tr></thead><tbody>${R.map(x => `<tr>
      <td style="white-space:nowrap">${esc(new Date(x.at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td>
      <td><small>${esc(x.actor_email || '—')}</small></td><td><span class="act-area">${esc(x.area)}</span> ${esc(x.action)}${x.n > 1 ? ` <b>×${x.n}</b>` : ''}</td>
      <td><small>${esc(STUDIO_NAMES[x.studio_id] || x.studio_id || '')}</small></td><td>${esc(x.label || '')}${x.n > 1 ? `<small class="goal-note"> (and ${x.n - 1} more)</small>` : ''}</td>
      <td class="act-chs">${actDetails(x.details)}</td></tr>`).join('')}</tbody></table></div>`}`;
}
function actFilter() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const area = v('act-area');
  _act.f = { area, action: area !== _act.f.area ? '' : v('act-action'), studio: v('act-studio'), actor: v('act-actor'), q: v('act-q').trim(), from: v('act-from'), to: v('act-to') };
  actLoad();
}
function actCsv() {
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [['When', 'Who', 'Area', 'Action', 'Count', 'Studio', 'What', 'Changes'].map(cell).join(',')].concat((_act.rows || []).map(x => [
    new Date(x.at).toLocaleString('en-CA'), x.actor_email || '', x.area, x.action, x.n, STUDIO_NAMES[x.studio_id] || x.studio_id || '', x.label || '',
    Object.keys(x.details || {}).map(k => { const d = x.details[k]; return k + ': ' + (Array.isArray(d) ? JSON.stringify(d[0]) + ' → ' + JSON.stringify(d[1]) : JSON.stringify(d)); }).join('; ')].map(cell).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'activity-log-' + localDateStr(new Date()) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- Home office → 🎁 Donations & giveaways (admins: world_prize_codes.sql) ----------
// Who got what (a school auction, a contest winner…), with the codes that went with it and how each is doing.
// Prize codes can be made right here for an entry; they're managed in World settings → Prices & sales → Prize codes.
let _don = { rows: null, search: '', from: '', to: '', err: '' };
const DON_KINDS = [['donation', 'Donation'], ['giveaway', 'Giveaway'], ['contest', 'Contest winner'], ['other', 'Other']];
async function openDonPane() {
  await hoAreaLoad('world_site_deals'); if (!hoA('world_site_deals', 'view')) { alert('Donations & giveaways need “World site & deals” on the Access page.'); return; }
  showOnlyPane('don-pane'); setActiveNav('nav-don');
  if (!_don.from) { const y = new Date().getFullYear(); _don.from = y + '-01-01'; }
  donDraw(); donLoad();
}
async function donLoad() {
  const { data, error } = await sb.rpc('hub_donations_list', { p_search: _don.search || null, p_from: _don.from || null, p_to: _don.to || null });
  _don.rows = error ? null : (data || []); _don.err = error ? (/hub_donations_list/i.test(error.message) ? 'Run world_prize_codes.sql in Supabase to switch this on.' : error.message) : '';
  donDraw();
}
function donDraw() {
  const el = document.getElementById('don-pane'); if (!el) return;
  const R = _don.rows || [];
  const codes = R.reduce((t, d) => t.concat(d.code_status || []), []), used = codes.filter(c => c.used === true).length, off = codes.filter(c => c.off === true && c.used !== true).length;
  const value = R.reduce((t, d) => t + (+d.value || 0), 0);
  const chip = c => `<span class="don-code ${c.used === true ? 'used' : c.off === true ? 'off' : c.kind === 'unknown' ? 'unk' : ''}" title="${c.kind === 'membership' ? 'Membership code' : c.kind === 'unknown' ? 'Not a World code (e.g. a Shopify-only code)' : 'Prize code'}">${esc(c.code)} · ${c.used === true ? '✓ used' : c.off === true ? 'off / ended' : c.kind === 'unknown' ? '?' : c.starts ? 'starts ' + esc(new Date(c.starts + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })) : 'not yet'}</span>`;
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🎁 Donations & giveaways</div><span class="spacer"></span>
      ${hoA('world_site_deals', 'edit') ? '<button class="ho-btn primary" onclick="donEdit(null)">+ Add</button>' : ''}<button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Everything given away (school auctions, contests, prizes) and the codes that went with it. Codes show whether they’ve been used. Make and manage prize codes here or in World settings → Prices & sales → Prize codes.</div>
    <div class="don-filters"><input type="search" id="don-q" placeholder="Search who, event, email or code" value="${escAttr(_don.search)}" onkeydown="if(event.key==='Enter')donFilter()">
      <label>From <input type="date" id="don-from" value="${escAttr(_don.from)}"></label><label>To <input type="date" id="don-to" value="${escAttr(_don.to)}"></label><button class="ho-btn" onclick="donFilter()">Show</button></div>
    ${_don.err ? `<div class="goal-note" style="color:#b91c1c">${esc(_don.err)}</div>` : ''}
    ${_don.rows === null && !_don.err ? '<div class="goal-note">Loading…</div>' : `<div class="don-sum"><span><b>${R.length}</b> ${R.length === 1 ? 'entry' : 'entries'}</span><span><b>${codes.length}</b> codes given</span><span><b>${used}</b> used</span><span><b>${codes.length - used - off}</b> not used yet</span>${value ? `<span><b>$${value.toFixed(2)}</b> value</span>` : ''}</div>
    ${R.length ? `<div class="don-list">${R.map(d => `<div class="don-row"><div class="don-main"><b>${esc(d.recipient)}</b> <span class="don-kind">${esc((DON_KINDS.find(k => k[0] === d.kind) || [0, d.kind])[1])}</span>
        <div class="goal-note">${esc(new Date(d.given_on + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }))}${d.event ? ' · ' + esc(d.event) : ''}${d.studio_id ? ' · ' + esc(STUDIO_NAMES[d.studio_id] || d.studio_id) : ''}${d.value ? ' · $' + Number(d.value).toFixed(2) : ''}${d.contact_name || d.contact_email ? ' · ' + esc([d.contact_name, d.contact_email, d.contact_phone].filter(Boolean).join(', ')) : ''}</div>
        ${(d.code_status || []).length ? `<div class="don-codes">${d.code_status.map(chip).join('')}</div>` : ''}${d.notes ? `<div class="don-notes">${esc(d.notes)}</div>` : ''}</div>
      ${hoA('world_site_deals', 'edit') ? `<button class="ho-btn" onclick="donEdit('${escAttr(d.id)}')">Edit</button>` : ''}</div>`).join('')}</div>` : '<div class="ho-intro">Nothing logged for these dates yet.</div>'}`}`;
}
function donFilter() { _don.search = document.getElementById('don-q').value.trim(); _don.from = document.getElementById('don-from').value; _don.to = document.getElementById('don-to').value; _don.rows = null; donDraw(); donLoad(); }
function donEdit(id) {
  const d = id ? (_don.rows || []).find(x => x.id === id) || {} : { kind: 'donation', given_on: localDateStr(new Date()), studio_id: _sessionStudioId || '' }, studios = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  openDutySheet(`<h3>${id ? 'Edit' : 'Add'} a donation or giveaway</h3><div class="me-form don-form">
    <label>Kind<select id="dn-kind">${DON_KINDS.map(k => `<option value="${k[0]}"${d.kind === k[0] ? ' selected' : ''}>${k[1]}</option>`).join('')}</select></label>
    <label>Who it went to<input id="dn-recipient" maxlength="200" value="${escAttr(d.recipient || '')}" placeholder="e.g. Maple Elementary PAC, or the winner’s name"></label>
    <label>Event<input id="dn-event" maxlength="200" value="${escAttr(d.event || '')}" placeholder="e.g. Spring auction, Instagram contest"></label>
    <div class="don-two"><label>Date<input type="date" id="dn-date" value="${escAttr(d.given_on || '')}"></label>
      <label>From studio<select id="dn-studio"><option value="">Home office / all</option>${studios.map(s2 => `<option value="${escAttr(s2)}"${d.studio_id === s2 ? ' selected' : ''}>${esc(STUDIO_NAMES[s2] || s2)}</option>`).join('')}</select></label></div>
    <div class="don-two"><label>Contact name<input id="dn-cname" value="${escAttr(d.contact_name || '')}"></label><label>Contact email<input id="dn-cemail" type="email" value="${escAttr(d.contact_email || '')}"></label></div>
    <div class="don-two"><label>Contact phone<input id="dn-cphone" value="${escAttr(d.contact_phone || '')}"></label><label>Value ($, optional)<input id="dn-value" type="number" step="0.01" min="0" value="${escAttr(d.value != null ? d.value : '')}"></label></div>
    <label>Codes given (one per line)<textarea id="dn-codes" rows="3" placeholder="Paste codes, or make new ones below">${esc((d.codes || []).join('\n'))}</textarea></label>
    <details class="don-make"><summary>🎟️ Make new prize codes for this</summary>
      <label>What it’s for<select id="dn-mk-type" onchange="donTypeChange()">${DON_TYPES.map(t => `<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select></label>
      <div class="don-two"><label>How many codes<input id="dn-mk-n" type="number" min="1" max="200" value="1"></label>
        <label id="dn-mk-spots-l">Free spots each<input id="dn-mk-spots" type="number" min="1" max="20" value="2"></label>
        <label id="dn-mk-amt-l" hidden>Amount ($)<input id="dn-mk-amt" type="number" min="1" step="0.01" placeholder="e.g. 25"></label>
        <span id="dn-mk-pty" class="goal-note" hidden>The base price is free; extras are still paid.</span></div>
      <label>Works at<select id="dn-mk-where"><option value="all">All studios</option><option value="studio">Only the studio above</option></select></label>
      <div class="don-two"><label>Works from (optional)<input id="dn-mk-start" type="date"></label><label>Works until (optional)<input id="dn-mk-exp" type="date"></label></div>
      <label>Start each code with (optional)<input id="dn-mk-pre" maxlength="20" placeholder="e.g. FREE2" style="text-transform:uppercase"></label>
      <button class="ho-btn" onclick="donMakeCodes()">Make codes and add them</button> <span class="goal-note" id="dn-mk-msg"></span></details>
    <label>Notes<textarea id="dn-notes" rows="2">${esc(d.notes || '')}</textarea></label>
    <div id="dn-msg" class="goal-note"></div></div>
    <div class="sheet-actions">${id ? `<button class="danger" onclick="donDelete('${escAttr(id)}')">Delete</button><span style="flex:1"></span>` : ''}<button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="donSave('${escAttr(id || '')}')">Save</button></div>`);
}
const DON_TYPES = [['workshop2', 'Workshop for 2 (a workshop or Mini Make)', true], ['minimake2', 'Mini Make for 2', true], ['glazing2', 'Glazing for 2', true],
  ['kids_party', 'Kids party (the base price)', false], ['get_together', 'Adult get-together (the base price)', false], ['amount', '$ amount off a booking', false]];
function donTypeChange() {
  const t = document.getElementById('dn-mk-type').value, sp = DON_TYPES.some(x => x[0] === t && x[2]);
  document.getElementById('dn-mk-spots-l').hidden = !sp; document.getElementById('dn-mk-amt-l').hidden = t !== 'amount';
  document.getElementById('dn-mk-pty').hidden = !(t === 'kids_party' || t === 'get_together');
}
async function donMakeCodes() {
  const v = id => document.getElementById(id).value, msg = document.getElementById('dn-mk-msg'), studio = v('dn-studio');
  if (v('dn-mk-where') === 'studio' && !studio) { msg.textContent = 'Choose the studio above first (or “All studios”).'; return; }
  msg.textContent = 'Making…';
  const note = [v('dn-recipient'), v('dn-event')].filter(Boolean).join(' · ') || 'Donation';
  const { data, error } = await sb.rpc('world_prize_codes_generate', { p_count: +v('dn-mk-n') || 1, p_prefix: v('dn-mk-pre'),
    p: { type: v('dn-mk-type'), spots: v('dn-mk-spots'), amount: v('dn-mk-amt'), studios: v('dn-mk-where') === 'studio' ? [studio] : [], starts_on: v('dn-mk-start'), expires_on: v('dn-mk-exp'), note } });
  if (error) { msg.textContent = /world_prize_codes_generate/i.test(error.message) ? 'Run world_prize_codes.sql in Supabase first.' : error.message; return; }
  const ta = document.getElementById('dn-codes'); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + (data || []).join('\n');
  msg.textContent = `✓ ${(data || []).length} made and added above. Save to keep this entry.`;
}
async function donSave(id) {
  const v = k => document.getElementById(k).value, msg = document.getElementById('dn-msg');
  const { error } = await sb.rpc('hub_donation_save', { p: { id: id || '', kind: v('dn-kind'), recipient: v('dn-recipient'), event: v('dn-event'), given_on: v('dn-date'), studio_id: v('dn-studio'),
    contact_name: v('dn-cname'), contact_email: v('dn-cemail'), contact_phone: v('dn-cphone'), value: v('dn-value'), notes: v('dn-notes'),
    codes: v('dn-codes').split(/[\n,;\t ]+/).map(x => x.trim()).filter(Boolean) } });
  if (error) { msg.innerHTML = `<span style="color:#b91c1c">${esc(error.message)}</span>`; return; }
  closeDutySheet(); _don.rows = null; donDraw(); donLoad();
}
async function donDelete(id) {
  if (!confirm('Delete this entry? Its codes stay as they are (turn them off in World settings if needed).')) return;
  const { error } = await sb.rpc('hub_donation_delete', { p_id: id }); if (error) { alert(error.message); return; }
  closeDutySheet(); _don.rows = null; donDraw(); donLoad();
}

// ---------- Home office → 🎉 Party balances (Nov 12 2026; hub_party_balances) ----------
// Every party (kids, splatter, get-togethers, field trips, buyouts) in a date range: what was paid before tax, whether the
// after-party form is filled in (actual guests), and what's owing from it. "Open" goes to the party on the Schedule (wsmGoTime).
if (typeof PANES !== 'undefined' && PANES.indexOf('pb-pane') < 0) PANES.push('pb-pane');
let _pb = { from: '', to: '', studio: '', show: 'attention', kind: '', q: '', rows: null, err: '' };
const PB_KIND = { kids: 'Kids party', splatter: 'Splatter party', get_together: 'Get-together', field_trip: 'Field trip', buyout: 'Studio buyout' };
const PB_ST = { paid: '✓ Paid', all_good: '✓ All good', credit_sent: '🎁 Gift card sent', invoice_later: '📋 Sent to the field trip tracker', link_sent: '✉️ Pay link sent', waived: '✓ Let go' };
const PB_DONE = { paid: 1, all_good: 1, credit_sent: 1, invoice_later: 1, waived: 1 };
// (Nov 13 2026) after-party forms started in November: an earlier party without one is never "form not filled in"
const PB_FORMS_FROM = '2026-11-01';   // (a pay link sent is still owing until it's paid)
async function openPbPane() {
  await hoAreaLoad('parties_events'); if (!hoA('parties_events', 'view')) { alert('Party balances need “Parties & events” on the Access page.'); return; }
  showOnlyPane('pb-pane'); setActiveNav('nav-pb');
  if (!_pb.from) { const d = new Date(); d.setDate(d.getDate() - 30); _pb.from = localDateStr(d); const e = new Date(); e.setDate(e.getDate() + 30); _pb.to = localDateStr(e); }
  pbLoad();
}
async function pbLoad() {
  _pb.rows = null; pbDraw();
  const { data, error } = await sb.rpc('hub_party_balances', { p_from: _pb.from, p_to: _pb.to, p_studio: _pb.studio || null });
  _pb.err = error ? error.message : ''; _pb.rows = error ? [] : (data || []); pbDraw();
}
// a party's state: upcoming, form missing (after the party), owing, settled, or filled in with nothing owing
function pbState(r, t) {
  if (r.date > t) return 'upcoming';
  if (r.kind === 'buyout') return 'buyout';
  if (!r.filled) return r.date < PB_FORMS_FROM ? 'before' : 'missing';
  if (r.status && PB_DONE[r.status]) return 'settled';
  if (r.owing != null && Number(r.owing) > 0.004) return 'owing';
  return 'ok';
}
function pbDraw() {
  const el = document.getElementById('pb-pane'); if (!el) return;
  const t = localDateStr(new Date()), R = _pb.rows || [], m = x => '$' + Number(x || 0).toFixed(2);
  const cnt = k => R.filter(r => pbState(r, t) === k).length;
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🎉 Party balances</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <p class="ho-intro">Every party, past and upcoming: what was paid (before tax), whether the after-party form is filled in, and what’s owing from it. Open one to see or finish its form on the Schedule.</p>
    <div class="sup-tools">
      <label>From <input type="date" value="${escAttr(_pb.from)}" onchange="_pb.from=this.value;pbLoad()"></label>
      <label>To <input type="date" value="${escAttr(_pb.to)}" onchange="_pb.to=this.value;pbLoad()"></label>
      <select onchange="_pb.studio=this.value;pbLoad()"><option value="">All studios</option>${Object.keys(STUDIO_NAMES).sort((a, b) => STUDIO_NAMES[a].localeCompare(STUDIO_NAMES[b])).map(id => `<option value="${escAttr(id)}"${_pb.studio === id ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('')}</select>
      <select onchange="_pb.kind=this.value;pbDraw()"><option value="">Every kind</option>${Object.keys(PB_KIND).map(k => `<option value="${k}"${_pb.kind === k ? ' selected' : ''}>${PB_KIND[k]}</option>`).join('')}</select>
      <input type="search" placeholder="Search name, email, order" value="${escAttr(_pb.q)}" oninput="_pb.q=this.value;pbDraw()"></div>`;
  if (_pb.err) { el.innerHTML = h + `<p class="fd-msg">${esc(_pb.err)}</p>`; return; }
  if (!_pb.rows) { el.innerHTML = h + '<p class="goal-note">Loading…</p>'; return; }
  const tabs = [['attention', `Needs attention (${cnt('missing') + cnt('owing')})`], ['missing', `⚠️ Form not filled in (${cnt('missing')})`], ['owing', `💲 Owing (${cnt('owing')})`],
    ['settled', `✓ Settled (${cnt('settled') + cnt('ok')})`], ['upcoming', `Upcoming (${cnt('upcoming')})`], ['all', `All (${R.length})`]];
  h += `<div class="sn-quick" style="margin:6px 0 10px">${tabs.map(([k, l]) => `<button class="ho-btn sm${_pb.show === k ? ' primary' : ''}" onclick="_pb.show='${k}';pbDraw()">${l}</button>`).join('')}</div>`;
  const q = _pb.q.trim().toLowerCase();
  const rows = R.filter(r => { const st = pbState(r, t);
      return (_pb.show === 'all' || (_pb.show === 'attention' ? (st === 'missing' || st === 'owing') : _pb.show === 'settled' ? (st === 'settled' || st === 'ok') : st === _pb.show))
        && (!_pb.kind || r.kind === _pb.kind) && (!q || [r.customer, r.email, r.order, r.reason].join(' ').toLowerCase().includes(q)); })
    .sort((a, b) => _pb.show === 'upcoming' ? (a.date < b.date ? -1 : 1) : (a.date < b.date ? 1 : -1));
  if (!rows.length) { el.innerHTML = h + '<p class="goal-note">Nothing here for these dates.</p>'; return; }
  const total = rows.reduce((s, r) => s + (pbState(r, t) === 'owing' ? Number(r.owing || 0) : 0), 0);
  h += `<table class="fd-tbl sup-tbl"><thead><tr><th>Party</th><th>When</th><th>Paid (before tax)</th><th>After-party form</th><th>Owing</th><th></th></tr></thead><tbody>${rows.map(r => {
    const st = pbState(r, t), g = r.filled ? `${r.actual_guests} guests` : '';
    const form = st === 'upcoming' ? '<span class="goal-note">not due yet</span>' : st === 'buyout' ? '<span class="goal-note">settled in Studio buyouts</span>' : st === 'before' ? '<span class="goal-note">before after-party forms</span>'
      : st === 'missing' ? '<b style="color:#b3261e">⚠️ Not filled in</b>' : `✓ Filled in · ${esc(g)}${r.status && PB_ST[r.status] ? ` · ${esc(PB_ST[r.status])}` : ''}`;
    const owe = st === 'owing' ? `<b>${m(r.owing)}</b>` : st === 'settled' || st === 'ok' ? '<span class="goal-note">–</span>' : st === 'missing' ? '<span class="goal-note">?</span>' : '';
    return `<tr><td><b>${esc(PB_KIND[r.kind] || 'Party')}</b>${r.reason ? ' · ' + esc(r.reason) : ''}<br><span class="goal-note">${esc(r.customer || '')}${r.order ? ' · ' + esc(r.order) : ''} · ${esc(String(STUDIO_NAMES[r.studio_id] || r.studio_id).replace(/^.*?\s-\s/, ''))}</span></td>
      <td style="white-space:nowrap">${esc(ptyDayLabel(r.date))}<br><span class="goal-note">${esc(shortTime(r.time))}</span></td>
      <td>${r.paid != null ? m(r.paid) : '<span class="goal-note">–</span>'}</td><td>${form}</td><td>${owe}</td>
      <td><button class="ho-btn sm" onclick="pbOpen('${escAttr(r.session_id)}','${escAttr(r.studio_id)}','${escAttr(r.date)}')">Open</button></td></tr>`; }).join('')}</tbody></table>`;
  if (total > 0) h += `<p class="goal-note" style="margin-top:8px">Owing in this list: <b>${m(total)}</b> before tax.</p>`;
  el.innerHTML = h;
}
function pbOpen(sessionId, studio, date) { wsmGoTime(sessionId, studio, date); }

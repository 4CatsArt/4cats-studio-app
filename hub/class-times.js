// hub/class-times.js: Home office → 📚 Class times (filters, bulk edit, holiday check, ⚡ Make Part 2, + Add class times, 📅 week view),
// ➕ Bulk add, and 🎟️ Adjust spots (opened from the Schedule). Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.

// ---------- Home office → 📚 Class times (admins: hub_class_times.sql) ----------
// World class timeslots across classes: filter by class, studio and dates; bulk edit spots, ages and on sale;
// change a timeslot's dates (its bookings move with it) and email the families.
let _ct = { f: { page: '', studio: '', from: '', to: '' }, rows: null, pages: null, sel: new Set(), err: '', cf: {}, sort: null };
async function openCtPane() {
  await hoAreaLoad('class_times'); if (!hoA('class_times', 'view')) { alert('Class times needs “Class times” on the Access page.'); return; }   // (Nov 11 2026: access.html)
  showOnlyPane('ct-pane'); setActiveNav('nav-ct');
  if (!_ct.f.from) { const d = new Date(); _ct.f.from = localDateStr(new Date(d.getFullYear(), d.getMonth(), 1)); const e = new Date(d); e.setDate(e.getDate() + 180); _ct.f.to = localDateStr(e); }
  sb.rpc('world_class_pages_list').then(r => { if (!r.error) _ct.pages = r.data || []; else if (!_ct.pages) _ct.pages = []; ctDraw(); });   // fresh each time (class settings may have changed)
  ctLoad();
}
async function ctLoad() {
  _ct.rows = null; ctDraw();
  const { data, error } = await sb.rpc('hub_class_slots_find', { p: _ct.f });
  _ct.err = error ? (/hub_class_slots_find/i.test(error.message) ? 'Run hub_class_times.sql in Supabase to switch this on.' : error.message) : '';
  _ct.rows = error ? [] : (data || []); _ct.sel = new Set([..._ct.sel].filter(id => _ct.rows.some(r => r.id === id))); ctDraw();
}
function ctDatesLine(ds) {
  const g = []; let last = null;
  (ds || []).forEach(d => { const dt = new Date(d + 'T12:00:00'), mo = dt.toLocaleDateString('en-CA', { month: 'short' }); if (!last || last.mo !== mo) { last = { mo, days: [] }; g.push(last); } last.days.push(dt.getDate()); });
  return g.map(x => x.mo + ' ' + x.days.join(', ')).join(' · ');
}
function ctDraw() {
  const el = document.getElementById('ct-pane'); if (!el) return;
  const F = _ct.f, R = _ct.rows, studios = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b)), n = _ct.sel.size;
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📚 Class times</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Kids class timeslots sold on World, across all classes. Class pages (pictures, prices, blocks) stay in World settings → Kids classes.</div>
    <div class="ct-modes"><button class="ho-btn ${_ct.mode !== 'week' ? 'primary' : ''}" onclick="_ct.mode='list';ctDraw()">☰ List</button><button class="ho-btn ${_ct.mode === 'week' ? 'primary' : ''}" onclick="ctWeekOpen()">📅 Week view</button>
      ${hoA('class_times', 'edit') ? '<button class="ho-btn" onclick="ctAddOpen()">+ Add class times</button>' : ''}
      ${hoA('class_times', 'edit') && ctPart2Pages().length ? `<button class="ho-btn primary" onclick="ctPart2Pick()">⚡ Make Part 2…</button>` : ''}</div>
    ${hoA('class_times', 'edit') && !ctPart2Pages().length ? '<div class="goal-note" style="margin:-2px 0 8px">Part 2 classes (e.g. Ringgold after Hokusai) get a “Make Part 2” button here once “This class is Part 2 of…” is set in World settings.</div>' : ''}
    ${_ct.mode === 'week' ? ctWeekHtml() : ''}
    <div class="act-filters"><select id="ct-page" onchange="ctFilter()"><option value="">All classes</option>${(_ct.pages || []).map(c => `<option value="${escAttr(c.id)}"${c.id === F.page ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="ct-studio" onchange="ctFilter()"><option value="">All studios</option>${studios.map(x => `<option value="${escAttr(x)}"${x === F.studio ? ' selected' : ''}>${esc(STUDIO_NAMES[x] || x)}</option>`).join('')}</select>
      <label>Starting from <input type="date" id="ct-from" value="${escAttr(F.from)}" onchange="ctFilter()"></label><label>to <input type="date" id="ct-to" value="${escAttr(F.to)}" onchange="ctFilter()"></label></div>
    ${_ct.err ? `<div class="goal-note" style="color:#b91c1c">${esc(_ct.err)}</div>` : ''}
    ${hoA('class_times', 'edit') && n ? `<div class="ct-bulk"><b>${n} selected</b>
      <span>Spots <input type="number" id="ct-b-spots" min="1" max="200" style="width:70px"> <button class="ho-btn sm" onclick="ctBulk('spots')">Set</button></span>
      <span>Ages <input type="number" id="ct-b-min" min="2" max="99" style="width:56px">–<input type="number" id="ct-b-max" min="2" max="99" style="width:56px"> <button class="ho-btn sm" onclick="ctBulk('ages')">Set</button></span>
      <span>Time <input type="time" id="ct-b-time" step="300" style="width:120px"> <button class="ho-btn sm" onclick="ctBulk('time')">Set</button></span>
      <button class="ho-btn sm" onclick="ctBulk('on')">On sale</button><button class="ho-btn sm" onclick="ctBulk('off')">Off sale</button>
      <button class="ho-btn sm ct-del" onclick="ctDelete([..._ct.sel])">Delete</button>
      <button class="ho-btn sm" onclick="_ct.sel.clear();ctDraw()">Clear</button><span class="goal-note" id="ct-b-msg"></span></div>` : ''}
    ${_ct.mode === 'week' ? '' : R === null ? '<div class="goal-note">Loading…</div>' : !R.length ? '<div class="ho-intro">No timeslots match.</div>' : `<div class="goal-note" style="margin:4px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="ct-count">${ctShown().length === R.length ? R.length + ' timeslot' + (R.length === 1 ? '' : 's') : ctShown().length + ' of ' + R.length + ' timeslots'}</span><span id="ct-selall">${ctSelAllHtml()}</span></div>
    <div class="oc-wrap"><table class="oc-table ct-table"><thead><tr><th><input type="checkbox" ${ctShown().length && ctShown().every(r => _ct.sel.has(r.id)) ? 'checked' : ''} onchange="ctAll(this.checked)" aria-label="Select all shown"></th>${ctTh('class', 'Class')}${ctTh('studio', 'Studio')}${ctTh('day', 'Day and time')}${ctTh('dates', 'Dates')}${ctTh('ages', 'Ages')}${ctTh('spots', 'Spots')}${ctTh('booked', 'Booked')}${ctTh('sale', 'On sale')}<th></th></tr>
      <tr class="ct-filter"><th></th>
        <th><input type="search" placeholder="Class…" value="${escAttr(_ct.cf.cls || '')}" oninput="_ct.cf.cls=this.value;ctRedrawRows()"><select onchange="_ct.cf.kind=this.value;ctRedrawRows()"><option value="">All</option>${[['family', '👨‍👧 Family only'], ['notfamily', 'Not family'], ['p1', 'Part 1'], ['p2', 'Part 2']].map(o => `<option value="${o[0]}"${_ct.cf.kind === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></th>
        <th><input type="search" placeholder="Studio…" value="${escAttr(_ct.cf.studio || '')}" oninput="_ct.cf.studio=this.value;ctRedrawRows()"></th>
        <th><select onchange="_ct.cf.day=this.value;ctRedrawRows()"><option value="">Any day</option>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<option${_ct.cf.day === d ? ' selected' : ''}>${d}</option>`).join('')}</select><input type="search" placeholder="Time…" value="${escAttr(_ct.cf.time || '')}" oninput="_ct.cf.time=this.value;ctRedrawRows()"></th>
        <th><input type="search" placeholder="Month or date…" value="${escAttr(_ct.cf.dates || '')}" oninput="_ct.cf.dates=this.value;ctRedrawRows()"></th>
        <th><input type="search" placeholder="e.g. 6–10" value="${escAttr(_ct.cf.ages || '')}" oninput="_ct.cf.ages=this.value;ctRedrawRows()"></th>
        <th></th>
        <th><select onchange="_ct.cf.booked=this.value;ctRedrawRows()"><option value="">All</option><option value="yes"${_ct.cf.booked === 'yes' ? ' selected' : ''}>Has bookings</option><option value="no"${_ct.cf.booked === 'no' ? ' selected' : ''}>Empty</option></select></th>
        <th><select onchange="_ct.cf.sale=this.value;ctRedrawRows()"><option value="">All</option><option value="on"${_ct.cf.sale === 'on' ? ' selected' : ''}>On</option><option value="off"${_ct.cf.sale === 'off' ? ' selected' : ''}>Off</option></select></th><th></th></tr></thead><tbody id="ct-tbody">${ctRowsHtml()}</tbody></table></div>`}`;
}
function ctRowsHtml() {
  const L = ctShown();
  if (!L.length) return '<tr><td colspan="10" class="goal-note" style="padding:12px">No timeslots match these filters.</td></tr>';
  return L.map(r => {
      const wd = new Date(String(r.start_date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' });
      return `<tr class="${r.active ? '' : 'ct-off'}"><td><input type="checkbox" ${_ct.sel.has(r.id) ? 'checked' : ''} onchange="ctPick('${escAttr(r.id)}', this.checked)"></td>
        <td><b>${esc(r.class_name)}</b>${r.family ? ' <span class="ct-fam">👨‍👧 Family</span>' : ''}${r.part_label ? `<br><small>${esc(r.part_label)}</small>` : ''}${r.follows_slot ? '<br><small class="goal-note">Part 2</small>' : ''}</td>
        <td>${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)}</td><td>${esc(wd)} ${esc(shortTime(r.start_time))}<br><small>${r.minutes} min · ${r.weeks} weeks</small></td>
        <td><small>${esc(ctDatesLine(r.dates))}</small>${(r.skip_dates || []).length ? `<br><small class="goal-note">no class ${esc(r.skip_dates.map(d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })).join(', '))}</small>` : ''}</td>
        <td>${r.min_age ?? ''}–${r.max_age ?? ''}</td><td>${r.spots}</td><td>${r.booked}</td><td>${r.active ? '✓' : '—'}</td>
        <td style="white-space:nowrap">${hoA('class_times', 'edit') ? `<button class="ho-btn sm" onclick="ctRedate('${escAttr(r.id)}')" title="Change the first date, time, weeks or skipped dates">Edit</button>
          <button class="ho-btn sm ct-del" onclick="ctDelete(['${escAttr(r.id)}'])"${r.booked ? ' disabled title="Families are booked: use Off sale instead"' : ''}>Delete</button>` : ''}</td></tr>`; }).join('');
}
// The list's column filters and sorting (in the page, on what's loaded)
const CT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function ctDayOf(r) { return CT_DAYS[new Date(String(r.start_date).slice(0, 10) + 'T12:00:00').getDay()]; }
function ctShown() {
  const F = _ct.cf || {}, low = v => String(v || '').toLowerCase(), has = (hay, q) => !q || low(hay).includes(low(q).trim());
  let L = (_ct.rows || []).filter(r => has(r.class_name + ' ' + (r.part_label || ''), F.cls) && has(STUDIO_NAMES[r.studio_id] || r.studio_id, F.studio) &&
    (!F.day || ctDayOf(r) === F.day) && has(shortTime(r.start_time), F.time) && has(ctDatesLine(r.dates) + ' ' + String(r.start_date).slice(0, 10), F.dates) &&
    (!F.ages || has(`${r.min_age ?? ''}-${r.max_age ?? ''} ${r.min_age ?? ''}–${r.max_age ?? ''}`, F.ages)) &&
    (!F.booked || (F.booked === 'yes' ? r.booked > 0 : !r.booked)) && (!F.sale || (F.sale === 'on' ? r.active : !r.active)) &&
    (!F.kind || (F.kind === 'family' ? r.family : F.kind === 'notfamily' ? !r.family : F.kind === 'p2' ? !!r.follows_slot || /2/.test(r.part_label || '') : !r.follows_slot && !/2/.test(r.part_label || ''))));
  const S = _ct.sort; if (!S) return L;
  const key = { class: r => low(r.class_name + ' ' + (r.part_label || '')), studio: r => low(STUDIO_NAMES[r.studio_id] || r.studio_id),
    day: r => ((new Date(String(r.start_date).slice(0, 10) + 'T12:00:00').getDay() + 6) % 7) * 10000 + +String(r.start_time).slice(0, 5).replace(':', ''),
    dates: r => String(r.start_date).slice(0, 10), ages: r => (r.min_age ?? 0) * 1000 + (r.max_age ?? 0), spots: r => r.spots || 0, booked: r => r.booked || 0, sale: r => r.active ? 1 : 0 }[S.key];
  return L.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (S.dir === 'desc' ? -1 : 1); });
}
function ctTh(k, label) { const S = _ct.sort || {}; return `<th class="ct-sortable" onclick="ctSort('${k}')">${label}${S.key === k ? (S.dir === 'desc' ? ' ▼' : ' ▲') : ''}</th>`; }
function ctSort(k) { const S = _ct.sort; _ct.sort = S && S.key === k ? (S.dir === 'asc' ? { key: k, dir: 'desc' } : null) : { key: k, dir: 'asc' }; ctDraw(); }
function ctRedrawRows() { const tb = document.getElementById('ct-tbody'); if (tb) tb.innerHTML = ctRowsHtml(); const n = document.getElementById('ct-count'); if (n) n.textContent = ctShown().length + ' of ' + (_ct.rows || []).length + ' timeslots';
  const sa = document.getElementById('ct-selall'); if (sa) sa.innerHTML = ctSelAllHtml(); }
// "Select all N shown": every timeslot the filters show (the same as the header checkbox), and Clear
function ctSelAllHtml() {
  if (!hoA('class_times', 'edit')) return '';
  const L = ctShown(), all = L.length && L.every(r => _ct.sel.has(r.id));
  return (L.length && !all ? `<button class="ho-btn sm" onclick="ctAll(true)">Select all ${L.length} shown</button>` : '') + (_ct.sel.size ? `<button class="ho-btn sm" onclick="ctAll(false)">Clear selection</button>` : '');
}
function ctFilter() { const v = id => (document.getElementById(id) || {}).value || ''; _ct.f = { page: v('ct-page'), studio: v('ct-studio'), from: v('ct-from'), to: v('ct-to') }; ctLoad(); }
function ctPick(id, on) { if (on) _ct.sel.add(id); else _ct.sel.delete(id); ctDraw(); }
function ctAll(on) { _ct.sel = new Set(on ? ctShown().map(r => r.id) : []); ctDraw(); }   // (just the rows shown)
// Delete timeslots (and their classes); ones with families booked are kept (hide them with Off sale instead)
async function ctDelete(ids) {
  const rows = (_ct.rows || []).filter(r => ids.includes(r.id)), booked = rows.filter(r => r.booked), free = rows.filter(r => !r.booked);
  if (!free.length) { alert('Families are booked in ' + (booked.length === 1 ? 'that timeslot' : 'those timeslots') + ', so ' + (booked.length === 1 ? 'it' : 'they') + ' can\u2019t be deleted. Use Off sale to hide ' + (booked.length === 1 ? 'it' : 'them') + ' instead.'); return; }
  const list = free.map(r => `• ${r.class_name} · ${STUDIO_NAMES[r.studio_id] || r.studio_id} · ${new Date(String(r.start_date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })} ${shortTime(r.start_time)}`).join('\n');
  if (!confirm(`Delete ${free.length} timeslot${free.length === 1 ? '' : 's'} and all ${free.length === 1 ? 'its' : 'their'} classes? This can\u2019t be undone.\n\n${list}` + (booked.length ? `\n\n(${booked.length} with families booked will be kept.)` : ''))) return;
  let ok = 0; const errs = [];
  for (const r of free) { const res = await sb.rpc('world_class_slot_remove', { p_slot: r.id }); if (res.error) errs.push(`${r.class_name} ${r.start_date}: ${res.error.message}`); else { ok++; _ct.sel.delete(r.id); } }
  if (errs.length) alert(`${ok} deleted. Not deleted:\n` + errs.join('\n'));
  ctLoad(); if (_ct.mode === 'week') ctWeekLoad();
}
async function ctBulk(what) {
  const ids = [..._ct.sel], rows = (_ct.rows || []).filter(r => _ct.sel.has(r.id)), msg = document.getElementById('ct-b-msg');
  const spots = +(document.getElementById('ct-b-spots') || {}).value || 0, mn = (document.getElementById('ct-b-min') || {}).value, mx = (document.getElementById('ct-b-max') || {}).value;
  if (what === 'spots' && !spots) { msg.textContent = 'Type the number of spots.'; return; }
  if (what === 'ages' && (mn === '' || mx === '' || +mn > +mx)) { msg.textContent = 'Type the ages (from – to).'; return; }
  // Time: each class time and all its weeks' classes move to the new time (same dates, weeks and skipped dates)
  const tm = ((document.getElementById('ct-b-time') || {}).value || '').slice(0, 5);
  if (what === 'time') {
    if (!/^\d{2}:\d{2}$/.test(tm)) { msg.textContent = 'Choose the new time.'; return; }
    const bookedRows = rows.filter(r => Number(r.booked || 0) > 0), label = shortTime(tm + ':00');
    if (!confirm(`Move ${rows.length} class time${rows.length === 1 ? '' : 's'} to ${label}? Every week of each class moves too.` +
      (bookedRows.length ? `\n\n${bookedRows.length} of them have families booked (${bookedRows.reduce((a, r) => a + Number(r.booked || 0), 0)} spots). Their bookings move with the class, so let those families know about the new time.` : ''))) return;
  }
  let ok = 0; const errs = [];
  for (const r of rows) {
    msg.textContent = `Saving ${ok + errs.length + 1} of ${rows.length}…`;
    const res = what === 'time' ? await sb.rpc('hub_class_slot_redate', { p_slot: r.id, p_start: String(r.start_date).slice(0, 10), p_time: tm + ':00', p_weeks: r.weeks, p_skip: r.skip_dates || [], p_preview: false })
      : what === 'ages' ? await sb.rpc('world_class_slot_ages', { p_slot: r.id, p_min: +mn, p_max: +mx })
      : await sb.rpc('world_class_slot_update', { p_slot: r.id, p_spots: what === 'spots' ? spots : r.spots, p_active: what === 'on' ? true : what === 'off' ? false : r.active });
    if (res.error) errs.push(`${r.class_name} · ${STUDIO_NAMES[r.studio_id] || r.studio_id}: ${res.error.message}`); else ok++;
  }
  if (errs.length) alert(`${ok} changed. Not changed:\n` + errs.join('\n'));
  ctLoad();
}
// ---- Holidays, long weekends, the Christmas break and camp days (the same check as World settings) ----
function nthWeekday(y, m, wd, n) { var d = new Date(Date.UTC(y, m, 1)); var add = (wd - d.getUTCDay() + 7) % 7 + (n - 1) * 7; d.setUTCDate(1 + add); return d.toISOString().slice(0, 10); }
function mondayBefore(y, m, day) { var d = new Date(Date.UTC(y, m, day)); d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function easter(y) { var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
  i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da)); }
function isoAddD(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function holidaysFor(prov, y) {
  var e = easter(y), gf = new Date(e); gf.setUTCDate(gf.getUTCDate() - 2);
  var L = [[y + '-01-01', 'New Year\u2019s Day'], [nthWeekday(y, 1, 1, 3), 'Family Day'], [gf.toISOString().slice(0, 10), 'Good Friday'], [mondayBefore(y, 4, 25), 'Victoria Day'],
    [y + '-07-01', 'Canada Day'], [nthWeekday(y, 7, 1, 1), prov === 'BC' ? 'BC Day' : prov === 'AB' ? 'Heritage Day' : 'Civic Holiday'], [nthWeekday(y, 8, 1, 1), 'Labour Day'],
    [nthWeekday(y, 9, 1, 2), 'Thanksgiving'], [y + '-12-25', 'Christmas Day']];
  if (prov === 'BC') L.push([y + '-09-30', 'Truth and Reconciliation Day']);
  if (prov === 'BC' || prov === 'AB') L.push([y + '-11-11', 'Remembrance Day']);
  if (prov === 'ON') L.push([y + '-12-26', 'Boxing Day']);
  return L;
}
// Each date's reason, if it's a holiday, a long-weekend Saturday/Sunday, the Christmas break, or a camp day (camps: { date: title })
function classDateWarnings(dates, studio, camps) {
  // holidays, long weekends and the Christmas break: flagged, not skipped unless ticked;
  // spring camp (March Break): flagged and skipped unless unticked; PA/PD days and other camps: classes run as normal
  var prov = String(studio || '').slice(0, 2), H = {};
  var years = {}; dates.forEach(function (d) { years[d.slice(0, 4)] = 1; years[+d.slice(0, 4) - 1] = 1; });
  Object.keys(years).forEach(function (y) { holidaysFor(prov, +y).forEach(function (h) {
    H[h[0]] = h[1];
    var wd = new Date(h[0] + 'T12:00:00Z').getUTCDay();
    if (wd === 1) { H[isoAddD(h[0], -1)] = H[isoAddD(h[0], -1)] || h[1] + ' long weekend'; H[isoAddD(h[0], -2)] = H[isoAddD(h[0], -2)] || h[1] + ' long weekend'; }
    if (wd === 5) { H[isoAddD(h[0], 1)] = H[isoAddD(h[0], 1)] || h[1] + ' long weekend'; H[isoAddD(h[0], 2)] = H[isoAddD(h[0], 2)] || h[1] + ' long weekend'; }
  }); });
  var out = [];
  dates.forEach(function (d) {
    var md = d.slice(5), why = H[d] || (md >= '12-24' || md === '01-01' ? 'Christmas break' : ''), skip = false;
    if (camps && camps[d]) { why = (why ? why + ' \u00b7 ' : '') + 'spring camp: ' + camps[d]; skip = true; }
    if (why) out.push({ date: d, why: why, skip: skip });
  });
  return out;
}
// Camp and PA/PD days at a studio on these dates (from the sessions)
var csCampCache = {};
async function campDaysAt(studio, dates) {
  var key = studio + ':' + dates.join(','); if (csCampCache[key]) return csCampCache[key];
  var m = {};
  if (studio && dates.length) {
    var r = await sb.from('sessions').select('session_date, title').eq('studio_id', studio).in('session_date', dates).or('title.ilike.%spring%camp%,title.ilike.%march%break%');   // (only spring camp / March Break skips classes)
    (r.data || []).forEach(function (x) { if (!m[x.session_date]) m[x.session_date] = String(x.title).split('|')[0].trim(); });
  }
  return (csCampCache[key] = m);
}
// Special days (not stats) by province, for the week view's day headers
function specialDaysFor(prov, y) {
  const e = easter(y), es = e.toISOString().slice(0, 10), sunN = (m, n) => nthWeekday(y, m, 0, n);
  const L = [[y + '-02-14', '💝 Valentine’s Day'], [y + '-03-17', '☘️ St. Patrick’s Day'], [es, '🐣 Easter Sunday'], [sunN(4, 2), '💐 Mother’s Day'], [sunN(5, 3), '👔 Father’s Day'],
    [y + '-10-31', '🎃 Halloween'], [y + '-12-24', '🎄 Christmas Eve'], [y + '-12-31', '🎉 New Year’s Eve']];
  if (prov === 'ON') L.push([y + '-11-11', '🌺 Remembrance Day']);
  if (prov === 'BC' || prov === 'AB') L.push([y + '-12-26', '🎁 Boxing Day']);
  return L;
}
function ctSlotDates(start, weeks, skip) { const out = []; const d = new Date(start + 'T12:00:00'); let g = 0; while (out.length < weeks && g < 60) { const iso = localDateStr(d); if (!skip.includes(iso)) out.push(iso); d.setDate(d.getDate() + 7); g++; } return out; }
// ---- ⚡ Make Part 2: for a class that's Part 2 of another (e.g. Ringgold after Hokusai), one timeslot per Part 1 timeslot,
// starting the week after it ends (same studio, time, length, weeks, spots), linked so families can book both ----
// the class chosen: in the week view its "Class to add", else the class filter
function ctChosenPageId() { return _ct.mode === 'week' ? (_ctw.page || _ct.f.page) : _ct.f.page; }
function ctPart2Pages() {   // Part 2 classes to offer: the chosen class's (if it's a Part 1 or a Part 2), else all of them
  const P = _ct.pages || [], id = ctChosenPageId(), pg = P.find(c => c.id === id);
  if (pg) return pg.part2_of || (pg.parts && pg.parts.labels) ? [pg] : P.filter(c => c.part2_of === pg.id);
  return P.filter(c => c.part2_of || (c.parts && c.parts.labels));
}
let _ctP2Id = null;
function ctPart2Page() { return (_ct.pages || []).find(c => c.id === _ctP2Id) || ctPart2Pages()[0] || null; }
function ctPart1Name(pg) { pg = pg || ctPart2Page(); if (pg && !pg.part2_of && pg.parts) return pg.name + ' ' + (pg.parts.labels[0] || 'Part 1'); const p1 = pg && (_ct.pages || []).find(c => c.id === pg.part2_of); return p1 ? p1.name : 'Part 1'; }
function ctPart2Name(pg) { return pg && !pg.part2_of && pg.parts ? pg.name + ' ' + (pg.parts.labels[1] || 'Part 2') : pg ? pg.name + ' (Part 2)' : 'Part 2'; }
// One button: choose which class's Part 2 to make (straight to the plan when there's only one)
function ctPart2Pick() {
  const L = ctPart2Pages();
  if (L.length === 1) { _ctP2Id = L[0].id; ctPart2Open(); return; }
  const lbl = pg => !pg.part2_of && pg.parts ? `${pg.name}: ${pg.parts.labels[1] || 'Part 2'} (after ${pg.parts.labels[0] || 'Part 1'})` : `${pg.name} (after ${ctPart1Name(pg)})`;
  openDutySheet(`<h3>⚡ Make Part 2</h3><p class="goal-note">Each Part 2 timeslot starts the week after its Part 1 ends (same studio, time, ages and spots), linked so families can book both.</p>
    <div class="me-form"><label>Which class?<select id="ctp2-pick">${L.map(pg => `<option value="${escAttr(pg.id)}">${esc(lbl(pg))}</option>`).join('')}</select></label></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="_ctP2Id=document.getElementById('ctp2-pick').value;ctPart2Open()">Continue</button></div>`);
}
async function ctPart2Open() {
  const pg = ctPart2Page(); if (!pg) return;
  openDutySheet(`<h3>Make ${esc(pg.name)} (Part 2)</h3><p class="goal-note">Finding ${esc(ctPart1Name())} timeslots…</p>`);
  let data, error;
  if (!pg.part2_of && pg.parts) {
    const r = await sb.rpc('hub_class_slots_find', { p: { page: pg.id, studio: '', from: '', to: '' } }); error = r.error;
    const L = r.data || [], followed = new Set(L.map(x => x.follows_slot).filter(Boolean)), p1 = pg.parts.labels[0], p2 = pg.parts.labels[1];
    data = L.filter(x => x.part_label !== p2 && !x.follows_slot).map(x => Object.assign({}, x, { taken: followed.has(x.id) }));
  } else ({ data, error } = await sb.rpc('world_class_part1_slots', { p_page: pg.id }));
  if (error) { openDutySheet(`<h3>Make ${esc(pg.name)} (Part 2)</h3><p class="goal-note" style="color:#b91c1c">${esc(error.message)}</p><div class="sheet-actions"><button onclick="closeDutySheet()">Close</button></div>`); return; }
  let todo = (data || []).filter(t => !t.taken);
  const onlyStudio = _ct.mode === 'week' ? _ctw.studio : _ct.f.studio;
  if (onlyStudio) todo = todo.filter(t => t.studio_id === onlyStudio);
  if (!todo.length) { openDutySheet(`<h3>Make ${esc(pg.name)} (Part 2)</h3><p>Every ${esc(ctPart1Name())} timeslot${onlyStudio ? ' at ' + esc(STUDIO_NAMES[onlyStudio] || onlyStudio) : ''} already has its Part 2.</p><div class="sheet-actions"><button onclick="closeDutySheet()">Close</button></div>`); return; }
  const f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const plan = [];
  for (const t of todo) {
    const last = (t.dates || []).slice(-1)[0] || t.start_date, nx = new Date(String(last).slice(0, 10) + 'T12:00:00'); nx.setDate(nx.getDate() + 7);
    const start = localDateStr(nx), weeks = pg.weeks || t.weeks, ds = ctSlotDates(start, weeks, []);
    plan.push({ t, start, weeks, ds, warn: classDateWarnings(ds, t.studio_id, await campDaysAt(t.studio_id, ds)),
      min: t.min_age != null ? t.min_age : pg.min_age, max: t.max_age != null ? t.max_age : pg.max_age });   // the same age group as the Part 1 time it follows
  }
  _ct.p2 = plan;
  openDutySheet(`<h3>Make ${esc(ctPart2Name(pg))}: ${plan.length} timeslot${plan.length === 1 ? '' : 's'}</h3>
    <p class="goal-note">Each starts the week after its ${esc(ctPart1Name())} timeslot ends: same studio, time, length and spots. Linked, so families can register for both.</p>
    <div class="cta-plan">${plan.map((x, i) => `<div class="cs-p2row"><b>${esc(STUDIO_NAMES[x.t.studio_id] || x.t.studio_id)}</b> · ${esc(f(x.start))} at ${esc(shortTime(x.t.start_time))} · ${x.weeks} weeks · ${x.t.spots} spots · ages ${x.min ?? '?'}–${x.max ?? '?'}
      <small class="goal-note">${esc(ctDatesLine(x.ds))}</small>${x.warn.map(w => `<label class="ba-check"><input type="checkbox" class="ctp2-skip" data-i="${i}" value="${w.date}"${w.skip ? ' checked' : ''}> Skip ${esc(f(w.date))} <span class="goal-note">(${esc(w.why)})</span></label>`).join('')}</div>`).join('')}</div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="ctp2-go" onclick="ctPart2Go()">Create all ${plan.length}</button></div>`);
}
async function ctPart2Go() {
  const pg = ctPart2Page(), b = document.getElementById('ctp2-go'); b.disabled = true;
  let made = 0; const errs = [];
  for (let i = 0; i < _ct.p2.length; i++) {
    const x = _ct.p2[i], skips = [...document.querySelectorAll(`.ctp2-skip[data-i="${i}"]:checked`)].map(c => c.value);
    b.textContent = `Making ${i + 1} of ${_ct.p2.length}…`;
    const r = await sb.rpc('world_class_slot_add', { p: { class_page_id: pg.id, studio_id: x.t.studio_id, start_date: x.start, start_time: String(x.t.start_time).slice(0, 5), minutes: pg.minutes || x.t.minutes,
      weeks: x.weeks, spots: x.t.spots, skip_dates: skips, min_age: x.min, max_age: x.max, part_label: !pg.part2_of && pg.parts ? (pg.parts.labels[1] || 'Part 2') : null, follows_slot: x.t.id } });
    if (r.error) errs.push(`${STUDIO_NAMES[x.t.studio_id] || x.t.studio_id} ${x.start}: ${r.error.message}`);
    else { made++; const fe = await ctSetFamily(r.data, !!x.t.family); if (fe) errs.push(`${STUDIO_NAMES[x.t.studio_id] || x.t.studio_id} ${x.start}: made, but not set as a family time (${fe})`); }
  }
  closeDutySheet(); ctLoad(); if (_ct.mode === 'week') ctWeekLoad();
  alert(`Made ${made} ${pg.name} timeslot${made === 1 ? '' : 's'}.` + (errs.length ? '\nNot made:\n' + errs.join('\n') : ''));
}
// A family time (world_class_family.sql): at least one adult and one child, up to 2 kids per adult; set right after the timeslot is made
async function ctSetFamily(slotId, on) { if (!on || !slotId) return null; const r = await sb.rpc('world_class_slot_family', { p_slot: slotId, p_family: true }); return r.error ? r.error.message : null; }
// ---- + Add class times: one class at several studios, days and times, with the holiday check ----
let _cta = null;
function ctAddOpen() {
  const pg = (_ct.pages || []).find(c => c.id === _ct.f.page) || {};
  const studios = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b)), DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
  _cta = { times: [] };
  openDutySheet(`<h3>+ Add class times</h3><div class="me-form">
    <label>Class<select id="cta-page" onchange="ctAddAges()"><option value="">Choose…</option>${(_ct.pages || []).map(c => `<option value="${escAttr(c.id)}"${c.id === pg.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <details open><summary><b>Studios</b> <span class="goal-note" id="cta-stsum">${_ct.f.studio ? '1 chosen' : 'none chosen'}</span></summary><div class="cta-studios">${studios.map(x => `<label><input type="checkbox" class="cta-st" value="${escAttr(x)}"${x === _ct.f.studio ? ' checked' : ''} onchange="ctAddSum()"> ${esc(STUDIO_NAMES[x] || x)}</label>`).join('')}</div></details>
    <div><b>Days</b> <span class="bk-days">${DAYS.map(([n, l]) => `<label><input type="checkbox" class="cta-day" value="${n}"> ${l}</label>`).join('')}</span></div>
    <div><b>Times</b> <span class="bk-chips" id="cta-times"></span> <input type="time" id="cta-time" step="900"> <button class="ho-btn sm" type="button" onclick="ctAddTime()">+ Add time</button></div>
    <div class="don-two"><label>First week (classes start on or after)<input type="date" id="cta-start" min="${localDateStr(new Date())}"></label><label>Weeks<input type="number" id="cta-weeks" min="1" max="20" value="5"></label></div>
    <div class="don-two"><label>Length (minutes)<input type="number" id="cta-min" min="30" max="300" step="15" value="90"></label><label>Spots<input type="number" id="cta-spots" min="1" max="200" value="15"></label></div>
    <div class="don-two"><label>Ages from<input type="number" id="cta-amin" min="2" max="99"></label><label>to<input type="number" id="cta-amax" min="2" max="99"></label></div>
    <label id="cta-partw" hidden>Part<select id="cta-part"></select></label>
    <label class="ba-check"><input type="checkbox" id="cta-family"> 👨‍👧 Family class: at least one adult (16+) and one child, max 2 kids per adult (everyone pays the class price; spots count people)</label>
    <button class="ho-btn" type="button" onclick="ctAddPreview()">Preview</button><div id="cta-out"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="cta-go" disabled onclick="ctAddGo()">Create all</button></div>`);
  ctAddAges();
}
function ctAddAges() {   // the class's own ages, number of classes and length
  const id = (document.getElementById('cta-page') || {}).value, pg = (_ct.pages || []).find(c => c.id === id) || {}, set = (k, v) => { if (v != null) document.getElementById(k).value = v; };
  set('cta-amin', pg.min_age); set('cta-amax', pg.max_age); set('cta-weeks', pg.weeks); set('cta-min', pg.minutes);
  // a class in parts: which part these times are (Part 2s usually come from ⚡ Make Part 2)
  const pw = document.getElementById('cta-partw'), ps = document.getElementById('cta-part'), L = pg.parts && pg.parts.labels;
  if (pw) { pw.hidden = !L; if (L) ps.innerHTML = L.map(l => `<option value="${escAttr(l)}">${esc(l)}</option>`).join(''); }
}
function ctAddSum() { const n = document.querySelectorAll('.cta-st:checked').length; document.getElementById('cta-stsum').textContent = n ? n + ' chosen' : 'none chosen'; }
function ctAddTime() { const v = document.getElementById('cta-time').value; if (v && !_cta.times.includes(v)) { _cta.times.push(v); _cta.times.sort(); }
  document.getElementById('cta-times').innerHTML = _cta.times.map((t, i) => `<span class="bk-chip">${esc(shortTime(t + ':00'))} <button type="button" onclick="_cta.times.splice(${i},1);ctAddTime()">×</button></span>`).join(''); }
async function ctAddPreview() {
  const v = id => document.getElementById(id).value, out = document.getElementById('cta-out');
  const page = v('cta-page'), studios = [...document.querySelectorAll('.cta-st:checked')].map(x => x.value), days = [...document.querySelectorAll('.cta-day:checked')].map(x => +x.value);
  const start = v('cta-start'), weeks = +v('cta-weeks') || 0;
  const miss = !page ? 'Choose the class.' : !studios.length ? 'Choose the studios.' : !days.length ? 'Choose the days.' : !_cta.times.length ? 'Add the times.' : !start ? 'Choose the first week.' : !weeks ? 'Weeks: 1 to 20.' : '';
  if (miss) { out.innerHTML = `<p class="goal-note" style="color:#b91c1c">${miss}</p>`; return; }
  out.innerHTML = '<p class="goal-note">Checking dates…</p>';
  const plan = [];
  for (const st of studios) for (const dw of days) for (const tm of _cta.times) {
    const d = new Date(start + 'T12:00:00'); while (((d.getDay() + 6) % 7) + 1 !== dw) d.setDate(d.getDate() + 1);   // the first of that weekday on/after the first week
    const first = localDateStr(d), ds = ctSlotDates(first, weeks, []);
    plan.push({ st, first, tm, warn: classDateWarnings(ds, st, await campDaysAt(st, ds)), ds });
  }
  _cta.plan = plan;
  const f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  out.innerHTML = `<p><b>${plan.length}</b> timeslot${plan.length === 1 ? '' : 's'} (${weeks} weeks each):</p><div class="cta-plan">${plan.map((x, i) =>
    `<div class="cs-p2row"><b>${esc(STUDIO_NAMES[x.st] || x.st)}</b> · ${esc(f(x.first))} at ${esc(shortTime(x.tm + ':00'))} <small class="goal-note">${esc(ctDatesLine(x.ds))}</small>${x.warn.map(w =>
      `<label class="ba-check"><input type="checkbox" class="cta-skip" data-i="${i}" value="${w.date}"${w.skip ? ' checked' : ''}> Skip ${esc(f(w.date))} <span class="goal-note">(${esc(w.why)})</span></label>`).join('')}</div>`).join('')}</div>`;
  document.getElementById('cta-go').disabled = false;
}
async function ctAddGo() {
  const v = id => document.getElementById(id).value, b = document.getElementById('cta-go'); b.disabled = true;
  let made = 0; const errs = [];
  for (let i = 0; i < _cta.plan.length; i++) {
    const x = _cta.plan[i], skips = [...document.querySelectorAll(`.cta-skip[data-i="${i}"]:checked`)].map(c => c.value);
    b.textContent = `Making ${i + 1} of ${_cta.plan.length}…`;
    const partW = document.getElementById('cta-partw');
    const r = await sb.rpc('world_class_slot_add', { p: { class_page_id: v('cta-page'), studio_id: x.st, start_date: x.first, start_time: x.tm, minutes: +v('cta-min') || 90, weeks: +v('cta-weeks'),
      spots: +v('cta-spots'), skip_dates: skips, min_age: v('cta-amin'), max_age: v('cta-amax'), part_label: partW && !partW.hidden ? v('cta-part') : null, follows_slot: null } });
    if (r.error) errs.push(`${STUDIO_NAMES[x.st] || x.st} ${x.first} ${x.tm}: ${r.error.message}`);
    else { made++; const fe = await ctSetFamily(r.data, document.getElementById('cta-family').checked); if (fe) errs.push(`${STUDIO_NAMES[x.st] || x.st} ${x.first}: made, but not set as a family time (${fe})`); }
  }
  closeDutySheet(); ctLoad();
  alert(`Made ${made} timeslot${made === 1 ? '' : 's'}.` + (errs.length ? '\nNot made:\n' + errs.join('\n') : ''));
}
// ---- 📅 Week view: a studio's week, Sunday to Saturday; click a free spot to place the chosen class ----
const CTW_START = 8 * 60, CTW_END = 21 * 60, CTW_ROW = 16;   // 8am–9pm, 15-minute rows, 16px each
let _ctw = { studio: '', page: '', week: '', sess: null, pending: [], startMon: (() => { try { return localStorage.getItem('hub.ctwStartMon') === '1'; } catch (e) { return false; } })() };
// the week's first day: Sunday or Monday (Week starts, by the date picker; remembered on this computer)
function ctWeekSunday(iso) { const d = new Date(iso + 'T12:00:00'), first = _ctw.startMon ? 1 : 0; d.setDate(d.getDate() - ((d.getDay() - first + 7) % 7)); return localDateStr(d); }
function ctWeekOpen() {
  _ct.mode = 'week';
  if (!_ctw.week) _ctw.week = ctWeekSunday(localDateStr(new Date()));
  if (!_ctw.studio) _ctw.studio = _ct.f.studio || _sessionStudioId || '';
  if (!_ctw.page) _ctw.page = _ct.f.page || '';
  ctDraw(); ctWeekLoad();
}
async function ctWeekLoad() {
  _ctw.sess = null; ctDraw();
  if (!_ctw.studio) return;
  const to = new Date(_ctw.week + 'T12:00:00'); to.setDate(to.getDate() + 6);
  const { data } = await sb.from('sessions').select('id, title, session_date, session_time, duration_minutes, world_class_slot_id, session_type, show, publish, capacity, spaces_left_cache, camp_program_id')
    .eq('studio_id', _ctw.studio).gte('session_date', _ctw.week).lte('session_date', localDateStr(to)).order('session_time');
  _ctw.sess = data || [];
  // who's actually booked in each session (not spots minus spots left: a day closed by setting spots left to 0 would look full)
  const ids = _ctw.sess.map(x => x.id), n = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data: bk } = await sb.from('bookings').select('session_id, qty').in('session_id', ids.slice(i, i + 150)).gt('qty', 0).is('returned_at', null);
    (bk || []).forEach(b => { n[b.session_id] = (n[b.session_id] || 0) + b.qty; });
  }
  _ctw.sess.forEach(x => { x.__booked = n[x.id] || 0; });
  ctDraw();
}
function ctWeekMove(n) { const d = new Date(_ctw.week + 'T12:00:00'); d.setDate(d.getDate() + 7 * n); _ctw.week = localDateStr(d); ctWeekLoad(); }
function ctWeekPage() { return (_ct.pages || []).find(c => c.id === _ctw.page) || null; }
function ctWeekHtml() {
  const studios = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b)), pg = ctWeekPage();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(_ctw.week + 'T12:00:00'); d.setDate(d.getDate() + i); return localDateStr(d); });
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const top = mins => (mins - CTW_START) / 15 * CTW_ROW, rows = (CTW_END - CTW_START) / 15;
  const wkLabel = new Date(_ctw.week + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' – ' + new Date(days[6] + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const pend = _ctw.pending.filter(x => x.studio === _ctw.studio);
  let h = `<div class="ctw-bar"><select onchange="_ctw.studio=this.value;ctWeekLoad()"><option value="">Choose a studio…</option>${studios.map(x => `<option value="${escAttr(x)}"${x === _ctw.studio ? ' selected' : ''}>${esc(STUDIO_NAMES[x] || x)}</option>`).join('')}</select>
    <select onchange="_ctw.page=this.value;ctDraw()"><option value="">Class to add…</option>${(_ct.pages || []).map(c => `<option value="${escAttr(c.id)}"${c.id === _ctw.page ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    ${pg && pg.parts && pg.parts.labels ? `<select onchange="_ctw.part=this.value;ctDraw()" title="Which part">${pg.parts.labels.map(l => `<option value="${escAttr(l)}"${(_ctw.part || pg.parts.labels[0]) === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
    ${pg ? `<label class="ctw-jump" title="At least one adult (16+) and one child, max 2 kids per adult"><input type="checkbox" ${_ctw.family ? 'checked' : ''} onchange="_ctw.family=this.checked"> 👨‍👧 Family</label>` : ''}
    ${pg ? `<span class="goal-note">${pg.weeks || '?'} weeks · ${pg.minutes || 90} min · ages ${pg.min_age ?? '?'}–${pg.max_age ?? '?'}</span>` : ''}
    <span class="spacer"></span><button class="ho-btn sm" onclick="ctWeekMove(-1)">‹</button><b>${esc(wkLabel)}</b><button class="ho-btn sm" onclick="ctWeekMove(1)">›</button>
    <label class="ctw-jump" title="Go to the week of a date">📅 <input type="date" value="${escAttr(_ctw.week)}" onchange="if(this.value){_ctw.week=ctWeekSunday(this.value);ctWeekLoad()}"></label>
    <label class="ctw-jump" title="The day each week starts on">Week starts <select onchange="_ctw.startMon=this.value==='mon';try{localStorage.setItem('hub.ctwStartMon',_ctw.startMon?'1':'0')}catch(e){};_ctw.week=ctWeekSunday(_ctw.week);ctWeekLoad()"><option value="sun"${_ctw.startMon ? '' : ' selected'}>Sun</option><option value="mon"${_ctw.startMon ? ' selected' : ''}>Mon</option></select></label>
    <button class="ho-btn sm" onclick="_ctw.week=ctWeekSunday(localDateStr(new Date()));ctWeekLoad()">This week</button>
    ${hoA('class_times', 'edit') && _ctw.pending.length ? `<button class="ho-btn primary" onclick="ctWeekCreate()">Create ${_ctw.pending.length} class time${_ctw.pending.length === 1 ? '' : 's'}</button>` : ''}</div>`;
  if (!_ctw.studio) return h + '<div class="ho-intro">Choose a studio to see its week.</div>';
  if (_ctw.sess === null) return h + '<div class="goal-note">Loading…</div>';
  h += `<div class="goal-note" style="margin:2px 0 6px">${pg ? 'Click a free spot to place <b>' + esc(pg.name) + '</b> there (it starts that day and runs its weeks).' : 'Choose a class to add, then click a free spot.'} Grey = parties, workshops, camps and other things on.</div>
    <div class="ctw-grid" style="--rows:${rows};--row:${CTW_ROW}px"><div class="ctw-times">${Array.from({ length: rows }, (_, i) => { const m = CTW_START + i * 15; return `<div>${m % 60 === 0 ? esc(shortTime(String(Math.floor(m / 60)).padStart(2, '0') + ':00:00')) : ''}</div>`; }).join('')}</div>`;
  days.forEach((d, di) => {
    const today = d === localDateStr(new Date()), past = d < localDateStr(new Date());
    const prov = String(_ctw.studio).slice(0, 2), yr = +d.slice(0, 4);
    const stat = holidaysFor(prov, yr).filter(x => x[0] === d).map(x => x[1]), spec = specialDaysFor(prov, yr).filter(x => x[0] === d).map(x => x[1]);
    h += `<div class="ctw-day${past ? ' past' : ''}${stat.length ? ' stat' : ''}"><div class="ctw-dh${today ? ' today' : ''}"><span>${esc(new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</span>
      <span class="ctw-hol">${stat.map(x => `<span class="ctw-stat" title="Stat holiday">${esc(x)}</span>`).join('')}${spec.map(x => `<span class="ctw-spec">${esc(x)}</span>`).join('')}</span></div>
      <div class="ctw-col" data-ctwday="${d}" onclick="ctWeekClick(event, '${d}')">`;
    // everything on this day (existing, new, and new classes' later weeks), laid out side by side when they overlap (up to 3)
    const items = [];
    (_ctw.sess || []).filter(x => x.session_date === d).forEach(x => {
      // booked / spots (spots minus spots left); closed ones (0 spots, nobody booked) aren't shown
      const camp = !!x.camp_program_id || /camp|pa\s*\/?\s*pd|pa day|pd day/i.test(x.title || '');
      // a camp/PA-PD day with nothing left to book and nobody booked (Shopify's inventory is 0 that day): "not open"
      const placeholder = camp && !x.camp_program_id && !x.__booked && !(x.spaces_left_cache > 0);
      const cap = x.capacity, booked = x.__booked || 0;
      // party-type slots (kids, splatter, get-together, field trip): Open or Booked
      const party = x.session_type === 'party' || /party|get.?together|field.?trip/i.test(x.title || '');
      // shown only when someone's booked or it has spots left (spots left follows Shopify's inventory for Shopify slots);
      // camps share their camp's spots, so they always show
      if (!camp && !booked && !(x.spaces_left_cache > 0)) return;
      const reg = party ? `<span class="ctw-reg${x.__booked ? ' full' : ''}">${x.__booked ? 'Booked' : 'Open'}</span>`
        : cap ? `<span class="ctw-reg${booked >= cap ? ' full' : ''}">${booked}/${cap}</span>` : '';
      const m = toMin(x.session_time), cls = !camp && (!!x.world_class_slot_id || x.session_type === 'class'), tp = String(x.title || '').split(' | '), part = (String(x.title).match(/Class (\d+ of \d+)/) || [])[1];   // (camps and PA/PD days: never shown as classes, whatever type the sync gives them)
      const name = tp.length > 1 && /^\*?\d{1,2}(:\d\d)?\s*(am|pm)\b/i.test(tp[0]) ? tp[1] : tp[0];   // Shopify titles start with the time and date ("6pm Sat Feb 13th | Kids Party")
      // camps and PA/PD days: their own time and length (half day AM/PM); with no length, full day 9am–4pm (half day 3 hours)
      const half = /half/i.test(x.title || ''), len = x.duration_minutes || (camp ? (half ? 180 : 420) : 60);
      const start = camp && !x.duration_minutes && m < 9 * 60 ? 9 * 60 : m;
      const hm = t => { const h2 = Math.floor(t / 60), m2 = t % 60; return ((h2 % 12) || 12) + (m2 ? ':' + String(m2).padStart(2, '0') : '') + (h2 >= 12 ? 'pm' : 'am'); };
      items.push({ s: start, e: start + len, ph: placeholder, html: (st, ht) => `<div class="ctw-b ${placeholder ? 'ph' : cls ? 'cls' : 'other'}${x.show === false ? ' hid' : ''}" style="${st};height:${ht}px" title="${escAttr(x.title + (placeholder ? ' (not open: no spots left that day, nobody booked)' : ''))}">
        ${placeholder ? '<span class="ctw-reg">not open</span>' : camp && !x.capacity && x.spaces_left_cache > 0 ? `<span class="ctw-reg">${x.spaces_left_cache} left</span>` : reg}<b>${esc(camp ? hm(start) + '–' + hm(start + len) : shortTime(x.session_time))}</b> ${esc(name)}${part ? ` <small>· class ${esc(part)}</small>` : ''}</div>` });
    });
    pend.filter(x => x.date === d).forEach(x => {
      const i = _ctw.pending.indexOf(x), m = toMin(x.time);
      items.push({ s: m, e: m + x.minutes, html: (st, ht) => `<div class="ctw-b new" style="${st};height:${ht}px"><b>${esc(shortTime(x.time + ':00'))}</b> ${esc(x.name)} <small>new · ${x.weeks} weeks</small>
        <button class="ctw-x" onclick="event.stopPropagation();_ctw.pending.splice(${i},1);ctDraw()" aria-label="Remove">×</button></div>` });
    });
    pend.forEach(x => {
      if (x.date === d) return;
      const k = Math.round((new Date(d + 'T12:00:00') - new Date(x.date + 'T12:00:00')) / (7 * 86400000));
      if (k > 0 && k < x.weeks && new Date(d + 'T12:00:00').getDay() === new Date(x.date + 'T12:00:00').getDay()) {
        const m = toMin(x.time);
        items.push({ s: m, e: m + x.minutes, html: (st, ht) => `<div class="ctw-b new ghost" style="${st};height:${ht}px"><b>${esc(shortTime(x.time + ':00'))}</b> ${esc(x.name)} <small>new · class ${k + 1} of ${x.weeks}</small></div>` });
      }
    });
    items.sort((p1, p2) => p1.s - p2.s || p2.e - p1.e);
    // groups of overlapping things: each gets a lane; the group's width is shared by its lanes
    let grp = [], grpEnd = -1;
    const flush = () => { const n = Math.max(1, ...grp.map(g => g.lane + 1)); grp.forEach(g => { g.n = n; }); grp = []; };
    items.forEach(it => {
      if (it.s >= grpEnd && grp.length) flush();
      const used = grp.filter(g => g.e > it.s).map(g => g.lane); let lane = 0; while (used.includes(lane)) lane++;
      it.lane = lane; grp.push(it); grpEnd = Math.max(grpEnd, it.e);
    });
    if (grp.length) flush();
    items.forEach(it => {
      if (it.e <= CTW_START || it.s >= CTW_END) return;
      const w = 100 / it.n, st = `top:${top(Math.max(it.s, CTW_START))}px;left:calc(${it.lane * w}% + 2px);width:calc(${w}% - 4px);right:auto`;
      h += it.html(st, Math.max(CTW_ROW, (Math.min(it.e, CTW_END) - Math.max(it.s, CTW_START)) / 15 * CTW_ROW) - 2);
    });
    _ctw.dayItems = _ctw.dayItems || {}; _ctw.dayItems[d] = items.filter(it => !it.ph).map(it => ({ s: it.s, e: it.e }));
    h += '</div></div>';
  });
  return h + '</div>';
}
function ctWeekClick(e, d) {
  const pg = ctWeekPage(); if (!pg) { alert('Choose the class to add first (at the top).'); return; }
  if (!hoA('class_times', 'edit')) return;
  if (d < localDateStr(new Date())) { alert('That day has passed.'); return; }
  const rect = e.currentTarget.getBoundingClientRect(), y = e.clientY - rect.top;
  const m = CTW_START + Math.floor(y / CTW_ROW) * 15, time = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const part = pg.parts && pg.parts.labels ? (_ctw.part && pg.parts.labels.includes(_ctw.part) ? _ctw.part : pg.parts.labels[0]) : null;
  _ctw.pending.push({ studio: _ctw.studio, page: pg.id, name: pg.name + (part ? ' · ' + part : '') + (_ctw.family ? ' · Family' : ''), part, family: !!_ctw.family, date: d, time, weeks: pg.weeks || 5, minutes: pg.minutes || 90, spots: 15, min_age: pg.min_age, max_age: pg.max_age });
  ctDraw();
}
// Create the placed class times: the holiday / camp day check, then make them
async function ctWeekCreate() {
  const plan = _ctw.pending.slice(), f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  openDutySheet(`<h3>Create ${plan.length} class time${plan.length === 1 ? '' : 's'}</h3><p class="goal-note">Checking dates…</p>`);
  for (const x of plan) { x.ds = ctSlotDates(x.date, x.weeks, []); x.warn = classDateWarnings(x.ds, x.studio, await campDaysAt(x.studio, x.ds)); }
  openDutySheet(`<h3>Create ${plan.length} class time${plan.length === 1 ? '' : 's'}</h3><div class="me-form">
    <div class="don-two"><label>Spots in each<input type="number" id="ctw-spots" min="1" max="200" value="15"></label>
      <label>Ages for all <span style="display:flex;gap:6px;align-items:center"><input type="number" id="ctw-amin-all" min="2" max="99" style="width:70px">–<input type="number" id="ctw-amax-all" min="2" max="99" style="width:70px"><button type="button" class="ho-btn sm" onclick="ctWeekAgesAll()">Set all</button></span></label></div>
    <div class="cta-plan">${plan.map((x, i) => `<div class="cs-p2row"><b>${esc(x.name)}</b> · ${esc(STUDIO_NAMES[x.studio] || x.studio)} · ${esc(f(x.date))} at ${esc(shortTime(x.time + ':00'))} · ${x.weeks} weeks · ${x.minutes} min
      <span class="ctw-ages">Ages <input type="number" class="ctw-amin" data-i="${i}" min="2" max="99" value="${escAttr(x.min_age ?? '')}">–<input type="number" class="ctw-amax" data-i="${i}" min="2" max="99" value="${escAttr(x.max_age ?? '')}"></span>
      ${(() => { const pgx = (_ct.pages || []).find(c => c.id === x.page), L = pgx && pgx.parts && pgx.parts.labels; return L ? `<span class="ctw-ages">Part <select class="ctw-part" data-i="${i}">${L.map(l => `<option value="${escAttr(l)}"${(x.part || L[0]) === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></span>` : ''; })()}
      <span class="ctw-ages"><label><input type="checkbox" class="ctw-fam" data-i="${i}"${x.family ? ' checked' : ''}> 👨‍👧 Family</label></span>
      <small class="goal-note">${esc(ctDatesLine(x.ds))}</small>${x.warn.map(w => `<label class="ba-check"><input type="checkbox" class="ctw-skip" data-i="${i}" value="${w.date}"${w.skip ? ' checked' : ''}> Skip ${esc(f(w.date))} <span class="goal-note">(${esc(w.why)})</span></label>`).join('')}</div>`).join('')}</div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Back</button><button class="primary" id="ctw-go" onclick="ctWeekGo()">Create all</button></div>`);
}
function ctWeekAgesAll() {
  const a = document.getElementById('ctw-amin-all').value, z = document.getElementById('ctw-amax-all').value;
  if (a !== '') document.querySelectorAll('.ctw-amin').forEach(i => { i.value = a; });
  if (z !== '') document.querySelectorAll('.ctw-amax').forEach(i => { i.value = z; });
}
async function ctWeekGo() {
  const b = document.getElementById('ctw-go'), spots = +document.getElementById('ctw-spots').value || 15;
  const ageOf = (cls, i) => { const e = document.querySelector(`.${cls}[data-i="${i}"]`); return e && e.value !== '' ? +e.value : null; };
  const missing = _ctw.pending.some((x, i) => ageOf('ctw-amin', i) == null || ageOf('ctw-amax', i) == null);
  if (missing) { alert('Add the ages for each class time (or use “Ages for all”).'); return; }
  b.disabled = true;
  let made = 0; const errs = [], done = [];
  for (let i = 0; i < _ctw.pending.length; i++) {
    const x = _ctw.pending[i], skips = [...document.querySelectorAll(`.ctw-skip[data-i="${i}"]:checked`)].map(c => c.value);
    b.textContent = `Making ${i + 1} of ${_ctw.pending.length}…`;
    const r = await sb.rpc('world_class_slot_add', { p: { class_page_id: x.page, studio_id: x.studio, start_date: x.date, start_time: x.time, minutes: x.minutes, weeks: x.weeks,
      spots, skip_dates: skips, min_age: ageOf('ctw-amin', i), max_age: ageOf('ctw-amax', i),
      part_label: (document.querySelector(`.ctw-part[data-i="${i}"]`) || {}).value || x.part || null, follows_slot: null } });
    x.family = !!(document.querySelector(`.ctw-fam[data-i="${i}"]`) || {}).checked;
    if (r.error) errs.push(`${x.name} ${x.date} ${x.time}: ${r.error.message}`);
    else { made++; done.push(x); const fe = await ctSetFamily(r.data, x.family); if (fe) errs.push(`${x.name} ${x.date}: made, but not set as a family time (${fe})`); }
  }
  _ctw.pending = _ctw.pending.filter(x => !done.includes(x));
  closeDutySheet(); ctWeekLoad(); ctLoad();
  alert(`Made ${made} class time${made === 1 ? '' : 's'}.` + (errs.length ? '\nNot made:\n' + errs.join('\n') : ''));
}
// Change a timeslot's dates: preview first (week by week, and who's booked), then do it and email the families
let _ctr = null;
function ctRedate(id) {
  const r = (_ct.rows || []).find(x => x.id === id); if (!r) return; _ctr = { r, prev: null };
  openDutySheet(`<h3>Edit: ${esc(r.class_name)}</h3><p class="ho-intro">${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)} · ${r.booked} booked. Bookings move with their class.</p>
    <div class="me-form"><div class="don-two"><label>First class<input type="date" id="ctr-start" value="${escAttr(String(r.start_date).slice(0, 10))}"></label><label>Time<input type="time" id="ctr-time" value="${escAttr(String(r.start_time).slice(0, 5))}"></label></div>
      <div class="don-two"><label>Weeks<input type="number" id="ctr-weeks" min="1" max="20" value="${r.weeks}"></label>
        <label>Skip these dates (no class)<input type="text" id="ctr-skip" value="${escAttr((r.skip_dates || []).map(d => String(d).slice(0, 10)).join(', '))}" placeholder="2027-02-17, 2027-03-17"></label></div>
      <button class="ho-btn" onclick="ctRedatePreview()">Preview</button><div id="ctr-out"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="ctr-go" disabled onclick="ctRedateGo()">Change the dates</button></div>`);
}
function ctrArgs() {
  const v = id => document.getElementById(id).value;
  return { p_slot: _ctr.r.id, p_start: v('ctr-start'), p_time: v('ctr-time'), p_weeks: +v('ctr-weeks') || 0,
    p_skip: v('ctr-skip').split(/[\s,;]+/).map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) };
}
async function ctRedatePreview() {
  const out = document.getElementById('ctr-out'); out.innerHTML = '<p class="goal-note">Working it out…</p>';
  const { data, error } = await sb.rpc('hub_class_slot_redate', Object.assign(ctrArgs(), { p_preview: true }));
  if (error) { out.innerHTML = `<p class="goal-note" style="color:#b91c1c">${esc(error.message)}</p>`; document.getElementById('ctr-go').disabled = true; return; }
  _ctr.prev = data;
  const f = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
  const n = Math.max((data.old || []).length, (data.new || []).length), fam = data.families || [];
  out.innerHTML = `<table class="ct-weeks"><thead><tr><th>Week</th><th>Was</th><th>Now</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => {
      const o = (data.old || [])[i], w = (data.new || [])[i], ch = String(o || '').slice(0, 10) !== String(w || '').slice(0, 10);
      return `<tr class="${ch ? 'ct-ch' : ''}"><td>${i + 1}</td><td>${f(o)}</td><td>${w ? f(w) : '<i>removed</i>'}</td></tr>`; }).join('')}</tbody></table>
    ${String(data.old_time).slice(0, 5) !== String(data.new_time).slice(0, 5) ? `<p class="goal-note">Time: ${esc(shortTime(data.old_time))} → <b>${esc(shortTime(data.new_time))}</b></p>` : ''}
    ${fam.length ? `<label class="ba-check"><input type="checkbox" id="ctr-email" checked> Email the ${fam.length} famil${fam.length === 1 ? 'y' : 'ies'} booked the new dates</label>
      <label>Note in the email (optional)<textarea id="ctr-msg" rows="2" placeholder="e.g. We moved week 3 for the holiday weekend."></textarea></label>
      <p class="goal-note">${esc(fam.map(x => x.name || x.email).join(', '))}</p>` : '<p class="goal-note">Nobody\u2019s booked yet.</p>'}`;
  document.getElementById('ctr-go').disabled = false;
}
async function ctRedateGo() {
  const b = document.getElementById('ctr-go'); b.disabled = true; b.textContent = 'Changing…';
  const email = document.getElementById('ctr-email') && document.getElementById('ctr-email').checked, note = (document.getElementById('ctr-msg') || {}).value || '';
  const { data, error } = await sb.rpc('hub_class_slot_redate', Object.assign(ctrArgs(), { p_preview: false }));
  if (error) { b.disabled = false; b.textContent = 'Change the dates'; alert('Not changed: ' + error.message); return; }
  let sent = 0;
  if (email && (data.families || []).length) {
    try { const d = await staffBookingCall('staff_class_notify', { slot_id: _ctr.r.id, old_dates: (data.old || []).map(x => String(x).slice(0, 10)), new_dates: (data.new || []).map(x => String(x).slice(0, 10)), message: note }); sent = d.sent || 0; }
    catch (e) { alert('The dates changed, but the emails didn\u2019t send: ' + e.message); }
  }
  closeDutySheet(); ctLoad();
  if (sent) alert(`Dates changed. ${sent} famil${sent === 1 ? 'y' : 'ies'} emailed.`);
}

// ---------- Home office → Bulk add (admins: world_bulk_times.sql) ----------
// Make many World-only times at once (no Shopify products): glazing now; party time slots next.
let _bulk = { kind: 'glazing', studios: [], days: [], times: [], skip: [], res: null, item: '', items: null, kidsOnly: false };
async function openBulkPane() {
  await hoAreaLoad('class_times'); if (!hoA('class_times', 'edit')) { alert('Bulk add needs “Class times” (Edit) on the Access page.'); return; }
  showOnlyPane('bulk-pane'); setActiveNav('nav-bulk'); bulkDraw();
}
function bulkVal(id) { const e = document.getElementById(id); return e ? e.value : ''; }
function bulkKeep() {
  const B = _bulk;
  B.studios = [...document.querySelectorAll('.bk-st:checked')].map(x => x.value);
  B.days = [...document.querySelectorAll('.bk-day:checked')].map(x => +x.value);
  ['from', 'to', 'spots', 'minutes', 'price', 'member'].forEach(k => { const v = bulkVal('bk-' + k); if (v !== '') B[k] = v; });
  const ko = document.getElementById('bk-kids'); if (ko) B.kidsOnly = ko.checked;
}
function bulkDraw() {
  const B = _bulk, el = document.getElementById('bulk-pane'), today = localDateStr(new Date());
  const groups = [['BC', 'British Columbia'], ['AB', 'Alberta'], ['ON', 'Ontario']];
  const ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
  const R = B.res;
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">➕ Bulk add</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Make many World-only times at once. Families book and pay on World (no Shopify products). Times that are already there are skipped, never doubled.</div>
    <div class="bk-card"><div class="bk-kinds"><label><input type="radio" name="bk-kind" value="workshop"${B.kind === 'workshop' ? ' checked' : ''} onchange="bulkKind(this.value)"> 🖼️ Workshop times</label>
      <label><input type="radio" name="bk-kind" value="glazing"${B.kind === 'glazing' ? ' checked' : ''} onchange="bulkKind(this.value)"> 🎨 Glazing times</label>
      <label><input type="radio" name="bk-kind" value="get_together"${B.kind === 'get_together' ? ' checked' : ''} onchange="bulkKind(this.value)"> 🎨 Adult Get-Together time slots</label>
      <label><input type="radio" name="bk-kind" value="kids"${B.kind === 'kids' ? ' checked' : ''} onchange="bulkKind(this.value)"> 🎂 Kids party times</label>
      <label><input type="radio" name="bk-kind" value="splatter"${B.kind === 'splatter' ? ' checked' : ''} onchange="bulkKind(this.value)"> 🖌️ Splatter party times</label></div>
    ${B.kind === 'workshop' ? bulkItemHtml() : ''}
    ${B.kind === 'get_together' ? '<div class="goal-note">One booking per slot. Priced in World settings → Prices &amp; sales → Party pricing (Adult Get-Together).</div>' : ''}
    ${bulkParty() ? `<div class="goal-note">Times come from each studio’s <b>Weekly Party Slot Schedule</b> (admin → Parties → Edit Party Slots); a time with room for 2 parties gets 2 spots. Kids and Splatter share the party room, so World only offers a time while a room is free. Priced in World settings → Party pricing.${B.kind === 'splatter' ? ' <b>Splatter:</b> choose only the studios that offer it (World settings → Parties → Splatter studios).' : ''}</div>` : ''}
    <div class="bk-sec"><b>Studios</b> <button class="ho-btn sm" onclick="bulkAllStudios(true)">All</button><button class="ho-btn sm" onclick="bulkAllStudios(false)">None</button>
      <div class="bk-studios">${groups.map(([pv, label]) => `<div><div class="bk-pv"><b>${label}</b> <button class="ho-btn sm" onclick="bulkProv('${pv}')">all</button></div>${ids.filter(id => id.startsWith(pv)).map(id =>
        `<label><input type="checkbox" class="bk-st" value="${escAttr(id)}"${B.studios.includes(id) ? ' checked' : ''}> ${esc(STUDIO_NAMES[id] || id)}</label>`).join('')}</div>`).join('')}</div></div>
    <div class="bk-sec bk-row"><label class="f">From<input type="date" id="bk-from" min="${today}" value="${escAttr(B.from || '')}"></label>
      <label class="f">To<input type="date" id="bk-to" min="${today}" value="${escAttr(B.to || '')}"></label>
      <div><b>Days</b>${bulkParty() ? ' <span class="goal-note">(none ticked: every day in the schedule)</span>' : ''}<div class="bk-days">${DAYS.map(([n, l]) => `<label><input type="checkbox" class="bk-day" value="${n}"${B.days.includes(n) ? ' checked' : ''}> ${l}</label>`).join('')}</div></div></div>
    ${bulkParty() ? '' : `<div class="bk-sec"><b>Times</b> <span class="goal-note">(each one is made on every chosen day)</span>
      <div class="bk-chips">${B.times.map((t, i) => `<span class="bk-chip">${esc(shortTime(t + ':00'))} <button onclick="_bulk.times.splice(${i},1);bulkKeep();bulkDraw()" aria-label="Remove">×</button></span>`).join('')}
        <input type="time" id="bk-time" step="900"><button class="ho-btn sm" onclick="bulkAddTime()">+ Add time</button></div></div>`}
    <div class="bk-sec bk-row">${B.kind === 'glazing' || B.kind === 'workshop' ? `<label class="f">Spots per time<input type="number" id="bk-spots" min="1" max="200" value="${escAttr(B.spots || 12)}"></label>` : ''}
      <label class="f">Length (minutes)<input type="number" id="bk-minutes" min="15" max="600" step="15" value="${escAttr(B.minutes || (B.kind === 'workshop' ? ((bulkItem() || {}).minutes || 90) : B.kind === 'glazing' ? 90 : 120))}"></label>
      ${B.kind === 'workshop' ? `<label class="ba-check bk-kidsonly"><input type="checkbox" id="bk-kids"${B.kidsOnly ? ' checked' : ''}> Kids only (drop-off): kids in the workshop’s kids ages, no adults</label>` : ''}
      ${B.kind === 'glazing' ? `<label class="f">Price per person<input type="number" id="bk-price" min="0" step="0.01" value="${escAttr(B.price || 14)}"></label>
      <label class="f">Member price<input type="number" id="bk-member" min="0" step="0.01" value="${escAttr(B.member || 7)}"></label>` : ''}</div>
    <div class="bk-sec"><b>Skip these dates</b> <span class="goal-note">(holidays, closures)</span>
      <div class="bk-chips">${B.skip.map((d, i) => `<span class="bk-chip">${esc(new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} <button onclick="_bulk.skip.splice(${i},1);bulkKeep();bulkDraw()" aria-label="Remove">×</button></span>`).join('')}
        <input type="date" id="bk-skip" min="${today}"><button class="ho-btn sm" onclick="bulkAddSkip()">+ Skip date</button></div></div>
    <div class="bk-actions"><button class="ho-btn" onclick="bulkRun(true)">Preview</button><button class="ho-btn primary" onclick="bulkRun(false)"${R && R.preview && R.made ? '' : ' disabled title="Preview first"'}>Make ${R && R.preview ? R.made : ''} times</button>
      <span class="goal-note" id="bk-msg"></span></div>
    ${R ? `<div class="bk-res">${R.preview ? `<b>${R.made}</b> new time${R.made === 1 ? '' : 's'} would be made${R.skipped ? `, <b>${R.skipped}</b> already there (skipped)` : ''}.`
        : `✅ Made <b>${R.made}</b> ${B.kind === 'workshop' ? esc((bulkItem() || {}).title || 'workshop') + ' time' : B.kind === 'get_together' ? 'time slot' : bulkParty() ? 'party time' : 'time'}${R.made === 1 ? '' : 's'}${R.skipped ? ` (${R.skipped} already there, skipped)` : ''}. They’re on World now.`}
      ${R.preview && R.list && R.list.length ? `<div class="bk-list">${R.list.map(x => `<span>${esc(STUDIO_NAMES[x.studio_id] || x.studio_id)} · ${esc(new Date(x.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} · ${esc(shortTime(x.time))}</span>`).join('')}${R.made > R.list.length ? `<span>…and ${R.made - R.list.length} more</span>` : ''}</div>` : ''}</div>` : ''}</div>`;
}
function bulkKind(k) { bulkKeep(); _bulk.kind = k; _bulk.res = null; _bulk.minutes = ''; bulkDraw(); if (k === 'workshop' && !_bulk.items) bulkLoadItems(); }
// Workshop times: the World workshops to choose from (world_items_list), with their price and length
async function bulkLoadItems() {
  const { data, error } = await sb.rpc('world_items_list');
  _bulk.items = error ? [] : ((data && data.items) || []).filter(i => i.active !== false && i.kind !== 'glazing' && !i.retired_at)   // (retired ones can't get new dates)
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'en', { sensitivity: 'base' }));
  bulkDraw();
}
function bulkItem() { return (_bulk.items || []).find(i => i.id === _bulk.item) || null; }
function bulkItemHtml() {
  const B = _bulk, it = bulkItem();
  if (!B.items) return '<div class="goal-note">Loading the World workshops…</div>';
  if (!B.items.length) return '<div class="goal-note">No World workshops yet. Make one in 🔁 Move to World (+ New World workshop).</div>';
  return `<div class="bk-sec"><b>Which workshop?</b> <select id="bk-item" onchange="bulkKeep();_bulk.item=this.value;_bulk.minutes='';_bulk.res=null;bulkDraw()"><option value="">Choose a World workshop…</option>${B.items.map(i =>
    `<option value="${escAttr(i.id)}"${i.id === B.item ? ' selected' : ''}>${esc(i.title)}${i.kind === 'mini_make' ? ' (Mini Make)' : ''}</option>`).join('')}</select>
    ${it ? `<div class="goal-note">${esc(it.kind === 'mini_make' ? 'Mini Make' : 'Workshop')} · ${it.price_tier ? 'price tier ' + esc(it.price_tier) : '$' + Number(it.price || 0).toFixed(2) + (it.member_price ? ' · members $' + Number(it.member_price).toFixed(2) : '')}${it.min_age != null ? ' · ages ' + it.min_age + (it.max_age && it.max_age < 99 ? '–' + it.max_age : '+') : ''}${it.minutes ? ' · ' + it.minutes + ' min' : ''} · paid by ${esc(it.payment === 'stripe' ? 'Stripe' : 'Shopify invoice')}</div>` : ''}</div>`;
}
function bulkParty() { return _bulk.kind === 'kids' || _bulk.kind === 'splatter'; }   // (from the party slot schedule: world_party_move.sql)
function bulkAllStudios(on) { document.querySelectorAll('.bk-st').forEach(x => { x.checked = on; }); bulkKeep(); _bulk.res = null; bulkDraw(); }
function bulkProv(pv) { document.querySelectorAll('.bk-st').forEach(x => { if (x.value.startsWith(pv)) x.checked = true; }); bulkKeep(); _bulk.res = null; bulkDraw(); }
function bulkAddTime() { const v = bulkVal('bk-time'); bulkKeep(); if (v && !_bulk.times.includes(v)) { _bulk.times.push(v); _bulk.times.sort(); } _bulk.res = null; bulkDraw(); }
function bulkAddSkip() { const v = bulkVal('bk-skip'); bulkKeep(); if (v && !_bulk.skip.includes(v)) { _bulk.skip.push(v); _bulk.skip.sort(); } _bulk.res = null; bulkDraw(); }
async function bulkRun(preview) {
  bulkKeep(); const B = _bulk, msg = document.getElementById('bk-msg');
  const what = B.kind === 'workshop' ? ((bulkItem() || {}).title || 'workshop') + ' times' : B.kind === 'get_together' ? 'Adult Get-Together time slots' : B.kind === 'kids' ? 'Kids party times' : B.kind === 'splatter' ? 'Splatter party times' : 'glazing times';
  if (B.kind === 'workshop' && !B.item) { msg.textContent = 'Choose the workshop first.'; return; }
  if (!preview && !confirm(`Make ${B.res ? B.res.made : ''} ${what} on World? They can be booked straight away.`)) return;
  msg.textContent = preview ? 'Working it out…' : 'Making them…';
  const { data, error } = B.kind === 'workshop'
    ? await sb.rpc('hub_bulk_workshop', { p: { item_id: B.item, studios: B.studios, from: B.from, to: B.to, days: B.days, times: B.times, skip: B.skip,
        spots: +B.spots || 0, minutes: +B.minutes || null, kids_only: !!B.kidsOnly, preview } })
    : bulkParty()
    ? await sb.rpc('hub_bulk_party', { p: { kind: B.kind, studios: B.studios, from: B.from, to: B.to, days: B.days, from_schedule: true, skip: B.skip, minutes: +B.minutes || 120, preview } })
    : B.kind === 'get_together'
    ? await sb.rpc('hub_bulk_party', { p: { kind: 'get_together', studios: B.studios, from: B.from, to: B.to, days: B.days, times: B.times, skip: B.skip, minutes: +B.minutes || 120, preview } })
    : await sb.rpc('hub_bulk_glazing', { p: { studios: B.studios, from: B.from, to: B.to, days: B.days, times: B.times, skip: B.skip,
        spots: +B.spots || 0, minutes: +B.minutes || 90, price: B.price, member_price: B.member, preview } });
  if (error) { msg.textContent = /hub_bulk_(glazing|party|workshop)|from_schedule/i.test(error.message) ? 'Run ' + (B.kind === 'workshop' ? 'hub_bulk_workshop.sql' : bulkParty() ? 'world_party_move.sql' : B.kind === 'get_together' ? 'world_party_slots.sql' : 'world_bulk_times.sql') + ' in Supabase first.' : error.message; return; }
  B.res = data; bulkDraw();
}

// ---------- 🎟️ Adjust spots (hub_adjust_spots.sql): a studio's times over a day / week / range, booked and spots, ----------
// changed one at a time or in bulk, saved as you go without reloading the page. World-only times change here;
// Shopify times are shown read-only (their spots are Shopify inventory: ✏️ Adjust on the schedule).
let _sp = { mode: 'week', from: '', to: '', kind: '', rows: null, err: '', sel: new Set(), saving: {}, changed: false, items: null };
function spotsRange() {
  const base = (_plan && _plan.date) || localDateStr(new Date()), d = new Date(base + 'T12:00:00');
  if (_sp.mode === 'day') return { from: base, to: base };
  if (_sp.mode === 'week') { const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { from: localDateStr(mon), to: localDateStr(sun) }; }
  return { from: _sp.from || base, to: _sp.to || base };
}
async function openSpotsPane() {
  if (!(_studioData && _studioData.isAdmin)) { alert('Adjust spots is for home office.'); return; }
  showOnlyPane('spots-pane'); setActiveNav('nav-plan'); _sp.sel = new Set(); _sp.changed = false; spotsLoad();
}
async function spotsLoad() {
  const r = spotsRange(); _sp.rows = null; spotsDraw();
  // the World workshops to change to: the same list the schedule's swap box uses (hub_ws_range's items)
  if (!_sp.items || !_sp.items.length) {
    try { const w = await sb.rpc('hub_ws_range', { p_studio: _sessionStudioId, p_from: r.from, p_to: r.from }); _sp.items = (!w.error && w.data && w.data.items) || []; } catch (e) { _sp.items = []; }
    if (!_sp.items.length && _plan && _plan.ws && _plan.ws.items) _sp.items = _plan.ws.items;
  }
  const { data, error } = await sb.rpc('hub_spots_list', { p_studio: _sessionStudioId, p_from: r.from, p_to: r.to });
  _sp.err = error ? (/hub_spots_list/.test(error.message) ? 'Run hub_adjust_spots.sql in Supabase first.' : error.message) : '';
  _sp.rows = error ? [] : (data || []); spotsDraw();
}
function spotsBack() { const back = _sp.changed; showOnlyPane('plan-pane'); setActiveNav('nav-plan'); if (back && _plan) loadPlanDay(_plan.date); }
function spotsDraw() {
  const el = document.getElementById('spots-pane'); if (!el) return;
  const r = spotsRange(), K = { workshop: 'Workshops', glazing: 'Glazing', class: 'Kids classes', camp: 'Camps & PA days' };
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🎟️ Adjust spots · ${esc(STUDIO_NAMES[_sessionStudioId] || _sessionStudioId)}</div><span class="spacer"></span>
      <button class="ho-btn" onclick="spotsBack()">← Back to the schedule</button></div>
    <div class="sp-bar">${[['day', 'Day'], ['week', 'Week'], ['custom', 'Dates']].map(([k, l]) => `<button class="ho-btn sm${_sp.mode === k ? ' primary' : ''}" onclick="_sp.mode='${k}';spotsLoad()">${l}</button>`).join('')}
      ${_sp.mode === 'custom' ? `<input type="date" value="${escAttr(r.from)}" onchange="_sp.from=this.value;spotsLoad()"> – <input type="date" value="${escAttr(r.to)}" onchange="_sp.to=this.value;spotsLoad()">`
        : `<b>${esc(ptyDayLabel(r.from))}${r.to !== r.from ? ' – ' + esc(ptyDayLabel(r.to)) : ''}</b>`}
      <select onchange="_sp.kind=this.value;spotsDraw()"><option value="">Everything</option>${Object.keys(K).map(k => `<option value="${k}"${_sp.kind === k ? ' selected' : ''}>${K[k]}</option>`).join('')}</select></div>`;
  if (_sp.err) { el.innerHTML = h + `<p class="fd-msg">${esc(_sp.err)}</p>`; return; }
  if (!_sp.rows) { el.innerHTML = h + '<p class="goal-note">Loading…</p>'; return; }
  const rows = _sp.rows.filter(x => !_sp.kind || x.kind === _sp.kind);
  const editable = rows.filter(x => x.world);
  [..._sp.sel].forEach(id => { if (!editable.some(x => x.id === id)) _sp.sel.delete(id); });
  const n = _sp.sel.size;
  h += `<div class="sp-bulk${n ? ' on' : ''}"><b>${n}</b> selected ·
      Set to <input type="number" id="sp-b-set" min="0" max="200" style="width:64px"> <button class="ho-btn sm" ${n ? '' : 'disabled'} onclick="spotsBulk('set')">Set</button>
      · Add <input type="number" id="sp-b-add" min="-200" max="200" style="width:64px" placeholder="+2"> <button class="ho-btn sm" ${n ? '' : 'disabled'} onclick="spotsBulk('add')">Add</button>
      · <button class="ho-btn sm" ${n ? '' : 'disabled'} onclick="spotsBulk('close')" title="No spots left: spots = what's booked">Close (no more spots)</button></div>`;
  if (!rows.length) { el.innerHTML = h + '<p class="goal-note">Nothing on these dates.</p>'; return; }
  let last = '';
  h += `<table class="fd-tbl sp-tbl"><thead><tr><th><input type="checkbox" ${editable.length && editable.every(x => _sp.sel.has(x.id)) ? 'checked' : ''} onchange="spotsPickAll(this.checked)" title="Select all you can change"></th>
    <th>Time</th><th>What</th><th class="c">Booked</th><th class="c">Spots</th><th class="c">Left</th><th></th><th></th></tr></thead><tbody>`;
  rows.forEach(x => {
    if (x.date !== last) { last = x.date; h += `<tr class="sp-day"><td colspan="8">${esc(ptyDayLabel(x.date))}</td></tr>`; }
    const left = x.capacity == null ? '' : Math.max(0, (+x.capacity || 0) - (+x.booked || 0)), st = _sp.saving[x.id];
    h += `<tr id="sp-r-${escAttr(x.id)}" class="${x.show === false ? 'sp-hidden' : ''}"><td>${x.world ? `<input type="checkbox" ${_sp.sel.has(x.id) ? 'checked' : ''} onchange="spotsPick('${escAttr(x.id)}',this.checked)">` : ''}</td>
      <td class="sp-t">${esc(shortTime(x.time))}</td><td class="sp-what">${spotsWhat(x)}</td>
      <td class="c"><b>${+x.booked || 0}</b></td>
      <td class="c">${x.world ? `<input type="number" class="sp-in" min="${+x.booked || 0}" max="200" value="${x.capacity == null ? '' : +x.capacity}" onchange="spotsSave('${escAttr(x.id)}', this.value)" onkeydown="if(event.key==='Enter') this.blur()">`
        : `<span class="goal-note" title="A Shopify time: its spots are Shopify inventory (✏️ Adjust on the schedule)">${x.capacity == null ? '—' : +x.capacity} · Shopify</span>`}</td>
      <td class="c sp-left">${left === '' ? '' : left}</td>
      <td class="sp-act">${x.slot_id ? `<button class="ho-btn sm" onclick="spotsClassAll('${escAttr(x.id)}')" title="Use this number for every week of this class, from today on">↧ All weeks</button>` : ''}${x.item_id ? `<button class="ho-btn sm" onclick="spotsShow('${escAttr(x.id)}', ${x.show === false})" title="${x.show === false ? 'Put it back on World' : 'Take it off World (anyone booked stays booked)'}">${x.show === false ? '↺ Reopen' : '✕ Close'}</button>` : ''}</td>
      <td class="sp-st">${st === 1 ? '…' : st === 2 ? '✓' : st && st.err ? `<span class="tsg-red">${esc(st.err)}</span>` : ''}</td></tr>`;
  });
  el.innerHTML = h + '</tbody></table>';
}
// the name, or (a World workshop nobody's booked yet) a box to change it to another workshop
function spotsWhat(x) {
  const hid = x.show === false ? ' <span class="sp-closed">closed</span>' : '';
  if (!x.item_id || (+x.booked || 0) > 0 || !(_sp.items || []).length) return esc(x.title) + hid + (x.item_id && +x.booked ? ' <span class="goal-note" title="Families are booked, so it can’t be changed">🔒</span>' : '');
  return `<select class="sp-swap" onchange="spotsSwap('${escAttr(x.id)}', this.value)" title="Change to another workshop (nobody's booked yet)">${(_sp.items || []).map(i => `<option value="${escAttr(i.id)}"${i.id === x.item_id ? ' selected' : ''}>${esc(i.title)}</option>`).join('')}</select>${hid}`;
}
async function spotsSwap(id, item) {
  const x = (_sp.rows || []).find(z => z.id === id); if (!x) return;
  const st = document.querySelector('#sp-r-' + id + ' .sp-st'); if (st) st.textContent = '…';
  const { error } = await sb.rpc('hub_ws_update', { p_session: id, p_item: item });
  if (error) { if (st) st.innerHTML = `<span class="tsg-red">${esc(error.message)}</span>`; const sel = document.querySelector('#sp-r-' + id + ' .sp-swap'); if (sel) sel.value = x.item_id; return; }
  x.item_id = item; x.title = ((_sp.items || []).find(i => i.id === item) || {}).title || x.title; _sp.changed = true;
  if (st) { st.textContent = '✓ Changed'; setTimeout(() => { if (st.textContent === '✓ Changed') st.textContent = ''; }, 1500); }
}
async function spotsShow(id, show) {
  const x = (_sp.rows || []).find(z => z.id === id); if (!x) return;
  if (!show && (+x.booked || 0) > 0 && !confirm(`${x.booked} booked on this one. Close it anyway? It comes off World; the booked families stay booked (cancel them separately if it isn't running).`)) return;
  const { error } = await sb.rpc('hub_ws_update', { p_session: id, p_show: show });
  if (error) { alert(error.message); return; }
  x.show = show; _sp.changed = true;
  const tr = document.getElementById('sp-r-' + id); if (!tr) return;
  tr.classList.toggle('sp-hidden', !show);
  tr.querySelector('.sp-what').innerHTML = spotsWhat(x);
  tr.querySelector('.sp-act').innerHTML = `<button class="ho-btn sm" onclick="spotsShow('${escAttr(id)}', ${!show})" title="${!show ? 'Put it back on World' : 'Take it off World (anyone booked stays booked)'}">${!show ? '↺ Reopen' : '✕ Close'}</button>`;
}
// a kids class: this week's spots for every week of the class (today on), in one go
async function spotsClassAll(id) {
  const x = (_sp.rows || []).find(z => z.id === id); if (!x) return;
  const inp = document.querySelector('#sp-r-' + id + ' .sp-in'), v = inp ? Math.round(+inp.value) : NaN;
  if (!(v >= 0)) { alert('Type the number of spots first.'); return; }
  if (!confirm(`Set every week of “${String(x.title).split('|')[0].trim()}” (this class time, from today on) to ${v} spots?`)) return;
  const { data, error } = await sb.rpc('hub_spots_class', { p_session: id, p_value: v });
  if (error) { alert(/hub_spots_class/.test(error.message) ? 'Run the updated hub_adjust_spots.sql first.' : error.message); return; }
  spotsApply(data);   // (the weeks shown here update; the others are saved too)
  const st = document.querySelector('#sp-r-' + id + ' .sp-st'); if (st) st.textContent = `✓ ${(data || []).length} weeks`;
}
function spotsPick(id, on) { if (on) _sp.sel.add(id); else _sp.sel.delete(id); spotsBulkBar(); }
function spotsPickAll(on) { (_sp.rows || []).filter(x => x.world && (!_sp.kind || x.kind === _sp.kind)).forEach(x => { if (on) _sp.sel.add(x.id); else _sp.sel.delete(x.id); }); spotsDraw(); }
function spotsBulkBar() {   // just the bar and the boxes, not the whole table (so nothing jumps)
  const bar = document.querySelector('.sp-bulk'); if (!bar) return;
  const n = _sp.sel.size; bar.classList.toggle('on', !!n); bar.querySelector('b').textContent = n;
  bar.querySelectorAll('button').forEach(b => { b.disabled = !n; });
}
// apply results to the rows in place (no reload)
function spotsApply(res) {
  (res || []).forEach(r => {
    const x = (_sp.rows || []).find(z => z.id === r.id); if (!x) return;
    if (r.error) { _sp.saving[r.id] = { err: r.error }; }
    else { x.capacity = r.capacity; x.booked = r.booked; _sp.saving[r.id] = 2; _sp.changed = true; }
    const tr = document.getElementById('sp-r-' + r.id); if (!tr) return;
    const inp = tr.querySelector('.sp-in'); if (inp && !r.error) inp.value = r.capacity;
    const lf = tr.querySelector('.sp-left'); if (lf && !r.error) lf.textContent = Math.max(0, r.capacity - r.booked);
    const st = tr.querySelector('.sp-st'); if (st) st.innerHTML = r.error ? `<span class="tsg-red">${esc(r.error)}</span>` : (r.note ? `<span class="goal-note">${esc(r.note)}</span>` : '✓');
  });
  setTimeout(() => (res || []).forEach(r => { if (_sp.saving[r.id] === 2) { delete _sp.saving[r.id]; const st = document.querySelector('#sp-r-' + r.id + ' .sp-st'); if (st && st.textContent === '✓') st.textContent = ''; } }), 1500);
}
async function spotsSave(id, val) {
  if (val === '') return;
  const st = document.querySelector('#sp-r-' + id + ' .sp-st'); if (st) st.textContent = '…';
  const { data, error } = await sb.rpc('hub_spots_set', { p_ids: [id], p_mode: 'set', p_value: Math.round(+val) });
  if (error) { if (st) st.innerHTML = `<span class="tsg-red">${esc(error.message)}</span>`; return; }
  spotsApply(data);
}
async function spotsBulk(mode) {
  const ids = [..._sp.sel]; if (!ids.length) return;
  const v = mode === 'set' ? document.getElementById('sp-b-set').value : mode === 'add' ? document.getElementById('sp-b-add').value : null;
  if (mode !== 'close' && (v === '' || isNaN(+v))) { alert('Type a number first.'); return; }
  if (mode === 'close' && !confirm(`Close ${ids.length} time${ids.length === 1 ? '' : 's'}? No more spots (anyone booked stays booked).`)) return;
  ids.forEach(id => { const st = document.querySelector('#sp-r-' + id + ' .sp-st'); if (st) st.textContent = '…'; });
  const { data, error } = await sb.rpc('hub_spots_set', { p_ids: ids, p_mode: mode, p_value: v === null ? null : Math.round(+v) });
  if (error) { alert(error.message); return; }
  spotsApply(data);
}

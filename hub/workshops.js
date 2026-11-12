// hub/workshops.js: Home office → 🖼️ Workshops manager (mass edit, a workshop's times, add from the Projects library) and
// 🔁 Move to World (workshops, lineups, parties, camps & PA/PD days, multi-week series). Moved out of hub.html as-is (Nov 11 2026).
// Loaded by hub.html after its main script.

// ---------- Home office → 🖼️ Workshops manager (world_workshops_manager.sql) ----------
// Every current World workshop (A–Z): next and last date, times left, studios, bookings and interest; Live (on World's
// Workshops page), Retire (gone from Suggest a date; off the page and this list once its last date is over), and its
// place on World's Workshops page (Move to top / bottom). Add workshop: a project from the Projects library.
let _wsm = { rows: null, err: '', q: '', kind: '', show: 'all', studio: '', sort: 'title', desc: false, all: false, add: null, tiers: null, msg: '', sel: new Set(), mass: {}, massBusy: '' };
async function openWsmPane() {
  await hoAreaLoad('class_times'); if (!hoA('class_times', 'edit')) { alert('The Workshops manager needs “Class times” (Edit) on the Access page.'); return; }   // (Nov 11 2026: access.html)
  showOnlyPane('wsm-pane'); setActiveNav('nav-wsm'); wsmDraw(); wsmLoad();
  if (!_wsm.tiers) { const pt = await sb.rpc('world_setting_get', { p_key: 'price_tiers' }); _wsm.tiers = pt.error ? [] : ((pt.data && pt.data.tiers) || []); wsmDraw(); }   // (the price tier dropdowns)
}
async function wsmLoad() {
  if (_wsm.from || _wsm.to) wsmRangeLoad();
  const { data, error } = await sb.rpc('hub_workshops', { p_all: !!_wsm.all });
  _wsm.err = error ? (/hub_workshops/.test(error.message) ? 'Run world_workshops_manager.sql in Supabase first.' : error.message) : '';
  _wsm.rows = error ? [] : (data || []); wsmDraw();
}
// A date range: the columns show those dates only (hub_workshops_range in world_workshops_manager.sql)
async function wsmRangeLoad() {
  if (!_wsm.from && !_wsm.to) { _wsm.rng = null; wsmDraw(); return; }
  const { data, error } = await sb.rpc('hub_workshops_range', { p_from: _wsm.from || null, p_to: _wsm.to || null });
  _wsm.rng = error ? null : (data || {}); _wsm.rngErr = error ? (/hub_workshops_range/.test(error.message) ? 'Run world_workshops_manager.sql again for the date range.' : error.message) : '';
  wsmDraw();
}
function wsmRange(k, v) { _wsm[k] = v || ''; wsmRangeLoad(); }
const wsmDay = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: String(d).slice(0, 4) !== String(new Date().getFullYear()) ? 'numeric' : undefined }) : '—';
function wsmSort(k) { if (_wsm.sort === k) _wsm.desc = !_wsm.desc; else { _wsm.sort = k; _wsm.desc = ['booked', 'interest', 'times', 'studios'].includes(k); } wsmDraw(); }
// Redraw, keeping the page and the table where they were scrolled to (ticking a box, Live, Retire, dates…)
function wsmDraw() {
  const el = document.getElementById('wsm-pane'); if (!el) return;
  const wrap0 = el.querySelector('.wsm-wrap'), keep = { win: window.scrollY, pane: el.scrollTop, top: wrap0 ? wrap0.scrollTop : 0, left: wrap0 ? wrap0.scrollLeft : 0 };
  const sc = []; for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (n.scrollTop) sc.push([n, n.scrollTop]);   // (any scrolling box around the page)
  wsmDrawPage();
  const wrap = el.querySelector('.wsm-wrap');
  if (wrap) { wrap.scrollTop = keep.top; wrap.scrollLeft = keep.left; }
  el.scrollTop = keep.pane; sc.forEach(([n, t]) => { n.scrollTop = t; });
  if (window.scrollY !== keep.win) window.scrollTo(0, keep.win);
}
function wsmDrawPage() {
  const el = document.getElementById('wsm-pane'); if (!el) return;
  const W = _wsm, today = new Date().toLocaleDateString('en-CA');
  // with a date range: each workshop's times, spots, bookings and studios in those dates only
  const R = (W.rows || []).map(r => { if (!W.rng) return r; const g = W.rng[r.id] || {};
    return Object.assign({}, r, { next_date: g.first || null, last_date: g.last || null, times_left: +g.n || 0, studios: g.studios || [], spots: +g.spots || 0, booked: +g.booked || 0 }); });
  const status = r => r.retired_at ? 'retired' : !r.live ? 'notlive' : 'live';
  const q = W.q.trim().toLowerCase();
  let rows = R.filter(r => (!q || String(r.title).toLowerCase().includes(q)) && (!W.kind || (W.kind === 'mini_make' ? wsmIsMini(r) : !wsmIsMini(r)))
    && (W.show === 'all' || (W.show === 'nodates' ? !r.times_left : W.show === 'top' ? r.wall_sort < 0 : W.show === 'bottom' ? r.wall_sort > 0 : W.show === 'kids' ? !!r.kids_ok : W.show === 'notkids' ? !r.kids_ok : status(r) === W.show))
    && (!W.studio || (r.studios || []).includes(W.studio)));
  const val = r => ({ title: String(r.title).toLowerCase(), next: r.next_date || '9999', last: r.last_date || '0000', times: +r.times_left || 0, studios: (r.studios || []).length,
    booked: +r.booked || 0, interest: (+r.likes || 0) + (+r.wishes || 0) + (+r.suggestions || 0), live: r.live ? 1 : 0, retired: r.retired_at ? 1 : 0, order: r.wall_sort == null ? 0 : r.wall_sort,
    tier: wsmTierName(r.price_tier).toLowerCase(), offer: (r.offer_from || '0000') + (r.offer_until || '9999'), kids: r.kids_ok ? 1 : 0 })[W.sort];
  rows.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * (W.desc ? -1 : 1) || String(a.title).localeCompare(String(b.title)); });
  W.shown = rows.map(r => r.id);
  const th = (k, l, cls) => `<th class="${cls || ''}"><button class="fd-th${W.sort === k ? ' on' : ''}" onclick="wsmSort('${k}')">${l}${W.sort === k ? (W.desc ? ' ▼' : ' ▲') : ''}</button></th>`;
  const studios = [...new Set(R.flatMap(r => r.studios || []))].sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🖼️ Workshops</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Every current World workshop. <b>Live</b> shows it on World’s Workshops page. <b>Retire</b> takes it out of Suggest a date now; once its last date is over it drops off World’s Workshops page and off this list. <b>⭐ Featured</b> (up to 10) rise to the top of World’s Workshops page and <b>⬇ Bottom</b> (up to 5) sit at the bottom; the rest go in between, most popular first. Schedule dates with ➕ Bulk add.</div>
    ${wsmAddHtml()}
    <div class="wsm-range"><b>Dates</b> <label>From <input type="date" value="${escAttr(W.from || '')}" onchange="wsmRange('from',this.value)"></label>
      <label>to <input type="date" value="${escAttr(W.to || '')}" onchange="wsmRange('to',this.value)"></label>
      ${W.from || W.to ? `<button class="ho-btn" onclick="_wsm.from='';_wsm.to='';_wsm.rng=null;wsmDraw()">Clear (from today on)</button>` : '<span class="fd-sm">Blank: from today on</span>'}
      ${W.rng ? (() => { const L = R.filter(r => r.times_left > 0), n = L.reduce((t, r) => t + r.times_left, 0), sp = L.reduce((t, r) => t + r.spots, 0), bk = L.reduce((t, r) => t + r.booked, 0);
        return `<span class="wsm-rsum">${esc((W.from ? wsmDay(W.from) : 'Today') + ' – ' + (W.to ? wsmDay(W.to) : 'on'))}: <b>${L.length}</b> workshops with times · <b>${n.toLocaleString()}</b> times · <b>${sp.toLocaleString()}</b> spots · <b>${bk.toLocaleString()}</b> booked${sp ? ` (${Math.round(100 * bk / sp)}% full)` : ''}</span>`; })() : ''}
      ${W.rngErr ? `<span class="fd-msg">${esc(W.rngErr)}</span>` : ''}</div>
    <div class="fd-filters"><input id="wsm-q" type="search" placeholder="Search a workshop" value="${escAttr(W.q)}" oninput="_wsm.q=this.value;clearTimeout(_wsm.t);_wsm.t=setTimeout(()=>{wsmDraw();const i=document.getElementById('wsm-q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)">
      <select onchange="_wsm.kind=this.value;wsmDraw()"><option value="">Workshops and Mini Makes</option><option value="workshop"${W.kind === 'workshop' ? ' selected' : ''}>Workshops</option><option value="mini_make"${W.kind === 'mini_make' ? ' selected' : ''}>Mini Makes</option></select>
      <select onchange="_wsm.show=this.value;wsmDraw()">${[['all', 'All'], ['live', 'Live'], ['notlive', 'Not live'], ['retired', 'Retiring'], ['nodates', 'No dates coming up'], ['top', '⭐ Featured'], ['bottom', '⬇ Bottom'], ['kids', '🧒 Good for kids'], ['notkids', 'Not marked for kids']].map(o => `<option value="${o[0]}"${W.show === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select onchange="_wsm.studio=this.value;wsmDraw()"><option value="">Any studio</option>${studios.map(s => `<option value="${escAttr(s)}"${W.studio === s ? ' selected' : ''}>${esc(STUDIO_NAMES[s] || s)}</option>`).join('')}</select>
      <label class="fd-sm"><input type="checkbox" ${W.all ? 'checked' : ''} onchange="_wsm.all=this.checked;wsmLoad()"> Show finished retired ones</label></div>
    ${W.err ? `<p class="fd-msg">${esc(W.err)}</p>` : ''}${W.msg ? `<p class="fd-ok">${esc(W.msg)}</p>` : ''}
    ${W.rows === null ? '<p class="fd-sm">Loading…</p>' : `<p class="fd-sm">${rows.length} workshop${rows.length === 1 ? '' : 's'}${W.sel.size ? ` · <b>${W.sel.size} ticked</b> <button class="fd-link" onclick="_wsm.sel.clear();wsmDraw()">clear</button>` : ''}</p>
    ${W.sel.size ? wsmMassHtml() : ''}
    <div class="fd-tbl-wrap wsm-wrap"><table class="fd-tbl wsm-tbl"><thead><tr><th class="wsm-ck"><input type="checkbox" class="fd-tick" title="Tick every workshop shown" ${rows.length && rows.every(r => W.sel.has(r.id)) ? 'checked' : ''} onchange="wsmTickAll(this.checked)"></th>${th('title', 'Workshop')}${th('next', 'Next date')}${th('last', 'Last date')}${th('times', 'Times left', 'num')}${th('studios', 'Studios', 'num')}${th('booked', 'Booked', 'num')}${th('offer', 'Offered')}${th('tier', 'Price tier')}${th('interest', 'Interest')}${th('kids', '🧒 Kids')}${th('live', 'Live')}${th('retired', 'Retire')}${th('order', `On page <span class="fd-sm">⭐ ${R.filter(r => r.wall_sort < 0).length}/10 ⬇ ${R.filter(r => r.wall_sort > 0).length}/5</span>`)}</tr></thead><tbody>` +
    rows.map(r => { const pct = r.spots ? Math.round(100 * (+r.booked || 0) / r.spots) : null, done = r.retired_at && (!r.last_date || r.last_date < today);
      return `<tr class="${r.retired_at ? 'wsm-ret' : ''}${!r.live ? ' wsm-off' : ''}${W.sel.has(r.id) ? ' wsm-sel' : ''}"><td class="wsm-ck"><input type="checkbox" class="fd-tick" ${W.sel.has(r.id) ? 'checked' : ''} onchange="wsmTick('${r.id}',this.checked)" aria-label="Tick ${escAttr(r.title)}"></td><td class="wsm-name">${r.image ? `<img src="${escAttr(r.image)}" alt="">` : '<span class="wsm-noimg"></span>'}<span><button class="wsm-link" onclick="wsmDetail('${r.id}')" title="See every time it’s offered"><b>${esc(r.title)}</b></button><br><span class="fd-sm">${wsmIsMini(r) ? 'Mini Make' : 'Workshop'}${r.min_age != null ? ' · ' + r.min_age + (r.max_age && r.max_age < 99 ? '–' + r.max_age : '+') : ''}${r.minutes ? ' · ' + r.minutes + ' min' : ''}${r.retired_at ? ' · <b class="wsm-rt">' + (done ? 'retired' : 'retiring') + '</b>' : ''}</span></span></td>
        <td>${wsmDay(r.next_date)}</td><td>${wsmDay(r.last_date)}</td><td class="num"><button class="wsm-link num" onclick="wsmDetail('${r.id}')" title="See every time it’s offered">${r.times_left || 0}</button></td>
        <td class="num" title="${escAttr((r.studios || []).map(s => STUDIO_NAMES[s] || s).join(', '))}">${(r.studios || []).length}</td>
        <td class="num">${+r.booked || 0}${pct != null ? ` <span class="fd-sm">· ${pct}% full</span>` : ''}</td>
        <td class="wsm-offer"><input type="date" value="${escAttr(r.offer_from || '')}" title="First date it's offered" onchange="wsmDates('${r.id}',this.value,null)"><span>to</span><input type="date" value="${escAttr(r.offer_until || '')}" title="Last date it's offered" onchange="wsmDates('${r.id}',null,this.value)"></td>
        <td>${wsmTierSel(r)}</td>
        <td class="wsm-int"><span title="Likes on World">❤️ ${r.likes || 0}</span> <span title="Wish lists">★ ${r.wishes || 0}</span> <span title="Suggestions (Suggest a date)">🗓️ ${r.suggestions || 0}</span></td>
        <td><input type="checkbox" class="fd-tick" ${r.kids_ok ? 'checked' : ''} onchange="wsmSet('${r.id}',{kids_ok:this.checked})" aria-label="Good for kids" title="Good for kids: the auto-scheduler can use it for kids-only times"></td>
        <td><input type="checkbox" class="fd-tick" ${r.live ? 'checked' : ''} onchange="wsmSet('${r.id}',{live:this.checked})" aria-label="Live on World"></td>
        <td><input type="checkbox" class="fd-tick" ${r.retired_at ? 'checked' : ''} onchange="wsmRetire('${r.id}',this)" aria-label="Retire"></td>
        <td class="wsm-ord"><button class="wsm-pin${r.wall_sort < 0 ? ' on' : ''}" onclick="wsmPlace('${r.id}','featured')" aria-pressed="${r.wall_sort < 0}" title="Featured: at the top of World's Workshops page">⭐ Featured</button><button class="wsm-pin bot${r.wall_sort > 0 ? ' on' : ''}" onclick="wsmPlace('${r.id}','bottom')" aria-pressed="${r.wall_sort > 0}" title="At the bottom of World's Workshops page">⬇ Bottom</button></td></tr>`; }).join('') + '</tbody></table></div>'}`;
}
// A Mini Make, as World decides: its kind, or the Mini Make price tier
function wsmIsMini(r) { return r.kind === 'mini_make' || /mini\s*make/i.test(wsmTierName(r.price_tier)) || /mini\s*make/i.test(String(r.price_tier || '')); }
// Offered: the first and last dates the auto-scheduler may use this workshop (blank = any date)
async function wsmDates(id, from, until) {
  const r = (_wsm.rows || []).find(x => x.id === id); if (!r) return;
  const f = from !== null ? (from || null) : (r.offer_from || null), u = until !== null ? (until || null) : (r.offer_until || null);
  const { error } = await sb.rpc('hub_workshop_dates', { p_id: id, p_from: f, p_until: u });
  if (error) { alert('Not saved: ' + (/hub_workshop_dates/.test(error.message) ? 'run auto_schedule.sql first.' : error.message)); wsmDraw(); return; }
  r.offer_from = f; r.offer_until = u; wsmDraw();
}
// Price tier (World settings → Price tiers): changing it here also changes the project's default (projects.html)
function wsmTierName(key) { const t = (_wsm.tiers || []).find(x => x.key === key); return t ? (t.name || t.key) : key ? String(key) : ''; }
function wsmTierSel(r) {
  const T = _wsm.tiers || [];
  if (!T.length) return r.price_tier ? esc(wsmTierName(r.price_tier)) : (r.price != null ? '$' + Number(r.price).toFixed(2) : '');
  const known = !r.price_tier || T.some(t => t.key === r.price_tier);
  return `<select class="wsm-tier" onchange="wsmTier('${r.id}',this)" aria-label="Price tier"><option value=""${!r.price_tier ? ' selected' : ''}>${r.price != null && !r.price_tier ? 'Own price $' + Number(r.price).toFixed(2) : 'No tier'}</option>` +
    (known ? '' : `<option value="${escAttr(r.price_tier)}" selected>${esc(r.price_tier)} (not in Price tiers)</option>`) +
    T.map(t => `<option value="${escAttr(t.key)}"${t.key === r.price_tier ? ' selected' : ''}>${esc(t.name || t.key)}</option>`).join('') + '</select>';
}
function wsmTier(id, sel) {
  const r = (_wsm.rows || []).find(x => x.id === id), name = sel.value ? wsmTierName(sel.value) : 'no tier';
  if (!confirm(`Change “${r ? r.title : 'this workshop'}” to ${name}?\n\nNew bookings on World use it straight away, and it becomes the project’s default price tier in the Projects library.`)) { sel.value = (r && r.price_tier) || ''; return; }
  wsmSet(id, { price_tier: sel.value });
}
// ⭐ Featured (up to 10) / ⬇ Bottom (up to 5): tap to set, tap again to take it off
function wsmPlace(id, place) {
  const r = (_wsm.rows || []).find(x => x.id === id); if (!r) return;
  const on = place === 'featured' ? r.wall_sort < 0 : r.wall_sort > 0;
  wsmSet(id, { place: on ? 'none' : place });
}
// ---- Mass edit: tick workshops, then change Live, Retire, price tier, Offered dates or their place on World, all at once ----
function wsmTick(id, on) { if (on) _wsm.sel.add(id); else _wsm.sel.delete(id); wsmDraw(); }
function wsmTickAll(on) { (_wsm.shown || []).forEach(id => { if (on) _wsm.sel.add(id); else _wsm.sel.delete(id); }); wsmDraw(); }
function wsmMassHtml() {
  const M = _wsm.mass, T = _wsm.tiers || [], n = _wsm.sel.size, busy = !!_wsm.massBusy;
  const sel = (k, opts) => `<select onchange="_wsm.mass.${k}=this.value" ${busy ? 'disabled' : ''}>${opts.map(o => `<option value="${escAttr(o[0])}"${(M[k] || '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  return `<div class="wsm-mass"><b>Change the ${n} ticked:</b>
    <label>🧒 Kids ${sel('kids', [['', '(no change)'], ['on', 'Good for kids'], ['off', 'Not for kids']])}</label>
    <label>Live ${sel('live', [['', '(no change)'], ['on', 'Live'], ['off', 'Not live']])}</label>
    <label>Retire ${sel('retired', [['', '(no change)'], ['on', 'Retire'], ['off', 'Not retired']])}</label>
    <label>On World’s page ${sel('place', [['', '(no change)'], ['featured', '⭐ Featured'], ['bottom', '⬇ Bottom'], ['none', 'Normal']])}</label>
    ${T.length ? `<label>Price tier ${sel('tier', [['', '(no change)']].concat(T.map(t => [t.key, t.name || t.key])))}</label>` : ''}
    <label>Offered from <input type="date" value="${escAttr(M.from || '')}" ${busy ? 'disabled' : ''} onchange="_wsm.mass.from=this.value"></label>
    <label>to <input type="date" value="${escAttr(M.until || '')}" ${busy ? 'disabled' : ''} onchange="_wsm.mass.until=this.value"></label>
    <label class="fd-sm"><input type="checkbox" ${M.clearDates ? 'checked' : ''} ${busy ? 'disabled' : ''} onchange="_wsm.mass.clearDates=this.checked"> clear their dates</label>
    <button class="ho-btn primary" ${busy ? 'disabled' : ''} onclick="wsmMassGo()">${busy ? esc(_wsm.massBusy) : 'Apply to ' + n}</button>
    <p class="fd-sm">Only what you choose changes; “(no change)” and blank dates leave each workshop as it is. A new price tier also becomes each project’s default.</p></div>`;
}
async function wsmMassGo() {
  const M = _wsm.mass, ids = [..._wsm.sel], rows = (_wsm.rows || []).filter(r => _wsm.sel.has(r.id));
  const p = {};
  if (M.live) p.live = M.live === 'on';
  if (M.kids) p.kids_ok = M.kids === 'on';
  if (M.retired) p.retired = M.retired === 'on';
  if (M.place) p.place = M.place;
  if (M.tier) p.price_tier = M.tier;
  const dates = M.clearDates || M.from || M.until;
  if (!Object.keys(p).length && !dates) { alert('Choose what to change first.'); return; }
  const what = [M.kids ? (p.kids_ok ? 'good for kids' : 'not for kids') : '', M.live ? (p.live ? 'live' : 'not live') : '', M.retired ? (p.retired ? 'retire' : 'un-retire') : '', M.place ? ({ featured: '⭐ featured', bottom: '⬇ bottom', none: 'normal order' })[M.place] : '',
    M.tier ? 'price tier ' + wsmTierName(M.tier) : '', M.clearDates ? 'clear the Offered dates' : dates ? `Offered ${M.from || '…'} to ${M.until || '…'}` : ''].filter(Boolean).join(', ');
  if (!confirm(`Change ${ids.length} workshop${ids.length === 1 ? '' : 's'}: ${what}?`)) return;
  const fails = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; _wsm.massBusy = `Changing ${i + 1} of ${rows.length}…`; wsmDraw();
    if (Object.keys(p).length) { const { error } = await sb.rpc('hub_workshop_set', { p: Object.assign({ id: r.id }, p) }); if (error) { fails.push(`${r.title}: ${error.message}`); continue; } }
    if (dates) {
      const f = M.clearDates ? null : (M.from || r.offer_from || null), u = M.clearDates ? null : (M.until || r.offer_until || null);
      const { error } = await sb.rpc('hub_workshop_dates', { p_id: r.id, p_from: f, p_until: u }); if (error) fails.push(`${r.title}: ${error.message}`);
    }
  }
  _wsm.massBusy = ''; _wsm.mass = {}; _wsm.sel.clear();
  _wsm.msg = `✓ Changed ${rows.length - fails.length} of ${rows.length}.`;
  await wsmLoad();
  if (fails.length) alert('Not changed:\n' + fails.slice(0, 12).join('\n') + (fails.length > 12 ? `\n…and ${fails.length - 12} more` : ''));
}
async function wsmSet(id, p) {
  const { data, error } = await sb.rpc('hub_workshop_set', { p: Object.assign({ id }, p) });
  if (error) { alert('Not saved: ' + error.message); wsmDraw(); return; }
  const r = (_wsm.rows || []).find(x => x.id === id); if (r && data) Object.assign(r, data);
  wsmDraw();
}
function wsmRetire(id, box) {
  const r = (_wsm.rows || []).find(x => x.id === id);
  if (box.checked && !confirm(`Retire “${r ? r.title : 'this workshop'}”?\n\nIt comes out of Suggest a date now. Its dates still run; after the last one it drops off World’s Workshops page and off this list.`)) { box.checked = false; return; }
  wsmSet(id, { retired: box.checked });
}
// ---- One workshop's times (tap its title or Times left): every time it's offered, with spots, bookings and % full ----
let _wsd = null;
async function wsmDetail(id) {
  const r = (_wsm.rows || []).find(x => x.id === id); if (!r) return;
  _wsd = { r, rows: null, past: false, studio: '', sort: 'date', desc: false, err: '' };
  wsmDetailDraw(); wsmDetailLoad();
}
async function wsmDetailLoad() {
  const D = _wsd; if (!D) return;
  D.rows = null; wsmDetailDraw();
  const { data, error } = await sb.rpc('hub_workshop_times', { p_item: D.r.id, p_past: D.past });
  if (_wsd !== D) return;
  D.err = error ? (/hub_workshop_times/.test(error.message) ? 'Run world_workshops_manager.sql in Supabase first (it adds this table).' : error.message) : '';
  D.rows = error ? [] : (data || []); wsmDetailDraw();
}
function wsmDetailSort(k) { const D = _wsd; if (D.sort === k) D.desc = !D.desc; else { D.sort = k; D.desc = ['booked', 'pct', 'families'].includes(k); } wsmDetailDraw(); }
function wsmDetailDraw() {
  let el = document.getElementById('wsd-back');
  if (!_wsd) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'wsd-back'; el.className = 'fd-sheet-back'; el.onclick = e => { if (e.target === el) { _wsd = null; wsmDetailDraw(); } }; document.body.appendChild(el); }
  const D = _wsd, R = D.rows || [], today = new Date().toLocaleDateString('en-CA');
  const pctOf = x => x.capacity ? Math.round(100 * (+x.booked || 0) / x.capacity) : null;
  let rows = R.filter(x => !D.studio || x.studio_id === D.studio);
  const val = x => ({ date: x.date + x.time, studio: (STUDIO_NAMES[x.studio_id] || x.studio_id).toLowerCase(), cap: +x.capacity || 0, booked: +x.booked || 0,
    left: x.left == null ? -1 : +x.left, pct: pctOf(x) ?? -1, families: +x.families || 0 })[D.sort];
  rows.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * (D.desc ? -1 : 1) || String(a.date + a.time).localeCompare(String(b.date + b.time)); });
  const up = rows.filter(x => x.date >= today && x.show), cap = up.reduce((t, x) => t + (+x.capacity || 0), 0), bk = up.reduce((t, x) => t + (+x.booked || 0), 0);
  const studios = [...new Set(R.map(x => x.studio_id))].sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const th = (k, l, cls) => `<th class="${cls || ''}">${k ? `<button class="fd-th${D.sort === k ? ' on' : ''}" onclick="wsmDetailSort('${k}')">${l}${D.sort === k ? (D.desc ? ' ▼' : ' ▲') : ''}</button>` : l}</th>`;
  const tm = (t, m) => { if (!t) return ''; const [h, mi] = t.split(':').map(Number), f = (H, M) => (H % 12 || 12) + (M ? ':' + String(M).padStart(2, '0') : '') + (H >= 12 ? 'pm' : 'am');
    if (!m) return f(h, mi); const e = h * 60 + mi + m; return f(h, mi) + '–' + f(Math.floor(e / 60) % 24, e % 60); };
  el.innerHTML = `<div class="fd-sheet wsd-sheet" role="dialog" aria-modal="true" aria-label="${escAttr(D.r.title)} times">
    <div class="wsd-head">${D.r.image ? `<img src="${escAttr(D.r.image)}" alt="">` : ''}<div><h3>${esc(D.r.title)}</h3><span class="fd-sm">${wsmIsMini(D.r) ? 'Mini Make' : 'Workshop'}${D.r.price_tier ? ' · ' + esc(wsmTierName(D.r.price_tier)) : ''}${D.r.retired_at ? ' · retiring' : ''}${D.r.live ? '' : ' · not live'}</span></div>
      <span class="spacer"></span><button class="ho-btn" onclick="_wsd=null;wsmDetailDraw()">Close</button></div>
    ${D.rows ? `<div class="wsd-sum"><span><b>${up.length}</b> time${up.length === 1 ? '' : 's'} coming up</span><span><b>${[...new Set(up.map(x => x.studio_id))].length}</b> studio${[...new Set(up.map(x => x.studio_id))].length === 1 ? '' : 's'}</span><span><b>${bk}</b> of ${cap} spots booked</span><span><b>${cap ? Math.round(100 * bk / cap) : 0}%</b> full</span></div>` : ''}
    <div class="fd-filters"><select onchange="_wsd.studio=this.value;wsmDetailDraw()"><option value="">All studios</option>${studios.map(s => `<option value="${escAttr(s)}"${D.studio === s ? ' selected' : ''}>${esc(STUDIO_NAMES[s] || s)}</option>`).join('')}</select>
      <label class="fd-sm"><input type="checkbox" ${D.past ? 'checked' : ''} onchange="_wsd.past=this.checked;wsmDetailLoad()"> Include past times</label></div>
    ${D.err ? `<p class="fd-msg">${esc(D.err)}</p>` : ''}
    ${!D.rows ? '<p class="fd-sm">Loading…</p>' : !rows.length ? '<p class="fd-sm">No times' + (D.past ? '' : ' coming up') + '. Add some with ➕ Bulk add → Workshop times.</p>' :
    `<div class="fd-tbl-wrap wsd-wrap"><table class="fd-tbl wsd-tbl"><thead><tr>${th('date', 'Date')}<th>Day</th><th>Time</th>${th('studio', 'Studio')}${th('cap', 'Spaces', 'num')}${th('booked', 'Booked', 'num')}${th('left', 'Left', 'num')}${th('pct', '% full')}${th('families', 'Families', 'num')}<th>Notes</th><th></th></tr></thead><tbody>` +
    rows.map(x => { const p = pctOf(x), past = x.date < today;
      return `<tr class="${past ? 'wsd-past' : ''}${x.show ? '' : ' wsd-hid'}"><td>${esc(new Date(x.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: x.date.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined }))}</td>
        <td>${esc(new Date(x.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' }))}</td><td>${esc(tm(x.time, x.minutes))}</td><td>${esc(STUDIO_NAMES[x.studio_id] || x.studio_id)}</td>
        <td class="num">${x.capacity ?? ''}</td><td class="num">${x.booked}</td><td class="num">${x.left ?? ''}</td>
        <td>${p != null ? `<span class="wsd-bar"><i style="width:${Math.min(100, p)}%" class="${p >= 100 ? 'full' : p >= 60 ? 'good' : p < 25 && !past ? 'low' : ''}"></i></span> ${p}%` : ''}</td>
        <td class="num">${x.families}</td>
        <td>${x.kids_only ? '<span title="Kids only (drop-off)">🧒</span> ' : ''}${x.suggested ? '<span class="wsd-s" title="Set up from a family\\u2019s suggestion">S</span> ' : ''}${x.show ? '' : '<i class="fd-sm">hidden</i>'}${past ? '<i class="fd-sm">past</i>' : ''}</td>
        <td><button class="ho-btn sm" onclick="wsmGoTime('${x.id}','${x.studio_id}','${x.date}')" title="Open this day on the Schedule">→</button></td></tr>`; }).join('') + '</tbody></table></div>'}
    </div>`;
}
// → the Schedule on that studio and day, with the time flashed
async function wsmGoTime(sessionId, studio, date) {
  if (studio !== _sessionStudioId) {
    if (_studioData && _studioData.isAdmin) await changeAdminStudio(studio);
    else { alert('This one is at ' + (STUDIO_NAMES[studio] || studio) + '.'); return; }
  }
  _wsd = null; wsmDetailDraw();
  showOnlyPane('plan-pane'); setActiveNav('nav-plan'); renderPlanStudioPick();
  await loadPlanDay(date);
  const find = () => document.querySelector('#plan-body [data-open-cl="' + sessionId + '"]');
  let el = find(), tries = 0;
  while (!el && tries++ < 20) { await new Promise(r => setTimeout(r, 150)); el = find(); }
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('plan-flash'); setTimeout(() => el.classList.remove('plan-flash'), 2600); }
}
// ---- Add workshop: a project from the Projects library ----
function wsmAddHtml() {
  const A = _wsm.add;
  if (!A) return '<div class="wsm-add"><button class="ho-btn primary" onclick="_wsm.add={q:\'\',hits:null,pick:null};wsmDraw()">+ Add workshop</button></div>';
  let h = `<div class="wsm-add on"><div class="fd-filters"><b>Add a workshop from the Projects library</b><span class="spacer"></span><button class="ho-btn" onclick="_wsm.add=null;wsmDraw()">Close</button></div>
    <div class="fd-inline"><input id="wsm-pq" placeholder="Search projects by name…" value="${escAttr(A.q)}" oninput="wsmProjSearch(this.value)"></div>`;
  if (A.hits && !A.pick) h += A.hits.length ? '<div class="wsm-hits">' + A.hits.map((p, i) => { const have = (_wsm.rows || []).find(r => r.project_id === p.id);
      return `<button class="wsm-hit" ${have ? 'disabled' : ''} onclick="wsmPick(${i})">${p.image ? `<img src="${escAttr(p.image)}" alt="">` : '<span class="wsm-noimg"></span>'}<span><b>${esc(p.name)}</b>${have ? '<br><span class="fd-sm">already a World workshop</span>' : ''}</span></button>`; }).join('') + '</div>' : '<p class="fd-sm">No projects match.</p>';
  if (A.pick) {
    const T = _wsm.tiers || [];
    h += `<div class="wsm-form"><div class="wsm-picked">${A.pick.image ? `<img src="${escAttr(A.pick.image)}" alt="">` : ''}<b>${esc(A.pick.name)}</b> <button class="ho-btn sm" onclick="_wsm.add.pick=null;wsmDraw()">Change</button></div>
      <div class="bk-row"><label class="f">Kind<select id="wsm-kind"><option value="workshop">Workshop</option><option value="mini_make">Mini Make</option></select></label>
        <label class="f">Length (minutes)<input type="number" id="wsm-min" value="90" min="15" step="15"></label>
        ${T.length ? `<label class="f">Price tier<select id="wsm-tier">${T.map(t => `<option value="${escAttr(t.key)}"${t.key === (A.pick.tier || 't39') ? ' selected' : ''}>${esc(t.name || t.key)}</option>`).join('')}</select></label>` : '<label class="f">Price per person<input type="number" id="wsm-price" step="0.01" min="0"></label>'}
        <label class="f">Ages from<input type="number" id="wsm-amin" placeholder="6"></label><label class="f">to<input type="number" id="wsm-amax" placeholder="(no limit)"></label>
        <label class="f">Paid by<select id="wsm-pay"><option value="stripe">Stripe</option><option value="shopify">Shopify invoice</option></select></label></div>
      <label class="fd-chk"><input type="checkbox" id="wsm-live"> <b>Make live</b>: show it on World’s Workshops page now (even before it has dates)</label>
      <button class="ho-btn primary" onclick="wsmAddSave()">Add to the list</button></div>`;
  }
  return h + '</div>';
}
let _wsmPT = null;
function wsmProjSearch(q) { _wsm.add.q = q; clearTimeout(_wsmPT); _wsmPT = setTimeout(async () => {
  const { data } = await sb.rpc('news_pick_list', { p_kind: 'project', p_search: q || null }); _wsm.add.hits = data || []; wsmDraw();
  const i = document.getElementById('wsm-pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
function wsmPick(i) { const p = _wsm.add.hits[i]; if (!p) return; _wsm.add.pick = { id: p.id, name: p.name, image: p.image || null, tier: null }; wsmDraw(); }
async function wsmAddSave() {
  const v = id => (document.getElementById(id) || {}).value, P = _wsm.add.pick, live = document.getElementById('wsm-live').checked;
  const tier = document.getElementById('wsm-tier') ? v('wsm-tier') : null;
  const { data, error } = await sb.rpc('world_item_save', { p: { project_id: P.id, kind: v('wsm-kind'), minutes: +v('wsm-min') || 90, price: +v('wsm-price') || 0,
    min_age: v('wsm-amin') || null, max_age: v('wsm-amax') || null, payment: v('wsm-pay'), treats: true, active: true, ...(tier !== null ? { price_tier: tier } : {}) } });
  if (error) { alert('Not added: ' + error.message); return; }
  const id = typeof data === 'string' ? data : (data && data.id);
  if (id) await sb.rpc('hub_workshop_set', { p: { id, live } });
  _wsm.msg = `${P.name} added${live ? ' and live on World' : ''}. Schedule its dates with ➕ Bulk add → Workshop times.`;
  _wsm.add = null; await wsmLoad();
}
// ---------- Home office → 🔁 Move to World (hub_move_to_world.sql): Shopify workshop products → World-only workshops ----------
// Find upcoming sessions by name, tick the dates, choose (or make) the World workshop, move. They keep their spots and
// bookings; the nightly Shopify sync then leaves them alone. Then the Shopify products are set to Draft.
let _m2w = { q: '', from: '', rows: null, sel: new Set(), items: null, item: '', msg: '', newOpen: false, proj: null };
async function openM2wPane() {
  if (!_hoCan.edit) { alert('Moving workshops needs Studio Ops edit access.'); return; }
  showOnlyPane('mv-pane'); setActiveNav('nav-mv'); m2wDraw();
  const { data, error } = await sb.rpc('world_items_list');
  _m2w.items = error ? [] : ((data && data.items) || []).filter(i => i.active !== false);
  _m2w.projects = error ? [] : ((data && data.projects) || []);
  const pt = await sb.rpc('world_setting_get', { p_key: 'price_tiers' });   // (world_price_tiers.sql)
  _m2w.tiers = pt.error ? [] : ((pt.data && pt.data.tiers) || []); m2wDraw();
}
function m2wDraw() {
  const el = document.getElementById('mv-pane'); if (!el) return;
  if (_m2w.mode === 'series') { el.innerHTML = m2sHtml(); return; }
  if (_m2w.mode === 'lineup') { el.innerHTML = m2lHtml(); return; }
  if (_m2w.mode === 'camps') { el.innerHTML = m2cHtml(); return; }
  if (_m2w.mode === 'parties') { el.innerHTML = m2pHtml(); if (!_m2p.res && !_m2p.busy) m2pRun(true); if (!_m2p.gt && !_m2p.gtBusy && !_m2p.gtMsg) m2gRun(true); return; }
  const R = _m2w.rows, groups = {};
  (R || []).forEach(r => { (groups[r.title] = groups[r.title] || []).push(r); });
  const nSel = _m2w.sel.size, selRows = (R || []).filter(r => _m2w.sel.has(r.id));
  const it = (_m2w.items || []).find(i => i.id === _m2w.item);
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🔁 Move to World</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${m2Tabs('')}
    <div class="ho-intro">Move a Shopify workshop to World: its upcoming dates keep their spots left and every booking, the Hub becomes the only place spots are kept, and the Shopify products are then set to Draft. Families book it on World, paid by Shopify invoice or Stripe (the World workshop's setting).</div>
    <div class="mv-find"><input id="mv-q" placeholder="Workshop name, e.g. Make the Gift" value="${escAttr(_m2w.q)}" onkeydown="if(event.key==='Enter')m2wFind()">
      <label>From <input type="date" id="mv-from" value="${escAttr(_m2w.from || new Date().toLocaleDateString('en-CA'))}"></label>
      <button class="ho-btn primary" onclick="m2wFind()">Find dates</button><button class="ho-btn" onclick="m2wFind(true)">Find all workshops</button></div>
    ${_m2w.msg ? `<div class="goal-note mv-msg">${_m2w.msg}</div>` : ''}
    ${R === null ? '' : !R.length ? '<div class="goal-note">No upcoming Shopify workshop dates match. (Already moved dates, camps, PA/PD days, classes and parties aren\'t listed.)</div>' : `
    <div class="mv-cols"><div class="mv-left">
      ${Object.keys(groups).map(t => { const G = groups[t], RL = G.filter(r => Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0), all = (RL.length ? RL : G).every(r => _m2w.sel.has(r.id)); return `<div class="mv-group">
        <div class="mv-gh"><label><input type="checkbox" ${all ? 'checked' : ''} onchange="m2wPick(${escAttr(JSON.stringify(G.map(r => r.id)))}, this.checked, true)"> <b>${esc(t)}</b></label>
          <small>${G.length} date${G.length === 1 ? '' : 's'} · ${G.filter(r => Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0).length} real · ${G.reduce((a, r) => a + Number(r.booked || 0), 0)} booked</small>
          <span class="spacer"></span><select class="mv-gsel ${_m2w.gItem[t] ? '' : 'none'}" onchange="_m2w.gItem[${escAttr(JSON.stringify(t))}]=this.value;m2wDraw()"><option value="">${_m2w.gItem[t] ? '' : '⚠ '}Choose its World workshop…</option>${m2wSorted().map(i => `<option value="${i.id}"${_m2w.gItem[t] === i.id ? ' selected' : ''}>${esc(i.title)} · $${Number(i.price).toFixed(0)} · ${i.payment === 'shopify' ? 'Shopify invoice' : 'Stripe'}</option>`).join('')}</select></div>
        <div class="oc-wrap"><table class="oc-table"><thead><tr><th></th><th>Studio</th><th>Date</th><th>Time</th><th>Spots left</th><th>Booked</th><th>Shopify</th></tr></thead><tbody>
        ${G.map(r => `<tr><td><input type="checkbox" ${_m2w.sel.has(r.id) ? 'checked' : ''} onchange="m2wPick(['${r.id}'], this.checked)"></td><td>${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)}</td>
          <td>${esc(new Date(r.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</td><td>${esc(shortTime(r.time))}</td>
          <td>${r.spots ?? '—'}</td><td>${r.booked}</td><td><small>${esc(r.shopify_status || '')}</small></td></tr>`).join('')}</tbody></table></div></div>`; }).join('')}
    </div>
    <div class="mv-right"><h4 style="margin:0 0 6px">Move ${nSel} date${nSel === 1 ? '' : 's'}</h4>
      <small class="goal-note">Each workshop moves to the World workshop chosen beside it. Workshops without one use this:</small>
      <select id="mv-item" onchange="_m2w.item=this.value;m2wDraw()"><option value="">Choose the World workshop…</option>${(_m2w.items || []).slice().sort((x, y) => String(x.title || '').localeCompare(String(y.title || ''), 'en', { sensitivity: 'base' })).map(i => `<option value="${i.id}"${_m2w.item === i.id ? ' selected' : ''}>${esc(i.title)} · $${Number(i.price).toFixed(0)} · ${i.payment === 'shopify' ? 'Shopify invoice' : 'Stripe'}</option>`).join('')}</select>
      ${it ? `<div class="goal-note">${esc(it.kind === 'mini_make' ? 'Mini Make' : 'Workshop')} · $${Number(it.price).toFixed(2)}${it.member_price ? ` · members $${Number(it.member_price).toFixed(2)}` : ''} · paid by <b>${it.payment === 'shopify' ? 'Shopify invoice' : 'Stripe'}</b></div>` : ''}
      <button class="ho-btn sm" onclick="_m2w.newOpen=!_m2w.newOpen;m2wDraw()">${_m2w.newOpen ? '× Cancel' : '+ New World workshop'}</button>
      ${_m2w.newOpen ? m2wNewHtml() : ''}
      ${(() => { const E = (R || []).filter(r => !_m2w.sel.has(r.id) && !Number(r.spots || 0) && !Number(r.booked || 0)); _m2w.empty = E.map(r => r.id);
        return E.length ? `<label class="mv-hide"><input type="checkbox" ${_m2w.hideEmpty ? 'checked' : ''} onchange="_m2w.hideEmpty=this.checked"> Also hide the ${E.length} empty date${E.length === 1 ? '' : 's'} (0 spots, nobody booked) from schedules</label>` : ''; })()}
      <label class="mv-hide"><input type="checkbox" ${_m2w.draft !== false ? 'checked' : ''} onchange="_m2w.draft=this.checked"> Set their Shopify products to Draft (only products no studio still sells on Shopify)</label>
      <div class="mv-sum">${nSel ? `${nSel} date${nSel === 1 ? '' : 's'} · ${selRows.reduce((a, r) => a + Number(r.booked || 0), 0)} booked (kept) · ${selRows.reduce((a, r) => a + Number(r.spots || 0), 0)} spots left (kept)` : 'Tick the dates to move.'}</div>
      ${(() => { const miss = [...new Set(selRows.map(r => r.title))].filter(t => !_m2w.gItem[t] && !it); return miss.length ? `<div class="goal-note" style="color:#b45309">⚠ Choose a World workshop for: ${miss.map(esc).join(', ')}</div>` : ''; })()}
      <button class="ho-btn primary" ${nSel && [...new Set(selRows.map(r => r.title))].every(t => _m2w.gItem[t] || it) ? '' : 'disabled'} onclick="m2wGo()">🔁 Move to World</button></div></div>`}`;
}
function m2wSorted() { return (_m2w.items || []).slice().sort((x, y) => String(x.title || '').localeCompare(String(y.title || ''), 'en', { sensitivity: 'base' })); }
function m2wNewHtml() {
  const P = _m2w.proj || {};
  return `<div class="mv-new"><label>Project <input id="mv-pq" placeholder="Search projects…" value="${escAttr(P.q || '')}" oninput="m2wProjSearch(this.value)"></label>
    ${P.rows ? `<div class="nw-pick-list">${P.rows.map((r, n) => `<button type="button" onclick="m2wProjChoose(${n})">${r.image ? `<img src="${escAttr(r.image)}" alt="">` : '<span class="nw-noimg"></span>'}<span>${esc(r.name)}</span></button>`).join('') || '<small class="goal-note">Nothing found.</small>'}</div>` : ''}
    ${P.id ? `<div class="goal-note">✓ ${esc(P.name)}</div>` : ''}
    <div class="don-two"><label>Kind<select id="mv-kind"><option value="workshop">Workshop</option><option value="mini_make">Mini Make</option></select></label><label>Length (min)<input type="number" id="mv-min" value="90"></label></div>
    ${(_m2w.tiers || []).length ? `<label>Price tier<select id="mv-tier" onchange="_m2w.proj=Object.assign(_m2w.proj||{},{tier:this.value});m2wDraw()">${(_m2w.tiers || []).map(t => `<option value="${escAttr(t.key)}"${(P.tier || 't39') === t.key ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}<option value=""${P.tier === '' ? ' selected' : ''}>No tier (set the prices below)</option></select></label>` : ''}
    ${(_m2w.tiers || []).length && (P.tier === undefined || P.tier) ? '<div class="goal-note">Prices come from the tier (World settings → Price tiers).</div>' : `<div class="don-two"><label>Price per person<input type="number" step="0.01" id="mv-price" value="39"></label><label>Member price<input type="number" step="0.01" id="mv-mprice" placeholder="blank = Member pricing settings"></label></div>`}
    <div class="don-two"><label>Ages from<input type="number" id="mv-amin" placeholder="optional"></label><label>to<input type="number" id="mv-amax" placeholder="optional"></label></div>
    <label>Paid by<select id="mv-pay"><option value="shopify">Shopify invoice (keeps payments in Shopify for now)</option><option value="stripe">Stripe</option></select></label>
    <button class="ho-btn primary sm" onclick="m2wNewSave()">Make this World workshop</button></div>`;
}
let _m2wPT = null;
function m2wProjSearch(q) { _m2w.proj = Object.assign(_m2w.proj || {}, { q }); clearTimeout(_m2wPT); _m2wPT = setTimeout(async () => {
  const { data } = await sb.rpc('news_pick_list', { p_kind: 'project', p_search: q || null }); _m2w.proj.rows = data || []; m2wDraw();
  const i = document.getElementById('mv-pq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
function m2wProjChoose(n) { const r = _m2w.proj.rows[n], pj = (_m2w.projects || []).find(x => x.id === r.id);
  _m2w.proj = { q: r.name, id: r.id, name: r.name, tier: (pj && pj.price_tier) || 't39' }; m2wDraw(); }   // its project's default price tier
async function m2wNewSave() {
  const v = id => (document.getElementById(id) || {}).value;
  if (!_m2w.proj || !_m2w.proj.id) { alert('Choose the project first.'); return; }
  const tier = document.getElementById('mv-tier') ? v('mv-tier') : null;
  const { data, error } = await sb.rpc('world_item_save', { p: { project_id: _m2w.proj.id, kind: v('mv-kind'), minutes: +v('mv-min') || 90, price: +v('mv-price') || 0,
    member_price: v('mv-mprice') || null, min_age: v('mv-amin') || null, max_age: v('mv-amax') || null, payment: v('mv-pay'), treats: true, active: true,
    ...(tier !== null ? { price_tier: tier } : {}) } });
  if (error) { alert('Not saved: ' + error.message); return; }
  const r = await sb.rpc('world_items_list'); _m2w.items = ((r.data && r.data.items) || []).filter(i => i.active !== false);
  _m2w.item = data; _m2w.newOpen = false; _m2w.proj = null; m2wDraw();
}
async function m2wFind(all) {
  _m2w.q = all ? '*' : (document.getElementById('mv-q').value || '').trim(); _m2w.from = document.getElementById('mv-from').value; _m2w.gItem = {};
  _m2w.msg = 'Looking…'; _m2w.rows = null; _m2w.sel = new Set(); m2wDraw();
  const { data, error } = await sb.rpc('hub_move_preview', { p_search: _m2w.q, p_from: _m2w.from || null });
  _m2w.msg = error ? esc(/hub_move_preview/i.test(error.message) ? 'Run hub_move_to_world.sql in Supabase first.' : error.message) : '';
  _m2w.rows = error ? null : (data || []);
  // only real dates start ticked (spots left or a booking); the empty "phantom" ones a single Shopify product makes at every studio aren't
  const norm = t => String(t || '').toLowerCase().replace(/\s*\|.*$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byName = {}; (_m2w.items || []).forEach(i => { byName[norm(i.title)] = i.id; });
  [...new Set((_m2w.rows || []).map(r => r.title))].forEach(t => { const id = byName[norm(t)]; if (id) _m2w.gItem[t] = id; });
  (_m2w.rows || []).forEach(r => { if ((Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0) && (_m2w.gItem[r.title] || _m2w.q !== '*')) _m2w.sel.add(r.id); });
  _m2w.hideEmpty = true; m2wDraw();
}
function m2wPick(ids, on, realOnly) {   // a workshop's tick box ticks only its real dates (spots or a booking); untick clears all
  const real = id => { const r = (_m2w.rows || []).find(x => x.id === id); return r && (Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0); };
  ids.forEach(id => on ? ((!realOnly || real(id)) && _m2w.sel.add(id)) : _m2w.sel.delete(id)); m2wDraw(); }
async function m2wGo() {
  const R = _m2w.rows || [], fallback = _m2w.item;
  const groups = {}; R.filter(r => _m2w.sel.has(r.id)).forEach(r => { const item = _m2w.gItem[r.title] || fallback; (groups[item] = groups[item] || []).push(r.id); });
  const n = _m2w.sel.size, names = Object.keys(groups).map(id => ((_m2w.items || []).find(i => i.id === id) || {}).title || '?');
  if (!n || !confirm(`Move ${n} date${n === 1 ? '' : 's'} to ${names.length} World workshop${names.length === 1 ? '' : 's'}?\n\n${names.join(', ')}\n\nThey keep their spots left and bookings, and from now on the Hub keeps their spots (Shopify no longer does).`)) return;
  _m2w.msg = 'Moving…'; m2wDraw();
  const lines = [], movedIds = [];
  for (const [item, ids] of Object.entries(groups)) {
    const { data, error } = await sb.rpc('hub_move_to_world', { p_ids: ids, p_item: item });
    if (error) lines.push(`✗ ${esc(((_m2w.items || []).find(i => i.id === item) || {}).title || item)}: ${esc(error.message)}`);
    else { lines.push(`✓ <b>${esc(data.item)}</b>: ${data.moved} date${data.moved === 1 ? '' : 's'}`); movedIds.push(...ids); }
  }
  let hidden = 0;
  if (_m2w.hideEmpty && (_m2w.empty || []).length) { const h = await sb.rpc('hub_hide_empty_sessions', { p_ids: _m2w.empty }); hidden = h.error ? 0 : (h.data || 0); }
  let shop = null;
  if (_m2w.draft !== false && movedIds.length) {
    const r = await sb.functions.invoke('hub-shopify-draft', { body: { session_ids: movedIds } });
    shop = r.error ? { error: (r.data && r.data.error) || r.error.message || 'it didn\'t run' } : (r.data || {});
  }
  _m2w.msg = `${lines.join('<br>')}${hidden ? `<br>Hid ${hidden} empty date${hidden === 1 ? '' : 's'}.` : ''}<br>
    ${shop && !shop.error ? `<b>Shopify:</b> ${(shop.drafted || []).length ? `set <b>${shop.drafted.length}</b> product${shop.drafted.length === 1 ? '' : 's'} to Draft ✓` : 'no products drafted'}.
        ${(shop.kept || []).length ? `<br>Left active: ${shop.kept.map(k => `<br>· ${esc(k.title)}: ${esc(k.why)}`).join('')}` : ''}`
      : `<b>Next, in Shopify:</b> set the moved workshops' products to <b>Draft</b> (Products → search → tick → More actions → Set as draft).${shop && shop.error ? ` <small>(Drafting automatically didn't work: ${esc(shop.error)})</small>` : ''}`}`;
  _m2w.rows = null; _m2w.sel = new Set(); m2wDraw();
}

function m2Tabs(on) { return `<div class="nw-tabs">${[['', 'One-off workshops'], ['lineup', 'Lineups → by project'], ['series', 'Multi-week series → Class times'], ['camps', 'Camps & PA/PD days'], ['parties', 'Parties & get-togethers']].map(t => `<button class="${on === t[0] ? 'on' : ''}" onclick="_m2w.mode='${t[0]}';m2wDraw()">${t[1]}</button>`).join('')}</div>`; }

// ---- Move to World: lineups ("… Week Workshop Lineup", project chosen at booking) → a World workshop per project (hub_move_lineups.sql) ----
let _m2l = { q: '', rows: null, sel: new Set(), map: {}, names: {}, emptyItem: '', unchosenItem: '', rowItem: {}, hidePhantom: true, draft: true, msg: '' };
const m2lNorm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
function m2lPlanOf(r) {   // this date's plan: groups by World workshop (main first), the no-project bookings with the main
  const by = {};
  (r.groups || []).forEach(g => { const it = _m2l.map[g.key]; if (!it) return; (by[it] = by[it] || { item_id: it, kids: 0, booking_ids: [] }); by[it].kids += Number(g.kids || 0); by[it].booking_ids.push(...g.booking_ids); });
  let L = Object.values(by).sort((a, b) => b.kids - a.kids);
  const un = r.unchosen && r.unchosen.booking_ids ? r.unchosen : null;
  if (un) { const pickIt = L.length && _m2l.rowItem[r.id] ? _m2l.rowItem[r.id] : null;
    if (pickIt && !L.find(g => g.item_id === pickIt)) L.push({ item_id: pickIt, kids: 0, booking_ids: [] });
    if (L.length) { const tgt = pickIt ? L.find(g => g.item_id === pickIt) : L[0]; tgt.booking_ids.push(...un.booking_ids); tgt.kids += Number(un.kids || 0); L.sort((a, b) => b.kids - a.kids); } else if (_m2l.rowItem[r.id] || _m2l.unchosenItem) L = [{ item_id: _m2l.rowItem[r.id] || _m2l.unchosenItem, kids: Number(un.kids || 0), booking_ids: un.booking_ids.slice() }]; }
  const missing = (r.groups || []).filter(g => !_m2l.map[g.key]).map(g => g.name);
  return { groups: L, missing, booked: (r.groups || []).length > 0 || !!un };
}
function m2lHtml() {
  if (_m2w.items === null) openM2wPane();
  const R = _m2l.rows, items = m2wSorted(), nm = id => ((_m2w.items || []).find(i => i.id === id) || {}).title || '?';
  const opt = (sel, extra) => `<option value="">Choose its World workshop…</option>${extra || ''}${items.map(i => `<option value="${i.id}"${sel === i.id ? ' selected' : ''}>${esc(i.title)} · $${Number(i.price).toFixed(0)}</option>`).join('')}`;
  const keys = {}; (R || []).forEach(r => (r.groups || []).forEach(g => { (keys[g.key] = keys[g.key] || { name: _m2l.names[g.key] || g.name, kids: 0 }).kids += Number(g.kids || 0); }));
  const realRow = r => (r.groups || []).length || r.unchosen || Number(r.spots || 0) > 0;
  const sel = (R || []).filter(r => _m2l.sel.has(r.id)), plans = sel.map(r => [r, m2lPlanOf(r)]);
  const blocked = plans.filter(([r, pl]) => pl.missing.length || (!pl.booked && !_m2l.emptyItem && !r.unchosen) || (!pl.groups.length && pl.booked));
  const splits = plans.filter(([, pl]) => pl.groups.length > 1).length;
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🔁 Move to World</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${m2Tabs('lineup')}
    <div class="ho-intro">For lineups where families chose the project when they booked ("… Week Workshop Lineup"). Each date becomes the World workshop of the project its families chose. Where families chose different projects, the date becomes the most-chosen one and a date is added at the same studio and time for each other project, with those bookings moved onto it. Total spots stay the same.</div>
    <div class="mv-find"><input id="ml-q" placeholder="Lineup name, e.g. Polar Week" value="${escAttr(_m2l.q)}" onkeydown="if(event.key==='Enter')m2lFind()"><button class="ho-btn primary" onclick="m2lFind()">Find dates</button></div>
    ${_m2l.msg ? `<div class="goal-note mv-msg">${_m2l.msg}</div>` : ''}
    ${R === null ? '' : !R.length ? '<div class="goal-note">No upcoming lineup dates match.</div>' : `<div class="mv-cols"><div class="mv-left">
      <div class="mv-group"><div class="mv-gh"><b>Projects families chose</b><small>matched to World workshops by name: check each</small></div>
        <div class="oc-wrap"><table class="oc-table"><thead><tr><th>Project chosen</th><th>Kids</th><th>Becomes the World workshop</th></tr></thead><tbody>
        ${Object.entries(keys).sort((a, b) => b[1].kids - a[1].kids).map(([k, v]) => `<tr><td>${esc(v.name)}</td><td>${v.kids}</td><td><select class="mv-gsel ${_m2l.map[k] ? '' : 'none'}" onchange="_m2l.map[${escAttr(JSON.stringify(k))}]=this.value;m2wDraw()">${opt(_m2l.map[k])}</select></td></tr>`).join('') || '<tr><td colspan="3" class="goal-note">No bookings with a project yet.</td></tr>'}
        ${(() => { const U = (R || []).filter(r => !(r.groups || []).length && r.unchosen); return U.length ? `<tr><td><i>Booked, but no project recorded</i> <small>(families didn't choose one: each date has its own choice in the list below; this is for any left)</small></td><td>${U.reduce((a, r) => a + Number(r.unchosen.kids || 0), 0)} kids · ${U.length} date${U.length === 1 ? '' : 's'}</td>
          <td><select class="mv-gsel ${_m2l.unchosenItem ? '' : 'none'}" onchange="_m2l.unchosenItem=this.value;m2wDraw()">${opt(_m2l.unchosenItem)}</select></td></tr>` : ''; })()}
        <tr><td><i>Dates nobody has booked</i></td><td>${(R || []).filter(r => !(r.groups || []).length && !r.unchosen && Number(r.spots || 0) > 0).length} dates</td>
          <td><select class="mv-gsel ${_m2l.emptyItem ? '' : 'none'}" onchange="_m2l.emptyItem=this.value;m2wDraw()">${opt(_m2l.emptyItem, `<option value="hide"${_m2l.emptyItem === 'hide' ? ' selected' : ''}>Hide them (don't sell them on World)</option>`)}</select></td></tr>
        </tbody></table></div></div>
      <div class="oc-wrap"><table class="oc-table"><thead><tr><th></th><th>Studio</th><th>Date</th><th>Time</th><th>Spots left</th><th>Families chose</th><th>Becomes</th></tr></thead><tbody>
      ${R.filter(realRow).map(r => { const pl = m2lPlanOf(r); return `<tr><td><input type="checkbox" ${_m2l.sel.has(r.id) ? 'checked' : ''} onchange="this.checked?_m2l.sel.add('${r.id}'):_m2l.sel.delete('${r.id}');m2wDraw()"></td>
        <td>${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)}</td><td>${esc(new Date(r.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</td><td>${esc(shortTime(r.time))}</td><td>${r.spots ?? '—'}</td>
        <td><small>${(r.groups || []).map(g => `${esc(g.name)} ×${g.kids}`).join(' · ')}${r.unchosen ? `${(r.groups || []).length ? ' · ' : ''}<i>no project</i> ×${r.unchosen.kids}${(r.groups || []).length ? `<br><label class="ml-un">no project goes to <select onchange="_m2l.rowItem['${r.id}']=this.value;m2wDraw()"><option value="">${esc(nm((m2lPlanOf(Object.assign({}, r, { unchosen: null })).groups[0] || {}).item_id))} (this date's main)</option>${items.map(i => `<option value="${i.id}"${_m2l.rowItem[r.id] === i.id ? ' selected' : ''}>${esc(i.title)}</option>`).join('')}</select></label>` : ''}` : ''}${!(r.groups || []).length && !r.unchosen ? '<i>nobody yet</i>' : ''}</small></td>
        <td><small>${!(r.groups || []).length && r.unchosen ? `<select class="mv-gsel ${pl.groups.length ? '' : 'none'}" onchange="_m2l.rowItem['${r.id}']=this.value;m2wDraw()" title="No project was recorded: choose what this date becomes">${opt(_m2l.rowItem[r.id] || _m2l.unchosenItem)}</select>${_m2l.rowItem[r.id] && _m2l.rowSuggested && _m2l.rowSuggested[r.id] === _m2l.rowItem[r.id] ? '<br><i>suggested: what most chose that day</i>' : ''}` : pl.missing.length ? `<span style="color:#b45309">⚠ choose a workshop for ${pl.missing.map(esc).join(', ')}</span>` : pl.groups.length ? pl.groups.map((g, i) => (i ? '+ new date: ' : '') + esc(nm(g.item_id)) + ` (${g.kids})`).join('<br>') : pl.booked ? '<span style="color:#b45309">⚠ choose for "Booked, but no project recorded"</span>' : _m2l.emptyItem === 'hide' ? 'hidden' : _m2l.emptyItem ? esc(nm(_m2l.emptyItem)) : '<span style="color:#b45309">⚠ choose for empty dates</span>'}</small></td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="mv-right"><h4 style="margin:0 0 6px">Move ${sel.length} date${sel.length === 1 ? '' : 's'}</h4>
      <div class="mv-sum">${splits ? `${splits} date${splits === 1 ? '' : 's'} split into several projects (a date added for each extra project). ` : ''}${sel.reduce((a, r) => a + (r.groups || []).reduce((x, g) => x + Number(g.kids || 0), 0) + Number((r.unchosen && r.unchosen.kids) || 0), 0)} kids booked (kept).</div>
      ${(R || []).some(r => !realRow(r)) ? `<label class="mv-hide"><input type="checkbox" ${_m2l.hidePhantom ? 'checked' : ''} onchange="_m2l.hidePhantom=this.checked"> Also hide the ${(R || []).filter(r => !realRow(r)).length} empty dates (0 spots, nobody booked) from schedules</label>` : ''}
      <label class="mv-hide"><input type="checkbox" ${_m2l.draft ? 'checked' : ''} onchange="_m2l.draft=this.checked"> Set the lineup's Shopify products to Draft (only products no studio still sells on Shopify)</label>
      ${blocked.length ? `<div class="goal-note" style="color:#b45309">⚠ ${blocked.length} ticked date${blocked.length === 1 ? '' : 's'} still need a World workshop chosen (see the ⚠ rows in the table on the left).</div>` : ''}
      <button class="ho-btn sm" onclick="_m2w.newOpen=!_m2w.newOpen;m2wDraw()">${_m2w.newOpen ? '× Cancel' : '+ New World workshop'}</button>
      ${_m2w.newOpen ? m2wNewHtml() : ''}
      <button class="ho-btn primary" ${sel.length && !blocked.length ? '' : 'disabled'} onclick="m2lGo()">🔁 Move lineup to World</button></div></div>`}`;
}
async function m2lFind() {
  _m2l.q = (document.getElementById('ml-q').value || '').trim(); _m2l.msg = 'Looking…'; _m2l.rows = null; _m2l.sel = new Set(); m2wDraw();
  const { data, error } = await sb.rpc('hub_lineup_preview', { p_search: _m2l.q, p_from: null });
  _m2l.msg = error ? esc(/hub_lineup_preview/i.test(error.message) ? 'Run hub_move_lineups.sql in Supabase first.' : error.message) : '';
  _m2l.rows = error ? null : (data || []);
  const byName = {}; (_m2w.items || []).forEach(i => { byName[m2lNorm(i.title)] = i.id; });
  (_m2l.rows || []).forEach(r => { (r.groups || []).forEach(g => { if (!_m2l.names[g.key] || /^[a-z]/.test(_m2l.names[g.key])) _m2l.names[g.key] = g.name; if (!(g.key in _m2l.map) && byName[g.key]) _m2l.map[g.key] = byName[g.key]; });
    if ((r.groups || []).length || r.unchosen || Number(r.spots || 0) > 0) _m2l.sel.add(r.id); });
  const tally = (pick) => { const t = {}; (_m2l.rows || []).filter(pick).forEach(x => (x.groups || []).forEach(g => { t[g.key] = (t[g.key] || 0) + Number(g.kids || 0); }));
    const top = Object.entries(t).sort((a, b) => b[1] - a[1]).find(([k]) => _m2l.map[k]); return top ? _m2l.map[top[0]] : ''; };
  _m2l.rowItem = {}; _m2l.rowSuggested = {};
  (_m2l.rows || []).filter(r => !(r.groups || []).length && r.unchosen).forEach(r => {
    const it = tally(x => x.date === r.date && x.time === r.time) || tally(x => x.date === r.date);
    if (it) { _m2l.rowItem[r.id] = it; _m2l.rowSuggested[r.id] = it; } });
  m2wDraw();
}
async function m2lGo() {
  const R = _m2l.rows || [], sel = R.filter(r => _m2l.sel.has(r.id));
  const plan = [], hideIds = [];
  sel.forEach(r => { const pl = m2lPlanOf(r);
    if (pl.groups.length) plan.push({ session_id: r.id, groups: pl.groups.map(g => ({ item_id: g.item_id, booking_ids: g.booking_ids })) });
    else if (!pl.booked && _m2l.emptyItem === 'hide') hideIds.push(r.id);
    else if (!pl.booked && _m2l.emptyItem) plan.push({ session_id: r.id, groups: [], empty_item: _m2l.emptyItem }); });
  if (_m2l.hidePhantom) R.filter(r => !(r.groups || []).length && !r.unchosen && !Number(r.spots || 0)).forEach(r => hideIds.push(r.id));
  if (!plan.length && !hideIds.length) return;
  if (!confirm(`Move ${plan.length} lineup date${plan.length === 1 ? '' : 's'} to World${hideIds.length ? ` and hide ${hideIds.length} empty date${hideIds.length === 1 ? '' : 's'}` : ''}?\n\nBookings stay, moved to their project's date where families chose different projects.`)) return;
  _m2l.msg = 'Moving…'; m2wDraw();
  const tot = { dates_converted: 0, empty_dates_converted: 0, dates_added_for_other_projects: 0, joined_existing: 0, bookings_moved: 0, skipped: [] }; let err = '';
  for (let i = 0; i < plan.length; i += 80) {
    const { data, error } = await sb.rpc('hub_lineup_move', { p: plan.slice(i, i + 80) });
    if (error) { err = error.message; break; }
    ['dates_converted', 'empty_dates_converted', 'dates_added_for_other_projects', 'joined_existing', 'bookings_moved'].forEach(k => tot[k] += Number(data[k] || 0)); tot.skipped.push(...(data.skipped || []));
  }
  let hidden = 0;
  if (hideIds.length) { const h = await sb.rpc('hub_hide_unbooked_sessions', { p_ids: hideIds }); hidden = h.error ? 0 : (h.data || 0); }
  let shop = null;
  if (_m2l.draft && !err) {
    const originals = [...new Map(R.map(r => [r.date + r.time + r.title, { date: r.date, time: r.time, title: r.title }])).values()];
    const r = await sb.functions.invoke('hub-shopify-draft', { body: { originals } }); shop = r.error ? { error: (r.data && r.data.error) || r.error.message } : (r.data || {});
  }
  _m2l.msg = `${err ? `✗ Stopped: ${esc(err)}<br>` : ''}✓ <b>${tot.dates_converted + tot.empty_dates_converted}</b> date${tot.dates_converted + tot.empty_dates_converted === 1 ? '' : 's'} now World workshops · <b>${tot.dates_added_for_other_projects}</b> date${tot.dates_added_for_other_projects === 1 ? '' : 's'} added for other projects ${tot.joined_existing ? ` · <b>${tot.joined_existing}</b> joined the same World workshop already on at that time` : ''} · ${tot.bookings_moved} booking${tot.bookings_moved === 1 ? '' : 's'} moved${hidden ? ` · hid ${hidden} empty date${hidden === 1 ? '' : 's'}` : ''}.
    ${tot.skipped.length ? `<br>⚠ <b>${tot.skipped.length} date${tot.skipped.length === 1 ? '' : 's'} skipped</b> (left as they were, families untouched): ${tot.skipped.map(x => { const r = (R || []).find(y => y.id === x.session); return (r ? esc((STUDIO_NAMES[r.studio_id] || r.studio_id) + ' ' + r.date + ' ' + shortTime(r.time)) + ': ' : '') + esc(x.why); }).join('<br>· ')}` : ''}
    <br>${shop && !shop.error ? `<b>Shopify:</b> ${(shop.drafted || []).length ? `set <b>${shop.drafted.length}</b> product${shop.drafted.length === 1 ? '' : 's'} to Draft ✓` : 'no products drafted'}.${(shop.kept || []).length ? ` ${shop.kept.length} left active (a studio still sells them on Shopify).` : ''}`
      : `<b>Next, in Shopify:</b> set the lineup's products to <b>Draft</b>.${shop && shop.error ? ` <small>(Drafting automatically didn't work: ${esc(shop.error)})</small>` : ''}`}`;
  _m2l.rows = null; _m2l.sel = new Set(); m2wDraw();
}

// ---- Move to World: Kids and Splatter parties → World-run (world_party_move.sql). All upcoming party times at once. ----
let _m2p = { res: null, busy: false, msg: '', gt: null, gtBusy: false, gtMsg: '' };
function m2pHtml() {
  const R = _m2p.res;
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🔁 Move to World</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${m2Tabs('parties')}
    <div class="ho-intro">Every upcoming <b>Kids Party</b> and <b>Splatter Party</b> time becomes <b>World-run</b>: booked on World (priced from World settings → Party pricing, paid by Shopify invoice), and the Hub keeps their spots (the nightly Shopify sync stops changing them). Each time keeps its <b>bookings</b> and open/closed state. Kids and Splatter share the party room, so World only offers a time while a room is free in the <b>Weekly Party Slot Schedule</b> (admin → Parties). The old “Party Time Slot” leftovers (no product, nobody booked) are hidden.</div>
    ${_m2p.msg ? `<div class="goal-note mv-msg">${_m2p.msg}</div>` : ''}
    ${!R ? '<div class="goal-note">Counting…</div>' : `<div class="mv-right" style="max-width:560px">
      ${R.preview ? `<h4 style="margin:0 0 6px">Ready to move</h4>
        <div class="mv-sum"><b>${R.kids}</b> Kids party times (<b>${R.kids_booked}</b> booked, kept) · <b>${R.splatter}</b> Splatter party times (<b>${R.splatter_booked}</b> booked, kept)${R.leftovers_hidden ? ` · <b>${R.leftovers_hidden}</b> leftover “Party Time Slot” times hidden` : ''}</div>
        ${R.kids || R.splatter ? `<div class="goal-note">Then in Shopify: set the <b>Kids Party</b> and <b>Splatter Party</b> products (and their extras) to <b>Draft</b>. World keeps offering the times: World-run parties don't need the Shopify products.</div>
        <button class="ho-btn primary" ${_m2p.busy ? 'disabled' : ''} onclick="m2pRun(false)">🔁 Make all party times World-run</button>` : '<div class="goal-note">Nothing left to move: every upcoming Kids and Splatter party time is World-run.</div>'}`
      : `<h4 style="margin:0 0 6px">✅ Done</h4><div class="mv-sum"><b>${R.kids}</b> Kids and <b>${R.splatter}</b> Splatter party times are World-run (${R.kids_booked + R.splatter_booked} booked parties kept)${R.leftovers_hidden ? `, ${R.leftovers_hidden} leftovers hidden` : ''}.</div>
        <div class="goal-note">Next: set the party products to Draft in Shopify. New party times: ➕ Bulk add → Kids or Splatter party times.</div>`}</div>`}
    ${m2gHtml()}`;
}
// Adult Get-Togethers: the Shopify "Adult Get-Together Time Slot" times → World-run (hub_get_together_move)
function m2gHtml() {
  const G = _m2p.gt;
  return `<div class="mv-right" style="max-width:560px;margin-top:14px"><h4 style="margin:0 0 6px">🎉 Adult Get-Togethers</h4>
    <div class="goal-note">Upcoming get-together times still on Shopify become <b>World-run</b> (one booking each, priced from Party pricing → Adult Get-Together), keeping their spots and bookings.</div>
    ${_m2p.gtMsg ? `<div class="goal-note mv-msg">${_m2p.gtMsg}</div>` : ''}
    ${!G ? '<div class="goal-note">Counting…</div>' : G.preview
      ? (G.times ? `<div class="mv-sum"><b>${G.times}</b> get-together times (<b>${G.open}</b> open, <b>${G.booked}</b> booked, kept)</div>
          <div class="goal-note">Then in Shopify: set the <b>Adult Get-Together</b> products and their extras to <b>Draft</b>.</div>
          <button class="ho-btn primary" ${_m2p.gtBusy ? 'disabled' : ''} onclick="m2gRun(false)">🔁 Make all get-together times World-run</button>`
        : '<div class="goal-note">Nothing left to move: every upcoming get-together time is World-run.</div>')
      : `<div class="mv-sum">✅ <b>${G.times}</b> get-together times are World-run (${G.booked} booked kept).</div><div class="goal-note">Next: set the Adult Get-Together products to Draft in Shopify. New times: ➕ Bulk add → Adult Get-Together time slots.</div>`}</div>`;
}
async function m2gRun(preview) {
  if (!preview && !confirm('Make every upcoming Adult Get-Together time World-run? Bookings are kept; from now on World books them and the Hub keeps their spots.')) return;
  _m2p.gtBusy = true; _m2p.gtMsg = preview ? '' : 'Moving…'; m2wDraw();
  const { data, error } = await sb.rpc('hub_get_together_move', { p_preview: preview });
  _m2p.gtBusy = false; _m2p.gtMsg = error ? esc(/hub_get_together_move/i.test(error.message) ? 'Run world_party_move.sql in Supabase first (the latest).' : error.message) : '';
  if (!error) _m2p.gt = data; m2wDraw();
}
async function m2pRun(preview) {
  if (!preview && !confirm('Make every upcoming Kids and Splatter party time World-run? Bookings are kept; from now on World books them and the Hub keeps their spots.')) return;
  _m2p.busy = true; _m2p.msg = preview ? '' : 'Moving…'; m2wDraw();
  const { data, error } = await sb.rpc('hub_party_move', { p_preview: preview });
  _m2p.busy = false; _m2p.msg = error ? esc(/hub_party_move/i.test(error.message) ? 'Run world_party_move.sql in Supabase first.' : error.message) : '';
  if (!error) _m2p.res = data; m2wDraw();
}

// ---- Move to World: camps and PA/PD days → World-run (Stripe on World only; hub_move_camps.sql). Nothing renamed or made. ----
let _m2c = { q: '', rows: null, sel: new Set(), hide: true, msg: '' };
const m2cReal = r => Number(r[4] || 0) > 0 || Number(r[5] || 0) > 0;   // r = [id, title, studio, date, spots, booked]
function m2cHtml() {
  const R = _m2c.rows, groups = {};
  (R || []).forEach(r => (groups[r[1]] = groups[r[1]] || []).push(r));
  const sel = (R || []).filter(r => _m2c.sel.has(r[0])), empty = (R || []).filter(r => !_m2c.sel.has(r[0]) && !m2cReal(r) && !(Number(r[4]) < 0));
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🔁 Move to World</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${m2Tabs('camps')}
    <div class="ho-intro">Camps and PA/PD days become <b>World-run</b>: booked on World with Stripe only, and the Hub keeps their spots (the nightly Shopify sync stops changing them). Each day keeps its name, spots (a closing day stays below 0) and every booking: nothing is renamed or made. Afterwards, set the camp and PA/PD products to <b>Draft</b> in Shopify (Hextom bulk edit works well), then add the 4cats.com redirect.</div>
    <div class="mv-find"><input id="mc-q" placeholder="Camp name, e.g. Winter Camp, PA/PD, Summer Camp (blank = all)" value="${escAttr(_m2c.q)}" onkeydown="if(event.key==='Enter')m2cFind()"><button class="ho-btn primary" onclick="m2cFind()">Find days</button></div>
    ${_m2c.msg ? `<div class="goal-note mv-msg">${_m2c.msg}</div>` : ''}
    ${R === null ? '' : !R.length ? '<div class="goal-note">No upcoming camp or PA/PD days still on Shopify match.</div>' : `<div class="mv-cols"><div class="mv-left">
      <div class="oc-wrap"><table class="oc-table"><thead><tr><th></th><th>Camp</th><th>Days</th><th>Real days</th><th>Studios</th><th>Dates</th><th>Spots left</th><th>Booked</th></tr></thead><tbody>
      ${Object.keys(groups).sort().map(t => { const G = groups[t], RL = G.filter(r => m2cReal(r) || Number(r[4]) < 0), on = RL.length && RL.every(r => _m2c.sel.has(r[0]));
        return `<tr><td><input type="checkbox" ${on ? 'checked' : ''} onchange="m2cPick(${escAttr(JSON.stringify(t))}, this.checked)"></td><td><b>${esc(t)}</b></td><td>${G.length}</td><td>${RL.length}</td>
          <td>${new Set(RL.map(r => r[2])).size}</td><td>${fmt(G[0][3])} – ${fmt(G[G.length - 1][3])}</td>
          <td>${RL.reduce((a, r) => a + Math.max(Number(r[4] || 0), 0), 0)}${RL.some(r => Number(r[4]) < 0) ? ` <small title="days with spots below 0 (closing)">(${RL.filter(r => Number(r[4]) < 0).length} closing)</small>` : ''}</td>
          <td>${G.reduce((a, r) => a + Number(r[5] || 0), 0)}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="mv-right"><h4 style="margin:0 0 6px">Make ${sel.length} day${sel.length === 1 ? '' : 's'} World-run</h4>
      <div class="mv-sum">${sel.reduce((a, r) => a + Number(r[5] || 0), 0)} kids booked (kept) · ${sel.reduce((a, r) => a + Math.max(Number(r[4] || 0), 0), 0)} spots left (kept, now kept by the Hub)</div>
      ${empty.length ? `<label class="mv-hide"><input type="checkbox" ${_m2c.hide ? 'checked' : ''} onchange="_m2c.hide=this.checked"> Also hide the ${empty.length} empty days (0 spots, nobody booked) from schedules</label>` : ''}
      <div class="goal-note">Then in Shopify: set these camps' products to <b>Draft</b> (Hextom). World keeps showing them: World-run days don't need the Shopify product.</div>
      <button class="ho-btn primary" ${sel.length ? '' : 'disabled'} onclick="m2cGo()">🔁 Make World-run</button></div></div>`}`;
}
function m2cPick(t, on) { (_m2c.rows || []).filter(r => r[1] === t && (m2cReal(r) || Number(r[4]) < 0)).forEach(r => on ? _m2c.sel.add(r[0]) : _m2c.sel.delete(r[0])); m2wDraw(); }
async function m2cFind() {
  _m2c.q = (document.getElementById('mc-q').value || '').trim(); _m2c.msg = 'Looking…'; _m2c.rows = null; _m2c.sel = new Set(); m2wDraw();
  const { data, error } = await sb.rpc('hub_camp_preview', { p_search: _m2c.q || '*', p_from: null });
  _m2c.msg = error ? esc(/hub_camp_preview/i.test(error.message) ? 'Run hub_move_camps.sql in Supabase first.' : error.message) : '';
  _m2c.rows = error ? null : (data || []);
  (_m2c.rows || []).forEach(r => { if (m2cReal(r) || Number(r[4]) < 0) _m2c.sel.add(r[0]); });
  m2wDraw();
}
async function m2cGo() {
  const ids = [..._m2c.sel], R = _m2c.rows || [];
  if (!ids.length || !confirm(`Make ${ids.length} camp and PA/PD day${ids.length === 1 ? '' : 's'} World-run?\n\nThey keep their names, spots and bookings. From now on they're booked on World (Stripe) only, and the Hub keeps their spots.`)) return;
  _m2c.msg = 'Moving…'; m2wDraw();
  let moved = 0, err = '';
  for (let i = 0; i < ids.length; i += 1000) {
    const { data, error } = await sb.rpc('hub_camp_move', { p_ids: ids.slice(i, i + 1000) });
    if (error) { err = error.message; break; } moved += Number((data && data.moved) || 0);
  }
  let hidden = 0;
  const empty = R.filter(r => !_m2c.sel.has(r[0]) && !m2cReal(r) && !(Number(r[4]) < 0)).map(r => r[0]);
  if (!err && _m2c.hide && empty.length) for (let i = 0; i < empty.length; i += 1000) { const h = await sb.rpc('hub_hide_empty_sessions', { p_ids: empty.slice(i, i + 1000) }); hidden += h.error ? 0 : (h.data || 0); }
  _m2c.msg = `${err ? `✗ Stopped: ${esc(err)}<br>` : ''}✓ <b>${moved}</b> day${moved === 1 ? '' : 's'} now World-run${hidden ? ` · hid ${hidden} empty day${hidden === 1 ? '' : 's'}` : ''}.<br><b>Next, in Shopify:</b> set these camps' products to <b>Draft</b> (Hextom bulk edit), then add the 4cats.com redirect.`;
  _m2c.rows = null; _m2c.sel = new Set(); m2wDraw();
}

// ---- Move to World: multi-week series (e.g. Make the Gift: "3 Week Session" + "Class 2 of 3"…) → a class page's class times (hub_move_series.sql) ----
let _m2s = { q: '', rows: null, sel: new Set(), pages: null, page: '', msg: '', hide: true, draft: true };
async function m2sLoadPages() { if (_m2s.pages) return; const r = await sb.rpc('world_class_pages_list'); _m2s.pages = r.error ? [] : (r.data || []); m2wDraw(); }
function m2sHtml() {
  if (_m2s.pages === null) m2sLoadPages();
  const R = _m2s.rows, groups = {}; (R || []).forEach(r => (groups[r.base] = groups[r.base] || []).push(r));
  const real = r => Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0;
  const nSel = _m2s.sel.size, selRows = (R || []).filter(r => _m2s.sel.has(r.id)), empty = (R || []).filter(r => !_m2s.sel.has(r.id) && !real(r));
  const pages = (_m2s.pages || []).slice().sort((x, y) => String(x.name).localeCompare(String(y.name)));
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🔁 Move to World</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${m2Tabs('series')}
    <div class="ho-intro">For classes sold as a run of weeks on Shopify (week 1 "… | 3 Week Session", then "Class 2 of 3"…). Each real run becomes one <b>class time</b> on a World class page: its studio, start date, time, weeks and ages (from the title), with its spots. Its existing sessions are linked (no new sessions), and every booked family is put on all the weeks. Pricing and the page come from World settings → Kids classes.</div>
    <div class="mv-find"><input id="ms-q" placeholder="Class name, e.g. Make the Gift" value="${escAttr(_m2s.q)}" onkeydown="if(event.key==='Enter')m2sFind()"><button class="ho-btn primary" onclick="m2sFind()">Find runs</button></div>
    ${_m2s.msg ? `<div class="goal-note mv-msg">${_m2s.msg}</div>` : ''}
    ${R === null ? '' : !R.length ? '<div class="goal-note">No upcoming Shopify runs match.</div>' : `<div class="mv-cols"><div class="mv-left">
      ${Object.keys(groups).map(t => { const G = groups[t]; return `<div class="mv-group"><div class="mv-gh"><b>${esc(t)}</b><small>${G.length} run${G.length === 1 ? '' : 's'} · ${G.filter(real).length} real · ${G.reduce((a, r) => a + Number(r.booked || 0), 0)} kids booked</small></div>
        <div class="oc-wrap"><table class="oc-table"><thead><tr><th></th><th>Studio</th><th>Starts</th><th>Time</th><th>Weeks found</th><th>Spots left</th><th>Booked</th></tr></thead><tbody>
        ${G.map(r => `<tr><td><input type="checkbox" ${_m2s.sel.has(r.id) ? 'checked' : ''} onchange="this.checked?_m2s.sel.add('${r.id}'):_m2s.sel.delete('${r.id}');m2wDraw()"></td><td>${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)}</td>
          <td>${esc(new Date(r.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</td><td>${esc(shortTime(r.time))}</td>
          <td>${Number(r.found) >= Number(r.weeks) ? `${r.found} of ${r.weeks}` : `<span style="color:#b45309">⚠ ${r.found} of ${r.weeks}</span>`}</td><td>${r.spots ?? '—'}</td><td>${r.booked}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('')}
    </div><div class="mv-right"><h4 style="margin:0 0 6px">Move ${nSel} run${nSel === 1 ? '' : 's'} to the class page:</h4>
      <select id="ms-page" onchange="_m2s.page=this.value;m2wDraw()"><option value="">Choose the World class page…</option>${pages.map(pg => `<option value="${pg.id}"${_m2s.page === pg.id ? ' selected' : ''}>${esc(pg.name)}${pg.slug ? ' (' + esc(pg.slug) + ')' : ''}</option>`).join('')}</select>
      ${empty.length ? `<label class="mv-hide"><input type="checkbox" ${_m2s.hide ? 'checked' : ''} onchange="_m2s.hide=this.checked"> Also hide the ${empty.length} empty run${empty.length === 1 ? '' : 's'} (0 spots, nobody booked) from schedules</label>` : ''}
      <label class="mv-hide"><input type="checkbox" ${_m2s.draft ? 'checked' : ''} onchange="_m2s.draft=this.checked"> Set their Shopify products to Draft (only products no studio still sells on Shopify)</label>
      <div class="mv-sum">${nSel ? `${nSel} class time${nSel === 1 ? '' : 's'} · ${selRows.reduce((a, r) => a + Number(r.booked || 0), 0)} kids booked (kept, on every week) · ${selRows.reduce((a, r) => a + Number(r.spots || 0), 0)} spots left (kept)` : 'Tick the runs to move.'}</div>
      <button class="ho-btn primary" ${nSel && _m2s.page ? '' : 'disabled'} onclick="m2sGo()">🔁 Move to class times</button></div></div>`}`;
}
async function m2sFind() {
  _m2s.q = (document.getElementById('ms-q').value || '').trim(); _m2s.msg = 'Looking…'; _m2s.rows = null; _m2s.sel = new Set(); m2wDraw();
  const { data, error } = await sb.rpc('hub_series_preview', { p_search: _m2s.q, p_from: null });
  _m2s.msg = error ? esc(/hub_series_preview/i.test(error.message) ? 'Run hub_move_series.sql in Supabase first.' : error.message) : '';
  _m2s.rows = error ? null : (data || []);
  (_m2s.rows || []).forEach(r => { if (Number(r.spots || 0) > 0 || Number(r.booked || 0) > 0) _m2s.sel.add(r.id); });
  if (!_m2s.page && _m2s.pages) { const m = _m2s.pages.find(pg => String(pg.name || '').toLowerCase().includes(_m2s.q.toLowerCase())); if (m) _m2s.page = m.id; }
  m2wDraw();
}
async function m2sGo() {
  const R = _m2s.rows || [], ids = [..._m2s.sel], pg = (_m2s.pages || []).find(x => x.id === _m2s.page);
  if (!pg || !ids.length || !confirm(`Move ${ids.length} run${ids.length === 1 ? '' : 's'} to class times on "${pg.name}"?\n\nTheir sessions are linked (none made), spots kept, and every booked family put on all the weeks.`)) return;
  const originals = R.filter(r => _m2s.sel.has(r.id)).map(r => ({ date: r.date, time: r.time, title: r.title }));
  _m2s.msg = 'Moving…'; m2wDraw();
  const { data, error } = await sb.rpc('hub_move_series', { p_ids: ids, p_page: pg.id });
  if (error) { _m2s.msg = esc('Not moved: ' + error.message); m2wDraw(); return; }
  let hidden = 0;
  const empty = R.filter(r => !_m2s.sel.has(r.id) && !Number(r.spots || 0) && !Number(r.booked || 0)).map(r => r.id);
  if (_m2s.hide && empty.length) { const h = await sb.rpc('hub_hide_empty_series', { p_ids: empty }); hidden = h.error ? 0 : (h.data || 0); }
  let shop = null;
  if (_m2s.draft) { const r = await sb.functions.invoke('hub-shopify-draft', { body: { originals } }); shop = r.error ? { error: (r.data && r.data.error) || r.error.message } : (r.data || {}); }
  _m2s.msg = `✓ <b>${data.class_times}</b> class time${data.class_times === 1 ? '' : 's'} on <b>${esc(data.page)}</b> · ${data.later_weeks_linked} later weeks linked · ${data.families_copied} family booking${data.families_copied === 1 ? '' : 's'} added to later weeks${hidden ? ` · hid ${hidden} empty run${hidden === 1 ? '' : 's'}` : ''}.
    ${(data.skipped || []).length ? `<br>⚠ ${data.skipped.map(x => esc(x.why)).join('<br>⚠ ')}` : ''}
    <br>${shop && !shop.error ? `<b>Shopify:</b> ${(shop.drafted || []).length ? `set <b>${shop.drafted.length}</b> product${shop.drafted.length === 1 ? '' : 's'} to Draft ✓` : 'no products drafted'}.${(shop.kept || []).length ? `<br>Left active: ${shop.kept.map(k => `<br>· ${esc(k.title)}: ${esc(k.why)}`).join('')}` : ''}`
      : `<b>Next, in Shopify:</b> set the moved runs' products to <b>Draft</b>.${shop && shop.error ? ` <small>(Drafting automatically didn't work: ${esc(shop.error)})</small>` : ''}`}
    <br>Check them in <b>Hub → Class times</b> and on the class page in World.`;
  _m2s.rows = null; _m2s.sel = new Set(); m2wDraw();
}

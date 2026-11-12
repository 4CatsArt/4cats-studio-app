// hub/calendar.js: 📅 Calendar for home office (Nov 12 2026; hub_calendar.sql). Month, week and agenda views of hub_cal_range:
// 💵 paydays and pay period ends, 🌴 approved time off and no-time-off dates, 📧 newsletter sends, 🏷️ deals of the day, and your own
// 📌 events and 🗺️ planning items (for everyone at home office, or just you). Layers switch on and off (remembered on this computer).
// Loaded by hub.html after dashboard.js. Weeks start on Sunday, like pay periods.

if (typeof PANES !== 'undefined' && !PANES.includes('cal-pane')) PANES.push('cal-pane');
const CAL_LAYERS = [
  ['event', '📌 Events', '#6d4aeb'], ['planning', '🗺️ Planning', '#e8710a'], ['pay', '💵 Pay', '#2e7d32'],
  ['time_off', '🌴 Time off', '#00897b'], ['newsletters', '📧 Newsletters', '#1e66c9'], ['deals', '🏷️ Deals', '#d6337a']];
const _cal = { view: 'month', day: null, items: [], from: null, to: null, err: '', loading: false, off: {} };
try { _cal.off = JSON.parse(localStorage.getItem('hub-cal-off') || '{}') || {}; _cal.view = localStorage.getItem('hub-cal-view') || 'month'; } catch (e) { }

const calIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const calD = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
const calAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const calCol = layer => (CAL_LAYERS.find(l => l[0] === layer) || [, , '#6b6a80'])[2];
const calTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); };

function openCalPane() {
  showOnlyPane('cal-pane'); setActiveNav('nav-cal');
  if (!_cal.day) _cal.day = calD(calIso(new Date()));
  calStyles(); calLoad();
}
function calRange() {   // the dates the current view shows
  const d = _cal.day;
  if (_cal.view === 'week') { const a = calAdd(d, -d.getDay()); return [a, calAdd(a, 6)]; }
  if (_cal.view === 'agenda') return [d, calAdd(d, 34)];
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 12), a = calAdd(first, -first.getDay());
  return [a, calAdd(a, 41)];
}
async function calLoad() {
  const [a, z] = calRange(); _cal.from = calIso(a); _cal.to = calIso(z); _cal.loading = true; calDraw();
  const want = _cal.from + _cal.to;
  const { data, error } = await sb.rpc('hub_cal_range', { p_from: _cal.from, p_to: _cal.to, p_layers: null });
  if (_cal.from + _cal.to !== want) return;   // (they moved on while it loaded)
  _cal.loading = false; _cal.err = error ? (/hub_cal_range/.test(error.message) ? 'Run the calendar SQL (step 1) in Supabase first.' : error.message) : '';
  _cal.items = data || []; calDraw();
}
function calShown() { return _cal.items.filter(x => !_cal.off[x.layer]); }
function calOn(dateIso) { return calShown().filter(x => x.start_date <= dateIso && x.end_date >= dateIso); }
function calMove(n) {
  const d = _cal.day;
  _cal.day = _cal.view === 'month' ? new Date(d.getFullYear(), d.getMonth() + n, 1, 12) : calAdd(d, n * (_cal.view === 'week' ? 7 : 35));
  calLoad();
}
function calToday() { _cal.day = calD(calIso(new Date())); calLoad(); }
function calView(v) { _cal.view = v; try { localStorage.setItem('hub-cal-view', v); } catch (e) { } calLoad(); }
function calLayer(k) { _cal.off[k] = !_cal.off[k]; try { localStorage.setItem('hub-cal-off', JSON.stringify(_cal.off)); } catch (e) { } calDraw(); }

function calChip(x, i, dayIso) {
  const t = x.all_day ? '' : `<span class="cal-t">${esc(calTime(x.start_time))}</span> `;
  const cont = x.start_date < dayIso ? ' cont' : '';
  return `<button class="cal-chip${cont}" style="--c:${escAttr(x.colour || calCol(x.layer))}" onclick="event.stopPropagation();calOpen(${i})" title="${escAttr(x.title)}">${t}${esc(x.title)}${x.visibility === 'me' ? ' 🔒' : ''}</button>`;
}
function calDraw() {
  const el = document.getElementById('cal-pane'); if (!el) return;
  const d = _cal.day, todayIso = calIso(new Date()), S = calShown();
  const idx = x => _cal.items.indexOf(x);
  const title = _cal.view === 'month' ? d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    : _cal.view === 'week' ? (() => { const [a, z] = calRange(); return a.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' – ' + z.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); })()
    : 'From ' + d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  let body = '';
  if (_cal.err) body = `<p class="fd-msg">${esc(_cal.err)}</p>`;
  else if (_cal.view === 'month') {
    const [a] = calRange(), m = d.getMonth();
    body = '<div class="cal-grid"><div class="cal-hd">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => `<span>${w}</span>`).join('') + '</div><div class="cal-days">';
    for (let i = 0; i < 42; i++) {
      const day = calAdd(a, i), iso = calIso(day), L = calOn(iso);
      body += `<div class="cal-day${day.getMonth() !== m ? ' other' : ''}${iso === todayIso ? ' today' : ''}" onclick="calNew('${iso}')" title="Add an event on this day">
        <div class="cal-dn">${day.getDate()}</div>${L.slice(0, 4).map(x => calChip(x, idx(x), iso)).join('')}${L.length > 4 ? `<button class="cal-more" onclick="event.stopPropagation();_cal.day=calD('${iso}');calView('week')">+${L.length - 4} more</button>` : ''}</div>`;
    }
    body += '</div></div>';
  } else if (_cal.view === 'week') {
    const [a] = calRange();
    body = '<div class="cal-week">';
    for (let i = 0; i < 7; i++) {
      const day = calAdd(a, i), iso = calIso(day), L = calOn(iso);
      body += `<div class="cal-wcol${iso === todayIso ? ' today' : ''}"><div class="cal-wh" onclick="calNew('${iso}')" title="Add an event on this day"><b>${day.toLocaleDateString('en-CA', { weekday: 'short' })}</b> ${day.getDate()}</div>
        ${L.map(x => calChip(x, idx(x), iso)).join('') || '<div class="cal-none">—</div>'}<button class="cal-add" onclick="calNew('${iso}')">+</button></div>`;
    }
    body += '</div>';
  } else {
    const days = {}; S.forEach(x => { let c = calD(x.start_date < _cal.from ? _cal.from : x.start_date); const end = x.end_date > _cal.to ? _cal.to : x.end_date;
      while (calIso(c) <= end) { (days[calIso(c)] = days[calIso(c)] || []).push(x); c = calAdd(c, 1); } });
    const keys = Object.keys(days).sort();
    body = keys.length ? '<div class="cal-agenda">' + keys.map(k => `<div class="cal-ag-day${k === todayIso ? ' today' : ''}"><div class="cal-ag-h">${esc(calD(k).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }))}${k === todayIso ? ' · Today' : ''}</div>
        ${days[k].map(x => `<button class="cal-ag-row" style="--c:${escAttr(x.colour || calCol(x.layer))}" onclick="calOpen(${idx(x)})"><span class="cal-ag-t">${x.all_day ? 'All day' : esc(calTime(x.start_time) + '–' + calTime(x.end_time))}</span><span class="cal-ag-x"><b>${esc(x.title)}${x.visibility === 'me' ? ' 🔒' : ''}</b>${x.location || x.note ? `<span class="fd-sm">${esc(x.location || x.note)}</span>` : ''}</span></button>`).join('')}</div>`).join('') + '</div>'
      : '<p class="ho-intro">Nothing in the next 5 weeks on the layers you’ve switched on.</p>';
  }
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📅 Calendar</div><span class="spacer"></span>
      <button class="ho-btn primary" onclick="calNew()">+ Add event</button></div>
    <div class="cal-bar"><div class="cal-nav"><button class="ho-btn" onclick="calMove(-1)" title="Back">◀</button><button class="ho-btn" onclick="calToday()">Today</button><button class="ho-btn" onclick="calMove(1)" title="Forward">▶</button>
        <b class="cal-title">${esc(title)}</b>${_cal.loading ? '<span class="fd-sm">Loading…</span>' : ''}</div>
      <div class="cal-views">${[['month', 'Month'], ['week', 'Week'], ['agenda', 'Agenda']].map(([v, l]) => `<button class="${_cal.view === v ? 'on' : ''}" onclick="calView('${v}')">${l}</button>`).join('')}</div></div>
    <div class="cal-layers">${CAL_LAYERS.map(([k, l, c]) => `<button class="cal-lay${_cal.off[k] ? ' off' : ''}" style="--c:${c}" onclick="calLayer('${k}')" title="${_cal.off[k] ? 'Show' : 'Hide'} ${escAttr(l)}"><i></i>${l}</button>`).join('')}</div>
    ${body}`;
}

// ---------- an item: details (and edit, for events) ----------
function calOpen(i) {
  const x = _cal.items[i]; if (!x) return;
  if ((x.layer === 'event' || x.layer === 'planning') && x.editable) { calForm(x); return; }
  const when = calWhen(x);
  const link = { time_off: ['openTsPane', 'Timesheets'], newsletters: ['openNewsPane', 'Newsletters'] }[x.layer];
  openDutySheet(`<h3 style="margin:0 0 4px">${esc(x.title)}</h3><p class="fd-sm" style="margin:0 0 10px">${esc(when)}</p>
    ${x.note ? `<p style="margin:0 0 8px">${esc(x.note)}</p>` : ''}${x.notes ? `<p style="white-space:pre-wrap;margin:0 0 8px">${esc(x.notes)}</p>` : ''}${x.location ? `<p style="margin:0 0 8px">📍 ${calLinkify(x.location)}</p>` : ''}
    ${x.by ? `<p class="fd-sm">Added by ${esc(x.by)}${x.visibility === 'me' ? ' · only they can see it' : ''}</p>` : ''}
    <div style="text-align:right;margin-top:12px">${link && typeof window[link[0]] === 'function' ? `<button class="ho-btn" onclick="closeDutySheet();${link[0]}()">Open ${link[1]}</button> ` : ''}<button class="ho-btn primary" onclick="closeDutySheet()">Close</button></div>`);
}
function calWhen(x) {
  const f = s => calD(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const days = x.start_date === x.end_date ? f(x.start_date) : f(x.start_date) + ' – ' + f(x.end_date);
  return x.all_day ? days + ' · all day' : days + ' · ' + calTime(x.start_time) + '–' + calTime(x.end_time);
}
function calLinkify(s) { const t = esc(s); return /^https?:\/\/\S+$/.test(String(s).trim()) ? `<a href="${escAttr(String(s).trim())}" target="_blank" rel="noopener">${t}</a>` : t; }

// ---------- add or change an event ----------
function calNew(iso) { calForm({ start_date: iso || calIso(_cal.day || new Date()), end_date: iso || calIso(_cal.day || new Date()), all_day: true, layer: 'event', visibility: 'office' }); }
function calForm(x) {
  _cal.edit = x;
  const v = k => escAttr(x[k] || '');
  openDutySheet(`<h3 style="margin:0 0 10px">${x.id ? 'Change event' : '+ Add event'}</h3>
    <div class="cal-form">
      <label class="wide">Title<input id="cf-title" maxlength="200" value="${v('title')}" placeholder="e.g. Team meeting"></label>
      <label>Starts<input id="cf-sd" type="date" value="${v('start_date')}" onchange="const e=document.getElementById('cf-ed');if(e.value<this.value)e.value=this.value"></label>
      <label>Ends<input id="cf-ed" type="date" value="${v('end_date')}"></label>
      <label class="wide cal-chk"><input id="cf-allday" type="checkbox" ${x.all_day !== false ? 'checked' : ''} onchange="document.getElementById('cf-times').hidden=this.checked"> All day</label>
      <div id="cf-times" class="wide cal-two" ${x.all_day !== false ? 'hidden' : ''}><label>From<input id="cf-st" type="time" step="300" value="${v('start_time')}"></label><label>To<input id="cf-et" type="time" step="300" value="${v('end_time')}"></label></div>
      <label class="wide">Where or Zoom link (optional)<input id="cf-loc" maxlength="300" value="${v('location')}" placeholder="e.g. https://zoom.us/j/… or Victoria office"></label>
      <label class="wide">Notes (optional)<textarea id="cf-notes" rows="3" maxlength="4000">${esc(x.notes || '')}</textarea></label>
      <label>Kind<select id="cf-layer"><option value="event"${x.layer !== 'planning' ? ' selected' : ''}>📌 Event</option><option value="planning"${x.layer === 'planning' ? ' selected' : ''}>🗺️ Planning</option></select></label>
      <label>Who sees it<select id="cf-vis" ${x.id && !x.mine ? 'disabled title="Only the person who added it can change this"' : ''}><option value="office"${x.visibility !== 'me' ? ' selected' : ''}>Everyone at home office</option><option value="me"${x.visibility === 'me' ? ' selected' : ''}>Just me 🔒</option></select></label>
    </div>
    ${x.id && x.by ? `<p class="fd-sm" style="margin:8px 0 0">Added by ${esc(x.by)}</p>` : ''}
    <div class="fd-msg" id="cf-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px">${x.id ? '<button class="ho-btn" style="color:#c62828" onclick="calDelete()">Delete</button>' : ''}<span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Cancel</button><button class="ho-btn primary" onclick="calSave()">Save</button></div>`);
  setTimeout(() => { const t = document.getElementById('cf-title'); if (t && !x.id) t.focus(); }, 50);
}
async function calSave() {
  const g = id => (document.getElementById(id) || {}).value || '', all = document.getElementById('cf-allday').checked, msg = document.getElementById('cf-msg');
  const p = { id: (_cal.edit && _cal.edit.id) || null, title: g('cf-title').trim(), start_date: g('cf-sd'), end_date: g('cf-ed') || g('cf-sd'),
    start_time: all ? null : g('cf-st') || null, end_time: all ? null : g('cf-et') || null, location: g('cf-loc'), notes: g('cf-notes'), layer: g('cf-layer'), visibility: g('cf-vis') };
  if (!p.title) { msg.textContent = 'Give it a title.'; return; }
  if (!all && (!p.start_time || !p.end_time)) { msg.textContent = 'Choose both times, or tick All day.'; return; }
  const { error } = await sb.rpc('hub_cal_event_save', { p });
  if (error) { msg.textContent = error.message; return; }
  closeDutySheet(); calLoad();
}
async function calDelete() {
  if (!_cal.edit || !_cal.edit.id || !confirm('Delete “' + _cal.edit.title + '”?')) return;
  const { error } = await sb.rpc('hub_cal_event_delete', { p_id: _cal.edit.id });
  if (error) { document.getElementById('cf-msg').textContent = error.message; return; }
  closeDutySheet(); calLoad();
}

function calStyles() {
  if (document.getElementById('cal-css')) return;
  const st = document.createElement('style'); st.id = 'cal-css';
  st.textContent = `
#cal-pane .cal-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin: 10px 0; }
#cal-pane .cal-nav { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } #cal-pane .cal-title { font-size: 18px; margin-left: 6px; }
#cal-pane .cal-views { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: #fff; }
#cal-pane .cal-views button { border: 0; background: none; padding: 7px 14px; font: inherit; font-weight: 600; cursor: pointer; color: var(--ink); }
#cal-pane .cal-views button.on { background: var(--accent); color: #fff; }
#cal-pane .cal-layers { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
#cal-pane .cal-lay { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 4px 12px 4px 8px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); }
#cal-pane .cal-lay i { width: 12px; height: 12px; border-radius: 4px; background: var(--c); } #cal-pane .cal-lay.off { opacity: .45; } #cal-pane .cal-lay.off i { background: transparent; border: 2px solid var(--c); }
#cal-pane .cal-grid { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
#cal-pane .cal-hd { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); background: #f7f6fb; font-size: 12px; font-weight: 700; color: var(--ink-soft); }
#cal-pane .cal-hd span { padding: 6px 8px; }
#cal-pane .cal-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: minmax(108px, auto); }
#cal-pane .cal-day { border-top: 1px solid var(--border); border-left: 1px solid var(--border); padding: 4px 4px 6px; min-width: 0; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
#cal-pane .cal-day:nth-child(7n+1) { border-left: 0; } #cal-pane .cal-day.other { background: #fbfbfd; } #cal-pane .cal-day.other .cal-dn { color: #b7b5c6; }
#cal-pane .cal-day:hover { background: #f8f6ff; }
#cal-pane .cal-dn { font-size: 12px; font-weight: 700; padding: 2px 4px; align-self: flex-start; border-radius: 999px; min-width: 22px; text-align: center; }
#cal-pane .cal-day.today .cal-dn { background: var(--accent); color: #fff; }
#cal-pane .cal-chip { display: block; width: 100%; text-align: left; border: 0; border-left: 3px solid var(--c); background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--ink); border-radius: 5px;
  padding: 2px 6px; font: inherit; font-size: 12px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
#cal-pane .cal-chip.cont { border-left-style: dashed; } #cal-pane .cal-chip:hover { background: color-mix(in srgb, var(--c) 22%, #fff); } #cal-pane .cal-t { font-weight: 700; }
#cal-pane .cal-more { border: 0; background: none; color: var(--accent); font: inherit; font-size: 12px; font-weight: 700; text-align: left; padding: 0 6px; cursor: pointer; }
#cal-pane .cal-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
#cal-pane .cal-wcol { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 0; min-height: 220px; }
#cal-pane .cal-wcol.today { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
#cal-pane .cal-wh { font-size: 13px; padding: 2px 4px 6px; border-bottom: 1px solid var(--border); margin-bottom: 2px; cursor: pointer; }
#cal-pane .cal-wcol .cal-chip { white-space: normal; } #cal-pane .cal-none { color: #c4c2d2; font-size: 12px; padding: 2px 6px; }
#cal-pane .cal-add { margin-top: auto; border: 1px dashed var(--border); background: none; border-radius: 8px; color: var(--ink-soft); cursor: pointer; font: inherit; padding: 2px; }
#cal-pane .cal-agenda { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }
#cal-pane .cal-ag-day { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 8px 10px; } #cal-pane .cal-ag-day.today { border-color: var(--accent); }
#cal-pane .cal-ag-h { font-weight: 800; font-size: 13px; color: var(--ink-soft); margin-bottom: 4px; }
#cal-pane .cal-ag-row { display: flex; gap: 12px; width: 100%; text-align: left; border: 0; border-left: 4px solid var(--c); background: none; padding: 6px 8px; font: inherit; color: var(--ink); cursor: pointer; border-radius: 4px; }
#cal-pane .cal-ag-row:hover { background: #f7f6fb; } #cal-pane .cal-ag-t { width: 120px; flex: none; font-size: 13px; color: var(--ink-soft); }
#cal-pane .cal-ag-x { display: flex; flex-direction: column; min-width: 0; }
.cal-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; } .cal-form label { display: flex; flex-direction: column; gap: 3px; font-size: 13px; font-weight: 600; }
.cal-form .wide { grid-column: 1 / -1; } .cal-form input:not([type=checkbox]), .cal-form select, .cal-form textarea { padding: 7px 9px; border: 1px solid #ddd; border-radius: 8px; font: inherit; font-weight: 400; }
.cal-form .cal-chk { flex-direction: row; align-items: center; gap: 8px; } .cal-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .cal-two[hidden] { display: none; }
@media (max-width: 760px) { #cal-pane .cal-week { grid-template-columns: 1fr; } #cal-pane .cal-days { grid-auto-rows: minmax(64px, auto); } #cal-pane .cal-chip { font-size: 10.5px; padding: 1px 4px; } }`;
  document.head.appendChild(st);
}

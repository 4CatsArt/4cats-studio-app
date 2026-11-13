// hub/calendar.js: 📅 Calendar for home office (Nov 12 2026; hub_calendar.sql). Month, week and agenda views of hub_cal_range:
// 💵 paydays and pay period ends, 🌴 approved time off and no-time-off dates, 📧 newsletter sends, 🏷️ deals of the day, and your own
// 📌 events and 🗺️ planning items (for everyone at home office, or just you). Layers switch on and off (remembered on this computer).
// Loaded by hub.html after dashboard.js. Weeks start on Sunday, like pay periods.
// (Nov 12 2026: 👥 meetings and 1:1s (hub_calendar_meetings.sql): invite home office people, Yes / Maybe / No, repeats, skip a
// date, agenda, and notes for each date: shared with the people invited; a 1:1's only the two of you.)
// (Nov 12 2026: ⚙ My calendar settings: your Zoom link (fills in new meetings) and time zone (hub_cal_settings); email invites,
// updates and cancellations through the hub-cal-invite Edge Function; hub.html#cal-<id> ("Answer in the Hub") opens that meeting.)
// (Nov 12 2026: 📞 Call types (hub_calendar_appointments.sql): set up calls coordinators can book with you (open hours, length,
// buffer, notice…); booked calls show on 👥 Meetings, and open with who, their answer, Join and Cancel. Booking: hub/appt.js.)
// (Nov 12 2026: 🚫 "Blocks my call times" on your events, for people coordinators can book calls with (hub_calendar_busy.sql):
// on by default for timed events and "just me" days, off for shared all-day ones. Approved time off blocks call times too.)

if (typeof PANES !== 'undefined' && !PANES.includes('cal-pane')) PANES.push('cal-pane');
const CAL_LAYERS = [
  ['meeting', '👥 Meetings', '#0e7490'], ['event', '📌 Events', '#6d4aeb'], ['planning', '🗺️ Planning', '#e8710a'], ['pay', '💵 Pay', '#2e7d32'],
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
  calStyles(); calLoad(); calMe().catch(() => {}); calHasTypes();
}
// do coordinators book calls with you? (then your events show 🚫 Blocks my call times)
async function calHasTypes() {
  try { const { data, error } = await sb.rpc('hub_appt_types_mine'); _cal.hasTypes = !error && (data || []).some(t => t.active); } catch (e) { _cal.hasTypes = false; }
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
  const mk = x.layer === 'meeting' ? (x.my_response === 'pending' ? '❔ ' : x.my_response === 'no' ? '' : '') + (x.kind === 'one_on_one' ? '1:1 ' : '👥 ') : '';
  return `<button class="cal-chip${cont}${x.my_response === 'no' ? ' declined' : ''}" style="--c:${escAttr(x.colour || calCol(x.layer))}" onclick="event.stopPropagation();calOpen(${i})" title="${escAttr(x.title)}${x.my_response === 'pending' ? ' (not answered yet)' : ''}">${t}${mk}${esc(x.title)}${x.visibility === 'me' ? ' 🔒' : ''}</button>`;
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
      <button class="ho-btn" onclick="calSettings()" title="Your Zoom link and time zone">⚙</button><button class="ho-btn" onclick="calApptTypes()" title="Calls coordinators can book with you">📞 Call types</button><button class="ho-btn" onclick="calNew(null, 'one_on_one')">+ 1:1</button><button class="ho-btn" onclick="calNew(null, 'meeting')">+ Meeting</button><button class="ho-btn primary" onclick="calNew()">+ Add event</button></div>
    <div class="cal-bar"><div class="cal-nav"><button class="ho-btn" onclick="calMove(-1)" title="Back">◀</button><button class="ho-btn" onclick="calToday()">Today</button><button class="ho-btn" onclick="calMove(1)" title="Forward">▶</button>
        <b class="cal-title">${esc(title)}</b>${_cal.loading ? '<span class="fd-sm">Loading…</span>' : ''}</div>
      <div class="cal-views">${[['month', 'Month'], ['week', 'Week'], ['agenda', 'Agenda']].map(([v, l]) => `<button class="${_cal.view === v ? 'on' : ''}" onclick="calView('${v}')">${l}</button>`).join('')}</div></div>
    <div class="cal-layers">${CAL_LAYERS.map(([k, l, c]) => `<button class="cal-lay${_cal.off[k] ? ' off' : ''}" style="--c:${c}" onclick="calLayer('${k}')" title="${_cal.off[k] ? 'Show' : 'Hide'} ${escAttr(l)}"><i></i>${l}</button>`).join('')}</div>
    ${body}`;
}

// ---------- an item: details (and edit, for events) ----------
function calOpen(i) {
  const x = _cal.items[i]; if (!x) return;
  if (x.kind === 'call') { calCall(i); return; }
  if (x.layer === 'meeting') { calMeeting(i); return; }
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
  const rp = { weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'every month' }[x.repeat];
  return (x.all_day ? days + ' · all day' : days + ' · ' + calTime(x.start_time) + '–' + calTime(x.end_time)) + (rp ? ' · repeats ' + rp + (x.repeat_until ? ' until ' + calD(x.repeat_until).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '') : '');
}
function calLinkify(s) { const t = esc(s); return /^https?:\/\/\S+$/.test(String(s).trim()) ? `<a href="${escAttr(String(s).trim())}" target="_blank" rel="noopener">${t}</a>` : t; }

// ---------- 👥 a meeting or 1:1: who's coming, your answer, the agenda, and notes for this date ----------
async function calMeeting(i) {
  const x = _cal.items[i]; if (!x) return; _cal.edit = x;
  const R = { yes: '✅ Going', maybe: '🤔 Maybe', no: '❌ Not going', pending: '❔ Not answered' };
  const zoom = x.location && /^https?:\/\//.test(x.location.trim()) ? `<a class="ho-btn primary" href="${escAttr(x.location.trim())}" target="_blank" rel="noopener">🎥 Join</a>` : x.location ? `<p style="margin:0 0 8px">📍 ${esc(x.location)}</p>` : '';
  openDutySheet(`<h3 style="margin:0 0 2px">${x.kind === 'one_on_one' ? '1:1 · ' : '👥 '}${esc(x.title)}</h3><p class="fd-sm" style="margin:0 0 10px">${esc(calWhen(x))}</p>
    ${zoom ? `<div style="margin:0 0 10px">${zoom}</div>` : ''}
    ${x.agenda ? `<div class="cal-lbl">Agenda</div><p style="white-space:pre-wrap;margin:0 0 10px">${esc(x.agenda)}</p>` : ''}
    <div class="cal-lbl">Who’s coming</div><div class="cal-att">${(x.attendees || []).map(a => `<span class="cal-a ${esc(a.response)}">${esc(a.name)} · ${R[a.response] || a.response}</span>`).join('')}</div>
    ${x.my_response ? `<div class="cal-lbl" style="margin-top:10px">Your answer</div><div class="cal-ans">${['yes', 'maybe', 'no'].map(r => `<button class="ho-btn${x.my_response === r ? ' primary' : ''}" onclick="calRespond('${r}')">${R[r]}</button>`).join('')}</div>` : ''}
    <div class="cal-lbl" style="margin-top:12px">Notes for ${esc(calD(x.start_date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} <span class="fd-sm" id="cm-by"></span></div>
    <textarea id="cm-notes" rows="5" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:8px;font:inherit" placeholder="${x.kind === 'one_on_one' ? 'Only the two of you see these.' : 'Shared with everyone invited.'}">Loading…</textarea>
    <div class="fd-msg" id="cm-msg"></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${x.mine ? `<button class="ho-btn" onclick="calForm(_cal.edit)">✏️ Change</button>${x.repeat && x.repeat !== 'none' ? '<button class="ho-btn" onclick="calSkip()">Skip this date</button>' : ''}<button class="ho-btn" style="color:#c62828" onclick="calDelete()">Delete</button>` : `<span class="fd-sm">Set up by ${esc(x.by || '')}</span>`}
      <span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Close</button><button class="ho-btn primary" onclick="calNotesSave()">Save notes</button></div>`);
  const { data, error } = await sb.rpc('hub_cal_notes_get', { p_event: x.id, p_date: x.start_date });
  const ta = document.getElementById('cm-notes'); if (!ta || _cal.edit !== x) return;
  ta.value = error ? '' : ((data && data.body) || ''); _cal.notesWas = ta.value;
  if (data && data.by) document.getElementById('cm-by').textContent = '· last saved by ' + data.by;
}
async function calRespond(r) {
  const x = _cal.edit; const { error } = await sb.rpc('hub_cal_respond', { p_event: x.id, p_response: r });
  if (error) { document.getElementById('cm-msg').textContent = error.message; return; }
  const ta = document.getElementById('cm-notes'), keep = ta ? ta.value : null;
  await calLoad();
  const i = _cal.items.findIndex(y => y.id === x.id && y.start_date === x.start_date); if (i >= 0) { await calMeeting(i); const t2 = document.getElementById('cm-notes'); if (t2 && keep !== null && keep !== _cal.notesWas) t2.value = keep; }
}
async function calNotesSave() {
  const x = _cal.edit, ta = document.getElementById('cm-notes'), msg = document.getElementById('cm-msg'); if (!x || !ta) return;
  const { error } = await sb.rpc('hub_cal_notes_save', { p_event: x.id, p_date: x.start_date, p_body: ta.value });
  if (error) { msg.textContent = error.message; return; }
  _cal.notesWas = ta.value; msg.textContent = ''; msg.innerHTML = '<span style="color:#2e7d32">✓ Notes saved</span>';
  const it = _cal.items.find(y => y.id === x.id && y.start_date === x.start_date); if (it) it.has_notes = !!ta.value.trim();
}
async function calSkip() {
  const x = _cal.edit; if (!confirm('Skip ' + calD(x.start_date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) + ' only? The other dates stay.')) return;
  const { error } = await sb.rpc('hub_cal_skip', { p_event: x.id, p_date: x.start_date, p_skip: true });
  if (error) { document.getElementById('cm-msg').textContent = error.message; return; }
  closeDutySheet(); calLoad();
  calInvite(x.id, 'send');   // (✉️ the update takes that date off their calendars)
}

// ---------- 📞 calls coordinators booked with you ----------
function calCall(i) {
  const x = _cal.items[i]; if (!x) return; _cal.edit = x;
  openDutySheet(`<h3 style="margin:0 0 2px">${esc(x.title)}</h3><p class="fd-sm" style="margin:0 0 10px">${esc(calWhen(x))}</p>
    ${x.location && /^https?:\/\//.test(x.location) ? `<div style="margin:0 0 10px"><a class="ho-btn primary" href="${escAttr(x.location)}" target="_blank" rel="noopener">🎥 Join</a></div>` : ''}
    <div class="cal-lbl">Booked by</div><p style="margin:0 0 10px">${esc(x.by)}${x.studio_id ? ' · ' + esc(STUDIO_NAMES[x.studio_id] || x.studio_id) : ''}</p>
    ${x.note ? `<div class="cal-lbl">What they want to talk about</div><p style="white-space:pre-wrap;margin:0 0 10px">${esc(x.note)}</p>` : ''}
    <div class="fd-msg" id="cc-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn" style="color:#c62828" onclick="calCallCancel()">Cancel this call</button><span style="flex:1"></span><button class="ho-btn primary" onclick="closeDutySheet()">Close</button></div>`);
}
async function calCallCancel() {
  const x = _cal.edit; if (!x || !confirm('Cancel this call? ' + (x.by || 'They') + ' will get an email.')) return;
  const { error } = await sb.rpc('hub_appt_cancel', { p_booking: x.id });
  if (error) { document.getElementById('cc-msg').textContent = error.message; return; }
  try { await fetch(`${SUPABASE_URL}/functions/v1/hub-cal-invite`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ booking_id: x.id, action: 'appt_cancel' }) }); } catch (e) { }
  closeDutySheet(); calLoad();
}
// ---------- 📞 your call types: what coordinators can book with you ----------
const CAL_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
async function calApptTypes() {
  const { data, error } = await sb.rpc('hub_appt_types_mine');
  if (error) { calToast(/hub_appt/.test(error.message) ? 'Run the appointments SQL first.' : error.message, true); return; }
  _cal.types = data || [];
  const hrs = t => (t.hours || []).map(w => `${CAL_DOW[w.dow]} ${calTime(w.start)}–${calTime(w.end)}`).join(', ');
  openDutySheet(`<h3 style="margin:0 0 4px">📞 Call types</h3><p class="fd-sm" style="margin:0 0 10px">Calls coordinators can book with you, from the Coordinator view or their own login. Booked calls show on your calendar.</p>
    ${_cal.types.length ? _cal.types.map((t, i) => `<div class="cal-at${t.active ? '' : ' off'}"><div><b>${esc(t.title)}</b> · ${t.minutes} min${t.active ? '' : ' · <i>off</i>'}<div class="fd-sm">${esc(hrs(t))} · ${t.upcoming} upcoming</div></div><button class="ho-btn sm" onclick="calApptForm(${i})">Change</button></div>`).join('')
      : '<p class="fd-sm">None yet.</p>'}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn primary" onclick="calApptForm(-1)">+ New call type</button><span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Close</button></div>`);
}
function calApptForm(i) {
  const t = i >= 0 ? _cal.types[i] : { title: 'Coordinator check-in', minutes: 30, buffer_min: 10, notice_hours: 24, ahead_days: 21, max_per_day: null, cancel_hours: 12, one_upcoming: true, active: true,
    question: 'What do you want to talk about?', hours: [{ dow: 2, start: '10:00', end: '12:00' }, { dow: 4, start: '14:00', end: '16:00' }] };
  _cal.at = JSON.parse(JSON.stringify(t)); calApptFormDraw();
}
function calApptFormDraw() {
  const t = _cal.at, v = k => escAttr(t[k] == null ? '' : t[k]), sel = (id, list, cur) => `<select id="${id}">${list.map(([a, b]) => `<option value="${a}"${String(cur) === String(a) ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
  openDutySheet(`<h3 style="margin:0 0 10px">${t.id ? 'Change call type' : '+ New call type'}</h3>
    <div class="cal-form">
      <label class="wide">Name<input id="ca-title" value="${v('title')}" maxlength="120"></label>
      <label class="wide">Description (optional)<input id="ca-desc" value="${v('description')}" maxlength="1000" placeholder="e.g. A quick catch-up on how things are going"></label>
      <label>Length${sel('ca-min', [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour']], t.minutes)}</label>
      <label>Gap between calls${sel('ca-buf', [[0, 'None'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min']], t.buffer_min)}</label>
      <label>Notice needed${sel('ca-notice', [[2, '2 hours'], [12, '12 hours'], [24, '1 day'], [48, '2 days'], [72, '3 days']], t.notice_hours)}</label>
      <label>Book up to${sel('ca-ahead', [[7, '1 week ahead'], [14, '2 weeks ahead'], [21, '3 weeks ahead'], [30, '1 month ahead'], [60, '2 months ahead']], t.ahead_days)}</label>
      <label>Most calls a day${sel('ca-max', [['', 'No limit'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6']], t.max_per_day == null ? '' : t.max_per_day)}</label>
      <label>They can cancel up to${sel('ca-cancel', [[0, 'any time'], [2, '2 hours before'], [12, '12 hours before'], [24, '1 day before'], [48, '2 days before']], t.cancel_hours)}</label>
      <div class="wide"><div class="cal-lbl">Open hours (your time)</div>${(t.hours || []).map((w, k) => `<div class="cal-hr">${sel('ca-dow-' + k, CAL_DOW.map((d, n) => [n, d]), w.dow)}<input type="time" id="ca-s-${k}" value="${escAttr(w.start)}" step="900"> to <input type="time" id="ca-e-${k}" value="${escAttr(w.end)}" step="900"><button class="ho-btn sm" onclick="calApptHours();_cal.at.hours.splice(${k},1);calApptFormDraw()">✕</button></div>`).join('')}
        <button class="ho-btn sm" onclick="calApptHours();_cal.at.hours.push({dow:2,start:'10:00',end:'12:00'});calApptFormDraw()">+ Add open hours</button></div>
      <label class="wide">Question when they book (optional)<input id="ca-q" value="${v('question')}" maxlength="300"></label>
      <label class="wide">Zoom link (optional)<input id="ca-loc" value="${v('location')}" placeholder="Leave empty to use yours from ⚙ settings"></label>
      <label class="wide cal-chk"><input type="checkbox" id="ca-one" ${t.one_upcoming ? 'checked' : ''}> One upcoming call per coordinator</label>
      <label class="wide cal-chk"><input type="checkbox" id="ca-on" ${t.active ? 'checked' : ''}> Open for booking</label>
    </div><div class="fd-msg" id="ca-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn" onclick="calApptTypes()">← Back</button><span style="flex:1"></span><button class="ho-btn primary" onclick="calApptSave()">Save</button></div>`);
}
function calApptHours() { (_cal.at.hours || []).forEach((w, k) => { const g = id => (document.getElementById(id) || {}).value; if (g('ca-dow-' + k) != null) { w.dow = +g('ca-dow-' + k); w.start = g('ca-s-' + k); w.end = g('ca-e-' + k); } }); }
async function calApptSave() {
  calApptHours();
  const g = id => (document.getElementById(id) || {}).value, t = _cal.at;
  const p = { id: t.id || null, title: g('ca-title'), description: g('ca-desc'), minutes: +g('ca-min'), buffer_min: +g('ca-buf'), notice_hours: +g('ca-notice'), ahead_days: +g('ca-ahead'),
    max_per_day: g('ca-max'), cancel_hours: +g('ca-cancel'), hours: t.hours, question: g('ca-q'), location: g('ca-loc'), one_upcoming: document.getElementById('ca-one').checked, active: document.getElementById('ca-on').checked };
  const { error } = await sb.rpc('hub_appt_type_save', { p });
  if (error) { document.getElementById('ca-msg').textContent = error.message; return; }
  calToast('✓ Saved'); calHasTypes(); calApptTypes();
}

// ---------- add or change an event ----------
function calNew(iso, kind) {
  const d = iso || calIso(_cal.day || new Date()), m = kind === 'meeting' || kind === 'one_on_one';
  calForm({ start_date: d, end_date: d, all_day: !m, start_time: m ? '10:00' : '', end_time: m ? (kind === 'one_on_one' ? '10:30' : '11:00') : '', layer: m ? 'meeting' : 'event', kind: kind || 'event', visibility: m ? 'attendees' : 'office', attendees: [],
    location: m && _cal.me && _cal.me.zoom_link ? _cal.me.zoom_link : '' });
}
async function calPeople() {   // home office people to invite (the same list as 🏢 chat's + New message)
  if (_cal.people) return _cal.people;
  const { data } = await sb.rpc('hub_chat_office_people'); _cal.people = data || []; return _cal.people;
}
function calBlocksDefault(x) { return x.id && typeof x.blocks === 'boolean' ? x.blocks : (x.all_day === false || x.visibility === 'me'); }
function calBlocksFollow() {   // (not touched yet: follows all day / who sees it)
  const b = document.getElementById('cf-blocks'); if (!b || _cal.blkTouched || (_cal.edit && _cal.edit.id)) return;
  b.checked = !document.getElementById('cf-allday').checked || (document.getElementById('cf-vis') || {}).value === 'me';
}
async function calForm(x) {
  _cal.edit = x; _cal.blkTouched = false;
  const v = k => escAttr(x[k] || ''), kind = x.kind || 'event', meet = kind !== 'event';
  const P = meet ? await calPeople() : [], inv = new Set((x.attendees || []).map(a => a.user_id));
  const people = !meet ? '' : kind === 'one_on_one'
    ? `<label class="wide">With<select id="cf-with"><option value="">Choose someone…</option>${P.map(p => `<option value="${escAttr(p.user_id)}"${inv.has(p.user_id) ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`
    : `<div class="wide"><div class="cal-lbl">Invite</div><div class="cal-ppl">${P.map(p => `<label class="cal-pp"><input type="checkbox" class="cf-inv" value="${escAttr(p.user_id)}"${inv.has(p.user_id) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('') || '<span class="fd-sm">No one else at home office yet.</span>'}</div></div>`;
  const repeat = `<label>Repeats<select id="cf-rep">${[['none', 'Doesn’t repeat'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month']].map(([k2, l]) => `<option value="${k2}"${(x.repeat || 'none') === k2 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Until (optional)<input id="cf-until" type="date" value="${v('repeat_until')}"></label>`;
  if (x.id && x.series_start) { x = Object.assign({}, x, { start_date: x.series_start, end_date: x.series_start }); _cal.edit = x; }   // (a repeating one: change the series)
  openDutySheet(`<h3 style="margin:0 0 10px">${x.id ? (meet ? 'Change ' + (kind === 'one_on_one' ? '1:1' : 'meeting') : 'Change event') : meet ? (kind === 'one_on_one' ? '+ 1:1' : '+ Meeting') : '+ Add event'}</h3>
    <div class="cal-form">
      <label class="wide">Title<input id="cf-title" maxlength="200" value="${v('title')}" placeholder="${kind === 'one_on_one' ? 'e.g. Weekly check-in' : 'e.g. Team meeting'}"></label>
      ${people}
      <label>Starts<input id="cf-sd" type="date" value="${v('start_date')}" onchange="const e=document.getElementById('cf-ed');if(e.value<this.value)e.value=this.value"></label>
      <label>Ends<input id="cf-ed" type="date" value="${v('end_date')}"></label>
      <label class="wide cal-chk"><input id="cf-allday" type="checkbox" ${x.all_day !== false ? 'checked' : ''} onchange="document.getElementById('cf-times').hidden=this.checked;calBlocksFollow()"> All day</label>
      <div id="cf-times" class="wide cal-two" ${x.all_day !== false ? 'hidden' : ''}><label>From<input id="cf-st" type="time" step="300" value="${v('start_time')}"></label><label>To<input id="cf-et" type="time" step="300" value="${v('end_time')}"></label></div>
      <label class="wide">Where or Zoom link (optional)<input id="cf-loc" maxlength="300" value="${v('location')}" placeholder="e.g. https://zoom.us/j/… or Victoria office"></label>
      ${meet ? `<label class="wide">Agenda (optional)<textarea id="cf-agenda" rows="3" maxlength="4000" placeholder="What you’ll talk about">${esc(x.agenda || '')}</textarea></label>`
        : `<label class="wide">Notes (optional)<textarea id="cf-notes" rows="3" maxlength="4000">${esc(x.notes || '')}</textarea></label>`}
      ${repeat}
      ${!meet && _cal.hasTypes && (!x.id || x.mine) ? `<label class="wide cal-chk" title="Coordinators can’t book calls with you at this time"><input type="checkbox" id="cf-blocks" ${calBlocksDefault(x) ? 'checked' : ''} onchange="_cal.blkTouched=true"> 🚫 Blocks my call times</label>` : ''}
      ${meet ? `<p class="wide fd-sm" style="margin:0">${kind === 'one_on_one' ? '🔒 Only the two of you see it and its notes.' : '👥 Only the people invited see it.'}</p>` : `
      <label>Kind<select id="cf-layer"><option value="event"${x.layer !== 'planning' ? ' selected' : ''}>📌 Event</option><option value="planning"${x.layer === 'planning' ? ' selected' : ''}>🗺️ Planning</option></select></label>
      <label>Who sees it<select id="cf-vis" onchange="calBlocksFollow()" ${x.id && !x.mine ? 'disabled title="Only the person who added it can change this"' : ''}><option value="office"${x.visibility !== 'me' ? ' selected' : ''}>Everyone at home office</option><option value="me"${x.visibility === 'me' ? ' selected' : ''}>Just me 🔒</option></select></label>`}
    </div>
    ${x.id && x.by ? `<p class="fd-sm" style="margin:8px 0 0">Added by ${esc(x.by)}</p>` : ''}
    <div class="fd-msg" id="cf-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px">${x.id ? '<button class="ho-btn" style="color:#c62828" onclick="calDelete()">Delete</button>' : ''}<span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Cancel</button><button class="ho-btn primary" onclick="calSave()">Save</button></div>`);
  setTimeout(() => { const t = document.getElementById('cf-title'); if (t && !x.id) t.focus(); }, 50);
}
async function calSave() {
  const g = id => (document.getElementById(id) || {}).value || '', all = document.getElementById('cf-allday').checked, msg = document.getElementById('cf-msg');
  const kind = (_cal.edit && _cal.edit.kind) || 'event';
  const p = { id: (_cal.edit && _cal.edit.id) || null, title: g('cf-title').trim(), start_date: g('cf-sd'), end_date: g('cf-ed') || g('cf-sd'),
    start_time: all ? null : g('cf-st') || null, end_time: all ? null : g('cf-et') || null, location: g('cf-loc'), notes: g('cf-notes'), layer: g('cf-layer'), visibility: g('cf-vis'),
    kind, agenda: g('cf-agenda'), repeat: g('cf-rep') || 'none', repeat_until: g('cf-until') || null,
    attendees: kind === 'one_on_one' ? [g('cf-with')].filter(Boolean) : kind === 'meeting' ? Array.from(document.querySelectorAll('.cf-inv:checked')).map(c => c.value) : [] };
  const blk = document.getElementById('cf-blocks'); if (blk && (_cal.blkTouched || !p.id)) p.blocks = blk.checked;   // (🚫 only when chosen; else the usual rule)
  if (!p.title && kind === 'one_on_one' && p.attendees[0]) p.title = '1:1 with ' + ((_cal.people || []).find(x => x.user_id === p.attendees[0]) || {}).name;
  if (!p.title) { msg.textContent = 'Give it a title.'; return; }
  if (kind === 'one_on_one' && !p.attendees.length) { msg.textContent = 'Choose who the 1:1 is with.'; return; }
  if (kind === 'meeting' && !p.attendees.length) { msg.textContent = 'Invite at least one person.'; return; }
  if (p.repeat !== 'none' && p.end_date !== p.start_date) { msg.textContent = 'A repeating one has to start and end on the same day.'; return; }
  if (!all && (!p.start_time || !p.end_time)) { msg.textContent = 'Choose both times, or tick All day.'; return; }
  const btn = document.querySelector('.duty-sheet .ho-btn.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const { data, error } = await sb.rpc('hub_cal_event_save', { p });
  if (error) { msg.textContent = error.message; if (btn) { btn.disabled = false; btn.textContent = 'Save'; } return; }
  closeDutySheet(); calLoad();
  if (kind !== 'event' && data && data.id) calInvite(data.id, 'send');   // (✉️ the invites, or their update)
}
// ✉️ email invites (hub-cal-invite): after a meeting is saved or a date skipped ('send'), before it's deleted ('cancel')
async function calInvite(id, action) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-cal-invite`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ event_id: id, action }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { calToast('Invites didn’t go out: ' + (d.error || r.status) + (r.status === 404 && !d.error ? ' (is hub-cal-invite deployed?)' : ''), true); return d; }
    const bits = [d.sent ? `✉️ invite sent to ${d.sent}` : '', d.updated ? `update sent to ${d.updated}` : '', d.cancelled ? `cancellation sent to ${d.cancelled}` : ''].filter(Boolean);
    if (bits.length || (d.errors || []).length) calToast((bits.join(' · ') || 'Nothing sent') + ((d.errors || []).length ? ' · ⚠ ' + d.errors[0] : ''), !!(d.errors || []).length);
    return d;
  } catch (e) { calToast('Invites didn’t go out: ' + (e.message || e), true); return null; }
}
function calToast(text, bad) {
  let t = document.getElementById('cal-toast'); if (!t) { t = document.createElement('div'); t.id = 'cal-toast'; document.body.appendChild(t); }
  t.textContent = text; t.className = 'cal-toast' + (bad ? ' bad' : ''); t.style.display = 'block';
  clearTimeout(_cal.toastT); _cal.toastT = setTimeout(() => { t.style.display = 'none'; }, bad ? 9000 : 5000);
}
// ⚙ your Zoom link and time zone
async function calMe() { if (_cal.me) return _cal.me; const { data } = await sb.rpc('hub_cal_me_get'); _cal.me = data || {}; return _cal.me; }
async function calSettings() {
  const me = await calMe();
  openDutySheet(`<h3 style="margin:0 0 10px">⚙ My calendar settings</h3>
    <div class="cal-form"><label class="wide">Your Zoom link<input id="cs-zoom" value="${escAttr(me.zoom_link || '')}" placeholder="https://us02web.zoom.us/j/…"></label>
    <p class="wide fd-sm" style="margin:0">Your personal meeting room link (in Zoom: Meetings → Personal Room → Invite link). New meetings and 1:1s fill it in for you.</p>
    <label>Your time zone<select id="cs-tz">${[['America/Vancouver', 'BC time'], ['America/Edmonton', 'Alberta time'], ['America/Toronto', 'Ontario time']].map(([v, l]) => `<option value="${v}"${(me.tz || 'America/Vancouver') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="wide fd-sm" style="margin:0">Invites you send show their times in this time zone.</p></div>
    <div class="fd-msg" id="cs-msg"></div>
    <div style="text-align:right;margin-top:12px"><button class="ho-btn" onclick="closeDutySheet()">Cancel</button> <button class="ho-btn primary" onclick="calSettingsSave()">Save</button></div>`);
}
async function calSettingsSave() {
  const { data, error } = await sb.rpc('hub_cal_me_set', { p_zoom: document.getElementById('cs-zoom').value, p_tz: document.getElementById('cs-tz').value });
  if (error) { document.getElementById('cs-msg').textContent = error.message; return; }
  _cal.me = data; closeDutySheet(); calToast('✓ Saved');
}
// "Answer in the Hub" (hub.html#cal-<id>): open the calendar at that meeting's next date
async function calOpenById(id) {
  openCalPane();
  const t = new Date(), a = calIso(calAdd(t, -7)), z = calIso(calAdd(t, 90));
  const { data } = await sb.rpc('hub_cal_range', { p_from: a, p_to: z, p_layers: ['meeting', 'event', 'planning'] });
  const L = (data || []).filter(x => x.id === id), x = L.find(y => y.start_date >= calIso(t)) || L[L.length - 1];
  if (!x) { calToast('That meeting isn’t on your calendar (it may have been cancelled).', true); return; }
  _cal.day = calD(x.start_date); await calLoad();
  const i = _cal.items.findIndex(y => y.id === x.id && y.start_date === x.start_date); if (i >= 0) calOpen(i);
}
async function calDelete() {
  if (!_cal.edit || !_cal.edit.id || !confirm('Delete “' + _cal.edit.title + '”' + (_cal.edit.repeat && _cal.edit.repeat !== 'none' ? ' and every date it repeats' : '') + '?')) return;
  if (_cal.edit.layer === 'meeting' && _cal.edit.mine) await calInvite(_cal.edit.id, 'cancel');   // (✉️ cancellations go out first)
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
#cal-pane .cal-chip.declined { opacity: .5; text-decoration: line-through; }
.cal-lbl { font-size: 12px; font-weight: 800; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.cal-ppl { display: flex; flex-wrap: wrap; gap: 6px; } .cal-pp { display: inline-flex !important; flex-direction: row !important; align-items: center; gap: 6px !important; border: 1px solid #e6e3ee; border-radius: 999px; padding: 4px 10px; font-weight: 500 !important; cursor: pointer; }
.cal-att { display: flex; flex-wrap: wrap; gap: 6px; } .cal-a { border-radius: 999px; padding: 3px 10px; font-size: 13px; background: #f1f0f6; }
.cal-a.yes { background: #e7f4e8; color: #1b5e20; } .cal-a.no { background: #fde2e2; color: #b91c1c; } .cal-a.maybe { background: #fff3e0; color: #92400e; }
.cal-ans { display: flex; gap: 6px; flex-wrap: wrap; }
.cal-at { display: flex; gap: 10px; align-items: center; justify-content: space-between; border: 1px solid #eee; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; } .cal-at.off { opacity: .6; }
.cal-hr { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; } .cal-hr select, .cal-hr input { padding: 6px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.cal-toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 10001; background: #1f1b3a; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.2); max-width: 90vw; }
.cal-toast.bad { background: #b91c1c; }
@media (max-width: 760px) { #cal-pane .cal-week { grid-template-columns: 1fr; } #cal-pane .cal-days { grid-auto-rows: minmax(64px, auto); } #cal-pane .cal-chip { font-size: 10.5px; padding: 1px 4px; } }`;
  document.head.appendChild(st);
}// hub/calendar.js: 📅 Calendar for home office (Nov 12 2026; hub_calendar.sql). Month, week and agenda views of hub_cal_range:
// 💵 paydays and pay period ends, 🌴 approved time off and no-time-off dates, 📧 newsletter sends, 🏷️ deals of the day, and your own
// 📌 events and 🗺️ planning items (for everyone at home office, or just you). Layers switch on and off (remembered on this computer).
// Loaded by hub.html after dashboard.js. Weeks start on Sunday, like pay periods.
// (Nov 12 2026: 👥 meetings and 1:1s (hub_calendar_meetings.sql): invite home office people, Yes / Maybe / No, repeats, skip a
// date, agenda, and notes for each date: shared with the people invited; a 1:1's only the two of you.)
// (Nov 12 2026: ⚙ My calendar settings: your Zoom link (fills in new meetings) and time zone (hub_cal_settings); email invites,
// updates and cancellations through the hub-cal-invite Edge Function; hub.html#cal-<id> ("Answer in the Hub") opens that meeting.)
// (Nov 12 2026: 📞 Call types (hub_calendar_appointments.sql): set up calls coordinators can book with you (open hours, length,
// buffer, notice…); booked calls show on 👥 Meetings, and open with who, their answer, Join and Cancel. Booking: hub/appt.js.)

if (typeof PANES !== 'undefined' && !PANES.includes('cal-pane')) PANES.push('cal-pane');
const CAL_LAYERS = [
  ['meeting', '👥 Meetings', '#0e7490'], ['event', '📌 Events', '#6d4aeb'], ['planning', '🗺️ Planning', '#e8710a'], ['pay', '💵 Pay', '#2e7d32'],
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
  calStyles(); calLoad(); calMe().catch(() => {});
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
  const mk = x.layer === 'meeting' ? (x.my_response === 'pending' ? '❔ ' : x.my_response === 'no' ? '' : '') + (x.kind === 'one_on_one' ? '1:1 ' : '👥 ') : '';
  return `<button class="cal-chip${cont}${x.my_response === 'no' ? ' declined' : ''}" style="--c:${escAttr(x.colour || calCol(x.layer))}" onclick="event.stopPropagation();calOpen(${i})" title="${escAttr(x.title)}${x.my_response === 'pending' ? ' (not answered yet)' : ''}">${t}${mk}${esc(x.title)}${x.visibility === 'me' ? ' 🔒' : ''}</button>`;
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
      <button class="ho-btn" onclick="calSettings()" title="Your Zoom link and time zone">⚙</button><button class="ho-btn" onclick="calApptTypes()" title="Calls coordinators can book with you">📞 Call types</button><button class="ho-btn" onclick="calNew(null, 'one_on_one')">+ 1:1</button><button class="ho-btn" onclick="calNew(null, 'meeting')">+ Meeting</button><button class="ho-btn primary" onclick="calNew()">+ Add event</button></div>
    <div class="cal-bar"><div class="cal-nav"><button class="ho-btn" onclick="calMove(-1)" title="Back">◀</button><button class="ho-btn" onclick="calToday()">Today</button><button class="ho-btn" onclick="calMove(1)" title="Forward">▶</button>
        <b class="cal-title">${esc(title)}</b>${_cal.loading ? '<span class="fd-sm">Loading…</span>' : ''}</div>
      <div class="cal-views">${[['month', 'Month'], ['week', 'Week'], ['agenda', 'Agenda']].map(([v, l]) => `<button class="${_cal.view === v ? 'on' : ''}" onclick="calView('${v}')">${l}</button>`).join('')}</div></div>
    <div class="cal-layers">${CAL_LAYERS.map(([k, l, c]) => `<button class="cal-lay${_cal.off[k] ? ' off' : ''}" style="--c:${c}" onclick="calLayer('${k}')" title="${_cal.off[k] ? 'Show' : 'Hide'} ${escAttr(l)}"><i></i>${l}</button>`).join('')}</div>
    ${body}`;
}

// ---------- an item: details (and edit, for events) ----------
function calOpen(i) {
  const x = _cal.items[i]; if (!x) return;
  if (x.kind === 'call') { calCall(i); return; }
  if (x.layer === 'meeting') { calMeeting(i); return; }
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
  const rp = { weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'every month' }[x.repeat];
  return (x.all_day ? days + ' · all day' : days + ' · ' + calTime(x.start_time) + '–' + calTime(x.end_time)) + (rp ? ' · repeats ' + rp + (x.repeat_until ? ' until ' + calD(x.repeat_until).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '') : '');
}
function calLinkify(s) { const t = esc(s); return /^https?:\/\/\S+$/.test(String(s).trim()) ? `<a href="${escAttr(String(s).trim())}" target="_blank" rel="noopener">${t}</a>` : t; }

// ---------- 👥 a meeting or 1:1: who's coming, your answer, the agenda, and notes for this date ----------
async function calMeeting(i) {
  const x = _cal.items[i]; if (!x) return; _cal.edit = x;
  const R = { yes: '✅ Going', maybe: '🤔 Maybe', no: '❌ Not going', pending: '❔ Not answered' };
  const zoom = x.location && /^https?:\/\//.test(x.location.trim()) ? `<a class="ho-btn primary" href="${escAttr(x.location.trim())}" target="_blank" rel="noopener">🎥 Join</a>` : x.location ? `<p style="margin:0 0 8px">📍 ${esc(x.location)}</p>` : '';
  openDutySheet(`<h3 style="margin:0 0 2px">${x.kind === 'one_on_one' ? '1:1 · ' : '👥 '}${esc(x.title)}</h3><p class="fd-sm" style="margin:0 0 10px">${esc(calWhen(x))}</p>
    ${zoom ? `<div style="margin:0 0 10px">${zoom}</div>` : ''}
    ${x.agenda ? `<div class="cal-lbl">Agenda</div><p style="white-space:pre-wrap;margin:0 0 10px">${esc(x.agenda)}</p>` : ''}
    <div class="cal-lbl">Who’s coming</div><div class="cal-att">${(x.attendees || []).map(a => `<span class="cal-a ${esc(a.response)}">${esc(a.name)} · ${R[a.response] || a.response}</span>`).join('')}</div>
    ${x.my_response ? `<div class="cal-lbl" style="margin-top:10px">Your answer</div><div class="cal-ans">${['yes', 'maybe', 'no'].map(r => `<button class="ho-btn${x.my_response === r ? ' primary' : ''}" onclick="calRespond('${r}')">${R[r]}</button>`).join('')}</div>` : ''}
    <div class="cal-lbl" style="margin-top:12px">Notes for ${esc(calD(x.start_date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} <span class="fd-sm" id="cm-by"></span></div>
    <textarea id="cm-notes" rows="5" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ddd;border-radius:8px;font:inherit" placeholder="${x.kind === 'one_on_one' ? 'Only the two of you see these.' : 'Shared with everyone invited.'}">Loading…</textarea>
    <div class="fd-msg" id="cm-msg"></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${x.mine ? `<button class="ho-btn" onclick="calForm(_cal.edit)">✏️ Change</button>${x.repeat && x.repeat !== 'none' ? '<button class="ho-btn" onclick="calSkip()">Skip this date</button>' : ''}<button class="ho-btn" style="color:#c62828" onclick="calDelete()">Delete</button>` : `<span class="fd-sm">Set up by ${esc(x.by || '')}</span>`}
      <span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Close</button><button class="ho-btn primary" onclick="calNotesSave()">Save notes</button></div>`);
  const { data, error } = await sb.rpc('hub_cal_notes_get', { p_event: x.id, p_date: x.start_date });
  const ta = document.getElementById('cm-notes'); if (!ta || _cal.edit !== x) return;
  ta.value = error ? '' : ((data && data.body) || ''); _cal.notesWas = ta.value;
  if (data && data.by) document.getElementById('cm-by').textContent = '· last saved by ' + data.by;
}
async function calRespond(r) {
  const x = _cal.edit; const { error } = await sb.rpc('hub_cal_respond', { p_event: x.id, p_response: r });
  if (error) { document.getElementById('cm-msg').textContent = error.message; return; }
  const ta = document.getElementById('cm-notes'), keep = ta ? ta.value : null;
  await calLoad();
  const i = _cal.items.findIndex(y => y.id === x.id && y.start_date === x.start_date); if (i >= 0) { await calMeeting(i); const t2 = document.getElementById('cm-notes'); if (t2 && keep !== null && keep !== _cal.notesWas) t2.value = keep; }
}
async function calNotesSave() {
  const x = _cal.edit, ta = document.getElementById('cm-notes'), msg = document.getElementById('cm-msg'); if (!x || !ta) return;
  const { error } = await sb.rpc('hub_cal_notes_save', { p_event: x.id, p_date: x.start_date, p_body: ta.value });
  if (error) { msg.textContent = error.message; return; }
  _cal.notesWas = ta.value; msg.textContent = ''; msg.innerHTML = '<span style="color:#2e7d32">✓ Notes saved</span>';
  const it = _cal.items.find(y => y.id === x.id && y.start_date === x.start_date); if (it) it.has_notes = !!ta.value.trim();
}
async function calSkip() {
  const x = _cal.edit; if (!confirm('Skip ' + calD(x.start_date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) + ' only? The other dates stay.')) return;
  const { error } = await sb.rpc('hub_cal_skip', { p_event: x.id, p_date: x.start_date, p_skip: true });
  if (error) { document.getElementById('cm-msg').textContent = error.message; return; }
  closeDutySheet(); calLoad();
  calInvite(x.id, 'send');   // (✉️ the update takes that date off their calendars)
}

// ---------- 📞 calls coordinators booked with you ----------
function calCall(i) {
  const x = _cal.items[i]; if (!x) return; _cal.edit = x;
  openDutySheet(`<h3 style="margin:0 0 2px">${esc(x.title)}</h3><p class="fd-sm" style="margin:0 0 10px">${esc(calWhen(x))}</p>
    ${x.location && /^https?:\/\//.test(x.location) ? `<div style="margin:0 0 10px"><a class="ho-btn primary" href="${escAttr(x.location)}" target="_blank" rel="noopener">🎥 Join</a></div>` : ''}
    <div class="cal-lbl">Booked by</div><p style="margin:0 0 10px">${esc(x.by)}${x.studio_id ? ' · ' + esc(STUDIO_NAMES[x.studio_id] || x.studio_id) : ''}</p>
    ${x.note ? `<div class="cal-lbl">What they want to talk about</div><p style="white-space:pre-wrap;margin:0 0 10px">${esc(x.note)}</p>` : ''}
    <div class="fd-msg" id="cc-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn" style="color:#c62828" onclick="calCallCancel()">Cancel this call</button><span style="flex:1"></span><button class="ho-btn primary" onclick="closeDutySheet()">Close</button></div>`);
}
async function calCallCancel() {
  const x = _cal.edit; if (!x || !confirm('Cancel this call? ' + (x.by || 'They') + ' will get an email.')) return;
  const { error } = await sb.rpc('hub_appt_cancel', { p_booking: x.id });
  if (error) { document.getElementById('cc-msg').textContent = error.message; return; }
  try { await fetch(`${SUPABASE_URL}/functions/v1/hub-cal-invite`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ booking_id: x.id, action: 'appt_cancel' }) }); } catch (e) { }
  closeDutySheet(); calLoad();
}
// ---------- 📞 your call types: what coordinators can book with you ----------
const CAL_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
async function calApptTypes() {
  const { data, error } = await sb.rpc('hub_appt_types_mine');
  if (error) { calToast(/hub_appt/.test(error.message) ? 'Run the appointments SQL first.' : error.message, true); return; }
  _cal.types = data || [];
  const hrs = t => (t.hours || []).map(w => `${CAL_DOW[w.dow]} ${calTime(w.start)}–${calTime(w.end)}`).join(', ');
  openDutySheet(`<h3 style="margin:0 0 4px">📞 Call types</h3><p class="fd-sm" style="margin:0 0 10px">Calls coordinators can book with you, from the Coordinator view or their own login. Booked calls show on your calendar.</p>
    ${_cal.types.length ? _cal.types.map((t, i) => `<div class="cal-at${t.active ? '' : ' off'}"><div><b>${esc(t.title)}</b> · ${t.minutes} min${t.active ? '' : ' · <i>off</i>'}<div class="fd-sm">${esc(hrs(t))} · ${t.upcoming} upcoming</div></div><button class="ho-btn sm" onclick="calApptForm(${i})">Change</button></div>`).join('')
      : '<p class="fd-sm">None yet.</p>'}
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn primary" onclick="calApptForm(-1)">+ New call type</button><span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Close</button></div>`);
}
function calApptForm(i) {
  const t = i >= 0 ? _cal.types[i] : { title: 'Coordinator check-in', minutes: 30, buffer_min: 10, notice_hours: 24, ahead_days: 21, max_per_day: null, cancel_hours: 12, one_upcoming: true, active: true,
    question: 'What do you want to talk about?', hours: [{ dow: 2, start: '10:00', end: '12:00' }, { dow: 4, start: '14:00', end: '16:00' }] };
  _cal.at = JSON.parse(JSON.stringify(t)); calApptFormDraw();
}
function calApptFormDraw() {
  const t = _cal.at, v = k => escAttr(t[k] == null ? '' : t[k]), sel = (id, list, cur) => `<select id="${id}">${list.map(([a, b]) => `<option value="${a}"${String(cur) === String(a) ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
  openDutySheet(`<h3 style="margin:0 0 10px">${t.id ? 'Change call type' : '+ New call type'}</h3>
    <div class="cal-form">
      <label class="wide">Name<input id="ca-title" value="${v('title')}" maxlength="120"></label>
      <label class="wide">Description (optional)<input id="ca-desc" value="${v('description')}" maxlength="1000" placeholder="e.g. A quick catch-up on how things are going"></label>
      <label>Length${sel('ca-min', [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour']], t.minutes)}</label>
      <label>Gap between calls${sel('ca-buf', [[0, 'None'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min']], t.buffer_min)}</label>
      <label>Notice needed${sel('ca-notice', [[2, '2 hours'], [12, '12 hours'], [24, '1 day'], [48, '2 days'], [72, '3 days']], t.notice_hours)}</label>
      <label>Book up to${sel('ca-ahead', [[7, '1 week ahead'], [14, '2 weeks ahead'], [21, '3 weeks ahead'], [30, '1 month ahead'], [60, '2 months ahead']], t.ahead_days)}</label>
      <label>Most calls a day${sel('ca-max', [['', 'No limit'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6']], t.max_per_day == null ? '' : t.max_per_day)}</label>
      <label>They can cancel up to${sel('ca-cancel', [[0, 'any time'], [2, '2 hours before'], [12, '12 hours before'], [24, '1 day before'], [48, '2 days before']], t.cancel_hours)}</label>
      <div class="wide"><div class="cal-lbl">Open hours (your time)</div>${(t.hours || []).map((w, k) => `<div class="cal-hr">${sel('ca-dow-' + k, CAL_DOW.map((d, n) => [n, d]), w.dow)}<input type="time" id="ca-s-${k}" value="${escAttr(w.start)}" step="900"> to <input type="time" id="ca-e-${k}" value="${escAttr(w.end)}" step="900"><button class="ho-btn sm" onclick="calApptHours();_cal.at.hours.splice(${k},1);calApptFormDraw()">✕</button></div>`).join('')}
        <button class="ho-btn sm" onclick="calApptHours();_cal.at.hours.push({dow:2,start:'10:00',end:'12:00'});calApptFormDraw()">+ Add open hours</button></div>
      <label class="wide">Question when they book (optional)<input id="ca-q" value="${v('question')}" maxlength="300"></label>
      <label class="wide">Zoom link (optional)<input id="ca-loc" value="${v('location')}" placeholder="Leave empty to use yours from ⚙ settings"></label>
      <label class="wide cal-chk"><input type="checkbox" id="ca-one" ${t.one_upcoming ? 'checked' : ''}> One upcoming call per coordinator</label>
      <label class="wide cal-chk"><input type="checkbox" id="ca-on" ${t.active ? 'checked' : ''}> Open for booking</label>
    </div><div class="fd-msg" id="ca-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="ho-btn" onclick="calApptTypes()">← Back</button><span style="flex:1"></span><button class="ho-btn primary" onclick="calApptSave()">Save</button></div>`);
}
function calApptHours() { (_cal.at.hours || []).forEach((w, k) => { const g = id => (document.getElementById(id) || {}).value; if (g('ca-dow-' + k) != null) { w.dow = +g('ca-dow-' + k); w.start = g('ca-s-' + k); w.end = g('ca-e-' + k); } }); }
async function calApptSave() {
  calApptHours();
  const g = id => (document.getElementById(id) || {}).value, t = _cal.at;
  const p = { id: t.id || null, title: g('ca-title'), description: g('ca-desc'), minutes: +g('ca-min'), buffer_min: +g('ca-buf'), notice_hours: +g('ca-notice'), ahead_days: +g('ca-ahead'),
    max_per_day: g('ca-max'), cancel_hours: +g('ca-cancel'), hours: t.hours, question: g('ca-q'), location: g('ca-loc'), one_upcoming: document.getElementById('ca-one').checked, active: document.getElementById('ca-on').checked };
  const { error } = await sb.rpc('hub_appt_type_save', { p });
  if (error) { document.getElementById('ca-msg').textContent = error.message; return; }
  calToast('✓ Saved'); calApptTypes();
}

// ---------- add or change an event ----------
function calNew(iso, kind) {
  const d = iso || calIso(_cal.day || new Date()), m = kind === 'meeting' || kind === 'one_on_one';
  calForm({ start_date: d, end_date: d, all_day: !m, start_time: m ? '10:00' : '', end_time: m ? (kind === 'one_on_one' ? '10:30' : '11:00') : '', layer: m ? 'meeting' : 'event', kind: kind || 'event', visibility: m ? 'attendees' : 'office', attendees: [],
    location: m && _cal.me && _cal.me.zoom_link ? _cal.me.zoom_link : '' });
}
async function calPeople() {   // home office people to invite (the same list as 🏢 chat's + New message)
  if (_cal.people) return _cal.people;
  const { data } = await sb.rpc('hub_chat_office_people'); _cal.people = data || []; return _cal.people;
}
async function calForm(x) {
  _cal.edit = x;
  const v = k => escAttr(x[k] || ''), kind = x.kind || 'event', meet = kind !== 'event';
  const P = meet ? await calPeople() : [], inv = new Set((x.attendees || []).map(a => a.user_id));
  const people = !meet ? '' : kind === 'one_on_one'
    ? `<label class="wide">With<select id="cf-with"><option value="">Choose someone…</option>${P.map(p => `<option value="${escAttr(p.user_id)}"${inv.has(p.user_id) ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`
    : `<div class="wide"><div class="cal-lbl">Invite</div><div class="cal-ppl">${P.map(p => `<label class="cal-pp"><input type="checkbox" class="cf-inv" value="${escAttr(p.user_id)}"${inv.has(p.user_id) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('') || '<span class="fd-sm">No one else at home office yet.</span>'}</div></div>`;
  const repeat = `<label>Repeats<select id="cf-rep">${[['none', 'Doesn’t repeat'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month']].map(([k2, l]) => `<option value="${k2}"${(x.repeat || 'none') === k2 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Until (optional)<input id="cf-until" type="date" value="${v('repeat_until')}"></label>`;
  if (x.id && x.series_start) { x = Object.assign({}, x, { start_date: x.series_start, end_date: x.series_start }); _cal.edit = x; }   // (a repeating one: change the series)
  openDutySheet(`<h3 style="margin:0 0 10px">${x.id ? (meet ? 'Change ' + (kind === 'one_on_one' ? '1:1' : 'meeting') : 'Change event') : meet ? (kind === 'one_on_one' ? '+ 1:1' : '+ Meeting') : '+ Add event'}</h3>
    <div class="cal-form">
      <label class="wide">Title<input id="cf-title" maxlength="200" value="${v('title')}" placeholder="${kind === 'one_on_one' ? 'e.g. Weekly check-in' : 'e.g. Team meeting'}"></label>
      ${people}
      <label>Starts<input id="cf-sd" type="date" value="${v('start_date')}" onchange="const e=document.getElementById('cf-ed');if(e.value<this.value)e.value=this.value"></label>
      <label>Ends<input id="cf-ed" type="date" value="${v('end_date')}"></label>
      <label class="wide cal-chk"><input id="cf-allday" type="checkbox" ${x.all_day !== false ? 'checked' : ''} onchange="document.getElementById('cf-times').hidden=this.checked"> All day</label>
      <div id="cf-times" class="wide cal-two" ${x.all_day !== false ? 'hidden' : ''}><label>From<input id="cf-st" type="time" step="300" value="${v('start_time')}"></label><label>To<input id="cf-et" type="time" step="300" value="${v('end_time')}"></label></div>
      <label class="wide">Where or Zoom link (optional)<input id="cf-loc" maxlength="300" value="${v('location')}" placeholder="e.g. https://zoom.us/j/… or Victoria office"></label>
      ${meet ? `<label class="wide">Agenda (optional)<textarea id="cf-agenda" rows="3" maxlength="4000" placeholder="What you’ll talk about">${esc(x.agenda || '')}</textarea></label>`
        : `<label class="wide">Notes (optional)<textarea id="cf-notes" rows="3" maxlength="4000">${esc(x.notes || '')}</textarea></label>`}
      ${repeat}
      ${meet ? `<p class="wide fd-sm" style="margin:0">${kind === 'one_on_one' ? '🔒 Only the two of you see it and its notes.' : '👥 Only the people invited see it.'}</p>` : `
      <label>Kind<select id="cf-layer"><option value="event"${x.layer !== 'planning' ? ' selected' : ''}>📌 Event</option><option value="planning"${x.layer === 'planning' ? ' selected' : ''}>🗺️ Planning</option></select></label>
      <label>Who sees it<select id="cf-vis" ${x.id && !x.mine ? 'disabled title="Only the person who added it can change this"' : ''}><option value="office"${x.visibility !== 'me' ? ' selected' : ''}>Everyone at home office</option><option value="me"${x.visibility === 'me' ? ' selected' : ''}>Just me 🔒</option></select></label>`}
    </div>
    ${x.id && x.by ? `<p class="fd-sm" style="margin:8px 0 0">Added by ${esc(x.by)}</p>` : ''}
    <div class="fd-msg" id="cf-msg"></div>
    <div style="display:flex;gap:8px;margin-top:12px">${x.id ? '<button class="ho-btn" style="color:#c62828" onclick="calDelete()">Delete</button>' : ''}<span style="flex:1"></span><button class="ho-btn" onclick="closeDutySheet()">Cancel</button><button class="ho-btn primary" onclick="calSave()">Save</button></div>`);
  setTimeout(() => { const t = document.getElementById('cf-title'); if (t && !x.id) t.focus(); }, 50);
}
async function calSave() {
  const g = id => (document.getElementById(id) || {}).value || '', all = document.getElementById('cf-allday').checked, msg = document.getElementById('cf-msg');
  const kind = (_cal.edit && _cal.edit.kind) || 'event';
  const p = { id: (_cal.edit && _cal.edit.id) || null, title: g('cf-title').trim(), start_date: g('cf-sd'), end_date: g('cf-ed') || g('cf-sd'),
    start_time: all ? null : g('cf-st') || null, end_time: all ? null : g('cf-et') || null, location: g('cf-loc'), notes: g('cf-notes'), layer: g('cf-layer'), visibility: g('cf-vis'),
    kind, agenda: g('cf-agenda'), repeat: g('cf-rep') || 'none', repeat_until: g('cf-until') || null,
    attendees: kind === 'one_on_one' ? [g('cf-with')].filter(Boolean) : kind === 'meeting' ? Array.from(document.querySelectorAll('.cf-inv:checked')).map(c => c.value) : [] };
  if (!p.title && kind === 'one_on_one' && p.attendees[0]) p.title = '1:1 with ' + ((_cal.people || []).find(x => x.user_id === p.attendees[0]) || {}).name;
  if (!p.title) { msg.textContent = 'Give it a title.'; return; }
  if (kind === 'one_on_one' && !p.attendees.length) { msg.textContent = 'Choose who the 1:1 is with.'; return; }
  if (kind === 'meeting' && !p.attendees.length) { msg.textContent = 'Invite at least one person.'; return; }
  if (p.repeat !== 'none' && p.end_date !== p.start_date) { msg.textContent = 'A repeating one has to start and end on the same day.'; return; }
  if (!all && (!p.start_time || !p.end_time)) { msg.textContent = 'Choose both times, or tick All day.'; return; }
  const btn = document.querySelector('.duty-sheet .ho-btn.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const { data, error } = await sb.rpc('hub_cal_event_save', { p });
  if (error) { msg.textContent = error.message; if (btn) { btn.disabled = false; btn.textContent = 'Save'; } return; }
  closeDutySheet(); calLoad();
  if (kind !== 'event' && data && data.id) calInvite(data.id, 'send');   // (✉️ the invites, or their update)
}
// ✉️ email invites (hub-cal-invite): after a meeting is saved or a date skipped ('send'), before it's deleted ('cancel')
async function calInvite(id, action) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-cal-invite`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ event_id: id, action }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { calToast('Invites didn’t go out: ' + (d.error || r.status) + (r.status === 404 && !d.error ? ' (is hub-cal-invite deployed?)' : ''), true); return d; }
    const bits = [d.sent ? `✉️ invite sent to ${d.sent}` : '', d.updated ? `update sent to ${d.updated}` : '', d.cancelled ? `cancellation sent to ${d.cancelled}` : ''].filter(Boolean);
    if (bits.length || (d.errors || []).length) calToast((bits.join(' · ') || 'Nothing sent') + ((d.errors || []).length ? ' · ⚠ ' + d.errors[0] : ''), !!(d.errors || []).length);
    return d;
  } catch (e) { calToast('Invites didn’t go out: ' + (e.message || e), true); return null; }
}
function calToast(text, bad) {
  let t = document.getElementById('cal-toast'); if (!t) { t = document.createElement('div'); t.id = 'cal-toast'; document.body.appendChild(t); }
  t.textContent = text; t.className = 'cal-toast' + (bad ? ' bad' : ''); t.style.display = 'block';
  clearTimeout(_cal.toastT); _cal.toastT = setTimeout(() => { t.style.display = 'none'; }, bad ? 9000 : 5000);
}
// ⚙ your Zoom link and time zone
async function calMe() { if (_cal.me) return _cal.me; const { data } = await sb.rpc('hub_cal_me_get'); _cal.me = data || {}; return _cal.me; }
async function calSettings() {
  const me = await calMe();
  openDutySheet(`<h3 style="margin:0 0 10px">⚙ My calendar settings</h3>
    <div class="cal-form"><label class="wide">Your Zoom link<input id="cs-zoom" value="${escAttr(me.zoom_link || '')}" placeholder="https://us02web.zoom.us/j/…"></label>
    <p class="wide fd-sm" style="margin:0">Your personal meeting room link (in Zoom: Meetings → Personal Room → Invite link). New meetings and 1:1s fill it in for you.</p>
    <label>Your time zone<select id="cs-tz">${[['America/Vancouver', 'BC time'], ['America/Edmonton', 'Alberta time'], ['America/Toronto', 'Ontario time']].map(([v, l]) => `<option value="${v}"${(me.tz || 'America/Vancouver') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="wide fd-sm" style="margin:0">Invites you send show their times in this time zone.</p></div>
    <div class="fd-msg" id="cs-msg"></div>
    <div style="text-align:right;margin-top:12px"><button class="ho-btn" onclick="closeDutySheet()">Cancel</button> <button class="ho-btn primary" onclick="calSettingsSave()">Save</button></div>`);
}
async function calSettingsSave() {
  const { data, error } = await sb.rpc('hub_cal_me_set', { p_zoom: document.getElementById('cs-zoom').value, p_tz: document.getElementById('cs-tz').value });
  if (error) { document.getElementById('cs-msg').textContent = error.message; return; }
  _cal.me = data; closeDutySheet(); calToast('✓ Saved');
}
// "Answer in the Hub" (hub.html#cal-<id>): open the calendar at that meeting's next date
async function calOpenById(id) {
  openCalPane();
  const t = new Date(), a = calIso(calAdd(t, -7)), z = calIso(calAdd(t, 90));
  const { data } = await sb.rpc('hub_cal_range', { p_from: a, p_to: z, p_layers: ['meeting', 'event', 'planning'] });
  const L = (data || []).filter(x => x.id === id), x = L.find(y => y.start_date >= calIso(t)) || L[L.length - 1];
  if (!x) { calToast('That meeting isn’t on your calendar (it may have been cancelled).', true); return; }
  _cal.day = calD(x.start_date); await calLoad();
  const i = _cal.items.findIndex(y => y.id === x.id && y.start_date === x.start_date); if (i >= 0) calOpen(i);
}
async function calDelete() {
  if (!_cal.edit || !_cal.edit.id || !confirm('Delete “' + _cal.edit.title + '”' + (_cal.edit.repeat && _cal.edit.repeat !== 'none' ? ' and every date it repeats' : '') + '?')) return;
  if (_cal.edit.layer === 'meeting' && _cal.edit.mine) await calInvite(_cal.edit.id, 'cancel');   // (✉️ cancellations go out first)
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
#cal-pane .cal-chip.declined { opacity: .5; text-decoration: line-through; }
.cal-lbl { font-size: 12px; font-weight: 800; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.cal-ppl { display: flex; flex-wrap: wrap; gap: 6px; } .cal-pp { display: inline-flex !important; flex-direction: row !important; align-items: center; gap: 6px !important; border: 1px solid #e6e3ee; border-radius: 999px; padding: 4px 10px; font-weight: 500 !important; cursor: pointer; }
.cal-att { display: flex; flex-wrap: wrap; gap: 6px; } .cal-a { border-radius: 999px; padding: 3px 10px; font-size: 13px; background: #f1f0f6; }
.cal-a.yes { background: #e7f4e8; color: #1b5e20; } .cal-a.no { background: #fde2e2; color: #b91c1c; } .cal-a.maybe { background: #fff3e0; color: #92400e; }
.cal-ans { display: flex; gap: 6px; flex-wrap: wrap; }
.cal-at { display: flex; gap: 10px; align-items: center; justify-content: space-between; border: 1px solid #eee; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; } .cal-at.off { opacity: .6; }
.cal-hr { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; } .cal-hr select, .cal-hr input { padding: 6px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.cal-toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 10001; background: #1f1b3a; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.2); max-width: 90vw; }
.cal-toast.bad { background: #b91c1c; }
@media (max-width: 760px) { #cal-pane .cal-week { grid-template-columns: 1fr; } #cal-pane .cal-days { grid-auto-rows: minmax(64px, auto); } #cal-pane .cal-chip { font-size: 10.5px; padding: 1px 4px; } }`;
  document.head.appendChild(st);
}

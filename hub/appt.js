// hub/appt.js: 📞 Book a call with home office (Nov 12 2026; hub_calendar_appointments.sql). Coordinators book the call types home
// office sets up (e.g. "Coordinator check-in with Ani"): on the studio computer (Coordinator view, its PIN, choosing their name) or
// on their own login (Team tab). Free times come from the server (open hours, minus anything booked or busy) and show in local time.
// Their upcoming calls are listed with Join and Cancel (up to the cancel-by time). Loaded by hub.html after calendar.js.
// 📞 Your calls strip on Today (coordinator view): the studio's calls in the next 2 weeks, with Join (apptStripLoad).

if (typeof PANES !== 'undefined' && !PANES.includes('appt-pane')) PANES.push('appt-pane');
const _appt = { host: null, studio: null, pin: null, phone: false, studios: [], types: [], upcoming: [], type: null, slots: null, day: null, slot: null, people: null, msg: '' };

function openApptPane() {   // studio computer, Coordinator view
  showOnlyPane('appt-pane'); setActiveNav('nav-appt');
  apptMount('appt-pane', { studio: typeof _sessionStudioId !== 'undefined' ? _sessionStudioId : null, pin: typeof _sessionPin !== 'undefined' ? _sessionPin : null, phone: false });
}
async function apptMount(hostId, ctx) {
  Object.assign(_appt, { host: hostId, studio: ctx.studio || null, pin: ctx.pin || null, phone: !!ctx.phone, studios: ctx.studios || [], type: null, slots: null, day: null, slot: null, people: null, msg: '' });
  if (!_appt.studio && _appt.studios.length) _appt.studio = _appt.studios[0];
  apptStyles(); apptDraw(true);
  const [o, u] = await Promise.all([sb.rpc('hub_appt_open'), sb.rpc('hub_appt_upcoming', { p_studio: _appt.studio, p_pin: _appt.pin })]);
  if (o.error) { _appt.msg = /hub_appt_open/.test(o.error.message) ? 'Calls aren’t set up yet.' : o.error.message; }
  _appt.types = o.data || []; _appt.upcoming = u.error ? [] : (u.data || []);
  if (u.error && !o.error) _appt.msg = u.error.message;
  apptDraw();
}
const apptT = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' AM', 'am').replace(' PM', 'pm').replace(':00', '');
const apptDay = iso => new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const apptDayLong = iso => new Date(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
const apptLocalDate = iso => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function apptDraw(loading) {
  const el = document.getElementById(_appt.host); if (!el) return;
  const studioPick = _appt.phone && _appt.studios.length > 1 ? `<label class="appt-studio">Your studio <select onchange="_appt.studio=this.value;apptMount('${_appt.host}',{studio:this.value,phone:true,studios:_appt.studios})">${_appt.studios.map(s => `<option value="${escAttr(s)}"${s === _appt.studio ? ' selected' : ''}>${esc(STUDIO_NAMES[s] || s)}</option>`).join('')}</select></label>` : '';
  const up = _appt.upcoming.length ? `<div class="appt-up"><div class="appt-h">Your upcoming calls</div>${_appt.upcoming.map(c => `<div class="appt-call">
      <div><b>${esc(c.title)}</b> with ${esc(c.host || '')}<div class="appt-sub">${esc(apptDayLong(c.start_at))} · ${esc(apptT(c.start_at))}–${esc(apptT(c.end_at))}${!_appt.phone && c.who ? ' · ' + esc(c.who) : ''}</div></div>
      <span class="spacer"></span>${c.location && /^https?:\/\//.test(c.location) ? `<a class="ho-btn primary sm" href="${escAttr(c.location)}" target="_blank" rel="noopener">🎥 Join</a>` : ''}
      ${c.can_cancel ? `<button class="ho-btn sm" onclick="apptCancel('${escAttr(c.id)}')">Cancel</button>` : `<span class="appt-sub" title="Too close to cancel here">Message ${esc(c.host || 'them')} to change it</span>`}</div>`).join('')}</div>` : '';
  let body = '';
  if (loading) body = '<p class="ho-intro">Loading…</p>';
  else if (_appt.msg && !_appt.types.length) body = `<p class="ho-intro">${esc(_appt.msg)}</p>`;
  else if (!_appt.type) body = _appt.types.length ? '<div class="appt-h">Book a call</div><div class="appt-types">' + _appt.types.map((t, i) => `<button class="appt-type" onclick="apptPick(${i})">
      <b>${esc(t.title)}</b><span>with ${esc(t.host)} · ${t.minutes} min</span>${t.description ? `<span class="appt-sub">${esc(t.description)}</span>` : ''}</button>`).join('') + '</div>'
    : '<p class="ho-intro">No calls are open for booking right now.</p>';
  else body = apptPickerHtml();
  el.innerHTML = `${_appt.host === 'appt-pane' ? '<div class="ho-head"><div class="pts-page-title" style="margin:0">📞 Book a call</div></div>' : '<div class="appt-h" style="font-size:16px">📞 Calls with home office</div>'}
    ${studioPick}${up}${body}<div class="me-msg err" id="appt-err" style="display:none"></div>`;
}
async function apptPick(i) {
  _appt.type = _appt.types[i]; _appt.slots = null; _appt.day = null; _appt.slot = null; apptDraw();
  const t = new Date(), a = apptLocalDate(t.toISOString()), z = apptLocalDate(new Date(t.getTime() + (_appt.type.ahead_days || 21) * 864e5).toISOString());
  const { data, error } = await sb.rpc('hub_appt_slots', { p_type: _appt.type.id, p_from: a, p_to: z });
  if (!_appt.type) return;
  _appt.slots = error ? [] : ((data && data.slots) || []);
  if (error) apptErr(error.message);
  _appt.day = _appt.slots.length ? apptLocalDate(_appt.slots[0]) : null;
  apptDraw();
}
function apptPickerHtml() {
  const T = _appt.type;
  if (_appt.slots === null) return `<div class="appt-pick"><button class="ho-btn sm" onclick="_appt.type=null;apptDraw()">← Back</button><p class="ho-intro">Finding open times…</p></div>`;
  const byDay = {}; _appt.slots.forEach(s => { (byDay[apptLocalDate(s)] = byDay[apptLocalDate(s)] || []).push(s); });
  const days = Object.keys(byDay).sort();
  let h = `<div class="appt-pick"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="ho-btn sm" onclick="_appt.type=null;apptDraw()">← Back</button>
    <b>${esc(T.title)}</b><span class="appt-sub">with ${esc(T.host)} · ${T.minutes} min · times in your time</span></div>`;
  if (!days.length) return h + `<p class="ho-intro">No open times in the next ${T.ahead_days || 21} days. Check back soon, or message ${esc(T.host)}.</p></div>`;
  h += '<div class="appt-days">' + days.map(d => `<button class="appt-day${d === _appt.day ? ' on' : ''}" onclick="_appt.day='${d}';_appt.slot=null;apptDraw()"><b>${esc(apptDay(byDay[d][0]))}</b><span>${byDay[d].length} open</span></button>`).join('') + '</div>';
  if (_appt.day && byDay[_appt.day]) h += '<div class="appt-slots">' + byDay[_appt.day].map(s => `<button class="appt-slot${s === _appt.slot ? ' on' : ''}" onclick="apptSlot('${escAttr(s)}')">${esc(apptT(s))}</button>`).join('') + '</div>';
  if (_appt.slot) {
    const names = !_appt.phone ? (_appt.people === null ? '<p class="appt-sub">Loading names…</p>' : `<label class="appt-f">Who’s booking?<select id="appt-who"><option value="">Choose your name…</option>${_appt.people.map(p => `<option value="${escAttr(p.staff_id)}">${esc(p.name)}</option>`).join('')}</select></label>`) : '';
    h += `<div class="appt-form"><div class="appt-when">📞 ${esc(apptDayLong(_appt.slot))} at ${esc(apptT(_appt.slot))}</div>${names}
      ${T.question ? `<label class="appt-f">${esc(T.question)}<textarea id="appt-ans" rows="3" maxlength="1000"></textarea></label>` : ''}
      <button class="ho-btn primary" id="appt-go" onclick="apptBook()">Book it</button>
      <p class="appt-sub">You can cancel here up to ${T.cancel_hours || 0} hours before.</p></div>`;
  }
  return h + '</div>';
}
async function apptSlot(s) {
  _appt.slot = s; apptDraw();
  if (!_appt.phone && _appt.people === null) {
    const { data, error } = await sb.rpc('hub_appt_coordinators', { p_studio: _appt.studio, p_pin: _appt.pin });
    _appt.people = error ? [] : (data || []); if (error) apptErr(error.message);
    apptDraw();
  }
}
async function apptBook() {
  const who = document.getElementById('appt-who'), ans = document.getElementById('appt-ans');
  if (who && !who.value) { apptErr('Choose your name.'); return; }
  if (ans && !ans.value.trim()) { apptErr('Please answer the question.'); return; }
  const b = document.getElementById('appt-go'); if (b) { b.disabled = true; b.textContent = 'Booking…'; }
  const { data, error } = await sb.rpc('hub_appt_book', { p_type: _appt.type.id, p_start: _appt.slot, p_studio: _appt.studio, p_pin: _appt.pin, p_staff: who ? who.value : null, p_answer: ans ? ans.value : null });
  if (error) { apptErr(error.message); if (b) { b.disabled = false; b.textContent = 'Book it'; } if (/just taken/.test(error.message)) { const i = _appt.types.indexOf(_appt.type); setTimeout(() => apptPick(i), 1200); } return; }
  apptInvite(data.id, 'book');
  const done = `✓ Booked: ${data.title} with ${data.host}, ${apptDayLong(data.start_at)} at ${apptT(data.start_at)}.`;
  await apptMount(_appt.host, { studio: _appt.studio, pin: _appt.pin, phone: _appt.phone, studios: _appt.studios });
  const el = document.getElementById(_appt.host); if (el) el.insertAdjacentHTML('afterbegin', `<div class="me-msg ok" style="margin-bottom:10px">${esc(done)} It’s on ${esc(data.host)}’s calendar, and in your upcoming calls below.</div>`);
}
async function apptCancel(id) {
  const c = _appt.upcoming.find(x => x.id === id); if (!c || !confirm(`Cancel your ${c.title} call on ${apptDayLong(c.start_at)} at ${apptT(c.start_at)}?`)) return;
  const { error } = await sb.rpc('hub_appt_cancel', { p_booking: id, p_studio: _appt.studio, p_pin: _appt.pin });
  if (error) { apptErr(error.message); return; }
  apptInvite(id, 'appt_cancel');
  apptMount(_appt.host, { studio: _appt.studio, pin: _appt.pin, phone: _appt.phone, studios: _appt.studios });
}
function apptErr(t) { const e = document.getElementById('appt-err'); if (e) { e.textContent = t; e.style.display = ''; setTimeout(() => { e.style.display = 'none'; }, 8000); } }
// ✉️ the confirmation (or cancellation) emails: hub-cal-invite, once it knows about calls (quietly skipped until then)
async function apptInvite(id, action) {
  try { await fetch(`${SUPABASE_URL}/functions/v1/hub-cal-invite`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ booking_id: id, action, studio: _appt.studio, pin: _appt.pin }) }); } catch (e) { }
}

// a coordinator's own login: their Team tab gets the calls section at the top
(function apptHookTeam() {
  if (typeof meLoadTeam !== 'function' || meLoadTeam._appt) return;
  const orig = meLoadTeam;
  window.meLoadTeam = async function (quiet) {
    const r = await orig.apply(this, arguments);
    const body = document.getElementById('me-body'), studios = (typeof _meTeam !== 'undefined' && _meTeam && (_meTeam.studios || []).map(s => s.studio_id || s.id || s)) || [];
    if (body && studios.length && !document.getElementById('me-appt')) {
      body.insertAdjacentHTML('afterbegin', '<div id="me-appt" class="me-card" style="margin-bottom:12px"></div>');
      apptMount('me-appt', { phone: true, studios: studios.filter(s => typeof s === 'string') });
    }
    return r;
  };
  window.meLoadTeam._appt = true;
})();

function apptStyles() {
  if (document.getElementById('appt-css')) return;
  const st = document.createElement('style'); st.id = 'appt-css';
  st.textContent = `
.appt-h { font-weight: 800; margin: 12px 0 8px; } .appt-sub { color: var(--ink-soft); font-size: 13px; }
.appt-studio { display: flex; gap: 8px; align-items: center; margin: 6px 0; font-weight: 600; }
.appt-up { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 6px 12px; margin: 8px 0; }
.appt-call { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--border); } .appt-call:first-of-type { border-top: 0; }
.appt-types { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.appt-type { text-align: left; border: 1px solid var(--border); background: #fff; border-radius: 14px; padding: 14px; cursor: pointer; font: inherit; color: var(--ink); display: flex; flex-direction: column; gap: 4px; }
.appt-type:hover { border-color: var(--accent); } .appt-type b { font-size: 16px; }
.appt-pick { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 12px; }
.appt-days { display: flex; gap: 8px; overflow-x: auto; padding: 10px 0; }
.appt-day { flex: none; border: 1px solid var(--border); background: #fff; border-radius: 12px; padding: 8px 12px; cursor: pointer; font: inherit; display: flex; flex-direction: column; align-items: flex-start; color: var(--ink); }
.appt-day span { font-size: 12px; color: var(--ink-soft); } .appt-day.on { background: var(--accent); border-color: var(--accent); color: #fff; } .appt-day.on span { color: #fff; }
.appt-slots { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 10px; }
.appt-slot { border: 1px solid var(--accent); color: var(--accent); background: #fff; border-radius: 999px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer; min-height: 40px; }
.appt-slot.on { background: var(--accent); color: #fff; }
.appt-form { border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
.appt-when { font-weight: 800; font-size: 16px; } .appt-f { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; }
.appt-strip { background: #fff; border: 1px solid var(--border); border-left: 4px solid #0e7490; border-radius: 14px; padding: 10px 14px; margin: 0 0 12px; display: flex; flex-direction: column; gap: 6px; }
.appt-strip-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; } .appt-strip-row.now { font-weight: 800; }
.appt-strip > .ho-btn { align-self: flex-start; }
.appt-f select, .appt-f textarea { padding: 9px; border: 1px solid #ddd; border-radius: 10px; font: inherit; font-weight: 400; font-size: 16px; }`;
  document.head.appendChild(st);
}

// ---- 📞 Your calls on Today (coordinator view on the studio computer): hidden when none are booked ----
async function apptStripLoad(studioId) {
  const el = document.getElementById('appt-strip'); if (!el) return;
  let L = [];
  try { const r = await sb.rpc('hub_appt_upcoming', { p_studio: studioId || _sessionStudioId, p_pin: typeof _sessionPin !== 'undefined' ? _sessionPin : null }); L = r.error ? [] : (r.data || []); } catch (e) { L = []; }
  L = L.filter(c => new Date(c.start_at) - Date.now() < 14 * 864e5).slice(0, 3);
  if (!L.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  apptStyles();
  const soon = c => { const m = (new Date(c.start_at) - Date.now()) / 6e4; return m < 15 && m > -40; };
  el.style.display = '';
  el.innerHTML = `<div class="appt-strip"><b>📞 Your calls with home office</b>${L.map(c => `<div class="appt-strip-row${soon(c) ? ' now' : ''}">
      <span>${esc(apptDay(c.start_at))} · ${esc(apptT(c.start_at))} · ${esc(c.title)} with ${esc(c.host || '')}${c.who ? ' (' + esc(c.who) + ')' : ''}</span>
      ${c.location && /^https?:\/\//.test(c.location) ? `<a class="ho-btn ${soon(c) ? 'primary' : ''} sm" href="${escAttr(c.location)}" target="_blank" rel="noopener">🎥 Join</a>` : ''}</div>`).join('')}
    <button class="ho-btn sm" onclick="openApptPane()">Book or change a call</button></div>`;
}

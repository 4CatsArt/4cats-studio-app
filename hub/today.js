// hub/today.js: the Today screen. Studio weather and forecast helpers, the greeting hero, 📋 notes assigned to me and 📋 For you,
// 📊 labour % by day, 📣 announcements (Today and staff phones), who's working, today's events, who's teaching + lesson plans,
// who demos what, on stage today, Today's projects, project tools & materials, and 📘 projects on the Schedule and Today tabs.
// Moved out of hub.html as-is (Nov 12 2026). Loaded by hub.html after its main script, before the other area files.

// Approximate neighbourhood-level coordinates — studios table has no lat/lng
// column (only city/province), and these don't change, so a static lookup
// is simpler than geocoding on every load. Generated from general knowledge
// of each neighbourhood, NOT verified against actual studio addresses —
// accurate enough for weather (doesn't meaningfully vary over a few km) but
// worth spot-checking a few you know well before fully trusting it.
const STUDIO_COORDS = {
  'BC-RICH-GC': { lat: 49.1666, lon: -123.1336 }, 'BC-RICH-STV': { lat: 49.1254, lon: -123.1827 },
  'BC-SUR-SSR': { lat: 49.0170, lon: -122.8033 }, 'BC-YVR-KIT': { lat: 49.2687, lon: -123.1547 },
  'BC-YVR-MS': { lat: 49.2633, lon: -123.1000 }, 'BC-YVR-UBC': { lat: 49.2606, lon: -123.2460 },
  'BC-YYJ-CSV': { lat: 48.4177, lon: -123.3494 }, 'BC-YYJ-ESQ': { lat: 48.4302, lon: -123.4106 },
  'BC-YYJ-OB': { lat: 48.4293, lon: -123.3096 }, 'BC-YYJ-VIC': { lat: 48.4508, lon: -123.3778 },
  'AB-YYC-ING': { lat: 51.0375, lon: -114.0378 }, 'AB-STA-STA': { lat: 53.6303, lon: -113.6256 },
  'ON-BRL-BRL': { lat: 43.3255, lon: -79.7990 }, 'ON-CMB-GLT': { lat: 43.3601, lon: -80.3127 },
  'ON-ERN-ERN': { lat: 43.7717, lon: -80.0679 }, 'ON-HAM-OS': { lat: 43.2427, lon: -79.8271 },
  'ON-HAM-WD': { lat: 43.3334, lon: -79.8987 }, 'ON-HAM-WH': { lat: 43.2700, lon: -79.8663 },
  'ON-KGN-AP': { lat: 44.2312, lon: -76.5323 }, 'ON-LDN-BYR': { lat: 42.9556, lon: -81.3320 },
  'ON-LDN-WVG': { lat: 42.9740, lon: -81.2569 }, 'ON-MIS-PC': { lat: 43.5548, lon: -79.5872 },
  'ON-OAK-OAK': { lat: 43.4675, lon: -79.6877 }, 'ON-OAK-WST': { lat: 43.4408, lon: -79.7169 },
  'ON-YOW-GLB': { lat: 45.3975, lon: -75.6899 }, 'ON-STC-STC': { lat: 43.1594, lon: -79.2469 },
  'ON-YYZ-AVE': { lat: 43.6944, lon: -79.4056 }, 'ON-YYZ-BP': { lat: 43.6614, lon: -79.4759 },
  'ON-YYZ-LEA': { lat: 43.7059, lon: -79.3656 }, 'ON-YYZ-BEA': { lat: 43.6708, lon: -79.2952 },
  'ON-WTR-WTR': { lat: 43.4643, lon: -80.5204 }
};

// Open-Meteo WMO weather codes → short label. Not exhaustive of every code
// Open-Meteo can return, but covers the realistic Canadian range.
const WMO_LABELS = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ hail'
};
function weatherLabel(code) { return WMO_LABELS[code] || 'Unknown'; }

const WMO_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};
function weatherEmoji(code) { return WMO_EMOJI[code] || '🌡️'; }

// 7-day forecast for the "Today at 4Cats" header pills. Separate from the
// existing current-conditions weather widget (top-strip) — this hits
// Open-Meteo's daily forecast params instead of current-only, reusing the
// same STUDIO_COORDS lookup.
async function fetchWeatherForecast(studioId) {
  const coords = STUDIO_COORDS[studioId];
  if (!coords) return [];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=celsius&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast request failed');
  const data = await res.json();
  const daily = data.daily || {};
  const days = (daily.time || []).map((dateStr, i) => ({
    date: dateStr,
    code: daily.weather_code[i],
    tempMax: Math.round(daily.temperature_2m_max[i]),
    tempMin: Math.round(daily.temperature_2m_min[i]),
  }));
  return days;
}

function forecastDayLabel(dateStr, index) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

// ---------- Greeting hero (live for everyone) ----------

async function fetchDailySnapshotWithPin(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-daily-snapshot`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ pin, studioId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function timeOfDayGreeting() {
  const hour = new Date().getHours(); // viewer's own device clock, on purpose
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatSessionTime(t) {
  // t is 'HH:MM:SS' from Postgres time type
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

// Special day greeting (projects.html → Themes → Special days → Greeting).
// Set by loadDashboardTheme(); blank = the normal time-of-day greeting.
// "Happy Halloween 🎃" → "Happy Halloween, Kat! 🎃" — any emoji typed at the
// end moves after the name.
let _specialGreeting = null;
let _lastHeroData = null;
function heroGreetingHtml(name) {
  const g = (_birthdayGreeting || _specialGreeting || '').trim();
  const m = g.match(/^([\s\S]*?)([\s\p{Extended_Pictographic}\u200D\uFE0F]*)$/u);
  const text = m ? m[1].replace(/[\s!.,]+$/, '') : '';
  const emoji = m ? m[2].trim() : '';
  if (!text) return `${esc(timeOfDayGreeting())}, ${esc(name)}! ${emoji ? esc(emoji) : '👋'}`;
  return `${esc(text)}, ${esc(name)}!${emoji ? ' ' + esc(emoji) : ''}`;
}

// ---------- 📋 Notes assigned to me (Auto-schedule notes; autosched_assign.sql) ----------
// The inbox (hub_inbox.sql): things to decide for the responsibilities this person holds (e.g. Staff schedule approvals)
let _inbox = [];
const asFmt12 = v => { const [h, m] = String(v || '').split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? 'p' : 'a'); };
const INBOX_KIND = { promo_unfinished: '🎁', cut_shift: '✂️', short_day: '👤', gt_booked: '🎉', class_problem: '📚', evening_question: '🌆', as_note: '📝' };
// the evening question's choices: the same as Auto-schedule's (asPadOpts)
function inboxEveningOpts(P) {
  const n = Math.max(1, +P.usual || 1), pa = P.pad !== 'field';
  return (pa ? [['watch', 'Keep both open, tell us if it books']] : []).concat([['close', 'Close the evening']])
    .concat(Array.from({ length: n }, (_, i) => [String(i + 1), `Open with ${i + 1} staff${i + 1 === n ? ' (normal)' : ''}`]))
    .concat([['more', 'Keep it open, bring in one more teacher']]).concat(pa ? [['cancel_pa', 'Close the PA/PD day']] : []);
}
function inboxItemHtml(x) {
  const fmt = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const t = v => v ? asFmt12(v) : '';
  const now = x.shift ? `<span class="lab-sub">Now ${esc(t(x.shift.start))}–${esc(t(x.shift.end))}</span>` : '';
  const btns = x.kind === 'cut_shift'
    ? `<button class="ho-btn" onclick="inboxDecide('${x.id}','approve')">✓ Approve</button> <button class="ho-btn" onclick="inboxChange('${x.id}')">Change…</button> <button class="ho-btn" onclick="inboxDecide('${x.id}','keep')">Keep</button>`
    : x.kind === 'gt_booked'
    ? `<button class="ho-btn" onclick="window.open('staff-schedule.html','_blank')">Open staff schedule</button> <button class="ho-btn" onclick="inboxDecide('${x.id}','done')" title="Someone's covering it">✓ Done</button>`
    : x.kind === 'short_day'
    ? `<button class="ho-btn" onclick="window.open('staff-schedule.html','_blank')">Open staff schedule</button> <button class="ho-btn" onclick="inboxDecide('${x.id}','done')" title="I've added someone">✓ Done</button> <button class="ho-btn" onclick="inboxDecide('${x.id}','keep')" title="It's quiet: the staff we have is enough (this day isn't flagged again)">Disregard</button>`
    : x.kind === 'evening_question'
    ? `<select id="ev-${x.id}" class="inbox-sel"><option value="">Choose…</option>${inboxEveningOpts(x.payload || {}).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
       <button class="ho-btn" onclick="const v=document.getElementById('ev-${x.id}').value; if (!v) { alert('Choose what happens to the evening.'); return; } inboxDecide('${x.id}','evening',null,null,v)">Save</button>`
    : `<button class="ho-btn" onclick="inboxDecide('${x.id}','done')">✓ Done</button>`;
  // (Nov 9 2026) the day it's about: open it on the day board or the Hub's Schedule; and why (kept with the decision, so the system learns)
  const day = x.day ? String(x.day).slice(0, 10) : '', links = day && x.studio_id
    ? `<span class="inbox-links"><a href="day-board.html?view=day&studio=${encodeURIComponent(x.studio_id)}&date=${day}" target="_blank" rel="noopener" title="Open this day on the day board">📅 Day board</a> · <a href="#" onclick="inboxGoDay('${esc(x.studio_id)}','${day}');return false" title="Open this day on the Hub's Schedule">Hub schedule</a></span>` : '';
  return `<div class="mn-row inbox-row"><div><b>${INBOX_KIND[x.kind] || '•'} ${esc(fmt(x.day))}</b> · ${esc(STUDIO_NAMES[x.studio_id] || x.studio_id || '')} · <b>${esc(x.title)}</b> ${now} ${links}</div>
    <div class="lab-sub">${esc(x.detail || '')}</div>
    <input id="why-${x.id}" class="inbox-why" maxlength="300" placeholder="Why? (optional: helps the system learn your decisions)" value="${esc(x.decision_note || '')}">
    <div class="inbox-btns">${btns}</div></div>`;
}
// a day from 📋 For you on the Hub's Schedule (its studio first, for home office)
async function inboxGoDay(studio, date) {
  if (studio !== _sessionStudioId) {
    if (_studioData && _studioData.isAdmin) await changeAdminStudio(studio);
    else { alert('This one is at ' + (STUDIO_NAMES[studio] || studio) + '.'); return; }
  }
  showOnlyPane('plan-pane'); setActiveNav('nav-plan'); renderPlanStudioPick(); await loadPlanDay(date);
}
async function inboxDecide(id, action, start, end, value) {
  // the "Why?" note first: the decision's log entry picks it up (decision_notes.sql; skipped quietly if not set up)
  const why = document.getElementById('why-' + id);
  if (why && why.value.trim()) { try { await sb.rpc('hub_inbox_note', { p_id: id, p_note: why.value.trim() }); } catch (e) { } }
  const { data, error } = await sb.rpc('hub_inbox_decide', { p_id: id, p_action: action, p_start: start || null, p_end: end || null, p_value: value || null });
  if (error) { alert(error.message); myNotesLoad(); return; }
  // a shift was changed or removed: the staff member gets their notification, the same way as any approved shift change in the Hub
  if (data && data.applied) fnHeaders().then(h => fetch(`${SUPABASE_URL}/functions/v1/hub-push`, { method: 'POST', headers: h, body: JSON.stringify({ action: 'shifts' }) })).catch(() => {});
  myNotesLoad();
}
function inboxChange(id) {
  const x = _inbox.find(i => i.id === id); if (!x || !x.shift) return;
  const v = prompt('New times for this shift (at least 3 hours), e.g. 4:30p-7:30p', asFmt12(x.shift.start) + '-' + asFmt12(x.shift.end));
  if (!v) return;
  const m = v.replace(/\s+/g, '').match(/^(\d{1,2})(?::(\d{2}))?([ap])m?-(\d{1,2})(?::(\d{2}))?([ap])m?$/i);
  if (!m) { alert('Use a time like 4:30p-7:30p, with a or p on both times.'); return; }
  const hm = (h, mm, ap) => { h = +h % 12 + (/p/i.test(ap) ? 12 : 0); return String(h).padStart(2, '0') + ':' + (mm || '00'); };
  inboxDecide(id, 'change', hm(m[1], m[2], m[3]), hm(m[4], m[5], m[6]));
}
// ---- 📋 For you, its own page: filter by kind, studio and when; search; sort ----
const INBOX_CARD_MAX = 3;
const INBOX_LABEL = { cut_shift: ['shift to approve', 'shifts to approve'], evening_question: ['evening to decide', 'evenings to decide'],
  as_note: ['note', 'notes'], promo_unfinished: ['promo party to call about', 'promo parties to call about'], short_day: ['short day', 'short days'], gt_booked: ['party booked with nobody on', 'parties booked with nobody on'], class_problem: ['class booking', 'class bookings'] };
// (Nov 10 2026) the week an item is in (Sunday to Saturday), for the studio-by-week summary
const inboxWeek = x => { if (!x.day) return ''; const d = new Date(String(x.day).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); };
const inboxWeekLabel = w => w ? 'Week of ' + new Date(w + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : 'No date';
// studios down the side, weeks across: how many to decide in each (tap a number: just those)
function inboxSummaryHtml(list) {
  const weeks = [...new Set(list.map(inboxWeek))].sort((a, b) => (a || '9999').localeCompare(b || '9999'));
  const shown = weeks.slice(0, 6), later = weeks.slice(6);
  const studios = [...new Set(list.map(x => x.studio_id || ''))].sort((a, b) => (STUDIO_NAMES[a] || a || '~').localeCompare(STUDIO_NAMES[b] || b || '~'));
  const cell = (st, ws) => { const n = list.filter(x => (x.studio_id || '') === st && ws.includes(inboxWeek(x))).length;
    return n ? `<button class="inbox-n${n >= 10 ? ' hi' : ''}" onclick="inboxPageOpen('', '${escAttr(st)}', '${ws.length === 1 ? escAttr(ws[0]) : 'later'}')">${n}</button>` : '<span class="lab-sub">·</span>'; };
  return `<div class="inbox-sum"><table><thead><tr><th>Studio</th>${shown.map(w => `<th>${esc(w ? new Date(w + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : 'No date')}</th>`).join('')}${later.length ? '<th>Later</th>' : ''}<th>All</th></tr></thead><tbody>` +
    studios.map(st => `<tr><td>${esc(STUDIO_NAMES[st] || st || 'Network')}</td>${shown.map(w => `<td>${cell(st, [w])}</td>`).join('')}${later.length ? `<td>${cell(st, later)}</td>` : ''}
      <td><button class="inbox-n tot" onclick="inboxPageOpen('', '${escAttr(st)}', '')">${list.filter(x => (x.studio_id || '') === st).length}</button></td></tr>`).join('') + '</tbody></table></div>';
}
let _myNotes = [], _inboxPage = null;
function inboxSorter(by) {
  const d = x => String(x.day || '9999');
  return by === 'studio' ? (a, b) => (STUDIO_NAMES[a.studio_id] || '').localeCompare(STUDIO_NAMES[b.studio_id] || '') || d(a).localeCompare(d(b))
    : by === 'kind' ? (a, b) => Object.keys(INBOX_LABEL).indexOf(a.kind) - Object.keys(INBOX_LABEL).indexOf(b.kind) || d(a).localeCompare(d(b))
    : (a, b) => d(a).localeCompare(d(b)) || (STUDIO_NAMES[a.studio_id] || '').localeCompare(STUDIO_NAMES[b.studio_id] || '');
}
function inboxPageOpen(kind, studio, week) {
  _inboxPage = { kind: kind || '', studio: studio === undefined ? '' : studio || '__none', week: week || '', when: '', q: '', sort: 'group' };
  let el = document.getElementById('inbox-page');
  if (!el) { el = document.createElement('div'); el.id = 'inbox-page'; el.className = 'inbox-page'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'For you'); document.body.appendChild(el); }
  el.style.display = ''; document.body.style.overflow = 'hidden';
  inboxPageDraw();
}
function inboxPageClose() { const el = document.getElementById('inbox-page'); if (el) el.style.display = 'none'; document.body.style.overflow = ''; _inboxPage = null; }
function inboxPageSet(k, v) { if (!_inboxPage) return; _inboxPage[k] = v; inboxPageDraw(k === 'q'); }
function inboxPageDraw(keepFocus) {
  const el = document.getElementById('inbox-page'), F = _inboxPage; if (!el || !F) return;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const until = F.when ? new Date(today.getTime() + (+F.when) * 86400000).toISOString().slice(0, 10) : null;
  const q = F.q.trim().toLowerCase();
  const shownWeeks = [...new Set(_inbox.map(inboxWeek))].sort((a, b) => (a || '9999').localeCompare(b || '9999')).slice(0, 6);
  const rows = _inbox.filter(x => (!F.kind || x.kind === F.kind) && (!F.studio || (F.studio === '__none' ? !x.studio_id : x.studio_id === F.studio)) && (!until || !x.day || String(x.day).slice(0, 10) <= until)
      && (!F.week || (F.week === 'later' ? !shownWeeks.includes(inboxWeek(x)) : inboxWeek(x) === F.week))
      && (!q || [x.title, x.detail, STUDIO_NAMES[x.studio_id]].join(' ').toLowerCase().includes(q))).sort(inboxSorter(F.sort));
  const studios = [...new Set(_inbox.map(x => x.studio_id).filter(Boolean))].sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const opt = (v, l, cur) => `<option value="${escAttr(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
  const notes = _myNotes;
  el.innerHTML = `<div class="inbox-page-in">
    <div class="inbox-page-head"><b>📋 For you</b><span class="lab-sub">${rows.length} of ${_inbox.length} shown</span><span style="flex:1"></span><button class="ho-btn" onclick="inboxPageClose()" aria-label="Close">✕ Close</button></div>
    <div class="inbox-filters">
      <select onchange="inboxPageSet('kind', this.value)" aria-label="Kind">${opt('', 'Everything', F.kind)}${Object.keys(INBOX_LABEL).filter(k => _inbox.some(x => x.kind === k)).map(k => opt(k, INBOX_KIND[k] + ' ' + INBOX_LABEL[k][1][0].toUpperCase() + INBOX_LABEL[k][1].slice(1) + ' (' + _inbox.filter(x => x.kind === k).length + ')', F.kind)).join('')}</select>
      <select onchange="inboxPageSet('studio', this.value)" aria-label="Studio">${opt('', 'All studios', F.studio)}${studios.map(st => opt(st, STUDIO_NAMES[st] || st, F.studio)).join('')}</select>
      <select onchange="inboxPageSet('when', this.value)" aria-label="When">${opt('', 'Any day', F.when)}${opt('7', 'Next 7 days', F.when)}${opt('14', 'Next 14 days', F.when)}${opt('21', 'Next 3 weeks', F.when)}</select>
      <select onchange="inboxPageSet('week', this.value)" aria-label="Week">${opt('', 'Every week', F.week)}${[...new Set(_inbox.map(inboxWeek))].sort((a, b) => (a || '9999').localeCompare(b || '9999')).map(w => opt(w, inboxWeekLabel(w), F.week)).join('')}${F.week === 'later' ? opt('later', 'Later weeks', F.week) : ''}</select>
      <select onchange="inboxPageSet('sort', this.value)" aria-label="Sort">${opt('group', 'By studio, then week', F.sort)}${opt('soon', 'Soonest first', F.sort)}${opt('kind', 'By kind', F.sort)}</select>
      <input id="inbox-q" type="search" placeholder="Search…" value="${escAttr(F.q)}" oninput="inboxPageSet('q', this.value)" aria-label="Search">
    </div>
    ${!F.studio && !F.week && !F.kind && !q ? inboxSummaryHtml(_inbox) : ''}
    <div class="inbox-list">${!rows.length ? '<p class="lab-sub" style="padding:14px 0">Nothing matches.</p>' : F.sort !== 'group' ? rows.map(inboxItemHtml).join('')
      : (() => { let h = '', lastS = null, lastW = null;
          rows.slice().sort((a, b) => (STUDIO_NAMES[a.studio_id] || a.studio_id || '~').localeCompare(STUDIO_NAMES[b.studio_id] || b.studio_id || '~') || String(a.day || '9999').localeCompare(String(b.day || '9999'))).forEach(x => {
            if (x.studio_id !== lastS) { const n = rows.filter(y => y.studio_id === x.studio_id).length; h += `<h3 class="inbox-gh">${esc(STUDIO_NAMES[x.studio_id] || x.studio_id || 'Network')} <span class="lab-sub">${n}</span></h3>`; lastS = x.studio_id; lastW = null; }
            const w = inboxWeek(x); if (w !== lastW) { const n = rows.filter(y => y.studio_id === x.studio_id && inboxWeek(y) === w).length;
              const kinds = Object.keys(INBOX_LABEL).map(k => { const c = rows.filter(y => y.studio_id === x.studio_id && inboxWeek(y) === w && y.kind === k).length; return c ? INBOX_KIND[k] + ' ' + c : ''; }).filter(Boolean).join(' · ');
              h += `<h4 class="inbox-wh">${esc(inboxWeekLabel(w))} <span class="lab-sub">${n} · ${kinds}</span></h4>`; lastW = w; }
            h += inboxItemHtml(x); });
          return h; })()}</div>
    ${notes.length ? `<h4 style="margin:16px 0 4px">Notes from home office (${notes.length})</h4>${notes.map(n => `<div class="mn-row"><label><input type="checkbox" onchange="myNoteDone('${n.id}')"> <b>${esc(new Date(n.day + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</b> · ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</label><div>${esc(n.body)}</div></div>`).join('')}` : ''}
  </div>`;
  if (keepFocus) { const i = document.getElementById('inbox-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
async function myNotesLoad() {
  const el = document.getElementById('card-mynotes'); if (!el) return;
  let list = [];
  try { const r = await sb.rpc('hub_my_autosched_notes'); list = r.error ? [] : (r.data || []); } catch (e) { list = []; }
  try { const r = await sb.rpc('hub_inbox_mine'); _inbox = r.error ? [] : (r.data || []); } catch (e) { _inbox = []; }
  if (_inboxPage) inboxPageDraw();
  if (!list.length && !_inbox.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  el.style.display = '';
  _myNotes = list;
  const soon = _inbox.slice().sort(inboxSorter('soon')).slice(0, INBOX_CARD_MAX), more = _inbox.length - soon.length;
  const chips = Object.keys(INBOX_LABEL).map(k => { const n = _inbox.filter(x => x.kind === k).length;
    return n ? `<button class="inbox-chip" onclick="inboxPageOpen('${k}')">${INBOX_KIND[k]} ${n} ${esc(n === 1 ? INBOX_LABEL[k][0] : INBOX_LABEL[k][1])}</button>` : ''; }).join('');
  el.innerHTML = `<div class="lab-card"><div class="lab-row"><span class="lab-ttl">📋 For you</span><span class="lab-sub">${[
      _inbox.length ? _inbox.length + ' to decide' : '',
      list.length ? list.length + ' note' + (list.length === 1 ? '' : 's') + ' from home office' : ''].filter(Boolean).join(' · ')}</span>
      ${_inbox.length ? `<span style="flex:1"></span><button class="ho-btn" onclick="inboxPageOpen('')">See all (${_inbox.length}) →</button>` : ''}</div>
    ${chips ? `<div class="inbox-chips">${chips}</div>` : ''}
    ${_inbox.length > INBOX_CARD_MAX ? inboxSummaryHtml(_inbox) + '<p class="lab-sub" style="margin:6px 0 0">Tap a number to see those, by studio and week.</p>' : soon.map(inboxItemHtml).join('')}
    ${list.slice(0, INBOX_CARD_MAX).map(n => `<div class="mn-row"><label><input type="checkbox" onchange="myNoteDone('${n.id}')"> <b>${esc(fmt(n.day))}</b> · ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</label><div>${esc(n.body)}</div>
      <span class="lab-sub">from ${esc(String(n.created_by || '').split('@')[0])}</span></div>`).join('')}
    ${list.length > INBOX_CARD_MAX ? `<button class="inbox-more" onclick="inboxPageOpen('')">+ ${list.length - INBOX_CARD_MAX} more notes: see all →</button>` : ''}</div>`;
}
async function myNoteDone(id) {
  const { error } = await sb.rpc('hub_my_autosched_note_done', { p_id: id, p_done: true });
  if (error) { alert(error.message); return; }
  myNotesLoad();
}
// ---------- 📊 Labour % by day (hub_day_labour.sql) ----------
// Labour ÷ the revenue of that day's bookings (sessions happening that day, whenever they were paid for).
// Past days: hours worked (punches; a shift with no punches counts as planned). Today and on: planned shifts.
// Admin only while it's being built; $ amounts only for finance logins (the database decides).
const _labour = { cache: {}, busy: {} };
function labourCan() { return !!(_studioData && _studioData.isAdmin) || !!_sessionPin; }
// (Nov 9 2026) coordinators: their own studio's labour %, through hub_day_labour_coord (the coordinator PIN; % only, no $)
const labourAdmin = () => !!(_studioData && _studioData.isAdmin);
function labourRpc(studio, from, to) {
  return labourAdmin() ? sb.rpc('hub_day_labour', { p_studio_id: studio, p_from: from, p_to: to })
    : sb.rpc('hub_day_labour_coord', { p_studio_id: studio, p_from: from, p_to: to, p_pin: _sessionPin });
}
// the week (Sunday to Saturday, like pay periods) that a day is in: its labour % against that week's bookings
function labourWeekOf(date) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); const a = localDateStr(d); d.setDate(d.getDate() + 6); return [a, localDateStr(d)]; }
async function labourWeekGet(studio, date) {
  const [a, z] = labourWeekOf(date), k = 'w|' + studio + '|' + a + '|' + (labourAdmin() ? 'a' : 'c');
  if (_labour.cache[k] && Date.now() - _labour.cache[k].at < 5 * 60 * 1000) return _labour.cache[k].d;
  if (_labour.busy[k]) return _labour.busy[k];
  _labour.busy[k] = labourRpc(studio, a, z).then(r => {
    delete _labour.busy[k];
    if (r.error) return { err: /hub_day_labour/.test(r.error.message) ? 'Run hub_day_labour.sql first.' : r.error.message };
    const d = { pct: r.data.total_pct, exp_pct: r.data.total_exp_pct, from: a, to: z };
    _labour.cache[k] = { at: Date.now(), d }; return d;
  });
  return _labour.busy[k];
}
function labourWeekHtml(w) {
  if (!w || w.err) return '';
  const lbl = new Date(w.from + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + '–' + new Date(w.to + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return `<span class="lab-item" title="Labour against the bookings for the whole week (Sun–Sat), worked hours for past days and planned for the rest"><span class="lab-k">This week (${esc(lbl)})</span>${w.pct == null ? '<span class="lab-pct off">No bookings</span>' : `<span class="lab-pct ${labStaffCls(w.pct)}">${w.pct}%</span>`}</span>`;
}
async function labourGet(studio, date) {
  const k = studio + '|' + date + '|' + (labourAdmin() ? 'a' : 'c');
  if (_labour.cache[k] && Date.now() - _labour.cache[k].at < 60 * 1000) return _labour.cache[k].d;
  if (_labour.busy[k]) return _labour.busy[k];
  _labour.busy[k] = labourRpc(studio, date, date).then(r => {
    delete _labour.busy[k];
    if (r.error) return { err: /hub_day_labour/.test(r.error.message) ? 'Run hub_day_labour.sql first.' : r.error.message };
    const d = Object.assign({ money: r.data.money, today: r.data.today }, (r.data.days || [])[0] || {});
    _labour.cache[k] = { at: Date.now(), d }; return d;
  });
  return _labour.busy[k];
}
const labourSrc = s => s === 'paid' ? 'hours worked' : s === 'mixed' ? 'worked + some planned' : 'planned';
// Labour % only, against the goal (20%): green at or under the goal, amber a little over, red well over.
// Everyone with access sees the labour % (and, later, coordinators); finance logins also see the day margin and Details.
const LAB_GOAL = 20, LAB_WARN = 25;
const labStaffCls = p => p == null ? '' : p <= LAB_GOAL ? 'good' : p <= LAB_WARN ? 'ok' : 'high';
const labState = d => !d || d.err ? 'err' : d.pct != null ? 'ok' : d.state ? d.state : (Number(d.hours) || d.open ? 'no_bookings' : 'closed');
function labourPctHtml(d) {
  if (!d || d.err) return `<span class="lab-pct">–</span>`;
  const st = labState(d);
  if (st !== 'ok') return `<span class="lab-pct off">${st === 'closed' ? 'Closed' : 'No bookings'}</span>`;
  return `<span class="lab-pct ${labStaffCls(d.pct)}">${d.pct}%</span>`;
}
function labourHintHtml(d) {
  if (!d || d.err) return `<span class="lab-hint">${esc((d && d.err) || '')}</span>`;
  const st = labState(d);
  if (st === 'closed') return '<span class="lab-hint">Closed: nothing booked and nobody scheduled.</span>';
  if (st === 'no_bookings') return '<span class="lab-hint">Nothing is booked for this day yet.</span>';
  const c = Math.max(0, Math.round(d.pct));
  return `<span class="lab-hint">Out of every $1 booked, ${c}¢ pays staff. The goal is ${LAB_GOAL}¢ (${LAB_GOAL}%) or less. This doesn’t include other costs like rent and utilities.</span>`;
}
// finance logins: the day margin (booked − staff − the day's rent, supplies, utilities and home office share)
const labMarginCls = m => m == null ? '' : m >= 10 ? 'good' : m >= 0 ? 'ok' : 'high';
function labourMarginHtml(d, withHint) {
  if (!d || !d.money || d.err || d.margin == null || d.revenue == null) return '';
  const m = d.margin, mp = d.margin_pct, money = n => '$' + Math.round(Math.abs(n)).toLocaleString('en-CA');
  return `<span class="lab-item"><span class="lab-k">Day margin</span><span class="lab-pct ${labMarginCls(mp)}">${mp == null ? '–' : mp + '%'}</span>
    <span class="lab-money ${m >= 0 ? 'up' : 'down'}">${m >= 0 ? '+' : '−'}${money(m)}</span>${withHint ? `<span class="lab-hint">Booked revenue less staff, and this day’s share of the month’s rent, art supplies, utilities and home office costs (split over the month’s open days).</span>` : ''}</span>`;
}
// finance logins: the same two numbers against the sales that came in that day (finance's Daily Grid figure)
function labourSoldHtml(d, withHint) {
  if (!d || !d.money || d.err || d.sold == null) return '';
  const money = n => '$' + Math.round(Math.abs(n)).toLocaleString('en-CA'), m = d.sold_margin, mp = d.sold_margin_pct;
  return `<span class="lab-item lab-sold"><span class="lab-k">By sales${withHint ? ` (${money(d.sold)} came in)` : ''}</span>
    <span class="lab-mini">Labour <span class="lab-pct sm ${labStaffCls(d.sold_pct)}">${d.sold_pct == null ? '–' : d.sold_pct + '%'}</span>${m != null ? ` · Margin <span class="lab-pct sm ${labMarginCls(mp)}">${mp == null ? '–' : mp + '%'}</span> <span class="lab-money ${m >= 0 ? 'up' : 'down'}">${m >= 0 ? '+' : '−'}${money(m)}</span>` : ''}</span>
    ${withHint ? '<span class="lab-hint">The same, against the sales that came in this day (finance’s Daily Grid), whatever they were for.</span>' : ''}</span>`;
}
function labourSubHtml(d) {
  if (!d || d.err || !d.money) return '';
  return `${labourSrc(d.source)} · ${Number(d.hours || 0)} h · $${Math.round(d.revenue || 0)} booked · $${Math.round(d.labour || 0)} staff`;
}
async function labourCardLoad() {
  const el = document.getElementById('card-labour'); if (!el) return;
  if (!labourCan() || !_sessionStudioId) { el.style.display = 'none'; return; }
  const today = localDateStr(new Date()), [d, w] = await Promise.all([labourGet(_sessionStudioId, today), labourWeekGet(_sessionStudioId, today)]);
  if (!labourCan()) { el.style.display = 'none'; return; }   // (the PIN view may have closed while it loaded)
  el.style.display = '';
  el.innerHTML = `<div class="lab-card"><div class="lab-row"><span class="lab-ttl">📊 Labour today</span>${labourPctHtml(d)}<span class="spacer"></span>
      ${d && d.money ? `<button class="ho-btn" onclick="labourTable('${escAttr(_sessionStudioId)}','${today}')">Details</button>` : ''}${labourAdmin() ? '<span class="lab-admin" title="Home office and coordinators see this">admin</span>' : ''}</div>
    ${labourWeekHtml(w) ? `<div class="lab-pair">${labourWeekHtml(w)}</div>` : ''}
    ${labourHintHtml(d)}${d && d.money ? `<div class="lab-pair">${labourMarginHtml(d, true)}${labourSoldHtml(d, true)}</div><div class="lab-sub">${labourSubHtml(d)}</div>` : ''}</div>`;
}
async function labourLineLoad(elId, date) {
  const el = document.getElementById(elId); if (!el) return;
  if (!labourCan() || !_sessionStudioId || !date) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="lab-line"><span class="lab-sub">📊 Labour…</span></div>';
  const [d, w] = await Promise.all([labourGet(_sessionStudioId, date), labourWeekGet(_sessionStudioId, date)]);
  if (!document.getElementById(elId) || (_plan && _plan.date !== date && elId === 'plan-labour')) return;
  el.innerHTML = `<div class="lab-line"><span class="lab-ttl">📊 Labour</span>${labourPctHtml(d)}<span class="lab-sub" title="Out of every $1 booked, how many cents pay staff. Doesn’t include rent, utilities or other costs.">goal ${LAB_GOAL}%</span>${labourWeekHtml(w)}
    ${d && d.money ? `${labourMarginHtml(d, false)}${labourSoldHtml(d, false)}<span class="lab-sub">${labourSubHtml(d)}</span><button class="ho-btn" onclick="labourTable('${escAttr(_sessionStudioId)}','${date}')">Details</button>` : ''}${labourAdmin() ? '<span class="lab-admin" title="Home office and coordinators see this">admin</span>' : ''}</div>`;
}
async function labourTable(studio, date) {
  const d = await labourGet(studio, date); if (!d || d.err) { alert((d && d.err) || 'Not loaded.'); return; }
  const when = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  const hm = m => { m = Math.round(Number(m) || 0); return Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : ''); };
  const money = n => n == null ? '' : '$' + Number(n).toFixed(2);
  const people = (d.people || []).map(p => `<tr><td>${esc(p.name)}</td><td class="num">${hm(p.mins)}</td><td>${p.source === 'paid' ? 'worked' : 'planned'}</td>${d.money ? `<td class="num">${money(p.cost)}</td>` : ''}</tr>`).join('');
  const sess = (d.sessions || []).map(x => `<tr><td>${esc(fdTime ? fdTime(x.time + ':00') : x.time)}</td><td>${esc(String(x.title || '').split('|')[0].trim())}${x.estimate ? ' <span class="fd-sm" title="Old-style Drawing Class and Lawren Harris weeks: $18 for each child on that week’s class list">(estimate: $18 a child)</span>' : ''}</td>${d.revenue != null ? `<td class="num">${money(x.revenue)}</td>` : ''}</tr>`).join('');
  openDutySheet(`<h3>📊 Labour · ${esc(STUDIO_NAMES[studio] || studio)}</h3><p class="ho-intro">${esc(when)} · ${labourSrc(d.source)}</p>
    <div class="lab-big">${labourPctHtml(d)}${labourHintHtml(d)}</div>
    ${d.margin != null ? `<div class="lab-pair" style="margin-top:8px">${labourMarginHtml(d, true)}</div>
      <table class="lab-tbl lab-break"><tbody>
        <tr><td>Booked for this day</td><td class="num">${money(d.revenue)}</td></tr>
        <tr><td>Staff</td><td class="num">−${money(d.labour)}</td></tr>
        <tr><td>This day’s share of rent, art supplies, utilities and home office${d.open === false ? ' (closed: none)' : ''}</td><td class="num">−${money(d.costs)}</td></tr>
        <tr class="tot"><td>Day margin</td><td class="num">${d.margin >= 0 ? '' : '−'}${money(Math.abs(d.margin))}</td></tr></tbody></table>
      ${d.sold != null ? `<div class="lab-pair" style="margin-top:10px">${labourSoldHtml(d, true)}</div>
      <table class="lab-tbl lab-break"><tbody>
        <tr><td>Sales that came in this day</td><td class="num">${money(d.sold)}</td></tr>
        <tr><td>Staff</td><td class="num">−${money(d.labour)}</td></tr>
        <tr><td>This day’s share of rent, art supplies, utilities and home office</td><td class="num">−${money(d.costs)}</td></tr>
        <tr class="tot"><td>Day margin by sales</td><td class="num">${d.sold_margin >= 0 ? '' : '−'}${money(Math.abs(d.sold_margin))}</td></tr></tbody></table>` : ''}`
      : `<p class="fd-sm">No rent, art supplies, utilities or home office costs on file for this month (finance), so there’s no day margin yet.</p>`}
    <h4 style="margin:12px 0 4px">Staff (${Number(d.hours || 0)} h)</h4>
    ${people ? `<table class="lab-tbl"><thead><tr><th>Who</th><th class="num">Paid time</th><th>From</th>${d.money ? '<th class="num">Cost</th>' : ''}</tr></thead><tbody>${people}</tbody></table>` : '<p class="fd-sm">No shifts or hours worked.</p>'}
    <h4 style="margin:12px 0 4px">Bookings this day</h4>
    ${sess ? `<table class="lab-tbl"><thead><tr><th>Time</th><th>What</th>${d.revenue != null ? '<th class="num">Booked</th>' : ''}</tr></thead><tbody>${sess}</tbody></table>` : '<p class="fd-sm">No booked revenue this day.</p>'}
    ${(d.missing || []).length ? `<p class="fd-warn" style="margin-top:8px">⚠ Booked, but no price found (not counted): ${(d.missing || []).map(m => `${esc(fdTime(m.time + ':00'))} ${esc(String(m.title || '').split('|')[0].trim())}${m.order ? ' (' + esc(m.order) + ')' : ''}`).join(', ')}</p>` : ''}
    <p class="fd-sm">Past days: hours worked from punches (anyone without punches counts by their shift, marked “planned”). Today and on: planned shifts. Booked revenue is before tax, gift card redemptions included; camps and multi-week classes are spread over their days. Memberships and retail aren’t tied to a day, so they’re not included. Older Drawing Class and Lawren Harris weeks are estimated at $18 for each child on that week’s class list.</p>
    <div class="sheet-actions"><button class="primary" onclick="closeDutySheet()">Close</button></div>`);
}

// ---------- Announcements from home office ----------
// Unread: a full card with "Got it". Read here: tucked into "Earlier messages".
// Urgent ones stay full-size until they expire, even once read.
let _annData = [];
async function loadAnnouncements(studioId) {
  const { data, error } = await sb.rpc('hub_announcements', { p_studio_id: studioId || null });
  if (error) { console.error('Announcements load failed:', error); _annData = []; renderAnnouncements(); return; }
  _annData = Array.isArray(data) ? data : [];
  renderAnnouncements();
}
function annReadLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
}
// One announcement card, as staff see it (also used for the home office preview).
function annCardHtml(a, rightHtml) {
  const urgent = a.priority === 'urgent';
  return `<div class="ann${urgent ? ' urgent' : ''}">
    <div class="ann-icon" aria-hidden="true">${urgent ? '!' : '📢'}</div>
    <div class="ann-main">
      <div class="ann-eyebrow">${urgent ? 'Urgent · from home office' : 'From home office'}</div>
      <div class="ann-title">${a.title ? annTitleMd(a.title) : 'Your title'}</div>
      ${a.body ? `<div class="ann-body">${annMd(a.body)}</div>` : ''}
    </div>
    ${rightHtml || ''}
  </div>`;
}
// Today screen: urgent unread ones as a banner, and a one-line nudge for the rest.
// Everything is read in full on 📣 Announcements (sidebar).
function renderAnnouncements() {
  const el = document.getElementById('hub-announcements');
  const unread = _annData.filter(a => !a.read_at);
  const badge = document.getElementById('ann-badge'); if (badge) { badge.textContent = unread.length; badge.style.display = unread.length ? '' : 'none'; }
  if (!el) return;
  const urgent = unread.filter(a => a.priority === 'urgent'), others = unread.filter(a => a.priority !== 'urgent');
  el.innerHTML = urgent.map(a => `<button class="ann-banner" onclick="openAnnPane('${escAttr(a.id)}')">
      <span class="ann-banner-ic">🚨</span><span class="ann-banner-main"><b>${annTitleMd(a.title)}</b>${a.body ? `<span>${esc(annPlain(a.body, 140))}</span>` : ''}</span>
      <span class="ann-banner-go">Read ›</span></button>`).join('')
    + (others.length ? `<button class="ann-nudge" onclick="openAnnPane()">📣 ${others.length} new announcement${others.length === 1 ? '' : 's'} from home office <b>Read ›</b></button>` : '');
  const pane = document.getElementById('ann-pane');
  if (pane && pane.style.display !== 'none') renderAnnPane();
}
// ---- staff phones: 📣 announcements, urgent ones as a banner (hub_announcements_v2.sql) ----
let _meAnn = [];
const HUB_STAFF_ANNOUNCEMENTS = false;   // announcements on staff phones: off for now (studio computers only)
async function meLoadAnn() {
  if (!HUB_STAFF_ANNOUNCEMENTS) return;
  try { const r = await sb.rpc('hub_my_announcements'); _meAnn = r.error ? [] : (r.data || []); } catch (e) { _meAnn = []; }
  const unread = _meAnn.filter(a => !a.read_at);
  const b = document.getElementById('me-ann-badge'); if (b) { b.textContent = unread.length; b.style.display = unread.length ? '' : 'none'; }
  const ban = document.getElementById('me-ann-banner');
  if (ban) ban.innerHTML = unread.filter(a => a.priority === 'urgent').map(a => `<button class="ann-banner" onclick="meAnnSheet('${escAttr(a.id)}')">
      <span class="ann-banner-ic">🚨</span><span class="ann-banner-main"><b>${annTitleMd(a.title)}</b>${a.body ? `<span>${esc(annPlain(a.body, 110))}</span>` : ''}</span><span class="ann-banner-go">Read ›</span></button>`).join('');
}
function meAnnSheet(focusId) {
  openDutySheet(`<h3>📣 Announcements</h3><div id="me-ann-list" class="ann-list"></div><div class="sheet-actions"><button onclick="closeDutySheet()">Close</button></div>`);
  meAnnRender(focusId);
}
function meAnnRender(focusId) {
  const box = document.getElementById('me-ann-list'); if (!box) return;
  box.innerHTML = _meAnn.length ? _meAnn.map(a => `<div class="ann-card${a.priority === 'urgent' ? ' urgent' : ''}${a.read_at ? ' read' : ''}" id="me-ann-${escAttr(a.id)}">
      <div class="ann-eyebrow">${a.priority === 'urgent' ? '🚨 Urgent · ' : ''}From home office · ${esc(annReadLabel(a.created_at))}</div>
      <div class="ann-title">${annTitleMd(a.title)}</div>
      ${a.body ? `<div class="ann-full">${annMd(a.body)}</div>` : ''}
      <div class="ann-foot">${a.read_at ? `<span class="ann-readby">✓ Read ${esc(annReadLabel(a.read_at))}</span>` : `<button class="ann-btn" onclick="meAnnAck('${escAttr(a.id)}', this)">Got it</button>`}</div></div>`).join('')
    : '<div class="goal-note">No announcements right now.</div>';
  if (focusId) { const c = document.getElementById('me-ann-' + focusId); if (c) c.scrollIntoView({ block: 'start' }); }
}
async function meAnnAck(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const { data, error } = await sb.rpc('hub_ack_announcement_me', { p_announcement_id: id });
  if (error) { if (btn) { btn.disabled = false; btn.textContent = 'Got it'; } alert(error.message); return; }
  const a = _meAnn.find(x => x.id === id); if (a) a.read_at = data || new Date().toISOString();
  await meLoadAnn(); meAnnRender();
}


// The 📣 Announcements page (studio computer): everything showing, in full, with who's read it here
let _annReaders = {}, _annPeople = null, _annAway = [];
async function openAnnPane(focusId) {
  showOnlyPane('ann-pane'); setActiveNav('nav-ann');
  await loadAnnouncements(_sessionStudioId);
  try { const r = await sb.rpc('hub_announcements_readers', { p_studio_id: _sessionStudioId || null }); _annReaders = r.error ? null : (r.data || {}); } catch (e) { _annReaders = null; }
  try { const r = await sb.rpc('hub_chat_people', { p_studio: _sessionStudioId }); _annPeople = r.error ? null : (r.data || []); } catch (e) { _annPeople = null; }   // (⏳ who still needs to read)
  try { const r = await sb.rpc('hub_ann_away_ids'); _annAway = r.error ? [] : (r.data || []); } catch (e) { _annAway = []; }   // (on extended leave, or no longer working: left out)
  renderAnnPane();
  if (focusId) { const c = document.getElementById('ann-' + focusId); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
}
// ⏳ (Nov 14 2026) who on this studio's team hasn't read an announcement yet (people working today first)
function annFirst(p) { return String(p.first || String(p.name || '').trim().split(/\s+/)[0] || ''); }
function annPending(a) {
  if (!Array.isArray(_annPeople) || !_annPeople.length || _annReaders === null) return null;
  const R = (_annReaders || {})[a.id] || [], byId = new Set(R.filter(r => r.staff_id).map(r => r.staff_id));
  const byName = new Set(R.filter(r => !r.staff_id).map(r => String(r.name || '').toLowerCase()));   // (before the SQL with ids: by first name)
  const today = new Set((_teamPeople || []).map(p => p.staff_id)), away = new Set(_annAway || []);
  return _annPeople.filter(p => !away.has(p.staff_id) && !byId.has(p.staff_id) && !byName.has(annFirst(p).toLowerCase())).map(p => Object.assign({}, p, { today: today.has(p.staff_id) }))
    .sort((x, y) => (y.today - x.today) || annFirst(x).localeCompare(annFirst(y)));
}
function annPendingHtml(a, canAck) {
  const P = annPending(a); if (P === null) return '';
  if (!P.length) return '<div class="ann-pend done">🎉 Everyone has read it</div>';
  return `<div class="ann-pend"${canAck ? ` role="button" tabindex="0" onclick="annWho('${escAttr(a.id)}')" title="Tick who has read it"` : ''}><b>⏳ Still to read (${P.length}):</b> ` +
    P.map(p => `<span class="ann-pp${p.today ? ' today' : ''}">${hubAvatarHtml({ staff_id: p.staff_id, name: p.name, avatar_key: p.avatar_key }, 22)} ${esc(annFirst(p))}${p.today ? ' <i>on today</i>' : ''}</span>`).join('') + '</div>';
}
function annSummaryHtml(list) {
  if (!Array.isArray(_annPeople) || !_annPeople.length || _annReaders === null || !list.length) return '';
  const count = {}; list.forEach(a => (annPending(a) || []).forEach(p => { const k = p.staff_id; count[k] = count[k] || { p, n: 0 }; count[k].n++; }));
  const L = Object.values(count).sort((x, y) => (y.p.today - x.p.today) || (y.n - x.n));
  if (!L.length) return '<div class="ann-sum done">🎉 Everyone has read every announcement.</div>';
  return `<div class="ann-sum"><b>⏳ ${L.length} ${L.length === 1 ? 'person still needs' : 'people still need'} to read:</b> ` +
    L.map(x => `<span class="ann-pp${x.p.today ? ' today' : ''}">${hubAvatarHtml({ staff_id: x.p.staff_id, name: x.p.name, avatar_key: x.p.avatar_key }, 22)} ${esc(annFirst(x.p))} <em>${x.n}</em></span>`).join('') + '</div>';
}
function renderAnnPane() {
  const box = document.getElementById('ann-list'); if (!box) return;
  const canAck = !(_studioData && _studioData.isAdmin);
  const allRead = a => { const P = annPending(a); return Array.isArray(P) && P.length === 0; };   // (Nov 14 2026) everyone here has read it: folded to its header
  const list = _annData.slice().sort((a, b) => (allRead(a) - allRead(b)) || (!!a.read_at - !!b.read_at) || ((b.priority === 'urgent') - (a.priority === 'urgent')));
  box.innerHTML = annSummaryHtml(list) + (list.length ? list.map(a => {
    const readers = (_annReaders && _annReaders[a.id]) || [];
    if (allRead(a)) return `<details class="ann-card read ann-done${a.priority === 'urgent' ? ' urgent' : ''}" id="ann-${escAttr(a.id)}"><summary>
      <div class="ann-eyebrow">${a.priority === 'urgent' ? '🚨 Urgent · ' : ''}From home office · ${esc(annReadLabel(a.created_at))}${a.show_until ? ` · until ${esc(hoFmtDate(a.show_until))}` : ''}</div>
      <div class="ann-title">${annTitleMd(a.title)}</div><span class="ann-done-chip">🎉 Everyone has read it</span><span class="ann-done-more">Show</span></summary>
      ${a.body ? `<div class="ann-full">${annMd(a.body)}</div>` : ''}
      <div class="ann-foot">${readers.length ? `<span class="ann-readby">✓ Read by ${readers.map(r => esc(r.name)).join(', ')}</span>` : ''}</div></details>`;
    return `<div class="ann-card${a.priority === 'urgent' ? ' urgent' : ''}${a.read_at ? ' read' : ''}" id="ann-${escAttr(a.id)}">
      <div class="ann-eyebrow">${a.priority === 'urgent' ? '🚨 Urgent · ' : ''}From home office · ${esc(annReadLabel(a.created_at))}${a.show_until ? ` · until ${esc(hoFmtDate(a.show_until))}` : ''}</div>
      <div class="ann-title">${annTitleMd(a.title)}</div>
      ${a.body ? `<div class="ann-full">${annMd(a.body)}</div>` : ''}
      <div class="ann-foot">${readers.length ? `<span class="ann-readby">✓ Read by ${readers.map(r => esc(r.name)).join(', ')}</span>` : a.read_at ? '<span class="ann-readby">✓ Read here</span>' : '<span class="ann-note">Not read yet</span>'}
        ${canAck ? `<button class="ann-btn" onclick="annWho('${escAttr(a.id)}')">${readers.length || a.read_at ? 'I’ve read it too' : 'Got it'}</button>` : ''}</div>${annPendingHtml(a, canAck)}</div>`;
  }).join('') : '<div class="ho-card"><div class="goal-note">No announcements right now.</div></div>');
}
// "Who's read it?": tick the people (this studio's team), no PIN, like duties
async function annWho(id) {
  const a = _annData.find(x => x.id === id) || {};
  let people = [];
  try { const r = await sb.rpc('hub_chat_people', { p_studio: _sessionStudioId }); if (!r.error) people = r.data || []; } catch (e) {}
  if (!people.length || _annReaders === null) { ackAnnouncement(id); return; }   // before hub_announcements_v2.sql: the studio's "Got it" as before
  const done = new Set(((_annReaders || {})[id] || []).map(r => r.name));
  openDutySheet(`<h3>Who’s read it?</h3><p>${esc(a.title || '')}</p>
    <div class="ann-who">${people.map(p => `<label class="${done.has(p.first) ? 'done' : ''}"><input type="checkbox" class="ann-who-cb" value="${escAttr(p.staff_id)}"${done.has(p.first) ? ' disabled checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>
    <div class="goal-note" style="margin-top:8px">Tick everyone who has read it (for example after reading it together).</div>
    <div id="ann-who-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="annWhoSave('${escAttr(id)}')">Save</button></div>`);
}
async function annWhoSave(id) {
  const ids = [...document.querySelectorAll('.ann-who-cb:checked:not(:disabled)')].map(c => c.value);
  if (!ids.length) { document.getElementById('ann-who-msg').innerHTML = '<div class="me-msg err">Tick at least one name.</div>'; return; }
  const { error } = await sb.rpc('hub_ack_announcement_people', { p_announcement_id: id, p_staff_ids: ids, p_studio_id: _sessionStudioId || null });
  if (error) { document.getElementById('ann-who-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet(); openAnnPane();
}
async function ackAnnouncement(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const { data, error } = await sb.rpc('hub_ack_announcement', { p_announcement_id: id, p_studio_id: _sessionStudioId || null });
  if (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Got it'; }
    alert("Couldn't save that just now: " + error.message);
    return;
  }
  const a = _annData.find(x => x.id === id);
  if (a) a.read_at = data || new Date().toISOString();
  renderAnnouncements();
}


// ---------- Who's working today ----------
// Same colours and file names as admin.html's staff avatars.
const AVATAR_BUCKET = 'staff-avatars';
const AVATAR_TINTS = ['#ece7ff', '#dbeafe', '#e3f9ec', '#fce7f3', '#fef3d6', '#e0f2fe', '#fde2e2', '#ede9fe'];
const AVATAR_INKS  = ['#5636c9', '#1d4ed8', '#15803d', '#be185d', '#b45309', '#0369a1', '#b91c1c', '#6d28d9'];
let _teamCount = 0;
let _teamPeople = [];
let _teamNotes = { day: '', by: {} };
let _teamTimer = null;
function avatarTintIndex(seed) {
  let h = 0; const t = String(seed || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h % AVATAR_TINTS.length;
}
function hubAvatarHtml(p, size, onNow) {
  const i = avatarTintIndex(p.staff_id);
  const inner = p.avatar_key
    ? `<img src="${escAttr(`${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${String(p.avatar_key).split('/').map(encodeURIComponent).join('/')}`)}" alt="">`
    : `<span style="color:${AVATAR_INKS[i]};font-size:${Math.round(size * 0.42)}px">${esc(String(p.name || '?').charAt(0).toUpperCase())}</span>`;
  return `<span class="hub-av" style="width:${size}px;height:${size}px;background:${AVATAR_TINTS[i]}">${inner}${onNow ? '<span class="on-now" title="On shift now"></span>' : ''}</span>`;
}
function hmToMin(t) { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; }

async function loadTeamToday(studioId) {
  const el = document.getElementById('card-team-today');
  if (!el) return;
  const [{ data, error }, sick, notes] = await Promise.all([
    sb.rpc('hub_today_team', { p_studio_id: studioId || null }),
    loadSickCalls(studioId, 0),
    sb.rpc('hub_studio_notes', { p_studio: studioId || _sessionStudioId, p_date: localDateStr(new Date()) }).then(r => r, () => ({ data: null }))
  ]);
  // today's day note and shift notes (shift_day_notes.sql; none until it's run)
  _teamNotes = { day: (notes && notes.data && notes.data.day_note) || '', by: {} };
  ((notes && notes.data && notes.data.shifts) || []).forEach(x => { _teamNotes.by[x.staff_id] = x.note; });
  _sickToday = {}; sick.forEach(c => { _sickToday[c.staff_id] = c; });
  await loadBreakWarnings();
  if (error) {
    // Not set up yet (SQL not run) or not allowed — leave the card out.
    console.error('Who\'s working load failed:', error);
    el.style.display = 'none'; el.innerHTML = ''; _teamCount = 0;
    return;
  }
  renderTeamToday(data || []);
}
function renderTeamToday(rows) {
  const el = document.getElementById('card-team-today');
  // One entry per person (someone can have a split shift).
  const byPerson = new Map();
  rows.forEach(r => {
    const p = byPerson.get(r.staff_id) || { staff_id: r.staff_id, name: r.name, avatar_key: r.avatar_key, role_tag: r.role_tag, nickname: r.nickname || null, full_name: r.full_name || null, shifts: [] };
    p.shifts.push({ start: r.start_time, end: r.end_time });
    byPerson.set(r.staff_id, p);
  });
  const people = [...byPerson.values()];
  _teamPeople = people; setTimeout(() => { try { ocAlerts(); } catch (e) {} }, 0);
  _teamCount = people.length;
  if (_dutiesLoaded) renderDuties(); // duty pickers use today's team
  if (_classInfo && _lastHeroData) renderFloorToday(_lastHeroData); // role chips use avatars
  if (_lastHeroData) renderDailyHero(_lastHeroData); // hero line includes the team count

  if (!people.length) {
    el.innerHTML = `<div class="team-title">Who's working</div>
      <div class="team-empty">No shifts posted for today yet. They show here once they're approved in the staff schedule.</div>`;
    el.style.display = '';
    return;
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const firstStart = Math.min(...people.map(p => Math.min(...p.shifts.map(s => hmToMin(s.start)))));
  const lastEnd = Math.max(...people.map(p => Math.max(...p.shifts.map(s => hmToMin(s.end)))));
  const sickNow = people.filter(p => _sickToday[p.staff_id]);
  el.innerHTML = `<div class="team-title">Who's working</div>
    ${_teamNotes.day ? `<div class="team-daynote">📝 ${esc(_teamNotes.day)}</div>` : ''}
    ${sickNow.map(p => sickAlertHtml(_sickToday[p.staff_id], p)).join('')}
    ${people.filter(p => _breakWarn[p.staff_id]).map(p => `<div class="sick-alert wait">⏰ <b>${esc(p.name)}</b>${_breakWarn[p.staff_id].startsWith('’') ? '' : ' '}${esc(_breakWarn[p.staff_id])}.</div>`).join('')}
    <div class="team-list">${people.map(p => {
      const onNow = p.shifts.some(s => hmToMin(s.start) <= nowMin && nowMin < hmToMin(s.end));
      const done = p.shifts.every(s => hmToMin(s.end) <= nowMin);
      const opens = p.shifts.some(s => hmToMin(s.start) === firstStart);
      const closes = p.shifts.some(s => hmToMin(s.end) === lastEnd);
      const tags = [
        _sickToday[p.staff_id] ? '<span class="team-tag sick">🤒 Called in sick</span>' : '',
        _teamNotes.by[p.staff_id] ? `<span class="team-tag note" title="${escAttr(_teamNotes.by[p.staff_id])}">📝 ${esc(_teamNotes.by[p.staff_id])}</span>` : '',
        p.role_tag ? `<span class="team-tag">${esc(p.role_tag)}</span>` : '',
        opens ? '<span class="team-tag open">Opening</span>' : '',
        closes ? '<span class="team-tag close">Closing</span>' : '',
      ].join('');
      return `<div class="team-row${done ? ' done' : ''}${_sickToday[p.staff_id] ? ' sick' : ''}">
        ${hubAvatarHtml(p, 44, onNow)}
        <div class="team-who">
          <span class="team-name">${esc(p.name)}</span>
          <span class="team-shift">${p.shifts.map(s => `${shortTime(s.start)} – ${shortTime(s.end)}`).join(', ')}</span>
        </div>
        ${tags ? `<div class="team-tags">${tags}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  el.style.display = '';
}

// ---------- Today's events / festivals ----------
// hub_today_events(): events coordinators added (index.html → Add Event), with
// their details. Shown at the top of "On stage today".
let _todayEvents = [];
async function loadTodayEvents(studioId) {
  const { data, error } = await sb.rpc('hub_today_events', { p_studio_id: studioId || null });
  _todayEvents = error ? [] : (Array.isArray(data) ? data : []);
  if (error) console.error('Events load failed:', error);
  if (_lastHeroData) renderDailyHero(_lastHeroData);   // redraws the floor card too
}
function eventBlockHtml(ev) {
  const time = ev.start_time ? `${shortTime(ev.start_time)}${ev.end_time ? ' – ' + shortTime(ev.end_time) : ''}` : '';
  const staff = (ev.staff || []);
  return `<div class="ev-row">
    <div class="ev-tag">🎪 Event</div>
    <div class="ev-main">
      <div class="ev-title">${esc(ev.title)}${time ? ` <span class="ev-time">${esc(time)}</span>` : ''}</div>
      ${ev.project ? `<div class="ev-line"><b>Project:</b> ${esc(ev.project)}</div>` : ''}
      ${ev.day_plan ? `<div class="ev-line ev-plan">${esc(ev.day_plan)}</div>` : ''}
      ${staff.length || ev.staff_needed ? `<div class="ev-staff">${staff.map(p => `<span class="duty-who">${hubAvatarHtml(p, 22)} ${esc(p.name)}</span>`).join('')}
        ${ev.staff_needed ? `<span class="ev-need">${ev.staff_needed} staff needed</span>` : ''}</div>` : ''}
    </div>
  </div>`;
}

// ---------- Who's teaching + lesson plans ----------
// Read the same way the schedule's Day view does (studio login): today's
// sessions, session_staff (Director / Demoers / Circlers for the day, the
// wheel teacher, and kids class teachers from the staff schedule),
// party_details (party teachers) and curriculum_weeks (lesson plan links).
let _classInfo = null;   // { byKey: { 'HH:MM:SS|title': {...} }, roles: {...}, curriculum: [] }
const ROLE_FIELDS = [['director', 'Director'], ['teacher', 'Demoer'], ['teacher2', 'Demoer'], ['circler', 'Circler'], ['circler2', 'Circler'], ['circler3', 'Circler']];

async function loadClassStaff(studioId) {
  const today = localDateStr(new Date());
  // Fill today's blank roles from the staff schedule (once a day per studio,
  // hub_auto_roles.sql). Quietly skipped if that SQL isn't run yet.
  try {
    const f = await sb.rpc('hub_fill_roles', { p_studio_id: studioId || null });
    if (f.error && !/hub_fill_roles/i.test(f.error.message)) console.error('Role fill failed:', f.error);
  } catch (e) { /* not set up yet */ }
  try {
    const { data: sess, error } = await sb.from('sessions').select('id, title, session_time, session_type, spaces_left_cache')
      .eq('studio_id', studioId).eq('session_date', today);
    if (error) throw error;
    const ids = (sess || []).map(x => x.id);
    const partyIds = (sess || []).filter(x => x.session_type === 'party').map(x => x.id);
    const [st, cur, pb] = await Promise.all([
      ids.length ? sb.from('session_staff').select('*').in('session_id', ids) : Promise.resolve({ data: [] }),
      sb.from('curriculum_weeks').select('*'),
      partyIds.length ? sb.from('bookings').select('id, session_id, raw_payload').in('session_id', partyIds).gt('qty', 0).is('returned_at', null) : Promise.resolve({ data: [] })
    ]);
    const pbIds = (pb.data || []).map(b => b.id);
    const pd = pbIds.length ? await sb.from('party_details').select('booking_id, party_teacher1, party_teacher2, actual_art_time').in('booking_id', pbIds) : { data: [] };
    // how long each party keeps its teachers busy (art time)
    const partyBusy = {};
    (pb.data || []).forEach(b => {
      const x = (sess || []).find(z => z.id === b.session_id) || {};
      const d = (pd.data || []).find(z => z.booking_id === b.id);
      partyBusy[b.session_id] = Math.max(partyBusy[b.session_id] || 0, hubPartyBusyMin(x.title, b.raw_payload, d));
    });
    const staffBy = {}; (st.data || []).forEach(r => { staffBy[r.session_id] = r; });
    const partyTeachers = {};
    (pb.data || []).forEach(b => {
      const d = (pd.data || []).find(x => x.booking_id === b.id);
      if (!d) return;
      const list = partyTeachers[b.session_id] = partyTeachers[b.session_id] || [];
      [d.party_teacher1, d.party_teacher2].forEach(n => { n = String(n || '').trim(); if (n && !list.includes(n)) list.push(n); });
    });
    const byKey = {};
    (sess || []).forEach(x => {
      byKey[String(x.session_time || '').slice(0, 8) + '|' + x.title] = {
        id: x.id, type: x.session_type, spaces: x.spaces_left_cache, staff: staffBy[x.id] || {}, party: partyTeachers[x.id] || [], partyBusy: partyBusy[x.id] || null
      };
    });
    // Roles for the day: the first session that has any set (same as the Day view).
    // (kids classes keep their own teacher in the same field, so they're skipped)
    const isKidsRow = x => x.session_type === 'class' || x.session_type === 'series' || /class \d+ of \d+|week session/i.test(x.title || '');
    const withRoles = (sess || []).filter(x => !isKidsRow(x)).map(x => staffBy[x.id]).filter(r => r && ROLE_FIELDS.some(([f]) => String(r[f] || '').trim()));
    const pick = withRoles.find(r => true) || {};
    // Kids class weeks 2+ ("Class 4 of 4"): the families booked the series, so the
    // bookings sit on week 1. Count the week's roster (same as the Schedule), and
    // keep the rows so "On stage" can add any the daily summary leaves out.
    const kidsWeeks = (sess || []).filter(x => /\bclass\s+([2-9]|\d{2,})\s+of\s+\d+/i.test(x.title || ''));
    const rosters = await Promise.all(kidsWeeks.map(x => sb.rpc('get_class_week_bookings', { p_session_id: x.id })));
    const kidsRows = kidsWeeks.map((x, i) => ({ time: x.session_time, title: x.title,
      bookingCount: rosters[i].error ? 0 : (rosters[i].data || []).reduce((n, b) => n + (b.qty || 0), 0), ok: !rosters[i].error }));
    let campTeam = {};
    const campIds = (sess || []).filter(x => /camp|pa day|pd day|pa\/pd|no school/i.test(x.title || '')).map(x => x.id);
    if (campIds.length) { try { const ct = await sb.rpc('hub_camp_team', { p_session_ids: campIds }); if (!ct.error) campTeam = ct.data || {}; } catch (e) {} }
    _classInfo = { byKey, roles: pick, curriculum: cur.data || [], kidsRows, campTeam };
  } catch (e) {
    console.error('Class staff load failed:', e);
    _classInfo = null;
  }
  if (_lastHeroData) renderDailyHero(_lastHeroData);   // hero line + floor list
}

// A typed name ("Rainbow Ruby", "Ruby Smith", "Ruby") → today's team member, if one matches.
function teamMatch(typed) {
  const t = String(typed || '').trim().toLowerCase();
  if (!t) return null;
  return _teamPeople.find(p => [p.name, p.nickname, p.full_name].some(n => n && String(n).trim().toLowerCase() === t))
    || _teamPeople.find(p => p.full_name && String(p.full_name).toLowerCase().split(' ')[0] === t)
    || null;
}
function personChip(typed, role) {
  const p = teamMatch(typed);
  const who = p || { staff_id: typed, name: typed, avatar_key: null };
  return `<span class="role-chip">${hubAvatarHtml(who, 20)}${role ? `<b>${esc(role)}</b> ` : ''}${esc(p ? p.name : typed)}</span>`;
}
function rolesStripHtml() {
  const r = (_classInfo && _classInfo.roles) || {};
  const groups = {};
  ROLE_FIELDS.forEach(([f, label]) => {
    const n = String(r[f] || '').trim();
    if (!n) return;
    const brk = String(r['break_' + f] || '').trim();
    (groups[label] = groups[label] || []).push({ n, brk });
  });
  const labels = Object.keys(groups);
  if (!labels.length) return '';
  // Still exactly what was filled in automatically?
  const auto = r.auto_roles || {};
  const isAuto = ROLE_FIELDS.some(([f]) => auto[f]) && ROLE_FIELDS.every(([f]) => !String(r[f] || '').trim() || auto[f] === r[f]);
  return `<div class="roles-strip">${isAuto ? '<div class="roles-auto">Filled in from the staff schedule · change them in the schedule’s Day view</div>' : ''}${labels.map(label => `<div class="roles-group"><span class="roles-label">${esc(label)}${groups[label].length > 1 ? 's' : ''}</span>
    ${groups[label].map(x => `<span class="role-chip">${hubAvatarHtml(teamMatch(x.n) || { staff_id: x.n, name: x.n }, 22)}${esc((teamMatch(x.n) || {}).name || x.n)}${x.brk ? `<small>break ${esc(x.brk)}</small>` : ''}</span>`).join('')}</div>`).join('')}</div>`;
}
// Same rules as index.html's getCurriculumLinks: a fixed link for the class type, else this week's.
function lessonPlanFor(title, date) {
  const list = (_classInfo && _classInfo.curriculum) || [];
  const t = String(title || '').toLowerCase();
  const fixed = list.find(r => r.session_type_key && !r.week_start && t.includes(String(r.session_type_key).toLowerCase()));
  const row = (fixed && (fixed.website_url || fixed.curriculum_url)) ? fixed
    : list.find(r => r.week_start && r.week_end && date >= r.week_start && date <= r.week_end);
  return row ? safeHttpUrl(row.curriculum_url) : null;
}
let _floorDemo = {};
function classStaffHtml(s) {
  if (!_classInfo) return '';
  const info = _classInfo.byKey[String(s.time || '').slice(0, 8) + '|' + s.title];
  if (!info) return '';
  const chips = [];
  const title = String(s.title || '').toLowerCase();
  if (info.type === 'party') info.party.forEach(n => chips.push(personChip(n, 'Party')));
  else if (/wheel/.test(title) && info.staff.wheel_teacher) chips.push(personChip(info.staff.wheel_teacher, 'Teacher'));
  else if (/camp|pa day|pd day|pa\/pd|no school/.test(title)) {   // camps: their own lead + teachers
    (((_classInfo.campTeam || {})[info.id]) || []).forEach(t => chips.push(personChip(t.full_name || t.name, t.role === 'lead' ? 'Lead' : 'Teacher')));
  }
  else if (info.type === 'series' || info.type === 'class' || /class \d+ of \d+|week session/.test(title)) {
    const pl = (_floorDemo || {})[String(s.time || '').slice(0, 8) + '|' + s.title];
    (pl && pl.teachers || []).forEach(n => chips.push(personChip(n, 'Teacher')));
  }
  else if (!/wheel/.test(title) && info.type !== 'party' && Number(s.bookingCount || 0) > 0) {
    // Workshops, glazing, Mini Make with people booked: the day's demoers who aren't teaching then
    const pl = (_floorDemo || {})[String(s.time || '').slice(0, 8) + '|' + s.title];
    const html = hubDemoChips(pl);
    if (html) return `<div class="floor-staff">${html}</div>`;
  }
  return chips.length ? `<div class="floor-staff">${chips.join('')}</div>` : '';
}

// ---------- Who demos what (Today screen + Schedule) ----------
// A kids class's teacher and a wheel workshop's teacher are busy for 90 minutes
// from the start; a kids party's teachers for its art time (first 60 minutes).
// Every other session gets the day's demoers who aren't busy then; if none are
// free, the Director; if the Director's busy too, it needs a demoer.
// A kids class with no teacher set gets the first free demoer.
const HUB_BUSY_MIN = { kids: 90, wheel: 90, party: 60 };
const HUB_DEMO_MIN = 15;   // a demo keeps the demoer busy for the first 15 minutes of a session (same as the day board)
// A party keeps its teachers busy for its art time: what the customer chose (60 or 90
// minutes) or the actual art time on the party form. Team building: 15 minutes.
function hubPartyBusyMin(title, rawPayload, detail) {
  if (/team\s*building|get.?together/i.test(title || '')) return 15;   // (only the intro, then it runs like a workshop)
  let art = detail && detail.actual_art_time;
  if (!art) {
    try { const sub = getPartySubtype(title || ''); art = parseAddonDetails(parsePartyAddons(rawPayload, sub), sub).artTime; } catch (e) {}
  }
  return /90/.test(String(art || '')) ? 90 : 60;
}
const hubNameKey = n => String(n || '').trim().toLowerCase();
const hubMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
// rows: [{ key, start (minutes), kind: 'kids'|'wheel'|'party'|'other', teachers: [names], booked }]
function hubDemoPlan(rows, roles) {
  roles = roles || {};
  const demoers = [roles.teacher, roles.teacher2].map(n => String(n || '').trim()).filter(Boolean);
  const director = String(roles.director || '').trim();
  const busy = [];   // { name, start, end }
  const isBusy = (n, t) => busy.some(b => b.name === hubNameKey(n) && t >= b.start && t < b.end);
  // (Nov 8 2026, same as the day board) each role's break: nobody is picked to demo or teach on their break
  ['director', 'teacher', 'teacher2', 'circler', 'circler2', 'circler3'].forEach(f => {
    const who = String(roles[f] || '').trim(), m = String(roles['break_' + f] || '').match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
    if (!who || !m) return;
    const h = v => { v = +v; return v < 8 ? v + 12 : v; };
    busy.push({ name: hubNameKey(who), start: h(m[1]) * 60 + +m[2], end: h(m[3]) * 60 + +m[4], why: 'break' });
  });
  const out = {};
  const sorted = rows.slice().sort((a, b) => a.start - b.start);
  // 1. teaching blocks, in time order (a kids class with no teacher takes the first free demoer)
  sorted.filter(r => r.kind !== 'other').forEach(r => {
    let names = (r.teachers || []).map(n => String(n || '').trim()).filter(Boolean), auto = false;
    if (!names.length && r.kind === 'kids') {
      const free = demoers.find(n => !isBusy(n, r.start)) || (director && !isBusy(director, r.start) ? director : '');
      if (free) { names = [free]; auto = true; }
    }
    names.forEach(n => busy.push({ name: hubNameKey(n), start: r.start, end: r.start + (r.busy || HUB_BUSY_MIN[r.kind] || 90), why: r.kind }));
    out[r.key] = { teachers: names, auto };
  });
  // 2. everything else: whoever the day board set for this time (session_staff.demo_by), else free demoers, else the Director, else nobody
  sorted.filter(r => r.kind === 'other').forEach(r => {
    const set = String(r.demoBy || '').trim();
    if (set) { out[r.key] = { demo: [set], set: true }; return; }
    const free = demoers.filter(n => !isBusy(n, r.start));
    if (free.length) out[r.key] = { demo: free };
    else if (director && !isBusy(director, r.start)) out[r.key] = { demo: [director], viaDirector: true };
    else out[r.key] = { demo: [], none: demoers.length > 0 || !!director };
  });
  // every busy block (teaching + the start of anything they demo), for break planning
  const blocks = busy.slice();
  sorted.filter(r => r.kind === 'other').forEach(r => (out[r.key].demo || []).forEach(n => blocks.push({ name: hubNameKey(n), start: r.start, end: r.start + HUB_DEMO_MIN, why: 'demo' })));
  Object.defineProperty(out, '_blocks', { value: blocks, enumerable: false });
  return out;
}
function hubDemoChips(plan) {
  if (!plan) return '';
  if (plan.demo && plan.demo.length) return plan.demo.map(n => personChip(n, 'Demo')).join('');
  if (plan.none) return '<span class="role-chip" style="background:#fff4dd;color:#9a3412">⚠ Needs a demoer (everyone’s teaching)</span>';
  return '';
}

// ---------- On stage today ----------
// Kind chip from the session title — display only, never used for logic.
function sessionKind(title) {
  const t = String(title || '');
  if (/party/i.test(t)) return ['Party', 'party'];
  if (/wheel/i.test(t)) return ['Wheel', 'wheel'];
  if (/camp|pa day|pd day/i.test(t)) return ['Camp', 'camp'];
  if (/class \d+ of \d+|week session|kids/i.test(t)) return ['Kids class', 'kids'];
  if (/glaz/i.test(t)) return ['Glazing', 'glazing'];
  if (/festival|event/i.test(t)) return ['Event', 'event'];
  return ['Workshop', 'workshop'];
}
function renderFloorToday(data) {
  const el = document.getElementById('card-floor-today');
  if (!el) return;
  // Older function versions don't send sessions — just leave the card out.
  if (!data || !Array.isArray(data.sessions)) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const now = new Date();
  const nowHM = now.getHours() * 60 + now.getMinutes();
  // Events are shown in their own block, so leave their placeholder session rows out.
  const evTitles = new Set(_todayEvents.map(e => String(e.title || '').trim().toLowerCase()));
  const keyOf = s => String(s.time || '').slice(0, 8) + '|' + s.title;
  const merged = data.sessions.map(s => Object.assign({}, s));
  // Kids class weeks 2+: use the week's enrolled count, and add any the daily summary missed
  ((_classInfo && _classInfo.kidsRows) || []).forEach(k => {
    const have = merged.find(s => keyOf(s) === keyOf(k));
    if (have) { if (!Number(have.bookingCount)) have.bookingCount = k.bookingCount; }
    else merged.push({ time: k.time, title: k.title, bookingCount: k.bookingCount });
  });
  const allSessions = merged.filter(s => !evTitles.has(String(s.title || '').trim().toLowerCase()))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  // 0 booked and 0 spots open = not running today. A kids class with nobody enrolled isn't running either (rules doc 1:
  // nobody enrolled = no class, no teacher), once the class counts have loaded.
  // (by its title only: workshops and glazing can share the database type 'class', and an open workshop with nobody booked
  // yet must always show)
  const isKidsClass = s => /class \d+ of \d+|week session/i.test(s.title || '') || s.title === 'Catch Up Class';
  const notRunning = s => {
    if (!_classInfo || Number(s.bookingCount || 0) > 0) return false;
    if (isKidsClass(s)) {
      if (!_classInfo.kidsRows || s.title === 'Catch Up Class') return false;
      // weeks 2+: only when that week's class list really loaded (a failed load must never hide a class)
      const wk = _classInfo.kidsRows.find(k => String(k.time || '').slice(0, 8) + '|' + k.title === String(s.time || '').slice(0, 8) + '|' + s.title);
      return wk ? wk.ok === true : true;
    }
    const info = _classInfo.byKey[String(s.time || '').slice(0, 8) + '|' + s.title];
    if (!info || info.spaces === null || info.spaces === undefined || Number(info.spaces) > 0) return false;
    return !(info.type === 'class' || info.type === 'series' || /class \d+ of \d+|week session/i.test(s.title || '') || s.title === 'Catch Up Class');
  };
  const sessions = allSessions.filter(s => !notRunning(s));
  // who demos what (teaching blocks: kids classes, wheel, party art time)
  _floorDemo = hubDemoPlan(sessions.map(s => {
    const key = keyOf(s), info = (_classInfo && _classInfo.byKey[key]) || null, title = String(s.title || '').toLowerCase();
    const kind = !info ? 'other' : /camp|pa day|pd day|pa\/pd|no school/i.test(s.title || '') ? 'skip'   // camps have their own staff
      : info.type === 'party' ? (Number(s.bookingCount || 0) > 0 ? 'party' : 'skip')
      : /wheel/.test(title) ? 'wheel'
      : (info.type === 'series' || info.type === 'class' || /class \d+ of \d+|week session/.test(title)) ? 'kids' : 'other';
    const teachers = !info ? [] : kind === 'party' ? (info.party || []) : kind === 'wheel' ? [info.staff.wheel_teacher] : kind === 'kids' ? [info.staff.teacher] : [];
    return { key, start: hubMin(s.time), kind, teachers, booked: Number(s.bookingCount || 0), busy: kind === 'party' ? (info.partyBusy || hubPartyBusyMin(s.title)) : null,
             demoBy: info && info.staff ? info.staff.demo_by || '' : '' };
  }).filter(r => r.kind !== 'skip'), (_classInfo && _classInfo.roles) || {});
  const offToday = allSessions.filter(notRunning);
  const rows = sessions.map(s => {
    const [h, m] = String(s.time || '00:00').split(':').map(Number);
    // Faded once it's more than 2 hours past the start time.
    const past = (h * 60 + m) + 120 < nowHM;
    const t = formatSessionTime(String(s.time || '00:00:00'));
    const [clock, ampm] = t.split(' ');
    const [kindLabel, kindCls] = sessionKind(s.title);
    const booked = Number(s.bookingCount || 0);
    return `
      <div class="floor-row tap${past ? ' past' : ''}" data-open-today="${escAttr(String(s.time || '').slice(0, 8) + '|' + s.title)}" tabindex="0">
        <div class="floor-time">${esc(clock)}<small>${esc(ampm.toLowerCase())}</small></div>
        <div class="floor-main">
          <div class="floor-name">${esc(s.title)}</div>
          <span class="kind-chip kind-${kindCls}">${esc(kindLabel)}</span>
          ${classStaffHtml(s)}
        </div>
        <div class="floor-booked"><b>${booked}</b> booked</div>
        ${lessonPlanFor(s.title, localDateStr(new Date())) ? `<a class="floor-btn lp" href="${escAttr(lessonPlanFor(s.title, localDateStr(new Date())))}" target="_blank" rel="noopener">Lesson plan</a>` : ''}
        ${projBtnHtml(((_classInfo && _classInfo.byKey[String(s.time || '').slice(0, 8) + '|' + s.title]) || {}).id, s.title, 'floor-btn')}
        <button class="floor-btn" onclick="openTodayClassList(${escAttr(JSON.stringify(String(s.time || '').slice(0, 8) + '|' + s.title))})">Class list</button>
      </div>`;
  }).join('');
  el.innerHTML = `
    <div class="floor-head">
      <div class="floor-title">On stage today</div>
      <div class="floor-count">${[sessions.length || !_todayEvents.length ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}` : '', _todayEvents.length ? `${_todayEvents.length} event${_todayEvents.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}</div>
      <div class="spacer"></div>
      <button class="floor-btn" onclick="openPlanAhead()">🗓️ Open the schedule</button>
    </div>
    ${rolesStripHtml()}
    ${_todayEvents.length ? `<div class="ev-list">${_todayEvents.map(eventBlockHtml).join('')}</div>` : ''}
    <div class="floor-list">${rows || `<div class="floor-empty">${_todayEvents.length ? 'No classes booked today.' : 'Nothing booked today.'}</div>`}</div>
    ${offToday.length ? `<details class="plan-closed"><summary>Not running today (${offToday.length}) · nobody booked or enrolled</summary>
      ${offToday.map(s => `<div class="plan-sess off"><span class="t">${esc(shortTime(s.time))}</span><span class="nm">${esc(s.title)}</span></div>`).join('')}
      <div class="goal-note" style="margin:6px 2px">A coordinator can open spots from the Schedule.</div></details>` : ''}`;
  el.style.display = '';
}

async function loadDailyHero(pin, studioId) {
  try {
    const data = await fetchDailySnapshotWithPin(pin, studioId);
    renderDailyHero(data);
  } catch (e) {
    console.error('Daily hero load failed:', e);
    // Fail quietly — a broken greeting shouldn't disrupt the rest of the page.
  }
}

// ---------- Today's Projects (live for everyone, company-wide) ----------

let _projectsDate = null;          // date currently shown, so we can refresh after midnight
let _projectsTimer = null;
const PROJECTS_RECHECK_MS = 10 * 60 * 1000;


// Called with the studio login's token: the function returns the printout /
// template links only to a signed-in studio login (photos, names and medium
// for everyone else).
async function fetchProjectsForDate(dateStr) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_projects_for_date`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ p_date: dateStr })
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.message) || 'Request failed');
  return data;
}

// Only plain web links are turned into buttons (never javascript: etc.).
function safeHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

function projectTileHtml(p) {
  const photo = p.image_url
    ? `<img class="ph" src="${escAttr(p.image_url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;ph-none&quot;>No photo</div>'">`
    : `<div class="ph-none">No photo</div>`;
  const pill = p.medium ? `<span class="medium-pill">${esc(p.medium)}</span>` : '';

  // Printout links — only present for a signed-in studio login, and only if
  // filled in (projects.html → Library). Order: the shared base sheet for the
  // shape (e.g. "Pinch bowl"), then this project's own steps, then template.
  const links = [
    { url: safeHttpUrl(p.base_printout_url), label: '🖨 ' + (p.base_printout_name ? p.base_printout_name + ' base' : 'Base') },
    { url: safeHttpUrl(p.printout_url), label: p.base_printout_url ? '🖨 Steps' : '🖨 Printout' },
    ...(p.extra_printouts || []).map((x, i) => ({ url: safeHttpUrl(x && x.url), label: '🖨 ' + ((x && x.label) || 'Printout ' + (i + 2)) })),
    { url: safeHttpUrl(p.template_url), label: '📐 Template' }
  ].filter(l => l.url)
   .map(l => `<a class="project-link" href="${escAttr(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(l.label)}</a>`)
   .join('');
  const tileKey = String(p.id || p.name || '');
  _projectTiles[tileKey] = p;
  const needBtn = `<button type="button" class="project-link" onclick="event.stopPropagation();openProjectSupplies(${escAttr(JSON.stringify(tileKey))})">🧰 What's needed</button>`;

  return `<div class="project-tile tap" role="button" tabindex="0"
      onclick="openProjectSupplies(${escAttr(JSON.stringify(tileKey))})"
      onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.click(); }">
      <div class="ph-wrap">${photo}${pill}</div>
      <div class="info">
        <div class="nm">${esc(p.name)}</div>
        <div class="project-links">${links}${needBtn}</div>
      </div>
    </div>`;
}

// ---------- Project tools & materials (tap a project tile) ----------
// Tools and materials come with each project from get_projects_for_date()
// (set up in projects.html → Library → a project → What's needed).
// Amounts are per person.
const _projectTiles = {};        // project id → tile data from get_projects_for_date

function fmtQty(q) {
  const n = Number(q);
  if (q === null || q === undefined || q === '' || isNaN(n)) return '';
  return String(Math.round(n * 100) / 100);
}

function openProjectSupplies(key) {
  const p = _projectTiles[key];
  if (!p) return;
  document.getElementById('ps-modal-title').textContent = p.name;
  const body = document.getElementById('ps-modal-body');
  document.getElementById('ps-modal').style.display = 'flex';
  document.body.classList.add('ps-open');
  const card = document.querySelector('#ps-modal .prize-modal-card'); if (card) card.scrollTop = 0;
  const tools = Array.isArray(p.tools) ? p.tools : [];
  const mats = Array.isArray(p.materials) ? p.materials : [];
  const prepped = Array.isArray(p.prepped) ? p.prepped : [];
  const photo = p.image_url
    ? `<img src="${escAttr(p.image_url)}" alt="" onerror="this.outerHTML='<div class=&quot;ph-none&quot;></div>'">`
    : `<div class="ph-none"></div>`;
  const toolsHtml = tools.length
    ? `<ul>${tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
    : `<div class="ps-empty">No tools listed yet.</div>`;
  const matsHtml = mats.length
    ? `<ul>${mats.map(m => {
        const q = fmtQty(m.qty);
        const amt = q ? `${q}${m.unit ? (m.unit === 'g' ? 'g' : ' ' + m.unit) : ''}` : '';
        return `<li><span>${esc(m.name)}${m.note ? `<small>${esc(m.note)}</small>` : ''}</span>${amt ? `<span class="q">${esc(amt)}</span>` : ''}</li>`;
      }).join('')}</ul>`
    : `<div class="ps-empty">No materials listed yet.</div>`;
  const preppedHtml = prepped.length
    ? `<div class="ps-sec ps-prep"><h4>✂️ Prepped ahead</h4><ul>${prepped.map(x => {
        const q = fmtQty(x.qty);
        return `<li><span>${esc(x.name)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>${q ? `<span class="q">× ${esc(q)}</span>` : ''}</li>`;
      }).join('')}</ul></div>`
    : '';
  const links = [
    { url: safeHttpUrl(p.curriculum_url), label: '📘 Curriculum' },
    { url: safeHttpUrl(p.step_by_step_url), label: '📋 Step-by-step' },
    { url: safeHttpUrl(p.base_printout_url), label: '🖨 ' + (p.base_printout_name ? p.base_printout_name + ' base' : 'Base') },
    { url: safeHttpUrl(p.printout_url), label: p.base_printout_url ? '🖨 Steps' : '🖨 Printout' },
    ...(p.extra_printouts || []).map((x, i) => ({ url: safeHttpUrl(x && x.url), label: '🖨 ' + ((x && x.label) || 'Printout ' + (i + 2)) }))
  ].concat(Array.isArray(p.templates) ? p.templates.map(t => ({ url: safeHttpUrl(t && t.url), label: '📐 ' + ((t && t.name) || 'Template') }))
          : [{ url: safeHttpUrl(p.template_url), label: '📐 Template' }]).filter(l => l.url);
  const facts = [p.make_quantity ? 'Makes ' + p.make_quantity : '', p.sizing ? 'Size: ' + p.sizing : ''].filter(Boolean).join(' · ');
  body.innerHTML = `
    <div class="ps-top">${photo}<div>${p.medium ? `<div class="ps-medium">${esc(p.medium)}</div>` : ''}
      ${facts ? `<div class="ps-facts">${esc(facts)}</div>` : ''}
      <div class="ps-empty">Amounts are per person.</div></div></div>
    ${links.length ? `<div class="ps-links ps-links-top">${links.map(l => `<a class="project-link" href="${escAttr(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>` : ''}
    <div class="ps-cols">
      <div class="ps-sec"><h4>🧰 Tools</h4>${toolsHtml}</div>
      <div class="ps-sec"><h4>🎨 Materials</h4>${matsHtml}</div>
      ${preppedHtml}
    </div>
    ${p.notes ? `<div class="ps-sec ps-notes"><h4>📝 Notes</h4><div>${esc(p.notes).replace(/\n/g, '<br>')}</div></div>` : ''}`;
}

// ---- 📘 Project on the Schedule and Today tabs (hub_session_projects.sql) ----
// Each workshop or class time gets a button that opens its project card (the "What's needed" pop-up, plus curriculum,
// step-by-step, templates, makes and notes). The button starts hidden; once the list is on screen, the times' projects
// are fetched in one go and the buttons with a project show. Glazing, parties and camps have none (for now).
const _sessProj = {};   // session id → project card, or null when it has none
let _projFillPending = false;
const NO_PROJECT_RE = /glaz|party|parties|camp|\bpa\s*\/?\s*pd\b|pa day|pd day|no school|get.?together|team building|field trip/i;
function projBtnHtml(sid, title, cls) {
  if (!sid || NO_PROJECT_RE.test(String(title || ''))) return '';
  const c = _sessProj[sid];
  if (c === null) return '';
  if (c === undefined && !_projFillPending) { _projFillPending = true; setTimeout(() => { _projFillPending = false; hubFillProjectButtons(); }, 0); }
  return `<button class="${cls} proj-btn" data-proj-sid="${escAttr(sid)}"${c ? '' : ' style="display:none"'} onclick="event.stopPropagation();openSessionProject('${escAttr(sid)}')">📘 Project</button>`;
}
async function hubFillProjectButtons() {
  const btns = [...document.querySelectorAll('[data-proj-sid]')];
  const need = [...new Set(btns.map(b => b.dataset.projSid).filter(id => !(id in _sessProj)))];
  for (let i = 0; i < need.length; i += 300) {
    const chunk = need.slice(i, i + 300);
    const { data, error } = await sb.rpc('hub_session_projects', { p_ids: chunk });
    if (error) { chunk.forEach(id => { _sessProj[id] = null; }); continue; }   // (before the SQL is run: no buttons)
    const d = data || {};
    await resolveUploadedSheetLinks({ projects: Object.values(d) });
    chunk.forEach(id => { _sessProj[id] = d[id] || null; });
  }
  document.querySelectorAll('[data-proj-sid]').forEach(b => { b.style.display = _sessProj[b.dataset.projSid] ? '' : 'none'; });
}
function openSessionProject(sid) {
  const p = _sessProj[sid]; if (!p) return;
  _projectTiles['sess:' + sid] = p; openProjectSupplies('sess:' + sid);
}

function closeProjectSupplies() {
  document.getElementById('ps-modal').style.display = 'none';
  document.body.classList.remove('ps-open');
}

// Shows Today + Tomorrow; the arrow opens the rest of the week in place.
// Open/closed is remembered for the page, so the 10-minute refresh and
// admin studio switches don't snap it shut.
let _forecastExpanded = false;
let _lastForecastDays = [];

function forecastPillsHtml(forecastDays) {
  if (!forecastDays || !forecastDays.length) return '';
  _lastForecastDays = forecastDays;
  const shown = _forecastExpanded ? forecastDays : forecastDays.slice(0, 2);
  const pills = shown.map((d, i) => `
      <div class="forecast-pill${i === 0 ? ' today' : ''}${i >= 2 ? ' extra' : ''}">
        ${esc(forecastDayLabel(d.date, i))} · ${esc(weatherLabel(d.code))} ${weatherEmoji(d.code)} <span class="forecast-temp">${d.tempMax}° / ${d.tempMin}°</span>
      </div>`).join('');
  const toggle = forecastDays.length > 2 ? `
      <button class="forecast-toggle" onclick="toggleForecastWeek()"
              aria-expanded="${_forecastExpanded}"
              aria-label="${_forecastExpanded ? 'Hide the rest of the week' : 'Show the rest of the week'}"
              title="${_forecastExpanded ? 'Hide the rest of the week' : 'Show the rest of the week'}">${_forecastExpanded ? '‹' : '›'}</button>` : '';
  return `<div class="forecast-row" id="forecast-row">${pills}${toggle}</div>`;
}

function toggleForecastWeek() {
  _forecastExpanded = !_forecastExpanded;
  const row = document.getElementById('forecast-row');
  if (row) row.outerHTML = forecastPillsHtml(_lastForecastDays);
}

function renderTodaysProjects(data, forecastDays) {
  const card = document.getElementById('card-todays-projects');
  if (!card) return;
  if (!data) { card.style.display = 'none'; return; }
  card.style.display = '';

  // Fridays: the event replaces the usual pick-1-of-3 lineup, so the
  // subtitle says so. Keyed off the day actually having event projects
  // (not just the weekday), so it's right even if a Friday has no event.
  const isEvent = !!(data.published && (data.event || []).length > 0);
  const subtitle = isEvent
    ? "Tonight's Friday Night Event projects."
    : "Today's workshop lineup — guests choose 1 of 3 projects.";

  const head = `<div class="today-header">
      <div class="today-header-top">
        <div class="today-title">🎨 Today at 4Cats</div>
        <button class="today-see-all" onclick="openPlanAhead()">See everything happening today at the studio →</button>
      </div>
      ${forecastPillsHtml(forecastDays)}
      <div class="today-subtitle">${esc(subtitle)}</div>
    </div>`;

  if (!data.published) {
    card.innerHTML = head + `<div class="projects-empty">Today's projects haven't been published yet.</div>`;
    return;
  }

  // Fridays: the event and its projects replace the line up
  const main = isEvent ? data.event : (data.projects || []);
  const eventLine = isEvent && data.day_title ? `<div class="projects-event">${esc(data.day_title)}</div>` : '';
  const mainHtml = main.length
    ? `<div class="projects-grid">${main.map(projectTileHtml).join('')}</div>`
    : `<div class="projects-empty">No projects listed for today.</div>`;

  const minis = data.mini_make || [];
  const miniHtml = minis.length
    ? `<div class="projects-mini">
        <div class="projects-mini-label">Mini Make this week</div>
        <div class="projects-mini-row">${minis.map(projectTileHtml).join('')}</div>
      </div>`
    : '';

  card.innerHTML = head + eventLine + mainHtml + miniHtml;
}


// ⏳ the "still to read" styles
(function () { const st = document.createElement('style'); st.textContent = `
.ann-pend { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: #fff4dc; border: 1px solid #f3d38b; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; color: #6b4a00; cursor: pointer; }
.ann-pend.done, .ann-sum.done { background: #e9f7ee; border-color: #bfe5cc; color: #1e6b3d; cursor: default; font-weight: 700; }
.ann-sum { margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; background: #fff4dc; border: 1px solid #f3d38b; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 14px; color: #6b4a00; }
.ann-pp { display: inline-flex; align-items: center; gap: 4px; background: #fff; border-radius: 999px; padding: 2px 8px 2px 2px; font-weight: 600; }
.ann-pp.today { box-shadow: 0 0 0 2px #e8a33c; }
details.ann-done > summary { list-style: none; cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; } details.ann-done > summary::-webkit-details-marker { display: none; }
details.ann-done > summary .ann-eyebrow { flex-basis: 100%; } details.ann-done > summary .ann-title { flex: 1; min-width: 200px; }
.ann-done-chip { background: #e9f7ee; color: #1e6b3d; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
.ann-done-more { font-size: 12px; font-weight: 700; color: var(--accent, #4f3bd1); } details.ann-done[open] .ann-done-more { display: none; } details.ann-done[open] > summary { margin-bottom: 6px; } .ann-pp i { font-style: normal; font-size: 11px; color: #b06d00; } .ann-pp em { font-style: normal; background: #f3d38b; border-radius: 999px; padding: 0 6px; font-size: 11px; }
`; document.head.appendChild(st); })();

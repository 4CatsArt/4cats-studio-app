// hub/staff.js: the staff tools. ⏱ Punch clock, break warnings and timecards on the Schedule; ✍️ policy sign-offs; the personal
// staff view (my shifts, 🔁 give-aways, 🕒 Hours, profile, team, time off and unavailability, sick calls); home office 🕒 Timesheets,
// 🛡️ concerns, shift swaps, studio computers, 🕘 shift history and request rules. Moved out of hub.html as-is (Nov 11 2026).
// Loaded by hub.html after its main script.

// ---------- ⏱ Punch clock (studio computer) ----------
// hub_time_punch.sql: only the studio's shared login can punch; PINs are checked
// on the server. The screen resets itself after each punch.
const PUNCH_LABEL = { in: 'Punch in', break_out: 'Start break', break_in: 'End break', out: 'Punch out' };
const PUNCH_DONE = { in: 'punched in', break_out: 'started a break', break_in: 'ended their break', out: 'punched out' };
const PUNCH_STATE = { none: 'Not in yet', in: 'Working', break: 'On break', out: 'Done for today' };
let _punchPerson = null, _punchTimer = null;
function openPunch() {
  showOnlyPane('punch-pane'); setActiveNav('nav-punch');
  loadPunchBoard();
}
async function loadPunchBoard(searchAll) {
  const body = document.getElementById('punch-body');
  if (!searchAll) await loadBreakWarnings();
  const { data, error } = searchAll ? await sb.rpc('hub_punch_people', { p_studio_id: _sessionStudioId }) : await sb.rpc('hub_punch_board', { p_studio_id: _sessionStudioId });
  if (error) { body.innerHTML = `<div class="ho-card">${esc(/hub_punch/i.test(error.message) && /function/i.test(error.message) ? 'The punch clock isn’t set up yet (run hub_time_punch.sql).' : error.message)}</div>`; return; }
  const people = searchAll ? data : (data.people || []);
  window._punchPeople = people;
  body.innerHTML = `
    ${searchAll ? `<input class="pc-search" id="pc-search" placeholder="Type your name…" oninput="filterPunchPeople(this.value)" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:12px">` : ''}
    <div class="pc-grid" id="pc-grid">${punchCards(people, searchAll)}</div>
    <div style="margin-top:16px">${searchAll ? '<button class="ho-btn" onclick="loadPunchBoard()">← Back to today’s team</button>'
      : '<div class="goal-note">Not on the list? You need a shift on today’s schedule here to punch in. Ask your manager or home office to add it.</div>'}</div>`;
  if (searchAll) document.getElementById('pc-search').focus();
}
function punchCards(people, searchAll) {
  if (!people.length) return '<div class="ho-intro">No one is on the schedule here today.</div>';
  return people.map((p, i) => `<button class="pc-card" onclick="punchPick(${i})">${hubAvatarHtml(p, 64)}
      <span class="nm">${esc(p.name)}</span>
      ${p.start_time ? `<span class="tm">${esc(shortTime(p.start_time))}–${esc(shortTime(p.end_time))}</span>` : ''}
      ${!searchAll ? `<span class="pc-state ${esc(p.state)}">${esc(PUNCH_STATE[p.state] || '')}</span>` : ''}
      ${!searchAll && _breakWarn[p.staff_id] ? `<span class="pc-state break">⏰ Break time</span>` : ''}</button>`).join('');
}
function filterPunchPeople(q) {
  q = String(q || '').toLowerCase().trim();
  const list = (window._punchPeople || []).map((p, i) => [p, i]).filter(([p]) => !q || (p.full_name || p.name).toLowerCase().includes(q));
  document.getElementById('pc-grid').innerHTML = list.map(([p, i]) => `<button class="pc-card" onclick="punchPick(${i})">${hubAvatarHtml(p, 56)}<span class="nm">${esc(p.name)}</span><span class="tm">${esc(p.full_name || '')}</span></button>`).join('') || '<div class="ho-intro">No match.</div>';
}
function punchPick(i) {
  const p = (window._punchPeople || [])[i]; if (!p) return;
  _punchPerson = p;
  openDutySheet(`<div style="text-align:center">${hubAvatarHtml(p, 72)}<h3 style="margin:8px 0 2px">${esc(p.name)}</h3><p style="margin:0 0 10px">Type your punch PIN</p></div>
    <input class="pin-mask pc-pin" id="pc-pin" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4" onkeydown="if(event.key==='Enter') punchCheck()" oninput="if(event.inputType === 'insertText' && this.value.length===4) punchCheck()">
    <div class="pc-keys">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k => `<button onclick="punchKey('${k}')">${k}</button>`).join('')}</div>
    <div id="pc-msg" style="margin-top:10px"></div>
    <div class="sheet-actions"><button onclick="punchCancel()">Cancel</button></div>`);
  setTimeout(() => { const el = document.getElementById('pc-pin'); if (el) el.focus(); }, 50);
  punchIdle();
}
function punchKey(k) {
  const el = document.getElementById('pc-pin'); if (!el) return;
  if (k === '⌫') el.value = el.value.slice(0, -1);
  else if (k === '✓') return punchCheck();
  else if (el.value.length < 4) el.value += k;
  if (el.value.length === 4) punchCheck();
  punchIdle();
}
function punchDone() { clearTimeout(_punchTimer); window._punchJust = null; closeDutySheet(); if (paneVisible('punch-pane')) loadPunchBoard(); }
async function punchSaveAfter() {
  const j = window._punchJust, el = document.getElementById('pc-after'); if (!j || !el) return punchDone();
  if (!el.value.trim()) { document.getElementById('pc-after-msg').innerHTML = '<div class="me-msg err">Write your comment, or tap No thanks.</div>'; return; }
  const { error } = await sb.rpc('hub_punch_comment', { p_punch_id: j.id, p_staff_id: j.staff_id, p_pin: j.pin, p_comment: el.value, p_studio_id: _sessionStudioId });
  if (error) { document.getElementById('pc-after-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  document.querySelector('#duty-sheet-back .duty-sheet').innerHTML = '<div class="pc-done">✓ Comment saved</div>';
  clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 2000);
}
// Leave the screen clean if someone walks away mid-punch
function punchIdle() { clearTimeout(_punchTimer); _punchTimer = setTimeout(() => (window._punchJust ? punchDone() : punchCancel()), 30000); }
function punchCancel() { clearTimeout(_punchTimer); _punchPerson = null; closeDutySheet(); }
async function punchCheck() {
  const el = document.getElementById('pc-pin'); if (!el || !_punchPerson) return;
  const pin = el.value;
  if (!/^\d{4}$/.test(pin)) return;
  const msg = document.getElementById('pc-msg');
  msg.innerHTML = '<div class="goal-note">Checking…</div>';
  const { data, error } = await sb.rpc('hub_punch_check', { p_staff_id: _punchPerson.staff_id, p_pin: pin, p_studio_id: _sessionStudioId });
  if (error) { el.value = ''; msg.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; el.focus(); return; }
  const p = _punchPerson;
  const tm = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const PL = { in: 'In', break_out: 'Break', break_in: 'Back', out: 'Out' };
  const today = Array.isArray(data.today) ? data.today : [];
  const shift = data.shift && data.shift.start ? `Shift ${esc(shortTime(data.shift.start))}–${esc(shortTime(data.shift.end))}` : '';
  openDutySheet(`<div style="text-align:center">${hubAvatarHtml(p, 64)}<h3 style="margin:8px 0 2px">${esc(p.name)}</h3>
      <p style="margin:0">${esc(PUNCH_STATE[data.state] || '')}${shift ? ' · ' + shift : ''}</p></div>
    ${today.length ? `<div class="pc-today">${today.map(x => `<span><b>${PL[x.kind] || x.kind}</b> ${esc(tm(x.at))}</span>`).join('')}</div>` : ''}
    <div class="pc-acts">${(data.can || []).map(k => `<button class="${k}" onclick="punchGo('${k}')">${PUNCH_LABEL[k]}</button>`).join('')}</div>
    <label class="f" style="margin-top:12px">Comment (optional)<input id="pc-comment" maxlength="300" placeholder="e.g. Punched in late by accident, here at 9:00" style="font:inherit;font-size:15px;padding:10px;border:1px solid var(--border);border-radius:10px"></label>
    <input type="hidden" id="pc-pin" value="${escAttr(pin)}">
    <div id="pc-msg"></div>
    <div class="sheet-actions"><button onclick="punchCancel()">Cancel</button></div>`);
  punchIdle();
}
async function punchGo(kind) {
  const p = _punchPerson; if (!p) return;
  const pin = document.getElementById('pc-pin').value, comment = document.getElementById('pc-comment').value;
  document.querySelectorAll('.pc-acts button').forEach(b => { b.disabled = true; });
  const { data, error } = await sb.rpc('hub_punch', { p_staff_id: p.staff_id, p_pin: pin, p_kind: kind, p_comment: comment || null, p_studio_id: _sessionStudioId });
  if (error) { document.getElementById('pc-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; document.querySelectorAll('.pc-acts button').forEach(b => { b.disabled = false; }); return; }
  const at = new Date(data.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const flagged = (data.flags || []).length > 0;
  const already = (comment || '').trim();
  // A warning: offer a comment box right here (PIN checked again on the server)
  window._punchJust = flagged ? { id: data.id, staff_id: p.staff_id, pin } : null;
  openDutySheet(`<div class="pc-done">✓ ${esc(data.name || p.name)} ${PUNCH_DONE[kind]} at ${esc(at)}</div>
    ${flagged ? `<div class="me-msg warn">${esc(data.flags.join(' · '))}.</div>
      ${already ? `<div class="goal-note" style="margin-top:8px">💬 Your comment: “${esc(already)}”</div>`
        : `<label class="f" style="margin-top:10px">Want to explain? Add a comment for your manager (optional)
            <input id="pc-after" maxlength="300" placeholder="e.g. Bus was late" style="font:inherit;font-size:15px;padding:10px;border:1px solid var(--border);border-radius:10px" oninput="punchIdle()"></label>
          <div id="pc-after-msg"></div>
          <div class="sheet-actions"><button onclick="punchDone()">No thanks</button><button class="primary" onclick="punchSaveAfter()">Save comment</button></div>
          <div class="goal-note" style="margin-top:6px">You can also add one later in the Hub on your phone: Hours → Add a note.</div>`}` : ''}`);
  _punchPerson = null;
  clearTimeout(_punchTimer);
  _punchTimer = setTimeout(punchDone, flagged && !already ? 30000 : 3500);
  if (typeof loadTeamToday === 'function') loadTeamToday(_sessionStudioId);
  if (kind === 'out' && data.id) { punchAskStudioHours(data.id, p.staff_id); punchAskBreak(data.id, p.staff_id, pin); }
}
// (Nov 11 2026) punch out with no break punched, on a scheduled shift over the break threshold (punch_break_check.sql):
// "Did you take one?" Forgot → a break is added in the middle of the shift; didn't → they say why
async function punchAskBreak(outId, staffId, pin) {
  let info; try { const r = await sb.rpc('hub_punch_break_info', { p_staff_id: staffId, p_pin: pin, p_out_id: outId, p_studio_id: _sessionStudioId }); if (r.error) return; info = r.data; } catch (e) { return; }
  if (!info || !info.ask) return;
  clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 60000);   // (time to answer)
  window._punchBreak = { outId, staffId, pin };
  const box = document.createElement('div'); box.id = 'pc-break';
  box.innerHTML = `<div class="me-msg" style="margin-top:12px;background:#fdecea;border:2px solid #c0392b;color:#1a1a1a">
      <b style="font-size:16px">☕ You didn't punch a break today. Did you take one?</b>
      <div class="sheet-actions" style="margin-top:10px;justify-content:flex-start;flex-wrap:wrap">
        <button class="primary" onclick="punchBreakAnswer('forgot')">Yes, I forgot to punch it</button>
        <button onclick="document.getElementById('pc-break-why').style.display='block';punchIdleLong()">No, I didn't take a break</button></div>
      <div id="pc-break-why" style="display:none;margin-top:8px">
        <label class="f">Why not? (for your manager)<input id="pc-break-reason" maxlength="200" placeholder="e.g. No one to cover me, it was too busy" oninput="punchIdleLong()"
          style="font:inherit;font-size:15px;padding:10px;border:1px solid var(--border);border-radius:10px"></label>
        <div class="sheet-actions" style="margin-top:8px"><button class="primary" onclick="punchBreakAnswer('skipped')">Save</button></div></div>
      <div id="pc-break-msg"></div></div>`;
  const sheet = document.querySelector('.pc-done'); if (sheet && sheet.parentNode) sheet.parentNode.appendChild(box);
}
function punchIdleLong() { clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 60000); }
async function punchBreakAnswer(answer) {
  const b = window._punchBreak; if (!b) return;
  const reason = (document.getElementById('pc-break-reason') || {}).value || '';
  if (answer === 'skipped' && !reason.trim()) { document.getElementById('pc-break-msg').innerHTML = '<div class="me-msg err">Say why you didn’t take a break.</div>'; return; }
  const { data, error } = await sb.rpc('hub_punch_break_answer', { p_staff_id: b.staffId, p_pin: b.pin, p_out_id: b.outId, p_answer: answer, p_reason: reason || null, p_studio_id: _sessionStudioId });
  if (error) { document.getElementById('pc-break-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  const tm = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  document.getElementById('pc-break').innerHTML = `<div class="pc-done" style="font-size:16px">✓ ${answer === 'forgot' ? `Break added: ${esc(tm(data.from))}–${esc(tm(data.to))}` : 'Thanks, your manager will see why.'}</div>`;
  window._punchBreak = null; clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 3000);
}
// (Nov 8 2026) a split shift (home office staff): at punch out, how many of today's hours were for the studio (punch_studio_hours.sql)
async function punchAskStudioHours(punchId, staffId) {
  let info; try { const r = await sb.rpc('hub_punch_split_info', { p_staff: staffId, p_studio: _sessionStudioId }); if (r.error) return; info = r.data; } catch (e) { return; }
  if (!info || !info.ask) return;
  clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 45000);   // (time to answer)
  const box = document.createElement('div'); box.id = 'pc-split';
  box.innerHTML = `<div class="me-msg" style="margin-top:12px;background:#fbf5ea;border:1px solid #ead2ad;color:#6b4b00">
      <b>How many of today's hours were for the studio?</b> The rest counts as home office.
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <input id="pc-split-h" type="number" min="0" max="16" step="0.25" value="${info.studio_hours != null ? info.studio_hours : info.shift_hours}" style="width:90px;font:inherit;font-size:16px;padding:8px;border:1px solid var(--border);border-radius:10px" oninput="punchIdle()"> hours
        <span class="goal-note">${info.studio_hours != null ? `(planned: ${info.studio_hours} of ${info.shift_hours})` : `(shift: ${info.shift_hours})`}</span></div>
      <div id="pc-split-msg"></div>
      <div class="sheet-actions" style="margin-top:8px"><button onclick="punchDone()">Skip</button><button class="primary" onclick="punchSaveStudioHours('${escAttr(punchId)}','${escAttr(staffId)}')">Save</button></div></div>`;
  const sheet = document.querySelector('.pc-done'); if (sheet && sheet.parentNode) sheet.parentNode.appendChild(box);
}
async function punchSaveStudioHours(punchId, staffId) {
  const h = +document.getElementById('pc-split-h').value;
  const { error } = await sb.rpc('hub_punch_studio_hours', { p_punch: punchId, p_staff: staffId, p_hours: h });
  const m = document.getElementById('pc-split-msg');
  if (error) { if (m) m.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  if (m) m.innerHTML = `<div class="me-msg ok">Saved: ${h} h for the studio.</div>`;
  clearTimeout(_punchTimer); _punchTimer = setTimeout(punchDone, 2000);
}

// ---------- ⏰ Break warnings (studio computer) ----------
// From the punch board: working 5h+ with no break, or 10+ min past the break
// time in the day's roles without starting it. Shown in Who's working and on
// the punch screen. Rules: break_warn_minutes, break_late_minutes.
let _breakWarn = {};   // staff_id → text
async function loadBreakWarnings() {
  _breakWarn = {};
  if (_studioData && _studioData.isAdmin) return;          // admin logins can't read the punch board
  let board;
  try { const r = await sb.rpc('hub_punch_board', { p_studio_id: _sessionStudioId }); if (r.error) return; board = r.data; } catch (e) { return; }
  const ru = Object.assign({ break_warn_minutes: 300, break_late_minutes: 10 }, (board && board.rules) || {});
  const now = Date.now();
  const roleBreaks = [];   // [name, minutes-of-day]
  const roles = (_classInfo && _classInfo.roles) || {};
  ROLE_FIELDS.forEach(([f]) => {
    const who = String(roles[f] || '').trim(), b = String(roles['break_' + f] || '').match(/(\d{1,2}):(\d{2})/);
    if (who && b) { let h = +b[1]; if (h < 8) h += 12; roleBreaks.push([who.toLowerCase(), h * 60 + +b[2], b[0]]); }
  });
  (board.people || []).forEach(p => {
    if (p.state !== 'in' || p.had_break) return;
    const mins = p.first_in ? Math.round((now - new Date(p.first_in).getTime()) / 60000) : 0;
    if (mins >= (ru.break_warn_minutes || 300)) { _breakWarn[p.staff_id] = `has worked ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m without a break`; return; }
    const names = [p.name, p.full_name, p.nickname].filter(Boolean).map(x => String(x).toLowerCase());
    const rb = roleBreaks.find(([w]) => names.includes(w) || names.some(n => n.split(' ')[0] === w));
    if (rb) { const d = new Date(); const nowMin = d.getHours() * 60 + d.getMinutes();
      if (nowMin >= rb[1] + (ru.break_late_minutes || 10)) _breakWarn[p.staff_id] = `’s break was due at ${shortTime(rb[2] + ':00')}`; }
  });
}

// ---------- ⏱ Timecards on the Schedule (coordinators / home office) ----------
function tcMinutes(punches) {
  let worked = 0, brk = 0, inAt = null, brAt = null;
  punches.forEach(p => {
    const t = new Date(p.at).getTime();
    if (p.kind === 'in') inAt = t;
    else if (p.kind === 'break_out' && inAt) { worked += t - inAt; inAt = null; brAt = t; }
    else if (p.kind === 'break_in') { if (brAt) brk += t - brAt; brAt = null; inAt = t; }
    else if (p.kind === 'out' && inAt) { worked += t - inAt; inAt = null; }
  });
  return { worked: Math.round(worked / 60000), brk: Math.round(brk / 60000), open: inAt !== null || brAt !== null };
}
const hm = m => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
async function loadTimecards() {
  const box = document.getElementById('tc-box'); if (!box || !_plan) return;
  const { data, error } = await sb.rpc('hub_timecards', { p_studio_id: _sessionStudioId, p_day: _plan.date });
  if (error) { box.innerHTML = /hub_timecards/i.test(error.message) && /function/i.test(error.message) ? '' : `<div class="goal-note">${esc(error.message)}</div>`; return; }
  window._tcData = data || [];
  const isToday = _plan.date === localDateStr(new Date()), seenTeam = new Set();
  box.innerHTML = (tcCanFix() || !(data || []).length ? '' : '<div class="goal-note" style="margin-bottom:6px">Only home office can change punches.</div>') + (data || []).map((c, ci) => {
    const t = tcMinutes(c.punches || []);
    const pills = (c.punches || []).map(p => {
      const at = new Date(p.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `<button class="tc-p${p.original_at ? ' edited' : ''}${(p.flags || []).length ? ' flag' : ''}" onclick="tcFix('${escAttr(p.id)}', ${ci})" title="${escAttr((p.flags || []).join(' · '))}">${esc({ in: 'In', break_out: 'Break', break_in: 'Back', out: 'Out' }[p.kind])} ${esc(at)}${p.original_at ? ' ✎' : ''}</button>`;
    }).join('');
    const notes = (c.punches || []).filter(p => p.comment || p.edit_note || (p.flags || []).length).map(p => `<div class="tc-note">${(p.flags || []).length ? '⚑ ' + esc(p.flags.join(' · ')) + ' ' : ''}${p.comment ? '💬 “' + esc(p.comment) + '” ' : ''}${p.edit_note ? '✎ ' + esc(p.edited_by_name || 'Manager') + ': ' + esc(p.edit_note) + (p.original_at ? ' (was ' + esc(new Date(p.original_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + ')' : '') : ''}</div>`).join('');
    const noOut = t.open && !isToday;
    const tm = (_plan.team || []).find(p => (c.staff_id && String(p.staff_id) === String(c.staff_id)) || p.name === c.name || planWriteName(p) === c.name);
    if (tm) seenTeam.add(tm);
    return `<div class="tc-card"><div class="tc-head">${hubAvatarHtml(c, 28)}<span class="nm">${esc(c.name)}</span>
        <span class="goal-note">${c.shift_start ? 'Shift ' + esc(shortTime(c.shift_start)) + '–' + esc(shortTime(c.shift_end)) : 'Not scheduled'}</span>
        ${planStaffRoleHtml(tm ? planWriteName(tm) : c.name, true)}
        <span class="tot">${(c.punches || []).length ? `<b>${hm(t.worked)}</b> worked · ${hm(t.brk)} break` : 'No punches'}${noOut ? ' · <span style="color:#b91c1c;font-weight:700">no punch out</span>' : ''}</span></div>
      <div class="tc-punches">${pills}${tcCanFix() ? `<button class="tc-p" onclick="tcAdd(${ci})">＋ Add punch</button>` : ''}</div>${notes}</div>`;
  }).join('') + (_plan.team || []).filter(p => !seenTeam.has(p)).map(p =>   // working today, no timecard yet
    `<div class="tc-card"><div class="tc-head">${hubAvatarHtml(p, 28)}<span class="nm">${esc(p.name)}</span><span class="goal-note">Shift ${esc(shortTime(p.start_time))}–${esc(shortTime(p.end_time))}</span>
      ${planStaffRoleHtml(planWriteName(p), true)}<span class="tot">No punches</span></div></div>`).join('')
    || '<div class="goal-note">No one is on the schedule for this day yet.</div>';
}
function tcCanFix() { return !!(_studioData && _studioData.isAdmin); }
function tcFix(id, ci) {
  if (!tcCanFix()) { alert('Only home office can change punches. Ask home office if a time needs fixing.'); return; }
  const c = window._tcData[ci], p = (c.punches || []).find(x => String(x.id) === String(id)); if (!p) return;
  const cur = new Date(p.at); const hhmm = String(cur.getHours()).padStart(2, '0') + ':' + String(cur.getMinutes()).padStart(2, '0');
  openDutySheet(`<h3>Fix a punch</h3><p>${esc(c.name)} · ${esc({ in: 'Punch in', break_out: 'Start break', break_in: 'End break', out: 'Punch out' }[p.kind])}${p.original_at ? ' · originally ' + esc(new Date(p.original_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) : ''}</p>
    <div class="me-form"><label>Correct time<input type="time" id="tc-time" value="${hhmm}"></label>
      <label>Why (optional)<input id="tc-note" maxlength="300" placeholder="e.g. Forgot to punch in, was here at 9"></label>
      <label>Your name<input id="tc-by" value="${escAttr((_lastHeroData && _sessionPin && _lastHeroData.firstName !== 'team' && _lastHeroData.firstName) || '')}"></label></div>
    <div id="tc-msg"></div>
    <div class="sheet-actions"><button class="danger" onclick="tcSave('${escAttr(id)}', true)">Remove punch</button><span style="flex:1"></span><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="tcSave('${escAttr(id)}', false)">Save</button></div>`);
}
async function tcSave(id, remove) {
  const v = k => document.getElementById(k).value;
  if (remove && !confirm('Remove this punch? It stays in the history.')) return;
  const { error } = await sb.rpc('hub_punch_fix', { p_id: id, p_new_time: v('tc-time') || '00:00', p_note: v('tc-note'), p_by_name: v('tc-by') || null, p_remove: !!remove });
  if (error) { document.getElementById('tc-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet(); loadTimecards();
}
function tcAdd(ci) {
  if (!tcCanFix()) return;
  const c = window._tcData[ci];
  openDutySheet(`<h3>Add a missing punch</h3><p>${esc(c.name)} · ${esc(ptyDayLabel(_plan.date))}</p>
    <div class="me-form"><label>Kind<select id="tc-kind"><option value="in">Punch in</option><option value="break_out">Start break</option><option value="break_in">End break</option><option value="out" selected>Punch out</option></select></label>
      <label>Time<input type="time" id="tc-time" value="${escAttr(String(c.shift_end || '17:00').slice(0, 5))}"></label>
      <label>Why (optional)<input id="tc-note" maxlength="300" placeholder="e.g. Forgot to punch out"></label>
      <label>Your name<input id="tc-by"></label></div>
    <div id="tc-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="tcAddSave('${escAttr(c.staff_id)}')">Add</button></div>`);
}
async function tcAddSave(staffId) {
  const v = k => document.getElementById(k).value;
  const { error } = await sb.rpc('hub_punch_add', { p_staff_id: staffId, p_studio_id: _sessionStudioId, p_day: _plan.date, p_kind: v('tc-kind'), p_time: v('tc-time'), p_note: v('tc-note'), p_by_name: v('tc-by') || null });
  if (error) { document.getElementById('tc-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet(); loadTimecards();
}


// ==========================================================================
// ✍️ POLICY SIGN-OFFS (kb_acknowledgements.sql)
// Staff read a Knowledge Base doc/slideshow and sign it:
//   • own login (phone): no PIN needed — Sign-offs tab
//   • studio computer: pick your name, then your punch PIN — ✍️ Sign policies
// Coordinators (coordinator view) and home office see who has signed.
// The database decides who's allowed; the page only shows what it's given.
// ==========================================================================
const ACK_STATUS = { signed: 'Signed', due_soon: 'Due soon', due: 'To sign', overdue: 'Overdue' };
const ACK_ORDER = { overdue: 0, due: 1, due_soon: 2, signed: 3 };
const KB_VIEW_URL = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '') + 'kb-view.html?id=';
let _ackCtx = null;        // { mode: 'personal' | 'studio', staff_id, pin, name, items }
let _ackPeople = [], _ackTimer = null, _ackReading = null;

function ackDue(it) {
  if (it.status === 'signed') return it.due_date ? 'Next due ' + hoFmtDate(it.due_date) : 'Signed ' + hoFmtDate(String(it.signed_at || '').slice(0, 10));
  if (it.status === 'due_soon') return 'Renew by ' + hoFmtDate(it.due_date);
  return (it.status === 'overdue' ? 'Was due ' : 'Due ') + hoFmtDate(it.due_date) + (it.last_signed_any ? ' · updated since you last signed' : '');
}
function ackItemsHtml(items, signFn) {
  const list = (items || []).slice().sort((a, b) => (ACK_ORDER[a.status] - ACK_ORDER[b.status]) || String(a.title).localeCompare(b.title));
  if (!list.length) return '<div class="goal-note">Nothing to sign right now.</div>';
  return list.map(it => `<div class="ack-item"><div class="t"><b>${esc(it.title)}</b><span class="goal-note">${esc(ackDue(it))}</span></div>
      <span class="ack-st ${esc(it.status)}">${ACK_STATUS[it.status] || ''}</span>
      ${it.status !== 'signed' ? `<button class="ho-btn" onclick="${signFn}('${escAttr(it.kb_id)}')">Read &amp; sign</button>`
        : `<button class="ho-btn" onclick="ackOpenViewOnly('${escAttr(it.kb_id)}')">Open</button>`}</div>`).join('');
}

// ---- Own login: the Sign-offs tab ----
async function meCheckAcks() {
  const { data, error } = await sb.rpc('kb_ack_mine');
  const tab = document.getElementById('me-tab-acks'), b = document.getElementById('me-acks-badge');
  if (error || !Array.isArray(data)) { if (tab) tab.style.display = 'none'; return null; }
  if (tab) tab.style.display = '';
  const n = data.filter(x => x.status === 'overdue' || x.status === 'due').length;
  if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; }
  return data;
}
async function meLoadAcks() {
  const body = document.getElementById('me-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const items = await meCheckAcks();
  if (!items) { body.innerHTML = '<div class="me-msg err">Sign-offs aren’t available right now.</div>'; return; }
  _ackCtx = { mode: 'personal', items };
  const todo = items.filter(x => x.status !== 'signed').length;
  let html = `<div class="me-card"><h3 style="margin-top:0">✍️ Policies to read and sign</h3>
    <div class="me-rules">${todo ? 'Read each one to the end, then sign. Your signature goes on your training record.' : 'You’re all caught up. Thank you!'}</div>
    ${ackItemsHtml(items, 'ackStartSign')}</div>`;
  body.innerHTML = html + '<div id="me-ack-team"></div>';
  // Coordinators on their own login also see their studios
  const t = await sb.rpc('kb_ack_coord', { p_pin: null, p_studio_id: null });
  if (!t.error && t.data && t.data.ok && (t.data.rows || []).length) {
    document.getElementById('me-ack-team').innerHTML = `<div class="me-card"><h3 style="margin-top:0">👥 Your team</h3><div id="me-ack-team-body"></div></div>`;
    ackRenderCompliance('me-ack-team-body', t.data.rows, { compact: true });
  }
}

// ---- Studio computer: ✍️ Sign policies ----
function openAcksPane() {
  showOnlyPane('acks-pane'); setActiveNav('nav-acks');
  loadAckPeople();
}
async function loadAckPeople() {
  const body = document.getElementById('acks-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('kb_ack_studio_people', { p_studio_id: _sessionStudioId });
  if (error) { body.innerHTML = `<div class="ho-card">${esc(/kb_ack/i.test(error.message) && /function/i.test(error.message) ? 'Policy sign-offs aren’t set up yet (run kb_acknowledgements.sql).' : error.message)}</div>`; return; }
  _ackPeople = data || [];
  const b = document.getElementById('acks-badge');
  if (b) { const n = _ackPeople.filter(p => p.overdue).length; b.textContent = n; b.style.display = n ? '' : 'none'; }
  body.innerHTML = _ackPeople.length
    ? `<div class="pc-grid">${_ackPeople.map((p, i) => `<button class="pc-card" onclick="ackPick(${i})">${hubAvatarHtml(p, 64)}
        <span class="nm">${esc(p.name)}</span>
        <span class="tm">${p.overdue + p.due} to sign${p.due_soon ? ` · ${p.due_soon} due soon` : ''}</span>
        ${p.overdue ? `<span class="ack-count">${p.overdue} overdue</span>` : ''}</button>`).join('')}</div>`
    : '<div class="ho-card"><b>✓ Everyone here is up to date.</b><div class="goal-note">Nothing needs signing right now.</div></div>';
}
function ackPick(i) {
  const p = _ackPeople[i]; if (!p) return;
  _ackCtx = { mode: 'studio', staff_id: p.staff_id, name: p.name, person: p };
  openDutySheet(`<div style="text-align:center">${hubAvatarHtml(p, 72)}<h3 style="margin:8px 0 2px">${esc(p.name)}</h3><p style="margin:0 0 10px">Type your punch PIN</p></div>
    <input class="pin-mask pc-pin" id="ak-pin" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4" onkeydown="if(event.key==='Enter') ackPinCheck()" oninput="if(event.inputType === 'insertText' && this.value.length===4) ackPinCheck()">
    <div class="pc-keys">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k => `<button onclick="ackKey('${k}')">${k}</button>`).join('')}</div>
    <div id="ak-msg" style="margin-top:10px"></div>
    <div class="sheet-actions"><button onclick="ackEndStudio()">Cancel</button></div>`);
  setTimeout(() => { const el = document.getElementById('ak-pin'); if (el) el.focus(); }, 50);
  ackIdle();
}
function ackKey(k) {
  const el = document.getElementById('ak-pin'); if (!el) return;
  if (k === '⌫') el.value = el.value.slice(0, -1);
  else if (k === '✓') return ackPinCheck();
  else if (el.value.length < 4) el.value += k;
  if (el.value.length === 4) ackPinCheck();
  ackIdle();
}
async function ackPinCheck() {
  const el = document.getElementById('ak-pin'); if (!el || !_ackCtx) return;
  const pin = el.value; if (!/^\d{4}$/.test(pin)) return;
  const msg = document.getElementById('ak-msg');
  msg.innerHTML = '<div class="goal-note">Checking…</div>';
  const { data, error } = await sb.rpc('kb_ack_person', { p_staff_id: _ackCtx.staff_id, p_pin: pin, p_studio_id: _sessionStudioId });
  if (error || !data || !data.ok) { el.value = ''; msg.innerHTML = `<div class="me-msg err">${esc(error ? error.message : (data && data.error) || 'Try again.')}</div>`; el.focus(); return; }
  _ackCtx.pin = pin; _ackCtx.items = data.items || [];
  ackPersonSheet();
}
function ackPersonSheet(note) {
  if (!_ackCtx) return;
  openDutySheet(`<h3 style="margin-top:0">✍️ ${esc(_ackCtx.name)}’s policies</h3>
    ${note ? `<div class="me-msg ok" style="margin-bottom:8px">${esc(note)}</div>` : ''}
    ${ackItemsHtml(_ackCtx.items, 'ackStartSign')}
    <div class="sheet-actions"><button class="primary" onclick="ackEndStudio()">Done</button></div>`);
  ackIdle();
}
// Leave the studio computer clean if someone walks away
function ackIdle() { clearTimeout(_ackTimer); _ackTimer = setTimeout(() => { if (_ackCtx && _ackCtx.mode === 'studio') ackEndStudio(); }, 3 * 60 * 1000); }
function ackEndStudio() {
  clearTimeout(_ackTimer); ackCloseReader(); closeDutySheet();
  _ackCtx = null;
  if (paneVisible('acks-pane')) loadAckPeople();
}

// ---- Reading + signing (both) ----
function ackStartSign(kbId) {
  const it = ((_ackCtx && _ackCtx.items) || []).find(x => x.kb_id === kbId); if (!it) return;
  closeDutySheet();
  _ackReading = { item: it, reachedEnd: false };
  ackOpenReader(it, true);
}
function ackOpenViewOnly(kbId) {
  const it = ((_ackCtx && _ackCtx.items) || []).find(x => x.kb_id === kbId); if (!it) return;
  closeDutySheet();
  _ackReading = { item: it, viewOnly: true };
  ackOpenReader(it, false);
}
function ackOpenReader(it, signing) {
  ackCloseReader(true);
  const el = document.createElement('div');
  el.className = 'ack-reader'; el.id = 'ack-reader';
  el.innerHTML = `<div class="ack-reader-box" role="dialog" aria-modal="true">
      <div class="ack-reader-head"><b>${esc(it.title)}</b><button class="ho-btn" onclick="ackCloseReader()">Close</button></div>
      <iframe src="${escAttr(KB_VIEW_URL + encodeURIComponent(it.kb_id))}" title="${escAttr(it.title)}"></iframe>
      <div class="ack-reader-foot" id="ack-foot">${signing ? '<div class="goal-note">📖 Read to the end (or the last slide) to sign.</div>' : ''}</div>
    </div>`;
  document.body.appendChild(el);
  if (!signing) document.getElementById('ack-foot').style.display = 'none';
  if (_ackCtx && _ackCtx.mode === 'studio') ackIdle();
}
function ackCloseReader(quiet) {
  const el = document.getElementById('ack-reader'); if (el) el.remove();
  if (quiet) return;
  const wasReading = _ackReading; _ackReading = null;
  if (!wasReading || !_ackCtx) return;
  if (_ackCtx.mode === 'studio') ackPersonSheet();
}
// kb-view.html (same site) says the reader got to the end
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'kb-view-end') return;
  if (!_ackReading || _ackReading.viewOnly || _ackReading.reachedEnd || e.data.id !== _ackReading.item.kb_id) return;
  _ackReading.reachedEnd = true;
  const it = _ackReading.item;
  const foot = document.getElementById('ack-foot'); if (!foot) return;
  const who = _ackCtx && _ackCtx.mode === 'studio' ? _ackCtx.name : ((_me && _me.full_name) || '');
  foot.innerHTML = `<label class="ack-agree"><input type="checkbox" id="ack-agree"> <span>${esc(it.statement || 'I have read and understand this document.')}</span></label>
    <div class="ack-sign-row"><input type="text" id="ack-name" maxlength="120" autocomplete="off" placeholder="Type your full name${who ? ` (${esc(who)})` : ''}">
      <button class="ho-btn primary" id="ack-sign-btn" onclick="ackSign()">✍️ Sign</button></div>
    <div id="ack-sign-msg" style="margin-top:8px"></div>`;
  if (_ackCtx && _ackCtx.mode === 'studio') ackIdle();
});
async function ackSign() {
  if (!_ackReading || !_ackCtx) return;
  const it = _ackReading.item;
  const msg = document.getElementById('ack-sign-msg'), btn = document.getElementById('ack-sign-btn');
  const name = (document.getElementById('ack-name').value || '').trim();
  if (!document.getElementById('ack-agree').checked) { msg.innerHTML = '<div class="me-msg err">Tick the box to agree first.</div>'; return; }
  if (name.length < 2) { msg.innerHTML = '<div class="me-msg err">Type your full name to sign.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Signing…';
  const args = { p_kb_id: it.kb_id, p_version: it.version, p_typed_name: name };
  if (_ackCtx.mode === 'studio') Object.assign(args, { p_staff_id: _ackCtx.staff_id, p_pin: _ackCtx.pin, p_studio_id: _sessionStudioId });
  const { data, error } = await sb.rpc('kb_ack_sign', args);
  if (error || !data || !data.ok) {
    btn.disabled = false; btn.textContent = '✍️ Sign';
    msg.innerHTML = `<div class="me-msg err">${esc(error ? error.message : (data && data.error) || 'Couldn’t sign just now.')}</div>`;
    return;
  }
  _ackReading = null;
  ackCloseReader(true);
  if (_ackCtx.mode === 'studio') {
    const r = await sb.rpc('kb_ack_person', { p_staff_id: _ackCtx.staff_id, p_pin: _ackCtx.pin, p_studio_id: _sessionStudioId });
    if (!r.error && r.data && r.data.ok) _ackCtx.items = r.data.items || [];
    ackPersonSheet('✓ Signed: ' + it.title);
  } else {
    meLoadAcks();
  }
}

// ---- Compliance: home office (all studios) and coordinator view (their studio) ----
let _ackcMode = 'ho', _ackcRows = [], _ackcView = 'docs';
async function openAckCompliance(mode) {
  _ackcMode = mode;
  if (mode === 'ho' && !_hoCan.view) return;
  showOnlyPane('ackc-pane'); setActiveNav(mode === 'ho' ? 'nav-ack-ho' : 'nav-ack-coord');
  const bar = document.getElementById('ackc-studio');
  bar.innerHTML = mode === 'ho'
    ? `<select class="ho-btn" id="ackc-studio-sel" onchange="loadAckCompliance()"><option value="">All studios</option>${Object.keys(STUDIO_NAMES).map(id => `<option value="${escAttr(id)}">${esc(STUDIO_NAMES[id])}</option>`).join('')}</select>`
    : `<span class="goal-note">${esc(STUDIO_NAMES[_sessionStudioId] || _sessionStudioId || '')}</span>`;
  loadAckCompliance();
}
async function loadAckCompliance() {
  const body = document.getElementById('ackc-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  let rows, err;
  if (_ackcMode === 'ho') {
    const sel = document.getElementById('ackc-studio-sel');
    const r = await sb.rpc('kb_ack_compliance', { p_studio_id: (sel && sel.value) || null });
    err = r.error && r.error.message; rows = r.data;
  } else {
    if (!_sessionPin) { body.innerHTML = '<div class="ho-card">Unlock the coordinator view first.</div>'; return; }
    const r = await sb.rpc('kb_ack_coord', { p_pin: _sessionPin, p_studio_id: _sessionStudioId });
    err = r.error ? r.error.message : (r.data && !r.data.ok ? r.data.error : null); rows = r.data && r.data.rows;
  }
  if (err) { body.innerHTML = `<div class="ho-card">${esc(/kb_ack/i.test(err) && /function/i.test(err) ? 'Policy sign-offs aren’t set up yet (run kb_acknowledgements.sql).' : err)}</div>`; return; }
  _ackcRows = rows || [];
  ackRenderCompliance('ackc-body', _ackcRows, {});
}
function ackRenderCompliance(hostId, rows, opts) {
  const host = document.getElementById(hostId); if (!host) return;
  if (!rows.length) { host.innerHTML = '<div class="ho-card"><div class="goal-note">No policies need signing here right now. Turn on “Staff must acknowledge” on a Knowledge Base doc to start.</div></div>'; return; }
  const n = s => rows.filter(r => r.status === s).length;
  const chips = `<div class="ack-chips">
      <div class="ack-chip"><b style="color:#7f1d1d">${n('overdue')}</b>Overdue</div>
      <div class="ack-chip"><b style="color:#4c1d95">${n('due')}</b>To sign</div>
      <div class="ack-chip"><b style="color:#78350f">${n('due_soon')}</b>Due soon</div>
      <div class="ack-chip"><b style="color:#14532d">${n('signed')}</b>Signed</div></div>`;
  const view = opts.compact ? 'people' : _ackcView;
  const tabs = opts.compact ? '' : `<div class="ack-tabs"><button class="ho-btn${view === 'docs' ? ' on' : ''}" onclick="_ackcView='docs'; ackRenderCompliance('${hostId}', _ackcRows, {})">By policy</button>
      <button class="ho-btn${view === 'people' ? ' on' : ''}" onclick="_ackcView='people'; ackRenderCompliance('${hostId}', _ackcRows, {})">By person</button></div>`;
  const nm = r => esc(r.staff_name);
  let html = '';
  if (view === 'docs') {
    const docs = {};
    rows.forEach(r => { (docs[r.kb_id] = docs[r.kb_id] || { title: r.title, version: r.version, rows: [] }).rows.push(r); });
    html = Object.values(docs).sort((a, b) => a.title.localeCompare(b.title)).map(d => {
      const out = d.rows.filter(r => r.status !== 'signed').sort((a, b) => ACK_ORDER[a.status] - ACK_ORDER[b.status] || a.staff_name.localeCompare(b.staff_name));
      const ok = d.rows.length - out.filter(r => r.status !== 'due_soon').length;
      return `<div class="ho-card"><div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><b style="font-size:15.5px;flex:1">${esc(d.title)}</b>
          <span class="goal-note">v${d.version} · ${ok} of ${d.rows.length} signed</span></div>
        ${out.length ? `<div class="ack-people">${out.map(r => `<span><span class="ack-st ${r.status}">${ACK_STATUS[r.status]}</span> ${nm(r)} <small class="goal-note">${esc(hoFmtDate(r.due_date))}</small></span>`).join('')}</div>`
          : '<div class="goal-note" style="margin-top:6px">✓ Everyone has signed.</div>'}</div>`;
    }).join('');
  } else {
    const people = {};
    rows.forEach(r => { (people[r.staff_id] = people[r.staff_id] || { name: r.staff_name, rows: [] }).rows.push(r); });
    const list = Object.values(people).map(p => Object.assign(p, { out: p.rows.filter(r => r.status !== 'signed') }))
      .filter(p => p.out.length).sort((a, b) => b.out.filter(r => r.status === 'overdue').length - a.out.filter(r => r.status === 'overdue').length || a.name.localeCompare(b.name));
    html = list.length ? list.map(p => `<div class="${opts.compact ? '' : 'ho-card'}" style="${opts.compact ? 'padding:6px 0;border-bottom:1px solid var(--border)' : ''}"><b>${esc(p.name)}</b>
        <div class="ack-people">${p.out.map(r => `<span><span class="ack-st ${r.status}">${ACK_STATUS[r.status]}</span> ${esc(r.title)} <small class="goal-note">${esc(hoFmtDate(r.due_date))}</small></span>`).join('')}</div></div>`).join('')
      : '<div class="goal-note">✓ Everyone is up to date.</div>';
  }
  host.innerHTML = chips + tabs + html;
}

// ==========================================================================
// PERSONAL STAFF VIEW — my shifts, time off, availability, calling in sick
// ==========================================================================
let _me = null;          // { staff_id, name, ... } from hub_whoami
let _meTab = 'shifts';
let _meWeeks = 4;
let _meReq = null;       // hub_my_requests() result
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
async function meSignOut() {
  if (!confirm('Sign out?')) return;
  await sb.auth.signOut();   // onAuthStateChange resets the page
}
// "4Cats Team": what staff see once they sign in with their own personal login (any screen). Studio logins and home office keep "4Cats Hub",
// so it feels like two separate tools. The words are swapped on screen only; nothing else changes.
let _teamObs = null;
function teamBrandText(t) {
  return t.replace(/4Cats Hub/g, '4Cats Team').replace(/\bthe Hub\b/g, 'the Team app').replace(/\bThe Hub\b/g, 'The Team app')
    .replace(/\bHub(?=\s*(→|&rarr;|on your phone|\)|'s|’s))/g, 'Team app').replace(/\(Hub\)/g, '(Team app)');
}
function teamBrand(on) {
  document.documentElement.classList.toggle('team-brand', !!on);
  if (_teamObs) { _teamObs.disconnect(); _teamObs = null; }
  if (!on) { document.title = '4Cats Hub'; return; }
  document.title = '4Cats Team';
  const fix = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /Hub/.test(n.nodeValue) && !(n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(n => { const v = teamBrandText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  };
  fix(document.body);
  _teamObs = new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType === 3) { const v = teamBrandText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } else if (n.nodeType === 1) fix(n); });
    if (m.type === 'characterData' && /Hub/.test(m.target.nodeValue || '')) { const v = teamBrandText(m.target.nodeValue); if (v !== m.target.nodeValue) m.target.nodeValue = v; } }));   // (only when the words change: never a loop)
  _teamObs.observe(document.body, { childList: true, subtree: true, characterData: true });
}
function startStaffView(me) {
  _me = me;
  teamBrand(true);
  document.getElementById('dashboard-gate').style.display = 'none';
  document.getElementById('dashboard-shell').style.display = 'none';
  document.getElementById('staff-shell').style.display = '';
  document.getElementById('me-avatar').innerHTML = hubAvatarHtml(me, 48);
  document.getElementById('me-hi').textContent = `Hi ${me.name || ''}!`;
  const qs = new URLSearchParams(location.search), openChat = qs.get('chat');   // tapped a notification
  if (openChat) { meTab('chat'); chatOpenWhenReady(openChat); history.replaceState(null, '', location.pathname + location.hash); }
  else { meTab('shifts'); if (qs.get('tab')) history.replaceState(null, '', location.pathname + location.hash); }
  meCheckTeam();
  meCheckAcks();
  meLoadAnn();
  meNewsCheck();   // 📰 staff newsletter
  if (_meTeamTimer) clearInterval(_meTeamTimer);
  _meTeamTimer = setInterval(() => { if (_me) { meCheckTeam(); if (_meTab === 'team') meLoadTeam(true); } }, 2 * 60 * 1000);
}
function meTab(t) {
  _meTab = t;
  ['shifts', 'news', 'hours', 'off', 'avail', 'chat', 'acks', 'profile', 'team'].forEach(x => { const b = document.getElementById('me-tab-' + x); if (b) b.classList.toggle('on', x === t); });
  if (t !== 'chat') chatStop();
  if (t === 'chat') { document.getElementById('me-body').innerHTML = '<div id="me-chat" class="chat-host"></div>'; chatMount('me-chat', 'staff'); }
  else if (t === 'acks') meLoadAcks();
  else if (t === 'news') { meLoadNews(); const ban = document.getElementById('me-news-banner'); if (ban) ban.innerHTML = ''; }
  else if (t === 'shifts') meLoadShifts(); else if (t === 'hours') meLoadHours(); else if (t === 'team') meLoadTeam(); else if (t === 'profile') meLoadProfile(); else meLoadRequests();
}
function meDateLabel(ds, today) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const diff = Math.round((dt - new Date(...today.split('-').map((v, i) => i === 1 ? v - 1 : +v))) / 86400000);
  const base = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return diff === 0 ? 'Today · ' + base : diff === 1 ? 'Tomorrow · ' + base : base;
}
function meWeekLabel(ds, today) {
  const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const monday = dt => { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
  const w = Math.round((monday(toDate(ds)) - monday(toDate(today))) / (7 * 86400000));
  return w === 0 ? 'This week' : w === 1 ? 'Next week' : 'Week of ' + monday(toDate(ds)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
async function meLoadShifts() {
  const body = document.getElementById('me-body');
  body.innerHTML = '<div class="ho-intro">Loading your shifts…</div>';
  const today = localDateStr(new Date());
  const to = new Date(); to.setDate(to.getDate() + _meWeeks * 7);
  let myNotes = [];
  try { const mn = await sb.rpc('hub_my_notes', { p_from: today, p_to: localDateStr(to) }); myNotes = (!mn.error && mn.data) || []; } catch (e) {}
  const noteOf = sh => myNotes.find(n => n.shift_date === sh.shift_date && n.studio_id === sh.studio_id) || null;
  const [sched, req, cov] = await Promise.all([
    sb.rpc('hub_my_schedule', { p_from: today, p_to: localDateStr(to) }),
    sb.rpc('hub_my_requests_v5').then(r => r.error && /hub_my_requests_v5/i.test(r.error.message) ? sb.rpc('hub_my_requests') : r),
    sb.rpc('hub_my_cover_requests')
  ]);
  _meCover = cov && !cov.error && Array.isArray(cov.data) ? cov.data : [];
  if (sched.error) { body.innerHTML = `<div class="me-msg err">Couldn't load your shifts: ${esc(sched.error.message)}</div>`; return; }
  _meReq = req.data || null;
  const d = sched.data, rules = (_meReq && _meReq.rules) || { sick_window_hours: 24 };
  const shifts = d.shifts || [];
  await meLoadOffers();
  const coverHtml = meCoverHtml() + meOffersHtml() + (await mePunchCardHtml()) + (await meLockboxHtml());
  if (!shifts.length) {
    body.innerHTML = coverHtml + `<div class="me-card"><h3>No shifts in the next ${_meWeeks} weeks</h3><div class="me-rules">Shifts show here once they’re approved in the staff schedule.</div></div>`;
    return;
  }
  const now = new Date();
  let html = '', lastWeek = '';
  shifts.forEach((sh, i) => {
    const wk = meWeekLabel(sh.shift_date, d.today);
    if (wk !== lastWeek) { html += `<div class="me-week">${esc(wk)}</div>`; lastWeek = wk; }
    const [y, m, dd] = sh.shift_date.split('-').map(Number);
    const [sh1, sm1] = String(sh.start_time).split(':').map(Number), [eh, em] = String(sh.end_time).split(':').map(Number);
    const start = new Date(y, m - 1, dd, sh1, sm1), end = new Date(y, m - 1, dd, eh, em);
    const canSick = !sh.sick && now < end && (start - now) <= (rules.sick_window_hours || 24) * 3600000;
    const studio = sh.studio_id === '__HOME_OFFICE__' ? '🏠 Home office (work from home)' : String(sh.studio_name || STUDIO_NAMES[sh.studio_id] || sh.studio_id).replace(/^4CATS( Art Studios)?\s*-?\s*/i, '');
    const roles = (sh.roles || []).map(r => `<span class="me-chip">${esc(r.role)}${r.break ? ' · break ' + esc(r.break) : ''}</span>`).join('');
    const teach = (sh.teaching || []).map(t => `<span class="me-chip teach">${esc(t.as)} · ${esc(shortTime(t.time))} ${esc(t.title)}</span>`).join('');
    const team = (sh.team || []).map(p => `<span class="role-chip">${hubAvatarHtml({ staff_id: p.name, name: p.name, avatar_key: p.avatar_key }, 22)}${esc(p.name)} <small>${esc(shortTime(p.start_time))}–${esc(shortTime(p.end_time))}</small></span>`).join('');
    html += `<div class="me-shift${sh.shift_date === d.today ? ' today' : ''}${sh.sick ? ' sick' : ''}">
      <div class="me-row"><span class="me-day">${esc(meDateLabel(sh.shift_date, d.today))}</span><span class="me-time">${esc(shortTime(sh.start_time))} – ${esc(shortTime(sh.end_time))}</span></div>
      <div class="me-studio">📍 ${esc(studio)}</div>
      ${(() => { const n = noteOf(sh); return n ? (n.note ? `<div class="me-note">📝 <b>Note:</b> ${esc(n.note)}</div>` : '') + (n.day_note ? `<div class="me-note day">📌 <b>At the studio:</b> ${esc(n.day_note)}</div>` : '') : ''; })()}
      ${roles || teach || sh.sick ? `<div class="me-chips">${sh.sick ? '<span class="me-chip sick">🤒 You called in sick</span>' : ''}${roles}${teach}</div>` : ''}
      ${team ? `<div class="me-team">Working with ${team}</div>` : '<div class="me-team">No one else is on yet.</div>'}
      ${meOfferLine(sh) || (canSick ? `<div class="me-actions"><button class="ho-btn" onclick="meSick(${i})">🤒 Call in sick</button>${meCanGive(sh) ? `<button class="ho-btn" onclick="meGiveAway(${i})">🔁 Give away</button>` : ''}</div>`
        : meCanGive(sh) ? `<div class="me-actions"><button class="ho-btn" onclick="meGiveAway(${i})">🔁 Give away</button></div>` : '')}
    </div>`;
  });
  html += `<div style="text-align:center;margin-top:8px"><button class="ho-btn" onclick="_meWeeks += 4; meLoadShifts()">Show 4 more weeks</button></div>`;
  body.innerHTML = coverHtml + html;
  _meShifts = shifts;
}
let _meShifts = [];
// ---- 🔁 Shift give-aways (hub_shift_offers.sql) ----
let _meOffers = null;
async function meLoadOffers() {
  try { const r = await sb.rpc('hub_offers_mine'); _meOffers = r.error ? null : r.data; } catch (e) { _meOffers = null; }
}
function meOfferFor(sh) { return ((_meOffers && _meOffers.mine) || []).find(o => o.shift_date === sh.shift_date && o.studio_id === sh.studio_id && ['open', 'taken'].includes(o.status)); }
// Any shift on the schedule can be given away (staff-schedule's and Sling's), just not drafts
function meCanGive(sh) { return !!_meOffers && sh.status !== 'draft' && !sh.sick && sh.shift_date >= localDateStr(new Date()) && !meOfferFor(sh); }
function meOfferLine(sh) {
  const o = meOfferFor(sh); if (!o) return '';
  return `<div class="me-offer">${o.status === 'open' ? '🔁 Up for grabs. Waiting for someone to take it.' : `🔁 <b>${esc(String(o.taker_name || '').split(' ')[0])}</b> will take it. Waiting for home office to approve.`}
    <button class="ho-btn" onclick="meOfferCancel('${escAttr(o.id)}')">Withdraw</button></div>`;
}
function meOffersHtml() {
  if (!_meOffers) return '';
  const av = _meOffers.available || [], tk = (_meOffers.taken || []).filter(o => o.status === 'taken');
  const when = o => `${esc(meDateLabel(o.shift_date, localDateStr(new Date())))} · ${esc(shortTime(o.start_time))}–${esc(shortTime(o.end_time))} · ${esc(o.studio_name)}`;
  return (tk.length ? `<div class="me-card"><h3>🔁 Waiting for approval</h3>${tk.map(o => `<div class="me-list-row"><div class="what">${when(o)}<div class="goal-note">from ${esc(o.from_name)}</div></div></div>`).join('')}</div>` : '')
    + (av.length ? `<div class="me-card cover-ask"><h3>🔁 Shifts up for grabs (${av.length})</h3>
        ${av.map(o => `<div class="me-list-row"><div class="what"><b>${when(o)}</b><div class="goal-note">${esc(o.from_name)}${o.note ? ' · ' + esc(o.note) : ''}</div></div>
          <button class="ho-btn primary" onclick="meOfferTake('${escAttr(o.id)}')">I’ll take it</button></div>`).join('')}
        <div class="me-small">Home office approves every swap. It stays theirs until then.</div></div>` : '');
}
function meOfferPush(id, event) { fnHeaders().then(h => fetch(`${SUPABASE_URL}/functions/v1/hub-push`, { method: 'POST', headers: h, body: JSON.stringify({ action: 'offer', offer_id: id, event }) })).catch(() => {}); }
function meGiveAway(i) {
  const sh = _meShifts[i]; if (!sh) return;
  openDutySheet(`<h3>🔁 Give away this shift?</h3><p>${esc(meDateLabel(sh.shift_date, localDateStr(new Date())))} · ${esc(shortTime(sh.start_time))}–${esc(shortTime(sh.end_time))}</p>
    <div id="go-msg"></div>
    <div class="me-form"><label>Note for whoever takes it (optional)<input id="go-note" maxlength="300" placeholder="e.g. Dentist appointment, happy to take a shift back"></label></div>
    <div class="me-small" style="margin-top:6px">Staff at your studio and nearby studios who are free then can take it. <b>It stays your shift until home office approves the swap.</b></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="go-btn" onclick="meGiveAwaySave(${i})">Offer it</button></div>`);
}
async function meGiveAwaySave(i) {
  const sh = _meShifts[i], btn = document.getElementById('go-btn'), msg = document.getElementById('go-msg');
  if (btn) { btn.disabled = true; btn.textContent = 'Offering…'; }
  let data, error;
  try { ({ data, error } = await sb.rpc('hub_offer_shift', { p_date: sh.shift_date, p_studio: sh.studio_id, p_note: document.getElementById('go-note').value || null })); }
  catch (e) { error = e; }
  if (error || !data) {   // shown at the top of the pop-up, where it can't be missed
    if (btn) { btn.disabled = false; btn.textContent = 'Offer it'; }
    if (msg) { msg.innerHTML = `<div class="me-msg err" style="margin-bottom:10px">${esc((error && error.message) || 'Couldn’t offer the shift. Try again.')}</div>`; msg.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  meOfferPush(data.id, 'offered');
  closeDutySheet(); meLoadShifts();
}
async function meOfferCancel(id) {
  if (!confirm('Withdraw this offer? The shift stays yours.')) return;
  const { error } = await sb.rpc('hub_offer_cancel', { p_id: id });
  if (error) { alert(error.message); return; }
  meLoadShifts();
}
async function meOfferTake(id) {
  const { error } = await sb.rpc('hub_offer_take', { p_id: id });
  if (error) { alert(error.message); meLoadShifts(); return; }
  meOfferPush(id, 'taken');
  meLoadShifts();
}
let _meCover = [];
// 🔑 Lockbox codes for the studios this person works at (hub_my_lockboxes.sql). Closed until tapped.
async function meLockboxHtml() {
  let data;
  try { const r = await sb.rpc('hub_my_lockboxes'); if (r.error || !Array.isArray(r.data) || !r.data.length) return ''; data = r.data; } catch (e) { return ''; }
  return `<details class="me-more" style="margin-bottom:12px;background:#fff"><summary>🔑 Lockbox code${data.length === 1 ? '' : 's'}</summary>
    <div class="lb-list">${data.map(x => `<div class="lb-row"><div><b>${esc(x.studio_name)}</b>${x.home ? ' <span class="goal-note">home studio</span>' : ''}
        ${x.location ? `<div class="goal-note">${esc(x.location)}</div>` : ''}</div>
      <div class="lb-code${x.code ? '' : ' none'}">${x.code ? esc(x.code) : 'No code on file'}</div></div>`).join('')}</div>
    <div class="me-small" style="padding-bottom:10px">Please don’t share these. Only your studios are shown.</div></details>`;
}

// Punch PIN + recent punches (with comments) on My shifts
let _mePunch = null;
// Shifts tab: just a nudge to set a punch PIN (punches live on Hours, the PIN on Profile)
async function mePunchCardHtml() {
  let data, error;
  try { ({ data, error } = await sb.rpc('hub_my_punch_info')); } catch (e) { return ''; }
  if (error || !data || typeof data.has_pin !== 'boolean') return '';
  _mePunch = data;
  if (data.has_pin) return '';
  return `<div class="me-card cover-ask"><h3>⏱ Set your punch PIN</h3>
      <div class="me-small">You’ll type it on the studio computer to punch in and out. 4 numbers, just for you.</div>
      <div style="margin-top:10px"><button class="ho-btn primary" onclick="meTab('profile')">Set it in Profile</button></div></div>`;
}
// Profile tab: set or change the punch PIN
async function mePunchPinCardHtml() {
  let data;
  try { const r = await sb.rpc('hub_my_punch_info'); if (r.error || !r.data || typeof r.data.has_pin !== 'boolean') return ''; data = r.data; } catch (e) { return ''; }
  _mePunch = data;
  if (data.pin_from_profile) return `<div class="me-card"><h3>⏱ Punch PIN</h3>
      <div class="me-small">Your punch PIN is your manager PIN (it also unlocks the coordinator view). Home office changes it in admin.</div></div>`;
  return `<div class="me-card"><h3>🔑 ${data.has_pin ? 'Change your PIN' : 'Set your PIN'}</h3>
      <div class="me-small">Your one 4Cats PIN: you type it on the studio computer to punch in and out and sign policies${_studioData && _studioData.isManager ? ', and it unlocks the coordinator view' : ''}. 4 numbers, just for you.</div>
      <div class="me-form" style="margin-top:10px"><div class="two"><label>${data.has_pin ? 'New PIN' : 'PIN'}<input class="pin-mask" id="me-pin1" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4"></label>
        <label>Again<input class="pin-mask" id="me-pin2" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4"></label></div>
      <button class="ho-btn" style="min-height:46px" onclick="meSetPin()">Save PIN</button></div></div>`;
}
async function meSetPin(again) {
  const a = document.getElementById('me-pin1').value, b = document.getElementById('me-pin2').value;
  if (!/^\d{4}$/.test(a)) { alert('Your PIN is 4 numbers.'); return; }
  if (a !== b) { alert('Those two PINs don’t match.'); return; }
  const { error } = await sb.rpc('hub_set_my_punch_pin', { p_pin: a });
  if (error) { alert(error.message); return; }
  meLoadProfile('<div class="me-msg ok" style="margin-bottom:10px">✓ PIN saved. Use it on the studio computer from now on.</div>');
}
function meCoverHtml() {
  const open = (_meCover || []).filter(r => r.status === 'asked');
  const answered = (_meCover || []).filter(r => r.status !== 'asked');
  return open.map(r => `<div class="me-card cover-ask">
      <h3>🙋 Can you cover a shift?</h3>
      <div class="me-line"><b>${esc(r.studio_name || r.studio_id)}</b> · ${esc(meDateLabel(r.shift_date, localDateStr(new Date())))}</div>
      <div class="me-line">${esc(shortTime(r.start_time))} – ${esc(shortTime(r.end_time))}</div>
      <div class="me-small">${r.asked_by_name ? esc(r.asked_by_name) + ' is asking' : 'Your manager is asking'} because a teammate is off sick.</div>
      <div class="me-actions"><button class="ho-btn primary" onclick="meAnswerCover('${escAttr(r.id)}', true)">Yes, I’ll cover</button>
        <button class="ho-btn" onclick="meAnswerCover('${escAttr(r.id)}', false)">Can’t make it</button></div>
    </div>`).join('') + answered.map(r => `<div class="me-msg ${r.status === 'accepted' ? 'ok' : 'warn'}" style="margin-bottom:10px">${r.status === 'accepted' ? '✓ You’re covering' : 'You said you can’t cover'} ${esc(r.studio_name || '')} on ${esc(meFmtDate(r.shift_date))}, ${esc(shortTime(r.start_time))}–${esc(shortTime(r.end_time))}.</div>`).join('');
}
async function meAnswerCover(id, yes) {
  let note = null;
  if (!yes) { note = prompt('Anything to tell your manager? (optional)') ; if (note === null) return; }
  const { error } = await sb.rpc('hub_respond_cover', { p_id: id, p_accept: yes, p_note: note || null });
  if (error) { alert(error.message); return; }
  hubNotify({ type: 'cover_answer', request_id: id });
  meLoadShifts();
}
let _meFiles = null;
const MED_BUCKET = 'staff-medical-notes';
function meSick(i) {
  const sh = _meShifts[i]; if (!sh) return;
  const need = _meReq && _meReq.rules && _meReq.rules.sick_reason_required;
  openDutySheet(`<h3>🤒 Call in sick</h3>
    <p>${esc(meDateLabel(sh.shift_date, localDateStr(new Date())))}, ${esc(shortTime(sh.start_time))} – ${esc(shortTime(sh.end_time))}. Your studio and manager will see this straight away so they can find cover.</p>
    ${(() => { const [y, m, d] = sh.shift_date.split('-').map(Number), [h, mi] = String(sh.start_time).split(':').map(Number);
        const hrs = (new Date(y, m - 1, d, h, mi) - new Date()) / 3600000, late = (_meReq && _meReq.rules && _meReq.rules.sick_late_hours) || 12;
        return hrs <= late ? `<div class="me-msg warn" style="margin-bottom:10px">Your shift starts in ${hrs < 1 ? 'less than an hour' : Math.round(hrs) === 1 ? 'about an hour' : Math.round(hrs) + ' hours'}, so this is a late sick call. Your manager will be notified in the Hub straight away and see it’s short notice.</div>` : ''; })()}
    <label class="f">Note for your manager${need ? '' : ' (optional)'}<textarea id="me-sick-note" maxlength="500" placeholder="e.g. Fever since last night"></textarea></label>
    <div id="me-sick-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="me-sick-go" onclick="meSickGo(${i})">Call in sick</button></div>`);
}
async function meSickGo(i) {
  const sh = _meShifts[i];
  const btn = document.getElementById('me-sick-go'); btn.disabled = true;
  const { data, error } = await sb.rpc('hub_call_in_sick', { p_shift_date: sh.shift_date, p_studio_id: sh.studio_id, p_note: document.getElementById('me-sick-note').value || null });
  if (error) { document.getElementById('me-sick-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; btn.disabled = false; return; }
  const pay = data && data.pay;
  // email the studio's managers (the sick call id comes from the studio list)
  if (data && data.sick_call_id) hubNotify({ type: 'sick_call', sick_call_id: data.sick_call_id });
  openDutySheet(`<h3>🤒 Got it. Feel better!</h3>
    <p>Rest up. Your studio and manager will sort out the day.</p>
    <div class="me-msg ok" style="margin-bottom:10px">✓ Your manager has been notified in the Hub${data && data.late ? ', marked as short notice' : ''}, and will sort out the day.</div>
    ${pay === 'paid' ? '<div class="me-msg ok">This is a paid sick day.</div>' : pay === 'unpaid' ? `<div class="me-msg warn">${((_meReq || {}).tally || {}).sick_leave && Number(_meReq.tally.sick_leave.paid_days) === 0 ? 'This is an unpaid, job-protected sick day.' : 'You’ve used your paid sick days, so this is an unpaid, job-protected sick day.'}</div>`
      : pay === 'not_eligible' ? '<div class="me-msg warn">Paid sick days start after 3 months, so this one is unpaid.</div>' : ''}
    <div class="sheet-actions"><button class="primary" onclick="closeDutySheet()">OK</button></div>`);
  meLoadShifts();
}

// ---- 🕒 Timesheets (hub_timesheets.sql): staff "Hours" tab + home office approval ----
const TS_KIND = { in: 'In', break_out: 'Break', break_in: 'Back', out: 'Out' };
// Punch times always in the STUDIO's time zone (the database reads corrected times that way too)
// (Nov 11 2026) BC and Alberta are on permanent time (UTC−7 / UTC−6 all year), like the studios table; Ontario follows Toronto
function tsTz(studioId) { const p = String(studioId || '').slice(0, 2); return p === 'BC' ? 'Etc/GMT+7' : p === 'AB' ? 'Etc/GMT+6' : p === 'ON' ? 'America/Toronto' : undefined; }
function tsTzLabel(studioId) { const p = String(studioId || '').slice(0, 2); return p === 'BC' ? 'BC' : p === 'AB' ? 'Alberta' : p === 'ON' ? 'Ontario' : ''; }
const tsTime = (iso, studioId) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tsTz(studioId) });
// "HH:MM" (24h) in the studio's zone, for time boxes
function tsHHMM(iso, studioId) {
  const parts = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tsTz(studioId) }).formatToParts(new Date(iso));
  const g = t => (parts.find(x => x.type === t) || {}).value || '00';
  return g('hour') + ':' + g('minute');
}
const tsHm = m => { m = Math.round(Number(m) || 0); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
function tsDayLabel(d) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function tsPeriodLabel(per) {
  return `${tsDayLabel(per.start)} – ${tsDayLabel(per.end)}${per.pay_date ? ' · paid ' + tsDayLabel(per.pay_date) : ''}`;
}
function tsStatusPill(ts, admin) {
  if (ts.days_worked !== undefined) {   // per-day approval (hub_timesheets_v3)
    const w = Number(ts.days_worked) || 0, ap = Number(ts.days_approved) || 0;
    if (w && ap >= w) return '<span class="me-pill approved">✓ All days approved</span>';
    if (ap) return `<span class="me-pill pending">${ap} of ${w} days approved</span>`;
  }
  if (ts.status === 'approved') return `<span class="me-pill approved">✓ Approved${admin && ts.approved_by_name ? ' by ' + esc(ts.approved_by_name) : ''}</span>`;   // staff: just "Approved"
  const ended = ts.period && ts.period.end < localDateStr(new Date());
  return `<span class="me-pill pending">${ts.reopened_at ? 'Changed since approval: waiting' : ended ? 'Waiting for approval' : 'Current pay period'}</span>`;
}
// one day; admin adds fix buttons
function tsDayHtml(d, admin) {
  const today = localDateStr(new Date());
  const has = (d.shifts || []).length || (d.punches || []).length || (d.notes || []).length;
  if (!has) return '';
  const open = d.minutes && d.minutes.open_days > 0 && d.date < today;
  const shifts = (d.shifts || []).map(x => `${esc(shortTime(x.start))}–${esc(shortTime(x.end))}${x.studio_id ? ' · ' + esc(STUDIO_NAMES[x.studio_id] || x.studio_id) : ''}`).join(', ');
  const chips = (d.punches || []).map(p => `<span class="ts-p${(p.flags || []).length ? ' flag' : ''}${p.original_at ? ' edited' : ''}"
      title="${escAttr([...(p.flags || []), p.edit_note ? 'Changed: ' + p.edit_note : ''].filter(Boolean).join(' · '))}"><b>${TS_KIND[p.kind] || p.kind}</b> ${esc(tsTime(p.at, p.studio_id))}${p.original_at ? ' ✎' : ''}</span>`).join('');
  const extra = (d.punches || []).filter(p => (p.flags || []).length || p.edit_note).map(p =>
    `<div class="ts-line">${(p.flags || []).length ? '⚑ ' + esc(p.flags.join(' · ')) + ' ' : ''}${p.edit_note ? '✎ ' + esc(p.edited_by_name || 'Home office') + ': ' + esc(p.edit_note) + (p.original_at ? ' (was ' + esc(tsTime(p.original_at, p.studio_id)) + ')' : '') : ''}</div>`).join('');
  // Comments typed at the punch clock count as notes (shown with the other notes)
  const WHEN = { in: 'punching in', break_out: 'starting a break', break_in: 'ending a break', out: 'punching out' };
  const punchNotes = (d.punches || []).filter(p => p.comment).map(p => `<div class="ts-note"><div>📝 <span class="goal-note">When ${WHEN[p.kind] || 'punching'} (${esc(tsTime(p.at, p.studio_id))}):</span> “${esc(p.comment)}”</div></div>`).join('');
  const notes = (d.notes || []).map(n => `<div class="ts-note"><div>📝 ${esc(n.note)}${n.after_approval ? ' <span class="pf-status need">after approval</span>' : ''}</div>
      ${n.answer ? `<div class="ts-answer">↳ ${esc(n.answered_by_name || 'Home office')}: ${esc(n.answer)}</div>` : (admin ? `<button class="ho-btn" style="min-height:30px;margin-top:4px" onclick="tsAnswer('${escAttr(n.id)}')">Answer</button>` : '<div class="ts-answer muted">Waiting for home office</div>')}</div>`).join('');
  return `<div class="ts-day${open ? ' open' : ''}">
    <div class="ts-head"><b>${esc(tsDayLabel(d.date))}</b>${shifts ? `<span class="goal-note">Shift ${shifts}</span>` : '<span class="goal-note">No shift</span>'}
      ${!admin && (d.punches || []).length ? (d.approval && d.approval.status === 'approved' ? '<span class="me-pill approved">✓ Approved</span>' : d.approval && d.approval.status === 'changed' ? '<span class="me-pill pending">Changed: waiting</span>' : (d.date < localDateStr(new Date()) ? '<span class="me-pill pending">Waiting</span>' : '')) : ''}
      <span class="ts-tot">${(d.punches || []).length ? tsHm(d.minutes.worked) + (d.minutes.break ? ' · ' + tsHm(d.minutes.break) + ' break' : '') : ''}</span></div>
    ${chips && !admin ? `<div class="ts-chips">${chips}</div>` : ''}
    ${open ? '<div class="ts-line" style="color:#b91c1c;font-weight:700">No punch out this day</div>' : ''}
    ${d.ot && (d.ot.ot15 || d.ot.ot2) ? `<div class="ts-line" style="color:#b45309">⏱ Overtime: ${d.ot.ot15 ? tsHm(d.ot.ot15) + ' at 1.5×' : ''}${d.ot.ot15 && d.ot.ot2 ? ', ' : ''}${d.ot.ot2 ? tsHm(d.ot.ot2) + ' at 2×' : ''}</div>` : ''}
    ${extra}${punchNotes}${notes}
    ${!admin && d.date <= localDateStr(new Date()) ? `<button class="ho-btn" style="min-height:32px;margin-top:6px" onclick="meTsNote('${escAttr(d.date)}')">Add a note</button>` : ''}
  </div>`;
}

// ---- staff: Hours tab ----
let _meTsDate = null;
async function meLoadHours(date) {
  const body = document.getElementById('me-body');
  if (date) _meTsDate = date;
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  let { data, error } = await sb.rpc('hub_my_timesheet_ot', { p_date: _meTsDate || localDateStr(new Date()) });
  if (error && /hub_my_timesheet_ot/i.test(error.message)) ({ data, error } = await sb.rpc('hub_my_timesheet', { p_date: _meTsDate || localDateStr(new Date()) }));
  if (!error && data) (data.days || []).forEach(d => { d.ot = (data.ot || {})[d.date] || null; });
  if (error) { body.innerHTML = `<div class="me-msg err">${esc(/hub_my_timesheet/i.test(error.message) ? 'Timesheets aren’t set up yet.' : error.message)}</div>`; return; }
  const per = data.period, prev = addDaysStr(per.start, -1), next = addDaysStr(per.end, 1);
  const days = (data.days || []).map(d => tsDayHtml(d, false)).join('');
  body.innerHTML = `<div class="me-card">
      <div class="ts-nav"><button class="ho-btn" onclick="meLoadHours('${prev}')">‹</button>
        <div class="ts-per"><b>${esc(tsPeriodLabel(per))}</b><div>${tsStatusPill(data)}</div></div>
        <button class="ho-btn" onclick="meLoadHours('${next}')" ${per.start > localDateStr(new Date()) ? 'disabled' : ''}>›</button></div>
      <div class="me-stats"><div class="me-stat"><b>${tsHm(data.totals.worked)}</b><span>worked</span></div><div class="me-stat"><b>${tsHm(data.totals.break)}</b><span>on breaks</span></div></div>
      ${(() => { const o15 = (data.days || []).reduce((n, d) => n + (d.ot ? d.ot.ot15 : 0), 0), o2 = (data.days || []).reduce((n, d) => n + (d.ot ? d.ot.ot2 : 0), 0);
        return o15 + o2 ? `<div class="me-small" style="margin-top:8px">⏱ Overtime this pay period: <b>${tsHm(o15)}</b> at 1.5×${o2 ? `, <b>${tsHm(o2)}</b> at 2×` : ''}</div>` : ''; })()}
      ${data.totals.open_days ? `<div class="me-msg warn" style="margin-top:10px">${data.totals.open_days} day${data.totals.open_days === 1 ? '' : 's'} with no punch out. Add a note with the time you finished.</div>` : ''}
      <div class="me-small" style="margin-top:8px">Something wrong? Tap <b>Add a note</b> on that day and home office will fix it before approving.</div>
    </div>
    ${days || '<div class="me-card">No shifts or punches in this pay period.</div>'}
    <div style="text-align:center;margin:10px 0"><button class="ho-btn" onclick="meTsNote(null)">Add a note for another day</button></div>`;
}
function addDaysStr(d, n) { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd + n); return localDateStr(x); }
function meTsNote(date) {
  openDutySheet(`<h3>📝 Note for home office</h3>
    <div class="me-form">${date ? `<p>${esc(tsDayLabel(date))}</p><input type="hidden" id="ts-date" value="${escAttr(date)}">` : `<label>Day<input type="date" id="ts-date" max="${localDateStr(new Date())}"></label>`}
      <label>What’s wrong?<textarea id="ts-note" maxlength="1000" placeholder="e.g. Forgot to punch out, I left at 5:00"></textarea></label></div>
    <div id="ts-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="meTsNoteSave()">Send</button></div>`);
}
async function meTsNoteSave() {
  const date = document.getElementById('ts-date').value, note = document.getElementById('ts-note').value;
  if (!date) { document.getElementById('ts-msg').innerHTML = '<div class="me-msg err">Choose the day.</div>'; return; }
  const { error } = await sb.rpc('hub_add_timesheet_note', { p_date: date, p_note: note });
  if (error) { document.getElementById('ts-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet(); meLoadHours(date);
}

// ---- home office: 🕒 Timesheets ----
let _tsDate = null, _tsPerson = null;
// Who's signed in (home office): the name on their login in admin, filled in automatically
let _tsMe = null;
async function tsLoadMe() {
  if (_tsMe !== null) return _tsMe;
  _tsMe = '';
  try {
    const { data: u } = await sb.auth.getUser();
    if (u && u.user) {
      const { data } = await sb.from('studio_users').select('display_name').eq('user_id', u.user.id).eq('role', 'admin').limit(1);
      _tsMe = (data && data[0] && data[0].display_name) || (u.user.email || '').split('@')[0] || '';
    }
  } catch (e) {}
  return _tsMe;
}
function tsByName() { return _tsMe || ''; }
// ---------- 🛡️ Anonymous concerns (hub_concerns.sql) ----------
// The same form on the studio computer (its studio filled in) and on staff phones.
// Nothing about who sends it is kept; only the day.
let _cn = { kind: null };
function concernFormHtml(fixedStudio, studios) {
  const today = localDateStr(new Date());
  return `<div class="cn-intro">
      <p><b>Use this form for:</b> safety or cleanliness concerns, and interpersonal concerns (how people are being treated at work).</p>
      <p>💬 <b>If you feel comfortable, please talk to your manager first.</b> It’s usually the quickest way to sort things out.</p>
      <p>📧 <b>HR or payroll question?</b> Email <a href="mailto:HR@4cats.com">HR@4cats.com</a> instead.</p>
      <p>🚨 <b>In an emergency, call 911.</b></p></div>
    <div class="cn-anon">🔒 <b>Anonymous.</b> The Hub doesn’t record who sends this. Only home office reads it.</div>
    <div class="me-form" style="margin-top:12px">
      ${fixedStudio ? `<div class="goal-note">Studio: <b>${esc(STUDIO_NAMES[fixedStudio] || fixedStudio)}</b></div>`
        : (() => { const list = (studios && studios.length ? studios : (_cn.mineOnly ? [] : Object.keys(STUDIO_NAMES))).slice().sort((a, b) => String(STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
            const one = list.length === 1;
            return `<label>Studio<select id="cn-studio">${one ? '' : '<option value="">Choose…</option>'}${list.map(id => `<option value="${escAttr(id)}">${esc(STUDIO_NAMES[id] || id)}</option>`).join('')}
              <option value="__none">Prefer not to say / not about a studio</option></select></label>`; })()}
      <label>When did it happen?<input type="date" id="cn-date" value="${today}" max="${today}"></label>
      <label>Your concern<textarea id="cn-text" rows="6" maxlength="5000" placeholder="Please be as detailed as you can, so it can be sorted out quickly."></textarea></label>
      <label>Your name and email <span class="goal-note">(only if you want us to contact you)</span><input id="cn-contact" maxlength="300" placeholder="Leave empty to stay anonymous"></label>
      <div class="me-sub-title">Can we share this with the studio team?</div>
      <div class="cn-share"><label><input type="radio" name="cn-share" value="no" checked> No</label><label><input type="radio" name="cn-share" value="yes"> Don’t mind</label></div>
      <div id="cn-msg"></div>
      <button class="ho-btn primary" style="min-height:46px" id="cn-send" onclick="concernSend(${fixedStudio ? `'${escAttr(fixedStudio)}'` : 'null'})">Send anonymously</button></div>`;
}
function concernRerender() { const h = document.getElementById(_cn.host); if (h) h.innerHTML = concernFormHtml(_cn.fixed, _cn.studios); }
function openConcernPane() {   // studio computer / home office
  showOnlyPane('concern-pane'); setActiveNav('nav-concern');
  _cn = { kind: null, host: 'concern-host', fixed: _studioData && _studioData.isAdmin ? null : _sessionStudioId, studios: null };
  concernRerender();
}
async function concernOpenSheet() {   // staff phones: only their own studios to choose from (nothing about them is sent with the report)
  openDutySheet(`<h3>🛡️ Report a concern</h3><div id="cn-sheet"><div class="goal-note">Loading…</div></div><div class="sheet-actions"><button onclick="closeDutySheet()">Close</button></div>`);
  let mine = [];
  try { const r = await sb.rpc('hub_chat_staff_studios', { p_staff: _me && _me.staff_id }); if (!r.error && Array.isArray(r.data)) mine = r.data.filter(Boolean); } catch (e) {}
  _cn = { kind: null, host: 'cn-sheet', fixed: null, studios: mine, mineOnly: true };
  concernRerender();
}
async function concernSend(fixedStudio) {
  const msg = document.getElementById('cn-msg'), btn = document.getElementById('cn-send');
  const studio = fixedStudio || (document.getElementById('cn-studio') || {}).value || '';
  const text = document.getElementById('cn-text').value.trim();
  if (!studio) { msg.innerHTML = '<div class="me-msg err">Choose the studio, or “Prefer not to say”.</div>'; return; }
  if (!text) { msg.innerHTML = '<div class="me-msg err">Describe the concern.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  const share = (document.querySelector('input[name=cn-share]:checked') || {}).value === 'yes';
  const { error } = await sb.rpc('hub_report_concern', { p_kind: 'general', p_studio: studio === '__none' ? null : studio, p_date: document.getElementById('cn-date').value || null,
    p_concern: text, p_contact: document.getElementById('cn-contact').value || null, p_share: share });
  if (error) { btn.disabled = false; btn.textContent = 'Send anonymously'; msg.innerHTML = `<div class="me-msg err">${esc(/hub_report_concern/i.test(error.message) ? 'Reporting isn’t set up yet (hub_concerns.sql).' : error.message)}</div>`; return; }
  const h = document.getElementById(_cn.host);
  if (h) h.innerHTML = `<div class="cn-done">💛 <b>Thank you.</b> Your report went to home office.${document.getElementById('cn-contact') && document.getElementById('cn-contact').value ? '' : ' It’s anonymous, so we can’t reply to you directly. If you want to talk to someone, you can always reach home office.'}</div>`;
  _cn.kind = null;
}
// Home office: the reports
async function openConcernsAdmin() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('concerns-pane'); setActiveNav('nav-concerns'); loadConcernsAdmin();
}
async function loadConcernsAdmin() {
  const body = document.getElementById('concerns-body'); if (!body) return;
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_concerns_list');
  if (error) { body.innerHTML = `<div class="ho-card"><div class="goal-note">${esc(/hub_concerns_list/i.test(error.message) ? 'Run hub_concerns.sql to set up reporting.' : error.message)}</div></div>`; return; }
  const list = data || [];
  const n = list.filter(c => c.status === 'new').length, badge = document.getElementById('concerns-badge'); if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
  const KIND = { general: 'Concern', safety: '🧹 Safety or cleanliness', conduct: '🙋 Staff behaviour or studio issue' }, ST = { new: 'New', reviewing: 'Looking into it', resolved: 'Resolved' };
  body.innerHTML = list.length ? list.map(c => `<div class="ho-card cn-card ${c.status}">
      <div class="cn-head"><span class="cn-st ${c.status}">${ST[c.status]}</span><b>${KIND[c.kind] || c.kind}</b><span class="goal-note">· ${esc(STUDIO_NAMES[c.studio_id] || c.studio_id || 'Studio not given')} · happened ${esc(tsDayLabel(c.concern_date || c.sent_on))} · sent ${esc(tsDayLabel(c.sent_on))}</span></div>
      <div class="cn-text">${esc(c.concern).replace(/\n/g, '<br>')}</div>
      <div class="goal-note">${c.contact ? `Wants to be contacted: <b>${esc(c.contact)}</b>` : 'Anonymous, no contact left'}${c.kind !== 'conduct' ? ` · ${c.share_with_studio ? 'OK to share with the studio team' : 'Don’t share with the studio team'}` : ''}</div>
      <div class="cn-edit"><select id="cn-st-${escAttr(c.id)}">${Object.entries(ST).map(([k, l]) => `<option value="${k}"${c.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <input id="cn-notes-${escAttr(c.id)}" value="${escAttr(c.ho_notes || '')}" placeholder="Home office notes (private)" maxlength="2000">
        <button class="ho-btn" onclick="concernSave('${escAttr(c.id)}')">Save</button></div>
      ${c.updated_by_name ? `<div class="goal-note">Last updated by ${esc(c.updated_by_name)}</div>` : ''}</div>`).join('')
    : '<div class="ho-card"><div class="goal-note">No reports yet.</div></div>';
}
async function concernSave(id) {
  await tsLoadMe();
  const { error } = await sb.rpc('hub_concern_update', { p_id: id, p_status: document.getElementById('cn-st-' + id).value, p_notes: document.getElementById('cn-notes-' + id).value, p_by_name: tsByName() || null });
  if (error) { alert(error.message); return; }
  loadConcernsAdmin();
}

// ---------- Home office: shift swaps (hub_shift_offers.sql) ----------
async function openSwapsPane() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('swaps-pane'); setActiveNav('nav-swaps'); loadSwapsPane();
}
async function loadSwapsPane() {
  const body = document.getElementById('swaps-body'); if (!body) return;
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_offers_admin');
  if (error) { body.innerHTML = `<div class="ho-card"><div class="goal-note">${esc(/hub_offers_admin/i.test(error.message) ? 'Run hub_shift_offers.sql to set up shift swaps.' : error.message)}</div></div>`; return; }
  const list = data || [], waiting = list.filter(o => o.status === 'taken'), open = list.filter(o => o.status === 'open'), done = list.filter(o => !['taken', 'open'].includes(o.status));
  const badge = document.getElementById('swaps-badge'); if (badge) { badge.textContent = waiting.length; badge.style.display = waiting.length ? '' : 'none'; }
  const when = o => `${esc(tsDayLabel(o.shift_date))} · ${esc(shortTime(o.start_time))}–${esc(shortTime(o.end_time))} · ${esc(o.studio_name)}`;
  const STATUS = { approved: '✅ Approved', cancelled: 'Withdrawn', ended: 'Ended (shift changed or passed)' };
  body.innerHTML = `
    <div class="ho-card"><div class="ho-title" style="font-size:17px">Waiting for you${waiting.length ? ` (${waiting.length})` : ''}</div>
      ${waiting.length ? waiting.map(o => { const over = o.weekly_limit && o.week_hours > o.weekly_limit;
        return `<div class="dev-row pending"><div class="dev-main"><b>${when(o)}</b>
            <div>${esc(o.from_name)} → <b>${esc(o.taker_name)}</b>${o.note ? ` <span class="goal-note">· “${esc(o.note)}”</span>` : ''}</div>
            <div class="goal-note">${esc(String(o.taker_name).split(' ')[0])} would have ${o.week_hours}h that week${o.weekly_limit ? ` (overtime after ${o.weekly_limit}h)` : ''}</div>
            ${over ? `<div class="camp-short">⚠ That’s overtime for ${esc(String(o.taker_name).split(' ')[0])}</div>` : ''}
            ${o.still_ok ? `<div style="color:#b91c1c;font-weight:600">Can’t approve: ${esc(String(o.taker_name).split(' ')[0])} is ${esc(o.still_ok)}</div>` : ''}</div>
          <button class="ho-btn primary" onclick="swapDecide('${escAttr(o.id)}', true)"${o.still_ok ? ' disabled' : ''}>Approve</button>
          <button class="ho-btn" onclick="swapDecide('${escAttr(o.id)}', false)">Decline</button></div>`; }).join('')
        : '<div class="goal-note">Nothing waiting.</div>'}</div>
    <div class="ho-card" style="margin-top:14px"><div class="ho-title" style="font-size:17px">Up for grabs</div>
      ${open.length ? open.map(o => `<div class="dev-row"><div class="dev-main">${when(o)}<div class="goal-note">${esc(o.from_name)} is offering it${o.note ? ' · “' + esc(o.note) + '”' : ''}</div></div></div>`).join('')
        : '<div class="goal-note">No shifts offered right now.</div>'}</div>
    ${done.length ? `<details class="me-more" style="margin-top:14px;background:#fff"><summary>Recent (${done.length})</summary>
      ${done.map(o => `<div class="dev-row"><div class="dev-main">${when(o)}<div class="goal-note">${esc(o.from_name)}${o.taker_name ? ' → ' + esc(o.taker_name) : ''} · ${esc(STATUS[o.status] || o.status)}${o.decided_by_name ? ' by ' + esc(o.decided_by_name) : ''}</div></div></div>`).join('')}</details>` : ''}`;
}
async function swapDecide(id, approve) {
  let note = null;
  if (!approve) { note = prompt('Decline this swap. A short reason for them (optional):', ''); if (note === null) return; }
  else if (!confirm('Approve this swap? The shift moves to them, and both are told.')) return;
  await tsLoadMe();
  const { error } = await sb.rpc('hub_offer_decide', { p_id: id, p_approve: approve, p_by_name: tsByName() || null, p_note: note });
  if (error) { alert(error.message); loadSwapsPane(); return; }
  meOfferPush(id, approve ? 'approved' : 'declined');
  loadSwapsPane();
}

// ---------- Home office: studio computers ----------
async function openDevicesPane() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('devices-pane'); setActiveNav('nav-devices');
  loadDevicesPane();
}
function devWhat(ua) { ua = String(ua || ''); return /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Computer'; }
// More about a device from its browser details: type, browser and system version (e.g. "Mac · Chrome 131 · macOS 14.5")
function devDetail(ua) {
  ua = String(ua || ''); if (!ua) return '';
  const br = (ua.match(/Edg\/(\d+)/) && 'Edge ' + ua.match(/Edg\/(\d+)/)[1]) || (ua.match(/Chrome\/(\d+)/) && 'Chrome ' + ua.match(/Chrome\/(\d+)/)[1])
    || (ua.match(/Firefox\/(\d+)/) && 'Firefox ' + ua.match(/Firefox\/(\d+)/)[1]) || (/Safari\//.test(ua) && ua.match(/Version\/([\d.]+)/) && 'Safari ' + ua.match(/Version\/([\d.]+)/)[1]) || '';
  const os = (ua.match(/(?:iPhone|CPU) OS ([\d_]+)/) && 'iOS ' + ua.match(/(?:iPhone|CPU) OS ([\d_]+)/)[1].replace(/_/g, '.'))
    || (ua.match(/Mac OS X ([\d_]+)/) && 'macOS ' + ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.'))
    || (ua.match(/Windows NT ([\d.]+)/) && ({ '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.1': 'Windows 7' }[ua.match(/Windows NT ([\d.]+)/)[1]] || 'Windows'))
    || (ua.match(/Android ([\d.]+)/) && 'Android ' + ua.match(/Android ([\d.]+)/)[1]) || (/CrOS/.test(ua) && 'ChromeOS') || '';
  return [devWhat(ua), br, os].filter(Boolean).join(' · ');
}
function devBrowser(ua) { ua = String(ua || ''); return /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : ''; }
async function loadDevicesPane() {
  const body = document.getElementById('devices-body'); if (!body) return;
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_devices_list');
  if (error) { body.innerHTML = `<div class="ho-card"><div class="goal-note">${esc(/hub_devices_list/i.test(error.message) ? 'Run hub_devices.sql to set up approved computers.' : error.message)}</div></div>`; return; }
  const pending = (data || []).filter(d => d.status === 'pending'), approved = (data || []).filter(d => d.status === 'approved'), removed = (data || []).filter(d => d.status === 'revoked');
  const badge = document.getElementById('devices-badge'); if (badge) { badge.textContent = pending.length; badge.style.display = pending.length ? '' : 'none'; }
  const when = t => t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  body.innerHTML = `
    <div class="ho-card"><div class="ho-title" style="font-size:17px">Waiting for approval${pending.length ? ` (${pending.length})` : ''}</div>
      ${pending.length ? pending.map(d => `<div class="dev-row pending"><div class="dev-code sm">${esc(d.code)}</div>
          <div class="dev-main"><b>${esc(STUDIO_NAMES[d.studio_id] || d.studio_id)}</b><div class="goal-note">${esc(devDetail(d.user_agent) || devWhat(d.user_agent))}${d.location ? ` · 📍 ${esc(d.location)}` : ''} · asked ${esc(when(d.requested_at))}</div></div>
          <input id="dev-name-${escAttr(d.id)}" placeholder="Name it, e.g. Front desk Mac" maxlength="60">
          <button class="ho-btn primary" onclick="devSet('${escAttr(d.id)}', 'approved')">Approve</button>
          <button class="ho-btn" onclick="devSet('${escAttr(d.id)}', 'revoked')">Deny</button></div>`).join('')
        : '<div class="goal-note">Nothing waiting. A new studio computer shows a code here once someone signs in on it.</div>'}</div>
    <div class="ho-card" style="margin-top:14px"><div class="ho-title" style="font-size:17px">Approved computers</div>
      ${approved.length ? approved.map(d => `<div class="dev-row" id="dev-row-${escAttr(d.id)}"><div class="dev-main"><b>${esc(STUDIO_NAMES[d.studio_id] || d.studio_id)}</b> · <span id="dev-nm-${escAttr(d.id)}">${esc(d.name || devWhat(d.user_agent))}</span>
          <div class="dev-info">💻 ${esc(devDetail(d.user_agent) || 'No device details yet')}${d.location ? ` · 📍 ${esc(d.location)}` : ''}</div>
          <div class="goal-note">Last used <b>${esc(when(d.last_seen_at) || 'not yet')}</b> · approved ${esc(when(d.approved_at))}${d.approved_by_name ? ' by ' + esc(d.approved_by_name) : ''}</div></div>
          <button class="ho-btn" onclick="devRename('${escAttr(d.id)}', ${escAttr(JSON.stringify(d.name || ''))})">Rename</button>
          <button class="ho-btn" onclick="devSet('${escAttr(d.id)}', 'revoked')">Remove</button></div>`).join('')
        : '<div class="goal-note">None yet.</div>'}</div>
    ${removed.length ? `<details class="me-more" style="margin-top:14px;background:#fff"><summary>Removed in the last 30 days (${removed.length})</summary>
      ${removed.map(d => `<div class="dev-row"><div class="dev-main">${esc(STUDIO_NAMES[d.studio_id] || d.studio_id)} · ${esc(d.name || devWhat(d.user_agent))} <span class="goal-note">${esc(d.code)}</span></div>
        <button class="ho-btn" onclick="devSet('${escAttr(d.id)}', 'approved')">Approve again</button></div>`).join('')}</details>` : ''}`;
}
// Rename an approved computer (stays approved)
function devRename(id, current) {
  const nm = document.getElementById('dev-nm-' + id); if (!nm) return;
  nm.innerHTML = `<input id="dev-name-${escAttr(id)}" value="${escAttr(current)}" maxlength="60" placeholder="e.g. Front desk Mac" style="min-width:180px">
    <button class="ho-btn primary" onclick="devSet('${escAttr(id)}', 'approved')">Save</button><button class="ho-btn" onclick="loadDevicesPane()">Cancel</button>`;
  const el = document.getElementById('dev-name-' + id); el.focus(); el.select();
  el.onkeydown = e => { if (e.key === 'Enter') devSet(id, 'approved'); if (e.key === 'Escape') loadDevicesPane(); };
}
async function devSet(id, status) {
  if (status === 'revoked' && !confirm('Remove this computer? The studio login will stop working on it until it’s approved again.')) return;
  const el = document.getElementById('dev-name-' + id);
  const { error } = await sb.rpc('hub_device_set', { p_id: id, p_status: status, p_name: el ? el.value : null, p_by_name: (typeof tsByName === 'function' && (await tsLoadMe(), tsByName())) || null });
  if (error) { alert(error.message); return; }
  loadDevicesPane();
}

async function openTsPane() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('ts-pane'); setActiveNav('nav-ts');
  if (!_tsDate) { const d = new Date(); d.setDate(d.getDate() - 7); _tsDate = localDateStr(d); }   // the last finished pay period, usually
  loadTsPane();
}
// Filters: dates (week / pay period / custom), studio, employee, show
window._tsf = window._tsf || { mode: 'pay', anchor: null, from: '', to: '', studio: '', staff: '', show: 'all' };
let _tsStaffList = null;
async function tsRange() {
  const f = window._tsf, a = f.anchor || (() => { const d = new Date(); d.setDate(d.getDate() - 7); return localDateStr(d); })();
  f.anchor = a;
  if (f.mode === 'custom') { if (!f.from || !f.to) { f.from = addDaysStr(a, -6); f.to = a; } return { from: f.from, to: f.to, label: `${tsDayLabel(f.from)} – ${tsDayLabel(f.to)}` }; }
  if (f.mode === 'week') { const [y, m, d] = a.split('-').map(Number); const dt = new Date(y, m - 1, d); const sun = addDaysStr(a, -dt.getDay());
    return { from: sun, to: addDaysStr(sun, 6), label: `Week of ${tsDayLabel(sun)} – ${tsDayLabel(addDaysStr(sun, 6))}` }; }
  const { data } = await sb.rpc('hub_pay_period', { p_date: a });
  if (!data) return { from: a, to: a, label: a };
  return { from: data.start, to: data.end, label: tsPeriodLabel(data) };
}
function tsStep(dir) {
  const f = window._tsf;
  if (f.mode === 'custom') return;
  f.anchor = addDaysStr(f.anchor, dir * (f.mode === 'week' ? 7 : 14));
  window._tsSel = new Set(); loadTsPane();
}
// (Nov 11 2026) the scheduled shift in a row: "8:30am–5pm" (more than one: first start to last end)
function tsShiftCell(shifts) {
  const shs = (shifts || []).filter(z => z.start && z.end); if (!shs.length) return '<span class="goal-note">—</span>';
  const a = shs.map(z => String(z.start).slice(0, 5)).sort()[0], b = shs.map(z => String(z.end).slice(0, 5)).sort().slice(-1)[0];
  return esc(shortTime(a) + '–' + shortTime(b));
}
// (Nov 11 2026) Refresh: fetch everything again (people list too), and show that it's happening
async function tsRefresh() {
  const btn = document.getElementById('ts-refresh'); if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  _tsStaffList = null;
  try { await loadTsPane(); } finally {
    if (btn) { btn.textContent = '✓ Up to date'; setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Refresh'; }, 1500); }
  }
}
function tsSelectClean() {
  window._tsSel = window._tsSel || new Set(); let n = 0;
  (window._tsPeople || []).forEach(x => (x.days || []).forEach(d => { if (window._tsClean && window._tsClean(d)) { window._tsSel.add(x.staff_id + '|' + d.date); n++; } }));
  loadTsPane().then(() => { if (!n) alert('No clean days to approve here: everything left needs a look.'); });
}
function tsSetFilter(k, v) { window._tsf[k] = v; if (k !== 'show') window._tsSel = new Set(); loadTsPane(); }
async function loadTsPane(date) {
  if (date) window._tsf.anchor = date;
  window._tsSel = window._tsSel || new Set();
  const f = window._tsf, body = document.getElementById('ts-body');
  if (!body.innerHTML.trim()) body.innerHTML = '<div class="ho-intro">Loading…</div>';
  if (!_tsStaffList) { const r = await sb.rpc('hub_ts_staff_list'); _tsStaffList = r.error ? [] : (r.data || []); }
  await tsLoadMe();
  const rg = await tsRange();
  const args = { p_from: rg.from, p_to: rg.to, p_studio_id: f.studio || null, p_staff_id: f.staff || null };
  let { data, error } = await sb.rpc('hub_ts_rows_ot', args);
  if (error && /hub_ts_rows_ot/i.test(error.message)) ({ data, error } = await sb.rpc('hub_ts_rows', args));   // before hub_overtime.sql
  if (!error) (data.people || []).forEach(x => (x.days || []).forEach(d => { d.ot = (x.ot || {})[d.date] || null; }));
  if (error) { body.innerHTML = `<div class="ho-card">${esc(error.message)}${/hub_ts_rows/i.test(error.message) ? ' (run hub_timesheets_v3.sql first)' : ''}</div>`; return; }
  const today = localDateStr(new Date());
  const H = m => (Math.round((Number(m) || 0) / 60 * 100) / 100).toFixed(2);
  const sched = sh => (sh || []).reduce((n, x) => { const [a, b] = [x.start, x.end].map(t => { const [h, mi] = String(t || '0:0').split(':').map(Number); return h * 60 + mi; }); return n + Math.max(0, b - a); }, 0);
  const info = d => {
    const ps = d.punches || [], open = !!(d.minutes && d.minutes.open_days && d.date < today);
    const appr = d.approval && d.approval.status;
    return { ps, open, appr, canApprove: ps.length > 0 && !open && d.date < today,
      check: (d.notes || []).some(n => !n.answer) || ps.some(p => (p.flags || []).length || (p.comment && appr !== 'approved')) || open || appr === 'changed' };
  };
  // (Nov 11 2026) 🍁 province filter (by where the day was worked)
  const provOf = d => String(((d.shifts || [])[0] || {}).studio_id || ((d.punches || [])[0] || {}).studio_id || '').slice(0, 2);
  // ✨ a "clean" day: complete punches, nothing flagged, edited or noted, in and out within 10 minutes of the schedule,
  // no extra time, and a break if the shift is over 5 hours. Only these get picked by "Select clean days".
  const mins = hhmm => { const [h, m] = String(hhmm || '').split(':').map(Number); return h * 60 + m; };
  const plainNote = c => !c || /^Imported from Sling(: break without times, placed mid-shift)?$/.test(c);
  const clean = d => {
    const k = info(d), ps = k.ps;
    if (!k.canApprove || k.appr) return false;
    if (!ps.length || ps.some(p => (p.flags || []).length || p.original_at || !plainNote(p.comment))) return false;
    if ((d.notes || []).length) return false;
    const shs = (d.shifts || []).filter(z => z.start && z.end); if (!shs.length) return false;
    const st = ps[0].studio_id || shs[0].studio_id;
    const ins = ps.filter(p => p.kind === 'in'), outs = ps.filter(p => p.kind === 'out');
    if (ins.length !== 1 || outs.length !== 1) return false;
    if (ps.filter(p => p.kind === 'break_out').length !== ps.filter(p => p.kind === 'break_in').length) return false;
    const sStart = Math.min(...shs.map(z => mins(String(z.start).slice(0, 5)))), sEnd = Math.max(...shs.map(z => mins(String(z.end).slice(0, 5))));
    const pin = mins(tsHHMM(ins[0].at, st)), pout = mins(tsHHMM(outs[0].at, st));
    if (Math.abs(pin - sStart) > 10 || pout > sEnd + 10 || pout < sEnd - 15) return false;
    const worked = d.minutes ? Number(d.minutes.worked) || 0 : 0;
    if (worked > (sEnd - sStart) + 10) return false;
    if (sEnd - sStart > 300 && !ps.some(p => p.kind === 'break_out')) return false;
    return true;
  };
  window._tsClean = clean;
  const show = d => { const k = info(d);
    if (f.prov && provOf(d) !== f.prov) return false;
    if (f.show === 'clean') return clean(d);
    if (f.show === 'pending') return k.ps.length && k.appr !== 'approved';
    if (f.show === 'approved') return k.appr === 'approved';
    if (f.show === 'check') return k.check;
    return true; };
  const people = (data.people || []).map(x => Object.assign({}, x, { days: (x.days || []).filter(show) })).filter(x => x.days.length);
  window._tsPeople = people;
  window._tsRowKeys = [];
  people.forEach(x => x.days.forEach(d => { if (info(d).canApprove || (d.approval && d.approval.status)) window._tsRowKeys.push(x.staff_id + '|' + d.date); }));
  [...window._tsSel].forEach(k => { if (!window._tsRowKeys.includes(k)) window._tsSel.delete(k); });
  const sel = window._tsSel;
  const allOn = window._tsRowKeys.length && window._tsRowKeys.every(k => sel.has(k));
  const studioOpts = Object.keys(STUDIO_NAMES || {}).sort((a, b) => (STUDIO_NAMES[a] || '').localeCompare(STUDIO_NAMES[b] || ''))
    .map(id => `<option value="${escAttr(id)}"${id === f.studio ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('');
  const staffOpts = (_tsStaffList || []).map(x => `<option value="${escAttr(x.staff_id)}"${x.staff_id === f.staff ? ' selected' : ''}>${esc(x.full_name)}</option>`).join('');
  let nRows = 0, nAppr = 0;
  const rows = people.map((x, pi) => {
    const keys = x.days.filter(d => info(d).canApprove || (d.approval && d.approval.status)).map(d => x.staff_id + '|' + d.date);
    const worked = x.days.reduce((n, d) => n + (d.minutes ? Number(d.minutes.worked) || 0 : 0), 0);
    const sch = x.days.reduce((n, d) => n + sched(d.shifts), 0), diff = worked - sch;
    const ot15 = x.days.reduce((n, d) => n + (d.ot ? d.ot.ot15 : 0), 0), ot2 = x.days.reduce((n, d) => n + (d.ot ? d.ot.ot2 : 0), 0);
    const collapsed = (window._tsCollapsed || {})[x.staff_id];
    const head = `<tr class="tsg-group"><td class="tsg-cb">${keys.length ? `<input type="checkbox" ${keys.every(k => sel.has(k)) ? 'checked' : ''} onchange="tsPick(${JSON.stringify(keys).replace(/"/g, '&quot;')}, this.checked)">` : ''}</td>
        <td colspan="2"><button class="tsg-tog" onclick="tsToggle('${escAttr(x.staff_id)}')">${collapsed ? '▸' : '▾'}</button> <b>${esc(String(x.full_name || '').toUpperCase())}</b></td>
        <td colspan="6"></td><td>${H(sch)}</td><td><b>${H(worked)}</b></td><td class="${diff > 0 ? 'tsg-red' : ''}">${worked ? H(diff) : ''}</td>
        <td>${tsOtCell(ot15, ot2, true)}</td><td colspan="4"></td></tr>`;
    if (collapsed) return head;
    return head + x.days.map(d => {
      const k = info(d), ps = k.ps, key = x.staff_id + '|' + d.date;
      nRows++; if (k.appr === 'approved') nAppr++;
      const first = kk => ps.find(p => p.kind === kk), last = kk => [...ps].reverse().find(p => p.kind === kk);
      const inP = first('in'), outP = last('out'), bo = first('break_out'), bi = first('break_in');
      const nBreaks = ps.filter(p => p.kind === 'break_out').length;
      const flagged = ps.some(p => (p.flags || []).length);
      const loc = ((d.shifts || [])[0] || {}).studio_id || (ps[0] || {}).studio_id;
      const sc = sched(d.shifts), w = d.minutes ? Number(d.minutes.worked) || 0 : 0, dd = w - sc;
      const comments = ps.filter(p => p.comment).map(p => p.comment);
      const notes = d.notes || [], nNotes = notes.length + comments.length;
      const unanswered = notes.some(n => !n.answer) || (comments.length > 0 && k.appr !== 'approved');
      const noteTip = [...comments.map(c => 'At the punch clock: ' + c), ...notes.map(n => n.note)].join(' · ');
      const cell = p => p ? `<span class="${(p.flags || []).length ? 'tsg-flag' : ''}${p.original_at ? ' tsg-edit' : ''}" title="${escAttr([...(p.flags || []), p.edit_note ? 'Changed: ' + p.edit_note : ''].filter(Boolean).join(' · '))}">${esc(tsTime(p.at, p.studio_id))}${p.original_at ? ' ✎' : ''}</span>` : '';
      const st = k.appr === 'approved' ? `<span class="tsg-st ok" title="${escAttr('Approved' + (d.approval.by ? ' by ' + d.approval.by : '') + (d.approval.at ? ', ' + new Date(d.approval.at).toLocaleDateString() : ''))}">APPROVED</span>${d.approval.by ? `<div class="tsg-by">${esc(d.approval.by)}</div>` : ''}`
        : k.appr === 'changed' ? '<span class="tsg-st need" title="A punch changed after it was approved">CHANGED</span>'
        : ps.length ? '<span class="tsg-st need">PENDING</span>' : '';
      const canPick = k.canApprove || k.appr;
      return `<tr class="tsg-row${k.open ? ' tsg-open' : ''}${sel.has(key) ? ' tsg-sel' : ''}">
        <td class="tsg-cb">${canPick ? `<input type="checkbox" ${sel.has(key) ? 'checked' : ''} onchange="tsPick(['${escAttr(key)}'], this.checked)">` : ''}</td>
        <td class="tsg-name">${hubAvatarHtml(x, 22)}<span>${esc(x.name || x.full_name)}</span></td><td>${esc(tsDayLabel(d.date))}</td>
        <td class="tsg-loc">${esc(STUDIO_NAMES[loc] || loc || '')}</td><td class="tsg-shift">${tsShiftCell(d.shifts)}</td><td>${cell(inP)}</td>
        <td>${bo ? cell(bo) + '–' + (bi ? cell(bi) : '…') : ''}${nBreaks > 1 ? ` <span class="goal-note">+${nBreaks - 1}</span>` : ''}</td>
        <td>${d.minutes && d.minutes.break ? H(d.minutes.break) : ''}</td>
        <td>${outP ? cell(outP) + (outP.source === 'staff_link' ? ' <span title="Set by the staff member from the “forgot to punch out?” email">📧</span>' : '') : (k.open ? '<span class="tsg-red">missing</span>' : '')}</td>
        <td>${sc ? H(sc) : ''}</td><td>${ps.length ? H(w) : ''}</td><td class="${dd > 0 && !k.open ? 'tsg-red' : ''}">${ps.length && sc && !k.open ? H(dd) : ''}</td>
        <td>${d.ot ? tsOtCell(d.ot.ot15, d.ot.ot2) : ''}</td>
        <td>${st}</td>
        <td>${flagged ? `<span class="tsg-flagicon" title="${escAttr(ps.flatMap(p => p.flags || []).join(' · '))}">⚑</span>` : ''}</td>
        <td>${nNotes ? `<button class="tsg-note${unanswered ? ' new' : ''}" title="${escAttr(noteTip)}" onclick="tsDaySheet(${pi}, '${escAttr(d.date)}')">📝${nNotes > 1 ? nNotes : ''}</button>` : ''}</td>
        <td><button class="tsg-more" onclick="tsDaySheet(${pi}, '${escAttr(d.date)}')" title="Fix punches, notes, approve">⋮</button></td></tr>`;
    }).join('');
  }).join('');
  body.innerHTML = `<div class="ho-card tsg-bar">
      <div class="tsg-modes">${[['week', 'Week'], ['pay', 'Pay period'], ['custom', 'Custom']].map(([k, l]) => `<button class="${f.mode === k ? 'on' : ''}" onclick="tsSetFilter('mode', '${k}')">${l}</button>`).join('')}</div>
      ${f.mode === 'custom'
        ? `<input type="date" value="${escAttr(rg.from)}" onchange="window._tsf.from = this.value; loadTsPane()"> – <input type="date" value="${escAttr(rg.to)}" onchange="window._tsf.to = this.value; loadTsPane()">`
        : `<button class="ho-btn" onclick="tsStep(-1)">‹</button><div class="tsg-per"><b>${esc(rg.label)}</b></div><button class="ho-btn" onclick="tsStep(1)">›</button>`}
      <select onchange="tsSetFilter('prov', this.value)">${[['', 'All provinces'], ['BC', 'BC'], ['AB', 'Alberta'], ['ON', 'Ontario']].map(([k, l]) => `<option value="${k}"${(f.prov || '') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select onchange="tsSetFilter('studio', this.value)"><option value="">All studios</option>${studioOpts}</select>
      <select onchange="tsSetFilter('staff', this.value)"><option value="">All employees</option>${staffOpts}</select>
      <select onchange="tsSetFilter('show', this.value)">${[['all', 'Show: everything'], ['pending', 'Show: pending'], ['clean', 'Show: clean (ready to approve)'], ['approved', 'Show: approved'], ['check', 'Show: needs checking']].map(([k, l]) => `<option value="${k}"${f.show === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <span class="spacer"></span>
      <span class="goal-note">${tsByName() ? `Signed in as <b>${esc(tsByName())}</b>` : ''}</span><input type="hidden" id="ts-by" value="${escAttr(tsByName())}">
      <button class="ho-btn" onclick="tsSelectClean()" title="Tick every pending day that matches the schedule (within 10 min), with no flags, edits or notes, and a break on shifts over 5 hours">✨ Select clean days</button>
      <button class="ho-btn" onclick="tsToggleAll()">${Object.keys(window._tsCollapsed || {}).length ? 'Expand all' : 'Collapse all'}</button>
    </div>
    <div class="tsg-selbar${sel.size ? ' on' : ''}"><b>${sel.size}</b> selected
      <button class="ho-btn primary" onclick="tsBulk(true)" ${sel.size ? '' : 'disabled'}>✓ Approve selected</button>
      <button class="ho-btn" onclick="tsBulk(false)" ${sel.size ? '' : 'disabled'}>Un-approve selected</button>
      ${sel.size ? '<button class="ho-btn" onclick="window._tsSel = new Set(); loadTsPane()">Clear</button>' : ''}
      <span class="spacer"></span><span class="goal-note">${nRows} rows · ${nAppr} approved</span></div>
    <div id="ts-result"></div>
    <div class="ho-card tsg-wrap"><table class="tsg"><thead><tr>
      <th class="tsg-cb"><input type="checkbox" title="Select all in this view" ${allOn ? 'checked' : ''} onchange="tsPick(window._tsRowKeys, this.checked)"></th>
      <th>Name</th><th>Date</th><th>Location</th><th title="The scheduled shift">Shift</th><th>Clock in</th><th>Break</th><th title="Break hours">Brk (h)</th><th title="📧 = set by the staff member from the “forgot to punch out?” email">Clock out</th>
      <th title="Scheduled hours">Sch.</th><th>Worked</th><th title="Worked minus scheduled">Diff.</th><th title="Overtime hours, worked out with the province’s rules (Sunday–Saturday weeks, all studios together)">OT</th><th>Status</th><th title="Flags: late, early…">⚑</th><th>Note</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="16" class="goal-note" style="padding:16px">Nothing in this view.</td></tr>'}</tbody></table></div>`;
}
// Overtime cell: hours at 1.5× and 2× (decimals, like the rest of the sheet)
function tsOtCell(m15, m2, bold) {
  const h = m => (Math.round((Number(m) || 0) / 60 * 100) / 100).toFixed(2);
  const parts = [];
  if (Number(m15) > 0) parts.push(`${bold ? '<b>' : ''}${h(m15)}${bold ? '</b>' : ''}<span class="tsg-x">×1.5</span>`);
  if (Number(m2) > 0) parts.push(`${bold ? '<b>' : ''}${h(m2)}${bold ? '</b>' : ''}<span class="tsg-x">×2</span>`);
  return parts.length ? `<span class="tsg-ot">${parts.join(' ')}</span>` : '';
}
function tsPick(keys, on) { (keys || []).forEach(k => on ? window._tsSel.add(k) : window._tsSel.delete(k)); loadTsPane(); }
async function tsBulk(approve) {
  const items = [...window._tsSel].map(k => { const [staff_id, date] = k.split('|'); return { staff_id, date }; });
  if (!items.length) return;
  if (!confirm(`${approve ? 'Approve' : 'Un-approve'} ${items.length} timesheet row${items.length === 1 ? '' : 's'}?`)) return;
  const { data, error } = await sb.rpc('hub_ts_approve_days', { p_items: items, p_approve: approve, p_by_name: (document.getElementById('ts-by') || {}).value || null });
  if (error) { alert(error.message); return; }
  window._tsSel = new Set();
  await loadTsPane();
  const sk = (data && data.skipped) || [];
  document.getElementById('ts-result').innerHTML = `<div class="me-msg ${sk.length ? 'warn' : 'ok'}" style="margin-bottom:10px">${approve ? 'Approved' : 'Un-approved'} ${data.done}.
    ${sk.length ? `Skipped ${sk.length}: ${sk.map(x => `${esc(x.name)} ${esc(tsDayLabel(x.date))} (${esc(x.why)})`).join('; ')}.` : ''}</div>`;
}
function tsToggle(id) { window._tsCollapsed = window._tsCollapsed || {}; if (window._tsCollapsed[id]) delete window._tsCollapsed[id]; else window._tsCollapsed[id] = 1; loadTsPane(); }
function tsToggleAll() {
  const any = Object.keys(window._tsCollapsed || {}).length;
  window._tsCollapsed = {}; if (!any) (window._tsPeople || []).forEach(x => { window._tsCollapsed[x.staff_id] = 1; });
  loadTsPane();
}
// One day for one person: fix punches, add one, answer notes, approve this day
// One day for one person (home office): edit punch times, remove, add a break or a
// punch, then save with one reason. Then notes, comments, and approve this day.
function tsDaySheet(i, date) {
  const x = (window._tsPeople || [])[i]; if (!x) return;
  _tsPerson = x.staff_id; window._tsDay = date;
  const d = (x.days || []).find(z => z.date === date) || { date, shifts: [], punches: [], notes: [], minutes: { worked: 0, break: 0, open_days: 0 } };
  const studio = ((d.shifts || [])[0] || {}).studio_id || ((d.punches || [])[0] || {}).studio_id || x.home_studio_id || '';
  // the scheduled shift (first start, last end), for "Add punch" / "Add break" defaults
  const shs = (d.shifts || []).filter(z => z.start && z.end);
  const shift = shs.length ? { start: shs.map(z => String(z.start).slice(0, 5)).sort()[0], end: shs.map(z => String(z.end).slice(0, 5)).sort().slice(-1)[0] } : null;
  window._tsEdit = { shift, staff: x.staff_id, date, studio, punches: (d.punches || []).map(p => ({ id: p.id, kind: p.kind, orig: tsHHMM(p.at, p.studio_id || studio), time: tsHHMM(p.at, p.studio_id || studio), remove: false })), adds: [] };
  const appr = d.approval && d.approval.status;
  const tz = tsTz(studio), tzName = tsTzLabel(studio);
  openDutySheet(`<h3>${esc(x.full_name)}</h3>
    <p>${esc(tsDayLabel(date))}${studio ? ' · ' + esc(STUDIO_NAMES[studio] || studio) : ''}${shift ? ` · <span class="ts-shift">🗓 Shift ${esc(shortTime(shift.start))}–${esc(shortTime(shift.end))}</span>` : ' · <span class="ts-shift">no shift scheduled</span>'}${appr === 'approved' ? ` · <span class="tsg-st ok">APPROVED</span>${d.approval.by ? ' by ' + esc(d.approval.by) : ''}` : appr === 'changed' ? ' · <span class="tsg-st need">CHANGED</span>' : ''}</p>
    <div class="tse"><div class="tse-head"><b>Punches</b><span class="goal-note">times are ${esc(tzName)} time</span></div>
      <div id="tse-list"></div>
      <div class="tse-adds"><button class="ho-btn" onclick="tsEditAdd('break')">＋ Add break</button><button class="ho-btn" onclick="tsEditAdd('punch')">＋ Add punch</button></div>
      <label class="tse-why">Why? <span class="goal-note">(optional)</span><input id="tse-why" maxlength="300" placeholder="e.g. Forgot to punch out, left at 5:00 (staff note)"></label>
      <div id="tse-msg"></div>
      <div class="tse-save"><button class="ho-btn primary" onclick="tsEditSave()">Save changes</button></div></div>
    ${tsDayHtml(d, true)}
    <details class="hist-box" id="ts-hist"><summary>🕘 History for this day</summary><div id="ts-hist-body" class="goal-note">Loading…</div></details>
    <div class="sheet-actions">${appr ? `<button onclick="tsDayApprove('${escAttr(x.staff_id)}', '${escAttr(date)}', false)">Un-approve</button>` : ''}<span style="flex:1"></span>
      <button onclick="window._tsDay = null; closeDutySheet()">Done</button>
      ${appr !== 'approved' && (d.punches || []).length ? `<button class="primary" onclick="tsDayApprove('${escAttr(x.staff_id)}', '${escAttr(date)}', true)">✓ Approve this day</button>` : ''}</div>`);
  const sh = document.querySelector('#duty-sheet-back .duty-sheet'); if (sh) sh.classList.add('wide');
  tsEditRender();
  histDayLoad(x.staff_id, date, 'ts-hist-body');
}
// 🕘 Everything that happened to a person's shift and punches on a day (hub_shift_history.sql)
async function histDayLoad(staffId, date, elId) {
  const el = document.getElementById(elId); if (!el) return;
  const { data, error } = await sb.rpc('hub_history_day', { p_staff_id: staffId, p_date: date });
  if (error) { el.innerHTML = esc(/hub_history_day/i.test(error.message) ? 'History isn’t set up yet (hub_shift_history.sql).' : error.message); return; }
  el.innerHTML = (data || []).length ? `<div class="hist-list">${data.map(h => histRow(h)).join('')}</div>`
    : 'Nothing recorded for this day yet. (History starts from when it was switched on.)';
}
function histRow(h, extra) {
  const t = new Date(h.at);
  return `<div class="hist-row"><span class="hist-ic">${h.kind === 'punch' ? '⏱' : '📅'}</span>
    <div class="hist-main"><b>${esc(h.action)}</b>${h.detail ? ` <span>${esc(h.detail)}</span>` : ''}${extra || ''}
      <div class="goal-note">${esc(h.who || '')} · ${esc(t.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div></div></div>`;
}

// ---------- Home office: 🕘 Shift history (hub_history_feed) ----------
let _hist = { from: null, to: null, studio: '', staff: '', kind: '' };
async function openHistPane() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('hist-pane'); setActiveNav('nav-hist');
  if (!_hist.from) { const t = new Date(), f = new Date(); f.setDate(t.getDate() - 7); _hist.from = localDateStr(f); _hist.to = localDateStr(t); }
  if (!_tsStaffList) { const r = await sb.rpc('hub_ts_staff_list'); _tsStaffList = r.error ? [] : (r.data || []); }
  document.getElementById('hist-filters').innerHTML = `
    <label>From <input type="date" id="hf-from" value="${escAttr(_hist.from)}"></label>
    <label>To <input type="date" id="hf-to" value="${escAttr(_hist.to)}"></label>
    <select id="hf-studio"><option value="">All studios</option>${Object.keys(STUDIO_NAMES).sort().map(k => `<option value="${escAttr(k)}"${_hist.studio === k ? ' selected' : ''}>${esc(STUDIO_NAMES[k])}</option>`).join('')}</select>
    <select id="hf-staff"><option value="">Everyone</option>${(_tsStaffList || []).map(p => `<option value="${escAttr(p.staff_id || p.id)}"${_hist.staff === (p.staff_id || p.id) ? ' selected' : ''}>${esc(p.full_name || p.name || p.display_name)}</option>`).join('')}</select>
    <select id="hf-kind"><option value="">Shifts and punches</option><option value="shift"${_hist.kind === 'shift' ? ' selected' : ''}>Shifts only</option><option value="punch"${_hist.kind === 'punch' ? ' selected' : ''}>Punches only</option></select>
    <button class="ho-btn primary" onclick="histApply()">Show</button>`;
  histLoad();
}
function histApply() {
  const v = id => document.getElementById(id).value;
  Object.assign(_hist, { from: v('hf-from'), to: v('hf-to'), studio: v('hf-studio'), staff: v('hf-staff'), kind: v('hf-kind') });
  histLoad();
}
async function histLoad() {
  const box = document.getElementById('hist-body'); box.innerHTML = '<div class="goal-note">Loading…</div>';
  const { data, error } = await sb.rpc('hub_history_feed', { p_from: _hist.from, p_to: _hist.to, p_studio_id: _hist.studio || null, p_staff_id: _hist.staff || null, p_kind: _hist.kind || null });
  if (error) { box.innerHTML = `<div class="goal-note">${esc(/hub_history_feed/i.test(error.message) ? 'History isn’t set up yet: run hub_shift_history.sql.' : error.message)}</div>`; return; }
  const day = d => d ? tsDayLabel(d) : '';
  box.innerHTML = (data || []).length ? `<div class="hist-list">${data.map(g => {
      const one = g.count === 1 && g.items && g.items[0];
      const what = one ? `<span>${esc(one.staff || '')} · ${esc(day(one.date))}${one.detail ? ' · ' + esc(one.detail) : ''}</span>`
        : `<span>${g.count} ${g.kind === 'punch' ? 'punches' : 'shifts'} for ${g.people} ${g.people === 1 ? 'person' : 'people'}${g.from ? ` · ${esc(day(g.from))}${g.to && g.to !== g.from ? ' – ' + esc(day(g.to)) : ''}` : ''}${(g.sample || []).length ? ` · ${esc(g.sample.filter(Boolean).join(', '))}${g.people > (g.sample || []).length ? '…' : ''}` : ''}</span>`;
      return histRow({ kind: g.kind, action: g.action + (g.studio_id ? ` · ${STUDIO_NAMES[g.studio_id] || g.studio_id}` : ''), detail: '', who: g.who, at: g.at }, ' ' + what);
    }).join('')}</div>${data.length >= 500 ? '<div class="goal-note">Showing the latest 500. Narrow the dates, studio or person to see more.</div>' : ''}`
    : '<div class="goal-note">Nothing in this time. (History starts from when it was switched on.)</div>';
}
const TSE_KINDS = [['in', 'Clock in'], ['break_out', 'Break start'], ['break_in', 'Break end'], ['out', 'Clock out']];
function tsEditRender() {
  const e = window._tsEdit, box = document.getElementById('tse-list'); if (!e || !box) return;
  const m = document.getElementById('tse-msg'); if (m) m.innerHTML = '';
  const kindSel = (k, onch) => `<select onchange="${onch}">${TSE_KINDS.map(([v, l]) => `<option value="${v}"${v === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const rows = [
    ...e.punches.map((p, i) => `<div class="tse-row${p.remove ? ' gone' : ''}${!p.remove && p.time !== p.orig ? ' changed' : ''}">
        <span class="tse-kind">${(TSE_KINDS.find(z => z[0] === p.kind) || [0, p.kind])[1]}</span>
        <input type="time" value="${escAttr(p.time)}" ${p.remove ? 'disabled' : ''} onchange="window._tsEdit.punches[${i}].time = this.value; tsEditRender()">
        ${p.time !== p.orig && !p.remove ? `<span class="goal-note">was ${esc(shortTime(p.orig + ':00'))}</span>` : ''}
        <button class="tse-x" title="${p.remove ? 'Keep it' : 'Remove this punch'}" onclick="window._tsEdit.punches[${i}].remove = !window._tsEdit.punches[${i}].remove; tsEditRender()">${p.remove ? '↺' : '✕'}</button></div>`),
    ...e.adds.map((a, i) => `<div class="tse-row new"><span class="tse-kind">${kindSel(a.kind, `window._tsEdit.adds[${i}].kind = this.value; tsEditRender()`)}</span>
        <input type="time" value="${escAttr(a.time)}" onchange="window._tsEdit.adds[${i}].time = this.value; tsEditRender()"><span class="goal-note">new</span>
        <button class="tse-x" title="Don't add" onclick="window._tsEdit.adds.splice(${i}, 1); tsEditRender()">✕</button></div>`)
  ];
  box.innerHTML = rows.join('') || '<div class="goal-note">No punches this day. Add them below.</div>';
}
// Defaults come from the scheduled shift: in at the start, out at the end, and a
// 30-minute break in the middle when the shift is longer than 5 hours.
const tsMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const tsHM = n => { n = ((Math.round(n / 15) * 15) % 1440 + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
function tsMidBreak(sh) { const mid = (tsMin(sh.start) + tsMin(sh.end)) / 2; return [tsHM(mid - 15), tsHM(mid + 15)]; }
function tsEditAdd(what) {
  const e = window._tsEdit; if (!e) return;
  const sh = e.shift;
  const has = k => e.punches.some(p => p.kind === k && !p.remove) || e.adds.some(a => a.kind === k);
  if (what === 'break') {
    const [a, b] = sh ? tsMidBreak(sh) : ['12:00', '12:30'];
    e.adds.push({ kind: 'break_out', time: a }, { kind: 'break_in', time: b });
  } else if (sh && !has('in') && !has('out') && !has('break_out')) {
    // nothing punched: the whole shift, plus a break if it's over 5 hours
    e.adds.push({ kind: 'in', time: sh.start });
    if (tsMin(sh.end) - tsMin(sh.start) > 300) { const [a, b] = tsMidBreak(sh); e.adds.push({ kind: 'break_out', time: a }, { kind: 'break_in', time: b }); }
    e.adds.push({ kind: 'out', time: sh.end });
  } else if (!has('in')) e.adds.push({ kind: 'in', time: sh ? sh.start : '09:00' });
  else if (!has('out')) e.adds.push({ kind: 'out', time: sh ? sh.end : '17:00' });
  else e.adds.push({ kind: 'break_out', time: sh ? tsMidBreak(sh)[0] : '12:00' });
  tsEditRender();
}
// in → (break start → break end)* → out, in time order
function tsEditCheck(list) {
  const seq = list.slice().sort((a, b) => a.time.localeCompare(b.time));
  let state = 'none';
  for (const p of seq) {
    const ok = (state === 'none' && p.kind === 'in') || (state === 'in' && (p.kind === 'break_out' || p.kind === 'out')) || (state === 'break' && p.kind === 'break_in') || (state === 'out' && p.kind === 'in');
    if (!ok) return `${(TSE_KINDS.find(z => z[0] === p.kind) || [0, p.kind])[1]} at ${p.time} doesn’t fit: punches need to go clock in → break start → break end → clock out.`;
    state = p.kind === 'in' || p.kind === 'break_in' ? 'in' : p.kind === 'break_out' ? 'break' : 'out';
  }
  if (state === 'break') return 'A break is started but not ended.';
  return '';
}
async function tsEditSave() {
  const e = window._tsEdit, msg = document.getElementById('tse-msg'); if (!e) return;
  const changed = e.punches.filter(p => p.remove || p.time !== p.orig), adds = e.adds.filter(a => a.time);
  if (!changed.length && !adds.length) { msg.innerHTML = '<div class="me-msg warn">Nothing has changed.</div>'; return; }
  const why = document.getElementById('tse-why').value.trim() || null;   // optional for home office
  const after = [...e.punches.filter(p => !p.remove).map(p => ({ kind: p.kind, time: p.time })), ...adds];
  const problem = tsEditCheck(after);
  if (problem) { msg.innerHTML = `<div class="me-msg err">${esc(problem)}</div>`; return; }
  if (!e.studio) { msg.innerHTML = '<div class="me-msg err">No studio found for this day.</div>'; return; }
  const by = (document.getElementById('ts-by') || {}).value || null;
  msg.innerHTML = '<div class="goal-note">Saving…</div>';
  for (const p of changed) {
    const { error } = await sb.rpc('hub_punch_fix', { p_id: p.id, p_new_time: p.remove ? p.orig : p.time, p_note: why, p_by_name: by, p_remove: p.remove });
    if (error) { msg.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  }
  for (const a of adds) {
    const { error } = await sb.rpc('hub_punch_add', { p_staff_id: e.staff, p_studio_id: e.studio, p_day: e.date, p_kind: a.kind, p_time: a.time, p_note: why, p_by_name: by });
    if (error) { msg.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  }
  tsReopenPerson();
}
async function tsDayApprove(staff, date, on) {
  const { data, error } = await sb.rpc('hub_ts_approve_days', { p_items: [{ staff_id: staff, date }], p_approve: on, p_by_name: (document.getElementById('ts-by') || {}).value || null });
  if (error) { alert(error.message); return; }
  if (data.skipped && data.skipped.length) { alert('Not approved: ' + data.skipped[0].why + '.'); return; }
  window._tsDay = null; closeDutySheet(); loadTsPane();
}
async function tsOpenPerson(i) {
  const x = (window._tsPeople || [])[i]; if (!x) return;
  window._tsDay = null;
  _tsPerson = x.staff_id;
  openDutySheet('<div class="goal-note">Loading…</div>');
  const { data, error } = await sb.rpc('hub_ts_person', { p_staff_id: x.staff_id, p_date: _tsDate });
  if (error) { openDutySheet(`<div class="me-msg err">${esc(error.message)}</div>`); return; }
  const ended = data.period.end < localDateStr(new Date());
  openDutySheet(`<h3>${esc(data.full_name)}</h3><p>${esc(tsPeriodLabel(data.period))} · ${tsStatusPill(data, true)}</p>
    <div class="me-stats"><div class="me-stat"><b>${tsHm(data.totals.worked)}</b><span>worked</span></div><div class="me-stat"><b>${tsHm(data.totals.break)}</b><span>on breaks</span></div></div>
    <div class="goal-note" style="margin:8px 0">Tap a punch to fix it, or ＋ punch to add a missing one.</div>
    <div style="max-height:52vh;overflow:auto">${(data.days || []).map(d => tsDayHtml(d, true)).join('') || '<div class="goal-note">Nothing this period.</div>'}</div>
    <div class="sheet-actions">${data.status === 'approved' ? `<button onclick="tsSet(false)">Un-approve</button>` : ''}<span style="flex:1"></span>
      <button onclick="closeDutySheet()">Close</button>
      ${data.status !== 'approved' && ended ? `<button class="primary" onclick="tsSet(true)">✓ Approve</button>` : ''}</div>`);
  const sheet = document.querySelector('#duty-sheet-back .duty-sheet'); if (sheet) sheet.classList.add('wide');
}
async function tsSet(approve) {
  const { error } = await sb.rpc('hub_ts_set', { p_staff_id: _tsPerson, p_date: _tsDate, p_approve: approve, p_by_name: (document.getElementById('ts-by') || {}).value || null });
  if (error) { alert(error.message); return; }
  closeDutySheet(); loadTsPane();
}
async function tsApproveEasy() {
  const easy = window._tsEasy || [];
  if (!confirm(`Approve ${easy.length} timesheet${easy.length === 1 ? '' : 's'} with no notes, flags or missing punch-outs?`)) return;
  const by = (document.getElementById('ts-by') || {}).value || null;
  for (const x of easy) { const { error } = await sb.rpc('hub_ts_set', { p_staff_id: x.staff_id, p_date: _tsDate, p_approve: true, p_by_name: by }); if (error) { alert(x.full_name + ': ' + error.message); break; } }
  loadTsPane();
}
function tsAnswer(noteId) {
  const a = prompt('Answer for the staff member (e.g. “Fixed: added your punch-out at 5:00”)');
  if (!a) return;
  sb.rpc('hub_ts_answer_note', { p_note_id: noteId, p_answer: a, p_by_name: (document.getElementById('ts-by') || {}).value || null }).then(({ error }) => {
    if (error) { alert(error.message); return; }
    tsReopenPerson();
  });
}
function tsReopenPerson() {
  const day = window._tsDay;
  loadTsPane().then(() => {
    const i = (window._tsPeople || []).findIndex(x => x.staff_id === _tsPerson);
    if (i < 0) return;
    if (day) tsDaySheet(i, day); else tsOpenPerson(i);
  });
}

// ---- Profile (hub_staff_profile.sql): avatar, phone, emergency contact, birthday, password ----
let _meProfile = null, _meAvFolder = null;
async function meLoadProfile(msg) {
  const body = document.getElementById('me-body');
  if (!_meProfile || !msg) body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_my_profile');
  if (error) { body.innerHTML = `<div class="me-msg err">${esc(/hub_my_profile/i.test(error.message) ? 'Profiles aren’t set up yet.' : error.message)}</div>`; return; }
  _meProfile = data;
  body.innerHTML = `${msg || ''}
    <div class="me-card"><h3>Your avatar</h3><div id="me-av-box"></div></div>
    <div class="me-card"><h3>Your details</h3>
      <div class="me-form">
        <label>Email (your login)<input value="${escAttr(data.email || '')}" disabled></label>
        <label>Name you go by<input id="pf-name" maxlength="40" autocomplete="nickname" value="${escAttr(data.preferred_name || '')}" placeholder="${escAttr(String(data.name || '').split(' ')[0])}">
          <span class="me-small" style="font-weight:400">Shown around the Hub (“Hi ${esc(String(data.preferred_name || data.name || 'there').split(' ')[0])}!”). If you also go by a different last name, add it after your first name. Leave empty to use your first name.</span></label>
        <label>Your phone<input id="pf-phone" type="tel" inputmode="tel" autocomplete="tel" value="${escAttr(data.phone || '')}" placeholder="604-555-1234"></label>
        <div class="me-sub-title" style="margin-top:6px">Emergency contact</div>
        <div class="two"><label>Name<input id="pf-ecn" value="${escAttr(data.emergency_contact_name || '')}" placeholder="e.g. Mom"></label>
          <label>Phone<input id="pf-ecp" type="tel" inputmode="tel" value="${escAttr(data.emergency_contact_phone || '')}"></label></div>
        <div class="me-small">Only you and home office can see your phone and emergency contact.</div>
        <button class="ho-btn primary" style="min-height:46px" onclick="meSaveProfile()">Save details</button>
      </div></div>
    ${await mePunchPinCardHtml()}
    <div class="me-card"><h3>Change your password</h3>
      <div class="me-form">
        <label>New password<input id="pf-pw1" type="password" autocomplete="new-password"></label>
        <label>Same again<input id="pf-pw2" type="password" autocomplete="new-password"></label>
        <div class="me-small">At least 8 characters.</div>
        <button class="ho-btn" style="min-height:46px" onclick="meSavePassword()">Change password</button>
      </div></div>`;
  meRenderAvatars();
}
function meRenderAvatars() {
  const box = document.getElementById('me-av-box'); if (!box || !_meProfile) return;
  const files = _meProfile.avatars || [], cur = _meProfile.avatar_key || '';
  const folderOf = k => k.includes('/') ? k.split('/').slice(0, -1).join('/') : '';
  const folders = [...new Set(files.map(folderOf))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
  if (_meAvFolder === null || !folders.includes(_meAvFolder)) _meAvFolder = folders.includes(folderOf(cur)) ? folderOf(cur) : (folders[0] || '');
  const url = k => `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${String(k).split('/').map(encodeURIComponent).join('/')}`;
  box.innerHTML = !files.length ? '<div class="me-small">No avatars to choose from yet.</div>' : `
    ${folders.length > 1 ? `<div class="pf-folders">${folders.map(f => `<button class="${f === _meAvFolder ? 'on' : ''}" onclick="_meAvFolder = ${escAttr(JSON.stringify(f))}; meRenderAvatars()">${esc(f || 'Others')}</button>`).join('')}</div>` : ''}
    <div class="pf-avs">${files.filter(k => folderOf(k) === _meAvFolder).map(k => `<button class="pf-av${k === cur ? ' sel' : ''}" onclick="mePickAvatar(${escAttr(JSON.stringify(k))})"><img loading="lazy" src="${escAttr(url(k))}" alt=""></button>`).join('')}</div>`;
}
async function mePickAvatar(k) {
  const { error } = await sb.rpc('hub_set_my_avatar', { p_key: k });
  if (error) { alert(error.message); return; }
  _meProfile.avatar_key = k;
  if (_me) { _me.avatar_key = k; document.getElementById('me-avatar').innerHTML = hubAvatarHtml(_me, 48); }
  meRenderAvatars();
}
async function meSaveProfile() {
  const v = id => document.getElementById(id).value;
  const { data, error } = await sb.rpc('hub_update_my_profile', { p_phone: v('pf-phone') || null, p_ec_name: v('pf-ecn') || null, p_ec_phone: v('pf-ecp') || null,
    p_preferred_name: v('pf-name') || null });
  if (!error && _me) {   // the greeting follows the new name straight away
    _me.name = String((data && data.preferred_name) || (_meProfile && _meProfile.name) || _me.name || '').split(' ')[0] || _me.name;   // first word = first name
    document.getElementById('me-hi').textContent = `Hi ${_me.name}!`;
  }
  meLoadProfile(error ? `<div class="me-msg err" style="margin-bottom:10px">${esc(error.message)}</div>` : '<div class="me-msg ok" style="margin-bottom:10px">✓ Saved.</div>');
}
async function meSavePassword() {
  const a = document.getElementById('pf-pw1').value, b = document.getElementById('pf-pw2').value;
  const msg = t => meLoadProfile(t);
  if (a.length < 8) { msg('<div class="me-msg err" style="margin-bottom:10px">Your password needs at least 8 characters.</div>'); return; }
  if (a !== b) { msg('<div class="me-msg err" style="margin-bottom:10px">Those two passwords don’t match.</div>'); return; }
  const { error } = await sb.auth.updateUser({ password: a });
  msg(error ? `<div class="me-msg err" style="margin-bottom:10px">${esc(error.message)}</div>` : '<div class="me-msg ok" style="margin-bottom:10px">✓ Your password is changed. Use it next time you sign in.</div>');
}

// ---- Team (coordinators / managers on their own login): sick calls for their studios ----
let _meTeam = null, _meTeamTimer = null;
async function meCheckTeam() {
  const { data, error } = await sb.rpc('hub_mgr_sick_calls', { p_days: 2 });
  if (error || !data || !(data.studios || []).length) { document.getElementById('me-tab-team').style.display = 'none'; return null; }
  _meTeam = data;
  document.getElementById('me-tab-team').style.display = '';
  const waiting = (data.calls || []).filter(sickNeedsPlan).length;
  const b = document.getElementById('me-team-badge');
  b.textContent = waiting; b.style.display = waiting ? '' : 'none';
  return data;
}
async function meLoadTeam(quiet) {
  const body = document.getElementById('me-body');
  if (!quiet) body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const data = await meCheckTeam();
  if (!data) { body.innerHTML = '<div class="me-card">You’re not set up as a manager for any studio.</div>'; return; }
  const calls = data.calls || [];
  const row = c => `<div class="me-shift${sickNeedsPlan(c) ? ' sick' : ''}">
      <div class="me-row"><span class="me-day">🤒 ${esc(c.name)}</span><span class="me-time">${esc(shortTime(c.start_time))} – ${esc(shortTime(c.end_time))}</span></div>
      <div class="me-studio">📍 ${esc(c.studio_name || c.studio_id)} · ${esc(meDateLabel(c.shift_date, localDateStr(new Date())))}</div>
      <div class="me-chips">${c.late ? `<span class="me-chip sick">Late: ${esc(meNum(c.hours_notice))}h notice</span>` : ''}${c.note ? `<span class="me-chip">“${esc(c.note)}”</span>` : ''}</div>
      ${!sickNeedsPlan(c) ? `<div class="me-team" style="color:${c.cover_status === 'asked' ? '#b45309' : '#15803d'}">${c.cover_status === 'asked' ? '⏳' : '✓'} ${c.handled_by_name ? esc(c.handled_by_name) + ': ' : ''}${sickPlanLine(c)}</div>
          <div class="me-actions"><button class="ho-btn" onclick="meSickPlan('${escAttr(c.id)}')">Change plan</button></div>`
        : `<div class="me-actions"><button class="ho-btn primary" onclick="meSickPlan('${escAttr(c.id)}')">I’m on it</button></div>`}
    </div>`;
  const waiting = calls.filter(sickNeedsPlan), done = calls.filter(c => !sickNeedsPlan(c));
  body.innerHTML = `<div class="me-rules" style="margin-bottom:8px">Sick calls for ${esc((data.studios || []).map(id => STUDIO_NAMES[id] || id).join(', '))}, yesterday to 2 days ahead.</div>
    ${waiting.length ? `<div class="me-week">Needs your plan (${waiting.length})</div>${waiting.map(row).join('')}` : '<div class="me-card">Nothing waiting. ✓</div>'}
    ${done.length ? `<div class="me-week">Handled</div>${done.map(row).join('')}` : ''}`;
}
// Same plan sheet as the studio computer, for the manager's own login
async function meSickPlan(id) {
  const c = ((_meTeam && _meTeam.calls) || []).find(x => String(x.id) === String(id));
  if (!c) return;
  _sickPlanCall = c;
  const { data: opts } = await sb.rpc('hub_cover_options', { p_id: c.id });
  const people = (opts || []).sort((a, b) => (a.working_here - b.working_here) || String(a.name).localeCompare(b.name));
  openDutySheet(`<h3>🤒 ${esc(c.name)} is off sick</h3>
    <p>${esc(c.studio_name || '')} · ${esc(ptyDayLabel(c.shift_date))}, ${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))}${c.note ? ' · “' + esc(c.note) + '”' : ''}</p>
    <div class="me-form">
      <label>What’s the plan?<select id="sp-plan" onchange="document.getElementById('sp-cover').style.display = this.value === 'cover' ? '' : 'none'">
        <option value="cover"${c.plan === 'cover' || !c.plan ? ' selected' : ''}>Getting someone to cover</option>
        <option value="cancel"${c.plan === 'cancel' ? ' selected' : ''}>Cancelling classes / bookings</option>
        <option value="as_is"${c.plan === 'as_is' ? ' selected' : ''}>Running the day without them</option></select></label>
      <div id="sp-cover" style="${c.plan && c.plan !== 'cover' ? 'display:none' : ''}">
        <label>Who’s covering?<select id="sp-who"><option value="">Choose…</option>${people.map(o => `<option value="${escAttr(o.staff_id)}"${o.staff_id === c.cover_staff_id ? ' selected' : ''}>${esc(o.name)}${o.working_here ? ' (already working here)' : o.working_elsewhere ? ' (working at ' + esc(STUDIO_NAMES[o.working_elsewhere] || o.working_elsewhere) + ')' : ''}</option>`).join('')}</select></label>
        <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink);margin-top:8px"><input type="checkbox" id="sp-addshift"> They’ve already said yes: add their shift now (${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))})</label>
        <div class="me-small">Otherwise they’ll get an email asking them, and can answer in the Hub.</div>
      </div>
      <label>Note <span style="font-weight:400">(needed if cancelling: which classes or bookings)</span><textarea id="sp-note" maxlength="500">${esc(c.plan_note || '')}</textarea></label>
      <input type="hidden" id="sp-name" value="${escAttr(c.handled_by_name || (_me && _me.name) || '')}">
    </div>
    <div id="sp-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="saveSickPlan()">Save</button></div>`);
}

// ---- Time off and availability ----
async function meLoadRequests() {
  const body = document.getElementById('me-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  let [{ data, error }, files] = await Promise.all([sb.rpc('hub_my_requests_v5'), sb.rpc('hub_my_time_off_files')]);
  if (error && /hub_my_requests_v5/i.test(error.message)) ({ data, error } = await sb.rpc('hub_my_requests'));
  if (error) { body.innerHTML = `<div class="me-msg err">Couldn't load: ${esc(error.message)}</div>`; return; }
  _meReq = data;
  _meFiles = files.error ? null : (files.data || []);   // null = uploads not set up yet
  if (_meTab === 'off') meRenderTimeOff(); else meRenderAvail();
}
// "Ask 14 days ahead for 1–3 days off, 60 days ahead for 4–10 days off"
function meNoticeText(ru) {
  const tiers = Array.isArray(ru.notice_tiers) && ru.notice_tiers.length
    ? [...ru.notice_tiers].sort((a, b) => a.up_to_days - b.up_to_days) : null;
  if (!tiers) return `Ask at least <b>${esc(ru.notice_days)} days</b> ahead`;
  let from = 1;
  const parts = tiers.map(t => {
    const span = from === t.up_to_days ? `${from} day` : `${from}–${t.up_to_days} days`;
    from = t.up_to_days + 1;
    return `<b>${esc(t.notice_days)} days</b> ahead for ${esc(span)} off`;
  });
  return 'Ask ' + parts.join(', ') + (from > 1 ? ` (longer requests: ${esc(tiers[tiers.length - 1].notice_days)} days ahead)` : '');
}
function meFmtDate(ds) { const [y, m, d] = String(ds).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function meAddDays(ds, n) { const [y, m, d] = ds.split('-').map(Number); const x = new Date(y, m - 1, d + n); return localDateStr(x); }
function meTypeLabel(t) {
  if (t.type === 'sick') return t.source === 'staff_sick' ? 'Called in sick' : 'Sick leave';
  if (t.type === 'medical') return 'Medical leave';
  return 'Time off';
}
// BC: 5 paid sick days (sick calls + appointments) after 3 months, then 3 unpaid job-protected days (sick calls only)
function meSickText(sl, today) {
  if (sl.applies === undefined) return `<br>Sick leave (medical appointments): <b>${meNum(sl.used)} of ${esc(sl.allowance)}</b> days used`;
  if (Number(sl.paid_days) === 0) {   // ON / AB: unpaid, job-protected days only
    const un = Number(sl.unpaid_days || 3), used = Number(sl.used || 0);
    return `<br><b>Sick days:</b> <b>${meNum(Math.min(used, un))} of ${un}</b> unpaid, job-protected sick days used, for calling in sick.`;
  }
  const notYet = sl.eligible_on && today < sl.eligible_on;
  const paid = Number(sl.paid_days || 5), unpaid = Number(sl.unpaid_days || 3), used = Number(sl.used || 0);
  return `<br><b>Sick days:</b> ${notYet
      ? `paid sick days start after 3 months, on <b>${esc(meFmtDate(sl.eligible_on))}</b>. Until then, sick days are unpaid.`
      : `<b>${meNum(Math.min(used, paid))} of ${paid}</b> paid sick days used${used > paid ? `, and <b>${meNum(Math.min(used - paid, unpaid))} of ${unpaid}</b> unpaid` : ''}.`}
    Paid sick days cover calling in sick and medical appointments. After the ${paid} paid days, you also have <b>${unpaid} unpaid, job-protected</b> sick days for calling in sick.`;
}
function meNum(n) { n = Number(n || 0); return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''); }
function meRenderTimeOff(msg) {
  const R = _meReq, ru = R.rules || {}, T = R.tally || {};
  const used = Number(T.approved || 0) + Number(T.pending || 0), allow = Number(T.allowance || 10);
  const over = used > allow;
  const pct = Math.min(100, Math.round(used / Math.max(allow, 1) * 100));
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  const wkThisQ = ((T.weekend_days || T.weekends || []).find(w => w.quarter === q) || {}).used || 0;
  const wkMax = ru.weekend_days_per_quarter ?? 2;
  const blackouts = (R.blackouts || []).map(b => `<li><b>${esc(b.label)}</b> (${esc(meFmtDate(b.start_date))} – ${esc(meFmtDate(b.end_date))})${b.mode === 'block' ? ': no time off' : ': needs a good reason'}${b.note ? ' · ' + esc(b.note) : ''}</li>`).join('');
  const list = (R.time_off || []).filter(t => t.type !== 'sick' || t.end_date >= R.today || t.status === 'pending').map(t => {
    const dates = t.start_date === t.end_date ? meFmtDate(t.start_date) : `${meFmtDate(t.start_date)} – ${meFmtDate(t.end_date)}`;
    const times = t.start_time ? ` · ${shortTime(t.start_time)}–${shortTime(t.end_time)}` : '';
    const flags = (t.flags || []).length && t.status === 'pending' ? `<div>⚑ ${esc(t.flags.join(' · '))}</div>` : '';
    const files = t.type === 'medical' && _meFiles ? _meFiles.filter(f => String(f.time_off_id) === String(t.id)) : [];
    const needNote = t.needs_doctor_note ? '<div style="color:#b91c1c;font-weight:700;font-size:12.5px;margin-top:4px">📎 Doctor’s note needed</div>' : '';
    const fileHtml = (needNote) + (t.type === 'medical' && _meFiles ? `<div class="me-files">${files.map(f => `<button class="me-file" onclick="meOpenFile('${escAttr(f.path)}')">📎 ${esc(f.file_name || 'Doctor’s note')}</button>`).join('')}
        ${!['denied', 'cancelled'].includes(t.status) ? `<label class="me-file add">＋ Add doctor’s note<input type="file" accept="application/pdf,image/*" style="display:none" onchange="meUploadNote('${escAttr(t.id)}', this)"></label>` : ''}</div>` : '');
    return `<div class="me-list-row"><div class="what"><b>${esc(dates)}</b>${esc(times)}<div>${esc(meTypeLabel(t))}${t.note ? ' · ' + esc(t.note) : ''}</div>${flags}${fileHtml}</div>
      <span class="me-pill ${esc(t.status)}">${esc(t.status === 'pending' ? 'waiting' : t.status)}</span>
      ${t.status === 'pending' ? `<button class="ho-btn" onclick="meCancelOff('${escAttr(t.id)}')">Cancel</button>` : ''}</div>`;
  }).join('');
  const sickLeave = T.sick_leave;
  const tiers = (Array.isArray(ru.notice_tiers) ? [...ru.notice_tiers] : []).sort((x, y) => x.up_to_days - y.up_to_days);
  let from = 1;
  const noticeRows = tiers.map(t => { const span = from === t.up_to_days ? `${from} day` : `${from}–${t.up_to_days} days`; from = t.up_to_days + 1;
    return `<div class="nt-row"><span>${esc(span)} off</span><b>${esc(t.notice_days)} days ahead</b></div>`; }).join('');
  // sick days box (BC: paid then unpaid; ON / AB: unpaid only)
  let sickBox = '';
  if (sickLeave && sickLeave.applies !== undefined) {
    const paid = Number(sickLeave.paid_days ?? 0), unpaid = Number(sickLeave.unpaid_days ?? 0), su = Number(sickLeave.used || 0);
    const notYet = sickLeave.eligible_on && R.today < sickLeave.eligible_on;
    const head = paid > 0 ? `<b>${meNum(Math.min(su, paid))}</b> of <b>${paid}</b> paid sick days` : `<b>${meNum(Math.min(su, unpaid))}</b> of <b>${unpaid}</b> unpaid sick days`;
    const pctS = Math.min(100, Math.round((paid > 0 ? Math.min(su, paid) / paid : Math.min(su, unpaid) / Math.max(unpaid, 1)) * 100));
    sickBox = `<div class="me-sub">
      <div class="me-sub-title">🤒 Sick days</div>
      ${notYet ? `<div class="me-line">Paid sick days start <b>${esc(meFmtDate(sickLeave.eligible_on))}</b> (after 3 months).</div>`
               : `<div class="me-line">${head}${paid > 0 && su > paid ? ` · <b>${meNum(Math.min(su - paid, unpaid))}</b> of ${unpaid} unpaid` : ''}</div>
                  <div class="me-bar thin"><span style="width:${pctS}%"></span></div>`}
      <div class="me-small">${paid > 0 ? `Paid days are for calling in sick and medical appointments. Then <b>${unpaid} unpaid, job-protected</b> days for calling in sick.` : 'Job-protected, for calling in sick.'}</div>
    </div>`;
  }
  const blk = (R.blackouts || []).map(b => `<span class="me-tag">${b.mode === 'block' ? '⛔' : '⚠️'} ${esc(b.label)}: ${esc(meFmtDate(b.start_date))} – ${esc(meFmtDate(b.end_date))}</span>`).join('');
  document.getElementById('me-body').innerHTML = `
    ${msg || ''}
    <div class="me-card">
      <div class="me-card-head"><h3>Your ${esc(T.year || '')} time off</h3></div>
      <div class="me-tally"><b>${meNum(used)}</b> of <b>${meNum(allow)}</b> days used</div>
      <div class="me-bar"><span style="width:${pct}%;${over ? 'background:#dc2626' : ''}"></span></div>
      ${T.pending > 0 ? `<div class="me-small">${meNum(T.pending)} day${Number(T.pending) === 1 ? '' : 's'} waiting for approval</div>` : ''}
      <div class="me-stats">
        <div class="me-stat"><b>${meNum(T.upcoming)}</b><span>coming up</span></div>
        <div class="me-stat"><b>${wkThisQ} of ${esc(wkMax)}</b><span>weekend days this quarter</span></div>
      </div>
      ${over ? `<div class="me-msg err" style="margin-top:10px">You’re over your ${meNum(allow)} days for this year, so new requests may not be approved.</div>` : ''}
      ${sickBox}
      <div class="me-star">* Vacation pay is added to every pay cheque. It’s up to you to set it aside for your time off.</div>
    </div>
    <div class="me-card"><h3>Ask for time off</h3>
      ${noticeRows ? `<div class="me-sub-title" style="margin-top:2px">How much notice</div><div class="nt">${noticeRows}</div>` : ''}
      ${ru.notice_mode === 'block' ? '<div class="me-small">Less notice than this can’t be sent. Talk to your manager.</div>' : ''}
      <details class="me-more"><summary>Good to know</summary>
        <ul class="me-list">
          <li>📅 <b>${meNum(ru.annual_days)} days</b> off a year (<b>${meNum(ru.annual_days_senior)}</b> after ${esc(ru.senior_years)} years)</li>
          <li>🗓️ Up to <b>${esc(wkMax)} weekend days</b> (Sat or Sun) off each quarter</li>
          <li>⏱️ A part day counts as <b>½ day</b> if you’re scheduled that day</li>
          <li>🩺 <b>Medical leave</b> (surgery, longer health needs) needs a note and doesn’t use your time off</li>
          <li>🤒 Sick on the day? Use <b>Call in sick</b> on My shifts</li>
        </ul>
      </details>
      ${blk ? `<div class="me-sub-title">Busy times</div><div class="me-tags">${blk}</div>` : ''}
      <div class="me-form" style="margin-top:14px">
        <label>What for<select id="me-off-type" onchange="mePreviewOff()"><option value="time_off">Time off</option>${sickLeave && Number(sickLeave.paid_days ?? 5) > 0 ? '<option value="sick_leave">Sick day (medical appointment)</option>' : ''}<option value="medical_leave">Medical leave (note needed)</option></select></label>
        <div class="two"><label>First day<input type="date" id="me-off-start" min="${escAttr(R.today)}" onchange="const e=document.getElementById('me-off-end'); if(!e.value||e.value<this.value) e.value=this.value; mePreviewOff()"></label>
          <label>Last day<input type="date" id="me-off-end" min="${escAttr(R.today)}" onchange="mePreviewOff()"></label></div>
        <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink)"><input type="checkbox" id="me-off-part" onchange="document.getElementById('me-off-times').style.display=this.checked?'flex':'none'; mePreviewOff()"> Only part of one day</label>
        <div class="two" id="me-off-times" style="display:none"><label>From<input type="time" id="me-off-from" step="900"></label><label>Until<input type="time" id="me-off-until" step="900"></label></div>
        <div id="me-off-preview"></div>
        <label><span id="me-off-note-label">Note for your manager (optional)</span><textarea id="me-off-note" maxlength="500" placeholder="e.g. Family wedding"></textarea></label>
        <label id="me-off-file-row" style="display:none">Doctor’s note (optional — you can also add it later)<input type="file" id="me-off-file" accept="application/pdf,image/*">
          <span class="me-rules" style="font-weight:400">A PDF or a photo, up to 10 MB. Only you and home office can see it.</span></label>
        <button class="ho-btn primary" style="min-height:48px" onclick="meRequestOff()">Send request</button>
      </div></div>
    <div class="me-card"><h3>Your requests</h3>${list || '<div class="me-rules">No time off requests yet.</div>'}</div>`;
}
// Live check as dates are picked: notice, and whether it would go over the year's days
function mePreviewOff() {
  const box = document.getElementById('me-off-preview'); if (!box) return;
  const R = _meReq, ru = R.rules || {}, T = R.tally || {};
  const st = document.getElementById('me-off-start').value, en = document.getElementById('me-off-end').value || st;
  const kind = document.getElementById('me-off-type').value, sick = kind === 'sick_leave';
  const lbl = document.getElementById('me-off-note-label');
  const fr = document.getElementById('me-off-file-row'); if (fr) fr.style.display = kind === 'medical_leave' && _meFiles ? '' : 'none';
  if (lbl) lbl.textContent = kind === 'medical_leave' ? 'Note for your manager (needed: what it’s for, and when you expect to be back)' : 'Note for your manager (optional)';
  if (!st || en < st) { box.innerHTML = kind === 'medical_leave' ? '<div class="me-msg warn">Medical leave goes to your manager to approve. It doesn’t need 14 or 60 days’ notice and doesn’t use your time off.</div>' : ''; return; }
  const part = document.getElementById('me-off-part').checked;
  if (kind === 'medical_leave') {
    const need = Number(ru.medical_note_required_over_days ?? 5);
    const daysM = Math.round(((d => { const [y, m, dd] = en.split('-').map(Number); return new Date(y, m - 1, dd); })() - (d => { const [y, m, dd] = st.split('-').map(Number); return new Date(y, m - 1, dd); })()) / 86400000) + 1;
    const lbl2 = document.getElementById('me-off-file-row');
    if (lbl2) lbl2.firstChild.textContent = daysM > need ? `Doctor’s note (needed for more than ${need} days)` : 'Doctor’s note (optional — you can also add it later)';
    box.innerHTML = `<div class="me-msg warn">Medical leave goes to your manager to approve. It doesn’t need 14 or 60 days’ notice and doesn’t use your time off.${daysM > need ? ` <b>Leave longer than ${need} days needs a doctor’s note</b>, attached below.` : ''}</div>`;
    return;
  }
  const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const days = Math.round((toD(en) - toD(st)) / 86400000) + 1;
  // a part day counts ½ only if they're on a shift that day (shifts already loaded on My shifts)
  const onShift = (_meShifts || []).some(x => x.shift_date === st);
  const count = part ? (onShift ? 0.5 : 0) : days;
  const msgs = [];
  if (sick) {
    const sl = T.sick_leave || { used: 0, paid_days: 5, unpaid_days: 3 };
    const paid = Number(sl.paid_days ?? sl.allowance ?? 5), unpaid = Number(sl.unpaid_days ?? 0), used = Number(sl.used || 0);
    if (paid === 0) { if (used + count > unpaid) msgs.push(['err', `That’s more than your ${unpaid} unpaid, job-protected sick days for the year. Ask for time off or medical leave instead.`]);
      else msgs.push(['warn', `Unpaid, job-protected sick day (${meNum(used + count)} of ${unpaid} this year).`]); }
    else if (sl.eligible_on && st < sl.eligible_on) msgs.push(['err', `Paid sick days start on ${meFmtDate(sl.eligible_on)}. Ask for time off instead.`]);
    // appointments can only use PAID sick days (unpaid ones are for calling in sick)
    else if (used + count > paid) msgs.push(['err', `That’s more than your ${paid} paid sick days for this year (you’ve used ${meNum(used)}), and appointments can only use paid sick days. Ask for time off instead.`]);
    else msgs.push(['ok', `Paid sick day (${meNum(used + count)} of ${paid} this year).`]);
  } else {
    const tiers = (ru.notice_tiers || []).slice().sort((a, b) => a.up_to_days - b.up_to_days);
    const tier = tiers.find(t => days <= t.up_to_days) || tiers[tiers.length - 1];
    const ahead = Math.round((toD(st) - toD(R.today)) / 86400000);
    if (tier && ahead < tier.notice_days) msgs.push([ru.notice_mode === 'block' ? 'err' : 'warn', `${days} day${days === 1 ? '' : 's'} off needs ${tier.notice_days} days’ notice, and this is ${ahead} days away.${ru.notice_mode === 'block' ? ' It won’t be accepted.' : ''}`]);
    const sameYear = st.slice(0, 4) === String(T.year);
    const used = Number(T.approved || 0) + Number(T.pending || 0);
    if (sameYear && used + count > Number(T.allowance)) msgs.push(['warn', `This brings you to ${meNum(used + count)} of ${meNum(T.allowance)} days for ${T.year}. You can still send it, but you’re over your time off for the year, so it may not be approved.`]);
  }
  box.innerHTML = msgs.map(([k, t]) => `<div class="me-msg ${k}">${esc(t)}</div>`).join('');
}
async function meRequestOff() {
  const v = id => document.getElementById(id).value;
  const part = document.getElementById('me-off-part').checked;
  // long medical leave needs a doctor's note before it can be sent
  if (v('me-off-type') === 'medical_leave') {
    const need = Number(((_meReq || {}).rules || {}).medical_note_required_over_days ?? 5);
    const st = v('me-off-start'), en = v('me-off-end') || st;
    if (st) {
      const days = Math.round((new Date(en + 'T12:00') - new Date(st + 'T12:00')) / 86400000) + 1;
      const f = document.getElementById('me-off-file');
      if (days > need && !(f && f.files && f.files[0])) {
        const box = document.getElementById('me-body');
        box.insertAdjacentHTML('afterbegin', `<div class="me-msg err" style="margin-bottom:10px">Medical leave longer than ${need} days needs a doctor’s note. Attach it below, then send.</div>`);
        box.scrollIntoView({ behavior: 'smooth' }); return;
      }
    }
  }
  const args = {
    p_start: v('me-off-start') || null, p_end: v('me-off-end') || v('me-off-start') || null,
    p_start_time: part ? v('me-off-from') || null : null, p_end_time: part ? v('me-off-until') || null : null,
    p_type: v('me-off-type'), p_note: v('me-off-note') || null };
  let { data, error } = await sb.rpc('hub_request_time_off_v5', args);
  if (error && /hub_request_time_off_v5/i.test(error.message)) ({ data, error } = await sb.rpc('hub_request_time_off', args));
  if (error) { const box = document.getElementById('me-body'); box.insertAdjacentHTML('afterbegin', `<div class="me-msg err" style="margin-bottom:10px">${esc(error.message)}</div>`); box.scrollIntoView({ behavior: 'smooth' }); return; }
  const fileEl = document.getElementById('me-off-file');
  let upMsg = '';
  if (v('me-off-type') === 'medical_leave' && fileEl && fileEl.files && fileEl.files[0]) {
    const err = await meUploadFile(data.id, fileEl.files[0]);
    upMsg = err ? `<div class="me-msg err" style="margin-bottom:10px">The request was sent, but the doctor’s note didn’t upload: ${esc(err)} You can add it from “Your requests”.</div>` : '';
  }
  await meLoadRequests();
  meRenderTimeOff(upMsg + (data.over_allowance
    ? '<div class="me-msg err" style="margin-bottom:10px">Request sent, but you’re over your time off for the year, so it may not be approved. Your manager has been told.</div>'
    : (data.flags || []).length
      ? `<div class="me-msg warn" style="margin-bottom:10px">Request sent. Your manager will take a closer look because: ${esc(data.flags.join('; '))}.</div>`
      : '<div class="me-msg ok" style="margin-bottom:10px">Request sent. You’ll see it here as approved or not once your manager has looked at it.</div>'));
}
// Doctor's notes: private bucket, own folder (<staff_id>/<request id>/…), then recorded on the request.
async function meUploadFile(timeOffId, file) {
  const okType = /^(application\/pdf|image\/)/.test(file.type || '') || /\.(pdf|heic|heif|jpe?g|png|webp)$/i.test(file.name);
  if (!okType) return 'Choose a PDF or a photo.';
  if (file.size > 10 * 1024 * 1024) return 'That file is bigger than 10 MB.';
  const safe = String(file.name || 'note').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${_me.staff_id}/${timeOffId}/${Date.now()}-${safe}`;
  const up = await sb.storage.from(MED_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) return up.error.message;
  const at = await sb.rpc('hub_attach_time_off_file', { p_time_off_id: String(timeOffId), p_path: path, p_file_name: file.name || safe, p_size: file.size });
  if (at.error) { await sb.storage.from(MED_BUCKET).remove([path]); return at.error.message; }
  return null;
}
async function meUploadNote(timeOffId, input) {
  const file = input.files && input.files[0]; if (!file) return;
  input.closest('label').firstChild.textContent = 'Uploading… ';
  const err = await meUploadFile(timeOffId, file);
  await meLoadRequests();
  meRenderTimeOff(err ? `<div class="me-msg err" style="margin-bottom:10px">The doctor’s note didn’t upload: ${esc(err)}</div>`
                      : '<div class="me-msg ok" style="margin-bottom:10px">Doctor’s note added. Only you and home office can see it.</div>');
}
async function meOpenFile(path) {
  const { data, error } = await sb.storage.from(MED_BUCKET).createSignedUrl(path, 300);   // 5-minute link
  if (error || !data) { alert('Couldn’t open the file: ' + (error ? error.message : '')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}
async function meCancelOff(id) {
  if (!confirm('Cancel this request?')) return;
  const { error } = await sb.rpc('hub_cancel_time_off', { p_id: String(id) });
  if (error) { alert(error.message); return; }
  meLoadRequests();
}
function meRenderAvail(msg) {
  const R = _meReq, ru = R.rules || {};
  const earliest = meAddDays(R.today, ru.unavailability_notice_days || 0);
  const list = (R.unavailability || []).map(u => `<div class="me-list-row"><div class="what"><b>${esc(DOW_NAMES[u.day_of_week] || '')}s</b> · ${u.start_time ? esc(shortTime(u.start_time) + '–' + shortTime(u.end_time)) : 'all day'}
      <div>From ${esc(meFmtDate(u.effective_from))}${u.effective_to ? ' until ' + esc(meFmtDate(u.effective_to)) : ''}</div></div>
      <button class="ho-btn" onclick="meEndUnavail('${escAttr(u.id)}')">Remove</button></div>`).join('');
  document.getElementById('me-body').innerHTML = `
    ${msg || ''}
    <div class="me-card"><h3>When you can’t work</h3>
      <div class="me-rules">Times you’re regularly not available on weekdays (for example, school on Tuesday mornings). The schedule is built around these.
        Each one needs an end date, up to 6 months away, and has to repeat at least ${esc(ru.unavail_min_repeats || 2)} weeks (for a single day, ask for time off).
        New ones start at least <b>${esc(ru.unavailability_notice_days)} days</b> from today so posted schedules don’t change; removing one works right away.
        ${ru.unavail_weekends_allowed ? '' : '<br><b>Saturdays and Sundays:</b> being available on weekends is part of the job, so they can’t be set here. Talk to your manager if something special comes up.'}</div>
      <div style="margin-top:8px">${list || '<div class="me-rules">Nothing yet: you’re shown as available any time.</div>'}</div></div>
    <div class="me-card"><h3>Add a time you can’t work</h3>
      <div class="me-form">
        <label>Day<select id="me-un-dow">${(ru.unavail_weekends_allowed ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5]).map(i => `<option value="${i}">${DOW_NAMES[i]}s</option>`).join('')}</select></label>
        <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink)"><input type="checkbox" id="me-un-allday" checked style="min-height:auto" onchange="document.getElementById('me-un-times').style.display=this.checked?'none':'flex'"> All day</label>
        <div class="two" id="me-un-times" style="display:none"><label>From<input type="time" id="me-un-from" step="900"></label><label>Until<input type="time" id="me-un-until" step="900"></label></div>
        <div class="two"><label>Starting<input type="date" id="me-un-start" min="${escAttr(earliest)}" value="${escAttr(earliest)}" onchange="const e=document.getElementById('me-un-end'); e.min=this.value; e.max=meAddDays(this.value, ${Number(ru.unavail_max_days || 183)})"></label>
          <label>Until<input type="date" id="me-un-end" min="${escAttr(earliest)}" max="${escAttr(meAddDays(earliest, Number(ru.unavail_max_days || 183)))}" required></label></div>
        <button class="ho-btn primary" style="min-height:46px" onclick="meAddUnavail()">Save</button>
      </div></div>`;
}
async function meAddUnavail() {
  const v = id => document.getElementById(id).value;
  const all = document.getElementById('me-un-allday').checked;
  const { error } = await sb.rpc('hub_add_unavailability', { p_day_of_week: Number(v('me-un-dow')),
    p_start_time: all ? null : v('me-un-from') || null, p_end_time: all ? null : v('me-un-until') || null,
    p_effective_from: v('me-un-start') || null, p_effective_to: v('me-un-end') || null });
  if (error) { document.getElementById('me-body').insertAdjacentHTML('afterbegin', `<div class="me-msg err" style="margin-bottom:10px">${esc(error.message)}</div>`); document.getElementById('me-body').scrollIntoView({ behavior: 'smooth' }); return; }
  await meLoadRequests(); meRenderAvail('<div class="me-msg ok" style="margin-bottom:10px">Saved.</div>');
}
async function meEndUnavail(id) {
  if (!confirm('Remove this? You’ll be shown as available at that time from today.')) return;
  const { error } = await sb.rpc('hub_end_unavailability', { p_id: String(id) });
  if (error) { alert(error.message); return; }
  meLoadRequests();
}

// ---- Sick calls on the studio Hub (Who's working + coordinator Notifications) ----
let _sickToday = {};   // staff_id → sick call, today at this studio
async function loadSickCalls(studioId, days) {
  const { data, error } = await sb.rpc('hub_studio_sick_calls', { p_studio_id: studioId || null, p_days: days || 0 });
  return error ? [] : (data || []);
}

// ---- Emails (hub-notify Edge Function). Best effort: the Hub still shows everything. ----
async function hubNotify(body) {
  try { await fetch(`${SUPABASE_URL}/functions/v1/hub-notify`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify(body) }); }
  catch (e) { console.warn('Email not sent:', e); }
}
function sickNeedsPlan(c) { return c.needs_plan !== undefined ? !!c.needs_plan : !c.plan; }

// ---- The manager's plan for a sick call ----
const SICK_PLANS = { cover: 'Getting cover', cancel: 'Cancelling classes / bookings', as_is: 'Running the day without them' };
function sickPlanLine(c) {
  if (!c.plan) return '';
  if (c.plan === 'cover' && c.cover_status === 'asked') return `Asked ${esc(c.cover_name || 'someone')} to cover, waiting for their answer`;
  if (c.plan === 'cover' && c.cover_status === 'declined') return `${esc(c.cover_name || 'They')} can’t cover. Needs a new plan`;
  return `${esc(SICK_PLANS[c.plan] || c.plan)}${c.plan === 'cover' && c.cover_name ? ': ' + esc(c.cover_name) + (c.cover_shift_added ? ' ✓' : '') : ''}${c.plan_note ? ' · “' + esc(c.plan_note) + '”' : ''}`;
}
function sickAlertHtml(c, p) {
  const shift = p ? p.shifts.map(s => shortTime(s.start) + '–' + shortTime(s.end)).join(', ') : shortTime(c.start_time) + '–' + shortTime(c.end_time);
  if (c.plan && !sickNeedsPlan(c)) return `<div class="sick-alert ${c.cover_status === 'asked' ? 'wait' : 'done'}">🤒 <b>${esc(c.name)}</b> is off sick (${esc(shift)}). ${c.cover_status === 'asked' ? '⏳' : '✓'} ${c.handled_by_name ? esc(c.handled_by_name) + ': ' : ''}${sickPlanLine(c)}</div>`;
  return `<div class="sick-alert">🤒 <b>${esc(c.name)}</b> called in sick for ${esc(shift)}${c.late ? ` <span class="pf-status need">late: ${esc(meNum(c.hours_notice))}h notice</span>` : ''}. ${c.cover_status === 'declined' ? esc(c.cover_name || 'The person asked') + ' can’t cover. Needs a new plan.' : 'Needs a manager’s plan.'}
    <button class="ho-btn" style="min-height:32px;margin-left:6px" onclick="openSickPlan('${escAttr(c.id)}')">I’m on it</button></div>`;
}
let _sickPlanCall = null;
async function openSickPlan(id) {
  if (!coordOrAdmin()) { openPinModal(); return; }
  const all = await loadSickCalls(_sessionStudioId, 3);
  const c = all.find(x => String(x.id) === String(id));
  if (!c) { alert('That sick call wasn’t found.'); return; }
  _sickPlanCall = c;
  const { data: opts } = await sb.rpc('hub_cover_options', { p_id: c.id });
  const people = (opts || []).sort((a, b) => (a.working_here - b.working_here) || String(a.name).localeCompare(b.name));
  const who = (_lastHeroData && _sessionPin && _lastHeroData.firstName && _lastHeroData.firstName !== 'team') ? _lastHeroData.firstName : '';
  openDutySheet(`<h3>🤒 ${esc(c.name)} is off sick</h3>
    <p>${esc(ptyDayLabel(c.shift_date))}, ${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))}${c.note ? ' · “' + esc(c.note) + '”' : ''}</p>
    <div class="me-form">
      <label>What’s the plan?<select id="sp-plan" onchange="document.getElementById('sp-cover').style.display = this.value === 'cover' ? '' : 'none'">
        <option value="cover"${c.plan === 'cover' || !c.plan ? ' selected' : ''}>Getting someone to cover</option>
        <option value="cancel"${c.plan === 'cancel' ? ' selected' : ''}>Cancelling classes / bookings</option>
        <option value="as_is"${c.plan === 'as_is' ? ' selected' : ''}>Running the day without them</option></select></label>
      <div id="sp-cover" style="${c.plan && c.plan !== 'cover' ? 'display:none' : ''}">
        <label>Who’s covering?<select id="sp-who"><option value="">Choose…</option>${people.map(o => `<option value="${escAttr(o.staff_id)}"${o.staff_id === c.cover_staff_id ? ' selected' : ''}>${esc(o.name)}${o.working_here ? ' (already working here)' : o.working_elsewhere ? ' (working at ' + esc(STUDIO_NAMES[o.working_elsewhere] || o.working_elsewhere) + ')' : ''}</option>`).join('')}</select></label>
        <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink);margin-top:8px"><input type="checkbox" id="sp-addshift"> They’ve already said yes: add their shift now (${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))})</label>
        <div class="me-small">Otherwise they’ll get an email asking them, and can answer in the Hub.</div>
      </div>
      <label>Note <span style="font-weight:400">(needed if cancelling: which classes or bookings)</span><textarea id="sp-note" maxlength="500">${esc(c.plan_note || '')}</textarea></label>
      <label>Your name<input id="sp-name" value="${escAttr(c.handled_by_name || who)}" placeholder="So home office knows who has it"></label>
    </div>
    <div id="sp-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="saveSickPlan()">Save</button></div>`);
}
async function saveSickPlan() {
  const c = _sickPlanCall; if (!c) return;
  const v = id => document.getElementById(id).value;
  const plan = v('sp-plan');
  const confirmed = plan === 'cover' && document.getElementById('sp-addshift').checked;
  let error = null;
  if (plan === 'cover' && !confirmed) {
    // ask them: request + email
    if (!v('sp-who')) { document.getElementById('sp-msg').innerHTML = '<div class="me-msg err">Choose who to ask.</div>'; return; }
    const r = await sb.rpc('hub_ask_cover', { p_sick_call_id: c.id, p_staff_id: v('sp-who'), p_handled_by: v('sp-name') || null });
    error = r.error;
    if (!error && r.data && r.data.request_id) hubNotify({ type: 'cover_request', request_id: r.data.request_id });
  } else {
    ({ error } = await sb.rpc('hub_sick_plan', { p_id: c.id, p_plan: plan, p_note: v('sp-note') || null, p_handled_by: v('sp-name') || null,
      p_cover_staff_id: plan === 'cover' ? (v('sp-who') || null) : null, p_add_cover_shift: confirmed }));
  }
  if (error) { document.getElementById('sp-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet();
  if (_me) { meLoadTeam(); return; }
  loadTeamToday(_sessionStudioId);
  if (paneVisible('notif-pane')) loadNotifPane();
  if (paneVisible('sick-pane')) loadSickPane();
  refreshCoordBadges();
}
// Home office: every studio's sick calls
async function openSickPane() {
  if (!(_studioData && _studioData.isAdmin)) return;
  showOnlyPane('sick-pane'); setActiveNav('nav-sick');
  loadSickPane();
}
async function loadSickPane() {
  const body = document.getElementById('sick-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_all_sick_calls', { p_days: 3 });
  if (error) { body.innerHTML = `<div class="ho-card">Couldn't load: ${esc(error.message)}${/hub_all_sick_calls/i.test(error.message) ? ' (run hub_staff_rules_v5.sql first)' : ''}</div>`; return; }
  const row = c => `<div class="ntf${sickNeedsPlan(c) ? ' cancel' : ''}"><span class="ic">${sickNeedsPlan(c) ? '🤒' : c.cover_status === 'asked' ? '⏳' : '✅'}</span><div class="bd">
      <div class="tt">${esc(c.name)} · ${esc(c.studio_name || c.studio_id)}</div>
      <div class="mt">${esc(ptyDayLabel(c.shift_date))} · ${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))}${c.late ? ` · ⚠️ late (${esc(meNum(c.hours_notice))}h notice)` : ''}${c.note ? ' · “' + esc(c.note) + '”' : ''}</div>
      ${!sickNeedsPlan(c) ? `<div class="mt" style="color:${c.cover_status === 'asked' ? '#b45309' : '#15803d'}">${c.handled_by_name ? esc(c.handled_by_name) + ': ' : ''}${sickPlanLine(c)}</div>` : `<div class="mt" style="color:#b91c1c;font-weight:700">${c.cover_status === 'declined' ? esc(sickPlanLine(c)) : 'Waiting for a manager’s plan'}</div>`}</div>
      <span class="tm">${esc(relTime(c.created_at))}</span></div>`;
  const waiting = (data || []).filter(sickNeedsPlan), done = (data || []).filter(c => !sickNeedsPlan(c));
  body.innerHTML = `${waiting.length ? `<div class="ho-section-head">Waiting for a manager (${waiting.length})</div>${waiting.map(row).join('')}` : '<div class="ho-card">Nothing waiting — every sick call has a plan. ✓</div>'}
    ${done.length ? `<div class="ho-section-head">Handled (${done.length})</div>${done.map(row).join('')}` : ''}`;
}

// ---- Home office: request rules ----
async function openRulesPane() {
  if (!_hoCan.view) return;
  showOnlyPane('rules-pane'); setActiveNav('nav-rules');
  const body = document.getElementById('rules-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const [r, b] = await Promise.all([sb.from('staff_request_rules').select('*').eq('id', 1).maybeSingle(), sb.from('time_off_blackouts').select('*').order('start_date')]);
  if (r.error) { body.innerHTML = `<div class="ho-card">Couldn't load the rules: ${esc(r.error.message)}. Run hub_staff_portal.sql first.</div>`; return; }
  const ru = r.data || {}, ed = _hoCan.edit ? '' : 'disabled';
  _rulesHasUnpaidProv = 'unpaid_sick_provinces' in ru;   // only save it once v6 is run
  _rulesLoaded = ru;
  setTimeout(hoFillPinStaff, 0);
  setTimeout(loadOtRules, 0);
  const mode = (k) => `<select id="ru-${k}" ${ed}><option value="flag"${ru[k] === 'flag' ? ' selected' : ''}>Let it through, flagged</option><option value="block"${ru[k] === 'block' ? ' selected' : ''}>Refuse it</option></select>`;
  const num = (k, max) => `<input type="number" id="ru-${k}" min="0" max="${max}" value="${escAttr(ru[k] ?? '')}" ${ed}>`;
  body.innerHTML = `
    <div class="ho-card me-form" style="max-width:720px">
      <div class="ho-title" style="font-size:17px">Time off requests</div>
      <div><div style="font-size:12px;font-weight:700;color:var(--ink-soft);margin-bottom:6px">Notice needed, by how long the request is</div>
        <div id="ru-tiers">${(Array.isArray(ru.notice_tiers) ? [...ru.notice_tiers].sort((a, b) => a.up_to_days - b.up_to_days) : [{ up_to_days: 3, notice_days: ru.notice_days || 14 }])
          .map(t => ruTierRow(t, ed)).join('')}</div>
        ${_hoCan.edit ? '<button class="ho-btn" style="min-height:32px;margin-top:6px" onclick="document.getElementById(\'ru-tiers\').insertAdjacentHTML(\'beforeend\', ruTierRow({ up_to_days: \'\', notice_days: \'\' }, \'\'))">+ Add a tier</button>' : ''}
        <div class="goal-note" style="margin-top:4px">Requests longer than the last tier need the last tier’s notice.</div></div>
      <label>If less notice${mode('notice_mode')}</label>
      <div class="two"><label>Longest request (days in a row)${num('max_days', 365)}</label><label>If longer${mode('max_days_mode')}</label></div>
      <div class="two"><label>Already off at the same studio that day${num('max_off_per_studio', 50)}</label><label>If that many are off${mode('max_off_mode')}</label></div>
      <div class="two"><label>Studios with this many staff or more…${num('large_studio_staff', 200)}</label><label>…can have this many off${num('max_off_large_studio', 50)}</label></div>
      <div class="two"><label>Days off per year${num('annual_days', 365)}</label><label>…after this many years${num('senior_years', 50)}</label></div>
      <div class="two"><label>Days off per year for them${num('annual_days_senior', 365)}</label><label>If over the yearly days${mode('annual_mode')}</label></div>
      <div class="two"><label>Weekend days (Sat/Sun) off per quarter${num('weekend_days_per_quarter', 26)}</label><label>If more weekend days${mode('weekend_mode')}</label></div>
      <div class="ho-title" style="font-size:17px;margin-top:6px">Sick days (paid: sick calls + medical appointments; unpaid: sick calls)</div>
      <div class="two"><label>Provinces (e.g. BC)<input id="ru-sick_leave_provinces" value="${escAttr((ru.sick_leave_provinces || []).join(', '))}" ${ed}></label><label>Paid sick days per calendar year${num('sick_leave_days', 365)}</label></div>
      <div class="two"><label>…then unpaid, job-protected days${num('sick_unpaid_days', 365)}</label><label>Paid sick days start after (days employed)${num('sick_paid_after_days', 730)}</label></div>
      <div class="two"><label>Provinces with unpaid, job-protected sick days only (e.g. ON, AB)<input id="ru-unpaid_sick_provinces" value="${escAttr((ru.unpaid_sick_provinces || ['ON', 'AB']).join(', '))}" ${ed}></label><span></span></div>
      <div class="ho-title" style="font-size:17px;margin-top:6px">Unavailability and sick calls</div>
      <div class="two"><label>Unavailability can last up to (days)${num('unavail_max_days', 730)}</label><label>…and must repeat at least (weeks)${num('unavail_min_repeats', 52)}</label></div>
      <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink)"><input type="checkbox" id="ru-unavail_weekends_allowed" ${ru.unavail_weekends_allowed ? 'checked' : ''} ${ed}> Staff can set Saturdays and Sundays as unavailable</label>
      <div class="two"><label>New unavailability starts at least (days ahead)${num('unavailability_notice_days', 365)}</label>
        <label>Sick call allowed when the shift starts within (hours)${num('sick_window_hours', 168)}</label></div>
      <div class="ho-title" style="font-size:17px;margin-top:6px">Punch clock</div>
      <div class="two"><label>Can punch in at most (min) before the shift${num('punch_early_minutes', 240)}</label><label>Flag punching in more than (min) late${num('punch_late_minutes', 240)}</label></div>
      <div class="two"><label>Email “forgot to punch out?” after the shift ends + (min)${num('punchout_reminder_minutes', 720)}</label><label>Break warning after working (min) with no break${num('break_warn_minutes', 720)}</label></div>
      <div class="two"><label>Break warning when this many min past their break time${num('break_late_minutes', 240)}</label><span></span></div>
      <div class="two"><label>Late sick call: this many hours’ notice or less${num('sick_late_hours', 168)}</label>
        <label>Doctor’s note needed for medical leave over (days)${num('medical_note_required_over_days', 365)}</label></div>
      <label>Home office copy of sick-call emails (optional email address)<input id="ru-notify_home_office_email" type="email" value="${escAttr(ru.notify_home_office_email || '')}" placeholder="Leave blank: only the studio’s managers get them" ${ed}></label>
      <label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--ink)"><input type="checkbox" id="ru-sick_reason_required" ${ru.sick_reason_required ? 'checked' : ''} ${ed} style="min-height:auto"> A note is required when calling in sick</label>
      ${_hoCan.edit ? '<button class="ho-btn primary" onclick="saveRules()">Save rules</button>' : ''}
      <div id="ru-msg"></div>
    </div>
    <div class="ho-card me-form" style="max-width:720px;margin-top:12px" id="ot-rules-card"><div class="goal-note">Loading overtime rules…</div></div>
    ${_hoCan.edit ? `<div class="ho-card me-form" style="max-width:720px;margin-top:12px">
      <div class="ho-title" style="font-size:17px">Set a punch PIN for someone</div>
      <div class="goal-note">For staff without a login. Staff with a login set their own in the Hub on their phone.</div>
      <div class="two"><label>Staff member<select id="hp-staff"><option value="">Loading…</option></select></label><label>New 4-digit PIN<input class="pin-mask" id="hp-pin" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4"></label></div>
      <button class="ho-btn" onclick="hoSetPunchPin()">Set PIN</button><div id="hp-msg"></div></div>` : ''}
    <div class="ho-card" style="max-width:720px;margin-top:12px">
      <div class="ho-title" style="font-size:17px">Busy times (blackout dates)</div>
      <div class="goal-note">Staff see these when asking for time off.</div>
      ${(b.data || []).map(x => `<div class="me-list-row"><div class="what"><b>${esc(x.label)}</b><div>${esc(meFmtDate(x.start_date))} – ${esc(meFmtDate(x.end_date))} · ${x.mode === 'block' ? 'refused' : 'flagged'}${x.note ? ' · ' + esc(x.note) : ''}</div></div>
        ${_hoCan.edit ? `<button class="ho-btn danger" onclick="deleteBlackout('${escAttr(x.id)}')">Delete</button>` : ''}</div>`).join('') || '<div class="goal-note" style="margin:8px 0">None yet.</div>'}
      ${_hoCan.edit ? `<div class="me-form" style="margin-top:10px"><div class="two"><label>Name<input id="bo-label" placeholder="e.g. Summer camp weeks"></label><label>Requests then<select id="bo-mode"><option value="block">Refuse them</option><option value="flag">Let through, flagged</option></select></label></div>
        <div class="two"><label>From<input type="date" id="bo-start"></label><label>To<input type="date" id="bo-end"></label></div>
        <label>Note for staff (optional)<input id="bo-note" placeholder="e.g. Talk to your manager for anything urgent"></label>
        <button class="ho-btn" onclick="addBlackout()">Add busy time</button></div>` : ''}
    </div>`;
}
function ruTierRow(t, ed) {
  return `<div class="two ru-tier" style="margin-bottom:6px;align-items:center"><label style="flex-direction:row;align-items:center;gap:6px">Up to <input type="number" class="ru-up" min="1" max="365" value="${escAttr(t.up_to_days)}" ${ed} style="width:90px"> days off</label>
    <label style="flex-direction:row;align-items:center;gap:6px">ask <input type="number" class="ru-notice" min="0" max="365" value="${escAttr(t.notice_days)}" ${ed} style="width:90px"> days ahead</label>
    ${ed ? '' : '<button class="ho-btn" style="min-height:32px;flex:none" onclick="this.closest(\'.ru-tier\').remove()" aria-label="Remove tier">✕</button>'}</div>`;
}
let _rulesHasUnpaidProv = false, _rulesLoaded = null;
async function saveRules() {
  const n = k => Math.max(0, parseInt(document.getElementById('ru-' + k).value, 10) || 0);
  const v = k => document.getElementById('ru-' + k).value;
  const patch = { notice_mode: v('notice_mode'), max_days: n('max_days'), max_days_mode: v('max_days_mode'),
    max_off_per_studio: n('max_off_per_studio'), max_off_mode: v('max_off_mode'), unavailability_notice_days: n('unavailability_notice_days'),
    sick_window_hours: n('sick_window_hours'), sick_reason_required: document.getElementById('ru-sick_reason_required').checked, updated_at: new Date().toISOString(),
    large_studio_staff: n('large_studio_staff'), max_off_large_studio: n('max_off_large_studio'),
    annual_days: n('annual_days'), annual_days_senior: n('annual_days_senior'), senior_years: n('senior_years'), annual_mode: v('annual_mode'),
    weekend_days_per_quarter: n('weekend_days_per_quarter'), weekend_mode: v('weekend_mode'),
    sick_leave_days: n('sick_leave_days'),
    sick_leave_provinces: v('sick_leave_provinces').split(/[ ,]+/).map(x => x.trim().toUpperCase()).filter(Boolean),
    unavail_max_days: n('unavail_max_days'), unavail_min_repeats: n('unavail_min_repeats'),
    unavail_weekends_allowed: document.getElementById('ru-unavail_weekends_allowed').checked };
  if ('punch_early_minutes' in (_rulesLoaded || {})) Object.assign(patch, { punch_early_minutes: n('punch_early_minutes'), punch_late_minutes: n('punch_late_minutes') });
  if ('punchout_reminder_minutes' in (_rulesLoaded || {})) Object.assign(patch, { punchout_reminder_minutes: n('punchout_reminder_minutes'),
    break_warn_minutes: n('break_warn_minutes'), break_late_minutes: n('break_late_minutes') });
  if ('medical_note_required_over_days' in (_rulesLoaded || {})) Object.assign(patch, {
    medical_note_required_over_days: n('medical_note_required_over_days'),
    notify_home_office_email: (v('notify_home_office_email') || '').trim() || null });
  if (document.getElementById('ru-unpaid_sick_provinces') && _rulesHasUnpaidProv) patch.unpaid_sick_provinces = v('unpaid_sick_provinces').split(/[ ,]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  if (document.getElementById('ru-sick_late_hours')) Object.assign(patch, { sick_late_hours: n('sick_late_hours'),
    sick_unpaid_days: n('sick_unpaid_days'), sick_paid_after_days: n('sick_paid_after_days') });
  const tiers = [...document.querySelectorAll('#ru-tiers .ru-tier')].map(r => ({
    up_to_days: parseInt(r.querySelector('.ru-up').value, 10), notice_days: parseInt(r.querySelector('.ru-notice').value, 10) }))
    .filter(t => t.up_to_days > 0 && t.notice_days >= 0).sort((a, b) => a.up_to_days - b.up_to_days);
  if (!tiers.length) { document.getElementById('ru-msg').innerHTML = '<div class="me-msg err">Add at least one notice tier.</div>'; return; }
  patch.notice_tiers = tiers;
  patch.notice_days = tiers[0].notice_days;   // kept for anything still reading the single number
  const { error } = await sb.from('staff_request_rules').update(patch).eq('id', 1);
  document.getElementById('ru-msg').innerHTML = error
    ? `<div class="me-msg err">${/schema cache|column/i.test(error.message) ? 'Some rules aren’t set up in the database yet. Run the staff rules SQL files (v3, v4 and v5) in Supabase, then try again.' : esc(error.message)}</div>`
    : '<div class="me-msg ok">Saved. New requests follow these rules.</div>';
}
// Overtime by province (hub_overtime.sql). Stored in minutes, shown in hours.
const OT_METHODS = [['daily_then_weekly', 'Daily first, then weekly on regular hours (BC)'], ['greater_of', 'Daily or weekly, whichever is more (AB)'], ['weekly', 'Weekly only (ON)']];
async function loadOtRules() {
  const card = document.getElementById('ot-rules-card'); if (!card) return;
  const { data, error } = await sb.rpc('hub_ot_rules');
  if (error) { card.innerHTML = `<div class="ho-title" style="font-size:17px">Overtime</div><div class="goal-note">${/hub_ot_rules/i.test(error.message) ? 'Run hub_overtime.sql to set up overtime.' : esc(error.message)}</div>`; return; }
  const ed = _hoCan.edit ? '' : 'disabled', hrs = m => m == null ? '' : String(Math.round(m / 60 * 100) / 100);
  card.innerHTML = `<div class="ho-title" style="font-size:17px">Overtime by province</div>
    <div class="goal-note" style="margin-bottom:8px">Everyone hourly gets overtime, managers included. Weeks run Sunday–Saturday, with every studio’s hours added together.
      Check these against Payworks or the province’s employment standards. Leave a box empty for “none”.</div>
    <table class="ot-tbl"><thead><tr><th>Province</th><th>1.5× after (hours a day)</th><th>2× after (hours a day)</th><th>1.5× after (hours a week)</th><th>How they combine</th><th></th></tr></thead><tbody>
    ${(data || []).map(r => `<tr data-prov="${escAttr(r.province)}"><td><b>${esc(r.province)}</b></td>
      <td><input type="number" step="0.25" min="0" max="24" class="ot-d" value="${escAttr(hrs(r.daily_minutes))}" ${ed}></td>
      <td><input type="number" step="0.25" min="0" max="24" class="ot-dd" value="${escAttr(hrs(r.daily_double_minutes))}" ${ed}></td>
      <td><input type="number" step="0.25" min="0" max="80" class="ot-w" value="${escAttr(hrs(r.weekly_minutes))}" ${ed}></td>
      <td><select class="ot-m" ${ed}>${OT_METHODS.map(([v, l]) => `<option value="${v}"${v === r.method ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${_hoCan.edit ? `<button class="ho-btn" onclick="saveOtRule('${escAttr(r.province)}')">Save</button>` : ''}</td></tr>`).join('')}</tbody></table>
    <div id="ot-msg"></div>`;
}
async function saveOtRule(prov) {
  const row = document.querySelector(`#ot-rules-card tr[data-prov="${prov}"]`); if (!row) return;
  const m = cls => { const v = row.querySelector(cls).value.trim(); return v === '' ? null : Math.round(Number(v) * 60); };
  const { error } = await sb.rpc('hub_set_ot_rule', { p_province: prov, p_daily: m('.ot-d'), p_daily_double: m('.ot-dd'), p_weekly: m('.ot-w'), p_method: row.querySelector('.ot-m').value });
  document.getElementById('ot-msg').innerHTML = error ? `<div class="me-msg err">${esc(error.message)}</div>` : `<div class="me-msg ok">${esc(prov)} overtime saved. Timesheets use it straight away.</div>`;
}
async function hoFillPinStaff() {
  const sel = document.getElementById('hp-staff'); if (!sel) return;
  const { data } = await sb.from('staff_profiles').select('id, display_name').eq('is_active', true).order('display_name');
  sel.innerHTML = '<option value="">Choose…</option>' + (data || []).map(p => `<option value="${escAttr(p.id)}">${esc(p.display_name)}</option>`).join('');
}
async function hoSetPunchPin() {
  const id = document.getElementById('hp-staff').value, pin = document.getElementById('hp-pin').value;
  const box = document.getElementById('hp-msg');
  if (!id || !/^\d{4}$/.test(pin)) { box.innerHTML = '<div class="me-msg err">Choose someone and a 4-digit PIN.</div>'; return; }
  const { error } = await sb.rpc('hub_admin_set_punch_pin', { p_staff_id: id, p_pin: pin });
  box.innerHTML = error ? `<div class="me-msg err">${esc(error.message)}</div>` : '<div class="me-msg ok">Punch PIN set. Tell them in person.</div>';
  if (!error) document.getElementById('hp-pin').value = '';
}
async function addBlackout() {
  const v = id => document.getElementById(id).value.trim();
  if (!v('bo-label') || !v('bo-start') || !v('bo-end')) { alert('Give it a name and both dates.'); return; }
  const { error } = await sb.from('time_off_blackouts').insert({ label: v('bo-label'), start_date: v('bo-start'), end_date: v('bo-end'), mode: v('bo-mode'), note: v('bo-note') || null });
  if (error) { alert(error.message); return; }
  openRulesPane();
}
async function deleteBlackout(id) {
  if (!confirm('Delete this busy time?')) return;
  const { error } = await sb.from('time_off_blackouts').delete().eq('id', id);
  if (error) { alert(error.message); return; }
  openRulesPane();
}


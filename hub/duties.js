// hub/duties.js: ✅ Opening / closing lists (the studio's lists, home office's Open & close overview and history), ✅ Today's
// duties and 📋 Manage duties. Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.

// ---------- Opening / closing lists ----------
// hub_checklists.sql: hub_checklist() gives today's items + progress for this
// studio; hub_checklist_save() saves every tick (so a reload or a second
// person picks up where it left off) and the finish (who did it; the server
// times it from the first tick). Closing list: same screens, once its items exist.
const OC_NAMES = { open: 'Opening', close: 'Closing' };
let _oc = { open: null, close: null };       // hub_checklist() results
let _cl = null;                               // the list open on the checklist page
let _clSaveTimer = null;

async function loadOpenClose(studioId) {
  const el = document.getElementById('card-open-close');
  if (!el) return;
  const [o, c] = await Promise.all([
    sb.rpc('hub_checklist', { p_list: 'open', p_studio_id: studioId || null }),
    sb.rpc('hub_checklist', { p_list: 'close', p_studio_id: studioId || null })
  ]);
  if (o.error) { console.error('Opening list load failed:', o.error); el.style.display = 'none'; return; }
  _oc.open = o.data; _oc.close = c.error ? null : c.data;
  renderOpenClose();
}

function clItemDone(item, answers, notes) {
  const a = answers[item.id];
  if (item.kind === 'tick') return a === true;
  if (item.kind === 'multi') return Array.isArray(a) && item.options.every((_, i) => a[i] === true);
  if (typeof a !== 'number' || !item.options[a]) return false;
  return !item.options[a].note || !!String(notes[item.id] || '').trim();
}
// "info" items are notes to read, with nothing to tick: they don't count.
function clTasks(items) { return (items || []).filter(i => i.kind !== 'info'); }
function clProgress(data) {
  if (!data || !data.items) return { done: 0, total: 0 };
  const run = data.run || {};
  const answers = run.answers || {}, notes = run.notes || {};
  const tasks = clTasks(data.items);
  return { done: tasks.filter(i => clItemDone(i, answers, notes)).length, total: tasks.length };
}
function clMinutes(run) {
  if (!run || !run.started_at || !run.finished_at) return null;
  return Math.max(1, Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 60000));
}
function clWho(ids) {
  return (ids || []).map(id => (_teamPeople.find(p => p.staff_id === id) || {}).name).filter(Boolean);
}
function ringSvg(done, total, finished) {
  const r = 30, c = 2 * Math.PI * r, frac = total ? done / total : 0;
  const col = finished ? '#16a34a' : 'var(--accent)';
  return `<svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label="${done} of ${total} done">
    <circle cx="38" cy="38" r="${r}" fill="none" stroke="#eceaf6" stroke-width="8"></circle>
    ${frac > 0 ? `<circle cx="38" cy="38" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"></circle>` : ''}
    <text x="38" y="43" text-anchor="middle" font-family="Fredoka, Inter, sans-serif" font-size="${finished ? 20 : 15}" font-weight="600" fill="#1f1b3a">${finished ? '✓' : total ? `${done}/${total}` : '–'}</text></svg>`;
}
// (Nov 9 2026) ⚠️ Studio alerts: the last open day's closing list wasn't finished; the opening list isn't done an hour into the first shift.
//   The closing list: hub_checklist_history (this studio's last 14 days). The opening list: today's (hub_checklist). The first shift: today's team.
let _ocAlertPrev = { studio: null, at: 0, day: null }, _ocAlertTimer = null;
async function ocAlerts() {
  const box = document.getElementById('oc-alerts'); if (!box) return;
  const st = _sessionStudioId; if (!st || (_studioData && _studioData.isAdmin && !_sessionStudioId)) { box.innerHTML = ''; return; }
  const out = [], nice = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' });
  // the last day the studio was open before today: its closing list (looked up at most every 30 minutes)
  if (_ocAlertPrev.studio !== st || Date.now() - _ocAlertPrev.at > 30 * 60000) {
    _ocAlertPrev = { studio: st, at: Date.now(), day: null };
    try {
      const to = new Date(); to.setDate(to.getDate() - 1); const from = new Date(); from.setDate(from.getDate() - 14);
      const { data } = await sb.rpc('hub_checklist_history', { p_from: localDateStr(from), p_to: localDateStr(to) });
      _ocAlertPrev.day = (data || []).filter(d => d.studio_id === st && d.status === 'open' && !d.today && !d.future).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
    } catch (e) { /* not available for this login: no alert */ }
  }
  const last = _ocAlertPrev.day;
  if (last && !(last.close && last.close.finished_at))
    out.push(`<div class="oc-alert">⚠️ <b>${esc(nice(last.date))}’s closing list wasn’t finished.</b> Please check the studio was closed up properly${last.close ? ' (it was started, not finished)' : ''}.</div>`);
  // today's opening list, an hour into the first shift
  const firsts = (_teamPeople || []).flatMap(p => (p.shifts || []).map(x => hmToMin(x.start))).filter(n => n > 0);
  const run = _oc.open && _oc.open.run, has = _oc.open && clTasks(_oc.open.items).length;
  if (has && firsts.length && !(run && run.finished_at)) {
    const first = Math.min(...firsts), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= first + 60) out.push(`<div class="oc-alert">⏰ <b>The opening list isn’t done yet.</b> The first shift started at ${esc(shortTime(String(Math.floor(first / 60)).padStart(2, '0') + ':' + String(first % 60).padStart(2, '0')))}.${run ? ` (${clProgress(_oc.open).done} of ${clProgress(_oc.open).total} done)` : ''} <button class="ho-btn sm" onclick="openChecklist('open')">Open the list</button></div>`);
  }
  box.innerHTML = out.join('');
  clearTimeout(_ocAlertTimer); _ocAlertTimer = setTimeout(ocAlerts, 5 * 60000);
}
function renderOpenClose() {
  setTimeout(ocAlerts, 0);
  const el = document.getElementById('card-open-close');
  const ring = list => {
    const data = _oc[list];
    if (!data || !clTasks(data.items).length) {
      return `<button class="oc-ring" disabled>${ringSvg(0, 0, false)}<span class="nm">${OC_NAMES[list]}</span><span class="st">Coming soon</span></button>`;
    }
    const pr = clProgress(data), run = data.run;
    let st;
    if (run && run.finished_at) {
      const who = clWho(run.finished_by), mins = clMinutes(run);
      st = `<span class="st good">Done${who.length ? ' by ' + esc(who.join(' & ')) : ''} · ${esc(dutyTime(run.finished_at))}${mins ? ` · ${mins} min` : ''}</span>`;
    } else if (pr.done) st = `<span class="st warn">In progress · ${pr.done} of ${pr.total}</span>`;
    else st = `<span class="st">Not started · tap to begin</span>`;
    return `<button class="oc-ring" onclick="openChecklist('${list}')">${ringSvg(pr.done, pr.total, !!(run && run.finished_at))}<span class="nm">${OC_NAMES[list]}</span>${st}</button>`;
  };
  const ho = _oc.open && _oc.open.handoff;
  const openDone = _oc.open && _oc.open.run && _oc.open.run.finished_at;
  const alerts = (ho && ho.note && !openDone ? `<div class="oc-alert"><b>From last night's close:</b> ${esc(ho.note)}</div>` : '') +
    ['open', 'close'].map(list => {
      const run = _oc[list] && _oc[list].run;
      return run && run.attention_note ? `<div class="oc-alert"><b>${OC_NAMES[list]} note:</b> ${esc(run.attention_note)}</div>` : '';
    }).join('');
  el.innerHTML = `<div class="oc-title">Open & close</div><div class="oc-rings">${ring('open')}${ring('close')}</div>${alerts}`;
  el.style.display = '';
}

function openChecklist(list) {
  const data = _oc[list];
  if (!data || !clTasks(data.items).length) return;
  const run = data.run || {};
  _cl = { list, items: data.items, handoff: list === 'open' ? (data.handoff || null) : null, answers: JSON.parse(JSON.stringify(run.answers || {})), notes: JSON.parse(JSON.stringify(run.notes || {})), run: data.run || null, saving: false, saveMsg: '' };
  showOnlyPane('checklist-pane');
  setActiveNav('');
  renderChecklist();
  window.scrollTo(0, 0);
}
function closeChecklist() {
  flushChecklistSave();
  _cl = null;
  showDashboardPane();
  loadOpenClose(_sessionStudioId);
}

function renderChecklist() {
  const el = document.getElementById('cl-body');
  if (!_cl) { el.innerHTML = ''; return; }
  const { answers, notes, run } = _cl;
  const items = _cl.items;
  const tasks = clTasks(items);
  const done = tasks.filter(i => clItemDone(i, answers, notes)).length;
  const finished = run && run.finished_at;
  const ho = _cl.handoff;
  let html = `<div class="cl-top">
    <div class="cl-head"><h1>${OC_NAMES[_cl.list]} list</h1><span class="spacer"></span>
      <button class="ho-btn" onclick="closeChecklist()">← Back to today</button></div>
    <div class="cl-sub">${esc(STUDIO_NAMES[_sessionStudioId] || '')} · <span id="cl-count">${done} of ${tasks.length} done</span>${_cl.list === 'open' ? ' · aim to finish within 15 minutes' : ''}</div>
    <div class="cl-bar"><div id="cl-bar-fill" style="width:${tasks.length ? Math.round(100 * done / tasks.length) : 0}%"></div></div>
    ${ho && ho.note ? `<div class="cl-handoff"><b>From last night's close${ho.names && ho.names.length ? ' (' + esc(ho.names.join(' & ')) + ')' : ''}:</b> ${esc(ho.note)}</div>` : ''}
    ${finished ? `<div class="cl-done-banner">✓ Finished${clWho(run.finished_by).length ? ' by ' + esc(clWho(run.finished_by).join(' & ')) : ''} at ${esc(dutyTime(run.finished_at))}${clMinutes(run) ? ` · took ${clMinutes(run)} min` : ''}. You can still change answers.</div>` : ''}
  </div>`;
  let section = null;
  items.forEach(item => {
    if (item.section !== section) { section = item.section; html += `<div class="cl-section">${esc(section)}</div>`; }
    const ok = clItemDone(item, answers, notes);
    const a = answers[item.id];
    const weekly = item.weekly ? '<span class="cl-weekly">This week</span>' : '';
    let body = '';
    if (item.kind === 'info') {
      html += `<div class="cl-item cl-info"><div class="cl-q">${esc(item.label)}</div>${item.hint ? `<div class="cl-hint">${esc(item.hint)}</div>` : ''}</div>`;
      return;
    }
    if (item.kind === 'tick') {
      html += `<div class="cl-item${ok ? ' done' : ''}"><button class="cl-tick" onclick="clTick('${item.id}')">
        <span class="cl-box${a === true ? ' on' : ''}">${a === true ? '✓' : ''}</span>
        <span><span class="cl-q">${esc(item.label)}</span>${weekly}${item.hint ? `<div class="cl-hint">${esc(item.hint)}</div>` : ''}</span></button></div>`;
      return;
    }
    if (item.kind === 'multi') {
      const arr = Array.isArray(a) ? a : [];
      body = `<div class="cl-subs">${item.options.map((o, i) => `<button class="cl-tick" onclick="clSub('${item.id}', ${i})">
        <span class="cl-box${arr[i] === true ? ' on' : ''}">${arr[i] === true ? '✓' : ''}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    } else {
      const opt = typeof a === 'number' ? item.options[a] : null;
      body = `<div class="cl-opts">${item.options.map((o, i) => `<button class="cl-opt${a === i ? ' sel' : ''}${a === i && o.flag ? ' flag' : ''}" onclick="clChoose('${item.id}', ${i})">${esc(o.label)}</button>`).join('')}</div>
        ${opt && opt.note ? `<textarea class="cl-note" placeholder="Tell us a bit more…" oninput="clNote('${item.id}', this.value)">${esc(notes[item.id] || '')}</textarea>` : ''}`;
    }
    html += `<div class="cl-item${ok ? ' done' : ''}"><div class="cl-q">${esc(item.label)}${weekly}</div>
      ${item.hint ? `<div class="cl-hint">${esc(item.hint)}</div>` : ''}${body}</div>`;
  });
  const left = tasks.length - done;
  html += `<div class="cl-foot"><span class="msg" id="cl-save-msg">${esc(_cl.saveMsg || (left ? `${left} to go` : 'All done!'))}</span>
    <button onclick="finishChecklist()" ${left ? 'disabled' : ''}>${finished ? 'Save changes' : `Finish ${OC_NAMES[_cl.list].toLowerCase()} list`}</button></div>`;
  el.innerHTML = html;
}

function clChanged(rerender) {
  if (rerender !== false) renderChecklist();
  if (_clSaveTimer) clearTimeout(_clSaveTimer);
  _clSaveTimer = setTimeout(() => saveChecklist(false), 700);
}
function clTick(id) { _cl.answers[id] = _cl.answers[id] === true ? false : true; clChanged(); }
function clSub(id, i) {
  const arr = Array.isArray(_cl.answers[id]) ? _cl.answers[id].slice() : [];
  arr[i] = arr[i] === true ? false : true;
  for (let k = 0; k < arr.length; k++) if (arr[k] !== true) arr[k] = false;
  _cl.answers[id] = arr; clChanged();
}
function clChoose(id, i) { _cl.answers[id] = i; clChanged(); }
function clNote(id, v) {
  _cl.notes[id] = v;
  // keep typing smooth: update the counts without redrawing the text box
  const tasks = clTasks(_cl.items);
  const done = tasks.filter(it => clItemDone(it, _cl.answers, _cl.notes)).length;
  const btn = document.querySelector('.cl-foot button');
  if (btn) btn.disabled = done < tasks.length;
  const cnt = document.getElementById('cl-count');
  if (cnt) cnt.textContent = `${done} of ${tasks.length} done`;
  const bar = document.getElementById('cl-bar-fill');
  if (bar) bar.style.width = Math.round(100 * done / tasks.length) + '%';
  clChanged(false);
}
function flushChecklistSave() {
  if (_clSaveTimer) { clearTimeout(_clSaveTimer); _clSaveTimer = null; if (_cl) saveChecklist(false); }
}
function clAttentionText() {
  const parts = [];
  _cl.items.forEach(item => {
    const a = _cl.answers[item.id];
    if (item.kind !== 'choice' || typeof a !== 'number') return;
    const o = item.options[a];
    if (!o || !o.flag) return;
    const note = String(_cl.notes[item.id] || '').trim();
    if (item.key === 'attention') { if (note) parts.push(note); }
    else if (item.key === 'found_studio') parts.push(`Found the studio: ${o.label}${note ? ' — ' + note : ''}`);
    else if (item.key === 'prep_tomorrow') parts.push(`Prep for tomorrow: ${note || o.label}`);
    else if (note) parts.push(`${item.label} ${o.label.toLowerCase()}: ${note}`);
  });
  return parts.join('\n');
}
async function saveChecklist(finish, finishedBy) {
  if (!_cl) return null;
  const msg = document.getElementById('cl-save-msg');
  if (msg && !finish) msg.textContent = 'Saving…';
  const { data, error } = await sb.rpc('hub_checklist_save', {
    p_list: _cl.list, p_studio_id: _sessionStudioId || null,
    p_answers: _cl.answers, p_notes: _cl.notes,
    p_finish: !!finish, p_finished_by: finishedBy || null,
    p_attention: finish ? clAttentionText() : null
  });
  if (error) {
    if (msg) msg.textContent = "Couldn't save just now. It'll try again on your next tick.";
    console.error('Checklist save failed:', error);
    return null;
  }
  if (_cl) {
    _cl.run = data;
    if (_oc[_cl.list]) _oc[_cl.list].run = data;
    const left = clTasks(_cl.items).length - clTasks(_cl.items).filter(i => clItemDone(i, _cl.answers, _cl.notes)).length;
    _cl.saveMsg = '';
    if (msg && !finish) msg.textContent = left ? `Saved · ${left} to go` : 'Saved · all done!';
  }
  return data;
}
function finishChecklist() {
  if (!_cl) return;
  if (_cl.run && _cl.run.finished_at) { saveChecklist(true, _cl.run.finished_by).then(() => closeChecklist()); return; }
  if (!_teamPeople.length) { doFinishChecklist([]); return; }
  _clWhoPicked = new Set();
  renderClWho();
}
let _clWhoPicked = new Set();
function renderClWho() {
  openDutySheet(`
    <h3>Who ${_cl.list === 'open' ? 'opened' : 'closed'} today?</h3>
    <p>Tap everyone who helped.</p>
    <div class="who-grid">${_teamPeople.map(p => `<button class="who-btn${_clWhoPicked.has(p.staff_id) ? ' sel' : ''}" onclick="toggleClWho('${escAttr(p.staff_id)}')">${hubAvatarHtml(p, 44)}${esc(p.name)}</button>`).join('')}</div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Back</button>
      <button class="primary" onclick="doFinishChecklist([..._clWhoPicked])" ${_clWhoPicked.size ? '' : 'disabled'}>Finish</button></div>`);
}
function toggleClWho(id) { _clWhoPicked.has(id) ? _clWhoPicked.delete(id) : _clWhoPicked.add(id); renderClWho(); }
async function doFinishChecklist(ids) {
  closeDutySheet();
  if (_clSaveTimer) { clearTimeout(_clSaveTimer); _clSaveTimer = null; }
  const saved = await saveChecklist(true, ids);
  if (!saved) { alert("Couldn't finish the list just now. Check the connection and try again."); return; }
  closeChecklist();
}

// Home office → Opening lists: every studio today.
function openOcOverview() {
  if (!_hoCan.view) return;
  showOnlyPane('oc-overview-pane');
  setActiveNav('nav-oc-overview');
  loadOcOverview();
}
let _ocList = 'open';
function setOcList(list) {
  _ocList = list;
  document.querySelectorAll('#oc-tabs button').forEach(b => b.classList.toggle('on', b.dataset.l === list));
  document.getElementById('oc-title').textContent = list === 'history' ? '✅ Open & close history' : '✅ Open & close today';
  document.getElementById('oc-intro').textContent = list === 'history'
    ? 'Were the opening and closing lists done? Each day shows O (open) and C (close). Red means the studio was open but the list wasn’t finished. Tap a square for details.'
    : 'Every open studio’s list for today: who did it, how long it took, problems flagged, and anything that needs attention.';
  loadOcOverview();
}
async function loadOcOverview() {
  if (_ocList === 'history') return loadOcHistory();
  const box = document.getElementById('oc-overview');
  box.innerHTML = '<div class="ho-intro">Loading…</div>';
  const isOpen = _ocList === 'open';
  const { data, error } = await sb.rpc('hub_checklist_overview', { p_list: _ocList });
  if (error) { box.innerHTML = `<div class="ho-card">Couldn't load: ${esc(error.message)}</div>`; return; }
  const items = data.items || [];
  const found = items.find(i => i.key === 'found_studio');
  // A studio that's closed today (closure, or nothing scheduled) isn't expected
  // to open, unless someone did the list anyway.
  const isClosed = r => !r.run && r.day && r.day.status !== 'open';
  const open = (data.studios || []).filter(r => !isClosed(r));
  const closed = (data.studios || []).filter(isClosed);
  const nm = id => STUDIO_NAMES[id] || id;
  const rows = open.slice().sort((a, b) => {
    const rank = r => !r.run ? 0 : !r.run.finished_at ? 1 : 2;
    return rank(a) - rank(b) || nm(a.studio_id).localeCompare(nm(b.studio_id));
  });
  const done = rows.filter(r => r.run && r.run.finished_at).length;
  box.innerHTML = `<div class="ho-intro"><b>${done} of ${rows.length}</b> open studios have finished their ${isOpen ? 'opening' : 'closing'} list today.</div>
    <div class="oc-wrap"><table class="oc-table"><thead><tr><th>Studio</th><th>Status</th><th>Who</th>${isOpen ? '<th>Found the studio</th><th>Closed last night by</th>' : ''}<th>Problems</th><th>Needs attention</th></tr></thead><tbody>
    ${rows.map(r => {
      const run = r.run;
      const answers = (run && run.answers) || {};
      const flags = items.filter(i => i.kind === 'choice' && typeof answers[i.id] === 'number' && i.options[answers[i.id]] && i.options[answers[i.id]].flag && i.key !== 'attention' && i.key !== 'found_studio')
        .map(i => Object.assign({}, i, { options: i.options.map(o => Object.assign({}, o, { label: o.label })) }));
      const f = found && typeof answers[found.id] === 'number' ? found.options[answers[found.id]] : null;
      const why = r.day && r.day.status === 'open' && !r.day.shifts && !r.day.bookings && r.day.events ? ' <span style="color:var(--ink-soft)">(event only)</span>' : '';
      const status = !run ? `<span class="ho-pill ended">Not started</span>${why}`
        : !run.finished_at ? '<span class="ho-pill soon">In progress</span>'
        : `<span class="ho-pill live">Done ${esc(dutyTime(run.finished_at))}</span>${clMinutes(run) ? ` <span style="color:var(--ink-soft)">${clMinutes(run)} min</span>` : ''}`;
      return `<tr><td><b>${esc(nm(r.studio_id))}</b></td><td>${status}</td>
        <td>${run && run.finished_by_names ? esc(run.finished_by_names.join(', ')) : ''}</td>
        ${isOpen ? `<td>${f ? (f.flag ? `<span style="color:#b45309;font-weight:700">${esc(f.label)}</span>` : esc(f.label)) : ''}</td>
        <td>${r.last_close && r.last_close.names && r.last_close.names.length ? esc(r.last_close.names.join(', ')) : ''}</td>` : ''}
        <td>${flags.length ? flags.map(i => `<div>• ${isOpen ? '' : esc(i.label) + ': '}${esc(i.options[answers[i.id]].label)}</div>`).join('') : ''}</td>
        <td style="white-space:pre-line">${run && run.attention_note ? esc(run.attention_note) : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="${isOpen ? 7 : 5}">No studios are open today.</td></tr>`}</tbody></table></div>
    ${closed.length ? `<div class="ho-section-head">Closed today (${closed.length})</div>
      <div class="ho-intro">${closed.sort((a, b) => nm(a.studio_id).localeCompare(nm(b.studio_id))).map(r =>
        `${esc(nm(r.studio_id))} <span style="color:var(--ink-soft)">(${r.day.status === 'closed' ? (r.day.reason ? esc(r.day.reason) : 'closed') : 'nothing scheduled'})</span>`).join(' · ')}</div>` : ''}`;
}

// Home office → Open & close → History: studios × days, O and C per day.
let _ocDays = 14, _ocHist = null;
function ocCell(day, list) {
  const run = day[list];
  if (day.future) return { cls: 'fut', label: '' };
  if (run && run.finished_at) return { cls: 'done', label: '✓' };
  if (day.status !== 'open' && !run) return { cls: 'closed', label: '' };
  if (day.today) return { cls: run ? 'part' : 'wait', label: run ? '…' : '' };
  return { cls: run ? 'part' : 'miss', label: run ? '½' : '✗' };
}
async function loadOcHistory() {
  const box = document.getElementById('oc-overview');
  box.innerHTML = '<div class="ho-intro">Loading…</div>';
  const to = localDateStr(new Date());
  const fromD = new Date(); fromD.setDate(fromD.getDate() - (_ocDays - 1));
  const { data, error } = await sb.rpc('hub_checklist_history', { p_from: localDateStr(fromD), p_to: to });
  if (error) { box.innerHTML = `<div class="ho-card">Couldn't load: ${esc(error.message)}</div>`; return; }
  _ocHist = data || [];
  renderOcHistory();
}
function renderOcHistory() {
  const box = document.getElementById('oc-overview');
  const byStudio = {};
  _ocHist.forEach(d => { (byStudio[d.studio_id] = byStudio[d.studio_id] || []).push(d); });
  const dates = [...new Set(_ocHist.map(d => d.date))].sort();
  const score = days => {
    const r = { open: [0, 0], close: [0, 0] };
    days.forEach(d => ['open', 'close'].forEach(l => {
      const c = ocCell(d, l).cls;
      if (c === 'done' || c === 'miss' || c === 'part') { r[l][1]++; if (c === 'done') r[l][0]++; }
    }));
    return r;
  };
  const pct = ([a, b]) => b ? Math.round(100 * a / b) : null;
  const studios = Object.keys(byStudio).map(id => ({ id, days: byStudio[id], sc: score(byStudio[id]) }))
    .filter(x => x.sc.open[1] || x.sc.close[1] || x.days.some(d => d.open || d.close))
    .sort((a, b) => (pct(a.sc.open) ?? 101) + (pct(a.sc.close) ?? 101) - ((pct(b.sc.open) ?? 101) + (pct(b.sc.close) ?? 101))
      || (STUDIO_NAMES[a.id] || a.id).localeCompare(STUDIO_NAMES[b.id] || b.id));
  const tot = { open: [0, 0], close: [0, 0] };
  studios.forEach(x => ['open', 'close'].forEach(l => { tot[l][0] += x.sc[l][0]; tot[l][1] += x.sc[l][1]; }));
  const scoreHtml = sc => ['open', 'close'].map(l => {
    const p = pct(sc[l]);
    return `<span class="ocs ${p === null ? '' : p >= 90 ? 'good' : p >= 70 ? 'mid' : 'bad'}">${l === 'open' ? 'Open' : 'Close'} ${sc[l][0]}/${sc[l][1]}</span>`;
  }).join('');
  const dayHead = d => {
    const [y, m, dd] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, dd);
    return `<th class="och-d">${dt.toLocaleDateString(undefined, { weekday: 'short' })}<br>${dd}</th>`;
  };
  box.innerHTML = `
    <div class="ho-head" style="margin-bottom:10px">
      <div class="oc-tabs">${[7, 14, 30].map(n => `<button class="${_ocDays === n ? 'on' : ''}" onclick="_ocDays=${n};loadOcHistory()">${n} days</button>`).join('')}</div>
      <span class="ho-intro" style="margin:0">Network: ${scoreHtml(tot)} <span style="color:var(--ink-soft)">(today not counted)</span></span>
    </div>
    <div class="och-legend"><span class="och-sq done">✓</span> done <span class="och-sq part">½</span> started, not finished <span class="och-sq miss">✗</span> open but not done <span class="och-sq closed"></span> closed <span class="och-sq wait"></span> today, not yet</div>
    <div class="oc-wrap"><table class="och-table"><thead><tr><th class="och-studio">Studio</th><th>Done</th>${dates.map(dayHead).join('')}</tr></thead><tbody>
    ${studios.map(x => `<tr><td class="och-studio"><b>${esc(STUDIO_NAMES[x.id] || x.id)}</b></td><td class="och-score">${scoreHtml(x.sc)}</td>
      ${dates.map(dt => {
        const d = x.days.find(z => z.date === dt);
        if (!d) return '<td></td>';
        return `<td class="och-c">${['open', 'close'].map(l => {
          const c = ocCell(d, l);
          return `<button class="och-sq ${c.cls}" title="${l === 'open' ? 'Open' : 'Close'}" onclick="ocHistDetail('${escAttr(x.id)}','${dt}')"><small>${l === 'open' ? 'O' : 'C'}</small>${c.label}</button>`;
        }).join('')}</td>`;
      }).join('')}</tr>`).join('') || `<tr><td colspan="${dates.length + 2}">No studios were open in this range.</td></tr>`}
    </tbody></table></div>`;
}
function ocHistDetail(studioId, date) {
  const d = (_ocHist || []).find(z => z.studio_id === studioId && z.date === date);
  if (!d) return;
  const [y, m, dd] = date.split('-').map(Number);
  const when = new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const part = l => {
    const run = d[l], c = ocCell(d, l);
    let txt;
    if (c.cls === 'done') {
      const mins = clMinutes(run);
      txt = `✓ Finished ${esc(dutyTime(run.finished_at))}${run.names && run.names.length ? ' by ' + esc(run.names.join(' & ')) : ''}${mins ? ` · ${mins} min` : ''}`;
    } else if (run) txt = `Started ${run.started_at ? esc(dutyTime(run.started_at)) : ''} but not finished`;
    else if (c.cls === 'closed') txt = d.status === 'closed' ? `Closed${d.reason ? ': ' + esc(d.reason) : ''}` : 'Closed (nothing scheduled)';
    else if (c.cls === 'wait') txt = 'Not done yet today';
    else if (c.cls === 'fut') txt = '';
    else txt = '✗ Not done';
    return `<div class="ho-card" style="box-shadow:none"><div class="ho-title" style="font-size:15px">${l === 'open' ? 'Opening' : 'Closing'} list</div>
      <div class="ho-body" style="color:var(--ink)">${txt}</div>${run && run.note ? `<div class="duty-note" style="margin-top:8px">${esc(run.note)}</div>` : ''}</div>`;
  };
  openDutySheet(`<h3>${esc(STUDIO_NAMES[studioId] || studioId)}</h3><p>${esc(when)}</p>${part('open')}${part('close')}
    <div class="sheet-actions"><button class="primary" onclick="closeDutySheet()">Close</button></div>`);
}


// ---------- Today's duties ----------
// Same data as index.html's "Today's Tasks": task_templates (regular duties,
// some repeating) and studio_tasks (each day's duties). For now duties are
// created by home office only (admin → Studio Ops → Tasks); studios tick them
// off, say who did it, change who it's for, and add their own note
// (studio_note — kept separate so home office's instructions stay as written).
// Shown: today's repeating duties, one-off duties due today or overdue and not
// done, and anything done today.
let _duties = [], _dutyTemplates = [], _dutiesLoaded = false, _dutiesStudio = null;
let _dutyHasStaffCol = true;   // false until hub_duties.sql is run

function openDuties() {
  showOnlyPane('duties-pane'); setActiveNav('nav-duties');
  if (_sessionStudioId) loadDuties(_sessionStudioId);
}
async function loadDuties(studioId) {
  const el = document.getElementById('card-duties');
  if (!el || !studioId) return;
  _dutiesStudio = studioId;
  const today = localDateStr(new Date());
  const tpl = await sb.from('task_templates').select('*').or(`studio_id.is.null,studio_id.eq.${studioId}`).order('title');
  if (tpl.error) { console.error('Duty templates load failed:', tpl.error); el.style.display = 'none'; return; }
  _dutyTemplates = tpl.data || [];
  await makeTodaysRepeatingDuties(studioId, today);
  const startOfToday = new Date(today + 'T00:00:00').toISOString();
  const [open, todays, doneToday] = await Promise.all([
    sb.from('studio_tasks').select('*').or(`studio_id.eq.${studioId},studio_id.is.null`).eq('status', 'pending').lte('due_date', today),
    sb.from('studio_tasks').select('*').or(`studio_id.eq.${studioId},studio_id.is.null`).eq('due_date', today),
    // overdue ones finished today stay visible (ticked) for the rest of the day
    sb.from('studio_tasks').select('*').or(`studio_id.eq.${studioId},studio_id.is.null`).eq('status', 'complete').gte('completed_at', startOfToday)
  ]);
  if (open.error || todays.error) { console.error('Duties load failed:', open.error || todays.error); el.style.display = 'none'; return; }
  const byId = new Map();
  [...(open.data || []), ...(todays.data || []), ...((doneToday && doneToday.data) || [])].forEach(t => byId.set(t.id, t));
  // Old instances of repeating duties don't carry over (same as index.html).
  _duties = [...byId.values()].filter(t => !t.template_id || t.due_date === today)
    .sort((a, b) => (a.status === 'complete') - (b.status === 'complete') || String(a.due_date).localeCompare(String(b.due_date)) || String(a.created_at).localeCompare(String(b.created_at)));
  _dutyHasStaffCol = _duties.length ? Object.prototype.hasOwnProperty.call(_duties[0], 'completed_by_staff_id') : _dutyHasStaffCol;
  _dutiesLoaded = true;
  renderDuties();
}

// Today's copy of each repeating duty, made once per studio per day (same as index.html).
async function makeTodaysRepeatingDuties(studioId, date) {
  const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date + 'T12:00:00').getDay()];
  const repeating = _dutyTemplates.filter(t => t.repeat === 'daily' || (t.repeat === 'weekly' && (t.repeat_days || []).includes(dayName)));
  if (!repeating.length) return;
  const { data: existing } = await sb.from('studio_tasks').select('template_id')
    .eq('studio_id', studioId).eq('due_date', date).not('template_id', 'is', null);
  const have = new Set((existing || []).map(t => t.template_id));
  const make = repeating.filter(t => !have.has(t.id));
  if (!make.length) return;
  await sb.from('studio_tasks').insert(make.map(t => ({
    studio_id: studioId, title: t.title, notes: t.notes || null, url: t.url || null,
    template_id: t.id, due_date: date, source: 'studio', status: 'pending'
  })));
}

function dutyPersonFor(staffId, fallbackName) {
  if (staffId) {
    const p = _teamPeople.find(x => x.staff_id === staffId);
    if (p) return p;
  }
  return fallbackName ? { staff_id: staffId || fallbackName, name: fallbackName, avatar_key: null } : null;
}
function dutyTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
}

function renderDuties() {
  const el = document.getElementById('card-duties');
  if (!el) return;
  const today = localDateStr(new Date());
  const done = _duties.filter(t => t.status === 'complete').length;
  const items = _duties.map(t => {
    const isDone = t.status === 'complete';
    const late = !isDone && t.due_date < today;
    const assignee = dutyPersonFor(t.assignee_id, t.assignee_name);
    const doer = isDone ? dutyPersonFor(t.completed_by_staff_id, null) : null;
    const who = isDone
      ? `<span class="duty-who">${doer ? hubAvatarHtml(doer, 22) + ' Done by ' + esc(doer.name) : 'Done'}${t.completed_at ? ' · ' + esc(dutyTime(t.completed_at)) : ''}</span>`
      : assignee ? `<span class="duty-who">${hubAvatarHtml(assignee, 22)} ${esc(assignee.name)}</span>` : '<span>Anyone</span>';
    const link = safeHttpUrl(t.url);
    return `<div class="duty${isDone ? ' done' : ''}">
      <button class="duty-check" onclick="toggleDuty('${escAttr(t.id)}')" aria-label="${isDone ? 'Mark not done' : 'Mark done'}: ${escAttr(t.title)}">${isDone ? '✓' : ''}</button>
      <div class="duty-main">
        <div class="duty-name">${esc(t.title)}</div>
        <div class="duty-meta">${who}${t.source === 'home_office' ? '<span class="duty-tag ho">Home office</span>' : ''}${late ? '<span class="duty-tag late">Overdue</span>' : ''}</div>
        ${t.notes ? `<div class="duty-note">${esc(t.notes)}</div>` : ''}
        ${t.studio_note ? `<div class="duty-snote"><b>Studio note:</b> ${esc(t.studio_note)}</div>` : ''}
        ${link ? `<a class="duty-link" href="${escAttr(link)}" target="_blank" rel="noopener">Open the how-to ↗</a>` : ''}
      </div>
      <div class="duty-actions"><button class="duty-mini" onclick="openDutyEdit('${escAttr(t.id)}')">${t.studio_note ? 'Edit note' : '+ Note'}</button></div>
    </div>`;
  }).join('');
  const left = _duties.length - done, badge = document.getElementById('duties-badge');
  if (badge) { badge.textContent = left; badge.style.display = left ? '' : 'none'; }
  el.innerHTML = `
    <div class="duties-head">
      <div class="duties-title">${_duties.length ? `${done} of ${_duties.length} done` : ''}</div>
    </div>
    ${_duties.length ? `<div class="duties-grid">${items}</div>` : '<div class="floor-empty">No duties for today.</div>'}
`;
  el.style.display = '';
}

// ---------- Manage duties (hub_duties_manage.sql) ----------
const DM_DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
let _dm = { tab: 'regular', studio: null, tpls: [] };
function dmIsHO() { return !!(_studioData && _studioData.isAdmin); }
function openDutyManage(tab) {
  if (!coordOrAdmin()) { openPinModal(); return; }
  showOnlyPane('dm-pane'); setActiveNav('nav-dm');
  if (tab) _dm.tab = tab;
  if (_dm.studio === null) _dm.studio = dmIsHO() ? '' : _sessionStudioId;
  const tabs = [['regular', 'Regular duties']].concat(dmIsHO() ? [['send', 'Send a duty'], ['progress', 'How studios are doing']] : []);
  if (!tabs.some(t => t[0] === _dm.tab)) _dm.tab = 'regular';
  document.getElementById('dm-tabs').innerHTML = tabs.map(([k, l]) => `<button class="${_dm.tab === k ? 'on' : ''}" onclick="openDutyManage('${k}')">${l}</button>`).join('');
  if (_dm.tab === 'send') dmRenderSend(); else if (_dm.tab === 'progress') dmLoadProgress(); else dmLoadRegular();
}
function dmRepeatLabel(t) {
  if (t.repeat === 'daily') return 'Every day';
  if (t.repeat === 'weekly') return DM_DAYS.filter(([k]) => (t.repeat_days || []).includes(k)).map(d => d[1]).join(', ') || 'Weekly';
  return 'When needed (pick it from the list)';
}
function dmCanEdit(t) { return dmIsHO() || (t.studio_id && t.studio_id === _sessionStudioId); }
async function dmLoadRegular() {
  const body = document.getElementById('dm-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  let q = sb.from('task_templates').select('*').order('title');
  const st = dmIsHO() ? _dm.studio : _sessionStudioId;
  if (st) q = q.or(`studio_id.is.null,studio_id.eq.${st}`);
  const { data, error } = await q;
  if (error) { body.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  _dm.tpls = data || [];
  const groups = [['daily', 'Every day'], ['weekly', 'Certain days'], ['none', 'When needed']];
  body.innerHTML = `<div class="ho-card">
      <div class="dm-top">${dmIsHO() ? `<select onchange="_dm.studio = this.value; dmLoadRegular()"><option value="">Every studio’s duties</option>${Object.keys(STUDIO_NAMES).sort().map(k => `<option value="${escAttr(k)}"${_dm.studio === k ? ' selected' : ''}>${esc(STUDIO_NAMES[k])}</option>`).join('')}</select>` : `<div class="goal-note">${esc(STUDIO_NAMES[_sessionStudioId] || '')}: regular duties come from home office.</div>`}
        <span class="spacer"></span>${dmIsHO() ? '<button class="ho-btn primary" onclick="dmEdit(null)">+ Add a regular duty</button>' : ''}</div>
      ${_dm.tpls.length ? groups.map(([k, l]) => { const g = _dm.tpls.filter(t => (t.repeat || 'none') === k); return g.length ? `<div class="me-sub-title" style="margin-top:14px">${l}</div>${g.map(t => `
        <div class="dm-row"><div class="dm-main"><b>${esc(t.title)}</b>
            <div class="goal-note">${esc(dmRepeatLabel(t))} · ${t.studio_id ? esc(STUDIO_NAMES[t.studio_id] || t.studio_id) : 'All studios'}${t.notes ? ' · ' + esc(t.notes) : ''}</div>
            ${safeHttpUrl(t.url) ? `<a class="duty-link" href="${escAttr(safeHttpUrl(t.url))}" target="_blank" rel="noopener">How-to ↗</a>` : ''}</div>
          ${dmCanEdit(t) ? `<button class="ho-btn" onclick="dmEdit('${escAttr(t.id)}')">Edit</button>` : '<span class="duty-tag ho">Home office</span>'}</div>`).join('')}` : ''; }).join('')
        : '<div class="goal-note" style="margin-top:12px">No regular duties yet.</div>'}
    </div>`;
}
function dmEdit(id) {
  const t = id ? _dm.tpls.find(x => x.id === id) : { repeat: 'daily', repeat_days: [], studio_id: dmIsHO() ? (_dm.studio || null) : _sessionStudioId };
  if (!t) return;
  window._dmEditing = id;
  openDutySheet(`<h3>${id ? 'Edit duty' : 'New regular duty'}</h3>
    <div class="me-form">
      <label>What needs doing<input id="dm-title" maxlength="120" value="${escAttr(t.title || '')}" placeholder="e.g. Wipe down the wheel area"></label>
      <label>Notes (optional)<input id="dm-notes" maxlength="300" value="${escAttr(t.notes || '')}"></label>
      <label>How-to link (optional)<input id="dm-url" maxlength="500" value="${escAttr(t.url || '')}" placeholder="https://…"></label>
      ${dmIsHO() ? `<label>Which studios<select id="dm-studio"><option value="">All studios</option>${Object.keys(STUDIO_NAMES).sort().map(k => `<option value="${escAttr(k)}"${t.studio_id === k ? ' selected' : ''}>${esc(STUDIO_NAMES[k])}</option>`).join('')}</select></label>`
        : `<div class="goal-note">Just for ${esc(STUDIO_NAMES[_sessionStudioId] || 'this studio')}</div>`}
      <label>How often<select id="dm-repeat" onchange="document.getElementById('dm-days').style.display = this.value === 'weekly' ? '' : 'none'">
        <option value="daily"${t.repeat === 'daily' ? ' selected' : ''}>Every day</option>
        <option value="weekly"${t.repeat === 'weekly' ? ' selected' : ''}>Certain days of the week</option>
        <option value="none"${(t.repeat || 'none') === 'none' ? ' selected' : ''}>When needed (staff pick it from the list)</option></select></label>
      <div id="dm-days" class="dm-days" style="${t.repeat === 'weekly' ? '' : 'display:none'}">${DM_DAYS.map(([k, l]) => `<label><input type="checkbox" class="dm-day" value="${k}"${(t.repeat_days || []).includes(k) ? ' checked' : ''}> ${l}</label>`).join('')}</div>
    </div>
    <div id="dm-msg"></div>
    <div class="sheet-actions">${id ? '<button onclick="dmDelete()">Delete</button>' : ''}<span style="flex:1"></span><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="dmSave()">Save</button></div>`);
}
async function dmSave() {
  const v = id => (document.getElementById(id) || {}).value;
  const studio = dmIsHO() ? (v('dm-studio') || null) : _sessionStudioId;
  const { error } = await sb.rpc('hub_duty_template_save', { p_id: window._dmEditing || null, p_title: v('dm-title'), p_notes: v('dm-notes') || null, p_url: v('dm-url') || null,
    p_studio_id: studio, p_repeat: v('dm-repeat'), p_repeat_days: [...document.querySelectorAll('.dm-day:checked')].map(c => c.value) });
  if (error) { document.getElementById('dm-msg').innerHTML = `<div class="me-msg err">${esc(/hub_duty_template_save/i.test(error.message) ? 'Run hub_duties_manage.sql first.' : error.message)}</div>`; return; }
  closeDutySheet(); dmLoadRegular();
  if (_sessionStudioId) loadDuties(_sessionStudioId);   // today's list picks up a new everyday duty
}
async function dmDelete() {
  if (!confirm('Delete this regular duty? Duties already on today’s list stay.')) return;
  const { error } = await sb.rpc('hub_duty_template_delete', { p_id: window._dmEditing });
  if (error) { document.getElementById('dm-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  closeDutySheet(); dmLoadRegular();
}
function dmRenderSend() {
  const byProv = {}; Object.keys(STUDIO_NAMES).sort().forEach(k => { (byProv[k.slice(0, 2)] = byProv[k.slice(0, 2)] || []).push(k); });
  document.getElementById('dm-body').innerHTML = `<div class="ho-card me-form" style="max-width:720px">
      <label>What needs doing<input id="ds-title" maxlength="120" placeholder="e.g. Put up the holiday window display"></label>
      <label>Notes (optional)<input id="ds-notes" maxlength="300"></label>
      <label>How-to link (optional)<input id="ds-url" maxlength="500" placeholder="https://…"></label>
      <label>Due<input id="ds-due" type="date" value="${escAttr(localDateStr(new Date()))}"></label>
      <div class="me-sub-title">Studios</div>
      <label class="dm-all"><input type="checkbox" id="ds-all" checked onchange="document.getElementById('ds-pick').style.display = this.checked ? 'none' : ''"> All studios</label>
      <div id="ds-pick" style="display:none">${Object.entries(byProv).map(([pv, ks]) => `<div class="dm-prov"><b>${esc(pv)}</b> <a href="#" onclick="document.querySelectorAll('.ds-st[data-p=${pv}]').forEach(c=>c.checked=true); return false">all</a>
        <div class="dm-studios">${ks.map(k => `<label><input type="checkbox" class="ds-st" data-p="${pv}" value="${escAttr(k)}"> ${esc(STUDIO_NAMES[k])}</label>`).join('')}</div></div>`).join('')}</div>
      <div class="goal-note">Each studio gets its own copy to tick off, so you can see who’s done it. To repeat it, add it as a regular duty instead.</div>
      <div id="ds-msg"></div>
      <div style="display:flex;justify-content:flex-end"><button class="ho-btn primary" onclick="dmSend()">Send</button></div></div>`;
}
async function dmSend() {
  const v = id => document.getElementById(id).value;
  const all = document.getElementById('ds-all').checked;
  const ids = all ? [] : [...document.querySelectorAll('.ds-st:checked')].map(c => c.value);
  const msg = document.getElementById('ds-msg');
  if (!all && !ids.length) { msg.innerHTML = '<div class="me-msg err">Choose at least one studio.</div>'; return; }
  const { data, error } = await sb.rpc('hub_send_duty', { p_title: v('ds-title'), p_notes: v('ds-notes') || null, p_url: v('ds-url') || null, p_due: v('ds-due') || null, p_studio_ids: ids });
  if (error) { msg.innerHTML = `<div class="me-msg err">${esc(/hub_send_duty/i.test(error.message) ? 'Run hub_duties_manage.sql first.' : error.message)}</div>`; return; }
  msg.innerHTML = `<div class="me-msg ok">Sent to ${data.studios} studio${data.studios === 1 ? '' : 's'}. Follow it under “How studios are doing”.</div>`;
  document.getElementById('ds-title').value = ''; document.getElementById('ds-notes').value = ''; document.getElementById('ds-url').value = '';
}
async function dmLoadProgress() {
  const body = document.getElementById('dm-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const t = new Date(), from = new Date(); from.setDate(t.getDate() - 14); const to = new Date(); to.setDate(t.getDate() + 14);
  const { data, error } = await sb.rpc('hub_duty_progress', { p_from: localDateStr(from), p_to: localDateStr(to) });
  if (error) { body.innerHTML = `<div class="me-msg err">${esc(/hub_duty_progress/i.test(error.message) ? 'Run hub_duties_manage.sql first.' : error.message)}</div>`; return; }
  const today = localDateStr(new Date());
  body.innerHTML = `<div class="ho-card"><div class="goal-note" style="margin-bottom:8px">Home office duties due in the last two weeks and the next two.</div>
    ${(data || []).length ? data.map(d => { const pct = d.total ? Math.round(d.done / d.total * 100) : 0, late = d.due_date < today && d.done < d.total;
      return `<div class="dm-prog"><div class="dm-prog-head"><b>${esc(d.title)}</b><span class="goal-note">due ${esc(tsDayLabel(d.due_date))}</span><span class="spacer"></span>
          <span class="${late ? 'camp-short' : 'camp-ok'}">${d.shared ? 'one shared duty for all studios' : `${d.done} of ${d.total} done`}</span></div>
        ${d.shared ? '' : `<div class="dm-bar"><i style="width:${pct}%"></i></div>`}
        ${(d.missing || []).length && !d.shared ? `<details class="dm-miss"><summary>Not done yet (${d.missing.length})</summary><div class="goal-note">${d.missing.map(k => esc(STUDIO_NAMES[k] || k)).join(' · ')}</div></details>` : ''}</div>`; }).join('')
      : '<div class="goal-note">No home office duties in this time.</div>'}</div>`;
}

// Tick off → "Who did this?" (today's team). Untick → back to not done.
function toggleDuty(id) {
  const t = _duties.find(x => String(x.id) === String(id));
  if (!t) return;
  if (t.status === 'complete') { saveDutyDone(t, false, null); return; }
  if (!_teamPeople.length) { saveDutyDone(t, true, null); return; }
  openDutySheet(`
    <h3>Who did this?</h3>
    <p>${esc(t.title)}</p>
    <div class="who-grid">${_teamPeople.map(p => `<button class="who-btn" onclick="pickDutyDoer('${escAttr(t.id)}','${escAttr(p.staff_id)}')">${hubAvatarHtml(p, 44)}${esc(p.name)}</button>`).join('')}</div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button onclick="pickDutyDoer('${escAttr(t.id)}','')">Skip, just mark it done</button></div>`);
}
function pickDutyDoer(id, staffId) {
  const t = _duties.find(x => String(x.id) === String(id));
  closeDutySheet();
  if (t) saveDutyDone(t, true, staffId || null);
}
async function saveDutyDone(t, done, staffId) {
  const { data: u } = await sb.auth.getUser();
  const patch = {
    status: done ? 'complete' : 'pending',
    completed_at: done ? new Date().toISOString() : null,
    completed_by: done && u && u.user ? u.user.id : null
  };
  if (_dutyHasStaffCol) patch.completed_by_staff_id = done ? staffId : null;
  let { error } = await sb.from('studio_tasks').update(patch).eq('id', t.id);
  if (error && /completed_by_staff_id/i.test(error.message)) {
    // hub_duties.sql not run yet: save without the person.
    _dutyHasStaffCol = false; delete patch.completed_by_staff_id;
    ({ error } = await sb.from('studio_tasks').update(patch).eq('id', t.id));
  }
  if (error) { alert("Couldn't save that: " + error.message); return; }
  Object.assign(t, patch);
  renderDuties();
}

// Edit: who it's for, and the studio's own note (home office's note stays as written).
function openDutyEdit(id) {
  const t = _duties.find(x => String(x.id) === String(id));
  if (!t) return;
  const people = _teamPeople.slice();
  if (t.assignee_id && !people.some(p => p.staff_id === t.assignee_id)) people.push({ staff_id: t.assignee_id, name: t.assignee_name || 'Someone' });
  openDutySheet(`
    <h3>${esc(t.title)}</h3>
    <p>${t.source === 'home_office' ? 'From home office' : 'A regular duty'}</p>
    ${t.notes ? `<div class="duty-note" style="margin-bottom:12px">${esc(t.notes)}</div>` : ''}
    <label class="f">Who
      <select id="duty-edit-who"><option value="">Anyone</option>${people.map(p => `<option value="${escAttr(p.staff_id)}"${p.staff_id === t.assignee_id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label class="f">Studio note<textarea id="duty-edit-note" maxlength="500" placeholder="e.g. Ran out of labels, finish tomorrow">${esc(t.studio_note || '')}</textarea></label>
    <div class="sheet-actions">
      <button onclick="closeDutySheet()">Cancel</button>
      <button class="primary" onclick="saveDutyEdit('${escAttr(t.id)}')">Save</button>
    </div>`);
  const ta = document.getElementById('duty-edit-note'); if (ta) ta.focus();
}
async function saveDutyEdit(id) {
  const t = _duties.find(x => String(x.id) === String(id));
  if (!t) return;
  const whoId = document.getElementById('duty-edit-who').value;
  const who = _teamPeople.find(p => p.staff_id === whoId) || (whoId && whoId === t.assignee_id ? { staff_id: t.assignee_id, name: t.assignee_name } : null);
  const patch = {
    assignee_id: who ? who.staff_id : null, assignee_name: who ? who.name : null,
    studio_note: document.getElementById('duty-edit-note').value.trim() || null
  };
  const { error } = await sb.from('studio_tasks').update(patch).eq('id', t.id);
  if (error) {
    alert(/studio_note/i.test(error.message) ? 'Studio notes need hub_duties.sql to be run in Supabase first.' : "Couldn't save: " + error.message);
    return;
  }
  Object.assign(t, patch);
  closeDutySheet(); renderDuties();
}

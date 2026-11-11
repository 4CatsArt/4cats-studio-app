// hub/studio-notes.js: ✍️ Studio notes on World: the note card on the Today screen (one studio) and
// Home office → ✍️ Studio notes (every studio). Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html.

// ✍️ (Nov 11 2026) Studio notes on World (world_studio_note_schedule.sql), home office only: scheduled ahead ("show from" /
// "until"), written for one studio or several at once; the picture is this studio's own, or the one for every studio
let _snote = null;
const snToday = () => localDateStr(new Date());
async function studioNoteLoad(sid) {
  const el = document.getElementById('studio-note-card'); if (!el || !sid) return;
  let r; try { r = await sb.rpc('hub_studio_notes', { p_studio: sid }); } catch (e) { return; }
  if (r.error || !r.data || !r.data.can_edit) { el.innerHTML = ''; return; }
  _snote = Object.assign({ sid }, r.data);
  const t = snToday(), N = _snote.notes || [];
  const live = N.filter(n => n.show_from <= t && (!n.show_until || n.show_until >= t)).sort((a, b) => b.show_from.localeCompare(a.show_from))[0];
  const ahead = N.filter(n => n.show_from > t).sort((a, b) => a.show_from.localeCompare(b.show_from));
  const line = n => `<div class="sn-line"><span class="fd-sm"><b>${esc(ptyDayLabel(n.show_from))}</b>${n.show_until ? ' – ' + esc(ptyDayLabel(n.show_until)) : ''}${n.studios_in_group > 1 ? ` · 🏬 ${n.studios_in_group} studios` : ''}</span>
      <span class="sn-snip">${esc(String(n.body).slice(0, 90))}${String(n.body).length > 90 ? '…' : ''}</span>
      <button class="ho-btn sm" onclick="studioNoteEdit('${escAttr(n.id)}')">Edit</button><button class="ho-btn sm" onclick="studioNoteRemove('${escAttr(n.id)}')">Remove</button></div>`;
  el.innerHTML = `<div class="pm-box sn-card"><b>✍️ Note on World</b>
    <button class="ho-btn sm" style="margin-left:8px" onclick="studioNoteEdit('')">+ New note</button><button class="ho-btn sm" onclick="_sns.studio='${escAttr(sid)}';openSnotesPane()">All studios’ notes →</button>
    <div style="margin-top:6px"><b class="fd-sm">Showing today:</b> ${live ? '' : '<span class="fd-sm">nothing</span>'}</div>${live ? line(live) : ''}
    ${ahead.length ? `<div style="margin-top:6px"><b class="fd-sm">Coming up (${ahead.length}):</b></div>${ahead.map(line).join('')}` : ''}</div>`;
}
function studioNoteEdit(id) {
  if (!_snote) return; const n = (_snote.notes || []).find(x => x.id === id) || {}, isNew = !id;
  const nm = String(STUDIO_NAMES[_snote.sid] || _snote.sid).replace(/^.*?\s-\s/, ''), photo = _snote.photo_studio || _snote.photo_all;
  const prov = { BC: 'BC', AB: 'Alberta', ON: 'Ontario' };
  const studioPick = isNew ? `<b style="display:block;margin:8px 0 4px">Which studios</b>
      <div class="sn-quick">${['all', 'BC', 'AB', 'ON'].map(k => `<button class="ho-btn sm" type="button" onclick="studioNotePick('${k}')">${k === 'all' ? 'All' : prov[k]}</button>`).join('')}<button class="ho-btn sm" type="button" onclick="studioNotePick('none')">None</button></div>
      <div class="sn-studios">${Object.keys(STUDIO_NAMES).map(sid => `<label class="ba-check"><input type="checkbox" class="sn-st" value="${escAttr(sid)}" ${sid === _snote.sid ? 'checked' : ''}> ${esc(STUDIO_NAMES[sid])}</label>`).join('')}</div>
      <p class="fd-sm">Each studio gets its own copy, so one can be changed or removed later without touching the others.</p>`
    : `<p class="fd-sm">For ${esc(STUDIO_NAMES[_snote.sid] || _snote.sid)} only${n.studios_in_group > 1 ? ` (written for ${n.studios_in_group} studios: the others keep theirs)` : ''}.</p>`;
  openDutySheet(`<h3>✍️ ${isNew ? 'New note' : 'Edit note'} on World</h3>
    <p class="ho-intro">Shows on each studio’s World home page from the start day (until the end day, if set). The newest started note shows; when it ends, the one before it shows again.</p>
    <div class="me-form">
      <div class="sup-two"><label>Show from<input type="date" id="sn-from" value="${escAttr(n.show_from || snToday())}"></label><label>Until (optional)<input type="date" id="sn-until" value="${escAttr(n.show_until || '')}"></label></div>
      <label>Heading (optional)<input id="sn-title" maxlength="120" value="${escAttr(n.title || '')}" placeholder="A Little Note from ${escAttr(nm)} (each studio's own name)"></label>
      <label>The note<textarea id="sn-body" rows="6" maxlength="2000" placeholder="e.g. We’re open and looking forward to a busy day of making! …">${esc(n.body || '')}</textarea></label>
      <label>Sign-off (optional)<textarea id="sn-signed" rows="2" maxlength="200" placeholder="See you at the studio,">${esc(n.signed || '')}</textarea></label>
      <label class="ba-check"><input type="checkbox" id="sn-auto" ${n.auto_staff === false ? '' : 'checked'}> Add the studio’s coordinator and that day’s staff after it (their 4Cats names: the coordinator first, then the published schedule)</label>
      ${studioPick}
      <div class="sn-ph"><b>Picture</b> ${photo ? `<img src="${escAttr(photo)}" alt="" style="max-width:160px;border-radius:8px;display:block;margin:6px 0">` : '<span class="fd-sm">none yet</span>'}
        <div class="fd-sm" style="margin:4px 0">${_snote.photo_studio ? 'This studio’s own picture (stays until changed).' : _snote.photo_all ? 'The picture for every studio (stays until changed).' : ''}</div>
        <label class="ho-btn sm">📷 This studio’s picture<input type="file" accept="image/*" hidden onchange="studioNotePhoto(this, '${escAttr(_snote.sid)}', '${escAttr(id)}')"></label>
        <label class="ho-btn sm">📷 Picture for every studio<input type="file" accept="image/*" hidden onchange="studioNotePhoto(this, '*', '${escAttr(id)}')"></label>
        ${_snote.photo_studio ? `<button class="ho-btn sm" onclick="studioNotePhotoClear('${escAttr(_snote.sid)}', '${escAttr(id)}')">Use the every-studio one</button>` : ''}</div>
      <div id="sn-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="studioNoteSave('${escAttr(id)}')">${isNew ? 'Save note' : 'Save'}</button></div>`);
}
function studioNotePick(k) { document.querySelectorAll('.sn-st').forEach(c => { c.checked = k === 'all' ? true : k === 'none' ? false : c.value.startsWith(k + '-') ? true : c.checked; }); }
async function studioNoteSave(id) {
  const v = x => (document.getElementById(x) || {}).value || '';
  const studios = [...document.querySelectorAll('.sn-st:checked')].map(c => c.value);
  const { data, error } = await sb.rpc('hub_studio_note_put', { p: { id: id || null, studios, title: v('sn-title'), body: v('sn-body'), signed: v('sn-signed'), show_from: v('sn-from'), show_until: v('sn-until'), auto_staff: document.getElementById('sn-auto').checked } });
  if (error) { document.getElementById('sn-msg').innerHTML = `<p class="fd-msg">${esc(/hub_studio_note_put/.test(error.message) ? 'Run world_studio_note_schedule.sql in Supabase first.' : error.message)}</p>`; return; }
  closeDutySheet(); studioNoteLoad(_snote.sid);
  if (!id && data && data.studios > 1) alert(`✓ Saved for ${data.studios} studios.`);
}
async function studioNoteRemove(id) {
  if (!confirm('Remove this note (for this studio only)?')) return;
  const { error } = await sb.rpc('hub_studio_note_remove', { p_id: id }); if (error) { alert(error.message); return; }
  studioNoteLoad(_snote.sid);
}
async function studioNotePhoto(inp, key, reopen) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const urls = await rpUploadFiles([f], 'studio-notes'); if (!urls[0]) return;
  const { error } = await sb.rpc('hub_studio_note_photo', { p_key: key, p_url: urls[0] }); if (error) { alert(error.message); return; }
  await studioNoteLoad(_snote.sid); studioNoteEdit(reopen);
}
async function studioNotePhotoClear(key, reopen) {
  const { error } = await sb.rpc('hub_studio_note_photo', { p_key: key, p_url: '' }); if (error) { alert(error.message); return; }
  await studioNoteLoad(_snote.sid); studioNoteEdit(reopen);
}

// ---------- Home office → ✍️ Studio notes (world_studio_notes_page.sql): every studio's World note in one table ----------
let _sns = { rows: null, photos: {}, err: '', studio: '', prov: '', status: 'current', msg: '' };
async function openSnotesPane() {
  if (!_hoCan.edit) { alert('Studio notes is for home office (Studio Ops edit access).'); return; }
  showOnlyPane('snotes-pane'); setActiveNav('nav-snotes'); snsLoad();
}
async function snsLoad() {
  _sns.rows = null; snsDraw();
  const { data, error } = await sb.rpc('hub_studio_notes_all');
  _sns.err = error ? (/hub_studio_notes_all/.test(error.message) ? 'Run world_studio_notes_page.sql in Supabase first.' : error.message) : '';
  _sns.rows = error ? [] : (data.notes || []); _sns.photos = error ? {} : (data.photos || {}); snsDraw();
}
function snsStatus(n, t) { return n.show_from > t ? 'upcoming' : (n.show_until && n.show_until < t) ? 'ended' : 'live'; }
function snsDraw() {
  const el = document.getElementById('snotes-pane'); if (!el) return;
  const t = localDateStr(new Date()), R = _sns.rows || [];
  // what each studio shows today: its newest started, not-ended note
  const liveBy = {}; R.filter(n => snsStatus(n, t) === 'live').forEach(n => { const c = liveBy[n.studio_id]; if (!c || n.show_from > c.show_from || (n.show_from === c.show_from && n.updated_at > c.updated_at)) liveBy[n.studio_id] = n; });
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">✍️ Studio notes</div><span class="spacer"></span>
      <button class="ho-btn primary" onclick="snsEdit(null)">+ New note</button><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <p class="ho-intro">The little note on each studio’s World home page. Each studio shows its newest note that has started (and hasn’t ended); when it ends, the one before it shows again.</p>`;
  if (_sns.msg) h += `<p class="fd-msg">${esc(_sns.msg)}</p>`;
  if (_sns.err) { el.innerHTML = h + `<p class="fd-msg">${esc(_sns.err)}</p>`; return; }
  if (!_sns.rows) { el.innerHTML = h + '<p class="goal-note">Loading…</p>'; return; }
  const ids = Object.keys(STUDIO_NAMES), none = ids.filter(id => !liveBy[id]);
  h += `<div class="sup-tools">
      <select onchange="_sns.prov=this.value;snsDraw()">${[['', 'All provinces'], ['BC', 'BC'], ['AB', 'Alberta'], ['ON', 'Ontario']].map(([k, l]) => `<option value="${k}"${_sns.prov === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select onchange="_sns.studio=this.value;snsDraw()"><option value="">All studios</option>${ids.map(id => `<option value="${escAttr(id)}"${_sns.studio === id ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('')}</select>
      <select onchange="_sns.status=this.value;snsDraw()">${[['current', 'Showing now and coming up'], ['live', 'Showing today'], ['upcoming', 'Coming up'], ['ended', 'Ended (last 30 days)'], ['none', `Studios with no note today (${none.length})`], ['all', 'Everything']].map(([k, l]) => `<option value="${k}"${_sns.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
  const inScope = id => (!_sns.prov || id.startsWith(_sns.prov + '-')) && (!_sns.studio || id === _sns.studio);
  if (_sns.status === 'none') {
    const list = none.filter(inScope);
    h += list.length ? `<div class="card">${list.map(id => `<div class="sn-line"><b>${esc(STUDIO_NAMES[id])}</b><span class="spacer" style="flex:1"></span><button class="ho-btn sm" onclick="snsEdit(null, '${escAttr(id)}')">+ Write one</button></div>`).join('')}</div>` : '<p class="goal-note">Every studio has a note showing today.</p>';
  } else {
    const rows = R.filter(n => inScope(n.studio_id)).filter(n => { const st = snsStatus(n, t); return _sns.status === 'all' || (_sns.status === 'current' ? st !== 'ended' : st === _sns.status); })
      .sort((a, b) => (a.show_from < b.show_from ? 1 : a.show_from > b.show_from ? -1 : String(STUDIO_NAMES[a.studio_id] || '').localeCompare(String(STUDIO_NAMES[b.studio_id] || ''))));
    // notes written together: one row, with how many studios
    const seen = new Set(), out = [];
    rows.forEach(n => { if (n.group_id) { if (seen.has(n.group_id)) return; seen.add(n.group_id); out.push(Object.assign({}, n, { _copies: rows.filter(x => x.group_id === n.group_id) })); } else out.push(n); });
    h += out.length ? `<table class="fd-tbl sup-tbl"><thead><tr><th>Studio</th><th>Shows</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>${out.map(n => {
        const st = snsStatus(n, t), copies = n._copies || [n], many = copies.length > 1;
        const onToday = copies.filter(c => liveBy[c.studio_id] && liveBy[c.studio_id].id === c.id).length;
        const stTxt = st === 'live' ? (onToday === copies.length ? '<span class="sns-live">● Showing</span>' : onToday ? `<span class="sns-live">● Showing at ${onToday}</span>` : '<span class="goal-note" title="A newer note is showing">Hidden by a newer note</span>') : st === 'upcoming' ? '<span class="sns-up">Coming up</span>' : '<span class="goal-note">Ended</span>';
        return `<tr><td>${many ? `<b>🏬 ${copies.length} studios</b><div class="goal-note">${esc(copies.map(c => String(STUDIO_NAMES[c.studio_id] || c.studio_id).replace(/^.*?\s-\s/, '')).slice(0, 6).join(', '))}${copies.length > 6 ? '…' : ''}</div>` : esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</td>
          <td style="white-space:nowrap">${esc(ptyDayLabel(n.show_from))}${n.show_until ? ' – ' + esc(ptyDayLabel(n.show_until)) : ' on'}</td>
          <td>${n.title ? `<b>${esc(n.title)}</b><br>` : ''}<span class="sn-snip">${esc(String(n.body).slice(0, 110))}${String(n.body).length > 110 ? '…' : ''}</span></td>
          <td>${stTxt}</td>
          <td style="white-space:nowrap"><button class="ho-btn sm" onclick="snsEdit('${escAttr(n.id)}')">Edit</button><button class="ho-btn sm" onclick="snsRemove('${escAttr(n.id)}')">Remove</button></td></tr>`; }).join('')}</tbody></table>`
      : '<p class="goal-note">No notes here.</p>';
  }
  // pictures
  const P = _sns.photos || {};
  h += `<details class="card" style="margin-top:14px"><summary><b>📷 Note pictures</b> <span class="goal-note">${P['*'] ? 'every-studio picture set' : 'no every-studio picture'} · ${Object.keys(P).filter(k => k !== '*').length} studios with their own</span></summary>
    <div class="sn-line"><b>Every studio</b>${P['*'] ? `<img src="${escAttr(P['*'])}" alt="" class="sns-ph">` : '<span class="goal-note">none</span>'}<span class="spacer" style="flex:1"></span>
      <label class="ho-btn sm">📷 Change<input type="file" accept="image/*" hidden onchange="snsPhoto(this, '*')"></label>${P['*'] ? `<button class="ho-btn sm" onclick="snsPhotoClear('*')">Remove</button>` : ''}</div>
    ${ids.filter(inScope).map(id => `<div class="sn-line"><span>${esc(STUDIO_NAMES[id])}</span>${P[id] ? `<img src="${escAttr(P[id])}" alt="" class="sns-ph">` : '<span class="goal-note">uses the every-studio picture</span>'}<span class="spacer" style="flex:1"></span>
      <label class="ho-btn sm">📷 Own picture<input type="file" accept="image/*" hidden onchange="snsPhoto(this, '${escAttr(id)}')"></label>${P[id] ? `<button class="ho-btn sm" onclick="snsPhotoClear('${escAttr(id)}')">Use the every-studio one</button>` : ''}</div>`).join('')}</details>`;
  el.innerHTML = h;
}
// new note (one, a province or all studios), or edit one (this studio's copy, or every copy written together)
function snsEdit(id, forStudio) {
  const n = id ? (_sns.rows || []).find(x => x.id === id) : null, copies = n && n.group_id ? (_sns.rows || []).filter(x => x.group_id === n.group_id) : [];
  const prov = { BC: 'BC', AB: 'Alberta', ON: 'Ontario' }, pre = forStudio || _sns.studio || '';
  openDutySheet(`<h3>✍️ ${n ? 'Edit note' : 'New note'}</h3>
    <div class="me-form">
      <div class="sup-two"><label>Show from<input type="date" id="sns-from" value="${escAttr((n && n.show_from) || localDateStr(new Date()))}"></label><label>Until (optional)<input type="date" id="sns-until" value="${escAttr((n && n.show_until) || '')}"></label></div>
      <label>Heading (optional)<input id="sns-title" maxlength="120" value="${escAttr((n && n.title) || '')}" placeholder="A Little Note from (each studio's own name)"></label>
      <label>The note<textarea id="sns-body" rows="6" maxlength="2000">${esc((n && n.body) || '')}</textarea></label>
      <label>Sign-off (optional)<textarea id="sns-signed" rows="2" maxlength="200" placeholder="See you at the studio,">${esc((n && n.signed) || '')}</textarea></label>
      <label class="ba-check"><input type="checkbox" id="sns-auto" ${n && n.auto_staff === false ? '' : 'checked'}> Add the studio’s coordinator and that day’s staff after it (their 4Cats names: the coordinator first, then the published schedule)</label>
      ${n ? (copies.length > 1 ? `<label class="ba-check"><input type="radio" name="sns-scope" value="all" checked> Change all ${copies.length} studios’ copies</label>
          <label class="ba-check"><input type="radio" name="sns-scope" value="one"> Only ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</label>` : `<p class="fd-sm">For ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}.</p>`)
        : `<b style="display:block;margin:8px 0 4px">Which studios</b>
          <div class="sn-quick">${['all', 'BC', 'AB', 'ON'].map(k => `<button class="ho-btn sm" type="button" onclick="studioNotePick('${k}')">${k === 'all' ? 'All' : prov[k]}</button>`).join('')}<button class="ho-btn sm" type="button" onclick="studioNotePick('none')">None</button></div>
          <div class="sn-studios">${Object.keys(STUDIO_NAMES).map(sid => `<label class="ba-check"><input type="checkbox" class="sn-st" value="${escAttr(sid)}" ${sid === pre ? 'checked' : ''}> ${esc(STUDIO_NAMES[sid])}</label>`).join('')}</div>`}
      <div id="sns-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="snsSave('${escAttr(id || '')}')">Save</button></div>`);
}
async function snsSave(id) {
  const v = x => (document.getElementById(x) || {}).value || '';
  const p = { title: v('sns-title'), body: v('sns-body'), signed: v('sns-signed'), show_from: v('sns-from'), show_until: v('sns-until'), auto_staff: document.getElementById('sns-auto').checked };
  const n = id ? (_sns.rows || []).find(x => x.id === id) : null;
  const scope = (document.querySelector('input[name="sns-scope"]:checked') || {}).value;
  let r;
  if (n && n.group_id && scope === 'all') r = await sb.rpc('hub_studio_note_group_put', { p_group: n.group_id, p });
  else r = await sb.rpc('hub_studio_note_put', { p: Object.assign(p, { id: id || null, studios: id ? [] : [...document.querySelectorAll('.sn-st:checked')].map(c => c.value) }) });
  if (r.error) { document.getElementById('sns-msg').innerHTML = `<p class="fd-msg">${esc(r.error.message)}</p>`; return; }
  closeDutySheet(); _sns.msg = `✓ Saved${r.data && r.data.studios > 1 ? ' for ' + r.data.studios + ' studios' : ''}.`; snsLoad();
}
async function snsRemove(id) {
  const n = (_sns.rows || []).find(x => x.id === id); if (!n) return;
  const copies = n.group_id ? (_sns.rows || []).filter(x => x.group_id === n.group_id) : [n];
  let r;
  if (copies.length > 1) {
    const all = confirm(`This note is on ${copies.length} studios. OK = remove it from all ${copies.length}. Cancel = choose one studio instead.`);
    if (all) r = await sb.rpc('hub_studio_note_group_remove', { p_group: n.group_id });
    else { const which = prompt('Remove it from which studio? Type part of its name:'); if (!which) return;
      const c = copies.find(x => String(STUDIO_NAMES[x.studio_id] || x.studio_id).toLowerCase().includes(which.toLowerCase())); if (!c) { alert('No studio with that name has this note.'); return; }
      r = await sb.rpc('hub_studio_note_remove', { p_id: c.id }); }
  } else { if (!confirm('Remove this note?')) return; r = await sb.rpc('hub_studio_note_remove', { p_id: id }); }
  if (r.error) { alert(r.error.message); return; }
  _sns.msg = '✓ Removed.'; snsLoad();
}
async function snsPhoto(inp, key) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const urls = await rpUploadFiles([f], 'studio-notes'); if (!urls[0]) return;
  const { error } = await sb.rpc('hub_studio_note_photo', { p_key: key, p_url: urls[0] }); if (error) { alert(error.message); return; }
  snsLoad();
}
async function snsPhotoClear(key) { const { error } = await sb.rpc('hub_studio_note_photo', { p_key: key, p_url: '' }); if (error) { alert(error.message); return; } snsLoad(); }

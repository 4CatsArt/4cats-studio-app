// hub/studio-notes.js: ✍️ Studio notes on World: the note card on the Today screen (one studio) and
// Home office → ✍️ Studio notes (every studio). Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html.

// ✍️ (Nov 11 2026) Studio notes on World (world_studio_note_schedule.sql), home office only: scheduled ahead ("show from" /
// "until"), written for one studio or several at once; the picture is this studio's own, or the one for every studio.
// The Today card only shows them (Nov 11 2026): notes are added, changed and removed on the ✍️ Studio notes page.
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
      <span class="sn-snip">${esc(snPlain(n.body).slice(0, 90))}${snPlain(n.body).length > 90 ? '…' : ''}</span></div>`;
  el.innerHTML = `<div class="pm-box sn-card"><b>✍️ Note on World</b>
    <button class="ho-btn sm" style="margin-left:8px" onclick="_sns.studio='${escAttr(sid)}';openSnotesPane()" title="Add, change or remove notes on the Studio notes page">Add or change notes in Studio notes →</button>
    <div style="margin-top:6px"><b class="fd-sm">Showing today:</b> ${live ? '' : '<span class="fd-sm">nothing</span>'}</div>${live ? line(live) : ''}
    ${ahead.length ? `<div style="margin-top:6px"><b class="fd-sm">Coming up (${ahead.length}):</b></div>${ahead.map(line).join('')}` : ''}</div>`;
}
// 🔗 (Nov 12 2026) Links in a note: [the words](https://…) shows as a link on World (and a bare web address becomes one too)
function snPlain(t) { return String(t || '').replace(/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)/g, '$1'); }
function snsAddLink() {
  const ta = document.getElementById('sns-body'); if (!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd, picked = ta.value.slice(a, b).trim();
  let url = (prompt('The web address for the link (for example https://world.4cats.com/#camps):', 'https://') || '').trim();
  if (!url || url === 'https://') return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  const words = picked || (prompt('The words people click on:', 'Find out more') || '').trim();
  if (!words) return;
  const ins = '[' + words.replace(/[\[\]]/g, '') + '](' + url.replace(/[\s)]/g, '') + ')';
  ta.value = ta.value.slice(0, a) + ins + ta.value.slice(b);
  ta.focus(); ta.selectionStart = ta.selectionEnd = a + ins.length;
}
function studioNotePick(k) { document.querySelectorAll('.sn-st').forEach(c => { c.checked = k === 'all' ? true : k === 'none' ? false : c.value.startsWith(k + '-') ? true : c.checked; }); }

// ---------- Home office → ✍️ Studio notes (world_studio_notes_page.sql): every studio's World note in one table ----------
let _sns = { rows: null, photos: {}, err: '', studio: '', prov: '', status: 'current', msg: '' };
async function openSnotesPane() {
  // Who can open it: “World site & deals” (Edit) on access.html. The server decides (perm_can); a refusal shows on the page.
  showOnlyPane('snotes-pane'); setActiveNav('nav-snotes'); snsLoad();
}
async function snsLoad() {
  _sns.rows = null; snsDraw();
  const { data, error } = await sb.rpc('hub_studio_notes_all');
  _sns.err = error ? (/hub_studio_notes_all/.test(error.message) ? 'Run world_studio_notes_page.sql in Supabase first.' : error.message) : '';
  _sns.rows = error ? [] : (data.notes || []); _sns.photos = error ? {} : (data.photos || {});
  try { const ps = await sb.rpc('hub_note_photo_schedule'); _sns.sched = ps.error ? null : (ps.data || []); } catch (e) { _sns.sched = null; }   // 🗓 (Nov 12 2026) scheduled default pictures
  try { const fc = await sb.rpc('hub_note_follow_counts'); _sns.follows = fc.error ? {} : (fc.data || {}); } catch (e) { _sns.follows = {}; }   // ✉️ (Nov 12 2026) followers by email
  snsDraw();
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
  { const F = _sns.follows || {}, tot = Object.values(F).reduce((a, b) => a + Number(b || 0), 0);
    h += `<p class="goal-note" style="margin-top:-6px">✉️ ${tot ? `<b>${tot}</b> ${tot === 1 ? 'person follows' : 'people follow'} studio notes by email (they tick it on the studio’s World page). A note is emailed to its studio’s followers once, on the day it starts showing, around 8am there.` : 'Customers can follow a studio’s notes by email from its World page. A note is emailed to its followers on the day it starts showing.'}</p>`; }
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
        return `<tr><td>${many ? `<b>🏬 ${copies.length} studios</b><div class="goal-note">${copies.map(c => `<a href="#" onclick="snsEdit('${escAttr(c.id)}', null, 'one');return false" title="Edit only this studio’s copy">${esc(String(STUDIO_NAMES[c.studio_id] || c.studio_id).replace(/^.*?\s-\s/, ''))}</a>`).join(', ')}</div>` : esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</td>
          <td style="white-space:nowrap">${esc(ptyDayLabel(n.show_from))}${n.show_until ? ' – ' + esc(ptyDayLabel(n.show_until)) : ' on'}</td>
          <td>${n.title ? `<b>${esc(n.title)}</b><br>` : ''}<span class="sn-snip">${esc(snPlain(n.body).slice(0, 110))}${snPlain(n.body).length > 110 ? '…' : ''}</span></td>
          <td>${stTxt}${n.emailed_at ? `<div class="goal-note">✉️ Emailed to ${Number(n.emailed_count || 0)}</div>` : (!many && (_sns.follows || {})[n.studio_id] ? `<div class="goal-note">✉️ ${Number(_sns.follows[n.studio_id])} following</div>` : '')}</td>
          <td style="white-space:nowrap"><button class="ho-btn sm" onclick="snsEdit('${escAttr(n.id)}')">Edit</button><button class="ho-btn sm" onclick="snsRemove('${escAttr(n.id)}')">Remove</button></td></tr>`; }).join('')}</tbody></table>`
      : '<p class="goal-note">No notes here.</p>';
  }
  h += snsSchedHtml();
  // pictures
  const P = _sns.photos || {};
  h += `<details class="card" style="margin-top:14px"><summary><b>📷 Note pictures</b> <span class="goal-note">${P['*'] ? 'every-studio picture set' : 'no every-studio picture'} · ${Object.keys(P).filter(k => k !== '*').length} studios with their own</span></summary>
    <div class="sn-line"><b>Every studio</b>${P['*'] ? `<img src="${escAttr(P['*'])}" alt="" class="sns-ph">` : '<span class="goal-note">none</span>'}<span class="spacer" style="flex:1"></span>
      <label class="ho-btn sm">📷 Change<input type="file" accept="image/*" hidden onchange="snsPhoto(this, '*')"></label><button class="ho-btn sm" onclick="snsLibOpen('*')">🖼 Library</button>${P['*'] ? `<button class="ho-btn sm" onclick="snsPhotoLink('*')">🔗 Link</button>` : ''}${P['*'] ? `<button class="ho-btn sm" onclick="snsPhotoClear('*')">Remove</button>` : ''}</div>
    ${ids.filter(inScope).map(id => `<div class="sn-line"><span>${esc(STUDIO_NAMES[id])}</span>${P[id] ? `<img src="${escAttr(P[id])}" alt="" class="sns-ph">` : '<span class="goal-note">uses the every-studio picture</span>'}<span class="spacer" style="flex:1"></span>
      <label class="ho-btn sm">📷 Own picture<input type="file" accept="image/*" hidden onchange="snsPhoto(this, '${escAttr(id)}')"></label><button class="ho-btn sm" onclick="snsLibOpen('${escAttr(id)}')">🖼 Library</button>${P[id] ? `<button class="ho-btn sm" onclick="snsPhotoLink('${escAttr(id)}')">🔗 Link</button>` : ''}${P[id] ? `<button class="ho-btn sm" onclick="snsPhotoClear('${escAttr(id)}')">Use the every-studio one</button>` : ''}</div>`).join('')}</details>`;
  el.innerHTML = h;
}
// new note (one, a province or all studios), or edit one (this studio's copy, or every copy written together)
function snsEdit(id, forStudio, preScope) {
  const n = id ? (_sns.rows || []).find(x => x.id === id) : null, copies = n && n.group_id ? (_sns.rows || []).filter(x => x.group_id === n.group_id) : [];
  const prov = { BC: 'BC', AB: 'Alberta', ON: 'Ontario' }, pre = forStudio || _sns.studio || '';
  openDutySheet(`<h3>✍️ ${n ? 'Edit note' : 'New note'}</h3>
    <div class="me-form">
      <div class="sup-two"><label>Show from<input type="date" id="sns-from" value="${escAttr((n && n.show_from) || localDateStr(new Date()))}"></label><label>Until (optional)<input type="date" id="sns-until" value="${escAttr((n && n.show_until) || '')}"></label></div>
      <label>Heading (optional)<input id="sns-title" maxlength="120" value="${escAttr((n && n.title) || '')}" placeholder="💌 A little note from 4Cats (each studio’s name), if left blank"></label>
      <label>The note<textarea id="sns-body" rows="6" maxlength="2000">${esc((n && n.body) || '')}</textarea></label><div class="fd-sm" style="margin:-4px 0 8px"><button class="ho-btn sm" type="button" onclick="snsAddLink()">🔗 Add a link</button> Highlight some words first to turn them into the link. A web address typed into the note becomes clickable too.</div>
      <label>Sign-off (optional)<textarea id="sns-signed" rows="2" maxlength="200" placeholder="See you at the studio! (if left blank)">${esc((n && n.signed) || '')}</textarea></label>
      <div class="sns-photo-row" style="margin:6px 0 10px"><b style="display:block;margin-bottom:4px">📷 Picture for this note (optional)</b>
        <input type="hidden" id="sns-photo" value="${escAttr((n && n.photo) || '')}">
        <div id="sns-photo-prev">${snsPhotoPrev((n && n.photo) || '')}</div>
        <label class="ho-btn sm">📷 ${n && n.photo ? 'Change' : 'Add a picture'}<input type="file" accept="image/*" hidden onchange="snsNotePhoto(this)"></label> <button class="ho-btn sm" type="button" onclick="snsLibOpen('note')">🖼 Choose from library</button>
        <label style="display:block;margin:6px 0 2px">🔗 Link when the picture is tapped (optional)<input id="sns-photo-link" type="url" placeholder="https://world.4cats.com/#classes" value="${escAttr((n && n.photo_link) || '')}"></label>
        <span class="fd-sm">Shows only while this note shows. No picture here: a scheduled default picture for the day, else the studio’s own, else the one for every studio.</span></div>
      <label class="ba-check"><input type="checkbox" id="sns-auto" ${n && n.auto_staff === false ? '' : 'checked'}> Add the studio’s coordinator and that day’s staff after it (their 4Cats names: the coordinator first, then the published schedule)</label>
      ${n ? (copies.length > 1 ? `<label class="ba-check"><input type="radio" name="sns-scope" value="all" ${preScope === 'one' ? '' : 'checked'}> Change all ${copies.length} studios’ copies</label>
          <label class="ba-check"><input type="radio" name="sns-scope" value="one" ${preScope === 'one' ? 'checked' : ''}> Only ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)} <span class="fd-sm">(it becomes its own note, with its own text)</span></label>` : `<p class="fd-sm">For ${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}.</p>`) + snsAlsoHtml(n, copies)
        : `<b style="display:block;margin:8px 0 4px">Which studios</b>
          <div class="sn-quick">${['all', 'BC', 'AB', 'ON'].map(k => `<button class="ho-btn sm" type="button" onclick="studioNotePick('${k}')">${k === 'all' ? 'All' : prov[k]}</button>`).join('')}<button class="ho-btn sm" type="button" onclick="studioNotePick('none')">None</button></div>
          <div class="sn-studios">${Object.keys(STUDIO_NAMES).map(sid => `<label class="ba-check"><input type="checkbox" class="sn-st" value="${escAttr(sid)}" ${sid === pre ? 'checked' : ''}> ${esc(STUDIO_NAMES[sid])}</label>`).join('')}</div>`}
      <div id="sns-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="snsSave('${escAttr(id || '')}')">Save</button></div>`);
}
async function snsSave(id) {
  const v = x => (document.getElementById(x) || {}).value || '';
  const p = { title: v('sns-title'), body: v('sns-body'), signed: v('sns-signed').trim() || 'See you at the studio!', photo: v('sns-photo'), photo_link: snsLink(v('sns-photo-link')),   // 📷 (Nov 12 2026) the note's own picture ('' = none) and its link
      // (Nov 12 2026) the default sign-off
    show_from: v('sns-from'), show_until: v('sns-until'), auto_staff: document.getElementById('sns-auto').checked };
  const n = id ? (_sns.rows || []).find(x => x.id === id) : null;
  const scope = (document.querySelector('input[name="sns-scope"]:checked') || {}).value;
  let r;
  if (n && n.group_id && scope === 'all') r = await sb.rpc('hub_studio_note_group_put', { p_group: n.group_id, p });
  else r = await sb.rpc('hub_studio_note_put', { p: Object.assign(p, { id: id || null, detach: !!(n && n.group_id && scope === 'one'), studios: id ? [] : [...document.querySelectorAll('.sn-st:checked')].map(c => c.value) }) });
  if (r.error) { document.getElementById('sns-msg').innerHTML = `<p class="fd-msg">${esc(r.error.message)}</p>`; return; }
  let added = 0;
  const also = [...document.querySelectorAll('.sn-also:checked')].map(c => c.value);
  if (n && also.length) {   // 🏬 (Nov 12 2026) also post it at more studios: copies in the same group
    const c = await sb.rpc('hub_studio_note_copy', { p_id: n.id, p_studios: also });
    if (c.error) { document.getElementById('sns-msg').innerHTML = `<p class="fd-msg">Saved, but copying didn’t work: ${esc(c.error.message)}</p>`; snsLoad(); return; }
    added = (c.data && c.data.added) || 0;
  }
  closeDutySheet(); _sns.msg = `✓ Saved${r.data && r.data.studios > 1 ? ' for ' + r.data.studios + ' studios' : ''}${added ? `, and posted at ${added} more studio${added === 1 ? '' : 's'}` : ''}.`; snsLoad();
}
// 🗓 (Nov 12 2026) Scheduled default pictures: a picture for a date range (every studio, or chosen ones), used by any note
// without its own picture while the dates last (world_note_photo_for: the note's own → scheduled → the studio's → every studio's)
function snsSchedHtml() {
  const S = _sns.sched; if (S === null || S === undefined) return '';
  const t = localDateStr(new Date()), nm = x => (x.studio_ids && x.studio_ids.length) ? x.studio_ids.map(id => String(STUDIO_NAMES[id] || id).replace(/^.*?\s-\s/, '')).join(', ') : 'Every studio';
  return `<details class="card" style="margin-top:14px"${S.length ? ' open' : ''}><summary><b>🗓 Scheduled default pictures</b> <span class="goal-note">${S.filter(x => x.starts_on <= t && x.ends_on >= t).length} showing today · ${S.length} in all</span></summary>
    <p class="goal-note" style="margin:6px 0">A note without its own picture uses one of these while its dates last: a studio’s own schedule first, then one for every studio. Outside these dates, the pictures below are used.</p>
    ${S.length ? S.map(x => `<div class="sn-line"><img src="${escAttr(x.url)}" alt="" class="sns-ph"><span><b>${esc(x.label || 'Picture')}</b><br><span class="goal-note">${esc(ptyDayLabel(x.starts_on))} – ${esc(ptyDayLabel(x.ends_on))} · ${esc(nm(x))}${x.link ? ' · 🔗 ' + esc(String(x.link).replace(/^https?:\/\//, '').slice(0, 40)) : ''}${x.starts_on <= t && x.ends_on >= t ? ' · <b>showing now</b>' : ''}</span></span>
      <span class="spacer" style="flex:1"></span><button class="ho-btn sm" onclick="snsSchedRemove('${escAttr(x.id)}')">Remove</button></div>`).join('') : '<p class="goal-note">None yet.</p>'}
    <button class="ho-btn sm" style="margin-top:8px" onclick="snsSchedAdd()">+ Schedule a picture</button></details>`;
}
function snsSchedAdd() {
  openDutySheet(`<h3>🗓 Schedule a default picture</h3><div class="me-form">
    <label>Name (for you)<input id="sps-label" maxlength="80" placeholder="Holidays"></label>
    <div class="sup-two"><label>From<input type="date" id="sps-from" value="${escAttr(localDateStr(new Date()))}"></label><label>Until<input type="date" id="sps-until"></label></div>
    <input type="hidden" id="sns-photo" value=""><b style="display:block;margin:6px 0 4px">The picture</b><div id="sns-photo-prev"></div>
    <label class="ho-btn sm">📷 Choose a picture<input type="file" accept="image/*" hidden onchange="snsNotePhoto(this)"></label> <button class="ho-btn sm" type="button" onclick="snsLibOpen('note')">🖼 Choose from library</button>
    <label style="display:block;margin:8px 0 2px">🔗 Link when the picture is tapped (optional)<input id="sps-link" type="url" placeholder="https://world.4cats.com/#workshops"></label>
    <details style="margin:10px 0"><summary><b>Studios</b> <span class="fd-sm">(none ticked = every studio)</span></summary>
      <div class="sn-studios">${Object.keys(STUDIO_NAMES).map(sid => `<label class="ba-check"><input type="checkbox" class="sps-st" value="${escAttr(sid)}"> ${esc(STUDIO_NAMES[sid])}</label>`).join('')}</div></details>
    <div id="sps-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="snsSchedSave()">Save</button></div>`);
}
async function snsSchedSave() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const { error } = await sb.rpc('hub_note_photo_schedule_put', { p: { url: v('sns-photo'), link: snsLink(v('sps-link')), label: v('sps-label'), starts_on: v('sps-from'), ends_on: v('sps-until'),
    studios: [...document.querySelectorAll('.sps-st:checked')].map(c => c.value) } });
  if (error) { document.getElementById('sps-msg').innerHTML = `<p class="fd-msg">${esc(error.message)}</p>`; return; }
  closeDutySheet(); _sns.msg = '✓ Picture scheduled.'; snsLoad();
}
async function snsSchedRemove(id) {
  if (!confirm('Remove this scheduled picture?')) return;
  const { error } = await sb.rpc('hub_note_photo_schedule_remove', { p_id: id }); if (error) { alert(error.message); return; }
  _sns.msg = '✓ Removed.'; snsLoad();
}
// 🖼 (Nov 12 2026) Choose a picture already in storage (the retail-media bucket, where the Hub's uploads go), newest first.
// target 'note' = the open note / schedule sheet's picture; a studio id or '*' = that studio's (every studio's) picture.
let _lib = { folder: 'studio-notes', target: null, folders: null };
const LIB_IMG = /\.(jpe?g|png|gif|webp|avif)$/i;
async function snsLibOpen(target) {
  _lib.target = target;
  let box = document.getElementById('sns-lib');
  if (!box) { box = document.createElement('div'); box.id = 'sns-lib'; document.body.appendChild(box); }
  box.setAttribute('style', 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10050;display:flex;align-items:center;justify-content:center');
  box.onclick = e => { if (e.target === box) snsLibClose(); };
  if (!_lib.folders) {
    const { data } = await sb.storage.from('retail-media').list('', { limit: 100 });
    _lib.folders = (data || []).filter(x => !x.id).map(x => x.name).sort();   // (folders have no id)
    if (_lib.folders.indexOf('studio-notes') < 0) _lib.folders.unshift('studio-notes');
  }
  snsLibLoad();
}
function snsLibClose() { const b = document.getElementById('sns-lib'); if (b) b.remove(); }
async function snsLibLoad() {
  const box = document.getElementById('sns-lib'); if (!box) return;
  const shell = inner => `<div style="background:#fff;border-radius:14px;padding:16px 18px;width:min(860px,94vw);max-height:86vh;overflow:auto">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><b style="font-size:17px">🖼 Choose a picture</b>
      <select onchange="_lib.folder=this.value;snsLibLoad()">${(_lib.folders || []).map(f => `<option value="${escAttr(f)}"${f === _lib.folder ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <span style="flex:1"></span><button class="ho-btn sm" onclick="snsLibClose()">Close</button></div>${inner}</div>`;
  box.innerHTML = shell('<p class="goal-note">Loading…</p>');
  const { data, error } = await sb.storage.from('retail-media').list(_lib.folder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) { box.innerHTML = shell(`<p class="fd-msg">The library couldn’t be opened: ${esc(error.message)}</p>`); return; }
  const pics = (data || []).filter(x => x.id && LIB_IMG.test(x.name));
  box.innerHTML = shell(pics.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">${pics.map(x => {
      const url = sb.storage.from('retail-media').getPublicUrl(_lib.folder + '/' + x.name).data.publicUrl;
      return `<button type="button" onclick="snsLibPick('${escAttr(url)}')" title="${escAttr(x.name)}" style="border:1px solid #eadfce;border-radius:10px;padding:4px;background:#fff;cursor:pointer">
        <img src="${escAttr(url)}" alt="" loading="lazy" style="width:100%;height:110px;object-fit:cover;border-radius:7px;display:block"></button>`; }).join('')}</div>`
    : '<p class="goal-note">No pictures in this folder yet.</p>');
}
async function snsLibPick(url) {
  const t = _lib.target; snsLibClose();
  if (t === 'note') {   // the note (or schedule) sheet that's open
    const inp = document.getElementById('sns-photo'); if (!inp) return;
    inp.value = url; const prev = document.getElementById('sns-photo-prev'); if (prev) prev.innerHTML = snsPhotoPrev(url);
    return;
  }
  const { error } = await sb.rpc('hub_studio_note_photo', { p_key: t, p_url: url });   // a studio's (or every studio's) picture
  if (error) { alert(error.message); return; }
  _sns.msg = '✓ Picture set.'; snsLoad();
}
// 🔗 (Nov 12 2026) A picture's link: a web address ('' = none); "world.4cats.com/…" gets https:// added
function snsLink(v) { v = String(v || '').trim(); return !v ? '' : /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, ''); }
async function snsPhotoLink(key) {
  const v = prompt(`Link when ${key === '*' ? 'the every-studio picture' : (STUDIO_NAMES[key] || key) + '’s picture'} is tapped (a web address; leave empty for no link):`, 'https://');
  if (v === null) return;
  const { error } = await sb.rpc('hub_studio_note_photo_link', { p_key: key, p_link: v.trim() === 'https://' ? '' : snsLink(v) });
  if (error) { alert(error.message); return; }
  _sns.msg = '✓ Link saved.'; snsLoad();
}
// 📷 (Nov 12 2026) A note's own picture: uploaded right away, saved with the note
function snsPhotoPrev(url) {
  return url ? `<div style="display:flex;gap:10px;align-items:center;margin:4px 0 6px"><img src="${escAttr(url)}" alt="" style="max-width:160px;max-height:120px;border-radius:10px;display:block">
    <button class="ho-btn sm" type="button" onclick="snsNotePhotoClear()">Remove</button></div>` : ''
}
async function snsNotePhoto(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const prev = document.getElementById('sns-photo-prev'); if (prev) prev.innerHTML = '<span class="fd-sm">Uploading…</span>';
  const urls = await rpUploadFiles([f], 'studio-notes');
  if (!urls[0]) { if (prev) prev.innerHTML = snsPhotoPrev(document.getElementById('sns-photo').value); return; }
  document.getElementById('sns-photo').value = urls[0]; if (prev) prev.innerHTML = snsPhotoPrev(urls[0]);
}
function snsNotePhotoClear() { document.getElementById('sns-photo').value = ''; const prev = document.getElementById('sns-photo-prev'); if (prev) prev.innerHTML = ''; }
// 🏬 (Nov 12 2026) A published note: tick more studios to post it there too (they join its group)
function snsAlsoHtml(n, copies) {
  if (!n) return '';
  const have = new Set((copies.length ? copies : [n]).map(c => c.studio_id)), left = Object.keys(STUDIO_NAMES).filter(sid => !have.has(sid));
  if (!left.length) return '';
  return `<details style="margin:8px 0"><summary><b>🏬 Also post it at…</b> <span class="fd-sm">(${left.length} other studios)</span></summary>
    <p class="fd-sm" style="margin:6px 0">Copies go up with this note’s text, dates and picture rules, and stay grouped with it. Each studio can still be edited on its own later.</p>
    <div class="sn-studios">${left.map(sid => `<label class="ba-check"><input type="checkbox" class="sn-also" value="${escAttr(sid)}"> ${esc(STUDIO_NAMES[sid])}</label>`).join('')}</div></details>`;
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

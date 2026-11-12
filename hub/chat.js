// hub/chat.js: 💬 Staff chat (rooms, unread counts, the Team app's chat tab) and 🔔 phone notifications for chat (hub-push + sw.js).
// Moved out of hub.html as-is (Nov 12 2026). Loaded by hub.html after its main script.
// (Nov 12 2026) 🏢 Home office chat (hub_chat_office.sql): a Home office group and private home office messages, at the top of
// home office's chat list, with + New message; home office posts carry the person's name and 🎨 picture.

// ---------- 💬 Staff chat (hub_chat.sql) ----------
// One component for three places: staff phones (their studio chats + private messages),
// the studio computer (that studio's chat; pick who's posting + their punch PIN, every
// message — nothing is remembered, so the next person can't post as someone else) and home office (every chat; private ones read-only). New messages are
// checked every 4 seconds while a chat is open; the list every 20.
let _chat = null;
function chatStop() { if (_chat) { clearInterval(_chat.poll); clearInterval(_chat.listPoll); clearTimeout(_chat.asTimer); } _chat = null; }
async function openChatPane() { showOnlyPane('chat-pane'); setActiveNav('nav-chat'); chatMount('hub-chat', _studioData && _studioData.isAdmin ? 'admin' : 'studio'); }
function chatAvatar(m, size) { return hubAvatarHtml({ name: m.author_name || 'Home office', avatar_key: m.avatar_key, staff_id: m.author_staff_id || m.author_user || m.author_name }, size); }
async function chatMount(hostId, mode) {
  chatStop();
  _chat = { host: hostId, mode, threads: [], open: null, msgs: [], last: 0, as: null, pin: null, pinUntil: 0, people: null };
  const host = document.getElementById(hostId); if (!host) return;
  host.innerHTML = `${mode === 'admin' ? `<input id="chat-search" class="chat-find" style="margin-bottom:10px" placeholder="Search chats: a person, a studio or a word in the last message…" oninput="_chat.filter = this.value; chatRenderThreads()" autocomplete="off">` : ''}<div class="chat-wrap${mode === 'staff' ? ' phone' : ''}"><div class="chat-list" id="chat-list"><div class="goal-note" style="padding:12px">Loading…</div></div>
    <div class="chat-room" id="chat-room"><div class="chat-empty">Choose a chat.</div></div></div>`;
  await chatLoadThreads();
  if (!_chat) return;
  _chat.listPoll = setInterval(chatLoadThreads, 20000);
  // the studio computer has one chat: open it straight away
  if (mode === 'studio' && _chat.threads.length === 1) chatOpen(_chat.threads[0].id);
}
async function chatLoadThreads() {
  if (!_chat) return;
  const { data, error } = await sb.rpc('hub_chat_threads');
  const list = document.getElementById('chat-list'); if (!list || !_chat) return;
  if (error) { list.innerHTML = `<div class="goal-note" style="padding:12px">${esc(/hub_chat_threads/i.test(error.message) ? 'Chat isn’t set up yet (hub_chat.sql).' : error.message)}</div>`; return; }
  _chat.threads = data || [];
  chatRenderThreads();
  chatBadges();
  if (_chat.mode === 'staff') pushCardRender(); else if (_chat.mode === 'admin') pushAdminRender();
}
function chatRenderThreads() {
  const list = document.getElementById('chat-list'); if (!list || !_chat) return;
  const q = String(_chat.filter || '').trim().toLowerCase();
  const hit = t => !q || [t.title, STUDIO_NAMES[t.studio_id], t.last && t.last.who, t.last && t.last.body].some(x => String(x || '').toLowerCase().includes(q));
  const shown = _chat.threads.filter(hit);
  const office = shown.filter(t => t.kind === 'office' || t.kind === 'office_direct').sort((a, b) => (a.kind === 'office' ? -1 : 0) - (b.kind === 'office' ? -1 : 0));
  const studios = shown.filter(t => t.kind === 'studio'), mine = shown.filter(t => t.kind === 'direct' && !t.watching), watch = shown.filter(t => t.kind === 'direct' && t.watching);
  const row = t => `<button class="chat-thread${_chat.open === t.id ? ' on' : ''}" onclick="chatOpen('${escAttr(t.id)}')">
      ${t.kind === 'studio' ? '<span class="chat-ic">🏠</span>' : t.kind === 'office' ? '<span class="chat-ic">🏢</span>' : t.other && t.kind === 'office_direct' ? hubAvatarHtml({ name: t.other.name, avatar_key: t.other.avatar_key, staff_id: t.other.user_id }, 32) : t.other ? hubAvatarHtml({ name: t.other.name, avatar_key: t.other.avatar_key, staff_id: t.other.staff_id }, 32) : '<span class="chat-ic">👥</span>'}
      <span class="chat-tmain"><b>${esc(t.title)}</b><span class="goal-note">${t.last ? esc((t.last.who ? (/^home office$/i.test(t.last.who) ? t.last.who : t.last.who.split(' ')[0]) + ': ' : '') + t.last.body) : 'No messages yet'}</span></span>
      ${t.unread > 0 && !t.watching ? `<span class="nav-badge">${t.unread}</span>` : ''}</button>`;
  list.innerHTML = `${_chat.mode === 'staff' ? `<div id="push-card"></div><button class="ho-btn primary" style="width:100%;margin-bottom:8px" onclick="chatNewDirect()">+ New direct message</button>` : ''}
    ${_chat.mode === 'admin' ? '<div id="push-admin"></div>' : ''}
    ${office.length || _chat.mode === 'admin' ? `<div class="chat-sec" style="display:flex;align-items:center;gap:6px">🏢 Home office${_chat.mode === 'admin' ? '<span style="flex:1"></span><button class="ho-btn sm" onclick="chatNewOffice()" title="A private message to someone at home office">+ New message</button>' : ''}</div>${office.map(row).join('')}` : ''}
    ${studios.length ? `<div class="chat-sec">Studio chat${studios.length === 1 ? '' : 's'}</div>${studios.map(row).join('')}` : ''}
    ${mine.length ? `<div class="chat-sec">Direct messages</div>${mine.map(row).join('')}` : ''}
    ${watch.length ? `<details class="chat-watch"${_chat.watchOpen || q ? ' open' : ''} ontoggle="if (!(_chat.filter || '').trim()) _chat.watchOpen = this.open"><summary class="chat-sec">${_chat.mode === 'admin' ? 'Direct messages, all studios' : 'Direct messages'} (${watch.length})</summary>${watch.map(row).join('')}</details>` : ''}
    ${!_chat.threads.length ? '<div class="goal-note" style="padding:12px">No chats yet.</div>' : !shown.length ? '<div class="goal-note" style="padding:12px">No chats match.</div>' : ''}`;
}
function chatBadges() {
  if (!_chat) return;
  const n = _chat.threads.filter(t => !t.watching).reduce((a, t) => a + (t.unread || 0), 0);
  ['chat-badge', 'me-chat-badge'].forEach(id => { const b = document.getElementById(id); if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } });
}
// Unread count for the sidebar / tab when chat isn't open (every minute)
async function chatUnreadTick() {
  if (_chat) return;
  try { const r = await sb.rpc('hub_chat_unread'); if (r.error) return;
    ['chat-badge', 'me-chat-badge'].forEach(id => { const b = document.getElementById(id); if (b) { b.textContent = r.data; b.style.display = r.data ? '' : 'none'; } }); } catch (e) {}
}
setInterval(chatUnreadTick, 60000); setTimeout(chatUnreadTick, 4000);
async function chatOpen(id) {
  if (!_chat) return;
  clearInterval(_chat.poll);
  _chat.open = id; _chat.msgs = []; _chat.last = 0;
  const t = _chat.threads.find(x => x.id === id) || {};
  document.querySelector('#' + _chat.host + ' .chat-wrap').classList.add('room-open');
  document.querySelectorAll('.chat-thread').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(id)));
  const room = document.getElementById('chat-room');
  const privacy = t.kind === 'office' ? '<div class="chat-note">🏢 Only home office can see this chat.</div>'
    : t.kind === 'office_direct' ? `<div class="chat-note">🔒 Only you and ${esc(t.title || 'them')} can see these messages.</div>`
    : t.kind === 'direct' ? `<div class="chat-note">${t.watching ? '👀 You’re viewing a direct message. Read-only. '
    : t.other_studio ? 'You don’t work at the same studio any more, so this chat is read-only. ' : ''}<button type="button" class="chat-about" onclick="chatAboutDM()">ℹ️ About Direct Messages</button></div>` : '';
  room.innerHTML = `<div class="chat-head"><button class="ho-btn chat-back" onclick="document.querySelector('#${_chat.host} .chat-wrap').classList.remove('room-open')">←</button><b>${esc(t.title || 'Chat')}</b></div>
    ${privacy}<div class="chat-msgs" id="chat-msgs"><div class="goal-note" style="padding:12px">Loading…</div></div>
    ${t.can_post ? `<div class="chat-compose">${_chat.mode === 'studio' ? '<div id="chat-as" class="chat-as"></div>' : ''}
        <textarea id="chat-text" rows="1" maxlength="2000" placeholder="Write a message…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();chatSend()}" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px';chatAsTouch()"></textarea>
        <button class="ho-btn primary" onclick="chatSend()">Send</button></div><div id="chat-msg"></div>` : ''}`;
  if (_chat.mode === 'studio') chatRenderAs();
  await chatFetch(true);
  if (_chat && _chat.open === id) _chat.poll = setInterval(() => chatFetch(false), 4000);
}
async function chatFetch(first) {
  if (!_chat || !_chat.open) return;
  const id = _chat.open;
  const { data, error } = await sb.rpc('hub_chat_messages', { p_thread: id, p_after: _chat.last, p_limit: 60 });
  if (!_chat || _chat.open !== id) return;
  const box = document.getElementById('chat-msgs'); if (!box) return;
  if (error) { box.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  const fresh = (data || []).filter(m => m.id > _chat.last);
  if (!fresh.length && !first) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  _chat.msgs = _chat.msgs.concat(fresh);
  if (fresh.length) _chat.last = fresh[fresh.length - 1].id;
  chatRender();
  if (first || nearBottom) box.scrollTop = box.scrollHeight;
  if (_chat.last) { sb.rpc('hub_chat_read', { p_thread: id, p_last: _chat.last }).then(() => { const t = _chat && _chat.threads.find(x => x.id === id); if (t) { t.unread = 0; chatBadges(); } }); }
}
function chatRender() {
  const box = document.getElementById('chat-msgs'); if (!box || !_chat) return;
  if (!_chat.msgs.length) { box.innerHTML = '<div class="chat-empty">No messages yet. Say hi!</div>'; return; }
  let lastDay = '';
  box.innerHTML = _chat.msgs.map(m => {
    const d = new Date(m.created_at), day = d.toDateString();
    const sep = day !== lastDay ? `<div class="chat-day">${esc(d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</div>` : ''; lastDay = day;
    const ot = (_chat.threads.find(x => x.id === _chat.open) || {}).kind, inOffice = ot === 'office' || ot === 'office_direct';
    const canRemove = !m.deleted && (m.mine || (_chat.mode === 'admin' && ot !== 'office_direct'));
    return sep + `<div class="chat-m${m.mine ? ' mine' : ''}${m.author_kind === 'home_office' ? ' ho' : ''}">${m.mine ? '' : chatAvatar(m, 30)}
      <div class="chat-bub"><div class="chat-who">${m.mine ? '' : esc(m.author_name || 'Home office') + (m.author_kind === 'home_office' && !inOffice ? ' <span class="duty-tag ho">Home office</span>' : '')}
          <span class="goal-note">${esc(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}${m.via_studio ? ' · studio computer' : ''}</span>
          ${canRemove ? `<button class="chat-x" title="Remove" onclick="chatRemove(${m.id})">✕</button>` : ''}</div>
        ${m.deleted ? `<i class="goal-note">Message removed${m.deleted_by ? ' by ' + esc(m.deleted_by) : ''}</i>` : `<div class="chat-body">${esc(m.body).replace(/\n/g, '<br>')}</div>`}</div></div>`;
  }).join('');
}
// Studio computer: who's posting (name + PIN for every message; cleared after sending)
// Walked away after choosing a name or typing a PIN, without sending: clear it after a
// minute with no typing.
function chatAsTouch() {
  if (!_chat || _chat.mode !== 'studio') return;
  clearTimeout(_chat.asTimer);
  if (_chat.as) _chat.asTimer = setTimeout(() => { if (_chat && _chat.as) { _chat.as = null; _chat.pin = null; chatRenderAs(); } }, 60000);
}
async function chatRenderAs() {
  const el = document.getElementById('chat-as'); if (!el || !_chat) return;
  if (!_chat.people) { const r = await sb.rpc('hub_chat_people', { p_studio: _sessionStudioId }); _chat.people = r.error ? [] : (r.data || []); }
  if (_chat.pin && Date.now() > _chat.pinUntil) { _chat.pin = null; }
  // walked away after choosing a name (or typing a PIN) without sending: clear it after a minute
  chatAsTouch();
  el.innerHTML = `Posting as <select id="chat-as-sel" onchange="_chat.as = this.value || null; _chat.pin = null; chatRenderAs()"><option value="">— choose your name —</option>${_chat.people.map(p => `<option value="${escAttr(p.staff_id)}"${_chat.as === p.staff_id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    ${_chat.as && !_chat.pin ? '<input class="pin-mask" id="chat-pin" type="text" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore autocomplete="off" inputmode="numeric" maxlength="4" placeholder="PIN">' : ''}${_chat.as && _chat.pin ? '<span class="goal-note">✓ PIN entered</span>' : ''}`;
}
async function chatSend() {
  if (!_chat || !_chat.open) return;
  const ta = document.getElementById('chat-text'), msg = document.getElementById('chat-msg');
  const body = (ta.value || '').trim(); if (!body) return;
  const args = { p_thread: _chat.open, p_body: body };
  if (_chat.mode === 'studio') {
    if (!_chat.as) { msg.innerHTML = '<div class="me-msg err">Choose your name first.</div>'; return; }
    const pinEl = document.getElementById('chat-pin');
    const pin = _chat.pin && Date.now() < _chat.pinUntil ? _chat.pin : (pinEl ? pinEl.value : '');
    if (!/^\d{4}$/.test(pin)) { msg.innerHTML = '<div class="me-msg err">Type your 4-number punch PIN.</div>'; if (pinEl) pinEl.focus(); return; }
    args.p_as_staff = _chat.as; args.p_pin = pin;
  }
  msg.innerHTML = '';
  const { data: posted, error } = await sb.rpc('hub_chat_post', args);
  if (!error && posted && posted.id) pushNotifyMessage(posted.id);
  if (error) { msg.innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; if (_chat.mode === 'studio') { _chat.pin = null; chatRenderAs(); } return; }
  if (_chat.mode === 'studio') { _chat.as = null; _chat.pin = null; _chat.pinUntil = 0; chatRenderAs(); }   // forget who posted
  ta.value = ''; ta.style.height = 'auto';
  await chatFetch(false);
  const box = document.getElementById('chat-msgs'); if (box) box.scrollTop = box.scrollHeight;
  chatLoadThreads();
}
async function chatRemove(id) {
  if (!confirm('Remove this message for everyone?')) return;
  const { error } = await sb.rpc('hub_chat_delete', { p_message: id });
  if (error) { alert(error.message); return; }
  const m = _chat.msgs.find(x => x.id === id); if (m) { m.deleted = true; m.body = null; }
  chatRender();
}
// "ℹ️ About Direct Messages": the little pop-up
function chatAboutDM() {
  document.querySelectorAll('.dm-about-back').forEach(x => x.remove());
  const back = document.createElement('div'); back.className = 'dm-about-back';
  back.innerHTML = '<div class="dm-about" role="dialog" aria-modal="true" aria-labelledby="dm-about-h"><h3 id="dm-about-h">ℹ️ About Direct Messages</h3>' +
    '<p>Direct messages are only visible to the people in the conversation. However, HR may access and review them when necessary for workplace investigations, including harassment or misconduct.</p>' +
    '<p>Please keep all messages professional and respectful.</p><button type="button" class="ho-btn primary" onclick="this.closest(\'.dm-about-back\').remove()">Got it</button></div>';
  back.addEventListener('click', e => { if (e.target === back) back.remove(); });
  document.body.appendChild(back);
}
// 🏢 Home office: a private message to someone at home office
async function chatNewOffice() {
  if (!_chat.officePeople) { const r = await sb.rpc('hub_chat_office_people'); _chat.officePeople = r.error ? [] : (r.data || []); if (r.error) { alert(/hub_chat_office_people/.test(r.error.message) ? 'Run the home office chat SQL first.' : r.error.message); return; } }
  openDutySheet(`<h3>New message</h3><p class="goal-note" style="margin:0 0 8px">🔒 Only the two of you will see it.</p>
    <input id="chat-ofind" class="chat-find" placeholder="Search home office…" oninput="chatFilterOffice(this.value)" autocomplete="off">
    <div class="chat-people" id="chat-opeople"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button></div>`);
  chatFilterOffice('');
  setTimeout(() => { const f = document.getElementById('chat-ofind'); if (f) f.focus(); }, 50);
}
function chatFilterOffice(q) {
  q = String(q || '').toLowerCase().trim();
  const list = (_chat.officePeople || []).filter(p => !q || String(p.name || '').toLowerCase().includes(q));
  document.getElementById('chat-opeople').innerHTML = list.map(p => `<button class="chat-person" onclick="chatStartOffice('${escAttr(p.user_id)}')">${hubAvatarHtml({ name: p.name, avatar_key: p.avatar_key, staff_id: p.user_id }, 30)}<span><b>${esc(p.name)}</b></span></button>`).join('')
    || `<div class="goal-note">${(_chat.officePeople || []).length ? 'No one found.' : 'No one else at home office yet.'}</div>`;
}
async function chatStartOffice(userId) {
  const { data, error } = await sb.rpc('hub_chat_office_direct', { p_user: userId });
  if (error) { alert(error.message); return; }
  closeDutySheet();
  await chatLoadThreads();
  chatOpen(data);
}
// Staff: start a direct message
async function chatNewDirect() {
  if (!_chat.people) { const r = await sb.rpc('hub_chat_people', {}); _chat.people = r.error ? [] : (r.data || []); }
  openDutySheet(`<h3>New direct message</h3>
    <input id="chat-find" class="chat-find" placeholder="Search for someone at your studio…" oninput="chatFilterPeople(this.value)" autocomplete="off">
    <div class="chat-people" id="chat-people"></div>
    <div class="goal-note" style="margin-top:8px">You can message anyone at your studio. <button type="button" class="chat-about" onclick="chatAboutDM()">ℹ️ About Direct Messages</button></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button></div>`);
  chatFilterPeople('');
  setTimeout(() => { const f = document.getElementById('chat-find'); if (f) f.focus(); }, 50);
}
function chatFilterPeople(q) {
  q = String(q || '').toLowerCase().trim();
  const list = (_chat.people || []).filter(p => !q || p.name.toLowerCase().includes(q) || String(STUDIO_NAMES[p.home_studio_id] || '').toLowerCase().includes(q)).slice(0, 40);
  document.getElementById('chat-people').innerHTML = list.map(p => `<button class="chat-person" onclick="chatStartDirect('${escAttr(p.staff_id)}')">${hubAvatarHtml(p, 30)}<span><b>${esc(p.name)}</b>${p.home_studio_id ? `<span class="goal-note"> · ${esc(STUDIO_NAMES[p.home_studio_id] || p.home_studio_id)}</span>` : ''}</span></button>`).join('')
    || `<div class="goal-note">${(_chat.people || []).length ? 'No one found.' : 'No one else works at your studio yet.'}</div>`;
}
async function chatStartDirect(staffId) {
  const { data, error } = await sb.rpc('hub_chat_direct', { p_other: staffId });
  if (error) { alert(error.message); return; }
  closeDutySheet();
  await chatLoadThreads();
  chatOpen(data);
}

// ---------- 🔔 Phone notifications for chat (hub_push.sql + hub-push + sw.js) ----------
let _pushReg = null;
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(r => { _pushReg = r; }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {   // a notification tapped while the Hub is open
    if (e.data && e.data.type === 'open-chat') { const u = new URL(e.data.url), id = u.searchParams.get('chat');
      if (id && _me) { meTab('chat'); chatOpenWhenReady(id); } else if (u.searchParams.get('tab') === 'shifts' && _me) meTab('shifts'); }
  });
}
function chatOpenWhenReady(id, tries) {
  tries = tries || 0;
  if (_chat && _chat.threads && _chat.threads.some(t => t.id === id)) { chatOpen(id); return; }
  if (tries < 20) setTimeout(() => chatOpenWhenReady(id, tries + 1), 300);
}
function pushNotifyMessage(id) {
  fnHeaders().then(h => fetch(`${SUPABASE_URL}/functions/v1/hub-push`, { method: 'POST', headers: h, body: JSON.stringify({ message_id: id }) })).catch(() => {});
}
function pushB64(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
function pushEnv() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { ios, standalone, supported };
}
async function pushMySub() {
  try { const r = _pushReg || await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch (e) { return null; }
}
async function pushCardRender() {
  const el = document.getElementById('push-card'); if (!el) return;
  const { data: st, error } = await sb.rpc('hub_push_status');
  if (error || !st) { el.innerHTML = ''; return; }
  const env = pushEnv(), sub = env.supported ? await pushMySub() : null;
  let html = '';
  if (!st.enabled_for_me || !st.public_key) html = '';   // not switched on for their studio yet: say nothing
  else if (env.ios && !env.standalone) html = `<div class="push-card">📲 <b>Get a notification for new messages:</b> tap <b>Share</b> <span class="push-ic">⬆︎</span> then <b>Add to Home Screen</b>, and open the Hub from your home screen. Then turn notifications on here.</div>`;
  else if (!env.supported) html = '<div class="push-card">This browser can’t show notifications. Try Chrome or Safari on your phone.</div>';
  else if (Notification.permission === 'denied') html = '<div class="push-card">🔕 Notifications are blocked for the Hub. Turn them on in your phone’s settings for this app or site.</div>';
  else if (sub) html = `<div class="push-card on">🔔 Notifications are on for this phone. <a href="#" onclick="pushTest(); return false">Send a test</a> · <a href="#" onclick="pushOff(); return false">Turn off</a><div id="push-msg"></div></div>`;
  else html = `<div class="push-card"><button class="ho-btn primary" style="width:100%" onclick="pushOn()">🔔 Turn on notifications</button><div class="goal-note" style="margin-top:4px">Get a notification on this phone when someone messages you or your studio’s chat.</div><div id="push-msg"></div></div>`;
  el.innerHTML = html;
}
async function pushOn() {
  const msg = () => document.getElementById('push-msg');
  try {
    const { data: st } = await sb.rpc('hub_push_status');
    if (!st || !st.public_key) throw new Error('Notifications aren’t set up yet. Ask home office.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { pushCardRender(); return; }
    const reg = _pushReg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64(st.public_key) });
    const j = sub.toJSON();
    const { error } = await sb.rpc('hub_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent });
    if (error) throw error;
    await pushCardRender();
    const m = msg(); if (m) m.innerHTML = '<span style="color:#15803d">✓ Turned on.</span>';
  } catch (e) { const m = msg(); if (m) m.innerHTML = `<span style="color:#b91c1c">${esc(e.message || e)}</span>`; }
}
async function pushOff() {
  const sub = await pushMySub();
  if (sub) { await sb.rpc('hub_push_unsubscribe', { p_endpoint: sub.endpoint }); try { await sub.unsubscribe(); } catch (e) {} }
  pushCardRender();
}
async function pushTest() {
  const m = document.getElementById('push-msg'); if (m) m.innerHTML = '<span class="goal-note">Sending…</span>';
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-push`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ action: 'test' }) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    if (m) m.innerHTML = j.sent ? '<span style="color:#15803d">Sent. It should appear in a few seconds.</span>' : '<span style="color:#b91c1c">Nothing was sent. Try turning notifications off and on again.</span>';
  } catch (e) { if (m) m.innerHTML = `<span style="color:#b91c1c">${esc(e.message || e)}</span>`; }
}
// Home office: set up the keys, and switch notifications on (all studios or chosen ones)
async function pushAdminRender() {
  const el = document.getElementById('push-admin'); if (!el || el.dataset.open === '1') return;
  const { data: s, error } = await sb.rpc('hub_push_settings_get');
  if (error) { el.innerHTML = /hub_push_settings_get/i.test(error.message) ? '' : `<div class="goal-note">${esc(error.message)}</div>`; return; }
  const label = !s.enabled ? 'Off' : (s.studio_ids && s.studio_ids.length ? `On for ${s.studio_ids.length} studio${s.studio_ids.length === 1 ? '' : 's'}` : 'On for all studios');
  el.innerHTML = `<details class="push-admin"><summary>🔔 Phone notifications: <b>${esc(label)}</b></summary>
      ${!s.has_keys ? `<div class="goal-note" style="margin:8px 0">First, set them up once (this creates the notification keys).</div><button class="ho-btn primary" onclick="pushSetup()">Set up phone notifications</button>`
        : `<div class="goal-note" style="margin:8px 0">${s.phones} phone${s.phones === 1 ? '' : 's'} from ${s.people} ${s.people === 1 ? 'person' : 'people'} turned on.</div>
        <label class="dm-all"><input type="radio" name="pa-mode" value="off"${!s.enabled ? ' checked' : ''}> Off</label>
        <label class="dm-all"><input type="radio" name="pa-mode" value="all"${s.enabled && !(s.studio_ids || []).length ? ' checked' : ''}> All studios</label>
        <label class="dm-all"><input type="radio" name="pa-mode" value="some"${s.enabled && (s.studio_ids || []).length ? ' checked' : ''}> Chosen studios:</label>
        <div class="pa-studios">${Object.keys(STUDIO_NAMES).sort().map(k => `<label><input type="checkbox" class="pa-st" value="${escAttr(k)}"${(s.studio_ids || []).includes(k) ? ' checked' : ''}> ${esc(STUDIO_NAMES[k])}</label>`).join('')}</div>
        <button class="ho-btn primary" style="margin-top:8px" onclick="pushAdminSave()">Save</button>`}<div id="pa-msg"></div></details>`;
  el.querySelector('details').addEventListener('toggle', e => { el.dataset.open = e.target.open ? '1' : ''; });
}
async function pushSetup() {
  const m = document.getElementById('pa-msg');
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/hub-push`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ action: 'setup' }) });
    const j = await r.json(); if (j.error) throw new Error(j.error);
    document.getElementById('push-admin').dataset.open = ''; pushAdminRender();
  } catch (e) { if (m) m.innerHTML = `<div class="me-msg err">${esc(/Failed to fetch|404/.test(e.message) ? 'Deploy the hub-push Edge Function first.' : e.message)}</div>`; }
}
async function pushAdminSave() {
  const mode = (document.querySelector('input[name=pa-mode]:checked') || {}).value || 'off';
  const ids = mode === 'some' ? [...document.querySelectorAll('.pa-st:checked')].map(c => c.value) : [];
  if (mode === 'some' && !ids.length) { document.getElementById('pa-msg').innerHTML = '<div class="me-msg err">Tick at least one studio.</div>'; return; }
  const { error } = await sb.rpc('hub_push_settings_set', { p_enabled: mode !== 'off', p_studio_ids: ids });
  if (error) { document.getElementById('pa-msg').innerHTML = `<div class="me-msg err">${esc(error.message)}</div>`; return; }
  document.getElementById('push-admin').dataset.open = ''; pushAdminRender();
}

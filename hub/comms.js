// hub/comms.js: Home office → ✉️ Email staff, 📰 Staff newsletter (and staff's Team app → 📰 News), 📧 Newsletters (builder,
// templates, topics) and 📢 Announcements (the editor and the **bold** formatting). Moved out of hub.html (Nov 11 2026), wired to
// access.html: Newsletters → "Newsletters"; staff newsletter, Email staff and Announcements → "Staff comms". Loaded after hub.html's main script.

// ---------- Home office → 📧 Newsletters (news_core.sql): subscribers at a glance, and the topics (tags) ----------
let _news = { d: null, err: '', edit: null };
// ---------- Home office → ✉️ Email staff (staff-email Edge Function, staff_emails.sql) ----------
let _se = { studios: [], reply: '', out: {}, everyone: [] };   // out: { staff id: name } left out
async function seCall(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/staff-email`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || ('HTTP ' + r.status)); e.dup = d.duplicate; throw e; } return d;
}
function openStaffEmailPane() {
  showOnlyPane('se-pane'); setActiveNav('nav-se');
  const el = document.getElementById('se-pane');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">✉️ Email staff</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
      <p class="ho-intro">Send an email to every active staff member, or the staff at the studios you choose, and leave anyone out. Each person gets their own copy with only their own address on it, so nobody sees anyone else’s. <b>{{first_name}}</b> becomes their first name. Owners and HR only.</p>
      <div class="ho-card se-card">
        <label>Subject<input id="se-subject" maxlength="200" placeholder="e.g. Holiday schedule and staff party"></label>
        <label>Message<textarea id="se-body" rows="14" placeholder="Hi {{first_name}},&#10;&#10;…&#10;&#10;Thanks,&#10;Renée"></textarea></label>
        <span class="se-help">Leave a blank line between paragraphs. <b>**bold**</b>, <i>*italic*</i>, [link text](https://…), and lines starting “- ” become bullets. Plain https://… links work too. Send yourself a test to see it.</span>
        <div class="se-row"><label class="se-who"><input type="radio" name="se-who" value="all" checked onchange="seWho()"> All active staff</label>
          <label class="se-who"><input type="radio" name="se-who" value="some" onchange="seWho()"> Staff at these studios…</label></div>
        <div id="se-studios" class="se-studios" hidden></div>
        <div class="se-out"><label>Leave people out <small>(optional)</small><input id="se-out-q" placeholder="Type a name…" autocomplete="off" oninput="seOutList()"></label>
          <div id="se-out-hits" class="se-out-hits"></div><div id="se-out-chips" class="se-out-chips"></div></div>
        <label>Replies go to<input id="se-reply" type="email" placeholder="your email"></label>
        <div class="se-row"><button class="ho-btn" onclick="seTest()">Send me a test</button><button class="ho-btn primary" id="se-send" onclick="seSend()">Send…</button><span id="se-count" class="se-count"></span></div>
        <p id="se-msg" class="se-msg" role="status"></p>
      </div>
      <h3 class="se-h">Sent</h3><div id="se-hist" class="se-hist">Loading…</div>`;
    document.getElementById('se-studios').innerHTML = Object.keys(STUDIO_NAMES).map(id => `<label><input type="checkbox" value="${esc(id)}" onchange="seCount()"> ${esc(STUDIO_NAMES[id])}</label>`).join('');
    sb.auth.getUser().then(r => { const em = r && r.data && r.data.user && r.data.user.email; const i = document.getElementById('se-reply'); if (em && i && !i.value) i.value = em; }).catch(() => {});
  }
  seCount(); seHistory();
}
function seStudios() { return document.querySelector('input[name="se-who"]:checked').value === 'all' ? [] : [...document.querySelectorAll('#se-studios input:checked')].map(c => c.value); }
function seWho() { document.getElementById('se-studios').hidden = document.querySelector('input[name="se-who"]:checked').value === 'all'; seCount(); }
async function seCount() {
  const c = document.getElementById('se-count'), btn = document.getElementById('se-send'); if (!c) return;
  const some = document.querySelector('input[name="se-who"]:checked').value !== 'all', st = seStudios();
  if (some && !st.length) { c.textContent = 'Tick at least one studio.'; btn.textContent = 'Send…'; btn.disabled = true; return; }
  c.textContent = 'Counting…';
  try { const d = await seCall({ action: 'preview', studios: st, exclude: Object.keys(_se.out) }); _se.count = d.count; _se.everyone = d.everyone || []; seOutChips();
    c.textContent = 'Goes to ' + d.count + ' staff' + (d.sample && d.sample.length ? ' (' + d.sample.slice(0, 4).join(', ') + (d.count > 4 ? '…' : '') + ')' : '');
    btn.textContent = 'Send to ' + d.count + ' staff'; btn.disabled = !d.count; }
  catch (e) { c.textContent = /staff-email|Failed to fetch|404/.test(e.message) ? 'Deploy the staff-email Edge Function first.' : e.message; btn.disabled = true; }
}
function seVals() { const v = id => (document.getElementById(id) || {}).value || ''; return { subject: v('se-subject').trim(), body: v('se-body').trim(), reply_to: v('se-reply').trim(), studios: seStudios(), exclude: Object.keys(_se.out) }; }
// "Leave people out": type a name, tap it; they show as chips (× puts them back)
function seOutList() {
  const q = ((document.getElementById('se-out-q') || {}).value || '').trim().toLowerCase(), box = document.getElementById('se-out-hits'); if (!box) return;
  if (q.length < 2) { box.innerHTML = ''; return; }
  const hits = _se.everyone.filter(p => !_se.out[p.id] && String(p.name || '').toLowerCase().includes(q)).slice(0, 8);
  box.innerHTML = hits.length ? hits.map(p => `<button type="button" class="ho-btn" onclick="seOut('${escAttr(p.id)}', true)">${esc(p.name)}</button>`).join('') : '<span class="se-count">No one by that name.</span>';
}
function seOut(id, add) {
  if (add) { const p = _se.everyone.find(x => x.id === id); if (p) _se.out[id] = p.name; const q = document.getElementById('se-out-q'); if (q) q.value = ''; }
  else delete _se.out[id];
  seOutList(); seOutChips(); seCount();
}
function seOutChips() {
  const el = document.getElementById('se-out-chips'); if (!el) return;
  const ids = Object.keys(_se.out);
  el.innerHTML = ids.length ? '<span class="se-count">Left out:</span> ' + ids.map(id => `<span class="se-chip">${esc(_se.out[id])}<button type="button" onclick="seOut('${escAttr(id)}', false)" aria-label="Put ${esc(_se.out[id])} back">×</button></span>`).join('') : '';
}
async function seTest() {
  const m = document.getElementById('se-msg'), x = seVals(); if (!x.subject || !x.body) { m.textContent = 'Add a subject and a message.'; return; }
  m.textContent = 'Sending the test…';
  try { const d = await seCall(Object.assign({ action: 'test' }, x)); m.textContent = '✓ Test sent to ' + d.to + '. Check how it looks, then send it to everyone.'; seHistory(); }
  catch (e) { m.textContent = e.message; }
}
async function seSend(again) {
  const m = document.getElementById('se-msg'), btn = document.getElementById('se-send'), x = seVals();
  if (!x.subject || !x.body) { m.textContent = 'Add a subject and a message.'; return; }
  if (!again && !confirm('Send “' + x.subject + '” to ' + (_se.count || 'all') + ' staff now?\n\nThis can’t be undone.')) return;
  btn.disabled = true; m.textContent = 'Sending… (this can take a minute)';
  try {
    const d = await seCall(Object.assign({ action: 'send', again: !!again }, x));
    m.textContent = '✓ Sent to ' + d.sent + ' staff' + (d.failed ? '. ' + d.failed + ' didn’t send. Check Resend’s log.' : '.');
    document.getElementById('se-subject').value = ''; document.getElementById('se-body').value = '';
    seHistory();
  } catch (e) {
    if (e.dup && confirm(e.message + '\n\nSend it again anyway?')) { btn.disabled = false; return seSend(true); }
    m.textContent = e.message;
  }
  btn.disabled = false;
}
async function seHistory() {
  const el = document.getElementById('se-hist'); if (!el) return;
  try {
    const d = await seCall({ action: 'history' });
    el.innerHTML = (d.sends || []).length ? (d.sends || []).map(x => `<div class="se-sent"><b>${esc(x.subject)}</b> <span>${x.is_test ? 'test to ' + esc(x.sent_by) : esc(x.sent_count + ' staff' + ((x.audience && x.audience.studios && x.audience.studios.length) ? ' at ' + x.audience.studios.map(i => STUDIO_NAMES[i] || i).join(', ') : '') + (x.audience && x.audience.left_out ? ' (' + x.audience.left_out + ' left out)' : ''))}${x.failed ? ' · ' + x.failed + ' failed' : ''} · ${esc(new Date(x.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${esc(x.sent_by || '')}</span></div>`).join('') : '<div class="se-sent">Nothing sent yet.</div>';
  } catch (e) { el.textContent = /staff_email_sends/.test(e.message) ? 'Run staff_emails.sql in Supabase first.' : ''; }
}

// =====================================================================================================================
// 📰 Staff newsletter (staff_newsletter.sql): a monthly newsletter read in the Team app (not emailed).
//   Home office: 📰 Staff newsletter. A cover (title, photo, note) and sections of short cards, with a live phone preview that
//   is exactly what staff see. Saves as you type. "Start next month from this one" copies the sections, cards emptied.
//   "New this month" suggests upcoming new classes. Staff: Team app → 📰 News: react, "I've read it"; you see who has.
// =====================================================================================================================
const SN_KINDS = {
  dates:     { emoji: '📅', title: 'Dates to know',         hint: 'Pay days, stat holidays, deadlines, camp starts', fields: ['when', 'title', 'text'] },
  shoutouts: { emoji: '🌟', title: 'Shout-outs',            hint: 'Kudos from studios and customers',              fields: ['title', 'text', 'image'] },
  welcome:   { emoji: '👋', title: 'Welcome & anniversaries', hint: 'New staff and work anniversaries',            fields: ['title', 'text', 'image'] },
  wins:      { emoji: '🏆', title: 'Studio wins',           hint: 'Challenge results, points leaders, fill rates', fields: ['title', 'text', 'image'] },
  new:       { emoji: '🎨', title: 'New this month',        hint: 'Projects and classes launching',                fields: ['title', 'text', 'image', 'link'] },
  reminders: { emoji: '📌', title: 'Reminders',             hint: 'Short and to the point',                        fields: ['title', 'text', 'link'] },
  tip:       { emoji: '💡', title: 'Tip of the month',      hint: 'One how-to, with a link to the Knowledge Base',  fields: ['title', 'text', 'image', 'link'] },
  love:      { emoji: '💬', title: 'Customer love',         hint: 'A few review quotes (the quote, then who/where)', fields: ['text', 'title'] },
  photo:     { emoji: '📸', title: 'Photo of the month',    hint: 'One great photo and a caption',                 fields: ['image', 'text', 'title'] },
  custom:    { emoji: '✨', title: 'Something new',         hint: 'Anything else',                                 fields: ['title', 'text', 'image', 'link'] }
};
const SN_ORDER = ['dates', 'shoutouts', 'welcome', 'wins', 'new', 'reminders', 'tip', 'love', 'photo'];
const SN_REACT = ['❤️', '🎉', '😂', '👏', '🙌'];
let _sn = { list: null, issue: null, dirty: false, timer: null, saving: false, suggest: null, err: '' };
function snId() { return 'x' + Math.random().toString(36).slice(2, 10); }
function snSection(kind) { const k = SN_KINDS[kind] || SN_KINDS.custom; return { id: snId(), kind, emoji: k.emoji, title: k.title, text: '', items: [] }; }
function snMonthLabel(m) { return m ? new Date(String(m).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) : ''; }

// ---- the newsletter as staff see it (phone-first): also the builder's live preview ----
function snText(t) {   // plain text with line breaks and links
  return esc(String(t || '')).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
function snMore(t) {
  const s = String(t || ''); if (s.length <= 240) return `<p class="sn-p">${snText(s)}</p>`;
  return `<div class="sn-more"><p class="sn-p">${snText(s)}</p><button type="button" class="sn-morebtn" onclick="this.parentNode.classList.toggle('open');this.textContent=this.parentNode.classList.contains('open')?'Show less':'Read more'">Read more</button></div>`;
}
function snItemHtml(sec, it) {
  if (sec.kind === 'dates') return `<div class="sn-date"><span class="sn-when">${esc(it.when || '')}</span><span><b>${esc(it.title || '')}</b>${it.text ? `<span class="sn-sub">${snText(it.text)}</span>` : ''}</span></div>`;
  if (sec.kind === 'love') return `<blockquote class="sn-quote">“${snText(it.text || '')}”${it.title ? `<cite>${esc(it.title)}</cite>` : ''}</blockquote>`;
  if (sec.kind === 'photo') return `<figure class="sn-photo">${it.image ? `<img src="${escAttr(it.image)}" alt="" loading="lazy">` : ''}${it.text || it.title ? `<figcaption>${it.title ? `<b>${esc(it.title)}</b> ` : ''}${snText(it.text || '')}</figcaption>` : ''}</figure>`;
  return `<div class="sn-card">${it.image ? `<img class="sn-img" src="${escAttr(it.image)}" alt="" loading="lazy">` : ''}<div class="sn-cbody">
      ${it.title ? `<h4>${esc(it.title)}</h4>` : ''}${it.text ? snMore(it.text) : ''}
      ${it.link ? `<a class="sn-link" href="${escAttr(it.link)}" target="_blank" rel="noopener">${esc(it.link_label || 'Open')} →</a>` : ''}</div></div>`;
}
function snIssueHtml(x, opts) {
  opts = opts || {};
  const secs = (x.sections || []).filter(s => (s.items || []).length || s.text);
  let h = `<article class="sn-issue">${x.cover_image ? `<img class="sn-cover" src="${escAttr(x.cover_image)}" alt="">` : ''}
    <p class="sn-kicker">${esc(snMonthLabel(x.month))} · 4Cats Team News</p><h2 class="sn-title">${esc(x.title || 'Untitled')}</h2>
    ${x.intro ? `<div class="sn-note">${snText(x.intro)}${x.intro_by ? `<div class="sn-by">— ${esc(x.intro_by)}</div>` : ''}</div>` : ''}
    ${secs.length > 2 ? `<nav class="sn-toc">${secs.map(s => `<a href="#sn-${escAttr(s.id)}" onclick="event.preventDefault();var e=document.getElementById('sn-${escAttr(s.id)}');if(e)e.scrollIntoView({behavior:'smooth'})">${esc(s.emoji || '')} ${esc(s.title || '')}</a>`).join('')}</nav>` : ''}`;
  secs.forEach(s => {
    h += `<section class="sn-sec sn-${escAttr(s.kind)}" id="sn-${escAttr(s.id)}"><h3>${esc(s.emoji || '')} ${esc(s.title || '')}</h3>${s.text ? `<p class="sn-p sn-intro">${snText(s.text)}</p>` : ''}
      <div class="sn-items">${(s.items || []).map(it => snItemHtml(s, it)).join('')}</div></section>`;
  });
  if (!secs.length && opts.preview) h += '<p class="sn-empty">Add cards to a section and they appear here.</p>';
  if (opts.staff) {
    const R = x.reactions || {};
    h += `<div class="sn-foot"><div class="sn-reacts">${SN_REACT.map(e => `<button type="button" class="sn-react${R[e] && R[e].mine ? ' on' : ''}" onclick="meNewsReact('${escAttr(x.id)}','${e}',${R[e] && R[e].mine ? 'false' : 'true'})">${e}${R[e] && R[e].n ? ` <span>${R[e].n}</span>` : ''}</button>`).join('')}</div>
      ${x.read_at ? '<div class="sn-done">✓ You\u2019ve read it. Thanks!</div>' : `<button type="button" class="sn-readbtn" onclick="meNewsMarkRead('${escAttr(x.id)}')">✓ I\u2019ve read it</button>`}</div>`;
  } else if (opts.preview) h += `<div class="sn-foot"><div class="sn-reacts">${SN_REACT.map(e => `<span class="sn-react">${e}</span>`).join('')}</div><span class="sn-readbtn">✓ I\u2019ve read it</span></div>`;
  return h + '</article>';
}

// ---- home office: the list and the builder ----
async function openStaffNewsPane() {
  await hoAreaLoad('staff_comms'); if (!hoA('staff_comms', 'view')) { alert('The staff newsletter needs “Staff comms” on the Access page.'); return; }
  showOnlyPane('sn-pane'); setActiveNav('nav-sn');
  if (_sn.issue) { snDraw(); return; }
  snLoadList();
}
async function snLoadList() {
  _sn.list = null; _sn.issue = null; snDraw();
  const { data, error } = await sb.rpc('hub_staffnews_list');
  _sn.list = error ? [] : (data || []); _sn.err = error ? (/hub_staffnews_list/.test(error.message) ? 'Run staff_newsletter.sql in Supabase first.' : error.message) : '';
  snDraw();
}
function snDraw() {
  const el = document.getElementById('sn-pane'); if (!el) return;
  if (!_sn.issue) {
    const L = _sn.list;
    el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📰 Staff newsletter</div><span class="spacer"></span>
        ${hoA('staff_comms', 'edit') ? '<button class="ho-btn primary" onclick="snNew()">+ New newsletter</button>' : ''}<button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
      <div class="ho-intro">A monthly newsletter for staff, read in the Team app (📰 News). Nothing is emailed. Staff can react and tap “I've read it”, and you can see who has.</div>
      ${_sn.err ? `<div class="goal-note">${esc(_sn.err)}</div>` : L === null ? '<div class="goal-note">Loading…</div>' : !L.length ? '<div class="goal-note">No newsletters yet. Make the first one!</div>' :
        [['draft', '📝 Drafts', 'Saved as you go. Only home office can see these.'], ['published', '✅ Published', 'In the Team app for staff.']].map(([st, head, sub]) => { const G = L.filter(x => x.status === st); return !G.length ? '' :
        `<h3 class="sn-grp">${head} <span class="fd-sm">(${G.length}) · ${sub}</span></h3>` + '<div class="sn-list">' + G.map(x => `<div class="sn-row">${x.cover_image ? `<img src="${escAttr(x.cover_image)}" alt="">` : '<span class="sn-row-ic">📰</span>'}
          <div class="sn-row-main"><b>${esc(x.title)}</b><div class="fd-sm">${esc(snMonthLabel(x.month))} · ${x.status === 'published' ? `<span class="cust-st cust-booked">Published</span> · read by <b>${x.read}</b> of ${x.staff}${x.opened > x.read ? ` (${x.opened - x.read} opened)` : ''}` : '<span class="cust-st cust-held">Draft</span>'}
            ${Object.keys(x.reactions || {}).length ? ' · ' + Object.entries(x.reactions).map(([e, v]) => e + ' ' + v.n).join(' ') : ''}</div></div>
          <div class="sn-row-acts"><button class="ho-btn" onclick="snOpen('${escAttr(x.id)}')">${hoA('staff_comms', 'edit') ? 'Edit' : 'View'}</button>
            ${hoA('staff_comms', 'edit') ? `<button class="ho-btn" onclick="snDuplicate('${escAttr(x.id)}')" title="Same sections, cards emptied, for the next month">Start next month from this</button>` : ''}
            ${x.status === 'published' ? `<button class="ho-btn" onclick="snReaders('${escAttr(x.id)}')">Who's read it</button>` : hoA('staff_comms', 'edit') ? `<button class="ho-btn" onclick="snDelete('${escAttr(x.id)}')">Delete</button>` : ''}</div></div>`).join('') + '</div>'; }).join('')}`;
    return;
  }
  const x = _sn.issue, ed = hoA('staff_comms', 'edit'), dis = ed ? '' : ' disabled';
  const F = (path, label, val, opts) => { opts = opts || {};
    return `<label class="sn-f${opts.wide ? ' wide' : ''}"><span>${label}</span>${opts.area ? `<textarea data-sn="${path}" rows="${opts.rows || 3}" placeholder="${escAttr(opts.ph || '')}"${dis}>${esc(val || '')}</textarea>`
      : `<input data-sn="${path}" value="${escAttr(val || '')}" placeholder="${escAttr(opts.ph || '')}"${opts.type ? ` type="${opts.type}"` : ''}${dis}>`}</label>`; };
  const imgF = (path, val) => `<div class="sn-imgf">${val ? `<img src="${escAttr(val)}" alt=""><button type="button" class="ho-btn sm" onclick="snSetPath('${path}','');snDraw()"${dis}>Remove photo</button>`
      : `<label class="ho-btn sm sn-upl">📷 Add a photo<input type="file" accept="image/*" data-snup="${path}" hidden${dis}></label>`}</div>`;
  let h = `<div class="ho-head"><button class="ho-btn" onclick="snBack()">← All newsletters</button>
      ${x.status === 'published' ? '<span class="sn-stat pub">✅ Published: staff can see it</span>' : '<span class="sn-stat draft">📝 Draft: only home office can see this</span>'}<span class="spacer"></span>
      <span class="fd-sm" id="sn-saved">${_sn.saving ? 'Saving…' : _sn.dirty ? 'Unsaved changes' : x.id ? '✓ Saved' : ''}</span>
      ${ed ? `<button class="ho-btn" onclick="snSave(true)">Save</button>
        <button class="ho-btn primary" onclick="snPublish(${x.status === 'published' ? 'false' : 'true'})">${x.status === 'published' ? 'Unpublish' : '📣 Publish to the Team app'}</button>` : ''}</div>
    <div class="sn-wrap"><div class="sn-ed">
      <div class="sn-box"><h3>Cover</h3><div class="sn-grid">${F('title', 'Title', x.title, { ph: 'e.g. December News', wide: true })}
        <label class="sn-f"><span>Month</span><input type="month" data-sn="month" value="${escAttr(String(x.month || '').slice(0, 7))}"${dis}></label>${F('intro_by', 'Note from', x.intro_by, { ph: 'e.g. Renée' })}</div>
        ${imgF('cover_image', x.cover_image)}${F('intro', 'A short note (2–3 sentences)', x.intro, { area: true, wide: true, ph: 'What this month is about…' })}</div>`;
  (x.sections || []).forEach((s, si) => {
    const K = SN_KINDS[s.kind] || SN_KINDS.custom;
    h += `<div class="sn-box"><div class="sn-sechead"><input class="sn-emo" data-sn="sections.${si}.emoji" value="${escAttr(s.emoji || '')}" maxlength="4"${dis}>
        <input class="sn-sectitle" data-sn="sections.${si}.title" value="${escAttr(s.title || '')}"${dis}>
        ${ed ? `<button class="ho-btn sm" title="Move up" onclick="snMove(${si},-1)"${si ? '' : ' disabled'}>▲</button><button class="ho-btn sm" title="Move down" onclick="snMove(${si},1)"${si < x.sections.length - 1 ? '' : ' disabled'}>▼</button>
          <button class="ho-btn sm" title="Remove this section" onclick="snDelSection(${si})">✕</button>` : ''}</div>
      <div class="fd-sm" style="margin:-2px 0 6px">${esc(K.hint)}${!(s.items || []).length ? ' · No cards yet, so staff won\u2019t see this section.' : ''}</div>
      ${F(`sections.${si}.text`, 'Intro line (optional)', s.text, { wide: true })}
      ${(s.items || []).map((it, ii) => `<div class="sn-item"><div class="sn-item-head"><b>${s.kind === 'dates' ? 'Date' : s.kind === 'love' ? 'Quote' : s.kind === 'photo' ? 'Photo' : 'Card'} ${ii + 1}</b><span class="spacer"></span>
          ${ed ? `<button class="ho-btn sm" onclick="snMoveItem(${si},${ii},-1)"${ii ? '' : ' disabled'}>▲</button><button class="ho-btn sm" onclick="snMoveItem(${si},${ii},1)"${ii < s.items.length - 1 ? '' : ' disabled'}>▼</button><button class="ho-btn sm" onclick="snDelItem(${si},${ii})">✕</button>` : ''}</div>
        <div class="sn-grid">${K.fields.map(f => f === 'when' ? F(`sections.${si}.items.${ii}.when`, 'When', it.when, { ph: 'e.g. Dec 15' })
            : f === 'title' ? F(`sections.${si}.items.${ii}.title`, s.kind === 'love' ? 'Who / where' : s.kind === 'photo' ? 'Caption title (optional)' : 'Title', it.title, { wide: s.kind !== 'dates', ph: s.kind === 'love' ? 'e.g. A parent at Oak Bay' : '' })
            : f === 'text' ? F(`sections.${si}.items.${ii}.text`, s.kind === 'love' ? 'The quote' : s.kind === 'dates' ? 'Details (optional)' : s.kind === 'photo' ? 'Caption' : 'Text', it.text, { area: s.kind !== 'dates', wide: true, rows: s.kind === 'love' ? 2 : 3 })
            : f === 'image' ? `<div class="wide">${imgF(`sections.${si}.items.${ii}.image`, it.image)}</div>`
            : f === 'link' ? F(`sections.${si}.items.${ii}.link`, 'Link (optional)', it.link, { ph: 'https://…' }) + F(`sections.${si}.items.${ii}.link_label`, 'Button words', it.link_label, { ph: 'Open' }) : '').join('')}</div></div>`).join('')}
      ${ed ? `<div class="sn-addrow"><button class="ho-btn sm" onclick="snAddItem(${si})">+ Add ${s.kind === 'dates' ? 'a date' : s.kind === 'love' ? 'a quote' : s.kind === 'photo' ? 'a photo' : 'a card'}</button>
        ${s.kind === 'new' ? `<button class="ho-btn sm" onclick="snSuggest(${si})">✨ Suggest upcoming new classes</button>` : ''}</div>
        ${s.kind === 'new' && _sn.suggest && _sn.suggest.si === si ? `<div class="sn-sugg">${_sn.suggest.rows === null ? 'Looking…' : !_sn.suggest.rows.length ? 'Nothing new starting in ' + esc(snMonthLabel(x.month)) + '.' :
            _sn.suggest.rows.map((r, ri) => `<div class="sn-sugg-row"><span>${r.kind === 'class' ? '🧒' : '🎨'} <b>${esc(r.title)}</b> <span class="fd-sm">starts ${esc(new Date(r.first + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }))} · ${r.studios} studio${r.studios === 1 ? '' : 's'}</span></span>
              <button class="ho-btn sm" onclick="snAddSuggested(${si},${ri})">+ Add</button></div>`).join('')}</div>` : ''}` : ''}</div>`;
  });
  if (ed) h += `<div class="sn-box sn-addsec"><b>+ Add a section</b> ${Object.keys(SN_KINDS).map(k => `<button class="ho-btn sm" onclick="snAddSection('${k}')">${SN_KINDS[k].emoji} ${esc(SN_KINDS[k].title)}</button>`).join('')}</div>`;
  h += `</div><div class="sn-prevwrap"><div class="fd-sm" style="text-align:center;margin-bottom:6px">Live preview: what staff see on their phone</div>
      <div class="sn-phone"><div class="sn-screen" id="sn-preview">${snIssueHtml(x, { preview: true })}</div></div></div></div>`;
  el.innerHTML = h;
}
function snPreview() { const p = document.getElementById('sn-preview'); if (p && _sn.issue) p.innerHTML = snIssueHtml(_sn.issue, { preview: true }); }
function snSetPath(path, v) {
  const parts = path.split('.'); let o = _sn.issue;
  for (let i = 0; i < parts.length - 1; i++) o = o[/^\d+$/.test(parts[i]) ? +parts[i] : parts[i]];
  const last = parts[parts.length - 1]; o[last] = last === 'month' && v ? v + '-01' : v;
  snChanged();
}
function snChanged() {
  _sn.dirty = true; const m = document.getElementById('sn-saved'); if (m) m.textContent = 'Unsaved changes';
  snPreview(); clearTimeout(_sn.timer); _sn.timer = setTimeout(() => snSave(false), 1500);   // (saves itself as you type)
}
async function snSave(loud) {
  clearTimeout(_sn.timer);
  if (!_sn.issue || !hoA('staff_comms', 'edit') || _sn.saving) return;
  _sn.saving = true; const m = document.getElementById('sn-saved'); if (m) m.textContent = 'Saving…';
  const x = _sn.issue;
  const { data, error } = await sb.rpc('hub_staffnews_save', { p: { id: x.id || null, month: x.month, title: x.title, cover_image: x.cover_image, intro: x.intro, intro_by: x.intro_by, sections: x.sections } });
  _sn.saving = false;
  if (error) { if (m) m.textContent = 'Not saved: ' + error.message; if (loud) alert(error.message); return; }
  if (!x.id && data) x.id = data.id;
  _sn.dirty = false; const m2 = document.getElementById('sn-saved'); if (m2) m2.textContent = '✓ Saved';
}
function snNew() {
  const d = new Date(), next = new Date(d.getFullYear(), d.getMonth() + (d.getDate() > 20 ? 1 : 0), 1), month = localDateStr(next);
  _sn.issue = { id: null, month, title: snMonthLabel(month).split(' ')[0] + ' News', cover_image: '', intro: '', intro_by: '', status: 'draft', sections: SN_ORDER.map(snSection) };
  _sn.suggest = null; snDraw(); snSave(false);
}
async function snOpen(id) {
  const { data, error } = await sb.rpc('hub_staffnews_get', { p_id: id });
  if (error || !data) { alert(error ? error.message : 'Not found'); return; }
  _sn.issue = data; _sn.dirty = false; _sn.suggest = null; snDraw();
}
async function snBack() { if (_sn.dirty) await snSave(false); _sn.issue = null; snLoadList(); }
async function snDuplicate(id) {
  const { data, error } = await sb.rpc('hub_staffnews_duplicate', { p_id: id, p_keep_cards: false });
  if (error) { alert(error.message); return; }
  _sn.issue = data; _sn.dirty = false; _sn.suggest = null; snDraw();
}
async function snDelete(id) {
  if (!confirm('Delete this draft?')) return;
  const { error } = await sb.rpc('hub_staffnews_delete', { p_id: id }); if (error) { alert(error.message); return; }
  snLoadList();
}
async function snPublish(on) {
  await snSave(false); const x = _sn.issue; if (!x.id) return;
  const empty = (x.sections || []).filter(s => (s.items || []).length).length === 0;
  if (on && !confirm(empty ? 'There are no cards yet. Publish anyway?' : `Publish “${x.title}” to the Team app? Staff see it under 📰 News straight away.`)) return;
  if (!on && !confirm('Unpublish it? Staff won\u2019t see it until you publish again.')) return;
  const { data, error } = await sb.rpc('hub_staffnews_publish', { p_id: x.id, p_on: on });
  if (error) { alert(error.message); return; }
  x.status = data.status; x.published_at = data.published_at; snDraw();
}
async function snReaders(id) {
  openDutySheet('<h3>Who\u2019s read it</h3><div id="sn-readers">Loading…</div><div class="sheet-actions"><button onclick="closeDutySheet()">Close</button></div>');
  const { data, error } = await sb.rpc('hub_staffnews_readers', { p_id: id });
  const el = document.getElementById('sn-readers'); if (!el) return;
  if (error) { el.textContent = error.message; return; }
  const R = data || [], read = R.filter(r => r.read_at), opened = R.filter(r => !r.read_at && r.opened_at), not = R.filter(r => !r.opened_at);
  const grp = (t, L) => `<h4 style="margin:12px 0 4px">${t} (${L.length})</h4><div class="sn-readers">${L.map(r => `<span>${esc(r.name)} <span class="fd-sm">${esc(STUDIO_NAMES[r.studio_id] || r.studio_id || '')}</span></span>`).join('') || '<span class="fd-sm">Nobody</span>'}</div>`;
  el.innerHTML = grp('✓ Read', read) + grp('👀 Opened, not finished', opened) + grp('Not opened yet', not);
}
function snAddSection(kind) { _sn.issue.sections.push(snSection(kind)); snChanged(); snDraw(); }
function snDelSection(si) { const s = _sn.issue.sections[si]; if ((s.items || []).length && !confirm(`Remove “${s.title}” and its ${s.items.length} card${s.items.length === 1 ? '' : 's'}?`)) return; _sn.issue.sections.splice(si, 1); snChanged(); snDraw(); }
function snMove(si, d) { const S = _sn.issue.sections, t = S[si]; S[si] = S[si + d]; S[si + d] = t; snChanged(); snDraw(); }
function snAddItem(si) { _sn.issue.sections[si].items.push({ title: '', text: '' }); snChanged(); snDraw(); }
function snDelItem(si, ii) { _sn.issue.sections[si].items.splice(ii, 1); snChanged(); snDraw(); }
function snMoveItem(si, ii, d) { const L = _sn.issue.sections[si].items, t = L[ii]; L[ii] = L[ii + d]; L[ii + d] = t; snChanged(); snDraw(); }
async function snSuggest(si) {
  _sn.suggest = { si, rows: null }; snDraw();
  const { data, error } = await sb.rpc('hub_staffnews_suggest', { p_month: _sn.issue.month });
  _sn.suggest = { si, rows: error ? [] : (data || []) }; if (error) alert(error.message); snDraw();
}
function snAddSuggested(si, ri) {
  const r = _sn.suggest.rows[ri];
  _sn.issue.sections[si].items.push({ title: r.title, text: `Starts ${new Date(r.first + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })} at ${r.studios} studio${r.studios === 1 ? '' : 's'}.` });
  _sn.suggest.rows.splice(ri, 1); snChanged(); snDraw();
}
async function snUpload(inp) {
  let file = inp.files && inp.files[0]; if (!file) return;
  const m = document.getElementById('sn-saved'); if (m) m.textContent = 'Uploading the photo…';
  try { file = await nwShrink(file); } catch (e) {}
  if (file.size > 5 * 1024 * 1024) { alert('Please use a photo under 5 MB.'); return; }
  const path = `staff/${_sn.issue.id || 'new'}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
  const { error } = await sb.storage.from('news-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) { alert('The photo didn\u2019t upload: ' + error.message); return; }
  snSetPath(inp.dataset.snup, sb.storage.from('news-media').getPublicUrl(path).data.publicUrl); snDraw();
}
document.addEventListener('input', ev => { const t = ev.target; if (t && t.dataset && t.dataset.sn && _sn.issue && t.closest('#sn-pane')) snSetPath(t.dataset.sn, t.value); });
document.addEventListener('change', ev => { const t = ev.target; if (t && t.dataset && t.dataset.snup && t.closest('#sn-pane')) snUpload(t); });

// ---- staff: Team app → 📰 News ----
let _meNews = { list: null, open: null };
async function meNewsCheck() {
  try { const r = await sb.rpc('hub_staffnews_mine'); _meNews.list = r.error ? null : (r.data || []); } catch (e) { _meNews.list = null; }
  const tab = document.getElementById('me-tab-news'); if (tab) tab.style.display = _meNews.list && _meNews.list.length ? '' : 'none';
  const unread = (_meNews.list || []).filter(x => !x.read), b = document.getElementById('me-news-badge');
  if (b) { b.textContent = unread.length ? '1' : ''; b.style.display = unread.length ? '' : 'none'; }
  const ban = document.getElementById('me-news-banner'), top = (_meNews.list || [])[0];
  if (ban) ban.innerHTML = top && !top.read && _meTab !== 'news' ? `<button class="sn-banner" onclick="meTab('news');meNewsOpen('${escAttr(top.id)}')">📰 <span><b>${esc(top.title)}</b> is here!</span><span class="sn-banner-go">Read →</span></button>` : '';
}
async function meLoadNews() {
  const body = document.getElementById('me-body'); if (!body) return;
  if (_meNews.open) { meNewsOpen(_meNews.open); return; }
  if (_meNews.list === null) await meNewsCheck();
  const L = _meNews.list || [];
  body.innerHTML = `<div class="me-card"><h3>📰 Team News</h3><div class="me-small">The 4Cats staff newsletter, every month.</div></div>` +
    (L.length ? L.map(x => `<button class="sn-li" onclick="meNewsOpen('${escAttr(x.id)}')">${x.cover_image ? `<img src="${escAttr(x.cover_image)}" alt="">` : '<span class="sn-row-ic">📰</span>'}
        <span><b>${esc(x.title)}</b><span class="me-small">${esc(snMonthLabel(x.month))}</span></span>${x.read ? '<span class="sn-li-read">✓</span>' : '<span class="sn-li-new">New</span>'}</button>`).join('') : '<div class="me-small">No newsletters yet.</div>');
}
async function meNewsOpen(id) {
  _meNews.open = id;
  const body = document.getElementById('me-body'); if (!body) return;
  body.innerHTML = '<div class="me-small">Loading…</div>';
  const { data, error } = await sb.rpc('hub_staffnews_open', { p_id: id });
  if (error || !data) { body.innerHTML = `<div class="me-msg err">${esc(error ? error.message : 'Not found')}</div>`; _meNews.open = null; return; }
  body.innerHTML = `<button class="ho-btn" style="margin-bottom:10px" onclick="_meNews.open=null;meLoadNews()">← All newsletters</button><div class="sn-reader">${snIssueHtml(data, { staff: true })}</div>`;
  window.scrollTo(0, 0); meNewsCheck();
}
async function meNewsMarkRead(id) {
  const { error } = await sb.rpc('hub_staffnews_mark_read', { p_id: id }); if (error) { alert(error.message); return; }
  const it = (_meNews.list || []).find(x => x.id === id); if (it) it.read = true;
  await meNewsOpen(id); meNewsCheck();
}
async function meNewsReact(id, emoji, on) {
  const { error } = await sb.rpc('hub_staffnews_react', { p_id: id, p_emoji: emoji, p_on: on }); if (error) { alert(error.message); return; }
  const y = window.scrollY; await meNewsOpen(id); window.scrollTo(0, y);
}

async function openNewsPane() {
  await hoAreaLoad('newsletters'); if (!hoA('newsletters', 'view')) { alert('Newsletters need “Newsletters” on the Access page.'); return; }
  showOnlyPane('news-pane'); setActiveNav('nav-news'); newsDraw();
  const { data, error } = await sb.rpc('news_topics_admin');
  _news.err = error ? (/news_topics_admin/i.test(error.message) ? 'Run news_core.sql in Supabase to switch this on.' : error.message) : '';
  _news.d = error ? null : data; newsDraw(); nwLoad();
}
function newsDraw() {
  const el = document.getElementById('news-pane'); if (!el) return;
  const tab = _nw.tab || 'issues';
  const head = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📧 Newsletters</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="nw-tabs">${[['issues', 'Newsletters'], ['templates', 'Templates'], ['topics', 'Topics & list']].map(t => `<button class="${tab === t[0] ? 'on' : ''}" onclick="nwTab('${t[0]}')">${t[1]}</button>`).join('')}</div>`;
  if (_nw.issue) { el.innerHTML = head + nwEditorHtml(); nwAfterDraw(); return; }
  el.innerHTML = head + (tab === 'topics' ? newsTopicsHtml() : nwListHtml(tab === 'templates'));
}
function newsTopicsHtml() {
  const D = _news.d, C = (D && D.counts) || {}, T = (D && D.topics) || [], n = v => Number(v || 0).toLocaleString('en-CA');
  return `${_news.err ? `<div class="goal-note" style="color:#b91c1c">${esc(_news.err)}</div>` : !D ? '<div class="goal-note">Loading…</div>' : `
    <div class="news-stats">
      <div><b>${n(C.express)}</b><span>Subscribed (opted in)</span></div>
      <div><b>${n(C.implied)}</b><span>Recent customers (implied, under 2 years)</span></div>
      <div><b>${n(C.new_7d)}</b><span>New in the last 7 days</span></div>
      <div><b>${n(C.unsubscribed)}</b><span>Unsubscribed</span></div>
      <div><b>${n(C.bounced)}</b><span>Bounced or complained</span></div>
      ${C.implied_expired ? `<div><b>${n(C.implied_expired)}</b><span>Implied consent ended (not emailed)</span></div>` : ''}
    </div>
    <h3 style="margin:18px 0 6px">Topics</h3>
    <div class="goal-note" style="margin-bottom:8px">Newsletters are sent with one or more topics. Readers can stop emails about a topic from any newsletter (and later choose them on their preferences page). Renaming keeps everyone's choices.</div>
    <div class="oc-wrap"><table class="oc-table"><thead><tr><th>Order</th><th>Topic</th><th>Description (shown to readers)</th><th>Opted out</th><th>On</th><th></th></tr></thead><tbody>
    ${T.map(t => _news.edit === t.id ? `<tr><td><input type="number" id="nt-sort" value="${t.sort}" style="width:60px"></td><td><input id="nt-name" value="${escAttr(t.name)}" maxlength="60"></td>
        <td><input id="nt-desc" value="${escAttr(t.description || '')}" maxlength="140" placeholder="e.g. Classes, camps and PA/PD days for kids"></td><td>${n(t.opted_out)}</td>
        <td><input type="checkbox" id="nt-on" ${t.active ? 'checked' : ''}></td><td><button class="ho-btn sm primary" onclick="newsTopicSave('${t.id}')">Save</button> <button class="ho-btn sm" onclick="_news.edit=null;newsDraw()">Cancel</button></td></tr>`
      : `<tr class="${t.active ? '' : 'ct-off'}"><td>${t.sort}</td><td><b>${esc(t.name)}</b></td><td><small>${esc(t.description || '')}</small></td><td>${n(t.opted_out)}</td><td>${t.active ? '✓' : '—'}</td>
        <td>${hoA('newsletters', 'edit') ? `<button class="ho-btn sm" onclick="_news.edit='${t.id}';newsDraw()">Edit</button>` : ''}</td></tr>`).join('')}
    ${hoA('newsletters', 'edit') ? `<tr><td><input type="number" id="nt-new-sort" value="${T.length + 1}" style="width:60px"></td><td><input id="nt-new-name" maxlength="60" placeholder="New topic"></td>
      <td><input id="nt-new-desc" maxlength="140" placeholder="Description (optional)"></td><td></td><td></td><td><button class="ho-btn sm primary" onclick="newsTopicSave('')">+ Add topic</button></td></tr>` : ''}
    </tbody></table></div><div class="goal-note" id="nt-msg"></div>`}`;
}

// ---- The newsletter builder (news_issues.sql, news-send): list, editor with blocks, live preview, test send, templates ----
let _nw = { tab: 'issues', list: null, tpls: null, issue: null, dirty: false, html: '', device: 'desktop', msg: '' };
const NW_BLOCKS = [['heading', 'Heading'], ['text', 'Text'], ['image', 'Picture'], ['two_images', 'Two pictures'], ['button', 'Button'], ['divider', 'Divider'], ['spacer', 'Space'],
  ['project', '🎨 Workshop / project'], ['class', '📚 Kids class'], ['deal', '🎁 Deal'], ['membership', '⭐ Membership']];
const NW_LIVE = { project: 'project', class: 'class', deal: 'deal' };
const NW_KINDS = [['any', 'anything'], ['workshops', 'a workshop'], ['mini_make', 'a Mini Make'], ['glazing', 'glazing'], ['classes', 'a kids class'], ['camps', 'a camp'], ['pa_days', 'a PA/PD day'], ['kids_parties', 'a kids party'], ['events', 'a get-together or event']];
function nwTab(t) { _nw.tab = t; if (_nw.issue && _nw.dirty && !confirm('Leave without saving?')) return; _nw.issue = null; _nw.dirty = false; nwLoad(); }
async function nwLoad() {
  newsDraw();
  if (_nw.tab === 'topics') return;
  const tpl = _nw.tab === 'templates';
  const { data, error } = await sb.rpc('news_issues_list', { p_templates: tpl });
  if (error) { _nw.msg = /news_issues_list/i.test(error.message) ? 'Run news_issues.sql in Supabase to switch the builder on.' : error.message; }
  if (tpl) _nw.tpls = data || []; else _nw.list = data || [];
  if (!tpl && !_nw.tpls) { const r = await sb.rpc('news_issues_list', { p_templates: true }); _nw.tpls = r.data || []; }
  newsDraw();
}
function nwListHtml(tpl) {
  const L = tpl ? _nw.tpls : _nw.list;
  const when = v => v ? new Date(v).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const st = { draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending…', sent: 'Sent' };
  return `${_nw.msg ? `<div class="goal-note" style="color:#b91c1c">${esc(_nw.msg)}</div>` : ''}
    ${hoA('newsletters', 'edit') ? `<div class="nw-new"><button class="ho-btn primary" onclick="nwNew(null, ${tpl})">+ New ${tpl ? 'template' : 'newsletter'}</button>
      ${!tpl && (_nw.tpls || []).length ? `<span class="goal-note">or start from a template:</span> ${(_nw.tpls || []).map(t => `<button class="ho-btn sm" onclick="nwNew('${t.id}', false)">📐 ${esc(t.title)}</button>`).join(' ')}` : ''}</div>` : ''}
    ${L === null ? '<div class="goal-note">Loading…</div>' : !L.length ? `<div class="goal-note">No ${tpl ? 'templates' : 'newsletters'} yet.</div>` : `
    <div class="oc-wrap"><table class="oc-table"><thead><tr><th>${tpl ? 'Template' : 'Newsletter'}</th><th>Subject</th><th>Topics</th>${tpl ? '' : '<th>Status</th>'}<th>Updated</th><th></th></tr></thead><tbody>
    ${L.map(i => `<tr><td><b>${esc(i.title)}</b><br><small>${i.blocks_n} block${i.blocks_n === 1 ? '' : 's'}${i.test_count ? ` · ${i.test_count} test${i.test_count === 1 ? '' : 's'} sent` : ''}</small></td><td>${esc(i.subject || '')}</td>
      <td><small>${(i.topics || []).map(t => esc(nwTopicName(t))).join(', ')}</small></td>${tpl ? '' : `<td>${st[i.status] || i.status}</td>`}<td><small>${when(i.updated_at)}${i.updated_by ? '<br>' + esc(i.updated_by) : ''}</small></td>
      <td style="white-space:nowrap"><button class="ho-btn sm" onclick="nwOpen('${i.id}')">${i.status === 'sent' ? 'View' : 'Edit'}</button>
        ${hoA('newsletters', 'edit') ? `<button class="ho-btn sm" onclick="nwDup('${i.id}', false)">Duplicate</button>${i.status !== 'sent' ? ` <button class="ho-btn sm ct-del" onclick="nwDel('${i.id}')">Delete</button>` : ''}` : ''}</td></tr>`).join('')}
    </tbody></table></div>`}`;
}
function nwTopicName(slug) { const t = ((_news.d && _news.d.topics) || []).find(x => x.slug === slug); return t ? t.name : slug; }
async function nwNew(fromId, tpl) {
  if (fromId) { const { data, error } = await sb.rpc('news_issue_duplicate', { p_id: fromId, p_template: false, p_title: 'New newsletter' }); if (error) { alert(error.message); return; } return nwOpen(data); }
  _nw.issue = { id: null, title: tpl ? 'New template' : 'New newsletter', subject: '', preheader: '', topics: [], blocks: [{ type: 'heading', text: 'Hello from 4Cats!' }, { type: 'text', text: 'Write your news here.' }], is_template: !!tpl, status: 'draft' };
  _nw.dirty = true; _nw.html = ''; _nw.count = null; _nw.pick = null; newsDraw(); nwPreview(); nwCount();
}
async function nwOpen(id) {
  const { data, error } = await sb.rpc('news_issue_get', { p_id: id }); if (error || !data) { alert(error ? error.message : 'Not found'); return; }
  _nw.issue = data; _nw.dirty = false; _nw.html = ''; _nw.count = null; _nw.pick = null; newsDraw(); nwPreview(); nwCount();
}
async function nwDup(id, tpl) { const { data, error } = await sb.rpc('news_issue_duplicate', { p_id: id, p_template: tpl, p_title: null }); if (error) { alert(error.message); return; } nwOpen(data); }
async function nwDel(id) { if (!confirm('Delete this? It can\'t be undone.')) return; const { error } = await sb.rpc('news_issue_delete', { p_id: id }); if (error) { alert(error.message); return; } nwLoad(); }

function nwBlockFields(b, i) {
  const f = (k, label, ph, area) => `<label class="nw-f">${label}${area ? `<textarea data-nwb="${i}" data-k="${k}" rows="${area}" placeholder="${escAttr(ph || '')}">${esc(b[k] || '')}</textarea>` : `<input data-nwb="${i}" data-k="${k}" value="${escAttr(b[k] || '')}" placeholder="${escAttr(ph || '')}">`}</label>`;
  const sel = (k, label, opts) => `<label class="nw-f nw-sm">${label}<select data-nwb="${i}" data-k="${k}">${opts.map(o => `<option value="${o[0]}"${(b[k] || opts[0][0]) === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
  const pic = (k, label) => `<div class="nw-pic">${b[k] && b[k].url ? `<img src="${escAttr(b[k].url)}" alt="">` : ''}<label class="nw-f">${label} link<input data-nwb="${i}" data-k="${k}.url" value="${escAttr((b[k] && b[k].url) || '')}" placeholder="https://… or upload"></label>
    <label class="ho-btn sm nw-up">⬆ Upload<input type="file" accept="image/*" data-nwup="${i}" data-k="${k}.url" hidden></label>
    <label class="nw-f">Description (for screen readers)<input data-nwb="${i}" data-k="${k}.alt" value="${escAttr((b[k] && b[k].alt) || '')}"></label>
    <label class="nw-f">Clicks go to (optional)<input data-nwb="${i}" data-k="${k}.link" value="${escAttr((b[k] && b[k].link) || '')}" placeholder="https://world.4cats.com/…"></label>
    ${k !== 'pic' ? `<label class="nw-f">Caption (optional)<input data-nwb="${i}" data-k="${k}.caption" value="${escAttr((b[k] && b[k].caption) || '')}"></label>` : ''}</div>`;
  switch (b.type) {
    case 'heading': return f('text', 'Heading', 'New this week') + sel('size', 'Size', [['medium', 'Medium'], ['large', 'Large'], ['small', 'Small']]) + sel('align', 'Align', [['left', 'Left'], ['center', 'Centre']]) + sel('color', 'Colour', [['ink', 'Dark'], ['red', '4Cats red']]);
    case 'text': return f('text', 'Text', 'Write here. **bold**, *italic*, [link words](https://…). A blank line starts a new paragraph.', 5) + sel('align', 'Align', [['left', 'Left'], ['center', 'Centre']]);
    case 'image': return pic('pic', 'Picture') + `<label class="nw-f nw-sm"><input type="checkbox" data-nwb="${i}" data-k="full"${b.full ? ' checked' : ''}> Full width (edge to edge)</label>`;
    case 'two_images': return `<div class="nw-two">${pic('a', 'Left picture')}${pic('b', 'Right picture')}</div>`;
    case 'button': return f('label', 'Button words', 'Book now') + f('url', 'Goes to', 'https://world.4cats.com/#inspire') + sel('style', 'Style', [['solid', 'Red'], ['outline', 'Outline']]) + sel('align', 'Align', [['center', 'Centre'], ['left', 'Left']]);
    case 'spacer': return sel('height', 'Height', [['24', 'Medium'], ['12', 'Small'], ['48', 'Large']]);
    case 'project': case 'class': case 'deal': return nwPickHtml(b, i) + nwLiveFields(b, i, f);
    case 'membership': return '<small class="goal-note">A "Become a 4Cats member" card linking to Membership. Change any wording below.</small>' + nwLiveFields(b, i, f);
    default: return '<small class="goal-note">A thin line between sections.</small>';
  }
}
// Live blocks: choose the project / class / deal (search), and optional wording changes (blank = World's own)
function nwPickHtml(b, i) {
  const k = NW_LIVE[b.type], R = (_nw.pick && _nw.pick.i === i) ? _nw.pick.rows : null;
  return `<div class="nw-pick"><div><b>${b.ref ? '✓ ' + esc(b.ref_name || 'Chosen') : 'Nothing chosen yet'}</b> <small class="goal-note">${b.type === 'deal' ? 'Upcoming deal days' : b.type === 'class' ? 'Kids class pages' : 'Projects (price from its World-only workshop, if it has one)'}</small></div>
    <div class="nw-test"><input placeholder="Search…" value="${escAttr((_nw.pick && _nw.pick.i === i && _nw.pick.q) || '')}" oninput="nwPickSearch(${i}, '${k}', this.value)" onfocus="if(!(_nw.pick&&_nw.pick.i===${i}))nwPickSearch(${i}, '${k}', '')"></div>
    ${R ? `<div class="nw-pick-list">${R.length ? R.map((r, n) => `<button type="button" onclick="nwPickChoose(${i}, ${n})">${r.image ? `<img src="${escAttr(r.image)}" alt="">` : '<span class="nw-noimg"></span>'}<span>${esc(r.name)}${r.price ? ` <small>$${Number(r.price).toFixed(0)}</small>` : ''}</span></button>`).join('') : '<small class="goal-note">Nothing found.</small>'}</div>` : ''}</div>`;
}
function nwLiveFields(b, i, f) {
  return `<details class="nw-more"><summary>Change the wording (optional)</summary>${f('eyebrow', 'Small label on top', b.type === 'deal' ? 'Deal of the day · …' : b.type === 'class' ? 'Kids class' : b.type === 'membership' ? '4Cats membership' : 'Workshop')}
    ${f('title', 'Title', 'blank = its own name')}${f('text', 'Description', 'blank = its own description', 3)}${f('button', 'Button words', b.type === 'class' ? 'See dates' : b.type === 'deal' ? 'See the deal' : b.type === 'membership' ? 'Join now' : 'Book now')}
    ${b.type === 'project' || b.type === 'class' ? `<label class="nw-f nw-sm"><input type="checkbox" data-nwb="${i}" data-k="show_price"${b.show_price === false ? '' : ' checked'}> Show the price</label>` : ''}</details>`;
}
let _nwPickT = null;
function nwPickSearch(i, kind, q) {
  _nw.pick = Object.assign(_nw.pick && _nw.pick.i === i ? _nw.pick : { i, rows: null }, { q });
  clearTimeout(_nwPickT); _nwPickT = setTimeout(async () => {
    const { data, error } = await sb.rpc('news_pick_list', { p_kind: kind, p_search: q || null });
    if (!_nw.pick || _nw.pick.i !== i) return; _nw.pick.rows = error ? [] : (data || []);
    const el = document.querySelectorAll('.nw-block')[i]; if (!el) return; const box = el.querySelector('.nw-pick');
    if (box) { const tmp = document.createElement('div'); tmp.innerHTML = nwPickHtml(_nw.issue.blocks[i], i); box.replaceWith(tmp.firstElementChild); const inp = el.querySelector('.nw-pick input'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  }, 250);
}
function nwPickChoose(i, n) {
  const r = _nw.pick && _nw.pick.rows && _nw.pick.rows[n]; if (!r) return;
  Object.assign(_nw.issue.blocks[i], { ref: r.id, ref_name: r.name }); _nw.pick = null; _nw.dirty = true; newsDraw(); nwPreview();
}
// Audience: everyone (who's subscribed, with current consent, and hasn't stopped its topics), or choose by rules
function nwAudienceHtml(ro) {
  const A = _nw.issue.audience || { type: 'all' }, R = A.type === 'rules', dis = ro ? 'disabled' : '';
  const st = Object.keys(STUDIO_NAMES || {}).sort((x, y) => (STUDIO_NAMES[x] || x).localeCompare(STUDIO_NAMES[y] || y));
  const num = (path, v, ph) => `<input type="number" min="0" max="3650" data-nwa="${path}" value="${escAttr(v ?? '')}" placeholder="${ph || ''}" ${dis} class="nw-num">`;
  const kinds = (path, v) => `<select data-nwa="${path}" ${dis}>${NW_KINDS.map(o => `<option value="${o[0]}"${(v || 'any') === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  return `<h4 class="nw-h">Who gets it</h4>
    <div class="nw-aud"><label><input type="radio" name="nwaud" value="all" ${!R ? 'checked' : ''} ${dis} data-nwa="type"> Everyone on the list</label>
      <label><input type="radio" name="nwaud" value="rules" ${R ? 'checked' : ''} ${dis} data-nwa="type"> Choose who</label></div>
    ${R ? `<div class="nw-rules">
      <div><b>Studios</b> <small class="goal-note">(their studio, or booked there in the last year; none ticked = all)</small>
        <div class="nw-prov">${['BC', 'AB', 'ON'].map(pv => `<label><input type="checkbox" data-nwa="provinces" value="${pv}" ${(A.provinces || []).includes(pv) ? 'checked' : ''} ${dis}> All ${pv}</label>`).join('')}</div>
        <details class="nw-more"><summary>Pick studios${(A.studios || []).length ? ` (${A.studios.length} chosen)` : ''}</summary><div class="nw-studios">${st.map(id => `<label><input type="checkbox" data-nwa="studios" value="${id}" ${(A.studios || []).includes(id) ? 'checked' : ''} ${dis}> ${esc(STUDIO_NAMES[id] || id)}</label>`).join('')}</div></details></div>
      <div><b>Membership</b> <select data-nwa="members" ${dis}>${[['any', 'Anyone'], ['yes', 'Members'], ['no', 'Not members'], ['lapsed', 'Lapsed in the last year']].map(o => `<option value="${o[0]}"${(A.members || 'any') === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div>
      <div><b>Booked</b> ${kinds('booked.kind', A.booked && A.booked.kind)} in the last ${num('booked.days', A.booked && A.booked.days, 'days')} days</div>
      <div><b>Haven't booked</b> anything in ${num('not_booked_days', A.not_booked_days, 'days')} days <small class="goal-note">(but have before)</small></div>
      <div><b>Coming up:</b> ${kinds('upcoming.kind', A.upcoming && A.upcoming.kind)} in the next ${num('upcoming.days', A.upcoming && A.upcoming.days, 'days')} days</div>
      <div><b>Kids aged</b> ${num('kid_ages.min', A.kid_ages && A.kid_ages.min, 'from')} to ${num('kid_ages.max', A.kid_ages && A.kid_ages.max, 'to')}</div>
      <small class="goal-note">Leave a rule blank to skip it. People must match every rule you fill in.</small></div>` : ''}
    <div class="nw-count" id="nw-count">${_nw.count ? nwCountText(_nw.count) : 'Counting…'}</div>`;
}
function nwCountText(c) { return c.error ? 'Couldn\'t count: ' + esc(c.error) : `<b>${Number(c.total || 0).toLocaleString('en-CA')} people</b> would get it <small>(${Number(c.express || 0).toLocaleString('en-CA')} opted in · ${Number(c.implied || 0).toLocaleString('en-CA')} recent customers)</small>`; }
let _nwCountT = null;
function nwCount() {
  clearTimeout(_nwCountT); _nwCountT = setTimeout(async () => {
    if (!_nw.issue || _nw.issue.is_template) return;
    const { data, error } = await sb.rpc('news_audience_count', { p_audience: _nw.issue.audience || { type: 'all' }, p_topics: _nw.issue.topics || [] });
    _nw.count = error ? { error: error.message } : data; const el = document.getElementById('nw-count'); if (el) el.innerHTML = nwCountText(_nw.count); nwChecksRefresh();
  }, 500);
}
// The pre-send checklist: everything that must be right before a newsletter can go out (sending stays locked until all ✓)
function nwChecks() {
  const I = _nw.issue, B = I.blocks || [], url = u => /^(https?:\/\/|mailto:|tel:)/i.test(String(u || '').trim());
  const pics = B.flatMap(b => b.type === 'image' ? [b.pic] : b.type === 'two_images' ? [b.a, b.b] : []).filter(x => x && x.url);
  const links = B.flatMap(b => b.type === 'button' ? [b.url] : b.type === 'image' ? [b.pic && b.pic.link] : b.type === 'two_images' ? [b.a && b.a.link, b.b && b.b.link] : []).filter(Boolean);
  const textLinks = B.filter(b => b.type === 'text').flatMap(b => [...String(b.text || '').matchAll(/\]\(([^)]*)\)/g)].map(m => m[1]));
  const liveMissing = B.filter(b => NW_LIVE[b.type] && !b.ref).length;
  const c = _nw.count;
  return [
    ['Subject', !!String(I.subject || '').trim(), 'Add a subject.'],
    ['Preview text', !!String(I.preheader || '').trim(), 'Add the grey line that shows after the subject in inboxes.'],
    ['Content', B.some(b => ['text', 'heading', 'image', 'project', 'class', 'deal', 'membership'].includes(b.type)), 'Add some blocks.'],
    ['Every picture has a description', pics.every(x => String(x.alt || '').trim()), `${pics.filter(x => !String(x.alt || '').trim()).length} picture(s) need a description (screen readers, and when pictures don't load).`],
    ['Every 4Cats block is chosen', !liveMissing, `${liveMissing} workshop / class / deal block(s) have nothing chosen.`],
    ['Links work', links.concat(textLinks).every(url) && B.filter(b => b.type === 'button').every(b => b.label && url(b.url)), 'A button or link is missing its words or a proper web address (https://…).'],
    ['Topics chosen', (I.topics || []).length > 0, 'Tick at least one topic (it decides who has opted out).'],
    ['Audience', !!(c && !c.error && c.total > 0), c && !c.error ? 'Nobody matches this audience.' : 'Counting the audience…'],
    ['Saved', !_nw.dirty && !!I.id, 'Save your changes.'],
    ['Test sent', (I.test_count || 0) > 0 && !!I.last_test_at && (!I.updated_at || new Date(I.last_test_at) >= new Date(I.updated_at) - 2000), 'Send yourself a test of this version.'],
  ];
}
function nwChecksHtml() {
  const L = nwChecks(), ok = L.every(x => x[1]);
  return `<h4 class="nw-h">Ready to send?</h4><div class="nw-checks ${ok ? 'ok' : ''}">${L.map(x => `<div class="${x[1] ? 'y' : 'n'}">${x[1] ? '✓' : '○'} <b>${esc(x[0])}</b>${x[1] ? '' : ` <small>${esc(x[2])}</small>`}</div>`).join('')}
    <div class="nw-sendrow"><button class="ho-btn primary" disabled title="${ok ? 'Sending through Resend is the next step to build' : 'Finish the checklist first'}">📨 Schedule or send</button>
    <small class="goal-note">${ok ? 'All set. Sending through Resend is being built next.' : 'Sending unlocks when every item has a ✓.'} The mailing address is checked when sending.</small></div></div>`;
}
function nwChecksRefresh() { const el = document.getElementById('nw-checks-wrap'); if (el && _nw.issue && !_nw.issue.is_template && _nw.issue.status !== 'sent') el.innerHTML = nwChecksHtml(); }
function nwEditorHtml() {
  const I = _nw.issue, ro = I.status === 'sent' || !hoA('newsletters', 'edit'), T = ((_news.d && _news.d.topics) || []).filter(t => t.active);
  return `<div class="nw-bar"><button class="ho-btn" onclick="nwClose()">← ${I.is_template ? 'Templates' : 'Newsletters'}</button>
      <b class="nw-state">${I.status === 'sent' ? 'Sent (read only: duplicate it to change)' : _nw.dirty ? '● Unsaved changes' : I.id ? '✓ Saved' : ''}</b><span class="spacer"></span>
      ${ro ? '' : `<button class="ho-btn primary" onclick="nwSave()">Save</button>`}
      ${I.id && hoA('newsletters', 'edit') ? `<button class="ho-btn" onclick="nwDup('${I.id}', ${!I.is_template})">${I.is_template ? 'Duplicate template' : '📐 Save as a template'}</button>` : ''}</div>
    <div class="nw-wrap"><div class="nw-left">
      <label class="nw-f">Name (for the team)<input data-nwi="title" value="${escAttr(I.title || '')}" ${ro ? 'disabled' : ''}></label>
      <label class="nw-f">Subject<input data-nwi="subject" value="${escAttr(I.subject || '')}" maxlength="150" placeholder="This week at 4Cats: …" ${ro ? 'disabled' : ''}></label>
      <label class="nw-f">Preview text <small>(the grey line after the subject in inboxes)</small><input data-nwi="preheader" value="${escAttr(I.preheader || '')}" maxlength="150" ${ro ? 'disabled' : ''}></label>
      <div class="nw-f">Topics <small>(readers who stopped these won't get it, once sending is switched on)</small><div class="nw-topics">${T.map(t => `<label><input type="checkbox" data-nwtopic="${t.slug}"${(I.topics || []).includes(t.slug) ? ' checked' : ''} ${ro ? 'disabled' : ''}> ${esc(t.name)}</label>`).join('')}</div></div>
      ${I.is_template ? '' : nwAudienceHtml(ro)}
      <h4 class="nw-h">Blocks</h4><small class="goal-note">Tip: type <code>{first_name}</code> in a heading, text or the subject for the reader's first name ("friend" if we don't have it).</small>
      ${(I.blocks || []).map((b, i) => `<div class="nw-block"><div class="nw-bh"><b>${esc((NW_BLOCKS.find(x => x[0] === b.type) || [, b.type])[1])}</b><span class="spacer"></span>
          ${ro ? '' : `<button class="ho-btn sm" onclick="nwMove(${i},-1)" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="ho-btn sm" onclick="nwMove(${i},1)" ${i < I.blocks.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button class="ho-btn sm ct-del" onclick="nwRemove(${i})" aria-label="Remove">✕</button>`}</div>
        <fieldset ${ro ? 'disabled' : ''} class="nw-fs">${nwBlockFields(b, i)}</fieldset></div>`).join('')}
      ${ro ? '' : `<div class="nw-add"><span class="goal-note">Add:</span> ${NW_BLOCKS.map(x => `<button class="ho-btn sm" onclick="nwAdd('${x[0]}')">+ ${x[1]}</button>`).join(' ')}</div>`}
      ${I.id && !I.is_template ? `<h4 class="nw-h">Send a test</h4><div class="nw-test"><input id="nw-test-to" placeholder="you@4cats.com (up to 5, separated by commas)" value="${escAttr(_nw.testTo || '')}"><button class="ho-btn" onclick="nwTest()">✉ Send test</button></div>
        <div class="goal-note">Tests are marked [TEST]. Save first: tests use the saved version.</div>` : ''}
      <div id="nw-checks-wrap">${I.id && !I.is_template && I.status !== 'sent' ? nwChecksHtml() : ''}</div>
      <div class="goal-note" id="nw-msg">${esc(_nw.msg || '')}</div>
    </div>
    <div class="nw-right"><div class="nw-dev"><button class="${_nw.device === 'desktop' ? 'on' : ''}" onclick="_nw.device='desktop';nwAfterDraw()">💻 Desktop</button><button class="${_nw.device === 'phone' ? 'on' : ''}" onclick="_nw.device='phone';nwAfterDraw()">📱 Phone</button></div>
      <div class="nw-inbox"><b>${esc(I.subject || '(no subject)')}</b><span>${esc(I.preheader || '')}</span></div>
      <iframe id="nw-frame" title="Newsletter preview" class="nw-frame ${_nw.device}"></iframe></div></div>`;
}
function nwAfterDraw() {
  const fr = document.getElementById('nw-frame'); if (!fr) return;
  fr.className = 'nw-frame ' + _nw.device; if (_nw.html) fr.srcdoc = _nw.html;
  document.querySelectorAll('.nw-dev button').forEach(b => b.classList.toggle('on', b.textContent.includes(_nw.device === 'phone' ? 'Phone' : 'Desktop')));
  const pane = document.getElementById('news-pane'); if (!pane || pane.__nwBound) return; pane.__nwBound = true;
  pane.addEventListener('input', e => nwField(e.target));
  pane.addEventListener('change', e => { if (e.target.matches('[data-nwup]')) nwUpload(e.target); else nwField(e.target); });
}
function nwSet(obj, path, val) { const k = path.split('.'); let o = obj; for (let j = 0; j < k.length - 1; j++) { if (!o[k[j]] || typeof o[k[j]] !== 'object') o[k[j]] = {}; o = o[k[j]]; } o[k[k.length - 1]] = val; }
function nwField(t) {
  const I = _nw.issue; if (!I || !t) return;
  if (t.dataset.nwi) I[t.dataset.nwi] = t.value;
  else if (t.dataset.nwtopic) { const S = new Set(I.topics || []); t.checked ? S.add(t.dataset.nwtopic) : S.delete(t.dataset.nwtopic); I.topics = [...S]; }
  else if (t.dataset.nwb != null) nwSet(I.blocks[+t.dataset.nwb], t.dataset.k, t.type === 'checkbox' ? t.checked : t.value);
  else if (t.dataset.nwa) {
    const A = I.audience = I.audience || { type: 'all' }, k = t.dataset.nwa;
    if (k === 'type') { A.type = t.value; _nw.dirty = true; newsDraw(); nwCount(); return; }
    if (k === 'studios' || k === 'provinces') { const S = new Set(A[k] || []); t.checked ? S.add(t.value) : S.delete(t.value); A[k] = [...S]; }
    else nwSet(A, k, t.type === 'number' ? (t.value === '' ? null : +t.value) : t.value);
    _nw.dirty = true; const st0 = document.querySelector('.nw-state'); if (st0) st0.textContent = '● Unsaved changes'; nwCount(); return;
  }
  else return;
  if (t.dataset.nwtopic) nwCount();
  _nw.dirty = true; const st = document.querySelector('.nw-state'); if (st) st.textContent = '● Unsaved changes';
  if (t.dataset.nwi === 'subject' || t.dataset.nwi === 'preheader') { const ib = document.querySelector('.nw-inbox'); if (ib) ib.innerHTML = `<b>${esc(I.subject || '(no subject)')}</b><span>${esc(I.preheader || '')}</span>`; }
  clearTimeout(_nw.t); _nw.t = setTimeout(nwPreview, 600); nwChecksRefresh();
}
async function nwPreview() {
  if (!_nw.issue) return;
  const { data, error } = await sb.functions.invoke('news-send', { body: { action: 'render', issue: _nw.issue } });
  if (error) { const m = document.getElementById('nw-msg'); if (m) m.textContent = 'Preview didn\'t load (deploy news-send?): ' + (error.message || error); return; }
  _nw.html = (data && data.html) || ''; const fr = document.getElementById('nw-frame'); if (fr) fr.srcdoc = _nw.html;
}
function nwAdd(type) { _nw.issue.blocks.push(type === 'spacer' ? { type, height: '24' } : type === 'button' ? { type, label: 'Book now', url: 'https://world.4cats.com' } : { type }); _nw.dirty = true; newsDraw(); nwPreview();
  if (NW_LIVE[type]) setTimeout(() => { const L = document.querySelectorAll('.nw-block'), inp = L[L.length - 1] && L[L.length - 1].querySelector('.nw-pick input'); if (inp) { inp.scrollIntoView({ block: 'center' }); inp.focus(); } }, 50); }
function nwMove(i, d) { const B = _nw.issue.blocks, j = i + d; if (j < 0 || j >= B.length) return; [B[i], B[j]] = [B[j], B[i]]; _nw.dirty = true; newsDraw(); nwPreview(); }
function nwRemove(i) { _nw.issue.blocks.splice(i, 1); _nw.dirty = true; newsDraw(); nwPreview(); }
// Newsletter pictures: shrink to 1200px wide (twice the email's width, sharp on phones) and compress, before uploading.
// PNGs that are already small (logos, graphics with see-through parts) are kept as they are.
async function nwShrink(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return file;   // (GIFs and others: as they are)
  try {
    const bmp = await createImageBitmap(file), png = /png/i.test(file.type);
    if (bmp.width <= 1200 && (png ? file.size < 600 * 1024 : file.size < 350 * 1024)) return file;   // already email-sized
    const scale = Math.min(1, 1200 / bmp.width), w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); if (!png) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); } g.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.82));   // (PNG keeps see-through parts)
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + (png ? '.png' : '.jpg'), { type: png ? 'image/png' : 'image/jpeg' });
  } catch (e) { return file; }   // (a format the browser can't read: uploaded as it is)
}
async function nwUpload(inp) {
  let file = inp.files && inp.files[0]; if (!file) return;
  const m0 = document.getElementById('nw-msg'); if (m0) m0.textContent = 'Preparing the picture…';
  file = await nwShrink(file);
  if (file.size > 5 * 1024 * 1024) { alert('Please use a picture under 5 MB.'); return; }
  const path = `${_nw.issue.id || 'new'}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
  const m = document.getElementById('nw-msg'); if (m) m.textContent = 'Uploading…';
  const { error } = await sb.storage.from('news-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) { if (m) m.textContent = 'Upload didn\'t work: ' + error.message; return; }
  const url = sb.storage.from('news-media').getPublicUrl(path).data.publicUrl;
  nwSet(_nw.issue.blocks[+inp.dataset.nwup], inp.dataset.k, url); _nw.dirty = true; newsDraw(); nwPreview();
}
async function nwSave() {
  const I = _nw.issue; const m = document.getElementById('nw-msg');
  const { data, error } = await sb.rpc('news_issue_save', { p: { id: I.id, title: I.title, subject: I.subject, preheader: I.preheader, topics: I.topics || [], blocks: I.blocks || [], audience: I.audience || { type: 'all' }, is_template: !!I.is_template } });
  if (error) { if (m) m.textContent = 'Not saved: ' + error.message; return false; }
  I.id = data; I.updated_at = new Date().toISOString(); _nw.dirty = false; newsDraw(); nwPreview(); nwCount(); return true;
}
async function nwTest() {
  const I = _nw.issue, m = document.getElementById('nw-msg');
  if (_nw.dirty && !(await nwSave())) return;
  const to = (document.getElementById('nw-test-to').value || '').split(/[,\s]+/).filter(Boolean); _nw.testTo = to.join(', ');
  if (m) m.textContent = 'Sending…';
  const { data, error } = await sb.functions.invoke('news-send', { body: { action: 'test', id: I.id, to: to.length ? to : undefined } });
  const mm = document.getElementById('nw-msg'); if (mm) mm.textContent = error ? 'Test not sent: ' + ((data && data.error) || error.message || error) : '✓ Test sent to ' + (data.to || []).join(', ');
  if (!error) { I.test_count = (I.test_count || 0) + 1; I.last_test_at = new Date().toISOString(); I.updated_at = I.updated_at || I.last_test_at; nwChecksRefresh(); }
}
function nwClose() { if (_nw.dirty && !confirm('Leave without saving?')) return; _nw.issue = null; _nw.dirty = false; nwLoad(); }
async function newsTopicSave(id) {
  const v = k => (document.getElementById(k) || {}).value || '';
  const p = id ? { id, name: v('nt-name'), description: v('nt-desc'), sort: +v('nt-sort') || 0, active: document.getElementById('nt-on').checked }
               : { name: v('nt-new-name'), description: v('nt-new-desc'), sort: +v('nt-new-sort') || 99, active: true };
  if (!String(p.name).trim()) { document.getElementById('nt-msg').textContent = 'Give the topic a name.'; return; }
  const { error } = await sb.rpc('news_topic_save', { p });
  if (error) { document.getElementById('nt-msg').textContent = 'Not saved: ' + error.message; return; }
  _news.edit = null; openNewsPane();
}


// ---------- Announcement formatting: **bold**, *italic*, [link](https://…), - bullets, # headings, blank line = new paragraph ----------
function annInlineMd(t) {   // (already escaped text)
  return t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<i>$2</i>').replace(/(^|\W)_([^_\n]+?)_(?=\W|$)/g, '$1<i>$2</i>');
}
function annMd(text) {
  const lines = String(text || '').replace(/\r/g, '').replace(/^\s*\n+|\n+\s*$/g, '').split('\n');
  let out = '', para = [], list = [];
  const flushP = () => { if (para.length) { out += '<p>' + para.map(l => annInlineMd(esc(l.trim()))).join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list.length) { out += '<ul>' + list.map(l => '<li>' + annInlineMd(esc(l)) + '</li>').join('') + '</ul>'; list = []; } };
  for (const raw of lines) {
    const l = raw.trimEnd(), m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/), hd = l.match(/^\s*#{1,3}\s+(.*)$/);
    if (!l.trim()) { flushP(); flushL(); continue; }
    if (m && !/^\s*\*\*/.test(l)) { flushP(); list.push(m[1]); continue; }
    if (hd) { flushP(); flushL(); out += '<p class="ann-h">' + annInlineMd(esc(hd[1])) + '</p>'; continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out;
}
// A title (one line): bold and italics, no stray **
function annTitleMd(t) { return annInlineMd(esc(String(t || '').trim())).replace(/\*\*/g, ''); }
// A short plain snippet (the top banner): the formatting marks taken out
function annPlain(t, n) { const s = String(t || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|__/g, '').replace(/(^|\s)[*_](\S)/g, '$1$2').replace(/(\S)[*_](?=\s|$|[.,;:!?])/g, '$1')
  .replace(/^\s*(?:[-•]|#{1,3})\s+/gm, '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s; }
// ---- The editor: a toolbar, and pasting from Google Docs, email or a web page keeps bold, italics, links and lists ----
function annFmt(kind) {
  const ta = document.getElementById('ho-f-body'); if (!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b);
  let ins, caret;
  if (kind === 'b' || kind === 'i') { const m = kind === 'b' ? '**' : '*'; ins = m + (sel || (kind === 'b' ? 'bold text' : 'italic text')) + m; caret = sel ? a + ins.length : a + m.length; }
  else if (kind === 'link') { const url = prompt('Link address (https://…)', 'https://'); if (!url || !/^https?:\/\/\S+/.test(url)) return; ins = `[${sel || 'link text'}](${url.trim()})`; caret = a + ins.length; }
  else if (kind === 'list') { const start = v.lastIndexOf('\n', a - 1) + 1; const block = v.slice(start, b) || ''; const lines = (block || 'First point').split('\n').map(l => /^\s*-\s/.test(l) ? l : '- ' + l);
    ta.value = v.slice(0, start) + lines.join('\n') + v.slice(b); ta.focus(); ta.setSelectionRange(start, start + lines.join('\n').length); hoFormChanged(); return; }
  ta.value = v.slice(0, a) + ins + v.slice(b); ta.focus();
  // no text was selected: the placeholder words are selected, ready to type over
  if (sel) ta.setSelectionRange(a + ins.length, a + ins.length);
  else if (kind === 'link') ta.setSelectionRange(a + 1, a + 1 + 'link text'.length);
  else { const m = kind === 'b' ? 2 : 1; ta.setSelectionRange(a + m, a + ins.length - m); }
  hoFormChanged();
}
function annHtmlToMd(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (n, ctx) => {
    if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, ' ');
    if (n.nodeType !== 1) return '';
    const tag = n.tagName.toLowerCase(), st = n.getAttribute('style') || '';
    if (/^(style|script|head|title|meta)$/.test(tag)) return '';
    const fw = (st.match(/font-weight:\s*(\w+)/) || [])[1];
    const bold = (tag === 'b' || tag === 'strong' || /^(bold|[6-9]00)$/.test(fw || '')) && fw !== 'normal' && fw !== '400' && !ctx.b;
    const ital = (tag === 'i' || tag === 'em' || /font-style:\s*italic/.test(st)) && !ctx.i;
    let inner = [...n.childNodes].map(c => walk(c, { b: ctx.b || bold, i: ctx.i || ital, li: ctx.li || tag === 'li' })).join('');
    if (tag === 'br') return '\n';
    if (tag === 'a' && n.getAttribute('href') && /^https?:/.test(n.getAttribute('href'))) inner = `[${inner.trim()}](${n.getAttribute('href')})`;
    if (bold && inner.trim()) inner = inner.replace(/^(\s*)(.*?)(\s*)$/s, '$1**$2**$3');
    if (ital && inner.trim()) inner = inner.replace(/^(\s*)(.*?)(\s*)$/s, '$1*$2*$3');
    if (tag === 'li') return '\n- ' + inner.trim();
    if (/^h[1-6]$/.test(tag)) return '\n\n**' + inner.trim().replace(/\*\*/g, '') + '**\n\n';
    if (/^(p|div|ul|ol|table|tr|blockquote|section)$/.test(tag)) return '\n' + inner + '\n';
    return inner;
  };
  return walk(doc.body, {}).replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\*\*\s*\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
function annPaste(e) {
  const cd = e.clipboardData; if (!cd) return;
  const html = cd.getData('text/html'), text = cd.getData('text/plain');
  let md = html ? annHtmlToMd(html) : String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!md) return;
  e.preventDefault();
  const ta = e.target, a = ta.selectionStart, b = ta.selectionEnd;
  ta.value = ta.value.slice(0, a) + md + ta.value.slice(b); ta.setSelectionRange(a + md.length, a + md.length);
  hoFormChanged();
}
function annTitlePaste(e) {   // a title: one plain line
  const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; if (!t) return;
  e.preventDefault(); const ta = e.target, a = ta.selectionStart, clean = t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  ta.value = ta.value.slice(0, a) + clean + ta.value.slice(ta.selectionEnd); ta.setSelectionRange(a + clean.length, a + clean.length); hoFormChanged();
}
async function openAnnouncePane() {
  await hoAreaLoad('staff_comms'); if (!hoA('staff_comms', 'view')) { alert('Announcements need “Staff comms” on the Access page.'); return; }
  showOnlyPane('announce-pane');
  setActiveNav('nav-announce');
  document.getElementById('ho-new-btn').style.display = hoA('staff_comms', 'edit') ? '' : 'none';
  document.getElementById('ho-view-only').style.display = hoA('staff_comms', 'edit') ? 'none' : '';
  loadHoAnnouncements();
}

function hoToday() { return localDateStr(new Date()); }
function hoStudioIds() { return Object.keys(STUDIO_NAMES); }
function hoTargetText(ids) {
  if (!ids || !ids.length) return 'All studios';
  const all = hoStudioIds();
  const byProv = {};
  ids.forEach(id => { const p = id.split('-')[0]; (byProv[p] = byProv[p] || []).push(id); });
  const parts = [];
  Object.keys(byProv).forEach(p => {
    const inProv = all.filter(id => id.indexOf(p + '-') === 0);
    if (byProv[p].length === inProv.length) parts.push('All ' + p);
    else parts.push(...byProv[p].map(id => STUDIO_NAMES[id] || id));
  });
  return parts.length > 3 ? parts.slice(0, 3).join(', ') + ' +' + (parts.length - 3) + ' more' : parts.join(', ');
}
function hoFmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = String(d).split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function loadHoAnnouncements() {
  const list = document.getElementById('ho-list');
  list.innerHTML = '<div class="ho-intro">Loading…</div>';
  const [annRes, readsRes] = await Promise.all([
    sb.from('announcements').select('*').order('created_at', { ascending: false }),
    sb.from('announcement_reads').select('announcement_id, studio_id, read_at')
  ]);
  if (annRes.error) { list.innerHTML = `<div class="ho-card">Couldn't load announcements: ${esc(annRes.error.message)}</div>`; return; }
  _hoAnns = annRes.data || [];
  _hoReadsOk = !readsRes.error;
  _hoReadsBy = {};
  (readsRes.data || []).forEach(r => { (_hoReadsBy[r.announcement_id] = _hoReadsBy[r.announcement_id] || []).push(r); });
  renderHoList();
}

function renderHoList() {
  const list = document.getElementById('ho-list');
  const today = hoToday();
  const status = a => a.show_from > today ? 'soon' : (a.show_until && a.show_until < today ? 'ended' : 'live');
  const groups = { live: [], soon: [], ended: [] };
  _hoAnns.forEach(a => groups[status(a)].push(a));
  const card = a => {
    const st = status(a);
    const targets = (a.studio_ids && a.studio_ids.length) ? a.studio_ids : hoStudioIds();
    const reads = (_hoReadsBy[a.id] || []).filter(r => targets.includes(r.studio_id));
    const readSet = new Set(reads.map(r => r.studio_id));
    const notYet = targets.filter(id => !readSet.has(id));
    const readsHtml = !_hoReadsOk ? '' : `<details class="ho-reads"><summary>✓ Read at ${reads.length} of ${targets.length} studios</summary>
      <div class="list">${reads.sort((x, y) => String(x.read_at).localeCompare(String(y.read_at)))
        .map(r => `<div>✓ ${esc(STUDIO_NAMES[r.studio_id] || r.studio_id)} <span style="color:var(--ink-soft)">· ${esc(annReadLabel(r.read_at))}</span></div>`).join('')}
        ${notYet.length ? `<div class="not-yet">Not yet: ${notYet.map(id => esc(STUDIO_NAMES[id] || id)).join(', ')}</div>` : ''}</div></details>`;
    const pill = st === 'live' ? '<span class="ho-pill live">Showing now</span>'
      : st === 'soon' ? `<span class="ho-pill soon">Starts ${esc(hoFmtDate(a.show_from))}</span>`
      : '<span class="ho-pill ended">Ended</span>';
    return `<div class="ho-card"><div class="ho-row">
      <div class="ho-main">
        <div class="ho-title">${annTitleMd(a.title)}</div>
        ${a.body ? `<div class="ho-body">${annMd(a.body)}</div>` : ''}
        <div class="ho-meta">${pill}${a.priority === 'urgent' ? '<span class="ho-pill urgent">Urgent</span>' : ''}
          <span>· ${esc(hoTargetText(a.studio_ids))}</span>
          <span>· ${esc(hoFmtDate(a.show_from))} → ${a.show_until ? esc(hoFmtDate(a.show_until)) : 'no end date'}</span></div>
        <div style="margin-top:8px" class="ho-reach" id="reach-${escAttr(a.id)}" data-fallback="${escAttr(readsHtml)}">${st === 'ended' ? `<button class="ho-btn" onclick="hoLoadReach('${escAttr(a.id)}')">Who’s read it?</button>` : '<span class="goal-note">Loading who’s read it…</span>'}</div>
      </div>
      ${hoA('staff_comms', 'edit') ? `<div class="ho-actions">
        <button class="ho-btn" onclick="hoEditAnnouncement('${escAttr(a.id)}')">Edit</button>
        <button class="ho-btn danger" onclick="hoDeleteAnnouncement('${escAttr(a.id)}')">Delete</button></div>` : ''}
    </div></div>`;
  };
  let html = '';
  if (groups.live.length) html += '<div class="ho-section-head">Showing now</div>' + groups.live.map(card).join('');
  if (groups.soon.length) html += '<div class="ho-section-head">Coming up</div>' + groups.soon.map(card).join('');
  if (groups.ended.length) html += `<details><summary class="ho-section-head" style="cursor:pointer">Ended (${groups.ended.length})</summary>${groups.ended.map(card).join('')}</details>`;
  list.innerHTML = html || '<div class="ho-card">No announcements yet.' + (hoA('staff_comms', 'edit') ? ' Tap “New announcement” to write one.' : '') + '</div>';
  _hoAnns.filter(a => status(a) !== 'ended').forEach(a => hoLoadReach(a.id));
}
// Who it went to (active staff at the targeted studios) and who's read it, by person
async function hoLoadReach(id) {
  const el = document.getElementById('reach-' + id); if (!el) return;
  const [{ data, error }, mg] = await Promise.all([sb.rpc('hub_announcement_reach', { p_announcement_id: String(id) }),
    sb.rpc('hub_ann_manager_reach', { p_announcement_id: String(id) }).then(r => r, () => ({ error: true }))]);   // 👑 (Nov 14 2026)
  if (error || !data) { el.innerHTML = el.dataset.fallback || ''; return; }   // before hub_announcements_v2.sql: by studio, as before
  const pct = data.total ? Math.round(data.read / data.total * 100) : 0;
  const notYet = (data.people || []).filter(p => !p.read_at), done = (data.people || []).filter(p => p.read_at);
  const studioName = sid => sid ? (STUDIO_NAMES[sid] || sid) : 'No home studio';
  el.innerHTML = `<div class="reach-top"><b>✓ ${data.read} of ${data.total} staff</b> <span class="goal-note">(${pct}%)</span></div>
    <div class="dm-bar"><i style="width:${pct}%"></i></div>
    <details class="ho-reads"><summary>By studio</summary><div class="reach-studios">${(data.by_studio || []).map(g => `<div><span>${esc(studioName(g.studio_id))}</span><b>${g.read} / ${g.total}</b></div>`).join('')}</div></details>
    ${notYet.length ? `<details class="ho-reads"><summary>Not read yet (${notYet.length})</summary><div class="list">${notYet.map(p => `<div>${esc(p.name)} <span class="goal-note">· ${esc(studioName(p.studio_id))}</span></div>`).join('')}</div></details>` : ''}
    ${done.length ? `<details class="ho-reads"><summary>Read (${done.length})</summary><div class="list">${done.map(p => `<div>✓ ${esc(p.name)} <span class="goal-note">· ${esc(annReadLabel(p.read_at))} · ${p.via === 'studio' ? 'at the studio' : 'on their phone'}</span></div>`).join('')}</div></details>` : ''}${(() => { const M = mg && !mg.error && mg.data; if (!M || !M.total) return '';   // 👑 managers: how many have read it, and who hasn't
      const left = (M.people || []).filter(x => !x.read_at), ok = left.length === 0, pctM = Math.round(M.read / M.total * 100);
      return `<div class="reach-mgr${ok ? ' ok' : ''}"><b>👑 Managers: ${M.read} of ${M.total} read</b> <span class="goal-note">(${pctM}%)</span>${ok ? ' ✓' : ''}</div>` +
        (left.length ? `<details class="ho-reads" open><summary>Managers not read yet (${left.length})</summary><div class="list">${left.map(x => `<div>${esc(x.name)} <span class="goal-note">· ${esc((x.studios || []).map(studioName).join(', ') || 'no studio')}</span></div>`).join('')}</div></details>` : ''); })()}`;
}


function hoEditAnnouncement(id) {
  if (!hoA('staff_comms', 'edit')) return;
  const a = id ? _hoAnns.find(x => String(x.id) === String(id)) : null;
  _hoEditing = a
    ? { id: a.id, title: a.title || '', body: a.body || '', priority: a.priority || 'normal', show_from: a.show_from || hoToday(), show_until: a.show_until || '', studio_ids: (a.studio_ids || []).slice() }
    : { id: null, title: '', body: '', priority: 'normal', show_from: hoToday(), show_until: '', studio_ids: [] };
  _hoEditing.mode = _hoEditing.studio_ids.length ? 'pick' : 'all';
  renderHoEditor();
  document.getElementById('ho-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHoEditor() {
  const el = document.getElementById('ho-editor');
  const e = _hoEditing;
  if (!e) { el.innerHTML = ''; return; }
  const provs = [['BC', 'British Columbia'], ['AB', 'Alberta'], ['ON', 'Ontario']];
  const all = hoStudioIds();
  const studioPicker = e.mode !== 'pick' ? '' : `<div class="ho-studios">${provs.map(([p, label]) => {
    const ids = all.filter(id => id.indexOf(p + '-') === 0);
    const allOn = ids.every(id => e.studio_ids.includes(id));
    return `<div class="ho-prov">
      <label class="all"><input type="checkbox" ${allOn ? 'checked' : ''} onchange="hoToggleProv('${p}', this.checked)"> All of ${esc(label)}</label>
      ${ids.map(id => `<label><input type="checkbox" ${e.studio_ids.includes(id) ? 'checked' : ''} onchange="hoToggleStudio('${escAttr(id)}', this.checked)"> ${esc(STUDIO_NAMES[id] || id)}</label>`).join('')}
    </div>`;
  }).join('')}</div>`;
  el.innerHTML = `<div class="ho-card">
    <div class="ho-head" style="margin-bottom:12px"><div class="ho-title" style="font-size:18px">${e.id ? 'Edit announcement' : 'New announcement'}</div></div>
    <div class="ho-form">
      <label class="f">Title<input type="text" id="ho-f-title" value="${escAttr(e.title)}" maxlength="120" placeholder="e.g. Holiday kits arrive Thursday" oninput="hoFormChanged()" onpaste="annTitlePaste(event)"></label>
      <div class="f"><span>Message</span>
        <div class="ann-tools" role="toolbar" aria-label="Formatting"><button type="button" onclick="annFmt('b')" title="Bold (select text first)"><b>B</b></button><button type="button" onclick="annFmt('i')" title="Italic"><i>I</i></button>
          <button type="button" onclick="annFmt('link')" title="Link">🔗 Link</button><button type="button" onclick="annFmt('list')" title="Bullet list">• List</button>
          <span class="ann-tools-tip">Select text, then tap. Pasting from Google Docs or email keeps bold, links and lists.</span></div>
        <textarea id="ho-f-body" rows="9" placeholder="What studios need to know…" oninput="hoFormChanged()" onpaste="annPaste(event)">${esc(e.body)}</textarea></div>
      <div class="ho-grid3">
        <label class="f">Priority<select id="ho-f-priority" onchange="hoFormChanged()">
          <option value="normal"${e.priority !== 'urgent' ? ' selected' : ''}>Normal</option>
          <option value="urgent"${e.priority === 'urgent' ? ' selected' : ''}>🚨 Urgent: also a banner at the top (keep it short)</option></select></label>
        <label class="f">Show from<input type="date" id="ho-f-from" value="${escAttr(e.show_from)}" onchange="hoFormChanged()"></label>
        <label class="f">Show until (optional)<input type="date" id="ho-f-until" value="${escAttr(e.show_until)}" onchange="hoFormChanged()"></label>
      </div>
      <div class="f" style="display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:700;color:var(--ink-soft)">Studios
        <div class="ho-choice">
          <label><input type="radio" name="ho-f-mode" ${e.mode !== 'pick' ? 'checked' : ''} onchange="hoSetMode('all')"> All studios</label>
          <label><input type="radio" name="ho-f-mode" ${e.mode === 'pick' ? 'checked' : ''} onchange="hoSetMode('pick')"> Choose provinces or studios</label>
        </div>
        ${studioPicker}
      </div>
      <div>
        <div class="ho-preview-label" style="margin-bottom:8px">How studios will see it</div>
        <div id="ho-preview">${annCardHtml(e, '<button class="ann-btn" disabled>Got it</button>')}</div>
      </div>
      <div class="ho-actions" style="justify-content:flex-end">
        <button class="ho-btn" onclick="hoCancelEdit()">Cancel</button>
        <button class="ho-btn primary" id="ho-save-btn" onclick="hoSaveAnnouncement()">${e.id ? 'Save changes' : 'Post announcement'}</button>
      </div>
    </div></div>`;
}
function hoReadForm() {
  const e = _hoEditing; if (!e) return;
  e.title = document.getElementById('ho-f-title').value;
  e.body = document.getElementById('ho-f-body').value;
  e.priority = document.getElementById('ho-f-priority').value;
  e.show_from = document.getElementById('ho-f-from').value;
  e.show_until = document.getElementById('ho-f-until').value;
}
function hoFormChanged() {
  hoReadForm();
  const pv = document.getElementById('ho-preview');
  if (pv) pv.innerHTML = annCardHtml(_hoEditing, '<button class="ann-btn" disabled>Got it</button>');
}
function hoSetMode(mode) { hoReadForm(); _hoEditing.mode = mode; renderHoEditor(); }
function hoToggleStudio(id, on) {
  hoReadForm();
  const set = new Set(_hoEditing.studio_ids);
  on ? set.add(id) : set.delete(id);
  _hoEditing.studio_ids = hoStudioIds().filter(x => set.has(x));
  renderHoEditor();
}
function hoToggleProv(p, on) {
  hoReadForm();
  const set = new Set(_hoEditing.studio_ids);
  hoStudioIds().filter(id => id.indexOf(p + '-') === 0).forEach(id => on ? set.add(id) : set.delete(id));
  _hoEditing.studio_ids = hoStudioIds().filter(x => set.has(x));
  renderHoEditor();
}
function hoCancelEdit() { _hoEditing = null; renderHoEditor(); }

async function hoSaveAnnouncement() {
  hoReadForm();
  const e = _hoEditing;
  const title = e.title.trim();
  if (!title) { alert('Please add a title.'); return; }
  if (!e.show_from) { alert('Please choose a start date.'); return; }
  if (e.show_until && e.show_until < e.show_from) { alert('"Show until" can\'t be before "Show from".'); return; }
  const ids = e.mode === 'pick' ? e.studio_ids : [];
  if (e.mode === 'pick' && !ids.length) { alert('Choose at least one studio, or pick "All studios".'); return; }
  const payload = { title, body: e.body.trim() || null, priority: e.priority, studio_ids: ids, show_from: e.show_from, show_until: e.show_until || null };
  const btn = document.getElementById('ho-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  let res;
  if (e.id) res = await sb.from('announcements').update(payload).eq('id', e.id);
  else {
    const { data: u } = await sb.auth.getUser();
    res = await sb.from('announcements').insert({ ...payload, created_by: u && u.user ? u.user.id : null });
  }
  if (res.error) {
    btn.disabled = false; btn.textContent = e.id ? 'Save changes' : 'Post announcement';
    alert("Couldn't save: " + res.error.message);
    return;
  }
  _hoEditing = null; renderHoEditor();
  await loadHoAnnouncements();
  if (_studioViewStarted) loadAnnouncements(_sessionStudioId); // Today screen too
}

async function hoDeleteAnnouncement(id) {
  const a = _hoAnns.find(x => String(x.id) === String(id));
  if (!a || !confirm(`Delete "${a.title}"? Studios will stop seeing it, and its read receipts are removed.`)) return;
  const { error } = await sb.from('announcements').delete().eq('id', a.id);
  if (error) { alert("Couldn't delete: " + error.message); return; }
  if (_hoEditing && String(_hoEditing.id) === String(id)) { _hoEditing = null; renderHoEditor(); }
  await loadHoAnnouncements();
  if (_studioViewStarted) loadAnnouncements(_sessionStudioId);
}


// 👑 the managers line (Nov 14 2026)
(function () { const st = document.createElement('style'); st.textContent = `.reach-mgr { margin: 10px 0 2px; padding: 6px 10px; border-radius: 10px; background: #fff4dc; color: #6b4a00; font-size: 14px; }
.reach-mgr.ok { background: #e9f7ee; color: #1e6b3d; }`; document.head.appendChild(st); })();

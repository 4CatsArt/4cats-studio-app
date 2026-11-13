// hub/families.js: 👪 Families (the families table, a family's card, its people, notes, "can attend as" ages, badges).
// Moved out of hub.html (Nov 11 2026) and opened from the studio view with the same staff PIN as Front desk.
// Loaded by hub.html after its main script (and after hub/front-desk.js, which holds the shared PIN step). 

// 🔑 (Nov 11 2026) Families in the studio view: the same "Who's at the desk?" PIN as Front desk (one unlock covers both).
// Looking families up needs Families (View) on the Access page; changing them needs Families (Edit). The server decides.
// Can the person at the desk change families? (home office logins, or a PIN with Families: Edit on the Access page)
function famCanEdit() {
  if (_studioData && _studioData.isAdmin) return true;
  return !!(_fdSeller && (_fdSeller.fam === 'edit' || _fdSeller.fam === 'manage'));
}
function famDeskGate() {
  const pane = document.getElementById('families-pane'); if (!pane) return false;
  let box = document.getElementById('fam-pin-gate');
  if (!fdNeedsPin()) {
    if (box) { box.remove(); Array.from(pane.children).forEach(c => { if (c.dataset.famHid) { c.style.display = c.dataset.famHid === '-' ? '' : c.dataset.famHid; delete c.dataset.famHid; } }); }
    return false;
  }
  if (!box) {
    Array.from(pane.children).forEach(c => { c.dataset.famHid = c.style.display || '-'; c.style.display = 'none'; });
    box = document.createElement('div'); box.id = 'fam-pin-gate'; pane.prepend(box);
  }
  box.innerHTML = fdPinHtml('👪 Families');
  setTimeout(() => { const i = document.getElementById('fd-pin'); if (i && document.activeElement !== i) i.focus(); }, 60);
  if (_sessionPin) fdPinGo(_sessionPin, true);   // (coordinator view already unlocked: their PIN)
  return true;
}
// ---------- Coordinator → Families (hub_families.sql) ----------
// Managers and admins only: the server checks the manager PIN (or the login) on every call.
let _fam = { results: null, open: null, msg: '', sort: 'last_visit', desc: true, total: 0, studioSet: false };
function openFamiliesPane() {
  const wasOpen = paneVisible('families-pane') || paneVisible('fd-pane');   // (Front desk and Families share one PIN unlock)
  showOnlyPane('families-pane'); setActiveNav('nav-families');
  { const rb = document.getElementById('fam-receipt-btn'); if (rb) rb.style.display = _studioData && _studioData.isAdmin ? '' : 'none'; }   // (🧾 admin only)
  if (!wasOpen) _fdSeller = null;                                          // (opened fresh: whoever's at the desk enters their PIN)
  if (famDeskGate()) return;
  const sel = document.getElementById('fam-studio');
  if (!_fam.studioSet) {   // your studio first (all studios for a home office login)
    const admin = !!(_studioData && _studioData.isAdmin);
    sel.innerHTML = '<option value="">All studios</option>' + Object.keys(STUDIO_NAMES).map(id => '<option value="' + id + '">' + famEsc(STUDIO_NAMES[id]) + '</option>').join('');
    sel.value = !admin && _sessionStudioId ? _sessionStudioId : '';
    _fam.studioSet = true;
  }
  if (!_fam.results && !_fam.open) famList(true); else famRender();
}
// The families table (hub_family_list.sql)
async function famList(reset) {
  const v = id => (document.getElementById(id) || {}).value || '';
  if (reset) { _fam.results = []; _fam.open = null; }
  _fam.msg = 'Loading…'; famRender();
  const { data, error } = await sb.rpc('hub_family_list', { p_q: v('fam-q') || null, p_studio: v('fam-studio') || null, p_member: v('fam-member') || 'any', p_activity: v('fam-activity') || 'any',
    p_flag: v('fam-flagf') || null, p_sort: _fam.sort, p_desc: _fam.desc, p_limit: 50, p_offset: reset ? 0 : (_fam.results || []).length, p_pin: fdPin() });
  if (error) { _fam.msg = famErr(error); famRender(); return; }
  _fam.results = (reset ? [] : (_fam.results || [])).concat(data || []);
  _fam.total = data && data.length ? Number(data[0].total) : (reset ? 0 : _fam.total);
  _fam.msg = _fam.results.length ? '' : 'No families match.';
  famRender();
}
function famSort(col) { if (_fam.sort === col) _fam.desc = !_fam.desc; else { _fam.sort = col; _fam.desc = col !== 'name' && col !== 'studio'; } famList(true); }
function famEsc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function famErr(e) { return (e && e.message) || 'Something went wrong.'; }
async function famSearch() { return famList(true); }
async function famSearchOld() {
  const q = (document.getElementById('fam-q').value || '').trim();
  if (q.length < 2) { _fam.msg = 'Type at least 2 letters.'; famRender(); return; }
  _fam.msg = 'Searching…'; _fam.open = null; famRender();
  const { data, error } = await sb.rpc('hub_family_search', { p_q: q, p_pin: fdPin() });
  if (error) { _fam.results = null; _fam.msg = famErr(error); famRender(); return; }
  _fam.results = data || []; _fam.msg = _fam.results.length ? '' : 'No families found for “' + q + '”.'; famRender();
}
// ➕ (Nov 11 2026) Add a customer (hub_family_add.sql + my-studio-data staff_customer_add): a family who hasn't booked yet
function famAddOpen() {
  const st = _sessionStudioId || '';
  openDutySheet(`<h3>➕ Add a customer</h3>
    <p class="ho-intro">For a family who hasn't booked yet. If the email is already a 4Cats customer, they're linked, not doubled.</p>
    <div class="me-form">
      <div class="sup-two"><label>Parent first name<input id="fa-first" maxlength="80"></label><label>Last name<input id="fa-last" maxlength="80"></label></div>
      <label>Email<input id="fa-email" type="email" maxlength="160"></label>
      <label>Phone (optional)<input id="fa-phone" maxlength="30"></label>
      <label>Studio<select id="fa-studio">${Object.keys(STUDIO_NAMES).map(id => `<option value="${escAttr(id)}"${id === st ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('')}</select></label>
      <b style="display:block;margin:8px 0 4px">Children (optional)</b>
      <div id="fa-kids">${[0, 1, 2].map(i => `<div class="sup-two"><label>First name<input class="fa-kid-n" maxlength="60"></label><label>Birthday<input class="fa-kid-b" type="date"></label></div>`).join('')}</div>
      <div id="fa-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="fa-go" onclick="famAddSave()">Add them</button></div>`);
}
async function famAddSave() {
  const v = id => (document.getElementById(id) || {}).value || '', msg = document.getElementById('fa-msg'), btn = document.getElementById('fa-go');
  const kids = [...document.querySelectorAll('#fa-kids .sup-two')].map(r => ({ first_name: r.querySelector('.fa-kid-n').value.trim(), birthdate: r.querySelector('.fa-kid-b').value })).filter(k => k.first_name);
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const d = await staffBookingCall('staff_customer_add', { booking_ids: [], first_name: v('fa-first'), last_name: v('fa-last'), email: v('fa-email'), phone: v('fa-phone'), studio_id: v('fa-studio'), kids });
    closeDutySheet();
    if (d.kid_errors && d.kid_errors.length) alert('Added, but some children weren’t saved: ' + d.kid_errors.join('; ') + '. Add them on the family card.');
    else if (d.existing) alert('They were already a 4Cats customer, so they’re linked (not doubled).');
    await famList(true); famOpen(d.customer_id);
  } catch (e) { btn.disabled = false; btn.textContent = 'Add them'; msg.innerHTML = `<p class="fd-msg">${esc(e.message)}</p>`; }
}
async function famOpen(cid) {
  _fam.msg = 'Opening…'; famRender();
  const { data, error } = await sb.rpc('hub_family_card', { p_customer: cid, p_pin: fdPin() });
  if (error) { _fam.msg = famErr(error); famRender(); return; }
  if (!_fam.open || _fam.open.shopify_customer_id !== data.shopify_customer_id) { _fam.secs = {}; _fam.compOpen = false; }
  _fam.open = data; _fam.msg = ''; famRender();
  const [ch, bd] = await Promise.all([sb.rpc('hub_family_changes_to_people', { p_customer: cid, p_pin: fdPin() }),
    sb.rpc('hub_family_badges', { p_customer: cid, p_pin: fdPin() })]);
  if (_fam.open && _fam.open.shopify_customer_id === data.shopify_customer_id) {
    if (!ch.error) _fam.open.changes = ch.data || [];
    _fam.open.badges = bd.error ? null : (bd.data || []);   // null = hub_family_badges.sql not run yet
    famRender();
  }
}
// "4:45pm Fri Nov 13th | Make the Gift (Ages 5-10) | 3 Week Session" → "Make the Gift (Ages 5-10) · 3 Week Session"
function famTitle(t) { const parts = String(t || '').split('|').map(x => x.trim()).filter(Boolean); if (parts.length > 1 && /^\*?\d/.test(parts[0])) parts.shift(); return parts.join(' · '); }
// A family member's camp badges: the camper with the same first name (and last name, when both are known)
function famBadgesFor(f, p) {
  const list = f.badges || [], first = String(p.first_name || '').trim().toLowerCase(), full = (first + ' ' + String(p.last_name || '').trim().toLowerCase()).trim();
  return list.filter(c => c.camper.toLowerCase() === full)[0] || list.filter(c => c.camper.toLowerCase().split(' ')[0] === first)[0] || null;
}
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.sec && d.closest && d.closest('#fam-body')) { _fam.secs = _fam.secs || {}; _fam.secs[d.dataset.sec] = d.open; } }, true);
function famAdjLabel(n) { return n === 1 ? '1 year older' : n === 2 ? '2 years older' : n === -1 ? '1 year younger' : 'Their own age'; }
function famRender() {
  const body = document.getElementById('fam-body'); if (!body) return;
  let h = _fam.msg ? '<div class="fam-msg">' + famEsc(_fam.msg) + '</div>' : '';
  if (_fam.open) {
    const f = _fam.open, sn = id => STUDIO_NAMES[id] || id || '';
    const dl = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const tm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? 'pm' : 'am'); };
    const FLAGS = { allergy: ['⚕️', 'Allergy'], support: ['🤝', 'Needs extra support'], payment: ['💳', 'Ask about payment'], vip: ['⭐', 'VIP'], heads_up: ['👀', 'Heads up'] };
    const REL = { child: 'Child', myself: 'The customer', partner: 'Partner', grandchild: 'Grandchild', friend: 'Friend', other: 'Other' };
    const PLAN = { member: '4Cats Member', workshops: 'Workshops Only' }, SRC = { world: 'joined on World', gift: 'gift', appstle: 'Appstle', bookeo: 'Bookeo', tag: 'Shopify tag', comp: 'added by home office' };
    const open = k => _fam.secs && _fam.secs[k] ? ' open' : '';
    const sec = (k, title, count, body) => '<details class="fam-sec" data-sec="' + k + '"' + open(k) + '><summary>' + title + (count != null ? ' <span class="fam-count">' + count + '</span>' : '') + '</summary><div class="fam-sec-body">' + body + '</div></details>';
    const flags = (f.notes || []).filter(n => n.flag);
    const people = f.people || [], badges = f.badges || [];
    const used = new Set();
    people.forEach(p => { const b = famBadgesFor(f, p); if (b) used.add(b.camper); });
    const loose = badges.filter(c => !used.has(c.camper));
    const badgeChips = c => '<div class="fam-badges">' + (c.badges || []).map(b => '<span class="fam-badge" title="Last earned ' + famEsc(dl(b.last_date)) + '">🏅 ' + famEsc(b.name) + (b.times > 1 ? ' <b>×' + b.times + '</b>' : '') + '</span>').join('') + '</div>';
    const badgeMeta = c => c.total + ' badge' + (c.total === 1 ? '' : 's') + (c.first_date ? ' · ' + famEsc(dl(c.first_date)) + (c.last_date !== c.first_date ? ' – ' + famEsc(dl(c.last_date)) : '') : '') + ((c.studios || []).length ? ' · ' + famEsc(c.studios.map(sn).join(', ')) : '');
    // Header (always open)
    h += '<button class="ho-btn ghost" onclick="_fam.open=null;famRender()">← Back to the list</button>' +
      '<div class="fam-card"><div class="fam-name">' + famEsc(f.parent_name || 'Family') + (f.member ? ' <span class="fam-pill">⭐ Member</span>' : '') + '</div>' +
      '<div class="fam-meta">' + [f.email ? '<a href="mailto:' + famEsc(f.email) + '">' + famEsc(f.email) + '</a>' : '', f.phone ? '<a href="tel:' + famEsc(String(f.phone).replace(/[^\d+]/g, '')) + '">' + famEsc(f.phone) + '</a>' : '',
        f.past && f.past.first_visit ? 'with us since ' + famEsc(dl(f.past.first_visit)) : ''].filter(Boolean).join(' · ') + '</div>' +
      (flags.length ? '<div class="fam-flags">' + flags.map(n => '<span class="fam-flag f-' + n.flag + '">' + FLAGS[n.flag][0] + ' ' + famEsc(FLAGS[n.flag][1]) + '</span>').join('') + '</div>' : '');
    // Linked participants: one folding row each
    h += sec('people', 'Linked participants', people.length, (people.length ? '' : '<p class="fam-meta">No participants linked on 4Cats World yet.</p>') + people.map(p => {
      const adj = p.age_adjust || 0, b = famBadgesFor(f, p);
      const head = '<b>' + famEsc(p.first_name + (p.last_name ? ' ' + p.last_name : '')) + '</b> <span class="fam-meta">' + famEsc(REL[p.relationship] || p.relationship || '') + ' · ' +
        (p.age != null ? 'age ' + p.age : (p.is_16_plus ? '16 or older' : 'no birthdate')) + '</span>' +
        (adj ? ' <span class="fam-pill warn">attends as age ' + (p.age + adj) + '</span>' : '') + (b ? ' <span class="fam-pill">🏅 ' + b.total + '</span>' : '') + (p.medical_info ? ' <span class="fam-pill med">⚕️ medical</span>' : '');
      return '<details class="fam-person-d" data-sec="p-' + p.id + '"' + open('p-' + p.id) + '><summary>' + head + '</summary><div class="fam-person-body">' +
        (p.medical_info ? '<div class="fam-med">⚕️ ' + famEsc(p.medical_info) + '</div>' : '') +
        // Edit (only with Families: Edit)
        (famCanEdit() ? '<h4 class="fam-h4">Details</h4><div class="fam-edit">' +
          '<label>First name <input type="text" id="fe-f-' + p.id + '" maxlength="40" value="' + famEsc(p.first_name || '') + '"></label>' +
          '<label>Last name <input type="text" id="fe-l-' + p.id + '" maxlength="40" value="' + famEsc(p.last_name || '') + '"></label>' +
          '<label>Birthdate <input type="date" id="fe-b-' + p.id + '" value="' + famEsc(p.birthdate || '') + '"></label>' +
          '<label>Relationship <select id="fe-r-' + p.id + '">' + Object.keys(REL).map(k => '<option value="' + k + '"' + (p.relationship === k ? ' selected' : '') + '>' + REL[k] + '</option>').join('') + '</select></label>' +
          '<label class="fam-chk"><input type="checkbox" id="fe-a-' + p.id + '"' + (p.is_16_plus ? ' checked' : '') + '> 16 or older</label>' +
          '<label class="fam-wide">Medical info and allergies <textarea id="fe-m-' + p.id + '" rows="2" maxlength="1000">' + famEsc(p.medical_info || '') + '</textarea></label>' +
        '</div><button class="ho-btn" onclick="famSavePerson(\'' + p.id + '\')">Save details</button> <span class="fam-meta" id="fe-msg-' + p.id + '"></span>' +
        '<p class="fam-meta" style="margin:6px 0 0">Changes are logged with the old details. Bookings already made keep the name they were booked with.</p>' : '') +
        // Age exception
        '<h4 class="fam-h4">Age exception</h4>' +
        (adj ? '<p class="fam-line">Can attend as <b>' + famEsc(famAdjLabel(adj)) + '</b>' + (p.age != null ? ' (age ' + (p.age + adj) + ')' : '') + '. <span class="fam-meta">' + famEsc(p.age_adjust_note || '') + ' — set by ' + famEsc(p.age_adjust_by || '?') + (p.age_adjust_at ? ' on ' + famEsc(String(p.age_adjust_at).slice(0, 10)) : '') + (p.age_adjust_until ? ' · until ' + famEsc(p.age_adjust_until) : '') + '</span></p>' : '<p class="fam-meta">None. They book by their real age.</p>') +
        (!famCanEdit() ? '' : p.birthdate ? '<div class="fam-adj-row"><label>Can attend as <select id="fa-n-' + p.id + '">' + [0, 1, 2, -1].map(n => '<option value="' + n + '"' + (n === adj ? ' selected' : '') + '>' + famAdjLabel(n) + '</option>').join('') + '</select></label>' +
          '<label>Until (optional) <input type="date" id="fa-u-' + p.id + '" value="' + famEsc(p.age_adjust_until || '') + '"></label></div>' +
          '<label class="fam-adj-note">Reason (who approved it and why) <input type="text" id="fa-r-' + p.id + '" maxlength="300" value="' + famEsc(p.age_adjust_note || '') + '" placeholder="e.g. Kyra approved: joining her older brother\'s class"></label>' +
          '<button class="ho-btn" onclick="famSaveAdj(\'' + p.id + '\')">Save age exception</button> <span class="fam-meta" id="fa-m-' + p.id + '"></span>' : '<p class="fam-meta">Add a birthdate first.</p>') +
        // Badges
        '<h4 class="fam-h4">🏅 Badges' + (b ? ' <span class="fam-count">' + b.total + '</span>' : '') + '</h4>' +
        (b ? '<p class="fam-meta" style="margin:0">Camp badges: ' + badgeMeta(b) + '</p>' + badgeChips(b) : '<p class="fam-meta">No badges yet.</p>') +
        '</div></details>';
    }).join('') +
    // Campers on this family's camp orders who aren't participants on World yet (their badges have nowhere to attach)
    (loose.length ? '<h4 class="fam-h4" style="margin-top:14px">Campers not linked on World <span class="fam-count">' + loose.length + '</span></h4>' +
      '<p class="fam-meta" style="margin:0 0 6px">On this family\'s camp orders, but not added as participants. Add them so their badges and age checks attach to them.</p>' +
      loose.map((c, i) => {
        const parts = String(c.camper).split(' '), fn = parts.shift() || '', ln = parts.join(' ');
        return '<details class="fam-person-d loose" data-sec="loose-' + i + '"' + open('loose-' + i) + '><summary><b>' + famEsc(c.camper) + '</b> <span class="fam-meta">camper · not on World</span> <span class="fam-pill">🏅 ' + c.total + '</span></summary><div class="fam-person-body">' +
          '<p class="fam-meta" style="margin:6px 0 0">Camp badges: ' + badgeMeta(c) + '</p>' + badgeChips(c) +
          (famCanEdit() ? '<h4 class="fam-h4">Add as a participant</h4><div class="fam-edit">' +
            '<label>First name <input type="text" id="fn-f-' + i + '" maxlength="40" value="' + famEsc(fn) + '"></label>' +
            '<label>Last name <input type="text" id="fn-l-' + i + '" maxlength="40" value="' + famEsc(ln) + '"></label>' +
            '<label>Birthdate <input type="date" id="fn-b-' + i + '"></label>' +
            '<label>Relationship <select id="fn-r-' + i + '">' + Object.keys(REL).map(k => '<option value="' + k + '"' + (k === 'child' ? ' selected' : '') + '>' + REL[k] + '</option>').join('') + '</select></label>' +
          '</div><button class="ho-btn" onclick="famAddPerson(' + i + ')">Add to family</button> <span class="fam-meta" id="fn-msg-' + i + '"></span>' : '') + '</div></details>';
      }).join('') : ''));
    // Customer badges: the customer's own (none until the badge system is built)
    h += sec('cbadges', '🏅 Customer badges', null, '<p class="fam-meta">' + famEsc(f.parent_name || 'The customer') + '\'s own badges will show here once the badge system is built. Kids\' badges are under Linked participants.</p>');
    // Upcoming
    const up = f.upcoming || [];
    // one booking's row (its date, what, and Schedule / Cancel)
    const upRow = (u, extra) =>
      '<div class="fam-row2' + (extra || '') + '"><span class="fam-when"><b>' + famEsc(dl(u.date)) + '</b>' + (u.time ? '<span>' + famEsc(tm(u.time)) + '</span>' : '') + '</span>' +
      '<span class="fam-what"><b>' + famEsc(famTitle(u.title)) + '</b><span class="fam-meta">' + famEsc([sn(u.studio_id), (u.kids && u.kids.length ? u.kids.join(', ') : (u.qty ? u.qty + (u.qty === 1 ? ' spot' : ' spots') : '')), u.order].filter(Boolean).join(' · ')) + '</span></span>' +
      (u.id ? '<span class="fam-acts">' + (u.session_id ? '<button class="ho-btn sm" onclick="famGoTime(\'' + famEsc(u.session_id) + '\',\'' + famEsc(u.studio_id) + '\',\'' + famEsc(String(u.date).slice(0, 10)) + '\')" title="Open this day on the Schedule">📅 Schedule</button>' : '') +
        (_hoCan.edit ? '<button class="ho-btn sm" onclick="famBookingAdmin(\'' + famEsc(u.id) + '\',' + (u.is_class ? 'false' : 'true') + ')">' + (u.is_class ? '✏️ Cancel' : '✏️ Change / Cancel') + '</button>' : '') + '</span>' : '') + '</div>';
    // (Nov 9 2026) a kids class's weeks as one row: same class, studio, child(ren) and order; it opens to show each week
    const clsBase = u => { const m = String(famTitle(u.title) || '').match(/^(.*?)\s*[·|\-–]?\s*Class\s+\d+\s+of\s+(\d+)\s*$/i); return m ? { name: m[1].trim(), of: +m[2] } : null; };
    const groups = [], byKey = {};
    up.forEach(u => {
      const b = u.is_class !== false ? clsBase(u) : null;
      const key = b ? [b.name, u.studio_id, (u.kids || []).join(','), u.order || ''].join('|') : null;
      if (key && byKey[key]) { byKey[key].items.push(u); return; }
      const g = { base: b, items: [u] }; groups.push(g); if (key) byKey[key] = g;
    });
    const upHtml = groups.map((g, gi) => {
      if (g.items.length < 2) return upRow(g.items[0]);
      const a = g.items[0], z = g.items[g.items.length - 1], n = g.items.length, gid = 'fam-cg-' + gi;
      const nice = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
      const wd = new Date(String(a.date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' });
      return '<div class="fam-row2 fam-cgrp"><span class="fam-when"><b>' + famEsc(nice(a.date)) + ' → ' + famEsc(nice(z.date)) + '</b><span>' + famEsc(wd + 's' + (a.time ? ' · ' + tm(a.time) : '')) + '</span></span>' +
        '<span class="fam-what"><b>' + famEsc(g.base.name) + ' · ' + n + (n === g.base.of ? '' : ' of ' + g.base.of) + ' classes</b><span class="fam-meta">' + famEsc([sn(a.studio_id), (a.kids && a.kids.length ? a.kids.join(', ') : (a.qty ? a.qty + (a.qty === 1 ? ' spot' : ' spots') : '')), a.order].filter(Boolean).join(' · ')) + '</span></span>' +
        '<span class="fam-acts"><button class="ho-btn sm" type="button" aria-expanded="false" aria-controls="' + gid + '" onclick="var d=document.getElementById(\'' + gid + '\'),o=d.hidden;d.hidden=!o;this.setAttribute(\'aria-expanded\',o);this.textContent=(o?\'▾ Hide\':\'▸ Show\')+\' the ' + n + ' classes\'">▸ Show the ' + n + ' classes</button></span></div>' +
        '<div id="' + gid + '" class="fam-cgrp-list" hidden>' + g.items.map(u => upRow(u, ' fam-cgrp-item')).join('') + '</div>';
    }).join('');
    h += sec('upcoming', 'Upcoming', up.length, up.length ? '<div class="fam-rows">' + upHtml + '</div>'
      : '<p class="fam-meta">Nothing booked coming up.</p>');
    // Timeline: orders and cancellations
    const tl = f.timeline || [];
    // (transfers, party changes and credits: hub_family_timeline.sql)
    const tlRow = (cls, label, title, meta, e) => '<div class="fam-tl-row ' + cls + '"><span class="fam-tl-dot"></span><span class="fam-when"><b>' + famEsc(dl(e.at)) + '</b><span>' + label + '</span></span><span class="fam-what"><b>' + title + '</b><span class="fam-meta">' + famEsc(meta.filter(Boolean).join(' · ')) + '</span></span></div>';
    const money2 = n => '$' + Math.abs(Number(n) || 0).toFixed(2);
    const tlExtra = e => e.kind === 'change' || e.kind === 'move'
      ? tlRow('move', e.kind === 'change' ? 'Changed' : 'Moved', famEsc(famTitle(e.what)) + (e.to_what && e.to_what !== e.what ? ' → ' + famEsc(famTitle(e.to_what)) : ''),
          [e.time_change ? (e.date ? dl(e.date) : '') + ': time moved ' + e.time_change + ' (' + sn(e.studio_id) + ')'   // (Nov 10 2026: a whole time moved by staff)
           : (e.from_date ? dl(e.from_date) : '') + (e.from_time ? ' ' + shortTime(e.from_time) : '') + (e.from_studio && e.from_studio !== e.studio_id ? ' (' + sn(e.from_studio) + ')' : '') + ' → ' + (e.date ? dl(e.date) : '') + (e.time ? ' ' + shortTime(e.time) : '') + ' (' + sn(e.studio_id) + ')',
           e.old_spots && e.spots && e.old_spots !== e.spots ? e.old_spots + ' → ' + e.spots + ' spots' : '', Number(e.amount) > 0 ? 'paid ' + money2(e.amount) + ' more' + (e.order ? ' (' + e.order + ')' : '') : '',
           e.credit_code ? money2(e.amount) + ' credit ' + e.credit_code : '', 'by ' + (e.by || 'family')], e)
      : e.kind === 'party_change'
      ? tlRow('move', 'Party changed', famEsc(famTitle(e.what)), [e.date ? 'for ' + dl(e.date) : '', e.old_spots && e.spots && e.old_spots !== e.spots ? e.old_spots + ' → ' + e.spots + ' guests' : '',
          Number(e.paid) > 0 ? 'paid ' + money2(e.paid) + ' more' + (e.order ? ' (' + e.order + ')' : '') : '', Number(e.credit) > 0 ? money2(e.credit) + ' gift card' + (e.gift_last4 ? ' ending ' + e.gift_last4 : '') : ''], e)
      : e.kind === 'credit'
      ? tlRow('credit', 'Credit sent', '🎁 ' + famEsc(e.code || ''), [e.type === 'amount' ? money2(e.amount) : (e.spots || 1) + ' ' + ({ glazing2: 'glazing', minimake2: 'Mini Make' }[e.type] || 'workshop') + ' spot' + ((e.spots || 1) === 1 ? '' : 's'),
          e.reason || '', e.used ? '✓ used' : e.expires ? 'not used yet · until ' + dl(e.expires) : 'not used yet', e.by ? 'by ' + e.by : ''], e)
      : null;
    h += sec('timeline', 'Timeline', tl.length, tl.length ? '<div class="fam-tl">' + tl.map(e => tlExtra(e) || (e.kind === 'cancel'
      ? '<div class="fam-tl-row cancel"><span class="fam-tl-dot"></span><span class="fam-when"><b>' + famEsc(dl(e.at)) + '</b><span>Cancelled</span></span><span class="fam-what"><b>' + famEsc(famTitle(e.what)) + '</b><span class="fam-meta">' +
        famEsc([e.date ? 'for ' + dl(e.date) : '', e.spots ? e.spots + (e.spots === 1 ? ' spot' : ' spots') : '', e.gift_last4 ? '$' + Number(e.amount).toFixed(2) + ' gift card ending ' + e.gift_last4 : e.credit_code ? '$' + Number(e.amount).toFixed(2) + ' credit ' + e.credit_code : 'no credit', 'by ' + (e.by || 'family')].filter(Boolean).join(' · ')) + '</span></span></div>'
      : '<div class="fam-tl-row"><span class="fam-tl-dot"></span><span class="fam-when"><b>' + famEsc(dl(e.at)) + '</b><span>Order ' + famEsc(e.order || '') + '</span></span><span class="fam-what"><b>' + famEsc(String(e.what || '').split(' · ').map(famTitle).join(' · ')) + '</b><span class="fam-meta">' +
        famEsc([sn(e.studio_id), e.spots ? e.spots + (e.spots === 1 ? ' spot' : ' spots') : '', e.refunded ? 'cancelled' : ''].filter(Boolean).join(' · ')) +
        (!e.refunded && /^W\d+$/i.test(String(e.order || '')) && _studioData && _studioData.isAdmin ? ' <button class="ho-btn sm" onclick="famReceipt(\'' + famEsc(e.order) + '\')" title="A receipt for this order, to save as a PDF or print">🧾 Receipt</button>' : '') +
        (e.refunded && e.order && _studioData && _studioData.isAdmin ? ' <button class="ho-btn sm" onclick="famRefundOrder(\'' + famEsc(e.order) + '\')" title="If a gift card was given when it was cancelled: switch it off (if unused) and refund to how they paid">↩ Refund instead of the credit</button>' : '') + '</span></span></div>')).join('') + '</div>'
      : '<p class="fam-meta">No orders yet.</p>');
    // Cancellations
    const cx = f.cancellations || [];
    h += sec('cancels', 'Cancellations', cx.length, cx.length ? cx.map(c => '<p class="fam-line">↩️ ' + famEsc(famTitle(c.title)) + (c.date ? ' (' + famEsc(dl(c.date)) + ')' : '') + ' · ' +
      (c.gift_last4 ? '$' + Number(c.amount).toFixed(2) + ' gift card ending ' + famEsc(c.gift_last4) + (c.gift_expires ? ', expires ' + famEsc(dl(c.gift_expires)) : '') : 'no credit') + ' · by ' + famEsc(c.by || 'family') + ' on ' + famEsc(dl(c.at)) +
      (c.gift_last4 && _studioData && _studioData.isAdmin && f.email ? ' <button class="ho-btn sm" onclick="famRefundInstead(\'' + famEsc(c.gift_last4) + '\',' + Number(c.amount) + ')" title="Switch off the gift card (if unused) and refund to how they paid">↩ Refund instead</button>' : '') + '</p>').join('')
      : '<p class="fam-meta">No cancellations.</p>');
    // Membership
    const mem = (f.memberships || [])[0];
    h += sec('membership', 'Membership', null, (mem ? '<p class="fam-line">' + famEsc(PLAN[mem.plan] || mem.plan) + ' · ' + famEsc(mem.status) + (mem.ends_on ? ' · until ' + famEsc(dl(mem.ends_on)) : '') +
      (mem.auto_renew ? ' · renews automatically' : '') + (mem.source ? ' · ' + famEsc(SRC[mem.source] || mem.source) : '') + (mem.discount_kind ? ' · ' + famEsc(mem.discount_kind) + ' price' : '') + '</p>' +
      ((f.memberships || []).length > 1 ? '<p class="fam-meta">' + (f.memberships.length - 1) + ' earlier membership' + (f.memberships.length > 2 ? 's' : '') + ' on file.</p>' : '')
      : '<p class="fam-meta">Not a member.</p>') + famCompHtml(f, mem));
    // Past year
    const pv = f.past || {};
    h += sec('past', 'Past year', pv.visits || 0, '<p class="fam-line">' + (pv.visits || 0) + ' visit' + (pv.visits === 1 ? '' : 's') + (pv.last_visit ? ' · last ' + famEsc(dl(pv.last_visit)) : '') + (pv.top_studio ? ' · usually at ' + famEsc(sn(pv.top_studio)) : '') + '</p>' +
      ((pv.recent || []).length ? '<div class="fam-rows">' + pv.recent.map(r => '<div class="fam-row2"><span class="fam-when"><b>' + famEsc(dl(r.date)) + '</b></span><span class="fam-what">' + famEsc(famTitle(r.title)) + '<span class="fam-meta">' + famEsc(sn(r.studio_id)) + '</span></span></div>').join('') + '</div>' : ''));
    // Credits and rewards
    const st = f.stamps || {};
    h += sec('credits', 'Credits and rewards', null, '<p class="fam-line">Stamp card: ' + (st.on_card || 0) + ' of 10' + (st.cards_done ? ' · ' + st.cards_done + ' card' + (st.cards_done === 1 ? '' : 's') + ' completed' : '') + (st.prizes_waiting ? ' · 🎁 ' + st.prizes_waiting + ' prize waiting' : '') + '</p>' +
      (cx.filter(c => c.gift_last4).length ? '<p class="fam-meta">Gift cards from cancellations: ' + cx.filter(c => c.gift_last4).map(c => '$' + Number(c.amount).toFixed(2) + ' (ending ' + famEsc(c.gift_last4) + ')').join(', ') + '</p>' : ''));
    // 💳 Saved cards (Nov 10 2026): the cards they chose to save on a Stripe page (brand, last 4, expiry; read from Stripe when opened)
    // ⭐ (Nov 10 2026) member pricing without membership (partner_pricing.sql), home office
    if (_studioData && _studioData.isAdmin) h += sec('partner', '⭐ Member pricing (not a member)', null, '<div class="fam-partner" data-cid="' + famEsc(f.shopify_customer_id || f.customer_id || '') + '" data-email="' + famEsc(f.email || '') + '"><p class="fam-meta">Open to check…</p></div>');
    if (f.email) h += sec('cards', '💳 Saved cards', null, '<div class="fam-cards" data-email="' + famEsc(f.email) + '"><p class="fam-meta">Open to check with Stripe…</p></div>');
    // Notes
    const notes = f.notes || [];
    h += sec('notes', 'Notes', notes.length,
      (famCanEdit() ? '<div class="fam-noteadd"><textarea id="fam-note" rows="2" maxlength="2000" placeholder="Add a note for every studio, e.g. Prefers texts to calls"></textarea>' +
      '<div class="fam-adj-row"><label>Flag <select id="fam-flag"><option value="">No flag (just a note)</option>' + Object.keys(FLAGS).map(k => '<option value="' + k + '">' + FLAGS[k][0] + ' ' + FLAGS[k][1] + '</option>').join('') + '</select></label>' +
      '<button class="ho-btn" onclick="famAddNote()">Add note</button> <span class="fam-meta" id="fam-note-msg"></span></div></div>' : '<p class="fam-meta">Ask a coordinator to add or change notes.</p>') +
      notes.map(n => '<div class="fam-note' + (n.flag ? ' f-' + n.flag : '') + '">' + (n.flag ? '<span class="fam-flag f-' + n.flag + '">' + FLAGS[n.flag][0] + ' ' + famEsc(FLAGS[n.flag][1]) + '</span> ' : '') + famEsc(n.body) +
        '<div class="fam-meta">' + famEsc(n.author) + (n.studio_id ? ' · ' + famEsc(sn(n.studio_id)) : '') + ' · ' + famEsc(dl(n.at)) + (famCanEdit() ? ' · <button class="fam-x" onclick="famRemoveNote(' + Number(n.id) + ')">Remove</button>' : '') + '</div></div>').join(''));
    // Staff changes
    const chg = f.changes || [];
    if (chg.length) h += sec('changes', 'Staff changes', chg.length, chg.map(c => {
      const d = c.detail || {}, fr = d.from || {}, to = d.to || {};
      const diff = c.action === 'person_add' || (!d.from && d.to && d.to.first_name) ? 'added ' + [to.first_name, to.last_name].filter(Boolean).join(' ') + (to.birthdate ? ' (' + to.birthdate + ')' : '') + ' as a participant'
        : fr.first_name !== undefined ? Object.keys(to).filter(k => JSON.stringify(fr[k] ?? null) !== JSON.stringify(to[k] ?? null)).map(k => k.replace(/_/g, ' ') + ': ' + (fr[k] ?? '—') + ' → ' + (to[k] ?? '—')).join('; ')
        : (d.participant || '') + ': can attend as ' + famAdjLabel(d.to || 0) + (d.note ? ' — ' + d.note : '');
      return '<p class="fam-meta" style="margin:4px 0">' + famEsc(dl(c.at)) + ' · ' + famEsc(c.who) + ' · ' + famEsc(diff) + '</p>';
    }).join(''));
    h += '</div>';
  } else if (_fam.results && _fam.results.length) {
    const FL = { allergy: '⚕️', support: '🤝', payment: '💳', vip: '⭐', heads_up: '👀' };
    const sd = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
    const th = (col, label) => '<th><button class="fam-th' + (_fam.sort === col ? ' on' : '') + '" onclick="famSort(\'' + col + '\')">' + label + (_fam.sort === col ? (_fam.desc ? ' ↓' : ' ↑') : '') + '</button></th>';
    h += '<p class="fam-meta" style="margin:0 0 6px">' + _fam.total + (_fam.total === 1 ? ' family' : ' families') + '</p>' +
      '<div class="fam-tablewrap"><table class="fam-table"><thead><tr>' + th('name', 'Parent') + '<th>Kids</th><th>⭐</th>' + th('studio', 'Usual studio') + th('visits', 'Visits (year)') + th('last_visit', 'Last visit') + th('next', 'Next booking') + '<th>Flags</th></tr></thead><tbody>' +
      _fam.results.map(r => '<tr onclick="famOpen(' + Number(r.shopify_customer_id) + ')" tabindex="0" onkeydown="if(event.key===\'Enter\')famOpen(' + Number(r.shopify_customer_id) + ')">' +
        '<td><b>' + famEsc(r.parent_name || 'Family') + '</b><span class="fam-sm">' + famEsc(r.email || '') + '</span></td>' +
        '<td>' + famEsc(r.kids || '') + '</td><td>' + (r.member ? '⭐' : '') + '</td><td>' + famEsc(STUDIO_NAMES[r.top_studio] || r.top_studio || '') + '</td>' +
        '<td class="num">' + Number(r.visits_year || 0) + '</td><td>' + famEsc(sd(r.last_visit)) + '</td>' +
        '<td>' + (r.next_visit ? famEsc(sd(r.next_visit)) + (Number(r.upcoming) > 1 ? ' <span class="fam-sm" style="display:inline">+' + (Number(r.upcoming) - 1) + ' more</span>' : '') : '—') + '</td>' +
        '<td>' + (r.flags || []).map(f => '<span title="' + famEsc(f) + '">' + (FL[f] || '') + '</span>').join(' ') + '</td></tr>').join('') +
      '</tbody></table></div>' + (_fam.results.length < _fam.total ? '<p style="text-align:center;margin:10px 0"><button class="ho-btn" onclick="famList(false)">Show more</button></p>' : '');
  }
  body.innerHTML = h;
}
// "Mark as member" (hub_member_comp.sql + hub_member_fixers.sql): free membership, with an optional end date
function famCompHtml(f, mem) {
  if (!_hubMemberFix || !f.shopify_customer_id) return '';
  const comp = (f.memberships || []).find(m => m.source === 'comp' && m.status === 'active');
  const t = new Date(), min = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  const noteReq = !_hubOwner;
  if (!_fam.compOpen) return '<div class="fam-comp"><button class="ho-btn" onclick="_fam.compOpen=true;famRender()">' + (comp ? '✏️ Change this membership' : '⭐ Mark as member') + '</button>' +
    (comp ? ' <button class="ho-btn" onclick="famCompEnd()">End membership</button>' : '') +
    (mem && !comp && mem.status === 'active' ? ' <small class="fam-meta">Already a member another way: only add one here if that one is wrong.</small>' : '') + '</div>';
  return '<div class="fam-comp"><b>' + (comp ? 'Change membership' : '⭐ Mark as member') + '</b> <small class="fam-meta">(free, no payment)</small>' +
    '<div class="fam-comp-row"><label>Plan <select id="fc-plan"><option value="member"' + (comp && comp.plan === 'workshops' ? '' : ' selected') + '>4Cats Member</option><option value="workshops"' + (comp && comp.plan === 'workshops' ? ' selected' : '') + '>Workshops Only</option></select></label>' +
    '<label>Ends on <small>(optional)</small> <input type="date" id="fc-end" min="' + min + '" value="' + famEsc(comp && comp.ends_on ? String(comp.ends_on).slice(0, 10) : '') + '"></label>' +
    '<label class="fc-note">Note' + (noteReq ? ' <small>(required)</small>' : '') + ' <input id="fc-note" maxlength="200" placeholder="e.g. Student member until Aug 14 2027, showed as not a member"></label></div>' +
    '<small class="fam-meta">Leave the end date blank and they stay a member until it\'s ended. Every change is recorded with your name.</small>' +
    '<div class="fam-comp-row"><button class="ho-btn primary" onclick="famCompSave()">Save</button><button class="ho-btn" onclick="_fam.compOpen=false;famRender()">Cancel</button>' +
    '<span class="fam-meta" id="fc-msg" style="color:#b91c1c"></span></div></div>';
}
async function famCompSave() {
  const f = _fam.open; if (!f) return;
  const v = id => (document.getElementById(id) || {}).value || '', msg = document.getElementById('fc-msg');
  if (!_hubOwner && !v('fc-note').trim()) { msg.textContent = 'Add a note saying why.'; return; }
  const { error } = await sb.rpc('hub_member_comp_save', { p_customer: f.shopify_customer_id, p_email: f.email || null, p_name: f.parent_name || null,
    p_plan: v('fc-plan') || 'member', p_ends_on: v('fc-end') || null, p_note: v('fc-note') || null });
  if (error) { msg.textContent = /hub_member_comp_save/.test(error.message) ? 'Run hub_member_comp.sql in Supabase first.' : error.message; return; }
  _fam.compOpen = false; famOpen(f.shopify_customer_id);
}
async function famCompEnd() {
  const f = _fam.open; if (!f) return;
  if (!confirm('End ' + (f.parent_name || 'this family') + '\u2019s membership now? They lose member prices straight away.')) return;
  const { error } = await sb.rpc('hub_member_comp_end', { p_customer: f.shopify_customer_id });
  if (error) { alert(error.message); return; }
  famOpen(f.shopify_customer_id);
}
async function famSavePerson(id) {
  const g = k => document.getElementById(k + id), m = document.getElementById('fe-msg-' + id);
  const p = { first_name: g('fe-f-').value, last_name: g('fe-l-').value, birthdate: g('fe-b-').value || null, relationship: g('fe-r-').value, is_16_plus: g('fe-a-').checked, medical_info: g('fe-m-').value };
  const person = (_fam.open.people || []).find(x => x.id === id);
  if (person && p.birthdate && p.birthdate !== person.birthdate && !confirm('Change the birthdate to ' + p.birthdate + '? Their age checks on World will use it.')) return;
  m.textContent = 'Saving…';
  const { data, error } = await sb.rpc('hub_participant_update', { p_id: id, p, p_pin: fdPin() });
  if (error) { m.textContent = famErr(error); return; }
  if (data && data.changed === false) { m.textContent = 'Nothing changed.'; return; }
  famOpen(_fam.open.shopify_customer_id);
}
async function famAddPerson(i) {
  const g = k => document.getElementById(k + i), m = document.getElementById('fn-msg-' + i);
  const p = { first_name: g('fn-f-').value, last_name: g('fn-l-').value, birthdate: g('fn-b-').value || null, relationship: g('fn-r-').value, is_16_plus: false };
  if (!p.birthdate) { m.textContent = 'Add their birthdate.'; return; }
  m.textContent = 'Adding…';
  const { error } = await sb.rpc('hub_participant_add', { p_customer: _fam.open.shopify_customer_id, p, p_pin: fdPin() });
  if (error) { m.textContent = famErr(error); return; }
  _fam.secs = Object.assign({}, _fam.secs, { people: true });
  famOpen(_fam.open.shopify_customer_id);
}
async function famAddNote() {
  const body = (document.getElementById('fam-note').value || '').trim(), flag = document.getElementById('fam-flag').value || null, m = document.getElementById('fam-note-msg');
  if (!body) { m.textContent = 'Write the note first.'; return; }
  m.textContent = 'Saving…';
  const { error } = await sb.rpc('hub_family_note_add', { p_customer: _fam.open.shopify_customer_id, p_body: body, p_flag: flag, p_pin: fdPin() });
  if (error) { m.textContent = famErr(error); return; }
  famOpen(_fam.open.shopify_customer_id);
}
async function famRemoveNote(id) {
  if (!confirm('Remove this note? It will be hidden for everyone (kept in the record).')) return;
  const { error } = await sb.rpc('hub_family_note_remove', { p_id: id, p_pin: fdPin() });
  if (error) { alert(famErr(error)); return; }
  famOpen(_fam.open.shopify_customer_id);
}
async function famSaveAdj(id) {
  const n = parseInt(document.getElementById('fa-n-' + id).value, 10), until = document.getElementById('fa-u-' + id).value || null, note = document.getElementById('fa-r-' + id).value;
  const m = document.getElementById('fa-m-' + id); m.textContent = 'Saving…';
  const { error } = await sb.rpc('hub_participant_age_adjust', { p_id: id, p_adjust: n, p_note: note, p_until: until, p_pin: fdPin() });
  if (error) { m.textContent = famErr(error); return; }
  famOpen(_fam.open.shopify_customer_id);
}


// ---------- 🧾 Receipts (Nov 13 2026; hub_order_receipt.sql): a World order's receipt (W…), to save as a PDF or print ----------
// From a family's Timeline (🧾 Receipt), or any order number (🧾 Receipt for an order, at the top of Families: field trips, buyouts).
// Opens in a new tab laid out like a receipt, with the GST/HST number; "Save as PDF / Print" uses the browser's own Save as PDF.
function famReceiptAsk() {
  const n = prompt('The World order number (e.g. W100549):'); if (!n || !n.trim()) return;
  famReceipt(n.trim());
}
async function famReceipt(order) {
  const w = window.open('', '_blank');   // (opened right away, so the browser allows it)
  if (w) w.document.write('<p style="font-family:Arial;padding:30px;color:#555">Making the receipt…</p>');
  const { data: r, error } = await sb.rpc('hub_order_receipt', { p_order: order });
  if (error || !r) { if (w) w.close(); alert(error && /hub_order_receipt/.test(error.message) && /function/i.test(error.message) ? 'Run hub_order_receipt.sql in Supabase first.' : (error ? error.message : 'That order wasn’t found.')); return; }
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const m = n => '$' + Number(n || 0).toFixed(2);
  const day = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const paid = r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const studio = r.studio_id === 'WAREHOUSE' || r.studio_id === 'GIFTCARD' ? '4Cats Shop' : '4Cats ' + ((typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[r.studio_id]) || r.studio_id || '');
  const L = Array.isArray(r.lines) ? r.lines : [];
  const lineName = l => l.kind === 'world' ? `${l.program} (${l.qty} ${Number(l.qty) === 1 ? 'spot' : 'spots'})` : (l.kind === 'retail' || l.kind === 'treat') && Number(l.qty) > 1 ? `${l.program} × ${l.qty}`
    : l.kind === 'aftercare' ? 'Aftercare' + (l.qty ? ` × ${l.qty}` : '') : (l.kind === 'camp' || l.kind === 'class') && (l.days || []).length ? `${l.program} (${l.days.length} ${l.kind === 'class' ? 'week' : 'day'}${l.days.length === 1 ? '' : 's'})` : (l.program || 'Item');
  const lineSub = l => [l.date ? day(l.date) + (l.time ? ' ' + l.time : '') : '', (l.days || []).length > 1 ? (l.days || []).map(d => day(d).replace(/, \d{4}$/, '')).join(', ') : (l.days || []).length === 1 && !l.date ? day(l.days[0]) : '',
    (l.participants || []).map(k => k && k.name).filter(Boolean).join(', '), (l.notes || []).join(', '), l.kind === 'giftcard' && l.gift && l.gift.to_name ? 'for ' + l.gift.to_name : ''].filter(Boolean).join(' · ');
  const rows = L.map(l => `<tr><td><b>${e(lineName(l))}</b>${lineSub(l) ? `<div class="s">${e(lineSub(l))}</div>` : ''}</td><td class="r">${Number(l.discount) > 0 ? `<s>${m(l.regular)}</s><br>` : ''}${m(l.amount)}</td></tr>`).join('');
  const taxes = [['GST', r.gst], ['PST', r.pst], ['HST', r.hst]].filter(x => Number(x[1]) > 0);
  const gift = Number(r.gift_card_amount) > 0;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>4Cats receipt ${e(r.order_name)}</title><style>
    body{font-family:Helvetica,Arial,sans-serif;color:#1f2a24;margin:0;background:#f4f1ea} .pg{background:#fff;max-width:760px;margin:24px auto;padding:44px 52px;border-top:10px solid #c3090c;box-shadow:0 4px 20px rgba(0,0,0,.08)}
    .top{display:flex;justify-content:space-between;gap:20px} h1{margin:0;font-size:28px} .sm{color:#5c6670;font-size:13px;margin-top:4px} .rc{text-align:right} .rc h2{margin:0;font-size:22px;letter-spacing:1px}
    hr{border:0;border-top:1px solid #e2d9c8;margin:26px 0} .two{display:flex;gap:40px} .two div{flex:1} .lab{font-size:11px;font-weight:700;color:#5c6670;letter-spacing:.5px;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin-top:24px} th{background:#faf6ee;text-align:left;font-size:11px;color:#5c6670;letter-spacing:.5px;padding:8px 10px} th.r,td.r{text-align:right}
    td{padding:10px;border-bottom:1px solid #eee;vertical-align:top;font-size:14px} .s{color:#5c6670;font-size:12px;margin-top:3px} s{color:#999}
    .tot{margin-left:auto;width:320px;margin-top:14px;font-size:14px} .tot div{display:flex;justify-content:space-between;padding:4px 0} .tot .big{border-top:2px solid #1f2a24;margin-top:6px;padding-top:8px;font-weight:700;font-size:17px}
    .foot{color:#5c6670;font-size:12px;margin-top:40px} .bar{max-width:760px;margin:16px auto 0;text-align:right} .bar button{background:#c3090c;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-weight:700;font-size:14px;cursor:pointer}
    .test{color:#c3090c;font-weight:700} @media print{body{background:#fff}.pg{box-shadow:none;margin:0;max-width:none}.bar{display:none}}</style></head><body>
    <div class="bar"><button onclick="window.print()">Save as PDF / Print</button></div><div class="pg">
    <div class="top"><div><h1>4Cats Arts Studio</h1><div class="sm">hello@4cats.com · GST/HST number: 828575662RT0001</div></div>
      <div class="rc"><h2>RECEIPT</h2><div class="sm">Order ${e(r.order_name)}</div><div class="sm">Paid ${e(paid)}</div>${r.test_mode ? '<div class="sm test">TEST ORDER</div>' : ''}</div></div><hr>
    <div class="two"><div><div class="lab">BILLED TO</div>${e(r.customer_name || '')}<br>${e(r.customer_email && r.customer_email !== 'walk-in@4cats.com' ? r.customer_email : '')}</div>
      <div><div class="lab">${r.ship_to ? 'SHIPPED TO' : 'STUDIO'}</div>${r.ship_to ? `${e(r.ship_to.name)}<br>${e(r.ship_to.line1)}${r.ship_to.line2 ? '<br>' + e(r.ship_to.line2) : ''}<br>${e(r.ship_to.city)}, ${e(r.ship_to.province)} ${e(r.ship_to.postal)}` : e(studio)}</div></div>
    <table><thead><tr><th>DESCRIPTION</th><th class="r">AMOUNT (CAD)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><div><span>Subtotal</span><span>${m(r.subtotal)}</span></div>${Number(r.discount_total) > 0 ? `<div><span>Includes discounts of</span><span>${m(r.discount_total)}</span></div>` : ''}
      ${taxes.map(x => `<div><span>${x[0]}</span><span>${m(x[1])}</span></div>`).join('')}<div class="big"><span>Total</span><span>${m(r.total)}</span></div>
      ${gift ? `<div><span>Gift card ending ${e(r.gift_card_last4 || '')}</span><span>−${m(r.gift_card_amount)}</span></div>` : ''}
      <div><span>${Number(r.amount_charged) > 0 ? 'Paid by card (Stripe)' : 'Paid'}</span><span>${m(r.amount_charged != null ? r.amount_charged : r.total)}</span></div></div>
    <div class="foot">Thank you for choosing 4Cats! · 4Cats Arts Studio · GST/HST number 828575662RT0001 · Questions? hello@4cats.com</div></div></body></html>`;
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  else alert('Your browser blocked the receipt window. Allow pop-ups for the Hub, then try again.');
}

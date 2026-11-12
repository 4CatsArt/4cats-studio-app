// hub/coordinator.js: the coordinator pages. 🎉 Parties (new bookings, cancellations, party forms to chase), 🗓️ Suggestions
// ("Suggest a date!" on World), 💡 Project interest and 🔔 Notifications. Moved out of hub.html as-is (Nov 11 2026).
// Loaded by hub.html after its main script.

// ---------- Coordinator → Parties ----------
// Every party booked in the next 90 days (and the last week, to close out),
// grouped by what needs doing. Same tables as the Day view: bookings,
// party_details (contacted, guests, teachers, after-party) and the
// party_alert_dismissed flag for new bookings and cancellations.
let _pty = null;   // { list: [pt], cancels: [], forms: {} }
function daysUntil(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 86400000);
}
async function fetchPartyData(studioId) {
  const from = new Date(); from.setDate(from.getDate() - 7);
  const to = new Date(); to.setDate(to.getDate() + 90);
  const { data: sess, error } = await sb.from('sessions').select('id, title, session_date, session_time, session_type')
    .eq('studio_id', studioId).eq('session_type', 'party').gte('session_date', localDateStr(from)).lte('session_date', localDateStr(to))
    .order('session_date').order('session_time');
  if (error) throw error;
  const ids = (sess || []).map(x => x.id);
  if (!ids.length) return { list: [], cancels: [] };
  const [bk, cx] = await Promise.all([
    sb.from('bookings').select('id, session_id, customer_name, customer_email, customer_phone, shopify_order_name, qty, estimated_attendance, raw_payload, booked_at, project_preference, reason_for_gathering, customer_booking_number, party_alert_dismissed')
      .in('session_id', ids).gt('qty', 0).is('returned_at', null),
    sb.from('bookings').select('id, session_id, customer_name, shopify_order_name, booked_at, party_alert_dismissed')
      .in('session_id', ids).eq('qty', 0).not('party_alert_dismissed', 'eq', true)
  ]);
  if (bk.error) throw bk.error;
  const bIds = (bk.data || []).map(b => b.id);
  const pd = bIds.length ? await sb.from('party_details').select('*').in('booking_id', bIds) : { data: [] };
  const sById = {}; (sess || []).forEach(x => { sById[x.id] = x; });
  const list = (bk.data || []).map(b => {
    const d = (pd.data || []).find(z => z.booking_id === b.id) || null;
    return { booking_id: b.id, booking: b, detail: d, session: sById[b.session_id] || {},
             t1: (d && d.party_teacher1) || '', t2: (d && d.party_teacher2) || '' };
  }).sort((a, b) => (a.session.session_date + a.session.session_time).localeCompare(b.session.session_date + b.session.session_time));
  const cancels = (cx.data || []).map(b => ({ booking: b, session: sById[b.session_id] || {} }));
  return { list, cancels };
}
function ptyStatus(pt) {
  const d = pt.detail || {};
  if (d.actual_guests) return 'closed';
  if (daysUntil(pt.session.session_date) < 0) return 'toclose';
  if (d.contacted === 'Yes') return 'contacted';
  if (d.contacted === 'Left message') return 'message';
  return 'new';
}

function openPartiesPane() {
  if (!coordOrAdmin()) { openPinModal(); return; }
  showOnlyPane('parties-pane'); setActiveNav('nav-parties');
  loadPartiesPane();
}
async function loadPartiesPane() {
  const body = document.getElementById('parties-body');
  if (!_pty) body.innerHTML = '<div class="ho-intro">Loading…</div>';
  try {
    const data = await fetchPartyData(_sessionStudioId);
    _pty = Object.assign({ forms: (_pty && _pty.forms) || {} }, data);
    renderPartiesPane();
    refreshCoordBadges(data);
  } catch (e) { body.innerHTML = `<div class="ho-card">Couldn't load parties: ${esc(e.message || e)}</div>`; }
}
function renderPartiesPane() {
  const body = document.getElementById('parties-body');
  const P = _pty;
  const groups = [
    ['toclose', '✅ Still to close out (the party’s over)', 'Enter actual guests and send the thank-you.'],
    ['new', '📞 Needs contacting', ''],
    ['message', '💬 Left a message', 'Try again, or follow up by email.'],
    ['contacted', '👍 Contacted', ''],
    ['closed', '✓ Closed', '']
  ];
  const card = (pt, idx) => {
    const st = ptyStatus(pt), dd = daysUntil(pt.session.session_date);
    const urgent = (st === 'new' || st === 'message') && dd <= 7;
    const d = pt.detail || {};
    const guests = d.expected_guests || pt.booking.estimated_attendance || '';
    const teachers = [pt.t1, pt.t2].filter(Boolean);
    const isNew = !pt.booking.party_alert_dismissed;
    return `<div class="pty-card${urgent ? ' urgent' : ''}">
      <div class="pty-row">
        <div class="pty-when"><b>${esc(ptyDayLabel(pt.session.session_date))}</b><span>${esc(shortTime(pt.session.session_time || ''))}${dd >= 0 && dd <= 7 ? `<span class="pty-days">${dd === 0 ? 'Today' : dd === 1 ? 'Tomorrow' : 'In ' + dd + ' days'}</span>` : ''}</span></div>
        <div class="pty-main">
          <div class="pty-name">${esc(pt.booking.customer_name || 'Party')}${isNew ? ' <span class="pf-status need" style="background:#ece7ff;color:#5636c9">New</span>' : ''}</div>
          <div class="pty-sub">${esc(pt.session.title || 'Party')}${guests ? ' · ' + esc(guests) + ' guests' : ''}${pt.booking.customer_phone ? ' · ' + esc(pt.booking.customer_phone) : ''}${teachers.length ? ' · Teacher: ' + esc(teachers.join(', ')) : ''}</div>
        </div>
        <div class="pty-acts">
          ${st === 'new' || st === 'message' || st === 'contacted' ? `
            <button class="ho-btn${d.contacted === 'Left message' ? ' on' : ''}" onclick="ptySetContacted(${idx}, 'Left message')">Left message</button>
            <button class="ho-btn${d.contacted === 'Yes' ? ' on' : ''}" onclick="ptySetContacted(${idx}, 'Yes')">✓ Contacted</button>` : ''}
          ${isNew ? `<button class="ho-btn" onclick="ptyDismiss('${escAttr(pt.booking_id)}')">Mark reviewed</button>` : ''}
          <button class="pf-btn${P.forms[pt.booking_id] ? ' open' : ''}" onclick="ptyToggleForm(${idx})">${P.forms[pt.booking_id] ? 'Close form' : 'Party details'}</button>
        </div>
      </div>
      <div class="pf-wrap" data-ppf="${escAttr(pt.booking_id)}"></div>
    </div>`;
  };
  let html = '';
  if (P.cancels.length) {
    html += `<div class="ho-section-head">🚫 Cancellations to review (${P.cancels.length})</div>` + P.cancels.map(c =>
      `<div class="ntf cancel"><span class="ic">🚫</span><div class="bd"><div class="tt">${esc(c.booking.customer_name || 'Party booking')} cancelled</div>
        <div class="mt">${esc(c.session.title || 'Party')} · ${esc(ptyDayLabel(c.session.session_date))} ${esc(shortTime(c.session.session_time || ''))}${c.booking.shopify_order_name ? ' · ' + esc(c.booking.shopify_order_name) : ''}</div></div>
        <button class="ho-btn" onclick="ptyDismiss('${escAttr(c.booking.id)}')">Mark reviewed</button></div>`).join('');
  }
  groups.forEach(([key, title, note]) => {
    const items = P.list.map((pt, i) => [pt, i]).filter(([pt]) => ptyStatus(pt) === key);
    if (!items.length) return;
    const inner = items.map(([pt, i]) => card(pt, i)).join('');
    html += key === 'closed'
      ? `<details><summary class="ho-section-head" style="cursor:pointer">${title} (${items.length})</summary>${inner}</details>`
      : `<div class="ho-section-head">${title} (${items.length})</div>${note ? `<div class="goal-note" style="margin:-4px 0 8px">${esc(note)}</div>` : ''}${inner}`;
  });
  body.innerHTML = html || '<div class="ho-card">No parties booked in the next 90 days.</div>';
  document.querySelectorAll('#parties-body .pf-wrap').forEach(slot => {
    const el = P.forms[slot.dataset.ppf];
    if (el) slot.appendChild(el);
  });
}
function ptyToggleForm(i) {
  const pt = _pty.list[i];
  if (!pt) return;
  if (_pty.forms[pt.booking_id]) delete _pty.forms[pt.booking_id];
  else _pty.forms[pt.booking_id] = buildPartyFormEl(pt);
  renderPartiesPane();
}
// Quick "Contacted" / "Left message": only that field changes.
async function ptySetContacted(i, value) {
  const pt = _pty.list[i];
  if (!pt) return;
  const now = new Date().toISOString();
  const r = pt.detail
    ? await sb.from('party_details').update({ contacted: value, updated_at: now }).eq('booking_id', pt.booking_id)
    : await sb.from('party_details').insert({ booking_id: pt.booking_id, session_id: pt.session.id, studio_id: _sessionStudioId, contacted: value, updated_at: now });
  if (r.error) { alert("Couldn't save: " + r.error.message); return; }
  pt.detail = Object.assign({}, pt.detail || { booking_id: pt.booking_id }, { contacted: value });
  // an open form shows the new value too
  const form = _pty.forms[pt.booking_id];
  const sel = form && form.querySelector('select[id$="-contacted"]');
  if (sel) sel.value = value;
  renderPartiesPane(); refreshCoordBadges();
}
// New booking / cancellation reviewed (same flag as the Day view, so it clears everywhere)
async function ptyDismiss(bookingId) {
  const r = await sb.from('bookings').update({ party_alert_dismissed: true }).eq('id', bookingId);
  if (r.error) { alert("Couldn't save: " + r.error.message); return; }
  if (_pty) {
    _pty.cancels = _pty.cancels.filter(c => c.booking.id !== bookingId);
    _pty.list.forEach(pt => { if (pt.booking_id === bookingId) pt.booking.party_alert_dismissed = true; });
    if (paneVisible('parties-pane')) renderPartiesPane();
  }
  if (paneVisible('notif-pane')) loadNotifPane();
  refreshCoordBadges();
}

// ---------- Coordinator → Suggestions ("Suggest a date!" on 4Cats World; world_ideas_hub.sql) ----------
// New suggestions show here (no email to hello@). "Date added" emails the family
// automatically with a link (idea-update Edge Function). Home office can see every studio.
const IDEA_KIND_LABEL = { pa_days: 'PA/PD day', workshops: 'Workshop', class_times: 'Class times', camps: 'Camps', age_groups: 'Age groups', parties: 'Party idea', projects: 'Future project', other: 'Something else' };
let _ideas = [], _ideaOpen = null, _ideaDecline = null, _ideaBooked = {}, _ideaReportOpen = false;   // the "Date added" / "Not this time" box that's open
function openIdeasPane() {
  if (!coordOrAdmin()) { openPinModal(); return; }
  showOnlyPane('ideas-pane'); setActiveNav('nav-ideas');
  const admin = !!(_studioData && _studioData.isAdmin);
  document.getElementById('ideas-all-wrap').hidden = !admin;
  if (!admin) document.getElementById('ideas-all').checked = false;   // studios see their own
  loadIdeasPane();
}
// Matching suggestions become one card: same studio and kind, the same workshop
// (by name, ignoring capitals and punctuation; one starting with the other), and a
// date in common (or no dates). PA/PD days: same studio and a date in common.
function ideaNorm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function ideasMatch(a, b) {
  if (a.studio_id !== b.studio_id || a.kind !== b.kind || (a.status || 'new') !== (b.status || 'new')) return false;
  const da = a.dates || [], db = b.dates || [];
  const dateOk = !da.length || !db.length || da.some(d => db.includes(d));
  if (a.kind === 'pa_days') return da.length && db.length && da.some(d => db.includes(d));
  if (a.kind !== 'workshops') return false;
  const na = ideaNorm(a.details), nb = ideaNorm(b.details);
  if (na.length < 4 || nb.length < 4) return false;
  return dateOk && (na === nb || (na.length >= 6 && nb.startsWith(na)) || (nb.length >= 6 && na.startsWith(nb)));
}
function ideaGroups(list) {
  const groups = [];
  list.forEach(x => { const g = !x.auto_swap && groups.find(g => !g[0].auto_swap && g.some(y => ideasMatch(x, y))); if (g) g.push(x); else groups.push([x]); });
  return groups;
}
function ideaDefaultLink(x) {
  return 'https://world.4cats.com/?studio=' + encodeURIComponent(x.studio_id || '') + '#' + (/pa_days|camps/.test(x.kind) ? 'camps' : 'schedule');
}
async function loadIdeasPane() {
  const body = document.getElementById('ideas-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const all = !!(_studioData && _studioData.isAdmin) && !!(document.getElementById('ideas-all') || {}).checked;
  document.getElementById('ideas-studio').style.display = all ? '' : 'none';
  const { data, error } = await sb.rpc('hub_ideas_list', { p_studio: _sessionStudioId, p_all: all });
  if (error) { body.innerHTML = '<div class="ho-intro">' + (/function|does not exist/i.test(error.message) ? 'Not set up yet: run world_ideas_hub.sql in Supabase.' : esc(error.message)) + '</div>'; return; }
  _ideas = data || [];
  // Bookings on the workshop times families set up (hub_ideas_booked.sql): the report and yellow rows
  _ideaBooked = {};
  const withTime = _ideas.filter(x => x.session_id).map(x => x.id);
  if (withTime.length) { try { const r = await sb.rpc('hub_ideas_booked', { p_ids: withTime }); if (!r.error) (r.data || []).forEach(b => { _ideaBooked[b.id] = b; }); } catch (e) {} }
  // studio filter: the studios that have suggestions
  const sel = document.getElementById('ideas-studio'), keep = sel.value;
  const ids = [...new Set(_ideas.map(x => x.studio_id).filter(Boolean))].sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  sel.innerHTML = '<option value="">Every studio</option>' + ids.map(id => '<option value="' + esc(id) + '"' + (id === keep ? ' selected' : '') + '>' + esc(STUDIO_NAMES[id] || id) + ' (' + _ideas.filter(x => x.studio_id === id && (x.status || 'new') === 'new').length + ' new)</option>').join('');
  drawIdeas();
}
function drawIdeas() {
  const body = document.getElementById('ideas-body');
  const nice = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const when = iso => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  const groups = [['new', 'New'], ['seen', 'Seen'], ['added', 'Date added'], ['declined', 'Not this time'], ['done', 'Done']];
  const allMode = document.getElementById('ideas-all').checked && !!(_studioData && _studioData.isAdmin);
  const only = allMode ? document.getElementById('ideas-studio').value : '';
  const shown = _ideas.filter(x => !only || x.studio_id === only)
    .slice().sort((a, b) => allMode ? ((STUDIO_NAMES[a.studio_id] || a.studio_id || '~').localeCompare(STUDIO_NAMES[b.studio_id] || b.studio_id || '~') || String((a.dates || [])[0] || a.created_at).localeCompare(String((b.dates || [])[0] || b.created_at))) : 0);
  if (!_ideas.length) { body.innerHTML = '<div class="ho-intro">No suggestions yet. Families send them from 4Cats World’s home page (“Suggest a date!”).</div>'; return; }
  let h = '<div class="ho-intro">What families suggested on 4Cats World. Mark <b>Date added</b> when you’ve put it on the schedule: the family gets an email with a link.</div>';
  // (Nov 9 2026) seen ones are hidden (the list was very long); a button shows them again
  const seenN = shown.filter(ideaIsSeen).length;
  if (seenN) h += '<p style="margin:0 0 10px"><button class="ho-btn sm" onclick="_ideaShowSeen=!_ideaShowSeen;drawIdeas()">' + (_ideaShowSeen ? 'Hide the ' + seenN + ' finished' : 'Show finished (' + seenN + '): seen, not this time and done') + '</button></p>';
  // The report: suggested workshops that families set up, and how many got booked
  const setUp = shown.filter(x => x.session_id), gotBooked = setUp.filter(x => (_ideaBooked[x.id] || {}).booked > 0);
  if (setUp.length) {
    const people = gotBooked.reduce((n, x) => n + (+_ideaBooked[x.id].booked || 0), 0);
    const fam = setUp.filter(x => x.auto_swap).length, yours = setUp.length - fam;
    h += '<div class="idea-report">📈 <b>Suggested dates</b>' + (only ? ' at ' + esc(STUDIO_NAMES[only] || only) : '') + ': <b>' + setUp.length + '</b> added (' +
      [fam ? fam + ' set up by families on World' : '', yours ? yours + ' added by the studio' : ''].filter(Boolean).join(', ') + ') · <b>' + gotBooked.length + '</b> got bookings · <b>' + people + '</b> ' + (people === 1 ? 'person' : 'people') + ' booked' +
      (setUp.length ? ' <span class="idea-report-pct">(' + Math.round(100 * gotBooked.length / setUp.length) + '% booked)</span>' : '') +
      (() => { const own = setUp.filter(x => (_ideaBooked[x.id] || {}).by_suggester).length;
        const oth = setUp.filter(x => (+((_ideaBooked[x.id] || {}).others) || 0) > 0), othP = oth.reduce((n, x) => n + (+_ideaBooked[x.id].others || 0), 0);
        const lead = setUp.map(x => (x.dates || [])[0] ? Math.round((new Date(x.dates[0] + 'T12:00:00') - new Date(x.created_at)) / 86400000) : null).filter(n => n != null && n >= 0);
        return (oth.length ? ' · <span class="idea-others">👥 <b>' + oth.length + '</b> also booked by other families (' + othP + ' ' + (othP === 1 ? 'person' : 'people') + ')</span>' : '') +
          (own ? ' · <b>' + own + '</b> booked by the family who suggested it' : '') + (lead.length ? ' · on average <b>' + Math.round(lead.reduce((a, n) => a + n, 0) / lead.length) + '</b> days ahead' : ''); })() +
      // the details: every tracked suggested date, booked ones first, then by date
      '<details class="idea-report-more"' + (_ideaReportOpen ? ' open' : '') + ' ontoggle="_ideaReportOpen=this.open"><summary>Show details</summary><div class="idea-report-wrap"><table class="idea-report-tbl"><thead><tr><th>Workshop</th>' + (allMode ? '<th>Studio</th>' : '') + '<th>Date</th><th>Suggested</th><th>Set up by</th><th>Replaced</th><th class="num">Booked</th></tr></thead><tbody>' +
      setUp.slice().sort((a, b) => ((+((_ideaBooked[b.id] || {}).others) || 0) - (+((_ideaBooked[a.id] || {}).others) || 0)) || ((+((_ideaBooked[b.id] || {}).booked) || 0) - (+((_ideaBooked[a.id] || {}).booked) || 0)) || String((a.dates || [])[0] || '').localeCompare(String((b.dates || [])[0] || '')))
        .map(x => { const bk = +((_ideaBooked[x.id] || {}).booked) || 0, d = (x.dates || [])[0];
          return '<tr class="go' + (bk ? ' bk' : '') + '" onclick="ideaGoSession(\'' + x.id + '\')" title="Open this time on the Schedule"><td>' + esc(String(x.details || '').replace(/^Workshop:\s*/, '').split('\n')[0]) + '</td>' +
            (allMode ? '<td>' + esc(STUDIO_NAMES[x.studio_id] || x.studio_id || '') + '</td>' : '') +
            '<td><span class="idea-report-date">' + (d ? esc(nice(d)) : '') + ' →</span></td>' +
            '<td>' + esc(new Date(x.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) +
              (d ? ' <span class="idea-report-who">· ' + Math.max(0, Math.round((new Date(d + 'T12:00:00') - new Date(x.created_at)) / 86400000)) + ' days ahead</span>' : '') + '</td><td>' + (x.auto_swap ? 'Family, on World' : esc(x.status_by || 'Studio')) + (x.name ? ' <span class="idea-report-who">(' + esc(x.name) + ')</span>' : x.email ? ' <span class="idea-report-who">(' + esc(x.email) + ')</span>' : '') + '</td>' +
            '<td>' + (((_ideaBooked[x.id] || {}).replaced) ? '<span class="idea-report-who">was ' + esc(_ideaBooked[x.id].replaced) + '</span>' : '') + '</td>' +
            '<td class="num">' + (bk ? '<b>🎉 ' + bk + '</b>' : '0') + (((_ideaBooked[x.id] || {}).capacity) ? ' <span class="idea-report-who">of ' + _ideaBooked[x.id].capacity + '</span>' : '') +
              (((_ideaBooked[x.id] || {}).by_suggester) ? '<br><span class="idea-own">✓ they booked</span>' : '') +
              ((+((_ideaBooked[x.id] || {}).others) || 0) ? '<br><span class="idea-others">👥 +' + _ideaBooked[x.id].others + ' from ' + _ideaBooked[x.id].other_families + ' other ' + (_ideaBooked[x.id].other_families === 1 ? 'family' : 'families') + '</span>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div></details></div>';
  }
  groups.forEach(g => {
    // unseen ones families set up on World show under New (that's what the badge counts) until "Mark as seen"
    const isNewAuto = x => x.auto_swap && !x.seen_at;
    const list = shown.filter(x => (_ideaShowSeen || !ideaIsSeen(x)) && (g[0] === 'new' ? ((x.status || 'new') === 'new' || isNewAuto(x)) : g[0] === 'added' ? x.status === 'added' && !isNewAuto(x) : (x.status || 'new') === g[0])); if (!list.length) return;
    const unseenAuto = g[0] === 'new' ? list.filter(isNewAuto).map(x => x.id) : [];
    const grouped = ideaGroups(list);
    const fold = g[0] === 'added';   // (Nov 9 2026) Date added: folded until opened
    if (fold) h += '<details class="idea-fold"' + (_ideaAddedOpen ? ' open' : '') + ' ontoggle="_ideaAddedOpen=this.open"><summary>';
    h += '<h3 class="idea-grp">' + g[1] + ' <span>' + grouped.length + '</span>' +
      (unseenAuto.length > 1 ? ' <button class="ho-btn" style="margin-left:8px;font-size:13px" onclick="ideaSeen(\'' + unseenAuto.join(',') + '\')">✓ Mark all ' + unseenAuto.length + ' set up by families as seen</button>' : '') +
      '</h3>' + (fold ? '</summary>' : '') + grouped.map(G => {
      const x = G[0], key = G.map(y => y.id).join(','), open = _ideaOpen === key, declining = _ideaDecline === key, many = G.length > 1;
      const dates = [...new Set(G.flatMap(y => y.dates || []))].sort();
      const shared = dates.filter(d => G.filter(y => (y.dates || []).includes(d)).length > 1);
      const kids = G.reduce((n, y) => n + (y.kids || 0), 0);
      const people = G.map(y => '<div class="idea-person"><span class="idea-who">' + esc(y.name || 'A family') + (y.email ? ' · <a href="mailto:' + esc(y.email) + '">' + esc(y.email) + '</a>' : '') + '</span>' +
        '<span class="idea-when">' + esc(when(y.created_at)) + '</span>' + (y.school ? '<div class="idea-line"><b>School:</b> ' + esc(y.school) + '</div>' : '') +
        (y.kids ? '<div class="idea-line"><b>Kids:</b> ' + y.kids + (y.ages ? ' (ages ' + esc(y.ages) + ')' : '') + '</div>' : '') +
        (y.details ? '<div class="idea-text">' + esc(y.details) + '</div>' : '') + '</div>').join('');
      const ids = "'" + key + "'";
      const autoNew = x.auto_swap && !x.seen_at, canGo = !x.auto_swap && dates.length && (x.status === 'new' || x.status === 'seen');
      const bk = G.reduce((n, y) => n + (+((_ideaBooked[y.id] || {}).booked) || 0), 0);
      return '<div class="idea-row' + (x.status === 'new' || autoNew ? ' is-new' : '') + (bk ? ' is-booked' : '') + '"><div class="idea-main">' +
        '<div class="idea-top"><span class="idea-kind">' + esc(IDEA_KIND_LABEL[x.kind] || x.kind) + '</span>' +
          (bk ? '<span class="idea-booked">🎉 ' + bk + ' booked</span>' : '') +
          (G.some(y => (+((_ideaBooked[y.id] || {}).others) || 0) > 0) ? '<span class="idea-others-tag">👥 other families booked too</span>' : '') +
          (x.auto_swap ? '<span class="idea-auto" title="They tapped Book it on World, and an empty workshop time became this one">✨ Set up by the family on World</span>' : '') +
          (many ? '<span class="idea-count">' + G.length + ' families' + (kids ? ' · ' + kids + ' kids' : '') + '</span>' : '') +
          (allMode ? '<span class="idea-studio">' + esc(STUDIO_NAMES[x.studio_id] || x.studio_id || 'No studio') + '</span>' : '') + '</div>' +
        (dates.length ? '<div class="idea-dates">' + dates.map(d => '<span' + (shared.includes(d) ? ' class="shared" title="Asked for by more than one family"' : '') + '>' + esc(nice(d)) + (shared.includes(d) ? ' ×' + G.filter(y => (y.dates || []).includes(d)).length : '') + '</span>').join('') + '</div>' : '') +
        people +
        (x.status === 'added' ? '<div class="idea-line soft">Added' + (x.status_by ? ' by ' + esc(x.status_by) : '') + (G.some(y => y.emailed_at) ? ' · ' + (many ? 'families' : 'family') + ' emailed' : '') + (x.added_link ? ' · <a href="' + esc(x.added_link) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>' : '') +
        (open ? '<div class="idea-add"><label>Link for the ' + (many ? 'families' : 'family') + '<input type="url" id="idea-link" value="' + esc(x.added_link || ideaDefaultLink(x)) + '"></label>' +
          '<span class="idea-help">Where they can book it: the World schedule (the usual), a Shopify product, or the camps page.</span>' +
          '<label>Which time did you add? <small>(so you can see if it gets booked)</small><select id="idea-time"><option value="">Loading times…</option></select></label>' +
          '<label class="idea-chk"><input type="checkbox" id="idea-email" checked> Email ' + (many ? 'all ' + G.length + ' families' : esc((x.name || 'the family').split(' ')[0])) + ' that it’s been added</label>' +
          '<div class="idea-btns"><button class="ho-btn" onclick="_ideaOpen=null;drawIdeas()">Cancel</button><button class="ho-btn primary" onclick="ideaSet(' + ids + ',\'added\')">Save</button></div></div>' : '') +
        (declining ? '<div class="idea-add"><label>A note from the studio (optional)<textarea id="idea-note" maxlength="600" rows="3" placeholder="e.g. Saturdays are full with parties until January, but we’d love to see you on a weekday!"></textarea></label>' +
          (G.some(y => y.email) ? '<label class="idea-chk"><input type="checkbox" id="idea-email" checked> Email ' + (many ? 'all ' + G.length + ' families' : esc((x.name || 'the family').split(' ')[0])) + ' a kind note' + (x.kind === 'workshops' ? ' (with the next dates it’s on here, if any)' : '') + '</label>' : '<span class="idea-help">No email on this one, so nothing is sent.</span>') +
          '<div class="idea-btns"><button class="ho-btn" onclick="_ideaDecline=null;drawIdeas()">Cancel</button><button class="ho-btn primary" onclick="ideaSet(' + ids + ',\'declined\')">Save: not this time</button></div></div>' : '') +
        '</div><div class="idea-acts">' +
          (autoNew ? '<button class="ho-btn primary" onclick="ideaSeen(' + ids + ')">✓ Mark as seen</button>' : '') +
          (canGo && !open ? '<button class="ho-btn" onclick="ideaGoTo(' + ids + ')">📅 Go to this date</button>' : '') +
          (x.status !== 'added' && !open && !declining ? '<button class="ho-btn primary" onclick="_ideaOpen=' + ids + ';_ideaDecline=null;drawIdeas()">✓ Date added</button>' : '') +
          (x.status === 'new' ? '<button class="ho-btn" onclick="ideaSet(' + ids + ',\'seen\')">Mark seen</button>' : '') +
          (x.status !== 'declined' && x.status !== 'added' && !declining ? '<button class="ho-btn" onclick="_ideaDecline=' + ids + ';_ideaOpen=null;drawIdeas()">Not this time…</button>' : '') +
          (x.status === 'declined' || x.status === 'seen' ? '<button class="ho-btn" onclick="ideaSet(' + ids + ',\'new\')">Move back to new</button>' : '') +
        '</div></div>';
    }).join('') + (fold ? '</details>' : '');
  });
  body.innerHTML = h;
  if (_ideaOpen) ideaFillTimes(_ideaOpen);
}
// "Which time did you add?" (hub_idea_times.sql): that studio's times on the suggested dates
const _ideaTimes = {};
async function ideaFillTimes(key) {
  const sel = document.getElementById('idea-time'); if (!sel) return;
  if (!_ideaTimes[key]) {
    try { const r = await sb.rpc('hub_idea_times', { p_ids: key.split(',') }); _ideaTimes[key] = r.error ? { err: r.error.message } : { list: r.data || [] }; }
    catch (e) { _ideaTimes[key] = { err: e.message }; }
  }
  const T = _ideaTimes[key], sel2 = document.getElementById('idea-time'); if (!sel2) return;
  const cur = ((_ideas.find(x => key.split(',').includes(x.id)) || {}).session_id) || '';
  const nice = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  if (T.err) { sel2.innerHTML = '<option value="">' + (/hub_idea_times/.test(T.err) ? 'Run hub_idea_times.sql to pick a time' : 'Couldn’t load the times') + '</option>'; return; }
  sel2.innerHTML = '<option value="">' + (T.list.length ? 'Choose the time you added… (or skip)' : 'No times on those dates yet (skip)') + '</option>' +
    T.list.map(x => '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(nice(x.date) + ' · ' + shortTime(x.time) + ' · ' + String(x.title || '').split('|')[0].trim() + (x.booked ? ' (' + x.booked + ' booked)' : '')) + '</option>').join('');
}
let _ideaShowSeen = false, _ideaAddedOpen = false;
document.addEventListener('click', ev => { const t = ev.target.closest && ev.target.closest('.idea-row .idea-text'); if (t) t.classList.toggle('full'); });
function ideaIsSeen(x) { return (x.auto_swap && !!x.seen_at) || ['seen', 'declined', 'done'].includes(x.status); }   // (finished: seen, not this time, done: hidden unless "Show finished")
async function ideaSeen(idList) {
  const ids = String(idList).split(',').filter(Boolean);
  const { error } = await sb.rpc('hub_idea_seen', { p_ids: ids });
  if (error) { alert(/hub_idea_seen/.test(error.message) ? 'Run world_ideas_auto.sql in Supabase first.' : error.message); return; }
  const now = new Date().toISOString(); _ideas.forEach(x => { if (ids.includes(x.id)) x.seen_at = now; });
  drawIdeas(); try { refreshCoordBadges(); } catch (e) {}
}
// From the Suggestions report: open that workshop time on the Schedule (its studio and day), scrolled to it and flashing
async function ideaGoSession(id) {
  const x = _ideas.find(y => y.id === id); if (!x || !x.session_id) return;
  const date = (x.dates || [])[0]; if (!date) return;
  if (x.studio_id && x.studio_id !== _sessionStudioId) {
    if (_studioData && _studioData.isAdmin) await changeAdminStudio(x.studio_id);
    else { alert('This one is at ' + (STUDIO_NAMES[x.studio_id] || x.studio_id) + '.'); return; }
  }
  showOnlyPane('plan-pane'); setActiveNav('nav-plan'); renderPlanStudioPick();
  await loadPlanDay(date);
  const find = () => document.querySelector('#plan-body [data-open-cl="' + x.session_id + '"]');
  let el = find(), tries = 0;
  while (!el && tries++ < 20) { await new Promise(r => setTimeout(r, 150)); el = find(); }   // (the day's list draws a moment after it loads)
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('plan-flash'); setTimeout(() => el.classList.remove('plan-flash'), 2600); }
}
// "Go to this date": the Schedule on that studio and day, with the suggestion pinned at the top
let _ideaPin = null;
async function ideaGoTo(idList) {
  const ids = String(idList).split(','), G = _ideas.filter(x => ids.includes(x.id)), x = G[0]; if (!x) return;
  const today = localDateStr(new Date()), dates = [...new Set(G.flatMap(y => y.dates || []))].sort();
  const date = dates.find(d => d >= today) || dates[0] || today;
  if (x.studio_id && x.studio_id !== _sessionStudioId) {
    if (_studioData && _studioData.isAdmin) await changeAdminStudio(x.studio_id);
    else { alert('This suggestion is for ' + (STUDIO_NAMES[x.studio_id] || x.studio_id) + '.'); return; }
  }
  _ideaOpen = null; _ideaPin = { key: String(idList), open: false };
  showOnlyPane('plan-pane'); setActiveNav('nav-plan'); renderPlanStudioPick();
  ideaPinRender(); loadPlanDay(date);
}
function ideaPinRender() {
  const el = document.getElementById('plan-idea-pin'); if (!el) return;
  const ids = _ideaPin ? _ideaPin.key.split(',') : [], G = _ideas.filter(x => ids.includes(x.id)), x = G[0];
  if (!x) { el.innerHTML = ''; _ideaPin = null; return; }
  const nice = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const dates = [...new Set(G.flatMap(y => y.dates || []))].sort(), many = G.length > 1;
  const who = many ? G.length + ' families' : (x.name || x.email || 'A family');
  const what = String(x.details || IDEA_KIND_LABEL[x.kind] || '').replace(/\s+/g, ' ').slice(0, 90);
  el.innerHTML = '<div class="idea-pin"><button type="button" class="idea-pin-main" onclick="_ideaPin.open=!_ideaPin.open;ideaPinRender()" title="Tap to mark it added">💡 <b>' + esc(who) + '</b>: ' + esc(what) +
      (dates.length ? ' · ' + esc(dates.map(nice).join(', ')) : '') + '</button>' +
      '<button type="button" class="idea-pin-x" onclick="_ideaPin=null;ideaPinRender()" title="Unpin" aria-label="Unpin">×</button></div>' +
    (_ideaPin.open ? '<div class="idea-pin-box"><label>Link for the ' + (many ? 'families' : 'family') + '<input type="url" id="idea-link" value="' + esc(x.added_link || ideaDefaultLink(x)) + '"></label>' +
      '<label>Which time did you add? <small>(so you can see if it gets booked)</small><select id="idea-time"><option value="">Loading times…</option></select></label>' +
      '<label class="idea-chk"><input type="checkbox" id="idea-email" checked> Email ' + (many ? 'all ' + G.length + ' families' : esc((x.name || 'the family').split(' ')[0])) + ' that it’s been added</label>' +
      '<div class="idea-btns"><button class="ho-btn" onclick="_ideaPin.open=false;ideaPinRender()">Cancel</button>' +
      '<button class="ho-btn" onclick="ideaPinDecline()">Can’t add it…</button>' +
      '<button class="ho-btn primary" onclick="ideaPinSave()">✓ Date added</button></div></div>' : '');
  if (_ideaPin.open) { _ideaTimes[_ideaPin.key] = null; ideaFillTimes(_ideaPin.key); }   // (fresh: you may have just added the time)
}
function ideaPinDecline() {   // back to Suggestions, with the "Not this time" box open on it
  if (!_ideaPin) return; const key = _ideaPin.key; _ideaPin = null; ideaPinRender();
  _ideaDecline = key; _ideaOpen = null; openIdeasPane();
}
async function ideaPinSave() {
  if (!_ideaPin) return;
  const key = _ideaPin.key, ids = key.split(',');
  await ideaSet(key, 'added');
  if (_ideas.filter(x => ids.includes(x.id)).every(x => x.status === 'added')) { _ideaPin = null; try { refreshCoordBadges(); } catch (e) {} }
  ideaPinRender();
}
async function ideaSet(idList, status) {
  const ids = String(idList).split(',').filter(Boolean);
  const who = (_lastHeroData && _lastHeroData.firstName && _lastHeroData.firstName !== 'team') ? _lastHeroData.firstName : null;
  const link = status === 'added' ? ((document.getElementById('idea-link') || {}).value || '') : '';
  const email = status === 'added' || status === 'declined' ? !!(document.getElementById('idea-email') || {}).checked : false;
  const note = status === 'added' || status === 'declined' ? ((document.getElementById('idea-note') || {}).value || '').trim() : '';
  let emailed = 0, failed = [];
  for (const id of ids) {
    try {
      const r = await fetch(SUPABASE_URL + '/functions/v1/idea-update', { method: 'POST', headers: await fnHeaders(), body: JSON.stringify({ id, status, by: who, link, email, note }) });
      const d = await r.json();
      if (!r.ok || d.error) { failed.push(d.error || 'not saved'); continue; }
      if (d.emailed) emailed++;
      const i = _ideas.findIndex(x => x.id === id); if (i !== -1 && d.idea) _ideas[i] = Object.assign({}, _ideas[i], d.idea, d.emailed ? { emailed_at: new Date().toISOString() } : {});
    } catch (e) { failed.push(e.message); }
  }
  // "Which time did you add?": tie the suggestion to that time, so its bookings show (yellow rows, the report)
  const pick = status === 'added' ? ((document.getElementById('idea-time') || {}).value || '') : '';
  if (pick && !failed.length) {
    try {
      const r = await sb.rpc('hub_idea_set_session', { p_ids: ids, p_session: pick });
      if (!r.error) {
        _ideas.forEach(x => { if (ids.includes(x.id) && !x.auto_swap) x.session_id = pick; });
        const b = await sb.rpc('hub_ideas_booked', { p_ids: ids }); if (!b.error) (b.data || []).forEach(z => { _ideaBooked[z.id] = z; });
      }
    } catch (e) {}
  }
  if (failed.length) alert('Some didn’t save: ' + failed[0]);
  else if (status === 'added' || status === 'declined') alert(emailed ? 'Saved. ' + (emailed === 1 ? 'The family has' : emailed + ' families have') + ' been emailed. ✓' : 'Saved.');
  _ideaOpen = null; _ideaDecline = null;
  drawIdeas();
  if (typeof refreshCoordBadges === 'function') refreshCoordBadges();
}

// ---------- Coordinator → Project interest (hub_project_interest.sql) ----------
// Upcoming projects at this studio with what families did on 4Cats World → Inspire:
// ❤️ likes (everyone), ★ wish lists and 🔔 alerts (families at this studio), how many
// are booked and spots left here. "Add spots?" when interest is bigger than what's left.
function openInterestPane() {
  if (!coordOrAdmin()) { openPinModal(); return; }
  showOnlyPane('interest-pane'); setActiveNav('nav-interest');
  loadInterestPane();
}
async function loadInterestPane() {
  const body = document.getElementById('interest-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  const { data, error } = await sb.rpc('hub_project_interest', { p_studio: _sessionStudioId });
  if (error) { body.innerHTML = '<div class="ho-intro">' + (/does not exist|function/i.test(error.message) ? 'Not set up yet: run hub_project_interest.sql in Supabase.' : esc(error.message)) + '</div>'; return; }
  const rows = data || [];
  const studio = STUDIO_NAMES[_sessionStudioId] || _sessionStudioId || '';
  const nice = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const hot = r => r.spots_left != null && (r.wishes + r.alerts) > 0 && (r.wishes + r.alerts) >= r.spots_left;
  if (!rows.length) { body.innerHTML = '<div class="ho-intro">No upcoming projects at ' + esc(studio) + ' yet, and no families waiting for one.</div>'; return; }
  rows.sort((a, b) => (hot(b) - hot(a)) || ((b.wishes + b.alerts + b.likes) - (a.wishes + a.alerts + a.likes)));
  body.innerHTML = '<div class="ho-intro">What families love on 4Cats World (Inspire) for <b>' + esc(studio) + '</b>. ❤️ likes count everyone; ★ wish lists and 🔔 alerts are families at this studio. <b>Add spots?</b> means more families are interested than spots are left.</div>' +
    '<div class="pi-table"><table><thead><tr><th></th><th>Project</th><th>Next here</th><th title="Likes (all studios)">❤️</th><th title="Wish lists here">★</th><th title="Waiting for it here, or for new dates">🔔</th><th>Booked</th><th>Spots left</th><th></th></tr></thead><tbody>' +
    rows.map(r => {
      const mini = (r.kinds || []).includes('mini_make') && !(r.kinds || []).includes('workshop');
      return '<tr' + (hot(r) ? ' class="pi-hot"' : '') + '><td><span class="pi-pic"' + (r.image ? ' style="background-image:url(\'' + esc(r.image).replace(/'/g, '') + '\')"' : '') + '></span></td>' +
        '<td><b>' + esc(r.name) + '</b>' + (mini ? ' <span class="pi-tag">Mini Make</span>' : '') + '</td>' +
        '<td>' + (r.next_date ? esc(nice(r.next_date)) + (r.dates > 1 ? ' <span class="pi-soft">· ' + r.dates + ' dates</span>' : '') : '<span class="pi-soft">Not scheduled here</span>') + '</td>' +
        '<td>' + (r.likes || '–') + '</td><td>' + (r.wishes || '–') + '</td><td>' + (r.alerts || '–') + '</td>' +
        '<td>' + (r.booked == null ? '<span class="pi-soft" title="Families choose Mini Make projects at the studio">n/a</span>' : r.booked) + '</td>' +
        '<td>' + (r.spots_left == null ? (r.next_date ? '<span class="pi-soft">n/a</span>' : '–') : r.spots_left) + '</td>' +
        '<td>' + (hot(r) ? '<span class="pi-flag">🔥 Add spots?</span>' : (!r.next_date && (r.wishes + r.alerts) ? '<span class="pi-flag soft">Families waiting</span>' : '')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="ho-intro" style="margin-top:10px">Booked counts the project’s own workshops, plus lineup days where families chose this project. Spots left on lineup days are shared with that day’s other projects.</div>';
}

// ---------- Coordinator → Notifications ----------
// New party bookings and cancellations (until marked reviewed, on any device),
// and the studio's recent bookings, newest first. "Seen" for recent bookings
// is remembered on this computer.
const NOTIF_SEEN_KEY = () => 'hub-notif-seen-' + (_sessionStudioId || '');
function notifSeenAt() { try { return localStorage.getItem(NOTIF_SEEN_KEY()) || ''; } catch (e) { return ''; } }
function openNotifPane() {
  if (!coordOrAdmin()) { openPinModal(); return; }
  showOnlyPane('notif-pane'); setActiveNav('nav-notif');
  loadNotifPane();
}
async function loadNotifPane() {
  const body = document.getElementById('notif-body');
  body.innerHTML = '<div class="ho-intro">Loading…</div>';
  try {
    const [party, recent, sick, fam] = await Promise.all([fetchPartyData(_sessionStudioId), fetchRecentBookings(), loadSickCalls(_sessionStudioId, 2), loadFamilyChanges()]);
    const seen = notifSeenAt();
    const newParties = party.list.filter(pt => !pt.booking.party_alert_dismissed);
    let html = '';
    if (sick.length) {
      html += `<div class="ho-section-head">🤒 Sick calls</div>` + sick.map(c => `<div class="ntf cancel"><span class="ic">🤒</span><div class="bd">
        <div class="tt">${esc(c.name)} called in sick${c.late ? ` <span class="pf-status need">late: ${esc(meNum(c.hours_notice))}h notice</span>` : ''}</div><div class="mt">${esc(ptyDayLabel(c.shift_date))} · ${esc(shortTime(c.start_time))}–${esc(shortTime(c.end_time))}${c.note ? ' · “' + esc(c.note) + '”' : ''}</div>
        ${c.plan ? `<div class="mt" style="color:${sickNeedsPlan(c) ? '#b91c1c' : c.cover_status === 'asked' ? '#b45309' : '#15803d'}">${c.handled_by_name ? esc(c.handled_by_name) + ': ' : ''}${sickPlanLine(c)}</div>` : ''}</div>
        <span class="tm">${esc(relTime(c.created_at))}</span>
        ${!sickNeedsPlan(c) ? `<span class="pf-status ${c.cover_status === 'asked' ? 'need' : 'ok'}">${c.cover_status === 'asked' ? '⏳ Asked ' + esc(c.cover_name || '') : '✓ ' + esc(SICK_PLANS[c.plan] || 'Handled')}</span><button class="ho-btn" onclick="openSickPlan('${escAttr(c.id)}')">Change</button>` : `<button class="ho-btn" onclick="openSickPlan('${escAttr(c.id)}')">I’m on it</button>`}</div>`).join('');
    }
    if (fam.length) {
      // Families changing their own camp days or cancelling on 4Cats World (hub_family_changes.sql)
      const where = st => st === _sessionStudioId ? '' : ' (' + esc(STUDIO_LABEL_SHORT(st)) + ')';
      html += `<div class="ho-section-head">👪 Family changes <span class="mt" style="font-weight:400">made by families on 4Cats World</span></div>` + fam.map(f => {
        const who = esc(f.customer_name || 'A family') + (f.kids && f.kids.length ? ' · ' + esc(f.kids.join(', ')) : '') + (f.qty > 1 ? ' · ' + f.qty + ' spots' : '');
        const fromLine = esc(f.from_title || '') + ' · ' + esc(ptyDayLabel(f.from_date)) + ' ' + esc(shortTime(f.from_time || '')) + where(f.from_studio);
        const body = f.kind === 'week'   // one class week (world_class_weeks.sql): joining another class, or skipping (with their note)
          ? `<div class="tt">${f.to_date ? 'Joining another class this week' : esc(String(f.to_title || 'Skipping this week').split(' · ')[0])}: ${who}</div>
             <div class="mt">${fromLine}${f.to_date ? ` → <b>${esc(ptyDayLabel(f.to_date))} ${esc(shortTime(f.to_time || ''))}</b>${f.gift_last4 ? ' · “' + esc(f.gift_last4) + '”' : ''}` : (String(f.to_title || '').includes(' · ') ? ' · “' + esc(String(f.to_title).split(' · ').slice(1).join(' · ')) + '”' : '')}</div>`
          : f.kind === 'change'   // a workshop or glazing booking changed on World (world_booking_changes.sql)
          ? `<div class="tt">${f.to_studio === _sessionStudioId && f.from_studio !== _sessionStudioId ? 'Moved here' : f.from_studio === _sessionStudioId && f.to_studio !== _sessionStudioId ? 'Moved away' : 'Changed booking'}: ${who}</div>
             <div class="mt"><s>${fromLine}</s> → <b>${esc(f.to_title || '')} · ${esc(ptyDayLabel(f.to_date))} ${esc(shortTime(f.to_time || ''))}${where(f.to_studio)}</b>${f.amount > 0 ? ` · paid $${Number(f.amount).toFixed(2)} more` : f.amount < 0 ? ` · $${Number(-f.amount).toFixed(2)} credit` : ''}</div>`
          : f.kind === 'move'
          ? `<div class="tt">${f.to_studio === _sessionStudioId && f.from_studio !== _sessionStudioId ? 'Moved here' : 'Changed camp day'}: ${who}</div>
             <div class="mt"><s>${fromLine}</s> → <b>${esc(ptyDayLabel(f.to_date))} ${esc(shortTime(f.to_time || ''))}${where(f.to_studio)}</b></div>`
          : `<div class="tt">Cancelled: ${who}</div><div class="mt">${fromLine}${f.amount > 0 ? ` · $${Number(f.amount).toFixed(2)} gift card` + (f.gift_last4 ? ' ending ' + esc(f.gift_last4) : '') : ''}</div>`;
        return `<div class="ntf${f.reviewed ? '' : (f.kind === 'cancel' ? ' cancel' : ' new')}"><span class="ic">${f.kind === 'week' ? '📅' : f.kind === 'move' || f.kind === 'change' ? '🔁' : '🚫'}</span><div class="bd">${body}</div>
          <span class="tm">${esc(relTime(f.at))}</span>
          ${f.reviewed ? '<span class="pf-status ok">✓ Reviewed</span>' : `<button class="ho-btn" onclick="famReviewed('${escAttr(f.kind)}', ${Number(f.ref_id)})">Mark reviewed</button>`}</div>`;
      }).join('');
    }
    if (newParties.length || party.cancels.length) {
      html += `<div class="ho-section-head">Parties to review</div>` +
        newParties.map(pt => `<div class="ntf new"><span class="ic">🎂</span><div class="bd"><div class="tt">New party: ${esc(pt.booking.customer_name || 'Party booking')}</div>
          <div class="mt">${esc(pt.session.title || 'Party')} · ${esc(ptyDayLabel(pt.session.session_date))} ${esc(shortTime(pt.session.session_time || ''))}${pt.booking.shopify_order_name ? ' · ' + esc(pt.booking.shopify_order_name) : ''}</div></div>
          <span class="tm">${pt.booking.booked_at ? esc(relTime(pt.booking.booked_at)) : ''}</span>
          <button class="ho-btn" onclick="openPartiesPane()">Open Parties</button><button class="ho-btn" onclick="ptyDismiss('${escAttr(pt.booking_id)}')">Mark reviewed</button></div>`).join('') +
        party.cancels.map(c => `<div class="ntf cancel"><span class="ic">🚫</span><div class="bd"><div class="tt">Party cancelled: ${esc(c.booking.customer_name || 'Party booking')}</div>
          <div class="mt">${esc(c.session.title || 'Party')} · ${esc(ptyDayLabel(c.session.session_date))} ${esc(shortTime(c.session.session_time || ''))}</div></div>
          <button class="ho-btn" onclick="ptyDismiss('${escAttr(c.booking.id)}')">Mark reviewed</button></div>`).join('');
    }
    html += `<div class="ho-section-head">Recent bookings</div>` + (recent.length ? recent.map(b => {
      const unseen = !seen || (b.booked_at && b.booked_at > seen);
      const kids = (b.kids || []).length ? `<div class="mt">🧒 ${esc(b.kids.join(', '))}</div>` : '';
      return `<div class="ntf${unseen ? ' new' : ''}"><span class="ic">${unseen ? '🆕' : '🧾'}</span><div class="bd"><div class="tt">${esc(b.customer_name || 'Booking')}${b.qty > 1 ? ` · ${b.qty}` : ''}</div>
        <div class="mt">${esc(b.session.title || '—')}${b.session.session_date ? ' · ' + esc(ptyDayLabel(b.session.session_date)) + ' ' + esc(shortTime(b.session.session_time || '')) : ''}${b.shopify_order_name ? ' · ' + esc(b.shopify_order_name) : ''}</div>${kids}</div>
        <span class="tm">${b.booked_at ? esc(relTime(b.booked_at)) : ''}</span></div>`;
    }).join('') : '<div class="ho-intro">No bookings yet.</div>');
    body.innerHTML = html;
    // Opening this page counts as seeing the recent bookings.
    if (recent[0] && recent[0].booked_at) { try { localStorage.setItem(NOTIF_SEEN_KEY(), recent[0].booked_at); } catch (e) {} }
    refreshCoordBadges(party, recent);
  } catch (e) { body.innerHTML = `<div class="ho-card">Couldn't load: ${esc(e.message || e)}</div>`; }
}
// Family changes (camp day moves and self-cancellations), last 14 days, for this studio.
async function loadFamilyChanges() {
  if (!_sessionStudioId) return [];
  try { const r = await sb.rpc('hub_family_changes', { p_studio: _sessionStudioId, p_days: 14 }); return r.error ? [] : (r.data || []); } catch (e) { return []; }
}
async function famReviewed(kind, ref) {
  const who = (_lastHeroData && _sessionPin && _lastHeroData.firstName && _lastHeroData.firstName !== 'team') ? _lastHeroData.firstName : null;
  const { error } = await sb.rpc('hub_family_change_review', { p_studio: _sessionStudioId, p_kind: kind, p_ref: ref, p_by: who });
  if (error) { alert(error.message); return; }
  loadNotifPane();
}
function STUDIO_LABEL_SHORT(id) {
  const n = { 'BC-RICH-GC': 'Richmond Garden City', 'BC-RICH-STV': 'Richmond Steveston', 'BC-SUR-SSR': 'Surrey South', 'BC-YVR-KIT': 'Kitsilano', 'BC-YVR-MS': 'Main Street', 'BC-YVR-UBC': 'UBC',
    'BC-YYJ-CSV': 'Cook Street Village', 'BC-YYJ-ESQ': 'Esquimalt', 'BC-YYJ-OB': 'Oak Bay', 'BC-YYJ-VIC': 'Victoria Uptown', 'AB-YYC-ING': 'Inglewood', 'AB-STA-STA': 'St Albert',
    'ON-BRL-BRL': 'Burlington', 'ON-CMB-GLT': 'Cambridge', 'ON-ERN-ERN': 'Erin', 'ON-HAM-OS': 'Ottawa Street', 'ON-HAM-WD': 'Waterdown', 'ON-HAM-WH': 'West Harbour', 'ON-KGN-AP': 'Kingston',
    'ON-LDN-BYR': 'Byron', 'ON-LDN-WVG': 'Wortley Village', 'ON-MIS-PC': 'Port Credit', 'ON-OAK-OAK': 'Oakville North', 'ON-OAK-WST': 'Oakville West', 'ON-YOW-GLB': 'The Glebe',
    'ON-STC-STC': 'St Catharines', 'ON-YYZ-AVE': 'Avenue Road', 'ON-YYZ-BP': 'Baby Point', 'ON-YYZ-LEA': 'Leaside', 'ON-YYZ-BEA': 'The Beaches', 'ON-WTR-WTR': 'Waterloo' };
  return n[id] || id || '';
}
async function fetchRecentBookings() {
  const { data, error } = await sb.from('bookings').select('id, session_id, customer_name, qty, shopify_order_name, booked_at')
    .eq('studio_id', _sessionStudioId).is('returned_at', null).gt('qty', 0).order('booked_at', { ascending: false }).limit(40);
  if (error) throw error;
  const sIds = [...new Set((data || []).map(b => b.session_id).filter(Boolean))];
  const bIds = (data || []).map(b => b.id);
  const [ss, kids] = await Promise.all([
    sIds.length ? sb.from('sessions').select('id, title, session_date, session_time').in('id', sIds) : Promise.resolve({ data: [] }),
    bIds.length ? sb.from('booking_children').select('booking_id, child_index, child_name').in('booking_id', bIds).order('child_index') : Promise.resolve({ data: [] })
  ]);
  const sById = {}; (ss.data || []).forEach(x => { sById[x.id] = x; });
  const kBy = {}; (kids.data || []).forEach(k => { if (k.child_name) (kBy[k.booking_id] = kBy[k.booking_id] || []).push(k.child_name); });
  return (data || []).map(b => Object.assign({}, b, { session: sById[b.session_id] || {}, kids: kBy[b.id] || [] }));
}
async function ackSick(id) {
  const { error } = await sb.rpc('hub_ack_sick_call', { p_id: id });
  if (error) { alert(error.message); return; }
  loadNotifPane();
}
// Sidebar counts: Parties = new bookings + cancellations + parties in the next
// week not contacted; Notifications = new party items + recent bookings not seen yet.
async function refreshCoordBadges(party, recent) {
  try { if (_studioData && _studioData.isAdmin) boBadge(); } catch (e) {}   // 🏢 new studio buyout requests
  // home office: new concern reports (hub_concerns.sql)
  if (_studioData && _studioData.isAdmin) sb.rpc('hub_concerns_list').then(r => {
    const b = document.getElementById('concerns-badge'); if (!b || r.error) return;
    const n = (r.data || []).filter(c => c.status === 'new').length; b.textContent = n; b.style.display = n ? '' : 'none';
  }).catch(() => {});
  // home office: shift swaps waiting (hub_shift_offers.sql)
  if (_studioData && _studioData.isAdmin) sb.rpc('hub_offers_admin').then(r => {
    const b = document.getElementById('swaps-badge'); if (!b || r.error) return;
    const n = (r.data || []).filter(o => o.status === 'taken').length; b.textContent = n; b.style.display = n ? '' : 'none';
  }).catch(() => {});
  // home office: computers waiting for approval (hub_devices.sql)
  if (_studioData && _studioData.isAdmin) sb.rpc('hub_devices_list').then(r => {
    const b = document.getElementById('devices-badge'); if (!b || r.error) return;
    const n = (r.data || []).filter(d => d.status === 'pending').length; b.textContent = n; b.style.display = n ? '' : 'none';
  }).catch(() => {});
  if (!coordOrAdmin() || !_sessionStudioId) return;
  try {
    party = party || (_pty && paneVisible('parties-pane') ? _pty : await fetchPartyData(_sessionStudioId));
    if (!recent) recent = await fetchRecentBookings();
  } catch (e) { return; }
  const newP = party.list.filter(pt => !pt.booking.party_alert_dismissed).length + party.cancels.length;
  const soon = party.list.filter(pt => { const st = ptyStatus(pt); return (st === 'new' || st === 'message') && daysUntil(pt.session.session_date) <= 7; }).length;
  const seen = notifSeenAt();
  const unseen = recent.filter(b => b.booked_at && (!seen || b.booked_at > seen)).length;
  const setB = (id, n) => { const el = document.getElementById(id); if (el) { el.textContent = n > 99 ? '99+' : String(n); el.style.display = n ? '' : 'none'; } };
  setB('parties-badge', newP + soon);
  let sickN = 0;
  try { sickN = (await loadSickCalls(_sessionStudioId, 2)).filter(sickNeedsPlan).length; } catch (e) {}
  let famN = 0;
  try { famN = (await loadFamilyChanges()).filter(f => !f.reviewed).length; } catch (e) {}
  setB('notif-badge', newP + sickN + famN + (seen ? unseen : 0));
  // "Suggest a date!" suggestions waiting (world_ideas_hub.sql)
  try { const r = await sb.rpc('hub_ideas_new_count', { p_studio: _sessionStudioId, p_all: !!(_studioData && _studioData.isAdmin) }); if (!r.error) setB('ideas-badge', r.data || 0); } catch (e) {}
}



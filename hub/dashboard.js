// hub/dashboard.js: 🏠 My dashboard (Nov 12 2026), home office logins only. A grid of blocks picked from a library, started from
// a role's layout, then added to, removed, moved and resized by each person; saved to their own login (hub_dashboards table,
// my_dashboard SQL step 2: hub_dash_me / hub_dash_save). Each block is a summary with "Open →" to its full Hub page.
// The page only hides blocks a person can't open: every block loads through the same RPC or Edge Function as its full page,
// and that call checks access itself (a refusal shows "No access" on the block). Loaded by hub.html after the other area files.
// Design: "4Cats Hub — My dashboard design v1" doc. (Nov 12 2026: heights by dragging a block's corner, blocks stack into gaps,
// live reordering while dragging; Customize buttons sit in each block's header so blocks are the same size in both modes.)
// (Nov 12 2026: 🏁 Studio pace from pace.html's numbers, 🗓️ Weekly schedule check shared between people, 🧾 New orders feed
// with per-person ✓; my_dashboard SQL step 3.)
// (Nov 12 2026: a personal header (greeting, picture, today at a glance), 🎨 colour themes, and owners' 👥 Set up for…: a starting
// dashboard per person (hub_dash_templates, SQL step 4) that ↺ always goes back to; step 4 also adds can_set_up to hub_dash_me.)

// ---------- State ----------
let _dash = { me: null, layout: null, edit: false, err: '', saving: '', saveTimer: null, refreshTimer: null, drag: null, choose: false, cache: {}, ro: null };
const DASH_RANK = { none: 0, own: 1, view: 2, edit: 3, manage: 4 };
const DASH_REFRESH_MS = 5 * 60 * 1000;
const DASH_MAX_BLOCKS = 50;
const DASH_ROW = 4, DASH_GAP = 12, DASH_HMIN = 120, DASH_HMAX = 1000;   // the stacking grid: 4px rows, 12px gaps (a block's bottom margin); heights people can drag to

// ---------- Small helpers ----------
function dashCan(area, level) {
  if (!area) return true;
  const have = (_dash.me && _dash.me.areas && _dash.me.areas[area]) || 'none';
  return (DASH_RANK[have] || 0) >= (DASH_RANK[level || 'view'] || 0);
}
function dashIsOwner() { return !!(_dash.me && (_dash.me.roles || []).includes('owner')); }
function dashDay(d) { return d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : ''; }
function dashStudio(id) { return STUDIO_NAMES[id] || id || ''; }
function dashToday() { return localDateStr(new Date()); }
function dashNewId() { return 'b' + Math.random().toString(36).slice(2, 9); }
function dashRows(list, n, row, emptyText) {
  if (!list.length) return `<div class="dash-empty">${esc(emptyText || 'Nothing here.')}</div>`;
  const shown = list.slice(0, n);
  return `<div class="dash-list">${shown.map(row).join('')}</div>${list.length > n ? `<div class="dash-more">+ ${list.length - n} more</div>` : ''}`;
}
function dashLine(main, sub, cls) { return `<div class="dash-row${cls ? ' ' + cls : ''}"><div class="dash-main">${main}</div>${sub ? `<div class="dash-sub">${sub}</div>` : ''}</div>`; }
function dashBig(n, label, tone) { return `<div class="dash-big"><b class="${tone || ''}">${esc(n)}</b> <span>${esc(label)}</span></div>`; }
async function dashRpc(name, args) {
  const r = await sb.rpc(name, args || {});
  if (r.error) throw r.error;
  return r.data;
}
function dashOpen(fn, arg) {
  try {
    if (typeof window[fn] !== 'function') { alert('That page isn’t available on this login.'); return; }
    window[fn](arg);
  } catch (e) { console.warn('My dashboard: couldn’t open', fn, e); }
}

// ---------- The block library ----------
// type: { name, group, area, level, size (default), sizes, opts (defaults), settings(b) → html, open: [fn, arg], load(b) → html }
const DASH_GROUPS = ['Mine', 'Studio day', 'Customers', 'People', 'Money', 'Comms', 'World', 'Admin'];
const DASH_ROWS_SETTING = b => `<label>Rows to show <select data-opt="rows">${[3, 5, 8, 12].map(n => `<option value="${n}"${+b.opts.rows === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
const DASH_BLOCKS = {
  // ---- Mine ----
  for_you: {
    name: '📋 For you', group: 'Mine', area: null, size: 'm', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['inboxPageOpen', ''],
    desc: 'Items waiting on you, with their decide and note buttons.',
    async load(b) {
      const list = (await dashRpc('hub_inbox_mine')) || [];
      try { if (typeof _inbox !== 'undefined') _inbox = list; } catch (e) { }   // (the inbox page's own buttons read this)
      if (!list.length) return '<div class="dash-empty">Nothing waiting on you. ✓</div>';
      const sorted = typeof inboxSorter === 'function' ? list.slice().sort(inboxSorter('soon')) : list;
      const n = +b.opts.rows || 5;
      const items = typeof inboxItemHtml === 'function' ? sorted.slice(0, n).map(inboxItemHtml).join('')
        : sorted.slice(0, n).map(x => dashLine(esc(x.title || x.kind || 'Item'), esc(dashStudio(x.studio_id)))).join('');
      dashGlanceSet(b, list.length + (list.length === 1 ? ' thing for you' : ' things for you'));
      return dashBig(list.length, list.length === 1 ? 'to decide' : 'to decide') + items + (list.length > n ? `<div class="dash-more">+ ${list.length - n} more</div>` : '');
    }
  },
  chat_unread: {
    name: '💬 Unread chat', group: 'Mine', area: null, size: 's', open: ['openChatPane'],
    desc: 'How many chat messages you haven’t read.',
    async load(b) {
      const n = +(await dashRpc('hub_chat_unread')) || 0; dashGlanceSet(b, n ? n + ' unread chat' : '');
      return n ? dashBig(n, n === 1 ? 'unread message' : 'unread messages', 'warn') : '<div class="dash-empty">All caught up. ✓</div>';
    }
  },
  quick_links: {
    name: '🔗 Quick links', group: 'Mine', area: null, size: 'm', opts: { links: ['finance', 'pace', 'access', 'admin'] },
    desc: 'Buttons for the pages and tools you use most.',
    settings(b) {
      const on = new Set(b.opts.links || []);
      return '<div class="dash-ticks">' + DASH_LINKS.filter(l => dashCan(l.area, l.level)).map(l =>
        `<label><input type="checkbox" data-link="${escAttr(l.key)}"${on.has(l.key) ? ' checked' : ''}> ${esc(l.name)}</label>`).join('') + '</div>';
    },
    load(b) {
      const L = DASH_LINKS.filter(l => (b.opts.links || []).includes(l.key) && dashCan(l.area, l.level));
      if (!L.length) return '<div class="dash-empty">No links yet. Choose some in ✏️ Customize → ⚙.</div>';
      return '<div class="dash-links">' + L.map(l => `<button class="ho-btn sm" onclick="dashLinkGo('${escAttr(l.key)}')">${esc(l.name)}</button>`).join('') + '</div>';
    }
  },
  sticky_note: {
    name: '📝 Sticky note', group: 'Mine', area: null, size: 's', opts: { text: '' },
    desc: 'A private note to yourself, saved with your layout.',
    load(b) {
      return `<textarea class="dash-note" maxlength="2000" placeholder="A note to yourself…" oninput="dashNoteInput('${escAttr(b.id)}', this.value)">${esc(b.opts.text || '')}</textarea>`;
    }
  },

  // ---- Studio day ----
  open_close: {
    name: '✅ Open & close today', group: 'Studio day', area: 'duties_open_close', level: 'view', size: 'm', opts: { list: 'open', rows: 5 }, open: ['openOcOverview'],
    desc: 'Which open studios haven’t started or finished their list today.',
    settings: b => `<label>List <select data-opt="list"><option value="open"${b.opts.list === 'open' ? ' selected' : ''}>Opening</option><option value="close"${b.opts.list === 'close' ? ' selected' : ''}>Closing</option></select></label>` + DASH_ROWS_SETTING(b),
    async load(b) {
      const d = (await dashRpc('hub_checklist_overview', { p_list: b.opts.list === 'close' ? 'close' : 'open' })) || {};
      const open = (d.studios || []).filter(r => r.run || !r.day || r.day.status === 'open');
      const done = open.filter(r => r.run && r.run.finished_at), going = open.filter(r => r.run && !r.run.finished_at), not = open.filter(r => !r.run);
      const word = b.opts.list === 'close' ? 'closing' : 'opening';
      return dashBig(`${done.length} of ${open.length}`, `open studios finished their ${word} list`, done.length === open.length ? 'ok' : '') +
        dashRows(not.map(r => [r, 'Not started']).concat(going.map(r => [r, 'In progress'])), +b.opts.rows || 5,
          ([r, s]) => dashLine(esc(dashStudio(r.studio_id)), `<span class="dash-pill ${s === 'Not started' ? 'bad' : 'mid'}">${s}</span>`), 'Every open studio is done. ✓');
    }
  },
  class_problems: {
    name: '⚠️ Class bookings to fix', group: 'Studio day', area: 'class_times', level: 'view', size: 'm', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openAsPane'],
    desc: 'Families missing a week of a class, weeks on the wrong day, paid but not booked.',
    async load(b) {
      const L = (await dashRpc('hub_class_problems')) || []; dashGlanceSet(b, L.length ? L.length + ' class bookings to fix' : '');
      const W = { missing_week: '📚 Missing a week', off_day_week: '📅 Week on the wrong day', paid_not_booked: '💳 Paid, not booked' };
      return (L.length ? dashBig(L.length, 'to look at', 'warn') : '') +
        dashRows(L, +b.opts.rows || 5, x => dashLine(`<b>${esc(W[x.problem] || x.problem)}</b> · ${esc(dashStudio(x.studio_id))}`, esc(dashDay(x.day) + (x.detail ? ' · ' + x.detail : ''))), 'Every family is on all their weeks. ✓');
    }
  },
  nightly_run: {
    name: '🌙 Nightly run', group: 'Studio day', area: 'class_times', level: 'manage', size: 'm', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openAsPane'],
    desc: 'What the nightly auto-schedule changed this week.',
    async load(b) {
      const L = ((await dashRpc('hub_autosched_nightly_log', { p_days: 7 })) || []).filter(a => !/^(staff_|class_)/.test(a.action) && a.action !== 'keep_no_history');
      const A = typeof ASN_ACT !== 'undefined' ? ASN_ACT : {};
      return dashBig(L.length, L.length === 1 ? 'change this week' : 'changes this week') +
        dashRows(L, +b.opts.rows || 5, a => dashLine(`<b>${esc(A[a.action] || a.action)}</b> · ${esc(dashStudio(a.studio_id))}`, esc(dashDay(a.day) + (a.undone_at ? ' · undone' : ''))), 'Nothing changed this week.');
    }
  },
  devices: {
    name: '🖥 Computers waiting', group: 'Studio day', area: 'users_access', level: 'edit', size: 's', open: ['openDevicesPane'],
    desc: 'Studio computers waiting for approval.',
    async load() {
      const P = ((await dashRpc('hub_devices_list')) || []).filter(d => d.status === 'pending');
      return P.length ? dashBig(P.length, 'waiting', 'warn') + dashRows(P, 4, d => dashLine(esc(dashStudio(d.studio_id)), esc(relTime(d.requested_at)))) : '<div class="dash-empty">Nothing waiting. ✓</div>';
    }
  },

  // ---- Customers ----
  field_trips: {
    name: '🏫 Field trip follow-ups', group: 'Customers', area: 'parties_events', level: 'view', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openFtPane'],
    desc: 'Requests with a follow-up due today or earlier, and new requests.',
    async load(b) {
      const R = (await dashRpc('hub_field_trips', { p_status: 'open' })) || [], t = dashToday();
      const due = R.filter(r => r.follow_up && r.follow_up <= t && !['booked', 'declined'].includes(r.status)), fresh = R.filter(r => r.status === 'new');
      const list = due.concat(fresh.filter(r => !due.includes(r)));
      return `<div class="dash-chips"><span class="dash-pill ${due.length ? 'bad' : 'ok'}">${due.length} to follow up</span><span class="dash-pill">${fresh.length} new</span></div>` +
        dashRows(list, +b.opts.rows || 5, r => dashLine(esc(r.school || r.contact_name || 'Request'), esc([dashStudio(r.studio_id), r.follow_up && r.follow_up <= t ? 'follow up ' + dashDay(r.follow_up) : 'new'].filter(Boolean).join(' · '))), 'Nothing to follow up. ✓');
    }
  },
  buyouts: {
    name: '🏢 Buyout requests', group: 'Customers', area: 'parties_events', level: 'view', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openBoPane'],
    desc: 'New studio buyout requests and ones still open.',
    async load(b) {
      const R = (await dashRpc('hub_buyout_requests', { p_status: 'open' })) || [];
      const fresh = R.filter(r => r.status === 'new');
      return `<div class="dash-chips"><span class="dash-pill ${fresh.length ? 'mid' : 'ok'}">${fresh.length} new</span><span class="dash-pill">${R.length} open</span></div>` +
        dashRows(fresh.concat(R.filter(r => r.status !== 'new')), +b.opts.rows || 5, r => dashLine(esc((r.name || 'Request') + ' · ' + dashStudio(r.studio_id)), esc((r.status === 'new' ? 'new' : r.status) + ' · ' + relTime(r.created_at))), 'No open requests.');
    }
  },
  unpaid_invoices: {
    name: '🧾 Unpaid invoices', group: 'Customers', area: 'parties_events', level: 'view', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openFtPane'],
    desc: 'Field trip and buyout invoices sent but not paid, past due first.',
    async load(b) {
      const [ft, bo] = await Promise.all([dashRpc('hub_ft_invoices', { p_studio: null }).catch(() => []), dashRpc('hub_buyouts', { p_studio: null }).catch(() => [])]);
      const due = i => i.status === 'balance_sent' ? i.balance_due : i.pay_by;
      const L = [].concat((ft || []).map(i => Object.assign({ kind: '🏫' }, i)), (bo || []).map(i => Object.assign({ kind: '🏢' }, i)))
        .filter(i => i.status === 'sent' || i.status === 'balance_sent').sort((a, b) => String(due(a) || '').localeCompare(String(due(b) || '')));
      const t = dashToday(), late = L.filter(i => due(i) && String(due(i)).slice(0, 10) < t); dashGlanceSet(b, late.length ? late.length + ' invoices past due' : '');
      return `<div class="dash-chips"><span class="dash-pill ${late.length ? 'bad' : 'ok'}">${late.length} past due</span><span class="dash-pill">${L.length} unpaid</span></div>` +
        dashRows(L, +b.opts.rows || 5, i => dashLine(`${i.kind} ${esc(i.school || i.name || dashStudio(i.studio_id))}`,
          esc((i.status === 'sent' ? 'deposit' : 'balance') + ' due ' + dashDay(due(i))), due(i) && String(due(i)).slice(0, 10) < t ? 'late' : ''), 'Everything sent is paid. ✓');
    }
  },
  date_suggestions: {
    name: '🗓️ Date suggestions', group: 'Customers', area: 'class_times', level: 'view', size: 's', open: ['openIdeasPane'],
    desc: 'New “Suggest a date!” requests from World, all studios.',
    async load() {
      const n = +(await dashRpc('hub_ideas_new_count', { p_studio: (typeof _sessionStudioId !== 'undefined' && _sessionStudioId) || null, p_all: true })) || 0;
      return n ? dashBig(n, n === 1 ? 'new suggestion' : 'new suggestions', 'warn') : '<div class="dash-empty">No new suggestions.</div>';
    }
  },

  // ---- People ----
  sick_calls: {
    name: '🤒 Sick calls', group: 'People', area: 'staff_scheduling', level: 'view', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openSickPane'],
    desc: 'Sick calls in the next 3 days, the ones still needing a plan first.',
    async load(b) {
      const L = (await dashRpc('hub_all_sick_calls', { p_days: 3 })) || [];
      const needs = c => (typeof sickNeedsPlan === 'function' ? sickNeedsPlan(c) : !c.plan);
      const wait = L.filter(needs); dashGlanceSet(b, wait.length ? wait.length + (wait.length === 1 ? ' sick call needs' : ' sick calls need') + ' a plan' : '');
      return `<div class="dash-chips"><span class="dash-pill ${wait.length ? 'bad' : 'ok'}">${wait.length} need a plan</span><span class="dash-pill">${L.length - wait.length} handled</span></div>` +
        dashRows(wait.concat(L.filter(c => !needs(c))), +b.opts.rows || 5, c => dashLine(esc(c.name + ' · ' + (c.studio_name || dashStudio(c.studio_id))),
          esc(dashDay(c.shift_date) + ' · ' + shortTime(c.start_time) + '–' + shortTime(c.end_time)), needs(c) ? 'late' : ''), 'No sick calls. ✓');
    }
  },
  swaps: {
    name: '🔁 Shift swaps', group: 'People', area: 'staff_scheduling', level: 'edit', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openSwapsPane'],
    desc: 'Give-away shifts someone has taken, waiting for approval.',
    async load(b) {
      const W = ((await dashRpc('hub_offers_admin')) || []).filter(o => o.status === 'taken'); dashGlanceSet(b, W.length ? W.length + ' shift swaps to approve' : '');
      return (W.length ? dashBig(W.length, 'waiting for you', 'warn') : '') +
        dashRows(W, +b.opts.rows || 5, o => dashLine(esc(o.from_name + ' → ' + o.taker_name), esc(dashDay(o.shift_date) + ' · ' + shortTime(o.start_time) + ' · ' + (o.studio_name || ''))), 'Nothing waiting. ✓');
    }
  },
  sign_offs: {
    name: '✍️ Policy sign-offs', group: 'People', area: 'hr_policies', level: 'view', size: 's', open: ['openAckCompliance', 'ho'],
    desc: 'Overdue, due and signed policy sign-offs across all studios.',
    async load() {
      const R = (await dashRpc('kb_ack_compliance', { p_studio_id: null })) || [];
      const n = s => R.filter(r => r.status === s).length;
      if (!R.length) return '<div class="dash-empty">No policies need signing right now.</div>';
      return `<div class="dash-stats"><div><b class="bad">${n('overdue')}</b>Overdue</div><div><b>${n('due')}</b>To sign</div><div><b>${n('due_soon')}</b>Due soon</div><div><b class="ok">${n('signed')}</b>Signed</div></div>`;
    }
  },
  concerns: {
    name: '🛡️ Concerns', group: 'People', area: 'hr_policies', level: 'edit', size: 's', open: ['openConcernsAdmin'],
    desc: 'New and open concerns: counts and age only. Details stay on the Concerns page.',
    async load() {
      const L = (await dashRpc('hub_concerns_list')) || [];
      const fresh = L.filter(c => c.status === 'new'); dashGlanceSet(b, fresh.length ? fresh.length + ' new concerns' : ''); const looking = L.filter(c => c.status === 'reviewing');
      const oldest = fresh.map(c => c.created_at).filter(Boolean).sort()[0];
      return `<div class="dash-stats"><div><b class="${fresh.length ? 'bad' : 'ok'}">${fresh.length}</b>New</div><div><b>${looking.length}</b>Looking into it</div></div>` +
        (oldest ? `<div class="dash-sub">Oldest new one: ${esc(relTime(oldest))}</div>` : '');
    }
  },

  // ---- Money ----
  sales_pace: {   // (the type is still "sales_pace" so dashboards that already have it get the new version)
    name: '🏁 Studio pace', group: 'Money', area: 'sales_stats', level: 'view', size: 'm', opts: { order: 'best' }, open: ['dashOpenUrl', 'pace.html'],
    desc: 'Every studio’s month-to-date pace toward its goal, like the Studio Pace page. Scroll to see them all.',
    settings: b => `<label>Order <select data-opt="order"><option value="best"${b.opts.order !== 'worst' ? ' selected' : ''}>Best first</option><option value="worst"${b.opts.order === 'worst' ? ' selected' : ''}>Needs help first</option></select></label>`,
    async load(b) {
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Etc/GMT+7' });   // (as pace.html: BC time)
      const R = (await dashRpc('get_pace_leaderboard', { p_day: day })) || [], by = {};
      R.forEach(r => { by[r.studio_id] = r; });
      const num = v => v == null || isNaN(Number(v)) ? null : Number(v);
      const L = Object.keys(STUDIO_NAMES).map(id => ({ id, pace: num(by[id] && by[id].month_pace_pct), goal: num(by[id] && by[id].month_goal_pct) }));
      const ranked = L.filter(r => r.pace != null).sort((x, y) => y.pace - x.pace), rank = {};
      ranked.forEach((r, i) => { rank[r.id] = i && ranked[i - 1].pace === r.pace ? rank[ranked[i - 1].id] : i + 1; });
      const dir = b.opts.order === 'worst' ? 1 : -1;
      L.sort((x, y) => x.pace == null ? (y.pace == null ? dashStudio(x.id).localeCompare(dashStudio(y.id)) : 1) : y.pace == null ? -1 : (x.pace - y.pace) * dir);
      const counts = {}; ranked.forEach(r => { const t = dashPaceTier(r.pace); counts[t.label] = (counts[t.label] || 0) + 1; });
      return `<div class="dash-chips">${DASH_PACE_TIERS.slice().reverse().filter(t => counts[t.label]).map(t => `<span class="dash-pill" style="background:${t.bg};color:${t.fg}">${counts[t.label]} ${esc(t.label)}</span>`).join('')}</div>` +
        '<div class="dash-pace">' + L.map(r => { const t = dashPaceTier(r.pace), k = rank[r.id];
          return `<div class="dash-pace-row"><span class="dash-rank">${k === 1 ? '🥇' : k === 2 ? '🥈' : k === 3 ? '🥉' : (k || '—')}</span>
            <span class="dash-pace-name">${esc(dashStudio(r.id))}${r.goal != null ? `<small>${esc(r.goal)}% of the month’s goal</small>` : ''}</span>
            <i><em style="width:${r.pace == null ? 0 : Math.max(2, Math.min(100, r.pace / 1.5))}%;background:${t ? t.bg : 'transparent'}"></em></i>
            <b style="${t ? `background:${t.bg};color:${t.fg}` : 'color:var(--ink-soft)'}">${r.pace == null ? '—' : esc(r.pace) + '%'}</b></div>`; }).join('') +
        `</div><div class="dash-sub">Month to date compared with where each studio needs to be today. 100% = on track.</div>`;
    }
  },
  sched_check: {
    name: '🗓️ Weekly schedule check', group: 'People', area: 'staff_scheduling', level: 'view', size: 'm', opts: { show: 'all' }, poll: 30000, open: ['dashOpenUrl', 'day-board.html?view=week'],
    desc: 'Tick each studio once its week (Monday to Sunday) has been looked over. Shared: everyone sees who ticked what.',
    settings: b => `<label>Show <select data-opt="show"><option value="all"${b.opts.show !== 'todo' ? ' selected' : ''}>Every studio</option><option value="todo"${b.opts.show === 'todo' ? ' selected' : ''}>Only studios not ticked yet</option></select></label>`,
    async load(b) {
      const off = (_dash.week && _dash.week[b.id]) || 0, wk = dashMonday(off);
      const d = (await dashRpc('hub_sched_check_list', { p_week: wk })) || {}, C = {};
      (d.checks || []).forEach(c => { C[c.studio_id] = c; });
      if (!off) dashGlanceSet(b, (d.checks || []).length + ' of ' + Object.keys(STUDIO_NAMES).length + ' schedules checked');
      return dashSchedHtml(b, wk, off, C);
    }
  },
  orders: {
    name: '🧾 New orders', group: 'Money', area: 'sales_stats', level: 'view', size: 'm', opts: { days: '3' }, poll: 60000,
    desc: 'Shopify and World orders as they come in. ✓ hides one from your list (only yours).',
    settings: b => `<label>Go back <select data-opt="days">${[['1', '1 day'], ['3', '3 days'], ['7', 'A week'], ['14', '2 weeks']].map(([v, l]) => `<option value="${v}"${String(b.opts.days) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`,
    async load(b) {
      const d = (await dashRpc('hub_dash_orders', { p_days: +b.opts.days || 3, p_limit: 40 })) || {}, O = d.orders || [];
      (_dash.orders = _dash.orders || {})[b.id] = O; dashGlanceSet(b, +d.waiting ? d.waiting + ' new orders' : '');
      if (!O.length) return '<div class="dash-empty">No new orders. ✓</div>';
      const money = v => v == null ? '' : '$' + Number(v).toFixed(2);
      return `<div class="dash-head-row"><span class="dash-big"><b>${esc(d.waiting)}</b> <span>new</span></span><button class="ho-btn sm" onclick="dashOrdersAckAll('${b.id}')">✓ All shown</button></div>` +
        '<div class="dash-list">' + O.map((o, i) => `<div class="dash-order" id="dash-o-${b.id}-${i}">
          <button class="dash-tick" title="Seen it: hide from my list" onclick="dashOrderAck('${b.id}', ${i})">✓</button>
          <div class="dash-order-main"><div class="dash-main">${esc(o.name || '')} <span class="dash-o-amt">${esc(money(o.total))}</span></div>
            <div class="dash-sub">${esc([o.customer, dashStudio(o.studio_id), o.channel, relTime(o.at)].filter(Boolean).join(' · '))}</div>
            ${o.items ? `<div class="dash-o-items">${esc(o.items)}</div>` : ''}</div></div>`).join('') + '</div>' +
        (+d.waiting > O.length ? `<div class="dash-more">+ ${esc(+d.waiting - O.length)} older, after these</div>` : '');
    }
  },

  // ---- Comms ----
  newsletters: {
    name: '📧 Newsletters', group: 'Comms', area: 'newsletters', level: 'view', size: 's', open: ['openNewsPane'],
    desc: 'Drafts, scheduled and recently sent customer newsletters.',
    async load() {
      const L = (await dashRpc('news_issues_list', { p_templates: false })) || [];
      const n = s => L.filter(i => i.status === s).length;
      const last = L.filter(i => i.status === 'sent').sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      return `<div class="dash-stats"><div><b>${n('draft')}</b>Drafts</div><div><b>${n('scheduled') + n('sending')}</b>Scheduled</div><div><b>${n('sent')}</b>Sent</div></div>` +
        (last ? `<div class="dash-sub">Last sent: <b>${esc(last.title)}</b> · ${esc(relTime(last.updated_at))}</div>` : '');
    }
  },
  announcements: {
    name: '📢 Announcements', group: 'Comms', area: 'staff_comms', level: 'view', size: 'm', opts: { rows: 4 }, settings: DASH_ROWS_SETTING, open: ['openAnnouncePane'],
    desc: 'Announcements showing now, and how many studios have read each.',
    async load(b) {
      const [a, r] = await Promise.all([sb.from('announcements').select('id, title, priority, show_from, show_until, studio_ids').order('created_at', { ascending: false }),
        sb.from('announcement_reads').select('announcement_id, studio_id')]);
      if (a.error) throw a.error;
      const t = dashToday(), live = (a.data || []).filter(x => !(x.show_from > t) && !(x.show_until && x.show_until < t));
      const reads = {}; (r.data || []).forEach(x => { (reads[x.announcement_id] = reads[x.announcement_id] || new Set()).add(x.studio_id); });
      return dashRows(live, +b.opts.rows || 4, x => { const tg = x.studio_ids && x.studio_ids.length ? x.studio_ids : Object.keys(STUDIO_NAMES);
        const n = tg.filter(s => reads[x.id] && reads[x.id].has(s)).length;
        return dashLine(`${x.priority === 'urgent' ? '❗ ' : ''}${esc(String(x.title || 'Announcement').replace(/[*_#`]/g, ''))}`, r.error ? '' : `read at ${n} of ${tg.length} studios`); }, 'No announcements showing now.');
    }
  },
  staff_news: {
    name: '📰 Staff newsletter', group: 'Comms', area: 'staff_comms', level: 'view', size: 's', open: ['openStaffNewsPane'],
    desc: 'The latest staff newsletter: draft or published, and how many have read it.',
    async load() {
      const L = (await dashRpc('hub_staffnews_list')) || [];
      if (!L.length) return '<div class="dash-empty">No staff newsletters yet.</div>';
      const pub = L.filter(x => x.status === 'published').sort((a, b) => String(b.month).localeCompare(String(a.month)))[0], drafts = L.filter(x => x.status === 'draft').length;
      return (pub ? dashLine(`<b>${esc(pub.title)}</b>`, `read by ${esc(pub.read || 0)} of ${esc(pub.staff || 0)} staff`) : '') +
        `<div class="dash-sub">${drafts} draft${drafts === 1 ? '' : 's'}</div>`;
    }
  },

  // ---- World ----
  studio_notes: {
    name: '✍️ Studio notes', group: 'World', area: 'world_site_deals', level: 'view', size: 's', opts: { rows: 5 }, settings: DASH_ROWS_SETTING, open: ['openSnotesPane'],
    desc: 'Studios with no note showing on World, and notes ending this week.',
    async load(b) {
      const d = (await dashRpc('hub_studio_notes_all')) || {}, N = d.notes || [], t = dashToday();
      const wk = localDateStr(new Date(Date.now() + 7 * 86400000));
      const live = N.filter(n => n.show_from <= t && (!n.show_until || n.show_until >= t));
      const has = new Set(live.map(n => n.studio_id)), none = Object.keys(STUDIO_NAMES).filter(s => !has.has(s));
      const ending = new Set(live.filter(n => n.show_until && n.show_until <= wk).map(n => n.studio_id));
      return `<div class="dash-chips"><span class="dash-pill ${none.length ? 'mid' : 'ok'}">${none.length} with no note</span><span class="dash-pill">${ending.size} ending this week</span></div>` +
        dashRows(none, +b.opts.rows || 5, s => dashLine(esc(dashStudio(s)), 'no note showing'), 'Every studio has a note showing. ✓');
    }
  },
  donations: {
    name: '🎁 Donations & giveaways', group: 'World', area: 'world_site_deals', level: 'view', size: 's', open: ['openDonPane'],
    desc: 'Giveaway codes handed out and how many have been used.',
    async load() {
      const R = (await dashRpc('hub_donations_list', { p_search: null, p_from: null, p_to: null })) || [];
      const codes = R.reduce((t, d) => t.concat(d.code_status || []), []), used = codes.filter(c => c.used === true).length;
      return `<div class="dash-stats"><div><b>${R.length}</b>Entries</div><div><b>${codes.length}</b>Codes given</div><div><b class="ok">${used}</b>Used</div></div>`;
    }
  },

  // ---- Admin ----
  activity: {
    name: '🕘 Recent activity', group: 'Admin', area: 'users_access', level: 'view', size: 'm', opts: { rows: 8 }, settings: DASH_ROWS_SETTING, open: ['openActPane'],
    desc: 'The latest changes in the Activity log.',
    async load(b) {
      const n = +b.opts.rows || 8, L = (await dashRpc('staff_activity_list', { p: { limit: n } })) || [];
      return dashRows(L, n, x => dashLine(esc(x.label || x.action || ''), esc([String(x.actor_email || '').split('@')[0], dashStudio(x.studio_id), relTime(x.at)].filter(Boolean).join(' · '))), 'Nothing logged yet.');
    }
  }
};

// Quick links: Hub pages (by their sidebar button) and tool pages (new tab)
const DASH_LINKS = [
  { key: 'finance', name: '💵 Finance', url: 'finance.html', area: 'finance', level: 'view' },
  { key: 'pace', name: '📈 Studio pace', url: 'pace.html', area: null },
  { key: 'access', name: '🔐 Access', url: 'access.html', area: 'users_access', level: 'view' },
  { key: 'admin', name: '🛠 Admin', url: 'admin.html', area: null },
  { key: 'world', name: '🌍 World settings', url: 'world-settings.html', area: 'world_site_deals', level: 'view' },
  { key: 'staffsched', name: '🗓️ Staff schedule', url: 'staff-schedule.html', area: 'staff_scheduling', level: 'view' },
  { key: 'sessions', name: '🗂️ Class times table', url: 'sessions.html', area: 'class_times_table', level: 'view' },
  { key: 'camps', name: '🏕️ Camps', url: 'camps-manager.html', area: 'camps', level: 'view' },
  { key: 'kb', name: '📘 Knowledge base', url: 'knowledge.html', area: 'support', level: 'view' },
  { key: 'curriculum', name: '📚 Curriculum', url: 'curriculum.html', area: 'programs_curriculum', level: 'view' },
  { key: 'n_announce', name: '📢 Announcements', nav: 'nav-announce', area: 'staff_comms', level: 'view' },
  { key: 'n_ft', name: '🏫 Field trips', nav: 'nav-ft', area: 'parties_events', level: 'view' },
  { key: 'n_bo', name: '🏢 Buyouts', nav: 'nav-bo', area: 'parties_events', level: 'view' },
  { key: 'n_ts', name: '🕒 Timesheets', nav: 'nav-ts', area: 'timesheets', level: 'view' },
  { key: 'n_stf', name: '👥 Staffing', nav: 'nav-stf', area: 'staff_scheduling', level: 'view' },
  { key: 'n_news', name: '📧 Newsletters', nav: 'nav-news', area: 'newsletters', level: 'view' },
  { key: 'n_rp', name: '🛍️ Products', nav: 'nav-rp', area: 'retail_products', level: 'view' }
];
function dashLinkGo(key) {
  const l = DASH_LINKS.find(x => x.key === key); if (!l) return;
  if (l.url) { window.open(l.url, '_blank'); return; }
  const b = document.getElementById(l.nav);
  if (b) b.click(); else alert('That page isn’t on this login.');
}

// ---------- Studio pace, weekly schedule check, orders: helpers ----------
const DASH_PACE_TIERS = [   // (the same five bands as pace.html)
  { label: 'Closed', bg: '#d32f2f', fg: '#fff' }, { label: 'SOS', bg: '#f57c00', fg: '#fff' }, { label: 'Action plan', bg: '#75fcfd', fg: '#000' },
  { label: 'Planned growth', bg: '#75fc4c', fg: '#000' }, { label: 'All good', bg: '#e0218a', fg: '#fff' }];
function dashPaceTier(v) { if (v == null) return null; return DASH_PACE_TIERS[v > 100 ? 4 : v >= 80 ? 3 : v >= 50 ? 2 : v >= 10 ? 1 : 0]; }
function dashOpenUrl(u) { window.open(u, '_blank'); }
function dashMonday(off) {   // this week's Monday (local), moved by whole weeks
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * (off || 0));
  return localDateStr(d);
}
function dashSchedHtml(b, wk, off, C) {
  const ids = Object.keys(STUDIO_NAMES), done = ids.filter(id => C[id]).length;
  const end = new Date(wk + 'T12:00:00'); end.setDate(end.getDate() + 6);
  const f = d => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  const label = (off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : '') + ` · ${f(new Date(wk + 'T12:00:00'))} – ${f(end)}`;
  const list = ids.filter(id => b.opts.show !== 'todo' || !C[id]);
  return `<div class="dash-wk"><button class="ho-btn sm" onclick="dashSchedWeek('${b.id}',-1)" title="Week before">◀</button><b>${esc(label)}</b><button class="ho-btn sm" onclick="dashSchedWeek('${b.id}',1)" title="Week after">▶</button>
      ${off ? `<button class="ho-btn sm" onclick="dashSchedWeek('${b.id}',0)">This week</button>` : ''}</div>
    <div class="dash-prog"><i><em style="width:${Math.round(done / ids.length * 100)}%"></em></i><span><b>${done} of ${ids.length}</b> studios checked</span></div>` +
    (list.length ? '<div class="dash-list">' + list.map(id => { const c = C[id];
      return `<label class="dash-check${c ? ' on' : ''}"><input type="checkbox" ${c ? 'checked' : ''} onchange="dashSchedTick('${b.id}','${wk}','${id}',this.checked)">
        <span class="dash-main">${esc(dashStudio(id))}</span>
        <span class="dash-sub">${c ? '✓ ' + esc(c.by || 'Someone') + ' · ' + esc(dashWhen(c.at)) : 'Not checked yet'}</span>
        <a href="day-board.html?view=week&studio=${encodeURIComponent(id)}&date=${wk}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open this studio's week board">📅</a></label>`; }).join('') + '</div>'
      : '<div class="dash-empty">Every studio is checked for this week. ✓</div>');
}
function dashWhen(t) { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-CA', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?m\.?/i, (m, x) => x.toLowerCase() + 'm'); }
function dashSchedWeek(id, step) { _dash.week = _dash.week || {}; _dash.week[id] = step === 0 ? 0 : (_dash.week[id] || 0) + step; dashLoadBlock(id, true); }
async function dashSchedTick(id, wk, studio, on) {
  const b = _dash.layout.blocks[dashIdx(id)]; if (!b) return;
  try {
    const d = await dashRpc('hub_sched_check_set', { p_week: wk, p_studio: studio, p_on: !!on }), C = {};
    (d.checks || []).forEach(c => { C[c.studio_id] = c; });
    const off = (_dash.week && _dash.week[id]) || 0, html = dashSchedHtml(b, wk, off, C);
    _dash.cache[id] = html; const el = document.getElementById('dash-body-' + id); if (el) el.innerHTML = html;
  } catch (e) { alert('Couldn’t save that tick: ' + (e.message || e)); dashLoadBlock(id, true); }
}
async function dashOrderAck(id, i) {
  const o = ((_dash.orders || {})[id] || [])[i]; if (!o) return;
  const row = document.getElementById('dash-o-' + id + '-' + i); if (row) row.classList.add('gone');
  try { await dashRpc('hub_dash_order_ack', { p_orders: [{ source: o.source, ref: o.ref }] }); }
  catch (e) { if (row) row.classList.remove('gone'); alert('Couldn’t mark that one: ' + (e.message || e)); return; }
  setTimeout(() => dashLoadBlock(id, false), 250);
}
async function dashOrdersAckAll(id) {
  const O = (_dash.orders || {})[id] || []; if (!O.length) return;
  if (O.length > 5 && !confirm('Mark all ' + O.length + ' orders shown as seen?')) return;
  document.querySelectorAll('[id^="dash-o-' + id + '-"]').forEach(r => r.classList.add('gone'));
  try { await dashRpc('hub_dash_order_ack', { p_orders: O.map(o => ({ source: o.source, ref: o.ref })) }); }
  catch (e) { alert('Couldn’t mark them: ' + (e.message || e)); }
  dashLoadBlock(id, false);
}

// ---------- Role starter layouts (blocks not in the library yet, or not allowed, are skipped) ----------
const DASH_STARTERS = [
  { key: 'owner', name: 'Owner', blocks: [['for_you', 'm'], ['sales_pace', 'm'], ['orders', 'm'], ['sched_check', 'm'], ['month_glance', 'm'], ['fill_rates', 'm'], ['open_close', 's'], ['sick_calls', 's'], ['concerns', 's'], ['unpaid_invoices', 's'], ['activity', 'm'], ['quick_links', 'm']] },
  { key: 'home_office_ops', name: 'Home office ops', blocks: [['for_you', 'm'], ['orders', 'm'], ['open_close', 'm'], ['class_problems', 'm'], ['sick_calls', 's'], ['swaps', 's'], ['field_trips', 's'], ['buyouts', 's'], ['devices', 's'], ['retail_stock', 's'], ['announcements', 'm']] },
  { key: 'hr', name: 'HR', blocks: [['for_you', 'm'], ['sched_check', 'm'], ['sick_calls', 'm'], ['swaps', 's'], ['time_off', 's'], ['timesheets', 'm'], ['sign_offs', 'm'], ['concerns', 's'], ['missing_pins', 's'], ['staff_news', 'm']] },
  { key: 'registration', name: 'Registration', blocks: [['for_you', 'm'], ['find_family', 'm'], ['find_membership', 's'], ['family_changes', 's'], ['date_suggestions', 's'], ['parties_chase', 's'], ['field_trips', 's'], ['unpaid_invoices', 's'], ['class_problems', 'm'], ['chat_unread', 's']] },
  { key: 'marketing', name: 'Marketing', blocks: [['for_you', 'm'], ['newsletters', 'm'], ['studio_notes', 'm'], ['project_interest', 's'], ['donations', 's'], ['points', 's'], ['sales_pace', 's'], ['fill_rates', 'l']] }
];
function dashAllowed(type) { const t = DASH_BLOCKS[type]; return !!t && dashCan(t.area, t.level); }
function dashStarterBlocks(st) { return st.blocks.filter(([t]) => dashAllowed(t)); }
function dashBestStarter() {
  const roles = (_dash.me && _dash.me.roles) || [];
  const byRole = DASH_STARTERS.find(s => roles.includes(s.key)); if (byRole) return byRole.key;
  let best = DASH_STARTERS[1], score = -1;
  DASH_STARTERS.filter(s => s.key !== 'owner').forEach(s => { const n = dashStarterBlocks(s).length / s.blocks.length; if (n > score) { score = n; best = s; } });
  return best.key;
}
function dashBuild(keys) {
  const out = [], seen = new Set();
  keys.forEach(k => { const st = DASH_STARTERS.find(s => s.key === k); if (!st) return;
    dashStarterBlocks(st).forEach(([type, size]) => { if (seen.has(type)) return; seen.add(type);
      out.push({ id: dashNewId(), type, size, opts: Object.assign({}, DASH_BLOCKS[type].opts || {}) }); }); });
  if (!out.length) ['for_you', 'quick_links'].forEach(type => out.push({ id: dashNewId(), type, size: 'm', opts: Object.assign({}, DASH_BLOCKS[type].opts || {}) }));
  return { v: 1, start: false, starter: keys[0] || '', blocks: out };
}

// ---------- Open, load, save ----------
async function openMyDash() {
  showOnlyPane('mydash-pane'); setActiveNav('nav-mydash');
  dashStyles();
  if (!_dash.me) { dashDraw(); await dashLoadMe(); }
  dashDraw(); dashStartRefresh();
}
const DASH_PERSONAL = ['theme', 'avatar', 'name', 'greet', 'start'];   // (a person's own choices: a starting dashboard never overwrites them)
function dashNormalize(L) {
  if (!L || !Array.isArray(L.blocks)) return null;
  const out = { v: 1, start: !!L.start, starter: L.starter || '', blocks: L.blocks.filter(b => b && DASH_BLOCKS[b.type]).map(b => Object.assign({ id: b.id || dashNewId(), type: b.type, size: ['s', 'm', 'l'].includes(b.size) ? b.size : 'm', opts: Object.assign({}, DASH_BLOCKS[b.type].opts || {}, b.opts || {}) }, dashHeightOk(b.h) ? { h: dashHeightOk(b.h) } : {})) };
  if (L.theme && DASH_THEMES.some(t => t.key === L.theme)) out.theme = L.theme;
  if (L.avatar && typeof L.avatar === 'object' && (L.avatar.key || L.avatar.emoji)) out.avatar = { key: L.avatar.key ? String(L.avatar.key).slice(0, 300) : undefined, emoji: L.avatar.emoji ? String(L.avatar.emoji).slice(0, 16) : undefined };
  if (L.name) out.name = String(L.name).slice(0, 40);
  if (L.greet === false) out.greet = false;
  if (L.note) { out.note = String(L.note).slice(0, 600); if (L.note_by) out.note_by = String(L.note_by).slice(0, 60); }
  return out;
}
function dashFromTemplate(T, keep) {   // a starting dashboard, keeping the person's own colour, picture, name and start choice
  const L = dashNormalize(T); if (!L) return null;
  L.blocks.forEach(b => { b.id = dashNewId(); });
  L.start = false; delete L.avatar; delete L.name; delete L.greet;
  if (keep) DASH_PERSONAL.forEach(k => { if (keep[k] !== undefined && keep[k] !== null && !(k === 'theme' && !keep.theme)) L[k] = keep[k]; });
  return L;
}
async function dashLoadMe() {
  _dash.err = '';
  try {
    _dash.me = await dashRpc('hub_dash_me');
    const L = dashNormalize(_dash.me.layout), T = _dash.me.template;
    if (L) _dash.layout = L;
    else if (T && dashNormalize(T)) { _dash.layout = dashFromTemplate(T, null); dashSaveSoon(); }   // (first visit: the one an owner set up)
    else if (dashIsOwner()) { _dash.layout = dashBuild(['owner']); dashSaveSoon(); }
    else { _dash.layout = null; _dash.choose = true; }
  } catch (e) {
    _dash.me = null;
    _dash.err = /hub_dash_me/.test(e.message || '') ? 'Run My dashboard step 2 SQL in Supabase first.' : (e.message || 'Couldn’t load your dashboard.');
  }
  if (!_dash.sessName) try {   // (the greeting's name, until someone types their own)
    const r = await sb.auth.getSession(), u = r && r.data && r.data.session && r.data.session.user;
    const n = u ? ((u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0]) : '';
    _dash.sessName = n ? n.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).split(' ')[0] : '';
  } catch (e) { }
}
function dashSaveSoon() {
  if (_dash.target) { _dash.dirty = true; _dash.saving = 'Not saved yet'; dashStatus(); return; }   // (set-up mode saves with its own buttons)
  clearTimeout(_dash.saveTimer); _dash.saving = 'Saving…'; dashStatus();
  _dash.saveTimer = setTimeout(dashSaveNow, 800);
}
async function dashSaveNow() {
  if (!_dash.layout || _dash.target) return;
  try { await dashRpc('hub_dash_save', { p_layout: _dash.layout }); _dash.saving = 'Saved ✓'; }
  catch (e) { _dash.saving = 'Not saved: ' + (e.message || 'error'); }
  dashStatus();
  if (_dash.saving === 'Saved ✓') setTimeout(() => { if (_dash.saving === 'Saved ✓') { _dash.saving = ''; dashStatus(); } }, 2500);
}
function dashStatus() { const el = document.getElementById('dash-status'); if (el) { el.textContent = _dash.saving || ''; el.className = 'dash-status' + (/^Not saved/.test(_dash.saving) ? ' bad' : ''); } }

// ---------- Drawing ----------
function dashDraw(noLoad) {   // noLoad: redraw from blocks already loaded, without asking the database again
  const el = document.getElementById('mydash-pane'); if (!el) return;
  dashApplyTheme();
  if (!noLoad) _dash.glance = {};
  const L = _dash.layout, T = _dash.target;
  const btns = `<span id="dash-status" class="dash-status"></span>
    ${L ? `<button class="ho-btn" onclick="dashRefreshAll()" title="Refresh every block">↻</button>
      <button class="ho-btn" onclick="dashPersonalize()" title="${T ? 'Colour' : 'Colour, picture and greeting'}">🎨</button>` : ''}
    ${!T && _dash.me && _dash.me.can_set_up ? '<button class="ho-btn" onclick="dashSetupOpen()" title="Set up someone’s starting dashboard">👥 Set up for…</button>' : ''}
    ${L ? `<button class="ho-btn${_dash.edit ? ' primary' : ''}" onclick="dashToggleEdit()">${_dash.edit ? '✓ Done' : '✏️ Customize'}</button>` : ''}`;
  let head;
  if (T) head = `<div class="ho-head"><div class="pts-page-title" style="margin:0">👥 ${esc(T.name)}’s starting dashboard</div><span class="spacer"></span>${btns}</div>` + dashSetupBar();
  else if (L && L.greet !== false && _dash.me) {
    const nm = dashMyName(), g = typeof heroGreetingHtml === 'function' ? heroGreetingHtml(nm || 'there') : esc((typeof timeOfDayGreeting === 'function' ? timeOfDayGreeting() : 'Hello') + ', ' + (nm || 'there') + '!');
    head = `<div class="dash-hero">${dashAvatarHtml(L, 56)}<div class="dash-hello"><div class="dash-greet">${g}</div>
      <div class="dash-date">${esc(new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }))}<span id="dash-glance"></span></div></div>
      <span class="spacer"></span><div class="dash-hero-btns">${btns}</div></div>`;
  } else head = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🏠 My dashboard</div><span class="spacer"></span>${btns}</div>`;
  if (!T && L && L.note) head += `<div class="dash-note-banner"><span>📌</span><div><b>${esc(L.note_by ? 'A note from ' + L.note_by : 'A note for you')}</b><div>${esc(L.note).replace(/\n/g, '<br>')}</div></div><button class="ho-btn sm" onclick="dashNoteDismiss()" title="Hide this note">✕</button></div>`;
  if (_dash.err) { el.innerHTML = head + `<div class="ho-card"><div class="goal-note">${esc(_dash.err)}</div><button class="ho-btn" onclick="_dash.me=null;openMyDash()">Try again</button></div>`; return; }
  if (!_dash.me) { el.innerHTML = head + '<div class="ho-intro">Loading…</div>'; return; }
  if (_dash.choose || !_dash.layout) { el.innerHTML = head + dashChooserHtml(); return; }
  const bar = _dash.edit ? `<div class="dash-editbar"><button class="ho-btn primary" onclick="dashAddOpen()">+ Add a block</button>
      <button class="ho-btn" onclick="dashReset()">${!T && _dash.me.template ? '↺ Back to my starting dashboard' : '↺ Start again from a role’s layout'}</button>
      ${T ? '' : `<label class="dash-start"><input type="checkbox" ${L.start ? 'checked' : ''} onchange="_dash.layout.start=this.checked;dashSaveSoon()"> Open My dashboard when the Hub starts</label>`}
      <span class="fd-sm">Drag ⠿ to move, or use ◀ ▶. S, M and L change the width; drag a block’s bottom-right corner to change its height. Blocks stack up to fill gaps.</span></div>` : '';
  el.innerHTML = head + bar + `<div class="dash-grid${_dash.edit ? ' editing' : ''}" id="dash-grid"${_dash.edit ? ' ondragover="dashDragOver(event)" ondrop="dashDrop(event)"' : ''}>${L.blocks.map(dashBlockShell).join('')}</div>` +
    (!L.blocks.length ? `<div class="ho-card"><div class="goal-note">No blocks yet.</div><button class="ho-btn primary" onclick="${_dash.edit ? '' : 'dashToggleEdit();'}dashAddOpen()">+ Add a block</button></div>` : '');
  dashStatus(); dashGlanceDraw();
  dashPackStart();
  L.blocks.forEach(b => { if (!noLoad || _dash.cache[b.id] === undefined) dashLoadBlock(b.id, false); });
}
function dashBlockShell(b, i) {
  const t = DASH_BLOCKS[b.type], ed = _dash.edit, n = _dash.layout.blocks.length;
  const sizes = ['s', 'm', 'l'].map(s => `<button class="dash-sz${b.size === s ? ' on' : ''}" onclick="dashSize('${b.id}','${s}')" title="${s === 's' ? 'Small' : s === 'm' ? 'Medium' : 'Full width'}">${s.toUpperCase()}</button>`).join('');
  const tools = ed ? `<div class="dash-tools"><span class="dash-grip" title="Drag to move" draggable="true" ondragstart="dashDragStart(event,'${b.id}')" ondragend="dashDragEnd()">⠿</span>
      <button onclick="dashMove('${b.id}',-1)" ${i === 0 ? 'disabled' : ''} title="Move back">◀</button><button onclick="dashMove('${b.id}',1)" ${i === n - 1 ? 'disabled' : ''} title="Move forward">▶</button>
      ${sizes}${b.h ? `<button class="dash-hauto" onclick="dashHeightAuto('${b.id}')" title="Height: fit to what's in it">↕</button>` : ''}${t.settings ? `<button onclick="dashSettings('${b.id}')" title="Settings">⚙</button>` : ''}<button onclick="dashRemove('${b.id}')" title="Remove">✕</button></div>` : '';
  const acts = !ed ? `${t.open ? `<button class="dash-open" onclick="dashOpen('${escAttr(t.open[0])}'${t.open[1] !== undefined ? `,'${escAttr(t.open[1])}'` : ''})">Open →</button>` : ''}
      <button class="dash-ref" onclick="dashLoadBlock('${b.id}', true)" title="Refresh">↻</button>` : '';
  return `<section class="dash-block sz-${b.size}${b.h ? ' fixed' : ''}" id="dash-${b.id}" data-id="${b.id}"${b.h ? ` style="height:${b.h}px"` : ''} ${ed ? `ondragover="dashDragOver(event,'${b.id}')" ondrop="dashDrop(event)"` : ''}>
    <header><b title="${escAttr(t.name)}">${esc(t.name)}</b><span class="spacer"></span>${ed ? tools : acts}</header>
    <div class="dash-body" id="dash-body-${b.id}">${_dash.cache[b.id] || '<div class="dash-empty">Loading…</div>'}</div></section>`;
}
async function dashLoadBlock(id, fresh) {
  const b = _dash.layout && _dash.layout.blocks.find(x => x.id === id); if (!b) return;
  const t = DASH_BLOCKS[b.type], el = document.getElementById('dash-body-' + id); if (!el) return;
  if (fresh) el.innerHTML = '<div class="dash-empty">Loading…</div>';
  let html;
  try { html = await t.load(b); }
  catch (e) {
    const m = (e && (e.message || e.details)) || String(e);
    html = (e && e.code === '42501') || /permission|not allowed|access|sign in/i.test(m)
      ? '<div class="dash-empty">No access. Ask an owner on the Access page.</div>'
      : `<div class="dash-empty bad">Couldn’t load: ${esc(m)}</div>`;
  }
  _dash.cache[id] = html;
  const el2 = document.getElementById('dash-body-' + id);
  if (el2 && !(b.type === 'sticky_note' && el2.querySelector('textarea:focus'))) el2.innerHTML = html;   // (never wipe a note while it's being typed)
}
function dashRefreshAll() { (_dash.layout ? _dash.layout.blocks : []).forEach(b => { if (b.type !== 'sticky_note') dashLoadBlock(b.id, true); }); }
function dashStartRefresh() {
  clearInterval(_dash.refreshTimer); clearInterval(_dash.pollTimer);
  _dash.pollTimer = setInterval(() => {   // (shared blocks, like the schedule check and new orders, check back more often)
    if (!paneVisible('mydash-pane')) { clearInterval(_dash.pollTimer); return; }
    if (document.hidden || _dash.edit || _dash.drag) return;
    const now = Date.now(); _dash.polled = _dash.polled || {};
    (_dash.layout ? _dash.layout.blocks : []).forEach(b => { const t = DASH_BLOCKS[b.type];
      if (t.poll && now - (_dash.polled[b.id] || 0) >= t.poll) { _dash.polled[b.id] = now; if (!document.querySelector('#dash-body-' + b.id + ' input:focus')) dashLoadBlock(b.id, false); } });
  }, 10000);
  _dash.refreshTimer = setInterval(() => {
    if (!paneVisible('mydash-pane') || document.hidden) { if (!paneVisible('mydash-pane')) clearInterval(_dash.refreshTimer); return; }
    if (!_dash.edit) (_dash.layout ? _dash.layout.blocks : []).forEach(b => { if (b.type !== 'sticky_note') dashLoadBlock(b.id, false); });
  }, DASH_REFRESH_MS);
}

// ---------- First visit: pick a starting layout ----------
function dashChooserHtml() {
  const best = dashBestStarter();
  const who = _dash.target ? esc(_dash.target.name) + '’s' : 'your';
  return `<div class="ho-intro">Pick a layout to start from. It only shows the blocks ${who} access allows, and ${_dash.target ? 'you can still add, remove, move and resize them before saving' : 'you can add, remove, move and resize them afterwards'}.</div>
    <div class="dash-starters">${DASH_STARTERS.map(s => { const B = dashStarterBlocks(s);
      return `<label class="dash-starter${s.key === best ? ' best' : ''}"><input type="radio" name="dash-st" value="${s.key}" ${s.key === best ? 'checked' : ''}>
        <b>${esc(s.name)}</b>${s.key === best ? ` <span class="dash-pill ok">Closest to ${_dash.target ? esc(_dash.target.name) + '’s' : 'your'} access</span>` : ''}
        <div class="dash-sub">${B.length ? B.map(([t]) => esc(DASH_BLOCKS[t].name)).join(' · ') : 'Only For you and Quick links (nothing else matches your access)'}</div></label>`; }).join('')}</div>
    <button class="ho-btn primary" onclick="dashChoose()">Start with this layout</button>`;
}
function dashChoose() {
  const r = document.querySelector('input[name="dash-st"]:checked'); if (!r) return;
  const keep = _dash.keep || _dash.layout; _dash.keep = null;
  _dash.layout = dashBuild([r.value]); _dash.choose = false;
  if (keep) ['theme', 'avatar', 'name', 'greet', 'start', 'note', 'note_by'].forEach(k => { if (keep[k] !== undefined) _dash.layout[k] = keep[k]; });
  if (_dash.target) _dash.edit = true;
  dashSaveSoon(); dashDraw();
}
function dashReset() {
  const T = !_dash.target && _dash.me && _dash.me.template;
  if (T) {   // (back to the starting dashboard an owner set up; their colour, picture and name stay)
    if (!confirm('Go back to your starting dashboard? Your current blocks and their settings will be replaced (your colour and picture stay).')) return;
    _dash.layout = dashFromTemplate(T, _dash.layout); _dash.cache = {}; _dash.edit = false; dashSaveSoon(); dashDraw(); return;
  }
  if (!confirm(_dash.target ? 'Start again from a role’s layout?' : 'Start again from a role’s layout? Your current blocks and their settings will be replaced.')) return;
  _dash.keep = _dash.layout; _dash.choose = true; _dash.edit = false; _dash.cache = {}; dashDraw();
}

// ---------- Customize ----------
function dashToggleEdit() { _dash.edit = !_dash.edit; dashDraw(); }
function dashIdx(id) { return _dash.layout.blocks.findIndex(b => b.id === id); }
function dashMove(id, step) {
  const B = _dash.layout.blocks, i = dashIdx(id), j = i + step; if (i < 0 || j < 0 || j >= B.length) return;
  const [x] = B.splice(i, 1); B.splice(j, 0, x); dashSaveSoon(); dashDraw();
}
function dashSize(id, s) { const b = _dash.layout.blocks[dashIdx(id)]; if (!b || b.size === s) return; b.size = s; dashSaveSoon(); dashDraw(); }
function dashRemove(id) {
  const i = dashIdx(id); if (i < 0) return;
  _dash.layout.blocks.splice(i, 1); delete _dash.cache[id]; dashSaveSoon(); dashDraw();
}
// Dragging: the block being dragged stays in the grid as a faded placeholder, and as it passes over another block it's moved
// in front of or behind it right away, so the others slide out of the way (animated). Letting go just saves the new order.
function dashDragStart(e, id) {
  _dash.drag = id; _dash.dragMoved = false; _dash.dragWait = 0;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); } catch (x) { }
  const bl = e.currentTarget.closest('.dash-block');
  if (bl) { try { e.dataTransfer.setDragImage(bl, 20, 20); } catch (x) { } setTimeout(() => bl.classList.add('dragging'), 0); }   // (after the drag picture is taken)
}
function dashDragOver(e, target) {
  if (!_dash.drag) return;
  e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) { }
  if (!target || target === _dash.drag || Date.now() < _dash.dragWait) return;
  const tEl = document.getElementById('dash-' + target), dEl = document.getElementById('dash-' + _dash.drag); if (!tEl || !dEl) return;
  const r = tEl.getBoundingClientRect();
  const after = (r.width > r.height * 1.4) ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;   // (wide blocks: left/right half; tall ones: top/bottom half)
  const B = _dash.layout.blocks, from = dashIdx(_dash.drag);
  const x = B.splice(from, 1)[0]; let to = dashIdx(target) + (after ? 1 : 0);
  B.splice(to, 0, x);
  if (B.indexOf(x) === from) return;   // (already there)
  _dash.dragMoved = true; _dash.dragWait = Date.now() + 160;   // (a short pause so blocks sliding under the pointer don't bounce back)
  dashFlip(() => { const g = document.getElementById('dash-grid'); g.insertBefore(dEl, after ? tEl.nextSibling : tEl); });
}
function dashFlip(change) {   // move blocks, then animate each from where it was to where it is now
  const els = Array.from(document.querySelectorAll('#dash-grid .dash-block')), first = new Map(els.map(el => [el, el.getBoundingClientRect()]));
  change();
  els.forEach(el => {
    const a = first.get(el), b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    el.style.transition = 'none'; el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect();   // (apply before animating back)
    el.style.transition = 'transform 180ms ease'; el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; }, 200);
  });
}
function dashDrop(e) { e.preventDefault(); }
function dashDragEnd() {
  const moved = _dash.drag && _dash.dragMoved; _dash.drag = null; _dash.dragMoved = false;
  document.querySelectorAll('.dash-block.dragging').forEach(x => x.classList.remove('dragging'));
  if (moved) { dashSaveSoon(); dashDraw(true); }   // (redraw from what's already loaded, to refresh the ◀ ▶ buttons)
}
function dashAddOpen() {
  const have = new Set(_dash.layout.blocks.map(b => b.type));
  const html = `<h3 style="margin:0 0 4px">+ Add a block</h3><p class="fd-sm" style="margin:0 0 10px">Only blocks your access allows are listed.</p>` +
    DASH_GROUPS.map(g => { const T = Object.keys(DASH_BLOCKS).filter(k => DASH_BLOCKS[k].group === g && dashAllowed(k)); if (!T.length) return '';
      return `<div class="dash-addgrp"><b>${esc(g)}</b>${T.map(k => `<div class="dash-addrow"><div><div>${esc(DASH_BLOCKS[k].name)}${have.has(k) ? ' <span class="dash-pill">on your page</span>' : ''}</div><div class="dash-sub">${esc(DASH_BLOCKS[k].desc || '')}</div></div>
        <button class="ho-btn sm${have.has(k) ? '' : ' primary'}" onclick="dashAdd('${k}')">${have.has(k) ? 'Add another' : 'Add'}</button></div>`).join('')}</div>`; }).join('') +
    '<div style="text-align:right;margin-top:10px"><button class="ho-btn" onclick="closeDutySheet()">Close</button></div>';
  openDutySheet(html);
}
function dashAdd(type) {
  if (!dashAllowed(type)) return;
  if (_dash.layout.blocks.length >= DASH_MAX_BLOCKS) { alert('That’s the most blocks one page can hold (' + DASH_MAX_BLOCKS + ').'); return; }
  const t = DASH_BLOCKS[type];
  _dash.layout.blocks.push({ id: dashNewId(), type, size: t.size || 'm', opts: Object.assign({}, t.opts || {}) });
  closeDutySheet(); dashSaveSoon(); dashDraw();
  const last = _dash.layout.blocks[_dash.layout.blocks.length - 1], el = document.getElementById('dash-' + last.id);
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function dashSettings(id) {
  const b = _dash.layout.blocks[dashIdx(id)]; if (!b) return; const t = DASH_BLOCKS[b.type];
  openDutySheet(`<h3 style="margin:0 0 10px">⚙ ${esc(t.name)}</h3><div class="dash-set" id="dash-set">${t.settings(b)}</div>
    <div style="text-align:right;margin-top:12px"><button class="ho-btn" onclick="closeDutySheet()">Cancel</button> <button class="ho-btn primary" onclick="dashSettingsSave('${b.id}')">Save</button></div>`);
}
function dashSettingsSave(id) {
  const b = _dash.layout.blocks[dashIdx(id)], box = document.getElementById('dash-set'); if (!b || !box) return;
  box.querySelectorAll('[data-opt]').forEach(x => { b.opts[x.getAttribute('data-opt')] = x.value; });
  const ticks = box.querySelectorAll('[data-link]');
  if (ticks.length) b.opts.links = Array.from(ticks).filter(x => x.checked).map(x => x.getAttribute('data-link'));
  closeDutySheet(); delete _dash.cache[id]; dashSaveSoon(); dashDraw();
}
function dashNoteInput(id, text) {
  const b = _dash.layout.blocks[dashIdx(id)]; if (!b) return;
  b.opts.text = String(text).slice(0, 2000); _dash.cache[id] = DASH_BLOCKS.sticky_note.load(b); dashSaveSoon();
}

// ---------- Heights and stacking ----------
// Each block spans as many 4px grid rows as its height needs, and the grid fills gaps (dense), so short blocks slide up
// under shorter neighbours. In Customize, a block's own resize corner sets its height; it's saved as b.h (pixels).
function dashHeightOk(h) { const n = Math.round(+h / 10) * 10; return n >= DASH_HMIN && n <= DASH_HMAX ? n : 0; }
function dashSpan(el) {
  const h = el.getBoundingClientRect().height;
  el.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((h + DASH_GAP) / DASH_ROW));
}
function dashPackStart() {
  if (_dash.ro) _dash.ro.disconnect();
  const els = document.querySelectorAll('#dash-grid .dash-block');
  els.forEach(dashSpan);
  if (typeof ResizeObserver !== 'function') return;
  _dash.ro = new ResizeObserver(entries => entries.forEach(en => {
    const el = en.target; dashSpan(el);
    if (!_dash.edit || !el.style.height) return;   // (only a drag of the corner, in Customize, changes the saved height)
    const b = _dash.layout && _dash.layout.blocks.find(x => x.id === el.getAttribute('data-id')); if (!b) return;
    const h = dashHeightOk(parseFloat(el.style.height)) || (parseFloat(el.style.height) < DASH_HMIN ? DASH_HMIN : DASH_HMAX);
    if (h !== b.h) { b.h = h; el.classList.add('fixed'); dashSaveSoon(); dashHeightBtn(b); }
  }));
  els.forEach(el => _dash.ro.observe(el));
}
function dashHeightBtn(b) {   // (show ↕ Auto once a block has a height, without redrawing mid-drag)
  const t = document.querySelector('#dash-' + b.id + ' .dash-tools');
  if (t && !t.querySelector('.dash-hauto')) { const x = document.createElement('button'); x.className = 'dash-hauto'; x.textContent = '↕'; x.title = 'Height: fit to what’s in it'; x.onclick = () => dashHeightAuto(b.id); t.insertBefore(x, t.querySelector('[title="Settings"], [title="Remove"]')); }
}
function dashHeightAuto(id) { const b = _dash.layout.blocks[dashIdx(id)]; if (!b) return; delete b.h; dashSaveSoon(); dashDraw(); }

// ---------- 📋 For you: its buttons come from today.js and refresh only the Today screen's card ----------
// So: after any decision (they all finish with myNotesLoad), refresh For you blocks here too; and a "Why?" note typed on the
// dashboard is saved first (the Today screen has a box with the same id, which would otherwise be the one read).
function dashReloadType(type) { if (_dash.layout && paneVisible('mydash-pane')) _dash.layout.blocks.filter(b => b.type === type).forEach(b => dashLoadBlock(b.id, false)); }
(function dashHookInbox() {
  if (typeof myNotesLoad === 'function' && !myNotesLoad._dash) {
    const load = myNotesLoad;
    window.myNotesLoad = function () { const r = load.apply(this, arguments); try { dashReloadType('for_you'); } catch (e) { } return r; };
    window.myNotesLoad._dash = true;
  }
  if (typeof inboxDecide === 'function' && !inboxDecide._dash) {
    const decide = inboxDecide;
    window.inboxDecide = async function (id) {
      const mine = document.querySelector('#mydash-pane [id="why-' + id + '"]');
      if (mine && paneVisible('mydash-pane')) {
        const row = mine.closest('.inbox-row'); if (row) row.style.opacity = '.45';   // (feedback straight away)
        if (mine.value.trim()) { try { await sb.rpc('hub_inbox_note', { p_id: id, p_note: mine.value.trim() }); } catch (e) { } mine.value = ''; }
      }
      return decide.apply(this, arguments);
    };
    window.inboxDecide._dash = true;
  }
})();

// ---------- Personal header: name, picture, today at a glance ----------
function dashMyName() { return (_dash.layout && _dash.layout.name) || _dash.sessName || ''; }
function dashAvatarHtml(L, size) {
  const A = L && L.avatar, nm = dashMyName() || '?';
  if (A && A.key && typeof hubAvatarHtml === 'function') return hubAvatarHtml({ name: nm, avatar_key: A.key, staff_id: nm }, size);
  if (A && A.emoji) return `<span class="dash-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px">${esc(A.emoji)}</span>`;
  return typeof hubAvatarHtml === 'function' ? hubAvatarHtml({ name: nm, staff_id: nm }, size) : `<span class="dash-av" style="width:${size}px;height:${size}px">${esc(nm.charAt(0).toUpperCase())}</span>`;
}
function dashGlanceSet(b, txt) { if (!b || !b.id) return; (_dash.glance = _dash.glance || {})[b.id] = txt || ''; dashGlanceDraw(); }
function dashGlanceDraw() {
  const el = document.getElementById('dash-glance'); if (!el || !_dash.layout) return;
  const parts = _dash.layout.blocks.map(b => (_dash.glance || {})[b.id]).filter(Boolean);
  el.textContent = parts.length ? ' · ' + parts.join(' · ') : '';
}
function dashNoteDismiss() { if (!_dash.layout) return; delete _dash.layout.note; delete _dash.layout.note_by; dashSaveSoon(); dashDraw(true); }

// ---------- 🎨 Colours (the dashboard page only) ----------
const DASH_THEMES = [
  { key: 'classic', name: '4Cats classic', mood: 'The Hub’s own colours' },
  { key: 'buttercup', name: 'Buttercup', mood: 'Warm, happy, sunny', bg: '#fff8e1', card: '#ffffff', accent: '#d6a02a', soft: '#fbefc7', ink: '#2d2a22', inkSoft: '#7a7365', border: '#f1e6c4', on: '#fff' },
  { key: 'sage', name: 'Sage Studio', mood: 'Calm, natural, organized', bg: '#eef3ec', card: '#ffffff', accent: '#6b8e6e', soft: '#dce8dc', ink: '#253027', inkSoft: '#6b7a6c', border: '#dde6dc', on: '#fff' },
  { key: 'blush', name: 'Blush', mood: 'Soft, playful, welcoming', bg: '#fdf0f2', card: '#ffffff', accent: '#d9768f', soft: '#f9dbe2', ink: '#33252a', inkSoft: '#85707a', border: '#f3dde3', on: '#fff' },
  { key: 'lavender', name: 'Lavender Haze', mood: 'Dreamy, gentle, modern', bg: '#f4f0fb', card: '#ffffff', accent: '#9a7fd4', soft: '#e6ddf6', ink: '#2b2540', inkSoft: '#776f8c', border: '#e7e0f3', on: '#fff' },
  { key: 'sky', name: 'Sky Blue', mood: 'Fresh, clear, airy', bg: '#ecf5fc', card: '#ffffff', accent: '#4b8dc4', soft: '#d8e9f6', ink: '#1f2d3a', inkSoft: '#687888', border: '#d9e7f2', on: '#fff' },
  { key: 'peachy', name: 'Peachy', mood: 'Warm, cheerful, friendly', bg: '#fff2eb', card: '#ffffff', accent: '#e2875e', soft: '#fcdccb', ink: '#35261f', inkSoft: '#85706a', border: '#f6e0d4', on: '#fff' },
  { key: 'mint', name: 'Mint Condition', mood: 'Fresh, bright, clean', bg: '#eaf7f1', card: '#ffffff', accent: '#379a77', soft: '#d3eee2', ink: '#1e3129', inkSoft: '#64786f', border: '#d6ebe1', on: '#fff' },
  { key: 'oat', name: 'Oat Milk', mood: 'Neutral, minimal, timeless', bg: '#f5f0e7', card: '#ffffff', accent: '#9a8166', soft: '#e9dfcf', ink: '#2f2a23', inkSoft: '#7d7468', border: '#e6ddcf', on: '#fff' },
  { key: 'rosewood', name: 'Rosewood', mood: 'Rich, warm, sophisticated', bg: '#f8edee', card: '#ffffff', accent: '#a4515f', soft: '#eed5d9', ink: '#331f23', inkSoft: '#83686d', border: '#ecd9dc', on: '#fff' },
  { key: 'midnight', name: 'Midnight', mood: 'Deep navy, professional', dark: 1, bg: '#111a2e', card: '#1a2640', accent: '#8ab4f8', soft: '#24365a', ink: '#e7edf8', inkSoft: '#9babc6', border: '#2a3b5e', on: '#0f1a2e' },
  { key: 'charcoal', name: 'Charcoal', mood: 'Sleek, modern, focused', dark: 1, bg: '#1b1b1d', card: '#29292c', accent: '#e3b55a', soft: '#3a352a', ink: '#eeeeee', inkSoft: '#a3a3a8', border: '#3b3b40', on: '#1b1b1d' },
  { key: 'plum', name: 'Plum Night', mood: 'Moody, colourful, creative', dark: 1, bg: '#1e1829', card: '#2b2340', accent: '#c7a2f2', soft: '#3b2f58', ink: '#f0eaf9', inkSoft: '#a99bc2', border: '#3e335a', on: '#1e1829' }
];
function dashApplyTheme() {
  const el = document.getElementById('mydash-pane'); if (!el) return;
  const t = DASH_THEMES.find(x => x.key === (_dash.layout && _dash.layout.theme)) || DASH_THEMES[0];
  ['--dash-bg', '--card-bg', '--accent', '--accent-soft', '--ink', '--ink-soft', '--border', '--dash-on'].forEach(v => el.style.removeProperty(v));
  el.classList.toggle('themed', !!t.bg); el.classList.toggle('dark', !!t.dark);
  if (!t.bg) return;
  [['--dash-bg', t.bg], ['--card-bg', t.card], ['--accent', t.accent], ['--accent-soft', t.soft], ['--ink', t.ink], ['--ink-soft', t.inkSoft], ['--border', t.border], ['--dash-on', t.on]].forEach(([k, v]) => el.style.setProperty(k, v));
}
function dashThemeSwatch(t, on) {
  const bg = t.bg || '#f5f4fb', card = t.card || '#ffffff', acc = t.accent || 'var(--accent)', line = t.border || '#eceaf6';
  return `<button class="dash-sw${on ? ' on' : ''}" onclick="dashSetTheme('${t.key}')"><span class="dash-sw-pic" style="background:${bg}"><i style="background:${acc}"></i><i style="background:${card};border-color:${line}"></i><b style="background:${card};border-color:${line}"></b><b style="background:${card};border-color:${line}"></b></span>
    <span class="dash-sw-name">${esc(t.name)}${on ? ' ✓' : ''}</span><span class="dash-sw-mood">${esc(t.mood)}</span></button>`;
}
async function dashPersonalize() {
  if (!_dash.layout) return;
  const L = _dash.layout, cur = L.theme || 'classic', T = _dash.target;
  let h = `<h3 style="margin:0 0 4px">🎨 ${T ? esc(T.name) + '’s colour' : 'Make it yours'}</h3><p class="fd-sm" style="margin:0 0 10px">${T ? 'The colour their dashboard starts with. They can change it any time.' : 'Only My dashboard changes colour; the rest of the Hub stays the same.'}</p>
    <div class="dash-sws">${DASH_THEMES.map(t => dashThemeSwatch(t, t.key === cur)).join('')}</div>`;
  if (!T) {
    h += `<h4 class="dash-sh">Your picture</h4><div class="dash-avs" id="dash-avs">${dashAvatarChoicesHtml()}</div>
      <h4 class="dash-sh">Greeting</h4><label class="dash-set-row">What should it call you? <input type="text" maxlength="40" value="${escAttr(L.name || '')}" placeholder="${escAttr(_dash.sessName || 'Your name')}" onchange="dashSetName(this.value)"></label>
      <label class="dash-set-row"><input type="checkbox" ${L.greet !== false ? 'checked' : ''} onchange="dashSetGreet(this.checked)"> Show the greeting and “today at a glance” at the top</label>`;
  }
  h += '<div style="text-align:right;margin-top:12px"><button class="ho-btn primary" onclick="closeDutySheet()">Done</button></div>';
  openDutySheet(h);
  if (!T && !_dash.avatars) { _dash.avatars = await dashAvatarList(); const box = document.getElementById('dash-avs'); if (box) box.innerHTML = dashAvatarChoicesHtml(); }
}
function dashSetTheme(k) {
  if (!_dash.layout) return;
  if (k === 'classic') delete _dash.layout.theme; else _dash.layout.theme = k;
  dashApplyTheme(); dashSaveSoon();
  const box = document.querySelector('.dash-sws'); if (box) box.innerHTML = DASH_THEMES.map(t => dashThemeSwatch(t, t.key === (_dash.layout.theme || 'classic'))).join('');
}
function dashSetName(v) { v = String(v || '').trim().slice(0, 40); if (v) _dash.layout.name = v; else delete _dash.layout.name; dashSaveSoon(); dashDraw(true); }
function dashSetGreet(on) { if (on) delete _dash.layout.greet; else _dash.layout.greet = false; dashSaveSoon(); dashDraw(true); }
const DASH_EMOJI = ['🐱', '🦊', '🐻', '🐼', '🐨', '🦉', '🐸', '🐝', '🦋', '🌻', '🌈', '🎨', '🖌️', '🏺', '☕', '🌿', '⭐', '🍩'];
async function dashAvatarList() {   // the staff avatar library (as on personal profiles), if this login can see it
  try {
    const st = sb.storage.from(typeof AVATAR_BUCKET !== 'undefined' ? AVATAR_BUCKET : 'staff-avatars'), out = [];
    const top = await st.list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });
    if (top.error || !top.data) return [];
    const files = top.data.filter(f => f.id), folders = top.data.filter(f => !f.id).slice(0, 12);
    files.forEach(f => out.push(f.name));
    for (const fo of folders) { const r = await st.list(fo.name, { limit: 100 }); (r.data || []).filter(f => f.id).forEach(f => out.push(fo.name + '/' + f.name)); if (out.length > 300) break; }
    return out.filter(k => /\.(png|jpe?g|webp|gif|svg)$/i.test(k));
  } catch (e) { return []; }
}
function dashAvatarChoicesHtml() {
  const A = (_dash.layout && _dash.layout.avatar) || {}, url = k => `${SUPABASE_URL}/storage/v1/object/public/${typeof AVATAR_BUCKET !== 'undefined' ? AVATAR_BUCKET : 'staff-avatars'}/${String(k).split('/').map(encodeURIComponent).join('/')}`;
  const pics = _dash.avatars === undefined ? '<span class="fd-sm">Loading pictures…</span>' : (_dash.avatars || []).map(k => `<button class="dash-avc${A.key === k ? ' on' : ''}" onclick="dashSetAvatar('key', ${escAttr(JSON.stringify(k))})"><img loading="lazy" src="${escAttr(url(k))}" alt=""></button>`).join('');
  return pics + DASH_EMOJI.map(e => `<button class="dash-avc emo${A.emoji === e ? ' on' : ''}" onclick="dashSetAvatar('emoji', '${e}')">${e}</button>`).join('') +
    `<button class="dash-avc emo${!A.key && !A.emoji ? ' on' : ''}" onclick="dashSetAvatar('', '')" title="Just my first letter">${esc((dashMyName() || '?').charAt(0).toUpperCase())}</button>`;
}
function dashSetAvatar(kind, v) {
  if (!kind) delete _dash.layout.avatar; else _dash.layout.avatar = kind === 'key' ? { key: v } : { emoji: v };
  dashSaveSoon(); const box = document.getElementById('dash-avs'); if (box) box.innerHTML = dashAvatarChoicesHtml(); dashDraw(true);
}

// ---------- 👥 Set up for… (owners): a person's starting dashboard ----------
// The grid shows the owner's own numbers (data always loads as whoever is signed in); the block library and starting layouts
// follow the person's access. Nothing saves until "Save"; ✏️ Customize works the same as on your own.
async function dashSetupOpen() {
  openDutySheet('<h3 style="margin:0 0 8px">👥 Set up a starting dashboard</h3><p class="fd-sm">Loading…</p>');
  let P;
  try { P = (await dashRpc('hub_dash_people')) || []; }
  catch (e) { openDutySheet(`<h3 style="margin:0 0 8px">👥 Set up a starting dashboard</h3><p class="fd-msg">${esc(/hub_dash_people/.test(e.message || '') ? 'Run My dashboard step 4 SQL in Supabase first.' : e.message)}</p><div style="text-align:right"><button class="ho-btn" onclick="closeDutySheet()">Close</button></div>`); return; }
  _dash.people = P;
  const when = t => t ? new Date(t).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
  openDutySheet(`<h3 style="margin:0 0 4px">👥 Set up a starting dashboard</h3>
    <p class="fd-sm" style="margin:0 0 10px">Pick someone to arrange their blocks and colour. They can change it afterwards, and ↺ always takes them back to the one you set.</p>
    ${P.map((x, i) => `<div class="dash-addrow"><div><div><b>${esc(x.name || x.email)}</b>${x.me ? ' <span class="dash-pill">you</span>' : ''} <span class="fd-sm">${esc(x.email || '')}</span></div>
      <div class="dash-sub">${x.template_at ? `Starting dashboard set${x.template_by ? ' by ' + esc(x.template_by) : ''} ${esc(when(x.template_at))}` : 'No starting dashboard yet'}${x.arranged_at ? ` · arranged their own ${esc(when(x.arranged_at))}` : ' · hasn’t opened My dashboard yet'}</div></div>
      <button class="ho-btn sm primary" onclick="dashSetupStart(${i})">${x.template_at ? 'Edit' : 'Set up'}</button></div>`).join('') || '<p class="fd-sm">No home office logins found.</p>'}
    <div style="text-align:right;margin-top:10px"><button class="ho-btn" onclick="closeDutySheet()">Close</button></div>`);
}
async function dashSetupStart(i) {
  const x = (_dash.people || [])[i]; if (!x) return;
  let R; try { R = await dashRpc('hub_dash_for', { p_user: x.user_id }); } catch (e) { alert(e.message || e); return; }
  closeDutySheet();
  _dash.own = { me: _dash.me, layout: _dash.layout, cache: _dash.cache, edit: _dash.edit, choose: _dash.choose };
  _dash.target = { user_id: x.user_id, name: R.name || x.name || x.email, had: !!R.template };
  _dash.me = { areas: R.areas || {}, roles: R.roles || [], actions: {} };
  const L = dashNormalize(R.template) || (R.layout ? dashFromTemplate(R.layout, null) : null);
  if (L && R.layout && !R.template && R.layout.theme) L.theme = R.layout.theme;
  _dash.layout = L; _dash.choose = !L; _dash.cache = {}; _dash.edit = !!L; _dash.dirty = false; _dash.saving = '';
  dashDraw();
}
function dashSetupBar() {
  const T = _dash.target, L = _dash.layout;
  return `<div class="dash-setup"><div><b>You’re arranging ${esc(T.name)}’s starting dashboard.</b> The blocks show your numbers while you arrange them; the blocks you can add follow ${esc(T.name)}’s access.
      ${T.had ? '' : ` ${esc(T.name)} gets this the first time they open My dashboard.`} They can change it afterwards, and ↺ takes them back to this one.</div>
    ${L ? `<label class="dash-set-row" style="display:block;margin-top:8px">A welcome note for ${esc(T.name)} (optional; shows at the top of their dashboard until they close it)
      <textarea class="dash-setup-note" maxlength="600" oninput="_dash.layout.note=this.value;_dash.dirty=true">${esc(L.note || '')}</textarea></label>
    <div class="dash-setup-btns"><button class="ho-btn primary" onclick="dashSetupSave(false)">💾 Save as ${esc(T.name)}’s starting dashboard</button>
      <button class="ho-btn" onclick="dashSetupSave(true)" title="Also replaces what they've arranged so far (their colour, picture and name stay)">Save and replace theirs now</button>
      ${T.had ? `<button class="ho-btn danger" onclick="dashSetupDelete()">Remove their starting dashboard</button>` : ''}
      <span class="spacer"></span><button class="ho-btn" onclick="dashSetupClose()">Close</button></div>` : `<div class="dash-setup-btns"><span class="spacer"></span><button class="ho-btn" onclick="dashSetupClose()">Close</button></div>`}</div>`;
}
async function dashSetupSave(replace) {
  const T = _dash.target, L = _dash.layout; if (!T || !L) return;
  if (replace && !confirm('Replace what ' + T.name + ' has arranged with this now? Their colour, picture and name stay.')) return;
  const out = JSON.parse(JSON.stringify(L)); delete out.avatar; delete out.name; delete out.greet; delete out.start;
  if (out.note && out.note.trim()) out.note_by = (_dash.own && _dash.own.layout && _dash.own.layout.name) || _dash.sessName || ''; else { delete out.note; delete out.note_by; }
  try { await dashRpc('hub_dash_template_save', { p_user: T.user_id, p_layout: out, p_replace: !!replace }); }
  catch (e) { alert('Couldn’t save: ' + (e.message || e)); return; }
  T.had = true; _dash.dirty = false; _dash.saving = replace ? 'Saved, and replaced theirs ✓' : 'Saved as their starting dashboard ✓'; dashDraw(true);
}
async function dashSetupDelete() {
  const T = _dash.target; if (!T || !confirm('Remove ' + T.name + '’s starting dashboard? What they’ve arranged stays; ↺ will offer the role layouts again.')) return;
  try { await dashRpc('hub_dash_template_delete', { p_user: T.user_id }); } catch (e) { alert(e.message || e); return; }
  T.had = false; _dash.saving = 'Starting dashboard removed'; dashDraw(true);
}
function dashSetupClose() {
  if (_dash.dirty && !confirm('Close without saving ' + _dash.target.name + '’s dashboard?')) return;
  const o = _dash.own || {}; _dash.target = null; _dash.own = null; _dash.dirty = false; _dash.saving = '';
  _dash.me = o.me; _dash.layout = o.layout; _dash.cache = o.cache || {}; _dash.edit = false; _dash.choose = !!o.choose;
  dashDraw();
}

// ---------- Open on start (called by hub.html once the Hub has started) ----------
async function dashStartup(data) {
  if (!data || !data.isAdmin) return;
  for (let i = 0; i < 50 && typeof _hubRestoring !== 'undefined' && _hubRestoring; i++) await new Promise(r => setTimeout(r, 100));   // (after "back to last time's spot")
  try { if (!_dash.me) await dashLoadMe(); } catch (e) { return; }
  if (_dash.layout && _dash.layout.start) openMyDash();
}

// ---------- Styles (kept with the page so hub.html only gains the pane and button) ----------
function dashStyles() {
  if (document.getElementById('dash-css')) return;
  const s = document.createElement('style'); s.id = 'dash-css';
  s.textContent = `
.dash-status { font-size: 13px; color: var(--ink-soft); } .dash-status.bad { color: var(--red); font-weight: 700; }
.dash-editbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--accent-soft); border-radius: 14px; padding: 10px 12px; margin: 8px 0 12px; }
.dash-start { font-size: 13px; display: flex; align-items: center; gap: 6px; }
.dash-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 4px; grid-auto-flow: row dense; gap: 0 12px; align-items: start; margin-top: 8px; }
.dash-block { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 12px 14px; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; margin-bottom: 12px; }
.dash-block.fixed .dash-body { flex: 1 1 auto; min-height: 0; max-height: none; }
.dash-block.sz-s { grid-column: span 1; } .dash-block.sz-m { grid-column: span 2; } .dash-block.sz-l { grid-column: 1 / -1; }
.dash-block header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; height: 28px; flex: none; min-width: 0; }
.dash-block header b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.dash-block .spacer { flex: 1; }
.dash-open, .dash-ref { border: 0; background: none; color: var(--accent); font-weight: 700; font-size: 13px; cursor: pointer; padding: 2px 4px; white-space: nowrap; flex: none; }
.dash-ref { color: var(--ink-soft); }
.dash-body { max-height: 420px; overflow-y: auto; font-size: 13.5px; }
.dash-grid.editing .dash-block { outline: 2px dashed var(--accent-soft); resize: vertical; overflow: hidden; max-height: 1000px; } .dash-block.dragging { opacity: .4; outline: 2px dashed var(--accent) !important; box-shadow: none; }
.dash-tools { display: flex; flex-wrap: nowrap; gap: 3px; align-items: center; flex: none; }   /* (in the header, so Customize never changes a block's height) */
.dash-tools button { border: 1px solid var(--border); background: var(--card-bg); color: var(--ink); border-radius: 7px; min-width: 24px; height: 24px; padding: 0 4px; font-size: 11px; cursor: pointer; }
.dash-tools button:disabled { opacity: .35; cursor: default; } .dash-tools .dash-sz.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.dash-grip { cursor: grab; font-size: 18px; line-height: 24px; color: var(--ink-soft); padding: 0 2px; }
.dash-empty { color: var(--ink-soft); padding: 4px 0; } .dash-empty.bad { color: var(--red); }
.dash-list { display: flex; flex-direction: column; gap: 6px; }
.dash-row { border-left: 3px solid var(--border); padding: 2px 0 2px 8px; } .dash-row.late { border-left-color: var(--red); }
.dash-main { font-weight: 600; } .dash-sub { color: var(--ink-soft); font-size: 12.5px; margin-top: 2px; }
.dash-more { color: var(--ink-soft); font-size: 12.5px; margin-top: 6px; }
.dash-big { margin-bottom: 6px; } .dash-big b { font-size: 26px; } .dash-big span { color: var(--ink-soft); }
.dash-big b.warn, .dash-stats b.bad { color: var(--red); } .dash-big b.ok, .dash-stats b.ok { color: var(--green); }
.dash-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.dash-pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; background: var(--border); color: var(--ink); }
.dash-pill.bad { background: var(--red-bg); color: var(--red); } .dash-pill.mid { background: var(--amber-bg); color: var(--amber); } .dash-pill.ok { background: var(--green-bg); color: var(--green); }
.dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; } .dash-stats div { text-align: center; font-size: 12px; color: var(--ink-soft); }
.dash-stats b { display: block; font-size: 22px; color: var(--ink); }
.dash-bars { display: flex; flex-direction: column; gap: 5px; }
.dash-bar { display: grid; grid-template-columns: minmax(90px, 40%) 1fr 44px; gap: 8px; align-items: center; font-size: 12.5px; }
.dash-bar span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dash-bar b { text-align: right; }
.dash-bar i { display: block; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; } .dash-bar em { display: block; height: 100%; background: var(--accent); } .dash-bar em.ok { background: var(--green); }
.dash-links { display: flex; flex-wrap: wrap; gap: 6px; }
.dash-note { width: 100%; min-height: 110px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 10px; padding: 8px; font: inherit; resize: vertical; background: #fffdf2; }
.dash-starters { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin: 10px 0 14px; }
.dash-starter { display: block; background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 12px; cursor: pointer; } .dash-starter.best { border-color: var(--accent); }
.dash-starter input { margin-right: 6px; }
.dash-addgrp { margin-bottom: 10px; } .dash-addgrp > b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-soft); margin: 8px 0 4px; }
.dash-addrow { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); }
.dash-set label { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; } .dash-ticks { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px; }
.dash-pace { display: flex; flex-direction: column; }
.dash-pace-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) minmax(50px, 30%) 56px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.dash-pace-row:last-child { border-bottom: 0; } .dash-rank { text-align: center; font-weight: 700; color: var(--ink-soft); }
.dash-pace-name { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .dash-pace-name small { display: block; font-weight: 400; color: var(--ink-soft); font-size: 11.5px; }
.dash-pace-row i { display: block; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; } .dash-pace-row em { display: block; height: 100%; }
.dash-pace-row b { text-align: center; border-radius: 8px; padding: 2px 0; font-size: 12.5px; }
.dash-wk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; } .dash-wk b { font-size: 13.5px; }
.dash-prog { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; } .dash-prog i { flex: 1; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; } .dash-prog em { display: block; height: 100%; background: var(--green); }
.dash-check { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto 24px; gap: 8px; align-items: center; padding: 6px 4px; border-bottom: 1px solid var(--border); cursor: pointer; }
.dash-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--green); } .dash-check.on .dash-main { color: var(--ink-soft); font-weight: 500; }
.dash-check .dash-sub { margin: 0; text-align: right; } .dash-check.on .dash-sub { color: var(--green); font-weight: 600; } .dash-check a { text-decoration: none; text-align: center; }
.dash-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; } .dash-head-row .dash-big { margin: 0; }
.dash-order { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid var(--border); transition: opacity .2s, transform .2s; }
.dash-order.gone { opacity: 0; transform: translateX(20px); pointer-events: none; }
.dash-tick { flex: none; width: 30px; height: 30px; border-radius: 999px; border: 1.5px solid var(--green); background: var(--card-bg); color: var(--green); font-weight: 800; cursor: pointer; }
.dash-tick:hover { background: var(--green); color: #fff; } .dash-order-main { min-width: 0; flex: 1; }
.dash-o-amt { float: right; font-weight: 800; } .dash-o-items { font-size: 12.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-block { color: var(--ink); }
.dash-hero { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; } .dash-hero .spacer { flex: 1; }
.dash-hero-btns { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .dash-hello { min-width: 0; }
.dash-greet { font-family: 'Fredoka', 'Inter', sans-serif; font-size: clamp(22px, 2vw, 30px); font-weight: 700; color: var(--ink); line-height: 1.15; }
.dash-date { color: var(--ink-soft); font-size: 13.5px; margin-top: 3px; } #dash-glance { font-weight: 600; }
.dash-av { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--accent-soft); flex: none; }
.dash-hero .hub-av, .dash-hero .dash-av { flex: none; }
.dash-note-banner { display: flex; gap: 10px; align-items: flex-start; background: var(--card-bg); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 14px; padding: 10px 12px; margin: 0 0 12px; color: var(--ink); }
.dash-note-banner > div { flex: 1; font-size: 14px; } .dash-note-banner b { display: block; margin-bottom: 2px; }
.dash-setup { background: #f3e8fb; border: 1px solid #d9b8f0; border-radius: 14px; padding: 12px 14px; margin: 6px 0 12px; color: #3b1d52; font-size: 13.5px; }
.dash-setup-note { width: 100%; box-sizing: border-box; min-height: 60px; margin-top: 4px; border: 1px solid #d9b8f0; border-radius: 10px; padding: 8px; font: inherit; }
.dash-setup-btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; } .dash-setup-btns .spacer { flex: 1; }
.dash-sws { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.dash-sw { text-align: left; border: 1px solid #e6e3ee; background: #fff; border-radius: 12px; padding: 8px; cursor: pointer; } .dash-sw.on { border-color: #111; box-shadow: 0 0 0 1px #111; }
.dash-sw-pic { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 9px 26px; gap: 4px; padding: 6px; border-radius: 8px; height: 50px; box-sizing: border-box; }
.dash-sw-pic i { display: block; border-radius: 3px; } .dash-sw-pic i + i { border: 1px solid; } .dash-sw-pic b { display: block; border-radius: 4px; border: 1px solid; }
.dash-sw-name { display: block; font-weight: 700; font-size: 12.5px; margin-top: 6px; color: #1f1b3a; } .dash-sw-mood { display: block; font-size: 11px; color: #6b6a80; }
.dash-sh { margin: 14px 0 6px; font-size: 13px; } .dash-set-row { display: flex; gap: 8px; align-items: center; margin: 6px 0; font-size: 13.5px; } .dash-set-row input[type=text] { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.dash-avs { display: flex; flex-wrap: wrap; gap: 6px; max-height: 220px; overflow-y: auto; }
.dash-avc { width: 44px; height: 44px; border-radius: 999px; border: 2px solid transparent; background: #f3f1f8; padding: 0; overflow: hidden; cursor: pointer; font-size: 22px; } .dash-avc img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dash-avc.on { border-color: #111; }
#mydash-pane.themed { background: var(--dash-bg); min-height: 100vh; box-sizing: border-box; }
#mydash-pane.themed .ho-btn { background: var(--card-bg); color: var(--ink); border-color: var(--border); }
#mydash-pane.themed .ho-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--dash-on); }
#mydash-pane.themed input, #mydash-pane.themed select, #mydash-pane.themed textarea { background: var(--card-bg); color: var(--ink); border-color: var(--border); }
#mydash-pane.themed .dash-block a, #mydash-pane.themed .dash-open { color: var(--accent); }
#mydash-pane.dark .goal-note, #mydash-pane.dark .fd-sm, #mydash-pane.dark .lab-sub, #mydash-pane.dark .dash-sub { color: var(--ink-soft); }
#mydash-pane.dark .dash-note { background: var(--dash-bg); color: var(--ink); } #mydash-pane.dark .dash-setup { background: #3b2f58; color: #f0eaf9; border-color: #5a4a80; }
@media (max-width: 1100px) { .dash-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dash-block.sz-l { grid-column: 1 / -1; } }
@media (max-width: 640px) { .dash-grid { grid-template-columns: 1fr; } .dash-block.sz-s, .dash-block.sz-m, .dash-block.sz-l { grid-column: 1 / -1; } }`;
  document.head.appendChild(s);
}

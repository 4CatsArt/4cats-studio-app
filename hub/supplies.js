// hub/supplies.js: 🧺 Supplies list (home office: names, groups, units, pars, order rules, per-studio overrides) and
// 📦 Supplies for studios (Supply Store, blind counts, studio-to-studio transfers; community-inventory Edge Function).
// Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.

// ---------- Home office → 🧺 Supplies list (supplies_manager.sql) ----------
// Every studio supply (not retail products): name, group, how it's counted, par, reorder at, pack size, order rule, jar count,
// in the Store, plus per-studio overrides. The same list Supplies → Store and Counts use.
const SUP_GROUPS = ['Clay', 'Ditto', 'Paint', 'Glaze', 'Canvases & surfaces', 'Brushes & tools', 'Craft materials', 'Camp & party', 'Cleaning & washroom', 'Studio basics', 'Snacks & Drinks', 'Other supplies'];
const SUP_RULES = [['', 'Top up to par'], ['one_case', 'Order one case at the reorder point'], ['on_request', 'Ask when needed (never ordered automatically)']];
let _sup = { rows: null, err: '', q: '', grp: '', show: 'active', edit: null, msg: '', canEdit: false };
async function openSupPane() {
  // Who can open it and change it: “Supplies & inventory” on access.html (View to look, Edit to change). The server decides (perm_can).
  showOnlyPane('sup-pane'); setActiveNav('nav-sup'); _sup.edit = null; supDraw(); supLoad();
  sb.rpc('perm_can', { p_area: 'supplies_inventory', p_level: 'edit' }).then(r => { _sup.canEdit = r.data === true; supDraw(); });
}
async function supLoad() {
  const { data, error } = await sb.rpc('hub_supplies_list');
  _sup.err = error ? (/hub_supplies_list/.test(error.message) ? 'Run supplies_manager.sql in Supabase first.' : /not allowed|denied/i.test(error.message) ? 'The supplies list needs “Supplies & inventory” on the Access page.' : error.message) : '';
  _sup.rows = error ? [] : (data || []); supDraw();
}
function supNum(v) { return v == null || v === '' ? '' : String(+v); }
function supRuleText(r) {
  if (r.order_rule === 'on_request') return 'ask when needed';
  if (r.order_rule === 'one_case') return `1 case${r.pack ? ' (' + r.pack + ')' : ''} at ${supNum(r.reorder_at) || '0'}`;
  if (r.par == null) return 'no par';
  return `par ${supNum(r.par)} · reorder at ${supNum(r.reorder_at) || '0'}${r.pack ? ' · packs of ' + r.pack : ''}`;
}
function supDraw() {
  const el = document.getElementById('sup-pane'); if (!el) return;
  const can = !!_sup.canEdit;
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🧺 Supplies list</div><span class="spacer"></span>
    ${can ? '<button class="ho-btn primary" onclick="supEdit(null)">+ Add a supply</button>' : ''}<button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <p class="ho-intro">Every studio supply: what staff "buy" in Supplies → Store as they open it, and count in Supplies → Counts. Retail products (kits, snacks for sale) are in 🛍️ Products.</p>`;
  if (_sup.msg) h += `<p class="fd-msg">${esc(_sup.msg)}</p>`;
  if (_sup.err) { el.innerHTML = h + `<p class="fd-msg">${esc(_sup.err)}</p>`; return; }
  if (!_sup.rows) { el.innerHTML = h + '<p class="goal-note">Loading…</p>'; return; }
  const q = _sup.q.toLowerCase();
  const list = _sup.rows.filter(r => (_sup.show === 'all' || (_sup.show === 'active' ? r.active : !r.active))
    && (!_sup.grp || (r.group || '') === _sup.grp) && (!q || (r.name + ' ' + r.sku).toLowerCase().includes(q)));
  h += `<div class="sup-tools"><input type="search" placeholder="Search a name or SKU" value="${escAttr(_sup.q)}" oninput="_sup.q=this.value;supDraw();this.focus();this.setSelectionRange(this.value.length,this.value.length)">
    <select onchange="_sup.grp=this.value;supDraw()"><option value="">All groups</option>${SUP_GROUPS.map(g => `<option${_sup.grp === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <select onchange="_sup.show=this.value;supDraw()">${[['active', 'Active'], ['off', 'Switched off'], ['all', 'All']].map(o => `<option value="${o[0]}"${_sup.show === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
    <span class="goal-note">${list.length} supplies</span></div>`;
  const by = {}; list.forEach(r => { (by[r.group || '(no group)'] = by[r.group || '(no group)'] || []).push(r); });
  const names = Object.keys(by).sort((a, b) => { const ia = SUP_GROUPS.indexOf(a), ib = SUP_GROUPS.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
  h += names.map(g => `<details class="card sup-grp" open><summary><b>${esc(g)}</b> <span class="goal-note">${by[g].length}</span></summary>
    <table class="fd-tbl sup-tbl"><thead><tr><th>Item</th><th>SKU</th><th>Counted in</th><th>Ordering</th><th class="c">Store</th><th></th></tr></thead><tbody>
    ${by[g].map(r => `<tr class="${r.active ? '' : 'sup-off'}"><td><b>${esc(r.name)}</b>${r.size ? `<div class="goal-note">${esc(r.size)}</div>` : ''}${(r.overrides || []).length ? `<div class="goal-note">🏷️ ${r.overrides.length} studio${r.overrides.length === 1 ? '' : 's'} differ</div>` : ''}</td>
      <td class="goal-note">${esc(r.sku)}</td><td>${r.count_mode === 'jar' ? '🫙 jar (¼ ½ ¾)' : esc(r.count_unit || 'each')}${r.tracking === 'count' ? ' · count all' : ''}</td>
      <td>${esc(supRuleText(r))}</td><td class="c">${r.store ? '✓' : ''}</td>
      <td>${can ? `<button class="ho-btn sm" onclick="supEdit('${escAttr(r.sku)}')">Edit</button>` : ''}</td></tr>`).join('')}
    </tbody></table></details>`).join('');
  el.innerHTML = h;
}
function supEdit(sku) {
  const r = sku ? (_sup.rows || []).find(x => x.sku === sku) : { sku: '', name: '', group: _sup.grp || '', tracking: 'buy', count_unit: 'each', active: true, store: true, overrides: [] };
  if (!r) return; const isNew = !sku;
  const v = x => x == null ? '' : escAttr(String(x)), opt = (list, cur) => list.map(o => `<option value="${escAttr(o[0])}"${String(cur || '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
  openDutySheet(`<h3>🧺 ${isNew ? 'Add a supply' : esc(r.name)}</h3>
    <div class="me-form sup-form">
      <label>Name<input id="sp-name" value="${v(r.name)}" maxlength="120"></label>
      <label>SKU<input id="sp-sku" value="${v(r.sku)}" ${isNew ? 'placeholder="e.g. CANVAS-MINI"' : 'disabled'}></label>
      <label>Group<select id="sp-group">${opt([['', '(none)']].concat(SUP_GROUPS.map(g => [g, g])), r.group)}</select></label>
      <label>Tracked by<select id="sp-track">${opt([['buy', 'Staff "buy" it as they open it (count unopened only)'], ['count', 'Count everything on hand (snacks & drinks)']], r.tracking)}</select></label>
      <label>Counted in (unit)<input id="sp-unit" value="${v(r.count_unit || 'each')}" placeholder="box, roll, bottle, each…"></label>
      <label>Size note<input id="sp-size" value="${v(r.size)}" placeholder="e.g. pack of 14, 1 box = 20 kg"></label>
      <label class="ba-check"><input type="checkbox" id="sp-jar" ${r.count_mode === 'jar' ? 'checked' : ''}> 🫙 Jar count: staff estimate how full (¼ ½ ¾) instead of counting pieces</label>
      <label>Ordering<select id="sp-rule">${opt(SUP_RULES, r.order_rule)}</select></label>
      <div class="sup-two"><label>Par (every studio)<input id="sp-par" type="number" step="any" min="0" value="${v(r.par)}"></label>
        <label>Reorder at<input id="sp-re" type="number" step="any" min="0" value="${v(r.reorder_at)}"></label>
        <label>Pack / case size<input id="sp-pack" type="number" step="1" min="1" value="${v(r.pack)}"></label></div>
      <div class="sup-two"><label>Supplier<input id="sp-supp" value="${v(r.supplier)}"></label>
        <label>Cost per unit $<input id="sp-cost" type="number" step="0.01" min="0" value="${v(r.cost)}"></label>
        <label>Delivery days<input id="sp-lead" type="number" step="1" min="0" value="${v(r.lead_days)}"></label></div>
      <label>Notes<input id="sp-notes" value="${v(r.notes)}" maxlength="300"></label>
      <label class="ba-check"><input type="checkbox" id="sp-store" ${r.store ? 'checked' : ''}> In Supplies → Store (staff can "buy" it)</label>
      <label class="ba-check"><input type="checkbox" id="sp-active" ${r.active !== false ? 'checked' : ''}> Active (off: not counted, ordered or in the Store; history kept)</label>
      ${isNew ? '' : `<div class="sup-ov"><b>🏷️ Different at some studios</b>
        ${(r.overrides || []).length ? `<table class="fd-tbl"><tr><th>Studio</th><th>Par</th><th>Reorder at</th><th>Why</th><th></th></tr>${r.overrides.map(o => `<tr><td>${esc(STUDIO_NAMES[o.studio_id] || o.studio_id)}</td><td>${esc(supNum(o.par))}</td><td>${esc(supNum(o.reorder_at))}</td><td class="goal-note">${esc(o.why || '')}</td>
          <td><button class="ho-btn sm" onclick="supOvRemove('${escAttr(r.sku)}','${escAttr(o.studio_id)}')">Remove</button></td></tr>`).join('')}</table>` : '<p class="goal-note">Same at every studio.</p>'}
        <div class="sup-two"><label>Studio<select id="sp-ov-st">${Object.keys(STUDIO_NAMES).map(id => `<option value="${escAttr(id)}">${esc(STUDIO_NAMES[id])}</option>`).join('')}</select></label>
          <label>Par there<input id="sp-ov-par" type="number" step="any" min="0"></label><label>Reorder at<input id="sp-ov-re" type="number" step="any" min="0"></label></div>
        <label>Why<input id="sp-ov-why" placeholder="e.g. busiest studio, no Splatter parties"></label>
        <button class="ho-btn sm" onclick="supOvAdd('${escAttr(r.sku)}')">+ Set for this studio</button></div>`}
      <div id="sp-msg"></div></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="supSave(${isNew})">${isNew ? 'Add it' : 'Save'}</button></div>`);
}
async function supSave(isNew) {
  const g = id => (document.getElementById(id) || {}).value || '', c = id => !!(document.getElementById(id) || {}).checked;
  const p = { new: isNew, sku: g('sp-sku'), name: g('sp-name'), group: g('sp-group'), tracking: g('sp-track'), count_unit: g('sp-unit'), size: g('sp-size'),
    count_mode: c('sp-jar') ? 'jar' : '', order_rule: g('sp-rule'), par: g('sp-par'), reorder_at: g('sp-re'), pack: g('sp-pack'),
    supplier: g('sp-supp'), cost: g('sp-cost'), lead_days: g('sp-lead'), notes: g('sp-notes'), store: c('sp-store'), active: c('sp-active') };
  const { error } = await sb.rpc('hub_supply_save', { p });
  if (error) { document.getElementById('sp-msg').innerHTML = `<p class="fd-msg">${esc(error.message)}</p>`; return; }
  closeDutySheet(); _sup.msg = `✓ ${isNew ? 'Added' : 'Saved'}: ${p.name}`; await supLoad();
}
async function supOvAdd(sku) {
  const g = id => (document.getElementById(id) || {}).value || '';
  const { error } = await sb.rpc('hub_supply_override_save', { p: { sku, studio_id: g('sp-ov-st'), par: g('sp-ov-par'), reorder_at: g('sp-ov-re'), why: g('sp-ov-why') } });
  if (error) { document.getElementById('sp-msg').innerHTML = `<p class="fd-msg">${esc(error.message)}</p>`; return; }
  await supLoad(); supEdit(sku);
}
async function supOvRemove(sku, studio) {
  const { error } = await sb.rpc('hub_supply_override_save', { p: { sku, studio_id: studio, remove: true } });
  if (error) { alert(error.message); return; } await supLoad(); supEdit(sku);
}

// ==========================================================================
// SUPPLIES (inventory): Supply Store, blind counts, studio-to-studio transfers
// Served by the community-inventory Edge Function. The studio login is
// enough; the server decides which studio this device is (a coordinator or
// admin PIN also works, and an admin can follow the studio switcher).
// The server never sends stock levels or expected counts. Counts are blind
// by design, so there is nothing on this page to hide.
//
// INVENTORY_LIVE = true: every studio login gets the tab (Store + Transfers).
// Set it back to false to hide the tab behind admin preview (admin PIN).
// Counts need a coordinator or admin PIN (enforced in community-inventory);
// without one, the Counts tab offers the usual PIN prompt. The bubble still
// shows due counts to everyone, so staff know to get a manager.
// ==========================================================================
const INVENTORY_LIVE = true;

let _inv = null;          // last 'init' response
let _invStudioId = null;  // studio the cart belongs to
let _invStaff = '';       // "who's using the store", kept until sign-out
let _invTab = 'store';    // 'store' | 'counts' | 'transfers'
let _invMode = 'open';    // store mode: 'open' | 'return'
let _invCart = {};        // `${action}:${sku}` → { sku, name, qty, action }
let _invFlash = null;     // { type: 'ok'|'err'|'warn', text }
let _invBusy = false;

// Tile colours for the store. Matched on the item name, so a new colour just
// gets a neutral tile until it's added here.
const INV_SWATCHES = {
  'azure': '#2b8fd6', 'beige': '#e6d5b8', 'black': '#222222', 'glow': '#d9f99d',
  'gold': '#d4af37', 'granny': '#8dc63f', 'green': '#2e9e4f', 'lemon': '#fff15c',
  'marble grey': '#a3a6ad', 'orange': '#f97316', 'peach': '#ffc8a2', 'pink': '#ec4899',
  'purple': '#7e22ce', 'raw umber': '#826644', 'red': '#dc2626', 'silver': '#c0c0c0',
  'sky blue': '#7dd3fc', 'sparkle blue': '#3b6cf6', 'ultramarine': '#1e3a8a',
  'van dyke brown': '#4b3621', 'violet': '#8b5cf6', 'white': '#f7f7f5', 'yellow': '#facc15',
  'brown clay': '#8b5e3c', 'low fire white clay': '#ece4d6'
};

function invDisplayName(name) {
  const n = String(name || '').replace(/^ditto\s*-\s*/i, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function invSwatch(name) {
  const key = String(name || '').toLowerCase().replace(/^ditto\s*-\s*/, '');
  return INV_SWATCHES[key] || '#e5e7eb';
}
function invSizeNote(note) {
  return String(note || '').replace(/\s*\(single colou?r\)\s*/i, '');
}
function invStudioName(id) { return id === 'WAREHOUSE' ? 'Salt Spring warehouse' : (STUDIO_NAMES[id] || id); }
function invShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function invEnabled() {
  return INVENTORY_LIVE || document.body.classList.contains('preview-mode');
}

async function invCall(action, extra) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-inventory`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify(Object.assign({ action, pin: _sessionPin, studioId: _sessionStudioId }, extra || {}))
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Things waiting on this studio: due counts, plus transfers it needs to act on.
function invActionCounts(d) {
  if (!d) return { counts: 0, transfers: 0 };
  const transfers = (d.transfers || []).filter(t =>
    (t.direction === 'outgoing' && t.status === 'requested') ||
    (t.direction === 'incoming' && t.status === 'sent')
  ).length;
  return { counts: d.dueCountTotal || 0, transfers };
}

function setInvBadge(n) {
  const b = document.getElementById('inv-badge');
  if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n);
  b.style.display = n > 0 ? '' : 'none';
}

// Called whenever the studio cards load (sign-in, studio switch, PIN unlock).
async function refreshInventory() {
  if (!invEnabled() || !_studioViewStarted) { setInvBadge(0); return; }
  if (paneVisible('inventory-pane')) { loadInventory(); return; }
  try {
    _inv = await invCall('init');
    const a = invActionCounts(_inv);
    setInvBadge(a.counts + a.transfers);
  } catch (e) {
    console.error('Supplies badge refresh failed:', e);
  }
}

// Sidebar → 📦 Supplies
function openInventory() {
  showOnlyPane('inventory-pane');
  setActiveNav('nav-inventory');
  const body = document.getElementById('inv-body');
  if (body && !_inv) body.innerHTML = `<div class="card"><div class="inv-empty">Loading supplies…</div></div>`;
  loadInventory();
}

async function loadInventory() {
  try {
    _inv = await invCall('init');
  } catch (e) {
    _inv = null;
    document.getElementById('inv-body').innerHTML =
      `<div class="inv-flash err">Couldn't load supplies: ${esc(e.message)}</div>`;
    return;
  }
  // A different studio (admin switcher) gets a fresh cart and name.
  if (_invStudioId && _invStudioId !== _inv.studioId) {
    _invCart = {};
    _invStaff = '';
  }
  _invStudioId = _inv.studioId;
  if (_invStaff && (_inv.staff || []).length && !_inv.staff.includes(_invStaff)) _invStaff = '';
  const a = invActionCounts(_inv);
  setInvBadge(a.counts + a.transfers);
  renderInventory();
  renderInvModal();
}

function invReset() {
  invCloseGroup();
  _inv = null; _invStudioId = null; _invStaff = ''; _invCart = {};
  _invFlash = null; _invTab = 'store'; _invMode = 'open';
  setInvBadge(0);
  const bar = document.getElementById('inventory-bar');
  if (bar) bar.innerHTML = '';
  const body = document.getElementById('inv-body');
  if (body) body.innerHTML = '';
}

// ---------- rendering ----------
function renderInventory() {
  if (!_inv) return;
  const bar = document.getElementById('inventory-bar');
  bar.innerHTML = `<span>📦 Supplies · <span class="who">${esc(invStudioName(_inv.studioId))}</span></span>
    <span class="spacer"></span><button onclick="goToDashboard()">← Dashboard</button>`;

  const a = invActionCounts(_inv);
  const badge = n => n > 0 ? `<span class="nav-badge">${n}</span>` : '';
  const staff = _inv.staff || [];
  const whoInput = staff.length
    ? `<select onchange="_invStaff = this.value; renderInventory()">
         <option value="">Choose your name</option>
         ${staff.map(n => `<option value="${escAttr(n)}" ${n === _invStaff ? 'selected' : ''}>${esc(n)}</option>`).join('')}
       </select>`
    : `<input type="text" placeholder="Your name" value="${escAttr(_invStaff)}"
         onchange="_invStaff = this.value.trim(); renderInventory()" />`;

  const flash = _invFlash ? `<div class="inv-flash ${_invFlash.type}">${esc(_invFlash.text)}</div>` : '';

  let tabBody = '';
  if (_invTab === 'store') tabBody = renderInvStore();
  else if (_invTab === 'counts') tabBody = renderInvCounts();
  else tabBody = renderInvTransfers();

  document.getElementById('inv-body').innerHTML = `
    <div class="inv-top">
      <label class="inv-who ${_invStaff ? '' : 'missing'}">Who's here? ${whoInput}</label>
    </div>
    <div class="inv-tabs">
      <button class="inv-tab ${_invTab === 'store' ? 'on' : ''}" onclick="invSetTab('store')">🛒 Store</button>
      <button class="inv-tab ${_invTab === 'counts' ? 'on' : ''}" onclick="invSetTab('counts')">📋 Counts${_inv.canCount ? '' : ' 🔒'} ${badge(a.counts)}</button>
      <button class="inv-tab ${_invTab === 'transfers' ? 'on' : ''}" onclick="invSetTab('transfers')">🔁 Transfers ${badge(a.transfers)}</button>
    </div>
    ${flash}
    ${tabBody}`;
}

function invSetTab(tab) { _invTab = tab; _invFlash = null; renderInventory(); }
function invSetMode(mode) { _invMode = mode; renderInventory(); }

// Store: one tile per category (Clay, Ditto, Snacks & Drinks). Tapping a
// category opens a pop-up of its items (colours, flavours…); tapping an
// item there adds a box to the cart. Then record the cart.
const INV_GROUP_ORDER = ['Clay', 'Ditto', 'Snacks & Drinks'];
const INV_GROUP_ICONS = { 'Clay': '🏺', 'Ditto': '🎨', 'Snacks & Drinks': '🍫' };
const INV_ITEM_ICONS = [
  [/hot\s*choc/i, '☕'], [/sushi/i, '🍣'], [/candy/i, '🍬'], [/\btea\b/i, '🍵'],
  [/bubly/i, '🫧'], [/\bcups?\b/i, '🥤']
];
let _invOpenGroup = null; // category whose pop-up is open

function invHasSwatch(name) {
  return !!INV_SWATCHES[String(name || '').toLowerCase().replace(/^ditto\s*-\s*/, '')];
}
function invItemIcon(name) {
  const hit = INV_ITEM_ICONS.find(([re]) => re.test(name || ''));
  return hit ? hit[1] : '📦';
}
// Swatch for colours, emoji for everything else
function invItemVisual(name, size) {
  const px = size || 34;
  return invHasSwatch(name)
    ? `<span class="inv-swatch" style="width:${px}px;height:${px}px;background:${invSwatch(name)}"></span>`
    : `<span class="inv-emoji" style="font-size:${Math.round(px * 0.8)}px">${invItemIcon(name)}</span>`;
}
function invGroups() {
  const byGroup = {};
  (_inv.items || []).forEach(i => { (byGroup[i.group] = byGroup[i.group] || []).push(i); });
  const rank = g => { const r = INV_GROUP_ORDER.indexOf(g); return r < 0 ? 99 : r; };
  return Object.keys(byGroup)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(name => ({ name, items: byGroup[name] }));
}
function invInCart(sku) {
  const c = _invCart[`${_invMode}:${sku}`];
  return c ? c.qty : 0;
}
function invGroupCount(g) {
  if (g.name === 'Ditto' || g.name === 'Clay') return `${g.items.length} colour${g.items.length === 1 ? '' : 's'}`;
  return `${g.items.length} item${g.items.length === 1 ? '' : 's'}`;
}

function renderInvStore() {
  const groups = invGroups();
  const tilesHtml = groups.map(g => {
    const inCart = g.items.reduce((s, i) => s + invInCart(i.sku), 0);
    const swatches = g.items.filter(i => invHasSwatch(i.name)).slice(0, 8);
    const visual = swatches.length
      ? `<span class="inv-mosaic">${swatches.map(i => `<span style="background:${invSwatch(i.name)}"></span>`).join('')}</span>`
      : `<span class="inv-emoji" style="font-size:30px">${INV_GROUP_ICONS[g.name] || '📦'}</span>`;
    return `<button class="inv-cat ${_invMode === 'return' ? 'return' : ''}" onclick="invOpenGroup('${escAttr(g.name)}')">
      ${inCart ? `<span class="inv-tile-qty">${inCart}</span>` : ''}
      ${visual}
      <span class="inv-cat-name">${INV_GROUP_ICONS[g.name] && swatches.length ? INV_GROUP_ICONS[g.name] + ' ' : ''}${esc(g.name)}</span>
      <span class="inv-tile-sub">${invGroupCount(g)} · tap to choose</span>
    </button>`;
  }).join('');

  const lines = Object.entries(_invCart);
  const total = lines.reduce((s, [, c]) => s + c.qty, 0);
  const cartHtml = lines.length
    ? lines.map(([key, c]) => `
        <div class="inv-line">
          ${invItemVisual(c.name, 22)}
          <span class="nm">${esc(invDisplayName(c.name))}<br>
            <span class="inv-tag ${c.action === 'return' ? 'return' : ''}">${c.action === 'return' ? '↩ Returning' : '📦 Opening'}</span></span>
          <button class="inv-step" onclick="invStep('${escAttr(key)}', -1)">−</button>
          <strong>${c.qty}</strong>
          <button class="inv-step" onclick="invStep('${escAttr(key)}', 1)">+</button>
        </div>`).join('')
    : `<div class="inv-empty">Tap a category, then pick what you're opening.</div>`;

  return `
    <div class="inv-modes">
      <button class="${_invMode === 'open' ? 'on' : ''}" onclick="invSetMode('open')">📦 Opening a new box</button>
      <button class="${_invMode === 'return' ? 'on' : ''}" onclick="invSetMode('return')">↩ Returning an unopened box</button>
    </div>
    <p class="inv-note">${_invMode === 'open'
      ? 'Before you open a new box or case, "buy" it here.'
      : 'Put a box back unopened? Record it here so it goes back on the shelf count.'}</p>
    <div class="inv-store">
      <div class="inv-cats">${tilesHtml || '<div class="inv-empty">No items in the store yet.</div>'}</div>
      <div class="card inv-cart">
        <h3>🛒 Cart</h3>
        ${cartHtml}
        <button class="inv-primary" onclick="invCheckout()" ${!total || _invBusy ? 'disabled' : ''}>
          ${_invBusy ? 'Saving…' : total ? `Record ${total} box${total === 1 ? '' : 'es'}` : 'Record'}
        </button>
        ${total && !_invStaff ? `<div class="inv-note" style="margin:8px 0 0">Choose your name above first.</div>` : ''}
      </div>
    </div>`;
}

// ---------- category pop-up ----------
function invOpenGroup(name) {
  _invOpenGroup = name;
  renderInvModal();
  document.getElementById('inv-modal').style.display = 'flex';
}
function invCloseGroup() {
  _invOpenGroup = null;
  const m = document.getElementById('inv-modal');
  if (m) m.style.display = 'none';
  const body = document.getElementById('inv-modal-body');
  if (body) body.innerHTML = '';
}
function renderInvModal() {
  if (!_invOpenGroup || !_inv) return;
  const g = invGroups().find(x => x.name === _invOpenGroup);
  if (!g) { invCloseGroup(); return; }
  document.getElementById('inv-modal-title').innerHTML =
    `${INV_GROUP_ICONS[g.name] || '📦'} ${esc(g.name)}
     <span class="inv-tag ${_invMode === 'return' ? 'return' : ''}" style="margin:0 0 0 8px;vertical-align:middle">${_invMode === 'return' ? '↩ Returning' : '📦 Opening'}</span>`;
  const picked = g.items.reduce((s, i) => s + invInCart(i.sku), 0);
  document.getElementById('inv-modal-body').innerHTML = `
    <p class="inv-note">Tap to add a box to the cart. Tap again for more.</p>
    <div class="inv-tiles">${g.items.map(i => {
      const q = invInCart(i.sku);
      return `<button class="inv-tile ${_invMode === 'return' ? 'return' : ''} ${q ? 'picked' : ''}" onclick="invAdd('${escAttr(i.sku)}')">
        ${q ? `<span class="inv-tile-qty">${q}</span>` : ''}
        ${invItemVisual(i.name)}
        <span class="inv-tile-name">${esc(invDisplayName(i.name))}</span>
        <span class="inv-tile-sub">${esc(invSizeNote(i.sizeNote))}</span>
      </button>`;
    }).join('')}</div>
    <button class="inv-primary" onclick="invCloseGroup()">${picked ? `Done · ${picked} in cart` : 'Done'}</button>`;
}

function invAdd(sku) {
  const item = (_inv.items || []).find(i => i.sku === sku);
  if (!item) return;
  const key = `${_invMode}:${sku}`;
  if (!_invCart[key]) _invCart[key] = { sku, name: item.name, qty: 0, action: _invMode };
  if (_invCart[key].qty < 20) _invCart[key].qty += 1;
  _invFlash = null;
  renderInventory();
  renderInvModal();
}

function invStep(key, delta) {
  const c = _invCart[key];
  if (!c) return;
  c.qty += delta;
  if (c.qty <= 0) delete _invCart[key];
  else if (c.qty > 20) c.qty = 20;
  renderInventory();
  renderInvModal();
}

async function invCheckout() {
  if (_invBusy) return;
  const lines = Object.values(_invCart);
  if (!lines.length) return;
  if (!_invStaff) { _invFlash = { type: 'warn', text: 'Choose your name at the top first.' }; renderInventory(); return; }
  const summary = lines.map(c => `${c.action === 'return' ? 'Return' : 'Open'} ${c.qty} × ${invDisplayName(c.name)}`).join('\n');
  if (!confirm(`Record this for ${invStudioName(_inv.studioId)}?\n\n${summary}`)) return;

  _invBusy = true; renderInventory();
  try {
    await invCall('buy', {
      staffName: _invStaff,
      items: lines.map(c => ({ sku: c.sku, qty: c.qty, action: c.action }))
    });
    const n = lines.reduce((s, c) => s + c.qty, 0);
    _invCart = {};
    _invMode = 'open';
    _invFlash = { type: 'ok', text: `✅ Recorded ${n} box${n === 1 ? '' : 'es'}. Thanks, ${_invStaff}!` };
  } catch (e) {
    _invFlash = { type: 'err', text: e.message };
  }
  _invBusy = false;
  renderInventory();
}

// Counts: names only. The server answers 'done' or 'recount', never a number.
function renderInvCounts() {
  if (!_inv.canCount) {
    const n = _inv.dueCountTotal || 0;
    return `<div class="card">
      <p class="inv-note">${n
        ? `<strong>${n} count${n === 1 ? ' is' : 's are'} due.</strong> Counts are done by a coordinator or manager.`
        : 'No counts due right now. Counts are done by a coordinator or manager.'}</p>
      <button class="inv-btn go" onclick="openPinModal()">🔓 Unlock with coordinator PIN</button>
    </div>`;
  }
  const due = _inv.dueCounts || [];
  if (!due.length) {
    return `<div class="card"><div class="inv-empty">🎉 No counts due right now. When one is due, a red bubble shows on 📦 Supplies.</div></div>`;
  }
  // (Nov 10 2026) by group (Clay, Ditto, Paint, Cleaning & washroom…), each its own section, with a printable count sheet
  const unitLabel = (u, n) => {
    const plural = { box: 'boxes', each: 'items' }[u] || `${u}s`;
    return n === 1 ? (u === 'each' ? 'item' : u) : plural;
  };
  const row = c => `
      <div class="inv-count-row">
        ${invItemVisual(c.name)}
        <span class="nm">${esc(invDisplayName(c.name))}
          <span class="inv-tile-sub" style="display:block;font-weight:500">${c.unit === 'each' ? 'Count each one' : `Count in ${esc(unitLabel(c.unit, 2))}`}${c.sizeNote ? ' · ' + esc(c.sizeNote) : ''}</span>
          ${c.recount ? `<span class="inv-recount">🔁 Please count this one again carefully.</span>` : ''}</span>
        <input type="number" inputmode="numeric" min="0" step="1" placeholder="${escAttr(unitLabel(c.unit, 2).replace(/^./, x => x.toUpperCase()))}" id="inv-count-${escAttr(c.id)}"
               onkeydown="if(event.key==='Enter') invSubmitCount('${escAttr(c.id)}')" />
        <button class="inv-btn go" onclick="invSubmitCount('${escAttr(c.id)}')" ${_invBusy ? 'disabled' : ''}>Submit</button>
      </div>`;
  const groups = invCountGroups(due);
  return `
    <div class="card inv-cnt-top">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <b style="font-size:16px">${due.length} item${due.length === 1 ? '' : 's'} to count</b>
        <span class="spacer" style="flex:1"></span>
        <button class="inv-btn" onclick="invPrintCountSheet()">🖨 Print count sheet</button>
      </div>
      <p class="inv-note" style="margin:8px 0 0">Count <strong>unopened stock only</strong>: sealed boxes, cases, packs, rolls and bottles, on the shelves and in the back.
        Don't count anything that's already open and in use. <strong>Snacks &amp; drinks:</strong> count everything on hand.
        Tip: print the sheet, walk around and write the numbers down, then type them in here.</p>
      <div class="inv-cnt-jump">${groups.map(g => `<a href="#inv-g-${escAttr(g.key)}" onclick="event.preventDefault();document.getElementById('inv-g-${escAttr(g.key)}').scrollIntoView({behavior:'smooth'})">${esc(g.name)} <span>${g.items.length}</span></a>`).join('')}</div>
    </div>
    ${groups.map(g => `<details class="card inv-cnt-grp" id="inv-g-${escAttr(g.key)}" open>
      <summary><b>${esc(g.name)}</b> <span class="inv-tile-sub">${g.items.length} to count</span></summary>
      ${g.items.map(row).join('')}
    </details>`).join('')}`;
}
// the counts sorted into their groups, in a sensible order (others alphabetical, then Other supplies last)
const INV_COUNT_ORDER = ['Clay', 'Ditto', 'Paint', 'Glaze', 'Canvases & surfaces', 'Brushes & tools', 'Craft materials', 'Camp & party', 'Cleaning & washroom', 'Studio basics', 'Snacks & Drinks'];
function invCountGroups(due) {
  const by = {};
  due.forEach(c => { const g = c.group || 'Other supplies'; (by[g] = by[g] || []).push(c); });
  const names = Object.keys(by).sort((a, b) => {
    const ia = INV_COUNT_ORDER.indexOf(a), ib = INV_COUNT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return names.map(n => ({ name: n, key: n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    items: by[n].sort((a, b) => invDisplayName(a.name).localeCompare(invDisplayName(b.name))) }));
}
// 🖨 a printable count sheet: every item due, by group, with a box to write the number in
function invPrintCountSheet() {
  const due = (_inv && _inv.dueCounts) || []; if (!due.length) return;
  const studio = (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[_inv.studioId || _sessionStudioId]) || _inv.studioId || _sessionStudioId || '';
  const unit = u => ({ box: 'boxes', each: 'each' })[u] || (u + 's');
  const groups = invCountGroups(due);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Count sheet · ${esc(studio)}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:18px}h1{font-size:18px;margin:0 0 2px}.sub{color:#555;margin:0 0 10px}
    h2{font-size:13px;margin:14px 0 4px;padding:3px 6px;background:#eee;break-after:avoid}table{width:100%;border-collapse:collapse}
    td,th{border-bottom:1px solid #ccc;padding:5px 6px;text-align:left}th{font-size:11px;color:#555}td.n{width:90px;border:1px solid #999}
    .u{color:#555;width:150px}.grp{break-inside:avoid}@media print{.np{display:none}}</style></head><body>
    <button class="np" onclick="window.print()" style="float:right;padding:6px 12px">Print</button>
    <h1>📦 Count sheet · ${esc(studio)}</h1>
    <p class="sub">Printed ${esc(new Date().toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} · Counted by: ______________________ · Count <b>unopened stock only</b> (snacks &amp; drinks: everything on hand), then type the numbers into the Hub (Supplies → Counts).</p>
    ${groups.map(g => `<div class="grp"><h2>${esc(g.name)} (${g.items.length})</h2><table><tr><th>Item</th><th>Count in</th><th>Number</th></tr>
      ${g.items.map(c => `<tr><td>${esc(invDisplayName(c.name))}${c.recount ? ' <b>(count again)</b>' : ''}</td><td class="u">${esc(unit(c.unit))}${c.sizeNote ? ' · ' + esc(c.sizeNote) : ''}</td><td class="n"></td></tr>`).join('')}</table></div>`).join('')}
    </body></html>`;
  const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups for the Hub to print the sheet.'); return; }
  w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { } }, 400);
}

async function invSubmitCount(countId) {
  if (_invBusy) return;
  if (!_invStaff) { _invFlash = { type: 'warn', text: 'Choose your name at the top first.' }; renderInventory(); return; }
  const input = document.getElementById(`inv-count-${countId}`);
  const raw = input ? input.value.trim() : '';
  const qty = Number(raw);
  if (raw === '' || !Number.isInteger(qty) || qty < 0) {
    _invFlash = { type: 'warn', text: 'Enter a whole number (0 or more).' };
    renderInventory();
    return;
  }
  const item = (_inv.dueCounts || []).find(c => c.id === countId);
  const name = item ? invDisplayName(item.name) : 'that item';

  _invBusy = true;
  try {
    const r = await invCall('count', { countId, qty, staffName: _invStaff });
    _invFlash = r.result === 'recount'
      ? { type: 'warn', text: `🔁 Please recount ${name}. Check the shelf and the back room, then enter it again.` }
      : { type: 'ok', text: `✅ ${name} count saved. Thanks!` };
  } catch (e) {
    _invFlash = { type: 'err', text: e.message };
  }
  _invBusy = false;
  await loadInventory();
}

// Transfers: emergency boxes from another studio.
function renderInvTransfers() {
  const t = _inv.transfers || [];
  const items = _inv.items || [];
  const other = id => esc(invStudioName(id));
  const what = x => `${x.qty} × ${esc(invDisplayName(x.name))}`;

  const needsUs = t.filter(x => (x.direction === 'outgoing' && x.status === 'requested') ||
                                (x.direction === 'incoming' && x.status === 'sent'));
  const waiting = t.filter(x => !needsUs.includes(x));

  const needsUsHtml = needsUs.length ? needsUs.map(x => x.direction === 'outgoing'
    ? `<div class="inv-xfer"><span class="txt"><strong>${other(x.otherStudioId)}</strong> is asking for ${what(x)}
         <span class="when">Requested ${invShortDate(x.requestedAt)}${x.requestedBy ? ` by ${esc(x.requestedBy)}` : ''}</span></span>
         <button class="inv-btn go" onclick="invTransfer('${escAttr(x.id)}', 'send')">Send</button>
         <button class="inv-btn warn" onclick="invTransfer('${escAttr(x.id)}', 'decline')">Can't spare it</button></div>`
    : `<div class="inv-xfer"><span class="txt"><strong>${other(x.otherStudioId)}</strong> sent you ${what(x)}
         <span class="when">Sent ${invShortDate(x.respondedAt)}${x.respondedBy ? ` by ${esc(x.respondedBy)}` : ''}</span></span>
         <button class="inv-btn go" onclick="invTransfer('${escAttr(x.id)}', 'receive')">It arrived</button></div>`
  ).join('') : `<div class="inv-empty">Nothing waiting on you.</div>`;

  const waitingHtml = waiting.length ? waiting.map(x => x.direction === 'incoming'
    ? `<div class="inv-xfer"><span class="txt">You asked <strong>${other(x.otherStudioId)}</strong> for ${what(x)}
         <span class="when">Requested ${invShortDate(x.requestedAt)} · waiting for them to send</span></span>
         <button class="inv-btn warn" onclick="invTransfer('${escAttr(x.id)}', 'cancel')">Cancel</button></div>`
    : `<div class="inv-xfer"><span class="txt">You sent <strong>${other(x.otherStudioId)}</strong> ${what(x)}
         <span class="when">Sent ${invShortDate(x.respondedAt)} · waiting for them to confirm it arrived</span></span></div>`
  ).join('') : `<div class="inv-empty">Nothing in progress.</div>`;

  const studioOpts = (_inv.studios || [])
    .map(id => ({ id, name: invStudioName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `<option value="${escAttr(s.id)}">${esc(s.name)}</option>`).join('');
  const itemOpts = invGroups().map(g => `<optgroup label="${escAttr(g.name)}">${
    g.items.map(i => `<option value="${escAttr(i.sku)}">${esc(invDisplayName(i.name))}</option>`).join('')
  }</optgroup>`).join('');

  return `
    <div class="section-head first">Waiting on you</div>
    <div class="card">${needsUsHtml}</div>

    <div class="section-head">In progress</div>
    <div class="card">${waitingHtml}</div>

    <div class="section-head">Need boxes urgently?</div>
    <div class="card">
      <p class="inv-note">For emergencies only: ask a nearby studio to send you sealed boxes.
        Their stock goes down when they send, and yours goes up when you confirm it arrived.</p>
      <div class="inv-form">
        <select id="inv-x-studio"><option value="">From which studio?</option>${studioOpts}</select>
        <select id="inv-x-sku"><option value="">Which item?</option>${itemOpts}</select>
        <input type="number" id="inv-x-qty" inputmode="numeric" min="1" max="20" step="1" value="1" />
        <button class="inv-btn go" onclick="invRequestTransfer()" ${_invBusy ? 'disabled' : ''}>Request</button>
      </div>
    </div>`;
}

async function invRequestTransfer() {
  if (_invBusy) return;
  if (!_invStaff) { _invFlash = { type: 'warn', text: 'Choose your name at the top first.' }; renderInventory(); return; }
  const fromStudioId = document.getElementById('inv-x-studio').value;
  const sku = document.getElementById('inv-x-sku').value;
  const qty = Number(document.getElementById('inv-x-qty').value);
  if (!fromStudioId || !sku || !Number.isInteger(qty) || qty < 1 || qty > 20) {
    _invFlash = { type: 'warn', text: 'Pick a studio, an item, and a number of boxes (1–20).' };
    renderInventory();
    return;
  }
  const item = (_inv.items || []).find(i => i.sku === sku);
  if (!confirm(`Ask ${invStudioName(fromStudioId)} for ${qty} × ${invDisplayName(item ? item.name : sku)}?`)) return;

  _invBusy = true;
  try {
    await invCall('transfer_request', { fromStudioId, sku, qty, staffName: _invStaff });
    _invFlash = { type: 'ok', text: `✅ Request sent to ${invStudioName(fromStudioId)}. It'll show here when they send it.` };
  } catch (e) {
    _invFlash = { type: 'err', text: e.message };
  }
  _invBusy = false;
  await loadInventory();
}

async function invTransfer(transferId, transferAction) {
  if (_invBusy) return;
  if (!_invStaff) { _invFlash = { type: 'warn', text: 'Choose your name at the top first.' }; renderInventory(); return; }
  const x = (_inv.transfers || []).find(t => t.id === transferId);
  const desc = x ? `${x.qty} × ${invDisplayName(x.name)}` : 'this transfer';
  const other = x ? invStudioName(x.otherStudioId) : 'the other studio';
  const prompts = {
    send: `Send ${desc} to ${other}? Only confirm once the boxes are on their way.`,
    decline: `Tell ${other} you can't spare ${desc}?`,
    cancel: `Cancel your request for ${desc}?`,
    receive: `Confirm ${desc} arrived from ${other}?`
  };
  if (!confirm(prompts[transferAction])) return;

  _invBusy = true;
  try {
    await invCall('transfer_update', { transferId, transferAction, staffName: _invStaff });
    const done = { send: 'Marked as sent.', decline: 'Request declined.', cancel: 'Request cancelled.', receive: 'Marked as received. Thanks!' };
    _invFlash = { type: 'ok', text: `✅ ${done[transferAction]}` };
  } catch (e) {
    _invFlash = { type: 'err', text: e.message };
  }
  _invBusy = false;
  await loadInventory();
}

if (INVENTORY_LIVE) {
  const navInv = document.getElementById('nav-inventory');
  if (navInv) { navInv.classList.remove('dev-only'); const g = navInv.closest('.nav-group'); if (g) g.classList.remove('dev-only'); }   // (Nov 14 2026: its section too)
} else {
  const navInv = document.getElementById('nav-inventory'); if (navInv) navInv.classList.add('dev-only');   // (not live: admin preview only)
}

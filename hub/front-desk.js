// hub/front-desk.js: 🛒 Front desk (book for a family, retail, parties, camps, classes, the cart, paying through camp-checkout
// staff mode, waiting to pay, returns & exchanges, who's here now) plus the family card's partner pricing and saved cards.
// Moved out of hub.html (Nov 11 2026) and opened from the studio view with each staff member's own PIN (🔑 Who's selling).
// Loaded by hub.html after its main script.
// (The PIN box is a plain text box shown as dots, so browsers don't offer to save it as a password.)
// (Nov 13 2026) 🚶 Walk-ins are paid here like everything else: 🛒 Add to cart sets up the hidden walk-in time (hub_walkin_prepare,
// priced by the project's World workshop) and puts it in the cart; paid → recorded as a walk-in with its project and price.
// "Already paid on Shopify POS" stays as a small link until POS is retired (it records without charging).
// (Nov 13 2026) 🚶 Walk-in form: Glazing, or a workshop: the project first, and its price follows from its World workshop (staff choose
// only when a project has no World price, or tap “change”).
// (Nov 13 2026) 🚶 Walk-ins (hub_walkins.sql): a walk-in for something not on the schedule (glazing, or a workshop at a price tier),
// with the customer and project, paid on Shopify POS for now; and any sale paid here in person (QR code or card at the desk) for
// something at this studio today is recorded as a walk-in too. Both go to hub_walk_ins, for schedule planning.

// ---------- 🛒 Front desk (hub_pos.sql + camp-checkout staff mode) ----------
// One cart on the right for everything; tabs across the top are different ways to add to it. Everything here is paid
// through Stripe (camp-checkout, staff mode), priced exactly as 4Cats World prices it: a QR code on this screen
// (10 minutes) or an emailed / copied pay link (24 hours). Paid → bookings, emails and class lists as from World.
const FD_BANDS = [['k57', 'Kids 5–7'], ['k811', 'Kids 8–11'], ['k1215', 'Kids 12–15'], ['adult', 'Adults (16+)']];
const FD_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FD_TABS = [['today', '📅 Today'], ['ws', '🎨 Workshops & glazing'], ['classes', '🧒 Kids classes'], ['parties', '🎉 Parties'], ['camps', '🏕️ Camps'], ['retail', '🛍️ Retail'], ['extras', '➕ Extras & add-ons'], ['snacks', '🧃 Drinks & snacks']];
// (Nov 14 2026) the Extras & Add-ons collection (Hub → Products → Collections) has its own tab; its products come off Retail
const FD_EXTRAS = c => /extras?\s*(&|and|\+)\s*add[\s-]*ons?/i.test(String((c && c.name) || ''));
let _fd = null;
function fdNew() {
  return { studio: _sessionStudioId, tab: 'today', date: null, cart: [], fam: null, people: [], q: '', hits: null, newFam: false, gift: '', msg: '', busy: false,
    order: null, add: null, recent: null, showRecent: false,
    today: null, ws: null, wsF: { type: '', from: '', to: '', days: {}, part: '', q: '', sort: 'date', desc: false },
    cls: null, clsF: { name: '', days: {}, from: '', age: '', sort: 'start', desc: false }, camps: null, campPick: {} };
}
// From the Schedule's open party slot: the Front desk's Parties, straight to that day and time
function planBookParty(date, time) {
  openFrontDesk();
  _fd.tab = 'parties'; _fd.ptyDate = date; _fd.ptyMonth = date.slice(0, 7); _fd.ptyWant = { date, time }; _fd.add = null;
  fdRender(); fdLoadTab();
  if (_fd.ptys && !_fd.ptys.err) fdPtyGoWant();
}
function fdPtyGoWant() {
  const W = _fd.ptyWant; if (!W || !Array.isArray(_fd.ptys)) return; _fd.ptyWant = null;
  const at = _fd.ptys.filter(x => x.session_date === W.date && String(x.session_time).slice(0, 5) === W.time && (x.spaces_left_cache ?? 0) > 0);
  const pick = at.find(x => fdPtyKind(x) === 'kids') || at[0];
  if (pick) { _fd.ptyKind = fdPtyKind(pick); fdPtyOpen(pick.id); } else fdRender();
}
function openFrontDesk() {
  const wasOpen = paneVisible('fd-pane') || paneVisible('families-pane');   // (Front desk and Families share one PIN unlock)
  showOnlyPane('fd-pane'); setActiveNav('nav-fd');
  if (!_fd || _fd.studio !== _sessionStudioId) { _fd = fdNew(); _fdSeller = null; }   // (another studio: a fresh cart, and a new PIN)
  if (!wasOpen) _fdSeller = null;                                                        // (opened again: whoever's at the desk enters their PIN)
  if (!_fd.date) _fd.date = fdToday();
  fdRender();
  if (fdNeedsPin()) { if (_sessionPin) fdPinGo(_sessionPin, true); return; }   // (coordinator view already unlocked: their PIN)
  fdLoadTab(); fdWaitLoad(); fdWaitTick();
}
// 🔑 (Nov 11 2026) Who's selling: each staff member's own PIN (hub_fd_pin_who: a staff PIN at this studio with Front desk on the
// Access page). Home office logins don't need one. It locks after 1 minute with no taps here, or when Front desk is left.
let _fdSeller = null;   // { pin, name, last }
const FD_IDLE_MS = 60 * 1000;   // (Nov 11 2026: 1 minute)
function fdNeedsPin() { return !(_studioData && _studioData.isAdmin) && !_fdSeller; }
function fdPin() { return _fdSeller ? _fdSeller.pin : (_sessionPin || null); }
function fdSellerLock() { _fdSeller = null; if (paneVisible('fd-pane')) fdRender(); if (paneVisible('families-pane') && typeof famDeskGate === 'function') famDeskGate(); }
function fdPinHtml(title) {
  return `<div class="fd-top"><div class="pts-page-title" style="margin:0">${title || '🛒 Front desk'}</div><span class="fd-studio">${esc(STUDIO_NAMES[_sessionStudioId] || _sessionStudioId || '')}</span></div>
    <div class="fd-pinbox" style="max-width:340px;margin:40px auto;text-align:center">
      <p style="font-size:17px;margin:0 0 6px"><b>Who’s at the desk?</b></p>
      <p class="fd-sm" style="margin:0 0 14px">Enter your PIN (the one you punch in with). Everything you sell or book is saved under your name.</p>
      <input id="fd-pin" type="text" name="fd-desk-code" inputmode="numeric" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore maxlength="4" pattern="[0-9]*" placeholder="••••"
        style="font-size:28px;letter-spacing:10px;text-align:center;width:180px;padding:10px;border-radius:12px;border:1px solid #ccc;-webkit-text-security:disc;text-security:disc"
        oninput="if(this.value.replace(/\\D/g,'').length===4)fdPinGo(this.value)" onkeydown="if(event.key==='Enter')fdPinGo(this.value)">
      <div id="fd-pin-msg" class="fd-sm" style="margin-top:10px;min-height:18px"></div></div>`;
}
async function fdPinGo(pin, quiet) {
  pin = String(pin || '').replace(/\D/g, '');
  const msg = document.getElementById('fd-pin-msg');
  if (pin.length !== 4) { if (msg && !quiet) msg.textContent = 'Your PIN is 4 numbers.'; return; }
  if (msg) msg.textContent = 'Checking…';
  const { data, error } = await sb.rpc('hub_fd_pin_who', { p_pin: pin, p_studio: _sessionStudioId });
  if (error || !data || !data.ok) {
    const m = document.getElementById('fd-pin-msg'), i = document.getElementById('fd-pin');
    if (m) m.textContent = quiet ? '' : (error ? (/hub_fd_pin_who/.test(error.message) ? 'Run the Front desk PIN SQL in Supabase first.' : error.message) : 'That PIN didn’t work.');
    if (i) { i.value = ''; i.focus(); }
    return;
  }
  _fdSeller = { pin, name: data.name || 'Staff', fam: data.families || 'none', last: Date.now() };
  if (paneVisible('families-pane') && typeof openFamiliesPane === 'function') { openFamiliesPane(); return; }
  fdRender(); fdLoadTab(); fdWaitLoad(); fdWaitTick();
}
document.addEventListener('pointerdown', e => { if (_fdSeller && e.target && e.target.closest && e.target.closest('#fd-pane, #families-pane')) _fdSeller.last = Date.now(); }, true);
document.addEventListener('keydown', e => { if (_fdSeller && e.target && e.target.closest && e.target.closest('#fd-pane, #families-pane')) _fdSeller.last = Date.now(); }, true);
setInterval(() => {
  if (!_fdSeller) return;
  if (_fd && _fd.order && _fd.order.status === 'pending' && paneVisible('fd-pane')) { _fdSeller.last = Date.now(); return; }   // (waiting for a family to pay: never lock mid-payment)
  if (!(paneVisible('fd-pane') || paneVisible('families-pane')) || Date.now() - _fdSeller.last > FD_IDLE_MS) fdSellerLock();
}, 5000);
const fdToday = () => new Date().toLocaleDateString('en-CA');
const fdAddDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const fdMoney = n => '$' + Number(n || 0).toFixed(2);
const fdDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const fdDow = d => new Date(String(d).slice(0, 10) + 'T12:00:00').getDay();
const fdTime = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? 'pm' : 'am'); };
const fdClean = t => String(t || '').split('|')[0].trim();
function fdAge(dob, on) { if (!dob) return null; const [y, m, d] = dob.split('-').map(Number), [Y, M, D] = (on || fdToday()).split('-').map(Number); let a = Y - y; if (M < m || (M === m && D < d)) a--; return a; }
const fdIsCamp = t => /camp|\bp[ad]\s*(\/\s*p[ad])?\s*day|pro-?\s*d\b|no[\s-]school/i.test(t || '');
const FD_KIND = { workshop: 'Workshop', workshops: 'Workshop', mini_make: 'Mini Make', glazing: 'Glazing' };

// ---------- Loading each tab's data ----------
async function fdLoadTab() {
  const F = _fd, st = F.studio;
  if (F.tab === 'today') {
    F.today = null; fdRender();
    const { data, error } = await sb.from('sessions').select('id, title, session_date, session_time, capacity, spaces_left_cache, world_item_id, world_class_slot_id, kids_only, show')
      .eq('studio_id', st).eq('session_date', F.date).order('session_time').limit(200);
    if (error) { F.today = { err: error.message }; fdRender(); return; }
    const slots = [...new Set((data || []).map(x => x.world_class_slot_id).filter(Boolean))], firstOf = {};
    if (slots.length) { const r = await sb.from('sessions').select('world_class_slot_id, session_date').in('world_class_slot_id', slots).order('session_date');
      (r.data || []).forEach(x => { if (!firstOf[x.world_class_slot_id]) firstOf[x.world_class_slot_id] = x.session_date; }); }
    const items = await fdItems((data || []).map(x => x.world_item_id));
    F.today = (data || []).filter(x => x.show !== false).map(x => Object.assign(x, { item: items[x.world_item_id] || null, first: x.world_class_slot_id ? firstOf[x.world_class_slot_id] : null }));
  } else if (F.tab === 'ws' && !F.ws) {
    fdRender();
    const { data, error } = await sb.from('sessions').select('id, title, session_date, session_time, capacity, spaces_left_cache, world_item_id, kids_only, show')
      .eq('studio_id', st).gte('session_date', fdToday()).lte('session_date', fdAddDays(fdToday(), 90)).not('world_item_id', 'is', null).order('session_date').order('session_time').limit(2000);
    if (error) { F.ws = { err: error.message }; fdRender(); return; }
    const items = await fdItems((data || []).map(x => x.world_item_id));
    F.ws = (data || []).filter(x => x.show !== false).map(x => Object.assign(x, { item: items[x.world_item_id] || {} }));
  } else if (F.tab === 'classes' && !F.cls) {
    fdRender(); await fdLoadClasses();
  } else if (F.tab === 'parties' && !F.ptys) {
    fdRender();
    const { data, error } = await sb.from('sessions').select('id, title, session_date, session_time, spaces_left_cache, capacity, world_party, show')
      .eq('studio_id', st).gte('session_date', fdToday()).lte('session_date', fdAddDays(fdToday(), 400)).order('session_date').order('session_time').limit(4000);
    if (error) { F.ptys = { err: error.message }; fdRender(); return; }
    // (a party kind at 0 spots is a leftover, e.g. Splatter where the studio doesn't offer it: not shown)
    F.ptys = (data || []).filter(x => x.show !== false && fdPtyKind(x) && (x.capacity == null || Number(x.capacity) > 0));
    if (F.ptyWant) setTimeout(fdPtyGoWant, 0);
    if (!F.ptyP) { try { const r = await sb.from('world_site_settings').select('value').eq('key', 'party_pricing').maybeSingle(); F.ptyP = r.data && r.data.value ? JSON.parse(r.data.value) : {}; } catch (e) { F.ptyP = {}; } }
    // World settings → Parties: which studios offer splatter, and each one's maximum (the same list World's Parties page uses)
    if (!F.ptyPage || F.ptyPage.__err) await fdPtyPageLoad();   // (World settings → Parties: project lists, colours, splatter studios)
  } else if ((F.tab === 'retail' || F.tab === 'snacks' || F.tab === 'extras') && !F.shop) {
    fdRender();
    const { data, error } = await sb.rpc('hub_fd_retail', { p_studio: st });
    F.shop = error ? { err: /hub_fd_retail/.test(error.message) ? 'Run fd_retail.sql in Supabase first.' : error.message } : (data || { products: [], collections: [] });
    fdStockLoad();
  } else if (F.tab === 'camps' && !F.camps) {
    fdRender();
    const { data, error } = await sb.from('sessions').select('id, title, session_date, session_time, capacity, spaces_left_cache, show')
      .eq('studio_id', st).gte('session_date', fdToday()).lte('session_date', fdAddDays(fdToday(), 430)).order('session_date').limit(5000);
    if (error) { F.camps = { err: error.message }; fdRender(); return; }
    F.camps = (data || []).filter(x => x.show !== false && fdIsCamp(x.title));
  }
  fdRender();
}
// Kids classes: every class starting soon, with its ages and the class that follows it (Part 2)
async function fdLoadClasses() {
  const F = _fd, st = F.studio;
  const { data, error } = await sb.from('sessions').select('id, title, session_date, session_time, capacity, spaces_left_cache, world_class_slot_id, show')
    .eq('studio_id', st).not('world_class_slot_id', 'is', null).gte('session_date', fdAddDays(fdToday(), -200)).lte('session_date', fdAddDays(fdToday(), 300)).order('session_date').limit(3000);
  if (error) { F.cls = { err: error.message }; return; }
  const by = {}; (data || []).forEach(x => { if (x.show === false) return; (by[x.world_class_slot_id] = by[x.world_class_slot_id] || []).push(x); });
  let info = {};
  try { const r = await sb.from('world_class_slots').select('id, min_age, max_age, part_label, family, follows_slot, class_page_id, world_class_pages(name, min_age, max_age, both_pct, both_everyone)').in('id', Object.keys(by));
    (r.data || []).forEach(x => { info[x.id] = x; }); } catch (e) { /* ages unknown */ }
  const all = Object.keys(by).map(k => { const w = by[k], first = w[0], I = info[k] || {}, P = I.world_class_pages || {};
    return { slot_id: k, weeks: w.length, first, name: P.name || fdClean(first.title), part: I.part_label || '', family: !!I.family, follows: I.follows_slot || null, page: I.class_page_id || null,
      bothPct: Number(P.both_pct) || 0, bothAll: !!P.both_everyone, min: I.min_age ?? P.min_age ?? null, max: I.max_age ?? P.max_age ?? null,
      left: Math.min(...w.map(x => x.spaces_left_cache ?? 0)), cap: first.capacity }; });
  F.clsAll = all;
  F.cls = all.filter(c => c.first.session_date >= fdToday());
}
// The part that follows a class (Part 2), if there is one with room
function fdPart2(c) { return (_fd.clsAll || []).find(x => x.follows === c.slot_id && x.first.session_date >= fdToday()) || null; }
const _fdItemCache = {};
async function fdItems(ids) {
  const need = [...new Set(ids.filter(Boolean))].filter(id => !_fdItemCache[id]);
  if (need.length) { const r = await sb.from('world_items').select('id, title, kind, treats, min_age, max_age, kids_min_age, kids_max_age').in('id', need); (r.data || []).forEach(x => { _fdItemCache[x.id] = x; }); }
  const out = {}; ids.forEach(id => { if (id && _fdItemCache[id]) out[id] = _fdItemCache[id]; }); return out;
}

// ---------- The page ----------
function fdRender() {
  const el = document.getElementById('fd-pane'); if (!el || !_fd) return;
  if (fdNeedsPin()) { el.innerHTML = fdPinHtml(); setTimeout(() => { const i = document.getElementById('fd-pin'); if (i && document.activeElement !== i) i.focus(); }, 60); return; }
  const F = _fd;
  let h = `<div class="fd-testing">🚧 <b>Being tested.</b> Please don’t use the Front desk for real bookings yet: keep booking the usual way until home office says it’s ready.</div>
    <div class="fd-top"><div class="pts-page-title" style="margin:0">🛒 Front desk</div><span class="fd-studio">${esc(STUDIO_NAMES[F.studio] || F.studio || '')}</span>${_fdSeller ? `<span class="fd-studio" title="Locks after 1 minute with no taps">🔑 Selling as <b>${esc(_fdSeller.name)}</b> <button class="ho-btn sm" onclick="fdSellerLock()">Lock</button></span>` : ''}<span class="spacer"></span>
    ${fdWaitChipHtml()}<button class="ho-btn" onclick="fdWalkOpen()" title="Someone came in for glazing or a workshop that isn’t on the schedule">🚶 Walk-in</button><button class="ho-btn" onclick="fdRetOpen()" title="A kit brought back: credit, or swap it for another">↩ Returns & exchanges</button><button class="ho-btn" onclick="fdRecentOpen()">Recent orders</button></div>
    <div class="fd-tabs" role="tablist">${FD_TABS.map(t => `<button role="tab" class="fd-tab${F.tab === t[0] ? ' on' : ''}" onclick="_fd.tab='${t[0]}';fdRender();fdLoadTab()">${t[1]}</button>`).join('')}</div>
    <div class="fd-wrap"><div class="fd-main">${fdMainHtml()}</div><aside class="fd-cart">${fdCartHtml()}</aside></div>`;
  if (F.add) h += fdAddHtml();
  if (F.shopPick) h += fdShopPickHtml();
  if (F.stockSheet) h += fdStockSheetHtml();
  if (F.order) h += fdPayHtml();
  if (F.showRecent) h += fdRecentHtml();
  if (_fdWait.open) h += fdWaitHtml();
  if (_fdHere.open) h += fdHereHtml();
  if (_fdRet.open) h += fdRetHtml();
  if (_fdWalk.open) h += fdWalkHtml();
  // keep typing where it was (search boxes redraw the table as you type)
  const ae = document.activeElement, keepId = ae && ae.id && el.contains(ae) ? ae.id : null, pos = keepId && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
  el.innerHTML = h;
  if (keepId) { const n = document.getElementById(keepId); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) {} } }
  if (F.order) fdQrDraw();
  fdQuoteSoon();
}
function fdMainHtml() {
  const F = _fd;
  if (F.tab === 'today') return fdTodayHtml();
  if (F.tab === 'ws') return fdWsHtml();
  if (F.tab === 'classes') return fdClsHtml();
  if (F.tab === 'camps') return fdCampsHtml();
  if (F.tab === 'parties') return fdPtyHtml();
  if (F.tab === 'retail') return fdShopHtml(false);
  if (F.tab === 'snacks') return fdShopHtml(true);
  if (F.tab === 'extras') return fdShopHtml(false, true);   // (Nov 10 2026: drinks and snacks are products of the kind "Snack or drink")
  const soon = { retail: ['🛍️', 'Retail', 'Product tiles to tap, once the product list (names, prices, tax) is set up.'], snacks: ['🧃', 'Drinks & snacks', 'Drinks and snack tiles to tap, once the product list (names, prices, tax) is set up.'] }[F.tab];
  return `<div class="fd-soon"><div class="fd-soon-ic">${soon[0]}</div><b>${soon[1]}</b><p class="fd-sm">${soon[2]}</p></div>`;
}
const fdLoading = '<p class="fd-sm">Loading…</p>';
// ---- 🛍️ Retail (fd_retail.sql): the kits and other shop items this studio sells, as tiles to tap ----
// Grouped by collection (e.g. Ditto kits → 4-piece kits, 8-piece kits, more). Search by name, SKU or barcode (a scanner types the
// barcode and Enter: an exact match goes straight in the cart). Prices show as a guide; checkout prices them again.
// (Nov 10 2026) this studio's stock (retail_stock.sql): a badge on each tile, and 📦 Stock here (make up kits, open a torn one)
async function fdStockLoad() {
  const F = _fd; const { data, error } = await sb.rpc('hub_retail_stock', { p_studio: F.studio });
  F.stock = error ? null : Object.fromEntries((data || []).map(x => [x.variant_id, x]));
  try { const d2 = await sb.rpc('hub_drink_supplies', { p_studio: F.studio }); F.drinkSup = d2.error ? null : (d2.data || []); } catch (e) { F.drinkSup = null; }   // (drink_supplies_held.sql)
  fdRender();
}
function fdStockBadge(p) {
  const S = _fd.stock; if (!S) return '';
  const vs = (p.variants || []).map(v => S[v.id]).filter(Boolean); if (!vs.length) return '';
  const n = vs.reduce((t, x) => t + rpN((x.on_hand || {})[_fd.studio]) - rpN((x.held || {})[_fd.studio]), 0);
  return n > 0 ? `<span class="fd-stk">${n} here</span>` : '<span class="fd-stk out">none here</span>';
}
function fdStockOpen(snacks) { _fd.stockSheet = { snacks }; fdRender(); }
function fdStockSheetHtml() {
  const F = _fd, S = F.stock || {}, snacks = F.stockSheet.snacks;
  const P = ((F.shop || {}).products || []).filter(p => (p.category === 'snack') === !!snacks);
  const rows = P.flatMap(p => (p.variants || []).map(v => ({ p, v, x: S[v.id] }))).filter(r => r.x);
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_fd.stockSheet=null;fdRender()}"><div class="fd-sheet" style="max-width:720px"><h3>📦 Stock at ${esc(STUDIO_NAMES[F.studio] || F.studio)}</h3>
    <p class="fd-sm">Sales count down by themselves. Kits sent from the warehouse arrive in <b>Supplies → Transfers</b>: tap Received there.${snacks ? ' Held = hot chocolates and candy bags booked with upcoming workshops.' : ''}</p>
    ${!F.stock ? '<p class="fd-sm">Loading…</p>' : !rows.length ? '<p class="fd-sm">Nothing here yet.</p>' : `<div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr><th>Product</th><th class="num">Here</th>${snacks ? '<th class="num">Held</th><th class="num">Free</th>' : ''}<th class="num">Sold 30 days</th>${snacks ? '' : '<th></th>'}</tr></thead><tbody>` +
      rows.map(r => { const oh = rpN((r.x.on_hand || {})[F.studio]), hd = rpN((r.x.held || {})[F.studio]);
        return `<tr><td><b>${esc(r.p.name)}</b>${r.v.name && r.v.name !== 'Default' ? ' · ' + esc(r.v.name) : ''}</td><td class="num">${oh}</td>${snacks ? `<td class="num">${hd || ''}</td><td class="num${oh - hd <= 0 ? ' fd-warn' : ''}">${oh - hd}</td>` : ''}<td class="num">${rpN((r.x.sold30 || {})[F.studio]) || ''}</td>
          ${snacks ? '' : `<td style="white-space:nowrap">${(r.x.parts || []).length ? `<button class="ho-btn sm" onclick="fdStockKits('make_kits','${r.v.id}')" title="From this studio’s own stock and packaging">Make kits</button> <button class="ho-btn sm" onclick="fdStockKits('open_kits','${r.v.id}')" title="Torn or broken packaging: its clay goes back into studio stock">Open a kit</button>` : '<span class="fd-sm">no parts set</span>'}</td>`}</tr>`; }).join('') + '</tbody></table></div>'}
    ${snacks && Array.isArray(F.drinkSup) && F.drinkSup.length ? `<h4 style="margin:16px 0 4px">☕ For hot drinks</h4><p class="fd-sm">Cups, lids, sleeves and tea bags. Held = what the hot chocolates booked with upcoming workshops will use.</p>
      <div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr><th>Supply</th><th class="num">Here</th><th class="num">Held</th><th class="num">Free</th></tr></thead><tbody>` +
      F.drinkSup.map(x => { const oh = rpN(x.on_hand), hd = rpN(x.held); return `<tr><td>${esc(x.name)} <span class="fd-sm">(${esc(x.unit)})</span></td><td class="num">${oh}</td><td class="num">${hd || ''}</td><td class="num${oh - hd <= 0 ? ' fd-warn' : ''}">${rpN(oh - hd)}</td></tr>`; }).join('') + '</tbody></table></div>' : ''}
    <div class="sheet-actions"><button onclick="_fd.stockSheet=null;fdRender()">Close</button></div></div></div>`;
}
async function fdStockKits(kind, vid) {
  const x = (_fd.stock || {})[vid]; if (!x) return;
  const parts = (x.parts || []).map(pp => pp.qty + ' × ' + pp.name).join(', ');
  const q = prompt(kind === 'make_kits' ? `How many ${x.product} kits did you make up?\n\nEach one takes ${parts} off this studio’s stock.` : `How many ${x.product} kits are torn or broken?\n\nEach one comes off the kits, and ${parts} goes back into this studio’s stock.`, '1');
  if (q === null || !(+q > 0)) return;
  const { error } = await sb.rpc('hub_retail_stock_move', { p: { kind, loc: _fd.studio, variant_id: vid, qty: Math.floor(+q) } });
  if (error) { alert(error.message); return; }
  await fdStockLoad();
}
function fdShopIn(p, c) {
  const t = new Set((p.tags || []).map(x => String(x).toLowerCase()));
  return ((c.tags || []).some(x => t.has(x)) || (c.product_ids || []).includes(p.id)) && !(c.hidden_ids || []).includes(p.id);
}
function fdShopPrice(p, v) {
  const reg = Number((v && v.price) ?? p.price), mem = (v && v.member_price) ?? p.member_price, sale = p.sale_price;
  const fam = _fd.fam && !_fd.fam.walk_in && _fd.fam.member;
  let now = reg, lab = '';
  if (sale != null && Number(sale) < now) { now = Number(sale); lab = 'sale'; }
  if (fam && mem != null && Number(mem) < now) { now = Number(mem); lab = '⭐ member'; }
  return { reg, now, lab, mem: !fam && mem != null && Number(mem) < reg ? Number(mem) : null };
}
function fdShopHtml(snacks, extras) {
  const F = _fd, S = F.shop;
  if (!S) return fdLoading; if (S.err) return '<p class="fd-msg">' + esc(S.err) + '</p>';
  const XC = (S.collections || []).find(FD_EXTRAS) || null;
  let P = (S.products || []).filter(p => (p.category === 'snack') === !!snacks), C = (S.collections || []).filter(c => P.some(p => fdShopIn(p, c)));
  if (extras) {   // ➕ the Extras & add-ons tab: that collection only (any kind of product)
    if (!XC) return '<div class="fd-soon"><div class="fd-soon-ic">➕</div><b>No Extras & add-ons yet.</b><p class="fd-sm">In Home office → 🛍️ Products → 🗂️ Collections, make a collection called “Extras & Add-ons” and tick <b>At the front desk</b> on its products.</p></div>';
    P = (S.products || []).filter(p => fdShopIn(p, XC)); C = [];
  } else if (XC) {   // Retail: the extras live on their own tab (unless they're in another collection too)
    const others = (S.collections || []).filter(c => c !== XC);
    P = P.filter(p => !fdShopIn(p, XC) || others.some(c => fdShopIn(p, c))); C = C.filter(c => c !== XC);
  }
  const q = (F.shopQ || '').trim().toLowerCase(), col = extras ? XC : C.find(c => c.id === F.shopCol) || null;
  let h = `<div class="fd-filters"><button class="ho-btn" onclick="fdStockOpen(${snacks ? 'true' : 'false'})" title="What this studio has, and making up or opening kits">📦 Stock here</button><input id="fd-shopq" type="search" placeholder="Search a name, tag or SKU" value="${esc(F.shopQ || '')}" oninput="_fd.shopQ=this.value;clearTimeout(_fd.qt);_fd.qt=setTimeout(fdRender,200)" onkeydown="if(event.key==='Enter'){event.preventDefault();fdShopScan(this.value)}">
    <span class="fd-chips"${extras ? ' hidden' : ''}><button class="fd-chip${!col ? ' on' : ''}" onclick="_fd.shopCol='';fdRender()">All</button>${C.map(c => `<button class="fd-chip${col && col.id === c.id ? ' on' : ''}" onclick="_fd.shopCol='${c.id}';fdRender()">${esc(c.name)}</button>`).join('')}</span></div>`;
  if (!P.length) return h + '<div class="fd-soon"><div class="fd-soon-ic">' + (snacks ? '🧃' : '🛍️') + '</div><b>Nothing to sell here yet.</b><p class="fd-sm">In Home office → 🛍️ Products, tick <b>At the front desk</b> on a product (and this studio, or every studio).</p></div>';
  const match = p => !q || (p.name + ' ' + (p.tags || []).join(' ') + ' ' + (p.variants || []).map(v => (v.sku || '') + ' ' + (v.barcode || '')).join(' ')).toLowerCase().includes(q);
  const tile = p => { const V = p.variants || [], pr = fdShopPrice(p, V[0]), pic = (p.images || [])[0], inCart = F.cart.filter(l => l.type === 'retail' && l.product_id === p.id).reduce((t, l) => t + l.qty, 0);
    // (Nov 10 2026) see-through pictures (PNG, WebP, SVG, like the snack and drink drawings) show whole; photos fill the square
    const fit = pic && /\.(png|webp|svg)(\?|$)/i.test(pic) ? ' fit' : '';
    return `<button class="fd-shop-tile" onclick="fdShopTap('${p.id}')">${pic ? `<img class="${fit.trim()}" src="${escAttr(pic)}" alt="" loading="lazy">` : '<span class="fd-shop-nopic">🛍️</span>'}
      <b>${esc(p.name)}</b><span class="fd-shop-pr">${pr.now < pr.reg ? `<s>${fdMoney(pr.reg)}</s> ` : ''}${fdMoney(pr.now)}${pr.lab ? ` <small>${esc(pr.lab)}</small>` : ''}${pr.mem != null ? ` <small>⭐ ${fdMoney(pr.mem)}</small>` : ''}</span>
      ${V.length > 1 ? `<span class="fd-sm">${V.length} options</span>` : ''}${inCart ? `<span class="fd-shop-in">${inCart} in cart</span>` : ''}${fdStockBadge(p)}</button>`; };
  const list = P.filter(match).filter(p => !col || fdShopIn(p, col));
  if (!list.length) return h + '<p class="fd-sm">Nothing matches.</p>';
  if (col) {   // by section, in the collection's order
    const secOf = p => { const t = new Set((p.tags || []).map(x => String(x).toLowerCase())); return (col.sections || []).findIndex(s2 => (s2.tags || []).some(x => t.has(x))); };
    const groups = (col.sections || []).map((s2, i) => ({ title: s2.title, list: list.filter(p => secOf(p) === i) })).concat([{ title: col.more_title || 'More', list: list.filter(p => secOf(p) < 0) }]).filter(g => g.list.length);
    return h + groups.map(g => `<h4 class="fd-shop-h">${esc(g.title)} <span class="fd-sm">${g.list.length}</span></h4><div class="fd-shop-grid">${g.list.map(tile).join('')}</div>`).join('');
  }
  return h + `<div class="fd-shop-grid">${list.map(tile).join('')}</div>`;
}
function fdShopAdd(p, v, qty) {
  const F = _fd, ex = F.cart.find(l => l.type === 'retail' && l.variant_id === v.id);
  if (ex) ex.qty = Math.min(50, ex.qty + qty);
  else F.cart.push({ type: 'retail', variant_id: v.id, product_id: p.id, qty, title: p.name + (v.name && v.name !== 'Default' ? ' · ' + v.name : ''), desc: v.sku ? 'SKU ' + v.sku : '' });
  F.shopPick = null; F.msg = ''; fdRender();
}
function fdShopTap(id) {
  const p = ((_fd.shop || {}).products || []).find(x => x.id === id); if (!p) return;
  const V = p.variants || []; if (!V.length) { alert('This product has no options switched on.'); return; }
  if (V.length === 1) { fdShopAdd(p, V[0], 1); return; }
  _fd.shopPick = { id, qty: 1 }; fdRender();
}
function fdShopQty(i, d) { const l = _fd.cart[i]; if (!l) return; l.qty += d; if (l.qty < 1) _fd.cart.splice(i, 1); else if (l.qty > 50) l.qty = 50; fdRender(); }
function fdShopScan(val) {   // an exact SKU or barcode: straight into the cart
  const code = String(val || '').trim().toUpperCase(); if (!code) return;
  for (const p of ((_fd.shop || {}).products || [])) for (const v of (p.variants || []))
    if (String(v.sku || '').toUpperCase() === code || String(v.barcode || '').toUpperCase() === code) { _fd.shopQ = ''; fdShopAdd(p, v, 1); return; }
}
function fdShopPickHtml() {
  const S = _fd.shopPick, p = ((_fd.shop || {}).products || []).find(x => x.id === S.id); if (!p) return '';
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_fd.shopPick=null;fdRender()}"><div class="fd-sheet" role="dialog" aria-modal="true"><h3>${esc(p.name)}</h3>
    ${(p.images || [])[0] ? `<img src="${escAttr(p.images[0])}" alt="" style="max-width:180px;border-radius:12px;display:block;margin:0 0 10px">` : ''}
    <div class="fd-shop-opts">${(p.variants || []).map(v => { const pr = fdShopPrice(p, v);
      return `<button class="fd-book" onclick="fdShopAdd(((_fd.shop||{}).products||[]).find(x=>x.id==='${p.id}'), ((_fd.shop||{}).products||[]).find(x=>x.id==='${p.id}').variants.find(x=>x.id==='${v.id}'), _fd.shopPick.qty)">${esc(v.name || 'Default')} · ${fdMoney(pr.now)}</button>`; }).join('')}</div>
    <p class="fd-sm" style="margin-top:10px">How many <span class="fd-qty"><button onclick="_fd.shopPick.qty=Math.max(1,_fd.shopPick.qty-1);fdRender()">−</button><b>${S.qty}</b><button onclick="_fd.shopPick.qty=Math.min(50,_fd.shopPick.qty+1);fdRender()">+</button></span></p>
    <div class="fd-sheet-btns"><button class="ho-btn" onclick="_fd.shopPick=null;fdRender()">Cancel</button></div></div></div>`;
}
// ---- 📅 Today ----
function fdTodayHtml() {
  const F = _fd, isToday = F.date === fdToday(), R = F.today;
  let h = `<div class="fd-datebar"><button class="fd-arrow" onclick="_fd.date=fdAddDays(_fd.date,-1);fdLoadTab()" aria-label="Previous day">‹</button>
    <div class="fd-date"><b>${isToday ? 'Today' : esc(new Date(F.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' }))}</b><span>${esc(new Date(F.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }))}</span></div>
    <button class="fd-arrow" onclick="_fd.date=fdAddDays(_fd.date,1);fdLoadTab()" aria-label="Next day">›</button>
    <input type="date" value="${esc(F.date)}" onchange="if(this.value){_fd.date=this.value;fdLoadTab()}">${isToday ? '' : '<button class="ho-btn" onclick="_fd.date=fdToday();fdLoadTab()">Today</button>'}</div>`;
  if (!R) return h + fdLoading;
  if (R.err) return h + '<p class="fd-msg">' + esc(R.err) + '</p>';
  if (!R.length) return h + '<p class="fd-sm">Nothing on the schedule this day.</p>';
  return h + '<div class="fd-list">' + R.map(x => {
    const cap = x.capacity != null ? +x.capacity : null, left = x.spaces_left_cache != null ? +x.spaces_left_cache : null, booked = cap != null && left != null ? Math.max(0, cap - left) : null;
    const kind = x.world_item_id ? 'ws' : x.world_class_slot_id ? 'class' : fdIsCamp(x.title) ? 'camp' : null;
    const started = kind === 'class' && x.first && x.first < fdToday(), can = kind && left > 0 && !started;
    return `<div class="fd-row${left != null && left <= 0 ? ' full' : ''}"><div class="fd-time">${fdTime(x.session_time)}</div>
      <div class="fd-what"><b>${esc(fdClean(x.title))}</b><span class="fd-sm">${x.item ? esc(FD_KIND[x.item.kind] || 'Workshop') : kind === 'class' ? (x.first === x.session_date ? 'Kids class · Class 1' : 'Kids class · started ' + fdDay(x.first)) : kind === 'camp' ? 'Camp' : ''}${x.kids_only ? ' · kids only' : ''}</span></div>
      <div class="fd-count">${booked != null ? `<span class="fd-bk"><b>${booked}</b> booked</span>` : ''}${left != null ? `<span>${left > 0 ? left + ' left' : 'full'}</span>` : ''}</div>
      <div class="fd-act">${can ? `<button class="fd-book" onclick="fdAddFrom('${kind}','${kind === 'class' ? x.world_class_slot_id : x.id}')">Add</button>` : kind ? `<span class="fd-sm">${started ? 'Class started' : 'Full'}</span>` : ''}</div></div>`; }).join('') + '</div>';
}
// ---- 🎨 Workshops & glazing (spreadsheet) ----
function fdSortHead(key, label, f, tab) { return `<th><button class="fd-th${f.sort === key ? ' on' : ''}" onclick="fdSort('${tab}','${key}')">${label}${f.sort === key ? (f.desc ? ' ▼' : ' ▲') : ''}</button></th>`; }
function fdSort(tab, key) { const f = tab === 'ws' ? _fd.wsF : _fd.clsF; if (f.sort === key) f.desc = !f.desc; else { f.sort = key; f.desc = key === 'left' || key === 'booked'; } fdRender(); }
function fdDayChips(f, tab) { return '<span class="fd-chips">' + FD_DAYS.map((d, i) => `<button class="fd-chip${f.days[i] ? ' on' : ''}" onclick="_fd.${tab}F.days[${i}]=!_fd.${tab}F.days[${i}];fdRender()">${d}</button>`).join('') + '</span>'; }
function fdWsHtml() {
  const F = _fd, R = F.ws, f = F.wsF;
  let h = `<div class="fd-filters">
    <select onchange="_fd.wsF.type=this.value;fdRender()"><option value="">All types</option>${['workshop', 'mini_make', 'glazing'].map(k => `<option value="${k}"${f.type === k ? ' selected' : ''}>${FD_KIND[k]}</option>`).join('')}</select>
    <label>From <input type="date" value="${esc(f.from)}" onchange="_fd.wsF.from=this.value;fdRender()"></label><label>To <input type="date" value="${esc(f.to)}" onchange="_fd.wsF.to=this.value;fdRender()"></label>
    <select onchange="_fd.wsF.part=this.value;fdRender()"><option value="">Any time</option>${[['am', 'Morning'], ['pm', 'Afternoon'], ['eve', 'Evening (5pm+)']].map(x => `<option value="${x[0]}"${f.part === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select>
    <input id="fd-wsq" type="search" placeholder="Search a workshop" value="${esc(f.q)}" oninput="_fd.wsF.q=this.value;clearTimeout(_fd.qt);_fd.qt=setTimeout(fdRender,250)">
    ${fdDayChips(f, 'ws')}${f.type || f.from || f.to || f.part || f.q || Object.values(f.days).some(Boolean) ? '<button class="ho-btn" onclick="_fd.wsF=Object.assign(_fd.wsF,{type:\'\',from:\'\',to:\'\',part:\'\',q:\'\',days:{}});fdRender()">Clear</button>' : ''}</div>`;
  if (!R) return h + fdLoading; if (R.err) return h + '<p class="fd-msg">' + esc(R.err) + '</p>';
  const anyDay = Object.values(f.days).some(Boolean), q = f.q.trim().toLowerCase();
  let rows = R.filter(x => (!f.type || (x.item.kind === f.type || (f.type === 'workshop' && !['mini_make', 'glazing'].includes(x.item.kind))))
    && (!f.from || x.session_date >= f.from) && (!f.to || x.session_date <= f.to) && (!anyDay || f.days[fdDow(x.session_date)])
    && (!f.part || (() => { const hh = +String(x.session_time || '0').split(':')[0]; return f.part === 'am' ? hh < 12 : f.part === 'pm' ? hh >= 12 && hh < 17 : hh >= 17; })())
    && (!q || fdClean(x.title).toLowerCase().includes(q)));
  const val = x => ({ date: x.session_date + (x.session_time || ''), name: fdClean(x.title).toLowerCase(), type: x.item.kind || '', left: x.spaces_left_cache ?? 0, booked: (x.capacity ?? 0) - (x.spaces_left_cache ?? 0) })[f.sort];
  rows.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * (f.desc ? -1 : 1); });
  h += `<p class="fd-sm">${rows.length} time${rows.length === 1 ? '' : 's'} (next 90 days)</p><div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr>${fdSortHead('date', 'Date', f, 'ws')}<th>Time</th>${fdSortHead('name', 'Workshop', f, 'ws')}${fdSortHead('type', 'Type', f, 'ws')}<th>Ages</th>${fdSortHead('booked', 'Booked', f, 'ws')}${fdSortHead('left', 'Left', f, 'ws')}<th></th></tr></thead><tbody>` +
    rows.slice(0, 400).map(x => { const left = x.spaces_left_cache ?? 0, I = x.item || {};
      return `<tr class="${left <= 0 ? 'full' : ''}"><td>${fdDay(x.session_date)}</td><td>${fdTime(x.session_time)}</td><td><b>${esc(fdClean(x.title))}</b>${x.kids_only ? ' <span class="fd-pill">kids only</span>' : ''}</td><td>${esc(FD_KIND[I.kind] || 'Workshop')}</td>
        <td>${I.min_age != null ? esc(I.min_age + (I.max_age && I.max_age < 99 ? '–' + I.max_age : '+')) : ''}</td><td class="num">${x.capacity != null ? Math.max(0, x.capacity - left) : ''}</td><td class="num">${left > 0 ? left : 'full'}</td>
        <td>${left > 0 ? `<button class="fd-add" onclick="fdAddFrom('ws','${x.id}')">Add</button>` : ''}</td></tr>`; }).join('') + '</tbody></table></div>' + (rows.length > 400 ? '<p class="fd-sm">Showing the first 400. Narrow it down with the filters.</p>' : '');
  return h;
}
// ---- 🧒 Kids classes (spreadsheet) ----
function fdClsHtml() {
  const F = _fd, R = F.cls, f = F.clsF;
  const names = R && !R.err ? [...new Set(R.map(c => c.name))].sort() : [];
  let h = `<div class="fd-filters">
    <select onchange="_fd.clsF.name=this.value;fdRender()"><option value="">All classes</option>${names.map(n => `<option${f.name === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <label>Starting from <input type="date" value="${esc(f.from)}" onchange="_fd.clsF.from=this.value;fdRender()"></label>
    <label>Fits age <input id="fd-clsage" type="number" min="2" max="18" style="width:4.5em" value="${esc(f.age)}" oninput="_fd.clsF.age=this.value;clearTimeout(_fd.qt);_fd.qt=setTimeout(fdRender,250)"></label>
    ${fdDayChips(f, 'cls')}${f.name || f.from || f.age || Object.values(f.days).some(Boolean) ? '<button class="ho-btn" onclick="_fd.clsF=Object.assign(_fd.clsF,{name:\'\',from:\'\',age:\'\',days:{}});fdRender()">Clear</button>' : ''}</div>`;
  if (!R) return h + fdLoading; if (R.err) return h + '<p class="fd-msg">' + esc(R.err) + '</p>';
  const anyDay = Object.values(f.days).some(Boolean), age = f.age === '' ? null : +f.age;
  let rows = R.filter(c => (!f.name || c.name === f.name) && (!f.from || c.first.session_date >= f.from) && (!anyDay || f.days[fdDow(c.first.session_date)])
    && (age == null || ((c.min == null || age >= c.min) && (c.max == null || age <= c.max))));
  const val = c => ({ start: c.first.session_date + (c.first.session_time || ''), name: (c.name + c.part).toLowerCase(), day: fdDow(c.first.session_date) * 10000 + +String(c.first.session_time || '0').replace(':', '').slice(0, 4), left: c.left, age: c.min ?? 0 })[f.sort];
  rows.sort((a, b) => { const A = val(a), B = val(b); return (A < B ? -1 : A > B ? 1 : 0) * (f.desc ? -1 : 1); });
  h += `<p class="fd-sm">${rows.length} class${rows.length === 1 ? '' : 'es'} starting soon</p><div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr>${fdSortHead('name', 'Class', f, 'cls')}${fdSortHead('day', 'Day', f, 'cls')}${fdSortHead('start', 'Starts', f, 'cls')}<th>Time</th><th class="num">Weeks</th>${fdSortHead('age', 'Ages', f, 'cls')}${fdSortHead('left', 'Left', f, 'cls')}<th></th></tr></thead><tbody>` +
    rows.map(c => `<tr class="${c.left <= 0 ? 'full' : ''}"><td><b>${esc(c.name)}</b>${c.part ? ' <span class="fd-sm">' + esc(c.part) + '</span>' : ''}${c.family ? ' <span class="fd-pill">family</span>' : ''}${fdPart2(c) ? ' <span class="fd-pill">+ part 2</span>' : ''}</td><td>${FD_DAYS[fdDow(c.first.session_date)]}</td><td>${fdDay(c.first.session_date)}</td><td>${fdTime(c.first.session_time)}</td>
      <td class="num">${c.weeks}</td><td>${c.min != null ? esc(c.min + (c.max != null && c.max < 99 ? '–' + c.max : '+')) : ''}</td><td class="num">${c.left > 0 ? c.left : 'full'}</td>
      <td>${c.left > 0 ? `<button class="fd-add" onclick="fdAddFrom('class','${c.slot_id}')">Add</button>` : ''}</td></tr>`).join('') + '</tbody></table></div>';
  return h;
}
// ---- 🏕️ Camps: a month calendar (camps run in weeks) and a list for PA/PD days ----
const fdIsPa = t => /\bp[ad]\s*(\/\s*p[ad])?\s*day|pro-?\s*d\b|no[\s-]school/i.test(t || '');
const fdIsHalf = t => /half\s*day/i.test(t || '');
function fdCampSel() { return Object.keys(_fd.campPick).filter(k => _fd.campPick[k]); }
function fdCampsHtml() {
  const F = _fd, R = F.camps;
  if (!R) return fdLoading; if (R.err) return '<p class="fd-msg">' + esc(R.err) + '</p>';
  const view = F.campView || 'cal', n = fdCampSel().length;
  let h = `<div class="fd-filters"><span class="fd-seg"><button class="fd-chip${view === 'cal' ? ' on' : ''}" onclick="_fd.campView='cal';fdRender()">🏕️ Camps calendar</button><button class="fd-chip${view === 'pa' ? ' on' : ''}" onclick="_fd.campView='pa';fdRender()">📚 PA/PD days</button></span>
    <span class="spacer"></span><button class="fd-book" ${n ? '' : 'disabled'} onclick="fdAddFrom('camp')">Add ${n || ''} day${n === 1 ? '' : 's'}</button>${n ? '<button class="ho-btn" onclick="_fd.campPick={};fdRender()">Clear</button>' : ''}</div>`;
  return h + (view === 'pa' ? fdPaHtml(R.filter(x => fdIsPa(x.title))) : fdCampCalHtml(R.filter(x => !fdIsPa(x.title))));
}
// Camps, as World shows them: choose the camp first, then its dates on a month calendar (Sunday first). Open days are green,
// chosen ones berry, full ones grey; days with two times (half-day AM/PM) get a button for each; "2 left" when spots are low.
const fdCampProg = x => fdClean(String(x.title || '').split('|').pop());
function fdCampCalHtml(list) {
  const F = _fd;
  if (!list.length) return '<p class="fd-sm">No camp days coming up at this studio.</p>';
  const progs = [...new Set(list.map(fdCampProg))];
  if (!F.campProg || !progs.includes(F.campProg)) F.campProg = progs[0];
  let h = '<div class="fd-progs">' + progs.map(pn => { const ds = list.filter(x => fdCampProg(x) === pn), n = ds.filter(x => F.campPick[x.id]).length;
    return `<button class="fd-prog${F.campProg === pn ? ' on' : ''}" onclick="_fd.campProg=${esc(JSON.stringify(pn))};_fd.campMonth=null;fdRender()"><b>${esc(pn)}</b><span>${fdDay(ds[0].session_date)} – ${fdDay(ds[ds.length - 1].session_date)}${n ? ' · ' + n + ' chosen' : ''}</span></button>`; }).join('') + '</div>';
  const dates = list.filter(x => fdCampProg(x) === F.campProg);
  const months = [...new Set(dates.map(x => x.session_date.slice(0, 7)))].sort();
  if (!F.campMonth || !months.includes(F.campMonth)) { const open = dates.find(x => (x.spaces_left_cache ?? 0) > 0); F.campMonth = open ? open.session_date.slice(0, 7) : months[0]; }
  const mi = months.indexOf(F.campMonth), [Y, M] = F.campMonth.split('-').map(Number), first = new Date(Y, M - 1, 1), daysIn = new Date(Y, M, 0).getDate();
  const byDay = {}; dates.forEach(x => { if (x.session_date.slice(0, 7) === F.campMonth) (byDay[+x.session_date.slice(8)] = byDay[+x.session_date.slice(8)] || []).push(x); });
  h += `<div class="fd-cal2"><div class="fd-cal2-head"><button class="fd-arrow sm" ${mi > 0 ? '' : 'disabled'} onclick="_fd.campMonth='${months[mi - 1] || ''}';fdRender()" aria-label="Previous month">‹</button>
    <b>${first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}</b><button class="fd-arrow sm" ${mi < months.length - 1 ? '' : 'disabled'} onclick="_fd.campMonth='${months[mi + 1] || ''}';fdRender()" aria-label="Next month">›</button></div>
    <div class="fd-cal2-grid">` + FD_DAYS.map(w => `<span class="fd-cal2-dow">${w}</span>`).join('');
  for (let i = 0; i < first.getDay(); i++) h += '<span class="fd-cal2-day blank"></span>';
  for (let day = 1; day <= daysIn; day++) {
    const opts = (byDay[day] || []).sort((a, b) => String(a.session_time).localeCompare(String(b.session_time)));
    if (!opts.length) { h += `<span class="fd-cal2-day"><span class="fd-cal2-num">${day}</span></span>`; continue; }
    h += `<div class="fd-cal2-day open"><span class="fd-cal2-num">${day}</span><div class="fd-cal2-opts">` + opts.map(x => {
      const left = x.spaces_left_cache ?? 0, on = !!F.campPick[x.id], label = opts.length > 1 ? fdTime(x.session_time) : 'Book';
      return `<button class="fd-cal2-opt${on ? ' on' : ''}" ${left <= 0 ? 'disabled' : ''} onclick="fdCampTap('${x.id}')" aria-pressed="${on}">${label}${left <= 0 ? '<small>Full</small>' : left <= 5 ? `<small>${left} left</small>` : ''}</button>`; }).join('') + '</div></div>';
  }
  return h + `</div><div class="fd-cal2-legend"><span><i class="o"></i>Open</span><span><i class="c"></i>Chosen</span><span><i class="f"></i>Full</span>${months.length > 1 ? '<span>Use ‹ › for other months</span>' : ''}</div></div>`;
}
// Choose / un-choose a camp day (one camp per date: choosing a time un-chooses that date's other times)
function fdCampTap(id) {
  const F = _fd, x = (F.camps || []).find(y => y.id === id); if (!x) return;
  const on = !F.campPick[id];
  if (on) (F.camps || []).forEach(y => { if (y.id !== id && y.session_date === x.session_date && !fdIsPa(y.title)) F.campPick[y.id] = false; });
  F.campPick[id] = on; fdRender();
}
function fdPaHtml(list) {
  const F = _fd, f = F.paF || (F.paF = { from: '', q: '' });
  if (!list.length) return '<p class="fd-sm">No PA/PD days coming up at this studio.</p>';
  const rows = list.filter(x => (!f.from || x.session_date >= f.from) && (!f.q || fdClean(String(x.title).split('|').pop()).toLowerCase().includes(f.q.toLowerCase())));
  let h = `<div class="fd-filters"><label>From <input type="date" value="${esc(f.from)}" onchange="_fd.paF.from=this.value;fdRender()"></label>
    <input id="fd-paq" type="search" placeholder="Search (e.g. school district)" value="${esc(f.q)}" oninput="_fd.paF.q=this.value;clearTimeout(_fd.qt);_fd.qt=setTimeout(fdRender,250)"></div>`;
  return h + `<div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr><th></th><th>Date</th><th>Day</th><th>PA/PD day</th><th class="num">Booked</th><th class="num">Left</th></tr></thead><tbody>` +
    rows.map(x => { const left = x.spaces_left_cache ?? 0;
      return `<tr class="${left <= 0 ? 'full' : ''}"><td><input type="checkbox" class="fd-tick" ${F.campPick[x.id] ? 'checked' : ''} ${left <= 0 ? 'disabled' : ''} onchange="_fd.campPick['${x.id}']=this.checked;fdRender()"></td>
        <td>${fdDay(x.session_date)}</td><td>${FD_DAYS[fdDow(x.session_date)]}</td><td><b>${esc(fdClean(String(x.title).split('|').pop()))}</b></td>
        <td class="num">${x.capacity != null ? Math.max(0, x.capacity - left) : ''}</td><td class="num">${left > 0 ? left : 'full'}</td></tr>`; }).join('') + '</tbody></table></div>';
}

// ---- 🎉 Parties: choose the kind, then a day on the calendar, then a time; the details go in the panel (World's own options) ----
const FD_PTY = [['kids', '🎨 Kids Party'], ['splatter', '💦 Splatter Party'], ['get_together', '🎈 Adult Get-Together']];
const FD_PTY_PROJECTS = [['oven-bake', 'Oven-Bake Clay'], ['clay', 'Clay'], ['painting', 'Painting'], ['besties', 'Besties'], ['undecided', 'Undecided']];
const FD_PTY_AFTER = [['no - just we will leave after the art portion', 'No – just leave after the art portion'], ['yes - add 30 minutes (enough time for cake only)', 'Yes – add 30 minutes (cake only)'], ['yes - add 45 minutes (enough time for lunch/snacks and cake)', 'Yes – add 45 minutes (lunch/snacks and cake)']];
const FD_GT_AFTER = [['No', 'No party time after'], ['Yes – add 30 minutes', 'Add 30 minutes'], ['Yes – add 60 minutes', 'Add 60 minutes']];
// Splatter: this studio's entry on World settings → Parties (splatter studios), if that list is set up
function fdSplatterStudio() { const L = ((_fd.ptyPage || {}).splatter || {}).studios || []; return L.find(x => x && x.studio_id === _sessionStudioId) || null; }
function fdSplatterOk() { const L = ((_fd.ptyPage || {}).splatter || {}).studios || []; return !L.length || !!fdSplatterStudio(); }
function fdPtyKind(x) { return x.world_party || (/splatter/i.test(x.title || '') ? 'splatter' : /get.?together/i.test(x.title || '') ? 'get_together' : /\bparty\b/i.test(x.title || '') && !/glaz|workshop/i.test(x.title || '') ? 'kids' : null); }
function fdPtyHtml() {
  const F = _fd, R = F.ptys;
  if (!R) return fdLoading; if (R.err) return '<p class="fd-msg">' + esc(R.err) + '</p>';
  const offered = FD_PTY.filter(k => R.some(x => fdPtyKind(x) === k[0]) && (k[0] !== 'splatter' || fdSplatterOk()));   // (only the kinds this studio offers)
  if (!offered.length) return '<p class="fd-sm">No party times at this studio yet.</p>';
  if (!offered.some(k => k[0] === (F.ptyKind || 'kids'))) F.ptyKind = offered[0][0];
  const kind = F.ptyKind || 'kids', list = R.filter(x => fdPtyKind(x) === kind);
  let h = '<div class="fd-progs">' + offered.map(k => `<button class="fd-prog${kind === k[0] ? ' on' : ''}" onclick="_fd.ptyKind='${k[0]}';_fd.ptyDate=null;_fd.ptyMonth=null;fdRender()"><b>${k[1]}</b><span>${R.filter(x => fdPtyKind(x) === k[0] && (x.spaces_left_cache ?? 0) > 0).length} open times</span></button>`).join('') + '</div>';
  if (!list.length) return h + '<p class="fd-sm">No times for this kind of party at this studio yet.</p>';
  const months = [...new Set(list.map(x => x.session_date.slice(0, 7)))].sort();
  if (!F.ptyMonth || !months.includes(F.ptyMonth)) { const open = list.find(x => (x.spaces_left_cache ?? 0) > 0); F.ptyMonth = open ? open.session_date.slice(0, 7) : months[0]; }
  const mi = months.indexOf(F.ptyMonth), [Y, M] = F.ptyMonth.split('-').map(Number), first = new Date(Y, M - 1, 1), daysIn = new Date(Y, M, 0).getDate();
  const byDay = {}; list.forEach(x => { if (x.session_date.slice(0, 7) === F.ptyMonth) (byDay[+x.session_date.slice(8)] = byDay[+x.session_date.slice(8)] || []).push(x); });
  h += `<div class="fd-ptywrap"><div class="fd-cal2"><div class="fd-cal2-head"><button class="fd-arrow sm" ${mi > 0 ? '' : 'disabled'} onclick="_fd.ptyMonth='${months[mi - 1] || ''}';fdRender()" aria-label="Previous month">‹</button>
    <b>${first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}</b><button class="fd-arrow sm" ${mi < months.length - 1 ? '' : 'disabled'} onclick="_fd.ptyMonth='${months[mi + 1] || ''}';fdRender()" aria-label="Next month">›</button></div>
    <div class="fd-cal2-grid">` + FD_DAYS.map(w => `<span class="fd-cal2-dow">${w}</span>`).join('');
  for (let i = 0; i < first.getDay(); i++) h += '<span class="fd-cal2-day blank"></span>';
  for (let day = 1; day <= daysIn; day++) {
    const xs = byDay[day] || [], open = xs.filter(x => (x.spaces_left_cache ?? 0) > 0).length, d = F.ptyMonth + '-' + String(day).padStart(2, '0');
    if (!xs.length) { h += `<span class="fd-cal2-day"><span class="fd-cal2-num">${day}</span></span>`; continue; }
    h += `<button class="fd-cal2-day ${open ? 'open' : 'gone'} fd-ptyday${F.ptyDate === d ? ' sel' : ''}" ${open ? '' : 'disabled'} onclick="_fd.ptyDate='${d}';fdRender()"><span class="fd-cal2-num">${day}</span><span class="fd-ptyn">${open ? open + (open === 1 ? ' time' : ' times') : 'booked'}</span></button>`;
  }
  h += '</div><div class="fd-cal2-legend"><span><i class="o"></i>Open times</span><span><i class="f"></i>All booked</span></div></div>';
  // the day's times
  h += '<div class="fd-ptytimes">';
  if (!F.ptyDate) h += '<p class="fd-sm">Tap a day to see its party times.</p>';
  else {
    const xs = list.filter(x => x.session_date === F.ptyDate);
    h += `<b>${fdDay(F.ptyDate)}</b>` + xs.map(x => { const left = x.spaces_left_cache ?? 0;
      return `<button class="fd-ptytime" ${left > 0 ? '' : 'disabled'} onclick="fdPtyOpen('${x.id}')">${fdTime(x.session_time)}<span>${left > 0 ? 'Open' : 'Booked'}</span></button>`; }).join('');
  }
  return h + '</div></div>';
}
// World settings → Parties (project lists, colours, splatter studios): loaded once per Front desk, whenever the party form needs it
async function fdPtyPageLoad() {
  if (_fd.ptyPage && !_fd.ptyPage.__err) return;
  // through World's public parties view (public-studio-data ?view=parties): the same lists World's Parties page shows
  // (the Hub's own sign-in can't read the 'parties' setting directly)
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/public-studio-data?view=parties&studio=${encodeURIComponent(_sessionStudioId || 'BC-YVR-MS')}`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
    const d = await r.json();
    if (!r.ok || !d || d.error) throw new Error((d && d.error) || ('HTTP ' + r.status));
    _fd.ptyPage = d.page || {};
  } catch (e) { _fd.ptyPage = { __err: e.message || 'not loaded' }; }
  if (_fd.add && _fd.add.kind === 'party') fdRender();
}
function fdPtyOpen(id) {
  if (!_fd.ptyPage || _fd.ptyPage.__err) fdPtyPageLoad();
  const x = (_fd.ptys || []).find(y => y.id === id); if (!x) return;
  const kind = fdPtyKind(x), P = _fd.ptyP || {}, inc = kind === 'get_together' ? (+((P.get_together || {}).min) || 10) : (+((P[kind] || {}).included) || 8);
  _fd.add = { kind: 'party', x, pk: kind, people: inc, art: false, after: kind === 'get_together' ? FD_GT_AFTER[0][0] : FD_PTY_AFTER[0][0], project: '', specific: '', custom: false, customText: '',
    colour: '', canvas: false, parentStay: false, reason: '', notes: '', gtProject: '' };
  _fd.addMsg = ''; fdRender();
}
function fdPtyAddHtml() {
  const A = _fd.add, x = A.x, k = A.pk, P = _fd.ptyP || {}, kids = k === 'kids', gt = k === 'get_together';
  const min = gt ? (+((P.get_together || {}).min) || 10) : (+((P[k] || {}).included) || 8), max = gt ? (+((P.get_together || {}).max) || 30) : k === 'splatter' ? ((fdSplatterStudio() || {}).max || 40) : 40;   // (splatter: the studio's own maximum, World settings → Parties)
  const is11 = String(x.session_time || '').slice(0, 5) === '11:00', set = (f, v) => `_fd.add.${f}=${v};fdRender()`;
  let h = `<h3>${esc((FD_PTY.find(p => p[0] === k) || [, 'Party'])[1])}</h3><p class="fd-sm">${fdDay(x.session_date)}, ${fdTime(x.session_time)}</p>
    <div class="fd-field"><b>What are they celebrating?</b><input value="${esc(A.reason)}" maxlength="100" placeholder="e.g. Maya’s 8th birthday" oninput="_fd.add.reason=this.value"></div>
    <div class="fd-field"><b>Guests</b> <span class="fd-sm">${min}–${max}${gt ? '' : ' (the party includes ' + min + ')'}</span><div class="fd-stepper"><button onclick="${set('people', `Math.max(${min},_fd.add.people-1)`)}" aria-label="Fewer">−</button><b>${A.people}</b><button onclick="${set('people', `Math.min(${max},_fd.add.people+1)`)}" aria-label="More">+</button></div></div>`;
  if (kids) h += `<div class="fd-field"><b>Art time</b><div class="fd-chips2"><button class="fd-chip${!A.art ? ' on' : ''}" onclick="${set('art', 'false')}">60 minutes</button><button class="fd-chip${A.art ? ' on' : ''}" onclick="${set('art', 'true')}">90 minutes</button></div></div>`;
  const AF = gt ? FD_GT_AFTER : FD_PTY_AFTER;
  h += `<div class="fd-field"><b>Party time after</b><select onchange="_fd.add.after=this.value;fdRender()">${AF.map(a => `<option value="${esc(a[0])}"${A.after === a[0] ? ' selected' : ''}>${esc(a[1])}</option>`).join('')}</select></div>`;
  if (kids) {
    h += `<div class="fd-field"><b>Project</b><div class="fd-chips2">${FD_PTY_PROJECTS.map(pj => `<button class="fd-chip${A.project === pj[0] ? ' on' : ''}" onclick="_fd.add.project='${pj[0]}';fdRender()">${pj[1]}</button>`).join('')}</div>` +
      (A.project && A.project !== 'besties' && A.project !== 'undecided' ? fdPtySpecHtml(A) : '') + '</div>';
    if (is11) h += `<label class="fd-chk"><input type="checkbox" ${A.parentStay ? 'checked' : ''} onchange="${set('parentStay', 'this.checked')}"> Parents are staying (11am parties: parent observer passes, one per guest after the first)</label>`;
  } else if (!gt) {
    const cols = String(((_fd.ptyPage || {}).splatter || {}).colours || '').split('\n').map(c => c.trim()).filter(Boolean);
    h += `<div class="fd-field"><b>Colour theme</b>${cols.length ? `<select onchange="_fd.add.colourPick=this.value;_fd.add.colour=this.value==='Custom'?'':this.value;fdRender()"><option value="">Choose…</option>${cols.map((c, n) => `<option value="${esc(c)}"${A.colourPick === c ? ' selected' : ''}>${n + 1}. ${esc(c)}</option>`).join('')}<option value="Custom"${A.colourPick === 'Custom' ? ' selected' : ''}>${cols.length + 1}. Custom: describe their own</option></select>${A.colourPick === 'Custom' ? `<input value="${esc(A.colour)}" placeholder="Describe the colour theme" oninput="_fd.add.colour=this.value">` : ''}`
      : `<input value="${esc(A.colour)}" placeholder="e.g. Rainbow, or pink and gold" oninput="_fd.add.colour=this.value">`}</div>
      <div class="fd-field"><b>Canvas</b><div class="fd-chips2"><button class="fd-chip${!A.canvas ? ' on' : ''}" onclick="${set('canvas', 'false')}">Watercolour paper</button><button class="fd-chip${A.canvas ? ' on' : ''}" onclick="${set('canvas', 'true')}">Canvas (+ per guest)</button></div></div>`;
  } else h += `<div class="fd-field"><b>Project</b><input value="${esc(A.gtProject)}" placeholder="e.g. Clay mugs, or Undecided" oninput="_fd.add.gtProject=this.value"></div>`;
  h += `<div class="fd-field"><b>Notes</b> <span class="fd-sm">(optional)</span><textarea rows="2" maxlength="1000" oninput="_fd.add.notes=this.value">${esc(A.notes)}</textarea></div>
    <p class="fd-sm">The price (with member savings) shows in the cart once it’s added.</p>`;
  return h;
}
// World settings → Parties: each project type's specific projects (some only with 90 minutes of art), as World's Parties page offers them
function fdPtyProjLists() {
  const out = {};
  String((((_fd.ptyPage || {}).kids) || {}).projects || '').split('\n').forEach(line => {
    const i = line.indexOf(':'); if (i === -1) return;
    out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).split(',').map(x => { x = x.trim(); return { label: x.replace(/\s*\(90\s*min(?:utes)?\)\s*$/i, '').trim(), ninety: /\(90\s*min/i.test(x) }; }).filter(x => x.label);
  });
  return out;
}
function fdPtySpecHtml(A) {
  const cat = (FD_PTY_PROJECTS.find(p => p[0] === A.project) || [, ''])[1].toLowerCase(), all = fdPtyProjLists()[cat] || [];
  const vis = all.filter(x => A.art || !x.ninety).sort((a, b) => a.label.localeCompare(b.label)), hid = !A.art && all.some(x => x.ninety);
  const pg = _fd.ptyPage, why = !pg ? '<span class="fd-sm">Loading the project list…</span>' : pg.__err ? `<span class="fd-sm">The project list didn’t load (${esc(pg.__err)}). Type it in for now.</span>` : `<span class="fd-sm">No ${esc((FD_PTY_PROJECTS.find(p => p[0] === A.project) || [, ''])[1])} projects listed in World settings → Parties yet. Type it in for now.</span>`;
  if (!all.length) return why + `<input value="${esc(A.specific)}" placeholder="Specific project (optional, e.g. Unicorn)" oninput="_fd.add.specific=this.value">
    <label class="fd-chk"><input type="checkbox" ${A.custom ? 'checked' : ''} onchange="_fd.add.custom=this.checked;fdRender()"> Custom project (extra fee)</label>${A.custom ? `<input value="${esc(A.customText)}" placeholder="Describe the custom project" oninput="_fd.add.customText=this.value">` : ''}`;
  if (A.specific && A.specific !== 'To be decided' && !vis.some(x => x.label === A.specific)) A.specific = '';   // (a 90-minute design, back on 60 minutes)
  const pick = A.custom ? 'Custom' : A.specific;
  return `<select onchange="_fd.add.custom=this.value==='Custom';_fd.add.specific=this.value==='Custom'?'':this.value;fdRender()"><option value="">Which specific project?</option>
    ${vis.map(x => `<option value="${esc(x.label)}"${pick === x.label ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}
    <option value="Custom"${A.custom ? ' selected' : ''}>Custom (extra fee)</option><option value="To be decided"${pick === 'To be decided' ? ' selected' : ''}>To be decided</option></select>
    ${hid ? '<span class="fd-sm">⏱ A few more designs with 90 minutes of art time.</span>' : ''}
    ${A.custom ? `<input value="${esc(A.customText)}" placeholder="Describe the custom project" oninput="_fd.add.customText=this.value">` : ''}
    ${pick === 'To be decided' ? '<span class="fd-sm">🗓️ They let the studio know the project at least 1 week before the party.</span>' : ''}`;
}
function fdPtyAddDone() {
  const F = _fd, A = F.add, k = A.pk, kids = k === 'kids', gt = k === 'get_together', fail = m => { F.addMsg = m; fdRender(); };
  if (!A.reason.trim()) return fail('Add what they’re celebrating.');
  if (kids && !A.project) return fail('Choose a project (or Undecided).');
  if (kids && A.custom && !A.customText.trim()) return fail('Describe the custom project.');
  if (kids && A.project && !['besties', 'undecided'].includes(A.project) && (fdPtyProjLists()[(FD_PTY_PROJECTS.find(p => p[0] === A.project) || [, ''])[1].toLowerCase()] || []).length && !A.custom && !A.specific)
    return fail('Choose the specific project (or To be decided).');
  if (k === 'splatter' && !A.colour.trim()) return fail('Add a colour theme.');
  if (gt && !A.gtProject.trim()) return fail('Add a project (or Undecided).');
  const pl = (FD_PTY_PROJECTS.find(p => p[0] === A.project) || [, ''])[1], spec = A.custom ? 'Custom: ' + A.customText.trim() : A.specific.trim();
  const label = (FD_PTY.find(p => p[0] === k) || [, 'Party'])[1].replace(/^\S+\s/, '');
  F.cart.push({ type: 'party', session_id: A.x.id, people: A.people, long_art: kids && A.art, after: A.after, project_key: kids ? A.project : undefined, project: kids ? pl : gt ? A.gtProject.trim() : undefined,
    specific: kids ? spec || undefined : undefined, custom_project: kids && A.custom, colour: k === 'splatter' ? A.colour.trim() : undefined, canvas: k === 'splatter' && A.canvas,
    parent_stay: kids && A.parentStay, reason: A.reason.trim(), notes: A.notes.trim() || undefined,
    title: `${label} · ${fdDay(A.x.session_date)}, ${fdTime(A.x.session_time)}`, desc: [A.people + ' guests', kids ? pl + (spec ? ': ' + spec : '') : k === 'splatter' ? A.colour.trim() : A.gtProject.trim(), A.reason.trim()].filter(Boolean).join(' · ') });
  F.add = null; F.addMsg = ''; fdRender();
}

// ---------- The cart (right) ----------
function fdCartHtml() {
  const F = _fd, bookings = F.cart.length;
  let h = '<div class="fd-cart-in"><h3>Cart</h3>';
  // The family
  if (F.fam) {
    if (F.fam.walk_in) h += `<div class="fd-fam"><div><b>🛍️ Walk-in</b><br><span class="fd-sm">Shop items only · pays now · no receipt email</span></div>
      <button class="ho-btn" onclick="_fd.fam=null;fdRender()">Change</button></div>`;
    else h += `<div class="fd-fam"><div><b>${esc(F.fam.first_name + (F.fam.last_name ? ' ' + F.fam.last_name : ''))}</b>${F.fam.table ? ` <span class="fd-pill">🪑 ${esc(F.fam.table)}</span>` : ''}${F.fam.member ? ' <span class="fd-pill">⭐ Member</span>' : ''}${F.fam.customer_id || F.fam.table ? '' : ' <span class="fd-pill">new</span>'}<br><span class="fd-sm">${esc(F.fam.email)}</span></div>
      <button class="ho-btn" onclick="fdFamClear()">Change</button></div>
      <div class="fd-people">${F.people.map((p, i) => `<span class="fd-person">${esc(p.name)}${p.dob ? ' · ' + fdAge(p.dob) : ''}${p.mine ? '' : ` <button onclick="_fd.people.splice(${i},1);fdRender()" aria-label="Remove">×</button>`}</span>`).join('')}
      <button class="fd-link" onclick="_fd.addPerson=!_fd.addPerson;fdRender()">+ person</button></div>` +
      (F.addPerson ? `<div class="fd-inline"><input id="fd-pn" placeholder="Name"><input id="fd-pd" type="date" title="Birthdate"><button class="ho-btn" onclick="fdAddPerson()">Add</button></div>` : '');
  } else {
    h += `<div class="fd-inline"><input id="fd-q" placeholder="Find family (name or email)" value="${esc(F.q)}" onkeydown="if(event.key==='Enter')fdFind()"><button class="ho-btn" onclick="fdFind()">Find</button></div>`;
    if (F.hits) h += F.hits.length ? '<div class="fd-hits">' + F.hits.map(r => `<button class="fd-hit" onclick="fdPick(${Number(r.shopify_customer_id)})"><b>${esc(r.parent_name || 'Family')}</b><span class="fd-sm">${esc(r.email || '')}</span></button>`).join('') + '</div>' : '<p class="fd-sm">No family found.</p>';
    h += F.newFam ? `<div class="fd-newfam"><input id="fd-nf" placeholder="First name"><input id="fd-nl" placeholder="Last name"><input id="fd-ne" type="email" placeholder="Email (receipt goes here)"><button class="ho-btn primary" onclick="fdNewFam()">Use this family</button></div>`
      : '<button class="fd-here-btn" onclick="fdHereOpen()" title="Pick them from today’s classes, by table">🪑 Who’s here now</button> <button class="fd-link" onclick="_fd.newFam=true;fdRender()">+ New family</button>' + (F.cart.length && F.cart.every(l => l.type === 'retail') ? ' <button class="fd-link" onclick="_fd.fam={walk_in:true,first_name:\'Walk-in\',last_name:\'\',email:\'\'};_fd.people=[];fdRender()">🛍️ Walk-in (no account)</button>' : '');
  }
  // The items
  h += '<div class="fd-items">' + (F.cart.length ? F.cart.map((l, i) => `<div class="fd-item"><div><b>${esc(l.title)}</b><span class="fd-sm">${esc(l.desc || '')}</span></div>${l.type === 'retail' ? `<span class="fd-qty"><button onclick="fdShopQty(${i},-1)" aria-label="One less">−</button><b>${l.qty}</b><button onclick="fdShopQty(${i},1)" aria-label="One more">+</button></span>` : ''}<button class="fd-x" onclick="_fd.cart.splice(${i},1);fdRender()" aria-label="Remove">×</button></div>`).join('') : '<p class="fd-sm">Nothing yet. Add from the tabs.</p>') + '</div>';
  if (F.cart.length) h += fdQuoteHtml();
  if (F.cart.length) {
    const needFam = !F.fam;
    h += `<label class="fd-sm fd-giftl">Gift card <input value="${esc(F.gift)}" placeholder="Code (optional)" oninput="_fd.gift=this.value"></label>
      ${needFam ? `<p class="fd-warn">${F.cart.every(l => l.type === 'retail') ? 'Choose the family (for member prices and an emailed receipt), or 🛍️ Walk-in above.' : 'Choose the family to pay for bookings.'}</p>` : ''}
      ${F.fam && F.fam.walk_in && F.cart.some(l => l.type !== 'retail') ? '<p class="fd-warn">A walk-in can buy shop items only. Choose the family for the bookings.</p>' : ''}
      ${fdCardsHtml(needFam)}
      <div class="fd-paybtns"><button class="fd-pay" ${needFam || F.busy ? 'disabled' : ''} onclick="fdPay('here')">💳 Card here</button><button class="fd-pay fd-pay2" ${needFam || F.busy ? 'disabled' : ''} onclick="fdPay('qr')">📱 Pay now (QR code)</button>
      <button class="ho-btn" ${needFam || F.busy || (F.fam && F.fam.walk_in) ? 'disabled' : ''} onclick="fdPay('email')">✉️ Email pay link</button><button class="ho-btn" ${needFam || F.busy || (F.fam && F.fam.walk_in) ? 'disabled' : ''} onclick="fdPay('link')">🔗 Copy pay link</button></div>
      <div class="fd-invrow"><button class="ho-btn" ${needFam || F.busy || (F.fam && F.fam.walk_in) ? 'disabled' : ''} onclick="fdPay('invoice')">🧾 Send invoice</button>
        <label class="fd-sm">Pay by <input type="date" value="${esc(F.payBy || fdAddDays(fdToday(), 2))}" min="${fdToday()}" max="${fdAddDays(fdToday(), 60)}" onchange="_fd.payBy=this.value"></label></div>
      <p class="fd-sm">Card here and QR: 10 minutes to pay. Links: 24 hours. Invoice: held until the end of its pay-by date, with a reminder the day before.</p>`;
  }
  if (F.msg) h += `<p class="fd-msg" role="status">${esc(F.msg)}</p>`;
  if (F.cart.length || F.fam) h += '<button class="fd-link fd-clear" onclick="if(confirm(\'Clear the cart and family?\')){_fd=Object.assign(fdNew(),{tab:_fd.tab,date:_fd.date,today:_fd.today,ws:_fd.ws,cls:_fd.cls,camps:_fd.camps,wsF:_fd.wsF,clsF:_fd.clsF});fdRender()}">Clear cart</button>';
  return h + '</div>';
}
async function fdFind() {
  const q = ((document.getElementById('fd-q') || {}).value || '').trim(); _fd.q = q;
  if (q.length < 2) { _fd.msg = 'Type at least 2 letters.'; fdRender(); return; }
  _fd.msg = 'Searching…'; fdRender();
  const { data, error } = await sb.rpc('hub_family_list', { p_q: q, p_limit: 8, p_pin: fdPin() });
  _fd.hits = error ? [] : (data || []); _fd.msg = error ? error.message : ''; fdRender();
}
async function fdPick(cid) {
  _fd.msg = 'Opening…'; fdRender();
  const { data, error } = await sb.rpc('hub_family_card', { p_customer: cid, p_pin: fdPin() });
  if (error || !data) { _fd.msg = (error && error.message) || 'Couldn’t open that family.'; fdRender(); return; }
  if (!data.email) { _fd.msg = 'This family has no email on file. Add them as a new family with an email.'; fdRender(); return; }
  const nm = String(data.parent_name || '').trim().split(/\s+/);
  _fd.fam = { customer_id: cid, email: data.email, first_name: nm[0] || 'Family', last_name: nm.slice(1).join(' '), member: !!data.member };
  _fd.people = (data.people || []).map(p => ({ name: (p.first_name + (p.last_name ? ' ' + p.last_name : '')).trim(), dob: p.birthdate || null, adult: !!p.is_16_plus, mine: true }));
  _fd.hits = null; _fd.msg = ''; fdRender();
}
function fdNewFam() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const f = v('fd-nf'), l = v('fd-nl'), e = v('fd-ne').toLowerCase();
  if (!f || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { _fd.msg = 'Add a first name and a real email.'; fdRender(); return; }
  _fd.fam = { customer_id: null, email: e, first_name: f, last_name: l }; _fd.people = []; _fd.newFam = false; _fd.msg = ''; fdRender();
}
function fdFamClear() { if (_fd.cart.length && !confirm('Change the family? Items already in the cart stay, but check who’s coming on each.')) return; _fd.fam = null; _fd.people = []; _fd.hits = null; fdRender(); }
function fdAddPerson(fromSheet) {
  const n = ((document.getElementById(fromSheet ? 'fd-apn' : 'fd-pn') || {}).value || '').trim(), d = (document.getElementById(fromSheet ? 'fd-apd' : 'fd-pd') || {}).value || '';
  if (!n) return; _fd.people.push({ name: n, dob: d || null, adult: d ? fdAge(d) >= 16 : false }); _fd.addPerson = false;
  if (fromSheet && _fd.add) _fd.add.who[_fd.people.length - 1] = true;
  fdRender();
}

// ---------- Who can come: ages and the adult rules (the same as 4Cats World) ----------
//   Kids 5–7: one adult each. Kids 8–11: one adult for every two kids (wheel workshops: one adult each, ages 8+).
//   Kids 12–15 can come on their own. Adults are 16+. Everyone takes a spot.
//   Kids-only times: only kids in the kids age range, no adults. Classes: the class's ages (family classes: at least one adult
//   and one child, up to 2 kids per adult). Camps: 6–12 (half-day camps 5–12).
const fdIsWheel = t => /wheel/i.test(t || '') && !/\d+\s+week\s+session|class\s+\d+\s+of|series/i.test(t || '');
function fdAges(A) {
  if (A.kind === 'ws') {
    const x = A.x, I = x.item || {};
    if (x.kids_only) return { min: I.kids_min_age ?? (I.kind === 'mini_make' ? 5 : 6), max: I.kids_max_age ?? 12, kidsOnly: true };
    if (fdIsWheel(x.title)) return { min: 8, max: 199, wheel: true };
    return { min: I.min_age ?? (I.kind === 'mini_make' ? 5 : 6), max: I.max_age && I.max_age < 99 ? I.max_age : 199 };
  }
  if (A.kind === 'class') return { min: A.c.min ?? 0, max: A.c.max ?? 199, family: !!A.c.family };
  const half = A.days.some(d => /half\s*day/i.test(d.title || '') && /camp/i.test(d.title || ''));
  return { min: half ? 5 : 6, max: 12 };
}
function fdBandOf(age) { return age == null ? null : age >= 16 ? 'adult' : age >= 12 ? 'k1215' : age >= 8 ? 'k811' : 'k57'; }
// Whether a person on the family can be ticked for this booking (and why not)
function fdPersonOk(A, p, onDate) {
  const g = fdAges(A), age = p.dob ? fdAge(p.dob, onDate) : (p.adult ? 16 : null);
  if (age == null) return { ok: false, age, why: 'needs a birthdate' };
  if (g.family && age >= 16) return { ok: true, age };   // (family class: the adults)
  if (age < g.min) return { ok: false, age, why: `too young (${g.min}+)` };
  if (age > g.max) return { ok: false, age, why: g.kidsOnly ? `kids ${g.min}–${g.max} only` : `too old (${g.min}–${g.max})` };
  return { ok: true, age };
}
// The group so far and the rule check for a workshop: { c: counts by age group, need, have, total, msg, bad }
function fdWsCheck(A) {
  const F = _fd, x = A.x, g = fdAges(A), c = { k57: 0, k811: 0, k1215: 0, adult: 0 };
  F.people.forEach((p, i) => { if (!A.who[i]) return; const age = p.dob ? fdAge(p.dob, x.session_date) : (p.adult ? 16 : null); const b = fdBandOf(age) || 'adult'; c[b]++; });
  FD_BANDS.forEach(b => { c[b[0]] += A.guests[b[0]] || 0; });
  const total = c.k57 + c.k811 + c.k1215 + c.adult, left = x.spaces_left_cache ?? 0;
  if (g.kidsOnly) {
    const bad = c.adult > 0 ? 'This is a kids-only time (drop-off): no adults.' : total > left ? `Only ${left} spot${left === 1 ? '' : 's'} left.` : '';
    return { c, total, need: 0, have: 0, bad: !!bad, msg: bad || (total ? total + (total === 1 ? ' spot' : ' spots') : '') };
  }
  const need = g.wheel ? c.k57 + c.k811 : c.k57 + Math.ceil(c.k811 / 2), have = c.adult;
  let msg = '', bad = false;
  if (have < need && total + (need - have) > left) { bad = true; msg = `This group needs ${total + need - have} spots with the adults it needs, but only ${left} are left.`; }
  else if (have < need) { bad = true; msg = `Add ${need - have} more adult${need - have === 1 ? '' : 's'}. ` + (g.wheel ? 'On the wheel, kids 8–11 need one adult each.' : `Kids ${Math.max(5, g.min)}–7 need one adult each, and kids 8–11 need one adult for every two kids.`); }
  else if (total > left) { bad = true; msg = `Only ${left} spot${left === 1 ? '' : 's'} left.`; }
  else if (total) msg = total + (total === 1 ? ' spot' : ' spots') + (need ? ` · ${need} adult${need === 1 ? '' : 's'} needed ✓` : '');
  return { c, total, need, have, bad, msg };
}
function fdFamilyCheck(A) {   // a family class: at least one adult (16+) and one child, up to 2 kids per adult
  const on = A.c.first.session_date; let adults = 0, kids = 0;
  _fd.people.forEach((p, i) => { if (!A.who[i]) return; const a = p.dob ? fdAge(p.dob, on) : (p.adult ? 16 : null); if (a != null && a >= 16) adults++; else kids++; });
  const bad = adults < 1 || kids < 1 || kids > adults * 2;
  return { bad, msg: !adults && !kids ? 'Family class: tick at least one adult (16+) and one child, up to 2 kids per adult.' : bad ? `${adults} adult${adults === 1 ? '' : 's'}, ${kids} kid${kids === 1 ? '' : 's'}: a family class needs at least one adult and one child, up to 2 kids per adult.` : `${adults} adult${adults === 1 ? '' : 's'} · ${kids} kid${kids === 1 ? '' : 's'} ✓` };
}

// ---------- Adding something: the panel ----------
async function fdAddFrom(kind, id) {
  const F = _fd;
  if (kind === 'ws') {
    const x = (F.today || []).concat(Array.isArray(F.ws) ? F.ws : []).find(y => y.id === id); if (!x) return;
    F.add = { kind, x, who: {}, guests: {}, extras: {} };
  } else if (kind === 'class') {
    if (!Array.isArray(F.cls)) { F.msg = 'Loading the class…'; fdRender(); await fdLoadClasses(); F.msg = ''; }
    let c = Array.isArray(F.cls) ? F.cls.find(y => y.slot_id === id) : null;
    if (!c) { const t = (F.today || []).find(y => y.world_class_slot_id === id); c = t ? { slot_id: id, name: fdClean(t.title), first: Object.assign({}, t, { session_date: t.first || t.session_date }), weeks: null, min: null, max: null } : null; }
    if (!c) return; const p2 = fdPart2(c); F.add = { kind, c, who: {}, p2, both: !!(p2 && p2.left > 0) };
  } else {
    const ids = id ? [id] : Object.keys(F.campPick).filter(k => F.campPick[k]);
    const all = (Array.isArray(F.camps) ? F.camps : []).concat(F.today || []);
    const days = ids.map(k => all.find(y => y.id === k)).filter(Boolean); if (!days.length) return;
    F.add = { kind: 'camp', days, who: {}, after: {} };
  }
  fdRender();
}
function fdWhoHtml(needDob, onDate) {
  const A = _fd.add, F = _fd;
  if (!F.fam) return '<p class="fd-warn">Choose the family first (in the cart), so you can tick who’s coming.</p>';
  const g = fdAges(A);
  return '<div class="fd-who"><b>Who’s coming</b> <span class="fd-sm">' + (g.kidsOnly ? `kids ${g.min}–${g.max} only (drop-off)` : g.family ? 'family class: adults and kids' : g.max < 199 ? `ages ${g.min}–${g.max}` : `ages ${g.min}+`) + '</span>' +
    (F.people.length ? F.people.map((p, i) => { const k = fdPersonOk(A, p, onDate); if (!k.ok && A.who[i]) A.who[i] = false;
    return `<label class="fd-chk${k.ok ? '' : ' off'}"><input type="checkbox" ${A.who[i] ? 'checked' : ''} ${k.ok ? '' : 'disabled'} onchange="_fd.add.who[${i}]=this.checked;fdRender()"> ${esc(p.name)}${k.age != null ? ` <span class="fd-sm">(${k.age})</span>` : ''}${k.ok ? '' : ` <span class="fd-warn">${esc(k.why)}</span>`}</label>`; }).join('') : '<span class="fd-sm">No people on this family yet.</span>') +
    `<div class="fd-inline"><input id="fd-apn" placeholder="Add someone: name"><input id="fd-apd" type="date" title="Birthdate"><button class="ho-btn" onclick="fdAddPerson(true)">Add</button></div></div>`;
}
function fdAddHtml() {
  const A = _fd.add;
  let h = '<div class="fd-sheet-back" onclick="if(event.target===this){_fd.add=null;fdRender()}"><div class="fd-sheet" role="dialog" aria-modal="true">';
  if (A.kind === 'party') h += fdPtyAddHtml();
  else if (A.kind === 'ws') {
    const x = A.x, I = x.item || {};
    h += `<h3>${esc(fdClean(x.title))}</h3><p class="fd-sm">${fdDay(x.session_date)}, ${fdTime(x.session_time)} · ${esc(FD_KIND[I.kind] || 'Workshop')} · ${(x.spaces_left_cache ?? 0)} left${x.kids_only ? ' · kids only (drop-off)' : ''}</p>` + fdWhoHtml(false, x.session_date);
    const g = fdAges(A), BR = { k57: [5, 7], k811: [8, 11], k1215: [12, 15], adult: [16, 199] };
    if (!x.kids_only) h += '<div class="fd-field"><b>Guests not on their list</b><div class="fd-bands">' + FD_BANDS.filter(b => BR[b[0]][1] >= g.min && BR[b[0]][0] <= g.max).map(b => {
      const lo = Math.max(BR[b[0]][0], g.min), hi = Math.min(BR[b[0]][1], g.max), lab = b[0] === 'adult' ? 'Adults (16+)' : `Kids ${lo}–${hi}`;
      const help = b[0] === 'k57' ? 'need 1 adult each' : b[0] === 'k811' ? (g.wheel ? 'need 1 adult each' : '1 adult per 2 kids') : b[0] === 'k1215' ? 'can come alone' : '';
      return `<label>${lab}${help ? ` <span class="fd-help">${help}</span>` : ''}<input type="number" min="0" max="20" value="${A.guests[b[0]] || 0}" onchange="_fd.add.guests['${b[0]}']=Math.max(0,+this.value||0);fdRender()"></label>`; }).join('') + '</div></div>';
    const chk = fdWsCheck(A); if (chk.msg) h += `<p class="${chk.bad ? 'fd-warn' : 'fd-ok'}">${esc(chk.msg)}</p>`;
    if (I.treats) h += `<div class="fd-field"><b>Treats</b><div class="fd-bands"><label>Hot chocolate<input type="number" min="0" max="20" value="${A.extras.hot || 0}" oninput="_fd.add.extras.hot=+this.value||0"></label><label>Candy bags<input type="number" min="0" max="20" value="${A.extras.candy || 0}" oninput="_fd.add.extras.candy=+this.value||0"></label></div></div>`;
    if (I.kind === 'glazing') h += `<div class="fd-field"><b>What are they glazing?</b><input value="${esc(A.glaze || '')}" oninput="_fd.add.glaze=this.value"></div>`;
    if (x.kids_only) h += `<div class="fd-field"><b>Who’s picking up?</b><div class="fd-inline"><input placeholder="Name" value="${esc(A.puName || '')}" oninput="_fd.add.puName=this.value"><input placeholder="Phone" value="${esc(A.puPhone || '')}" oninput="_fd.add.puPhone=this.value"></div></div>`;
  } else if (A.kind === 'class') {
    const c = A.c;
    h += `<h3>${esc(c.name)}${c.part ? ' · ' + esc(c.part) : ''}</h3><p class="fd-sm">Starts ${fdDay(c.first.session_date)}, ${fdTime(c.first.session_time)}${c.weeks ? ' · ' + c.weeks + (c.weeks === 1 ? ' week' : ' weeks') : ''}${c.min != null ? ' · ages ' + c.min + (c.max != null && c.max < 99 ? '–' + c.max : '+') : ''}${c.family ? ' · family class' : ''}</p>` + fdWhoHtml(true, c.first.session_date);
    if (c.family) { const fc = fdFamilyCheck(A); h += `<p class="${fc.bad ? 'fd-warn' : 'fd-ok'}">${esc(fc.msg)}</p>`; }
    if (A.p2) { const p2 = A.p2, linked = p2.page && p2.page !== c.page, pct = linked ? p2.bothPct : c.bothPct, all = linked ? p2.bothAll : c.bothAll;
      h += `<label class="fd-both${A.both ? ' on' : ''}${p2.left > 0 ? '' : ' off'}"><input type="checkbox" ${A.both ? 'checked' : ''} ${p2.left > 0 ? '' : 'disabled'} onchange="_fd.add.both=this.checked;fdRender()">
        <span><b>Also book ${esc(linked ? p2.name : (p2.part || 'Part 2'))}</b> <span class="fd-sm">(the part that follows)</span><br>
        <span class="fd-sm">Starts ${fdDay(p2.first.session_date)}, ${fdTime(p2.first.session_time)} · ${p2.weeks} week${p2.weeks === 1 ? '' : 's'}${p2.min != null ? ' · ages ' + p2.min + (p2.max != null && p2.max < 99 ? '–' + p2.max : '+') : ''} · ${p2.left > 0 ? p2.left + ' left' : 'full'}${pct ? ` · <b>${pct}% off</b> with ${esc(c.part || c.name)}${all ? '' : ' (members)'}` : ''}</span></span></label>`; }
  } else {
    const acDays = A.days.filter(d => !fdIsHalf(d.title) && !fdIsPa(d.title) || fdIsPa(d.title));   // (half days have no aftercare)
    h += `<h3>${esc([...new Set(A.days.map(fdCampProg))].join(' + '))}</h3><p class="fd-sm">${A.days.map(d => fdDay(d.session_date) + (A.days.filter(y => y.session_date === d.session_date).length > 1 ? ' ' + fdTime(d.session_time) : '')).join(', ')}</p>` + fdWhoHtml(true, A.days[0].session_date);
    if (acDays.length) {
      if (A.acInit !== true) { acDays.forEach(d => { if (A.after[d.id] === undefined) A.after[d.id] = true; }); A.acInit = true; }
      h += `<div class="fd-field"><label class="fd-chk"><input type="checkbox" ${A.aftercare ? 'checked' : ''} onchange="_fd.add.aftercare=this.checked;fdRender()"> <b>Add aftercare</b></label>` +
        (A.aftercare ? '<span class="fd-sm">On which days? Tap a day to add or remove it.</span><div class="fd-chips2">' + acDays.map(d => `<button class="fd-chip${A.after[d.id] ? ' on' : ''}" onclick="_fd.add.after['${d.id}']=!_fd.add.after['${d.id}'];fdRender()">${fdDay(d.session_date)}</button>`).join('') + '</div>' : '') + '</div>';
    }
  }
  if (A.kind !== 'party') h += `<div class="fd-field"><b>Giveaway or credit code</b> <span class="fd-sm">(optional)</span><input value="${esc(A.prize || '')}" oninput="_fd.add.prize=this.value" placeholder="${A.kind === 'ws' ? 'e.g. 2026ABJE 2026ABJE2' : 'Code'}">${A.kind === 'ws' ? '<span class="fd-sm">Two codes (one per person)? Type both, with a space between.</span>' : ''}</div>`;
  h += `
    ${_fd.addMsg ? `<p class="fd-warn">${esc(_fd.addMsg)}</p>` : ''}
    <div class="fd-sheet-btns"><button class="ho-btn" onclick="_fd.add=null;_fd.addMsg='';fdRender()">Cancel</button><button class="fd-pay" onclick="fdAddDone()">Add to cart</button></div></div></div>`;
  return h;
}
function fdAddDone() {
  if (_fd.add && _fd.add.kind === 'party') return fdPtyAddDone();
  const F = _fd, A = F.add, who = F.people.filter((p, i) => A.who[i]);
  // (Nov 13 2026) several codes on a workshop booking (one per spot, e.g. a coupon for 2 that came as two codes): space or comma between
  const codes = [...new Set(String(A.prize || '').toUpperCase().split(/[\s,;]+/).map(c => c.replace(/[^A-Z0-9-]/g, '')).filter(Boolean))];
  const prize = codes[0] || undefined, prizesMore = codes.slice(1);
  const fail = m => { F.addMsg = m; fdRender(); };
  if (!F.fam) return fail('Choose the family first.');
  if (prizesMore.length && A.kind !== 'ws') return fail('One code for a class or camp booking (several codes work on workshops).');
  if (A.kind === 'ws') {
    const x = A.x, guests = FD_BANDS.map(b => ({ label: b[1], n: A.guests[b[0]] || 0 })).filter(g => g.n > 0);
    if (!who.length && !guests.length) return fail('Tick who’s coming, or add guests.');
    const chk = fdWsCheck(A); if (chk.bad) return fail(chk.msg);
    if ((x.item || {}).kind === 'glazing' && !(A.glaze || '').trim()) return fail('Add what they’re glazing.');
    if (x.kids_only && (!(A.puName || '').trim() || String(A.puPhone || '').replace(/\D/g, '').length < 7)) return fail('Add who’s picking up (name and phone).');
    const n = who.length + guests.reduce((t, g) => t + g.n, 0);
    F.cart.push({ type: 'world', session_id: x.id, title: `${fdClean(x.title)} · ${fdDay(x.session_date)}, ${fdTime(x.session_time)}`,
      people: who.map(p => ({ name: p.name, dob: p.dob })), guests, extras: { hot: A.extras.hot || 0, candy: A.extras.candy || 0 }, glaze: A.glaze || undefined,
      pickup: x.kids_only ? { name: A.puName, phone: A.puPhone } : undefined, prize, prizes_more: prizesMore.length ? prizesMore : undefined,
      desc: [who.map(p => p.name).join(', '), guests.map(g => g.n + ' × ' + g.label).join(', '), n + (n === 1 ? ' spot' : ' spots'), (A.extras.hot ? A.extras.hot + ' hot choc' : ''), (A.extras.candy ? A.extras.candy + ' candy' : ''), prize ? (codes.length > 1 ? 'codes ' + codes.join(' + ') : 'code ' + prize) : ''].filter(Boolean).join(' · ') });
  } else if (A.kind === 'class') {
    if (!who.length) return fail('Tick who’s coming.');
    if (who.some(p => !p.dob && !p.adult)) return fail('Every child needs a birthdate for a class.');
    if (A.c.family) { const fc = fdFamilyCheck(A); if (fc.bad) return fail(fc.msg); }
    const both = A.p2 && A.both && A.p2.left > 0 ? A.p2 : null;
    if (both && both.left < who.length) return fail(`Only ${both.left} spot${both.left === 1 ? '' : 's'} left in ${both.part || both.name}.`);
    F.cart.push({ type: 'class', slot_id: A.c.slot_id, both_slot: both ? both.slot_id : undefined,
      title: `${A.c.name}${A.c.part ? ' · ' + A.c.part : ''}${both ? ' + ' + (both.page && both.page !== A.c.page ? both.name : (both.part || 'Part 2')) : ''} · from ${fdDay(A.c.first.session_date)}`,
      kids: who.map(p => ({ name: p.name, dob: p.dob, adult: !!p.adult })), prize, desc: who.map(p => p.name).join(', ') + (both ? ' · both parts' : '') + (prize ? ' · code ' + prize : '') });
  } else {
    if (!who.length) return fail('Tick who’s coming.');
    if (who.some(p => !p.dob)) return fail('Every camper needs a birthdate.');
    const days = A.days.map(d => d.id), after = A.aftercare ? days.filter(k => A.after[k]) : [];
    F.cart.push({ type: 'camp', days, aftercare: after, kids: who.map(p => ({ name: p.name, dob: p.dob })), prize,
      title: `Camp · ${days.length} day${days.length === 1 ? '' : 's'} (${A.days.map(d => fdDay(d.session_date)).join(', ')})`,
      desc: [who.map(p => p.name).join(', '), after.length ? after.length + ' aftercare' : '', prize ? 'code ' + prize : ''].filter(Boolean).join(' · ') });
    F.campPick = {};
  }
  F.add = null; F.addMsg = ''; fdRender();
}

// ---------- The running subtotal (camp-checkout staff_quote: prices only, nothing held) ----------
function fdQuoteKey() { const F = _fd; return F.fam && F.cart.length ? JSON.stringify([F.studio, F.fam.customer_id, F.fam.email, F.cart.map(l => { const o = Object.assign({}, l); delete o.desc; delete o.prize; delete o.prizes_more; return o; })]) : ''; }
function fdQuoteSoon() {
  const F = _fd, k = fdQuoteKey(); if (!F || k === F.qKey) return;
  F.qKey = k; F.quote = k ? { loading: true } : null;
  clearTimeout(F.qT); if (!k) return;
  F.qT = setTimeout(async () => {
    try { const d = await fdCall({ action: 'staff_quote', studio: F.studio, family: F.fam, lines: F.cart.map(l => { const o = Object.assign({}, l); delete o.desc; return o; }) });
      if (_fd === F && F.qKey === k) { F.quote = d; fdRender(); } }
    catch (e) { if (_fd === F && F.qKey === k) { F.quote = { err: e.message }; fdRender(); } }
  }, 350);
}
function fdQuoteHtml() {
  const F = _fd, Q = F.quote;
  if (!F.fam) return '<p class="fd-sm">Choose the family to see the prices (member prices depend on them).</p>';
  if (!Q || Q.loading) return '<div class="fd-sub"><div class="fd-pl fd-sm"><span>Working out the price…</span></div></div>';
  if (Q.err) return `<p class="fd-warn">${esc(Q.err)}</p>`;
  const saved = (Q.lines || []).reduce((t, l) => t + Math.max(0, (Number(l.regular) || 0) - (Number(l.amount) || 0)), 0);
  const codes = F.cart.some(l => l.prize) || (F.gift || '').trim();
  return '<div class="fd-sub">' + (Q.lines || []).map(l => `<div class="fd-pl fd-sm"><span>${esc(l.kind === 'treat' || l.kind === 'retail' ? l.program + (l.qty ? ' × ' + l.qty : '') : l.program)}</span><span>${Number(l.regular) > Number(l.amount) + 0.004 ? `<s>${fdMoney(l.regular)}</s> ` : ''}${fdMoney(l.amount)}</span></div>`).join('') +
    `<div class="fd-pl"><span>Subtotal</span><b>${fdMoney(Q.subtotal)}</b></div>` +
    (Q.taxes || []).map(t => `<div class="fd-pl fd-sm"><span>${esc(t.type)} (${t.rate}%)</span><span>${fdMoney(t.amount)}</span></div>`).join('') +
    `<div class="fd-pl fd-ptotal"><span>Total</span><span>${fdMoney(Q.total)}</span></div>` +
    (saved > 0.004 ? `<p class="fd-ok">${Q.member ? 'Member prices: ' : ''}saving ${fdMoney(saved)}</p>` : '') +
    (codes ? '<p class="fd-sm">Codes and gift cards come off when you pay.</p>' : '') + '</div>';
}
// ---------- Paying (camp-checkout, staff mode) ----------
async function fdCall(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/camp-checkout`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify(Object.assign({ staff: true, staff_pin: fdPin() || undefined }, body)) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d;
}
async function fdPay(mode) {
  const F = _fd; if (F.busy) return;
  const win = mode === 'here' ? window.open('', '_blank') : null;   // 💳 card here: Stripe in a new tab (opened now, while it's a tap, so it isn't blocked)
  if (win) try { win.document.write('<p style="font-family:sans-serif;padding:20px">Opening Stripe…</p>'); } catch (e) {}
  if (mode === 'card') { const c = ((F.cards && F.cards.list) || []).find(x => x.id === F.cardPick); if (!c) return;
    if (!confirm(`Charge ${fdMoney((F.quote && F.quote.total) || 0) !== '$0.00' ? fdMoney(F.quote.total) + ' to ' : ''}${fdCardLabel(c)} now?\n\nThe family gets an emailed receipt.`)) return; }
  F.busy = true; F.msg = mode === 'card' ? 'Charging their card…' : mode === 'qr' || mode === 'here' ? 'Getting the payment ready…' : mode === 'email' ? 'Sending the pay link…' : mode === 'invoice' ? 'Sending the invoice…' : 'Making the pay link…'; fdRender();
  try {
    const lines = F.cart.map(l => { const o = Object.assign({}, l); delete o.desc; return o; });
    const d = await fdCall({ action: 'staff_checkout', studio: F.studio, family: F.fam, lines, mode: mode === 'here' ? 'qr' : mode, gift_code: F.gift.trim() || null,
      payment_method: mode === 'card' ? F.cardPick : undefined,
      pay_by: mode === 'invoice' ? (F.payBy || fdAddDays(fdToday(), 2)) : undefined });
    if (win) { if (d.url && !d.paid) win.location = d.url; else win.close(); }
    F.order = Object.assign({ mode, status: d.paid ? 'paid' : 'pending' }, d); F.msg = '';
    if (d.paid && d.order && (mode === 'card' || mode === 'qr' || mode === 'here' || F.cart.some(l => l.walk))) fdWalkMark(d.order);   // (paid straight away: card on file, or nothing to pay)
    if (mode === 'link' && d.url) { try { await navigator.clipboard.writeText(d.url); F.order.copied = true; } catch (e) {} }
    if (!d.paid) fdPoll();
  } catch (e) { F.msg = e.message; if (win) win.close(); if (mode === 'card') fdWaitLoad(); }
  F.busy = false; fdRender();
}
// 💳 (Nov 10 2026) card on file: the family's saved cards (brand, last 4, expiry only; card details stay with Stripe)
const FD_BRAND = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', diners: 'Diners' };
const fdCardLabel = c => `${FD_BRAND[c.brand] || 'Card'} ••${c.last4}`;
function fdCardsHtml(needFam) {
  const F = _fd; if (needFam || !F.fam || F.fam.walk_in || !F.fam.email) return '';
  if (!F.cards || F.cards.email !== F.fam.email) { F.cards = { email: F.fam.email, list: null }; fdCardsLoad(); return ''; }
  const L = F.cards.list; if (!L || !L.length) return '';
  if (!L.some(c => c.id === F.cardPick)) F.cardPick = L[0].id;
  return `<div class="fd-cof"><span class="fd-sm">Saved card</span>${L.length > 1 ? `<select onchange="_fd.cardPick=this.value">${L.map(c => `<option value="${c.id}"${c.id === F.cardPick ? ' selected' : ''}>${esc(fdCardLabel(c))} · exp ${c.exp_month}/${String(c.exp_year).slice(2)}</option>`).join('')}</select>`
      : `<b>${esc(fdCardLabel(L[0]))}</b> <span class="fd-sm">exp ${L[0].exp_month}/${String(L[0].exp_year).slice(2)}</span>`}
    <button class="fd-pay fd-pay-cof" ${F.busy ? 'disabled' : ''} onclick="fdPay('card')">💳 Charge card on file</button></div>`;
}
async function fdCardsLoad() {
  const F = _fd, email = F.fam && F.fam.email; if (!email) return;
  try { const d = await fdCall({ action: 'staff_cards', studio: F.studio, family: { email } }); if (F.cards && F.cards.email === email) { F.cards.list = d.cards || []; if ((d.cards || []).length) fdRender(); } }
  catch (e) { if (F.cards) F.cards.list = []; }
}
function fdPayHtml() {
  const F = _fd, o = F.order, left = o.deadline ? Math.max(0, Math.round((new Date(o.deadline) - Date.now()) / 1000)) : 0;
  const lines = (o.lines || []).map(l => `<div class="fd-pl"><span>${esc(l.name)}</span><span>${fdMoney(l.amount)}</span></div>`).join('') +
    (o.taxes || []).map(t => `<div class="fd-pl fd-sm"><span>${esc(t.type)} (${t.rate}%)</span><span>${fdMoney(t.amount)}</span></div>`).join('') +
    `<div class="fd-pl fd-ptotal"><span>Total</span><span>${fdMoney(o.total)}</span></div>` + (o.amount_due != null && o.amount_due < o.total - 0.001 ? `<div class="fd-pl"><span>After gift card</span><b>${fdMoney(o.amount_due)}</b></div>` : '');
  let h = `<div class="fd-sheet-back"><div class="fd-sheet fd-paysheet" role="dialog" aria-modal="true"><h3>${esc(o.order || '')} · ${esc(F.fam ? F.fam.first_name + ' ' + (F.fam.last_name || '') : '')}</h3><div class="fd-plines">${lines}</div>`;
  if (o.status === 'paid' && F.cart.length && F.cart.every(l => l.type === 'retail')) h += `<div class="fd-paid">✓ Paid. Thank you!</div><p class="fd-sm">${F.fam && F.fam.walk_in ? 'Hand them their items.' : 'Their receipt is on its way by email. Hand them their items.'}</p>`;
  else if (o.status === 'paid') h += '<div class="fd-paid">✓ Paid. They’re booked!</div><p class="fd-sm">Their confirmation email is on its way; the booking is in My 4Cats and on the class list.</p>';
  else if (o.status === 'expired' || o.status === 'failed') h += '<div class="fd-expired">Not paid in time, so the spots went back.</div>';
  else if (o.mode === 'here') h += `<div class="fd-qrwrap"><div><p><b>💳 Stripe is open in another tab.</b> Type the card there for ${fdMoney(o.amount_due ?? o.total)}, then come back to this tab: it turns green when it’s paid.</p>
      <p class="fd-count-down" id="fd-count">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left</p><p class="fd-sm">If their bank asks for an extra check, they approve it on their phone.</p>
      <button class="ho-btn" onclick="window.open(_fd.order.url,'_blank')">Open Stripe again</button></div></div>`;
  else if (o.mode === 'qr') h += `<div class="fd-qrwrap"><div id="fd-qr" class="fd-qr"></div><div><p><b>Scan with your phone camera to pay ${fdMoney(o.amount_due ?? o.total)}.</b></p><p class="fd-count-down" id="fd-count">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left</p>
      <p class="fd-sm">Card, Apple Pay or Google Pay. This turns green when it’s paid.</p><button class="ho-btn" onclick="navigator.clipboard.writeText(_fd.order.url).then(()=>alert('Link copied.'))">Copy the link instead</button></div></div>`;
  else if (o.mode === 'invoice') h += `<p>🧾 Invoice emailed to <b>${esc(F.fam.email)}</b>. They pay by <b>${esc(new Date(o.deadline).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }))}</b>: the booking is held until then, with a reminder the day before. If it isn’t paid, the time opens up again.</p>
      <div class="fd-inline"><input readonly value="${esc(o.url || '')}" onclick="this.select()"><button class="ho-btn" onclick="navigator.clipboard.writeText(_fd.order.url).then(()=>{_fd.order.copied=true;fdRender()})">${o.copied ? 'Copied ✓' : 'Copy the Pay now link'}</button></div>`;
  else h += `<p>${o.mode === 'email' ? `✉️ Pay link emailed to <b>${esc(F.fam.email)}</b>.` : o.copied ? '🔗 Pay link copied. Paste it into a text or message.' : '🔗 Pay link ready.'} Spots held until <b>${esc(new Date(o.deadline).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</b>.</p>
      <div class="fd-inline"><input readonly value="${esc(o.url || '')}" onclick="this.select()"><button class="ho-btn" onclick="navigator.clipboard.writeText(_fd.order.url).then(()=>{_fd.order.copied=true;fdRender()})">Copy</button>${o.mode === 'email' ? '<button class="ho-btn" onclick="fdResend(_fd.order.order_id)">Send again</button>' : ''}</div>`;
  h += '<div class="fd-sheet-btns">' + (o.status === 'pending' || o.status === 'expired' || o.status === 'failed' ? '<button class="ho-btn fd-backcart" onclick="fdBackToCart()" title="Nothing is lost: the family and everything in the cart stay, to pay another way">← Back to the cart <small>(pay another way)</small></button>' : '') +
    (o.status === 'pending' ? `<button class="ho-btn" onclick="fdCancel()">${F.cart.length && F.cart.every(l => l.type === 'retail') ? 'Cancel this sale' : 'Cancel (spots go back)'}</button>` : '') +
    (o.status === 'pending' && o.mode !== 'qr' && o.mode !== 'here' ? '<button class="fd-pay" onclick="fdDone()">Done (they’ll pay later)</button>' : `<button class="fd-pay" onclick="fdDone()">${o.status === 'paid' ? 'Next family' : 'Close'}</button>`) + '</div></div></div>';
  return h;
}
function fdQrDraw() {
  const o = _fd && _fd.order, el = document.getElementById('fd-qr'); if (!o || !el || o.status !== 'pending' || o.mode !== 'qr' || el.firstChild) return;
  try { const q = qrcode(0, 'M'); q.addData(o.url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 5, margin: 4, scalable: true }); }
  catch (e) { el.textContent = 'The QR code didn’t draw. Use “Copy the link instead”.'; }
}
let _fdTimer = null;
function fdPoll() {
  clearInterval(_fdTimer); let n = 0;
  _fdTimer = setInterval(async () => {
    const o = _fd && _fd.order; if (!o || o.status !== 'pending') { clearInterval(_fdTimer); return; }
    const left = o.deadline ? Math.round((new Date(o.deadline) - Date.now()) / 1000) : 1;
    const c = document.getElementById('fd-count'); if (c) c.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left` : 'Time’s up';
    if ((o.mode === 'qr' || o.mode === 'here') && left <= 0) { clearInterval(_fdTimer); try { await fdCall({ action: 'staff_cancel', order_id: o.order_id }); } catch (e) {} o.status = 'expired'; fdRender(); return; }
    if (++n % 3) return;
    try { const d = await fdCall({ action: 'staff_status', order_id: o.order_id }); if (d.status !== 'pending') { o.status = d.status; clearInterval(_fdTimer); fdRender();
      if (d.status === 'paid' && (o.mode === 'qr' || o.mode === 'here' || _fd.cart.some(l => l.walk))) fdWalkMark(o.order); } } catch (e) {}
  }, 1000);
}
async function fdCancel() {
  const o = _fd.order; if (!o || !confirm('Cancel this order? The held spots go back to the schedule.')) return;
  try { await fdCall({ action: 'staff_cancel', order_id: o.order_id }); o.status = 'expired'; fdAckCancelled(o.order_id); } catch (e) { alert(e.message); }
  clearInterval(_fdTimer); fdRender();
}
// (Nov 10 2026) They changed their mind about how to pay: this payment is cancelled (held spots go back for a moment) and the
// cart and family stay, so another way to pay can be chosen straight away
async function fdBackToCart() {
  const o = _fd.order; if (!o) return;
  if (o.status === 'pending') { try { await fdCall({ action: 'staff_cancel', order_id: o.order_id }); fdAckCancelled(o.order_id); } catch (e) { alert(e.message); return; } }
  clearInterval(_fdTimer); _fd.order = null; _fd.msg = 'Back to the cart: choose how they’ll pay.'; _fd.qKey = ''; fdRender();
}
async function fdDone() {
  const o = _fd.order;
  if (o && (o.status === 'expired' || o.status === 'failed')) { fdBackToCart(); return; }   // (not paid: the cart stays)
  if (o && o.status === 'pending' && (o.mode === 'qr' || o.mode === 'here')) { try { await fdCall({ action: 'staff_cancel', order_id: o.order_id }); } catch (e) {} }   // (unpaid: its spots go back now)
  clearInterval(_fdTimer);
  const keep = { tab: _fd.tab, date: _fd.date, wsF: _fd.wsF, clsF: _fd.clsF };
  _fd = Object.assign(fdNew(), keep); fdRender(); fdLoadTab(); fdWaitLoad();   // (fresh counts after a sale; an emailed one joins 🧾 the list)
}
async function fdResend(id) { try { await fdCall({ action: 'staff_resend', order_id: id }); alert('Sent again.'); } catch (e) { alert(e.message); } }
// ---------- Recent orders (this studio, last 7 days) ----------
// ---------- 🧾 Waiting to pay (fd_waiting_returns.sql): orders this desk emailed, sent as a link or invoiced ----------
// Each stays on the list until someone deals with it: paid → ✓ Acknowledge; not paid → a new link, "paid another way", or
// "not paid" (written off, with a note). Drinks and snacks already used are never just removed.
let _fdWait = { list: null, open: false, timer: null };
async function fdWaitLoad() {
  if (!_fd) return;
  const { data, error } = await sb.rpc('hub_pos_waiting', { p_studio: _fd.studio });
  _fdWait.list = error ? { err: /hub_pos_waiting/.test(error.message) ? 'Run fd_waiting_returns.sql in Supabase first.' : error.message } : (data || []);
  const pane = document.getElementById('fd-pane'); if (pane && pane.style.display !== 'none') fdRender();
}
function fdWaitTick() {   // every 30 seconds while the Front desk is open
  clearInterval(_fdWait.timer);
  _fdWait.timer = setInterval(() => { const pane = document.getElementById('fd-pane'); if (!pane || pane.style.display === 'none') { clearInterval(_fdWait.timer); return; }
    if (!(_fd && (_fd.order || _fd.add || _fd.shopPick || _fdRet.open))) fdWaitLoad(); }, 30000);
}
const fdWaitState = o => o.status === 'paid' ? 'paid' : o.status === 'pending' && (!o.expires || new Date(o.expires) > new Date()) ? 'wait' : 'unpaid';
function fdWaitChipHtml() {
  const L = Array.isArray(_fdWait.list) ? _fdWait.list : []; if (!L.length) return '';
  const n = k => L.filter(o => fdWaitState(o) === k).length, w = n('wait'), p = n('paid'), u = n('unpaid');
  return `<button class="fd-wait-chip${u ? ' bad' : p ? ' good' : ''}" onclick="_fdWait.open=true;fdRender()">🧾 ${[w ? w + ' waiting to pay' : '', p ? `✓ ${p} paid` : '', u ? `⚠ ${u} not paid` : ''].filter(Boolean).join(' · ')}</button>`;
}
function fdWaitHtml() {
  const L = _fdWait.list;
  const row = o => { const k = fdWaitState(o), ago = Math.round((Date.now() - new Date(o.at)) / 60000);
    const when = ago < 60 ? ago + ' min ago' : ago < 1440 ? Math.round(ago / 60) + ' h ago' : new Date(o.at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    return `<div class="fd-wait-row ${k}"><div><b>${esc(o.name || '')}</b> <span class="fd-sm">${esc(o.order || '')} · ${fdMoney(o.total)} · ${o.mode === 'invoice' ? 'invoice' : o.mode === 'link' ? 'link' : 'emailed'} ${esc(when)}${o.by ? ' · by ' + esc(String(o.by).split('@')[0]) : ''}</span>
        <div class="fd-sm">${esc(o.what || '')}</div></div>
      <div class="fd-wait-act">${k === 'paid' ? `<span class="fd-st ok">✓ Paid</span><button class="ho-btn primary sm" onclick="fdWaitAck('${o.id}','paid')">Acknowledge</button>`
        : k === 'wait' ? `<span class="fd-st wait">Waiting</span>${o.mode === 'email' ? `<button class="ho-btn sm" onclick="fdResend('${o.id}')">Send again</button>` : ''}<button class="ho-btn sm" onclick="fdWaitPayOther('${o.id}')" title="Turn off the emailed link and take payment here instead">Pay another way</button><button class="ho-btn sm" onclick="fdWaitCancel('${o.id}')">Cancel order</button>`
        : `<span class="fd-st off">⚠ Not paid</span><button class="ho-btn sm" onclick="fdWaitAgain('${o.id}')" title="The same items, back in the cart to send a new link">New link</button><button class="ho-btn sm" onclick="fdWaitPayOther('${o.id}')" title="Take payment here instead">Pay another way</button><button class="ho-btn sm" onclick="fdWaitCancel('${o.id}')">Cancel order</button><button class="ho-btn sm" onclick="fdWaitOff('${o.id}')">Not paid…</button>`}</div></div>`; };
  const A = Array.isArray(L) ? L : [], groups = [['unpaid', '⚠ Not paid: needs someone to deal with it'], ['paid', '✓ Paid: acknowledge'], ['wait', 'Waiting to pay']];
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_fdWait.open=false;fdRender()}"><div class="fd-sheet" style="max-width:760px"><h3>🧾 Sent to pay</h3>
    <p class="fd-sm">Orders this desk emailed or sent as a link. Each stays here until it’s dealt with, so nobody forgets one: paid ones need a tap to acknowledge, and unpaid ones (especially drinks and snacks already had) stay until someone decides.</p>
    ${!L ? fdLoading : L.err ? `<p class="fd-msg">${esc(L.err)}</p>` : !A.length ? '<p class="fd-sm">Nothing waiting. 🎉</p>' : groups.map(([k, t]) => { const g = A.filter(o => fdWaitState(o) === k); return g.length ? `<h4 class="fd-wait-h">${t} (${g.length})</h4>` + g.map(row).join('') : ''; }).join('')}
    <div class="fd-sheet-btns"><button class="ho-btn" onclick="fdWaitLoad()">↻ Refresh</button><button class="ho-btn" onclick="_fdWait.open=false;fdRender()">Close</button></div></div></div>`;
}
async function fdWaitAck(id, kind, note) {
  const { error } = await sb.rpc('hub_pos_ack', { p_order: id, p_kind: kind, p_note: note || null });
  if (error) { alert(error.message); return false; } await fdWaitLoad(); return true;
}
async function fdWaitOther(id) {
  const o = (_fdWait.list || []).find(x => x.id === id); if (!o) return;
  const how = prompt(`How did ${o.name || 'they'} pay ${fdMoney(o.total)}? (e.g. cash, paid at the counter, already paid)`, ''); if (how === null) return;
  if (o.status === 'pending') { try { await fdCall({ action: 'staff_cancel', order_id: id }); } catch (e) { } }   // (the link is turned off, so it can't be paid twice)
  fdWaitAck(id, 'paid_other', how || 'Paid another way');
}
// (Nov 14 2026) Pay another way: the emailed link turned off, and the same items back in the cart to pay here (card, QR on their phone…)
async function fdWaitPayOther(id) {
  const o = (_fdWait.list || []).find(x => x.id === id); if (!o) return;
  const L = o.lines || [], movable = L.filter(l => (l.kind === 'retail' && l.variant_id) || l.kind === 'charge');
  if (!movable.length || movable.length < L.length) { alert('This order has bookings in it (classes, workshops…), so it can’t go back in the cart by itself.\n\nCancel the order, then book it again from the tabs and choose how they’ll pay.'); return; }
  if (!confirm(`Pay another way: the emailed link for ${fdMoney(o.total)} is turned off, and the items go back in the cart so ${o.name || 'they'} can pay here. Go ahead?`)) return;
  if (o.status === 'pending') { try { await fdCall({ action: 'staff_cancel', order_id: id }); } catch (e) { } }   // (so it can't be paid twice)
  await fdWaitAgain(id, true);
}
// (Nov 14 2026) Cancel order: the link turned off, and the order off the list (with a reason, kept with it)
async function fdWaitCancel(id) {
  const o = (_fdWait.list || []).find(x => x.id === id); if (!o) return;
  const why = prompt(`Cancel this order? ${o.name || ''} · ${o.what || ''} (${fdMoney(o.total)}).\n\nThe pay link stops working. Why? (optional, kept with the order)`, ''); if (why === null) return;
  if (o.status === 'pending') { try { await fdCall({ action: 'staff_cancel', order_id: id }); } catch (e) { } }
  await fdWaitAck(id, 'cancelled', why.trim() || 'Cancelled at the desk');
}
async function fdWaitOff(id) {
  const o = (_fdWait.list || []).find(x => x.id === id); if (!o) return;
  const why = prompt(`Not paid: ${o.what || ''} (${fdMoney(o.total)}).\n\nWhy? (kept with the order; any shop items come off stock as given)`, ''); if (!why || !why.trim()) return;
  if (o.status === 'pending') { try { await fdCall({ action: 'staff_cancel', order_id: id }); } catch (e) { } }
  fdWaitAck(id, 'written_off', why.trim());
}
// not paid: the same items back in the cart (with the family), to send a new link; the old one comes off the list
async function fdWaitAgain(id, payHere) {
  const o = (_fdWait.list || []).find(x => x.id === id); if (!o) return;
  if (_fd.cart.length && !confirm('Replace what’s in the cart now with this order’s items?')) return;
  const L = (o.lines || []), cart = [];
  L.forEach(l => { if (l.kind === 'retail' && l.variant_id) cart.push({ type: 'retail', variant_id: l.variant_id, product_id: l.product_id, qty: +l.qty || 1, title: l.program, desc: '' });
    else if (l.kind === 'charge') cart.push({ type: 'charge', name: l.program, amount: +l.amount, ref: l.ref || null, title: l.program, desc: '' }); });
  const skipped = L.length - cart.length;
  if (!cart.length) { alert('This order has bookings, not shop items: book them again from the tabs.'); return; }
  _fd.cart = cart; _fd.fam = { customer_id: null, email: o.email, first_name: String(o.name || 'Family').split(' ')[0], last_name: String(o.name || '').split(' ').slice(1).join(' ') };
  await fdWaitAck(id, 'cancelled', payHere ? 'Paid another way at the desk' : 'A new link was sent');
  _fdWait.open = false; _fd.msg = skipped ? 'Back in the cart (bookings in it need adding again from the tabs). Choose how they’ll pay.' : 'Back in the cart: choose how they’ll pay.'; fdRender();
}
function fdAckCancelled(id) { sb.rpc('hub_pos_ack', { p_order: id, p_kind: 'cancelled', p_note: 'Cancelled at the desk' }).then(() => fdWaitLoad()).catch(() => {}); }

// ↩ (Nov 10 2026) a cancellation's gift card swapped for a refund to how they paid (home office; only while the gift card is unused)
async function famRefundInstead(last4, amount) {
  const f = _fam.open; if (!f || !f.email) return;
  if (!confirm(`Refund $${Number(amount).toFixed(2)} to how they paid, instead of the gift card ending ${last4}?\n\nThe gift card is switched off first (only if none of it has been used). They get an email. This can’t be undone.`)) return;
  try { const d = await staffBookingCall('staff_refund_instead', { booking_ids: [], gift_last4: last4, email: f.email, by: '' });
    alert(`✓ $${Number(d.amount).toFixed(2)} refunded${d.gift ? ` ($${Number(d.card).toFixed(2)} to their card, $${Number(d.gift).toFixed(2)} back onto their gift card)` : ' to their card'}. The gift card ending ${d.gift_last4} is switched off.`);
  } catch (e) { alert(e.message); }
}
// ---------- ⭐ Member pricing for a group that isn't a member (partner_pricing.sql) ----------
document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.fam-sec[data-sec="partner"]') && d.open) famPartnerLoad(d.querySelector('.fam-partner')); }, true);
async function famPartnerLoad(box) {
  if (!box) return; const cid = box.getAttribute('data-cid'), email = box.getAttribute('data-email');
  const { data, error } = await sb.rpc('hub_partner_pricing', { p_customer: Number(cid) || null, p_email: email || null });
  if (error) { box.innerHTML = '<p class="fam-meta">' + famEsc(/hub_partner_pricing/.test(error.message) ? 'Run partner_pricing.sql in Supabase first.' : error.message) + '</p>'; return; }
  const p = data, has = k => p ? (p.kinds || []).includes(k) : true;
  box.innerHTML = (p ? `<p class="fam-line">✓ <b>${famEsc(p.label)}</b>: member prices on ${[(p.kinds || []).includes('team_building') ? 'Adult Get-Togethers' : '', (p.kinds || []).includes('kids_parties') ? 'Kids & Splatter parties' : ''].filter(Boolean).join(' and ')}, party extras included${p.until ? ', until ' + famEsc(p.until) : ''}.${p.note ? ' <span class="fam-meta">' + famEsc(p.note) + '</span>' : ''}</p>` : '<p class="fam-meta">Not set. For a group you give member prices to without a membership (e.g. a nonprofit).</p>') +
    `<div class="fam-pp-form"><label>Who it’s for<input class="pp-label" maxlength="120" placeholder="e.g. Nonprofit: Big Sisters Victoria" value="${p ? famEsc(p.label) : ''}"></label>
      <label class="ba-check"><input type="checkbox" class="pp-gt" ${has('team_building') ? 'checked' : ''}> Adult Get-Togethers</label>
      <label class="ba-check"><input type="checkbox" class="pp-kp" ${has('kids_parties') ? 'checked' : ''}> Kids & Splatter parties</label>
      <label>Until (optional)<input type="date" class="pp-until" value="${p && p.until ? famEsc(p.until) : ''}"></label>
      <label>Note (optional)<input class="pp-note" maxlength="300" value="${p && p.note ? famEsc(p.note) : ''}"></label>
      <div><button class="ho-btn sm primary" onclick="famPartnerSave(this.closest('.fam-partner'))">${p ? 'Update' : 'Turn on'}</button>${p ? ` <button class="ho-btn sm" onclick="famPartnerEnd(this.closest('.fam-partner'),'${famEsc(p.id)}')">End it</button>` : ''}</div>
      <p class="fam-meta">Member prices on those bookings (World and the Front desk), party extras included: time, guests, upgrades. They aren’t members: no perks, and nothing else changes.</p></div>`;
}
async function famPartnerSave(box) {
  const q = c => box.querySelector(c), kinds = [q('.pp-gt').checked ? 'team_building' : null, q('.pp-kp').checked ? 'kids_parties' : null].filter(Boolean);
  const { error } = await sb.rpc('hub_partner_pricing_save', { p: { customer_id: box.getAttribute('data-cid') || null, email: box.getAttribute('data-email') || null,
    label: q('.pp-label').value, kinds, until: q('.pp-until').value || null, note: q('.pp-note').value } });
  if (error) { alert(error.message); return; } famPartnerLoad(box);
}
async function famPartnerEnd(box, id) {
  if (!confirm('End member pricing for this group?')) return;
  const { error } = await sb.rpc('hub_partner_pricing_save', { p: { action: 'end', id } }); if (error) { alert(error.message); return; } famPartnerLoad(box);
}
async function famRefundOrder(order) {
  if (!confirm(`Order ${order}: refund the credit given when it was cancelled to how they paid instead?\n\nThe gift card is switched off first (only if none of it has been used). They get an email. This can’t be undone.`)) return;
  try { const d = await staffBookingCall('staff_refund_instead', { booking_ids: [], order, by: '' });
    alert(`✓ $${Number(d.amount).toFixed(2)} refunded${d.gift ? ` ($${Number(d.card).toFixed(2)} to their card, $${Number(d.gift).toFixed(2)} back onto their gift card)` : ' to their card'}. The gift card ending ${d.gift_last4} is switched off.`);
  } catch (e) { alert(e.message); }
}
// ---------- 💳 Saved cards in a family card: loaded from Stripe when the section is opened ----------
document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.fam-sec[data-sec="cards"]') && d.open) famCardsLoad(d.querySelector('.fam-cards')); }, true);
async function famCardsLoad(box, removeId) {
  if (!box) return; const email = box.getAttribute('data-email');
  box.innerHTML = '<p class="fam-meta">Checking with Stripe…</p>';
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/camp-checkout`, { method: 'POST', headers: await fnHeaders(),
      body: JSON.stringify(removeId ? { staff: true, staff_pin: fdPin() || undefined, action: 'staff_card_remove', studio: _sessionStudioId, family: { email }, payment_method: removeId } : { staff: true, staff_pin: fdPin() || undefined, action: 'staff_cards', studio: _sessionStudioId, family: { email } }) });
    const d = await r.json().catch(() => ({})); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status);
    const L = d.cards || [], ho = !!(_studioData && _studioData.isAdmin);
    box.innerHTML = !L.length ? '<p class="fam-meta">No saved cards. A card is saved when they tick “Save my payment information” on a 4Cats payment page.</p>'
      : L.map(c => `<div class="fam-row2"><span class="fam-what"><b>${famEsc(fdCardLabel(c))}</b><span class="fam-meta">exp ${c.exp_month}/${String(c.exp_year).slice(2)}</span></span>${ho ? `<button class="ho-btn sm" onclick="if(confirm('Remove this card? The studio won’t be able to charge it any more.'))famCardsLoad(this.closest('.fam-cards'),'${c.id}')">Remove</button>` : ''}</div>`).join('')
        + '<p class="fam-meta">Charge one from the Front desk (💳 Charge card on file). They can remove cards in My 4Cats on World.</p>';
  } catch (e) { box.innerHTML = '<p class="fam-meta">' + famEsc(e.message) + '</p>'; }
}
// ---------- 🪑 Who's here now (fd_here_now.sql): today's classes at this studio, each family with their table ----------
let _fdHere = { open: false, list: null, q: '', all: false };
async function fdHereOpen() {
  _fdHere = { open: true, list: null, q: '', all: false }; fdRender();
  const { data, error } = await sb.rpc('hub_fd_here_now', { p_studio: _fd.studio });
  _fdHere.list = error ? { err: /hub_fd_here_now/.test(error.message) ? 'Run fd_here_now.sql in Supabase first.' : error.message } : (data || []); fdRender();
}
function fdHereHtml() {
  const H = _fdHere, L = H.list, q = H.q.trim().toLowerCase().replace(/^t(?=\d)/, '');
  const match = f => !q || (/^\d+$/.test(q) ? String(f.tables || '').split(/\D+/).includes(q) : (String(f.name || '') + ' ' + String(f.email || '')).toLowerCase().includes(q));
  const ses = Array.isArray(L) ? L.filter(s => H.all || s.now || q) : [];
  const body = !L ? fdLoading : L.err ? `<p class="fd-msg">${esc(L.err)}</p>` : !L.length ? '<p class="fd-sm">Nobody’s booked here today.</p>'
    : (ses.map(s => { const fam = (s.families || []).filter(match); if (!fam.length) return '';
        return `<div class="fd-here-s"><div class="fd-here-t"><b>${esc(asFmt12(s.time))}</b> ${esc(s.title)}${s.now ? ' <span class="fd-st ok">on now</span>' : ''}</div><div class="fd-here-g">` +
          fam.map(f => `<button class="fd-here-f" onclick="fdHerePick('${f.booking_id}','${s.session_id}')"><span class="fd-here-tab">${f.tables ? esc(f.tables) : '—'}</span><span><b>${esc(f.name || 'Family')}</b><span class="fd-sm">${f.qty > 1 ? f.qty + ' people' : '1 person'}</span></span></button>`).join('') + '</div></div>'; }).join('')
      || `<p class="fd-sm">${q ? 'Nobody matches.' : 'Nothing on right now.'}</p>`)
      + (!H.all && L.some(s => !s.now) && !q ? `<button class="fd-link" onclick="_fdHere.all=true;fdRender()">Show all of today (${L.length} times)</button>` : '');
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_fdHere.open=false;fdRender()}"><div class="fd-sheet" style="max-width:760px"><h3>🪑 Who’s it for?</h3>
    <div class="fd-inline"><input id="fd-hereq" placeholder="Table number or name" value="${escAttr(H.q)}" oninput="_fdHere.q=this.value;fdRender()"></div>
    <p class="fd-sm">Tables are from 🪑 Assign Tables (the floor plan). Tap a family: their account is used for member prices and their receipt.</p>${body}
    <div class="fd-sheet-btns"><button class="ho-btn" onclick="_fdHere.open=false;fdRender()">Close</button></div></div></div>`;
}
async function fdHerePick(bid, sid) {
  const s = (_fdHere.list || []).find(x => x.session_id === sid), f = s && (s.families || []).find(x => x.booking_id === bid); if (!f) return;
  _fdHere.open = false;
  if (Number(f.customer_id) > 0) { await fdPick(Number(f.customer_id)); if (_fd.fam) { _fd.fam.table = f.tables || ''; fdRender(); return; } }
  if (!f.email) { _fd.msg = 'No email on that booking: find the family by name instead.'; fdRender(); return; }
  const nm = String(f.name || 'Family').trim().split(/\s+/);
  _fd.fam = { customer_id: null, email: f.email, first_name: nm[0] || 'Family', last_name: nm.slice(1).join(' '), table: f.tables || '' }; _fd.people = []; _fd.msg = ''; fdRender();
}
// ---------- ↩ Returns & exchanges (camp-checkout staff_return): shop items bought here, credit only or swapped ----------
let _fdRet = { open: false, q: '', list: null, ord: null, qty: {}, shelf: true, exch: [], note: '', busy: false, done: null };
async function fdRetOpen() { _fdRet = { open: true, q: '', list: null, ord: null, qty: {}, shelf: true, exch: [], note: '', busy: false, done: null }; fdRender(); fdRetFind();
  if (!_fd.shop) { _fd.tab = _fd.tab; try { const { data } = await sb.rpc('hub_fd_retail', { p_studio: _fd.studio }); if (data && !_fd.shop) _fd.shop = data; } catch (e) { } } }
async function fdRetFind() {
  const { data, error } = await sb.rpc('hub_pos_find_paid', { p_studio: _fd.studio, p_q: _fdRet.q || '' });
  _fdRet.list = error ? { err: /hub_pos_find_paid/.test(error.message) ? 'Run fd_waiting_returns.sql in Supabase first.' : error.message } : (data || []); fdRender();
}
function fdRetHtml() {
  const R = _fdRet, close = `<button class="ho-btn" onclick="_fdRet.open=false;fdRender()">Close</button>`;
  let h = `<div class="fd-sheet-back" onclick="if(event.target===this){_fdRet.open=false;fdRender()}"><div class="fd-sheet" style="max-width:760px"><h3>↩ Returns & exchanges</h3>`;
  if (R.done) {
    const d = R.done;
    h += `<div class="fd-paid">✓ Done</div><p>${esc(d.returned_names.join(', '))} ${d.exchange_names.length ? 'swapped for <b>' + esc(d.exchange_names.join(', ')) + '</b>' : 'returned'}.</p>
      ${d.code ? `<div class="fd-ret-code"><span class="fd-sm">Their credit: ${fdMoney(d.credit)}</span><b>${esc(d.code)}</b><span class="fd-sm">${d.emailed ? 'Emailed to them too.' : 'Write it down for them (no email on file).'} Good on 4Cats World for a year.</span></div>` : ''}
      ${d.to_pay ? `<p class="fd-warn">They owe ${fdMoney(d.to_pay)} + tax for the difference: it’s in the cart now. Choose how they’ll pay.</p>` : ''}
      <div class="fd-sheet-btns">${close}</div></div></div>`;
    return h;
  }
  if (!R.ord) {
    h += `<p class="fd-sm">Kits bought at this studio in the last 90 days. Returns are for credit only (a World credit code for what they paid, before tax), or swap for another product.</p>
      <div class="fd-inline"><input id="fd-retq" placeholder="Order number, name or email" value="${escAttr(R.q)}" oninput="_fdRet.q=this.value" onkeydown="if(event.key==='Enter')fdRetFind()"><button class="ho-btn" onclick="fdRetFind()">Find</button></div>
      ${!R.list ? fdLoading : R.list.err ? `<p class="fd-msg">${esc(R.list.err)}</p>` : !R.list.length ? '<p class="fd-sm">No paid shop orders found.</p>' :
        R.list.map(o => `<button class="fd-rec fd-ret-pick" onclick="fdRetPick('${o.id}')"><span><b>${esc(o.order || '')}</b> ${esc(o.name || '')} <span class="fd-sm">${esc((o.lines || []).filter(l => l.kind === 'retail').map(l => l.program + (l.qty > 1 ? ' × ' + l.qty : '')).join(', '))}</span><br>
          <span class="fd-sm">${esc(new Date(o.at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }))} · ${fdMoney(o.total)}</span></span><span>›</span></button>`).join('')}
      <div class="fd-sheet-btns">${close}</div></div></div>`;
    return h;
  }
  const o = R.ord, L = (o.lines || []).map((l, i) => ({ l, i })).filter(z => z.l.kind === 'retail');
  let credit = 0;
  const rows = L.map(({ l, i }) => { const left = (+l.qty || 0) - (+(o.returned || {})[String(i)] || 0), q = Math.min(R.qty[i] || 0, left), unit = (+l.amount || 0) / Math.max(1, +l.qty || 1); credit += unit * q;
    return `<div class="fd-item"><div><b>${esc(l.program)}</b><span class="fd-sm">${fdMoney(unit)} each (paid, before tax) · bought ${l.qty}${left < +l.qty ? ` · ${+l.qty - left} already returned` : ''}</span></div>
      ${left > 0 ? `<span class="fd-qty"><button onclick="fdRetQty(${i},-1,${left})">−</button><b>${q}</b><button onclick="fdRetQty(${i},1,${left})">+</button></span>` : '<span class="fd-sm">all returned</span>'}</div>`; }).join('');
  const P = ((_fd.shop || {}).products || []).filter(p => p.category !== 'snack');
  let exVal = 0;
  const exRows = R.exch.map((x, k) => { const p = P.find(pp => (pp.variants || []).some(v => v.id === x.variant_id)), v = p && p.variants.find(vv => vv.id === x.variant_id), pr = p ? fdShopPrice(p, v) : null;
    const val = pr ? (+pr.now || +pr.price || 0) * x.qty : 0; exVal += val;
    return `<div class="fd-item"><div><b>${esc(p ? p.name + (v && v.name !== 'Default' ? ' · ' + v.name : '') : 'Item')}</b><span class="fd-sm">${pr ? fdMoney(val) : ''}</span></div><span class="fd-qty"><button onclick="_fdRet.exch[${k}].qty=Math.max(1,_fdRet.exch[${k}].qty-1);fdRender()">−</button><b>${x.qty}</b><button onclick="_fdRet.exch[${k}].qty++;fdRender()">+</button></span><button class="fd-x" onclick="_fdRet.exch.splice(${k},1);fdRender()">×</button></div>`; }).join('');
  const diff = Math.round((credit - exVal) * 100) / 100;
  h += `<p><b>${esc(o.order || '')}</b> · ${esc(o.name || '')} <button class="fd-link" onclick="_fdRet.ord=null;_fdRet.qty={};_fdRet.exch=[];fdRender()">choose another order</button></p>
    <h4 class="fd-wait-h">What they’re bringing back</h4>${rows}
    <label class="ba-check"><input type="checkbox" ${R.shelf ? 'checked' : ''} onchange="_fdRet.shelf=this.checked"> Back on the shelf (untick if it’s damaged and can’t be sold)</label>
    <h4 class="fd-wait-h">Swap for (optional)</h4>${exRows || '<p class="fd-sm">Nothing: credit only.</p>'}
    <select onchange="if(this.value){_fdRet.exch.push({variant_id:this.value,qty:1});fdRender()}"><option value="">+ Add a product to swap for…</option>${P.flatMap(p => (p.variants || []).map(v => `<option value="${v.id}">${esc(p.name + (v.name && v.name !== 'Default' ? ' · ' + v.name : ''))} (${fdMoney((fdShopPrice(p, v) || {}).now || (fdShopPrice(p, v) || {}).price)})</option>`)).join('')}</select>
    <div class="fd-ret-sum">${credit > 0 ? `<div><span>Back to them</span><b>${fdMoney(credit)}</b></div>` : ''}${exVal > 0 ? `<div><span>New items</span><b>${fdMoney(exVal)}</b></div>` : ''}
      ${credit > 0 ? `<div class="tot"><span>${diff > 0.004 ? 'Credit code for' : diff < -0.004 ? 'They pay (plus tax)' : 'Even swap'}</span><b>${Math.abs(diff) > 0.004 ? fdMoney(Math.abs(diff)) : '✓'}</b></div>` : ''}</div>
    <label class="f">Note (optional)<input value="${escAttr(R.note)}" oninput="_fdRet.note=this.value" placeholder="e.g. wrong kit, a gift they already had"></label>
    <div class="fd-sheet-btns">${close}<button class="ho-btn primary" ${credit > 0 && !R.busy ? '' : 'disabled'} onclick="fdRetGo()">${R.busy ? 'Working…' : R.exch.length ? 'Do the exchange' : 'Give credit'}</button></div></div></div>`;
  return h;
}
function fdRetPick(id) { const o = (_fdRet.list || []).find(x => x.id === id); if (!o) return; _fdRet.ord = o; _fdRet.qty = {};
  const L = (o.lines || []).map((l, i) => ({ l, i })).filter(z => z.l.kind === 'retail'); if (L.length === 1) _fdRet.qty[L[0].i] = 1; fdRender(); }
function fdRetQty(i, d, max) { _fdRet.qty[i] = Math.max(0, Math.min(max, (_fdRet.qty[i] || 0) + d)); fdRender(); }
async function fdRetGo() {
  const R = _fdRet, o = R.ord, items = Object.entries(R.qty).filter(([, q]) => q > 0).map(([line, qty]) => ({ line: +line, qty }));
  if (!items.length) { alert('Choose what they’re bringing back.'); return; }
  if (!confirm(R.exch.length ? 'Do this exchange?' : 'Give them a credit code for these?')) return;
  R.busy = true; fdRender();
  try {
    const d = await fdCall({ action: 'staff_return', studio: _fd.studio, order_id: o.id, items, exchange: R.exch, to_shelf: R.shelf, note: R.note });
    R.done = d;
    if (d.to_pay > 0) {   // the difference: a charge in the cart, with the same family (or walk-in)
      _fd.cart.push({ type: 'charge', name: `Exchange difference: ${d.returned_names.join(', ')} → ${d.exchange_names.join(', ')}`.slice(0, 118), amount: d.to_pay, ref: 'exch:' + (o.order || o.id), tax_class: 'goods',
        title: 'Exchange difference', desc: d.exchange_names.join(', ') });
      if (!_fd.fam) _fd.fam = d.family.walk_in ? { walk_in: true, first_name: 'Walk-in', last_name: '', email: '' } : { customer_id: d.family.customer_id, email: d.family.email, first_name: String(d.family.name || 'Family').split(' ')[0], last_name: String(d.family.name || '').split(' ').slice(1).join(' ') };
    }
    fdStockLoad();
  } catch (e) { alert(e.message); }
  R.busy = false; fdRender();
}
async function fdRecentOpen() {
  _fd.showRecent = true; _fd.recent = null; fdRender();
  const { data, error } = await sb.rpc('hub_pos_recent', { p_studio: _fd.studio });
  _fd.recent = error ? { err: /hub_pos_recent/.test(error.message) ? 'Run hub_pos.sql to see recent orders.' : error.message } : (data || []); fdRender();
}
function fdRecentHtml() {
  const R = _fd.recent, ST = { paid: ['✓ Paid', 'ok'], pending: ['Waiting to pay', 'wait'], expired: ['Not paid', 'off'], failed: ['Not paid', 'off'] };
  let h = '<div class="fd-sheet-back" onclick="if(event.target===this){_fd.showRecent=false;fdRender()}"><div class="fd-sheet" role="dialog" aria-modal="true"><h3>Recent orders · last 7 days</h3>';
  h += !R ? fdLoading : R.err ? '<p class="fd-sm">' + esc(R.err) + '</p>' : !R.length ? '<p class="fd-sm">Nothing yet.</p>' : R.map(o => `<div class="fd-rec"><span><b>${esc(o.order || '')}</b> ${esc(o.name || '')} <span class="fd-sm">${esc(o.what || '')}</span><br><span class="fd-sm">${fdMoney(o.total)} · ${o.mode === 'qr' ? 'QR' : o.mode === 'email' ? 'emailed link' : 'link'} · ${esc(new Date(o.at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${esc(o.by || '')}</span></span>
    <span class="fd-st ${(ST[o.status] || ['', ''])[1]}">${(ST[o.status] || [o.status])[0]}</span>${o.status === 'pending' ? `<button class="ho-btn" onclick="fdRecCancel('${o.id}')">Cancel</button>` : ''}${o.status === 'pending' && o.mode === 'email' ? `<button class="ho-btn" onclick="fdResend('${o.id}')">Resend</button>` : ''}</div>`).join('');
  return h + '<div class="fd-sheet-btns"><button class="ho-btn" onclick="_fd.showRecent=false;fdRender()">Close</button></div></div></div>';
}
async function fdRecCancel(id) { if (!confirm('Cancel this order? The held spots go back.')) return; try { await fdCall({ action: 'staff_cancel', order_id: id }); fdAckCancelled(id); } catch (e) { alert(e.message); } fdRecentOpen(); }

// ---------- 🚶 Walk-ins (hub_walkins.sql) ----------
// Paid here in person (QR code or card at the desk): this order's bookings at this studio for today are walk-ins. Its bookings
// appear a moment after payment, so it asks again after a few seconds and half a minute (never counted twice).
function fdWalkMark(order) {
  if (!order || !_fd) return;
  const st = _fd.studio, pin = fdPin(), walk = _fd.cart.filter(l => l.walk).map(l => l.walk);   // (walk-ins in this sale: their project and price)
  [0, 8000, 30000].forEach(ms => setTimeout(() => { sb.rpc('hub_walkin_mark_order', { p_order: order, p_studio: st, p_pin: pin, p_walk: walk }).then(() => {}, () => {}); }, ms));
}
// A walk-in for something not on the schedule: what, project, how many, when, the customer; paid on Shopify POS for now
const FD_WALK_TIERS = [['t39', '$39 workshop'], ['t30', '$20 workshop'], ['tier1', 'Wheel workshop'], ['mini_make', 'Mini Make']];
const _fdWalk = { open: false };
function fdWalkNowHM() { const d = new Date(); d.setMinutes(Math.floor(d.getMinutes() / 15) * 15); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
async function fdWalkOpen() {
  const fam = _fd && _fd.fam && !_fd.fam.walk_in ? _fd.fam : null;
  Object.assign(_fdWalk, { open: true, kind: '', tier: '', people: 1, day: fdToday(), at: fdWalkNowHM(), project: null, projQ: '', projL: [], projNone: false,
    name: fam ? ((fam.first_name || '') + ' ' + (fam.last_name || '')).trim() : '', email: fam ? fam.email || '' : '', phone: '', cid: fam ? fam.customer_id || null : null,
    famQ: '', famL: null, pos: false, busy: false, msg: '', done: null });
  fdRender();
  try {   // the price tiers as set in World settings (falls back to the usual four)
    const { data } = await sb.from('world_site_settings').select('value').eq('key', 'price_tiers').maybeSingle();
    const T = data && data.value ? (JSON.parse(data.value).tiers || []) : [];
    if (T.length) { _fdWalk.tiers = T.map(t => [t.key, /workshop|make/i.test(t.name) ? t.name : t.name.replace(/\s*tier$/i, '') + ' workshop']); if (_fdWalk.open) fdRender(); }
  } catch (e) { }
}
function fdWalkClose() { _fdWalk.open = false; fdRender(); }
function fdWalkHtml() {
  const W = _fdWalk, tiers = W.tiers || FD_WALK_TIERS;
  if (W.done) return `<div class="fd-sheet-back" onclick="if(event.target===this)fdWalkClose()"><div class="fd-sheet" role="dialog" aria-modal="true" style="max-width:520px">
    <h3>🚶 Walk-in recorded</h3><div class="fd-paid">✓ ${esc(W.done.what)} · ${W.done.people} ${W.done.people === 1 ? 'person' : 'people'} · ${esc(W.done.name)}</div>
    <p class="fd-sm">They’re on today’s list under “🚶 Walk-ins” and counted for planning.</p>
    <div class="fd-sheet-btns"><button class="ho-btn" onclick="fdWalkUndo()">↩ Undo</button><button class="ho-btn" onclick="fdWalkOpen()">+ Another walk-in</button><button class="fd-pay" onclick="fdWalkClose()">Done</button></div></div></div>`;
  const tierName = k => ((tiers.find(t => t[0] === k) || [])[1]) || k;
  const chip = (on, label, js) => `<button type="button" class="fd-chip${on ? ' on' : ''}" onclick="${js}">${esc(label)}</button>`;
  const projBox = W.project ? `<div class="fd-walk-pick">🧩 <b>${esc(W.project.name)}</b> <button class="fd-link" onclick="_fdWalk.project=null;_fdWalk.tier='';_fdWalk.tierPick=false;fdRender()">change</button></div>`
    : W.projNone ? `<div class="fd-walk-pick">${W.kind === 'glazing' ? 'Their own piece / pottery painting' : 'Not sure'} <button class="fd-link" onclick="_fdWalk.projNone=false;fdRender()">change</button></div>`
    : `<input id="fd-walk-proj" class="fd-in" placeholder="Search projects (e.g. mug, gnome)…" value="${escAttr(W.projQ)}" oninput="fdWalkProj(this.value)" autocomplete="off">
       <div class="fd-walk-list">${(W.projL || []).map((p, i) => `<button class="fd-rec" onclick="fdWalkPickProj(${i})">${esc(p.name)}${W.kind === 'workshop' && p.tier ? ` <span class="fd-sm">· ${esc(tierName(p.tier))}</span>` : ''}</button>`).join('')}
       <button class="fd-link" onclick="_fdWalk.projNone=true;fdRender()">${W.kind === 'glazing' ? 'Their own piece / pottery painting' : 'Not sure'}</button></div>`;
  const fdFam = _fd.fam && !_fd.fam.walk_in ? _fd.fam : null;
  const famBox = fdFam && !W.posMode ? `<div class="fd-walk-pick">👪 <b>${esc(((fdFam.first_name || '') + ' ' + (fdFam.last_name || '')).trim())}</b> ${esc(fdFam.email || '')} <span class="fd-sm">(the family at the front desk)</span></div>`
    : W.cid ? `<div class="fd-walk-pick">👪 <b>${esc(W.name)}</b> ${esc(W.email)} <button class="fd-link" onclick="_fdWalk.cid=null;_fdWalk.name='';_fdWalk.email='';fdRender()">change</button></div>`
    : `<input id="fd-walk-fam" class="fd-in" placeholder="Find them: name or email…" value="${escAttr(W.famQ)}" onkeydown="if(event.key==='Enter')fdWalkFind(this.value)" autocomplete="off"> <button class="ho-btn" onclick="fdWalkFind(document.getElementById('fd-walk-fam').value)">Find</button>
       ${W.famL ? `<div class="fd-walk-list">${W.famL.length ? W.famL.map((f, i) => `<button class="fd-rec" onclick="fdWalkFam(${i})"><b>${esc(f.parent_name || '')}</b> <span class="fd-sm">${esc(f.email || '')}${f.kids ? ' · ' + esc(f.kids) : ''}</span></button>`).join('') : '<span class="fd-sm">No one found: add them below.</span>'}</div>` : ''}
       <div class="fd-walk-grid"><label>Name<input id="fd-walk-name" class="fd-in" value="${escAttr(W.name)}" oninput="_fdWalk.name=this.value" autocomplete="off"></label>
       <label>Email<input id="fd-walk-email" class="fd-in" type="email" value="${escAttr(W.email)}" oninput="_fdWalk.email=this.value" autocomplete="off"></label>
       <label>Phone<input id="fd-walk-phone" class="fd-in" type="tel" value="${escAttr(W.phone)}" oninput="_fdWalk.phone=this.value" autocomplete="off"></label></div>`;
  return `<div class="fd-sheet-back" onclick="if(event.target===this)fdWalkClose()"><div class="fd-sheet fd-walk" role="dialog" aria-modal="true" style="max-width:640px">
    <h3>🚶 Walk-in (not on the schedule)</h3>
    <p class="fd-sm" style="margin:0">For glazing or a workshop that isn’t on today’s schedule. Walking into something that <i>is</i> running? Book them the usual way: it counts as a walk-in.</p>
    <div><div class="fd-walk-lbl">What did they come in for?</div><div class="fd-chips">${chip(W.kind === 'glazing', '🎨 Glazing', "_fdWalk.kind='glazing';_fdWalk.tier='';_fdWalk.project=null;_fdWalk.projNone=false;fdRender()")}${chip(W.kind === 'workshop', '🧩 Workshop', "_fdWalk.kind='workshop';_fdWalk.project=null;_fdWalk.projNone=false;_fdWalk.tier='';fdRender()")}</div></div>
    ${W.kind ? `<div><div class="fd-walk-lbl">${W.kind === 'workshop' ? 'Which project?' : 'Project'}</div>${projBox}</div>` : ''}
    ${W.kind === 'workshop' && (W.project || W.projNone) ? (W.tier && !W.tierPick ? `<div class="fd-walk-price">Price: <b>${esc(tierName(W.tier))}</b>${W.project && W.project.tier === W.tier ? ' <span class="fd-sm">(from World)</span>' : ''} <button class="fd-link" onclick="_fdWalk.tierPick=true;fdRender()">change</button></div>`
      : `<div><div class="fd-walk-lbl">${W.project && !W.project.tier ? 'This project has no World price: choose the price' : 'Price'}</div><div class="fd-chips">${tiers.map(t => chip(W.tier === t[0], t[1], `_fdWalk.tier='${escAttr(t[0])}';_fdWalk.tierPick=false;fdRender()`)).join('')}</div></div>`) : ''}
    <div class="fd-walk-row"><div><div class="fd-walk-lbl">How many people?</div><div class="fd-qty"><button class="ho-btn" onclick="_fdWalk.people=Math.max(1,_fdWalk.people-1);fdRender()">−</button><b>${W.people}</b><button class="ho-btn" onclick="_fdWalk.people=Math.min(100,_fdWalk.people+1);fdRender()">+</button></div></div>
      ${W.posMode ? `<label class="fd-walk-lbl">Day<input type="date" class="fd-in" value="${escAttr(W.day)}" max="${fdToday()}" onchange="_fdWalk.day=this.value"></label>` : ''}
      <label class="fd-walk-lbl">Time<input type="time" class="fd-in" step="900" value="${escAttr(W.at)}" onchange="_fdWalk.at=this.value"></label></div>
    <div><div class="fd-walk-lbl">Customer</div>${famBox}</div>
    ${W.posMode ? `<label class="fd-walk-pos"><input type="checkbox" ${W.pos ? 'checked' : ''} onchange="_fdWalk.pos=this.checked;fdRender()"> They already paid on Shopify POS</label>` : ''}
    ${W.msg ? `<p class="fd-warn">${esc(W.msg)}</p>` : ''}
    <div class="fd-sheet-btns">${W.posMode ? `<button class="fd-link" onclick="_fdWalk.posMode=false;_fdWalk.msg='';fdRender()">← Pay here instead</button>` : `<button class="fd-link" title="Until Shopify POS is retired: record it without charging" onclick="_fdWalk.posMode=true;_fdWalk.msg='';fdRender()">Already paid on Shopify POS?</button>`}<span style="flex:1"></span>
      <button class="ho-btn" onclick="fdWalkClose()">Cancel</button>${W.posMode ? `<button class="fd-pay" ${W.busy ? 'disabled' : ''} onclick="fdWalkSave()">${W.busy ? 'Saving…' : 'Record walk-in'}</button>`
        : `<button class="fd-pay" ${W.busy ? 'disabled' : ''} onclick="fdWalkCart()">${W.busy ? 'Setting it up…' : '🛒 Add to cart'}</button>`}</div></div></div>`;
}
let _fdWalkT = null;
function fdWalkPickProj(i) {   // (the price follows the project's World workshop)
  const p = (_fdWalk.projL || [])[i]; if (!p) return;
  _fdWalk.project = { id: p.id, name: p.name, tier: p.tier || null };
  if (_fdWalk.kind === 'workshop') { _fdWalk.tier = p.tier || ''; _fdWalk.tierPick = !p.tier; }
  fdRender();
}
function fdWalkProj(q) {
  _fdWalk.projQ = q; clearTimeout(_fdWalkT);
  _fdWalkT = setTimeout(async () => { if (String(q).trim().length < 2) { _fdWalk.projL = []; fdRender(); return; }
    const { data } = await sb.rpc('hub_walkin_projects', { p_q: q }); if (_fdWalk.projQ === q) { _fdWalk.projL = data || []; fdRender(); } }, 250);
}
async function fdWalkFind(q) {
  _fdWalk.famQ = q || ''; if (String(q || '').trim().length < 2) return;
  const { data, error } = await sb.rpc('hub_family_search', { p_q: q, p_pin: fdPin() });
  _fdWalk.famL = error ? [] : (data || []); fdRender();
}
function fdWalkFam(i) {
  const f = (_fdWalk.famL || [])[i]; if (!f) return;
  Object.assign(_fdWalk, { cid: f.shopify_customer_id || null, name: f.parent_name || '', email: f.email || '', famL: null }); fdRender();
}
async function fdWalkSave() {
  const W = _fdWalk;
  const msg = !W.kind ? 'Choose what they came in for.' : !W.project && !W.projNone ? 'Choose the project (or “' + (W.kind === 'glazing' ? 'their own piece' : 'not sure') + '”).'
    : W.kind === 'workshop' && !W.tier ? 'Choose the price.'
    : !String(W.name).trim() ? 'Add the customer’s name.' : !String(W.email).trim() && !String(W.phone).trim() ? 'Add their email or phone.'
    : !W.pos ? 'Tick “They already paid on Shopify POS”.' : '';
  if (msg) { W.msg = msg; fdRender(); return; }
  W.busy = true; W.msg = ''; fdRender();
  const p = { studio_id: _fd.studio, kind: W.kind, tier: W.tier || null, people: W.people, day: W.day, at: W.at, paid_on: 'pos',
    project_id: W.project ? W.project.id : null, project_name: W.project ? null : (W.kind === 'glazing' ? 'Own piece' : null),
    customer_name: String(W.name).trim(), customer_email: String(W.email).trim(), customer_phone: String(W.phone).trim(), shopify_customer_id: W.cid || null };
  const { data, error } = await sb.rpc('hub_walkin_add', { p, p_pin: fdPin() });
  W.busy = false;
  if (error) { W.msg = /hub_walkin_add/.test(error.message) ? 'Walk-ins aren’t set up yet (home office: run the walk-ins SQL).' : error.message; fdRender(); return; }
  W.done = { id: data.id, what: data.what, people: data.people, name: p.customer_name }; fdRender();
  if (_fd.tab === 'today') fdLoadTab();
}
// 🛒 Add to cart: the hidden walk-in time, then a World workshop line (camp-checkout prices it; the receipt shows the project)
async function fdWalkCart() {
  const W = _fdWalk, F = _fd, fam = F.fam && !F.fam.walk_in ? F.fam : null;
  const email = String(W.email || '').trim().toLowerCase(), name = String(W.name || '').trim();
  const msg = !W.kind ? 'Choose what they came in for.' : !W.project && !W.projNone ? 'Choose the project (or “' + (W.kind === 'glazing' ? 'their own piece' : 'not sure') + '”).'
    : W.kind === 'workshop' && !W.tier ? 'Choose the price.'
    : !fam && !name ? 'Add the customer’s name.' : !fam && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Add their email (their receipt goes there).' : '';
  if (msg) { W.msg = msg; fdRender(); return; }
  W.busy = true; W.msg = ''; fdRender();
  const { data, error } = await sb.rpc('hub_walkin_prepare', { p: { studio_id: F.studio, kind: W.kind, tier: W.tier || null, people: W.people, at: W.at, project_id: W.project ? W.project.id : null }, p_pin: fdPin() });
  W.busy = false;
  if (error) { W.msg = /hub_walkin_prepare/.test(error.message) ? 'Paying for walk-ins isn’t set up yet (home office: run the walk-ins SQL).' : error.message; fdRender(); return; }
  if (!fam) {   // the customer becomes the family at the front desk (found: their card, with member pricing; new: name and email)
    if (W.cid) await fdPick(W.cid); else { const nm = name.split(/\s+/); F.fam = { customer_id: null, email, first_name: nm[0], last_name: nm.slice(1).join(' ') }; F.people = []; }
    if (!F.fam) { W.msg = F.msg || 'Couldn’t open that family.'; fdRender(); return; }
  }
  const tiers = W.tiers || FD_WALK_TIERS, tierLabel = ((tiers.find(t => t[0] === W.tier) || [])[1]) || '';
  const what = W.kind === 'glazing' ? 'Glazing' : (W.project ? W.project.name : tierLabel || 'Workshop');
  F.cart.push({ type: 'world', session_id: data.session_id, title: `🚶 Walk-in: ${what}`, people: [], guests: [{ label: 'Walk-in', n: W.people }], extras: { hot: 0, candy: 0 },
    walk_name: what, walk: { session_id: data.session_id, kind: W.kind, tier: W.kind === 'workshop' ? W.tier : null, what: W.kind === 'glazing' ? 'Glazing' : tierLabel || 'Workshop',
      project_id: W.project ? W.project.id : null, project_name: W.project ? W.project.name : (W.kind === 'glazing' ? 'Own piece' : null) },
    desc: `${W.people} ${W.people === 1 ? 'person' : 'people'} · walk-in${W.kind === 'workshop' && tierLabel ? ' · ' + tierLabel : ''}` });
  W.open = false; F.msg = '🚶 Walk-in added: choose how they’ll pay.'; fdRender();
}
async function fdWalkUndo() {
  const W = _fdWalk; if (!W.done || !confirm('Undo this walk-in?')) return;
  const { error } = await sb.rpc('hub_walkin_remove', { p_id: W.done.id, p_pin: fdPin() });
  if (error) { alert(error.message); return; }
  W.open = false; fdRender(); if (_fd.tab === 'today') fdLoadTab();
}

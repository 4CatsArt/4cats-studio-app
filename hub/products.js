// hub/products.js: Home office → 🛍️ Products: the list, editor, 👁 preview, 📦 stock, 🧩 kit parts, 🔢 counts, 🗂️ collections,
// ☑ bulk changes, 📷 pictures (rpUploadFiles, also used by Studio notes) and 📄 info panels.
// Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.

// ---------- Home office → 🛍️ Products (retail_products.sql) ----------
// The one product list for things 4Cats sells: art kits first. Words and pictures, where it's sold (World's shop
// and/or the front desk), prices and tax, and variants with their SKU (the same SKU as the inventory item: that's
// how sales and stock connect), weight and size (for ShipStation).
const RP_CATS = [['art_kit', 'Art kit'], ['snack', 'Snack or drink'], ['merch', 'Merch'], ['supplies', 'Supplies'], ['gift', 'Gift'], ['other', 'Other']];
const RP_TAX = [['goods', 'Goods (GST + PST in BC, GST in AB, HST in ON)'], ['services', 'Services'], ['none', 'No tax']];
let _rp = { rows: null, err: '', q: '', cat: '', where: '', show: 'active', edit: null, msg: '', ship: null, shipOpen: false, view: 'list', bulk: null, panels: null, panel: null,
  sel: new Set(), ba: '', bv: '', bends: '', bst: new Set(), bevery: true };
async function openRpPane() { // (async: also loads the shipping setting)
  // Who can open it: “Retail & products” on access.html (View to look, Edit to change). The server decides (perm_can).
  showOnlyPane('rp-pane'); setActiveNav('nav-rp'); _rp.edit = null; _rp.view = 'list'; rpDraw(); rpLoad(); rpPanelsLoad(); rpColsLoad();
  const sh = await sb.rpc('hub_retail_shipping_get'); _rp.ship = sh.error ? { err: /hub_retail_shipping/.test(sh.error.message) ? 'Run retail_shipping.sql in Supabase first.' : sh.error.message } : (sh.data || {}); rpDraw();
}
// 🚚 Shipping (World settings 'retail_shipping'): free over an amount of shop items, else a flat rate
function rpShipHtml() {
  const S = _rp.ship;
  const line = !S ? 'Loading…' : S.err ? esc(S.err) : `${S.free_over != null ? `Free over <b>$${Number(S.free_over).toFixed(2)}</b> of shop items` : 'No free shipping'}, otherwise <b>$${Number(S.flat_rate || 0).toFixed(2)}</b>`;
  if (!_rp.shipOpen || !S || S.err) return `<div class="rp-ship">🚚 <span>Shipping: ${line}</span>${S && !S.err ? '<button class="ho-btn sm" onclick="_rp.shipOpen=true;rpDraw()">Edit</button>' : ''}</div>`;
  return `<div class="rp-ship on"><b>🚚 Shipping</b>
    <label>Free shipping when shop items come to<span class="rp-money">$<input id="rp-free" type="number" step="0.01" min="0" value="${escAttr(S.free_over ?? '')}" placeholder="blank: never free"></span></label>
    <label>Otherwise, shipping is<span class="rp-money">$<input id="rp-flat" type="number" step="0.01" min="0" value="${escAttr(S.flat_rate ?? '')}"></span></label>
    <p class="fd-sm">Only shop items (kits, supplies, merch) count toward free shipping, before tax. Workshops, classes, camps, parties and memberships in the same cart never do. Pickup at a studio is always free.</p>
    <div><button class="ho-btn primary sm" onclick="rpShipSave()">Save</button> <button class="ho-btn sm" onclick="_rp.shipOpen=false;rpDraw()">Cancel</button></div></div>`;
}
async function rpShipSave() {
  const { data, error } = await sb.rpc('hub_retail_shipping_set', { p: { free_over: document.getElementById('rp-free').value, flat_rate: document.getElementById('rp-flat').value } });
  if (error) { alert('Not saved: ' + error.message); return; }
  _rp.ship = data; _rp.shipOpen = false; _rp.msg = '✓ Shipping saved.'; rpDraw();
}
async function rpLoad() {
  rpStockLoad();
  const { data, error } = await sb.rpc('hub_retail_list');
  _rp.err = error ? (/hub_retail_list/.test(error.message) ? 'Run retail_products.sql in Supabase first.' : /not allowed/i.test(error.message) ? 'Products needs “Retail & products” on the Access page.' : error.message) : '';
  _rp.rows = error ? [] : (data || []); rpDraw();
}
const rpMoney = n => n == null || n === '' ? '' : '$' + Number(n).toFixed(2);
function rpDraw() {
  const el = document.getElementById('rp-pane'); if (!el) return;
  if (_rp.edit) { el.innerHTML = rpEditHtml(); return; }
  if (_rp.view === 'bulk') { el.innerHTML = rpBulkHtml(); return; }
  if (_rp.view === 'cols') { el.innerHTML = rpColsHtml(); return; }
  if (_rp.view === 'col') { el.innerHTML = rpColHtml(); return; }
  if (_rp.view === 'panels') { el.innerHTML = rpPanelsHtml() + (_rp.msg ? `<p class="fd-ok">${esc(_rp.msg)}</p>` : ''); return; }
  const P = _rp, R = P.rows || [], q = P.q.trim().toLowerCase();
  const rows = R.filter(r => (!q || (r.name + ' ' + (r.variants || []).map(v => v.sku || '').join(' ') + ' ' + (r.tags || []).join(' ')).toLowerCase().includes(q))
    && (!P.cat || r.category === P.cat) && (P.show === 'all' || (P.show === 'active' ? r.active : !r.active))
    && (!P.nopic || !(r.images || []).length) && (!P.col || rpInCol(r, (_rp.cols || []).find(c => c.id === P.col)))
    && (!P.where || (P.where === 'online' ? r.sell_online : P.where === 'studio' ? r.sell_in_studio : P.where === 'both' ? r.sell_online && r.sell_in_studio : !r.sell_online && !r.sell_in_studio)));
  el.innerHTML = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🛍️ Products</div><span class="spacer"></span><button class="ho-btn" onclick="_rp.view='cols';_rp.msg='';rpDraw();rpColsLoad()">🗂️ Collections</button><button class="ho-btn" onclick="rpCntOpen()" title="Send count tasks for kits and snacks to studios (Supplies → Counts)">🔢 Ask studios to count</button><button class="ho-btn" onclick="rpSheetOpen()" title="Type the counts for a whole shelf at once (the warehouse, or a studio)">📋 Count sheet</button><button class="ho-btn" onclick="rpGridOpen()" title="Which Ditto colours (how many packs) go in each kit, all on one grid">🧩 Kit parts</button><button class="ho-btn" onclick="_rp.view='bulk';_rp.msg='';rpDraw()">📷 Bulk pictures</button><button class="ho-btn" onclick="_rp.view='panels';_rp.msg='';rpDraw()">📄 Info panels</button><button class="ho-btn primary" onclick="rpOpen(null)">+ New product</button><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    ${rpShipHtml()}
    <div class="ho-intro">Everything 4Cats sells: art kits first. Each product says where it’s sold (🌐 World’s shop, shipped from the warehouse, and/or 🏪 the front desk). Each variant’s <b>SKU</b> is the same as its inventory item, which is how sales and stock connect.</div>
    <div class="fd-filters"><input id="rp-q" type="search" placeholder="Search name, SKU or tag" value="${escAttr(P.q)}" oninput="_rp.q=this.value;clearTimeout(_rp.t);_rp.t=setTimeout(()=>{rpDraw();const i=document.getElementById('rp-q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)">
      <select onchange="_rp.cat=this.value;rpDraw()"><option value="">All kinds</option>${RP_CATS.map(c => `<option value="${c[0]}"${P.cat === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select>
      <select onchange="_rp.where=this.value;rpDraw()">${[['', 'Sold anywhere'], ['online', '🌐 Online'], ['studio', '🏪 At studios'], ['both', 'Both'], ['none', 'Not sold yet']].map(o => `<option value="${o[0]}"${P.where === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      ${(_rp.cols || []).length ? `<select onchange="_rp.col=this.value;rpDraw()"><option value="">Any collection</option>${_rp.cols.map(c => `<option value="${c.id}"${P.col === c.id ? ' selected' : ''}>🗂️ ${esc(c.name)}</option>`).join('')}</select>` : ''}
      <label class="fd-chk" style="margin:0"><input type="checkbox" ${P.nopic ? 'checked' : ''} onchange="_rp.nopic=this.checked;rpDraw()"> 📷 No pictures yet</label>
      <select onchange="_rp.show=this.value;rpDraw()">${[['active', 'On'], ['off', 'Off'], ['all', 'On and off']].map(o => `<option value="${o[0]}"${P.show === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    ${P.err ? `<p class="fd-msg">${esc(P.err)}</p>` : ''}${P.msg ? `<p class="fd-ok">${esc(P.msg)}</p>` : ''}
    ${P.rows === null ? '<p class="fd-sm">Loading…</p>' : !R.length && !P.err ? '<div class="fd-soon"><div class="fd-soon-ic">🛍️</div><b>No products yet.</b><p class="fd-sm">Add the first one with + New product (or send a Matrixify export of the kits to import them all).</p></div>' :
    (_rp.visible = rows.map(r => r.id), '') + rpBulkBarHtml(rows) +
    `<p class="fd-sm">${rows.length} product${rows.length === 1 ? '' : 's'}</p><div class="fd-tbl-wrap"><table class="fd-tbl rp-tbl"><thead><tr><th class="rp-ck"><input type="checkbox" title="Tick every product shown" ${rows.length && rows.every(r => _rp.sel.has(r.id)) ? 'checked' : ''} onclick="rpSelAll(this.checked)"></th><th>Product</th><th>Kind</th><th>Sold</th><th class="num">Price</th><th class="num">Members</th><th>SKUs</th><th class="num">Weight</th><th>Stock</th></tr></thead><tbody>` +
    rows.map(r => { const V = r.variants || [], ws = V.map(v => v.weight_g).filter(Boolean), missing = V.filter(v => v.sku && !v.in_inventory).length, noSku = V.filter(v => !v.sku).length;
      return `<tr class="${r.active ? '' : 'rp-off'}${_rp.sel.has(r.id) ? ' rp-sel' : ''}" onclick="rpOpen('${r.id}')"><td class="rp-ck" onclick="event.stopPropagation()"><input type="checkbox" ${_rp.sel.has(r.id) ? 'checked' : ''} onchange="rpSel('${r.id}',this.checked)"></td><td class="wsm-name">${r.images && r.images[0] ? `<img src="${escAttr(r.images[0])}" alt="">` : '<span class="wsm-noimg"></span>'}<span><b>${esc(r.name)}</b>${r.active ? '' : ' <span class="fd-pill">off</span>'}${r.blurb ? `<br><span class="fd-sm">${esc(r.blurb.slice(0, 70))}</span>` : ''}</span></td>
        <td>${esc((RP_CATS.find(c => c[0] === r.category) || [, r.category])[1])}</td>
        <td>${r.sell_online ? '<span title="World’s shop">🌐</span> ' : ''}${r.sell_in_studio ? `<span title="Front desk${r.studios && r.studios.length ? ': ' + r.studios.length + ' studios' : ': every studio'}">🏪${r.studios && r.studios.length ? '<small>' + r.studios.length + '</small>' : ''}</span>` : ''}${!r.sell_online && !r.sell_in_studio ? '<span class="fd-sm">not yet</span>' : ''}</td>
        <td class="num">${rpMoney(r.price)}${r.sale_price ? `<br><span class="fd-sm">sale ${rpMoney(r.sale_price)}</span>` : ''}</td><td class="num">${rpMoney(r.member_price)}</td>
        <td>${V.length} ${V.length === 1 ? 'variant' : 'variants'}${noSku ? ` <span class="fd-warn" title="Variants with no SKU">${noSku} no SKU</span>` : ''}${missing ? ` <span class="rp-inv" title="SKUs that aren’t inventory items yet">${missing} not in inventory</span>` : ''}</td>
        <td class="num">${ws.length ? (Math.min(...ws) === Math.max(...ws) ? ws[0] : Math.min(...ws) + '–' + Math.max(...ws)) + ' g' : '<span class="fd-sm">—</span>'}</td><td>${rpStockCell(r.id)}</td></tr>`; }).join('') + '</tbody></table></div>'}`;
}
// ---- The editor ----
function rpOpen(id) {
  const r = id ? (_rp.rows || []).find(x => x.id === id) : null;
  _rp.edit = r ? JSON.parse(JSON.stringify(r)) : { name: '', category: 'art_kit', images: [], whats_inside: [], tags: [], tax_class: 'goods', sell_online: false, sell_in_studio: false, studios: null, pickup: false, active: true,
    variants: [{ name: 'Default', sku: '', active: true }] };
  _rp.edit.allStudios = !(_rp.edit.studios && _rp.edit.studios.length);
  _rp.msg = ''; rpDraw(); window.scrollTo(0, 0);
}
function rpF(k, v) { _rp.edit[k] = v; _rp.edit.dirty = true; }
function rpV(i, k, v) { _rp.edit.variants[i][k] = v; _rp.edit.dirty = true; }
function rpEditHtml() {
  const E = _rp.edit, inp = (k, ph, type) => `<input ${type ? `type="${type}" step="0.01" min="0"` : ''} value="${escAttr(E[k] == null ? '' : E[k])}" placeholder="${escAttr(ph || '')}" oninput="rpF('${k}',this.value)">`;
  const ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b)), st = new Set(E.studios || []);
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🛍️ ${E.id ? esc(E.name || 'Product') : 'New product'}</div><span class="spacer"></span>
      <button class="ho-btn" onclick="rpClose()">← ${_rp.view === 'col' && _rp.colEdit ? esc(_rp.colEdit.name || 'Collection') : 'All products'}</button><button class="ho-btn" onclick="rpPreview()" title="How it will look on World’s shop (with these changes, saved or not)">👁 Preview online</button><button class="ho-btn primary" id="rp-save" onclick="rpSave()">Save</button></div>
    ${_rp.msg ? `<p class="fd-msg">${esc(_rp.msg)}</p>` : ''}
    <div class="rp-grid">
    <section class="rp-card"><h4>Basics</h4>
      <label>Name<input value="${escAttr(E.name)}" placeholder="e.g. Clay Creatures Kit" oninput="rpF('name',this.value)"></label>
      <div class="rp-two"><label>Kind<select onchange="rpF('category',this.value)">${RP_CATS.map(c => `<option value="${c[0]}"${E.category === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select></label>
        <label>Ages<input value="${escAttr(E.ages || '')}" placeholder="e.g. 6+" oninput="rpF('ages',this.value)"></label></div>
      <label>Short description <span class="fd-sm">(one or two lines, for cards)</span><input value="${escAttr(E.blurb || '')}" maxlength="160" oninput="rpF('blurb',this.value)"></label>
      <label>Tags <span class="fd-sm">(commas: clay, holiday, gift)</span><input value="${escAttr((E.tags || []).join(', '))}" oninput="rpF('tags',this.value.split(','))"></label>
      <label class="fd-chk"><input type="checkbox" ${E.active ? 'checked' : ''} onchange="rpF('active',this.checked);rpDraw()"> <b>On</b> <span class="fd-sm">(off hides it everywhere)</span></label></section>
    <section class="rp-card"><h4>Pictures <span class="fd-sm">(the first is the main one)</span></h4>
      <div class="rp-pics">${(E.images || []).map((u, i) => `<figure><img src="${escAttr(u)}" alt=""><figcaption>${i ? `<button onclick="rpPic(${i},-1)" aria-label="Move left">‹</button>` : '<span class="fd-sm">main</span>'}${i < E.images.length - 1 ? `<button onclick="rpPic(${i},1)" aria-label="Move right">›</button>` : ''}<button onclick="rpPic(${i},0)" aria-label="Remove">×</button></figcaption></figure>`).join('')}
        <label class="rp-up">+ Add pictures<input type="file" accept="image/*" multiple onchange="rpUpload(this)" hidden></label></div><p class="fd-sm" id="rp-upmsg"></p></section>
    <section class="rp-card rp-wide"><h4>Description</h4>
      <textarea rows="7" placeholder="What it is, how it works, what you make. A blank line starts a new paragraph; start a line with - for a bullet." oninput="rpF('description',this.value)">${esc(E.description || '')}</textarea>
      <label>What’s inside <span class="fd-sm">(one per line)</span><textarea rows="4" placeholder="1 lb air-dry clay&#10;3 paints&#10;Brush and tools" oninput="rpF('whats_inside',this.value.split('\\n'))">${esc((E.whats_inside || []).join('\n'))}</textarea></label></section>
    <section class="rp-card"><h4>Price and tax</h4>
      <div class="rp-two"><label>Price${inp('price', '0.00', 'number')}</label><label>Member price${inp('member_price', 'optional', 'number')}</label></div>
      <div class="rp-two"><label>Sale price${inp('sale_price', 'optional', 'number')}</label><label>Sale ends<input type="date" value="${escAttr(E.sale_ends || '')}" onchange="rpF('sale_ends',this.value)"></label></div>
      <label>Tax<select onchange="rpF('tax_class',this.value)">${RP_TAX.map(t => `<option value="${t[0]}"${E.tax_class === t[0] ? ' selected' : ''}>${t[1]}</option>`).join('')}</select></label>
      <p class="fd-sm">A variant can have its own price (below); blank uses these.</p></section>
    <section class="rp-card"><h4>Where it’s sold</h4>
      <label class="fd-chk"><input type="checkbox" ${E.sell_online ? 'checked' : ''} onchange="rpF('sell_online',this.checked);rpDraw()"> 🌐 <b>Online</b>: World’s shop, shipped from the warehouse (ShipStation)</label>
      ${E.sell_online ? `<label class="fd-chk rp-sub"><input type="checkbox" ${E.pickup ? 'checked' : ''} onchange="rpF('pickup',this.checked)"> Online buyers can pick it up at a studio instead</label>` : ''}
      <label class="fd-chk"><input type="checkbox" ${E.sell_in_studio ? 'checked' : ''} onchange="rpF('sell_in_studio',this.checked);rpDraw()"> 🏪 <b>At the front desk</b></label>
      ${E.sell_in_studio ? `<div class="rp-sub"><label class="fd-chk"><input type="radio" name="rp-st" ${E.allStudios ? 'checked' : ''} onchange="_rp.edit.allStudios=true;rpF('studios',null);rpDraw()"> Every studio</label>
        <label class="fd-chk"><input type="radio" name="rp-st" ${E.allStudios ? '' : 'checked'} onchange="_rp.edit.allStudios=false;rpDraw()"> Only these studios</label>
        ${E.allStudios ? '' : `<div class="rp-studios">${ids.map(id => `<label><input type="checkbox" ${st.has(id) ? 'checked' : ''} onchange="rpStudio('${id}',this.checked)"> ${esc(STUDIO_NAMES[id] || id)}</label>`).join('')}</div>`}</div>` : ''}</section>
    <section class="rp-card rp-wide"><h4>Variants <span class="fd-sm">(one row is fine; add more for sizes, colours or refills)</span></h4>
      <div class="fd-tbl-wrap"><table class="fd-tbl rp-vt"><thead><tr><th>Name</th><th>SKU</th><th>Barcode</th><th>Price</th><th>Members</th><th>Weight (g)</th><th>Size L × W × H (cm)</th><th>On</th><th></th></tr></thead><tbody>` +
      E.variants.map((v, i) => { const vi = (k, w, type) => `<input style="width:${w}" ${type ? 'type="number" step="0.01" min="0"' : ''} value="${escAttr(v[k] == null ? '' : v[k])}" oninput="rpV(${i},'${k}',this.value)">`;
        return `<tr><td>${vi('name', '100px')}</td><td>${vi('sku', '104px')}${v.sku && v.in_inventory === false ? '<br><span class="rp-inv">not in inventory yet</span>' : v.in_inventory ? '<br><span class="fd-ok" style="font-size:11px">✓ in inventory</span>' : ''}</td><td>${vi('barcode', '104px')}</td><td>${vi('price', '66px', 1)}</td><td>${vi('member_price', '66px', 1)}</td>
          <td>${vi('weight_g', '66px', 1)}</td><td class="rp-dims">${vi('length_cm', '46px', 1)}×${vi('width_cm', '46px', 1)}×${vi('height_cm', '46px', 1)}</td>
          <td><input type="checkbox" ${v.active !== false ? 'checked' : ''} onchange="rpV(${i},'active',this.checked)"></td><td>${E.variants.length > 1 ? `<button class="fd-x" onclick="_rp.edit.variants.splice(${i},1);rpDraw()" aria-label="Remove">×</button>` : ''}</td></tr>`; }).join('') +
      `</tbody></table></div><button class="ho-btn sm" onclick="_rp.edit.variants.push({name:'',sku:'',active:true});rpDraw()">+ Add a variant</button>
      <p class="fd-sm">The SKU should match the item in the inventory system, so stock and sales connect. Weight is the packed weight, for shipping.</p></section>
    ${rpEditPanelsHtml()}
    ${rpStockEditHtml(E)}
    <section class="rp-card rp-wide"><h4>Staff notes</h4><textarea rows="2" oninput="rpF('notes',this.value)">${esc(E.notes || '')}</textarea></section>
    </div>
    <div class="rp-foot">${E.id ? '<button class="ho-btn" onclick="rpDelete()">Delete product</button>' : ''}<span class="spacer"></span><button class="ho-btn" onclick="rpClose()">Cancel</button><button class="ho-btn primary" onclick="rpSave()">Save</button></div>`;
}
// ---- 👁 Preview online: the product as World's shop page will show it (from what's in the editor now, saved or not) ----
// Its look: World's fonts and colours. Add to cart does nothing here.
let _rpPv = null;
function rpPvText(t) {   // the description: "# heading", "- bullet", blank line = new paragraph
  const blocks = String(t || '').replace(/\r/g, '').split(/\n\s*\n/);
  return blocks.map(b => { const L = b.split('\n').filter(x => x.trim());
    if (!L.length) return '';
    if (L.every(x => /^\s*-\s+/.test(x))) return '<ul>' + L.map(x => '<li>' + esc(x.replace(/^\s*-\s+/, '')) + '</li>').join('') + '</ul>';
    return L.map(x => /^#\s+/.test(x) ? '<h3>' + esc(x.replace(/^#\s+/, '')) + '</h3>' : '<p>' + esc(x) + '</p>').join(''); }).join('');
}
function rpPreview(member) {
  const E = _rp.edit; if (!E) return;
  _rpPv = _rpPv && _rpPv.id === (E.id || 'new') ? Object.assign(_rpPv, member !== undefined ? { member } : {}) : { id: E.id || 'new', pic: 0, v: 0, member: !!member, panel: null, phone: false };
  if (!document.getElementById('rp-pv-fonts')) { const l = document.createElement('link'); l.id = 'rp-pv-fonts'; l.rel = 'stylesheet';   // (World's fonts, for the preview)
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,700;9..40,800&family=Work+Sans:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
  let el = document.getElementById('rp-pv'); if (!el) { el = document.createElement('div'); el.id = 'rp-pv'; document.body.appendChild(el); }
  const V = (E.variants || []).filter(v => v.active !== false), v = V[_rpPv.v] || V[0] || {}, imgs = (E.images || []).filter(Boolean);
  const num = x => x === '' || x == null ? null : Number(x);
  const reg = num(v.price) ?? num(E.price), mem = num(v.member_price) ?? num(E.member_price);
  const saleOn = num(E.sale_price) != null && (!E.sale_ends || E.sale_ends >= new Date().toISOString().slice(0, 10)), sale = saleOn ? num(E.sale_price) : null;
  let now = reg, lab = '';
  if (sale != null && reg != null && sale < now) { now = sale; lab = 'Sale'; }
  if (_rpPv.member && mem != null && now != null && mem < now) { now = mem; lab = '⭐ Member price'; }
  const money = n => n == null || isNaN(n) ? '' : '$' + Number(n).toFixed(2);
  const panels = rpPanelsFor(E).filter(z => (z.byTag || z.ticked) && z.x.active);
  const P = _rpPv, shipOK = E.sell_online, pk = E.pickup;
  el.innerHTML = `<div class="rp-pv-back" onclick="if(event.target===this)rpPvClose()"><div class="rp-pv-bar">
      <b>👁 Preview: World’s shop</b><span class="fd-sm">${E.sell_online ? '' : '⚠ Not ticked to sell online yet, so it won’t show on World. '}${E.active ? '' : '⚠ This product is Off. '}</span><span style="flex:1"></span>
      <label class="fd-chk" style="color:#fff"><input type="checkbox" ${P.member ? 'checked' : ''} onchange="rpPreview(this.checked)"> as a member</label>
      <button class="ho-btn sm" onclick="_rpPv.phone=!_rpPv.phone;rpPreview()">${P.phone ? '🖥 Computer' : '📱 Phone'}</button><button class="ho-btn sm" onclick="rpPvClose()">✕ Close</button></div>
    <div class="rp-pv-page${P.phone ? ' phone' : ''}"><div class="rp-pv-crumb">Shop › ${esc((RP_CATS.find(c => c[0] === E.category) || [, 'Kits'])[1])}</div>
      <div class="rp-pv-grid"><div class="rp-pv-gal">${imgs.length ? `<img class="rp-pv-main" src="${escAttr(imgs[Math.min(P.pic, imgs.length - 1)])}" alt="">` : '<div class="rp-pv-main rp-pv-none">No picture yet</div>'}
          ${imgs.length > 1 ? `<div class="rp-pv-thumbs">${imgs.map((u, i) => `<img src="${escAttr(u)}" alt="" class="${i === P.pic ? 'on' : ''}" onclick="_rpPv.pic=${i};rpPreview()">`).join('')}</div>` : ''}</div>
        <div class="rp-pv-info"><h1>${esc(E.name || 'Product name')}</h1>
          ${E.blurb ? `<p class="rp-pv-blurb">${esc(E.blurb)}</p>` : ''}
          <div class="rp-pv-price">${reg == null ? '<span style="color:#c8232c">No price yet</span>' : `${now < reg ? `<s>${money(reg)}</s> ` : ''}<b>${money(now)}</b>${lab ? ` <span class="rp-pv-lab">${esc(lab)}</span>` : ''}`}
            ${!P.member && mem != null && reg != null && mem < (now ?? reg) ? `<div class="rp-pv-mem">⭐ Members ${money(mem)}</div>` : ''}${sale != null && E.sale_ends ? `<div class="rp-pv-ends">Sale ends ${esc(new Date(E.sale_ends + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }))}</div>` : ''}</div>
          ${V.length > 1 ? `<div class="rp-pv-opts">${V.map((x, i) => `<button class="${i === P.v ? 'on' : ''}" onclick="_rpPv.v=${i};rpPreview()">${esc(x.name || 'Option ' + (i + 1))}</button>`).join('')}</div>` : ''}
          ${E.ages ? `<p class="rp-pv-ages">Ages ${esc(E.ages)}</p>` : ''}
          <div class="rp-pv-buy"><span class="rp-pv-qty">− 1 +</span><button class="rp-pv-add" onclick="alert('Preview only.')">Add to cart</button></div>
          <p class="rp-pv-ship">${shipOK ? '🚚 Ships from our warehouse · free shipping on shop orders over $79' : ''}${shipOK && pk ? '<br>' : ''}${pk ? '🏪 Or pick it up at your studio' : ''}</p>
          ${panels.length ? `<div class="rp-pv-panels">${panels.map((z, i) => `<button onclick="_rpPv.panel=${i};rpPreview()">ⓘ ${esc(z.x.label)}</button>`).join('')}</div>` : ''}</div></div>
      ${E.description ? `<div class="rp-pv-desc">${rpPvText(E.description)}</div>` : ''}
      ${(E.whats_inside || []).filter(x => String(x).trim()).length ? `<div class="rp-pv-inside"><h3>What’s in the kit</h3><ul>${E.whats_inside.filter(x => String(x).trim()).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    </div>
    ${P.panel != null && panels[P.panel] ? `<div class="rp-pv-pop" onclick="if(event.target===this){_rpPv.panel=null;rpPreview()}"><div><button class="rp-pv-x" onclick="_rpPv.panel=null;rpPreview()">✕</button><h2>${esc(panels[P.panel].x.label)}</h2>
      ${(panels[P.panel].x.images || [])[0] ? `<img src="${escAttr(panels[P.panel].x.images[0])}" alt="" style="max-width:100%;border-radius:12px">` : ''}${rpPvText(panels[P.panel].x.body || '') || '<p style="color:#888">(No text in this panel yet.)</p>'}</div></div>` : ''}</div>`;
}
function rpPvClose() { const el = document.getElementById('rp-pv'); if (el) el.remove(); _rpPv = null; }
// ---------- 📦 Stock (retail_stock.sql): on hand at the warehouse and each studio; receive, send, make or open kits, correct ----------
let _rpStock = null;   // [{ variant_id, product_id, sku, on_hand: {loc: n}, sold30, sold365, held, parts }]
async function rpStockLoad() {
  const { data, error } = await sb.rpc('hub_retail_stock', { p_studio: null });
  _rpStock = error ? { err: /hub_retail_stock/.test(error.message) ? 'Run retail_stock.sql in Supabase first.' : error.message } : (data || []);
  if (_rp.view === 'list' || _rp.edit) rpDraw();
}
const rpN = x => Math.round(Number(x || 0) * 100) / 100;
function rpStockOf(pid) { return Array.isArray(_rpStock) ? _rpStock.filter(x => x.product_id === pid) : []; }
function rpStockCell(pid) {
  const L = rpStockOf(pid); if (!L.length) return '<span class="fd-sm">—</span>';
  const wh = L.reduce((t, x) => t + rpN((x.on_hand || {}).WAREHOUSE), 0);
  const st = L.reduce((t, x) => t + Object.entries(x.on_hand || {}).filter(([k]) => k !== 'WAREHOUSE').reduce((u, [, v]) => u + rpN(v), 0), 0);
  const s30 = L.reduce((t, x) => t + Object.values(x.sold30 || {}).reduce((u, v) => u + rpN(v), 0), 0);
  return `<span class="rp-stk" title="Warehouse ${wh} · at studios ${st} · sold in the last 30 days ${s30}">🏭 ${wh} · 🏪 ${st}${s30 ? ` <span class="fd-sm">· ${s30} sold/30d</span>` : ''}</span>`;
}
function rpStockEditHtml(E) {
  if (!E.id) return '<section class="rp-card rp-wide"><h4>📦 Stock</h4><p class="fd-sm">Save the product first.</p></section>';
  if (_rpStock && _rpStock.err) return `<section class="rp-card rp-wide"><h4>📦 Stock</h4><p class="fd-msg">${esc(_rpStock.err)}</p></section>`;
  const L = rpStockOf(E.id), isKit = E.category !== 'snack';
  if (!L.length) return '<section class="rp-card rp-wide"><h4>📦 Stock</h4><p class="fd-sm">Loading… (or switch the product On and save: each option gets its stock item when it has a SKU)</p></section>';
  const loc = k => k === 'WAREHOUSE' ? '🏭 Warehouse' : (STUDIO_NAMES[k] || k);
  return `<section class="rp-card rp-wide"><h4>📦 Stock</h4>` + L.map(x => {
    const locs = [...new Set(['WAREHOUSE', ...Object.keys(x.on_hand || {}), ...Object.keys(x.sold365 || {}), ...Object.keys(x.held || {})])]
      .sort((a, b) => a === 'WAREHOUSE' ? -1 : b === 'WAREHOUSE' ? 1 : (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
    return `<div class="rp-stk-v"><div class="rp-stk-h"><b>${esc(x.variant && x.variant !== 'Default' ? x.variant : E.name)}</b> <span class="fd-sm">SKU ${esc(x.sku)}</span><span class="spacer"></span>
        <button class="ho-btn sm" onclick="rpStkAct('receive','${x.variant_id}')">+ Received</button><button class="ho-btn sm" onclick="rpStkSend('${x.variant_id}')">🚚 Send to studios</button>
        ${isKit ? `<button class="ho-btn sm" onclick="rpStkAct('make_kits','${x.variant_id}')">Make kits</button><button class="ho-btn sm" onclick="rpStkAct('open_kits','${x.variant_id}')">Open kits</button>` : ''}
        <button class="ho-btn sm" onclick="rpStkAct('set_count','${x.variant_id}')">Correct a count</button></div>
      <div class="fd-tbl-wrap"><table class="fd-tbl rp-stk-t"><thead><tr><th>Where</th><th class="num">On hand</th>${Object.keys(x.held || {}).length ? '<th class="num">Held</th><th class="num">Available</th>' : ''}<th class="num">Sold 30 days</th><th class="num">Sold this year</th></tr></thead><tbody>` +
        locs.map(k => { const oh = rpN((x.on_hand || {})[k]), hd = rpN((x.held || {})[k]), s30 = rpN((x.sold30 || {})[k]);
          const low = k !== 'WAREHOUSE' && s30 > 0 && oh <= Math.max(2, Math.ceil(s30 / 4));
          return `<tr><td>${esc(loc(k))}</td><td class="num${oh < 0 ? ' fd-warn' : ''}">${oh}${low ? ' <span class="fd-warn" title="Selling faster than what’s left">⚠ low</span>' : ''}</td>${Object.keys(x.held || {}).length ? `<td class="num">${hd || ''}</td><td class="num">${oh - hd}</td>` : ''}<td class="num">${s30 || ''}</td><td class="num">${rpN((x.sold365 || {})[k]) || ''}</td></tr>`; }).join('') +
      `</tbody></table></div>
      ${isKit ? `<p class="fd-sm" style="margin:6px 0 0"><b>Parts</b> (what one is made of, in pieces): ${(x.parts || []).length ? x.parts.map(pp => esc(pp.qty + ' × ' + pp.name)).join(', ') : '<i>none set yet</i>'} <button class="ho-btn sm" onclick="rpStkParts('${x.variant_id}')">Edit parts</button></p>` : ''}</div>`;
  }).join('') + '<p class="fd-sm">Sales count down by themselves: a front desk sale at its studio, an online sale at the warehouse. Studios receive what’s sent in Supplies → Transfers.</p></section>';
}
async function rpStkMove(p) {
  const { error } = await sb.rpc('hub_retail_stock_move', { p });
  if (error) { alert(/hub_retail_stock_move/.test(error.message) ? 'Run retail_stock.sql in Supabase first.' : error.message); return false; }
  await rpStockLoad(); return true;
}
function rpStkLocPick(withWh) {
  const ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const list = (withWh ? ['WAREHOUSE'] : []).concat(ids), lab = list.map((k, i) => `${i + 1}. ${k === 'WAREHOUSE' ? 'Warehouse' : STUDIO_NAMES[k]}`).join('\n');
  const n = prompt('Where?\n\n' + lab + '\n\nType the number:', '1'); if (!n) return null;
  return list[+n - 1] || null;
}
async function rpStkAct(kind, vid) {
  const where = kind === 'receive' ? (confirm('Received at the warehouse?\n\nOK = warehouse · Cancel = choose a studio') ? 'WAREHOUSE' : rpStkLocPick(false)) : rpStkLocPick(true);
  if (!where) return;
  const lab = { receive: 'How many were received?', make_kits: 'How many kits were made up? (their parts come off stock)', open_kits: 'How many kits were opened? (their parts go back into stock)', set_count: 'What is the count there now?' }[kind];
  const q = prompt(lab, ''); if (q === null || q.trim() === '' || isNaN(+q)) return;
  const note = kind === 'set_count' || kind === 'receive' ? (prompt('Note (optional), e.g. supplier or why', '') || '') : '';
  if (await rpStkMove({ kind, loc: where, variant_id: vid, qty: +q, note })) { _rp.msg = '✓ Stock updated.'; rpDraw(); }
}
// 🚚 send from the warehouse: a number for each studio, with a suggestion split by last year's sales
function rpStkSend(vid) {
  const x = (_rpStock || []).find(z => z.variant_id === vid); if (!x) return;
  const wh = rpN((x.on_hand || {}).WAREHOUSE);
  _rpSend = { vid, rows: {}, total: '' };
  const el = document.createElement('div'); el.id = 'rp-send'; document.body.appendChild(el); rpSendDraw();
}
let _rpSend = null;
function rpSendDraw() {
  const S = _rpSend, x = (_rpStock || []).find(z => z.variant_id === S.vid), el = document.getElementById('rp-send'); if (!x || !el) return;
  const ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const tot = Object.values(S.rows).reduce((t, v) => t + (+v || 0), 0);
  el.innerHTML = `<div class="fd-sheet-back" onclick="if(event.target===this){document.getElementById('rp-send').remove()}"><div class="fd-sheet" style="max-width:640px">
    <h3>🚚 Send ${esc(x.product)}${x.variant && x.variant !== 'Default' ? ' · ' + esc(x.variant) : ''}</h3><p class="fd-sm">At the warehouse: <b>${rpN((x.on_hand || {}).WAREHOUSE)}</b>. Each studio receives it in Supplies → Transfers.</p>
    <div class="fd-inline">Split <input type="number" min="1" style="width:90px" value="${escAttr(S.total)}" oninput="_rpSend.total=this.value"> by last year’s sales <button class="ho-btn sm" onclick="rpSendSuggest()">Suggest</button></div>
    <div class="rp-send-grid">${ids.map(id => `<label>${esc(STUDIO_NAMES[id])} <span class="fd-sm">${rpN((x.sold365 || {})[id]) ? rpN(x.sold365[id]) + ' sold' : ''}${rpN((x.on_hand || {})[id]) ? ' · has ' + rpN(x.on_hand[id]) : ''}</span><input type="number" min="0" value="${escAttr(S.rows[id] || '')}" oninput="_rpSend.rows['${id}']=this.value;document.getElementById('rp-send-tot').textContent=Object.values(_rpSend.rows).reduce((t,v)=>t+(+v||0),0)"></label>`).join('')}</div>
    <div class="sheet-actions"><span class="fd-sm" style="margin-right:auto">Sending <b id="rp-send-tot">${tot}</b></span><button onclick="document.getElementById('rp-send').remove()">Cancel</button><button class="primary" onclick="rpSendGo()">Send</button></div></div></div>`;
}
function rpSendSuggest() {   // last year's sales at each studio (else this collection's, else even), rounded, adding up to the total
  const S = _rpSend, x = (_rpStock || []).find(z => z.variant_id === S.vid), n = Math.floor(+S.total || 0); if (!(n > 0)) { alert('Type how many to split.'); return; }
  let w = Object.fromEntries(Object.entries(x.sold365 || {}).filter(([k, v]) => k !== 'WAREHOUSE' && STUDIO_NAMES[k] && +v > 0));
  if (!Object.keys(w).length) { const p = (_rp.rows || []).find(r => r.id === x.product_id), col = (_rp.cols || []).find(c => p && rpInCol(p, c));
    const sib = (_rpStock || []).filter(z => z.variant_id !== x.variant_id && col && (_rp.rows || []).some(r => r.id === z.product_id && rpInCol(r, col)));
    sib.forEach(z => Object.entries(z.sold365 || {}).forEach(([k, v]) => { if (k !== 'WAREHOUSE' && STUDIO_NAMES[k]) w[k] = (w[k] || 0) + (+v || 0); })); }
  if (!Object.keys(w).length) { alert('No sales yet to go by: type the numbers in.'); return; }
  const sum = Object.values(w).reduce((t, v) => t + v, 0), out = {}; let left = n;
  const parts = Object.entries(w).map(([k, v]) => [k, n * v / sum]).sort((a, b) => b[1] - a[1]);
  parts.forEach(([k, v]) => { out[k] = Math.floor(v); left -= out[k]; });
  parts.sort((a, b) => (b[1] % 1) - (a[1] % 1)).forEach(([k]) => { if (left > 0) { out[k]++; left--; } });
  S.rows = Object.fromEntries(Object.entries(out).filter(([, v]) => v > 0)); rpSendDraw();
}
async function rpSendGo() {
  const S = _rpSend, to = Object.entries(S.rows).filter(([, v]) => +v > 0).map(([studio, qty]) => ({ studio, qty: Math.floor(+qty) }));
  if (!to.length) { alert('Type how many for at least one studio.'); return; }
  if (!confirm(`Send ${to.reduce((t, r) => t + r.qty, 0)} to ${to.length} studio${to.length === 1 ? '' : 's'}?`)) return;
  if (await rpStkMove({ kind: 'send', variant_id: S.vid, to })) { document.getElementById('rp-send').remove(); _rp.msg = '✓ Sent. Each studio receives it in Supplies → Transfers.'; rpDraw(); }
}
// a kit's parts
let _rpParts = null, _invPick = null;
async function rpStkParts(vid) {
  const x = (_rpStock || []).find(z => z.variant_id === vid); if (!x) return;
  if (!_invPick) { const { data } = await sb.rpc('hub_inventory_items_pick'); _invPick = data || []; }
  _rpParts = { vid, list: (x.parts || []).map(pp => ({ sku: pp.sku, qty: pp.qty })) };
  const el = document.createElement('div'); el.id = 'rp-parts'; document.body.appendChild(el); rpPartsDraw();
}
function rpPartsDraw() {
  const P = _rpParts, x = (_rpStock || []).find(z => z.variant_id === P.vid), el = document.getElementById('rp-parts'); if (!el) return;
  const opts = cur => `<option value="">Choose…</option>${_invPick.map(i => `<option value="${escAttr(i.sku)}"${i.sku === cur ? ' selected' : ''}>${esc((i.category ? i.category + ' · ' : '') + i.name)}</option>`).join('')}`;
  el.innerHTML = `<div class="fd-sheet-back" onclick="if(event.target===this){document.getElementById('rp-parts').remove()}"><div class="fd-sheet">
    <h3>Parts of one ${esc(x.product)}</h3><p class="fd-sm">What one kit uses, in pieces: e.g. 4 packs of Ditto, or 1 cup + 1 lid for a hot drink. Stock in boxes is worked out (a Ditto box is 24 packs).</p>
    ${P.list.map((r, i) => `<div class="fd-inline"><input type="number" min="0.01" step="0.01" style="width:80px" value="${escAttr(r.qty)}" oninput="_rpParts.list[${i}].qty=this.value"> ×
      <select onchange="_rpParts.list[${i}].sku=this.value">${opts(r.sku)}</select><button class="fd-x" onclick="_rpParts.list.splice(${i},1);rpPartsDraw()">×</button></div>`).join('')}
    <button class="ho-btn sm" onclick="_rpParts.list.push({sku:'',qty:1});rpPartsDraw()">+ A part</button>
    <div class="sheet-actions"><button onclick="document.getElementById('rp-parts').remove()">Cancel</button><button class="primary" onclick="rpPartsSave()">Save</button></div></div></div>`;
}
async function rpPartsSave() {
  const P = _rpParts, parts = P.list.filter(r => r.sku && +r.qty > 0).map(r => ({ sku: r.sku, qty: +r.qty }));
  const { error } = await sb.rpc('hub_retail_kit_parts_save', { p_variant: P.vid, p_parts: parts });
  if (error) { alert(error.message); return; }
  document.getElementById('rp-parts').remove(); await rpStockLoad();
}
// ---------- 🧩 Kit parts grid: kits down the side, Ditto colours across; each number = blocks of that colour in one kit ----------
let _rpGrid = null;
async function rpGridOpen() {
  if (!Array.isArray(_rpStock)) await rpStockLoad();
  if (!_rp.cols) { try { await rpColsLoad(); } catch (e) { } }
  if (!_invPick) { const { data } = await sb.rpc('hub_inventory_items_pick'); _invPick = data || []; }
  const ditto = (_invPick || []).filter(i => /ditto/i.test(i.name || '') && !/total/i.test(i.sku || ''));
  const dcol = (_rp.cols || []).find(c => /ditto/i.test(c.name || ''));
  _rpGrid = { scope: dcol ? 'col:' + dcol.id : 'kits', cols: ditto, vals: {}, dirty: new Set(), q: '' };
  (_rpStock || []).forEach(x => (x.parts || []).forEach(pp => { _rpGrid.vals[x.variant_id + '|' + pp.sku] = String(pp.qty); }));
  rpGridDraw();
}
function rpGridDraw() {
  const G = _rpGrid, q = G.q.trim().toLowerCase(), V = rpScopeVariants(G.scope).filter(x => x.category !== 'snack' && (!q || rpVarName(x).toLowerCase().includes(q)));
  const ae = document.activeElement, aeId = ae && ae.id === 'rp-grid-q' ? ae.id : null, aePos = aeId ? ae.selectionStart : null;
  const short = n => String(n).replace(/^ditto\s*-\s*/i, '');
  rpOverlay('rp-grid', `<div class="fd-sheet-back" onclick="if(event.target===this&&(!_rpGrid.dirty.size||confirm('Close without saving?')))rpOverlayClose('rp-grid')"><div class="fd-sheet" style="max-width:96vw;width:1200px"><h3>🧩 Kit parts</h3>
    <div class="fd-inline" style="gap:8px"><select onchange="_rpGrid.scope=this.value;rpGridDraw()">${rpScopeOpts(G.scope, true)}</select><input id="rp-grid-q" placeholder="Find a kit" value="${escAttr(G.q)}" oninput="_rpGrid.q=this.value;rpGridDraw()"></div>
    <p class="fd-sm">How many <b>packs</b> of each Ditto colour go into <b>one</b> kit. Ditto is stocked in boxes of 24 packs: at a studio, Make kits takes the packs from its open (loose) Ditto, and Open a kit puts them back there; at the warehouse, from that colour’s boxes. Other parts set on a kit (not Ditto) are kept.</p>
    ${!G.cols.length ? '<p class="fd-msg">No Ditto colours found in the inventory list.</p>' : `<div class="fd-tbl-wrap rp-grid-wrap"><table class="fd-tbl rp-grid"><thead><tr><th class="rp-grid-k">Kit</th>${G.cols.map(c => `<th title="${escAttr(c.name)}"><span class="rp-sw" style="background:${typeof invSwatch === 'function' ? invSwatch(c.name) : '#ddd'}"></span>${esc(short(c.name))}</th>`).join('')}<th>Packs</th></tr></thead><tbody>` +
      V.map(x => { const tot = G.cols.reduce((t, c) => t + (+G.vals[x.variant_id + '|' + c.sku] || 0), 0);
        return `<tr${G.dirty.has(x.variant_id) ? ' class="rp-sel"' : ''}><td class="rp-grid-k">${esc(rpVarName(x))}</td>${G.cols.map(c => { const k = x.variant_id + '|' + c.sku, v = G.vals[k] || '';
          return `<td><input class="rp-gcell${v ? ' on' : ''}" type="number" min="0" step="1" value="${escAttr(v)}" oninput="rpGridSet('${x.variant_id}','${escAttr(c.sku)}',this)"></td>`; }).join('')}<td class="num" id="rp-gt-${x.variant_id}"><b>${tot || ''}</b></td></tr>`; }).join('') + '</tbody></table></div>'}
    <div class="sheet-actions"><span class="fd-sm" id="rp-grid-n" style="margin-right:auto">${G.dirty.size ? G.dirty.size + ' kit' + (G.dirty.size === 1 ? '' : 's') + ' changed' : ''}</span><button onclick="rpOverlayClose('rp-grid')">Close</button><button class="primary" onclick="rpGridSave()">Save</button></div></div></div>`);
  if (aeId) { const i = document.getElementById(aeId); if (i) { i.focus(); try { i.setSelectionRange(aePos, aePos); } catch (e) { } } }
}
function rpGridSet(vid, sku, el) {
  const G = _rpGrid; G.vals[vid + '|' + sku] = el.value; G.dirty.add(vid); el.classList.toggle('on', +el.value > 0);
  el.closest('tr').classList.add('rp-sel');
  const t = document.getElementById('rp-gt-' + vid); if (t) t.innerHTML = '<b>' + (G.cols.reduce((s, c) => s + (+G.vals[vid + '|' + c.sku] || 0), 0) || '') + '</b>';
  const n = document.getElementById('rp-grid-n'); if (n) n.textContent = G.dirty.size + ' kit' + (G.dirty.size === 1 ? '' : 's') + ' changed';
}
async function rpGridSave() {
  const G = _rpGrid; if (!G.dirty.size) { rpOverlayClose('rp-grid'); return; }
  const dsk = new Set(G.cols.map(c => c.sku)); let bad = 0;
  for (const vid of G.dirty) {
    const x = (_rpStock || []).find(z => z.variant_id === vid);
    const keep = ((x && x.parts) || []).filter(pp => !dsk.has(pp.sku)).map(pp => ({ sku: pp.sku, qty: +pp.qty }));   // (other parts stay)
    const parts = keep.concat(G.cols.map(c => ({ sku: c.sku, qty: +G.vals[vid + '|' + c.sku] || 0 })).filter(pp => pp.qty > 0));
    const { error } = await sb.rpc('hub_retail_kit_parts_save', { p_variant: vid, p_parts: parts }); if (error) bad++;
  }
  if (bad) alert(bad + ' kit' + (bad === 1 ? '' : 's') + ' didn’t save. Please try again.');
  rpOverlayClose('rp-grid'); _rp.msg = `✓ Parts saved for ${G.dirty.size - bad} kit${G.dirty.size - bad === 1 ? '' : 's'}.`; await rpStockLoad(); rpDraw();
}
// ---------- 🔢 Ask studios to count / 📋 Count sheet (retail_counts.sql) ----------
let _rpCnt = null, _rpSheet = null;
function rpOverlay(id, html) { let el = document.getElementById(id); if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); } el.innerHTML = html; }
function rpOverlayClose(id) { const el = document.getElementById(id); if (el) el.remove(); }
const rpVarName = x => x.product + (x.variant && x.variant !== 'Default' ? ' · ' + x.variant : '');
function rpScopeVariants(scope) {   // which product options: ticked, all kits, all snacks, or a collection
  const L = Array.isArray(_rpStock) ? _rpStock : [];
  if (scope === 'ticked') return L.filter(x => _rp.sel.has(x.product_id));
  if (scope === 'kits') return L.filter(x => x.category !== 'snack');
  if (scope === 'snacks') return L.filter(x => x.category === 'snack');
  if (String(scope).startsWith('col:')) { const c = (_rp.cols || []).find(z => z.id === scope.slice(4)); return c ? L.filter(x => (_rp.rows || []).some(r => r.id === x.product_id && rpInCol(r, c))) : []; }
  return L;
}
function rpScopeOpts(cur, withTicked) {
  return (withTicked && _rp.sel.size ? [['ticked', `The ${_rp.sel.size} ticked`]] : []).concat([['kits', 'All kits and other shop items'], ['snacks', 'All drinks and snacks']])
    .concat((_rp.cols || []).map(c => ['col:' + c.id, '🗂️ ' + c.name])).concat([['all', 'Everything']])
    .map(o => `<option value="${o[0]}"${o[0] === cur ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
}
async function rpCntOpen(scope) {
  if (!Array.isArray(_rpStock)) await rpStockLoad();
  if (!_rp.cols) { try { await rpColsLoad(); } catch (e) { } }
  _rpCnt = { scope: scope || (_rp.sel.size ? 'ticked' : 'kits'), all: true, studios: new Set(), first: !(_rpStock || []).some(x => Object.keys(x.on_hand || {}).some(k => k !== 'WAREHOUSE')), due: new Date().toLocaleDateString('en-CA') };
  rpCntDraw();
}
function rpCntDraw() {
  const C = _rpCnt, V = rpScopeVariants(C.scope), ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const nSt = C.all ? ids.length : C.studios.size;
  rpOverlay('rp-cnt', `<div class="fd-sheet-back" onclick="if(event.target===this)rpOverlayClose('rp-cnt')"><div class="fd-sheet" style="max-width:680px"><h3>🔢 Ask studios to count</h3>
    <p class="fd-sm">Each studio gets a count task for each product, in the Hub’s <b>Supplies → Counts</b> (a coordinator or manager PIN), like their Ditto counts.</p>
    <label class="f">What to count<select onchange="_rpCnt.scope=this.value;rpCntDraw()">${rpScopeOpts(C.scope, true)}</select></label>
    <p class="fd-sm">${V.length} product option${V.length === 1 ? '' : 's'}${V.length ? ': ' + esc(V.slice(0, 6).map(rpVarName).join(', ')) + (V.length > 6 ? ' and ' + (V.length - 6) + ' more' : '') : ''}</p>
    <label class="fd-chk"><input type="radio" name="cnt-st" ${C.all ? 'checked' : ''} onchange="_rpCnt.all=true;rpCntDraw()"> Every studio</label>
    <label class="fd-chk"><input type="radio" name="cnt-st" ${C.all ? '' : 'checked'} onchange="_rpCnt.all=false;rpCntDraw()"> Only these studios</label>
    ${C.all ? '' : `<div class="rp-studios">${ids.map(id => `<label><input type="checkbox" ${C.studios.has(id) ? 'checked' : ''} onchange="this.checked?_rpCnt.studios.add('${id}'):_rpCnt.studios.delete('${id}')"> ${esc(STUDIO_NAMES[id])}</label>`).join('')}</div>`}
    <label class="ba-check"><input type="checkbox" ${C.first ? 'checked' : ''} onchange="_rpCnt.first=this.checked;rpCntDraw()"> <b>First count</b>: their number becomes the stock (no recount, since there’s nothing to compare yet)</label>
    ${C.first ? '' : '<p class="fd-sm">A regular count is blind: if it doesn’t match what the system expects, they’re asked to count again.</p>'}
    <label class="f">Count by<input type="date" value="${escAttr(C.due)}" onchange="_rpCnt.due=this.value"></label>
    <div class="sheet-actions"><button onclick="rpOverlayClose('rp-cnt')">Cancel</button><button class="primary" onclick="rpCntGo()">Send ${V.length * nSt} count${V.length * nSt === 1 ? '' : 's'}</button></div></div></div>`);
}
async function rpCntGo() {
  const C = _rpCnt, V = rpScopeVariants(C.scope);
  if (!V.length) { alert('Nothing to count there yet (products need a SKU: save them once).'); return; }
  if (!C.all && !C.studios.size) { alert('Tick the studios.'); return; }
  const { data, error } = await sb.rpc('hub_retail_count_start', { p: { variant_ids: V.map(x => x.variant_id), all_studios: C.all, studios: [...C.studios], first: C.first, due: C.due } });
  if (error) { alert(/hub_retail_count_start/.test(error.message) ? 'Run retail_counts.sql in Supabase first.' : error.message); return; }
  rpOverlayClose('rp-cnt');
  _rp.msg = `✓ ${data.made} count task${data.made === 1 ? '' : 's'} sent to ${data.studios} studio${data.studios === 1 ? '' : 's'}${data.skipped ? ` (${data.skipped} already waiting to be counted, left as they were)` : ''}. They’re in Supplies → Counts.`; rpDraw();
}
// 📋 Count sheet: one place, many products, typed in and saved together
async function rpSheetOpen() {
  if (!Array.isArray(_rpStock)) await rpStockLoad();
  if (!_rp.cols) { try { await rpColsLoad(); } catch (e) { } }
  _rpSheet = { loc: 'WAREHOUSE', scope: 'kits', q: '', vals: {}, note: '' }; rpSheetDraw();
}
function rpSheetDraw() {
  const ae = document.activeElement, aeId = ae && ae.id && ae.id.startsWith('rp-s') ? ae.id : null, aePos = aeId && ae.type !== 'number' ? ae.selectionStart : null;
  const S = _rpSheet, q = S.q.trim().toLowerCase(), V = rpScopeVariants(S.scope).filter(x => !q || (rpVarName(x) + ' ' + (x.sku || '')).toLowerCase().includes(q));
  const ids = Object.keys(STUDIO_NAMES).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  const filled = Object.values(S.vals).filter(v => v !== '' && v != null).length;
  rpOverlay('rp-sheet', `<div class="fd-sheet-back" onclick="if(event.target===this&&(!${filled}||confirm('Close without saving these counts?')))rpOverlayClose('rp-sheet')"><div class="fd-sheet" style="max-width:820px"><h3>📋 Count sheet</h3>
    <div class="fd-inline" style="flex-wrap:wrap;gap:8px"><select onchange="_rpSheet.loc=this.value;rpSheetDraw()"><option value="WAREHOUSE"${S.loc === 'WAREHOUSE' ? ' selected' : ''}>🏭 Salt Spring warehouse</option>${ids.map(id => `<option value="${id}"${S.loc === id ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('')}</select>
      <select onchange="_rpSheet.scope=this.value;rpSheetDraw()">${rpScopeOpts(S.scope, false)}</select>
      <input id="rp-sheet-q" placeholder="Find a product or SKU" value="${escAttr(S.q)}" oninput="_rpSheet.q=this.value;rpSheetDraw()"></div>
    <p class="fd-sm">Type what’s on the shelf. Leave a box empty to skip it; 0 means none. Saving changes the stock to these numbers (the differences are kept as count corrections).</p>
    <div class="fd-tbl-wrap" style="max-height:52vh;overflow:auto"><table class="fd-tbl"><thead><tr><th>Product</th><th>SKU</th><th class="num">System says</th><th class="num">Counted</th></tr></thead><tbody>${V.map(x => { const now = rpN((x.on_hand || {})[S.loc]), v = S.vals[x.variant_id];
      return `<tr${v !== undefined && v !== '' && +v !== now ? ' class="rp-sel"' : ''}><td>${esc(rpVarName(x))}</td><td class="fd-sm">${esc(x.sku || '')}</td><td class="num">${now}</td>
        <td class="num"><input id="rp-sv-${x.variant_id}" type="number" min="0" step="1" style="width:84px" value="${escAttr(v ?? '')}" oninput="_rpSheet.vals['${x.variant_id}']=this.value;this.closest('tr').classList.toggle('rp-sel',this.value!==''&&+this.value!==${now});const c=document.getElementById('rp-sheet-n');if(c)c.textContent=Object.values(_rpSheet.vals).filter(v=>v!==''&&v!=null).length+' counted'"></td></tr>`; }).join('') || '<tr><td colspan="4" class="fd-sm">Nothing here.</td></tr>'}</tbody></table></div>
    <label class="f">Note (optional)<input value="${escAttr(S.note)}" oninput="_rpSheet.note=this.value" placeholder="e.g. November stock take"></label>
    <div class="sheet-actions"><span class="fd-sm" id="rp-sheet-n" style="margin-right:auto">${filled} counted</span><button onclick="rpOverlayClose('rp-sheet')">Cancel</button><button class="primary" onclick="rpSheetSave()">Save the counts</button></div></div></div>`);
  if (aeId) { const i = document.getElementById(aeId); if (i) { i.focus(); try { if (aePos != null) i.setSelectionRange(aePos, aePos); } catch (e) { } } }
}
async function rpSheetSave() {
  const S = _rpSheet, counts = Object.entries(S.vals).filter(([, v]) => v !== '' && v != null && !isNaN(+v) && +v >= 0).map(([variant_id, qty]) => ({ variant_id, qty: Math.floor(+qty) }));
  if (!counts.length) { alert('Type at least one count.'); return; }
  if (!confirm(`Save ${counts.length} count${counts.length === 1 ? '' : 's'} for ${S.loc === 'WAREHOUSE' ? 'the warehouse' : STUDIO_NAMES[S.loc]}?`)) return;
  const { data, error } = await sb.rpc('hub_retail_count_sheet_save', { p: { loc: S.loc, counts, note: S.note } });
  if (error) { alert(/hub_retail_count_sheet_save/.test(error.message) ? 'Run retail_counts.sql in Supabase first.' : error.message); return; }
  rpOverlayClose('rp-sheet'); _rp.msg = `✓ Counts saved: ${data.changed} changed, ${data.same} already right.`; await rpStockLoad(); rpDraw();
}
function rpStudio(id, on) { const s = new Set(_rp.edit.studios || []); if (on) s.add(id); else s.delete(id); rpF('studios', [...s]); }
function rpPic(i, dir) {
  const A = _rp.edit.images;
  if (!dir) { if (!confirm('Remove this picture from the product?')) return; A.splice(i, 1); }
  else { const j = i + dir; [A[i], A[j]] = [A[j], A[i]]; }
  _rp.edit.dirty = true; rpDraw();
}
async function rpUpload(inp) {
  const files = [...(inp.files || [])]; if (!files.length) return;
  const urls = await rpUploadFiles(files, _rp.edit.id || 'new', (k, n) => { const e = document.getElementById('rp-upmsg'); if (e) e.textContent = `Uploading ${k + 1} of ${n}…`; });
  urls.filter(Boolean).forEach(u => _rp.edit.images.push(u)); _rp.edit.dirty = true; rpDraw();
}
function rpClose() { if (_rp.edit && _rp.edit.dirty && !confirm('Leave without saving your changes?')) return; _rp.edit = null; rpDraw(); }
async function rpSave() {
  const E = _rp.edit;
  if (!String(E.name || '').trim()) { _rp.msg = 'Give the product a name.'; rpDraw(); return; }
  if (E.sell_in_studio && !E.allStudios && !(E.studios || []).length) { _rp.msg = 'Choose the studios that sell it (or Every studio).'; rpDraw(); return; }
  const skus = E.variants.map(v => String(v.sku || '').trim().toUpperCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) { _rp.msg = 'Two variants have the same SKU.'; rpDraw(); return; }
  const p = Object.assign({}, E, { studios: E.allStudios ? [] : (E.studios || []), variants: E.variants.map(v => ({ id: v.id || null, name: v.name, sku: v.sku, barcode: v.barcode, price: v.price,
    member_price: v.member_price, weight_g: v.weight_g, length_cm: v.length_cm, width_cm: v.width_cm, height_cm: v.height_cm, active: v.active !== false })) });
  ['dirty', 'allStudios', 'created_at', 'updated_at'].forEach(k => delete p[k]);
  const { data, error } = await sb.rpc('hub_retail_save', { p });
  if (error) { _rp.msg = 'Not saved: ' + error.message; rpDraw(); return; }
  _rp.edit = null; _rp.msg = `✓ Saved ${E.name}.`; await rpLoad(); rpColsLoad();
}
// ---- 🗂️ Collections (retail_collections.sql): groups of products, e.g. Ditto kits (4-piece kits first, then 8-piece, then more) ----
// A product is in one when it has one of its tags or is picked by hand, unless it's left out by hand. Sections: the first one
// whose tags it has, else the "More" heading.
async function rpColsLoad() {
  const { data, error } = await sb.rpc('hub_retail_collections_list');
  _rp.colErr = error ? (/hub_retail_collections/.test(error.message) ? 'Run retail_collections.sql in Supabase first.' : error.message) : '';
  _rp.cols = error ? [] : (data || []);
  if (_rp.col && !_rp.cols.some(c => c.id === _rp.col)) _rp.col = '';
  if (_rp.colEdit) { const fresh = _rp.cols.find(c => c.id === _rp.colEdit.id); if (fresh && !_rp.colEdit.dirty) _rp.colEdit = JSON.parse(JSON.stringify(fresh)); }
  if (!_rp.edit && (_rp.view === 'cols' || _rp.view === 'col' || _rp.view === 'list')) rpDraw();
}
function rpInCol(r, c) {
  if (!c) return false; const t = new Set((r.tags || []).map(x => String(x).toLowerCase()));
  return ((c.tags || []).some(x => t.has(x)) || (c.product_ids || []).includes(r.id)) && !(c.hidden_ids || []).includes(r.id);
}
function rpColsHtml() {
  const C = _rp.cols;
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🗂️ Collections</div><span class="spacer"></span><button class="ho-btn primary" onclick="rpColOpen(null)">+ New collection</button><button class="ho-btn" onclick="_rp.view='list';rpDraw()">← All products</button></div>
    <div class="ho-intro">Groups of products for World’s shop, like <b>Ditto kits</b>. A product joins a collection by its <b>tags</b> (or by hand). Sections show in order, so the best sellers come first.</div>
    ${_rp.colErr ? `<p class="fd-msg">${esc(_rp.colErr)}</p>` : ''}${_rp.msg ? `<p class="fd-ok">${esc(_rp.msg)}</p>` : ''}
    ${C === undefined || C === null ? '<p class="fd-sm">Loading…</p>' : !C.length ? '<p class="fd-sm">No collections yet.</p>' :
    `<div class="rpc-list">${C.map(c => { const P = c.products || [], nopic = P.filter(x => !x.pictures).length;
      return `<button class="rpc-card${c.active ? '' : ' rp-off'}" onclick="rpColOpen('${c.id}')"><div class="rpc-pics" style="position:relative">${c.image   // ⭐ its cover (World's Shop by Collection), else its first 4 products
        ? `<img src="${escAttr(c.image)}" alt="" style="grid-column:1/-1;height:144px"><span style="position:absolute;left:6px;top:6px;background:#fff;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.2)">\u2b50 Cover</span>`
        : P.filter(x => x.image).slice(0, 4).map(x => `<img src="${escAttr(x.image)}" alt="">`).join('') || '<span class="wsm-noimg"></span>'}</div>
        <b>${esc(c.name)}</b>${c.active ? '' : ' <span class="fd-sm">(off)</span>'}<span class="fd-sm">${P.length} product${P.length === 1 ? '' : 's'}${(c.sections || []).length ? ' · ' + c.sections.map(s => esc(s.title)).join(', ') : ''}</span>
        ${nopic ? `<span class="rp-inv">📷 ${nopic} still need pictures</span>` : P.length ? '<span class="fd-ok" style="font-size:12px">✓ every product has a picture</span>' : ''}</button>`; }).join('')}</div>`}`;
}
function rpColOpen(id) {
  const c = id ? (_rp.cols || []).find(x => x.id === id) : null;
  _rp.colEdit = c ? JSON.parse(JSON.stringify(c)) : { name: '', blurb: '', tags: [], product_ids: [], hidden_ids: [], sections: [], more_title: 'More', show_online: true, active: true, products: [] };
  _rp.view = 'col'; _rp.msg = ''; rpDraw(); window.scrollTo(0, 0);
}
function rpCF(k, v) { _rp.colEdit[k] = v; _rp.colEdit.dirty = true; }
function rpColHtml() {
  const E = _rp.colEdit; if (!E) { _rp.view = 'cols'; return rpColsHtml(); }
  // products in it right now (from the saved tags, plus what's changed here), by section
  const R = (_rp.rows || []), tagsOf = r => new Set((r.tags || []).map(x => String(x).toLowerCase()));
  const inIt = R.filter(r => rpInCol(r, E));
  const secOf = r => { const t = tagsOf(r); const i = (E.sections || []).findIndex(s => (s.tags || []).some(x => t.has(String(x).toLowerCase()))); return i; };
  const groups = (E.sections || []).map((s, i) => ({ title: s.title || 'Section ' + (i + 1), list: inIt.filter(r => secOf(r) === i) })).concat([{ title: E.more_title || 'More', list: inIt.filter(r => secOf(r) < 0) }]).filter(g => g.list.length);
  const nopic = inIt.filter(r => !(r.images || []).length).length;
  const isCover = r => !!E.image && (r.images || [])[0] === E.image;
  const tile = r => `<div class="rpc-tile${r.active ? '' : ' rp-off'}" style="position:relative">${isCover(r) ? '<span title="The collection\u2019s cover" style="position:absolute;left:6px;top:6px;z-index:1;background:#fff;border-radius:999px;padding:2px 7px;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.2)">\u2b50 Cover</span>' : ''}<button onclick="_rp.back='col';rpOpen('${r.id}')" title="Open ${escAttr(r.name)}">${(r.images || [])[0] ? `<img src="${escAttr(r.images[0])}" alt="">` : '<span class="rpc-nopic">📷<br>No picture yet</span>'}
      <b>${esc(r.name)}</b><span class="fd-sm">${rpMoney(r.price)}${r.active ? '' : ' · off'}${r.sell_online ? ' · 🌐' : ''}${r.sell_in_studio ? ' · 🏪' : ''}</span></button>
      <button class="fd-x" title="Leave it out of this collection" onclick="rpColHide('${r.id}')">×</button>${(r.images || [])[0] && !isCover(r) ? `<button class="ho-btn sm" title="Use this product\u2019s picture as the collection\u2019s cover" style="margin:4px auto 0;display:block" onclick="rpColCover('${r.id}')">\u2b50 Cover</button>` : ''}</div>`;
  const others = R.filter(r => !rpInCol(r, E)).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">🗂️ ${E.id ? esc(E.name || 'Collection') : 'New collection'}</div><span class="spacer"></span>
      <button class="ho-btn" onclick="rpColBack()">← Collections</button><button class="ho-btn primary" onclick="rpColSave()">Save</button></div>
    ${_rp.msg ? `<p class="fd-msg">${esc(_rp.msg)}</p>` : ''}
    <div class="rp-grid"><section class="rp-card"><h4>The collection</h4>
      <label>Name<input value="${escAttr(E.name)}" placeholder="e.g. Ditto kits" oninput="rpCF('name',this.value)"></label>
      <label>Short description <span class="fd-sm">(for World’s shop)</span><input value="${escAttr(E.blurb || '')}" maxlength="160" oninput="rpCF('blurb',this.value)"></label>
      ${rpColCoverHtml(E, inIt)}
      <label>Products with any of these tags <span class="fd-sm">(commas)</span><input value="${escAttr((E.tags || []).join(', '))}" onchange="rpCF('tags',this.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));rpDraw()"></label>
      <label class="fd-chk"><input type="checkbox" ${E.show_online ? 'checked' : ''} onchange="rpCF('show_online',this.checked)"> 🌐 Show on World’s shop</label>
      <label class="fd-chk"><input type="checkbox" ${E.active ? 'checked' : ''} onchange="rpCF('active',this.checked)"> <b>On</b></label></section>
    <section class="rp-card"><h4>Sections <span class="fd-sm">(in this order; a product goes in the first one whose tags it has)</span></h4>
      ${(E.sections || []).map((sc, i) => `<div class="rpc-sec"><input value="${escAttr(sc.title || '')}" placeholder="e.g. 4-piece kits" oninput="_rp.colEdit.sections[${i}].title=this.value;_rp.colEdit.dirty=true">
        <input value="${escAttr((sc.tags || []).join(', '))}" placeholder="tags, e.g. 4-piece ditto kit" onchange="_rp.colEdit.sections[${i}].tags=this.value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);_rp.colEdit.dirty=true;rpDraw()">
        <button class="ho-btn sm" ${i ? '' : 'disabled'} onclick="rpColSec(${i},-1)">▲</button><button class="ho-btn sm" ${i < E.sections.length - 1 ? '' : 'disabled'} onclick="rpColSec(${i},1)">▼</button><button class="fd-x" onclick="_rp.colEdit.sections.splice(${i},1);_rp.colEdit.dirty=true;rpDraw()">×</button></div>`).join('')}
      <button class="ho-btn sm" onclick="_rp.colEdit.sections.push({title:'',tags:[]});_rp.colEdit.dirty=true;rpDraw()">+ Add a section</button>
      <label style="margin-top:8px">Heading for the rest<input value="${escAttr(E.more_title || 'More')}" oninput="rpCF('more_title',this.value)"></label></section></div>
    ${E.id && inIt.length ? `<p style="margin:12px 0 0"><button class="ho-btn" onclick="rpColTickAll()">☑ Tick all ${inIt.length} for a bulk change (price, front desk…)</button></p>` : ''}
    <p class="fd-sm" style="margin:12px 0 4px"><b>${inIt.length}</b> product${inIt.length === 1 ? '' : 's'} in it${nopic ? ` · <span class="rp-inv">📷 ${nopic} still need pictures</span> (tap one to add them, or use 📷 Bulk pictures)` : ''}</p>
    ${groups.map(g => `<h4 class="rpc-h">${esc(g.title)} <span class="fd-sm">${g.list.length}</span></h4><div class="rpc-tiles">${g.list.map(tile).join('')}</div>`).join('') || '<p class="fd-sm">No products have these tags yet.</p>'}
    <div class="rp-card" style="margin-top:14px"><h4>Add a product by hand</h4><select onchange="if(this.value)rpColAdd(this.value)"><option value="">Choose a product…</option>${others.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
      ${(E.hidden_ids || []).length ? `<p class="fd-sm" style="margin-top:6px">Left out by hand: ${E.hidden_ids.map(id => { const r = R.find(x => x.id === id); return r ? `${esc(r.name)} <button class="ho-btn sm" onclick="rpColUnhide('${id}')">put back</button>` : ''; }).join(' · ')}</p>` : ''}</div>
    <div class="rp-foot">${E.id ? '<button class="ho-btn" onclick="rpColDelete()">Delete collection</button>' : ''}<span class="spacer"></span><button class="ho-btn primary" onclick="rpColSave()">Save</button></div>`;
}
// ---- ☑ Bulk changes (retail_bulk.sql): tick products, then change them all at once ----
const RP_BULK = [['desk_on', '🏪 Sell at the front desk'], ['desk_add', '🏪 Add studios to the front desk'], ['desk_off', '🏪 Stop selling at the front desk'],
  ['online_on', '🌐 Sell online'], ['online_off', '🌐 Stop selling online'], ['on', 'Turn On'], ['off', 'Turn Off (hidden everywhere)'],
  ['price_set', '💲 Set the price to…'], ['price_pct', '💲 Change the price by %…'], ['price_amt', '💲 Change the price by $…'],
  ['member_set', '⭐ Set the member price to…'], ['member_pct', '⭐ Member price: % off the price…'], ['member_clear', '⭐ Clear the member price'],
  ['sale_pct', '🏷️ Put on sale: % off…'], ['sale_clear', '🏷️ End the sale'], ['tag_add', '🔖 Add a tag…'], ['tag_remove', '🔖 Remove a tag…'], ['count_ask', '🔢 Ask studios to count these…']];
// (Nov 10 2026) ticking redraws the list: keep the page where it was (the window, the pane and the table's own scroll)
function rpDrawKeep() {
  const pane = document.getElementById('rp-pane'), wrap = pane && pane.querySelector('.fd-tbl-wrap');
  const y = window.scrollY, py = pane ? pane.scrollTop : 0, wy = wrap ? wrap.scrollTop : 0, wx = wrap ? wrap.scrollLeft : 0;
  const se = document.scrollingElement, sy = se ? se.scrollTop : 0;
  const barH = () => { const b = pane && pane.querySelector('.rp-bulk'); return b ? b.offsetHeight + 16 : 0; }, h0 = barH();
  rpDraw();
  const w2 = pane && pane.querySelector('.fd-tbl-wrap'), dh = barH() - h0;   // (the bulk bar appearing or going pushes the rows: follow them)
  if (pane) pane.scrollTop = py + (pane.scrollHeight > pane.clientHeight ? dh : 0); if (w2) { w2.scrollTop = wy; w2.scrollLeft = wx; }
  if (se) se.scrollTop = sy + dh; window.scrollTo(window.scrollX, y + dh);
}
function rpSel(id, on) { if (on) _rp.sel.add(id); else _rp.sel.delete(id); rpDrawKeep(); }
function rpSelAll(on) { (_rp.visible || []).forEach(id => on ? _rp.sel.add(id) : _rp.sel.delete(id)); rpDrawKeep(); }
function rpColTickAll() { const E = _rp.colEdit; if (!E) return; if (E.dirty && !confirm('Leave without saving the collection?')) return;
  _rp.sel = new Set((_rp.rows || []).filter(r => rpInCol(r, E)).map(r => r.id)); _rp.col = E.id; _rp.show = 'all'; _rp.colEdit = null; _rp.view = 'list'; _rp.msg = ''; rpDraw(); }
function rpBulkBarHtml(rows) {
  const n = _rp.sel.size; if (!n) return '';
  const a = _rp.ba, needV = ['price_set', 'price_pct', 'price_amt', 'member_set', 'member_pct', 'sale_pct'].includes(a), needTag = ['tag_add', 'tag_remove'].includes(a), needSt = ['desk_on', 'desk_add'].includes(a);
  const ids = Object.keys(STUDIO_NAMES).sort((x, y) => (STUDIO_NAMES[x] || x).localeCompare(STUDIO_NAMES[y] || y));
  const hidden = [..._rp.sel].filter(id => !rows.some(r => r.id === id)).length;
  const ph = { price_set: '24.99', price_pct: 'e.g. 10 or -10', price_amt: 'e.g. 2 or -2', member_set: '21.99', member_pct: 'e.g. 10', sale_pct: 'e.g. 20' }[a] || '';
  return `<div class="rp-bulk"><div class="rp-bulk-row"><b>☑ ${n} ticked</b>${hidden ? ` <span class="fd-sm">(${hidden} not shown with these filters)</span>` : ''}
      <button class="ho-btn sm" onclick="_rp.sel=new Set();rpDrawKeep()">Untick all</button>
      <select onchange="_rp.ba=this.value;rpDrawKeep()"><option value="">Change them…</option>${RP_BULK.map(b => `<option value="${b[0]}"${a === b[0] ? ' selected' : ''}>${b[1]}</option>`).join('')}</select>
      ${needV ? `<span class="rp-money">${/pct/.test(a) ? '' : '$'}<input id="rp-bv" type="number" step="0.01" placeholder="${ph}" value="${escAttr(_rp.bv)}" oninput="_rp.bv=this.value">${/pct/.test(a) ? '%' : ''}</span>` : ''}
      ${a === 'sale_pct' ? `<label class="fd-sm">until <input type="date" value="${escAttr(_rp.bends)}" onchange="_rp.bends=this.value"></label>` : ''}
      ${needTag ? `<input id="rp-btag" placeholder="tag, e.g. holiday" value="${escAttr(_rp.bv)}" oninput="_rp.bv=this.value">` : ''}
      ${a ? `<button class="ho-btn primary sm" onclick="rpBulkApply()">Apply to ${n}</button>` : ''}</div>
    ${a === 'price_pct' || a === 'price_amt' ? '<p class="fd-sm">Up with a plus number, down with a minus one (−10 = 10% less). Variants with their own price change the same way.</p>' : ''}
    ${a === 'price_set' ? '<p class="fd-sm">Sets each product’s price. Variants with their own price keep it (change those in the product).</p>' : ''}
    ${a === 'member_pct' || a === 'sale_pct' ? '<p class="fd-sm">Worked out from each product’s regular price, to the cent.</p>' : ''}
    ${needSt ? `<div class="rp-sub">${a === 'desk_on' ? `<label class="fd-chk"><input type="radio" name="rp-bst" ${_rp.bevery ? 'checked' : ''} onchange="_rp.bevery=true;rpDrawKeep()"> Every studio</label>
        <label class="fd-chk"><input type="radio" name="rp-bst" ${_rp.bevery ? '' : 'checked'} onchange="_rp.bevery=false;rpDrawKeep()"> Only these studios</label>` : '<p class="fd-sm">These studios are added to the ones each product already has.</p>'}
      ${a === 'desk_add' || !_rp.bevery ? `<div class="rp-studios">${ids.map(id => `<label><input type="checkbox" ${_rp.bst.has(id) ? 'checked' : ''} onchange="this.checked?_rp.bst.add('${id}'):_rp.bst.delete('${id}')"> ${esc(STUDIO_NAMES[id] || id)}</label>`).join('')}</div>` : ''}</div>` : ''}</div>`;
}
async function rpBulkApply() {   // (named apart from 📷 Bulk pictures' rpBulkGo)
  if (_rp.ba === 'count_ask') { rpCntOpen('ticked'); return; }
  const a = _rp.ba, ids = [..._rp.sel], lab = (RP_BULK.find(b => b[0] === a) || [, a])[1];
  const p = { action: a };
  if (['price_set', 'price_pct', 'price_amt', 'member_set', 'member_pct', 'sale_pct'].includes(a)) { if (_rp.bv === '' || isNaN(+_rp.bv)) { alert('Type the amount.'); return; } p.value = +_rp.bv; }
  if (['tag_add', 'tag_remove'].includes(a)) { if (!String(_rp.bv).trim()) { alert('Type the tag.'); return; } p.tag = String(_rp.bv).trim(); }
  if (a === 'sale_pct') p.ends = _rp.bends || null;
  if (a === 'desk_on') p.studios = _rp.bevery ? [] : [..._rp.bst];
  if (a === 'desk_add') p.studios = [..._rp.bst];
  if ((a === 'desk_on' && !_rp.bevery || a === 'desk_add') && !p.studios.length) { alert('Tick the studios.'); return; }
  const what = lab.replace(/…$/, '') + (p.value != null ? ' ' + (/pct/.test(a) ? p.value + '%' : '$' + p.value) : '') + (p.tag ? ' “' + p.tag + '”' : '') + (p.studios && p.studios.length ? ' (' + p.studios.length + ' studios)' : '');
  if (!confirm(`${what}\n\nfor ${ids.length} product${ids.length === 1 ? '' : 's'}?`)) return;
  const { data, error } = await sb.rpc('hub_retail_bulk', { p_ids: ids, p });
  if (error) { alert(/hub_retail_bulk/.test(error.message) ? 'Run retail_bulk.sql in Supabase first.' : error.message); return; }
  _rp.msg = `✓ ${what}: ${data} product${data === 1 ? '' : 's'} changed.`; _rp.ba = ''; _rp.bv = ''; await rpLoad();
}
// ⭐ (Nov 13 2026) the collection's cover on World's Shop by Collection: a product's picture, or automatic (the first product's picture)
function rpColCoverHtml(E, inIt) {
  const pics = inIt.filter(r => (r.images || [])[0]), cur = pics.find(r => r.images[0] === E.image), show = E.image || (pics[0] && pics[0].images[0]) || '';
  return `<label>Cover picture <span class="fd-sm">(on World’s Shop by Collection)</span><select onchange="rpColCover(this.value)">
      <option value="">Automatic: the first product’s picture</option>${E.image && !cur ? '<option value="__own" selected>Its own picture</option>' : ''}
      ${pics.map(r => `<option value="${r.id}"${cur && cur.id === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    ${show ? `<div style="margin:6px 0 10px"><img src="${escAttr(show)}" alt="" style="width:100%;max-width:260px;border-radius:12px;display:block"><span class="fd-sm">${cur ? 'Cover: ' + esc(cur.name) : E.image ? 'Its own picture' : 'Automatic'}${E.image ? '' : ' (changes if the first product changes)'}</span></div>` : '<p class="fd-sm">No product pictures yet.</p>'}`;
}
function rpColCover(v) {
  const E = _rp.colEdit; if (!E || v === '__own') return;
  if (!v) E.image = null;
  else { const r = (_rp.rows || []).find(x => x.id === v); if (!r || !(r.images || [])[0]) return; E.image = r.images[0]; }
  E.dirty = true; _rp.msg = 'Cover chosen: press Save.';
  rpDrawKeep();   // (stay where you are on the page: big collections are long)
  const r2 = v ? (_rp.rows || []).find(x => x.id === v) : null;
  rpToast(r2 ? '\u2b50 ' + r2.name + ' is the cover: press Save' : 'Cover: automatic. Press Save');
}
// a short note at the bottom of the screen (wherever you are on a long page), with a Save button
function rpToast(text, done) {
  let t = document.getElementById('rp-toast');
  if (!t) { t = document.createElement('div'); t.id = 'rp-toast'; t.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;background:#1f2a24;color:#fff;border-radius:999px;padding:10px 12px 10px 18px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;max-width:92vw'; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(text)}</span>${done ? '' : '<button class="ho-btn primary sm" onclick="rpColSave()">Save</button>'}<button class="ho-btn sm" onclick="this.parentNode.remove()" aria-label="Close">\u2715</button>`;
  clearTimeout(rpToast._t); rpToast._t = setTimeout(() => { const x = document.getElementById('rp-toast'); if (x) x.remove(); }, 12000);
}
function rpColSec(i, d) { const S = _rp.colEdit.sections, j = i + d; [S[i], S[j]] = [S[j], S[i]]; _rp.colEdit.dirty = true; rpDraw(); }
function rpColHide(id) { const E = _rp.colEdit; E.product_ids = (E.product_ids || []).filter(x => x !== id); if (!(E.hidden_ids || []).includes(id)) E.hidden_ids = (E.hidden_ids || []).concat(id); E.dirty = true; rpDraw(); }
function rpColUnhide(id) { const E = _rp.colEdit; E.hidden_ids = (E.hidden_ids || []).filter(x => x !== id); E.dirty = true; rpDraw(); }
function rpColAdd(id) { const E = _rp.colEdit; E.hidden_ids = (E.hidden_ids || []).filter(x => x !== id); if (!(E.product_ids || []).includes(id)) E.product_ids = (E.product_ids || []).concat(id); E.dirty = true; rpDraw(); }
function rpColBack() { if (_rp.colEdit && _rp.colEdit.dirty && !confirm('Leave without saving the collection?')) return; _rp.colEdit = null; _rp.view = 'cols'; rpDraw(); }
async function rpColSave() {
  const E = _rp.colEdit; if (!String(E.name || '').trim()) { _rp.msg = 'Give the collection a name.'; rpDraw(); return; }
  const p = { id: E.id || null, name: E.name, slug: E.slug, blurb: E.blurb, description: E.description, image: E.image, tags: E.tags || [], product_ids: E.product_ids || [], hidden_ids: E.hidden_ids || [],
    sections: (E.sections || []).filter(s => String(s.title || '').trim()), more_title: E.more_title, show_online: E.show_online !== false, active: E.active !== false, sort: E.sort };
  const { data, error } = await sb.rpc('hub_retail_collection_save', { p });
  if (error) { _rp.msg = 'Not saved: ' + error.message; rpDraw(); alert('The collection wasn\u2019t saved:\n\n' + error.message); return; }
  { const x = document.getElementById('rp-toast'); if (x) x.remove(); }
  _rp.colEdit = Object.assign(E, { id: data, dirty: false }); _rp.msg = ''; await rpColsLoad(); _rp.msg = '✓ Saved ' + E.name + '.'; rpDrawKeep(); rpToast('\u2713 Saved ' + E.name, true);
}
async function rpColDelete() {
  const E = _rp.colEdit; if (!confirm(`Delete the collection “${E.name}”? Its products stay as they are.`)) return;
  const { error } = await sb.rpc('hub_retail_collection_delete', { p_id: E.id }); if (error) { alert(error.message); return; }
  _rp.colEdit = null; _rp.view = 'cols'; _rp.msg = 'Deleted ' + E.name + '.'; rpColsLoad();
}
async function rpDelete() {
  const E = _rp.edit; if (!confirm(`Delete “${E.name}” and its variants? This can’t be undone. (To stop selling it, switch it Off instead.)`)) return;
  const { error } = await sb.rpc('hub_retail_delete', { p_id: E.id });
  if (error) { _rp.msg = 'Not deleted: ' + error.message; rpDraw(); return; }
  _rp.edit = null; _rp.msg = `Deleted ${E.name}.`; rpLoad();
}
// ---- Shared: upload pictures to retail-media (resized first) → their public addresses ----
async function rpUploadFiles(files, folder, onStep) {
  const urls = [];
  for (let k = 0; k < files.length; k++) {
    if (onStep) onStep(k, files.length);
    let f = files[k]; try { f = await nwShrink(f); } catch (e) { /* the original */ }
    if (f.size > 8 * 1024 * 1024) { alert(files[k].name + ' is over 8 MB; please use a smaller picture.'); urls.push(null); continue; }
    const path = `${folder}/${Date.now()}-${k}-${String(files[k].name).toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
    const { error } = await sb.storage.from('retail-media').upload(path, f, { contentType: f.type, upsert: false });
    if (error) { alert('Upload didn’t work for ' + files[k].name + ': ' + error.message); urls.push(null); continue; }
    urls.push(sb.storage.from('retail-media').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
// ---- 📷 Bulk pictures: drop many photos; each goes to the product its file name matches ----
// "Sculpt and Bake Dog Kit.jpg" → Sculpt & Bake: Dog Kit (main picture); "… Dog Kit 2.jpg", "… Dog Kit (3).jpg" → its 2nd, 3rd
const rpNorm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function rpMatchFile(name) {
  let base = String(name).replace(/\.[a-z0-9]+$/i, ''), n = 1;
  const whole = (_rp.rows || []).filter(p => rpNorm(p.name) === rpNorm(base));   // (a product whose own name ends in a number)
  if (whole.length === 1) return { product: whole[0].id, order: 1, maybe: null };
  const m = base.match(/^(.*?)[\s_-]*(?:\((\d{1,2})\)|[\s_-](\d{1,2}))$/);
  if (m && m[1].trim()) { base = m[1]; n = +(m[2] || m[3]); }
  const f = rpNorm(base), loose = s => s.replace(/\b(kit|the|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const P = (_rp.rows || []).map(p => ({ p, n: rpNorm(p.name) }));
  let hit = P.filter(x => x.n === f);
  if (!hit.length) hit = P.filter(x => loose(x.n) === loose(f));
  if (!hit.length && f.length >= 4) { const c = P.filter(x => x.n.includes(f) || f.includes(x.n)); if (c.length === 1) hit = c; }
  return { product: hit.length === 1 ? hit[0].p.id : '', order: n, maybe: hit.length > 1 ? hit.map(x => x.p.name) : null };
}
function rpBulkPick(inp) {
  const files = [...(inp.files || [])].filter(f => /^image\//.test(f.type));
  _rp.bulk = { items: files.map(f => Object.assign({ file: f, url: URL.createObjectURL(f) }, rpMatchFile(f.name))), busy: false, msg: '' };
  rpDraw();
}
function rpBulkHtml() {
  const B = _rp.bulk, P = (_rp.rows || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📷 Bulk pictures</div><span class="spacer"></span><button class="ho-btn" onclick="_rp.view='list';_rp.bulk=null;rpDraw()">← All products</button></div>
    <div class="ho-intro">Name each photo after its product: <b>Sculpt and Bake Dog Kit.jpg</b> is its main picture, <b>Sculpt and Bake Dog Kit 2.jpg</b> its second, and so on. (Punctuation doesn’t matter.) Check the matches, change any that are wrong, then upload. Pictures are added after the ones a product already has.</div>
    <label class="rp-drop">📷 Choose photos (as many as you like)<input type="file" accept="image/*" multiple onchange="rpBulkPick(this)" hidden></label>`;
  if (!B || !B.items.length) return h;
  const matched = B.items.filter(x => x.product).length;
  h += `<p class="fd-sm"><b>${matched}</b> of ${B.items.length} photos matched to a product${B.items.length - matched ? ` · <b class="fd-warn">${B.items.length - matched} need a product chosen</b> (or they’re skipped)` : ''}.</p>
    <div class="fd-tbl-wrap"><table class="fd-tbl rp-bulk"><thead><tr><th></th><th>Photo</th><th>Product</th><th>Picture #</th></tr></thead><tbody>` +
    B.items.map((x, i) => `<tr class="${x.product ? '' : 'rp-nomatch'}"><td><img src="${escAttr(x.url)}" alt=""></td><td>${esc(x.file.name)}${x.maybe ? `<br><span class="fd-warn">could be: ${esc(x.maybe.slice(0, 3).join(', '))}</span>` : ''}</td>
      <td><select onchange="_rp.bulk.items[${i}].product=this.value;rpDraw()"><option value="">(skip this photo)</option>${P.map(p => `<option value="${p.id}"${p.id === x.product ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
      <td><input type="number" min="1" max="20" value="${x.order}" style="width:60px" onchange="_rp.bulk.items[${i}].order=+this.value||1"></td></tr>`).join('') + '</tbody></table></div>' +
    `<p class="fd-sm" id="rp-bmsg">${esc(B.msg || '')}</p><button class="ho-btn primary" ${matched && !B.busy ? '' : 'disabled'} onclick="rpBulkGo()">Upload ${matched} photo${matched === 1 ? '' : 's'}</button>`;
  return h;
}
async function rpBulkGo() {
  const B = _rp.bulk, todo = B.items.filter(x => x.product).sort((a, b) => a.product.localeCompare(b.product) || a.order - b.order);
  B.busy = true; rpDraw();
  const msg = t => { B.msg = t; const e = document.getElementById('rp-bmsg'); if (e) e.textContent = t; };
  const urls = await rpUploadFiles(todo.map(x => x.file), 'bulk', (k, n) => msg(`Uploading ${k + 1} of ${n}…`));
  const by = {}; todo.forEach((x, i) => { if (urls[i]) (by[x.product] = by[x.product] || []).push(urls[i]); });
  let done = 0, err = 0;
  for (const pid of Object.keys(by)) { msg(`Adding to products… ${++done} of ${Object.keys(by).length}`); const { error } = await sb.rpc('hub_retail_add_images', { p_product: pid, p_urls: by[pid] }); if (error) err++; }
  const n = urls.filter(Boolean).length;
  _rp.bulk = null; _rp.view = 'list'; _rp.msg = `✓ ${n} photo${n === 1 ? '' : 's'} added to ${Object.keys(by).length} product${Object.keys(by).length === 1 ? '' : 's'}.` + (err ? ` ${err} product${err === 1 ? '' : 's'} didn’t save; try those again.` : '');
  await rpLoad();
}
// ---- 📄 Info panels: shared content (a link that opens a pop-up on the product page), on products by tag or ticked ----
async function rpPanelsLoad() {
  const { data, error } = await sb.rpc('hub_retail_panels');
  _rp.panels = error ? { err: /hub_retail_panels/.test(error.message) ? 'Run retail_panels.sql in Supabase first.' : error.message } : (data || []);
  rpDraw();
}
function rpPanelsFor(prod) {   // the panels on a product: by tag (auto) or ticked
  const P = Array.isArray(_rp.panels) ? _rp.panels : [], tags = new Set((prod.tags || []).map(t => String(t).trim().toLowerCase()));
  return P.map(x => ({ x, byTag: (x.tags || []).find(t => tags.has(t)) || null, ticked: (x.product_ids || []).includes(prod.id) }));
}
function rpPanelsHtml() {
  const P = _rp.panels;
  if (_rp.panel) return rpPanelEditHtml();
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📄 Info panels</div><span class="spacer"></span><button class="ho-btn primary" onclick="rpPanelOpen(null)">+ New info panel</button><button class="ho-btn" onclick="_rp.view='list';rpDraw()">← All products</button></div>
    <div class="ho-intro">Shared content for many products, like <b>How to bake Ditto clay</b>. On World it’s a link on the product page that opens a pop-up. A panel goes on every product with one of its tags, and on any product ticked for it. Edit it once and every product shows the change.</div>`;
  if (!P) return h + '<p class="fd-sm">Loading…</p>';
  if (P.err) return h + `<p class="fd-msg">${esc(P.err)}</p>`;
  const R = _rp.rows || [];
  return h + `<div class="fd-tbl-wrap"><table class="fd-tbl rp-tbl"><thead><tr><th>Panel</th><th>Link on the product page</th><th>On products</th><th></th></tr></thead><tbody>` +
    P.map(x => { const n = R.filter(p => rpPanelsFor(p).some(z => z.x.id === x.id && (z.byTag || z.ticked))).length;
      return `<tr class="${x.active ? '' : 'rp-off'}" onclick="rpPanelOpen('${x.id}')"><td><b>${esc(x.name)}</b>${x.active ? '' : ' <span class="fd-pill">off</span>'}${x.body ? '' : ' <span class="fd-warn">no text yet</span>'}</td><td>${esc(x.label)}</td>
        <td>${(x.tags || []).map(t => `<span class="fd-pill">tag: ${esc(t)}</span>`).join(' ')}${(x.product_ids || []).length ? ` <span class="fd-pill">+${x.product_ids.length} ticked</span>` : ''} <span class="fd-sm">· ${n} product${n === 1 ? '' : 's'}</span></td><td>Edit ›</td></tr>`; }).join('') + '</tbody></table></div>';
}
function rpPanelOpen(id) {
  const x = id ? (_rp.panels || []).find(y => y.id === id) : null;
  _rp.panel = x ? JSON.parse(JSON.stringify(x)) : { name: '', label: '', body: '', images: [], tags: [], product_ids: [], active: true };
  rpDraw(); window.scrollTo(0, 0);
}
function rpPanelEditHtml() {
  const X = _rp.panel, set = k => `oninput="_rp.panel.${k}=this.value"`;
  return `<div class="ho-head"><div class="pts-page-title" style="margin:0">📄 ${X.id ? esc(X.name) : 'New info panel'}</div><span class="spacer"></span><button class="ho-btn" onclick="_rp.panel=null;rpDraw()">← All panels</button><button class="ho-btn primary" onclick="rpPanelSave()">Save</button></div>
    <div class="rp-grid"><section class="rp-card"><h4>The panel</h4>
      <label>Name <span class="fd-sm">(for staff)</span><input value="${escAttr(X.name)}" placeholder="e.g. Ditto baking instructions" ${set('name')}></label>
      <label>Link on the product page<input value="${escAttr(X.label)}" placeholder="e.g. How to bake Ditto clay" ${set('label')}></label>
      <label>On every product tagged <span class="fd-sm">(commas)</span><input value="${escAttr((X.tags || []).join(', '))}" placeholder="e.g. ditto" oninput="_rp.panel.tags=this.value.split(',')"></label>
      <p class="fd-sm">${(X.product_ids || []).length ? `Also on ${X.product_ids.length} product${X.product_ids.length === 1 ? '' : 's'} ticked in their editor.` : 'You can also tick it on single products, in the product’s editor.'}</p>
      <label class="fd-chk"><input type="checkbox" ${X.active ? 'checked' : ''} onchange="_rp.panel.active=this.checked"> <b>On</b> <span class="fd-sm">(off: not shown on any product)</span></label></section>
    <section class="rp-card"><h4>Pictures <span class="fd-sm">(optional, shown in the pop-up)</span></h4>
      <div class="rp-pics">${(X.images || []).map((u, i) => `<figure><img src="${escAttr(u)}" alt=""><figcaption><button onclick="_rp.panel.images.splice(${i},1);rpDraw()" aria-label="Remove">×</button></figcaption></figure>`).join('')}
        <label class="rp-up">+ Add pictures<input type="file" accept="image/*" multiple onchange="rpPanelUpload(this)" hidden></label></div><p class="fd-sm" id="rp-pmsg"></p></section>
    <section class="rp-card rp-wide"><h4>What the pop-up says</h4>
      <textarea rows="12" placeholder="# Baking your Ditto creation&#10;Preheat the oven to …&#10;- Bake on a tray lined with parchment&#10;- …" ${set('body')}>${esc(X.body || '')}</textarea>
      <p class="fd-sm">Start a line with # for a heading or - for a bullet; a blank line starts a new paragraph.</p></section></div>
    <div class="rp-foot">${X.id ? '<button class="ho-btn" onclick="rpPanelDelete()">Delete panel</button>' : ''}<span class="spacer"></span><button class="ho-btn" onclick="_rp.panel=null;rpDraw()">Cancel</button><button class="ho-btn primary" onclick="rpPanelSave()">Save</button></div>`;
}
async function rpPanelUpload(inp) {
  const files = [...(inp.files || [])]; if (!files.length) return;
  const urls = await rpUploadFiles(files, 'panels', (k, n) => { const e = document.getElementById('rp-pmsg'); if (e) e.textContent = `Uploading ${k + 1} of ${n}…`; });
  _rp.panel.images.push(...urls.filter(Boolean)); rpDraw();
}
async function rpPanelSave() {
  const X = _rp.panel;
  const { error } = await sb.rpc('hub_retail_panel_save', { p: { id: X.id || null, name: X.name, label: X.label, body: X.body, images: X.images, tags: X.tags, product_ids: X.product_ids, active: X.active, sort: X.sort || 0 } });
  if (error) { alert('Not saved: ' + error.message); return; }
  _rp.panel = null; _rp.msg = `✓ Saved ${X.name}.`; await rpPanelsLoad();
}
async function rpPanelDelete() {
  const X = _rp.panel; if (!confirm(`Delete the “${X.name}” panel? It comes off every product.`)) return;
  const { error } = await sb.rpc('hub_retail_panel_delete', { p_id: X.id }); if (error) { alert(error.message); return; }
  _rp.panel = null; await rpPanelsLoad();
}
// In a product's editor: tick a panel on or off for this product (saved straight away)
async function rpPanelTick(panelId, on) {
  const E = _rp.edit; if (!E.id) { alert('Save the product first, then tick its info panels.'); rpDraw(); return; }
  const { error } = await sb.rpc('hub_retail_panel_product', { p_panel: panelId, p_product: E.id, p_on: on });
  if (error) { alert('Not saved: ' + error.message); return; }
  const x = (_rp.panels || []).find(y => y.id === panelId); if (x) { const s = new Set(x.product_ids || []); if (on) s.add(E.id); else s.delete(E.id); x.product_ids = [...s]; }
  rpDraw();
}
function rpEditPanelsHtml() {
  const E = _rp.edit, P = _rp.panels;
  if (!P) return '<section class="rp-card rp-wide"><h4>📄 Info panels</h4><p class="fd-sm">Loading…</p></section>';
  if (P.err || !P.length) return `<section class="rp-card rp-wide"><h4>📄 Info panels</h4><p class="fd-sm">${P.err ? esc(P.err) : 'No info panels yet. Make them with 📄 Info panels on the Products page.'}</p></section>`;
  return `<section class="rp-card rp-wide"><h4>📄 Info panels <span class="fd-sm">(links that open a pop-up on the product page)</span></h4>` +
    rpPanelsFor(E).map(z => `<label class="fd-chk"><input type="checkbox" ${z.byTag || z.ticked ? 'checked' : ''} ${z.byTag ? 'disabled' : ''} onchange="rpPanelTick('${z.x.id}',this.checked)">
      <span><b>${esc(z.x.label)}</b> <span class="fd-sm">${esc(z.x.name)}${z.byTag ? ` · on because it’s tagged “${esc(z.byTag)}”` : ''}${z.x.active ? '' : ' · panel is off'}</span></span></label>`).join('') + '</section>';
}

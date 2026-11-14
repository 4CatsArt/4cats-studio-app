// hub/print-library.js (Nov 14 2026; hub_print_library.sql): 🖨️ Print library. Studios download and print the current brochures and
// print-outs (Hub → Print library); home office uploads and manages them (Hub → 🎨 Marketing → Print library) and sees which studios
// have downloaded each. Files live in the public print-library storage folder.
(function () {
  const BUCKET = 'print-library', CATS = ['Brochures', 'Posters', 'Signs', 'Price lists', 'Flyers', 'Forms', 'Other'];
  const P = { list: null, cat: '', admin: null, edit: null, msg: '' };
  const url = path => path ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';
  const isImg = t => /^image\//.test(t || ''), isPdf = (t, n) => /pdf/.test(t || '') || /\.pdf$/i.test(n || '');
  const size = n => !n ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const day = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const stName = s => (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[s]) || s;
  const allStudios = () => typeof STUDIO_NAMES !== 'undefined' ? Object.keys(STUDIO_NAMES).filter(k => /^[A-Z]{2}-/.test(k)).sort() : [];
  const PROV = { BC: 'British Columbia', AB: 'Alberta', ON: 'Ontario' };
  function pane(id) {
    let el = document.getElementById(id); if (el) return el;
    el = document.createElement('main'); el.className = 'main'; el.id = id; el.style.display = 'none';
    const anchor = document.getElementById('mydash-pane') || document.querySelector('main.main');
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(el, anchor.nextSibling); else document.body.appendChild(el);
    if (typeof PANES !== 'undefined' && Array.isArray(PANES) && !PANES.includes(id)) PANES.push(id);
    return el;
  }
  const thumb = x => x.cover_path ? `<img src="${escAttr(url(x.cover_path))}" alt="" loading="lazy">` : isImg(x.file_type) ? `<img src="${escAttr(url(x.file_path))}" alt="" loading="lazy">`
    : `<span class="pl-ic">${isPdf(x.file_type, x.file_name) ? '📄' : '🗂️'}<b>${isPdf(x.file_type, x.file_name) ? 'PDF' : esc(String(x.file_name || '').split('.').pop().toUpperCase())}</b></span>`;

  // ---------- studios: current brochures and print-outs ----------
  window.openPrintPane = async function () {
    showOnlyPane('print-pane'); if (typeof setActiveNav === 'function') setActiveNav('nav-print');
    drawStudio(); const { data, error } = await sb.rpc('hub_print_list', { p_studio: (typeof _sessionStudioId !== 'undefined' && _sessionStudioId) || null });
    P.list = error ? { err: /hub_print_list/.test(error.message) && /function/i.test(error.message) ? 'The Print library isn’t set up yet.' : error.message } : (data || []); drawStudio();
  };
  function drawStudio() {
    const el = pane('print-pane'), L = P.list;
    let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🖨️ Print library</div></div><p class="fam-sub">The current brochures and print-outs for your studio. Download or print what you need.</p>`;
    if (L === null) h += '<div class="ho-card">Loading…</div>';
    else if (L.err) h += `<div class="ho-card">${esc(L.err)}</div>`;
    else if (!L.length) h += '<div class="ho-card">Nothing in the Print library right now.</div>';
    else {
      const cats = [...new Set(L.map(x => x.category))];
      h += cats.length > 1 ? `<div class="pl-cats"><button class="${P.cat ? '' : 'on'}" onclick="printCat('')">All</button>${cats.map(c => `<button class="${P.cat === c ? 'on' : ''}" onclick="printCat(${escAttr(JSON.stringify(c))})">${esc(c)}</button>`).join('')}</div>` : '';
      const fresh = x => Date.now() - new Date(x.created_at).getTime() < 14 * 864e5;
      h += '<div class="pl-grid">' + L.filter(x => !P.cat || x.category === P.cat).map(x => `<div class="pl-card">
        <a class="pl-thumb" href="${escAttr(url(x.file_path))}" target="_blank" rel="noopener" onclick="printDone('${escAttr(x.id)}')">${thumb(x)}${fresh(x) ? '<span class="pl-new">New</span>' : ''}</a>
        <div class="pl-body"><span class="pl-cat">${esc(x.category)}</span><b>${esc(x.title)}</b>${x.description ? `<p>${esc(x.description)}</p>` : ''}
        <span class="fd-sm">${esc(size(x.file_size))}${x.show_until ? ' · until ' + esc(day(x.show_until)) : ''}${x.downloaded ? ' · ✓ downloaded here' : ''}</span>
        <div class="pl-btns"><a class="ho-btn primary" href="${escAttr(url(x.file_path))}" download="${escAttr(x.file_name || x.title)}" onclick="printDone('${escAttr(x.id)}')">⬇ Download</a>
          <a class="ho-btn" href="${escAttr(url(x.file_path))}" target="_blank" rel="noopener" onclick="printDone('${escAttr(x.id)}')">🖨️ Print</a></div></div></div>`).join('') + '</div>';
    }
    el.innerHTML = h;
  }
  window.printCat = c => { P.cat = c; drawStudio(); };
  window.printDone = function (id) { sb.rpc('hub_print_downloaded', { p_id: id, p_studio: (typeof _sessionStudioId !== 'undefined' && _sessionStudioId) || null }).then(() => {}, () => {});
    const x = Array.isArray(P.list) && P.list.find(z => z.id === id); if (x && !x.downloaded) { x.downloaded = true; setTimeout(drawStudio, 400); } };

  // ---------- home office: upload and manage ----------
  window.openPrintAdmin = async function () { showOnlyPane('printadm-pane'); if (typeof setActiveNav === 'function') setActiveNav('nav-print-admin'); P.edit = null; drawAdmin(); await loadAdmin(); };
  async function loadAdmin() { const { data, error } = await sb.rpc('hub_print_admin_list'); P.admin = error ? { err: /hub_print_admin_list/.test(error.message) && /function/i.test(error.message) ? 'Run hub_print_library.sql in Supabase first.' : error.message } : (data || []); drawAdmin(); }
  function drawAdmin() {
    const el = pane('printadm-pane'), L = P.admin, n = allStudios().length;
    let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🖨️ Print library</div><span class="spacer"></span><button class="ho-btn primary" onclick="printEdit('new')">+ Add a print-out</button></div>
      <p class="fam-sub">Brochures and print-outs studios can download (Hub → Print library). Each shows to the studios you choose, between its dates.</p>${P.msg ? `<div class="me-msg">${esc(P.msg)}</div>` : ''}`;
    if (P.edit) h += editForm(P.edit);
    if (L === null) h += '<div class="ho-card">Loading…</div>';
    else if (L.err) h += `<div class="ho-card">${esc(L.err)}</div>`;
    else if (!L.length) h += '<div class="ho-card">Nothing yet: add your first brochure.</div>';
    else h += '<div class="pl-admin">' + L.map(x => { const D = x.downloads || [], aim = (x.studio_ids || []).length || n;
      const t = new Date().toISOString().slice(0, 10), live = x.active && (!x.show_from || x.show_from <= t) && (!x.show_until || x.show_until >= t);
      return `<div class="ho-card pl-row"><div class="pl-mini">${thumb(x)}</div><div class="pl-info"><b>${esc(x.title)}</b> <span class="pl-cat">${esc(x.category)}</span> ${live ? '<span class="pl-on">Showing</span>' : `<span class="pl-off">${x.active ? (x.show_from > t ? 'From ' + esc(day(x.show_from)) : 'Ended') : 'Switched off'}</span>`}
        <div class="fd-sm">${(x.studio_ids || []).length ? esc(x.studio_ids.length + ' studio' + (x.studio_ids.length === 1 ? '' : 's')) : 'All studios'}${x.show_from ? ' · from ' + esc(day(x.show_from)) : ''}${x.show_until ? ' · until ' + esc(day(x.show_until)) : ''} · ${esc(size(x.file_size))}</div>
        <details class="pl-dl"><summary>⬇ Downloaded by ${D.length} of ${aim} studio${aim === 1 ? '' : 's'}</summary><div class="fd-sm">${D.length ? D.map(d => `${esc(stName(d.studio_id))} (${esc(day(d.last_at))}${d.times > 1 ? ', ' + d.times + '×' : ''})`).join(' · ') : 'No one yet.'}
          ${(x.studio_ids || []).length || n ? '<br><b>Not yet:</b> ' + esc(((x.studio_ids || []).length ? x.studio_ids : allStudios()).filter(s => !D.some(d => d.studio_id === s)).map(stName).join(' · ') || 'none') : ''}</div></details></div>
        <div class="pl-act"><a class="ho-btn sm" href="${escAttr(url(x.file_path))}" target="_blank" rel="noopener">Open</a><button class="ho-btn sm" onclick="printEdit('${escAttr(x.id)}')">Edit</button><button class="ho-btn sm" onclick="printDel('${escAttr(x.id)}')">Delete</button></div></div>`; }).join('') + '</div>';
    el.innerHTML = h;
  }
  function editForm(E) {
    const S = allStudios(), on = new Set(E.studio_ids || []);
    const byProv = {}; S.forEach(s => (byProv[s.slice(0, 2)] = byProv[s.slice(0, 2)] || []).push(s));
    return `<div class="ho-card pl-form"><h3 style="margin:0 0 8px">${E.id ? 'Edit' : 'Add a print-out'}</h3>
      <label class="dash-set-row">File (PDF or picture) <input type="file" id="pl-file" accept=".pdf,image/*,.doc,.docx,.ppt,.pptx">${E.file_path ? ` <span class="fd-sm">now: ${esc(E.file_name || E.file_path)}</span>` : ''}</label>
      <label class="dash-set-row">Cover picture (optional, for a PDF) <input type="file" id="pl-cover" accept="image/*">${E.cover_path ? ' <span class="fd-sm">has one</span>' : ''}</label>
      <label class="dash-set-row">Title <input type="text" id="pl-title" maxlength="100" value="${escAttr(E.title || '')}" placeholder="e.g. Winter 2027 brochure"></label>
      <label class="dash-set-row">Category <select id="pl-cat">${CATS.map(c => `<option${(E.category || 'Brochures') === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="dash-set-row">Note for studios (optional) <input type="text" id="pl-desc" maxlength="200" value="${escAttr(E.description || '')}" placeholder="e.g. Print on 11×17, double-sided"></label>
      <div class="dash-set-row"><b>Which studios</b> <span class="fd-sm">(none ticked = every studio)</span><div class="pl-studios">${Object.keys(byProv).map(pv => `<div><label><input type="checkbox" data-plprov="${pv}"${byProv[pv].every(s => on.has(s)) ? ' checked' : ''}> <b>${esc(PROV[pv] || pv)}</b></label>${byProv[pv].map(s => `<label><input type="checkbox" data-plst="${s}"${on.has(s) ? ' checked' : ''}> ${esc(stName(s))}</label>`).join('')}</div>`).join('')}</div></div>
      <label class="dash-set-row">Show from <input type="date" id="pl-from" value="${escAttr(E.show_from || '')}"></label>
      <label class="dash-set-row">Until <input type="date" id="pl-until" value="${escAttr(E.show_until || '')}"> <span class="fd-sm">(empty = until you switch it off)</span></label>
      <label class="dash-set-row"><input type="checkbox" id="pl-active"${E.active === false ? '' : ' checked'}> Showing to studios</label>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="ho-btn primary" onclick="printSave()">Save</button><button class="ho-btn" onclick="printEdit(null)">Cancel</button><span class="fd-sm" id="pl-msg"></span></div></div>`;
  }
  window.printEdit = function (id) {
    P.msg = ''; P.edit = id === 'new' ? { studio_ids: [], active: true } : id ? JSON.parse(JSON.stringify((P.admin || []).find(x => x.id === id) || null)) : null; drawAdmin();
    const f = document.querySelector('.pl-form'); if (f) f.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  document.addEventListener('change', e => {   // a province's tick: all its studios
    const pv = e.target.closest && e.target.closest('[data-plprov]'); if (!pv) return;
    document.querySelectorAll(`[data-plst^="${pv.dataset.plprov}-"]`).forEach(c => { c.checked = pv.checked; });
  });
  async function up(file) {
    const safe = String(file.name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
    const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}/${safe}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error; return path;
  }
  window.printSave = async function () {
    const E = P.edit, msg = document.getElementById('pl-msg'), say = t => { if (msg) msg.textContent = t; };
    const f = document.getElementById('pl-file').files[0], c = document.getElementById('pl-cover').files[0];
    const rec = { id: E.id || null, title: document.getElementById('pl-title').value.trim(), category: document.getElementById('pl-cat').value, description: document.getElementById('pl-desc').value.trim(),
      studio_ids: [...document.querySelectorAll('[data-plst]:checked')].map(x => x.dataset.plst), show_from: document.getElementById('pl-from').value || null,
      show_until: document.getElementById('pl-until').value || null, active: document.getElementById('pl-active').checked, sort: E.sort || 0,
      file_path: E.file_path || '', file_name: E.file_name || '', file_type: E.file_type || '', file_size: E.file_size || null, cover_path: E.cover_path || '' };
    if (!rec.title) { say('Give it a title.'); return; }
    if (!f && !rec.file_path) { say('Choose the file.'); return; }
    if (rec.studio_ids.length === allStudios().length) rec.studio_ids = [];
    try {
      if (f) { say('Uploading the file…'); rec.file_path = await up(f); rec.file_name = f.name; rec.file_type = f.type; rec.file_size = f.size; }
      if (c) { say('Uploading the cover…'); rec.cover_path = await up(c); }
    } catch (e) { say('Didn’t upload: ' + (e.message || e)); return; }
    say('Saving…');
    const { error } = await sb.rpc('hub_print_save', { p: rec });
    if (error) { say('Not saved: ' + error.message); return; }
    P.edit = null; P.msg = '✓ Saved ' + rec.title + '.'; await loadAdmin();
  };
  window.printDel = async function (id) {
    const x = (P.admin || []).find(z => z.id === id); if (!x || !confirm('Delete “' + x.title + '” from the Print library? Studios won’t see it any more.')) return;
    const { data, error } = await sb.rpc('hub_print_delete', { p_id: id }); if (error) { alert('Not deleted: ' + error.message); return; }
    const files = [data && data.file_path, data && data.cover_path].filter(Boolean); if (files.length) sb.storage.from(BUCKET).remove(files).then(() => {}, () => {});
    P.msg = 'Deleted ' + x.title + '.'; await loadAdmin();
  };
  const css = document.createElement('style');
  css.textContent = `.pl-cats { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; } .pl-cats button { border: 1px solid #e3e0f3; background: #fff; border-radius: 999px; padding: 6px 14px; font: inherit; font-weight: 600; cursor: pointer; }
.pl-cats button.on { background: var(--accent, #4f3bd1); color: #fff; border-color: transparent; }
.pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; } .pl-card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); overflow: hidden; display: flex; flex-direction: column; }
.pl-thumb { position: relative; display: block; aspect-ratio: 4 / 3; background: #f4f2fb; } .pl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pl-ic { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; font-size: 44px; } .pl-ic b { font-size: 13px; color: #6b6890; margin-top: 4px; }
.pl-new { position: absolute; top: 8px; left: 8px; background: #e5484d; color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 800; }
.pl-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; flex: 1; } .pl-body p { margin: 0; font-size: 13px; color: #555; }
.pl-cat { display: inline-block; background: #efecfb; color: #4f3bd1; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 700; align-self: flex-start; }
.pl-btns { display: flex; gap: 6px; margin-top: auto; padding-top: 6px; } .pl-btns .ho-btn { text-decoration: none; }
.pl-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; } .pl-mini { width: 74px; height: 56px; flex: none; border-radius: 8px; overflow: hidden; background: #f4f2fb; } .pl-mini img { width: 100%; height: 100%; object-fit: cover; } .pl-mini .pl-ic { font-size: 24px; }
.pl-info { flex: 1; min-width: 0; } .pl-act { display: flex; gap: 6px; flex-wrap: wrap; } .pl-on { color: #1e7a45; font-weight: 700; font-size: 12px; } .pl-off { color: #8a6d00; font-weight: 700; font-size: 12px; }
.pl-dl summary { cursor: pointer; font-size: 13px; margin-top: 4px; } .pl-form .dash-set-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0; }
.pl-studios { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 16px; width: 100%; margin-top: 4px; } .pl-studios label { display: block; font-size: 13px; }`;
  document.head.appendChild(css);
})();

// hub/pic-library.js (Nov 14 2026): 🖼️ the Hub's picture library, for any picture upload: choose a picture already in 4Cats' storage
// instead of uploading again. hubPicPick(function (url) { … }) opens it; the picked picture's full web address comes back.
// It searches World pictures (world-banners), the Print library, theme banners and product photos (when Products has loaded them).
(function () {
  const BUCKETS = [['world-banners', 'World pictures'], ['print-library', 'Print library'], ['dashboard-theme-banners', 'Theme banners']];
  const LIB = { items: null, loading: null };
  const isPic = n => /\.(jpe?g|png|webp|gif|svg)$/i.test(n || '');
  async function load() {
    if (LIB.items) return LIB.items; if (LIB.loading) return LIB.loading;
    LIB.loading = (async () => {
      const items = [], seen = {};
      const add = (url, name, folder, at) => { if (!url || seen[url]) return; seen[url] = 1; items.push({ url, name: String(name || ''), folder, at: at || '' }); };
      try { (typeof _rp !== 'undefined' && _rp && _rp.rows || []).forEach(p => (p.images || []).forEach((u, i) => add(u, p.name + (i ? ' (' + (i + 1) + ')' : ''), 'Products', ''))); } catch (e) { }
      for (const [bucket, label] of BUCKETS) {
        const st = sb.storage.from(bucket);
        const walk = async (prefix, depth) => {
          for (let off = 0; off < 3000; off += 1000) {
            const r = await st.list(prefix, { limit: 1000, offset: off, sortBy: { column: 'created_at', order: 'desc' } });
            const L = (r && r.data) || [];
            for (const f of L) {
              const path = (prefix ? prefix + '/' : '') + f.name;
              if (!f.id && depth < 2) await walk(path, depth + 1);
              else if (f.id && isPic(f.name)) add(st.getPublicUrl(path).data.publicUrl, f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
                label + (prefix && bucket === 'world-banners' ? ' · ' + prefix.split('/')[0] : ''), f.created_at || '');
            }
            if (L.length < 1000) break;
          }
        };
        try { await walk('', 0); } catch (e) { console.warn('picture library:', bucket, e); }
      }
      items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      LIB.items = items; LIB.loading = null; return items;
    })();
    return LIB.loading;
  }
  window.hubPicReset = () => { LIB.items = null; };   // (after an upload, so it shows up next time)
  window.hubPicPick = function (onPick) {
    let box = document.getElementById('hub-lib');
    if (!box) { box = document.createElement('div'); box.id = 'hub-lib'; box.className = 'hub-lib'; document.body.appendChild(box); }
    const st = { q: '', folder: '' }; let items = [];
    box.innerHTML = `<div class="hub-lib-card" role="dialog" aria-label="Picture library"><div class="hub-lib-head"><b>🖼️ Choose a picture</b>
      <input type="search" placeholder="Search by name or folder" aria-label="Search pictures"><button type="button" class="ho-btn sm" data-libx>✕</button></div>
      <div class="hub-lib-chips"></div><div class="hub-lib-grid"><p class="fd-sm">Loading pictures…</p></div></div>`;
    box.hidden = false;
    const draw = () => {
      const folders = [...new Set(items.map(x => x.folder))], q = st.q.toLowerCase();
      const list = items.filter(x => (!st.folder || x.folder === st.folder) && (!q || (x.name + ' ' + x.folder).toLowerCase().includes(q)));
      box.querySelector('.hub-lib-chips').innerHTML = [`<button type="button" data-libf=""${!st.folder ? ' class="on"' : ''}>All (${items.length})</button>`]
        .concat(folders.map(f => `<button type="button" data-libf="${escAttr(f)}"${st.folder === f ? ' class="on"' : ''}>${esc(f)}</button>`)).join('');
      box.querySelector('.hub-lib-grid').innerHTML = list.length ? list.slice(0, 300).map(x => `<button type="button" class="hub-lib-pic" data-liburl="${escAttr(x.url)}" title="${escAttr(x.name)}"><img src="${escAttr(x.url)}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('') +
        (list.length > 300 ? `<p class="fd-sm">Showing 300 of ${list.length}: search to narrow it down.</p>` : '')
        : `<p class="fd-sm">${items.length ? 'Nothing matches.' : 'No pictures found yet.'}</p>`;
    };
    load().then(it => { items = it; draw(); });
    box.querySelector('input').addEventListener('input', e => { st.q = e.target.value; draw(); });
    box.onclick = e => {
      if (e.target === box || e.target.closest('[data-libx]')) { box.hidden = true; return; }
      const f = e.target.closest('[data-libf]'); if (f) { st.folder = f.dataset.libf; draw(); return; }
      const pk = e.target.closest('[data-liburl]'); if (pk) { box.hidden = true; onPick(pk.dataset.liburl); }
    };
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { box.hidden = true; document.removeEventListener('keydown', esc1); } });
    setTimeout(() => { const i = box.querySelector('input'); if (i) i.focus(); }, 30);
  };
  const css = document.createElement('style');
  css.textContent = `.hub-lib { position: fixed; inset: 0; z-index: 10000; background: rgba(20,16,40,.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
.hub-lib[hidden] { display: none; } .hub-lib-card { background: #fff; border-radius: 18px; width: min(980px, 100%); max-height: 88vh; display: flex; flex-direction: column; padding: 14px 16px; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.hub-lib-head { display: flex; gap: 10px; align-items: center; } .hub-lib-head input { flex: 1; padding: 8px 12px; border-radius: 10px; border: 1px solid #e3e0f3; font: inherit; }
.hub-lib-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; } .hub-lib-chips button { border: 1px solid #e3e0f3; background: #fff; border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.hub-lib-chips button.on { background: var(--accent, #4f3bd1); color: #fff; border-color: transparent; }
.hub-lib-grid { overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; padding-bottom: 4px; }
.hub-lib-pic { border: 2px solid transparent; background: #f6f4fc; border-radius: 12px; padding: 0; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; text-align: left; font: inherit; }
.hub-lib-pic:hover { border-color: var(--accent, #4f3bd1); } .hub-lib-pic img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: #eee; }
.hub-lib-pic span { font-size: 12px; padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;
  document.head.appendChild(css);
})();

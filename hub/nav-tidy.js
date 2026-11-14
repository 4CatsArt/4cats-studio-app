// hub/nav-tidy.js (Nov 13 2026): the sidebar, tidied. Home office items in folding sections (remembered), a 🔍 search box for admin
// users (anyone who can see Home office), and 📌 pinned items at the top (☆ on hover, remembered on this computer). It only moves the
// existing buttons, so each one keeps its own click and who-can-see-it rules; a section with nothing visible hides itself.
(function () {
  const SECTIONS = [
    ['mine', '⭐ Mine', ['nav-mydash', 'nav-cal', 'nav-ho-ann']],
    ['sched', '📅 Schedule & classes', ['nav-ct', 'nav-bulk', 'nav-sessions-table', 'nav-day-board', 'nav-as', 'nav-wsm', 'nav-curriculum', 'nav-camps']],
    ['ideas', '💡 Customer ideas', ['nav-ideas', 'nav-interest']],
    ['groups', '🎉 Parties & groups', ['nav-pb', 'nav-ft', 'nav-bo', 'nav-don']],
    ['shop', '🛍️ Shop', ['nav-rp', 'nav-sup']],
    ['memb', '⭐ Memberships', ['nav-memb', 'nav-mv']],
    ['staff', '👥 Staff', ['nav-stf', 'nav-sick', 'nav-swaps', 'nav-hist', 'nav-ts', 'nav-rules', 'nav-ack-ho', 'nav-concerns']],
    ['msgs', '📣 Messages', ['nav-announce', 'nav-sn', 'nav-se', 'nav-news', 'nav-snotes']],
    ['ops', '🏪 Studio operations', ['nav-oc-overview', 'nav-walkins', 'nav-devices', 'nav-act']],
  ];
  const OPEN_KEY = 'hub.navOpen', PIN_KEY = 'hub.navPins';
  const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const shown = el => !!el && el.style.display !== 'none' && !el.hidden;
  let built = false, syncing = false;

  function build() {
    const ho = document.getElementById('nav-group-homeoffice'); if (!ho || built) return; built = true;
    // "Announcements" in Home office is for sending them
    const ann = document.getElementById('nav-announce');
    if (ann) { const t = [...ann.childNodes].find(n => n.nodeType === 3 && /Announcements/.test(n.textContent)); if (t) t.textContent = ' Send announcements'; }
    const open = store(OPEN_KEY, { mine: true });
    const label = ho.querySelector('.nav-label');
    let after = label;
    SECTIONS.forEach(([key, name, ids]) => {
      const d = document.createElement('details'); d.className = 'nav-sec'; d.dataset.sec = key; if (open[key]) d.open = true;
      d.innerHTML = `<summary class="nav-sec-h">${name}<span class="nav-sec-n"></span></summary><div class="nav-sec-b"></div>`;
      const body = d.querySelector('.nav-sec-b');
      ids.forEach(id => { const el = document.getElementById(id); if (el) body.appendChild(el); });
      d.addEventListener('toggle', () => { if (syncing) return; const o = store(OPEN_KEY, {}); o[key] = d.open; save(OPEN_KEY, o); });
      after.after(d); after = d;
    });
    // pins and search
    const nav = ho.closest('nav') || ho.parentElement;
    const top = document.createElement('div'); top.className = 'nav-tools'; top.id = 'nav-tools';
    top.innerHTML = `<input type="search" id="nav-search" placeholder="🔍 Find a page…" autocomplete="off" aria-label="Find a page in the sidebar">` +
      `<div class="nav-group nav-pinned" id="nav-pinned"><div class="nav-label">📌 Pinned</div><div id="nav-pinned-b"></div></div>`;
    const first = nav.querySelector('.nav-group'); first.parentElement.insertBefore(top, first);
    document.getElementById('nav-search').addEventListener('input', search);
    document.getElementById('nav-search').addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.target.value = ''; search(); }
      if (e.key === 'Enter') { const hit = [...nav.querySelectorAll('.nav-item')].find(x => shown(x) && !x.classList.contains('nav-miss') && !x.closest('#nav-pinned')); if (hit) { hit.click(); e.target.value = ''; search(); } }
    });
    // ☆ on each item (Home office users)
    nav.querySelectorAll('.nav-item[id]').forEach(el => {
      if (el.closest('#nav-pinned')) return;
      const s = document.createElement('span'); s.className = 'nav-pin'; s.setAttribute('role', 'button'); s.title = 'Pin to the top'; s.textContent = '☆';
      s.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); togglePin(el.id); });
      el.appendChild(s);
    });
    new MutationObserver(() => { if (!syncing) requestAnimationFrame(sync); }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    sync();
  }
  function togglePin(id) { let P = store(PIN_KEY, []); P = P.includes(id) ? P.filter(x => x !== id) : P.concat(id); save(PIN_KEY, P); sync(); }
  function sync() {   // sections: hide the empty ones, show counts; pins; the tools only for Home office users
    syncing = true;
    try {
      const ho = document.getElementById('nav-group-homeoffice'), isHo = shown(ho);
      document.querySelectorAll('.nav-sec').forEach(d => { const n = [...d.querySelectorAll('.nav-sec-b > .nav-item')].filter(shown).length; d.style.display = n ? '' : 'none'; d.querySelector('.nav-sec-n').textContent = n; });
      const tools = document.getElementById('nav-tools'); if (tools) tools.style.display = isHo ? '' : 'none';
      const P = store(PIN_KEY, []), box = document.getElementById('nav-pinned-b'), wrap = document.getElementById('nav-pinned');
      if (box) {
        const items = P.map(id => document.getElementById(id)).filter(el => el && shown(el) && !el.closest('#nav-pinned'));
        box.innerHTML = items.map(el => { const ic = el.querySelector('.ic'), txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
          return `<button class="nav-item nav-pinned-item" data-pin-for="${el.id}"><span class="ic">${ic ? ic.textContent : '•'}</span> ${txt.replace(/[<>&]/g, '')}<span class="nav-pin on" role="button" title="Unpin" data-unpin="${el.id}">★</span></button>`; }).join('');
        box.querySelectorAll('[data-pin-for]').forEach(b => b.addEventListener('click', e => { if (e.target.closest('[data-unpin]')) { e.stopPropagation(); togglePin(b.dataset.pinFor); return; } document.getElementById(b.dataset.pinFor).click(); }));
        wrap.style.display = items.length && isHo ? '' : 'none';
        document.querySelectorAll('.nav-item[id] > .nav-pin').forEach(s => { const on = P.includes(s.parentElement.id); s.textContent = on ? '★' : '☆'; s.classList.toggle('on', on); s.title = on ? 'Unpin' : 'Pin to the top'; s.style.display = isHo ? '' : 'none'; });
      }
    } finally { setTimeout(() => { syncing = false; }, 0); }
  }
  function search() {   // matching items only; their sections open while searching
    const q = (document.getElementById('nav-search').value || '').trim().toLowerCase();
    const nav = document.getElementById('nav-search').closest('nav') || document.body;
    syncing = true;
    nav.querySelectorAll('.nav-item').forEach(el => { if (el.closest('#nav-pinned')) return; el.classList.toggle('nav-miss', !!q && !el.textContent.toLowerCase().replace(/[☆★]/g, '').includes(q)); });
    nav.querySelectorAll('.nav-sec').forEach(d => {
      if (q) { if (d.dataset.was === undefined) d.dataset.was = d.open ? '1' : ''; d.open = !![...d.querySelectorAll('.nav-sec-b > .nav-item')].some(el => shown(el) && !el.classList.contains('nav-miss')); }
      else if (d.dataset.was !== undefined) { d.open = d.dataset.was === '1'; delete d.dataset.was; }
      d.classList.toggle('nav-miss', !!q && !d.open);
    });
    nav.querySelectorAll('.nav-group').forEach(g => { if (g.id === 'nav-pinned') return; const any = [...g.querySelectorAll('.nav-item')].some(el => shown(el) && !el.classList.contains('nav-miss')); g.classList.toggle('nav-miss', !!q && !any); });
    setTimeout(() => { syncing = false; }, 0);
  }
  const css = document.createElement('style');
  css.textContent = `
.nav-tools { padding: 0 2px 6px; } #nav-search { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.08); color: #fff; padding: 8px 10px; font: inherit; font-size: 13px; margin-bottom: 8px; }
#nav-search::placeholder { color: rgba(255,255,255,.55); }
.nav-sec { margin: 0 0 2px; } .nav-sec-h { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; color: rgba(255,255,255,.82); font-size: 13px; font-weight: 700; }
.nav-sec-h::-webkit-details-marker { display: none; } .nav-sec-h::before { content: '▸'; font-size: 11px; opacity: .7; transition: transform .15s; } .nav-sec[open] > .nav-sec-h::before { transform: rotate(90deg); }
.nav-sec-h:hover { background: rgba(255,255,255,.06); } .nav-sec-n { margin-left: auto; font-size: 11px; opacity: .55; font-weight: 600; }
.nav-sec-b { display: flex; flex-direction: column; gap: 2px; padding-left: 10px; margin-bottom: 4px; }
.nav-item { position: relative; } .nav-pin { margin-left: auto; padding: 0 4px; opacity: 0; font-size: 14px; color: #ffd36b; cursor: pointer; } .nav-item:hover .nav-pin, .nav-pin.on { opacity: .9; }
.nav-item:focus-visible .nav-pin { opacity: .9; } .nav-pinned { margin-bottom: 8px; }
.nav-miss { display: none !important; }`;
  document.head.appendChild(css);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

// hub/update-check.js (Nov 14 2026): 🔄 "A new version of the Hub is ready". Every 5 minutes (and when the Hub comes back on screen)
// it fetches the latest hub.html and compares its file versions (the ?v= on each hub/*.js) with the ones running. If they differ:
// a banner with Update now / Later, and an automatic update when the screen has been idle for 10 minutes or overnight (2–5am),
// never in the middle of something (a Front desk cart or payment, an open pop-up, someone typing).
(function () {
  const sig = html => (String(html).match(/src="hub\/[a-z0-9_-]+\.js\?v=[^"]+"/gi) || []).sort().join('|');
  let mine = '';   // (read once the page has fully loaded: every file listed by then)
  let ready = false, laterUntil = 0, lastTouch = Date.now(), timer = null;
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(e => document.addEventListener(e, () => { lastTouch = Date.now(); }, { passive: true, capture: true }));
  function busy() {
    try {
      if (typeof _fd !== 'undefined' && _fd && ((_fd.cart && _fd.cart.length) || _fd.order || _fd.busy)) return true;   // (a Front desk sale in progress)
    } catch (e) { }
    if (document.getElementById('duty-sheet-back') || document.querySelector('.fd-sheet-back, dialog[open], .hub-lib:not([hidden])')) return true;   // (a pop-up open)
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(button|checkbox|radio)$/i.test(a.type || '')) return true;   // (someone typing)
    return false;
  }
  function update() { try { sessionStorage.setItem('hub.updatedAt', String(Date.now())); } catch (e) { } location.reload(); }
  function banner() {
    let b = document.getElementById('hub-update'); if (!ready || Date.now() < laterUntil) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('div'); b.id = 'hub-update'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>🔄 <b>A new version of the Hub is ready.</b> <span class="hu-sub">It updates by itself when the screen is quiet.</span></span><button type="button" class="hu-go">Update now</button><button type="button" class="hu-later">Later</button>';
    b.querySelector('.hu-go').onclick = () => { if (busy() && !confirm('Something is still open (a cart, payment or pop-up). Update anyway?')) return; update(); };
    b.querySelector('.hu-later').onclick = () => { laterUntil = Date.now() + 30 * 60 * 1000; b.remove(); };
    document.body.appendChild(b);
  }
  async function check() {
    if (!mine) mine = sig(document.documentElement.outerHTML);
    if (!mine) return;
    if (!ready) {
      try {
        const r = await fetch(location.pathname + '?update-check=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
        if (r.ok) { const s = sig(await r.text()); if (s && s !== mine) ready = true; }
      } catch (e) { /* offline: try again later */ }
    }
    if (!ready) return;
    banner();
    const h = new Date().getHours(), idle = Date.now() - lastTouch;
    if (!busy() && (idle >= 10 * 60 * 1000 || (h >= 2 && h < 5))) update();
  }
  function start() { clearInterval(timer); timer = setInterval(check, 5 * 60 * 1000); setTimeout(check, 30 * 1000); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.hubUpdateCheck = check;   // (for testing)
  const css = document.createElement('style');
  css.textContent = `#hub-update { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 9999; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  background: #1f1b3a; color: #fff; border-radius: 14px; padding: 10px 12px 10px 16px; box-shadow: 0 10px 30px rgba(0,0,0,.25); font-size: 14px; max-width: calc(100vw - 24px); }
#hub-update .hu-sub { opacity: .75; font-size: 12px; } #hub-update button { border: none; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
#hub-update .hu-go { background: #ffd36b; color: #1f1b3a; } #hub-update .hu-later { background: rgba(255,255,255,.15); color: #fff; }`;
  document.head.appendChild(css);
  if (document.readyState === 'complete') { mine = sig(document.documentElement.outerHTML); start(); }
  else window.addEventListener('load', () => { mine = sig(document.documentElement.outerHTML); start(); });
})();

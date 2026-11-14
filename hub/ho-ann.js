// hub/ho-ann.js (Nov 14 2026; hub_ho_announcements.sql): 📣 Announcements for home office. Everything showing at the studios now,
// with "Got it" recorded by name (studio reads stay as they are), an unread badge, and on Send announcements, who in home office
// has read each one.
(function () {
  let _ho = { list: null };
  const pane = document.createElement('main'); pane.className = 'main'; pane.id = 'hoann-pane'; pane.style.display = 'none';
  const anchor = document.getElementById('mydash-pane') || document.querySelector('main.main');
  if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(pane, anchor.nextSibling); else document.body.appendChild(pane);
  if (typeof PANES !== 'undefined' && Array.isArray(PANES) && !PANES.includes('hoann-pane')) PANES.push('hoann-pane');
  const day = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
  const myName = () => { try { return (typeof dashMyName === 'function' && dashMyName()) || ''; } catch (e) { return ''; } };
  const where = a => !a.studio_ids || !a.studio_ids.length ? 'All studios' : a.studio_ids.length > 3 ? a.studio_ids.length + ' studios'
    : a.studio_ids.map(s => (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[s]) || s).join(', ');

  async function load() {
    const { data, error } = await sb.rpc('hub_ho_ann_list');
    _ho.list = error ? { err: /hub_ho_ann_list/.test(error.message) && /function/i.test(error.message) ? 'Run hub_ho_announcements.sql in Supabase first.' : error.message } : (data || []);
    badge();
  }
  function badge() {
    const b = document.getElementById('ho-ann-badge'); if (!b) return;
    const n = Array.isArray(_ho.list) ? _ho.list.filter(a => !a.my_read_at).length : 0;
    b.textContent = n || ''; b.style.display = n ? '' : 'none';
  }
  function draw() {
    const L = _ho.list;
    let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">📣 Announcements</div></div>
      <p class="fam-sub">What the studios are seeing now. Tap <b>Got it</b> so it’s recorded that you’ve read it.</p>`;
    if (L === null) h += '<div class="ho-card">Loading…</div>';
    else if (L.err) h += `<div class="ho-card">${esc(L.err)}</div>`;
    else if (!L.length) h += '<div class="ho-card">Nothing showing right now.</div>';
    else h += L.map(a => `<div class="ho-card hoa-card${a.my_read_at ? ' read' : ''}"><div class="hoa-top"><b class="hoa-t">${a.priority === 'urgent' ? '🔴 ' : ''}${esc(a.title || '')}</b>
        <span class="fd-sm">${esc(where(a))} · ${esc(day(a.show_from))}${a.show_until ? ' – ' + esc(day(a.show_until)) : ''}</span></div>
        <div class="hoa-body">${esc(a.body || '').replace(/\n/g, '<br>')}</div>
        <div class="hoa-foot">${a.my_read_at ? `<span class="hoa-read">✓ You read it ${esc(day(a.my_read_at))}</span>` : `<button class="ho-btn primary" onclick="hoAnnAck('${escAttr(a.id)}', this)">Got it</button>`}</div></div>`).join('');
    pane.innerHTML = h;
  }
  window.openHoAnnPane = async function () {
    showOnlyPane('hoann-pane'); if (typeof setActiveNav === 'function') setActiveNav('nav-ho-ann');
    draw(); await load(); draw();
  };
  window.hoAnnAck = async function (id, btn) {
    if (btn) btn.disabled = true;
    const { data, error } = await sb.rpc('hub_ho_ann_ack', { p_id: id, p_name: myName() || null });
    if (error) { if (btn) btn.disabled = false; alert('Not recorded: ' + error.message); return; }
    const a = (_ho.list || []).find(x => x.id === id); if (a) a.my_read_at = data || new Date().toISOString();
    draw(); badge();
  };
  // Send announcements: who in home office has read each one (under each card)
  async function decorate() {
    const { data, error } = await sb.rpc('hub_ho_ann_readers'); if (error || !data) return;
    document.querySelectorAll('[id^="reach-"]').forEach(el => {
      const id = el.id.slice(6), P = data[id] || [], card = el.closest('.ho-card'); if (!card) return;
      let line = card.querySelector('.hoa-ho'); if (!line) { line = document.createElement('div'); line.className = 'hoa-ho fd-sm'; el.after(line); }
      line.innerHTML = '🏠 Home office read: ' + (P.length ? P.map(p => `<span title="${escAttr((p.email || '') + ' · ' + new Date(p.read_at).toLocaleString('en-CA'))}">${esc(p.name || p.email || '?')}</span>`).join(' · ') : '<i>no one yet</i>');
    });
  }
  if (typeof renderHoList === 'function') { const orig = renderHoList; window.renderHoList = function () { const r = orig.apply(this, arguments); decorate(); return r; }; }
  // the unread badge, once the Hub knows this is home office
  const ho = document.getElementById('nav-group-homeoffice');
  if (ho) { const seen = () => { if (ho.style.display !== 'none' && _ho.list === null) load(); }; new MutationObserver(seen).observe(ho, { attributes: true, attributeFilter: ['style'] }); seen(); }
  const css = document.createElement('style');
  css.textContent = `.hoa-card { margin-bottom: 10px; } .hoa-card.read { opacity: .75; } .hoa-top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; }
.hoa-t { font-size: 16px; } .hoa-body { margin: 8px 0 10px; line-height: 1.5; } .hoa-read { color: #2e7d4f; font-weight: 700; } .hoa-ho { margin-top: 6px; }
#ho-ann-badge { margin-left: auto; background: #e5484d; color: #fff; border-radius: 999px; font-size: 11px; font-weight: 800; padding: 1px 7px; }`;
  document.head.appendChild(css);
})();

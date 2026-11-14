// hub/studio-health.js (Nov 14 2026; studio_health.sql): 🩺 Studio health, a "how is my studio doing" page for coordinators (once
// home office switches it on) and admin. Dials and small trends, each green / yellow / red, in four parts: Studio health, Sales,
// Guest experience, Training. Measures not built yet show as "coming soon".
(function () {
  const H = { studio: null, data: null, set: null, err: '' };
  const G = '#22a06b', Y = '#e8a33c', R = '#e5484d', GREY = '#c9c6d8';
  const tone = (v, g, y, low) => v == null ? null : low ? (v <= g ? 'g' : v <= y ? 'y' : 'r') : (v >= g ? 'g' : v >= y ? 'y' : 'r');   // (low: smaller is better)
  const col = t => t === 'g' ? G : t === 'y' ? Y : t === 'r' ? R : GREY;
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  const money = n => '$' + Math.round(+n || 0).toLocaleString();
  const mon = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short' });
  const stName = s => (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[s]) || s;
  function pane() {
    let el = document.getElementById('health-pane'); if (el) return el;
    el = document.createElement('main'); el.className = 'main'; el.id = 'health-pane'; el.style.display = 'none';
    const a = document.getElementById('mydash-pane') || document.querySelector('main.main');
    if (a && a.parentElement) a.parentElement.insertBefore(el, a.nextSibling); else document.body.appendChild(el);
    if (typeof PANES !== 'undefined' && Array.isArray(PANES) && !PANES.includes('health-pane')) PANES.push('health-pane');
    return el;
  }
  // a half-circle dial: fill 0–100, its colour, the big number in the middle
  function dial(fill, t, big, size) {
    const w = size || 150, r = w / 2 - 12, cx = w / 2, cy = w / 2 + 2, f = Math.max(0, Math.min(100, fill == null ? 0 : fill));
    const arc = p => { const a = Math.PI * (1 - p / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    const [x0, y0] = arc(0), [x1, y1] = arc(f), [xe, ye] = arc(100);
    return `<svg class="sh-dial" viewBox="0 0 ${w} ${w / 2 + 14}" width="${w}" height="${w / 2 + 14}" aria-hidden="true">
      <path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${xe} ${ye}" fill="none" stroke="#eeecf6" stroke-width="12" stroke-linecap="round"/>
      ${f > 0 ? `<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${col(t)}" stroke-width="12" stroke-linecap="round"/>` : ''}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="sh-dial-n" fill="${t ? col(t) : '#9a97ad'}">${esc(big)}</text></svg>`;
  }
  // a small trend line (or bars)
  function spark(vals, t, opts) {
    const V = vals.map(v => v == null ? null : +v), ok = V.filter(v => v != null); if (ok.length < 2) return '';
    const w = 120, h = 34, mx = Math.max(...ok, (opts && opts.max) || 0), mn = Math.min(...ok, 0), sx = i => 4 + i * (w - 8) / (V.length - 1), sy = v => h - 4 - (v - mn) / ((mx - mn) || 1) * (h - 8);
    const pts = V.map((v, i) => v == null ? null : `${sx(i)},${sy(v)}`).filter(Boolean).join(' ');
    return `<svg class="sh-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col(t)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${V.map((v, i) => v == null ? '' : `<circle cx="${sx(i)}" cy="${sy(v)}" r="2.5" fill="${col(t)}"/>`).join('')}</svg>`;
  }
  function pctBars(rows) {   // each month as a % of the same month last year (no dollar amounts)
    const L = rows.map(r => ({ m: r.month, p: +r.last > 0 && r.this != null ? Math.round(+r.this / +r.last * 100) : null }));
    if (!L.some(x => x.p != null)) return '';
    const mx = Math.max(120, ...L.map(x => x.p || 0));
    return `<div class="sh-bars sh-pbars"><span class="sh-100" style="bottom:${Math.round(100 / mx * 50) + 14}px" title="100%: the same as last year"></span>${L.map(x => `<div class="sh-bar"><b>${x.p == null ? '—' : x.p + '%'}</b><div class="sh-bar-c"><i style="height:${x.p == null ? 0 : Math.max(3, Math.round(x.p / mx * 100))}%;background:${col(tone(x.p, 100, 90))}"></i></div><span>${mon(x.m)}</span></div>`).join('')}</div>`;
  }
  // every measure: { key, title, fill, t, big, line, good, extra }
  function measures(D) {
    const S = D.settings || {}, M = {};
    const p = D.punctuality || {}, pp = pct(p.on_time, p.punched);
    M.punctuality = { title: '⏰ Clocking in on time', fill: pp, t: tone(pp, 95, 85), big: pp == null ? '—' : pp + '%', line: p.punched ? `${p.on_time} of ${p.punched} shifts on time${p.no_punch ? ` · ${p.no_punch} with no clock-in` : ''}` : 'No shifts with clock-ins yet', good: 'Green: 95%+ within 5 min of the shift start', extra: spark((p.weeks || []).map(w => w.pct), tone(pp, 95, 85)) };
    const b = D.breaks || {}, bp = pct(b.on_time, b.breaks);
    M.breaks = { title: '☕ Breaks back on time', fill: bp, t: tone(bp, 90, 75), big: bp == null ? '—' : bp + '%', line: b.breaks ? `${b.on_time} of ${b.breaks} breaks back within 35 min · average ${b.avg_min} min` : 'No breaks clocked yet', good: 'Green: 90%+' };
    const oc = D.open_close || {}, miss = (oc.needed || 0) - (oc.done || 0), ocp = pct(oc.done, oc.needed);
    M.open_close = { title: '✅ Open & close lists', fill: ocp, t: oc.needed ? tone(miss, 0, 2, true) : null, big: oc.needed ? ocp + '%' : '—', line: oc.needed ? `${oc.done} of ${oc.needed} done${miss ? ` · ${miss} missed` : ''}` : 'No open days yet', good: 'Green: none missed · yellow: 1–2 · red: 3+',
      extra: (oc.missed || []).length ? `<div class="sh-miss">${oc.missed.slice(0, 4).map(x => `<span>${esc(new Date(x.day + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }))} ${x.list === 'open' ? 'opening' : 'closing'}</span>`).join('')}${oc.missed.length > 4 ? `<span>+${oc.missed.length - 4} more</span>` : ''}</div>` : '' };
    const pc = D.pace || {}, pv = pc.month_pace_pct == null ? null : Math.round(+pc.month_pace_pct);
    M.pace = { title: '🏁 At this pace', fill: pv == null ? null : Math.min(100, pv), t: tone(pv, 100, 80), big: pv == null ? '—' : pv + '%', line: pc.month_goal_pct != null ? `${Math.round(+pc.month_goal_pct)}% of this month’s goal so far` : 'No goal set for this month', good: 'Green: 100%+ of the pace to hit the goal' };
    const ly = D.vs_last_year || {}, want = ly.ly_month ? +ly.ly_month * +ly.share : null, lyp = want ? Math.round(+ly.mtd / want * 100) : null;
    M.vs_ly = { title: '📈 Vs last year', fill: lyp == null ? null : Math.min(100, lyp), t: tone(lyp, 100, 90), big: lyp == null ? '—' : lyp + '%', line: want ? `${lyp}% of last year’s sales for this point in the month` : 'No sales on file for this month last year', good: 'Green: 100%+ · yellow: 90–99% · the bars: each month vs last year',
      extra: (ly.months || []).length ? pctBars(ly.months) : '' };
    const f = D.flash || {}, fp = pct(f.done, f.total);
    M.flash = { title: '⚡ Flash challenges', fill: fp, t: f.total ? tone(fp, 80, 50) : null, big: f.total ? fp + '%' : '—', line: f.total ? `${f.done} of ${f.total} this month` : 'None this month', good: 'Green: 80%+ done' };
    const fill = (L, k, ttl, icon) => { const cur = (L || [])[0], fp2 = cur ? pct(cur.booked, cur.offered) : null;
      return { title: icon + ' ' + ttl, fill: fp2, t: cur && cur.offered ? tone(fp2, 70, 50) : null, big: fp2 == null ? '—' : fp2 + '%', line: cur && cur.offered ? `${cur.booked} of ${cur.offered} times booked in ${mon(cur.month)}` : 'No times offered this month', good: 'Green: 70%+ booked',
        extra: (L || []).length > 1 ? `<div class="sh-months">${L.map(x => `<span><b>${pct(x.booked, x.offered) ?? '—'}%</b>${mon(x.month)}</span>`).join('')}</div>` : '' }; };
    M.parties = fill(D.parties, 'parties', 'Parties booked', '🎉');
    M.get_togethers = fill(D.get_togethers, 'gt', 'Adult get-togethers', '🥂'); M.get_togethers.good += ' (promotional parties left out)';
    const kc = D.kids_classes || {}, kp = kc.last_year ? Math.round(kc.now / kc.last_year * 100) : null;
    M.kids = { title: '🧒 Kids classes', fill: kp == null ? null : Math.min(100, kp), t: kp == null ? null : tone(kp, 100, 90), big: kp == null ? String(kc.now || 0) : (kp >= 100 ? '+' : '') + (kp - 100) + '%', line: kp == null ? `${kc.now || 0} children enrolled (no classes on file for last year)` : `${kc.now} children enrolled · ${kc.last_year} this time last year`, good: 'Green: more than last year' };
    const at = D.art_turnaround || {}, ad = at.avg_days == null ? null : +at.avg_days;
    M.art = { title: '🏺 Artwork turnaround', fill: ad == null ? null : Math.max(5, 100 - ad / 21 * 100), t: tone(ad, 6.99, 14, true), big: ad == null ? '—' : ad + ' d', line: at.pieces ? `Average over ${at.pieces} pieces (last 60 days)${at.waiting_14 ? ` · ${at.waiting_14} waiting over 14 days` : ''}` : 'No pieces ready yet', good: 'Green: under 7 days · yellow: 7–14 · red: over 14' };
    const mm = D.moments || {}, goal = +S.moments_goal || 8, day = +String(D.today || '').slice(8, 10) || 1, dim = new Date(+String(D.today).slice(0, 4), +String(D.today).slice(5, 7), 0).getDate() || 30;
    const exp = goal * day / dim, mp = Math.round((mm.this_month || 0) / (exp || 1) * 100);
    M.moments = { title: '✨ Magical Moments', fill: Math.min(100, mp), t: tone(mp, 100, 50), big: String(mm.this_month || 0), line: `This month · goal ${goal} a month (${Math.round(exp)} by today)`, good: `Green: on track for ${goal}+ a month`, extra: spark((mm.months || []).map(x => x.n), tone(mp, 100, 50)) };
    const rt = D.returning || {}, rp = pct(rt.came_back, rt.families);
    M.returning = { title: '🔁 Families coming back', fill: rp, t: rt.families ? tone(rp, 40, 25) : null, big: rp == null ? '—' : rp + '%', line: rt.families ? `${rt.came_back} of ${rt.families} families booked again within 6 months` : 'Not enough bookings yet', good: 'Green: 40%+ · yellow: 25–39%' };
    const ty = D.thank_yous || {}, tp = pct(ty.on_time, ty.parties);
    M.thanks = { title: '💌 Party thank-yous', fill: tp, t: ty.parties ? tone(tp, 95, 80) : null, big: tp == null ? '—' : tp + '%', line: ty.parties ? `${ty.on_time} of ${ty.parties} sent within 2 days${ty.not_sent ? ` · ${ty.not_sent} not sent` : ''}` : 'No parties in the last 30 days', good: 'Green: 95%+ within 2 days' };
    const po = D.policies || {}, pop = pct(po.signed, po.total);
    M.policies = { title: '✍️ Policy sign-offs', fill: pop, t: po.total ? tone(pop, 100, 90) : null, big: po.total ? pop + '%' : '—', line: po.total ? `${po.signed} of ${po.total} signed${po.overdue ? ` · ${po.overdue} overdue` : ''}` : 'Nothing to sign right now', good: 'Green: everything signed' };
    return M;
  }
  const SOON = { health: ['📦 Inventory on track', '🗓️ Plan for the day', '🔪 Prep list', '📸 Photo checks'], sales: ['⭐ Membership visits', '🛒 Memberships sold in studio'],
    guest: ['⭐ Reviews', '🙋 Customers checked in', '🧳 Lost & damaged'], training: ['🎓 Training units', '🎬 Training videos & tests', '📝 Monthly training tests'] };
  const PARTS = [['health', '🏠 Studio health', ['punctuality', 'breaks', 'open_close']], ['sales', '💰 Sales performance', ['pace', 'vs_ly', 'flash', 'parties', 'get_togethers', 'kids']],
    ['guest', '💛 Guest experience', ['art', 'moments', 'returning', 'thanks']], ['training', '🎓 Training & knowledge', ['policies']]];
  const PTS = { g: 100, y: 60, r: 20 };
  function score(list) { const L = list.filter(m => m && m.t); if (!L.length) return null; return Math.round(L.reduce((t, m) => t + PTS[m.t], 0) / L.length); }
  function tile(m) {
    return `<div class="sh-tile ${m.t || 'none'}"><div class="sh-tile-h">${esc(m.title)}</div>${dial(m.fill, m.t, m.big, 140)}
      <div class="sh-line">${esc(m.line)}</div>${m.extra || ''}<div class="sh-good">${esc(m.good)}</div></div>`;
  }
  function draw() {
    const el = pane(), ho = typeof isHomeOfficeLogin === 'function' ? isHomeOfficeLogin() : !!document.getElementById('nav-group-homeoffice') && document.getElementById('nav-group-homeoffice').style.display !== 'none';
    const studios = typeof STUDIO_NAMES !== 'undefined' ? Object.keys(STUDIO_NAMES).filter(k => /^[A-Z]{2}-/.test(k)).sort((a, b) => stName(a).localeCompare(stName(b))) : [];
    let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🩺 Studio health</div><span class="spacer"></span>
      ${ho ? `<select class="sh-pick" onchange="healthPick(this.value)">${studios.map(s => `<option value="${s}"${s === H.studio ? ' selected' : ''}>${esc(stName(s))}</option>`).join('')}</select>` : ''}</div>
      <p class="fam-sub">How ${esc(stName(H.studio || ''))} is doing: mostly the last 30 days. 🟢 good · 🟡 not great · 🔴 needs attention.</p>`;
    if (ho && H.set) h += `<div class="sh-admin"><label><input type="checkbox" ${H.set.live ? 'checked' : ''} onchange="healthSet({live:this.checked})"> <b>Coordinators can see it</b> <span class="fd-sm">(their own studio, in the Coordinator part of the sidebar)</span></label>
      <label>Magical Moments goal a month <input type="number" min="1" value="${+H.set.moments_goal || 8}" style="width:70px" onchange="healthSet({moments_goal:+this.value})"></label><span class="fd-sm" id="sh-admin-msg"></span></div>`;
    if (H.err) { el.innerHTML = h + `<div class="ho-card">${esc(H.err)}</div>`; return; }
    if (!H.data) { el.innerHTML = h + '<div class="ho-card">Working it out…</div>'; return; }
    const M = measures(H.data), all = PARTS.flatMap(p => p[2].map(k => M[k])), ov = score(all), ot = ov == null ? null : ov >= 80 ? 'g' : ov >= 55 ? 'y' : 'r';
    const counts = { g: all.filter(m => m.t === 'g').length, y: all.filter(m => m.t === 'y').length, r: all.filter(m => m.t === 'r').length };
    h += `<div class="sh-top ${ot || 'none'}">${dial(ov, ot, ov == null ? '—' : String(ov), 220)}<div><div class="sh-top-t">${ot === 'g' ? 'Looking healthy! 🎉' : ot === 'y' ? 'Doing OK: a few things to work on' : ot === 'r' ? 'Needs attention' : 'Not enough to score yet'}</div>
      <div class="sh-counts"><span class="g">🟢 ${counts.g} good</span><span class="y">🟡 ${counts.y} not great</span><span class="r">🔴 ${counts.r} need attention</span></div>
      <div class="sh-parts">${PARTS.map(p => { const s = score(p[2].map(k => M[k])), t = s == null ? null : s >= 80 ? 'g' : s >= 55 ? 'y' : 'r'; return `<span class="${t || 'none'}"><b>${s == null ? '—' : s}</b>${esc(p[1])}</span>`; }).join('')}</div></div></div>`;
    h += PARTS.map(([key, title, ks]) => `<section class="sh-sec"><h2>${esc(title)}</h2><div class="sh-grid">${ks.map(k => tile(M[k])).join('')}
      ${(SOON[key] || []).map(t => `<div class="sh-tile soon"><div class="sh-tile-h">${esc(t)}</div><div class="sh-soon">Coming soon</div></div>`).join('')}</div></section>`).join('');
    el.innerHTML = h;
  }
  async function load() {
    H.data = null; H.err = ''; draw();
    const { data, error } = await sb.rpc('hub_studio_health', { p_studio: H.studio });
    if (error) H.err = /hub_studio_health/.test(error.message) && /function/i.test(error.message) ? 'Run studio_health.sql in Supabase first.' : error.message; else H.data = data;
    draw();
  }
  window.openHealthPane = async function (nav) {
    pane(); showOnlyPane('health-pane'); if (typeof setActiveNav === 'function') setActiveNav(nav || 'nav-health');
    if (!H.studio) H.studio = (typeof _sessionStudioId !== 'undefined' && _sessionStudioId) || 'BC-YYJ-OB';
    if (!H.set) { try { const { data } = await sb.rpc('hub_studio_health_settings'); H.set = data || null; } catch (e) { } }
    await load();
  };
  window.healthPick = s => { H.studio = s; load(); };
  window.healthSet = async function (p) {
    const { data, error } = await sb.rpc('hub_studio_health_set', { p });
    const m = document.getElementById('sh-admin-msg');
    if (error) { if (m) m.textContent = 'Not saved: ' + error.message; return; }
    H.set = data; if (m) m.textContent = 'Saved ✓'; coordNav(); if ('moments_goal' in p) load();
  };
  // the Coordinator part of the sidebar: only once "Coordinators can see it" is on
  async function coordNav() {
    const b = document.getElementById('nav-health-coord'); if (!b) return;
    if (!H.set) { try { const { data } = await sb.rpc('hub_studio_health_settings'); H.set = data || null; } catch (e) { } }
    b.style.display = H.set && H.set.live ? '' : 'none';
  }
  pane(); setTimeout(coordNav, 1500);
  const css = document.createElement('style');
  css.textContent = `.sh-pick { padding: 8px 12px; border-radius: 10px; border: 1px solid #ddd8ef; font: inherit; font-weight: 700; }
.sh-admin { display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: center; background: #fff7e6; border: 1px solid #f3dc9a; border-radius: 12px; padding: 10px 14px; margin: 0 0 14px; font-size: 14px; }
.sh-top { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; background: #fff; border-radius: 20px; padding: 18px 22px; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 18px; }
.sh-top.g { box-shadow: inset 6px 0 0 ${G}, 0 1px 3px rgba(0,0,0,.08); } .sh-top.y { box-shadow: inset 6px 0 0 ${Y}, 0 1px 3px rgba(0,0,0,.08); } .sh-top.r { box-shadow: inset 6px 0 0 ${R}, 0 1px 3px rgba(0,0,0,.08); }
.sh-top-t { font-size: 22px; font-weight: 800; margin-bottom: 8px; } .sh-counts { display: flex; gap: 14px; flex-wrap: wrap; font-weight: 700; font-size: 14px; margin-bottom: 10px; }
.sh-parts { display: flex; gap: 8px; flex-wrap: wrap; } .sh-parts span { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #f4f2fb; font-size: 13px; font-weight: 600; }
.sh-parts span b { font-size: 16px; } .sh-parts .g b { color: ${G}; } .sh-parts .y b { color: ${Y}; } .sh-parts .r b { color: ${R}; }
.sh-sec h2 { font-size: 18px; margin: 18px 0 10px; } .sh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.sh-tile { background: #fff; border-radius: 16px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; border-top: 5px solid ${GREY}; }
.sh-tile.g { border-top-color: ${G}; } .sh-tile.y { border-top-color: ${Y}; } .sh-tile.r { border-top-color: ${R}; }
.sh-tile.soon { background: #f7f6fb; box-shadow: none; border: 2px dashed #dcd9ea; justify-content: center; min-height: 150px; } .sh-soon { color: #9a97ad; font-weight: 700; font-size: 13px; }
.sh-tile-h { font-weight: 800; font-size: 14px; align-self: stretch; } .sh-dial-n { font-size: 26px; font-weight: 900; font-family: inherit; }
.sh-top .sh-dial-n { font-size: 40px; } .sh-line { font-size: 13px; color: #3d3a52; } .sh-good { font-size: 11px; color: #9a97ad; margin-top: auto; padding-top: 6px; }
.sh-miss, .sh-months { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; } .sh-miss span { background: #fdecec; color: #a12a2a; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 700; }
.sh-months span { display: flex; flex-direction: column; font-size: 11px; color: #6b6890; padding: 0 6px; } .sh-months b { color: #2b2840; font-size: 13px; }
.sh-bars { display: flex; gap: 6px; align-items: flex-end; height: 64px; margin-top: 4px; } .sh-bar { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; color: #6b6890; }
.sh-bar-c { display: flex; gap: 2px; align-items: flex-end; height: 50px; } .sh-bar-c i { width: 8px; border-radius: 3px 3px 0 0; display: block; min-height: 2px; }
.sh-pbars { position: relative; height: 82px; gap: 10px; } .sh-pbars .sh-bar b { font-size: 10px; color: #3d3a52; } .sh-pbars .sh-bar-c i { width: 16px; }
.sh-100 { position: absolute; left: 0; right: 0; border-top: 1.5px dashed #9a97ad; pointer-events: none; }
i.ty { background: #4f3bd1; } i.ly { background: #cfc9f0; } .sh-legend { display: flex; gap: 10px; font-size: 10px; color: #6b6890; } .sh-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 3px; }`;
  document.head.appendChild(css);
})();

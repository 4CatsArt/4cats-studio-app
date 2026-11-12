// hub/stats.js: the coordinator and studio stats cards. ⭐ Points, week info bar, suggested marketing emails, 📊 fill rates
// (Friday event, occupancy), kids parties and team building, sales goals, 📷 Instagram, daily check-ins, the weather card,
// ⚡ Flash Challenges and 📣 Influencer posts. Moved out of hub.html as-is (Nov 12 2026). Loaded by hub.html after its main script.

// ---------- Coordinator Points (coordinator view) ----------

async function fetchPointsData(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-points-data`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ pin, studioId })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadPoints(pin, studioId) {
  const el = document.getElementById('card-points');
  if (!el) return;
  try {
    renderPointsCard(await fetchPointsData(pin, studioId));
  } catch (e) {
    console.error('Points load failed:', e);
    el.innerHTML = `<div class="pts-empty">Points couldn't load right now.</div>`;
  }
}

const fmtPts = n => Number(n || 0).toLocaleString('en-US');

// The "My Points" page (sidebar → ⭐ My Points, coordinator view only).
function renderPointsCard(d) {
  _lastPointsData = d;
  const el = document.getElementById('card-points');
  if (!el) return;
  const studioName = STUDIO_NAMES[d.studioId] || d.studioId;
  const bar = document.getElementById('points-bar');
  if (bar) bar.innerHTML = `<span>${d.level === 'admin' ? '👁️ Admin view (read-only)' : '🔓 Coordinator view'} · <span class="who">${esc(studioName)}</span></span>
      <span class="spacer"></span><button onclick="goToDashboard()">← Dashboard</button><button onclick="endCoordinatorView()">🔒 Lock</button>`;

  // Ways to earn, grouped by category (category order from home office).
  const cats = d.categories || [];
  const catName = code => { const c = cats.find(x => x.code === code); return c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : 'Other'; };
  const catOrder = code => { const i = cats.findIndex(x => x.code === code); return i < 0 ? 999 : i; };
  const waysSorted = (d.waysToEarn || []).slice().sort((a, b) => catOrder(a.category) - catOrder(b.category));
  // The three mentoring steps are one project: shown together as a single
  // block (heading + total, then the steps numbered in order).
  const MENTOR_ORDER = ['mentoring_calls', 'mentoring_actions', 'mentoring_goal'];
  const mentorSteps = waysSorted.filter(w => w.mentorship).sort((a, b) => MENTOR_ORDER.indexOf(a.code) - MENTOR_ORDER.indexOf(b.code));
  const stepPts = w => w.points != null ? Number(w.points) : Number(String(w.how || '').replace(/[^0-9]/g, '')) || 0;
  const mentorBlock = mentorSteps.length ? `
      <div class="pts-project">
        <div class="pts-project-head">
          <span>🤝 Mentor another studio's coordinator</span>
          <span class="how">up to ${fmtPts(mentorSteps.reduce((t, w) => t + stepPts(w), 0))} per mentorship</span>
        </div>
        ${mentorSteps.map((w, i) => `
          <div class="pts-row pts-step"><span><span class="pts-step-num">${i + 1}</span>${esc(String(w.name).replace(/^Mentoring:\s*/i, '').replace(/^./, c => c.toUpperCase()))}</span>
            <span class="how">${fmtPts(stepPts(w))}</span></div>`).join('')}
      </div>` : '';

  let lastCat;
  let mentorShown = false;
  const ways = waysSorted.map(w => {
    const head = (cats.length && w.category !== lastCat) ? `<div class="pts-subhead" style="margin:12px 0 4px">${esc(catName(w.category))}</div>` : '';
    lastCat = w.category;
    if (w.mentorship) {
      if (mentorShown) return head;
      mentorShown = true;
      return head + mentorBlock;
    }
    return head + `
      <div class="pts-row"><span>${esc(w.name)}</span><span class="how">${esc(w.how)}${w.manual ? ' · added by home office' : ''}</span></div>`;
  }).join('') || `<div class="pts-empty">No ways to earn are switched on yet.</div>`;

  // This month by category
  const byCat = d.monthByCategory || {};
  const catKeys = Object.keys(byCat).filter(k => byCat[k]).sort((a, b) => catOrder(a) - catOrder(b));
  const monthByCatHtml = catKeys.length ? `<div class="card"><div class="pts-subhead">📊 ${esc(d.monthLabel || 'This month')} by category</div>${catKeys.map(k =>
    `<div class="pts-row"><span>${esc(k === 'other' ? 'Adjustments and other' : catName(k))}</span><span class="amt ${byCat[k] > 0 ? 'plus' : 'minus'}">${byCat[k] > 0 ? '+' : ''}${fmtPts(byCat[k])}</span></div>`).join('')}</div>` : '';

  // Mentorships (mentor or mentee). The mentee confirms steps; home office approves.
  const STEP_LABEL = { calls: 'All four calls completed', actions: 'Agreed actions completed', goal: '30-day goal reached' };
  const STEP_STATUS = { pending: 'Not confirmed yet', confirmed: 'Waiting for home office', approved: 'Approved', returned: 'Sent back — see note' };
  const fmtDay = ymd => ymd ? new Date(ymd + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
  const mentorshipsHtml = (d.mentorships || []).map(m => {
    const other = m.role === 'mentor' ? m.mentee : m.mentor;
    const otherLabel = other ? `${STUDIO_NAMES[other.studioId] || other.studioId}${other.name ? ' · ' + other.name : ''}` : '';
    const steps = (m.steps || []).map(st => {
      const icon = st.status === 'approved' ? '✅' : st.status === 'confirmed' ? '🟡' : st.status === 'returned' ? '↩️' : '⬜';
      const canConfirm = m.role === 'mentee' && m.status === 'active' && d.canRedeem && (st.status === 'pending' || st.status === 'returned');
      return `<div class="pts-row" style="align-items:flex-start">
          <span>${icon} ${esc(STEP_LABEL[st.step] || st.step)}${m.role === 'mentor' && st.points ? ` <span class="how">· ${fmtPts(st.points)} pts</span>` : ''}
            <div class="how" style="text-align:left">${esc(STEP_STATUS[st.status] || st.status)}${st.reviewNote && st.status === 'returned' ? ' — ' + esc(st.reviewNote) : ''}${st.confirmNote && st.status !== 'returned' ? ' — “' + esc(st.confirmNote) + '”' : ''}</div></span>
          ${canConfirm ? `<button class="btn-confirm" onclick="confirmMentorshipStep('${esc(m.id)}','${esc(st.step)}')">Confirm</button>` : ''}
        </div>`;
    }).join('');
    return `<div class="card">
        <div class="pts-subhead">${m.role === 'mentor' ? '🎓 You are mentoring' : '🎓 You are being mentored by'} ${esc(otherLabel)}${m.status !== 'active' ? ' · ' + esc(m.status) : ''}</div>
        <div style="font-weight:800;margin:2px 0">🎯 ${esc(m.goalDetail || '')}</div>
        ${m.agreedActions ? `<div class="goal-note">Agreed actions: ${esc(m.agreedActions)}</div>` : ''}
        <div class="goal-note">Calls by ${esc(fmtDay(m.callsEndDate))} · goal by ${esc(fmtDay(m.goalDate))}</div>
        ${m.role === 'mentee' && m.status === 'active' ? `<div class="goal-note">When a step is done, tap <strong>Confirm</strong> and say how it was verified (dashboard numbers, certification or your coordinator). Home office approves it.</div>` : ''}
        <div style="margin-top:8px">${steps}</div>
      </div>`;
  }).join('');

  // Prize TIERS on the page; each tier's prizes open in a pop-up
  // (openPrizeTier). Requests: SC only; points come off right away, home office
  // approves it, cancelling gives the points back.
  const wallet = d.noCoordinator ? 0 : d.wallet;
  const tierCards = (d.prizeTiers || []).map((t, i) => {
    const n = (t.prizes || []).length;
    const pct = t.cost ? Math.max(0, Math.min(100, Math.round(wallet / t.cost * 100))) : 0;
    const reached = !d.noCoordinator && wallet >= t.cost;
    return `<button type="button" class="pts-tier-card${reached ? ' reached' : ''}" onclick="openPrizeTier(${i})">
        <div class="tc-name">${esc(t.name)}</div>
        <div class="tc-cost">${fmtPts(t.cost)} pts</div>
        ${d.noCoordinator ? '' : `<div class="progress-track" style="margin:8px 0 4px"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="tc-sub">${reached ? '✓ You can redeem from this tier' : `${fmtPts(t.cost - wallet)} to go`}</div>`}
        <div class="tc-link">${n ? `See ${n} prize${n === 1 ? '' : 's'} →` : 'More prizes coming soon'}</div>
      </button>`;
  }).join('') || `<div class="pts-empty">No prize tiers yet — home office is setting them up.</div>`;
  const prizeCards = `<div class="pts-tier-grid">${tierCards}</div>`;

  const requests = (d.redemptions || []).map(r => `
      <div class="pts-row"><span>${esc(r.prize)} <span class="pts-status ${esc(r.status)}">${esc(r.status)}</span></span>
        <span class="amt minus">−${fmtPts(r.cost)}</span></div>`).join('');

  const lb = d.leaderboard || { top: [] };
  const lbMax = Math.max(1, ...(lb.top || []).map(r => r.points));
  const lbRow = r => `
      <div class="sglb-row${r.isYou ? ' you' : ''}">
        ${r.rank <= 3 ? `<div class="sglb-rank">${LB_MEDALS[r.rank - 1]}</div>` : `<div class="sglb-rank num">#${r.rank}</div>`}
        <div class="sglb-name">${esc(STUDIO_NAMES[r.studioId] || r.studioId)}${r.isYou ? '<span class="sglb-you-tag">YOU</span>' : ''}</div>
        <div class="sglb-bar"><div style="width:${Math.round(r.points / lbMax * 100)}%"></div></div>
        <div class="sglb-pct">${fmtPts(r.points)}</div>
      </div>`;
  const lbHtml = (lb.top || []).length ? `
    <div class="card">
      <div class="sglb" style="margin-top:0;border-top:none;padding-top:0">
        <div class="sglb-head"><div class="sglb-title">🏆 Top Studios — points this month</div></div>
        ${lb.top.map(lbRow).join('')}
        ${lb.you ? `<div class="sglb-gap">···</div>` + lbRow(Object.assign({}, lb.you, { isYou: true })) : ''}
        <div class="sglb-foot">Points earned this month · ${lb.totalStudios} studio${lb.totalStudios === 1 ? '' : 's'} with a coordinator</div>
      </div>
    </div>` : '';

  const title = `<div class="pts-page-title">⭐ My Points — ${esc(studioName)}</div>`;
  if (d.noCoordinator) {
    el.innerHTML = title + `<div class="card"><div class="pts-empty">No coordinator is assigned to this studio right now, so there's no wallet to show.</div></div>
      <div class="section-head pts-section">🎁 Prize tiers</div>${prizeCards}
      <div class="section-head pts-section">✨ Ways to earn</div><div class="card">${ways}</div>` + lbHtml;
    return;
  }

  const levelHtml = d.coordinatorLevel ? `<span class="pts-level">${esc(d.coordinatorLevel.emoji || '')} ${esc(d.coordinatorLevel.name)}</span>` : '';
  const nextLevelNote = d.nextLevel ? `<div class="goal-note">${fmtPts(d.nextLevel.toGo)} to ${esc(d.nextLevel.emoji || '')} ${esc(d.nextLevel.name)}</div>` : '';
  const nextPrizeHtml = d.nextPrize ? (() => {
    const pct = Math.max(0, Math.min(100, Math.round(d.wallet / d.nextPrize.cost * 100)));
    return `<div class="card"><div class="eyebrow">🎁 Next prize — ${esc(d.nextPrize.name)}</div>
      <div class="progress-track" style="margin:8px 0"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-note">${fmtPts(d.wallet)} of ${fmtPts(d.nextPrize.cost)} points · ${fmtPts(d.nextPrize.toGo)} to go</div></div>`;
  })() : '';
  const waitHtml = (d.waiting || []).map(w =>
    `<div class="pts-wait">⏳ ${esc(w.name)} points start in ${esc(w.startsLabel)} — new coordinators have a short waiting period while bookings made before they started play out.</div>`).join('');
  const recent = (d.recent || []).slice(0, 12).map(e => `
      <div class="pts-row"><span>${esc(e.label)}</span><span class="amt ${e.points > 0 ? 'plus' : 'minus'}">${e.points > 0 ? '+' : ''}${fmtPts(e.points)}</span></div>`).join('')
    || `<div class="pts-empty">No points yet — Friday fill points arrive each Saturday morning, and party and team building points on the 2nd of each month.</div>`;

  el.innerHTML = title + `
    <div class="pts-stats">
      <div class="pts-tile"><div class="eyebrow">⭐ Wallet — ready to spend</div><div class="pts-big">${fmtPts(d.wallet)}</div></div>
      <div class="pts-tile plain"><div class="eyebrow">📈 Earned in ${esc(d.monthLabel)}</div><div class="pts-big">${fmtPts(d.thisMonth)}</div></div>
      <div class="pts-tile plain"><div class="eyebrow">🏅 Lifetime earned</div><div class="pts-big">${fmtPts(d.lifetime)}</div>${levelHtml}${nextLevelNote}</div>
    </div>
    ${waitHtml}
    ${nextPrizeHtml}
    <div class="section-head pts-section">🎁 Prize tiers</div>
    ${prizeCards}
    ${monthByCatHtml}
    ${mentorshipsHtml ? `<div class="section-head pts-section">🎓 Mentoring</div>${mentorshipsHtml}` : ''}
    ${requests ? `<div class="section-head pts-section">📦 My prize requests</div><div class="card">${requests}</div>` : ''}
    <div class="pts-cols" style="margin-top:18px">
      <div class="card"><div class="pts-subhead">✨ Ways to earn</div>${ways}</div>
      <div class="card"><div class="pts-subhead">🧾 Recent points</div>${recent}</div>
    </div>
    ${lbHtml}`;
}

let _lastPointsData = null;

// Mentee confirms a mentorship step (home office then approves it).
async function confirmMentorshipStep(mentorshipId, step) {
  const labels = { calls: 'All four calls completed', actions: 'Agreed actions completed', goal: '30-day goal reached' };
  const note = prompt(`Confirm "${labels[step] || step}".\n\nHow was it verified? (e.g. dashboard numbers, certification passed, or your coordinator confirmed)`);
  if (note === null) return;
  if (!note.trim()) { alert('Please say how it was verified.'); return; }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/community-points-data`, {
      method: 'POST',
      headers: await fnHeaders(),
      body: JSON.stringify({ pin: _sessionPin, studioId: _sessionStudioId, action: 'confirm_mentorship_step', mentorshipId, step, note: note.trim() })
    });
    const out = await res.json();
    if (!res.ok || out.error) throw new Error(out.error || 'Could not confirm');
    alert('Confirmed — home office will review it.');
  } catch (e) {
    alert(e.message || 'Could not confirm that step.');
  }
  loadPoints(_sessionPin, _sessionStudioId);
}

// One tier's prizes, in a pop-up. More prizes get added over time, so the
// pop-up always says so.
function openPrizeTier(i) {
  const d = _lastPointsData;
  const t = d && (d.prizeTiers || [])[i];
  if (!t) return;
  const wallet = d.noCoordinator ? 0 : d.wallet;
  const prizes = t.prizes || [];
  const cards = prizes.map(p => {
    const cost = p.cost != null ? p.cost : t.cost; // a prize can have its own points
    const afford = wallet >= cost;
    const btn = !d.canRedeem ? `<button disabled>${d.level === 'admin' ? 'SC requests here' : 'Request'}</button>`
      : !p.inStock ? `<button disabled>Out of stock</button>`
      : afford ? `<button onclick="requestPrize('${esc(p.id)}')">Request</button>`
      : `<button disabled>${fmtPts(cost - wallet)} more to go</button>`;
    return `<div class="pts-prize${afford && p.inStock && d.canRedeem ? ' can' : ''}">
        ${p.imageUrl ? `<img src="${escAttr(p.imageUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-cost">${fmtPts(cost)} pts</div>
        ${p.description ? `<div class="p-desc">${esc(p.description)}</div>` : ''}
        ${btn}
      </div>`;
  }).join('');
  document.getElementById('prize-modal-title').innerHTML = `🎁 ${esc(t.name)} <span class="pm-cost">${fmtPts(t.cost)} pts</span>`;
  document.getElementById('prize-modal-body').innerHTML =
    (cards ? `<div class="pts-prize-grid">${cards}</div>` : '') +
    `<div class="pm-soon">✨ More prizes will be added soon — keep earning!</div>`;
  document.getElementById('prize-modal').style.display = 'flex';
}
function closePrizeModal() {
  document.getElementById('prize-modal').style.display = 'none';
}

async function requestPrize(prizeId) {
  const d = _lastPointsData;
  const tier = d && (d.prizeTiers || []).find(t => (t.prizes || []).some(p => p.id === prizeId));
  const prize = tier && tier.prizes.find(p => p.id === prizeId);
  if (!prize || !_sessionPin) return;
  closePrizeModal();
  if (!confirm(`Request "${prize.name}" for ${fmtPts(prize.cost != null ? prize.cost : tier.cost)} points?\n\nThe points come off your wallet now. Home office will confirm it — if it's cancelled, you get the points back.`)) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/community-points-data`, {
      method: 'POST',
      headers: await fnHeaders(),
      body: JSON.stringify({ pin: _sessionPin, studioId: _sessionStudioId, action: 'redeem', prizeId })
    });
    const out = await res.json();
    if (!res.ok || out.error) throw new Error(out.error || 'Request failed');
    alert(`Requested! "${prize.name}" is now waiting for home office.`);
  } catch (e) {
    alert(e.message || 'Could not request that prize.');
  }
  loadPoints(_sessionPin, _sessionStudioId);
}

function coordinatorPaneBar(barId) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const studioName = STUDIO_NAMES[_sessionStudioId] || _sessionStudioId || '';
  bar.innerHTML = `<span>${_viewLevel === 'admin' ? '👁️ Admin view' : '🔓 Coordinator view'} · <span class="who">${esc(studioName)}</span></span>
      <span class="spacer"></span><button onclick="goToDashboard()">← Dashboard</button><button onclick="endCoordinatorView()">🔒 Lock</button>`;
}

// Sidebar → 📊 Fill Rates (own studio).
let _occStrip = null; // the first load: past 14 days + today + next 7 (for the day tiles)
function occTime12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  if (!m) return hhmm || '';
  let h = parseInt(m[1], 10) % 24;
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m[2] === '00' ? `${h}${ap}` : `${h}:${m[2]}${ap}`;
}
// Same colours as admin's Fill Rates tab — busier = greener.
function occColor(pct) {
  if (pct == null) return '#fff';
  if (pct >= 50) return '#6cc584';
  if (pct >= 35) return '#a9dfb7';
  if (pct >= 20) return '#dcf2e1';
  if (pct >= 10) return '#fdf0cf';
  return '#fbe3e1';
}
function occLocalToday() { return localDateStr(new Date()); }
async function fetchOccupancy(date) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-occupancy-data`, {
    method: 'POST', headers: await fnHeaders(),
    body: JSON.stringify({ pin: _sessionPin, studioId: _sessionStudioId, date })
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Request failed');
  return d;
}
async function openOccupancy() {
  if (!_sessionPin) { openPinModal(); return; }
  showOnlyPane('occupancy-pane');
  setActiveNav('nav-occupancy');
  coordinatorPaneBar('occupancy-bar');
  document.getElementById('occ-title').textContent = `📊 Fill Rates — ${STUDIO_NAMES[_sessionStudioId] || _sessionStudioId}`;
  const daysEl = document.getElementById('occ-days');
  daysEl.innerHTML = `<div class="goal-note">Loading…</div>`;
  document.getElementById('occ-detail').innerHTML = '';
  try {
    const today = occLocalToday();
    const d = await fetchOccupancy(today);
    _occStrip = d;
    renderOccupancyDays();
    renderOccupancyDay(today, d);
  } catch (e) {
    console.error('Fill rates load failed:', e);
    daysEl.innerHTML = `<div class="goal-note">Fill rates couldn't load right now.</div>`;
  }
}
// Calendar of days (Sun–Sat rows): the last 2 weeks, today, and the next 7
// days (booked so far). Days outside that range are left blank.
function renderOccupancyDays() {
  const d = _occStrip; if (!d) return;
  const t = d.today || {};
  // No floor plan (0 seats) → there's nothing to measure against. Say so
  // instead of showing 0% everywhere; days can still be tapped to see bookings.
  if (!(Number(t.seats) > 0)) {
    const studioName = STUDIO_NAMES[_sessionStudioId] || _sessionStudioId || 'This studio';
    document.getElementById('occ-days').innerHTML = `
      <div class="occ-noplan">🪑 <strong>${esc(studioName)} doesn't have a floor plan yet</strong>, so fill rates can't be worked out —
        there are no seats to measure against. Once home office sets up its tables (admin → Floor Plans), fill rates appear here
        for every day, including past ones.</div>
      <div class="goal-note" style="margin-top:8px">Bookings for the selected day are still listed below.</div>`;
    return;
  }
  const todayRow = { day: d.date, is_open: t.is_open, utilization_pct: t.utilization_pct, peak_pct: t.peak_pct, seats: t.seats };
  const byDay = {};
  [...(d.days || []), todayRow].forEach(r => { if (r && r.day) byDay[r.day] = r; });
  const known = Object.keys(byDay).sort();
  if (!known.length) { document.getElementById('occ-days').innerHTML = `<div class="goal-note">No days to show yet.</div>`; return; }

  const ymd = dt => localDateStr(dt);
  const first = new Date(known[0] + 'T12:00:00'), last = new Date(known[known.length - 1] + 'T12:00:00');
  first.setDate(first.getDate() - first.getDay());          // back to Sunday
  last.setDate(last.getDate() + (6 - last.getDay()));        // forward to Saturday

  const cell = day => {
    const r = byDay[day];
    const dt = new Date(day + 'T12:00:00');
    const num = dt.getDate();
    const monthTag = num === 1 || day === known[0] ? dt.toLocaleDateString('en-CA', { month: 'short' }) + ' ' : '';
    if (!r) return `<div class="occ-cell out"><div class="oc-date">${esc(monthTag)}${num}</div></div>`;
    const isToday = day === d.date, future = day > d.date;
    const cls = `occ-cell${isToday ? ' today' : ''}${future ? ' future' : ''}`;
    if (!r.is_open) return `<div class="${cls} closed"><div class="oc-date">${esc(monthTag)}${num}</div><div class="oc-pct">—</div><div class="oc-sub">nothing on</div></div>`;
    const occ = Number(r.utilization_pct || 0), peak = Number(r.peak_pct || 0);
    return `<button type="button" class="${cls}" style="background:${occColor(occ)}" onclick="showOccupancyDay('${esc(day)}')">
        <div class="oc-date">${esc(monthTag)}${num}${isToday ? ' · today' : ''}</div>
        <div class="oc-pct">${occ.toFixed(0)}%</div>
        <div class="oc-sub">busiest ${peak.toFixed(0)}%${future ? ' · so far' : ''}</div></button>`;
  };
  const cells = [];
  for (const dt = new Date(first); dt <= last; dt.setDate(dt.getDate() + 1)) cells.push(cell(ymd(dt)));

  const past = known.filter(k => k < d.date).map(k => byDay[k]).filter(r => r.is_open && r.utilization_pct != null);
  const avg = past.length ? past.reduce((t2, r) => t2 + Number(r.utilization_pct), 0) / past.length : null;
  document.getElementById('occ-days').innerHTML = `
    <div class="pts-subhead">Last 2 weeks and the next 7 days${avg != null ? ` · last 2 weeks averaged ${avg.toFixed(0)}% on open days` : ''}</div>
    <div class="occ-cal">
      ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => `<div class="occ-dow">${w}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="goal-note" style="margin-top:10px">% = how full your seats were across the day's open hours · busiest = the fullest moment · upcoming days show what's booked so far. Seats: ${esc(String(t.seats || '—'))}.</div>`;
}

async function showOccupancyDay(day) {
  const el = document.getElementById('occ-detail');
  el.innerHTML = `<div class="card"><div class="goal-note">Loading…</div></div>`;
  try {
    renderOccupancyDay(day, await fetchOccupancy(day));
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    el.innerHTML = `<div class="card"><div class="goal-note">Couldn't load that day.</div></div>`;
  }
}
// One day hour by hour — same chart as admin (lines every 10% from 40%).
function renderOccupancyDay(day, d) {
  const el = document.getElementById('occ-detail');
  const t = d.today || {};
  const amber = d.amberPct || 85;
  const title = new Date(day + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  if (!t.is_open) { el.innerHTML = `<div class="card"><div class="pts-subhead">${esc(title)}</div><div class="goal-note">Nothing on that day.</div></div>`; return; }
  if (!(Number(t.seats) > 0)) {
    const held = (t.holds || []).map(h => `
      <div class="pts-row"><span><span class="how" style="display:inline-block;min-width:118px;text-align:left">${occTime12(h.start)}–${occTime12(h.end)}</span>${esc(h.title || '')}${h.is_party ? ' 🎉' : ''}</span><span class="amt">${h.seats}</span></div>`).join('');
    el.innerHTML = `<div class="card">
        <div class="pts-subhead" style="font-size:13px">${esc(title)}</div>
        <div class="goal-note" style="margin-bottom:12px">No floor plan yet, so no fill % — here's what was booked.</div>
        ${held || '<div class="pts-empty">Nothing booked.</div>'}
      </div>`;
    return;
  }
  const slots = t.slots || [];
  const bars = slots.map(sl => {
    const p = Number(sl.pct || 0);
    return `<div title="${occTime12(sl.time)}: ${sl.occupied} of ${t.seats} seats (${p.toFixed(0)}%)"
      style="flex:1;min-width:3px;height:${Math.max(2, Math.min(p, 100))}%;border-radius:3px 3px 0 0;background:${p >= 100 ? '#e53935' : p >= amber ? '#f5a623' : 'var(--accent)'}"></div>`;
  }).join('');
  const hours = slots.map(sl => `<div style="flex:1;min-width:3px;white-space:nowrap">${/:00$/.test(sl.time) ? occTime12(sl.time) : ''}</div>`).join('');
  const lines = [40, 50, 60, 70, 80, 90, 100].map(g => `
    <div style="position:absolute;left:0;right:34px;bottom:${g}%;border-top:1px ${g === 40 ? 'solid #b9a6e8' : 'dashed #e3e0d8'};pointer-events:none"></div>
    <div style="position:absolute;right:0;bottom:${g}%;transform:translateY(50%);font-size:9px;line-height:1;color:${g === 40 ? 'var(--accent-deep)' : '#aaa'};font-weight:${g === 40 ? 700 : 400}">${g}%</div>`).join('');
  const holds = (t.holds || []).map(h => `
    <div class="pts-row"><span><span class="how" style="display:inline-block;min-width:118px;text-align:left">${occTime12(h.start)}–${occTime12(h.end)}</span>${esc(h.title || '')}${h.is_party ? ' 🎉' : ''}</span><span class="amt">${h.seats}</span></div>`).join('');
  el.innerHTML = `<div class="card">
      <div class="pts-subhead" style="font-size:13px">${esc(title)}</div>
      <div class="goal-note" style="margin-bottom:12px"><strong>${Number(t.utilization_pct || 0).toFixed(0)}% full</strong>
        · busiest at ${occTime12(t.peak_start)}: ${t.peak_occupied} of ${t.seats} seats (${Number(t.peak_pct || 0).toFixed(0)}%)
        · open ${occTime12(t.open_time)}–${occTime12(t.close_time)}</div>
      <div style="position:relative;display:flex;align-items:flex-end;gap:2px;height:160px;border-bottom:1px solid var(--border);padding-right:34px">${bars}${lines}
        <div style="position:absolute;left:0;right:34px;bottom:${amber}%;border-top:1.5px dashed #f5a623;pointer-events:none"></div></div>
      <div style="display:flex;gap:2px;font-size:10px;color:var(--ink-soft);margin-top:3px;padding-right:34px">${hours}</div>
      <div class="pts-subhead" style="margin-top:14px">What held seats</div>
      ${holds || '<div class="pts-empty">Nothing booked.</div>'}
    </div>`;
}

// Sidebar → 📷 Instagram.
function openInstagram() {
  if (!_sessionPin) { openPinModal(); return; }
  showOnlyPane('instagram-pane');
  setActiveNav('nav-instagram');
  coordinatorPaneBar('instagram-bar');
  const el = document.getElementById('card-instagram');
  if (el && !el.innerHTML.trim()) el.innerHTML = `<div class="goal-note">Loading Instagram…</div>`;
  loadInstagram(_sessionPin, _sessionStudioId);
}

// Sidebar → ⭐ My Points. Only reachable with the coordinator view unlocked.
function openPoints() {
  if (!_sessionPin) { openPinModal(); return; }
  showOnlyPane('points-pane');
  setActiveNav('nav-points');
  const el = document.getElementById('card-points');
  if (el && !el.innerHTML.trim()) el.innerHTML = `<div class="pts-empty">Loading your points…</div>`;
  loadPoints(_sessionPin, _sessionStudioId);
}

// ---------- Week info bar (theme, Friday event, next week) ----------

async function fetchWeekHeaderInfo(dateStr) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_week_header_info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ p_date: dateStr })
  });
  const rows = await res.json();
  if (!res.ok) throw new Error((rows && rows.message) || 'Request failed');
  return rows && rows[0];
}

function renderWeekInfoBar(info) {
  const bar = document.getElementById('week-info-bar');
  if (!bar) return;
  if (!info) { bar.style.display = 'none'; return; }

  const parts = [`📅 <strong>WEEK ${esc(info.week_number)}</strong>`];
  if (info.theme_name) parts.push(`${esc(info.theme_name.toUpperCase())}${info.theme_emoji ? ' ' + info.theme_emoji : ''}`);
  if (info.friday_title) parts.push(`<span class="label">Friday:</span> ${esc(info.friday_title)}`);
  if (info.next_week_theme_name) parts.push(`<span class="label">Next week:</span> ${esc(info.next_week_theme_name)}`);

  bar.innerHTML = parts.join(' <span class="sep">·</span> ');
  bar.style.display = 'flex';
}

async function loadWeekInfoBar() {
  try {
    const today = localDateStr(new Date());
    renderWeekInfoBar(await fetchWeekHeaderInfo(today));
  } catch (e) {
    console.error('Week info bar load failed:', e);
    renderWeekInfoBar(null); // fail quietly
  }
}

// Base printouts, steps printouts and templates can be uploaded files (private 'project-sheets'
// bucket) instead of links. The lineup function returns their file paths to
// signed-in studio logins; this swaps each path for a temporary signed link
// (12 hours — covers a dashboard left open all day; the lineup reloads each
// new day). A forwarded link stops working after that.
const SHEETS_BUCKET = 'project-sheets';
const SHEET_LINK_SECONDS = 12 * 60 * 60;
// A printout link made when the page loaded runs out after 12 hours (the Hub can stay open for days on a studio computer):
// so every tap on a printout makes a fresh link right then, whatever made the old one. (Files in the private buckets only.)
document.addEventListener('click', function (ev) {
  const a = ev.target && ev.target.closest ? ev.target.closest('a[href*="/storage/v1/object/sign/"]') : null;
  if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
  const m = String(a.getAttribute('href') || '').match(/\/storage\/v1\/object\/sign\/([^/?#]+)\/([^?#]+)/);
  if (!m) return;
  const bucket = decodeURIComponent(m[1]), path = m[2].split('/').map(decodeURIComponent).join('/');
  ev.preventDefault();
  const sameTab = a.getAttribute('target') === '_self';
  const win = sameTab ? null : window.open('', '_blank');   // (opened during the tap, so it isn't blocked)
  if (win) try { win.document.write('<p style="font-family:sans-serif;padding:20px">Opening the printout…</p>'); } catch (e) {}
  sb.storage.from(bucket).createSignedUrl(path, 15 * 60).then(function (r) {
    const url = r && r.data && r.data.signedUrl;
    if (!url) { if (win) win.close(); alert('That printout couldn’t be opened' + (r && r.error ? ': ' + r.error.message : '.') + ' Try again, or refresh the Hub.'); return; }
    a.setAttribute('href', url);   // (and keep the fresh one on the link)
    if (win) win.location = url; else location.href = url;
  }, function (e) { if (win) win.close(); alert('That printout couldn’t be opened. Try again, or refresh the Hub.'); });
}, true);
async function resolveUploadedSheetLinks(data) {
  if (!data) return;
  const items = [].concat(data.projects || [], data.event || [], data.mini_make || []);
  // each project's other printouts (projects.html → More printouts: projects_more_printouts.sql)
  try {
    const ids = [...new Set(items.map(p => p && p.id).filter(id => /^[0-9a-f-]{36}$/i.test(String(id || ''))))];
    if (ids.length) { const { data: mp, error: me } = await sb.rpc('hub_project_more_printouts', { p_ids: ids });
      if (!me && mp) items.forEach(p => { if (p && mp[p.id]) p.extra_printouts = JSON.parse(JSON.stringify(mp[p.id])); }); }
  } catch (e) { /* before the SQL is run: just the usual printouts */ }
  const paths = [...new Set(items.flatMap(p => [p.base_printout_path, p.printout_path, p.template_path].concat((p.templates || []).map(t => t && t.path), (p.extra_printouts || []).map(x => x && x.path))).filter(Boolean))];
  if (!paths.length) return;
  try {
    const { data: signed, error } = await sb.storage.from(SHEETS_BUCKET).createSignedUrls(paths, SHEET_LINK_SECONDS);
    if (error) throw error;
    const byPath = {};
    (signed || []).forEach(x => { if (x && x.signedUrl && !x.error) byPath[x.path] = x.signedUrl; });
    items.forEach(p => {
      if (p.base_printout_path) p.base_printout_url = byPath[p.base_printout_path] || null;
      if (p.printout_path) p.printout_url = byPath[p.printout_path] || null;
      if (p.template_path) p.template_url = byPath[p.template_path] || null;
      (p.templates || []).forEach(t => { if (t && t.path) t.url = byPath[t.path] || t.url || null; });
      (p.extra_printouts || []).forEach(x => { if (x && x.path) x.url = byPath[x.path] || null; });
    });
  } catch (e) {
    console.error('Could not open uploaded printouts:', e); // links just don't show; the lineup still renders
  }
}

async function loadTodaysProjects(studioId) {
  // Nov 2026: the "Today at 4Cats" section (the old pick-1-of-3 lineup and its weather days) is retired: workshops are
  // now booked by project, and each time's project opens from 📘 Project on the Today and Schedule tabs.
  _projectsDate = localDateStr(new Date());
  const card = document.getElementById('card-todays-projects'); if (card) { card.style.display = 'none'; card.innerHTML = ''; }
  return;
  const today = localDateStr(new Date());
  _projectsDate = today;
  let forecastDays = [];
  try {
    if (studioId) forecastDays = await fetchWeatherForecast(studioId);
  } catch (e) {
    console.error('Weather forecast load failed:', e);
    // Fail quietly — the header still renders fine without the pills.
  }
  try {
    const projects = await fetchProjectsForDate(today);
    await resolveUploadedSheetLinks(projects);
    renderTodaysProjects(projects, forecastDays);
  } catch (e) {
    console.error("Today's Projects load failed:", e);
    renderTodaysProjects(null); // fail quietly, like the greeting
  }
  // Re-check every 10 min so a dashboard left open overnight rolls to the new day
  if (!_projectsTimer) {
    _projectsTimer = setInterval(() => {
      if (localDateStr(new Date()) !== _projectsDate) loadTodaysProjects(studioId);
    }, PROJECTS_RECHECK_MS);
  }
}

// ---------- Suggested Marketing Emails ----------

let _marketingSuggestions = []; // stashed so send/preview don't need a refetch
let _marketingStudioId = null;
let _marketingStudioName = '';

async function fetchMarketingSuggestionsWithPin(pin, studioId, weatherTag) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-marketing-suggestions`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ pin, studioId, weatherTag })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderMarketingSuggestions(data) {
  const container = document.getElementById('card-marketing-suggestions');
  if (!container) return;

  if (!data || data.error || !data.studioId) {
    container.innerHTML = '';
    return;
  }

  _marketingSuggestions = data.suggestions || [];
  _marketingStudioId = data.studioId;
  _marketingStudioName = STUDIO_NAMES[data.studioId] || data.studioId;

  if (!_marketingSuggestions.length) {
    container.innerHTML = `<div class="no-cap">No suggested templates for right now — check back as the season or weather changes.</div>`;
    return;
  }

  container.innerHTML = _marketingSuggestions.map(t => `
    <div class="suggestion-row">
      <div class="suggestion-head">
        <div>
          <div class="suggestion-name">${esc(t.name)}</div>
          <div class="suggestion-subject">${esc(t.subject)}</div>
        </div>
        <div class="suggestion-actions">
          <button class="suggestion-btn" onclick="togglePreview('${t.id}')">Preview</button>
          <button class="suggestion-btn primary" onclick="sendMarketingTemplate('${t.id}')">Send</button>
        </div>
      </div>
      <div class="suggestion-preview" id="preview-${t.id}">${esc(t.body)}</div>
    </div>`).join('');
}

function togglePreview(templateId) {
  const el = document.getElementById(`preview-${templateId}`);
  if (el) el.classList.toggle('open');
}

async function sendMarketingTemplate(templateId) {
  const template = _marketingSuggestions.find(t => t.id === templateId);
  if (!template || !_marketingStudioId) return;
  // send-email-blast verifies the manager PIN server-side before sending.
  // Captured once here so an inactivity lock mid-send can't swap it out.
  const pin = _sessionPin;
  if (!pin) { alert('The coordinator view has locked. Unlock it again, then retry.'); return; }

  try {
    // Dry run first — shows the real recipient count before committing to
    // an irreversible send.
    const dryRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-blast`, {
      method: 'POST',
      headers: await fnHeaders(),
      body: JSON.stringify({
        pin,
        studio_id: _marketingStudioId,
        studio_name: _marketingStudioName,
        recipient_type: 'marketing_all_customers',
        subject: template.subject,
        message: template.body,
        dry_run: true
      })
    });
    const dryData = await dryRes.json();
    if (!dryRes.ok || !dryData.success) {
      alert(`Couldn't check recipients: ${dryData.error || 'unknown error'}`);
      return;
    }

    const confirmed = confirm(`Send "${template.name}" to ${dryData.count} opted-in customer(s) at ${_marketingStudioName}?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email-blast`, {
      method: 'POST',
      headers: await fnHeaders(),
      body: JSON.stringify({
        pin,
        studio_id: _marketingStudioId,
        studio_name: _marketingStudioName,
        recipient_type: 'marketing_all_customers',
        subject: template.subject,
        message: template.body
      })
    });
    const sendData = await sendRes.json();
    if (sendRes.ok && sendData.success) {
      alert(`Sent! ${sendData.sent} delivered, ${sendData.failed} failed.`);
    } else {
      alert(`Send failed: ${sendData.error || 'unknown error'}`);
    }
  } catch (e) {
    console.error('Marketing send failed:', e);
    alert('Something went wrong sending this email — check the console for details.');
  }
}

async function loadMarketingSuggestions(pin, studioId) {
  try {
    const weatherTag = deriveWeatherTag(_lastWeatherData);
    const data = await fetchMarketingSuggestionsWithPin(pin, studioId, weatherTag);
    renderMarketingSuggestions(data);
  } catch (e) {
    console.error('Marketing suggestions load failed:', e);
  }
}

async function fetchFridayFillRateWithPin(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-dashboard-data`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify(studioId ? { pin, studioId } : { pin })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}


/* ==========================================================================
   WEATHER (current conditions for the studio, top of the page)
   ========================================================================== */
// Normalized shape: { tempC:number, condition:string, feelsLikeC:number, note:string, sourceLabel:string }
// LIVE — Open-Meteo, free, no API key required. Coordinates come from the
// static STUDIO_COORDS lookup (studios table has no lat/lng column).
async function getWeatherData_api(studioId) {
  const coords = STUDIO_COORDS[studioId];
  if (!coords) {
    return { tempC: null, condition: 'Unavailable', feelsLikeC: null,
             note: '', sourceLabel: 'No coordinates on file for this studio' };
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=celsius&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather request failed');
  const data = await res.json();
  const cur = data.current || {};
  return {
    tempC: Math.round(cur.temperature_2m),
    condition: weatherLabel(cur.weather_code),
    feelsLikeC: Math.round(cur.apparent_temperature),
    note: '',
    sourceLabel: 'Open-Meteo (live)'
  };
}
const WEATHER_SOURCE = getWeatherData_api;

let _lastWeatherData = null; // stashed so the marketing-suggestion fetch can derive a tag without a second weather call

function deriveWeatherTag(w) {
  if (!w || w.tempC === null) return null;
  const cond = (w.condition || '').toLowerCase();
  if (cond.includes('snow')) return 'snowy';
  if (cond.includes('rain') || cond.includes('drizzle')) return 'rainy';
  if (cond.includes('clear')) return w.tempC >= 20 ? 'sunny' : 'cold';
  if (cond.includes('cloud') || cond.includes('overcast') || cond.includes('fog')) return 'cloudy';
  if (w.tempC <= 5) return 'cold';
  if (w.tempC >= 22) return 'warm';
  return null;
}

// 🌤️ (Nov 12 2026) The weather strip on the Today screen: now, then Today / Tomorrow pills (› shows the rest of the week).
async function weatherStripDraw(studioId, w) {
  const el = document.getElementById('weather-strip'); if (!el) return;
  let days = [];
  try { days = await fetchWeatherForecast(studioId); } catch (e) { days = []; }
  const now = w && w.tempC !== null && w.tempC !== undefined
    ? `<div class="weather-now">🌤️ Now <b>${esc(w.tempC)}°C</b> · ${esc(w.condition || '')}${w.feelsLikeC !== undefined && w.feelsLikeC !== null ? ' · feels like ' + esc(w.feelsLikeC) + '°' : ''}</div>` : '';
  el.innerHTML = now + forecastPillsHtml(days);
}
// Current conditions. No tile any more (the forecast pills in "Today at 4Cats"
// cover weather), but the fetch stays: Suggested Emails use _lastWeatherData's
// weather tag. If a #mini-weather tile is ever added back, it draws itself.
async function renderWeatherCard(studioId) {
  const el = document.getElementById('mini-weather');
  try {
    const w = await WEATHER_SOURCE(studioId);
    _lastWeatherData = w;
    weatherStripDraw(studioId, w);   // (Nov 12 2026) 🌤️ the weather strip at the top of the Today screen
    if (!el) return;
    el.innerHTML = w.tempC === null ? `
      <div class="eyebrow">🌤️ Weather</div>
      <div class="sub">${esc(w.condition)}</div>` : `
      <div class="eyebrow">🌤️ Weather</div>
      <div class="big">${w.tempC}°C</div>
      <div class="sub">${esc(w.condition)} · Feels like ${w.feelsLikeC}°</div>`;
  } catch (e) {
    console.error('Weather load failed:', e);
    if (!el) return;
    el.innerHTML = `
      <div class="eyebrow">🌤️ Weather</div>
      <div class="sub">Unable to load weather right now</div>`;
  }
}

// ---- FRIDAY EVENT FILL RATE ----
// Normalized shape returned by the Edge Function:
//   { capacityKnown:boolean,
//     upcoming: { dateLabel:string, projectedAttendance:number, capacity:number,
//                 turns:number, pct:number } | null,
//     mostRecent: { dateLabel:string, attendance:number, capacity:number, pct:number } | null,
//     history: [ { date:string, dateLabel:string, attendance:number, capacity:number, pct:number } ],
//     bonusThresholdPct:number, sourceLabel:string }
// This card is PIN-gated (see fetchFridayFillRateWithPin above) — nothing
// renders here until a valid manager PIN comes back with data.

function fridayPctClass(pct, threshold) { return pct >= threshold ? 'hit' : ''; }

// Friday points tiers (fill %), drawn as lines. Sent by community-dashboard-data
// from the current Friday rule; 40 / 50 / 80 if it isn't (older function).
let _fridayTiers = [40, 50, 80];
function fridayTierReached(pct) {
  let n = 0;
  _fridayTiers.forEach((t, i) => { if (pct >= t) n = i + 1; });
  return n;
}

function fridayChartSvg(history, thresholdPct) {
  const barW = 26, gap = 14, chartH = 130, padTop = 10, padBottom = 22, padLeft = 64;
  const w = padLeft + history.length * (barW + gap) + gap;
  const h = chartH + padTop + padBottom;
  const lines = _fridayTiers.map((t, i) => {
    const y = padTop + chartH * (1 - Math.min(t, 100) / 100);
    return `
    <line x1="${padLeft - 4}" y1="${y}" x2="${w}" y2="${y}" stroke="${i === 0 ? 'var(--green)' : 'var(--amber)'}" stroke-width="${i === 0 ? 1.75 : 1.25}" stroke-dasharray="4 3"/>
    <text x="${padLeft - 8}" y="${y + 3}" text-anchor="end" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="${i === 0 ? 'var(--green)' : 'var(--amber)'}">Tier ${i + 1} · ${t}%</text>`;
  }).join('');
  const bars = history.map((d, i) => {
    const x = padLeft + gap + i * (barW + gap);
    const barH = Math.max(2, chartH * (Math.min(d.pct, 100) / 100));
    const y = padTop + chartH - barH;
    const cls = fridayTierReached(d.pct) > 0 ? 'var(--green)' : 'var(--accent)';
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${cls}"/>
      <text x="${x + barW / 2}" y="${padTop + chartH + 14}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" fill="var(--ink-soft)">${esc(d.dateLabel)}</text>
      <text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="700" fill="var(--ink)">${d.pct.toFixed(0)}%</text>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${lines}
    ${bars}
  </svg>`;
}

function fridayListHtml(history, thresholdPct) {
  return history.slice().reverse().map(d => `
    <div class="friday-list-row">
      <div class="fl-date">${esc(d.dateLabel)}</div>
      <div class="fl-bar-track"><div class="fl-bar-fill ${fridayPctClass(d.pct, thresholdPct)}" style="width:${Math.min(d.pct, 100)}%"></div></div>
      <div class="fl-pct">${d.pct.toFixed(1)}%</div>
      <div class="fl-detail">${d.attendance}/${d.effectiveTotal}</div>
    </div>`).join('');
}

// 🎁 Make the Gift: registered vs the studio's locked base (classes × 15),
// with the points tiers marked on the bar.
function renderMakeTheGift(m) {
  const card = document.getElementById('card-make-the-gift');
  const head = document.getElementById('mtg-head');
  if (!card || !head) return;
  const topEl = document.getElementById('mtg-top');
  if (!m || !m.classes) {
    card.style.display = 'none'; head.style.display = 'none'; card.innerHTML = '';
    if (topEl) { topEl.style.display = 'none'; topEl.innerHTML = ''; }
    return;
  }
  const pct = Math.max(0, Number(m.pct) || 0);
  const tiers = (m.tiers || []).slice().sort((a, b) => a.at - b.at);
  let reached = 0; tiers.forEach((t, i) => { if (pct >= t.at) reached = i + 1; });
  const earned = tiers.slice(0, reached).reduce((t, x) => t + (Number(x.points) || 0), 0);
  const next = tiers[reached];
  const needed = next ? Math.max(0, Math.ceil(m.base * next.at / 100) - m.registered) : 0;
  const day = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const paid = Number(m.paid) || 0;
  card.innerHTML = `
    <div class="mtg-top">
      <div><div class="mtg-big">${m.registered} <span>of ${m.base} spaces</span></div>
        <div class="goal-note" style="margin:2px 0 0">${m.classes} class${m.classes === 1 ? '' : 'es'} × 15 · closing a class doesn't lower the ${m.base}</div></div>
      <div class="mtg-pct">${pct.toFixed(0)}%</div>
    </div>
    <div class="mtg-bar"><div class="mtg-fill${reached ? ' hit' : ''}" style="width:${Math.min(pct, 100)}%"></div>
      ${tiers.map((t, i) => `<span class="mtg-tick${pct >= t.at ? ' hit' : ''}" style="left:${Math.min(t.at, 100)}%"><b>${t.at}%</b><i>${i ? '+' : ''}${fmtPts(t.points)}</i></span>`).join('')}
    </div>
    <div class="mtg-foot">
      <span>${reached ? `✅ Tier ${reached} reached · ${fmtPts(earned)} points` : 'No tier yet'}${next ? ` · <strong>${needed} more kid${needed === 1 ? '' : 's'}</strong> for ${next.at}%` : ' · every tier reached 🎉'}</span>
      <span>${paid ? `Paid ${fmtPts(paid)} points` : m.payDay ? `Points paid ${esc(day(m.payDay))}, after your last first class` : ''}</span>
    </div>`;
  card.style.display = ''; head.style.display = '';
  // Same card at the top of the main dashboard, under the Flash Challenge banner
  const top = document.getElementById('mtg-top');
  if (top) {
    top.innerHTML = `<div class="card mtg-top-card"><div class="pts-subhead" style="margin:0 0 8px">🎁 Make the Gift — fill rate</div>${card.innerHTML}</div>`;
    top.style.display = '';
  }
}

function renderFridayFillRateBody(f) {
  renderMakeTheGift(f.makeTheGift);
  if (Array.isArray(f.fridayTiers) && f.fridayTiers.length) _fridayTiers = f.fridayTiers.slice().sort((a, b) => a - b);
  f.bonusThresholdPct = _fridayTiers[0];
  if (!f.capacityKnown) {
    document.getElementById('card-friday-fillrate').innerHTML = `
      <div class="card-head"><div class="title">🎨 Friday Night Fill Rate</div></div>
      <div class="no-cap">Event seats aren't set for this studio yet — mark the event tables on its floor plan to start measuring Friday nights.</div>`;
    return;
  }

  const upcomingTile = f.upcoming ? `
    <div class="friday-tile live">
      <div class="eyebrow"><span class="live-dot"></span> Upcoming Friday</div>
      <div class="date">${esc(f.upcoming.dateLabel)}</div>
      <div class="pct">${f.upcoming.pct.toFixed(1)}%</div>
      <div class="detail">${f.upcoming.projectedAttendance} / ${f.upcoming.effectiveTotal} guests booked so far${f.upcoming.eventPct != null ? ` · ${f.upcoming.eventPct}% from the event` : ''}</div>
    </div>` : `
    <div class="friday-tile"><div class="eyebrow">Upcoming Friday</div><div class="detail">No Friday event scheduled</div></div>`;

  const recentTile = f.mostRecent ? `
    <div class="friday-tile">
      <div class="eyebrow">Most Recent Friday</div>
      <div class="date">${esc(f.mostRecent.dateLabel)}</div>
      <div class="pct ${fridayPctClass(f.mostRecent.pct, f.bonusThresholdPct)}">${f.mostRecent.pct.toFixed(1)}%</div>
      <div class="detail">${f.mostRecent.attendance} / ${f.mostRecent.effectiveTotal} guests${f.mostRecent.eventPct != null ? ` · ${f.mostRecent.eventPct}% from the event` : ''}${fridayTierReached(f.mostRecent.pct) ? ` · tier ${fridayTierReached(f.mostRecent.pct)} reached 🎉` : ` · tier 1 at ${_fridayTiers[0]}%`}</div>
    </div>` : `
    <div class="friday-tile"><div class="eyebrow">Most Recent Friday</div><div class="detail">No completed Friday events yet</div></div>`;

  document.getElementById('card-friday-fillrate').innerHTML = `
    <div class="card-head">
      <div class="title">🎨 Friday Night Fill Rate</div>
      <div class="friday-toggle">
        <button id="friday-view-chart" class="active" onclick="setFridayView('chart')">Chart</button>
        <button id="friday-view-list" onclick="setFridayView('list')">List</button>
      </div>
    </div>
    <div class="goal-note" style="margin:-4px 0 10px">How full the studio is from 5:30 to 9:30 pm — the Friday event, parties, Mini Make and every other booking — against a realistic full night of ${f.mostRecent ? f.mostRecent.effectiveTotal : (f.upcoming ? f.upcoming.effectiveTotal : '')} guests (2 hours each).</div>
    <div class="friday-summary">${upcomingTile}${recentTile}</div>
    <div id="friday-chart-view" class="friday-chart-scroll">${fridayChartSvg(f.history, f.bonusThresholdPct)}</div>
    <div id="friday-list-view" class="friday-list" style="display:none">${fridayListHtml(f.history, f.bonusThresholdPct)}</div>
    ${fridayAheadHtml(f.upcomingFridays)}`;
}

// The next 8 Fridays, booked so far (from community-dashboard-data) — which
// ones are filling and which need promoting. Same tier lines as the history.
function fridayAheadHtml(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const rows = list.map(u => {
    const pct = Math.max(0, u.pct || 0);
    const tier = fridayTierReached(pct);
    const toTier1 = Math.max(0, Math.ceil(u.effectiveTotal * _fridayTiers[0] / 100) - (u.guests || 0));
    return `<div class="fa-row">
        <div class="fa-date">${esc(u.dateLabel)}</div>
        <div class="fa-bar"><div style="width:${Math.min(pct, 100)}%;background:${tier ? 'var(--green)' : 'var(--accent)'}"></div>
          ${_fridayTiers.map((t, i) => `<span class="fa-tick" style="left:${Math.min(t, 100)}%" title="Tier ${i + 1} · ${t}%"></span>`).join('')}</div>
        <div class="fa-pct">${pct.toFixed(0)}%</div>
        <div class="fa-sub">${u.hadEvent || u.guests ? `${u.guests} / ${u.effectiveTotal} guests${tier ? ` · tier ${tier} 🎉` : ` · ${toTier1} more for tier 1`}` : 'no event scheduled yet'}</div>
      </div>`;
  }).join('');
  return `<div class="friday-ahead">
      <div class="pts-subhead" style="margin:16px 0 8px">📅 Next ${list.length} Fridays — booked so far</div>
      ${rows}
      <div class="goal-note" style="margin-top:6px">Ticks mark the points tiers (${_fridayTiers.map(t => t + '%').join(' / ')}). Bookings so far — these fill up as Friday gets closer.</div>
    </div>`;
}

function setFridayView(view) {
  document.getElementById('friday-chart-view').style.display = view === 'chart' ? 'block' : 'none';
  document.getElementById('friday-list-view').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('friday-view-chart').classList.toggle('active', view === 'chart');
  document.getElementById('friday-view-list').classList.toggle('active', view === 'list');
}

// ---------- Month label (Sales Goals leaderboard) ----------

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ---------- Kids Parties / Team Building (admin-only for now) ----------

async function fetchBookingBucketStatsWithPin(pin, studioId, bucket, mode, monthsBack) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-booking-bucket-data`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ pin, studioId, bucket, mode: mode || 'event', monthsBack: monthsBack || 6 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function shortMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

function bucketTrendChartSvg(trend) {
  const barW = 26, gap = 14, chartH = 110, padTop = 10, padBottom = 22;
  const w = Math.max(1, trend.length) * (barW + gap) + gap;
  const h = chartH + padTop + padBottom;
  const maxVal = Math.max(1, ...trend.map(d => d.bookingCount));
  const bars = trend.map((d, i) => {
    const x = gap + i * (barW + gap);
    const barH = Math.max(2, chartH * (d.bookingCount / maxVal));
    const y = padTop + chartH - barH;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="var(--accent)"/>
      <text x="${x + barW / 2}" y="${padTop + chartH + 14}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" fill="var(--ink-soft)">${esc(shortMonthLabel(d.month))}</text>
      <text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="700" fill="var(--ink)">${d.bookingCount}</text>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}

function renderBookingBucketCard(containerId, title, emoji, bucket, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || data.error || !data.studioId) {
    container.innerHTML = '';
    return;
  }

  const studioName = STUDIO_NAMES[data.studioId] || data.studioId;
  const tm = data.thisMonth;
  const isPurchase = data.mode === 'purchase';
  const bookingLabel = isPurchase ? 'This Month — Purchased' : 'This Month — Happening';

  const fillTile = (tm.pctFull !== null && tm.pctFull !== undefined) ? `
      <div class="friday-tile" style="grid-column:1 / -1">
        <div class="eyebrow">% Full</div>
        <div class="pct">${tm.pctFull}% <span style="font-size:11px;font-weight:400;color:var(--ink-soft)">(${tm.bookingCount} / ${tm.capacity} slots)</span></div>
      </div>` : '';

  container.innerHTML = `
    <div class="card-head">
      <div class="title">${emoji} ${esc(title)} — ${esc(studioName)}</div>
      <div class="friday-toggle">
        <button class="${!isPurchase ? 'active' : ''}" onclick="setBookingBucketMode('${bucket}','event')">By Party Date</button>
        <button class="${isPurchase ? 'active' : ''}" onclick="setBookingBucketMode('${bucket}','purchase')">By Purchase Date</button>
      </div>
    </div>
    <div class="friday-summary">
      <div class="friday-tile">
        <div class="eyebrow">${esc(bookingLabel)}</div>
        <div class="pct">${tm.bookingCount}</div>
      </div>
      <div class="friday-tile">
        <div class="eyebrow">This Month — Attendance</div>
        <div class="pct">${tm.totalAttendance}</div>
      </div>
      ${fillTile}
    </div>
    <div style="margin:14px 0" class="friday-tile">
      <div class="eyebrow">Avg. Party Size</div>
      <div class="pct">${tm.avgAttendance !== null ? tm.avgAttendance : '—'}</div>
    </div>
    ${data.trend.length ? `<div class="friday-chart-scroll">${bucketTrendChartSvg(data.trend)}</div>` : '<div class="no-cap">No bookings yet in this range.</div>'}`;
}

const _bucketModes = { kids_party: 'event', team_building: 'event' };
const _bucketMeta = {
  kids_party: { containerId: 'card-kids-parties', title: 'Kids Parties', emoji: '🎉' },
  team_building: { containerId: 'card-team-building', title: 'Team Building', emoji: '🏢' }
};

function setBookingBucketMode(bucket, mode) {
  _bucketModes[bucket] = mode;
  loadBookingBucketStats(_sessionPin, _sessionStudioId, bucket);
}

async function loadBookingBucketStats(pin, studioId, bucket) {
  const meta = _bucketMeta[bucket];
  try {
    const data = await fetchBookingBucketStatsWithPin(pin, studioId, bucket, _bucketModes[bucket]);
    renderBookingBucketCard(meta.containerId, meta.title, meta.emoji, bucket, data);
  } catch (e) {
    console.error(`Booking bucket (${bucket}) load failed:`, e);
    // Fail quietly — same non-critical treatment as the other admin-only cards.
  }
}

function loadAllBookingBuckets(pin, studioId) {
  loadBookingBucketStats(pin, studioId, 'kids_party');
  loadBookingBucketStats(pin, studioId, 'team_building');
}

// ---------- Sales Goals (percentages only) ----------
// community-goal-progress never returns dollar amounts — only % of today's
// goal, % of the monthly goal, and a pace status. Same goal formula as
// finance.html, including estimated wages for pay periods not yet entered.

const GOAL_REFRESH_MS = 5 * 60 * 1000; // 5 min — sales don't need 60s polling
let _goalRefreshTimer = null;

async function fetchGoalProgressWithPin(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-goal-progress`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify(studioId ? { pin, studioId } : { pin })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function goalTileHtml(eyebrow, pct, extraHtml, live) {
  const hit = pct >= 100;
  const width = Math.max(0, Math.min(pct, 100));
  return `
    <div class="friday-tile goal-tile${live ? ' live' : ''}">
      <div class="eyebrow">${live ? '<span class="live-dot"></span> ' : ''}${esc(eyebrow)}</div>
      <div class="pct${hit ? ' hit' : ''}">${pct}%</div>
      <div class="progress-track"><div class="progress-fill${hit ? ' hit' : ''}" style="width:${width}%"></div></div>
      ${extraHtml || ''}
    </div>`;
}

// This month vs the same month last year, by average day (percent only —
// community-goal-progress never sends dollars).
function yoyHtml(data) {
  const y = data && data.yoy;
  if (!y) return '';
  if (!y.available && y.isNew) return `<div class="yoy-line muted">📅 Your studio opened during ${esc(y.lastYearLabel || 'this month last year')}, so there's no fair comparison yet — it starts next year.</div>`;
  if (!y.available) return `<div class="yoy-line muted">📅 No ${esc(y.lastYearLabel || 'last year')} sales on file to compare with yet.</div>`;
  const pct = Number(y.pct) || 0;
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
  return `<div class="yoy-line ${cls}">📅 vs ${esc(y.lastYearLabel)}: <strong>${pct > 0 ? '+' : ''}${pct}% ${arrow}</strong>
      <span class="yoy-sub">per day, so far this month (${y.daysSoFar} day${y.daysSoFar === 1 ? '' : 's'}) compared with the average day last year</span></div>`;
}

function renderGoalCard(data) {
  const container = document.getElementById('card-sales-goals');
  if (!container) return;
  lastGoalData = data;

  if (!data || data.error || !data.studioId) {
    container.innerHTML = '';
    return;
  }

  const studioName = STUDIO_NAMES[data.studioId] || data.studioId;
  const head = `<div class="card-head"><div class="title">🎯 Sales Goals — ${esc(studioName)}</div></div>`;

  // Fail clearly: no goal set, or no timezone — say so instead of showing 0%.
  // The leaderboard still shows, so the studio can see how others are doing.
  if (data.status !== 'ok') {
    container.innerHTML = head + yoyHtml(data) + `<div class="goal-msg">${esc(data.message || 'Goal tracking isn\'t available yet.')}</div>` + leaderboardHtml(data);
    return;
  }

  const paceLabel = {
    ahead: '✓ On pace for the month',
    close: 'Slightly behind pace',
    behind: 'Behind pace'
  }[data.paceStatus] || '';

  // Today's numbers are no longer shown to coordinators (month pace only).

  // Month tile: a forecast. Pace = sales so far ÷ where the studio needs to be by today,
  // which is the same as "where the month ends up, as a % of the breakeven goal, if sales
  // keep averaging what they have so far" (same number as the big Month figure on pace.html).
  // Falls back to % of the monthly goal if the Edge Function hasn't been updated yet.
  const hasPace = data.pacePct !== undefined && data.pacePct !== null;
  const daysLeft = data.daysLeftInMonth;
  const daysLeftTxt = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  // How far through the month we are (today counted as a full day, same as pace)
  const [yy, mm] = String(data.month || '').split('-').map(Number);
  const dim = yy && mm ? new Date(yy, mm, 0).getDate() : null;
  const monthDonePct = dim ? Math.round((dim - daysLeft) / dim * 100) : null;
  const reached = hasPace && data.monthPct >= 100
    ? `<div class="goal-note"><b>Breakeven goal reached for the month.</b></div>` : '';
  const monthTile = goalTileHtml(hasPace ? `${monthLabel(data.month)} · at this pace` : monthLabel(data.month),
    hasPace ? data.pacePct : data.monthPct,
    `<div class="goal-note">${hasPace
        ? `If sales keep averaging what they have so far this month, you'll finish at this % of your breakeven goal<br>${data.monthPct}% total reached so far${monthDonePct !== null ? ` · ${monthDonePct}% of the month done` : ''} · ${daysLeftTxt}`
        : `of the monthly goal · ${daysLeftTxt}`}</div>
     ${reached}
     ${paceLabel ? `<span class="goal-pace ${esc(data.paceStatus)}">${paceLabel}</span>` : ''}`, true);

  const estNote = data.isAdmin && data.goalUsesEstimatedWages
    ? `<div class="goal-note" style="margin-top:-6px">Goal includes estimated wages for pay periods not entered yet (same as finance tool).</div>`
    : '';

  container.innerHTML = head + yoyHtml(data) + `<div class="friday-summary goal-summary">${monthTile}<div class="goal-lb">${leaderboardHtml(data)}</div></div>` + estNote;
}

// Top 3 studios (today or this month). The logged-in studio is highlighted
// if it's in the top 3; otherwise its own rank is shown underneath.
const LB_MEDALS = ['🥇', '🥈', '🥉'];

function leaderboardRowHtml(rank, studioId, pct, isYou) {
  const name = STUDIO_NAMES[studioId] || studioId;
  const width = Math.max(0, Math.min(pct, 100));
  const rankHtml = rank <= 3
    ? `<div class="sglb-rank">${LB_MEDALS[rank - 1]}</div>`
    : `<div class="sglb-rank num">#${rank}</div>`;
  return `
    <div class="sglb-row${isYou ? ' you' : ''}">
      ${rankHtml}
      <div class="sglb-name">${esc(name)}${isYou ? '<span class="sglb-you-tag">YOU</span>' : ''}</div>
      <div class="sglb-bar"><div class="${pct >= 100 ? 'hit' : ''}" style="width:${width}%"></div></div>
      <div class="sglb-pct">${pct}%</div>
    </div>`;
}

// Two leaderboards from community-goal-progress: today's % of daily goal
// and this month's % of monthly goal. A toggle switches between them; the
// choice sticks while the page is open (resets to This month on reload).
let lbMode = 'month';
let lastGoalData = null;

function setLeaderboardMode(mode) {
  lbMode = mode;
  if (lastGoalData) renderGoalCard(lastGoalData);
}

function leaderboardHtml(data) {
  if (!data) return '';
  const monthLb = data.leaderboard;
  const todayLb = data.todayLeaderboard;
  const hasToday = false; // Today leaderboard removed: month pace only
  const hasMonth = !!(monthLb && monthLb.top && monthLb.top.length);
  if (!hasToday && !hasMonth) return '';

  // Fall back to whichever list exists (e.g. an older function deploy
  // without todayLeaderboard just shows the monthly list, no toggle).
  const mode = lbMode === 'today' && hasToday ? 'today' : (hasMonth ? 'month' : 'today'); // month unless Today is picked (or month is missing)
  const isToday = mode === 'today';
  const lb = isToday ? todayLb : monthLb;
  // Month leaderboard shows pace when available (same order as % of monthly goal,
  // since every studio is measured on the same days so far).
  const monthHasPace = !!(monthLb && monthLb.top && monthLb.top.length && monthLb.top[0].pacePct !== undefined);
  const pctOf = r => isToday ? r.pct : (monthHasPace ? r.pacePct : r.monthPct);

  const rows = lb.top.map(r => leaderboardRowHtml(r.rank, r.studioId, pctOf(r), r.isYou)).join('');
  const youRow = lb.you
    ? `<div class="sglb-gap">···</div>` + leaderboardRowHtml(lb.you.rank, data.studioId, pctOf(lb.you), true)
    : '';

  const basis = isToday ? "% of today's goal (each studio's local day)"
    : monthHasPace ? 'where each studio finishes the month at its current pace (% of breakeven goal)' : '% of monthly goal';
  const missing = lb.notRanked
    ? ` · ${lb.notRanked} without a goal set${isToday ? '' : ' this month'}`
    : '';
  const foot = `<div class="sglb-foot">Ranked by ${basis} · ${lb.totalRanked} studio${lb.totalRanked === 1 ? '' : 's'} ranked${missing}</div>`;

  const toggle = hasToday && hasMonth
    ? `<div class="sglb-toggle">
         <button class="${isToday ? '' : 'on'}" onclick="setLeaderboardMode('month')">This month</button>
         <button class="${isToday ? 'on' : ''}" onclick="setLeaderboardMode('today')">Today</button>
       </div>`
    : '';
  const title = isToday ? '🏆 Top Studios — Today' : `🏆 Top Studios — ${esc(monthLabel(data.month))}`;

  return `
    <div class="sglb">
      <div class="sglb-head"><div class="sglb-title">${title}</div>${toggle}</div>
      ${rows}${youRow}
      ${foot}
    </div>`;
}

async function loadGoalProgress(pin, studioId) {
  try {
    const data = await fetchGoalProgressWithPin(pin, studioId);
    renderGoalCard(data);
  } catch (e) {
    console.error('Sales goal load failed:', e);
  }
}

function startGoalRefresh() {
  if (_goalRefreshTimer) clearInterval(_goalRefreshTimer);
  _goalRefreshTimer = setInterval(() => {
    if (_studioViewStarted && _sessionPin) loadGoalProgress(_sessionPin, _sessionStudioId);
  }, GOAL_REFRESH_MS);
}

// ---------- Instagram (moved from index.html's Community Hub) ----------

async function fetchInstagramWithPin(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-instagram-data`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify(studioId ? { pin, studioId } : { pin })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function igNum(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-US');
}

function renderInstagramCard(data) {
  const container = document.getElementById('card-instagram');
  if (!container) return;
  if (!data || data.error || !data.studioId) { container.innerHTML = ''; return; }

  const studioName = STUDIO_NAMES[data.studioId] || data.studioId;
  const head = `<div class="card-head"><div class="title">📷 Instagram — ${esc(studioName)}</div>${data.username ? `<div class="ig-handle">@${esc(String(data.username).replace(/^@/, ''))}</div>` : ''}</div>`;

  if (data.state === 'not_connected') {
    container.innerHTML = head + `<div class="goal-note">Instagram isn't connected for this studio yet.</div>`;
    return;
  }
  if (data.state === 'no_snapshot_yet') {
    container.innerHTML = head + `<div class="goal-note">Connected — waiting for the first sync.</div>`;
    return;
  }

  let changeHtml = '';
  if (data.followerChange != null) {
    const c = data.followerChange;
    const cls = c > 0 ? 'up' : c < 0 ? 'down' : 'flat';
    const arrow = c > 0 ? '↑' : c < 0 ? '↓' : '→';
    changeHtml = `<div class="ig-change ${cls}">${arrow} ${igNum(Math.abs(c))} in ${data.changeSinceDays} day${data.changeSinceDays === 1 ? '' : 's'}</div>`;
  }

  const tile = (label, value, extra) => `
    <div class="friday-tile">
      <div class="eyebrow">${esc(label)}</div>
      <div class="pct">${igNum(value)}</div>
      ${extra || ''}
    </div>`;

  // 28-day insights (instagram_daily_metrics — same as the admin Instagram tab).
  // Falls back to the old snapshot numbers if insights aren't in yet.
  const ins = data.insights;
  const sub = t => `<div class="ig-tile-sub">${t}</div>`;
  let tiles;
  if (ins && ins.month) {
    // This calendar month (since the first day tracked this month).
    const mo = ins.month;
    const lastDays = ins.lastPostAt ? Math.floor((Date.now() - new Date(ins.lastPostAt).getTime()) / 864e5) : null;
    const lastTxt = lastDays == null ? '' : lastDays === 0 ? 'last post today' : lastDays === 1 ? 'last post yesterday' : `last post ${lastDays} days ago`;
    const per = mo.posts ? Math.round((mo.interactions || 0) / mo.posts) : null;
    tiles = `
        ${tile('Followers', data.followers, changeHtml)}
        ${tile(`Views · ${mo.monthLabel}`, mo.views, sub(mo.nonFollowerPct != null
          ? `<strong>${mo.nonFollowerPct}% from people who don't follow you</strong>${mo.splitFromFirst ? '' : ` (since ${esc(mo.splitSinceLabel)})`}`
          : 'times your posts &amp; Reels were seen'))}
        ${tile(`Engagement · ${mo.monthLabel}`, mo.interactions, sub(per != null ? `likes, comments, shares &amp; saves · about ${igNum(per)} a post` : 'likes, comments, shares &amp; saves'))}
        ${tile(`Posts · ${mo.monthLabel}`, mo.posts, sub([mo.reels != null ? `${igNum(mo.reels)} Reel${mo.reels === 1 ? '' : 's'}` : '', lastTxt].filter(Boolean).join(' · ')))}
        ${tile(`Link taps · ${mo.monthLabel}`, mo.linkTaps, sub('taps on your website &amp; booking links'))}`;
  } else if (ins) {
    const reachX = ins.reach28 != null && data.followers ? (ins.reach28 / data.followers) : null;
    const engRate = ins.reach28 ? ((ins.interactions28 || 0) / ins.reach28 * 100) : null;
    const lastDays = ins.lastPostAt ? Math.floor((Date.now() - new Date(ins.lastPostAt).getTime()) / 864e5) : null;
    const lastTxt = lastDays == null ? '' : lastDays === 0 ? 'last post today' : lastDays === 1 ? 'last post yesterday' : `last post ${lastDays} days ago`;
    const engTile = `
      <div class="friday-tile">
        <div class="eyebrow">Engagement · 28 days</div>
        <div class="pct">${engRate == null ? '—' : engRate.toFixed(1) + '%'}</div>
        ${sub(ins.interactions28 != null ? `${igNum(ins.interactions28)} likes, comments, shares &amp; saves` : '')}
      </div>`;
    tiles = `
        ${tile('Followers', data.followers, changeHtml)}
        ${tile('Reach · 28 days', ins.reach28, sub(reachX == null ? 'accounts reached' : `${reachX.toFixed(1)}× your followers`))}
        ${engTile}
        ${tile('Posts · 30 days', ins.posts30, sub([ins.reels30 != null ? `${igNum(ins.reels30)} Reels` : '', lastTxt].filter(Boolean).join(' · ')))}
        ${tile('Link taps · 28 days', ins.linkTaps28, sub('taps on your website &amp; booking links'))}`;
  } else {
    tiles = `
        ${tile('Followers', data.followers, changeHtml)}
        ${tile('Reach', data.reach)}
        ${tile('Profile Views', data.profileViews)}
        ${tile('Engagements', data.engagements)}`;
  }
  const topPost = ins && ins.topPostUrl
    ? `<a class="ig-top-post" href="${escAttr(ins.topPostUrl)}" target="_blank" rel="noopener">⭐ Your best post lately${ins.topPostInteractions != null ? ` · ${igNum(ins.topPostInteractions)} likes + comments` : ''} — view it on Instagram ↗</a>`
    : '';

  container.innerHTML = head
    + (data.state === 'stale' ? `<div class="ig-warn">⚠ The last update failed — showing the most recent good numbers.</div>` : '')
    + `<div class="ig-grid${ins ? ' five' : ''}">${tiles}</div>`
    + topPost
    + igMonthHtml(data)
    + `<div class="ig-foot">${data.asOf ? 'Followers as of ' + esc(data.asOf) : 'As of — (studio timezone unavailable)'}${ins && ins.month ? ` · ${esc(ins.month.monthLabel)} numbers ${ins.month.fromFirst ? 'from the 1st' : 'since ' + esc(ins.month.sinceLabel)} through ${esc(ins.month.throughLabel)}` : (ins && ins.metricDate ? ' · insights as of ' + esc(new Date(ins.metricDate + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })) : '')}</div>`;
}

// Followers gained this month (since the first reading this month) and last
// month (final once the 1st's reading is in).
function igMonthHtml(data) {
  const m = data.monthGrowth, l = data.lastMonthGrowth;
  if (!m && !l) return '';
  const fmt = n => `${n > 0 ? '+' : ''}${igNum(n)}`;
  const cls = n => n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  return `<div class="ig-months">
      ${m ? `<div class="ig-month"><div class="eyebrow">${esc(m.monthLabel)} so far</div><div class="ig-month-val ${cls(m.gained)}">${fmt(m.gained)} followers</div><div class="ig-month-sub">since ${esc(m.sinceLabel)}</div></div>` : ''}
      ${l ? `<div class="ig-month"><div class="eyebrow">${esc(l.monthLabel)}</div><div class="ig-month-val ${cls(l.gained)}">${fmt(l.gained)} followers</div><div class="ig-month-sub">final · from ${esc(l.sinceLabel)}</div></div>` : ''}
    </div>`;
}

async function loadInstagram(pin, studioId) {
  try {
    renderInstagramCard(await fetchInstagramWithPin(pin, studioId));
  } catch (e) {
    console.error('Instagram load failed:', e);
    const c = document.getElementById('card-instagram');
    if (c) c.innerHTML = `<div class="card-head"><div class="title">📷 Instagram</div></div><div class="goal-note">Couldn't load Instagram right now. Try refreshing the page.</div>`;
  }
}

// ---------- Daily Check-Ins (admin-only for now, simple count) ----------

async function fetchCheckinCountWithPin(pin, studioId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/community-checkin-data`, {
    method: 'POST',
    headers: await fnHeaders(),
    body: JSON.stringify({ pin, studioId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderCheckinCard(data) {
  const container = document.getElementById('card-checkins');
  if (!container) return;

  if (!data || data.error || !data.studioId) {
    container.innerHTML = '';
    return;
  }

  const studioName = STUDIO_NAMES[data.studioId] || data.studioId;
  const label = monthLabel(data.month);

  container.innerHTML = `
    <div class="card-head">
      <div class="title">📋 Daily Check-Ins — ${esc(studioName)}</div>
    </div>
    <div class="friday-tile">
      <div class="eyebrow">${esc(label)} — Submissions</div>
      <div class="pct">${data.count}</div>
    </div>`;
}

async function loadCheckinCount(pin, studioId) {
  try {
    const data = await fetchCheckinCountWithPin(pin, studioId);
    renderCheckinCard(data);
  } catch (e) {
    console.error('Check-in count load failed:', e);
  }
}


// ---------- ⚡ Flash Challenges (studio view) ----------
let _flashData = null, _flashTimer = null, _flashTick = null;

// =====================================================================================================================
// 📣 Influencer posts (influencer_reports.sql): the coordinator reports an influencer collaboration (who, what was agreed, the post
// link(s) and screenshot(s)); home office approves it in admin → Points → 📣 Influencer posts (1,000 points to the coordinator).
// =====================================================================================================================
let _infl = { studio: null, rows: [], edit: null, shots: [] };
const INFL_ST = { submitted: '🟡 Waiting for home office', approved: '✅ Approved', returned: '↩️ Sent back' };
async function inflLoad(studioId) {
  _infl.studio = studioId || _sessionStudioId;
  try { const r = await sb.rpc('hub_influencer_reports', { p_studio: _infl.studio }); _infl.rows = r.error ? null : (r.data || []); } catch (e) { _infl.rows = null; }
  inflDraw();
}
function inflDraw() {
  const el = document.getElementById('infl-strip'); if (!el) return;
  if (_infl.rows === null) { el.style.display = 'none'; return; }   // (influencer_reports.sql not run yet)
  const R = _infl.rows.slice(0, 4);
  el.style.display = '';
  el.innerHTML = `<div class="infl-card"><div class="infl-head"><b>📣 Influencer posts</b><span class="fd-sm">1,000 points for each influencer collaboration home office approves</span>
      <button class="ho-btn primary" onclick="inflOpen()">+ Report an influencer post</button></div>
    ${R.length ? R.map(r => `<div class="infl-row"><span><b>@${esc(String(r.handle || '').replace(/^@/, ''))}</b>${r.influencer_name ? ' · ' + esc(r.influencer_name) : ''} <span class="fd-sm">${esc(r.platform || '')}${r.post_date ? ' · ' + esc(r.post_date) : ''}</span></span>
        <span>${r.status === 'approved' ? `✅ +${Number(r.points_awarded || 0).toLocaleString()} points` : esc(INFL_ST[r.status] || r.status)}
        ${r.status === 'returned' ? `<span class="fd-sm">${esc(r.review_note || '')}</span> <button class="ho-btn sm" onclick="inflOpen('${escAttr(r.id)}')">Fix and send again</button>` : ''}</span></div>`).join('') : ''}</div>`;
}
function inflOpen(id) {
  const r = id ? (_infl.rows || []).find(x => x.id === id) || {} : {};
  _infl.edit = id || null; _infl.shots = (r.screenshots || []).slice();
  openDutySheet(`<h3>📣 Report an influencer post</h3>
    <p class="ho-intro">For a collaboration with an influencer: what you agreed, and proof they posted. Home office checks it and approves the points.</p>
    ${r.review_note ? `<div class="me-msg err">Home office: ${esc(r.review_note)}</div>` : ''}
    <div class="me-form">
      <label>Influencer's name<input id="in-name" value="${escAttr(r.influencer_name || '')}"></label>
      <label>Their @handle<input id="in-handle" value="${escAttr(r.handle || '')}" placeholder="@name"></label>
      <label>Platform<select id="in-plat">${['instagram', 'tiktok', 'facebook', 'youtube', 'other'].map(x => `<option value="${x}"${(r.platform || 'instagram') === x ? ' selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
      <label>Followers (about)<input id="in-fol" type="number" min="0" value="${escAttr(r.followers || '')}"></label>
      <label class="me-wide">What was agreed?<textarea id="in-agree" rows="3" placeholder="e.g. Comped workshop for 2 → 1 reel and 2 stories, tagging the studio">${esc(r.agreement || '')}</textarea></label>
      <label>Date posted<input id="in-date" type="date" value="${escAttr(r.post_date || localDateStr(new Date()))}"></label>
      <label class="me-wide">Link(s) to the post (one per line)<textarea id="in-urls" rows="2" placeholder="https://www.instagram.com/reel/…">${esc((r.post_urls || []).join('\n'))}</textarea></label>
      <label class="me-wide">Screenshot(s) of the post<input id="in-file" type="file" accept="image/*" multiple onchange="inflUpload(this)"></label>
      <div class="me-wide infl-shots" id="in-shots"></div>
      <label class="me-wide">Anything else? (optional)<textarea id="in-note" rows="2">${esc(r.note || '')}</textarea></label>
    </div><div id="in-msg"></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="in-go" onclick="inflSend()">Send to home office</button></div>`);
  inflShots();
}
function inflShots() {
  const el = document.getElementById('in-shots'); if (!el) return;
  el.innerHTML = _infl.shots.map((u, i) => `<span class="infl-shot"><img src="${escAttr(u)}" alt=""><button title="Remove" onclick="_infl.shots.splice(${i},1);inflShots()">×</button></span>`).join('');
}
async function inflUpload(input) {
  const files = Array.from(input.files || []), msg = document.getElementById('in-msg');
  for (const f of files) {
    msg.innerHTML = '<div class="goal-note">Uploading…</div>';
    try { _infl.shots.push(await uploadAttachment(f)); } catch (e) { msg.innerHTML = `<div class="me-msg err">A screenshot didn't upload: ${esc(e.message || e)}</div>`; return; }
  }
  msg.innerHTML = ''; input.value = ''; inflShots();
}
async function inflSend() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim(), msg = document.getElementById('in-msg'), btn = document.getElementById('in-go');
  const p = { id: _infl.edit, studio_id: _infl.studio, reported_by: (_studioData && (_studioData.staffName || _studioData.coordinatorName)) || '',
    influencer_name: v('in-name'), handle: v('in-handle'), platform: v('in-plat'), followers: v('in-fol'), agreement: v('in-agree'), post_date: v('in-date'),
    post_urls: v('in-urls').split(/\s+/).filter(Boolean), screenshots: _infl.shots, note: v('in-note') };
  btn.disabled = true;
  const { error } = await sb.rpc('hub_influencer_report_save', { p });
  btn.disabled = false;
  if (error) { msg.innerHTML = `<div class="me-msg err">${esc(/hub_influencer_report_save/.test(error.message) ? 'Run influencer_reports.sql in Supabase first.' : error.message)}</div>`; return; }
  closeDutySheet(); alert('Sent! Home office will check it and approve the points.'); inflLoad(_infl.studio);
}

async function loadFlashChallenges(studioId) {
  const strip = document.getElementById('flash-strip');
  if (!strip) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/community-flash-data`, {
      method: 'POST', headers: await fnHeaders(),
      body: JSON.stringify({ pin: _sessionPin, studioId: studioId || _sessionStudioId })
    });
    const d = await res.json();
    if (!res.ok || d.error) throw new Error(d.error || 'Request failed');
    _flashData = d;
    renderFlashChallenges();
  } catch (e) {
    console.error('Flash challenges load failed:', e);  // never block the page
    strip.style.display = 'none';
  }
  if (!_flashTimer) _flashTimer = setInterval(() => { if (_studioViewStarted) loadFlashChallenges(_sessionStudioId); }, 120000);
  if (!_flashTick) _flashTick = setInterval(updateFlashCountdowns, 30000);
}
function flashTimeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!(ms > 0)) return 'Ended';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  return h ? `${h}h ${m}m left` : `${m}m left`;
}
function updateFlashCountdowns() {
  document.querySelectorAll('[data-flash-ends]').forEach(el => { el.textContent = flashTimeLeft(el.dataset.flashEnds); });
}
function renderFlashChallenges() {
  const strip = document.getElementById('flash-strip');
  const list = (_flashData && _flashData.challenges) || [];
  if (!strip) return;
  if (!list.length) { strip.style.display = 'none'; strip.innerHTML = ''; return; }
  strip.innerHTML = list.map(c => {
    const comp = c.completion || null;
    const done = comp && comp.status === 'approved';
    let body = '';
    if (c.checkType === 'pos_sales') {
      const q = Math.min(c.qty || 0, c.target || 0), pct = c.target ? Math.round(q / c.target * 100) : 0;
      body = `<div class="flash-bar"><div style="width:${pct}%"></div></div>
        <div class="flash-meta"><span>${fmtPts(c.qty || 0)} / ${fmtPts(c.target)} sold in studio</span>
          <span>${done ? (comp.points ? `✅ Done! +${fmtPts(comp.points)} points` : '✅ Done!') : (c.qty >= c.target ? '✅ Target hit — points on the way' : `${fmtPts(c.target - (c.qty || 0))} to go`)}</span></div>`;
    } else {
      let status = '';
      if (done) status = comp.points ? `✅ Approved! +${fmtPts(comp.points)} points` : '✅ Approved!';
      else if (comp && comp.status === 'claimed') status = '🟡 Claimed — waiting for home office';
      else if (comp && comp.status === 'returned') status = `↩️ Sent back${comp.reviewNote ? ': ' + esc(comp.reviewNote) : ''}`;
      const canClaim = _flashData.canClaim && (!comp || comp.status === 'returned');
      body = `<div class="flash-meta" style="margin-top:10px"><span>${status || (canClaim ? 'Done it? Let home office know.' : 'Your coordinator claims it when it\'s done.')}</span>
          ${canClaim ? `<button onclick="claimFlashChallenge('${esc(c.id)}')">We did it! 🎉</button>` : ''}</div>`;
    }
    return `<div class="flash-card${done ? ' done' : ''}">
        <div class="flash-top">
          <div><div class="flash-eyebrow">⚡ Flash challenge</div>
            <div class="flash-title">${esc(c.title)}</div>
            ${c.description ? `<div class="flash-desc">${esc(c.description)}</div>` : ''}</div>
          <div class="flash-pts">+${fmtPts(c.points)} pts<span class="flash-time" data-flash-ends="${esc(c.endsAt)}">${flashTimeLeft(c.endsAt)}</span></div>
        </div>${body}</div>`;
  }).join('');
  strip.style.display = '';
}
async function claimFlashChallenge(id) {
  const c = ((_flashData && _flashData.challenges) || []).find(x => x.id === id);
  if (!c || !_sessionPin) return;
  const note = prompt(`"${c.title}"\n\nWhat did you do? (a link, or a few words)`);
  if (note === null) return;
  if (!note.trim()) { alert('Please add a short note.'); return; }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/community-flash-data`, {
      method: 'POST', headers: await fnHeaders(),
      body: JSON.stringify({ pin: _sessionPin, studioId: _sessionStudioId, action: 'claim', challengeId: id, note: note.trim() })
    });
    const out = await res.json();
    if (!res.ok || out.error) throw new Error(out.error || 'Could not claim');
    alert('Claimed! Home office will check it and approve the points.');
  } catch (e) { alert(e.message || 'Could not claim that challenge.'); }
  loadFlashChallenges(_sessionStudioId);
}

// Studio-level cards (studio login is enough). _sessionPin is passed when
// unlocked so the greeting can use the coordinator's name.

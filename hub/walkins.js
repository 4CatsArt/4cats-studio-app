// hub/walkins.js: 🚶 Walk-ins report for home office (Nov 13 2026; hub_walkins.sql, hub_walkin_report). Who walks in, when and for
// what, for schedule planning: walk-ins not on the schedule and walk-ins into running classes (both from Front desk), plus the
// Shopify POS "STUDIO drop in" history imported from Sep 1 2026 (studio, day and time; no project or customer).
// Loaded by hub.html after calendar.js.

if (typeof PANES !== 'undefined' && !PANES.includes('walkin-pane')) PANES.push('walkin-pane');
const _wr = { range: '90', from: '', to: '', studio: '', data: null, err: '', loading: false, sort: 'people' };
const WR_DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];
const wrIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function wrDates() {
  const t = new Date(), today = wrIso(t), back = n => { const d = new Date(t); d.setDate(d.getDate() - n); return wrIso(d); };
  if (_wr.range === '30') return [back(29), today];
  if (_wr.range === '90') return [back(89), today];
  if (_wr.range === 'all') return ['2026-09-01', today];
  if (_wr.range === 'year') return [t.getFullYear() + '-01-01', today];
  return [_wr.from || back(29), _wr.to || today];
}
function openWalkinPane() {
  showOnlyPane('walkin-pane'); setActiveNav('nav-walkins'); wrStyles(); wrLoad();
}
async function wrLoad() {
  const [a, b] = wrDates(); _wr.loading = true; _wr.err = ''; wrRender();
  const { data, error } = await sb.rpc('hub_walkin_report', { p_from: a, p_to: b, p_studio: _wr.studio || null });
  _wr.loading = false;
  if (error) { _wr.err = /hub_walkin_report/.test(error.message) ? 'The walk-in report isn’t set up yet (run the walk-in report SQL).' : error.message; _wr.data = null; }
  else _wr.data = data || {};
  wrRender();
}
const wrHr = h => (h % 12 || 12) + (h < 12 ? 'am' : 'pm');
const wrName = id => (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[id]) || id;
const wrNum = n => Number(n || 0).toLocaleString('en-CA');
const wrPct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
function wrWhat(x) {   // what they came for, in plain words
  if (x.kind === 'running') return '↪ Joined: ' + x.what;
  if (x.kind === 'drop_in') return '🧾 ' + String(x.what || '').replace(/^POS: /, '') + ' (POS)';
  if (x.kind === 'glazing') return '🎨 Glazing';
  return '🧩 ' + x.what;
}
function wrRender() {
  const el = document.getElementById('walkin-pane'); if (!el) return;
  const [a, b] = wrDates(), D = _wr.data, T = (D && D.totals) || {};
  let h = `<div class="wr"><div class="wr-top"><div class="pts-page-title" style="margin:0">🚶 Walk-ins</div>
    <div class="wr-filters"><select id="wr-range" onchange="_wr.range=this.value;wrRender();if(this.value!=='custom')wrLoad()">
      ${[['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'Since Sep 1, 2026'], ['year', 'This year'], ['custom', 'Choose dates…']].map(o => `<option value="${o[0]}"${_wr.range === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      ${_wr.range === 'custom' ? `<input type="date" id="wr-from" value="${escAttr(a)}" onchange="_wr.from=this.value;wrLoad()"> to <input type="date" id="wr-to" value="${escAttr(b)}" onchange="_wr.to=this.value;wrLoad()">` : ''}
      <select id="wr-studio" onchange="_wr.studio=this.value;wrLoad()"><option value="">All studios</option>${Object.keys(STUDIO_NAMES).map(id => `<option value="${escAttr(id)}"${_wr.studio === id ? ' selected' : ''}>${esc(STUDIO_NAMES[id])}</option>`).join('')}</select></div></div>
    <p class="wr-sub">Who walks in, when, and for what: walk-ins for something not on the schedule and into running classes (from Front desk), and the Shopify POS drop-ins from Sep 1 (studio, day and time only). Times are each studio’s own.</p>`;
  if (_wr.err) h += `<div class="wr-card"><p class="wr-warn">${esc(_wr.err)}</p></div>`;
  else if (!D) h += `<div class="wr-card"><p class="wr-sub">${_wr.loading ? 'Loading…' : ''}</p></div>`;
  else if (!Number(T.people)) h += `<div class="wr-card"><p class="wr-sub">No walk-ins between ${esc(a)} and ${esc(b)}${_wr.studio ? ' at ' + esc(wrName(_wr.studio)) : ''}.</p></div>`;
  else {
    const P = Number(T.people);
    h += `<div class="wr-tiles">
      <div class="wr-tile"><b>${wrNum(P)}</b><span>people walked in</span><em>${wrNum(T.visits)} visits${_wr.studio ? '' : ' · ' + T.studios + ' studios'}</em></div>
      <div class="wr-tile"><b>${wrNum(T.unscheduled)}</b><span>not on the schedule</span><em>${wrPct(T.unscheduled, P)} · glazing or a workshop</em></div>
      <div class="wr-tile"><b>${wrNum(T.running)}</b><span>joined something running</span><em>${wrPct(T.running, P)} · booked at Front desk</em></div>
      <div class="wr-tile"><b>${wrNum(T.pos)}</b><span>POS drop-ins</span><em>${wrPct(T.pos, P)} · Shopify POS, before Front desk</em></div></div>`;
    // 🗓️ the weekday × hour grid
    const cell = {}; let max = 0, lo = 23, hi = 0;
    (D.grid || []).forEach(g => { const k = g.dow + '|' + g.hr, v = Number(g.people); cell[k] = (cell[k] || 0) + v; max = Math.max(max, cell[k]); if (g.hr >= 7 && g.hr <= 21) { lo = Math.min(lo, g.hr); hi = Math.max(hi, g.hr); } });
    if (lo > hi) { lo = 9; hi = 18; }
    const hours = []; for (let x = lo; x <= hi; x++) hours.push(x);
    const dayTot = d => hours.reduce((t, x) => t + (cell[d + '|' + x] || 0), 0);
    h += `<div class="wr-card"><h3>🗓️ When they walk in</h3><p class="wr-sub">People by weekday and hour. Darker is busier.</p><div class="wr-gridwrap"><table class="wr-grid"><thead><tr><th></th>${hours.map(x => `<th>${wrHr(x)}</th>`).join('')}<th>Day</th></tr></thead><tbody>
      ${WR_DAYS.map(([n, d]) => `<tr><th>${n}</th>${hours.map(x => { const v = cell[d + '|' + x] || 0, a2 = max ? v / max : 0;
        return `<td style="background:rgba(109,74,235,${(a2 * 0.85).toFixed(2)});color:${a2 > 0.5 ? '#fff' : 'inherit'}" title="${n} ${wrHr(x)}: ${v} ${v === 1 ? 'person' : 'people'}">${v || ''}</td>`; }).join('')}<td class="wr-daytot">${dayTot(d) || ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    // what they came for, and top projects
    const what = D.by_what || [], wmax = Math.max(1, ...what.map(x => Number(x.people)));
    const pr = D.projects || [], pmax = Math.max(1, ...pr.map(x => Number(x.people)));
    h += `<div class="wr-two"><div class="wr-card"><h3>What they came for</h3>${what.map(x => `<div class="wr-bar"><span class="wr-bl">${esc(wrWhat(x))}</span><span class="wr-bt"><i style="width:${Math.round(Number(x.people) / wmax * 100)}%"></i></span><b>${wrNum(x.people)}</b></div>`).join('')}</div>
      <div class="wr-card"><h3>Top projects</h3>${pr.length ? pr.map(x => `<div class="wr-bar"><span class="wr-bl">${esc(x.name)}</span><span class="wr-bt"><i style="width:${Math.round(Number(x.people) / pmax * 100)}%"></i></span><b>${wrNum(x.people)}</b></div>`).join('') : '<p class="wr-sub">No projects recorded yet: they come from Front desk walk-ins (POS drop-ins have none).</p>'}</div></div>`;
    // by studio
    if (!_wr.studio) {
      const rows = (D.by_studio || []).slice().sort((x, y) => _wr.sort === 'name' ? wrName(x.studio_id).localeCompare(wrName(y.studio_id)) : Number(y[_wr.sort]) - Number(x[_wr.sort]));
      const th = (k, l) => `<th><button class="wr-th${_wr.sort === k ? ' on' : ''}" onclick="_wr.sort='${k}';wrRender()">${l}</button></th>`;
      h += `<div class="wr-card"><h3>By studio</h3><div class="wr-gridwrap"><table class="wr-tbl"><thead><tr>${th('name', 'Studio')}${th('people', 'People')}${th('unscheduled', 'Not on schedule')}${th('running', 'Joined running')}${th('pos', 'POS drop-ins')}<th></th></tr></thead><tbody>
        ${rows.map(x => `<tr><td><button class="wr-link" onclick="_wr.studio='${escAttr(x.studio_id)}';wrLoad()">${esc(wrName(x.studio_id))}</button></td><td><b>${wrNum(x.people)}</b></td><td>${wrNum(x.unscheduled)}</td><td>${wrNum(x.running)}</td><td>${wrNum(x.pos)}</td>
          <td class="wr-mini"><span class="wr-bt"><i style="width:${Math.round(Number(x.people) / Math.max(1, ...rows.map(r => Number(r.people))) * 100)}%"></i></span></td></tr>`).join('')}</tbody></table></div></div>`;
    } else h += `<p class="wr-sub"><button class="wr-link" onclick="_wr.studio='';wrLoad()">← All studios</button></p>`;
    // week by week
    const wk = D.weeks || [], kmax = Math.max(1, ...wk.map(x => Number(x.people)));
    h += `<div class="wr-card"><h3>Week by week</h3><p class="wr-sub">Each bar is a week (Sunday to Saturday). <span class="wr-key wr-k1"></span> Front desk <span class="wr-key wr-k2"></span> POS drop-ins</p>
      <div class="wr-weeks">${wk.map(x => { const p = Number(x.people), q = Number(x.pos); const d = new Date(String(x.week) + 'T12:00:00');
        return `<div class="wr-wk" title="Week of ${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}: ${p} people (${q} POS)"><div class="wr-wcol" style="height:${Math.round(p / kmax * 100)}%"><i style="height:${p ? Math.round(q / p * 100) : 0}%"></i></div><span>${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span><b>${p}</b></div>`; }).join('')}</div></div>`;
  }
  el.innerHTML = h + '</div>';
}
function wrStyles() {
  if (document.getElementById('wr-css')) return;
  const s = document.createElement('style'); s.id = 'wr-css';
  s.textContent = `.wr { padding: 4px 2px 40px; max-width: 1200px; } .wr-top { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: space-between; }
  .wr-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .wr-filters select, .wr-filters input { padding: 7px 10px; border: 1px solid var(--border, #ddd); border-radius: 10px; font: inherit; background: #fff; }
  .wr-sub { color: #6b6a80; font-size: 13px; margin: 6px 0 12px; } .wr-warn { color: #b42318; }
  .wr-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 14px; }
  .wr-tile { background: #fff; border: 1px solid var(--border, #e6e4ef); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
  .wr-tile b { font-size: 28px; } .wr-tile span { font-weight: 700; } .wr-tile em { font-style: normal; color: #6b6a80; font-size: 12px; }
  .wr-card { background: #fff; border: 1px solid var(--border, #e6e4ef); border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; } .wr-card h3 { margin: 0 0 4px; font-size: 16px; }
  .wr-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; } .wr-two .wr-card { margin-bottom: 14px; }
  .wr-gridwrap { overflow-x: auto; } .wr-grid { border-collapse: separate; border-spacing: 3px; font-size: 12px; } .wr-grid th { font-weight: 700; color: #6b6a80; padding: 2px 4px; white-space: nowrap; }
  .wr-grid td { width: 42px; height: 30px; text-align: center; border-radius: 6px; background: #f4f3f9; font-weight: 700; } .wr-grid td.wr-daytot { background: none; color: #6b6a80; }
  .wr-bar { display: grid; grid-template-columns: minmax(120px, 1.4fr) 1fr 44px; gap: 8px; align-items: center; margin: 5px 0; font-size: 13px; } .wr-bar b { text-align: right; }
  .wr-bl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .wr-bt { display: block; height: 10px; border-radius: 6px; background: #f1eff8; overflow: hidden; } .wr-bt i { display: block; height: 100%; background: #6d4aeb; border-radius: 6px; }
  .wr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .wr-tbl td, .wr-tbl th { padding: 7px 8px; border-bottom: 1px solid #f0eef6; text-align: left; } .wr-mini { width: 22%; }
  .wr-th { border: 0; background: none; font: inherit; font-weight: 700; color: #6b6a80; cursor: pointer; padding: 0; } .wr-th.on { color: #1f1d2b; text-decoration: underline; }
  .wr-link { border: 0; background: none; font: inherit; color: #5b3fd6; cursor: pointer; padding: 0; text-align: left; }
  .wr-weeks { display: flex; gap: 6px; align-items: flex-end; height: 170px; overflow-x: auto; padding-top: 6px; } .wr-wk { flex: 1 0 34px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 11px; color: #6b6a80; }
  .wr-wcol { width: 70%; background: #6d4aeb; border-radius: 6px 6px 0 0; display: flex; flex-direction: column; justify-content: flex-end; min-height: 2px; } .wr-wcol i { display: block; background: #c8bdf6; border-radius: 0; }
  .wr-wk b { color: #1f1d2b; } .wr-key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: middle; margin-left: 8px; } .wr-k1 { background: #6d4aeb; } .wr-k2 { background: #c8bdf6; }`;
  document.head.appendChild(s);
}

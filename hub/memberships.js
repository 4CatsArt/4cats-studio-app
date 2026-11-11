// hub/memberships.js: Home office → ⭐ Memberships (find, refund, credit, end, dates).
// Moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html after its main script.
// ---------- Home office → ⭐ Memberships (hub_membership_refunds.sql + membership-checkout staff_refund) ----------
// Find any membership or gift membership by name or email (bought on World: they don't always have bookings, so Families can miss
// them). For exceptions: refund all or part to their card, and/or end it now (its auto-renew stops). Owners and "Can fix memberships".
let _mb = { q: '', res: null, err: '', open: null, msg: '' };
const MB_PLAN = p => p === 'workshops' ? 'Workshops Only' : '4Cats Member';
function openMembPane() { showOnlyPane('memb-pane'); setActiveNav('nav-memb'); mbDraw(); }
async function mbFind() {
  const q = ((document.getElementById('mb-q') || {}).value || '').trim(); _mb.q = q; _mb.msg = '';
  _mb.res = null; _mb.err = ''; mbDraw();
  const { data, error } = await sb.rpc('hub_memberships_find', { p_q: q });
  _mb.err = error ? (/hub_memberships_find/.test(error.message) ? 'Run hub_membership_refunds.sql in Supabase first.' : error.message) : '';
  _mb.res = error ? null : data; mbDraw();
}
async function mbCall(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/membership-checkout`, { method: 'POST', headers: await fnHeaders(), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({})); if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status)); return d;
}
function mbDraw() {
  const el = document.getElementById('memb-pane'); if (!el) return;
  const R = _mb.res, d = x => x ? new Date(String(x).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const today = new Date().toLocaleDateString('en-CA');
  const live = m => !['cancelled', 'ended', 'expired'].includes(m.status) && (!m.ends_on || String(m.ends_on) >= today);
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">⭐ Memberships</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Find a membership or a gift membership by name or email: the member’s, or whoever bought the gift. For exceptions, refund it (all or part, to their card) and/or end it now.</div>
    <div class="fd-inline" style="max-width:520px"><input id="mb-q" placeholder="Name or email" value="${escAttr(_mb.q)}" onkeydown="if(event.key==='Enter')mbFind()"><button class="ho-btn primary" onclick="mbFind()">Find</button></div>
    ${_mb.err ? `<p class="fd-msg">${esc(_mb.err)}</p>` : ''}${_mb.msg ? `<p class="fd-ok">${esc(_mb.msg)}</p>` : ''}`;
  if (R) {
    const M = R.memberships || [], G = R.gifts || [];
    h += `<h4 style="margin:16px 0 6px">Memberships (${M.length})</h4>` + (M.length ? `<div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr><th>Member</th><th>Plan</th><th>Dates</th><th>Status</th><th>How</th><th></th></tr></thead><tbody>` +
      M.map(m => `<tr><td><b>${esc(m.name || '')}</b><br><span class="fd-sm">${esc(m.email || '')}</span></td><td>${esc(MB_PLAN(m.plan))}${m.discount_kind ? `<br><span class="fd-sm">${esc(m.discount_kind)}</span>` : ''}</td>
        <td>${esc(d(m.starts_on))} – ${esc(d(m.ends_on))}${m.auto_renew ? '<br><span class="fd-sm">renews automatically</span>' : ''}</td>
        <td>${live(m) ? '<span class="fd-ok" style="font-size:12px">● active</span>' : `<span class="fd-sm">${esc(m.status || 'ended')}</span>`}${m.refunded_amount ? `<br><span class="fd-sm">$${Number(m.refunded_amount).toFixed(2)} refunded</span>` : ''}${m.credit_amount ? `<br><span class="fd-sm">$${Number(m.credit_amount).toFixed(2)} credit ${esc(m.credit_code || '')}</span>` : ''}${m.test_mode ? '<br><span class="fd-pill">test</span>' : ''}</td>
        <td><span class="fd-sm">${esc(m.source || '')}</span></td>
        <td style="white-space:nowrap">${m.has_payment || live(m) ? `<button class="ho-btn sm" onclick="mbOpen('membership','${m.id}')">Refund, credit or end…</button>` : ''}
          <button class="ho-btn sm" onclick="mbDatesOpen('${m.id}')">Dates & auto-renew…</button>
          ${(m.events || []).length ? `<button class="ho-btn sm" onclick="_mb.hist=_mb.hist==='${m.id}'?null:'${m.id}';mbDraw()">History (${m.events.length})</button>` : ''}
          ${m.stripe_subscription_id || m.stripe_customer_id ? `<a class="fd-sm" target="_blank" rel="noopener" href="https://dashboard.stripe.com/${m.test_mode ? 'test/' : ''}${m.stripe_subscription_id ? 'subscriptions/' + encodeURIComponent(m.stripe_subscription_id) : 'customers/' + encodeURIComponent(m.stripe_customer_id)}">Stripe ↗</a>` : ''}</td></tr>
        ${_mb.hist === m.id ? `<tr><td colspan="6"><div class="mb-hist">${(m.events || []).map(e => `<div>${e.at ? `<b>${esc(new Date(e.at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }))}</b> · ` : ''}${esc(String(e.kind).replace(/_/g, ' '))}${e.detail ? ` <span class="fd-sm">${esc(mbDetail(e.detail))}</span>` : ''}</div>`).join('')}</div></td></tr>` : ''}`).join('') + '</tbody></table></div>' : '<p class="fd-sm">None.</p>');
    h += `<h4 style="margin:16px 0 6px">Gift memberships (${G.length})</h4>` + (G.length ? `<div class="fd-tbl-wrap"><table class="fd-tbl"><thead><tr><th>Bought by</th><th>For</th><th>Plan</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody>` +
      G.map(g => `<tr><td><b>${esc(g.buyer_name || '')}</b><br><span class="fd-sm">${esc(g.buyer_email || '')}</span></td><td>${esc(g.recipient_name || '')}<br><span class="fd-sm">${esc(g.recipient_email || '')}</span></td>
        <td>${esc(MB_PLAN(g.plan))}<br><span class="fd-sm">code ${esc(g.code || '')}</span></td><td>${g.amount != null ? '$' + (Number(g.amount) + Number(g.tax || 0)).toFixed(2) : ''}<br><span class="fd-sm">${esc(d(g.paid_at || g.created_at))}</span></td>
        <td>${esc(g.status || '')}${g.refunded_amount ? `<br><span class="fd-sm">$${Number(g.refunded_amount).toFixed(2)} refunded</span>` : ''}${g.credit_amount ? `<br><span class="fd-sm">$${Number(g.credit_amount).toFixed(2)} credit ${esc(g.credit_code || '')}</span>` : ''}${g.test_mode ? '<br><span class="fd-pill">test</span>' : ''}</td>
        <td>${g.has_payment && g.status !== 'pending' ? `<button class="ho-btn sm" onclick="mbOpen('gift','${g.id}')">Refund or credit…</button>` : ''}</td></tr>`).join('') + '</tbody></table></div>' : '<p class="fd-sm">None.</p>');
  } else if (_mb.q && !_mb.err) h += '<p class="fd-sm">Searching…</p>';
  if (_mb.open) h += mbSheetHtml();
  if (_mb.dates) h += mbDatesHtml();
  el.innerHTML = h;
}
async function mbOpen(kind, id) {
  const R = _mb.res || {}, row = (kind === 'gift' ? R.gifts : R.memberships || []).find(x => x.id === id) || {};
  _mb.open = { kind, id, row, q: null, amount: '', method: 'refund', days: 365, end: kind !== 'gift' || row.status !== 'redeemed', email: true, note: '' }; mbDraw();
  try { _mb.open.q = await mbCall({ action: 'staff_refund_quote', kind, id }); } catch (e) { _mb.open.q = { err: e.message }; }
  if (_mb.open) { if (_mb.open.q && !_mb.open.q.found) _mb.open.method = 'none'; mbDraw(); }
}
function mbSheetHtml() {
  const O = _mb.open, r = O.row, Q = O.q, gift = O.kind === 'gift';
  const who = gift ? (r.buyer_name || r.buyer_email) : (r.name || r.email);
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_mb.open=null;mbDraw()}"><div class="fd-sheet" role="dialog" aria-modal="true">
    <h3>${gift ? 'Gift membership' : 'Membership'}: ${esc(who || '')}</h3><p class="fd-sm">${esc(MB_PLAN(r.plan))}${gift ? ' · code ' + esc(r.code || '') + (r.recipient_name ? ' · for ' + esc(r.recipient_name) : '') : ''}</p>
    ${!Q ? '<p class="fd-sm">Looking up the payment in Stripe…</p>' : Q.err ? `<p class="fd-msg">${esc(Q.err)}</p>` : !Q.found ? '<p class="fd-warn">No Stripe payment found for this one (free, a gift code, or paid elsewhere): it can be ended, not refunded here.</p>'
      : `<p>Paid <b>$${Number(Q.paid).toFixed(2)}</b>${Q.paid_on ? ' on ' + esc(new Date(Q.paid_on + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })) : ''}${Q.refunded ? ` · $${Number(Q.refunded).toFixed(2)} already refunded` : ''}${Q.test ? ' · <span class="fd-pill">test</span>' : ''}</p>`}
    ${Q && !Q.err ? (() => { const pre = Q.pretax != null ? Number(Q.pretax) : null, tot = Q.found ? Number(Q.left) : null;
        const def = O.method === 'refund' || O.method === 'giftcard' ? tot : O.method === 'credit' ? (pre != null ? Math.min(pre, tot ?? pre) : tot) : null;
        const opt = (v, l, dis) => `<label class="fd-chk"${dis ? ' style="opacity:.45"' : ''}><input type="radio" name="mb-m" ${O.method === v ? 'checked' : ''} ${dis ? 'disabled' : ''} onchange="_mb.open.method='${v}';_mb.open.amount='';mbDraw()"> ${l}</label>`;
        return `<div class="mb-meth"><b>Give back</b>${opt('refund', '💳 Refund to their card', !Q.found)}${opt('credit', '🎟️ A World credit code <span class="fd-sm">(comes off before tax, so the before-tax amount)</span>')}${opt('giftcard', '🎁 A gift card <span class="fd-sm">(4cats.com or World; with tax)</span>')}${opt('none', 'Nothing')}</div>
        ${O.method !== 'none' ? `<label class="f">Amount ${def != null ? `<span class="fd-sm">(blank: $${Number(def).toFixed(2)})</span>` : ''}<input type="number" step="0.01" min="0.01" value="${escAttr(O.amount)}" oninput="_mb.open.amount=this.value" placeholder="${def != null ? Number(def).toFixed(2) : ''}"></label>` : ''}
        ${O.method === 'credit' || O.method === 'giftcard' ? `<label class="f">Good for<select onchange="_mb.open.days=+this.value">${[[30, '30 days'], [90, '90 days'], [365, '1 year'], [730, '2 years']].map(d => `<option value="${d[0]}"${O.days === d[0] ? ' selected' : ''}>${d[1]}</option>`).join('')}</select></label>` : ''}`; })() : ''}
    ${gift ? (r.status === 'redeemed' ? '<p class="fd-sm">This gift has been redeemed: to end the membership it made, find the member above.</p>' : `<label class="ba-check"><input type="checkbox" ${O.end ? 'checked' : ''} onchange="_mb.open.end=this.checked"> Cancel the gift code (it can’t be used)</label>`)
      : `<label class="ba-check"><input type="checkbox" ${O.end ? 'checked' : ''} onchange="_mb.open.end=this.checked"> End the membership now${Q && Q.subscription ? ' (auto-renew stops)' : ''}</label>`}
    <label class="ba-check"><input type="checkbox" ${O.email ? 'checked' : ''} onchange="_mb.open.email=this.checked"> Email ${esc((gift ? r.buyer_email : r.email) || 'them')}</label>
    <label class="f">Note (why)<input value="${escAttr(O.note)}" oninput="_mb.open.note=this.value" placeholder="e.g. Bought for herself by mistake, meant a gift"></label>
    <div class="sheet-actions"><button onclick="_mb.open=null;mbDraw()">Close</button><button class="primary danger" onclick="mbGo()" ${!Q || Q.err ? 'disabled' : ''}>${O.method !== 'none' ? ({ refund: 'Refund', credit: 'Give the credit', giftcard: 'Give the gift card' })[O.method] + (O.end && r.status !== 'redeemed' ? (gift ? ' and cancel' : ' and end') : '') : gift ? 'Cancel the gift' : 'End the membership'}</button></div></div></div>`;
}
async function mbGo() {
  const O = _mb.open, Q = O.q || {}, M = O.method;
  if (M === 'none' && !O.end) { alert('Choose something to give back, ending it, or both.'); return; }
  const pre = Q.pretax != null ? Number(Q.pretax) : null, tot = Q.found ? Number(Q.left) : null;
  const def = M === 'credit' ? (pre != null ? Math.min(pre, tot ?? pre) : tot) : tot;
  const amt = M === 'none' ? 0 : (O.amount === '' ? def : +O.amount);
  if (M !== 'none' && !(amt > 0)) { alert('Type the amount.'); return; }
  const give = M === 'refund' ? `refund $${amt.toFixed(2)} to their card` : M === 'credit' ? `give a $${amt.toFixed(2)} World credit code` : M === 'giftcard' ? `give a $${amt.toFixed(2)} gift card` : '';
  if (!confirm([give, O.end ? (O.kind === 'gift' ? 'cancel the gift code' : 'end the membership now') : ''].filter(Boolean).join(' and ').replace(/^./, c => c.toUpperCase()) + '?\n\nThis can’t be undone.')) return;
  try {
    const d = await mbCall({ action: 'staff_refund', kind: O.kind, id: O.id, method: M, amount: M === 'none' ? '' : amt, days: O.days, cancel: !!O.end, email: O.email, note: O.note });
    _mb.open = null; _mb.msg = '✓ ' + [d.refunded ? '$' + Number(d.refunded).toFixed(2) + ' refunded' : '', d.credit ? `${d.credit.kind === 'credit' ? 'World credit' : 'gift card'} $${Number(d.credit.amount).toFixed(2)}: ${d.credit.code}` : '', d.ended ? 'ended' : ''].filter(Boolean).join(' · ') + '.'; mbFind();
  } catch (e) { alert(e.message); }
}
// a history line's details, short
function mbDetail(d) { try { const o = typeof d === 'string' ? JSON.parse(d) : d || {}; return [o.by ? 'by ' + o.by : '', o.refunded ? '$' + Number(o.refunded).toFixed(2) + ' refunded' : '', o.credit ? (o.credit.kind === 'credit' ? 'credit ' : 'gift card ') + '$' + Number(o.credit.amount).toFixed(2) : '',
  (o.changes || []).join(', '), o.plan ? o.plan : '', o.note ? '“' + o.note + '”' : ''].filter(Boolean).join(' · '); } catch (e) { return ''; } }
// ---- Dates & auto-renew ----
function mbDatesOpen(id) { const m = ((_mb.res || {}).memberships || []).find(x => x.id === id); if (!m) return;
  _mb.dates = { m, ends: String(m.ends_on || '').slice(0, 10), move: !!(m.auto_renew && m.stripe_subscription_id), auto: !!m.auto_renew, note: '' }; mbDraw(); }
function mbDatesHtml() {
  const D = _mb.dates, m = D.m, sub = !!m.stripe_subscription_id;
  return `<div class="fd-sheet-back" onclick="if(event.target===this){_mb.dates=null;mbDraw()}"><div class="fd-sheet" role="dialog" aria-modal="true">
    <h3>${esc(m.name || m.email || 'Membership')}</h3><p class="fd-sm">${esc(MB_PLAN(m.plan))} · started ${esc(String(m.starts_on || '').slice(0, 10))} · ends ${esc(String(m.ends_on || '').slice(0, 10))}${m.auto_renew ? ' · renews automatically' : ''}</p>
    <label class="f">Ends on (member until this day)<input type="date" value="${escAttr(D.ends)}" onchange="_mb.dates.ends=this.value"></label>
    ${sub && m.auto_renew ? `<label class="ba-check"><input type="checkbox" ${D.move ? 'checked' : ''} onchange="_mb.dates.move=this.checked"> Move the next payment to this date too <span class="fd-sm">(nothing charged now)</span></label>` : ''}
    ${sub ? `<label class="ba-check"><input type="checkbox" ${D.auto ? 'checked' : ''} onchange="_mb.dates.auto=this.checked"> Renews automatically (charges their card each year)</label>` : '<p class="fd-sm">No card on file for auto-renew (not a Stripe subscription): they can turn it on in My 4Cats.</p>'}
    <label class="f">Note (why)<input value="${escAttr(D.note)}" oninput="_mb.dates.note=this.value" placeholder="e.g. Away for 2 months, extended"></label>
    <div class="sheet-actions"><button onclick="_mb.dates=null;mbDraw()">Close</button><button class="primary" onclick="mbDatesGo()">Save</button></div></div></div>`;
}
async function mbDatesGo() {
  const D = _mb.dates, m = D.m, body = { action: 'staff_member_dates', id: m.id, note: D.note };
  if (D.ends && D.ends !== String(m.ends_on || '').slice(0, 10)) { body.ends_on = D.ends; body.move_payment = !!D.move; }
  if (m.stripe_subscription_id && D.auto !== !!m.auto_renew) body.auto_renew = D.auto;
  if (!body.ends_on && body.auto_renew === undefined) { alert('Nothing changed.'); return; }
  try { const d = await mbCall(body); _mb.dates = null; _mb.msg = '✓ ' + (d.changed || []).join(' · ') + '.'; mbFind(); } catch (e) { alert(e.message); }
}

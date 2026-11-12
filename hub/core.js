// hub/core.js: shared by every part of the Hub. Loaded by hub.html BEFORE its main script.
// The Supabase client, the sign-in token on Edge Function calls, fnHeaders, STUDIO_NAMES, and the
// everyday helpers: esc, escAttr, localDateStr, shortTime, openDutySheet/closeDutySheet, PANES/showOnlyPane/
// paneVisible, setActiveNav. Moved out of hub.html as-is (Nov 11 2026). (Nov 12 2026: + mydash-pane for 🏠 My dashboard; + the 👁 "Viewing as" banner for owners' Sign in as)

/* ==========================================================================
   LIVE CONFIG
   The anon key below only passes Supabase's API gateway — it grants no table
   access on its own. Card data comes from Edge Functions that check the
   studio login (and coordinator PIN, for the coordinator view) server-side.
   ========================================================================== */
const SUPABASE_URL = 'https://snxibhbhhchjthfmjtaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGliaGJoaGNoanRoZm1qdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk2ODAsImV4cCI6MjA5MjYzNTY4MH0.K-89Mx4SxU6N1hMmtK6Q79rWAtk6VTN9b5wemQxcZVA'; // copied from admin.html

// Studio email login (Supabase Auth). Same project and default storage as
// index.html / schedule.html, so a studio device already signed in there
// opens the dashboard without signing in again.
// A "set your password" link from the Hub's email lands here with #…type=recovery
const _isPasswordRecovery = /type=recovery/.test(location.hash || '');
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// (Copied from index.html.) The Hub sends the login itself for its own calls; this
// covers code copied from the Day view (party thank-you email, etc.).
// ── Edge Function calls carry the signed-in login (Oct 2026) ──
// Functions now check who is calling. Any call to /functions/v1/ that only carries the
// public anon key gets the signed-in person's token instead (when someone is signed in).
;(function () {   // leading ; so it can't join onto the line above
  var rawFetch = window.fetch.bind(window)
  function isAnonBearer(v) {
    var m = /^Bearer\s+([^.]+)\.([^.]+)\./.exec(v || '')
    if (!m) return false
    try { return JSON.parse(atob(m[2].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon' } catch (e) { return false }
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || ''
    var h = init && init.headers
    var key = h && (h.Authorization !== undefined ? 'Authorization' : h.authorization !== undefined ? 'authorization' : null)
    if (url.indexOf('/functions/v1/') === -1 || !key || typeof h.get === 'function' || !isAnonBearer(h[key])) return rawFetch(input, init)
    return sb.auth.getSession().then(function (r) {
      var token = r && r.data && r.data.session && r.data.session.access_token
      if (!token) return rawFetch(input, init)
      var headers = {}, k
      for (k in h) if (Object.prototype.hasOwnProperty.call(h, k)) headers[k] = h[k]
      headers[key] = 'Bearer ' + token
      var copy = {}
      for (k in init) if (Object.prototype.hasOwnProperty.call(init, k)) copy[k] = init[k]
      copy.headers = headers
      return rawFetch(input, copy)
    }, function () { return rawFetch(input, init) })
  }
})()

// Headers for every Edge Function call: the studio login's own access token
// (so the server knows which studio this device is), never a secret.
async function fnHeaders() {
  let token = SUPABASE_ANON_KEY;
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) token = data.session.access_token;
  } catch (e) { /* fall back to anon — the function will refuse studio-level data */ }
  return { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
}

const STUDIO_NAMES = {
  'BC-RICH-GC':'Richmond - Garden City','BC-RICH-STV':'Richmond - Steveston','BC-SUR-SSR':'Surrey - South',
  'BC-YVR-KIT':'Vancouver - Kitsilano','BC-YVR-MS':'Vancouver - Main Street','BC-YVR-UBC':'Vancouver - UBC',
  'BC-YYJ-CSV':'Victoria - Cook Street Village','BC-YYJ-ESQ':'Victoria - Esquimalt','BC-YYJ-OB':'Victoria - Oak Bay',
  'BC-YYJ-VIC':'Victoria - Uptown','AB-YYC-ING':'Calgary - Inglewood','AB-STA-STA':'St Albert',
  'ON-BRL-BRL':'Burlington - South','ON-CMB-GLT':'Cambridge - Galt','ON-ERN-ERN':'Erin',
  'ON-HAM-OS':'Hamilton - Ottawa Street','ON-HAM-WD':'Hamilton - Waterdown','ON-HAM-WH':'Hamilton - West Harbour',
  'ON-KGN-AP':'Kingston - Arlington Park','ON-LDN-BYR':'London - Byron','ON-LDN-WVG':'London - Wortley Village',
  'ON-MIS-PC':'Mississauga - Port Credit','ON-OAK-OAK':'Oakville - North','ON-OAK-WST':'Oakville - West',
  'ON-YOW-GLB':'Ottawa - The Glebe','ON-STC-STC':'St Catharines','ON-YYZ-AVE':'Toronto - Avenue Road',
  'ON-YYZ-BP':'Toronto - Baby Point','ON-YYZ-LEA':'Toronto - Leaside','ON-YYZ-BEA':'Toronto - The Beaches',
  'ON-WTR-WTR':'Waterloo - Uptown'
};


// ---------- Everyday helpers (moved from further down hub.html) ----------
function openDutySheet(html) {
  closeDutySheet();
  const back = document.createElement('div');
  back.className = 'duty-sheet-back'; back.id = 'duty-sheet-back';
  back.innerHTML = `<div class="duty-sheet" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', e => { if (e.target === back) closeDutySheet(); });
  document.body.appendChild(back);
}
function closeDutySheet() { const b = document.getElementById('duty-sheet-back'); if (b) b.remove(); }
function shortTime(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`;
}
function localDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function escAttr(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// The page panes: only one shows at a time. Points + Instagram are
// coordinator-only (their sidebar buttons only appear when unlocked).
const PANES = ['memb-pane', 'ft-pane', 'bo-pane', 'sn-pane', 'as-pane', 'stf-pane', 'rp-pane', 'sup-pane', 'spots-pane', 'snotes-pane', 'wsm-pane', 'fd-pane', 'se-pane', 'mv-pane', 'news-pane', 'ct-pane', 'act-pane', 'don-pane', 'bulk-pane', 'dashboard-main', 'hist-pane', 'ann-pane', 'concern-pane', 'concerns-pane', 'swaps-pane', 'chat-pane', 'dm-pane', 'devices-pane', 'etpl-pane', 'tickets-pane', 'moments-pane', 'info-pane', 'duties-pane', 'schedule-pane', 'points-pane', 'instagram-pane', 'occupancy-pane', 'inventory-pane', 'announce-pane', 'checklist-pane', 'oc-overview-pane', 'plan-pane', 'parties-pane', 'families-pane', 'notif-pane', 'ideas-pane', 'interest-pane', 'rules-pane', 'sick-pane', 'punch-pane', 'ts-pane', 'acks-pane', 'ackc-pane', 'mydash-pane'];
function showOnlyPane(id) {
  if (id !== 'chat-pane' && _chat && _chat.mode !== 'staff') chatStop();   // leaving Chat: stop checking for messages
  PANES.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = p === id ? (p === 'schedule-pane' ? 'flex' : '') : 'none';
  });
}
function paneVisible(id) {
  const el = document.getElementById(id);
  return !!el && el.style.display !== 'none';
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function setActiveNav(id) {
  document.querySelectorAll('.sidebar .nav-item').forEach(b => b.classList.toggle('active', b.id === id));
  hubRemember({ nav: id });
}

// (moved here Nov 11 2026: used all over the Hub) is the coordinator view unlocked, or a home office login? · "Sat, Dec 5" · "5 min ago"
function coordOrAdmin() { return !!_sessionPin || !!(_studioData && _studioData.isAdmin); }
function ptyDayLabel(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function relTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : mins + ' min ago';
  const h = Math.round(mins / 60); if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago';
}

// 👁 (Nov 12 2026) "Sign in as" (access.html → admin-sign-in-as): the page opened from the one-time link carries ?viewing_as=<name>.
// Kept for this window only (sessionStorage), with a banner on every page so it's never mistaken for your own sign-in.
(function () {
  try {
    var q = new URLSearchParams(location.search).get('viewing_as');
    if (q) { sessionStorage.setItem('hub-viewing-as', q); history.replaceState(null, '', location.pathname + location.hash); }
    var who = sessionStorage.getItem('hub-viewing-as'); if (!who) return;
    var show = function () {
      if (document.getElementById('viewing-as-bar')) return;
      var b = document.createElement('div'); b.id = 'viewing-as-bar';
      b.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1fa2;color:#fff;font:600 14px/1.4 system-ui,sans-serif;padding:8px 14px;text-align:center;box-shadow:0 -2px 8px rgba(0,0,0,.25)');
      b.textContent = '👁 Viewing as ' + who + '. Everything here is done as them. Close this window when you\u2019re done.';
      document.body.appendChild(b);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  } catch (e) { /* no banner */ }
})();

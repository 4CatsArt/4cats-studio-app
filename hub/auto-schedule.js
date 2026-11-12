// hub/auto-schedule.js: Home office → 🗓️ Auto-schedule (drafts, approved and posted shifts, warnings, disregarded warnings,
// assigning notes, the day plan) and 👥 Studio staffing. Moved out of hub.html as-is (Nov 12 2026). Loaded by hub.html after its main script.

// ---------- Home office → 🗓️ Auto-schedule (auto_schedule.sql + studio_staffing.sql) ----------
// Pick a week → "Make the workshop schedule": the empty times (0 bookings: workshops, glazing, Mini Make, wheel) are marked to
// come off and new workshops, glazing and Mini Makes are proposed for every studio from our rules → look it over (untick a
// removal, drop / change / move a new time) → Approve and publish (removals are checked again: anything booked meanwhile stays).
// The rules (agreed Nov 6 2026):
//   staff per day (👥 Studio staffing): closed = nothing; 1 staff + a kids class = no kids workshop; 2+ = both
//   everything by time: a time runs when a teacher is free for all of it (a class or wheel takes theirs only for its own hours)
//   weekday evenings (from 5:30): existing empty times that still fit stay; at least a Mini Make, a glazing and a workshop,
//     then more every 15 minutes up to a 7:30 start (staff allowing)
//   weekdays: a kids-only workshop at the first kids class time (or the studio's kids workshop time), then in the evening a
//     Mini Make, a glazing and a workshop, 15 minutes apart, from when the kids class / workshop ends, all done by 9:30pm
//   weekend mornings with no kids class at 9am (or 2+ staff and just one class): 9:00 workshop, 9:15 glazing, 9:30 Mini Make
//   weekends: 1:15 glazing, 1:30 workshop, 2:00 Mini Make, 2:15 glazing, 2:30 workshop, 3:00 workshop, 3:30 Mini Make;
//     3+ staff also 12:00 Mini Make, 12:15 glazing, 12:30 and 1:00 workshops; all done by 5pm (or the studio's own
//     "Weekends end", e.g. 7pm at Kitsilano and Main Street, which also get 4:00 workshop, 4:15 glazing, 4:30 Mini Make,
//     5:00 workshop); a Ditto workshop each weekend
//   workshops and glazing 2 hours, Mini Make 1½; never two at the same time
//   Nov 7 2026: workshops and Mini Makes start on the half hour (:00, :30); glazing on :15 only (1:15, 4:15), at most one on a
//     weekday and two on a weekend day (glazing already on that day counts); a kids class teacher is tied up 15 minutes
//     after the class (a second teacher can start something right away)
//   a kids class (90 minutes), kids-only workshop, wheel, booked party (its real length), booked field trip or group event takes a teacher fully;
//     wheel times starting together (a Clay Wheel class and a Wheel Workshop) share one teacher;
//     a booked Adult Get-Together runs like a workshop (its teacher only for the first 15 minutes);
//     1-staff studios get 45 minutes after a booked party for lunch
//   never on stat holidays or studio closures; small studios (1–2 staff) get no weekday workshops during camps (not PA/PD days)
//   1 staff on a weekday: everything done within 5 hours of their break, which ends 15 minutes before the first class / kids workshop;
//     if what's already on runs past that, a 30-minute break goes in the first gap (15 minutes after a class) and takes the teacher;
//     and the whole shift (from 15 minutes before the first thing on the day) is at most 8½ hours
//   a new time that matches an existing empty one (same workshop, same time) keeps the existing one instead
//   a PA/PD day: asks first — close the evening, or open with how many staff (until answered, nothing is proposed that day)
//   a weekday with a booked field trip: the same question (close the evening, or open with how many staff)
//   party times' open spots come down as they get near (Publish lowers their spots left; reopen any time from the Schedule):
//     a week or less away, any open party spot closes (Kids, Splatter, Adult Get-Together); two weeks or less away, a double or
//     triple party time with 2+ rooms open goes down to one (the Kids Party one stays); booked parties stay; never a field trip
//   weekend mornings (9:00 workshop, 9:15 glazing, 9:30 Mini Make): Vancouver Main Street only (Nov 7 2026)
//   kids-only times: only workshops ticked 🧒 Good for kids (Workshops manager)
//   Featured workshops first, then the most popular; never the same project twice in a day; only workshops in their "Offered" dates;
//     never retired ones (not-live ones are fine), never wheel, never the Hanukkah workshops
const AS_WEEKEND = [['13:15', 'glazing'], ['13:30', 'workshop'], ['14:00', 'mini'], ['14:15', 'glazing'], ['14:30', 'workshop'], ['15:00', 'workshop'], ['15:30', 'mini']];
const AS_WEEKEND_BIG = [['12:00', 'mini'], ['12:15', 'glazing'], ['12:30', 'workshop'], ['13:00', 'workshop']];
// weekend mornings, only when no kids class is on at 9am that day
const AS_WEEKEND_MORNING = [['09:00', 'workshop'], ['09:15', 'glazing'], ['09:30', 'mini']];
// later weekend times: only used where they can finish by the studio's "Weekends end" (e.g. 7pm at Kitsilano and Main Street)
const AS_WEEKEND_LATE = [['16:00', 'workshop'], ['16:15', 'glazing'], ['16:30', 'mini'], ['17:00', 'workshop']];
// start times: workshops and Mini Makes on the half hour; glazing on :15; glazing per day (weekday 1, weekend day 2)
const AS_ON_GRID = (k, start) => k === 'glazing' ? start % 60 === 15 : (k === 'workshop' || k === 'mini') ? start % 30 === 0 : true;
// The shared staffing settings (staffing_settings.sql; 👥 Studio staffing → 📏 Staffing rules): the same numbers the staff
// schedule builder and get_staffing_need use. These are the defaults; asMake() loads the saved ones.
const AS_SET_DEFAULTS = { pa_empty_close_days: 4, class_min: 90, class_after_min: 15, wheel_class_min: 90, wheel_workshop_min: 120, kids_workshop_min: 120, mini_make_min: 90, party_min: 105,
  lunch_after_party_min: 45, get_together_intro_min: 15, field_trip_min: 120, camp_min: 360, day_teacher_span_min: 450, open_party_close_days: 7,
  party_one_room_days: 14, fri6_party_shared: true, glazing_max_weekday: 1, glazing_max_weekend: 2 };
let AS_SET = Object.assign({}, AS_SET_DEFAULTS);
let AS_GT_PER = 20;   // Adult Get-Together / team building intro: 1 teacher per this many guests (its rule in staffing_rules)
async function asSettingsLoad() {
  try { const r = await sb.rpc('get_staffing_settings'); if (!r.error && r.data) AS_SET = Object.assign({}, AS_SET_DEFAULTS, r.data); } catch (e) { /* the defaults */ }
  try {
    const rr = await sb.rpc('hub_staffing_rules_list');
    const gt = (rr.error ? [] : (rr.data || [])).find(x => x.kind === 'per_group' && /get.?together|team.?building/i.test((x.pattern || '') + ' ' + (x.label || '')));
    if (gt && +gt.ratio > 0) AS_GT_PER = +gt.ratio;
  } catch (e) { /* 1 per 20 */ }
  AS_CLASS_BUFFER = +AS_SET.class_after_min; AS_DAY_SPAN = +AS_SET.day_teacher_span_min;
  AS_PARTY_CLOSE_DAYS = +AS_SET.open_party_close_days; AS_PARTY_ONE_DAYS = +AS_SET.party_one_room_days;
}
const AS_GLAZE_MAX = weekend => weekend ? +AS_SET.glazing_max_weekend : +AS_SET.glazing_max_weekday;
let AS_CLASS_BUFFER = 15;
// A 6pm Friday Kids Party runs like a workshop (Nov 7 2026): no teacher of its own, so Friday evening workshops go ahead
function asFriSixParty(s, d) { return AS_SET.fri6_party_shared !== false && s.k === 'party' && s.start === 18 * 60 && new Date(d + 'T12:00:00').getDay() === 5 && !/splatter/i.test(s.title || ''); }
// a field trip or PA/PD day's daytime teacher works this long (7.5 h, e.g. 10:30–6), a camp's at least until 5pm
let AS_DAY_SPAN = 450;
let AS_PARTY_CLOSE_DAYS = 7, AS_PARTY_ONE_DAYS = 14;   // open party spots close a week out; double/triple times go down to one two weeks out
const AS_MORNING_STUDIOS = ['BC-YVR-MS'];   // weekend morning workshops (when no kids class at 9am): these studios only   // the class teacher's 15 minutes after a kids class
const AS_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const AS_CLASS_LEN = s => Math.max(+s.len || 0, +AS_SET.class_min || 90);   // kids classes: 90 minutes (or longer, if the class is set longer)
const AS_KIND_LABEL = { workshop: 'Workshop', glazing: 'Glazing', mini: 'Mini Make', kidsws: 'Kids workshop' };
let _as = { mclose: {}, skip: {}, week: null, prov: '', data: null, plan: null, busy: false, msg: '', err: '', done: null, open: {}, view: 'changes', sview: {}, pad: {}, notes: [], openNotes: null, extra: {} };   // extra: 'studio|date' → staff brought in   // pad: 'studio|date' → 'close' or staff for a PA/PD day's evening
const asMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const asHM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const asT = m => { const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h >= 12 ? 'pm' : 'am'); };
const asCeil15 = m => Math.ceil(m / 15) * 15;
const asAddDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
function asMonday(d) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toLocaleDateString('en-CA'); }
function openAsPane() {
  if (!_hoCan.edit) { alert('Auto-schedule needs Studio Ops edit access.'); return; }
  showOnlyPane('as-pane'); setActiveNav('nav-as');
  if (_as.openNotes === null && typeof sb !== 'undefined') sb.rpc('hub_autosched_notes', { p_from: null, p_to: null, p_open: true }).then(r => { if (!r.error) { _as.openNotes = r.data || []; asDraw(); } });
  if (!_as.week) { const t = new Date().toLocaleDateString('en-CA'), m = asMonday(t); _as.week = m === t ? m : asAddDays(m, 7); }
  asDraw();
}
// ---- What a session is ----
function asKind(s, items) {
  const t = String(s.title || ''), it = s.item ? items[s.item] : null;
  // (field trips and group events are saved as party bookings, so they're recognised by their title first)
  if (/field trip/i.test(t)) return 'field';
  if (/get.?together|team building|adult group|group event|corporate/i.test(t)) return 'group';
  if (s.party || s.type === 'party' || /\b(kids party|splatter party|party time slot|birthday party)\b|^\s*(kids|splatter) party/i.test(t)) return 'party';
  if (/\bp[ad] day|pa\/pd|no[\s-]school/i.test(t)) return 'paday';
  if (/camp/i.test(t)) return 'camp';
  const series = !!(s.class_slot || /class \d+ of|\d+ week session|\bkids class\b/i.test(t) || (!s.item && /\bclass(es)?\b/i.test(t)));
  s._series = series;   // (a class series: never removed)
  if (/wheel/i.test(t)) return 'wheel';    // wheel (a workshop or an adult wheel class): takes the teacher, but isn't a kids class
  if (series) return 'class';              // a kids class: booked or not, takes the teacher; never removed
  if ((it && it.kind === 'glazing') || /glaz/i.test(t)) return 'glazing';
  if ((it && (it._mini || it.kind === 'mini_make')) || /mini\s*make/i.test(t)) return s.kids_only ? 'kidsws' : 'mini';
  if (s.kids_only) return 'kidsws';
  return 'workshop';
}
function asRemovable(s, k, today, nowMin) {
  if (s.booked > 0 || s.protected || s.staff_only || s._series) return false;   // (never a class series, wheel classes included)
  if (!['workshop', 'glazing', 'mini', 'wheel', 'kidsws'].includes(k)) return false;
  if (!s.item && !/glaz|mini\s*make|wheel/i.test(s.title || '')) return false;   // (older Shopify workshops stay: the publish step leaves them too)
  if (s.date < today || (s.date === today && asMin(s.time) <= nowMin)) return false;
  return true;
}
// ---- The engine: one week, every studio ----
function asBuild(W, onlyId) {
  const items = {}; (W.items || []).forEach(i => { items[i.id] = i; });
  const tiers = W.tiers || [], set = W.settings || {}, today = W.today, nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const stf = {}; (W.staffing || []).forEach(r => { stf[r.studio_id] = r; });
  const tierName = k => { const t = tiers.find(x => x.key === k); return t ? String(t.name || t.key) : String(k || ''); };
  (W.items || []).forEach(i => { i._mini = i.kind === 'mini_make' || /mini\s*make/i.test(tierName(i.price_tier)) || /mini\s*make/i.test(String(i.price_tier || '')); });   // (World: the kind, or the Mini Make tier)
  const isDitto = i => (i.tags || []).some(t => /ditto/i.test(t)) || /ditto|sculpt\s*(&|and)?\s*bake|oven.?bake/i.test(i.title || '') || /\$?\b20\b/.test(tierName(i.price_tier));
  const pool = (W.items || []).filter(i => !i.retired && !/wheel/i.test(i.title || '') && !/(hanuk|hannuk|chanuk|latke|menorah|table charm|dreidel)/i.test(i.title || ''));   // (not live is fine: it only hides it from World's Workshops page)
  const glazingItem = (W.items || []).find(i => i.kind === 'glazing');
  const days = Array.from({ length: 7 }, (_, i) => asAddDays(W.from, i));
  const out = { studios: [], removeCount: 0, addCount: 0, notes: [] };
  const studios = Object.keys(STUDIO_NAMES).filter(id => (!_as.prov || id.startsWith(_as.prov)) && (!onlyId || id === onlyId)).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
  for (const st of studios) {
    const row = stf[st], S = { id: st, days: [], notes: [] };
    out.studios.push(S);
    if (!row) { S.notes.push('Staffing not set yet (👥 Studio staffing), so nothing is proposed.'); }
    else if (!row.auto) S.notes.push('Left out of auto-scheduling (👥 Studio staffing).');
    const usedWeek = {};   // project → times this week at this studio (spreads the choices); what's already on (booked or staying) counts
    (W.sessions || []).forEach(s => { if (s.studio_id === st && s.item && items[s.item] && items[s.item].project_id && (s.booked > 0) && s.show !== false) usedWeek[items[s.item].project_id] = (usedWeek[items[s.item].project_id] || 0) + 1; });
    let dittoWeekend = false;
    const all = (W.sessions || []).filter(s => s.studio_id === st);
    all.forEach(s => { if (s.item && items[s.item] && isDitto(items[s.item]) && [0, 6].includes(new Date(s.date + 'T12:00:00').getDay()) && (s.booked > 0)) dittoWeekend = true; });
    for (const d of days) {
      let dow = new Date(d + 'T12:00:00').getDay(), weekend = dow === 0 || dow === 6, staff = row ? (+row[AS_DAYS[dow]] || 0) : 0;
      // 👤 + Staff: someone brought in that day (a part-timer or home office)
      const extra = staff > 0 ? (+_as.extra[st + '|' + d] || 0) : 0;
      if (extra) staff += extra;
      const D = { date: d, dow, staff, entries: [], notes: [], extra };
      if (extra) D.notes.push(`👤 +${extra} staff brought in`);
      S.days.push(D);
      // only what's really running at this studio: a time that's hidden, or has 0 spots and nobody booked, isn't running (the
      // "phantom" times a Shopify product holds at every studio, as World's schedule treats them): not counted, not shown, not touched
      // (a time with nobody booked and 0 spots left was closed, e.g. a party time closed while planning staff: not running, whatever its capacity)
      const running = s => s.show !== false && (s.booked > 0 || (+s.capacity > 0 && !(s.left != null && +s.left <= 0)) || (s.capacity == null && s.left != null && +s.left > 0));
      const ss = all.filter(s => s.date === d && running(s)).map(s => Object.assign({}, s, { k: asKind(s, items), start: asMin(s.time), len: +s.minutes || 0 }));
      // the empty times come off (unless unticked)
      ss.forEach(s => { s.remove = asRemovable(s, s.k, today, nowMin); if (s.remove) out.removeCount++;
        D.entries.push({ t: 'old', s, keep: !s.remove }); });
      // party times coming near: open spots close a week out; a double/triple time with 2+ rooms open goes down to one two weeks out
      if (d >= today) {
        const daysOut = Math.round((Date.parse(d + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 86400000);
        const isGt = x => x.party === 'get_together' || /get.?together/i.test(x.title || '');
        const isRoom = x => !isGt(x) && (x.party === 'kids' || x.party === 'splatter' || /kids? party|splatter|birthday|party time slot/i.test(x.title || ''));
        const groups = {};
        D.entries.forEach(e => { if (e.t !== 'old' || !['party', 'group'].includes(e.s.k) || !((+e.s.left || 0) > 0)) return;
          const g = isGt(e.s) ? 'gt' : isRoom(e.s) ? 'room' : null; if (!g) return; (groups[g + '|' + e.s.start] = groups[g + '|' + e.s.start] || []).push(e); });
        Object.values(groups).forEach(list => {
          const open = list.reduce((t, e) => t + (+e.s.left || 0), 0);
          let to = null, why = '';
          if (daysOut <= AS_PARTY_CLOSE_DAYS) { to = list.map(() => 0); why = 'a week or less away'; }
          else if (daysOut <= AS_PARTY_ONE_DAYS && open >= 2 && !isGt(list[0].s)) {   // (Kids / Splatter rooms only: an Adult Get-Together slot is one time of its own)
            const keep = Math.max(0, list.findIndex(e => e.s.party !== 'splatter' && !/splatter/i.test(e.s.title || '')));
            to = list.map((e, i) => i === keep ? 1 : 0); why = 'two weeks or less away';
          }
          if (!to) return;
          list.forEach((e, i) => { if ((+e.s.left || 0) > to[i]) { e.closeP = true; e.close = true; e.closeTo = to[i]; } });
          const lead = list.find(e => e.closeP); if (!lead) return;
          lead.closeLead = true; lead.closeWhy = why; lead.closeOpen = open;
          lead.closeAfter = list.reduce((t, e) => t + (e.closeP ? e.closeTo : (+e.s.left || 0)), 0);
        });
        // closed by hand in Auto-schedule (tap an open party time): all its open spots, every product at that time
        Object.values(groups).forEach(list => {
          if (!list.some(e => _as.mclose[e.s.id])) return;
          const open = list.reduce((t, e) => t + (+e.s.left || 0), 0);
          list.forEach(e => { e.closeP = true; e.close = true; e.closeTo = 0; e.closeLead = false; e.manual = true; });
          const lead = list[0]; lead.closeLead = true; lead.closeWhy = 'closed by you'; lead.closeOpen = open; lead.closeAfter = 0;
        });
      }
      if (!row || !row.auto) continue;
      const prov = st.slice(0, 2), hol = (W.holidays || []).find(h => h.day === d && (h.province === 'ALL' || h.province === prov));
      const clo = (W.closures || []).find(c => c.studio_id === st && c.date === d);
      if (staff === 0) {
        D.notes.push('Closed');
        // something booked on a normally-closed day (a field trip, a party…): someone has to be there
        const onClosed = ss.filter(x => x.booked > 0 && ['field', 'group', 'party', 'paday', 'camp', 'class'].includes(x.k));
        // a camp or PA/PD day on a usually-closed day: one person 8:30–5, planned by itself (the staff schedule adds the shift)
        const campOn = onClosed.filter(x => ['paday', 'camp'].includes(x.k)), others = onClosed.filter(x => !['paday', 'camp'].includes(x.k));
        if (campOn.length) { D.autoCamp = { from: '08:30', to: '17:00' }; D.notes.push(`${campOn.some(x => x.k === 'paday') ? 'PA/PD day' : 'Camp'} (usually closed): planned with 1 staff, 8:30am–5pm`); }
        // anything else booked: a warning, until someone's requested for the day (👤 Request another staff)
        if (others.length && !campOn.length && !(+_as.extra[st + '|' + d] > 0))
          D.notes.push(`⚠ Usually closed, but booked: ${others.map(x => `${asT(x.start)} ${fdClean(x.title)}`).join(', ')}. Request another staff for it (What to do?).`);
        continue;
      }
      if (hol) { D.notes.push('🎌 ' + hol.name); continue; }
      if (clo) { D.notes.push('Closed' + (clo.label ? ': ' + clo.label : '')); continue; }
      if (d < today) { D.notes.push('Past'); continue; }
      const kept = ss.filter(s => !s.remove);
      if (!weekend && staff <= 2 && kept.some(s => s.k === 'camp')) { D.notes.push('Camp day: no workshops (small studio)'); continue; }
      // the teacher-taking things kept on this day
      const ded = [];
      kept.forEach(s => {
        const lb = `${asT(s.start)} ${fdClean(s.title)}`;
        if (s.k === 'class') ded.push([s.start, s.start + AS_CLASS_LEN(s) + AS_CLASS_BUFFER, lb + ' (class, and 15 minutes after)']);
        else if (s.k === 'wheel') {
          // wheel classes: 90 minutes unless set; wheel times starting together (a Clay Wheel class and a Wheel Workshop) share one teacher
          const end = s.start + (s._series ? (+s.len || +AS_SET.wheel_class_min) : (s.len || +AS_SET.wheel_workshop_min)), lab = lb + (s._series ? ' (wheel class)' : '');
          const same = ded.find(x => x.wheel && x[0] === s.start);
          if (same) { same[1] = Math.max(same[1], end); same[2] += ', ' + lab; }
          else { const e = [s.start, end, lab]; e.wheel = true; ded.push(e); }
        }
        else if (s.k === 'kidsws') ded.push([s.start, s.start + (s.len || +AS_SET.kids_workshop_min), lb]);
        else if (s.k === 'party' && s.booked > 0 && !asFriSixParty(s, d)) { const len = s.party_minutes || +AS_SET.party_min; ded.push([s.start, s.start + len, lb + ' (party)']); if (staff === 1) ded.push([s.start + len, s.start + len + +AS_SET.lunch_after_party_min, 'lunch after the party']); }
        // a booked Adult Get-Together runs like a workshop: its teacher only for the first 15 minutes (the intro)
        else if (s.k === 'group' && s.booked > 0 && (s.party === 'get_together' || /get.?together/i.test(s.title || ''))) { const ppl = +s.expected > 0 ? +s.expected : (+s.booked || 1), n = Math.max(1, Math.ceil(ppl / AS_GT_PER));   // (1 teacher per 20 guests for the intro)
          for (let i = 0; i < n; i++) ded.push([s.start, s.start + +AS_SET.get_together_intro_min, lb + ' (get-together intro' + (n > 1 ? `, teacher ${i + 1} of ${n}` : '') + ')']); }
        else if ((s.k === 'field' || s.k === 'group') && s.booked > 0) ded.push([s.start, s.start + (s.len || +AS_SET.field_trip_min), lb + (s.k === 'field' ? ' (field trip)' : '')]);
        else if (s.k === 'camp' || s.k === 'paday') ded.push([s.start, s.start + (s.len || +AS_SET.camp_min), lb + ' (PA/PD day or camp)']);
      });
      const maxDed = (a, b) => { let m = 0; for (let t = a; t < b; t += 15) { const n = ded.filter(x => x[0] <= t && x[1] > t).length; if (n > m) m = n; } return m; };
      // ⚠ more classes, parties or other teacher-only times at once than there are staff (e.g. two kids classes with 1 staff):
      // their real times (a class's 15 minutes after doesn't count here), whatever was proposed
      {
        const real = ded.filter(x => !/staff break|lunch|^check$/.test(x[2] || '')).map(x => [x[0], /\(class, and 15 minutes after\)/.test(x[2] || '') ? x[1] - AS_CLASS_BUFFER : x[1], String(x[2] || '').replace(/ \(class, and 15 minutes after\)/, ' (class)')]);
        const lo = Math.min(...real.map(x => x[0])), hi = Math.max(...real.map(x => x[1]));
        let worst = null;
        for (let t = lo; isFinite(lo) && t < hi; t += 15) {
          const on = real.filter(x => x[0] <= t && x[1] > t);
          if (on.length > staff && (!worst || on.length > worst.length)) worst = on;
        }
        if (worst) D.notes.push(`⚠ Not enough teachers: ${worst.map(x => x[2]).join(' and ')} overlap, with ${staff} staff. Bring in another teacher (👤 + Staff) or move one.`);
      }
      const floorFree = (a, b) => staff - maxDed(a, b) >= 1;
      const starts = new Set(kept.filter(s => ['workshop', 'glazing', 'mini', 'kidsws'].includes(s.k)).map(s => s.start));
      const usedToday = new Set(kept.map(s => s.item && items[s.item] ? items[s.item].project_id : null).filter(Boolean));
      const spots = k => k === 'kidsws' ? (+set.spots_kids || 15) : staff >= 3 ? (+set.spots_big || 18) : (+set.spots_small || 12);
      const pick = (k, wantDitto, start) => {
        if (k === 'glazing') return glazingItem || null;
        const ok = pool.filter(i => (k === 'mini' ? i._mini : !i._mini && i.kind !== 'glazing')
          && (!i.offer_from || i.offer_from <= d) && (!i.offer_until || i.offer_until >= d) && !usedToday.has(i.project_id)
          && (k !== 'kidsws' || i.kids_ok));   // (kids-only times: only 🧒 Good for kids workshops)
        // an empty time of the same kind already at this time: keep its workshop if it's still allowed (it stays, no change)
        const there = new Set(ss.filter(s => s.remove && s.start === start && s.item && s.k === (k === 'kidsws' ? 'kidsws' : k)).map(s => s.item));
        // featured get priority once per studio per week; after that a workshop ranks below ones not used there yet that week,
        // so the whole list gets a turn; ties rotate by studio and date
        const tie = i => { let h = 0; const k = st + d + i.id; for (let c = 0; c < k.length; c++) h = (h * 31 + k.charCodeAt(c)) % 997; return h / 997; };
        const score = i => (there.has(i.id) ? 100000 : 0) + (wantDitto && isDitto(i) ? 5000 : 0) - (usedWeek[i.project_id] || 0) * 3000
          + (i.featured && !usedWeek[i.project_id] ? 1000 : 0) + Math.min(400, (+i.likes || 0) * 3 + (+i.booked90 || 0)) + tie(i) * 60;
        ok.sort((a, b) => score(b) - score(a) || String(a.title).localeCompare(String(b.title)));
        return ok[0] || null;
      };
      const add = (start, k, why) => {
        const len = k === 'mini' ? +AS_SET.mini_make_min : 120, end = start + len, endLimit = weekend ? (row.weekend_end ? asMin(row.weekend_end) : 17 * 60) : Math.min(21 * 60 + 30, D.workEnd || 24 * 60);
        if (end > endLimit || starts.has(start)) return false;
        if (!AS_ON_GRID(k, start)) return false;   // (workshops on the half hour; glazing on :15)
        if (k === 'glazing') {   // at most one glazing on a weekday, two on a weekend day (what's already on counts)
          const g = kept.filter(x => x.k === 'glazing').length + D.entries.filter(e => e.t === 'new' && e.on && e.k === 'glazing').length;
          if (g >= AS_GLAZE_MAX(weekend)) return false;
        }
        if (k === 'kidsws' ? maxDed(start, end) >= staff : !floorFree(start, end)) return false;
        // a kids workshop takes a teacher: never if that leaves a booked time (or one already planned) with nobody free
        if (k === 'kidsws') {
          ded.push([start, end, 'check']);
          const needs = kept.filter(s => ['workshop', 'glazing', 'mini'].includes(s.k)).map(s => [s.start, s.start + (s.len || (s.k === 'mini' ? +AS_SET.mini_make_min : 120))])
            .concat(D.entries.filter(e => e.t === 'new' && e.on && e.k !== 'kidsws').map(e => [e.start, e.start + e.len]));
          const breaks = needs.some(([a, b]) => !floorFree(a, b));
          ded.pop();
          if (breaks) return false;
        }
        const wantDitto = weekend && k === 'workshop' && !dittoWeekend;
        const it = pick(k, wantDitto, start); if (!it) { D.short = D.short || {}; D.short[k] = (D.short[k] || 0) + 1; return false; }
        D.entries.push({ t: 'new', k, start, len, item: it.id, spots: spots(k), kids: k === 'kidsws', why, on: true });
        starts.add(start); if (it.project_id) { usedToday.add(it.project_id); usedWeek[it.project_id] = (usedWeek[it.project_id] || 0) + 1; }
        if (k === 'kidsws') ded.push([start, end, `${asT(start)} new kids workshop`]);
        if (wantDitto && isDitto(it)) dittoWeekend = true;
        out.addCount++; return true;
      };
      if (weekend) {
        const late = row.weekend_end && asMin(row.weekend_end) > 17 * 60 ? AS_WEEKEND_LATE : [];
        // 9:00 workshop, 9:15 glazing, 9:30 Mini Make when no kids class is on at 9am, or (2+ staff) just one class:
        // one teacher takes the class, another runs the morning
        const classesAt9 = kept.filter(s => s.k === 'class' && s.start <= 9 * 60 && s.start + AS_CLASS_LEN(s) > 9 * 60).length;
        const morningOk = classesAt9 === 0 || (staff >= 2 && classesAt9 === 1);
        const morning = morningOk && AS_MORNING_STUDIOS.includes(st) ? AS_WEEKEND_MORNING : [];
        if (!morningOk && AS_MORNING_STUDIOS.includes(st)) D.notes.push(classesAt9 > 1 ? 'Two kids classes at 9am: no morning workshops' : 'Kids class at 9am (1 staff): no morning workshops');
        const tpl = morning.concat(staff >= 3 ? AS_WEEKEND_BIG.concat(AS_WEEKEND) : AS_WEEKEND).concat(late).slice().sort((a, b) => asMin(a[0]) - asMin(b[0]));
        tpl.forEach(([t, k]) => add(asMin(t), k, 'weekend'));
      } else {
        // a PA/PD day: ask about the evening (close it, or open with how many staff) before proposing anything
        // (a weekday with a booked field trip: the same question, close the evening or open with how many staff)
        const isPa = kept.some(s => s.k === 'paday'), isFt = !isPa && kept.some(s => s.k === 'field' && s.booked > 0);
        if (isPa || isFt) {
          const ans = _as.pad[st + '|' + d], min = +(set.pa_min ?? 8);
          const kids = kept.filter(s => s.k === (isPa ? 'paday' : 'field')).reduce((t, s) => t + (+s.booked || 0), 0);
          const lbl = isPa ? '🎒 PA/PD day' : '🚌 Field trip';
          // (a field trip: its booked time, e.g. 10am–12pm)
          const ft = isFt ? kept.filter(s => s.k === 'field' && s.booked > 0).sort((a, b) => a.start - b.start) : [];
          const ftTime = ft.length ? ft.map(s => `${asT(s.start)}–${asT(s.start + (s.len || 120))}`).join(', ') : null;
          // (a field trip: how many are expected, since usually only a deposit is booked; null when nobody has set it)
          const ftExp = isFt ? ft.reduce((t, s) => s.expected != null && +s.expected > 0 ? (t || 0) + +s.expected : t, null) : null;
          D.pad = { kind: isPa ? 'paday' : 'field', usual: staff, ans, kids, low: isPa && min > 0 && kids < min, min, time: ftTime, expected: ftExp };
          if (ans === undefined) { D.notes.push(lbl + ': choose what happens to the evening'); continue; }
          if (ans === 'close') { D.notes.push(lbl + ': evening closed'); continue; }
          if (ans === 'watch') { D.notes.push(lbl + ': both kept open · watching its bookings (notes on 📋 To-do)'); }
          else if (ans === 'more') { staff = staff + 1; D.staff = staff; D.notes.push(`${lbl}: evening with ${staff} staff (one more brought in · on 📋 To-do)`); }
          else if (ans === 'cancel_pa') { D.notes.push(`${lbl}: to be cancelled (on 📋 To-do) · evening as usual`); }
          else {
          staff = Math.max(1, +ans || 1) + extra; D.staff = staff; D.notes.push(`${lbl}: ${staff} staff that day`);
          }
          // (Nov 7 2026) the daytime teacher (the field trip, or the PA/PD camp) is one of the day's staff: they start 30 minutes
          // before and go home after about 7.5 hours (10:30 → 6; a camp at least until 5), so after that there's one fewer
          if (ans !== 'close') {
            const dayFirst = Math.min(...kept.filter(s => s.k === (isPa ? 'paday' : 'field') && (isPa || s.booked > 0)).map(s => s.start));
            if (isFinite(dayFirst) && dayFirst < 15 * 60) {
              const leave = Math.max(17 * 60, dayFirst - 30 + AS_DAY_SPAN);
              ded.push([leave, 24 * 60, `the ${isPa ? 'PA/PD day' : 'field trip'} teacher, gone home at ${asT(leave)}`]);
              D.notes.push(`${lbl}: its teacher works ${asT(dayFirst - 30)}–${asT(leave)}, so ${Math.max(0, staff - 1)} staff after ${asT(leave)}`);
            }
          }
        }
        const classes = kept.filter(s => s.k === 'class').sort((a, b) => a.start - b.start);
        const kidsT = classes.length ? classes[0].start : (row.kids_time ? asMin(row.kids_time) : null);
        // 1 staff on a weekday: work at most 5 hours after their break, which ends 15 minutes before the first class or
        // kids workshop (e.g. a 4:00 class → break ends 3:45 → everything done by 8:45)
        if (staff === 1) {
          const firsts = [kidsT].concat(kept.filter(s => ['class', 'kidsws', 'workshop', 'glazing', 'mini', 'wheel'].includes(s.k)).map(s => s.start)).filter(x => x != null);
          if (firsts.length) { const brk = Math.min(...firsts) - 15; D.workEnd = brk + 300; if (D.workEnd < 21 * 60 + 30) D.notes.push(`1 staff: done by ${asT(D.workEnd)} (5 hours after the ${asT(brk)} break)`); }
          // what's already on the schedule runs past that (e.g. a 7:30–9:00 wheel class): they need a 30-minute break in the
          // middle. It goes in the first free gap, 15 minutes after an earlier class or time ends, and takes the teacher.
          const pub = kept.filter(s => ['workshop', 'glazing', 'mini'].includes(s.k) && s.booked > 0).map(s => [s.start, s.start + (s.len || (s.k === 'mini' ? +AS_SET.mini_make_min : 120))]);
          const lastEnd = Math.max(0, ...ded.map(x => x[1]), ...pub.map(x => x[1]));
          if (D.workEnd && lastEnd > D.workEnd) {
            const busy = ded.map(x => [x[0], x[1]]).concat(pub);
            const free = (a, b) => !busy.some(x => x[0] < b && x[1] > a);
            // where it can go: 15 minutes after a class or booked time ends, or after the kids workshop (which is added after
            // this), or any 15-minute mark after that, as long as it starts before the 5 hours are up
            const kidsAfter = kidsT != null ? kidsT + 120 + 15 : null;
            const from = Math.min(...[kidsAfter, ...busy.map(x => x[1] + 15)].filter(x => x != null && x + 30 <= D.workEnd).concat([D.workEnd - 30]));
            const cands = [...new Set(busy.map(x => x[1] + 15).concat(kidsAfter != null ? [kidsAfter] : []).concat(Array.from({ length: 40 }, (_, i) => from + i * 15)).filter(t => t >= from && t + 30 <= D.workEnd))].sort((a, b) => a - b);
            const bs = cands.find(t => free(t, t + 30));
            if (bs != null) {
              ded.push([bs, bs + 30, `${asT(bs)} staff break`]);
              D.workEnd = Math.min(21 * 60 + 30, bs + 30 + 300);
              D.notes = D.notes.filter(n => !/^1 staff: done by/.test(n));
              D.notes.push(`1 staff: break ${asT(bs)}–${asT(bs + 30)} (the day runs past 5 hours)`);
            } else D.notes.push('⚠ No time for a 30-minute break: the day runs past 5 hours with no gap (check staffing)');
          }
          // the whole shift: at most 8½ hours (8 working + the break), from 15 minutes before the first thing on the day
          // (a field trip, party, class, booked time or the kids workshop)
          // (a PA/PD day or camp is its own daytime shift: the evening person's shift starts from the evening's first thing)
          // (a field trip day whose evening staff was chosen: the evening is its own shift, like a PA/PD day)
          const ftOwn = D.pad && D.pad.kind === 'field';
          const firstAll = Math.min(...[kidsT].concat(ded.filter(x => !/staff break|lunch|PA\/PD day or camp/.test(x[2] || '') && !(ftOwn && /\(field trip\)/.test(x[2] || ''))).map(x => x[0]), pub.map(x => x[0])).filter(x => x != null));
          if (isFinite(firstAll)) {
            const shiftEnd = firstAll - 15 + 510;
            if (!D.workEnd || shiftEnd < D.workEnd) {
              D.workEnd = shiftEnd;
              D.notes = D.notes.filter(n => !/^1 staff: done by/.test(n));
              D.notes.push(`1 staff: shift ${asT(firstAll - 15)}–${asT(shiftEnd)} (8½ hours max)`);
            }
          }
        }
        // Everything by time: a time can run when a teacher is free for all of it (classes, wheel and the rest
        // take theirs only for their own hours), and it fits before the day ends.
        // The kids workshop: at the first kids class time, or the studio's kids workshop time, whichever has a teacher free
        let eve = 18 * 60, kidsEnd = null;
        const hasKids = kept.some(s => s.k === 'kidsws');
        if (hasKids) kidsEnd = Math.max(...kept.filter(s => s.k === 'kidsws').map(s => s.start + (s.len || 120)));
        else {
          const tries = [...new Set([classes.length ? classes[0].start : null, row.kids_time ? asMin(row.kids_time) : null].filter(x => x != null))];
          for (const kt of tries) { if (add(kt, 'kidsws', kt === (classes[0] || {}).start ? 'at the kids class time' : 'kids workshop time')) { kidsEnd = kt + 120; break; } }
          if (!tries.length) D.notes.push('No kids class or kids workshop time: evening from 6pm');
        }
        // The evening (a Mini Make, a glazing and a workshop): from when the kids workshop ends (or the kids time, or 6pm),
        // each at the first 15-minute mark with a teacher free that still finishes in time
        // the evening starts at 5:30 (a teacher has to be free for each time, so with 1 staff it waits for the kids
        // workshop or class to finish; with 2+ staff it runs alongside)
        eve = 17 * 60 + 30;
        if (kidsEnd == null && kidsT == null) eve = 18 * 60;
        // existing empty evening times that still fit (a teacher free, in the day, an allowed workshop) stay where they are
        const seeded = new Set();
        ss.filter(s => s.remove && ['workshop', 'glazing', 'mini'].includes(s.k) && s.start >= eve && s.start <= 19 * 60 + 30)
          .sort((a, b) => a.start - b.start).forEach(s => { if (add(s.start, s.k, 'evening')) seeded.add(s.k); });
        const have = k => seeded.has(k) || kept.some(s => s.k === k && s.start >= 17 * 60);
        let t = eve;
        ['mini', 'glazing', 'workshop'].forEach(k => {
          if (have(k)) return;
          for (let x = t; x <= 21 * 60; x += 15) { if (add(x, k, 'evening')) { t = x + 15; return; } }
        });
        // …then more, every 15 minutes up to a 7:30 start, while a teacher is free and it finishes in time
        // (workshop, glazing, workshop, Mini Make, round and round; never the same project twice in a day)
        const AS_EVE_LAST = 19 * 60 + 30, cyc = ['workshop', 'glazing', 'workshop', 'mini']; let ci = 0;
        for (let x = eve; x <= AS_EVE_LAST; x += 15) {
          if (starts.has(x)) continue;
          for (let j = 0; j < cyc.length; j++) { const k = cyc[(ci + j) % cyc.length]; if (add(x, k, 'evening')) { ci = (ci + j + 1) % cyc.length; break; } }
        }
      }
      // the plan matches what's already there (same workshop, same time): keep the existing time instead of
      // removing it and adding the same one again
      D.entries.filter(e => e.t === 'new').forEach(e => {
        const o = D.entries.find(x => x.t === 'old' && x.s.remove && !x.keep && !x.same && x.s.item === e.item && x.s.start === e.start);
        if (!o) return;
        o.keep = true; o.same = true; e.dup = true; out.removeCount--; out.addCount--;
      });
      D.entries = D.entries.filter(e => !e.dup);
      // ran out of different projects for the day (never the same project twice)
      Object.keys(D.short || {}).forEach(k => D.notes.push(k === 'kidsws' ? 'Kids workshop left empty: no 🧒 Good for kids workshop in its dates (tick some in Workshops)'
        : `${D.short[k]} ${AS_KIND_LABEL[k].toLowerCase()} time${D.short[k] === 1 ? '' : 's'} left empty: no other ${k === 'glazing' ? 'glazing item' : AS_KIND_LABEL[k].toLowerCase() + ' in its dates'} to offer`));
      // ⚠ 1 staff on a weekend: a day over 5 hours needs a 30-minute gap with nothing running, starting within the first
      // 5 hours (from 15 minutes before the first thing). Everything on the day counts: classes, workshops and glazing staying or new,
      // booked parties, field trips and group times. (A break already planned for a weekday counts as that gap.)
      if (weekend && staff === 1) {   // (weekdays plan their own break around the kids class, above)
        const lenOf = x => x.k === 'class' ? AS_CLASS_LEN(x) : x.k === 'party' ? (x.party_minutes || +AS_SET.party_min) : x.k === 'mini' ? (x.len || +AS_SET.mini_make_min) : (x.len || 120);
        // what's running, each with when it frees the teacher (a class: 15 minutes after it ends)
        const runs = kept.filter(x => ['workshop', 'glazing', 'mini', 'kidsws', 'class', 'wheel'].includes(x.k) || (['party', 'field', 'group'].includes(x.k) && x.booked > 0))
          .map(x => [x.start, x.start + lenOf(x) + (x.k === 'class' ? AS_CLASS_BUFFER : 0)])
          .concat(D.entries.filter(e => e.t === 'new' && e.on).map(e => [e.start, e.start + e.len]))
          .sort((p1, p2) => p1[0] - p2[0]);
        if (runs.length) {
          // the shift: from 15 minutes before the first thing, to the weekend's end (5pm, or the studio's own) or later if something runs later
          const dayStart = runs[0][0] - 15, dayEnd = Math.max(...runs.map(x => x[1]), row.weekend_end ? asMin(row.weekend_end) : 17 * 60);
          if (dayEnd - dayStart > 300) {
            // a 30-minute break in a gap with nothing running, with at most 5 hours worked before it AND after it
            const lo = dayEnd - 330, hi = dayStart + 300;   // the break has to start between these
            const gaps = []; let end = runs[0][1];
            for (let i = 1; i < runs.length; i++) { if (runs[i][0] > end) gaps.push([end, runs[i][0]]); end = Math.max(end, runs[i][1]); }
            if (dayEnd > end) gaps.push([end, dayEnd]);   // (after the last thing, before the shift ends)
            const fits = gaps.some(([g0, g1]) => Math.max(g0, lo) + 30 <= g1 && Math.max(g0, lo) <= hi);
            if (!fits) {
              const near = gaps.filter(([g0, g1]) => g1 - g0 >= 30).map(([g0, g1]) => `${asT(g0)}–${asT(g1)}`);
              D.notes.push(`⚠ 1 staff: nowhere for a 30-minute break that keeps both halves of the ${asT(dayStart)}–${asT(dayEnd)} shift under 5 hours`
                + (near.length ? ` (the only gap${near.length === 1 ? '' : 's'}: ${near.join(', ')})` : ' (something is running all day)') + '. Leave a gap around midday, take a time off, or bring in another staff (👤 + Staff).');
            }
          }
        }
      }
      // flag: kept times with no teacher free
      kept.filter(s => ['workshop', 'glazing', 'mini'].includes(s.k)).forEach(s => {
        const end = s.start + (s.len || (s.k === 'mini' ? +AS_SET.mini_make_min : 120));
        if (!floorFree(s.start, end)) {
          const busy = [...new Set(ded.filter(x => x[0] < end && x[1] > s.start).map(x => x[2]).filter(Boolean))];
          D.notes.push(`⚠ ${asT(s.start)} ${fdClean(s.title)}: no teacher free with ${staff} staff${busy.length ? ` (busy: ${busy.join(', ')})` : ''}`);
        }
      });
      D.entries.sort((a, b) => (a.t === 'old' ? a.s.start : a.start) - (b.t === 'old' ? b.s.start : b.start));
    }
  }
  out.items = items; out.pool = pool; out.glazingItem = glazingItem;
  // disregarded warnings (autosched_disregard.sql): out of the day's warnings, kept with their note
  out.studios.forEach(S => S.days.forEach(D => {
    D.disregarded = [];
    D.notes = D.notes.filter(n => { if (!n.startsWith('⚠')) return true;
      const x = (_as.disr || []).find(r => r.studio_id === S.id && r.day === D.date && r.warning === n);
      if (x) { D.disregarded.push({ text: n, note: x.note || '', by: x.created_by || '' }); return false; } return true; });
  }));
  // 🚫 "Don't make any changes" for a studio this week: every suggestion off (nothing new, nothing taken off)
  out.studios.forEach(S => { if (_as.skip && _as.skip[W.from + '|' + S.id]) { S.skipped = true; S.days.forEach(D => D.entries.forEach(e => { if (e.t === 'new') e.on = false; if (e.t === 'old') { e.keep = true; if (e.closeP) e.close = false; } })); } });
  return out;
}
async function asMake() {
  _as.busy = true; _as.err = ''; _as.done = null; _as.plan = null; asDraw();
  const { data, error } = await sb.rpc('hub_autosched_week', { p_from: _as.week });
  _as.busy = false;
  if (error) { _as.err = /hub_autosched_week/.test(error.message) ? 'Run auto_schedule.sql in Supabase first.' : error.message; asDraw(); return; }
  _as.data = data;
  await asSettingsLoad();   // (the shared staffing settings: the same numbers as the staff schedule builder)
  try { await asNotesLoad(true); } catch (e) {}   // (the notes first: 👤 + Staff days are planned with their extra person)
  try { await asDisrLoad(); } catch (e) {}          // (and the disregarded warnings)
  // (and the PA/PD and field trip evening answers saved before: autosched_day_plan.sql), unless answered again on this page
  try {
    const dp = await sb.rpc('hub_autosched_dayplan_week', { p_from: _as.week, p_to: asAddDays(_as.week, 6) });
    (dp.error ? [] : (dp.data || [])).forEach(r => { const k = r.studio_id + '|' + r.day; if (_as.pad[k] === undefined && r.evening != null && r.evening !== '') _as.pad[k] = String(r.evening); });
  } catch (e) {}
  _as.plan = asBuild(data);
  _as.plan.studios.forEach(S => {   // nothing to change: start folded (open it any time)
    const n = S.days.reduce((t, D) => t + D.entries.filter(e => (e.t === 'new' && e.on) || (e.t === 'old' && e.s.remove && !e.keep)).length, 0);
    if (!n && !S.days.some(D => D.pad && D.pad.ans === undefined)) _as.open[S.id] = false; else if (_as.open[S.id] === false) delete _as.open[S.id];
  });
  asDraw();
  asDayPlanSoon();   // the staff schedule follows this plan
}
// ---- The page ----
function asDraw() {
  const el = document.getElementById('as-pane'); if (!el) return;
  const P = _as.plan, wkEnd = asAddDays(_as.week, 6), fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">🗓️ Auto-schedule</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="as-tabs" role="tablist"><button role="tab" aria-selected="${_as.tab !== 'rules'}" class="${_as.tab !== 'rules' ? 'on' : ''}" onclick="_as.tab='plan';asDraw()">🗓️ Plan the week</button><button role="tab" aria-selected="${_as.tab === 'rules'}" class="${_as.tab === 'rules' ? 'on' : ''}" onclick="_as.tab='rules';asDraw()">📖 The rules</button></div>`;
  if (_as.tab === 'rules') { el.innerHTML = h + asRulesHtml(); return; }
  h += `
    <div class="ho-intro">Pick a week and press <b>Make the workshop schedule</b>: the empty times (0 bookings) are marked to come off and new times are proposed for every studio from our rules. Look it over, then <b>Approve and publish</b>. Nothing changes until you publish.</div>
    <div class="as-bar"><button class="ho-btn" onclick="_as.week=asAddDays(_as.week,-7);_as.plan=null;_as.done=null;asDraw()" aria-label="Previous week">‹</button>
      <b>Week of ${fmt(_as.week)} – ${fmt(wkEnd)}</b><button class="ho-btn" onclick="_as.week=asAddDays(_as.week,7);_as.plan=null;_as.done=null;asDraw()" aria-label="Next week">›</button>
      <input type="date" value="${escAttr(_as.week)}" onchange="if(this.value){_as.week=asMonday(this.value);_as.plan=null;_as.done=null;asDraw()}">
      <select onchange="_as.prov=this.value;_as.plan=null;asDraw()"><option value="">All studios</option>${[['BC', 'BC'], ['AB', 'Alberta'], ['ON', 'Ontario']].map(p => `<option value="${p[0]}"${_as.prov === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}</select>
      <button class="fd-pay" ${_as.busy ? 'disabled' : ''} onclick="asMake()">${_as.busy ? 'Working…' : P ? '↻ Make it again' : 'Make the workshop schedule'}</button>
      <button class="ho-btn" onclick="asTodo()">📋 To-do${_as.openNotes && _as.openNotes.length ? ` <span class="as-todo-n">${_as.openNotes.length}</span>` : ''}</button></div>
    ${asNightlyHtml()}
    ${_as.notesErr ? `<p class="fd-sm">${esc(_as.notesErr)}</p>` : ''}
    ${_as.dpErr ? `<p class="fd-sm">${esc(_as.dpErr)}</p>` : ''}
    ${_as.err ? `<p class="fd-msg">${esc(_as.err)}</p>` : ''}${_as.done ? `<div class="as-done">✅ Published: <b>${_as.done.added}</b> new time${_as.done.added === 1 ? '' : 's'}, <b>${_as.done.removed}</b> empty time${_as.done.removed === 1 ? '' : 's'} removed${_as.done.kept ? `, ${_as.done.kept} kept because someone booked meanwhile` : ''}. <button class="ho-btn" onclick="_as.week=asAddDays(_as.week,7);_as.plan=null;_as.done=null;asDraw()">Next week →</button></div>` : ''}`;
  if (!P) {
    // the week is made as soon as it's shown (making only plans, nothing changes until Publish), so the Overview is always there
    if (!_as.busy && !_as.err && _as.autoWeek !== _as.week + '|' + _as.prov) { _as.autoWeek = _as.week + '|' + _as.prov; setTimeout(asMake, 0); h += '<p class="ho-intro">Making the week…</p>'; }
    el.innerHTML = h; return;
  }
  const sum = asCount();
  const padAsk = P.studios.filter(S => !S.published).reduce((t, S) => t + S.days.filter(D => D.pad && D.pad.ans === undefined).length, 0);
  const padLow = P.studios.filter(S => !S.published).reduce((t, S) => t + S.days.filter(D => D.pad && D.pad.low).length, 0);
  h += `<div class="as-sum"><span><b>${sum.add}</b> new times</span><span><b>${sum.rem}</b> empty times coming off</span>${sum.close ? `<span><b>${sum.close}</b> party time${sum.close === 1 ? '' : 's'} closing or going to one</span>` : ''}<span><b>${P.studios.length}</b> studios</span>${padAsk ? `<button class="as-padn" onclick="asPadList()">🎒🚌 <b>${padAsk}</b> PA/PD or field trip day${padAsk === 1 ? '' : 's'} need${padAsk === 1 ? 's' : ''} an answer</button>` : ''}${padLow ? `<button class="as-padn low" onclick="asPadList()">⚠ <b>${padLow}</b> PA/PD day${padLow === 1 ? '' : 's'} with few kids</button>` : ''}
    <span class="as-view" role="group" aria-label="Show"><button class="${_as.view !== 'after' ? 'on' : ''}" onclick="_as.view='changes';_as.sview={};asDraw()">Changes</button><button class="${_as.view === 'after' ? 'on' : ''}" onclick="_as.view='after';_as.sview={};asDraw()">After publishing</button></span>
    <span class="as-key">${_as.view === 'after' ? '<i class="k-old"></i>on the schedule <i class="k-new"></i>new' : '<i class="k-old"></i>stays <i class="k-rem"></i>comes off <i class="k-new"></i>new'}</span></div>
    ${asOverviewHtml()}
    <div class="as-studios">${P.studios.map((S, si) => asStudioHtml(S, si)).join('')}</div>
    <div class="as-foot"><span>${sum.add} new · ${sum.rem} off${P.studios.some(S => S.published) ? ` <span class="fd-sm">(${P.studios.filter(S => S.published).length} studio${P.studios.filter(S => S.published).length === 1 ? '' : 's'} already published)</span>` : ''}</span><button class="fd-pay" ${_as.busy || (!sum.add && !sum.rem) ? 'disabled' : ''} onclick="asPublish()">${P.studios.some(S => S.published) ? 'Approve and publish the rest' : 'Approve and publish'}</button></div>`;
  el.innerHTML = h;
}
// ---- 📖 The rules, in plain English: written from the live settings (📏 Staffing rules), so they never go out of date ----
let _asRules = null;
async function asRulesLoad() {
  _asRules = { loading: true };
  await asSettingsLoad();
  const [rr, st] = await Promise.all([sb.rpc('hub_staffing_rules_list'), sb.rpc('hub_staffing_list')]);
  _asRules = { list: rr.error ? [] : (rr.data || []), spots: (st.data && st.data.settings) || {}, err: rr.error ? rr.error.message : '' };
  if (_as.tab === 'rules') asDraw();
}
function asRulesHtml() {
  if (!_asRules) { setTimeout(asRulesLoad, 0); return '<p class="ho-intro">Loading the rules…</p>'; }
  if (_asRules.loading) return '<p class="ho-intro">Loading the rules…</p>';
  const S = AS_SET, sp = _asRules.spots || {}, n = v => esc(String(v)), hrs = m => { const h = +m / 60; return (h % 1 ? h.toFixed(1) : h) + (h === 1 ? ' hour' : ' hours') };
  const per = k => (_asRules.list || []).find(r => k.test((r.pattern || '') + ' ' + (r.label || '')));
  const ratio = (k, d) => { const r = per(k); return r && +r.ratio > 0 ? +r.ratio : d };
  const shared = ratio(/workshop|glaz|shared/i, 25), party = ratio(/kids.*party|splatter/i, 15), trip = ratio(/field/i, 30), camp = ratio(/camp|pa.?day/i, 15);
  const on = !!(_asn && _asn.on);
  return `<div class="as-rules">
  <p class="ho-intro">How Auto-schedule and the staff schedule decide things, in plain words. The numbers come from <b>👥 Studio staffing → 📏 Staffing rules</b>: change one there and it changes here, and in both schedulers.</p>

  <h3>1. Planning the workshop week</h3>
  <ul>
    <li>Press <b>Make the workshop schedule</b>: times nobody has booked are marked to come off, and new times are proposed for every studio. <b>Nothing changes until you press Approve and publish.</b></li>
    <li>How much a studio runs depends on its <b>staff that day</b> (👥 Studio staffing). Studios with Auto-schedule switched off there are left alone.</li>
    <li>Workshops and Mini Makes start on the hour or half hour; glazing starts at a quarter past. At most <b>${n(S.glazing_max_weekday)}</b> glazing time on a weekday and <b>${n(S.glazing_max_weekend)}</b> on a weekend day.</li>
    <li>Weekends follow a set pattern of afternoon times; studios with 3 or more staff also get midday times. Main Street also gets 9am times when there's no 9am kids class. Later times only go where they can finish by the studio's weekend closing (5pm unless set).</li>
    <li>On a weekday with no kids class, a studio can get a kids workshop at its set time (👥 Studio staffing).</li>
    <li>New times get <b>${n(sp.spots_small ?? 12)}</b> spots with 1–2 staff, <b>${n(sp.spots_big ?? 18)}</b> with 3 or more, and <b>${n(sp.spots_kids ?? 15)}</b> for kids-only times.</li>
    <li>A new time is only added when <b>at least one person is free</b> for it, after the people tied up with teaching (next section).</li>
    <li>A camp day at a small studio (2 staff or fewer, on a weekday): no workshops that day.</li>
    <li>A camp or PA/PD day on a day the studio is usually closed: planned with 1 person, 8:30am–5pm, without asking.</li>
    <li><b>Every open PA/PD day has at least 1 person, 8:30am–5pm,</b> planned in advance in the staff schedule, booked or not.</li>
    <li>A PA/PD day asks how the evening should run (tell us if it books, close, 1…n staff, one more teacher, or close the PA/PD day) <b>once the first child books</b>: the question arrives in 📋 For you within a minute. A field trip day asks as soon as it's booked. The answer is kept for the staff schedule.</li>
    <li><b>A PA/PD day still empty ${n(S.pa_empty_close_days ?? 4)} days before closes by itself</b> (the nightly run, with Undo); its 8:30–5 shift then shows as "could cut" for approval.</li>
  </ul>

  <h3>2. Who is tied up teaching (and for how long)</h3>
  <ul>
    <li><b>Kids class:</b> 1 teacher for ${hrs(S.class_min)} (or longer, if the class is set longer), plus <b>${n(S.class_after_min)} minutes after</b> for tidying and handing kids back.</li>
    <li><b>Clay Wheel class:</b> 1 teacher (wheel badge) for ${hrs(S.wheel_class_min)}. <b>Wheel Workshop:</b> ${hrs(S.wheel_workshop_min)}. A wheel class and a Wheel Workshop starting together share one teacher.</li>
    <li><b>Kids-only workshop:</b> 1 teacher for ${hrs(S.kids_workshop_min)}. A <b>Mini Make</b> runs ${n(S.mini_make_min)} minutes (unless its time is set to another length).</li>
    <li><b>Kids or Splatter party (booked):</b> 1 teacher per <b>${n(party)}</b> kids for the art time (${n(S.party_min)} minutes unless the party says otherwise), not the party time after. With only 1 staff, a ${n(S.lunch_after_party_min)}-minute break follows.</li>
    <li><b>Adult Get-Together or team building:</b> teachers for the <b>first ${n(S.get_together_intro_min)} minutes only</b> (the intro), 1 per <b>${n(AS_GT_PER)}</b> guests; after that it runs like a workshop.</li>
    <li><b>Field trip:</b> 1 teacher per <b>${n(trip)}</b>, going by the <b>expected</b> number (most only pay a deposit), for ${hrs(S.field_trip_min)} unless set. The daytime teacher works about ${hrs(S.day_teacher_span_min)}, starting 30 minutes before.</li>
    <li><b>Camp or PA/PD day:</b> 1 teacher per <b>${n(camp)}</b> campers, one of them the lead.</li>
    <li><b>Workshops, glazing, Mini Make:</b> shared by everyone in the studio at the time, <b>1 person per ${n(shared)}</b>, counted in 30-minute blocks, using the people expected (booked plus usual walk-ins).</li>
    <li><b>6pm Friday Kids Party:</b> ${S.fri6_party_shared !== false ? 'runs like a workshop: no teacher of its own, so Friday evening workshops go ahead around it.' : 'has its own teacher, like any party.'}</li>
    <li>A warning shows when more teacher-only times overlap than there are staff (for example two kids classes with 1 staff).</li>
  </ul>

  <h3>3. Party times</h3>
  <ul>
    <li>An open party time counts as "could still book" until it closes.</li>
    <li><b>Unbooked party times close ${n(S.open_party_close_days)} days before.</b></li>
    <li><b>Double or triple party times</b> with 2 or more rooms still open go down to <b>one room ${n(S.party_one_room_days)} days before</b> (Splatter closes before Kids).</li>
    <li><b>Splatter: only one at a time per studio.</b> The moment a Splatter time is booked, any other Splatter at that studio and time closes; two open Splatter times at the same time never both stay open.</li>
    <li><b>Adult Get-Together slots</b> are one time each, at every studio: they're never part of the "down to one room" rule, and only close when unbooked ${n(S.open_party_close_days)} days before.</li>
    <li>Field trips are never closed by these rules.</li>
  </ul>

  <h3>4. The staff schedule</h3>
  <ul>
    <li>The staff schedule plans at least as many people as Auto-schedule planned for each day, while anything is on. A <b>+ Staff</b> request adds one more person, over the hours given (or the busiest stretch).</li>
    <li>At least 1 person whenever anything is on. The day starts 30 minutes before the first booking.</li>
    <li><b>Shifts:</b> standard shapes; on weekdays any spare time goes at closing: a helper starts when first needed and stays to close (needed 7–8pm → 6:30–9:30, not 4:30–9:30); at least 3 hours; at most <b>${hrs(S.max_paid_min)}</b> paid (with the unpaid break by province); no 6-hour shifts like 3:30–9:30 unless the break is clear. Weekend days end at 5pm; weekday shifts flex with bookings.</li>
    <li><b>People:</b> never on unavailability or approved time off; one shift a day; at most <b>${n(S.max_days)}</b> days a week (2 days off, together if possible). Managers <b>${n(S.manager_min_hours)}–${n(S.manager_max_hours)}</b> hours a week (some marked to aim for ${n(S.manager_max_hours)}). New staff get 3 training shifts first. On-call staff only as a last resort.</li>
    <li><b>Weekends</b> follow 👥 Studio staffing's numbers. A <b>weekend floater</b> is only added if the day's labour stays under <b>${n(S.floater_max_pct)}%</b>, counting expected walk-ins.</li>
    <li>A class teacher also covers the studio during class when it's quiet: no party on, and at most <b>${n(S.quiet_booked)}</b> people at drop-in times.</li>
    <li>A day with nothing booked <b>${n(S.quiet_close_days)}</b> days before: nobody is scheduled.</li>
  </ul>

  <h3>5. The nightly run <span class="asn-pill ${on ? 'on' : ''}">${on ? 'On' : 'Off'}</span></h3>
  <ul>
    <li>${on ? 'Every night at about 2am, by itself:' : 'When switched on (🌙 Nightly run, on the Plan the week tab), every night at about 2am, by itself:'}</li>
    <li><b>Unbooked party times</b> close ${n(S.open_party_close_days)} days out; double or triple times go down to one room ${n(S.party_one_room_days)} days out.</li>
    <li><b>Workshop times nobody has booked ${n(+S.low_close_days + 1)} to ${n(S.swap_days)} days out</b> change to a more popular project (each time only once) at that studio (a different one for each time, never one already on that day, never wheel). Same time, same spots.</li>
    <li><b>Times expected to finish with fewer than ${n(S.low_people)} people</b>, up to ${n(S.low_close_days)} days out ("expected" = booked now plus the late bookings and walk-ins that time usually gets, from the last ${n(S.history_weeks)} weeks):
      <ul><li>nobody booked: it closes (spots to 0);</li><li>1 or 2 booked: it stays open, and a note asks whether to close it and move them;</li><li>not enough history to tell: it stays open.</li></ul></li>
    <li><b>A day with nothing booked at all</b> up to ${n(S.low_close_days)} days out: its workshop times close.</li>
    <li>Each rule looks at everything <b>up to</b> its number of days, so a missed night (or <b>▶ Run it now</b>) catches up.</li>
    <li><b>The class booking check:</b> every family should be on every week of the kids class they bought. Anyone missing a week, a week on a different day from week 1, or a paid class order with no booking is flagged in the morning.</li>
    <li><b>📋 For you:</b> every shift that could be cut, every short day, every PA/PD day or field trip whose evening hasn't been decided (next 3 weeks), every open Auto-schedule note (low times with 1–2 booked, a watched day that booked, + Staff) and every class booking problem goes to whoever holds that job (👤 Who gets these, in the nightly run card). <b>Approve</b> changes the shift and the staff member gets their usual shift-change notification in the 4Cats Team app; <b>Keep</b> leaves it and it isn't suggested again. Nothing changes without someone approving it.</li>
    <li><b>Then the staffing check</b> (the next 2 weeks): each studio's shifts against what's needed after those changes. It flags days that are <b>short</b> and shifts (or ends of shifts) that <b>could be cut</b>; it never changes a shift.</li>
    <li><b>Never:</b> deletes anything; changes anything with a booking; touches classes, camps, PA/PD days, wheel, field trips, booked parties, hidden times, or studios with Auto-schedule off. Every change can be undone.</li>
  </ul>
  ${_asRules.err ? `<p class="fd-sm">(Some numbers are the defaults: ${esc(_asRules.err)})</p>` : ''}
  </div>`;
}
// ---- 🌙 The nightly run (autosched_nightly.sql): closes and swaps by itself every night once switched on (rules doc 13, 30–33) ----
let _asn = { loaded: false, open: false, on: false, set: null, log: [], preview: null, busy: '', err: '', staff: [], staffAt: null, sopen: true, cls: [], clsErr: '', resp: null };
const ASN_ACT = { manual_close: '✋ Closed by hand', manual_reopen: '↩︎ Reopened by hand', swap_skipped: '↔︎ Swap skipped', close_pa_empty: '🎒 Empty PA/PD day closed', one_splatter: '🎨 One Splatter at a time', staff_short: '👤 Short', staff_cut: '✂️ Could cut', close_party: '🎉 Party closed', one_room: '🎉 Down to one room', swap: '🔁 Swapped', close_low: '✕ Closed (low)', close_quiet_day: '✕ Closed (quiet day)', note_low: '📋 Note: low, with bookings', keep_no_history: '• Kept (no history)' };
async function asNightlyLoad() {
  _asn.loaded = true;
  const [st, lg] = await Promise.all([sb.rpc('get_staffing_settings'), sb.rpc('hub_autosched_nightly_log', { p_days: 7 })]);
  if (lg.error) { _asn.err = /hub_autosched_nightly_log/.test(lg.error.message) ? 'Run autosched_nightly.sql in Supabase first.' : lg.error.message; asDraw(); return; }
  _asn.set = st.data || {}; _asn.on = !!_asn.set.nightly_on; _asn.log = (lg.data || []).filter(a => !/^(staff_|class_)/.test(a.action)); _asn.err = '';
  try { const rs = await sb.rpc('hub_responsibilities_list'); _asn.resp = rs.error ? null : (rs.data || []); if (!(_as.people || []).length) await asPeopleLoad(); } catch (e) { _asn.resp = null; }
  try { const cp = await sb.rpc('hub_class_problems'); _asn.clsErr = cp.error ? (/hub_class_problems/.test(cp.error.message) ? 'Run world_class_fix.sql in Supabase first.' : cp.error.message) : ''; _asn.cls = cp.error ? [] : (cp.data || []); } catch (e) { _asn.cls = []; }
  try { const sf = await sb.rpc('hub_autosched_staffing', { p_fresh: false }); _asn.staff = sf.error ? [] : (sf.data || []); _asn.staffAt = _asn.staff.length ? _asn.staff[0].checked_at : null; } catch (e) { _asn.staff = []; }
  asDraw();
}
// 👥 the staffing check: shifts against what's needed (flags only; you decide, the staff schedule makes the change)
async function asStaffCheckNow() {
  _asn.busy = 'staff'; _asn.wait = 'Queued: starts within a minute…'; asDraw();
  try { const data = await asQueued('staffing'); _asn.staff = data || []; _asn.staffAt = new Date().toISOString(); try { myNotesLoad(); } catch (e) {} }
  catch (e) { alert(e.message); }
  _asn.busy = ''; _asn.wait = ''; asDraw();
}
async function asStaffExtra(st, d) {   // 👤 request another staff on that day (the + Staff flow: hours, To-do note, the staff schedule places them)
  if (!_as.plan || d < _as.week || d > asAddDays(_as.week, 6)) { _as.week = asMonday(d); _as.plan = null; await asMake(); }
  await asExtra(st, d, 1);
}
async function asStaffNote(st, d, text) {   // 📋 a note for the day (assign it to the coordinator in the Overview: it goes to their tasks)
  const { error } = await sb.rpc('hub_autosched_note_save', { p: { studio_id: st, day: d, kind: 'staff', body: 'Staffing: ' + text } });
  if (error) { alert(error.message); return; }
  try { await asNotesLoad(); } catch (e) {}
  alert('Note added for ' + (STUDIO_NAMES[st] || st) + '. Assign it to someone in the Overview (📋 Notes): it goes to their tasks.');
}
// 📚 class bookings: families missing a week of a class they paid for, weeks on the wrong day, paid with no booking
const ASN_CLS = { missing_week: '📚 Missing a week', off_day_week: '📅 Week on the wrong day', paid_not_booked: '💳 Paid, not booked' };
async function asClassCheckNow() {
  _asn.busy = 'cls'; asDraw();
  const { data, error } = await sb.rpc('hub_class_problems'); _asn.busy = '';
  if (error) { alert(error.message); asDraw(); return; }
  _asn.cls = data || []; asDraw();
}
async function asRespSave(key, email) {
  const { error } = await sb.rpc('hub_responsibility_save', { p_key: key, p_emails: email ? [email] : [] });
  if (error) { alert(error.message); return; }
  const r = (_asn.resp || []).find(x => x.key === key); if (r) r.emails = email ? [email] : [];
  asDraw(); try { myNotesLoad(); } catch (e) {}
}
function asRespHtml() {
  if (!_asn.resp) return '';
  const ppl = (_as.people || []).filter(p => p.kind === 'admin');
  return `<h4>👤 Who gets these</h4><p class="fd-sm">Each goes to one person's 📋 For you card in the Hub (nobody picked: every Studio Ops admin sees them).</p>
    <div class="asn-resp">${_asn.resp.map(r => `<label>${esc(r.label)}${r.open ? ` <span class="fd-sm">(${r.open} open)</span>` : ''}
      <select ${_hoCan.edit ? '' : 'disabled'} onchange="asRespSave('${escAttr(r.key)}', this.value)"><option value="">Nobody picked</option>${ppl.map(p => `<option value="${escAttr(p.email)}" ${(r.emails || []).includes(p.email) ? 'selected' : ''}>${esc(p.name || p.email)}</option>`).join('')}</select></label>`).join('')}</div>`;
}
function asClassHtml() {
  const L = _asn.cls || [], fmt = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  return `<h4>📚 Class bookings <span class="fd-sm">${L.length ? `<b style="color:#b3261e">${L.length} to look at</b>` : 'all families on all their weeks'}</span>
      <button class="ho-btn" ${_asn.busy ? 'disabled' : ''} onclick="asClassCheckNow()">${_asn.busy === 'cls' ? 'Checking…' : '↻ Check now'}</button></h4>
    ${_asn.clsErr ? `<p class="fd-sm">${esc(_asn.clsErr)}</p>` : ''}
    <p class="fd-sm">Every kids class: each family should be on every week of the class they bought. Checked every night; anything here needs a person (the repair in world_class_fix.sql fixes what it safely can).</p>
    ${L.length ? `<table class="fd-tbl asn-tbl"><thead><tr><th>Day</th><th>Studio</th><th>What</th><th></th></tr></thead><tbody>${L.map(x => `<tr><td>${esc(fmt(x.day))}</td><td>${esc(STUDIO_NAMES[x.studio_id] || x.studio_id || '')}</td><td><b>${esc(ASN_CLS[x.problem] || x.problem)}</b></td><td>${esc((x.order ? x.order + ': ' : '') + (x.detail || ''))}</td></tr>`).join('')}</tbody></table>` : ''}`;
}
function asStaffHtml() {
  const L = _asn.staff || [], fmt = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const short = L.filter(x => x.kind === 'staff_short'), cut = L.filter(x => x.kind === 'staff_cut');
  const row = x => `<tr><td>${esc(fmt(x.day))}</td><td>${esc(STUDIO_NAMES[x.studio_id] || x.studio_id)}</td><td><b>${esc(ASN_ACT[x.kind] || x.kind)}</b></td><td>${esc(x.detail || '')}</td>
    <td style="white-space:nowrap">${_hoCan.edit ? (x.kind === 'staff_short' ? `<button class="ho-btn" onclick="asStaffExtra('${escAttr(x.studio_id)}','${escAttr(String(x.day).slice(0, 10))}')">👤 + Staff</button> ` : '')
      + `<button class="ho-btn" onclick="asStaffNote('${escAttr(x.studio_id)}','${escAttr(String(x.day).slice(0, 10))}', this.closest('tr').children[3].textContent)">📋 Note</button>` : ''}</td></tr>`;
  return `<h4>👥 Staffing check: the next 2 weeks <span class="fd-sm">${_asn.staffAt ? 'checked ' + esc(new Date(_asn.staffAt).toLocaleString('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit' })) : 'not checked yet'} · ${short.length} short · ${cut.length} could cut</span>
      <button class="ho-btn" ${_asn.busy ? 'disabled' : ''} onclick="asStaffCheckNow()">${_asn.busy === 'staff' ? 'Checking…' : '↻ Check now'}</button></h4>
    <p class="fd-sm">Shifts against what each day needs now (the same rules as the staff schedule, after tonight’s closings). Nothing changes by itself: <b>+ Staff</b> asks the staff schedule for one more person; <b>Note</b> puts it on the day’s To-do (assign it to the coordinator and it goes to their tasks). Shorten or remove a shift in the staff schedule.</p>
    ${L.length ? `<table class="fd-tbl asn-tbl"><thead><tr><th>Day</th><th>Studio</th><th>What</th><th></th><th></th></tr></thead><tbody>${short.concat(cut).map(row).join('')}</tbody></table>` : '<p class="fd-sm">Nothing to flag.</p>'}`;
}
function asNightlyList(list, withUndo) {
  if (!list.length) return '<p class="fd-sm">Nothing.</p>';
  const fmt = d => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  return `<table class="fd-tbl asn-tbl"><thead><tr><th>Day</th><th>Studio</th><th>What</th><th></th>${withUndo ? '<th></th>' : ''}</tr></thead><tbody>${list.map(a => `<tr${a.undone_at ? ' class="asn-undone"' : ''}>
    <td>${esc(fmt(a.day))}</td><td>${esc(STUDIO_NAMES[a.studio_id] || a.studio_id)}</td><td><b>${esc(ASN_ACT[a.action] || a.action)}</b></td><td>${esc(a.detail || '')}</td>
    ${withUndo ? `<td>${a.undone_at ? `<span class="fd-sm">undone${a.undone_by ? ' by ' + esc(String(a.undone_by).split('@')[0]) : ''}</span>` : a.can_undo && _hoCan.edit ? `<button class="ho-btn" onclick="asNightlyUndo(${+a.id})">Undo</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table>`;
}
function asNightlyHtml() {
  if (!_asn.loaded) { setTimeout(asNightlyLoad, 0); }
  const N = _asn, real = (N.log || []).filter(a => a.action !== 'keep_no_history');
  const last = N.log && N.log.length ? new Date(N.log[0].run_at) : null;
  const head = `<button class="asn-head" onclick="_asn.open=!_asn.open;asDraw()" aria-expanded="${N.open}">🌙 <b>Nightly run</b>
    <span class="asn-pill ${N.on ? 'on' : ''}">${N.on ? 'On' : 'Off'}</span>
    <span class="fd-sm">${N.err ? esc(N.err) : last ? `last change ${esc(last.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))} · ${real.length} change${real.length === 1 ? '' : 's'} this week` : N.on ? 'nothing changed yet' : 'switched off: nothing changes by itself'}${(N.cls || []).length ? ` · <b style="color:#b3261e">${N.cls.length} class booking${N.cls.length === 1 ? '' : 's'} to look at</b>` : ''}${(N.staff || []).length ? ` · <b>${N.staff.filter(x => x.kind === 'staff_short').length} short, ${N.staff.filter(x => x.kind === 'staff_cut').length} could cut</b>` : ''}</span>
    <span class="asn-car">${N.open ? '▾' : '▸'}</span></button>`;
  if (!N.open || N.err) return `<div class="asn">${head}</div>`;
  return `<div class="asn">${head}<div class="asn-body">
    <p class="fd-sm">Every night at about 2am, by itself: unbooked party times close a week out (double times go down to one room two weeks out); workshop times nobody has booked a week out swap to the studio’s most-booked project; times expected to finish under ${esc(N.set.low_people ?? 3)} close ${esc(N.set.low_close_days ?? 3)} days out if nobody’s booked (with bookings: a note here instead, nobody is moved); a day with nothing booked closes its workshop times. Never classes, camps, wheel, booked parties, or studios with Auto-schedule off. Every change can be undone.</p>
    <div class="asn-bar">${_hoCan.edit ? `<label class="asn-sw"><input type="checkbox" class="fd-tick" ${N.on ? 'checked' : ''} ${N.busy ? 'disabled' : ''} onchange="asNightlyToggle(this.checked)"> Run every night</label>` : ''}
      <button class="ho-btn" ${N.busy ? 'disabled' : ''} onclick="asNightlyPreview()">${N.busy === 'preview' ? 'Looking…' : '👁 Preview tonight’s run'}</button>
      ${_hoCan.edit ? `<button class="ho-btn" ${N.busy ? 'disabled' : ''} onclick="asNightlyNow()">${N.busy === 'run' ? 'Running…' : '▶ Run it now'}</button>` : ''}
      <span class="fd-sm">Settings (how low, how many days out): 👥 Studio staffing → 📏 Staffing rules.</span></div>
    ${N.wait ? `<p class="asn-wait">⏳ ${esc(N.wait)} <span class="fd-sm">(the whole network takes a minute or two; you can leave this open)</span></p>` : ''}
    ${asRespHtml()}
    ${asClassHtml()}
    ${asStaffHtml()}
    ${N.preview ? `<h4>Tonight’s run would do this <span class="fd-sm">(nothing has changed)</span></h4>${asNightlyList(N.preview, false)}` : ''}
    <h4>The last 7 days</h4>${asNightlyList(N.log || [], true)}
  </div></div>`;
}
async function asNightlyToggle(on) {
  _asn.busy = 'save'; asDraw();
  const next = Object.assign({}, _asn.set || {}, { nightly_on: !!on });
  const { data, error } = await sb.rpc('save_staffing_settings', { p: next });
  _asn.busy = '';
  if (error) { alert('Not saved: ' + error.message); asNightlyLoad(); return; }
  _asn.set = data; _asn.on = !!data.nightly_on; asDraw();
}
// The whole network takes longer than the app's 8-second limit, so these are queued: the database runs them within a minute
// (no limit, as you) and the card fills in by itself (autosched_nightly.sql: autosched_nightly_requests)
async function asQueued(kind) {
  const r = await sb.rpc('hub_autosched_nightly_request', { p_kind: kind });
  if (r.error) throw new Error(/hub_autosched_nightly_request/.test(r.error.message) ? 'Run autosched_nightly.sql in Supabase first (the buttons are queued now).' : r.error.message);
  const id = r.data, t0 = Date.now();
  while (Date.now() - t0 < 6 * 60 * 1000) {
    await new Promise(ok => setTimeout(ok, 4000));
    const g = await sb.rpc('hub_autosched_nightly_request_get', { p_id: id });
    if (g.error) throw new Error(g.error.message);
    const x = g.data || {};
    if (x.status === 'done') return x.result;
    if (x.status === 'failed') throw new Error(x.error || 'It didn\u2019t finish');
    _asn.wait = x.status === 'working' ? 'Working on it…' : 'Queued: starts within a minute…'; asDraw();
  }
  throw new Error('Still working on it. Look again in a few minutes (Last 7 days shows what it did).');
}
async function asNightlyPreview() {
  _asn.busy = 'preview'; _asn.wait = 'Queued: starts within a minute…'; asDraw();
  try { const data = await asQueued('preview'); _asn.preview = (data && data.actions) || []; }
  catch (e) { alert(e.message); }
  _asn.busy = ''; _asn.wait = ''; asDraw();
}
async function asNightlyNow() {
  const n = (_asn.preview || []).filter(a => !['keep_no_history'].includes(a.action)).length;
  if (!confirm(`Run tonight's changes now${_asn.preview ? ` (${n} change${n === 1 ? '' : 's'}, as in the preview)` : ''}? Each one can be undone.`)) return;
  _asn.busy = 'run'; _asn.wait = 'Queued: starts within a minute…'; asDraw();
  try { await asQueued('run'); } catch (e) { alert(e.message); _asn.busy = ''; _asn.wait = ''; asDraw(); return; }
  _asn.busy = ''; _asn.wait = '';
  _asn.preview = null; await asNightlyLoad();
  try { myNotesLoad(); } catch (e) {}
  if (_as.plan) asMake();   // (the week's plan, with the new state)
}
async function asNightlyUndo(id) {
  const { error } = await sb.rpc('hub_autosched_nightly_undo', { p_id: id });
  if (error) { alert(error.message); return; }
  await asNightlyLoad(); if (_as.plan) asMake();
}
// the day's staff in its header: on a PA/PD or field trip day whose evening was set, the usual and the evening's ("2 staff · evening 1")
function asDayStaff(D) {
  if (!D.staff) return '';
  const n = x => x + (x >= 4 ? '+' : '') + ' staff';
  return D.pad && D.pad.usual && D.pad.ans !== undefined && /^\d+$/.test(String(D.pad.ans)) && +D.pad.usual !== +D.staff ? `${n(D.pad.usual)} · evening ${D.staff}` : n(D.staff);
}
function asCount() { let add = 0, rem = 0, close = 0; (_as.plan ? _as.plan.studios : []).filter(S => !S.published).forEach(S => S.days.forEach(D => D.entries.forEach(e => { if (e.t === 'new' && e.on) add++; if (e.t === 'old' && e.s.remove && !e.keep) rem++; if (e.closeLead && e.close) close++; }))); return { add, rem, close }; }
function asStudioHtml(S, si) {
  const P = _as.plan, items = P.items, open = _as.open[S.id] !== false;
  const n = S.days.reduce((t, D) => t + D.entries.filter(e => e.t === 'new' && e.on).length, 0), r = S.days.reduce((t, D) => t + D.entries.filter(e => e.t === 'old' && e.s.remove && !e.keep).length, 0);
  const c = S.days.reduce((t, D) => t + D.entries.filter(e => e.closeLead && e.close).length, 0);
  const warn = S.days.some(D => D.notes.some(x => x.startsWith('⚠')));
  const sv = _as.sview[S.id] || _as.view;
  let h = `<div class="as-studio" id="as-st-${S.id}"><div class="as-shw"><button class="as-sh" onclick="_as.open['${S.id}']=${open ? 'false' : 'true'};asDraw()"><b>${esc(STUDIO_NAMES[S.id] || S.id)}</b><span>${n} new · ${r} off${c ? ` · ${c} party time${c === 1 ? '' : 's'} closing` : ''}${warn ? ' · ⚠ check' : ''}</span><span class="spacer"></span>${open ? '▾' : '▸'}</button>
    ${S.published ? `<span class="as-pub">✓ Published: ${+S.published.added || 0} new, ${+S.published.removed || 0} off${S.published.kept ? `, ${S.published.kept} kept (booked meanwhile)` : ''}${S.published.closed ? `, ${S.published.closed} party spot${S.published.closed === 1 ? '' : 's'} closed` : ''}</span>`
      : S.skipped ? `<span class="as-pub as-skipped">🚫 No changes this week</span><button class="ho-btn as-pubone" onclick="asSkip('${S.id}')">↺ Use the suggestions</button>`
      : (n || r || c) ? `<button class="ho-btn as-pubone" onclick="asSkip('${S.id}')" title="Leave this studio's week as it is: nothing new, nothing taken off">🚫 Don’t make any changes</button>` +  `<button class="ho-btn as-pubone" ${_as.busy ? 'disabled' : ''} onclick="asPublish('${S.id}')">Publish this studio</button>`
      : `<span class="as-pub">✓ Up to date</span><button class="ho-btn as-pubone" onclick="_as.open['${S.id}']=${open ? 'false' : 'true'};asDraw()">${open ? 'Collapse' : 'Expand'}</button>`}
    ${open && !S.published ? `<span class="as-view as-view-sm" role="group" aria-label="Show for ${escAttr(STUDIO_NAMES[S.id] || S.id)}"><button class="${sv !== 'after' ? 'on' : ''}" onclick="_as.sview['${S.id}']='changes';asDraw()">Changes</button><button class="${sv === 'after' ? 'on' : ''}" onclick="_as.sview['${S.id}']='after';asDraw()">After publishing</button></span>` : ''}</div>`;
  if (S.notes.length) h += `<p class="as-note">${S.notes.map(esc).join(' ')}</p>`;
  if (!open) return h + '</div>';
  if (sv === 'after' || S.published) return h + asAfterHtml(S) + '</div>';
  h += '<div class="as-week">' + S.days.map((D, di) => `<div class="as-day${D.staff === 0 ? ' closed' : ''}"><div class="as-dh">${new Date(D.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' })}<span>${asDayStaff(D)}</span></div>` +
    asNotesHtml(S.id, D.date) +
    (D.pad && !S.published ? asPadHtml(S, D) : '') +
    D.notes.filter(x => !(D.pad && (x.startsWith('🎒') || x.startsWith('🚌'))) && !x.startsWith('⚠')).map(x => `<div class="as-dn">${esc(x)}</div>`).join('') +
    asDayWarnHtml(S, D) +
    D.entries.map((e, ei) => {
      if (e.t === 'old') {
        const s = e.s, rem = s.remove && !e.keep;
        if (!['workshop', 'glazing', 'mini', 'wheel', 'kidsws', 'class', 'party', 'field', 'group', 'camp', 'paday'].includes(s.k)) return '';
        // an open party, get-together or field trip time nobody has booked: a light row (Auto-schedule never changes these),
        // one per time and kind (Kids and Splatter products at the same time show once)
        if (['party', 'group', 'field'].includes(s.k) && !s.booked) {
          const lbl = s.k === 'party' ? (/splatter/i.test(s.title || '') ? 'Splatter Party' : 'Kids Party') : fdClean(s.title);
          const dup = D.entries.slice(0, ei).some(o => o.t === 'old' && o.s && ['party', 'group', 'field'].includes(o.s.k) && !o.s.booked && o.s.start === s.start
            && (o.s.k === 'party' ? (/splatter/i.test(o.s.title || '') ? 'Splatter Party' : 'Kids Party') : fdClean(o.s.title)) === lbl);
          if (e.closeLead) return asPartyCloseHtml(s, e, si, di, ei, lbl);
          if (e.closeP || dup) return '';
          if (s.k === 'field') return `<div class="as-e as-open" title="Open for booking. Auto-schedule doesn’t change field trip times."><b>${asT(s.start)}</b> ${esc(lbl)} <span>open, not booked</span></div>`;
          return `<div class="as-e as-open" style="cursor:pointer" onclick="asCloseManual('${escAttr(S.id)}', '${escAttr(D.date)}', ${s.start}, '${s.k}')" title="Open for booking. Tap to close it (its open spots go to 0 when you publish)."><b>${asT(s.start)}</b> ${esc(lbl)} <span>open, not booked · tap to close</span></div>`;
        }
        if (e.closeLead) return asOldRow() + asPartyCloseHtml(s, e, si, di, ei, s.k === 'party' ? (/splatter/i.test(s.title || '') ? 'Splatter Party' : 'Kids Party') : fdClean(s.title));
        return asOldRow();
        function asOldRow() { return `<div class="as-e ${rem ? 'rem' : 'old'}${s.k === 'class' && !s.booked ? ' cls0' : ''}${s.k === 'glazing' ? ' as-glz' : ''}"${s.remove ? ` onclick="asToggleRem(${si},${di},${ei})" title="${rem ? 'Comes off (0 bookings). Tap to keep it.' : 'Kept. Tap to take it off.'}"` : ''}><b>${asT(s.start)}</b> ${esc(fdClean(s.title))}<span>${asCounts(s, rem, e.same)}</span></div>`; }
      }
      if (!e.on) return `<div class="as-e drop" onclick="asNew(${si},${di},${ei},'on',true)" title="Tap to add it back"><b>${asT(e.start)}</b> ${esc(AS_KIND_LABEL[e.k])} <span>left out</span></div>`;
      const it = items[e.item] || {}, opts = e.k === 'glazing' ? [] : P.pool.filter(i => (e.k === 'mini' ? i._mini : !i._mini && i.kind !== 'glazing') && (e.k !== 'kidsws' || i.kids_ok || i.id === e.item));
      return `<div class="as-e new${e.k === 'glazing' ? ' as-glz' : ''}"><div class="as-er"><input type="time" step="900" value="${asHM(e.start)}" onchange="asNew(${si},${di},${ei},'start',asMin(this.value))"><button class="as-x" onclick="asNew(${si},${di},${ei},'on',false)" title="Leave this one out">✕</button></div>` +
        (opts.length ? `<select title="${escAttr(it.title || '')}" onchange="asNew(${si},${di},${ei},'item',this.value)">${opts.map(i => `<option value="${escAttr(i.id)}"${i.id === e.item ? ' selected' : ''}>${esc(i.title)}${i.featured ? ' ⭐' : ''}</option>`).join('')}</select>` : `<b>${esc(it.title || 'Glazing')}</b>`) +
        `<span>${esc(AS_KIND_LABEL[e.k])} · ${e.spots} spots${e.manual ? ' · added by you' : ''}</span></div>`;
    }).join('') + `<div class="as-addb"><button class="as-noteb" onclick="asNoteNew('${S.id}','${D.date}')">📝 Note</button>${D.staff ? `<button class="as-staffb" onclick="asExtra('${S.id}','${D.date}',1)" title="Bring in a part-timer or home office: plan this day with one more staff">👤 + Staff</button>` : ''}${D.extra ? `<button onclick="asExtra('${S.id}','${D.date}',-1)" title="Plan without the extra person again">undo +staff</button>` : ''}</div>` + (D.staff && !D.notes.some(x => /^(Closed|🎌|Past)/.test(x)) ? `<div class="as-addb"><button onclick="asAddManual(${si},${di},'workshop')" title="Add a workshop time">+ Workshop</button><button onclick="asAddManual(${si},${di},'kidsws')" title="Add a kids-only workshop time">+ Kids</button><button onclick="asAddManual(${si},${di},'glazing')" title="Add a glazing time">+ Glazing</button></div>` : '') + '</div>').join('') + '</div></div>';
  return h;
}
// "After publishing": the week as it will be, kept and new times together, in time order (read-only)
function asAfterHtml(S) {
  const items = _as.plan.items, shown = ['workshop', 'glazing', 'mini', 'wheel', 'kidsws', 'class', 'party', 'field', 'group', 'camp', 'paday'];
  return '<div class="as-week">' + S.days.map(D => {
    const list = [];
    D.entries.forEach(e => {
      if (e.t === 'old') { const s = e.s; if (s.remove && !e.keep) return; if (!shown.includes(s.k) || (['party', 'group', 'field'].includes(s.k) && !s.booked)) return;
        list.push({ start: s.start, title: fdClean(s.title), sub: asCounts(s, false, e.same), cls: 'old' + (s.k === 'class' && !s.booked ? ' cls0' : '') }); }
      else if (e.on) { const it = items[e.item] || {}; list.push({ start: e.start, title: it.title || AS_KIND_LABEL[e.k], sub: `${AS_KIND_LABEL[e.k]} · ${e.spots} spots`, cls: 'new', tag: true }); }
    });
    list.sort((a, b) => a.start - b.start);
    const closed = D.notes.find(x => /^(Closed|🎌|Camp day|Past)/.test(x));
    return `<div class="as-day${D.staff === 0 ? ' closed' : ''}"><div class="as-dh">${new Date(D.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' })}<span>${asDayStaff(D)}</span></div>` +
      (closed ? `<div class="as-dn">${esc(closed)}</div>` : '') + asNotesHtml(S.id, D.date) +
      (list.length ? list.map(x => `<div class="as-e ${x.cls}"><div><b>${asT(x.start)}</b>${x.tag ? ' <i class="as-newtag">new</i>' : ''}</div><div>${esc(x.title)}</div>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</div>`).join('') : (closed ? '' : '<div class="as-dn">Nothing on</div>')) + '</div>';
  }).join('') + '</div>';
}
// 🎒 A PA/PD day's evening: close it, or open with how many staff (up to the usual); then that studio's week is made again
function asPadOpts(P) {
  const n = Math.max(1, P.usual || 1);
  return [['', 'Choose…']].concat(P.kind === 'field' ? [] : [['watch', 'Keep both open, tell us if it books']]).concat([['close', 'Close the evening']])
    .concat(Array.from({ length: n }, (_, i) => [String(i + 1), `Open with ${i + 1} staff${i + 1 === n ? ' (normal)' : ''}`]))
    .concat([['more', 'Keep the evening open, bring in one more teacher']])
    .concat(P.kind === 'field' ? [] : [['cancel_pa', 'Close the PA/PD day']]);
}
// who's coming: PA/PD days by kids booked; field trips by the expected number (usually only a deposit is booked)
const asPadWho = P => P.kind === 'field' ? (P.expected != null ? `about ${P.expected} expected` : 'expected number not set yet (deposit paid)') : `${P.kids} kid${P.kids === 1 ? '' : 's'} booked`;
const asPadName = P => P.kind === 'field' ? `🚌 <b>Field trip${P.time ? ' ' + esc(P.time) : ''}</b>` : '🎒 <b>PA/PD day</b>';
function asPadHtml(S, D) {
  const P = D.pad, opts = asPadOpts(P);
  return `<label class="as-pad${P.ans === undefined ? ' ask' : ''}${P.low ? ' low' : ''}">${asPadName(P)} · ${asPadWho(P)}${P.low ? `<span class="as-padlow">⚠ Under ${P.min}: cancel it, or run more in the evening?</span>` : ''}<span>The evening?</span><select onchange="asPadSet('${S.id}','${D.date}',this.value)">${opts.map(o => `<option value="${o[0]}"${String(P.ans ?? '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
}
function asPadSet(st, d, v) {
  const k = st + '|' + d, was = _as.pad[k];
  // one more teacher, or closing the PA/PD day: a note on 📋 To-do (only when newly chosen)
  if ((v === 'more' || v === 'cancel_pa') && was !== v && typeof sb !== 'undefined') {
    const Dx = ((((_as.plan || {}).studios || []).find(x => x.id === st) || {}).days || []).find(x => x.date === d) || {};
    const usual = (Dx.pad && Dx.pad.usual) || Dx.staff || 1;
    const body = v === 'more' ? `Bring in one more teacher for the evening (planned with ${usual + 1} staff)${Dx.pad && Dx.pad.kind === 'field' ? ' · field trip day' : ' · PA/PD day'}`
      : `Close the PA/PD day: let the booked families know and credit them (${(Dx.pad && Dx.pad.kids) || 0} booked)`;
    sb.rpc('hub_autosched_note_save', { p: { studio_id: st, day: d, kind: v === 'more' ? 'staff' : 'paday', body } }).then(() => { try { asNotesLoad(); } catch (e) {} }, () => {});
  }
  if (v === 'watch' || was === 'watch') {
    const ids = ((_as.data && _as.data.sessions) || []).filter(x => x.studio_id === st && x.date === d && /\bp[ad] day|pa\/pd|no[\s-]school/i.test(x.title || '')).map(x => x.id);
    const min = +(((_as.data || {}).settings || {}).pa_min ?? 8);
    if (ids.length) sb.rpc('hub_autosched_watch', { p_session_ids: ids, p_min: min, p_on: v === 'watch' }).then(r => {
      if (r.error) alert('The watch list isn’t set up: ' + (/hub_autosched_watch/.test(r.error.message) ? 'run autosched_watch.sql first.' : r.error.message));
    });
  }
  if (v === '') delete _as.pad[k]; else _as.pad[k] = v;
  const P = _as.plan, i = P.studios.findIndex(x => x.id === st); if (i < 0 || !_as.data) return;
  const one = asBuild(_as.data, st).studios[0]; if (one) P.studios[i] = one;   // just this studio's week again
  asDraw(); asDayPlanSoon();
}
// + Workshop / + Kids / + Glazing: a one-off time added by hand (4pm to start; change the time and the workshop in the box)
function asAddManual(si, di, k) {
  const P = _as.plan, S = P.studios[si], D = S.days[di], set = (_as.data && _as.data.settings) || {};
  const usedToday = new Set(D.entries.map(e => e.t === 'new' ? (P.items[e.item] || {}).project_id : e.s.item && P.items[e.s.item] ? P.items[e.s.item].project_id : null).filter(Boolean));
  let it;
  if (k === 'glazing') it = P.glazingItem;
  else {
    const ok = P.pool.filter(i => !i._mini && i.kind !== 'glazing' && (!i.offer_from || i.offer_from <= D.date) && (!i.offer_until || i.offer_until >= D.date) && (k !== 'kidsws' || i.kids_ok));
    const score = i => (usedToday.has(i.project_id) ? -100000 : 0) + (i.featured ? 1000 : 0) + (+i.likes || 0) * 3 + (+i.booked90 || 0);
    it = ok.sort((a, b) => score(b) - score(a))[0];
  }
  if (!it) { alert(k === 'glazing' ? 'There’s no glazing item to add.' : k === 'kidsws' ? 'No 🧒 Good for kids workshop is offered on this date (tick some in Workshops).' : 'No workshop is offered on this date.'); return; }
  const spots = k === 'kidsws' ? (+set.spots_kids || 15) : (D.staff >= 3 ? (+set.spots_big || 18) : (+set.spots_small || 12));
  D.entries.push({ t: 'new', k, start: 16 * 60, len: 120, item: it.id, spots, kids: k === 'kidsws', on: true, manual: true });
  D.entries.sort((a, b) => (a.t === 'old' ? a.s.start : a.start) - (b.t === 'old' ? b.s.start : b.start));
  asDraw();
}
// What's booked and what's left on a time already on the schedule
function asCounts(s, rem, same) {
  const b = +s.booked || 0, cap = s.capacity == null ? null : +s.capacity, left = s.left != null ? Math.max(0, +s.left) : (cap != null ? Math.max(0, cap - b) : null);
  const leftTxt = left != null ? ` · ${left} left` : '';
  if (s.k === 'party') return b ? 'party · booked' : 'party';
  if (s.k === 'class' || (s.k === 'wheel' && s._series)) return `${s.k === 'wheel' ? 'wheel class' : 'class'} · ${b} enrolled${leftTxt}`;
  if (s.k === 'group' || s.k === 'field') return b ? 'booked' : 'open';
  if (rem) return `${b} booked · off`;
  return `${b} booked${leftTxt}${same ? ' · stays, same as the plan' : ''}`;
}
// ---- 📝 Notes and to-dos (autosched_notes.sql): on a studio's day; saved for everyone; ✓ Done when handled ----
const AS_NOTE_KINDS = [['staff', '👤 Need another staff'], ['cancel', '✕ Cancel a time'], ['paday', '🎒 PA/PD day'], ['other', '📝 Other']];
async function asNotesLoad(quiet) {
  const [w, o] = await Promise.all([sb.rpc('hub_autosched_notes', { p_from: _as.week, p_to: asAddDays(_as.week, 6), p_open: false }), sb.rpc('hub_autosched_notes', { p_from: null, p_to: null, p_open: true })]);
  _as.notes = w.error ? [] : (w.data || []); _as.openNotes = o.error ? null : (o.data || []);
  _as.notesErr = w.error && /hub_autosched_notes/.test(w.error.message) ? 'Run autosched_notes.sql to use notes.' : '';
  // 👤 + Staff is remembered by its note ("Bring in another staff…", to-do or done): the week is planned with them every time
  if (!w.error) {
    const was = _as.extra, now = asExtraFromNotes();
    const changed = [...new Set(Object.keys(was).concat(Object.keys(now)))].filter(k => (+was[k] || 0) !== (+now[k] || 0));
    _as.extra = now;
    if (!quiet && changed.length && _as.plan && _as.data) {
      [...new Set(changed.map(k => k.split('|')[0]))].forEach(st => { const i = _as.plan.studios.findIndex(x => x.id === st); if (i >= 0 && !_as.plan.studios[i].published) { const one = asBuild(_as.data, st).studios[0]; if (one) _as.plan.studios[i] = one; } });
    }
  }
  if (!quiet) { asDraw(); asDayPlanSoon(); }
}
const AS_EXTRA_NOTE = /^Bring in another staff/i;
function asExtraFromNotes() {
  const out = {};
  (_as.notes || []).forEach(n => { if (n.kind === 'staff' && AS_EXTRA_NOTE.test(String(n.body || ''))) { const k = n.studio_id + '|' + n.day; out[k] = (out[k] || 0) + 1; } });
  return out;
}
function asNotesHtml(sid, d) {
  return (_as.notes || []).filter(n => n.studio_id === sid && n.day === d).map(n => `<div class="as-note2${n.done ? ' done' : ''}"><div><b>${esc((AS_NOTE_KINDS.find(k => k[0] === n.kind) || [, '📝'])[1])}</b></div><div>${esc(n.body)}</div>
    <div class="as-note2b"><span>${esc(String(n.created_by || '').split('@')[0])}${n.done ? ' · done' : ''}</span><button onclick="asNoteDone('${n.id}',${!n.done})">${n.done ? 'Undo' : '✓ Done'}</button><button onclick="asNoteDel('${n.id}')" title="Delete">✕</button></div></div>`).join('');
}
function asNoteNew(sid, d, pre) {
  if (!_as.people) { asPeopleLoad().then(() => asNoteNew(sid, d, pre)); return; }
  pre = pre || {};
  openDutySheet(`<h3>${esc(pre.title || '📝 Note')} · ${esc(STUDIO_NAMES[sid] || sid)}</h3><p class="ho-intro">${esc(new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }))}</p>
    <div class="ba-form"><label class="f">What kind<select id="asn-kind">${AS_NOTE_KINDS.map(k => `<option value="${k[0]}"${pre.kind === k[0] ? ' selected' : ''}>${esc(k[1])}</option>`).join('')}</select></label>
    <label class="f">Note<textarea id="asn-body" rows="${pre.body ? 5 : 3}" maxlength="1000" placeholder="e.g. Ask Sarah to come in 5–8 for the evening">${esc(pre.body || '')}</textarea></label>
    <label class="f">For <span class="fd-sm">(optional: they see it on their Today screen)</span>${asAssignSelect({ studio_id: sid }, 'asn-for', '')}</label><p class="fd-msg" id="asn-msg"></p></div>
    <div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" onclick="asNoteSave('${sid}','${d}')">Save note</button></div>`);
  setTimeout(() => { const t = document.getElementById('asn-body'); if (t) { t.focus(); t.selectionStart = t.selectionEnd = t.value.length; } }, 50);
}
async function asNoteSave(sid, d) {
  const body = (document.getElementById('asn-body') || {}).value || '', kind = (document.getElementById('asn-kind') || {}).value || 'other';
  if (!body.trim()) { document.getElementById('asn-msg').textContent = 'Write the note.'; return; }
  const fe = (document.getElementById('asn-for') || {}).value || '', fp = (_as.people || []).find(x => x.email === fe);
  const { error } = await sb.rpc('hub_autosched_note_save', { p: Object.assign({ studio_id: sid, day: d, kind, body }, fe ? { assigned_email: fe, assigned_name: fp ? fp.name : fe } : {}) });
  if (error) { document.getElementById('asn-msg').textContent = 'Not saved: ' + (/hub_autosched_note_save/.test(error.message) ? 'run autosched_notes.sql first.' : error.message); return; }
  closeDutySheet(); asNotesLoad();
}
async function asNoteDone(id, done) {
  const { error } = await sb.rpc('hub_autosched_note_save', { p: { id, done } });
  if (error) { alert(error.message); return; }
  await asNotesLoad(); if (document.getElementById('as-todo')) asTodo();
}
async function asNoteDel(id) {
  if (!confirm('Delete this note?')) return;
  const { error } = await sb.rpc('hub_autosched_note_delete', { p_id: id });
  if (error) { alert(error.message); return; }
  await asNotesLoad(); if (document.getElementById('as-todo')) asTodo();
}
// 📋 To-do: every open note, all weeks and studios, by date
async function asTodo(showDone) {
  if (showDone !== undefined) _as.todoAll = showDone;
  if (!_as.people) await asPeopleLoad();
  const { data, error } = await sb.rpc('hub_autosched_notes', { p_from: null, p_to: null, p_open: !_as.todoAll });
  if (error) { alert(/hub_autosched_notes/.test(error.message) ? 'Run autosched_notes.sql first.' : error.message); return; }
  const list = data || [], byDay = {};
  list.forEach(n => { (byDay[n.day] = byDay[n.day] || []).push(n); });
  openDutySheet(`<h3 id="as-todo">📋 Auto-schedule to-do</h3><label class="ba-check"><input type="checkbox" ${_as.todoAll ? 'checked' : ''} onchange="asTodo(this.checked)"> Show done ones too</label>
    ${list.length ? Object.keys(byDay).sort().map(d => `<div class="as-todo-day"><b>${esc(new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}</b>` +
      byDay[d].map(n => `<div class="as-todo-row${n.done ? ' done' : ''}"><input type="checkbox" class="fd-tick" ${n.done ? 'checked' : ''} onchange="asNoteDone('${n.id}',this.checked)">
        <div><b>${esc(STUDIO_NAMES[n.studio_id] || n.studio_id)}</b> · ${esc((AS_NOTE_KINDS.find(k => k[0] === n.kind) || [, '📝'])[1])}<div>${esc(n.body)}</div>
        <span class="fd-sm">${esc(String(n.created_by || '').split('@')[0])}${n.done && n.done_by ? ' · done by ' + esc(String(n.done_by).split('@')[0]) : ''}</span>
        <div class="as-for">For ${asAssignSelect(n, '', `asNoteAssign('${n.id}',this.value,true)`)}</div></div>
        <button class="as-x" onclick="asNoteDel('${n.id}')" title="Delete">✕</button></div>`).join('') + '</div>').join('') : '<p class="ho-intro">Nothing to do. 🎉</p>'}
    <div class="sheet-actions"><button class="primary" onclick="closeDutySheet()">Close</button></div>`);
}
// ---------- Disregarded warnings (autosched_disregard.sql) ----------
async function asDisrLoad() {
  const r = await sb.rpc('hub_autosched_disregarded', { p_from: _as.week, p_to: asAddDays(_as.week, 6) });
  _as.disr = r.error ? [] : (r.data || []); _as.disrErr = r.error && /hub_autosched_disregard/.test(r.error.message) ? 'Run autosched_disregard.sql to disregard warnings.' : '';
}
// A day's warnings, compact (Nov 7 2026): one folded line ("⚠ 4 warnings"); open, each in short form (the full text on hover
// and in 📊 Overview) with its What to do?; disregarded ones under them
function asWarnShort(x) {
  let t = String(x).replace(/^⚠\s*/, '').replace(/\s*\(busy:[\s\S]*\)\s*$/, '');
  return t.length > 110 ? t.slice(0, 107) + '…' : t;
}
function asDayWarnHtml(S, D) {
  const ws = D.notes.filter(x => x.startsWith('⚠')), dis = D.disregarded || [];
  if (!ws.length && !dis.length) return '';
  const k = S.id + '|' + D.date, open = !!(_as.wOpen && _as.wOpen[k]);
  const head = ws.length ? `⚠ ${ws.length} warning${ws.length === 1 ? '' : 's'}` : `✓ ${dis.length} disregarded`;
  return `<div class="as-wd${ws.length ? '' : ' ok'}"><button class="as-wdh" onclick="(_as.wOpen=_as.wOpen||{})['${k}']=${!open};asDraw()" aria-expanded="${open}">${head}${ws.length && dis.length ? ` <span>· ${dis.length} disregarded</span>` : ''}<span class="spacer"></span>${open ? '▾' : '▸'}</button>` +
    (open ? ws.map(x => `<div class="as-dn warn" title="${escAttr(x.replace(/^⚠\s*/, ''))}">${esc(asWarnShort(x))}${!S.published ? '<div>' + asWarnActHtml(S.id, D.date, x) + '</div>' : ''}</div>`).join('') +
      dis.map(x => `<div class="as-dn as-dis" title="${escAttr(x.text)}">✓ Disregarded${x.note ? ': ' + esc(x.note) : ''} <button class="as-disb" onclick="asDisregard('${S.id}','${D.date}',${escAttr(JSON.stringify(x.text))},true)">Undo</button></div>`).join('') : '') + '</div>';
}
// ⚠ a warning: what to do about it (another staff, move a class, flag with a note, or disregard: it's OK)
function asWarnActHtml(st, d, text) {
  const clean = String(text).replace(/^⚠\s*/, ''), key = clean.slice(0, 60);
  const noted = (_as.notes || []).some(n => n.studio_id === st && n.day === d && String(n.body || '').includes(key));
  return `${noted ? '<span class="as-noted">📋 note added</span> ' : ''}<select class="as-wact" onchange="asWarnAct('${st}','${d}',${escAttr(JSON.stringify(text))},this.value);this.value=''" title="What to do about it">
    <option value="">What to do?</option><option value="staff">👤 Request another staff</option><option value="move">🔁 Move a class</option><option value="flag">🚩 Flag with a note</option><option value="ok">✓ Disregard (it’s OK)</option></select>`;
}
function asWarnAct(st, d, text, v) {
  const clean = String(text).replace(/^⚠\s*/, '');
  if (v === 'staff') asExtra(st, d, 1);
  else if (v === 'move') asNoteNew(st, d, { kind: 'other', body: `🔁 Move a class: ${clean}\n\nMove: `, title: '🔁 Move a class' });
  else if (v === 'flag') asNoteNew(st, d, { kind: 'other', body: `🚩 ${clean}\n\n`, title: '🚩 Flag with a note' });
  else if (v === 'ok') asDisregard(st, d, text);
}
async function asDisregard(st, d, text, undo) {
  let note = null;
  if (!undo) { note = prompt('Disregard this warning? Add a short note (why it’s OK):\n\n' + text.replace(/^⚠\s*/, ''), ''); if (note === null) return; }
  const { error } = await sb.rpc('hub_autosched_disregard', { p_studio: st, p_day: d, p_warning: text, p_note: note, p_undo: !!undo });
  if (error) { alert(/hub_autosched_disregard/.test(error.message) ? 'Run autosched_disregard.sql first.' : error.message); return; }
  await asDisrLoad();
  const P = _as.plan, i = P ? P.studios.findIndex(x => x.id === st) : -1;
  if (i >= 0 && _as.data) { const one = asBuild(_as.data, st).studios[0]; if (one) P.studios[i] = one; }
  asDraw();
}
// ---------- Assigning notes (autosched_assign.sql): admins and coordinators ----------
async function asPeopleLoad() {
  if (_as.people) return _as.people;
  try { const r = await sb.rpc('hub_autosched_assignees'); _as.people = r.error ? [] : (r.data || []); _as.peopleErr = r.error ? (/hub_autosched_assignees/.test(r.error.message) ? 'Run autosched_assign.sql to assign notes.' : r.error.message) : ''; }
  catch (e) { _as.people = []; }
  try { const { data: { session } } = await sb.auth.getSession(); _as.me = String((session && session.user && session.user.email) || '').toLowerCase(); } catch (e) {}
  return _as.people;
}
// the "For" list: nobody, then that studio's coordinators, then other coordinators, then admins
function asAssignSelect(n, id, onchange) {
  const ppl = _as.people || [], cur = String(n.assigned_email || '').toLowerCase();
  const here = ppl.filter(p => p.kind === 'coordinator' && (p.studios || []).includes(n.studio_id)), others = ppl.filter(p => p.kind === 'coordinator' && !(p.studios || []).includes(n.studio_id)), admins = ppl.filter(p => p.kind === 'admin');
  const opt = p => `<option value="${escAttr(p.email)}"${p.email === cur ? ' selected' : ''}>${esc(p.name)}</option>`;
  const extra = cur && !ppl.some(p => p.email === cur) ? `<option value="${escAttr(cur)}" selected>${esc(n.assigned_name || cur)}</option>` : '';
  return `<select class="as-forsel"${id ? ` id="${id}"` : ''}${onchange ? ` onchange="${onchange}"` : ''}><option value="">Nobody yet</option>${extra}`
    + (here.length ? `<optgroup label="${escAttr(STUDIO_NAMES[n.studio_id] || n.studio_id || 'This studio')}">${here.map(opt).join('')}</optgroup>` : '')
    + (admins.length ? `<optgroup label="Home office">${admins.map(opt).join('')}</optgroup>` : '')
    + (others.length ? `<optgroup label="Other coordinators">${others.map(opt).join('')}</optgroup>` : '') + '</select>';
}
async function asNoteAssign(id, email, fromTodo) {
  const p = (_as.people || []).find(x => x.email === email);
  const { error } = await sb.rpc('hub_autosched_note_save', { p: { id, assigned_email: email || '', assigned_name: email ? (p ? p.name : email) : '' } });
  if (error) { alert(/assigned_email|hub_autosched_note_save/.test(error.message) ? 'Run autosched_assign.sql first.' : error.message); return; }
  await asNotesLoad(); if (fromTodo && document.getElementById('as-todo')) asTodo();
}
// 📊 Overview: every warning, PA/PD and field trip question and note this week, in one table (Go to opens the studio)
function asOverviewHtml() {
  const P = _as.plan, rows = [], f = _as.ovf || 'all', me = _as.me || '';
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  P.studios.forEach((S, si) => S.days.forEach((D, di) => {
    if (D.pad && !S.published) rows.push({ d: D.date, st: S.id, type: 'q', D, S });
    D.notes.filter(x => x.startsWith('⚠')).forEach(x => rows.push({ d: D.date, st: S.id, type: 'w', text: x.replace(/^⚠\s*/, ''), raw: x }));
    (D.disregarded || []).forEach(x => rows.push({ d: D.date, st: S.id, type: 'x', text: x.text.replace(/^⚠\s*/, ''), raw: x.text, note: x.note, by: x.by }));
  }));
  const inPlan = new Set(P.studios.map(S => S.id));
  (_as.notes || []).filter(n => inPlan.has(n.studio_id)).forEach(n => rows.push({ d: n.day, st: n.studio_id, type: 'n', n }));
  const count = t => rows.filter(r => r.type === t).length, mineN = rows.filter(r => r.type === 'n' && !r.n.done && String(r.n.assigned_email || '').toLowerCase() === me).length;
  const shown = rows.filter(r => (f === 'all' && r.type !== 'x') || r.type === f || (f === 'mine' && r.type === 'n' && String(r.n.assigned_email || '').toLowerCase() === me))
    .sort((a, b) => a.d.localeCompare(b.d) || (STUDIO_NAMES[a.st] || a.st).localeCompare(STUDIO_NAMES[b.st] || b.st) || 'qwn'.indexOf(a.type) - 'qwn'.indexOf(b.type));
  const chipAll = rows.filter(r => r.type !== 'x').length;
  const chip = (k, lbl, n) => `<button class="${f === k ? 'on' : ''}" onclick="_as.ovf='${k}';asDraw()">${lbl} <b>${n}</b></button>`;
  const row = r => {
    const go = `<button class="ho-btn" onclick="asGoStudio('${r.st}')">Go to</button>`;
    let what = '', detail = '', act = '';
    if (r.type === 'q') {
      const Pd = r.D.pad;
      what = Pd.kind === 'field' ? '🚌 Field trip' : '🎒 PA/PD day';
      detail = `${Pd.kind === 'field' && Pd.time ? esc(Pd.time) + ' · ' : ''}${esc(asPadWho(Pd))} · usually <b>${Pd.usual || 0} staff</b>${Pd.low ? ` · <b class="as-padlow">⚠ under ${Pd.min}</b>` : ''}`;
      act = `<select onchange="asPadSet('${r.S.id}','${r.D.date}',this.value)">${asPadOpts(Pd).map(o => `<option value="${o[0]}"${String(Pd.ans ?? '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    } else if (r.type === 'w') { what = '⚠ Warning'; detail = esc(r.text);
      act = asWarnActHtml(r.st, r.d, r.raw); }
    else if (r.type === 'x') { what = '✓ Disregarded'; detail = `<s>${esc(r.text)}</s><div><b>${esc(r.note || 'No note')}</b> <span class="fd-sm">· ${esc(String(r.by || '').split('@')[0])}</span></div>`;
      act = `<button class="ho-btn" onclick="asDisregard('${r.st}','${r.d}',${escAttr(JSON.stringify(r.raw))},true)">Undo</button>`; }
    else {
      const n = r.n; what = (AS_NOTE_KINDS.find(k => k[0] === n.kind) || [, '📝 Note'])[1];
      detail = `${esc(n.body)}<span class="fd-sm"> · ${esc(String(n.created_by || '').split('@')[0])}${n.done ? ' · ✓ done' : ''}</span>`;
      act = `<span class="as-ovn"><label class="as-ovdone"><input type="checkbox" ${n.done ? 'checked' : ''} onchange="asNoteDone('${n.id}',this.checked)"> Done</label>For ${asAssignSelect(n, '', `asNoteAssign('${n.id}',this.value)`)}</span>`;
    }
    return `<tr class="as-ov-${r.type}${r.type === 'n' && r.n.done ? ' done' : ''}${r.type === 'q' && r.D.pad.ans === undefined ? ' ask' : ''}"><td class="nw">${esc(fmt(r.d))}</td><td class="nw"><b>${esc(STUDIO_NAMES[r.st] || r.st)}</b></td><td class="nw">${what}</td><td>${detail}</td><td>${act}</td><td>${go}</td></tr>`;
  };
  if (!_as.people && !_as.peopleBusy) { _as.peopleBusy = true; asPeopleLoad().then(() => { _as.peopleBusy = false; asDraw(); }); }
  const head = `<button class="as-ovh" onclick="_as.ovHide=!_as.ovHide;asDraw()" aria-expanded="${!_as.ovHide}"><b>📊 Overview</b> <span>${count('w')} warning${count('w') === 1 ? '' : 's'} · ${count('q')} PA/PD and field trip day${count('q') === 1 ? '' : 's'} · ${count('n')} note${count('n') === 1 ? '' : 's'}${mineN ? ` · <b>${mineN} for you</b>` : ''}</span><span class="spacer"></span>${_as.ovHide ? '▸ Show' : '▾ Hide'}</button>`;
  if (_as.ovHide) return `<div class="as-ov">${head}</div>`;
  return `<div class="as-ov">${head}<div class="as-ovf">${chip('all', 'All', chipAll)}${chip('w', '⚠ Warnings', count('w'))}${chip('q', '🎒🚌 PA/PD and field trips', count('q'))}${chip('n', '📋 Notes', count('n'))}${chip('mine', '👤 For me', mineN)}${count('x') ? chip('x', '✓ Disregarded', count('x')) : ''}</div>
    ${_as.disrErr ? `<p class="fd-sm">${esc(_as.disrErr)}</p>` : ''}
    ${_as.peopleErr ? `<p class="fd-sm">${esc(_as.peopleErr)}</p>` : ''}
    ${shown.length ? `<div class="as-ovw"><table class="as-ovt"><thead><tr><th>Day</th><th>Studio</th><th>What</th><th>Details</th><th></th><th></th></tr></thead><tbody>${shown.map(row).join('')}</tbody></table></div>` : '<p class="ho-intro">Nothing here this week. 🎉</p>'}
    <p class="fd-sm">Notes for a day are added on the studio's day (📝 Note). Anyone a note is for sees it on their Today screen and can tick it done there.</p></div>`;
}
// 👤 + Staff: plan the day with one more person (a part-timer or home office), and add a to-do note to book them
async function asExtra(st, d, delta) {
  const k = st + '|' + d, P = _as.plan, i = P.studios.findIndex(x => x.id === st); if (i < 0) return;
  const D = P.studios[i].days.find(x => x.date === d) || {};
  if (delta > 0) {
    // when they're needed: the busiest part of the day (the staff schedule picks), or hours you give (autosched_day_plan.sql)
    const when = new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    const pick = await new Promise(res => {
      openDutySheet(`<h3>👤 Bring in another staff</h3><p class="ho-intro">${esc(STUDIO_NAMES[st] || st)} · ${esc(when)}. The day is planned with ${(D.staff || 0) + 1} staff, a to-do note is added to book them, and the staff schedule adds their shift.</p>
        <div class="ba-form"><label class="ba-check"><input type="radio" name="asx-when" value="busy" checked onchange="document.getElementById('asx-hrs').style.opacity=.5"> The busiest part of the day <span class="fd-sm">(the staff schedule picks, at least 3 hours)</span></label>
        <label class="ba-check"><input type="radio" name="asx-when" value="hours" onchange="document.getElementById('asx-hrs').style.opacity=1"> These hours</label>
        <div id="asx-hrs" style="opacity:.5;display:flex;gap:8px;align-items:center;margin-left:24px"><input type="time" id="asx-from" step="900" value="17:00" onfocus="document.querySelector('[name=asx-when][value=hours]').click()"> to <input type="time" id="asx-to" step="900" value="21:30" onfocus="document.querySelector('[name=asx-when][value=hours]').click()"></div>
        <p class="fd-msg" id="asx-msg"></p></div>
        <div class="sheet-actions"><button onclick="closeDutySheet();window._asxRes(null)">Cancel</button><button class="primary" onclick="window._asxOk()">Bring in another staff</button></div>`);
      window._asxRes = res;
      window._asxOk = () => {
        const hrs = (document.querySelector('[name=asx-when]:checked') || {}).value === 'hours';
        const f = (document.getElementById('asx-from') || {}).value, t = (document.getElementById('asx-to') || {}).value;
        if (hrs && (!f || !t || t <= f)) { document.getElementById('asx-msg').textContent = 'Choose a start before the end.'; return; }
        closeDutySheet(); res(hrs ? { from: f, to: t } : {});
      };
    });
    if (!pick) return;
    _as.extra[k] = (+_as.extra[k] || 0) + 1;
    const hrsTxt = pick.from ? ` (${shortTime(pick.from + ':00')}–${shortTime(pick.to + ':00')})` : ' (busiest part of the day)';
    try { await sb.rpc('hub_autosched_note_save', { p: Object.assign({ studio_id: st, day: d, kind: 'staff', body: `Bring in another staff (part-timer or home office): planned with ${(D.staff || 0) + 1} staff${hrsTxt}` }, pick.from ? { extra_from: pick.from, extra_to: pick.to } : {}) }); } catch (e) {}
    asNotesLoad(true).then(() => { asDraw(); asDayPlanSoon(); });
  } else {
    // undo: its note goes (the newest one for that day), so the next Make it again doesn't bring them back
    const n = (_as.notes || []).filter(x => x.studio_id === st && x.day === d && x.kind === 'staff' && AS_EXTRA_NOTE.test(String(x.body || ''))).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    if (n) { try { await sb.rpc('hub_autosched_note_delete', { p_id: n.id }); } catch (e) {} }
    _as.extra[k] = Math.max(0, (+_as.extra[k] || 0) - 1); if (!_as.extra[k]) delete _as.extra[k];
    asNotesLoad(true).then(() => { asDraw(); asDayPlanSoon(); });
  }
  const one = asBuild(_as.data, st).studios[0]; if (one) P.studios[i] = one;   // just this studio's week again
  asDraw();
}
// ---------- The day plan for the staff schedule (autosched_day_plan.sql) ----------
// What each studio-day was planned around: Studio staffing's people, 👤 + Staff extras (with their hours when given), the
// PA/PD or field trip evening answer, closed days. The staff schedule builder schedules at least that many people.
let _asDpTimer = null;
function asDayPlanSoon() { clearTimeout(_asDpTimer); _asDpTimer = setTimeout(() => { asDayPlanSave().catch(() => {}); }, 1200); }
async function asDayPlanSave() {
  const P = _as.plan, W = _as.data; if (!P || !W) return;
  const today = W.today || new Date().toISOString().slice(0, 10), rows = [];
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  P.studios.forEach(S => {
    const row = (W.staffing || []).find(x => x.studio_id === S.id) || {};
    S.days.forEach(D => {
      if (D.date < today) return;
      const k = S.id + '|' + D.date;
      const notes = (_as.notes || []).filter(n => n.studio_id === S.id && n.day === D.date && n.kind === 'staff' && AS_EXTRA_NOTE.test(String(n.body || '')));
      const closed = (D.notes || []).some(x => /^(Closed|🎌)/.test(x)) && !D.autoCamp;
      const hrs = notes.filter(n => n.extra_from && n.extra_to).map(n => ({ from: String(n.extra_from).slice(0, 5), to: String(n.extra_to).slice(0, 5), note_id: n.id }));
      const auto = D.autoCamp && !hrs.length ? [D.autoCamp] : [];   // (a camp / PA/PD day on a closed day: 8:30–5)
      rows.push({ studio_id: S.id, day: D.date, staff: closed || D.autoCamp ? 0 : (+row[keys[new Date(D.date + 'T12:00:00').getDay()]] || 0),
        extra: Math.max(+_as.extra[k] || 0, hrs.length + auto.length), extra_hours: hrs.concat(auto),
        extra_notes: notes.map(n => n.id), evening: D.pad && D.pad.ans !== undefined ? String(D.pad.ans) : null, closed });
    });
  });
  if (!rows.length) return;
  const r = await sb.rpc('hub_autosched_dayplan_save', { p: rows });
  _as.dpErr = r.error ? (/hub_autosched_dayplan_save/.test(r.error.message) ? 'Run autosched_day_plan.sql so the staff schedule follows this plan.' : r.error.message) : '';
}
// 🚫 Don't make any changes at a studio this week (or ↺ use the suggestions again)
function asSkip(st) {
  const k = _as.week + '|' + st;
  if (_as.skip[k]) delete _as.skip[k]; else _as.skip[k] = true;
  const P = _as.plan, i = P.studios.findIndex(x => x.id === st); if (i < 0 || !_as.data) return;
  const one = asBuild(_as.data, st).studios[0]; if (one) P.studios[i] = one;   // just this studio's week again
  asDraw();
}
// a party time whose open spots come down: "2 open → 1" or "closes" (tap to keep it open, tap again to close)
function asPartyCloseHtml(s, e, si, di, ei, lbl) {
  const what = e.closeAfter === 0 ? `${e.closeOpen > 1 ? e.closeOpen + ' open: ' : ''}closes` : `${e.closeOpen} open → ${e.closeAfter}`;
  if (e.manual) return `<div class="as-e rem as-pclose" onclick="asToggleClose(${si},${di},${ei})" title="You closed it: its open spots go to 0 when you publish. Tap to keep it open."><b>${asT(s.start)}</b> ${esc(lbl)} <span>${esc(what)}: closed by you (tap to undo)</span></div>`;
  return `<div class="as-e ${e.close ? 'rem as-pclose' : 'as-open'}" onclick="asToggleClose(${si},${di},${ei})" title="${e.close ? `${e.closeWhy}: ${e.closeAfter === 0 ? 'its open spots close' : 'down to one open'} when you publish (reopen any time from the Schedule). Tap to keep it as it is.` : 'Kept as it is. Tap to close.'}"><b>${asT(s.start)}</b> ${esc(lbl)}${s.booked ? ' (open rooms)' : ''} <span>${e.close ? esc(what) + ': ' + esc(e.closeWhy) : 'kept open (tap to close)'}</span></div>`;
}
// a party time that closes: keep it open instead (or close it again); every product at that time and kind goes together
function asCloseManual(st, d, start, k) {
  const P = _as.plan, i = P.studios.findIndex(x => x.id === st); if (i < 0 || !_as.data) return;
  const D = P.studios[i].days.find(x => x.date === d); if (!D) return;
  D.entries.forEach(e => { if (e.t === 'old' && e.s.start === start && e.s.k === k && (+e.s.left || 0) > 0) _as.mclose[e.s.id] = true; });
  const one = asBuild(_as.data, st).studios[0]; if (one) P.studios[i] = one;
  asDraw();
}
function asToggleClose(si, di, ei) {
  const D0 = _as.plan.studios[si].days[di], e0 = D0.entries[ei];
  if (e0.manual) {   // closed by hand: tapping again reopens it (forgotten, so Make it again won't close it)
    D0.entries.forEach(o => { if (o.t === 'old' && o.s.start === e0.s.start && o.s.k === e0.s.k) delete _as.mclose[o.s.id]; });
    const S = _as.plan.studios[si], one = asBuild(_as.data, S.id).studios[0]; if (one) _as.plan.studios[si] = one;
    asDraw(); return;
  }
  const D = _as.plan.studios[si].days[di], e = D.entries[ei], to = !e.close;
  D.entries.forEach(o => { if (o.closeP && o.s.start === e.s.start && o.s.k === e.s.k) o.close = to; });
  asDraw();
}
function asToggleRem(si, di, ei) { const e = _as.plan.studios[si].days[di].entries[ei]; e.keep = !e.keep; asDraw(); }
function asNew(si, di, ei, k, v) { const e = _as.plan.studios[si].days[di].entries[ei]; if (k === 'start') v = Math.round(v / 15) * 15; e[k] = v; asDraw(); }
async function asPublish(onlyId) {
  const P = _as.plan;
  const list = P.studios.filter(S => !S.published && (!onlyId || S.id === onlyId));
  const work = list.map(S => {
    const remove = [], add = [], close = [];
    S.days.forEach(D => D.entries.forEach(e => {
      if (e.closeP && e.close) close.push({ id: e.s.id, left: e.closeTo });
      if (e.t === 'old' && e.s.remove && !e.keep) remove.push(e.s.id);
      if (e.t === 'new' && e.on) add.push({ studio_id: S.id, date: D.date, time: asHM(e.start), item_id: e.item, spots: e.spots, minutes: e.len, kids_only: !!e.kids });
    }));
    return { S, remove, add, close };
  }).filter(w => w.remove.length || w.add.length || w.close.length);
  const nAdd = work.reduce((t, w) => t + w.add.length, 0), nRem = work.reduce((t, w) => t + w.remove.length, 0);
  const nClose = list.reduce((t, S) => t + S.days.reduce((u, D) => u + D.entries.filter(e => e.closeLead && e.close).length, 0), 0);
  const who = onlyId ? (STUDIO_NAMES[onlyId] || onlyId) : (list.length === P.studios.length ? 'every studio' : `the ${list.length} studios not published yet`);
  if (!work.length) { alert('Nothing to publish for ' + who + '.'); return; }
  if (!confirm(`Publish the week of ${_as.week} for ${who}?\n\n${nAdd} new times go live on World, and ${nRem} empty times come off (anything booked in the meantime stays).${nClose ? `\n\n${nClose} party time${nClose === 1 ? '' : 's'} close or go down to one open room (reopen any time from the Schedule).` : ''}`)) return;
  // one studio at a time (a whole week for every studio at once is too much for one request); the Workshops page refreshed once at the end
  const fails = [];
  for (let i = 0; i < work.length; i++) {
    const w = work[i];
    _as.busy = true; _as.err = `Publishing ${i + 1} of ${work.length}: ${STUDIO_NAMES[w.S.id] || w.S.id}…`; asDraw();
    const { data, error } = await sb.rpc('hub_autosched_publish', { p: { week: _as.week, remove: w.remove, add: w.add, refresh: i === work.length - 1 } });
    if (error) { fails.push(`${STUDIO_NAMES[w.S.id] || w.S.id}: ${error.message}`); continue; }
    // the unbooked party times coming near: closed (spots to 0)
    let closed = 0;
    if (w.close.length) {
      const c = await sb.rpc('hub_autosched_close_parties', { p: w.close });
      if (c.error) fails.push(`${STUDIO_NAMES[w.S.id] || w.S.id} (party times): ${/hub_autosched_close_parties/.test(c.error.message) ? 'run autosched_close_parties.sql first' : c.error.message}`);
      else closed = +c.data || 0;
    }
    w.S.published = Object.assign({}, data || {}, { closed }); _as.open[w.S.id] = false;
  }
  _as.busy = false; _as.err = fails.length ? 'Not published (try these again): ' + fails.join(' · ') : '';
  if (fails.length && work.length > 1) { try { await sb.rpc('hub_autosched_publish', { p: { week: _as.week, remove: [], add: [], refresh: true } }); } catch (e) {} }
  if (onlyId || fails.length) { asDraw(); return; }
  // everything left was published: add up the whole week
  const d = { added: 0, removed: 0, kept: 0 };
  P.studios.filter(S => S.published).forEach(S => { ['added', 'removed', 'kept'].forEach(k => { d[k] += (+S.published[k] || 0); }); });
  _as.done = d; _as.plan = null; asDraw(); window.scrollTo(0, 0);
}
// 🎒 The week's PA/PD days in one list: studio, date, kids, the warning, and the evening question right there
function asPadList() {
  const P = _as.plan; if (!P) return;
  const rows = [];
  P.studios.forEach((S, si) => S.days.forEach(D => { if (D.pad) rows.push({ S, si, D }); }));
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  openDutySheet(`<h3>🎒 PA/PD days and 🚌 field trips this week</h3>
    <p class="ho-intro">${rows.length} day${rows.length === 1 ? '' : 's'} with a PA/PD day or a booked field trip. Answer the evening question here, or Go to the studio.</p>
    <div class="as-padl">${rows.length ? rows.sort((a, b) => a.D.date.localeCompare(b.D.date) || (STUDIO_NAMES[a.S.id] || '').localeCompare(STUDIO_NAMES[b.S.id] || '')).map(r => {
      const P2 = r.D.pad, n = Math.max(1, P2.usual || 1);
      const opts = asPadOpts(P2);
      return `<div class="as-padr${P2.low ? ' low' : ''}${P2.ans === undefined ? ' ask' : ''}"><div>${P2.kind === 'field' ? '🚌 ' : '🎒 '}<b>${esc(STUDIO_NAMES[r.S.id] || r.S.id)}</b> · ${esc(fmt(r.D.date))}
        <div class="fd-sm">${P2.kind === 'field' ? 'Field trip' + (P2.time ? ' ' + esc(P2.time) : '') + ' · ' + esc(asPadWho(P2)) : esc(asPadWho(P2))} · usually <b>${P2.usual || 0} staff</b>${P2.low ? ` · <b class="as-padlow">⚠ under ${P2.min}</b>` : ''}</div></div>
        <select ${r.S.published ? 'disabled' : ''} onchange="asPadSet('${r.S.id}','${r.D.date}',this.value);asPadList()">${opts.map(o => `<option value="${o[0]}"${String(P2.ans ?? '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
        <button class="ho-btn" onclick="closeDutySheet();asGoStudio('${r.S.id}')">Go to</button></div>`;
    }).join('') : '<p class="ho-intro">No PA/PD days or field trips this week.</p>'}</div>
    <div class="sheet-actions"><button class="primary" onclick="closeDutySheet()">Done</button></div>`);
  const sh = document.querySelector('#duty-sheet-back .duty-sheet'); if (sh) sh.classList.add('wide', 'as-padsheet');
}
function asGoStudio(id) {
  _as.open[id] = true; asDraw();
  setTimeout(() => { const el = document.getElementById('as-st-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}
// ---------- Home office → 👥 Studio staffing (studio_staffing.sql) ----------
// Staff on each day of the week, per studio: how much the workshop auto-scheduler can run there, the spots on each auto-made
// time, and later the staff scheduling templates. Every change saves straight away.
const STF_DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
let _stf = { rows: {}, set: null, err: '', loaded: false, q: '', saving: {}, rules: null, sset: null, rerr: '', rsave: '' };
async function openStfPane() {
  if (!_hoCan.view) return;
  showOnlyPane('stf-pane'); setActiveNav('nav-stf'); stfDraw();
  const { data, error } = await sb.rpc('hub_staffing_list');
  _stf.err = error ? (/hub_staffing_list/.test(error.message) ? 'Run studio_staffing.sql in Supabase first.' : error.message) : '';
  _stf.rows = {}; ((data && data.rows) || []).forEach(r => { _stf.rows[r.studio_id] = r; });
  _stf.set = (data && data.settings) || { spots_small: 12, spots_kids: 15, spots_big: 18 }; _stf.loaded = true; stfDraw();
  stfRulesLoad();
}
// ---- 📏 Staffing rules: the one rulebook Auto-schedule, the staff schedule builder and the Hub share (staffing_settings.sql) ----
const STF_SETTINGS = [
  ['How long a teacher is needed', [
    ['class_min', 'Kids class (minutes, unless the class is set longer)'], ['class_after_min', 'Class teacher stays after (minutes)'],
    ['wheel_class_min', 'Clay Wheel class (minutes)'], ['wheel_workshop_min', 'Wheel Workshop (minutes)'], ['kids_workshop_min', 'Kids-only workshop (minutes)'], ['mini_make_min', 'Mini Make (minutes, unless the time is set longer)'],
    ['party_min', 'Kids / Splatter party (minutes, unless its art time says)'], ['lunch_after_party_min', 'Break after a party, with 1 staff (minutes)'],
    ['get_together_intro_min', 'Adult Get-Together intro (minutes)'], ['field_trip_min', 'Field trip (minutes, unless set)'], ['camp_min', 'Camp or PA/PD day (minutes, unless set)'],
    ['day_teacher_span_min', 'Field trip / PA/PD daytime teacher\u2019s shift (minutes)']]],
  ['Parties', [['open_party_close_days', 'An unbooked party time closes (days before)'], ['party_one_room_days', 'Double / triple party times go down to one room (days before)'],
    ['fri6_party_shared', 'The 6pm Friday Kids Party runs like a workshop (no teacher of its own)', 'bool']]],
  ['Workshops (Auto-schedule)', [['glazing_max_weekday', 'Glazing times on a weekday'], ['glazing_max_weekend', 'Glazing times on a weekend day']]],
  ['Nightly run (Auto-schedule → 🌙 Nightly run)', [['low_people', '"Low": expected to finish with fewer people than'], ['low_close_days', 'Low times with nobody booked close (days before)'],
    ['swap_days', 'Times nobody booked swap to the most-booked project (days before)'], ['history_weeks', 'Weeks of history for expected late bookings'], ['pa_empty_close_days', 'A PA/PD day with nobody booked closes (days before)']]],
  ['Staff schedule builder', [['quiet_close_days', 'Nothing booked this many days before: no shifts that day'], ['quiet_booked', 'A class teacher also covers the floor with up to this many drop-ins'],
    ['floater_max_pct', 'Weekend floater only while labour stays under (%)'], ['manager_min_hours', 'Managers: at least (hours a week)'], ['manager_max_hours', 'Managers: at most (hours a week)'],
    ['max_paid_min', 'Longest shift (paid minutes)'], ['max_days', 'Most days a week']]]
];
async function stfRulesLoad() {
  const [r1, r2] = await Promise.all([sb.rpc('hub_staffing_rules_list'), sb.rpc('get_staffing_settings')]);
  const e = r1.error || r2.error;
  _stf.rerr = e ? (/hub_staffing_rules_list|get_staffing_settings/.test(e.message) ? 'Run staffing_settings.sql in Supabase first.' : e.message) : '';
  _stf.rules = r1.data || []; _stf.sset = r2.data || {}; stfDraw();
}
function stfRulesHtml() {
  const edit = !!_hoCan.edit, S = _stf;
  if (S.rerr) return `<div class="stf-rb"><h3>📏 Staffing rules</h3><p class="fd-msg">${esc(S.rerr)}</p></div>`;
  if (!S.rules || !S.sset) return `<div class="stf-rb"><h3>📏 Staffing rules</h3><p class="fd-sm">Loading…</p></div>`;
  const dis = edit ? '' : 'disabled';
  const kindTxt = k => k === 'pooled' ? 'shared by everyone at that time' : k === 'per_group' ? 'per booking (party, field trip)' : k === 'one_per_session' ? 'per class or camp' : k || '';
  return `<div class="stf-rb"><h3>📏 Staffing rules</h3>
    <p class="fd-sm">One rulebook for <b>Auto-schedule</b>, the <b>staff schedule builder</b> and the Hub: change a number here and all three follow next time they plan.${S.rsave ? ` <b>${esc(S.rsave)}</b>` : ''}</p>
    <h4>Teachers per people</h4>
    <table class="fd-tbl stf-rtbl"><thead><tr><th>Rule</th><th>Counts</th><th class="c">1 teacher per</th><th class="c">Minutes</th></tr></thead><tbody>
    ${S.rules.map(r => `<tr><td>${esc(r.label)}</td><td class="fd-sm">${esc(kindTxt(r.kind))}</td>
      <td class="c">${r.ratio == null && r.kind !== 'pooled' && r.kind !== 'per_group' ? '<span class="fd-sm">1 each</span>' : `<input type="number" min="1" max="200" value="${escAttr(r.ratio ?? '')}" ${dis} onchange="stfRuleSave('${escAttr(r.id)}','ratio',this.value)" aria-label="1 teacher per, ${escAttr(r.label)}">`}</td>
      <td class="c"><input type="number" min="0" max="720" value="${escAttr(r.minutes ?? '')}" placeholder="—" ${dis} onchange="stfRuleSave('${escAttr(r.id)}','minutes',this.value)" aria-label="Minutes, ${escAttr(r.label)}"></td></tr>`).join('')}
    </tbody></table>
    ${STF_SETTINGS.map(([g, list]) => `<h4>${esc(g)}</h4><div class="stf-sg">${list.map(([k, lbl, t]) => t === 'bool'
        ? `<label class="stf-sb"><input type="checkbox" class="fd-tick" ${S.sset[k] !== false ? 'checked' : ''} ${dis} onchange="stfSetSave('${k}', this.checked)"> ${esc(lbl)}</label>`
        : `<label class="stf-si"><span>${esc(lbl)}</span><input type="number" min="0" max="1440" value="${escAttr(S.sset[k] ?? '')}" ${dis} onchange="stfSetSave('${k}', this.value)"></label>`).join('')}</div>`).join('')}
  </div>`;
}
async function stfSetSave(k, v) {
  const next = Object.assign({}, _stf.sset, { [k]: typeof v === 'boolean' ? v : (v === '' ? '' : +v) });
  const { data, error } = await sb.rpc('save_staffing_settings', { p: next });
  if (error) { alert('Not saved: ' + error.message); stfRulesLoad(); return; }
  _stf.sset = data; _stf.rsave = 'Saved ✓'; stfDraw(); setTimeout(() => { _stf.rsave = ''; stfDraw(); }, 1500);
}
async function stfRuleSave(id, field, v) {
  const { error } = await sb.rpc('hub_staffing_rule_save', { p_id: id, p: { [field]: v } });
  if (error) { alert('Not saved: ' + error.message); stfRulesLoad(); return; }
  _stf.rsave = 'Saved ✓'; await stfRulesLoad(); setTimeout(() => { _stf.rsave = ''; stfDraw(); }, 1500);
}
function stfRow(id) { return _stf.rows[id] || { studio_id: id, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, sun: 1, kids_time: null, auto: true, _new: true }; }
function stfDraw() {
  const el = document.getElementById('stf-pane'); if (!el) return;
  const S = _stf, edit = !!_hoCan.edit, set = S.set || {};
  const ids = Object.keys(STUDIO_NAMES), groups = [['BC', 'British Columbia'], ['AB', 'Alberta'], ['ON', 'Ontario']];
  const q = S.q.trim().toLowerCase();
  const sel = (r, d) => { const v = r[d]; return `<select class="stf-sel s${v}" ${edit ? '' : 'disabled'} onchange="stfSave('${r.studio_id}',{${d}:+this.value})" aria-label="${escAttr((STUDIO_NAMES[r.studio_id] || r.studio_id) + ' ' + d)}">${[[0, '—'], [1, '1'], [2, '2'], [3, '3'], [4, '4+']].map(o => `<option value="${o[0]}"${v === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`; };
  let h = `<div class="ho-head"><div class="pts-page-title" style="margin:0">👥 Studio staffing</div><span class="spacer"></span><button class="ho-btn" onclick="goToDashboard()">← Today screen</button></div>
    <div class="ho-intro">Staff on each day of the week. It decides how much the workshop auto-scheduler runs at each studio: with <b>1</b>, a kids class means no workshop that day; with <b>2</b>, a class and a workshop can run together; <b>—</b> means closed. Changes save straight away.</div>
    <div class="stf-rules"><b>Spots on auto-made times:</b>
      <label>1–2 staff <input type="number" min="1" max="200" value="${escAttr(set.spots_small ?? 12)}" ${edit ? '' : 'disabled'} onchange="stfRule('spots_small',this.value)"></label>
      <label>Kids only <input type="number" min="1" max="200" value="${escAttr(set.spots_kids ?? 15)}" ${edit ? '' : 'disabled'} onchange="stfRule('spots_kids',this.value)"></label>
      <label>3+ staff <input type="number" min="1" max="200" value="${escAttr(set.spots_big ?? 18)}" ${edit ? '' : 'disabled'} onchange="stfRule('spots_big',this.value)"></label>
      <span class="stf-sep"></span><label>Warn when a PA/PD day has fewer than <input type="number" min="0" max="200" value="${escAttr(set.pa_min ?? 8)}" ${edit ? '' : 'disabled'} onchange="stfRule('pa_min',this.value)"> kids</label></div>
    <div class="fd-filters"><input id="stf-q" type="search" placeholder="Find a studio" value="${escAttr(S.q)}" oninput="_stf.q=this.value;stfDraw();const i=document.getElementById('stf-q');i.focus();i.setSelectionRange(i.value.length,i.value.length)">
      <span class="stf-key"><i class="s0"></i>closed <i class="s1"></i>1 <i class="s2"></i>2 <i class="s3"></i>3 <i class="s4"></i>4+</span></div>
    ${S.err ? `<p class="fd-msg">${esc(S.err)}</p>` : ''}${!S.loaded ? '<p class="fd-sm">Loading…</p>' : ''}`;
  if (S.loaded && !S.err) {
    h += `<div class="fd-tbl-wrap stf-wrap"><table class="fd-tbl stf-tbl"><thead><tr><th>Studio</th>${STF_DAYS.map(d => `<th class="c">${d[1]}${edit ? `<br><select class="stf-all" onchange="if(this.value!=='')stfColumn('${d[0]}',+this.value);this.value=''" title="Set the whole column"><option value="">all…</option><option value="0">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option></select>` : ''}</th>`).join('')}
      <th>Kids workshop time<br><span class="fd-sm">(no class that day)</span></th><th>Weekends end<br><span class="fd-sm">(blank: 5pm)</span></th><th class="c">Auto-<br>schedule</th><th></th></tr></thead><tbody>`;
    groups.forEach(([pv, label]) => {
      const list = ids.filter(id => id.startsWith(pv) && (!q || (STUDIO_NAMES[id] || id).toLowerCase().includes(q))).sort((a, b) => (STUDIO_NAMES[a] || a).localeCompare(STUDIO_NAMES[b] || b));
      if (!list.length) return;
      h += `<tr class="stf-pv"><td colspan="12">${label}</td></tr>` + list.map(id => { const r = stfRow(id);
        return `<tr class="${r.auto ? '' : 'stf-off'}"><td><b>${esc(STUDIO_NAMES[id] || id)}</b>${r._new ? ' <span class="fd-sm">(not set yet)</span>' : ''}</td>${STF_DAYS.map(d => `<td class="c">${sel(r, d[0])}</td>`).join('')}
          <td><input type="time" step="900" class="stf-time" value="${escAttr(r.kids_time ? String(r.kids_time).slice(0, 5) : '')}" ${edit ? '' : 'disabled'} onchange="stfSave('${id}',{kids_time:this.value})"></td>
          <td><input type="time" step="900" class="stf-time" value="${escAttr(r.weekend_end ? String(r.weekend_end).slice(0, 5) : '')}" ${edit ? '' : 'disabled'} onchange="stfSave('${id}',{weekend_end:this.value})"></td>
          <td class="c"><input type="checkbox" class="fd-tick" ${r.auto ? 'checked' : ''} ${edit ? '' : 'disabled'} onchange="stfSave('${id}',{auto:this.checked})"></td>
          <td class="stf-st">${S.saving[id] === 1 ? '…' : S.saving[id] === 2 ? '✓' : S.saving[id] === 3 ? '<span class="fd-warn">not saved</span>' : ''}</td></tr>`; }).join('');
    });
    h += '</tbody></table></div>';
  }
  h += stfRulesHtml();
  // (keep the focus on the number box being typed in)
  const ae = document.activeElement, keep = ae && el.contains(ae) && ae.getAttribute('onchange');
  el.innerHTML = h;
  if (keep) { const again = [...el.querySelectorAll('[onchange]')].find(x => x.getAttribute('onchange') === keep); if (again && again !== ae) again.focus(); }
}
async function stfSave(id, patch) {
  _stf.saving[id] = 1; stfDraw();
  const { data, error } = await sb.rpc('hub_staffing_save', { p: Object.assign({ studio_id: id }, patch) });
  if (error) { _stf.saving[id] = 3; alert('Not saved: ' + error.message); stfDraw(); return; }
  _stf.rows[id] = data; _stf.saving[id] = 2; stfDraw();
  setTimeout(() => { if (_stf.saving[id] === 2) { delete _stf.saving[id]; stfDraw(); } }, 1500);
}
async function stfColumn(day, v) {
  const name = (STF_DAYS.find(d => d[0] === day) || [, day])[1];
  if (!confirm(`Set ${name} to ${v === 0 ? 'closed' : v === 4 ? '4+' : v} for every studio shown?`)) { stfDraw(); return; }
  const q = _stf.q.trim().toLowerCase(), ids = Object.keys(STUDIO_NAMES).filter(id => !q || (STUDIO_NAMES[id] || id).toLowerCase().includes(q));
  for (const id of ids) await stfSave(id, { [day]: v });
}
async function stfRule(k, v) {
  const { data, error } = await sb.rpc('hub_autosched_settings_set', { p: { [k]: v } });
  if (error) { alert('Not saved: ' + error.message); return; }
  _stf.set = data; stfDraw();
}

// hub/tickets.js: Tickets, Magical Moments and Studio info, moved out of hub.html as-is (Nov 11 2026). Loaded by hub.html.
/* ==========================================================================
   TICKETS, MAGICAL MOMENTS, STUDIO INFO — copied as-is from index.html (the
   Day view): tags, attachments + lightbox, moments, tickets (threads, read
   receipts, booking search, home office notifications), the Info view.
   Hub changes: the studio name comes from STUDIO_NAMES; currentUser is set
   from the signed-in login when a page opens. Keep in step with index.html
   until it retires.
   ========================================================================== */
const INFO_FIELD_LABELS = {
  address:             'Address',
  phone_number:        'Phone Number',
  voicemail_password:  'Voicemail Password',
  lockbox_code:        'Lockbox Code',
  lockbox_location:    'Lockbox Location',
  landlord_name:       'Landlord Name',
  landlord_phone:      'Landlord Phone',
  landlord_email:      'Landlord Email',
  square_footage:      'Square Footage',
  power_supply:        'Power Supply',
  capacity_persons:    'Capacity (persons)',
  buyout_tier:         'Buyout Tier',
  num_wheels:          '# of Wheels',
  num_computers:       '# of Computers',
  num_ipads:           '# of iPads',
  has_tap_reader:      'Tap/Card Reader',
  printer_model:       'Printer Model',
  toner_model:         'Toner Model',
  kiln_model:          'Kiln Model',
  utilities:           'Utilities',
  parking_staff:       'Staff Parking',
  parking_customers:   'Customer Parking',
  garbage_notes:       'Garbage/Recycling',
  plumber_name:      'Plumber Name',
  plumber_phone:     'Plumber Phone',
  plumber_notes:     'Plumber Notes',
  electrician_name:  'Electrician Name',
  electrician_phone: 'Electrician Phone',
  electrician_notes: 'Electrician Notes',
  fire_ext_last_inspection: 'Fire Ext. — Last Inspection',
  fire_ext_next_due:        'Fire Ext. — Next Due',
  fire_inspection_company:  'Fire Inspection Company',
  hvac_maintenance:         'HVAC Maintenance',
  light_switches_location:  'Light Switches',
  fuse_box_location:        'Fuse Box',
  water_shutoff_location:   'Water Shut-Off',
  mailbox_location:         'Mailbox Location',
  mailbox_has_key:          'Mailbox Has Key',
  points_of_entry:          'Points of Entry',
  thermostat_location:      'Thermostat Location',
  neighbours:               'Neighbours',
  outdoor_responsibilities: 'Outdoor Responsibilities',
  notes:                    'Extra Notes',
}
const INFO_SECTIONS = [
  { title: 'Contact & Access', keys: ['address','phone_number','voicemail_password','lockbox_code','lockbox_location'] },
  { title: 'Landlord',         keys: ['landlord_name','landlord_phone','landlord_email'] },
  { title: 'Space',            keys: ['square_footage','power_supply','capacity_persons','buyout_tier'] },
  { title: 'Equipment',        keys: ['num_wheels','num_computers','num_ipads','has_tap_reader','printer_model','toner_model','kiln_model'] },
  { title: 'Utilities',        keys: ['utilities'] },
  { title: 'Parking & Operations', keys: ['parking_staff','parking_customers','garbage_notes'] },
  { title: 'Service Contacts', keys: ['plumber_name','plumber_phone','plumber_notes','electrician_name','electrician_phone','electrician_notes'] },
  { title: 'Maintenance', keys: ['fire_ext_last_inspection','fire_ext_next_due','fire_inspection_company','hvac_maintenance'] },
  { title: 'Building & Facilities', keys: ['light_switches_location','fuse_box_location','water_shutoff_location','mailbox_location','mailbox_has_key','points_of_entry','thermostat_location','neighbours','outdoor_responsibilities'] },
  { title: 'Notes',            keys: ['notes'] },
]
var currentUser = null;
async function hubCopiedReady() {
  try { const { data } = await sb.auth.getUser(); currentUser = data && data.user ? data.user : null; } catch (e) {}
  window.currentStudioId = _sessionStudioId; currentStudioId = _sessionStudioId;
}
async function openTicketsPane() { showOnlyPane('tickets-pane'); setActiveNav('nav-tickets'); await hubCopiedReady(); loadTicketsView(); }
async function openMomentsPane() { showOnlyPane('moments-pane'); setActiveNav('nav-moments'); await hubCopiedReady(); loadMomentsView(); }
async function openInfoPane() { showOnlyPane('info-pane'); setActiveNav('nav-info'); loadHoursCard(); await hubCopiedReady(); loadInfoView(); renderLinksView(); }
// Print the iPad QR codes for this studio (one sheet)
function hubPrintQr() {
  const el = document.getElementById('qr-view-content'); if (!el) return;
  const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>iPad setup · ${esc(STUDIO_NAMES[_sessionStudioId] || '')}</title>
    <style>body{font-family:-apple-system,Segoe UI,sans-serif;margin:24px;color:#1a1a1a} h1{font-size:20px;margin:0 0 18px}
      div[style*="margin-bottom:2.5rem"]{break-inside:avoid;margin-bottom:22px!important} img{width:150px!important;height:150px!important}</style></head>
    <body><h1>iPad setup · ${esc(STUDIO_NAMES[_sessionStudioId] || '')}</h1>${el.innerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
  w.document.close();
}
// the unread-tickets badge on the sidebar, once the studio is known
async function hubTicketsBadge() { await hubCopiedReady(); try { if (typeof checkTicketsBadgeOnLoad === 'function') checkTicketsBadgeOnLoad(); } catch (e) {} }

// ── SHARED TAG COMPONENT ──────────────────────────────────────

var _allTags = []     // {id, name} loaded from DB
var _tagInstances = {}  // keyed by containerId -> { selectedIds: [], canCreate: bool }

function loadAllTags(cb) {
  sb.from('tags').select('id, name').order('name').then(function(res) {
    _allTags = res.data || []
    if (cb) cb()
  })
}

function initTagInput(containerId, canCreate, initialNames) {
  initialNames = initialNames || []
  var selectedIds = []
  // Match initial names to tag ids
  initialNames.forEach(function(name) {
    var tag = _allTags.find(function(t) { return t.name.toLowerCase() === name.toLowerCase() })
    if (tag) selectedIds.push(tag.id)
  })
  _tagInstances[containerId] = { selectedIds: selectedIds, canCreate: canCreate }
  renderTagInput(containerId)
}

function renderTagInput(containerId) {
  var wrap = document.getElementById(containerId)
  if (!wrap) return
  var inst = _tagInstances[containerId]
  if (!inst) return

  wrap.innerHTML = ''
  wrap.className = 'tag-input-wrap'
  wrap.style.position = 'relative'

  // Render selected chips
  inst.selectedIds.forEach(function(id) {
    var tag = _allTags.find(function(t) { return t.id === id })
    if (!tag) return
    var chip = document.createElement('span')
    chip.className = 'tag-chip'
    chip.innerHTML = escHtml(tag.name) + '<button class="tag-chip-remove" type="button">x</button>'
    chip.querySelector('.tag-chip-remove').addEventListener('click', function(e) {
      e.stopPropagation()
      inst.selectedIds = inst.selectedIds.filter(function(x) { return x !== id })
      renderTagInput(containerId)
    })
    wrap.appendChild(chip)
  })

  // Text input
  var input = document.createElement('input')
  input.className = 'tag-text-input'
  input.placeholder = inst.selectedIds.length ? '' : 'Add tags...'
  input.setAttribute('autocomplete', 'off')
  wrap.appendChild(input)

  // Dropdown container
  var dropdown = document.createElement('div')
  dropdown.className = 'tag-dropdown'
  dropdown.style.display = 'none'
  dropdown.style.position = 'absolute'
  dropdown.style.top = (wrap.offsetHeight + 4) + 'px'
  dropdown.style.left = '0'
  dropdown.style.right = '0'
  wrap.appendChild(dropdown)

  input.addEventListener('input', function() {
    showTagDropdown(containerId, input, dropdown)
  })
  input.addEventListener('keydown', function(e) {
    if (e.keyCode === 27) { dropdown.style.display = 'none'; input.value = '' }
    if (e.keyCode === 8 && !input.value && inst.selectedIds.length) {
      inst.selectedIds.pop()
      renderTagInput(containerId)
    }
  })
  input.addEventListener('focus', function() {
    showTagDropdown(containerId, input, dropdown)
  })

  document.addEventListener('click', function hideDD(e) {
    if (!wrap.contains(e.target)) {
      dropdown.style.display = 'none'
      document.removeEventListener('click', hideDD)
    }
  })

  wrap.addEventListener('click', function() { input.focus() })
}

function showTagDropdown(containerId, input, dropdown) {
  var inst = _tagInstances[containerId]
  var q = (input.value || '').trim().toLowerCase()
  var available = _allTags.filter(function(t) {
    if (inst.selectedIds.indexOf(t.id) !== -1) return false
    if (q && t.name.toLowerCase().indexOf(q) === -1) return false
    return true
  })

  dropdown.innerHTML = ''
  if (!available.length && !q) { dropdown.style.display = 'none'; return }

  available.forEach(function(tag) {
    var item = document.createElement('div')
    item.className = 'tag-dropdown-item'
    item.textContent = tag.name
    item.addEventListener('mousedown', function(e) {
      e.preventDefault()
      inst.selectedIds.push(tag.id)
      input.value = ''
      dropdown.style.display = 'none'
      renderTagInput(containerId)
    })
    dropdown.appendChild(item)
  })

  // "Create" option — home office only
  if (inst.canCreate && q && !_allTags.find(function(t) { return t.name.toLowerCase() === q })) {
    var createItem = document.createElement('div')
    createItem.className = 'tag-dropdown-item create'
    createItem.textContent = 'Create tag "' + q + '"'
    createItem.addEventListener('mousedown', function(e) {
      e.preventDefault()
      createTag(q, function(newTag) {
        inst.selectedIds.push(newTag.id)
        input.value = ''
        dropdown.style.display = 'none'
        renderTagInput(containerId)
      })
    })
    dropdown.appendChild(createItem)
  } else if (!available.length) {
    var empty = document.createElement('div')
    empty.className = 'tag-dropdown-empty'
    empty.textContent = inst.canCreate ? 'Type to create a tag' : 'No matching tags'
    dropdown.appendChild(empty)
  }

  dropdown.style.display = 'block'
}

function createTag(name, cb) {
  sb.from('tags').insert({ name: name, created_by_user_id: currentUser.id, created_at: new Date().toISOString() }).select('id, name').then(function(res) {
    if (res.error || !res.data || !res.data.length) { alert('Error creating tag'); return }
    var newTag = res.data[0]
    _allTags.push(newTag)
    _allTags.sort(function(a,b) { return a.name.localeCompare(b.name) })
    if (cb) cb(newTag)
  })
}

function getTagIds(containerId) {
  return (_tagInstances[containerId] || {}).selectedIds || []
}

function getTagNames(containerId) {
  var ids = getTagIds(containerId)
  return ids.map(function(id) {
    var t = _allTags.find(function(x) { return x.id === id })
    return t ? t.name : null
  }).filter(Boolean)
}

function saveTicketTags(ticketId, tagIds, cb) {
  // Delete existing then insert new
  sb.from('ticket_tags').delete().eq('ticket_id', ticketId).then(function() {
    if (!tagIds.length) { if (cb) cb(); return }
    var rows = tagIds.map(function(tid) { return { ticket_id: ticketId, tag_id: tid } })
    sb.from('ticket_tags').insert(rows).then(function() { if (cb) cb() })
  })
}

function loadTicketTags(ticketId, cb) {
  sb.from('ticket_tags').select('tag_id').eq('ticket_id', ticketId).then(function(res) {
    var ids = (res.data || []).map(function(r) { return r.tag_id })
    cb(ids)
  })
}


// ── ATTACHMENT COMPONENT ──────────────────────────────────────

var _attachInstances = {}
// { containerId: { files: [File], urls: [string], uploading: false } }

var SUPABASE_STORAGE_URL = 'https://snxibhbhhchjthfmjtaj.supabase.co/storage/v1/object/public/ticket-attachments/'
var MAX_ATTACH = 5

function initAttachments(containerId) {
  _attachInstances[containerId] = { files: [], urls: [] }
  renderAttachBar(containerId)
}

function renderAttachBar(containerId) {
  var wrap = document.getElementById(containerId)
  if (!wrap) return
  var inst = _attachInstances[containerId]
  if (!inst) return

  var thumbsHtml = inst.urls.map(function(url, i) {
    var safeUrl = url.replace(/"/g, '&quot;')
    return '<div class="attach-thumb-wrap">'
      + '<img class="attach-thumb" src="' + safeUrl + '" onclick="openLightbox(this.src)">'
      + '<button class="attach-thumb-remove" onclick="removeAttachment(\'' + containerId + '\',' + i + ')">x</button>'
      + '</div>'
  }).join('')

  var canAdd = inst.urls.length < MAX_ATTACH
  wrap.innerHTML = (thumbsHtml ? '<div class="attach-preview">' + thumbsHtml + '</div>' : '')
    + (canAdd ? '<label class="attach-btn"><input type="file" accept="image/*" multiple onchange="handleAttachFiles(\'' + containerId + '\',this)">📎 Add photos' + (inst.urls.length ? ' (' + inst.urls.length + '/' + MAX_ATTACH + ')' : '') + '</label>' : '<span style="font-size:12px;color:#aaa">Max ' + MAX_ATTACH + ' photos</span>')
}

function handleAttachFiles(containerId, input) {
  var inst = _attachInstances[containerId]
  if (!inst) return
  var files = Array.prototype.slice.call(input.files || [])
  var remaining = MAX_ATTACH - inst.urls.length
  files = files.slice(0, remaining)
  if (!files.length) return

  // Validate types
  var invalid = files.filter(function(f) { return !f.type.startsWith('image/') })
  if (invalid.length) { alert('Only image files are supported.'); return }

  var wrap = document.getElementById(containerId)
  if (wrap) wrap.innerHTML += '<span class="attach-uploading">Uploading...</span>'

  var promises = files.map(function(file) {
    return uploadAttachment(file)
  })

  Promise.all(promises).then(function(urls) {
    urls.forEach(function(url) { if (url) inst.urls.push(url) })
    renderAttachBar(containerId)
  }).catch(function(e) {
    console.error('Upload error:', e)
    alert('Upload failed: ' + ((e && (e.message || e.error)) || 'unknown error') + '\n\nPlease try again, or let home office know if it keeps happening.')
    renderAttachBar(containerId)
  })

  // Reset input
  input.value = ''
}

// Uploads through the signed-in studio login (role = authenticated),
// not the bare anon key, so the ticket-attachments upload policy allows it.
function uploadAttachment(file) {
  var ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  if (ext === file.name.toLowerCase()) ext = 'jpg'
  var path = 'tickets/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext
  return sb.storage.from('ticket-attachments').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false
  }).then(function(res) {
    if (res.error) throw res.error
    return SUPABASE_STORAGE_URL + path
  })
}

function removeAttachment(containerId, index) {
  var inst = _attachInstances[containerId]
  if (!inst) return
  inst.urls.splice(index, 1)
  renderAttachBar(containerId)
}

function getAttachmentUrls(containerId) {
  return (_attachInstances[containerId] || {}).urls || []
}

function clearAttachments(containerId) {
  if (_attachInstances[containerId]) _attachInstances[containerId].urls = []
  renderAttachBar(containerId)
}

// Lightbox
function openLightbox(urlOrEl) {
  var url = typeof urlOrEl === 'string' ? urlOrEl : urlOrEl.src
  var lb = document.getElementById('attach-lightbox')
  if (!lb) return
  lb.querySelector('img').src = url
  lb.classList.add('open')
}
function closeLightbox() {
  var lb = document.getElementById('attach-lightbox')
  if (lb) lb.classList.remove('open')
}

// Render attachment thumbnails inside a message bubble
function renderMsgAttachments(attachments) {
  if (!attachments || !attachments.length) return ''
  return '<div class="msg-attachments">'
    + attachments.map(function(url) {
      return '<img class="msg-attach-thumb" src="' + url + '" onclick="openLightbox(this.src)" loading="lazy">'
    }).join('')
    + '</div>'
}

// ── MAGICAL MOMENTS (studio view) ────────────────────────────

// The people a moment can be about: this studio's active staff (the same list the shift planner uses); home office: everyone
var studioStaffList = []
async function loadMomentStaff() {
  try {
    var r = await sb.from('staff_profiles').select('id, display_name, preferred_name, nickname, studio_ids, is_active, termination_date').eq('is_active', true).order('display_name')
    var today = new Date().toLocaleDateString('en-CA')
    var all = (r.data || []).filter(function (p) { return !p.termination_date || p.termination_date >= today })
    var mine = _sessionStudioId ? all.filter(function (p) { return !p.studio_ids || !p.studio_ids.length || p.studio_ids.indexOf(_sessionStudioId) !== -1 }) : all
    studioStaffList = mine.length ? mine : all
  } catch (e) { studioStaffList = [] }
}
function loadMomentsView() {
  var el = document.getElementById('moments-view-content')
  el.innerHTML = renderMomentsSubmitUI()
  _mmSelectedStaff = null
  // init staff search after render
  var input = document.getElementById('mm-staff-search')
  if (input) {
    input.addEventListener('input', function() { searchStaffForMoment(this.value) })
    input.addEventListener('focus', function() { searchStaffForMoment(this.value, true) })
  }
  loadMomentStaff().then(function () { if (input && document.activeElement === input) searchStaffForMoment(input.value, true) })
}

function renderMomentsSubmitUI() {
  return '<div style="max-width:600px;margin:0 auto">'
    + '<div style="text-align:center;margin-bottom:1.75rem">'
    + '<div style="font-size:32px;margin-bottom:8px">✨</div>'
    + '<div style="font-size:20px;font-weight:600;margin-bottom:6px">Share a Magical Moment</div>'
    + '<div style="font-size:14px;color:#888;line-height:1.5">Did a teammate do something amazing? Let home office know!</div>'
    + '</div>'
    + '<div style="background:white;border-radius:14px;border:0.5px solid #e0e0d8;padding:1.5rem;display:flex;flex-direction:column;gap:14px">'
    // Who is this about
    + '<div>'
    + '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Who is this about?</div>'
    + '<input id="mm-staff-search" type="text" placeholder="Start typing a name..." autocomplete="off" style="width:100%;padding:10px 12px;border:0.5px solid #d0d0c8;border-radius:8px;font-size:14px;outline:none">'
    + '<div id="mm-staff-results" style="margin-top:4px"></div>'
    + '<div id="mm-selected-staff" style="margin-top:6px;padding:9px 13px;background:#f5f0ff;border:0.5px solid #ce93d8;border-radius:8px;font-size:13px;align-items:center;justify-content:space-between;display:none"></div>'
    + '</div>'
    // Your name
    + '<div>'
    + '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Your name</div>'
    + '<input id="mm-your-name" type="text" placeholder="So home office knows who shared this" style="width:100%;padding:10px 12px;border:0.5px solid #d0d0c8;border-radius:8px;font-size:14px;outline:none">'
    + '</div>'
    // The story
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Customer name (optional)</div>'
    + '<input id="mm-customer-name" type="text" placeholder="If related to a customer" style="width:100%;padding:10px 12px;border:0.5px solid #d0d0c8;border-radius:8px;font-size:14px;outline:none"></div>'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Order # (optional)</div>'
    + '<input id="mm-order-num" type="text" placeholder="e.g. #10234" style="width:100%;padding:10px 12px;border:0.5px solid #d0d0c8;border-radius:8px;font-size:14px;outline:none"></div>'
    + '</div>'
    + '<div>'
    + '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">What did they do?</div>'
    + '<textarea id="mm-story" placeholder="Describe the magical moment — what happened, who was involved, and why it stood out..." style="width:100%;padding:10px 12px;border:0.5px solid #d0d0c8;border-radius:8px;font-size:14px;outline:none;resize:vertical;min-height:110px;font-family:inherit"></textarea>'
    + '</div>'
    + '<button onclick="submitMoment()" style="padding:12px;background:#1a1a1a;color:white;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;width:100%">✨ Send to Home Office</button>'
    + '</div>'
    + '<div id="mm-success" style="display:none;text-align:center;padding:2rem;background:white;border-radius:14px;border:0.5px solid #e0e0d8;margin-top:1rem">'
    + '<div style="font-size:36px;margin-bottom:10px">🌟</div>'
    + '<div style="font-size:17px;font-weight:600;margin-bottom:6px">Moment shared!</div>'
    + '<div style="font-size:14px;color:#888">Home office will review and add it to their record.</div>'
    + '<button onclick="loadMomentsView()" style="margin-top:16px;padding:8px 20px;background:#f5f5f0;border:0.5px solid #d0d0c8;border-radius:8px;font-size:13px;cursor:pointer;color:#444">Share another</button>'
    + '</div>'
    + '</div>'
}

var _mmSelectedStaff = null

var _mmMatches = []
function searchStaffForMoment(val, onFocus) {
  var q = (val || '').trim().toLowerCase()
  var res = document.getElementById('mm-staff-results')
  if (!res) return
  if (!q && !onFocus) { res.innerHTML = ''; return }
  var nm = function (s) { return (s.preferred_name || '').trim() || s.display_name || s.nickname || 'Unknown' }
  if (!studioStaffList.length) { res.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px 0">Loading names\u2026</div>'; return }
  _mmMatches = studioStaffList.filter(function(s) {
    var name = (s.display_name || '') + ' ' + (s.nickname || '') + ' ' + (s.preferred_name || '')
    return !q || name.toLowerCase().indexOf(q) !== -1
  }).slice(0, q ? 8 : 30)
  if (!_mmMatches.length) { res.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px 0">No one by that name at this studio</div>'; return }
  res.innerHTML = '<div style="border:0.5px solid #e0e0d8;border-radius:8px;overflow:auto;max-height:260px;margin-top:2px">'
    + _mmMatches.map(function(s, i) {
      return '<div onmousedown="event.preventDefault()" onclick="selectMomentStaffAt(' + i + ')" style="padding:9px 13px;font-size:13px;cursor:pointer;background:white;border-bottom:0.5px solid #f0f0e8" onmouseover="this.style.background=\'#f5f5f0\'" onmouseout="this.style.background=\'white\'">' + escHtml(nm(s)) + '</div>'
    }).join('')
    + '</div>'
}
function selectMomentStaffAt(i) {
  var s = _mmMatches[i]; if (!s) return
  selectMomentStaff(s.id, (s.preferred_name || '').trim() || s.display_name || s.nickname || 'Unknown')
}

function selectMomentStaff(id, name) {
  _mmSelectedStaff = { id: id, name: name }
  document.getElementById('mm-staff-results').innerHTML = ''
  document.getElementById('mm-staff-search').value = ''
  var el = document.getElementById('mm-selected-staff')
  el.style.display = 'flex'
  el.innerHTML = '<span>✨ <strong>' + escHtml(name) + '</strong></span>'
    + '<button onclick="clearMomentStaff()" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:0">×</button>'
}

function clearMomentStaff() {
  _mmSelectedStaff = null
  var el = document.getElementById('mm-selected-staff')
  el.style.display = 'none'
  el.innerHTML = ''
}

function submitMoment() {
  var yourName = (document.getElementById('mm-your-name').value || '').trim()
  var story = (document.getElementById('mm-story').value || '').trim()
  var customerName = (document.getElementById('mm-customer-name').value || '').trim()
  var orderNum = (document.getElementById('mm-order-num').value || '').trim()
  if (!_mmSelectedStaff) { alert('Please select who this moment is about.'); return }
  if (!story) { alert('Please write what they did.'); return }
  var payload = {
    about_staff_id: _mmSelectedStaff.id,
    about_name: _mmSelectedStaff.name,
    submitted_by_user_id: currentUser ? currentUser.id : null,
    submitted_by_name: yourName || 'Studio staff',
    studio_id: currentStudioId,
    story: story,
    customer_name: customerName || null,
    order_number: orderNum || null,
    source: 'peer',
    status: 'new',
    created_at: new Date().toISOString()
  }
  sb.from('magical_moments').insert(payload).then(function(r) {
    if (r.error) { alert('Error sending moment: ' + r.error.message); return }
    // Hide form, show success
    document.querySelector('#moments-view-content > div > div:first-child + div').style.display = 'none'
    document.getElementById('mm-success').style.display = 'block'
    _mmSelectedStaff = null
  })
}

// ── RECENT BOOKINGS (studio view) ──────────────────────────────

var ticketState = { tickets: [], openTicketId: null, bookingSearchResults: [], selectedBooking: null }

function loadTicketsView() {
  var el = document.getElementById('tickets-view-content')
  el.innerHTML = '<div class="loading">Loading tickets...</div>'
  fetchStudioTickets()
}

function fetchStudioTickets() {
  sb.from('tickets')
    .select('id, title, ticket_number, category, priority, status, created_at, updated_at, customer_email, shopify_order_name, assigned_to_user_id, ticket_messages(id), ticket_tags(tag_id)')
    .eq('studio_id', currentStudioId)
    .order('updated_at', { ascending: false })
    .then(function(res) {
      ticketState.tickets = res.data || []
      ticketState.tickets.forEach(function(t) {
        t.tag_names = (t.ticket_tags || []).map(function(tt) {
          var tag = _allTags.find(function(x) { return x.id === tt.tag_id })
          return tag ? tag.name : null
        }).filter(Boolean)
      })
      renderTicketsList()
      checkTicketsUnread()
    })
}

function checkTicketsBadgeOnLoad() {
  if (!currentStudioId) return
  var badge = document.getElementById('tickets-unread-badge')
  if (!badge) return
  sb.from('tickets')
    .select('id, status, updated_at, ticket_messages(id)')
    .eq('studio_id', currentStudioId)
    .neq('status', 'resolved')
    .then(function(res) {
      var tickets = res.data || []
      var hasWaiting = tickets.some(function(t) { return t.status === 'waiting_on_studio' })
      if (hasWaiting) {
        badge.style.display = 'inline-block'
        badge.style.background = '#6a1b9a'
        badge.title = 'Home office is waiting for your reply'
        return
      }
      // Check for unread messages
      var ids = tickets.map(function(t) { return t.id })
      if (!ids.length) return
      sb.from('ticket_read_receipts')
        .select('ticket_id, last_read_at')
        .eq('user_id', currentUser.id)
        .in('ticket_id', ids)
        .then(function(r) {
          var readMap = {}
          ;(r.data || []).forEach(function(x) { readMap[x.ticket_id] = x.last_read_at })
          var hasUnread = tickets.some(function(t) {
            if (!t.ticket_messages || !t.ticket_messages.length) return false
            var lastRead = readMap[t.id]
            if (!lastRead) return true
            return new Date(t.updated_at) > new Date(lastRead)
          })
          if (hasUnread) {
            badge.style.display = 'inline-block'
            badge.style.background = '#c0392b'
            badge.title = 'You have unread ticket messages'
          }
        })
    })
}

function checkTicketsUnread() {
  var badge = document.getElementById('tickets-unread-badge')
  var hasWaiting = ticketState.tickets.some(function(t) { return t.status === 'waiting_on_studio' })
  if (!ticketState.tickets.length && !hasWaiting) { badge.style.display = 'none'; return }
  if (hasWaiting) {
    badge.style.display = 'inline-block'
    badge.style.background = '#6a1b9a'
    badge.title = 'Home office is waiting for your reply'
    return
  }
  var ids = ticketState.tickets.map(function(t) { return t.id })
  sb.from('ticket_read_receipts')
    .select('ticket_id, last_read_at')
    .eq('user_id', currentUser.id)
    .in('ticket_id', ids)
    .then(function(res) {
      var readMap = {}
      ;(res.data || []).forEach(function(r) { readMap[r.ticket_id] = r.last_read_at })
      var hasUnread = ticketState.tickets.some(function(t) {
        if (t.ticket_messages && t.ticket_messages.length === 0) return false
        var lastRead = readMap[t.id]
        if (!lastRead) return true
        return new Date(t.updated_at) > new Date(lastRead)
      })
      if (hasUnread) {
        badge.style.display = 'inline-block'
        badge.style.background = '#c0392b'
        badge.title = 'You have unread ticket messages'
      } else {
        badge.style.display = 'none'
      }
    })
}

var PRIORITY_COLORS = { emergency: '#7b0000', high: '#c0392b', normal: '#2471a3', low: '#888' }
var PRIORITY_BG = { emergency: '#fde8e8', high: '#fdf0ee', normal: '#eaf4fb', low: '#f5f5f5' }
var STATUS_COLORS = { open: '#2e7d32', in_progress: '#7a5800', waiting_on_studio: '#6a1b9a', resolved: '#888' }
var STATUS_BG = { open: '#e8f5e9', in_progress: '#fffbe6', waiting_on_studio: '#f3e5f5', resolved: '#f5f5f5' }
var STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', waiting_on_studio: 'Waiting on Studio', resolved: 'Resolved' }
var CATEGORY_ICONS = { 'Scheduling / Sessions': '📅', 'Inventory / Supplies': '📦', 'Customer Issue': '👤', 'Staff / HR': '🧑', 'General / Other': '💬' }

function renderTicketsList() {
  var el = document.getElementById('tickets-view-content')
  var tickets = ticketState.tickets
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">'
    + '<div style="font-size:18px;font-weight:500">Tickets</div>'
    + '<button onclick="openNewTicketModal()" style="padding:7px 16px;background:#1a1a1a;color:white;border:none;border-radius:7px;font-size:13px;cursor:pointer;font-weight:500">+ New Ticket</button>'
    + '</div>'
  if (!tickets.length) {
    html += '<div style="text-align:center;padding:3rem;color:#aaa;font-size:14px">No tickets yet.<br>Create one to get started.</div>'
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:10px">'
    tickets.forEach(function(t) {
      var isUnresolved = t.status !== 'resolved'
      var cat = t.category || 'General / Other'
      var icon = CATEGORY_ICONS[cat] || '💬'
      var msgCount = t.ticket_messages ? t.ticket_messages.length : 0
      html += '<div onclick="openTicket(\'' + t.id + '\')" style="background:white;border-radius:10px;border:0.5px solid #e0e0d8;padding:14px 16px;cursor:pointer;transition:box-shadow 0.15s" '
        + 'onmouseover="this.style.boxShadow=\'0 2px 10px rgba(0,0,0,0.09)\'" onmouseout="this.style.boxShadow=\'none\'">'
        + '<div style="display:flex;align-items:flex-start;gap:10px">'
        + '<span style="font-size:18px;margin-top:1px">' + icon + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:14px;font-weight:500;margin-bottom:5px">' + escHtml(t.title) + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
        + '<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:' + (PRIORITY_BG[t.priority] || '#f5f5f5') + ';color:' + (PRIORITY_COLORS[t.priority] || '#888') + '">' + capFirst(t.priority) + '</span>'
        + '<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:' + (STATUS_BG[t.status] || '#f5f5f5') + ';color:' + (STATUS_COLORS[t.status] || '#888') + '">' + (STATUS_LABELS[t.status] || t.status) + '</span>'
        + '<span style="font-size:11px;color:#aaa">' + icon + ' ' + cat + '</span>'
        + (t.ticket_number ? '<span style="font-size:11px;color:#bbb;margin-right:4px">#' + String(t.ticket_number).padStart(4,'0') + '</span>' : '')
        + (t.customer_email ? '<span style="font-size:11px;color:#888">· ' + escHtml(t.customer_email) + '</span>' : '')
        + '</div>'
        + (t.tag_names && t.tag_names.length ? '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">' + t.tag_names.map(function(n) { return '<span style="font-size:11px;padding:1px 7px;border-radius:20px;background:#f0f0ea;color:#666">' + escHtml(n) + '</span>' }).join('') + '</div>' : '')
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;margin-left:8px">'
        + '<div style="font-size:11px;color:#aaa">' + fmtRelTime(t.updated_at) + '</div>'
        + (msgCount ? '<div style="font-size:11px;color:#888;margin-top:3px">' + msgCount + ' msg' + (msgCount !== 1 ? 's' : '') + '</div>' : '')
        + '</div>'
        + '</div>'
        + '</div>'
    })
    html += '</div>'
  }

  // New Ticket Modal (hidden)
  html += renderNewTicketModal()
  // Ticket Thread Modal (hidden)
  html += '<div id="ticket-thread-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;overflow:auto">'
    + '<div style="background:white;border-radius:14px;max-width:640px;margin:3rem auto;padding:0;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.18)">'
    + '<div id="ticket-thread-content" style="padding:0"></div>'
    + '</div></div>'

  el.innerHTML = html
}

function escHtml(s) {
  if (!s) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function fmtRelTime(iso) {
  if (!iso) return ''
  var diff = Date.now() - new Date(iso).getTime()
  var m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  var h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  var d = Math.floor(h / 24)
  if (d < 7) return d + 'd ago'
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ── NEW TICKET MODAL ─────────────────────────────────────────

function renderNewTicketModal() {
  return '<div id="new-ticket-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;overflow:auto">'
    + '<div style="background:white;border-radius:14px;max-width:560px;margin:3rem auto;padding:1.75rem;box-shadow:0 8px 40px rgba(0,0,0,0.18)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">'
    + '<div style="font-size:17px;font-weight:600">New Ticket</div>'
    + '<button onclick="closeNewTicketModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1">x</button>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:12px">'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Title</div>'
    + '<input id="nt-title" type="text" placeholder="Brief description of the issue" style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none"></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Category</div>'
    + '<select id="nt-category" style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none;background:white">'
    + '<option>Scheduling / Sessions</option><option>Inventory / Supplies</option><option>Customer Issue</option><option>Staff / HR</option><option>General / Other</option>'
    + '</select></div>'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Priority</div>'
    + '<select id="nt-priority" style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none;background:white">'
    + '<option value="normal">Normal</option><option value="high">High</option><option value="emergency">Emergency</option><option value="low">Low</option>'
    + '</select></div>'
    + '</div>'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Customer (optional)</div>'
    + '<input id="nt-booking-search" type="text" placeholder="Search by name or order #..." style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none" oninput="searchBookingsForTicket(this.value)">'
    + '<div id="nt-booking-results" style="margin-top:4px"></div>'
    + '<div id="nt-selected-customer" style="display:none;margin-top:6px;padding:8px 11px;background:#f0f8ff;border:0.5px solid #b0d8f0;border-radius:7px;font-size:13px;display:flex;align-items:center;justify-content:space-between"></div>'
    + '</div>'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">First Message</div>'
    + '<textarea id="nt-message" placeholder="Describe the issue in detail..." style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none;resize:vertical;min-height:90px;font-family:inherit"></textarea>'
    + '<div id="nt-attach-bar" style="margin-top:6px"></div></div>'
    + '<div><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Tags (optional)</div><div id="nt-tags-input" style="min-height:38px"></div></div>'
    + '<button onclick="submitNewTicket()" style="padding:10px;background:#1a1a1a;color:white;border:none;border-radius:7px;font-size:14px;cursor:pointer;font-weight:500">Create Ticket</button>'
    + '</div></div></div>'
}

// Hub: "+ New Ticket" first opens a short "Before you send a ticket" step (hubTicketWall);
// this opens the actual form.
function openNewTicketModalForm() {
  ticketState.selectedBooking = null
  document.getElementById('new-ticket-modal').style.display = 'block'
  setTimeout(function() { initTagInput('nt-tags-input', false, []); initAttachments('nt-attach-bar') }, 50)
}
function closeNewTicketModal() {
  document.getElementById('new-ticket-modal').style.display = 'none'
}

var _bookingSearchTimer = null
function searchBookingsForTicket(val) {
  clearTimeout(_bookingSearchTimer)
  var q = (val || '').trim()
  var res = document.getElementById('nt-booking-results')
  if (!q || q.length < 2) { res.innerHTML = ''; return }
  _bookingSearchTimer = setTimeout(function() {
    var queryBuilder = sb.from('bookings')
      .select('id, customer_name, customer_email, shopify_order_name, booked_at')
      .eq('studio_id', currentStudioId)
      .gt('qty', 0)
      .limit(6)
    // Try order number search or name search
    if (q.charAt(0) === '#' || !isNaN(q.replace('#',''))) {
      queryBuilder = queryBuilder.ilike('shopify_order_name', '%' + q.replace('#','') + '%')
    } else {
      queryBuilder = queryBuilder.ilike('customer_name', '%' + q + '%')
    }
    queryBuilder.order('booked_at', { ascending: false }).then(function(r) {
      var rows = r.data || []
      if (!rows.length) { res.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px 0">No bookings found</div>'; return }
      // Deduplicate by customer_email
      var seen = {}
      var unique = []
      rows.forEach(function(b) {
        var key = (b.customer_email || b.customer_name || b.id)
        if (!seen[key]) { seen[key] = true; unique.push(b) }
      })
      res.innerHTML = '<div style="border:0.5px solid #e0e0d8;border-radius:7px;overflow:hidden;margin-top:2px">'
        + unique.map(function(b) {
          return '<div onclick="selectBookingForTicket(' + JSON.stringify(b).replace(/"/g, '&quot;') + ')" style="padding:8px 11px;font-size:13px;cursor:pointer;border-bottom:0.5px solid #f0f0e8;background:white" onmouseover="this.style.background=\'#f5f5f0\'" onmouseout="this.style.background=\'white\'">'
            + '<strong>' + escHtml(b.customer_name) + '</strong>'
            + (b.customer_email ? ' <span style="color:#888">' + escHtml(b.customer_email) + '</span>' : '')
            + (b.shopify_order_name ? ' <span style="color:#aaa;font-size:11px">' + escHtml(b.shopify_order_name) + '</span>' : '')
            + '</div>'
        }).join('')
        + '</div>'
    })
  }, 300)
}

function selectBookingForTicket(b) {
  ticketState.selectedBooking = b
  document.getElementById('nt-booking-results').innerHTML = ''
  document.getElementById('nt-booking-search').value = ''
  var selEl = document.getElementById('nt-selected-customer')
  selEl.style.display = 'flex'
  selEl.innerHTML = '<span><strong>' + escHtml(b.customer_name) + '</strong>'
    + (b.customer_email ? ' &bull; ' + escHtml(b.customer_email) : '')
    + (b.shopify_order_name ? ' &bull; ' + escHtml(b.shopify_order_name) : '')
    + '</span>'
    + '<button onclick="clearSelectedBooking()" style="background:none;border:none;color:#888;cursor:pointer;font-size:14px;padding:0 0 0 8px">x</button>'
}
function clearSelectedBooking() {
  ticketState.selectedBooking = null
  var selEl = document.getElementById('nt-selected-customer')
  selEl.style.display = 'none'
  selEl.innerHTML = ''
}


// ── TICKET NOTIFICATIONS ──────────────────────────────────────

function sendTicketNotification(type, ticketId, replyBody) {
  fetch('https://snxibhbhhchjthfmjtaj.supabase.co/functions/v1/send-ticket-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGliaGJoaGNoanRoZm1qdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk2ODAsImV4cCI6MjA5MjYzNTY4MH0.K-89Mx4SxU6N1hMmtK6Q79rWAtk6VTN9b5wemQxcZVA'
    },
    body: JSON.stringify({ type: type, ticket_id: ticketId, reply_body: replyBody || null })
  }).catch(function(e) { console.error('Ticket notification error:', e) })
}

function sendEmergencyEmail(ticketId, title, studioId, category, message, createdBy) {
  var studioName = (typeof STUDIO_NAMES !== 'undefined' && STUDIO_NAMES[studioId]) || studioId   // Hub: no studio-name element
  fetch('https://snxibhbhhchjthfmjtaj.supabase.co/functions/v1/send-emergency-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGliaGJoaGNoanRoZm1qdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk2ODAsImV4cCI6MjA5MjYzNTY4MH0.K-89Mx4SxU6N1hMmtK6Q79rWAtk6VTN9b5wemQxcZVA' },
    body: JSON.stringify({ ticket_id: ticketId, title: title, studio_name: studioName, category: category, message: message, created_by: createdBy })
  }).catch(function(e) { console.error('Emergency email error:', e) })
}

function submitNewTicket() {
  var title = (document.getElementById('nt-title').value || '').trim()
  var category = document.getElementById('nt-category').value
  var priority = document.getElementById('nt-priority').value
  var message = (document.getElementById('nt-message').value || '').trim()
  if (!title) { alert('Please enter a title.'); return }
  if (!message) { alert('Please enter a first message.'); return }
  var booking = ticketState.selectedBooking
  var payload = {
    studio_id: currentStudioId,
    title: title,
    category: category,
    priority: priority,
    status: 'open',
    created_by_user_id: currentUser.id,
    customer_email: booking ? (booking.customer_email || null) : null,
    shopify_order_name: booking ? (booking.shopify_order_name || null) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  if (!currentUser || !currentStudioId) { alert('Your session has expired. Please sign in again.'); window.location.reload(); return }
  // Refresh session before submitting in case token expired (iPads left logged in)
  sb.auth.getSession().then(function(sessionRes) {
    if (!sessionRes.data || !sessionRes.data.session) { alert('Your session has expired. Please sign in again.'); window.location.reload(); return }
    sb.from('tickets').insert(payload).select('id').then(function(r) {
    if (r.error || !r.data || !r.data.length) { alert('Error creating ticket: ' + (r.error ? r.error.message : 'no data returned')); return }
    var ticketId = r.data[0].id
    var ntAttachUrls = getAttachmentUrls('nt-attach-bar')
    sb.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_user_id: currentUser.id,
      body: message,
      attachments: ntAttachUrls.length ? ntAttachUrls : null,
      created_at: new Date().toISOString()
    }).then(function() {
      var tagIds = getTagIds('nt-tags-input')
      saveTicketTags(ticketId, tagIds, function() {
        sendTicketNotification('new', ticketId, null)
        clearAttachments('nt-attach-bar')
        closeNewTicketModal()
        markTicketRead(ticketId)
        fetchStudioTickets()
      })
    })
  })
  }) // end getSession
}

// ── TICKET THREAD ────────────────────────────────────────────

function openTicket(ticketId) {
  var modal = document.getElementById('ticket-thread-modal')
  var content = document.getElementById('ticket-thread-content')
  modal.style.display = 'block'
  content.innerHTML = '<div style="padding:2rem;text-align:center;color:#aaa">Loading...</div>'
  markTicketRead(ticketId)

  Promise.all([
    sb.from('tickets').select('*').eq('id', ticketId).single(),
    sb.from('ticket_messages').select('id, ticket_id, author_user_id, body, attachments, created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    sb.from('ticket_tags').select('tag_id').eq('ticket_id', ticketId)
  ]).then(function(results) {
    var ticket = results[0].data
    var messages = results[1].data || []
    var tagIds = (results[2].data || []).map(function(r) { return r.tag_id })
    ticket.tag_names = tagIds.map(function(id) { var t = _allTags.find(function(x) { return x.id === id }); return t ? t.name : null }).filter(Boolean)
    renderThreadModal(ticket, messages)
  })
}

function markTicketRead(ticketId) {
  sb.from('ticket_read_receipts').upsert({
    ticket_id: ticketId,
    user_id: currentUser.id,
    last_read_at: new Date().toISOString()
  }, { onConflict: 'ticket_id,user_id' }).then(function() {})
}

function closeThreadModal() {
  document.getElementById('ticket-thread-modal').style.display = 'none'
  fetchStudioTickets()
}

function renderThreadModal(ticket, messages) {
  var content = document.getElementById('ticket-thread-content')
  var cat = ticket.category || 'General / Other'
  var icon = CATEGORY_ICONS[cat] || '💬'
  var html = '<div style="padding:1.5rem 1.75rem;border-bottom:0.5px solid #f0f0e8">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'
    + '<div style="flex:1">'
    + '<div style="font-size:16px;font-weight:600;margin-bottom:6px">' + icon + ' ' + escHtml(ticket.title) + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:' + (PRIORITY_BG[ticket.priority]||'#f5f5f5') + ';color:' + (PRIORITY_COLORS[ticket.priority]||'#888') + '">' + capFirst(ticket.priority) + '</span>'
    + '<span style="font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;background:' + (STATUS_BG[ticket.status]||'#f5f5f5') + ';color:' + (STATUS_COLORS[ticket.status]||'#888') + '">' + (STATUS_LABELS[ticket.status]||ticket.status) + '</span>'
    + '<span style="font-size:11px;color:#aaa">' + cat + '</span>'
    + '</div>'
    + (ticket.customer_email ? '<div style="font-size:12px;color:#888;margin-top:6px">Customer: ' + escHtml(ticket.customer_email) + (ticket.shopify_order_name ? ' &bull; ' + escHtml(ticket.shopify_order_name) : '') + '</div>' : '')
    + (ticket.tag_names && ticket.tag_names.length ? '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">' + ticket.tag_names.map(function(n) { return '<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:#f0f0ea;color:#666">' + escHtml(n) + '</span>' }).join('') + '</div>' : '')
    + '</div>'
    + '<button onclick="closeThreadModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;padding:0;line-height:1;flex-shrink:0">x</button>'
    + '</div>'
    + '</div>'

  // Messages
  html += '<div style="padding:1.25rem 1.75rem;display:flex;flex-direction:column;gap:12px;max-height:380px;overflow-y:auto" id="thread-messages">'
  if (!messages.length) {
    html += '<div style="color:#aaa;font-size:13px;text-align:center;padding:1rem 0">No messages yet.</div>'
  } else {
    messages.forEach(function(m) {
      var isMe = m.author_user_id === currentUser.id
      var authorLabel = isMe ? 'You' : 'Home Office'
      var bg = isMe ? '#1a1a1a' : '#f0f0ea'
      var color = isMe ? 'white' : '#1a1a1a'
      html += '<div style="display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + '">'
        + '<div style="font-size:11px;color:#aaa;margin-bottom:3px">' + escHtml(authorLabel) + ' &bull; ' + fmtRelTime(m.created_at) + '</div>'
        + '<div style="max-width:85%;padding:10px 14px;border-radius:12px;background:' + bg + ';color:' + color + ';font-size:13px;line-height:1.5;white-space:pre-wrap">' + escHtml(m.body) + renderMsgAttachments(m.attachments) + '</div>'
        + '</div>'
    })
  }
  html += '</div>'

  // Reply box (only if not resolved)
  if (ticket.status !== 'resolved') {
    html += '<div style="padding:1rem 1.75rem 1.5rem;border-top:0.5px solid #f0f0e8">'
      + '<textarea id="thread-reply-input" placeholder="Type your reply..." style="width:100%;padding:9px 11px;border:0.5px solid #d0d0c8;border-radius:7px;font-size:14px;outline:none;resize:vertical;min-height:70px;font-family:inherit;margin-bottom:8px"></textarea>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end">'
      + '<button onclick="markTicketSolved(\'' + ticket.id + '\')" title="Fixed it yourselves? Close the ticket so home office doesn\'t need to look at it." style="padding:8px 14px;background:white;color:#2e7d32;border:1px solid #2e7d32;border-radius:7px;font-size:13px;cursor:pointer">✅ Mark as solved</button>'
      + '<button onclick="submitThreadReply(\'' + ticket.id + '\')" style="padding:8px 18px;background:#1a1a1a;color:white;border:none;border-radius:7px;font-size:13px;cursor:pointer">Send Reply</button>'
      + '</div>'
      + '<div style="font-size:11px;color:#aaa;text-align:right;margin-top:6px">Solved it yourselves? Write what fixed it (optional), then press ✅ Mark as solved.</div>'
      + '</div>'
  } else {
    html += '<div style="padding:1rem 1.75rem;text-align:center;font-size:13px;color:#aaa;border-top:0.5px solid #f0f0e8">This ticket is resolved.</div>'
  }

  content.innerHTML = html
  setTimeout(function() { if (document.getElementById('thread-attach-bar')) initAttachments('thread-attach-bar') }, 50)
  // Scroll messages to bottom
  var msgEl = document.getElementById('thread-messages')
  if (msgEl) msgEl.scrollTop = msgEl.scrollHeight
}

// The studio closes its own ticket when it solved the problem itself, so home
// office doesn't need to review it. Anything typed in the reply box is posted
// first as the "what fixed it" note.
function markTicketSolved(ticketId) {
  if (!confirm('Mark this ticket as solved? It will close, and home office won\'t need to look at it.')) return
  var input = document.getElementById('thread-reply-input')
  var note = input ? (input.value || '').trim() : ''
  if (input) input.disabled = true
  var now = new Date().toISOString()
  sb.from('ticket_messages').insert({
    ticket_id: ticketId,
    author_user_id: currentUser.id,
    body: '✅ Solved by the studio' + (note ? ': ' + note : '.'),
    created_at: now
  }).then(function(r1) {
    if (r1.error) throw r1.error
    return sb.from('tickets').update({ status: 'resolved', updated_at: now }).eq('id', ticketId).select('id, status')
  }).then(function(r2) {
    if (r2.error) throw r2.error
    if (!r2.data || !r2.data.length || r2.data[0].status !== 'resolved') throw new Error('This login isn\'t allowed to close tickets yet.')
    markTicketRead(ticketId)
    openTicket(ticketId)
  }).catch(function(e) {
    if (input) input.disabled = false
    alert('Couldn\'t mark it as solved: ' + (e && e.message ? e.message : e))
  })
}

function submitThreadReply(ticketId) {
  var input = document.getElementById('thread-reply-input')
  var body = (input.value || '').trim()
  if (!body) return
  input.disabled = true
  var thrAttachUrls = getAttachmentUrls('thread-attach-bar')
  sb.from('ticket_messages').insert({
    ticket_id: ticketId,
    author_user_id: currentUser.id,
    body: body,
    attachments: thrAttachUrls.length ? thrAttachUrls : null,
    created_at: new Date().toISOString()
  }).then(function() {
    sb.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId).then(function() {
      sendTicketNotification('reply', ticketId, body)
      clearAttachments('thread-attach-bar')
      markTicketRead(ticketId)
      openTicket(ticketId)
    })
  })
}
// ── CAMP PICKUP EMAIL ─────────────────────────────────────────

// ---------- Studio hours (studio_hours.sql) ----------
// Shown on 4Cats World → Your studio. Coordinators and home office can edit.
const HRS_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let _hours = null, _hoursEdit = null;
function hrsTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h >= 12 ? 'pm' : 'am'); }
function hrsLine(d) { return !d || d.closed ? 'Closed' : hrsTime(d.open) + ' – ' + hrsTime(d.close); }
function hrsDefault() { return HRS_DAYS.map((_, i) => ({ day: i + 1, closed: false, open: '10:00', close: '18:00' })); }
async function loadHoursCard() {
  const el = document.getElementById('hours-card'); if (!el) return;
  if (!currentStudioId) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = '<div style="color:#bbb;font-size:12px">Loading hours…</div>';
  const r = await sb.rpc('hub_studio_hours_get', { p_studio: currentStudioId });
  if (r.error) { el.innerHTML = /function|schema/i.test(r.error.message) ? '<div class="goal-note">Studio hours aren’t set up yet (studio_hours.sql).</div>' : `<div class="goal-note">Couldn’t load hours: ${esc(r.error.message)}</div>`; return; }
  _hours = r.data || null; _hoursEdit = null;
  renderHoursCard();
}
function renderHoursCard() {
  const el = document.getElementById('hours-card'); if (!el) return;
  const canEdit = coordOrAdmin();
  if (_hoursEdit) { renderHoursEditor(el); return; }
  const H = _hours, today = new Date(), todayDay = (today.getDay() + 6) % 7 + 1;
  const todayStr = today.toLocaleDateString('en-CA');
  const upcoming = ((H && H.special) || []).filter(x => x.date >= todayStr).sort((a, b) => a.date < b.date ? -1 : 1);
  let html = `<div class="ho-head" style="margin-bottom:8px"><div class="ho-title" style="font-size:17px">🕒 Studio hours</div><span class="spacer"></span>` +
    (canEdit ? `<button class="ho-btn" onclick="editHours()">${H ? 'Edit' : 'Set the hours'}</button>` : '') + `</div>`;
  if (!H || !(H.week || []).length) {
    html += `<div class="goal-note">No hours set yet.${canEdit ? ' Set them here, and families see them on 4Cats World.' : ' A coordinator can set them.'}</div>`;
  } else {
    html += `<div class="hrs-grid">` + HRS_DAYS.map((name, i) => {
      const d = (H.week || []).find(x => x.day === i + 1);
      return `<div class="hrs-row${i + 1 === todayDay ? ' today' : ''}"><span>${name}</span><b>${esc(hrsLine(d))}</b></div>`;
    }).join('') + `</div>`;
    if (H.note) html += `<div class="goal-note" style="margin-top:8px">${esc(H.note)}</div>`;
    if (upcoming.length) html += `<div style="margin-top:10px;font-size:13px"><b>Special days</b>` + upcoming.slice(0, 8).map(x =>
      `<div class="hrs-row"><span>${esc(new Date(x.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }))}${x.label ? ' · ' + esc(x.label) : ''}</span><b>${esc(hrsLine(x))}</b></div>`).join('') + `</div>`;
    html += `<div class="goal-note" style="margin-top:8px;font-size:12px">Shown to families on 4Cats World.${H.updated_by ? ' Last changed by ' + esc(H.updated_by) + '.' : ''}</div>`;
  }
  el.innerHTML = html;
}
function editHours() {
  if (!coordOrAdmin()) { openPinModal(); return; }
  const H = _hours || {};
  _hoursEdit = { week: (H.week && H.week.length ? H.week : hrsDefault()).map(x => Object.assign({}, x)), note: H.note || '', special: (H.special || []).map(x => Object.assign({}, x)) };
  renderHoursCard();
}
function hrsKeep() {   // read what's typed into the draft
  const el = document.getElementById('hours-card'); if (!el || !_hoursEdit) return;
  el.querySelectorAll('[data-hd]').forEach(row => {
    const d = _hoursEdit.week.find(x => x.day === +row.dataset.hd);
    d.closed = !row.querySelector('.hrs-open').checked; d.open = row.querySelector('.hrs-o').value; d.close = row.querySelector('.hrs-c').value;
  });
  el.querySelectorAll('[data-hs]').forEach(row => {
    const x = _hoursEdit.special[+row.dataset.hs];
    x.date = row.querySelector('.hrs-date').value; x.label = row.querySelector('.hrs-label').value.trim();
    x.closed = row.querySelector('.hrs-sclosed').checked; x.open = row.querySelector('.hrs-o').value; x.close = row.querySelector('.hrs-c').value;
  });
  const n = document.getElementById('hrs-note'); if (n) _hoursEdit.note = n.value;
}
function renderHoursEditor(el) {
  const E = _hoursEdit;
  el.innerHTML = `<div class="ho-head" style="margin-bottom:8px"><div class="ho-title" style="font-size:17px">🕒 Studio hours</div></div>` +
    `<div class="hrs-edit">` + E.week.map(d => `<div class="hrs-erow" data-hd="${d.day}">
      <span class="hrs-name">${HRS_DAYS[d.day - 1]}</span>
      <label class="hrs-chk"><input type="checkbox" class="hrs-open"${d.closed ? '' : ' checked'} onchange="hrsKeep();renderHoursCard()"> Open</label>
      <input type="time" class="hrs-o" value="${esc(d.open || '10:00')}"${d.closed ? ' disabled' : ''}> to <input type="time" class="hrs-c" value="${esc(d.close || '18:00')}"${d.closed ? ' disabled' : ''}></div>`).join('') +
    `<button class="ho-btn" style="margin-top:6px" onclick="hrsCopyWeekdays()">Copy Monday to all weekdays</button></div>` +
    `<div style="margin-top:12px"><div style="font-size:12px;color:#888;margin-bottom:4px">Note for families (optional)</div>
      <input type="text" id="hrs-note" maxlength="160" value="${esc(E.note || '')}" placeholder="e.g. Hours may vary during camps" style="width:100%;padding:8px 10px;border:1px solid #e6e1d4;border-radius:8px;font:inherit"></div>` +
    `<div style="margin-top:14px"><div style="font-size:13px;font-weight:700;margin-bottom:6px">Special days (holidays, closures, short days)</div>` +
    (E.special.map((x, i) => `<div class="hrs-erow" data-hs="${i}">
      <input type="date" class="hrs-date" value="${esc(x.date || '')}">
      <input type="text" class="hrs-label" value="${esc(x.label || '')}" placeholder="e.g. Christmas" maxlength="40">
      <label class="hrs-chk"><input type="checkbox" class="hrs-sclosed"${x.closed ? ' checked' : ''} onchange="hrsKeep();renderHoursCard()"> Closed</label>
      <input type="time" class="hrs-o" value="${esc(x.open || '10:00')}"${x.closed ? ' disabled' : ''}> to <input type="time" class="hrs-c" value="${esc(x.close || '14:00')}"${x.closed ? ' disabled' : ''}>
      <button class="ho-btn" onclick="hrsKeep();_hoursEdit.special.splice(${i},1);renderHoursCard()">Remove</button></div>`).join('') || '<div class="goal-note">None yet.</div>') +
    `<button class="ho-btn" style="margin-top:6px" onclick="hrsKeep();_hoursEdit.special.push({ date: '', closed: true, label: '' });renderHoursCard()">+ Add a special day</button></div>` +
    `<div style="display:flex;gap:8px;align-items:center;margin-top:14px"><button class="ho-btn primary" id="hrs-save" onclick="saveHours()">Save hours</button>
      <button class="ho-btn" onclick="_hoursEdit=null;renderHoursCard()">Cancel</button><span id="hrs-msg" style="font-size:13px;color:#b91c1c"></span></div>`;
}
function hrsCopyWeekdays() {
  hrsKeep();
  const mon = _hoursEdit.week.find(x => x.day === 1);
  _hoursEdit.week.forEach(x => { if (x.day >= 2 && x.day <= 5) { x.closed = mon.closed; x.open = mon.open; x.close = mon.close; } });
  renderHoursCard();
}
async function saveHours() {
  hrsKeep();
  const E = _hoursEdit, msg = document.getElementById('hrs-msg');
  const special = E.special.filter(x => x.date || x.label).map(x => x.closed ? { date: x.date, closed: true, label: x.label || null } : { date: x.date, closed: false, open: x.open, close: x.close, label: x.label || null });
  const week = E.week.map(x => x.closed ? { day: x.day, closed: true } : { day: x.day, closed: false, open: x.open, close: x.close });
  const badDay = week.find(x => !x.closed && !(x.open && x.close && x.close > x.open));
  if (badDay) { msg.textContent = 'Check ' + HRS_DAYS[badDay.day - 1] + ': closing time needs to be after opening.'; return; }
  const badSp = special.find(x => !x.date || (!x.closed && !(x.open && x.close && x.close > x.open)));
  if (badSp) { msg.textContent = badSp.date ? 'Check the hours for ' + badSp.date + '.' : 'Each special day needs a date.'; return; }
  const who = (_lastHeroData && _lastHeroData.firstName && _lastHeroData.firstName !== 'team') ? _lastHeroData.firstName : null;
  const b = document.getElementById('hrs-save'); b.disabled = true;
  const r = await sb.rpc('hub_studio_hours_save', { p_studio: currentStudioId, p_week: week, p_note: E.note || null, p_special: special, p_by: who });
  b.disabled = false;
  if (r.error) { msg.textContent = r.error.message; return; }
  _hours = { week, note: (E.note || '').trim() || null, special, updated_by: who };
  _hoursEdit = null; renderHoursCard();
}

async function loadInfoView() {
  const el = document.getElementById('info-view-content')
  if (!el) return
  if (!currentStudioId) { el.innerHTML = '<p style="color:#bbb;font-size:13px">No studio assigned.</p>'; return }
  el.innerHTML = '<div style="color:#bbb;font-size:12px">Loading…</div>'

  const [{ data: row }, { data: vis }] = await Promise.all([
    sb.from('studio_setup').select('*').eq('studio_id', currentStudioId).maybeSingle(),
    sb.from('studio_setup_field_visibility').select('field_name').eq('show_on_info', true)
  ])

  const visibleFields = new Set((vis || []).map(r => r.field_name))
  if (!row || !visibleFields.size) {
    el.innerHTML = '<p style="color:#bbb;font-size:13px">No studio info has been set up yet. Ask your home office to fill it in.</p>'
    return
  }

  let html = ''
  for (const section of INFO_SECTIONS) {
    const visibleInSection = section.keys.filter(k => visibleFields.has(k) && row[k] !== null && row[k] !== undefined && row[k] !== '')
    if (!visibleInSection.length) continue

    html += `<div style="margin-bottom:1.8rem">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:10px;padding-bottom:5px;border-bottom:0.5px solid #f0f0e8">${escText(section.title)}</div>`

    for (const key of visibleInSection) {
      const label = INFO_FIELD_LABELS[key] || key
      let valHtml = ''
      if (key === 'utilities') {
        const utils = Array.isArray(row[key]) ? row[key] : (row[key] ? JSON.parse(row[key]) : [])
        if (!utils.length) continue
        valHtml = utils.map(u => `<div style="margin-bottom:3px">${u.type ? `<strong>${u.type}</strong> — ` : ''}${u.company || ''}${u.account_number ? ` &nbsp;·&nbsp; Acct: ${u.account_number}` : ''}</div>`).join('')
        html += `<div style="margin-bottom:10px">
          <div style="font-size:11px;color:#888;margin-bottom:4px">${label}</div>
          <div style="font-size:13px;color:#1a1a1a">${valHtml}</div>
        </div>`
        continue
      } else if (key === 'mailbox_has_key') {
        valHtml = row[key] ? 'Yes' : 'No'
      } else {
        valHtml = String(row[key]).replace(/\n/g, '<br>')
      }
      html += `<div style="display:grid;grid-template-columns:160px 1fr;gap:8px;margin-bottom:7px;font-size:13px">
        <span style="color:#888">${label}</span>
        <span style="color:#1a1a1a">${valHtml}</span>
      </div>`
    }
    html += `</div>`
  }

  // Tables from studio_tables (always show if data exists)
  const { data: tables } = await sb.from('studio_tables').select('capacity').eq('studio_id', currentStudioId).eq('is_active', true)
  if (tables && tables.length) {
    const seats = tables.reduce((s, t) => s + (t.capacity || 0), 0)
    html += `<div style="margin-bottom:1.8rem">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:10px;padding-bottom:5px;border-bottom:0.5px solid #f0f0e8">Tables</div>
      <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;font-size:13px">
        <span style="color:#888"># of Tables</span><span>${tables.length}</span>
        <span style="color:#888">Total Seats</span><span>${seats}</span>
      </div>
    </div>`
  }

  el.innerHTML = html || '<p style="color:#bbb;font-size:13px">No info fields are currently set to show here.</p>'
}
// Quick Links (iPad setup QR codes) — from index.html, shown on the Studio info page
// (QR_BASE is already defined with the party code)
function qr(id) {
  return {
    partyDashboard: QR_BASE + '/' + id + '/party-dashboard.png',
    partySignin:    QR_BASE + '/' + id + '/party-sign-in.png',
    workshopPDF:    QR_BASE + '/' + id + '/workshop-checkin.pdf',
  }
}
const QR_STUDIO = {
  'BC-RICH-GC':  qr('BC-RICH-GC'),
  'BC-RICH-STV': qr('BC-RICH-STV'),
  'BC-SUR-SSR':  qr('BC-SUR-SSR'),
  'BC-YVR-KIT':  qr('BC-YVR-KIT'),
  'BC-YVR-MS':   qr('BC-YVR-MS'),
  'BC-YVR-UBC':  qr('BC-YVR-UBC'),
  'BC-YYJ-CSV':  qr('BC-YYJ-CSV'),
  'BC-YYJ-ESQ':  qr('BC-YYJ-ESQ'),
  'BC-YYJ-OB':   qr('BC-YYJ-OB'),
  'BC-YYJ-VIC':  qr('BC-YYJ-VIC'),
  'AB-YYC-ING':  qr('AB-YYC-ING'),
  'AB-STA-STA':  qr('AB-STA-STA'),
  'ON-BRL-BRL':  qr('ON-BRL-BRL'),
  'ON-CMB-GLT':  qr('ON-CMB-GLT'),
  'ON-ERN-ERN':  qr('ON-ERN-ERN'),
  'ON-HAM-OS':   qr('ON-HAM-OS'),
  'ON-HAM-WD':   qr('ON-HAM-WD'),
  'ON-HAM-WH':   qr('ON-HAM-WH'),
  'ON-KGN-AP':   qr('ON-KGN-AP'),
  'ON-LDN-BYR':  qr('ON-LDN-BYR'),
  'ON-LDN-WVG':  qr('ON-LDN-WVG'),
  'ON-MIS-PC':   qr('ON-MIS-PC'),
  'ON-OAK-OAK':  qr('ON-OAK-OAK'),
  'ON-OAK-WST':  qr('ON-OAK-WST'),
  'ON-YOW-GLB':  qr('ON-YOW-GLB'),
  'ON-STC-STC':  qr('ON-STC-STC'),
  'ON-YYZ-AVE':  qr('ON-YYZ-AVE'),
  'ON-YYZ-BP':   qr('ON-YYZ-BP'),
  'ON-YYZ-LEA':  qr('ON-YYZ-LEA'),
  'ON-YYZ-BEA':  qr('ON-YYZ-BEA'),
  'ON-WTR-WTR':  qr('ON-WTR-WTR'),
}
function renderLinksView() {
  var el = document.getElementById('qr-view-content')
  if (!el) return
  var sid = currentStudioId || ''
  var SB  = 'https://snxibhbhhchjthfmjtaj.supabase.co/storage/v1/object/public/qr-codes'

  var qrGlobal = {
    demoer:         SB + '/global/demoer.png',
    circler:        SB + '/global/circler.png',
    director:       SB + '/global/director.png',
    training:       SB + '/global/training.png',
    workshopSignIn: SB + '/global/workshop-signin.png',
    partyMenu:      SB + '/global/party-menu.png',
    campCheckin:    SB + '/global/camp-checkin.png',
    contestSignup:  SB + '/global/contest-signup.png',
  }
  var qrStudio = {
    partyCheckin:   sid ? SB + '/' + sid + '/party-checkin.png'   : null,
    partyDashboard: sid ? SB + '/' + sid + '/party-dashboard.png' : null,
  }

  function section(title, cards) {
    return '<div style="margin-bottom:2.5rem">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #f0f0e8">' + title + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:16px">' + cards.map(qrCard).join('') + '</div>'
      + '</div>'
  }

  function qrCard(item) {
    var badge = item.studio
      ? '<span style="font-size:10px;background:#e8f0fe;color:#1a4fa0;padding:2px 6px;border-radius:10px;margin-left:6px;font-weight:600">Studio</span>'
      : '<span style="font-size:10px;background:#f0f0ec;color:#888;padding:2px 6px;border-radius:10px;margin-left:6px">Global</span>'
    var img = item.url
      ? '<img src="' + item.url + '" style="width:180px;height:180px;display:block;border-radius:8px" alt="' + item.label + '">'
      : '<div style="width:180px;height:180px;background:#f5f5f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#bbb">Not uploaded</div>'
    return '<div style="text-align:center">'
      + img
      + '<div style="font-size:13px;font-weight:500;margin-top:8px;color:#1a1a1a">' + item.label + badge + '</div>'
      + (item.note ? '<div style="font-size:11px;color:#aaa;margin-top:2px">' + escText(item.note) + '</div>' : '')
      + '</div>'
  }

  el.innerHTML = [
    section('DEMOER IPAD SETUP', [
      { label: 'Demoer Dashboard',   url: qrGlobal.demoer,         studio: false, note: 'Scan to open on iPad' },
    ]),
    section('CIRCLER IPAD SETUP', [
      { label: 'Circler Dashboard',  url: qrGlobal.circler,        studio: false, note: 'Scan to open on iPad' },
      { label: 'Workshop Sign-In',   url: qrGlobal.workshopSignIn, studio: false, note: 'Customer check-in QR' },
    ]),
    section('DIRECTOR IPAD SETUP', [
      { label: 'Director Dashboard', url: qrGlobal.director,       studio: false, note: 'Scan to open on iPad' },
      { label: 'Training',           url: qrGlobal.training,       studio: false, note: 'Staff training portal' },
      { label: 'Workshop Sign-In',   url: qrGlobal.workshopSignIn, studio: false, note: 'Customer check-in QR' },
    ]),
    section('PARTY IPAD SETUP', [
      { label: 'Party Check-In',     url: qrStudio.partyCheckin,   studio: true,  note: 'Guest self-check-in' },
      { label: 'Party Dashboard',    url: qrStudio.partyDashboard, studio: true,  note: 'Staff party view' },
      { label: 'Party Menu',         url: qrGlobal.partyMenu,      studio: false, note: 'Menu QR code' },
    ]),
    section('CAMP SETUP', [
      { label: 'Camp Check-In',      url: qrGlobal.campCheckin,    studio: false, note: 'Scan to open on iPad' },
    ]),
    section('CONTEST IPAD SETUP', [
      { label: 'Contest Sign-Up',    url: qrGlobal.contestSignup,  studio: false, note: 'Scan to open on iPad' },
    ]),
  ].join('')

  // Workshop check-in print sheet
  var studioCfg = sid ? (QR_STUDIO[sid] || {}) : {}
  var workshopUrl = studioCfg.workshopPDF || ''
  el.innerHTML += '<div style="margin-top:1rem;padding-top:1.5rem;border-top:1px solid #f0f0e8">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:12px">📋 Workshop Check-In Print Sheet</div>'
    + (workshopUrl
      ? '<p style="font-size:13px;color:#555;margin-bottom:12px">Print and place on each table — contains the QR code customers scan to check in.</p>'
        + '<a href="' + workshopUrl + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:#1a1a1a;color:white;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none">🖨️ Open &amp; Print Check-In Sheet</a>'
      : '<p style="font-size:13px;color:#bbb">Not yet configured for this studio. Upload <code>' + (sid || 'STUDIO-ID') + '/workshop-checkin.pdf</code> to the qr-codes bucket.</p>')
    + '</div>'
}
// ---------- Hub: "Before you send a ticket" ----------
// Asks what the problem is, offers quick ways to solve it (Google, Studio info, tips for the
// category), and needs what they've already tried + two ticks before the form opens.
// Emergencies skip straight to the form.
var HUB_TICKET_TIPS = {
  'Scheduling / Sessions': ['Check the <b>Schedule</b> page for the day: class lists, spots and who’s working are all there.', 'For a staffing gap, use <b>Call in sick / ask for cover</b>, or ask your coordinator.', 'Booking questions: open the class list and search the customer’s name.'],
  'Inventory / Supplies': ['Order supplies through the <b>Supplies</b> page, not a ticket.', 'Check whether a nearby studio can lend what you need today.'],
  'Customer Issue': ['Look the customer up in the <b>class list</b> (orders, notes and phone are there).', 'For a refund or credit, check the policy in the how-to guides first.', 'If a customer is unsafe or aggressive, call 911 first.'],
  'Staff / HR': ['<b>HR or payroll questions go to <a href="mailto:HR@4cats.com">HR@4cats.com</a></b>, not a ticket.', 'For a concern about how someone is treated, use <b>🛡️ Report a concern</b>.'],
  'General / Other': ['Restart it, check it’s plugged in and switched on, and try again.', 'Search Google for the <b>exact</b> error message or model number (Studio info has the printer, toner and kiln models).', 'Ask your coordinator or manager: they’ve often seen it before.']
};
function openNewTicketModal() {
  if (_studioData && _studioData.isAdmin) { openNewTicketModalForm(); return; }   // home office: straight to the form
  var cats = Object.keys(HUB_TICKET_TIPS);
  openDutySheet('<h3>Before you send a ticket</h3>'
    + '<p class="goal-note" style="margin-top:0">Most things can be sorted in a few minutes on your own. Tickets are for what you really can’t fix at the studio.</p>'
    + '<div class="me-form">'
    + '<label>What’s the problem?<input id="tw-what" maxlength="120" placeholder="e.g. Printer says “toner low” but it’s new" oninput="hubTicketWallCheck()"></label>'
    + '<label>What kind of problem?<select id="tw-cat" onchange="hubTicketWallTips()">' + cats.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></label>'
    + '<div id="tw-tips" class="tw-tips"></div>'
    + '<div class="tw-help"><button type="button" class="ho-btn" onclick="hubTicketGoogle()">🔎 Search Google for this</button>'
    + '<button type="button" class="ho-btn" onclick="closeDutySheet(); openInfoPane()">ℹ️ Studio info</button></div>'
    + '<label>What have you already tried?<textarea id="tw-tried" rows="3" maxlength="1000" placeholder="e.g. Restarted the printer, reseated the toner, searched the error on Google" oninput="hubTicketWallCheck()"></textarea></label>'
    + '<label class="tw-tick"><input type="checkbox" id="tw-t1" onchange="hubTicketWallCheck()"> I searched Google or the how-to guides and couldn’t fix it</label>'
    + '<label class="tw-tick"><input type="checkbox" id="tw-t2" onchange="hubTicketWallCheck()"> I checked with my manager or coordinator (or none is available)</label>'
    + '</div>'
    + '<div class="tw-emerg">🚨 <b>Emergency?</b> (safety, flooding, can’t open the studio) <a href="#" onclick="hubTicketEmergency(); return false">Skip to an emergency ticket</a></div>'
    + '<div class="sheet-actions"><button onclick="closeDutySheet()">Cancel</button><button class="primary" id="tw-go" disabled onclick="hubTicketContinue()">Continue to the ticket</button></div>');
  hubTicketWallTips();
  setTimeout(function () { var w = document.getElementById('tw-what'); if (w) w.focus(); }, 50);
}
function hubTicketWallTips() {
  var c = document.getElementById('tw-cat').value, tips = HUB_TICKET_TIPS[c] || [];
  document.getElementById('tw-tips').innerHTML = '<b>Try this first:</b><ul>' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  hubTicketWallCheck();
}
function hubTicketWallCheck() {
  var ok = (document.getElementById('tw-what').value || '').trim().length >= 5
    && (document.getElementById('tw-tried').value || '').trim().length >= 15
    && document.getElementById('tw-t1').checked && document.getElementById('tw-t2').checked;
  var b = document.getElementById('tw-go'); if (b) b.disabled = !ok;
}
function hubTicketGoogle() {
  var q = (document.getElementById('tw-what').value || '').trim();
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q || 'how to'), '_blank', 'noopener');
}
function hubTicketContinue() {
  var what = document.getElementById('tw-what').value.trim(), cat = document.getElementById('tw-cat').value, tried = document.getElementById('tw-tried').value.trim();
  closeDutySheet();
  openNewTicketModalForm();
  setTimeout(function () {
    var t = document.getElementById('nt-title'), c = document.getElementById('nt-category'), m = document.getElementById('nt-message');
    if (t) t.value = what;
    if (c) c.value = cat;
    if (m && !m.value) m.value = '\n\n— Already tried: ' + tried;
    if (m) { m.focus(); m.setSelectionRange(0, 0); }
  }, 80);
}
function hubTicketEmergency() {
  closeDutySheet();
  openNewTicketModalForm();
  setTimeout(function () { var p = document.getElementById('nt-priority'); if (p) p.value = 'emergency'; var t = document.getElementById('nt-title'); if (t) t.focus(); }, 80);
}

/* ======================= end of tickets / moments / info copy ======================= */

/*  minimake-block.js — Mini Make Drop In booking widget
 *  Hosted on GitHub Pages: https://4catsart.github.io/4cats-studio-app/minimake-block.js
 *
 *  Usage (Shopify Custom Liquid block on the product template):
 *    <div id="mm-root" data-week-start="2026-09-28"></div>
 *    <script src="https://4catsart.github.io/4cats-studio-app/minimake-block.js"></script>
 *
 *  Dates:
 *    data-week-start = Monday of the week (YYYY-MM-DD). The widget shows Mon–Sun.
 *    Optional overrides: data-date-from / data-date-to (YYYY-MM-DD).
 *    If nothing is provided, falls back to the current Mon–Sun week (Toronto time).
 */
(function () {
  var root = document.getElementById('mm-root')
  if (!root) return
  // Guard against double-loading (e.g. an old inline copy left in a description)
  if (root.getAttribute('data-mm-init')) return
  root.setAttribute('data-mm-init', '1')

  const EDGE_URL = 'https://snxibhbhhchjthfmjtaj.supabase.co/functions/v1/public-minimake'

  // Extras (only offered for sessions on/after this date)
  const ADDON_START_DATE = '2026-09-01'
  const HOT_CHOC_VARIANT_ID = 43066196820058
  const CANDY_BAG_VARIANT_ID = 43066196066394

  const PROVINCES = [
    { label: 'British Columbia', prefix: 'BC' },
    { label: 'Alberta',          prefix: 'AB' },
    { label: 'Ontario',          prefix: 'ON' },
  ]

  // ── Date range ────────────────────────────────────────────────
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  function addDays(ymd, n) {
    var p = ymd.split('-')
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }

  function currentMonday() {
    var today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
    var p = today.split('-')
    var dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() // 0 = Sun
    return addDays(today, dow === 0 ? -6 : 1 - dow)
  }

  var weekStart = (root.getAttribute('data-week-start') || '').trim().slice(0, 10)
  var DATE_FROM = (root.getAttribute('data-date-from') || '').trim()
  var DATE_TO   = (root.getAttribute('data-date-to') || '').trim()

  if (!DATE_RE.test(DATE_FROM)) {
    if (DATE_RE.test(weekStart)) {
      DATE_FROM = weekStart
    } else {
      DATE_FROM = currentMonday()
      console.warn('[minimake] No valid data-week-start on #mm-root — using current week starting ' + DATE_FROM)
    }
  }
  if (!DATE_RE.test(DATE_TO)) DATE_TO = addDays(DATE_FROM, 6)

  // ── Inject font + styles ──────────────────────────────────────
  if (!document.getElementById('mm-font')) {
    var font = document.createElement('link')
    font.id = 'mm-font'
    font.rel = 'stylesheet'
    font.href = 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&display=swap'
    document.head.appendChild(font)
  }
  if (!document.getElementById('mm-styles')) {
    var style = document.createElement('style')
    style.id = 'mm-styles'
    style.textContent = [
      "#mm-root { font-family: 'Work Sans', sans-serif; max-width: 720px; margin: 0 auto; padding: 8px 0 40px; color: #1a1a1a; }",
      ".mm-step-label { font-family: 'Work Sans', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 10px; }",
      ".mm-provinces { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }",
      ".mm-prov-chip { font-family: 'Work Sans', sans-serif; font-size: 13px; padding: 8px 20px; border: 1.5px solid #ddd; border-radius: 100px; cursor: pointer; background: #fff; color: #444; transition: all 0.15s ease; white-space: nowrap; }",
      ".mm-prov-chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }",
      ".mm-prov-chip.selected { background: #1a1a1a !important; border-color: #1a1a1a !important; color: #fff !important; font-weight: 600 !important; }",
      ".mm-studio-wrap { margin-bottom: 28px; }",
      ".mm-studio-select { font-family: 'Work Sans', sans-serif; font-size: 14px; width: 100%; max-width: 400px; padding: 10px 14px; border: 1.5px solid #ddd; border-radius: 8px; background: #fff; color: #1a1a1a; appearance: none; -webkit-appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; transition: border-color 0.15s; }",
      ".mm-studio-select:focus { outline: none; border-color: #1a1a1a; }",
      ".mm-dates { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }",
      ".mm-date-chip { font-family: 'Work Sans', sans-serif; font-size: 13px; padding: 8px 16px; border: 1.5px solid #ddd; border-radius: 100px; cursor: pointer; background: #fff; color: #444; transition: all 0.15s ease; white-space: nowrap; }",
      ".mm-date-chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }",
      ".mm-date-chip.selected { background: #1a1a1a !important; border-color: #1a1a1a !important; color: #fff !important; font-weight: 600 !important; }",
      ".mm-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 12px; }",
      ".mm-slot { font-family: 'Work Sans', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 16px 10px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px; background: #fff; gap: 10px; }",
      ".mm-slot.sold-out { opacity: 0.5; }",
      ".mm-slot-time { font-size: 18px; font-weight: 700; color: #1a1a1a; }",
      ".mm-slot.sold-out .mm-slot-time { color: #bbb; }",
      ".mm-slot-sold-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; border-radius: 100px; background: #f0f0f0; color: #aaa; }",
      ".mm-qty { display: flex; align-items: center; border: 1.5px solid #ddd; border-radius: 8px; overflow: hidden; }",
      ".mm-qty-caption { font-family: 'Work Sans', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: #999; }",
      ".mm-qty-btn { width: 34px; height: 34px; background: #f7f7f7; border: none; font-size: 18px; cursor: pointer; color: #444; transition: background 0.1s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }",
      ".mm-qty-btn:hover { background: #eee; }",
      ".mm-qty-btn:disabled { color: #ccc; cursor: default; }",
      ".mm-qty-val { width: 34px; text-align: center; font-size: 14px; font-weight: 700; color: #1a1a1a; border-left: 1px solid #ddd; border-right: 1px solid #ddd; line-height: 34px; flex-shrink: 0; }",
      "#mm-root .mm-register-btn { font-family: 'Work Sans', sans-serif !important; font-size: 12px !important; font-weight: 700 !important; letter-spacing: 0.08em !important; text-transform: uppercase !important; padding: 8px 18px !important; background: #1a1a1a !important; color: #fff !important; border: none !important; border-radius: 6px !important; cursor: pointer !important; text-decoration: none !important; transition: background 0.15s !important; display: inline-block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }",
      "#mm-root .mm-register-btn:hover { background: #333 !important; }",
      ".mm-loading, .mm-empty, .mm-prompt { font-family: 'Work Sans', sans-serif; font-size: 14px; color: #999; padding: 20px 0; text-align: center; }",
      ".mm-spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid #eee; border-top-color: #555; border-radius: 50%; animation: mm-spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }",
      "@keyframes mm-spin { to { transform: rotate(360deg); } }",
      ".mm-section { margin-bottom: 28px; }",
      ".mm-divider { border: none; border-top: 1px solid #f0f0f0; margin: 0 0 28px; }",
      ".mm-spaces-left { font-family: 'Work Sans', sans-serif; font-size: 11px; font-weight: 600; color: #c0392b; letter-spacing: 0.04em; }",
      ".mm-slot.mm-preselected { border-color: #c3090c !important; box-shadow: 0 0 0 2px rgba(195,9,12,0.15) !important; }",
      ".mm-extras { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; padding-top: 10px; border-top: 1px solid #f0f0f0; }",
      ".mm-extra-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }",
      ".mm-extra-label { font-family: 'Work Sans', sans-serif; font-size: 11px; font-weight: 600; color: #666; text-align: center; }"
    ].join('\n')
    document.head.appendChild(style)
  }

  // ── State ─────────────────────────────────────────────────────
  let allDates = []
  let studioList = []
  let selectedProvince = null
  let selectedStudio = null
  let selectedDate = null
  let preselectTime = null
  let scrolledToPreselect = false
  const slotQty = {}
  const hotChocQty = {}
  const candyBagQty = {}

  function formatTimeFromHHMM(t) {
    var parts = t.split(':')
    var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10)
    var ampm = h >= 12 ? 'pm' : 'am'
    var h12 = h % 12 || 12
    return h12 + (m > 0 ? ':' + (m < 10 ? '0' + m : m) : '') + ampm
  }

  function applyUrlParams() {
    try {
      var search = window.parent.location.search || window.location.search
      var params = new URLSearchParams(search)
      var t = params.get('time')
      if (t) preselectTime = t
      var sid = params.get('studio')
      var dt = params.get('date')
      if (!sid) return
      sid = sid.toUpperCase()
      var match = studioList.some(function(s) { return s.studio_id === sid })
      if (!match) return
      selectedProvince = sid.indexOf('BC') === 0 ? 'BC' : sid.indexOf('AB') === 0 ? 'AB' : sid.indexOf('ON') === 0 ? 'ON' : null
      selectedStudio = sid
      if (dt) {
        var avail = datesForStudio(sid)
        if (avail.some(function(d) { return d.date === dt })) selectedDate = dt
      }
    } catch (e) {}
  }

  const fetchUrl = EDGE_URL + '?date_from=' + DATE_FROM + '&date_to=' + DATE_TO

  root.innerHTML = '<div class="mm-loading"><span class="mm-spinner"></span>Loading available sessions\u2026</div>'

  fetch(fetchUrl)
    .then(function(r) { return r.json() })
    .then(function(data) {
      allDates = data.dates || []
      // Filter out past dates client-side
      var todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
      allDates = allDates.filter(function(d) { return d.date >= todayStr })
      if (!allDates.length) {
        root.innerHTML = '<div class="mm-empty">No Mini Make sessions are scheduled for this week. Check back soon!</div>'
        return
      }
      var studioMap = {}
      for (var i = 0; i < allDates.length; i++) {
        for (var j = 0; j < allDates[i].studios.length; j++) {
          var s = allDates[i].studios[j]
          if (!studioMap[s.studio_id]) studioMap[s.studio_id] = s.studio_name
        }
      }
      studioList = Object.keys(studioMap).map(function(id) {
        return { studio_id: id, studio_name: studioMap[id] }
      }).sort(function(a, b) { return a.studio_name.localeCompare(b.studio_name) })

      var activeProvs = PROVINCES.filter(function(p) {
        return studioList.some(function(s) { return s.studio_id.indexOf(p.prefix) === 0 })
      })
      if (activeProvs.length === 1) selectedProvince = activeProvs[0].prefix

      applyUrlParams()

      render()
    })
    .catch(function() {
      root.innerHTML = '<div class="mm-empty">Couldn\'t load sessions right now \u2014 please refresh the page.</div>'
    })

  function render() {
    root.innerHTML = ''
    renderProvincePicker()

    // Auto-select studio if only one exists for the selected province
    if (selectedProvince && !selectedStudio) {
      var provinceStudios = studioList.filter(function(s) {
        return s.studio_id.indexOf(selectedProvince) === 0
      })
      if (provinceStudios.length === 1) {
        selectedStudio = provinceStudios[0].studio_id
      }
    }

    renderStudioPicker()

    if (selectedStudio && datesForStudio(selectedStudio).length === 0) {
      var noneMsg = document.createElement('div')
      noneMsg.className = 'mm-empty'
      noneMsg.textContent = 'No available Mini Make sessions for this studio right now \u2014 please check another studio.'
      root.appendChild(noneMsg)
      return
    }

    // Auto-select date if only one is available for the selected studio
    if (selectedStudio && !selectedDate) {
      var availableDates = datesForStudio(selectedStudio)
      if (availableDates.length === 1) {
        selectedDate = availableDates[0].date
      }
    }

    renderDatePicker()
    renderSlots()
  }

  function activeProvinceCount() {
    return PROVINCES.filter(function(p) {
      return studioList.some(function(s) { return s.studio_id.indexOf(p.prefix) === 0 })
    }).length
  }

  function hasAvailableSlot(studioObj) {
    return studioObj.slots.some(function(slot) {
      return !(slot.spaces_left !== null && slot.spaces_left === 0)
    })
  }

  function datesForStudio(studioId) {
    return allDates.filter(function(d) {
      return d.studios.some(function(s) {
        return s.studio_id === studioId && hasAvailableSlot(s)
      })
    }).map(function(d) { return { date: d.date, label: d.label } })
  }

  function makeHr() {
    var hr = document.createElement('hr')
    hr.className = 'mm-divider'
    return hr
  }

  function buildExtrasRow(key) {
    if (hotChocQty[key] === undefined) hotChocQty[key] = 0
    if (candyBagQty[key] === undefined) candyBagQty[key] = 0

    var wrap = document.createElement('div')
    wrap.className = 'mm-extras'

    function makeItem(label, map, maxQty) {
      var item = document.createElement('div')
      item.className = 'mm-extra-item'

      var lbl = document.createElement('span')
      lbl.className = 'mm-extra-label'
      lbl.textContent = label
      item.appendChild(lbl)

      var qtyWrap = document.createElement('div')
      qtyWrap.className = 'mm-qty'

      var minus = document.createElement('button')
      minus.type = 'button'
      minus.className = 'mm-qty-btn'
      minus.textContent = '\u2212'
      minus.disabled = map[key] <= 0
      minus.addEventListener('click', function () {
        map[key] = Math.max(0, map[key] - 1)
        render()
      })

      var val = document.createElement('div')
      val.className = 'mm-qty-val'
      val.textContent = map[key]

      var plus = document.createElement('button')
      plus.type = 'button'
      plus.className = 'mm-qty-btn'
      plus.textContent = '+'
      plus.disabled = map[key] >= maxQty
      plus.addEventListener('click', function () {
        map[key] = Math.min(maxQty, map[key] + 1)
        render()
      })

      qtyWrap.appendChild(minus)
      qtyWrap.appendChild(val)
      qtyWrap.appendChild(plus)
      item.appendChild(qtyWrap)
      return item
    }

    wrap.appendChild(makeItem('Hot Chocolate ($2.50)', hotChocQty, 20))
    wrap.appendChild(makeItem('Candy Bag ($4.99)', candyBagQty, 20))

    return wrap
  }

  function renderProvincePicker() {
    var activeProvs = PROVINCES.filter(function(p) {
      return studioList.some(function(s) { return s.studio_id.indexOf(p.prefix) === 0 })
    })
    if (activeProvs.length <= 1) return

    var wrap = document.createElement('div')
    wrap.className = 'mm-section'
    var label = document.createElement('div')
    label.className = 'mm-step-label'
    label.textContent = 'Step 1 \u2014 Choose your province'
    wrap.appendChild(label)

    var chips = document.createElement('div')
    chips.className = 'mm-provinces'

    activeProvs.forEach(function(p) {
      var chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'mm-prov-chip' + (selectedProvince === p.prefix ? ' selected' : '')
      chip.textContent = p.label
      chip.addEventListener('click', function() {
        selectedProvince = p.prefix
        selectedStudio = null
        selectedDate = null
        render()
      })
      chips.appendChild(chip)
    })

    wrap.appendChild(chips)
    root.appendChild(wrap)
    root.appendChild(makeHr())
  }

  function renderStudioPicker() {
    if (!selectedProvince) return
    var provinceStudios = studioList.filter(function(s) {
      return s.studio_id.indexOf(selectedProvince) === 0
    })
    if (!provinceStudios.length) return

    var stepNum = activeProvinceCount() > 1 ? 2 : 1
    var wrap = document.createElement('div')
    wrap.className = 'mm-section mm-studio-wrap'
    var label = document.createElement('div')
    label.className = 'mm-step-label'
    label.textContent = 'Step ' + stepNum + ' \u2014 Choose your studio'
    wrap.appendChild(label)

    var select = document.createElement('select')
    select.className = 'mm-studio-select'

    var placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = '\u2014 Select a studio \u2014'
    placeholder.disabled = true
    placeholder.selected = !selectedStudio
    select.appendChild(placeholder)

    provinceStudios.forEach(function(studio) {
      var opt = document.createElement('option')
      opt.value = studio.studio_id
      opt.textContent = studio.studio_name
      opt.selected = selectedStudio === studio.studio_id
      select.appendChild(opt)
    })

    select.addEventListener('change', function() {
      selectedStudio = select.value || null
      selectedDate = null
      var available = datesForStudio(selectedStudio)
      if (available.length === 1) selectedDate = available[0].date
      render()
    })

    wrap.appendChild(select)
    root.appendChild(wrap)
    root.appendChild(makeHr())
  }

  function renderDatePicker() {
    if (!selectedStudio) return
    var available = datesForStudio(selectedStudio)
    if (!available.length || available.length === 1) return

    var stepNum = activeProvinceCount() > 1 ? 3 : 2
    var wrap = document.createElement('div')
    wrap.className = 'mm-section'
    var label = document.createElement('div')
    label.className = 'mm-step-label'
    label.textContent = 'Step ' + stepNum + ' \u2014 Choose a date'
    wrap.appendChild(label)

    var chips = document.createElement('div')
    chips.className = 'mm-dates'

    available.forEach(function(d) {
      var chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'mm-date-chip' + (selectedDate === d.date ? ' selected' : '')
      chip.textContent = d.label
      chip.addEventListener('click', function() {
        selectedDate = d.date
        render()
      })
      chips.appendChild(chip)
    })

    wrap.appendChild(chips)
    root.appendChild(wrap)
    root.appendChild(makeHr())
  }

  function renderSlots() {
    if (!selectedStudio || !selectedDate) {
      if (selectedStudio && !selectedDate) {
        var p = document.createElement('div')
        p.className = 'mm-prompt'
        p.textContent = 'Choose a date above to see available times.'
        root.appendChild(p)
      }
      return
    }

    var dateObj = null
    for (var i = 0; i < allDates.length; i++) {
      if (allDates[i].date === selectedDate) { dateObj = allDates[i]; break }
    }
    var studioObj = null
    if (dateObj) {
      for (var j = 0; j < dateObj.studios.length; j++) {
        if (dateObj.studios[j].studio_id === selectedStudio) { studioObj = dateObj.studios[j]; break }
      }
    }
    if (!studioObj) return

    var totalSteps = activeProvinceCount() > 1 ? 4 : 3
    var wrap = document.createElement('div')
    wrap.className = 'mm-section'
    var label = document.createElement('div')
    label.className = 'mm-step-label'
    label.textContent = 'Step ' + totalSteps + ' \u2014 Pick a time'
    wrap.appendChild(label)

    var dateChip = document.createElement('div')
    dateChip.className = 'mm-date-chip selected'
    dateChip.style.display = 'inline-block'
    dateChip.style.marginBottom = '16px'
    dateChip.style.cursor = 'default'
    dateChip.textContent = dateObj.label
    wrap.appendChild(dateChip)

    var grid = document.createElement('div')
    grid.className = 'mm-slots'
    var preselectedCard = null

    studioObj.slots.forEach(function(slot) {
      var isSoldOut = slot.spaces_left !== null && slot.spaces_left === 0
      if (isSoldOut) return

      var isPreselected = preselectTime && slot.time === formatTimeFromHHMM(preselectTime)
      var card = document.createElement('div')
      card.className = 'mm-slot' + (isPreselected ? ' mm-preselected' : '')
      if (isPreselected) preselectedCard = card

      var timeEl = document.createElement('span')
      timeEl.className = 'mm-slot-time'
      timeEl.textContent = slot.time
      card.appendChild(timeEl)

      var key = slot.register_url
      if (!slotQty[key]) slotQty[key] = 1

      var qtyCaption = document.createElement('span')
      qtyCaption.className = 'mm-qty-caption'
      qtyCaption.textContent = 'How many people?'
      card.appendChild(qtyCaption)

      var qty = document.createElement('div')
      qty.className = 'mm-qty'

      var minus = document.createElement('button')
      minus.type = 'button'
      minus.className = 'mm-qty-btn'
      minus.textContent = '\u2212'
      minus.disabled = slotQty[key] <= 1;
      (function(k) {
        minus.addEventListener('click', function() {
          if (slotQty[k] > 1) { slotQty[k]--; render() }
        })
      })(key)

      var val = document.createElement('div')
      val.className = 'mm-qty-val'
      val.textContent = slotQty[key]

      var plus = document.createElement('button')
      plus.type = 'button'
      plus.className = 'mm-qty-btn'
      plus.textContent = '+'
      plus.disabled = slot.spaces_left !== null && slotQty[key] >= slot.spaces_left;
      (function(k) {
        plus.addEventListener('click', function() { slotQty[k]++; render() })
      })(key)

      qty.appendChild(minus)
      qty.appendChild(val)
      qty.appendChild(plus)
      card.appendChild(qty)

      if (slot.spaces_left !== null && slot.spaces_left <= 5) {
        var warning = document.createElement('div')
        warning.className = 'mm-spaces-left'
        warning.textContent = slot.spaces_left + (slot.spaces_left === 1 ? ' space left' : ' spaces left')
        card.appendChild(warning)
      }

      // Extras: Hot Chocolate / Candy Bag (sessions on/after ADDON_START_DATE)
      if (selectedDate >= ADDON_START_DATE) {
        card.appendChild(buildExtrasRow(key))
      }

      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'mm-register-btn'
      btn.textContent = 'Register';
      (function (slotData, qtyKey) {
        btn.addEventListener('click', function () {
          var variantId = slotData.register_url.match(/\/cart\/(\d+):/)
          variantId = variantId ? variantId[1] : null
          if (!variantId) return

          btn.disabled = true
          btn.textContent = 'Adding\u2026'

          var items = [{
            id: parseInt(variantId, 10),
            quantity: slotQty[qtyKey]
          }]

          var bookingLabel = dateObj.label + ' ' + slotData.time + ' \u2014 ' + studioObj.studio_name
          var addonMatchProps = {
            'For booking': bookingLabel,
            '_studio_id': selectedStudio,
            '_event_date': selectedDate,
            '_event_time': slotData.time
          }

          if (hotChocQty[qtyKey]) {
            items.push({ id: HOT_CHOC_VARIANT_ID, quantity: hotChocQty[qtyKey], properties: addonMatchProps })
          }
          if (candyBagQty[qtyKey]) {
            items.push({ id: CANDY_BAG_VARIANT_ID, quantity: candyBagQty[qtyKey], properties: addonMatchProps })
          }

          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
          })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed')
            window.location.href = '/cart'
          })
          .catch(function () {
            btn.disabled = false
            btn.textContent = 'Register'
            alert('Something went wrong adding to cart. Please try again.')
          })
        })
      })(slot, key)
      card.appendChild(btn)

      grid.appendChild(card)
    })

    if (!grid.hasChildNodes()) {
      var mmEmptyMsg = document.createElement('div')
      mmEmptyMsg.className = 'mm-empty'
      mmEmptyMsg.textContent = 'All sessions for this date are sold out \u2014 please choose another date.'
      wrap.appendChild(mmEmptyMsg)
    } else {
      wrap.appendChild(grid)
    }
    root.appendChild(wrap)

    if (preselectedCard && !scrolledToPreselect) {
      scrolledToPreselect = true
      setTimeout(function () {
        preselectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }

})()

/* project-block.js — 4Cats single-project booking widget
 * Hosted on GitHub Pages, loaded from a Custom Liquid block on the
 * "project" product template:
 *
 *   <div class="project-booking" data-handle="{{ product.handle }}"></div>
 *   <script src="https://4catsart.github.io/4cats-studio-app/project-block.js"></script>
 *
 * Optional: data-project="Let It Glow Trees" overrides the custom.project metafield.
 *
 * Shows dedicated project sessions AND lineup days that offer this project.
 * Lineup bookings get the 'Project' line-item property pre-filled, exactly
 * like workshop_embed.html does when the customer picks it themselves.
 *
 * ES5 on purpose (older customer iPads).
 */
(function () {
  'use strict'

  var EDGE_URL = 'https://snxibhbhhchjthfmjtaj.supabase.co/functions/v1/public-project'

  // Extras (only offered for sessions on/after this date) — same as Mini Make / Workshop
  var ADDON_START_DATE = '2026-09-01'
  var HOT_CHOC_VARIANT_ID = 43066196820058
  var CANDY_BAG_VARIANT_ID = 43066196066394

  var PROVINCES = [
    { label: 'British Columbia', prefix: 'BC' },
    { label: 'Alberta', prefix: 'AB' },
    { label: 'Ontario', prefix: 'ON' }
  ]

  // ── Styles (injected once) ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('pb-styles')) return
    var font = document.createElement('link')
    font.rel = 'stylesheet'
    font.href = 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&display=swap'
    document.head.appendChild(font)

    var css = [
      '.pb-root { font-family: "Work Sans", sans-serif !important; max-width: 720px; margin: 0 auto; padding: 8px 0 40px; color: #1a1a1a; text-align: left; }',
      '.pb-root * { box-sizing: border-box; }',
      '.pb-section { margin-bottom: 28px; }',
      '.pb-divider { border: none !important; border-top: 1px solid #f0f0f0 !important; margin: 0 0 28px !important; }',
      '.pb-step { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 10px; }',
      '.pb-chips { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.pb-root .pb-chip { font-family: "Work Sans", sans-serif !important; font-size: 13px !important; padding: 8px 18px !important; border: 1.5px solid #ddd !important; border-radius: 100px !important; cursor: pointer; background: #fff !important; color: #444 !important; white-space: nowrap; line-height: 1.3 !important; min-height: 0 !important; transition: all 0.15s ease; }',
      '.pb-root .pb-chip:hover { border-color: #1a1a1a !important; color: #1a1a1a !important; }',
      '.pb-root .pb-chip.selected { background: #1a1a1a !important; border-color: #1a1a1a !important; color: #fff !important; font-weight: 600 !important; }',
      '.pb-root .pb-select { font-family: "Work Sans", sans-serif !important; font-size: 14px !important; width: 100%; max-width: 400px; padding: 10px 14px !important; border: 1.5px solid #ddd !important; border-radius: 8px !important; background: #fff; color: #1a1a1a !important; -webkit-appearance: none; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%23999\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }',
      '.pb-root .pb-select:focus { outline: none; border-color: #1a1a1a !important; }',
      '.pb-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }',
      '.pb-slot { display: flex; flex-direction: column; align-items: center; padding: 16px 12px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px; background: #fff; gap: 10px; text-align: center; }',
      '.pb-slot.pb-preselected { border-color: #c3090c !important; box-shadow: 0 0 0 2px rgba(195,9,12,0.15) !important; }',
      '.pb-slot-time { font-size: 18px; font-weight: 700; color: #1a1a1a; }',
      '.pb-lineup-tag { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; background: #fdecec; color: #c3090c; }',
      '.pb-qty-caption { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: #999; }',
      '.pb-qty { display: flex; align-items: center; border: 1.5px solid #ddd; border-radius: 8px; overflow: hidden; }',
      '.pb-root .pb-qty-btn { width: 34px !important; height: 34px !important; min-width: 0 !important; padding: 0 !important; background: #f7f7f7 !important; border: none !important; border-radius: 0 !important; font-size: 18px !important; cursor: pointer; color: #444 !important; display: flex; align-items: center; justify-content: center; }',
      '.pb-root .pb-qty-btn:disabled { color: #ccc !important; cursor: default; }',
      '.pb-qty-val { width: 34px; text-align: center; font-size: 14px; font-weight: 700; border-left: 1px solid #ddd; border-right: 1px solid #ddd; line-height: 34px; }',
      '.pb-spaces { font-size: 11px; font-weight: 600; color: #c0392b; letter-spacing: 0.04em; }',
      '.pb-extras { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; padding-top: 10px; border-top: 1px solid #f0f0f0; }',
      '.pb-extra-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }',
      '.pb-extra-label { font-size: 11px; font-weight: 600; color: #666; }',
      '.pb-root .pb-register { font-family: "Work Sans", sans-serif !important; font-size: 12px !important; font-weight: 700 !important; letter-spacing: 0.08em !important; text-transform: uppercase !important; padding: 10px 18px !important; background: #1a1a1a !important; color: #fff !important; border: none !important; border-radius: 6px !important; cursor: pointer; width: 100% !important; min-height: 0 !important; }',
      '.pb-root .pb-register:hover { background: #333 !important; }',
      '.pb-root .pb-register:disabled { background: #888 !important; cursor: default; }',
      '.pb-msg { font-size: 14px; color: #999; padding: 20px 0; text-align: center; }',
      '.pb-spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid #eee; border-top-color: #555; border-radius: 50%; animation: pb-spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }',
      '@keyframes pb-spin { to { transform: rotate(360deg); } }',
      '@media (prefers-reduced-motion: reduce) { .pb-spinner { animation-duration: 2s; } }'
    ].join('\n')
    var style = document.createElement('style')
    style.id = 'pb-styles'
    style.appendChild(document.createTextNode(css))
    document.head.appendChild(style)
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined && text !== null) e.textContent = text
    return e
  }

  function formatTimeFromHHMM(t) {
    var parts = t.split(':')
    var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10)
    var ampm = h >= 12 ? 'pm' : 'am'
    var h12 = h % 12 || 12
    return h12 + (m > 0 ? ':' + (m < 10 ? '0' + m : m) : '') + ampm
  }

  // ── One widget instance per container ──────────────────────────────────
  function Widget(root) {
    var handle = root.getAttribute('data-handle') || ''
    var projectOverride = root.getAttribute('data-project') || ''

    var project = null
    var allDates = []
    var studioList = []
    var selectedProvince = null
    var selectedStudio = null
    var selectedDate = null
    var preselectTime = null
    var scrolledToPreselect = false
    var qty = {}
    var hotChoc = {}
    var candyBag = {}

    root.className += ' pb-root'
    root.innerHTML = '<div class="pb-msg"><span class="pb-spinner"></span>Loading available times\u2026</div>'

    var url = EDGE_URL + '?handle=' + encodeURIComponent(handle)
    if (projectOverride) url += '&project=' + encodeURIComponent(projectOverride)

    fetch(url)
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.error) {
          root.innerHTML = ''
          root.appendChild(el('div', 'pb-msg', 'Booking isn\u2019t set up for this project yet.'))
          console.error('public-project:', data.error)
          return
        }
        project = data.project
        var today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
        allDates = (data.dates || []).filter(function (d) { return d.date >= today })

        if (!allDates.length) {
          root.innerHTML = ''
          root.appendChild(el('div', 'pb-msg', 'No ' + project.name + ' classes are scheduled right now. Check back soon!'))
          return
        }

        var studioMap = {}
        allDates.forEach(function (d) {
          d.studios.forEach(function (s) { studioMap[s.studio_id] = s.studio_name })
        })
        studioList = Object.keys(studioMap).map(function (id) {
          return { studio_id: id, studio_name: studioMap[id] }
        }).sort(function (a, b) { return a.studio_name.localeCompare(b.studio_name) })

        var provs = activeProvinces()
        if (provs.length === 1) selectedProvince = provs[0].prefix

        applyUrlParams()
        render()
      })
      .catch(function () {
        root.innerHTML = ''
        root.appendChild(el('div', 'pb-msg', 'Couldn\u2019t load times right now \u2014 please refresh the page.'))
      })

    function activeProvinces() {
      return PROVINCES.filter(function (p) {
        return studioList.some(function (s) { return s.studio_id.indexOf(p.prefix) === 0 })
      })
    }

    function isOpen(slot) { return !(slot.spaces_left !== null && slot.spaces_left === 0) }

    function studioOnDate(dateObj, studioId) {
      for (var i = 0; i < dateObj.studios.length; i++) {
        if (dateObj.studios[i].studio_id === studioId) return dateObj.studios[i]
      }
      return null
    }

    function datesForStudio(studioId) {
      return allDates.filter(function (d) {
        var s = studioOnDate(d, studioId)
        return s && s.slots.some(isOpen)
      })
    }

    function applyUrlParams() {
      try {
        var params = new URLSearchParams(window.location.search)
        var t = params.get('time')
        if (t) preselectTime = t
        var sid = params.get('studio')
        if (!sid) return
        sid = sid.toUpperCase()
        if (!studioList.some(function (s) { return s.studio_id === sid })) return
        selectedProvince = sid.substring(0, 2)
        selectedStudio = sid
        var dt = params.get('date')
        if (dt && datesForStudio(sid).some(function (d) { return d.date === dt })) selectedDate = dt
      } catch (e) {}
    }

    function stepLabel(n, text) {
      var offset = activeProvinces().length > 1 ? 0 : -1
      return el('div', 'pb-step', 'Step ' + (n + offset) + ' \u2014 ' + text)
    }

    function render() {
      root.innerHTML = ''

      if (selectedProvince && !selectedStudio) {
        var ps = studioList.filter(function (s) { return s.studio_id.indexOf(selectedProvince) === 0 })
        if (ps.length === 1) selectedStudio = ps[0].studio_id
      }

      renderProvinces()
      renderStudios()

      if (selectedStudio) {
        var avail = datesForStudio(selectedStudio)
        if (!avail.length) {
          root.appendChild(el('div', 'pb-msg', 'No open ' + project.name + ' times at this studio right now \u2014 please check another studio.'))
          return
        }
        if (!selectedDate && avail.length === 1) selectedDate = avail[0].date
      }

      renderDates()
      renderSlots()
    }

    function renderProvinces() {
      var provs = activeProvinces()
      if (provs.length <= 1) return
      var wrap = el('div', 'pb-section')
      wrap.appendChild(stepLabel(1, 'Choose your province'))
      var chips = el('div', 'pb-chips')
      provs.forEach(function (p) {
        var chip = el('button', 'pb-chip' + (selectedProvince === p.prefix ? ' selected' : ''), p.label)
        chip.type = 'button'
        chip.addEventListener('click', function () {
          selectedProvince = p.prefix
          selectedStudio = null
          selectedDate = null
          render()
        })
        chips.appendChild(chip)
      })
      wrap.appendChild(chips)
      root.appendChild(wrap)
      root.appendChild(el('hr', 'pb-divider'))
    }

    function renderStudios() {
      if (!selectedProvince) return
      var studios = studioList.filter(function (s) { return s.studio_id.indexOf(selectedProvince) === 0 })
      if (!studios.length) return

      var wrap = el('div', 'pb-section')
      wrap.appendChild(stepLabel(2, 'Choose your studio'))
      var select = el('select', 'pb-select')
      var ph = el('option', null, '\u2014 Select a studio \u2014')
      ph.value = ''
      ph.disabled = true
      ph.selected = !selectedStudio
      select.appendChild(ph)
      studios.forEach(function (s) {
        var opt = el('option', null, s.studio_name)
        opt.value = s.studio_id
        opt.selected = selectedStudio === s.studio_id
        select.appendChild(opt)
      })
      select.addEventListener('change', function () {
        selectedStudio = select.value || null
        selectedDate = null
        render()
      })
      wrap.appendChild(select)
      root.appendChild(wrap)
      root.appendChild(el('hr', 'pb-divider'))
    }

    function renderDates() {
      if (!selectedStudio) return
      var avail = datesForStudio(selectedStudio)
      if (avail.length <= 1) return

      var wrap = el('div', 'pb-section')
      wrap.appendChild(stepLabel(3, 'Choose a date'))
      var chips = el('div', 'pb-chips')
      avail.forEach(function (d) {
        var chip = el('button', 'pb-chip' + (selectedDate === d.date ? ' selected' : ''), d.label)
        chip.type = 'button'
        chip.addEventListener('click', function () {
          selectedDate = d.date
          render()
        })
        chips.appendChild(chip)
      })
      wrap.appendChild(chips)
      root.appendChild(wrap)
      root.appendChild(el('hr', 'pb-divider'))
    }

    function stepper(map, key, min, max) {
      var box = el('div', 'pb-qty')
      var minus = el('button', 'pb-qty-btn', '\u2212')
      minus.type = 'button'
      minus.disabled = map[key] <= min
      minus.addEventListener('click', function () { map[key] = Math.max(min, map[key] - 1); render() })
      var plus = el('button', 'pb-qty-btn', '+')
      plus.type = 'button'
      plus.disabled = max !== null && map[key] >= max
      plus.addEventListener('click', function () { map[key] = map[key] + 1; render() })
      box.appendChild(minus)
      box.appendChild(el('div', 'pb-qty-val', String(map[key])))
      box.appendChild(plus)
      return box
    }

    function extrasRow(key) {
      if (hotChoc[key] === undefined) hotChoc[key] = 0
      if (candyBag[key] === undefined) candyBag[key] = 0
      var wrap = el('div', 'pb-extras')
      function item(label, map) {
        var it = el('div', 'pb-extra-item')
        it.appendChild(el('span', 'pb-extra-label', label))
        it.appendChild(stepper(map, key, 0, 20))
        return it
      }
      wrap.appendChild(item('Hot Chocolate ($2.50)', hotChoc))
      wrap.appendChild(item('Candy Bag ($4.99)', candyBag))
      return wrap
    }

    function renderSlots() {
      if (!selectedStudio) return
      if (!selectedDate) {
        root.appendChild(el('div', 'pb-msg', 'Choose a date above to see available times.'))
        return
      }
      var dateObj = null
      for (var i = 0; i < allDates.length; i++) {
        if (allDates[i].date === selectedDate) { dateObj = allDates[i]; break }
      }
      var studioObj = dateObj && studioOnDate(dateObj, selectedStudio)
      if (!studioObj) return

      var wrap = el('div', 'pb-section')
      wrap.appendChild(stepLabel(4, 'Pick a time'))
      var dateChip = el('div', 'pb-chip selected', dateObj.label)
      dateChip.style.display = 'inline-block'
      dateChip.style.marginBottom = '16px'
      dateChip.style.cursor = 'default'
      wrap.appendChild(dateChip)

      var grid = el('div', 'pb-slots')
      var preselectedCard = null

      studioObj.slots.forEach(function (slot) {
        if (!isOpen(slot)) return
        var key = slot.session_id
        var isPre = preselectTime && slot.time === formatTimeFromHHMM(preselectTime)
        var card = el('div', 'pb-slot' + (isPre ? ' pb-preselected' : ''))
        if (isPre) preselectedCard = card

        card.appendChild(el('span', 'pb-slot-time', slot.time))

        if (slot.kind === 'lineup') {
          card.appendChild(el('span', 'pb-lineup-tag', 'Lineup day'))
        }

        if (!qty[key]) qty[key] = 1
        card.appendChild(el('span', 'pb-qty-caption', 'How many people?'))
        card.appendChild(stepper(qty, key, 1, slot.spaces_left))

        if (slot.spaces_left !== null && slot.spaces_left <= 5) {
          card.appendChild(el('div', 'pb-spaces',
            slot.spaces_left + (slot.spaces_left === 1 ? ' space left' : ' spaces left')))
        }

        if (selectedDate >= ADDON_START_DATE) card.appendChild(extrasRow(key))

        var btn = el('button', 'pb-register', 'Register')
        btn.type = 'button'
        btn.addEventListener('click', function () { register(btn, slot, key, dateObj, studioObj) })
        card.appendChild(btn)
        grid.appendChild(card)
      })

      if (!grid.hasChildNodes()) {
        wrap.appendChild(el('div', 'pb-msg', 'All times for this date are full \u2014 please choose another date.'))
      } else {
        wrap.appendChild(grid)
      }
      root.appendChild(wrap)

      if (preselectedCard && !scrolledToPreselect) {
        scrolledToPreselect = true
        setTimeout(function () { preselectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 150)
      }
    }

    function register(btn, slot, key, dateObj, studioObj) {
      btn.disabled = true
      btn.textContent = 'Adding\u2026'

      var main = { id: parseInt(slot.variant_id, 10), quantity: qty[key] || 1 }
      // Lineup day: pre-fill the project choice, same property as workshop_embed.html
      if (slot.kind === 'lineup') main.properties = { 'Project': project.name }
      var items = [main]

      var addonProps = {
        'For booking': dateObj.label + ' ' + slot.time + ' \u2014 ' + studioObj.studio_name,
        '_studio_id': selectedStudio,
        '_event_date': selectedDate,
        '_event_time': slot.time
      }
      if (hotChoc[key]) items.push({ id: HOT_CHOC_VARIANT_ID, quantity: hotChoc[key], properties: addonProps })
      if (candyBag[key]) items.push({ id: CANDY_BAG_VARIANT_ID, quantity: candyBag[key], properties: addonProps })

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
    }
  }

  function start() {
    injectStyles()
    var roots = document.querySelectorAll('.project-booking')
    for (var i = 0; i < roots.length; i++) {
      if (roots[i].getAttribute('data-pb-started')) continue
      roots[i].setAttribute('data-pb-started', '1')
      Widget(roots[i])
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()

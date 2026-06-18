/**
 * studio-page.js
 * 4Cats Art Studio — Studio landing page dynamic content
 * https://4catsart.github.io/4cats-studio-app/studio-page.js
 *
 * window.SP_CONFIG must be set before this loads:
 *   studioId, studioName, supabaseUrl, supabaseAnon
 */

(function () {
  'use strict';

  var CFG        = window.SP_CONFIG || {};
  var STUDIO_ID  = CFG.studioId   || '';
  var STUDIO_NAME= CFG.studioName || '4Cats';
  var SB_URL     = CFG.supabaseUrl|| 'https://snxibhbhhchjthfmjtaj.supabase.co';
  var SB_ANON    = CFG.supabaseAnon|| '';

  var COLLECTION_HANDLE = 'today-at-the-studio';

  // ── STUDIO → SHOPIFY VARIANT TITLE MAP ─────────────────────────
  var STUDIO_VARIANT_MAP = {
    'BC-RICH-GC':  'BC / RICHMOND - GARDEN CITY',
    'BC-RICH-STV': 'BC / RICHMOND - STEVESTON',
    'BC-SUR-SSR':  'BC / SURREY - SOUTH',
    'BC-YVR-KIT':  'BC / VANCOUVER - KITSILANO',
    'BC-YVR-MS':   'BC / VANCOUVER - MAIN STREET',
    'BC-YVR-UBC':  'BC / VANCOUVER - UBC',
    'BC-YYJ-CSV':  'BC / VICTORIA - COOK STREET VILLAGE',
    'BC-YYJ-ESQ':  'BC / VICTORIA - ESQUIMALT',
    'BC-YYJ-OB':   'BC / VICTORIA - OAK BAY',
    'BC-YYJ-VIC':  'BC / VICTORIA - UPTOWN',
    'AB-YYC-ING':  'AB / CALGARY - INGLEWOOD',
    'AB-STA-STA':  'AB / ST ALBERT',
    'ON-BRL-BRL':  'ON / BURLINGTON - SOUTH',
    'ON-CMB-GLT':  'ON / CAMBRIDGE - GALT',
    'ON-ERN-ERN':  'ON / ERIN',
    'ON-HAM-OS':   'ON / HAMILTON - OTTAWA STREET',
    'ON-HAM-WD':   'ON / HAMILTON - WATERDOWN',
    'ON-HAM-WH':   'ON / HAMILTON - WEST HARBOUR',
    'ON-KGN-AP':   'ON / KINGSTON - ARLINGTON PARK',
    'ON-LDN-BYR':  'ON / LONDON - BYRON',
    'ON-LDN-WVG':  'ON / LONDON - WORTLEY VILLAGE',
    'ON-MIS-PC':   'ON / MISSISSAUGA - PORT CREDIT',
    'ON-OAK-OAK':  'ON / OAKVILLE - NORTH',
    'ON-OAK-WST':  'ON / OAKVILLE - WEST',
    'ON-YOW-GLB':  'ON / OTTAWA - THE GLEBE',
    'ON-STC-STC':  'ON / ST CATHARINES',
    'ON-YYZ-AVE':  'ON / TORONTO - AVENUE ROAD',
    'ON-YYZ-BP':   'ON / TORONTO - BABY POINT',
    'ON-YYZ-LEA':  'ON / TORONTO - LEASIDE',
    'ON-YYZ-BEA':  'ON / TORONTO - THE BEACHES',
    'ON-WTR-WTR':  'ON / WATERLOO - UPTOWN'
  };

  // Weekly (form-based) product types — studio is in the HTML form
  var WEEKLY_PRODUCT_TYPES = ['workshop', 'mini-make', 'glazing', 'lineup'];

  function findStudioVariant(variants) {
    if (!variants || !variants.length) return null;
    var target = STUDIO_VARIANT_MAP[STUDIO_ID] || '';
    if (!target) return variants[0];
    for (var i = 0; i < variants.length; i++) {
      if ((variants[i].title || '').toUpperCase() === target) return variants[i];
    }
    return variants[0];
  }

  // ── UTILITIES ───────────────────────────────────────────────────

  var SB_HEADERS = {
    'apikey': SB_ANON,
    'Authorization': 'Bearer ' + SB_ANON,
    'Content-Type': 'application/json'
  };

  function sbFetch(path) {
    return fetch(SB_URL + '/rest/v1/' + path, { headers: SB_HEADERS })
      .then(function(r) { return r.json(); });
  }

  function todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  // Get Monday of current week (YYYY-MM-DD)
  function mondayOfWeek() {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    var day = now.getDay(); // 0=Sun
    var diff = (day === 0) ? -6 : 1 - day;
    now.setDate(now.getDate() + diff);
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  // Get Sunday of current week (YYYY-MM-DD)
  function sundayOfWeek() {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    var day = now.getDay();
    var diff = day === 0 ? 0 : 7 - day;
    now.setDate(now.getDate() + diff);
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  }

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  }

  function fmtTime(str) {
    if (!str) return '';
    var parts = str.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return m === '00' ? h + ampm : h + ':' + m + ampm;
  }

  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Is product a weekly (form-based) type?
  function isWeeklyProduct(product) {
    var tags = (product.tags || '').toLowerCase();
    for (var i = 0; i < WEEKLY_PRODUCT_TYPES.length; i++) {
      if (tags.indexOf(WEEKLY_PRODUCT_TYPES[i]) > -1) return true;
    }
    // Also check product type field
    var type = (product.product_type || '').toLowerCase();
    for (var j = 0; j < WEEKLY_PRODUCT_TYPES.length; j++) {
      if (type.indexOf(WEEKLY_PRODUCT_TYPES[j]) > -1) return true;
    }
    return false;
  }

  // Build product link — weekly products get ?studio=ID, variant products get ?variant=ID
  function buildProductUrl(product) {
    var base = '/products/' + product.handle;
    if (isWeeklyProduct(product)) {
      return base + '?studio=' + encodeURIComponent(STUDIO_ID);
    }
    var v = findStudioVariant(product.variants);
    if (v && v.id) return base + '?variant=' + v.id;
    return base + '?studio=' + encodeURIComponent(STUDIO_ID);
  }

  // Get availability for a product at this studio
  function getAvailability(product) {
    if (isWeeklyProduct(product)) {
      // Can't know exact availability for form-based products — just show as available
      return { available: true, spaces: null, isFull: false, isLow: false };
    }
    var v = findStudioVariant(product.variants);
    if (!v) return { available: false, spaces: 0, isFull: true, isLow: false };
    var qty = v.inventory_quantity;
    return {
      available: qty === null || qty > 0,
      spaces: qty,
      isFull: qty !== null && qty <= 0,
      isLow: qty !== null && qty > 0 && qty <= 4
    };
  }

  // ── FETCH COLLECTION PRODUCTS ───────────────────────────────────

  function fetchCollectionProducts(callback) {
    // Fetch up to 250 products from the collection
    fetch('/collections/' + COLLECTION_HANDLE + '/products.json?limit=250')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        callback(null, data.products || []);
      })
      .catch(function(e) { callback(e, []); });
  }

  // ── 1. TODAY'S SLIDER ───────────────────────────────────────────

  function loadToday() {
    var track = document.getElementById('sp-today-track');
    if (!track || !STUDIO_ID) return;

    var today    = todayStr();
    var monday   = mondayOfWeek();
    var sunday   = sundayOfWeek();

    fetchCollectionProducts(function(err, products) {
      if (err || !products.length) {
        track.innerHTML = '<div class="sp-empty" style="min-width:280px">No sessions today — <a href="#" id="sp-schedule-link" style="color:var(--color-accent-main);font-weight:600">see the full schedule</a></div>';
        return;
      }

      // Filter to today's products
      var todayProducts = products.filter(function(p) {
        var eventDate = getMetafield(p, 'custom.event_date');
        if (!eventDate) return false;
        // Weekly products: show if event_date (Monday) is the current week's Monday
        if (isWeeklyProduct(p)) {
          return eventDate === monday;
        }
        // All others: show only if event_date = today exactly
        return eventDate === today;
      });

      // Filter out Friday Night Specials (they go in the right panel)
      todayProducts = todayProducts.filter(function(p) {
        var tags = (p.tags || '').toLowerCase();
        return tags.indexOf('friday-night-special') === -1;
      });

      if (!todayProducts.length) {
        track.innerHTML = '<div class="sp-empty" style="min-width:280px">Nothing scheduled for today — <a href="#" id="sp-schedule-link" style="color:var(--color-accent-main);font-weight:600">see the full schedule</a></div>';
        return;
      }

      var html = '';
      todayProducts.forEach(function(p) {
        var img     = (p.images && p.images[0]) ? p.images[0].src : '';
        var title   = p.title || '';
        var price   = p.variants && p.variants[0] ? '$' + parseFloat(p.variants[0].price).toFixed(0) : '';
        var url     = buildProductUrl(p);
        var avail   = getAvailability(p);

        var spotsHtml = '';
        if (avail.isFull) {
          spotsHtml = '<div class="sp-session-card__spots" style="color:#c0391e">Sold out</div>';
        } else if (avail.isLow) {
          spotsHtml = '<div class="sp-session-card__spots" style="color:#c0391e">Only ' + avail.spaces + ' spots left!</div>';
        } else if (avail.spaces !== null) {
          spotsHtml = '<div class="sp-session-card__spots">' + avail.spaces + ' spots left</div>';
        }

        var bookHtml = avail.isFull
          ? '<div class="sp-session-card__book" style="opacity:.5;cursor:default">Sold Out</div>'
          : '<a href="' + esc(url) + '" class="sp-session-card__book">Book now →</a>';

        html +=
          '<div class="sp-session-card">' +
            '<div class="sp-session-card__thumb">' +
              (img ? '<img src="' + esc(img) + '" alt="' + esc(title) + '" loading="lazy">' : '') +
            '</div>' +
            '<div class="sp-session-card__body">' +
              '<div class="sp-session-card__title">' + esc(title) + '</div>' +
              (price ? '<div class="sp-session-card__price">' + esc(price) + '</div>' : '') +
              spotsHtml +
            '</div>' +
            bookHtml +
          '</div>';
      });

      track.innerHTML = html;
    });
  }

  // Helper: get product metafield value from .js endpoint metafields object
  function getMetafield(product, key) {
    if (!product.metafields) return null;
    // Shopify /products.json doesn't return metafields — use tags as fallback
    // The event_date is stored as a tag: event-date:2026-06-18
    var tags = (product.tags || '');
    var tagList = tags.split(',');
    var prefix = key.replace('custom.', '') + ':';
    for (var i = 0; i < tagList.length; i++) {
      var t = tagList[i].trim();
      if (t.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
        return t.substring(prefix.length).trim();
      }
    }
    return null;
  }

  // ── NOTE ON event_date ──────────────────────────────────────────
  // /collections/.../products.json does NOT return metafields.
  // Two options:
  //   A) Tag products with event-date:YYYY-MM-DD (getMetafield reads this)
  //   B) Use Shopify Storefront API with a token (reads metafields natively)
  // We use option A — tag-based — as it requires no API token.
  // For weekly products, tag with event-date:YYYY-MM-DD (the Monday).
  // For parties/one-off, tag with event-date:YYYY-MM-DD (the actual date).
  // Shopify Flow can auto-add/remove these tags based on custom.event_date metafield.
  // ────────────────────────────────────────────────────────────────

  // ── 2. FRIDAY NIGHT SPECIAL PANEL ──────────────────────────────

  function loadFridayNightSpecial() {
    var panel = document.getElementById('sp-friday-panel');
    if (!panel || !STUDIO_ID) return;

    var today = todayStr();

    fetchCollectionProducts(function(err, products) {
      if (err || !products.length) { panel.style.display = 'none'; return; }

      // Filter to friday-night-special tagged products with upcoming date
      var fridayProducts = products.filter(function(p) {
        var tags = (p.tags || '').toLowerCase();
        if (tags.indexOf('friday-night-special') === -1) return false;
        var eventDate = getMetafield(p, 'custom.event_date') || getMetafield(p, 'event-date');
        return eventDate && eventDate >= today;
      });

      if (!fridayProducts.length) { panel.style.display = 'none'; return; }

      // Sort by event date ascending — pick nearest upcoming
      fridayProducts.sort(function(a, b) {
        var da = getMetafield(a, 'custom.event_date') || getMetafield(a, 'event-date') || '';
        var db = getMetafield(b, 'custom.event_date') || getMetafield(b, 'event-date') || '';
        return da.localeCompare(db);
      });

      var product = fridayProducts[0];
      renderFridayPanel(panel, product);
    });
  }

  function renderFridayPanel(panel, product) {
    var v       = findStudioVariant(product.variants) || {};
    var url     = '/products/' + product.handle + (v.id ? '?variant=' + v.id : '');
    var qty     = v.inventory_quantity;
    var isFull  = qty !== null && qty <= 0;

    // Get friday_image metafield via tag: friday-image:URL
    // (set via Shopify Flow or manually — the image URL as a tag value)
    // Fallback to first product image
    var fridayImg = getMetafield(product, 'friday-image');
    var fallbackImg = (product.images && product.images[0]) ? product.images[0].src : '';
    var imgSrc = fridayImg || fallbackImg;

    // Get event date for display
    var eventDate = getMetafield(product, 'custom.event_date') || getMetafield(product, 'event-date');
    var dateDisplay = eventDate ? fmtDate(eventDate) : '';

    panel.innerHTML =
      '<div class="sp-friday">' +
        (imgSrc
          ? '<div class="sp-friday__img"><img src="' + esc(imgSrc) + '" alt="' + esc(product.title) + '" loading="lazy"></div>'
          : '<div class="sp-friday__img sp-friday__img--empty"></div>') +
        '<div class="sp-friday__footer">' +
          (dateDisplay ? '<div class="sp-friday__date">' + esc(dateDisplay) + '</div>' : '') +
          (isFull
            ? '<div class="sp-friday__btn sp-friday__btn--sold">Sold Out</div>'
            : '<a href="' + esc(url) + '" class="sp-friday__btn">BOOK FRIDAY NIGHT →</a>') +
        '</div>' +
      '</div>';
  }

  // ── 3. THIS WEEK'S PROJECTS ─────────────────────────────────────

  function loadProjects() {
    var grid = document.getElementById('sp-projects-grid');
    if (!grid || !STUDIO_ID) return;

    var todayS   = todayStr();
    var weekEnd  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    weekEnd.setDate(weekEnd.getDate() + 6);
    var weekEndStr = weekEnd.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

    var query = 'sessions?select=id,title,shopify_product_handle' +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&session_date=gte.' + encodeURIComponent(todayS) +
      '&session_date=lte.' + encodeURIComponent(weekEndStr) +
      '&order=session_date.asc&limit=50';

    sbFetch(query).then(function(sessions) {
      if (!sessions || !sessions.length) {
        grid.innerHTML = '<div class="sp-empty">Check back soon for this week\'s projects!</div>';
        return;
      }

      var seen = {}, handles = [];
      sessions.forEach(function(s) {
        var h = s.shopify_product_handle;
        if (h && !seen[h]) { seen[h] = true; handles.push({ handle: h, title: s.title }); }
      });

      if (!handles.length) { renderProjectsFromTitles(grid, sessions); return; }

      var fetches = handles.slice(0, 8).map(function(item) {
        return fetch('/products/' + item.handle + '.js')
          .then(function(r) { return r.json(); })
          .then(function(p) {
            return {
              title:  p.title || item.title,
              handle: p.handle || item.handle,
              image:  (p.images && p.images[0]) ? p.images[0].src : null,
              url:    '/products/' + (p.handle || item.handle)
            };
          })
          .catch(function() { return { title: item.title, handle: item.handle, image: null, url: '#' }; });
      });

      Promise.all(fetches).then(function(products) {
        var html = '';
        products.forEach(function(p) {
          var name = p.title;
          if (name.indexOf('|') > -1) name = name.split('|').slice(1).join('|').trim();
          html +=
            '<a href="' + esc(p.url) + '" class="sp-project-card">' +
              '<div class="sp-project-card__thumb">' +
                (p.image
                  ? '<img src="' + esc(p.image) + '" alt="' + esc(name) + '" loading="lazy">'
                  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px">🎨</div>') +
              '</div>' +
              '<div class="sp-project-card__name">' + esc(name) + '</div>' +
            '</a>';
        });
        grid.innerHTML = html || '<div class="sp-empty">Check back soon for this week\'s projects!</div>';
      });
    }).catch(function() {
      grid.innerHTML = '<div class="sp-empty">Couldn\'t load projects right now.</div>';
    });
  }

  function renderProjectsFromTitles(grid, sessions) {
    var seen = {}, html = '';
    sessions.forEach(function(s) {
      var name = s.title;
      if (name.indexOf('|') > -1) name = name.split('|').slice(1).join('|').trim();
      if (!seen[name]) {
        seen[name] = true;
        html += '<div class="sp-project-card"><div class="sp-project-card__thumb" style="display:flex;align-items:center;justify-content:center;font-size:32px">🎨</div><div class="sp-project-card__name">' + esc(name) + '</div></div>';
      }
    });
    grid.innerHTML = html || '<div class="sp-empty">Check back soon!</div>';
  }

  // ── 4. UPCOMING WEEKS ───────────────────────────────────────────

  function loadUpcomingWeeks() {
    var grid = document.getElementById('sp-weeks-grid');
    if (!grid) return;

    var todayS = todayStr();
    var query = 'curriculum_weeks?select=id,week_start,week_end,theme,curriculum_url' +
      '&week_end=gte.' + encodeURIComponent(todayS) +
      '&theme=not.is.null&order=week_start.asc&limit=6';

    sbFetch(query).then(function(weeks) {
      if (!weeks || !weeks.length) {
        grid.innerHTML = '<div class="sp-week-card"><div class="sp-week-card__theme" style="color:rgba(255,255,255,.5)">Themes coming soon…</div></div>';
        return;
      }

      var todayDt = new Date(todayS);
      var html = '';
      weeks.forEach(function(w) {
        var startDt = w.week_start ? new Date(w.week_start + 'T12:00:00') : null;
        var endDt   = w.week_end   ? new Date(w.week_end   + 'T12:00:00') : null;
        var isCurrent = startDt && endDt && todayDt >= startDt && todayDt <= endDt;

        var themeFull = w.theme || '';
        var themeDisplay = themeFull.indexOf('·') > -1
          ? themeFull.split('·').slice(1).join('·').trim()
          : themeFull;

        var datesStr = (w.week_start && w.week_end)
          ? fmtDate(w.week_start) + ' – ' + fmtDate(w.week_end)
          : '';

        var tags = themeDisplay.replace(' Week','').replace(' Collection','').split(' ');
        var tagHtml = '';
        tags.slice(0,3).forEach(function(t) {
          if (t.length > 2) tagHtml += '<span class="sp-week-card__tag">' + esc(t) + '</span>';
        });

        var linkOpen  = w.curriculum_url ? '<a href="' + esc(w.curriculum_url) + '" target="_blank" rel="noopener">' : '<div>';
        var linkClose = w.curriculum_url ? '</a>' : '</div>';

        html += linkOpen +
          '<div class="sp-week-card' + (isCurrent ? ' sp-week-card--current' : '') + '">' +
            (isCurrent ? '<span class="sp-week-card__badge">This week</span>' : '') +
            (datesStr ? '<div class="sp-week-card__dates">' + esc(datesStr) + '</div>' : '') +
            '<div class="sp-week-card__theme">' + esc(themeDisplay) + '</div>' +
            (tagHtml ? '<div class="sp-week-card__tags">' + tagHtml + '</div>' : '') +
          '</div>' +
        linkClose;
      });

      grid.innerHTML = html;
    }).catch(function() {
      grid.innerHTML = '<div class="sp-week-card"><div class="sp-week-card__theme" style="color:rgba(255,255,255,.5)">Couldn\'t load weeks right now.</div></div>';
    });
  }

  // ── 5. REVIEWS ──────────────────────────────────────────────────

  function loadReviews() {
    var grid = document.getElementById('sp-reviews-grid');
    if (!grid || !STUDIO_ID) return;

    var query = 'party_reviews?select=id,rating,review_text,reviewer_name,session_title,created_at' +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&rating=gte.4&review_text=not.is.null&order=created_at.desc&limit=6';

    sbFetch(query).then(function(reviews) {
      if (!reviews || !reviews.length) { grid.innerHTML = '<div class="sp-empty">Reviews coming soon!</div>'; return; }

      var html = '';
      reviews.forEach(function(r) {
        html +=
          '<div class="sp-review-card">' +
            '<div class="sp-review-card__stars">' + stars(r.rating || 5) + '</div>' +
            '<div class="sp-review-card__text">"' + esc(r.review_text) + '"</div>' +
            '<div class="sp-review-card__author">' + esc(r.reviewer_name || 'Happy guest') + '</div>' +
            (r.session_title ? '<div class="sp-review-card__event">' + esc(r.session_title) + '</div>' : '') +
          '</div>';
      });
      grid.innerHTML = html;
    }).catch(function() {
      grid.innerHTML = '<div class="sp-empty">Couldn\'t load reviews right now.</div>';
    });
  }

  // ── 6. STUDIO PREFERENCE WIDGET ─────────────────────────────────

  var STUDIO_LIST = [
    { id: 'BC-RICH-GC',  name: 'Richmond – Garden City' },
    { id: 'BC-RICH-STV', name: 'Richmond – Steveston' },
    { id: 'BC-SUR-SSR',  name: 'Surrey – South' },
    { id: 'BC-YVR-KIT',  name: 'Vancouver – Kitsilano' },
    { id: 'BC-YVR-MS',   name: 'Vancouver – Main Street' },
    { id: 'BC-YVR-UBC',  name: 'Vancouver – UBC' },
    { id: 'BC-YYJ-CSV',  name: 'Victoria – Cook Street Village' },
    { id: 'BC-YYJ-ESQ',  name: 'Victoria – Esquimalt' },
    { id: 'BC-YYJ-OB',   name: 'Victoria – Oak Bay' },
    { id: 'BC-YYJ-VIC',  name: 'Victoria – Uptown' },
    { id: 'AB-YYC-ING',  name: 'Calgary – Inglewood' },
    { id: 'AB-STA-STA',  name: 'St Albert' },
    { id: 'ON-BRL-BRL',  name: 'Burlington – South' },
    { id: 'ON-CMB-GLT',  name: 'Cambridge – Galt' },
    { id: 'ON-ERN-ERN',  name: 'Erin' },
    { id: 'ON-HAM-OS',   name: 'Hamilton – Ottawa Street' },
    { id: 'ON-HAM-WD',   name: 'Hamilton – Waterdown' },
    { id: 'ON-HAM-WH',   name: 'Hamilton – West Harbour' },
    { id: 'ON-KGN-AP',   name: 'Kingston – Arlington Park' },
    { id: 'ON-LDN-BYR',  name: 'London – Byron' },
    { id: 'ON-LDN-WVG',  name: 'London – Wortley Village' },
    { id: 'ON-MIS-PC',   name: 'Mississauga – Port Credit' },
    { id: 'ON-OAK-OAK',  name: 'Oakville – North' },
    { id: 'ON-OAK-WST',  name: 'Oakville – West' },
    { id: 'ON-YOW-GLB',  name: 'Ottawa – The Glebe' },
    { id: 'ON-STC-STC',  name: 'St Catharines' },
    { id: 'ON-YYZ-AVE',  name: 'Toronto – Avenue Road' },
    { id: 'ON-YYZ-BP',   name: 'Toronto – Baby Point' },
    { id: 'ON-YYZ-LEA',  name: 'Toronto – Leaside' },
    { id: 'ON-YYZ-BEA',  name: 'Toronto – The Beaches' },
    { id: 'ON-WTR-WTR',  name: 'Waterloo – Uptown' }
  ];

  var PREF_KEY = '4cats_preferred_studio';
  function getPref() { try { return localStorage.getItem(PREF_KEY) || getCookie(PREF_KEY); } catch(e) { return getCookie(PREF_KEY); } }
  function setPref(id) { try { localStorage.setItem(PREF_KEY, id); } catch(e) {} setCookie(PREF_KEY, id, 365); }
  function getCookie(n) { var m = document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)'); return m ? m[2] : ''; }
  function setCookie(n, v, d) { var e = new Date(); e.setDate(e.getDate() + d); document.cookie = n + '=' + v + ';path=/;expires=' + e.toUTCString() + ';SameSite=Lax'; }

  function initPrefWidget() {
    var list  = document.getElementById('sp-pref-list');
    var label = document.getElementById('sp-pref-label');
    if (!list) return;
    var current = getPref() || STUDIO_ID;
    if (STUDIO_ID && !getPref()) setPref(STUDIO_ID);
    var found = STUDIO_LIST.filter(function(s) { return s.id === current; })[0];
    if (found && label) label.textContent = found.name;
    var html = '';
    STUDIO_LIST.forEach(function(s) {
      html += '<div class="sp-pref-popup__item' + (s.id === current ? ' active' : '') + '" onclick="spSetStudio(\'' + s.id + '\')">' +
        '<div class="sp-pref-popup__dot"></div>' + esc(s.name) + '</div>';
    });
    list.innerHTML = html;
  }

  window.spPrefToggle = function() {
    var p = document.getElementById('sp-pref-popup');
    if (p) p.classList.toggle('open');
  };
  window.spSetStudio = function(id) {
    setPref(id);
    var found = STUDIO_LIST.filter(function(s) { return s.id === id; })[0];
    var label = document.getElementById('sp-pref-label');
    if (found && label) label.textContent = found.name;
    var items = document.querySelectorAll('.sp-pref-popup__item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].textContent.trim() === (found ? found.name : ''));
    }
    var p = document.getElementById('sp-pref-popup');
    if (p) p.classList.remove('open');
  };
  document.addEventListener('click', function(e) {
    var w = document.getElementById('sp-studio-pref');
    var p = document.getElementById('sp-pref-popup');
    if (p && w && !w.contains(e.target)) p.classList.remove('open');
  });

  // ── INIT ────────────────────────────────────────────────────────

  function init() {
    loadToday();
    loadFridayNightSpecial();
    loadProjects();
    loadUpcomingWeeks();
    loadReviews();
    initPrefWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

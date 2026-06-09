/**
 * studio-page.js
 * 4Cats Art Studio — Studio landing page dynamic content
 * Hosted at: 4catsart.github.io/4cats-studio-app/studio-page.js
 *
 * Requires window.SP_CONFIG to be set before this script loads:
 *   studioId, studioName, featuredHandle, supabaseUrl, supabaseAnon
 *
 * Sections driven:
 *   1. Today's sessions carousel  (#sp-today-track)
 *   2. Featured event panel       (#sp-highlight-panel)
 *   3. This week's projects       (#sp-projects-grid)
 *   4. Upcoming weeks             (#sp-weeks-grid)
 *   5. Reviews                    (#sp-reviews-grid)
 *   6. Studio preference widget   (#sp-studio-pref)
 */

(function () {
  'use strict';

  var CFG = window.SP_CONFIG || {};
  var STUDIO_ID    = CFG.studioId    || '';
  var STUDIO_NAME  = CFG.studioName  || '4Cats';
  var FEAT_HANDLE  = CFG.featuredHandle || '';
  var SB_URL       = CFG.supabaseUrl || 'https://snxibhbhhchjthfmjtaj.supabase.co';
  var SB_ANON      = CFG.supabaseAnon || '';

  var SB_HEADERS   = {
    'apikey':        SB_ANON,
    'Authorization': 'Bearer ' + SB_ANON,
    'Content-Type':  'application/json'
  };

  // ── UTILITIES ──────────────────────────────────────────────────

  function sbFetch(path) {
    return fetch(SB_URL + '/rest/v1/' + path, { headers: SB_HEADERS })
      .then(function (r) { return r.json(); });
  }

  function today() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); // YYYY-MM-DD
  }

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtTime(str) {
    // str = "14:00:00"
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
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 1. TODAY'S SESSIONS ────────────────────────────────────────

  function loadToday() {
    var todayStr = today();
    var track = document.getElementById('sp-today-track');
    if (!track || !STUDIO_ID) return;

    // Query sessions for today at this studio that have spaces or registrations
    var query = 'sessions?select=id,title,session_date,start_time,price,spaces_left_cache,session_type' +
      '&session_date=eq.' + encodeURIComponent(todayStr) +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&order=start_time.asc' +
      '&limit=20';

    sbFetch(query).then(function (sessions) {
      if (!sessions || !sessions.length) {
        track.innerHTML = '<div class="sp-empty" style="min-width:100%">No sessions scheduled for today — <a href="/pages/schedule" style="color:var(--rust);font-weight:600">see the full schedule</a></div>';
        return;
      }

      // For each session, look up the shopify_variants to get a booking URL
      var sessionIds = sessions.map(function (s) { return s.id; });
      var varQuery = 'shopify_variants?select=session_id,variant_id,register_url' +
        '&session_id=in.(' + sessionIds.join(',') + ')' +
        '&studio_id=eq.' + encodeURIComponent(STUDIO_ID);

      sbFetch(varQuery).then(function (variants) {
        var varMap = {};
        if (variants && variants.length) {
          variants.forEach(function (v) { varMap[v.session_id] = v; });
        }

        var html = '';
        sessions.forEach(function (s) {
          var v        = varMap[s.id] || {};
          var bookUrl  = v.register_url || ('#');
          var spaces   = s.spaces_left_cache;
          var isFull   = spaces !== null && spaces <= 0;
          var isLow    = spaces !== null && spaces > 0 && spaces <= 4;

          var spotsHtml = '';
          if (isFull) {
            spotsHtml = '<div class="sp-session-card__spots sp-session-card__spots--low">Sold out</div>';
          } else if (isLow) {
            spotsHtml = '<div class="sp-session-card__spots sp-session-card__spots--low">Only ' + spaces + ' spots left!</div>';
          } else if (spaces !== null) {
            spotsHtml = '<div class="sp-session-card__spots">' + spaces + ' spots left</div>';
          }

          var bookHtml = isFull
            ? '<div class="sp-session-card__book" style="background:var(--text-soft);cursor:default">Sold Out</div>'
            : '<a href="' + esc(bookUrl) + '" class="sp-session-card__book">Book now →</a>';

          html += '<div class="sp-session-card">' +
            '<div class="sp-session-card__thumb">' +
              '<span class="sp-session-card__time">' + fmtTime(s.start_time) + '</span>' +
            '</div>' +
            '<div class="sp-session-card__body">' +
              '<div class="sp-session-card__title">' + esc(s.title) + '</div>' +
              '<div class="sp-session-card__meta">' + esc(s.session_type || 'Workshop') + '</div>' +
              (s.price ? '<div class="sp-session-card__price">$' + s.price + '</div>' : '') +
              spotsHtml +
            '</div>' +
            bookHtml +
          '</div>';
        });

        track.innerHTML = html;
      });
    }).catch(function () {
      track.innerHTML = '<div class="sp-empty" style="min-width:100%">Couldn\'t load today\'s sessions — <a href="/pages/schedule" style="color:var(--rust);font-weight:600">see the full schedule</a></div>';
    });
  }

  // ── 2. FEATURED EVENT PANEL ────────────────────────────────────

  function loadFeaturedEvent() {
    var panel = document.getElementById('sp-highlight-panel');
    if (!panel) return;

    if (!FEAT_HANDLE) {
      // Auto-pick: next upcoming evening session (after 5pm) at this studio
      autoPickFeatured(panel);
      return;
    }

    // Fetch product from Shopify Storefront API
    fetch('/products/' + FEAT_HANDLE + '.js')
      .then(function (r) { return r.json(); })
      .then(function (product) {
        renderHighlight(panel, product);
      })
      .catch(function () {
        autoPickFeatured(panel);
      });
  }

  function autoPickFeatured(panel) {
    // Find the next session after 5pm at this studio
    var todayStr = today();
    var query = 'sessions?select=id,title,session_date,start_time,price,spaces_left_cache,session_type' +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&session_date=gte.' + encodeURIComponent(todayStr) +
      '&start_time=gte.17%3A00%3A00' +
      '&order=session_date.asc,start_time.asc' +
      '&limit=1';

    sbFetch(query).then(function (sessions) {
      if (!sessions || !sessions.length) {
        panel.innerHTML = '';
        return;
      }
      renderHighlightFromSession(panel, sessions[0]);
    }).catch(function () {
      panel.innerHTML = '';
    });
  }

  function renderHighlight(panel, product) {
    var img    = (product.images && product.images[0]) ? product.images[0].src : '';
    var title  = product.title || '';
    // Parse time/date from product title format: "7pm Fri May 30th | Event Title"
    var parts  = title.split('|');
    var timeDate = parts[0] ? parts[0].trim() : '';
    var evtTitle = parts[1] ? parts[1].trim() : title;

    var v      = (product.variants && product.variants[0]) || {};
    var price  = v.price ? '$' + parseFloat(v.price).toFixed(0) : '';
    var qty    = v.inventory_quantity;
    var isFull = qty !== null && qty <= 0;
    var isLow  = qty !== null && qty > 0 && qty <= 4;

    var spotsHtml = '';
    if (isFull) {
      spotsHtml = '<div class="sp-highlight__spots" style="color:#e07070">⚬ Sold out</div>';
    } else if (isLow) {
      spotsHtml = '<div class="sp-highlight__spots">⚬ Only ' + qty + ' spots left</div>';
    } else if (qty !== null) {
      spotsHtml = '<div class="sp-highlight__spots">⚬ ' + qty + ' spots available</div>';
    }

    var bookUrl = '/products/' + product.handle + '?variant=' + v.id;

    panel.innerHTML =
      '<div class="sp-highlight">' +
        (img ? '<div class="sp-highlight__thumb"><img src="' + esc(img) + '" alt="' + esc(evtTitle) + '" loading="lazy"></div>' : '') +
        '<div class="sp-highlight__body">' +
          '<div class="sp-highlight__eyebrow">✦ Featured event</div>' +
          '<div class="sp-highlight__title">' + esc(evtTitle) + '</div>' +
          (timeDate ? '<div class="sp-highlight__date">' + esc(timeDate) + (price ? ' · ' + price : '') + '</div>' : '') +
          (product.body_html ? '<div class="sp-highlight__desc">' + product.body_html.replace(/<[^>]+>/g, '').substring(0, 120) + '…</div>' : '') +
          spotsHtml +
          (isFull
            ? '<div class="sp-highlight__book" style="background:var(--text-soft);cursor:default">Sold Out</div>'
            : '<a href="' + esc(bookUrl) + '" class="sp-highlight__book">Book this event →</a>') +
        '</div>' +
      '</div>';
  }

  function renderHighlightFromSession(panel, s) {
    var spotsHtml = '';
    var spaces = s.spaces_left_cache;
    if (spaces !== null && spaces <= 0) {
      spotsHtml = '<div class="sp-highlight__spots" style="color:#e07070">⚬ Sold out</div>';
    } else if (spaces !== null && spaces <= 4) {
      spotsHtml = '<div class="sp-highlight__spots">⚬ Only ' + spaces + ' spots left</div>';
    } else if (spaces !== null) {
      spotsHtml = '<div class="sp-highlight__spots">⚬ ' + spaces + ' spots available</div>';
    }

    var dateStr = fmtDate(s.session_date) + ' · ' + fmtTime(s.start_time);
    var isFull = spaces !== null && spaces <= 0;

    panel.innerHTML =
      '<div class="sp-highlight">' +
        '<div class="sp-highlight__body" style="padding-top:28px">' +
          '<div class="sp-highlight__eyebrow">✦ Coming up</div>' +
          '<div class="sp-highlight__title">' + esc(s.title) + '</div>' +
          '<div class="sp-highlight__date">' + esc(dateStr) + (s.price ? ' · $' + s.price : '') + '</div>' +
          spotsHtml +
          (isFull
            ? '<div class="sp-highlight__book" style="background:var(--text-soft);cursor:default">Sold Out</div>'
            : '<a href="/pages/schedule?studio=' + esc(STUDIO_ID) + '" class="sp-highlight__book">View &amp; book →</a>') +
        '</div>' +
      '</div>';
  }

  // ── 3. THIS WEEK'S PROJECTS ────────────────────────────────────

  function loadProjects() {
    var grid = document.getElementById('sp-projects-grid');
    if (!grid || !STUDIO_ID) return;

    var todayStr = today();

    // Find products active this week for this studio via shopify_variants
    // We look for sessions this week and get their linked Shopify products
    var weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 6);
    var weekEndStr = weekEnd.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

    var query = 'sessions?select=id,title,shopify_product_handle' +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&session_date=gte.' + encodeURIComponent(todayStr) +
      '&session_date=lte.' + encodeURIComponent(weekEndStr) +
      '&order=session_date.asc' +
      '&limit=50';

    sbFetch(query).then(function (sessions) {
      if (!sessions || !sessions.length) {
        grid.innerHTML = '<div class="sp-empty">Check back soon for this week\'s projects!</div>';
        return;
      }

      // Deduplicate by shopify_product_handle
      var seen = {};
      var handles = [];
      sessions.forEach(function (s) {
        var h = s.shopify_product_handle;
        if (h && !seen[h]) {
          seen[h] = true;
          handles.push({ handle: h, title: s.title });
        }
      });

      if (!handles.length) {
        renderProjectsFromTitles(grid, sessions);
        return;
      }

      // Fetch product metafields (custom.project) for each handle
      var fetches = handles.slice(0, 8).map(function (item) {
        return fetch('/products/' + item.handle + '.js')
          .then(function (r) { return r.json(); })
          .then(function (p) {
            return {
              title:    p.title || item.title,
              handle:   p.handle || item.handle,
              image:    (p.images && p.images[0]) ? p.images[0].src : null,
              project:  (p.metafields && p.metafields['custom.project']) || null,
              url:      '/products/' + (p.handle || item.handle)
            };
          })
          .catch(function () {
            return { title: item.title, handle: item.handle, image: null, url: '#' };
          });
      });

      Promise.all(fetches).then(function (products) {
        var html = '';
        products.forEach(function (p) {
          var name = p.project || p.title;
          // Strip the time/date prefix from session titles (e.g. "3pm Sun May 10th | Project Name")
          if (name.indexOf('|') > -1) {
            name = name.split('|').slice(1).join('|').trim();
          }
          html +=
            '<a href="' + esc(p.url) + '" class="sp-project-card">' +
              '<div class="sp-project-card__thumb">' +
                (p.image
                  ? '<img src="' + esc(p.image) + '" alt="' + esc(name) + '" loading="lazy">'
                  : '<div style="width:100%;height:100%;background:var(--mist);display:flex;align-items:center;justify-content:center;font-size:28px">🎨</div>') +
              '</div>' +
              '<div class="sp-project-card__name">' + esc(name) + '</div>' +
            '</a>';
        });
        grid.innerHTML = html || '<div class="sp-empty">Check back soon for this week\'s projects!</div>';
      });

    }).catch(function () {
      grid.innerHTML = '<div class="sp-empty">Couldn\'t load projects right now.</div>';
    });
  }

  function renderProjectsFromTitles(grid, sessions) {
    var seen = {};
    var html = '';
    sessions.forEach(function (s) {
      var name = s.title;
      if (name.indexOf('|') > -1) name = name.split('|').slice(1).join('|').trim();
      if (!seen[name]) {
        seen[name] = true;
        html +=
          '<div class="sp-project-card">' +
            '<div class="sp-project-card__thumb" style="background:var(--mist);display:flex;align-items:center;justify-content:center;font-size:32px">🎨</div>' +
            '<div class="sp-project-card__name">' + esc(name) + '</div>' +
          '</div>';
      }
    });
    grid.innerHTML = html || '<div class="sp-empty">Check back soon!</div>';
  }

  // ── 4. UPCOMING WEEKS ──────────────────────────────────────────

  function loadUpcomingWeeks() {
    var grid = document.getElementById('sp-weeks-grid');
    if (!grid) return;

    var todayStr = today();
    // Next 6 weeks with a theme
    var query = 'curriculum_weeks?select=id,week_start,week_end,theme,curriculum_url' +
      '&week_end=gte.' + encodeURIComponent(todayStr) +
      '&theme=not.is.null' +
      '&order=week_start.asc' +
      '&limit=6';

    sbFetch(query).then(function (weeks) {
      if (!weeks || !weeks.length) {
        grid.innerHTML = '<div class="sp-week-card"><div class="sp-week-card__theme" style="color:rgba(255,255,255,.5)">Themes coming soon…</div></div>';
        return;
      }

      var todayDt = new Date(todayStr);
      var html = '';
      weeks.forEach(function (w) {
        // Is this the current week?
        var startDt = w.week_start ? new Date(w.week_start + 'T12:00:00') : null;
        var endDt   = w.week_end   ? new Date(w.week_end   + 'T12:00:00') : null;
        var isCurrent = startDt && endDt && todayDt >= startDt && todayDt <= endDt;

        // Parse theme: "Week 22 · Whimsy Week" → display just the friendly name
        var themeFull = w.theme || '';
        var themeDisplay = themeFull.indexOf('·') > -1
          ? themeFull.split('·').slice(1).join('·').trim()
          : themeFull;

        var datesStr = '';
        if (w.week_start && w.week_end) {
          datesStr = fmtDate(w.week_start) + ' – ' + fmtDate(w.week_end);
        }

        // Generate tag words from theme name
        var tags = themeDisplay.replace(' Week', '').replace(' Collection', '').split(' ');
        var tagHtml = '';
        tags.slice(0, 3).forEach(function (t) {
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
    }).catch(function () {
      grid.innerHTML = '<div class="sp-week-card"><div class="sp-week-card__theme" style="color:rgba(255,255,255,.5)">Couldn\'t load weeks right now.</div></div>';
    });
  }

  // ── 5. REVIEWS ─────────────────────────────────────────────────

  function loadReviews() {
    var grid = document.getElementById('sp-reviews-grid');
    if (!grid || !STUDIO_ID) return;

    var query = 'party_reviews?select=id,rating,review_text,reviewer_name,session_title,created_at' +
      '&studio_id=eq.' + encodeURIComponent(STUDIO_ID) +
      '&rating=gte.4' +
      '&review_text=not.is.null' +
      '&order=created_at.desc' +
      '&limit=6';

    sbFetch(query).then(function (reviews) {
      if (!reviews || !reviews.length) {
        grid.innerHTML = '<div class="sp-empty">Reviews coming soon!</div>';
        return;
      }

      var html = '';
      reviews.forEach(function (r) {
        html +=
          '<div class="sp-review-card">' +
            '<div class="sp-review-card__stars">' + stars(r.rating || 5) + '</div>' +
            '<div class="sp-review-card__text">"' + esc(r.review_text) + '"</div>' +
            '<div class="sp-review-card__author">' + esc(r.reviewer_name || 'Happy guest') + '</div>' +
            (r.session_title ? '<div class="sp-review-card__event">' + esc(r.session_title) + '</div>' : '') +
          '</div>';
      });

      grid.innerHTML = html;

      // Update Google badge with avg rating if we have data
      var avg = reviews.reduce(function (sum, r) { return sum + (r.rating || 5); }, 0) / reviews.length;
      var scoreEl = document.getElementById('sp-gmaps-score');
      var starsEl = document.getElementById('sp-gmaps-stars');
      if (scoreEl) scoreEl.textContent = avg.toFixed(1) + ' (' + reviews.length + '+ reviews)';
      if (starsEl) starsEl.textContent = '★★★★' + (avg >= 4.5 ? '★' : '☆');

    }).catch(function () {
      grid.innerHTML = '<div class="sp-empty">Couldn\'t load reviews right now.</div>';
    });
  }

  // ── 6. STUDIO PREFERENCE WIDGET ───────────────────────────────

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

  function getPref() {
    try { return localStorage.getItem(PREF_KEY) || getCookie(PREF_KEY); }
    catch (e) { return getCookie(PREF_KEY); }
  }

  function setPref(id) {
    try { localStorage.setItem(PREF_KEY, id); } catch (e) {}
    setCookie(PREF_KEY, id, 365);
  }

  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m[2] : '';
  }

  function setCookie(name, val, days) {
    var exp = new Date();
    exp.setDate(exp.getDate() + days);
    document.cookie = name + '=' + val + ';path=/;expires=' + exp.toUTCString() + ';SameSite=Lax';
  }

  function initPrefWidget() {
    var list  = document.getElementById('sp-pref-list');
    var label = document.getElementById('sp-pref-label');
    if (!list) return;

    var current = getPref() || STUDIO_ID;

    // Set current studio as default on studio pages
    if (STUDIO_ID && !getPref()) setPref(STUDIO_ID);

    // Update button label
    var found = STUDIO_LIST.filter(function (s) { return s.id === current; })[0];
    if (found && label) label.textContent = found.name;

    // Build list
    var html = '';
    STUDIO_LIST.forEach(function (s) {
      html +=
        '<div class="sp-pref-popup__item' + (s.id === current ? ' active' : '') + '" ' +
          'onclick="spSetStudio(\'' + s.id + '\')">' +
          '<div class="sp-pref-popup__dot"></div>' +
          esc(s.name) +
        '</div>';
    });
    list.innerHTML = html;
  }

  // Exposed globally for onclick handlers
  window.spPrefToggle = function () {
    var popup = document.getElementById('sp-pref-popup');
    if (popup) popup.classList.toggle('open');
  };

  window.spSetStudio = function (id) {
    setPref(id);
    var found = STUDIO_LIST.filter(function (s) { return s.id === id; })[0];
    var label = document.getElementById('sp-pref-label');
    if (found && label) label.textContent = found.name;

    // Update active state in list
    var items = document.querySelectorAll('.sp-pref-popup__item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].textContent.trim() === (found ? found.name : ''));
    }

    // Close popup
    var popup = document.getElementById('sp-pref-popup');
    if (popup) popup.classList.remove('open');
  };

  // Close popup on outside click
  document.addEventListener('click', function (e) {
    var widget = document.getElementById('sp-studio-pref');
    var popup  = document.getElementById('sp-pref-popup');
    if (popup && widget && !widget.contains(e.target)) {
      popup.classList.remove('open');
    }
  });

  // ── INIT ───────────────────────────────────────────────────────

  function init() {
    loadToday();
    loadFeaturedEvent();
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

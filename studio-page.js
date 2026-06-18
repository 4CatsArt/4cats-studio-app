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

  var CFG         = window.SP_CONFIG || {};
  var STUDIO_ID   = CFG.studioId    || '';
  var STUDIO_NAME = CFG.studioName  || '4Cats';
  var SB_URL      = CFG.supabaseUrl || 'https://snxibhbhhchjthfmjtaj.supabase.co';
  var SB_ANON     = CFG.supabaseAnon|| '';

  var STUDIO_TODAY_URL = SB_URL + '/functions/v1/studio-today';

  // ── UTILITIES ───────────────────────────────────────────────────

  var SB_HEADERS = {
    'apikey':        SB_ANON,
    'Authorization': 'Bearer ' + SB_ANON,
    'Content-Type':  'application/json'
  };

  function sbFetch(path) {
    return fetch(SB_URL + '/rest/v1/' + path, { headers: SB_HEADERS })
      .then(function(r) { return r.json(); });
  }

  function todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
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
    var m = parseInt(parts[1], 10);
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return m === 0 ? h + ampm : h + ':' + (m < 10 ? '0' + m : m) + ampm;
  }

  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606';
    return s;
  }

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cleanTitle(title) {
    if (!title) return '';
    return title.indexOf('|') > -1 ? title.split('|').slice(1).join('|').trim() : title;
  }

  // ── 1 + 2. TODAY SLIDER + FRIDAY PANEL (single fetch) ──────────

  function loadTodayAndFriday() {
    var track = document.getElementById('sp-today-track');
    var panel = document.getElementById('sp-friday-panel');
    if (!STUDIO_ID) return;

    fetch(STUDIO_TODAY_URL + '?studio_id=' + encodeURIComponent(STUDIO_ID), {
      headers: SB_HEADERS
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        renderToday(track, data.today || []);
        renderFriday(panel, data.friday || null);
        renderMiniMake(data); 
      })
      .catch(function() {
        if (track) track.innerHTML = '<div class="sp-empty" style="min-width:280px">Couldn\'t load today\'s sessions \u2014 <a href="/pages/schedule" style="color:var(--color-accent-main);font-weight:600">see the full schedule</a></div>';
        if (panel) panel.style.display = 'none';
      });
  }

  function renderToday(track, products) {
    if (!track) return;
    if (!products.length) {
      track.innerHTML = '<div class="sp-empty" style="min-width:280px">Nothing scheduled for today \u2014 <a href="/pages/schedule" style="color:var(--color-accent-main);font-weight:600">see the full schedule</a></div>';
      return;
    }
    var html = '';
    products.forEach(function(p) {
      var title  = cleanTitle(p.title);
      var handle = p.handle || (p.url ? p.url.split('/products/')[1].split('?')[0] : '');
      var timeStr = p.sessionTime ? fmtTime(p.sessionTime) : '';

      var spotsText = '';
      if (p.isFull) {
        spotsText = 'Sold out';
      } else if (p.spaces !== null && p.spaces <= 6) {
        spotsText = p.spaces + ' spots left';
      }
      var spotsHtml = '<div class="sp-session-card__spots" style="color:' + (spotsText ? '#c0391e' : 'transparent') + '">' + (spotsText || 'x') + '</div>';

      var bookHtml = p.isFull
        ? '<div class="sp-session-card__book" style="opacity:.5;cursor:default">Sold Out</div>'
        : '<a href="' + esc(p.url) + '" class="sp-session-card__book">Book now \u2192</a>';

      html +=
        '<div class="sp-session-card" data-handle="' + esc(handle) + '">' +
          '<div class="sp-session-card__thumb">' +
            (p.image ? '<img src="' + esc(p.image) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">' : '') +
            (timeStr ? '<div class="sp-session-card__time-badge">' + esc(timeStr) + '</div>' : '') +
          '</div>' +
          '<div class="sp-session-card__body">' +
            '<div class="sp-session-card__title">' + esc(title) + '</div>' +
            (p.price ? '<div class="sp-session-card__price">' + esc(p.price) + '</div>' : '') +
            spotsHtml +
          '</div>' +
          bookHtml +
        '</div>';
    });
    track.innerHTML = html;

  }

  function renderFriday(panel, p) {
    if (!panel) return;
    if (!p) { panel.style.display = 'none'; return; }
    var imgSrc = p.fridayImage || p.image || '';
    panel.innerHTML =
      '<div class="sp-friday">' +
        (imgSrc
          ? '<div class="sp-friday__img"><img src="' + esc(imgSrc) + '" alt="' + esc(p.title) + '" loading="lazy"></div>'
          : '<div class="sp-friday__img sp-friday__img--empty"></div>') +
        '<div class="sp-friday__footer">' +
          (p.isFull
            ? '<div class="sp-friday__btn sp-friday__btn--sold">Sold Out</div>'
            : '<a href="' + esc(p.url) + '" class="sp-friday__btn">BOOK FRIDAY NIGHT \u2192</a>') +
        '</div>' +
      '</div>';
  }

  function renderMiniMake(data) {
  var section = document.getElementById('sp-minimake-section');
  if (!section) return;
  var mm = data.miniMake;
  var next = data.nextMiniMake;
  if (!mm && !next) { section.style.display = 'none'; return; }

  var thisHtml = mm
    ? '<div class="sp-mm-photo">' +
        (mm.image ? '<img src="' + esc(mm.image) + '" alt="' + esc(mm.title) + '" loading="lazy">' : '<div class="sp-mm-photo-empty"></div>') +
        '<a href="' + esc(mm.url) + '" class="sp-mm-photo-btn">Book This Week \u2192</a>' +
      '</div>'
    : '<div class="sp-mm-photo sp-mm-photo-empty"></div>';

  var nextHtml = next
    ? '<div class="sp-mm-photo">' +
        (next.image ? '<img src="' + esc(next.image) + '" alt="' + esc(next.title) + '" loading="lazy">' : '<div class="sp-mm-photo-empty"></div>') +
        '<a href="' + esc(next.url) + '" class="sp-mm-photo-btn">Book Next Week \u2192</a>' +
      '</div>'
    : '<div class="sp-mm-photo sp-mm-photo-empty"></div>';

  var centerHtml =
    '<div class="sp-mm-center">' +
      '<div class="sp-mm-eyebrow">Mini Makes from ' + esc((mm || next).price || '$8') + ' \u2665</div>' +
      '<div class="sp-mm-cols">' +
        '<div>' +
          '<p class="sp-mm-desc">Just want somewhere to go? We got you. Drop in, make something &amp; hang out!</p>' +
          '<ul class="sp-mm-list">' +
            '<li>\uD83D\uDC8C No experience needed</li>' +
            '<li>\uD83C\uDFA8 Choose from weekly themes</li>' +
            '<li>\u2728 One visit, drop in anytime</li>' +
            '<li>\uD83D\uDE0A Fun, social &amp; relaxing</li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<div class="sp-mm-perfect-label">Perfect for:</div>' +
          '<ul class="sp-mm-list">' +
            '<li>\uD83D\uDC65 Friend hangs</li>' +
            '<li>\uD83D\uDC97 Casual date nights</li>' +
            '<li>\uD83C\uDF19 After dinner plans</li>' +
            '<li>\u2614 Rainy days</li>' +
            '<li>\uD83C\uDFA8 Creative breaks</li>' +
            '<li>\uD83D\uDCA1 &ldquo;We should do something tonight&rdquo;</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
    '</div>';

  section.innerHTML = thisHtml + centerHtml + nextHtml;
}

  // ── 3. THIS WEEK'S PROJECTS ─────────────────────────────────────

  function loadProjects() {
    var grid = document.getElementById('sp-projects-grid');
    if (!grid || !STUDIO_ID) return;

    var todayS  = todayStr();
    var weekEnd = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
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
          var name = cleanTitle(p.title);
          html +=
            '<a href="' + esc(p.url) + '" class="sp-project-card">' +
              '<div class="sp-project-card__thumb">' +
                (p.image
                  ? '<img src="' + esc(p.image) + '" alt="' + esc(name) + '" loading="lazy">'
                  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px">\uD83C\uDFA8</div>') +
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
      var name = cleanTitle(s.title);
      if (!seen[name]) {
        seen[name] = true;
        html += '<div class="sp-project-card"><div class="sp-project-card__thumb" style="display:flex;align-items:center;justify-content:center;font-size:32px">\uD83C\uDFA8</div><div class="sp-project-card__name">' + esc(name) + '</div></div>';
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
        grid.innerHTML = '<div class="sp-week-card"><div class="sp-week-card__theme" style="color:rgba(255,255,255,.5)">Themes coming soon\u2026</div></div>';
        return;
      }
      var todayDt = new Date(todayS);
      var html = '';
      weeks.forEach(function(w) {
        var startDt = w.week_start ? new Date(w.week_start + 'T12:00:00') : null;
        var endDt   = w.week_end   ? new Date(w.week_end   + 'T12:00:00') : null;
        var isCurrent = startDt && endDt && todayDt >= startDt && todayDt <= endDt;
        var themeFull = w.theme || '';
        var themeDisplay = themeFull.indexOf('\u00b7') > -1
          ? themeFull.split('\u00b7').slice(1).join('\u00b7').trim()
          : themeFull;
        var datesStr = (w.week_start && w.week_end)
          ? fmtDate(w.week_start) + ' \u2013 ' + fmtDate(w.week_end) : '';
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
    { id: 'BC-RICH-GC',  name: 'Richmond \u2013 Garden City' },
    { id: 'BC-RICH-STV', name: 'Richmond \u2013 Steveston' },
    { id: 'BC-SUR-SSR',  name: 'Surrey \u2013 South' },
    { id: 'BC-YVR-KIT',  name: 'Vancouver \u2013 Kitsilano' },
    { id: 'BC-YVR-MS',   name: 'Vancouver \u2013 Main Street' },
    { id: 'BC-YVR-UBC',  name: 'Vancouver \u2013 UBC' },
    { id: 'BC-YYJ-CSV',  name: 'Victoria \u2013 Cook Street Village' },
    { id: 'BC-YYJ-ESQ',  name: 'Victoria \u2013 Esquimalt' },
    { id: 'BC-YYJ-OB',   name: 'Victoria \u2013 Oak Bay' },
    { id: 'BC-YYJ-VIC',  name: 'Victoria \u2013 Uptown' },
    { id: 'AB-YYC-ING',  name: 'Calgary \u2013 Inglewood' },
    { id: 'AB-STA-STA',  name: 'St Albert' },
    { id: 'ON-BRL-BRL',  name: 'Burlington \u2013 South' },
    { id: 'ON-CMB-GLT',  name: 'Cambridge \u2013 Galt' },
    { id: 'ON-ERN-ERN',  name: 'Erin' },
    { id: 'ON-HAM-OS',   name: 'Hamilton \u2013 Ottawa Street' },
    { id: 'ON-HAM-WD',   name: 'Hamilton \u2013 Waterdown' },
    { id: 'ON-HAM-WH',   name: 'Hamilton \u2013 West Harbour' },
    { id: 'ON-KGN-AP',   name: 'Kingston \u2013 Arlington Park' },
    { id: 'ON-LDN-BYR',  name: 'London \u2013 Byron' },
    { id: 'ON-LDN-WVG',  name: 'London \u2013 Wortley Village' },
    { id: 'ON-MIS-PC',   name: 'Mississauga \u2013 Port Credit' },
    { id: 'ON-OAK-OAK',  name: 'Oakville \u2013 North' },
    { id: 'ON-OAK-WST',  name: 'Oakville \u2013 West' },
    { id: 'ON-YOW-GLB',  name: 'Ottawa \u2013 The Glebe' },
    { id: 'ON-STC-STC',  name: 'St Catharines' },
    { id: 'ON-YYZ-AVE',  name: 'Toronto \u2013 Avenue Road' },
    { id: 'ON-YYZ-BP',   name: 'Toronto \u2013 Baby Point' },
    { id: 'ON-YYZ-LEA',  name: 'Toronto \u2013 Leaside' },
    { id: 'ON-YYZ-BEA',  name: 'Toronto \u2013 The Beaches' },
    { id: 'ON-WTR-WTR',  name: 'Waterloo \u2013 Uptown' }
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

  window.spCarouselScroll = function(dir) {
    var track = document.getElementById('sp-today-track');
    if (track) track.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

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
    loadTodayAndFriday();
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

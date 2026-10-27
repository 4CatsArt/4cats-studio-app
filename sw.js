// 4Cats Hub — background worker for phone notifications (Oct 2026).
// Lives next to hub.html. It only shows notifications and opens the Hub when one
// is tapped; it doesn't cache or change anything else.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '4Cats Hub', {
    body: d.body || '',
    icon: 'hub-icon-192.png',
    badge: 'hub-icon-192.png',
    tag: d.tag || undefined,          // one notification per chat; a new message replaces the last
    renotify: !!d.tag,
    data: { url: d.url || 'hub.html' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'hub.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.includes('hub.html') && 'focus' in c) { c.postMessage({ type: 'open-chat', url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});

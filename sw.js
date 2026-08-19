/* The Doomsday Protocol — service worker.
 *
 * Bump CACHE when index.html, styles.css, data.js or app.js change; the old
 * cache is dropped on activate.
 * Strategy:
 *   navigations      network first, cached shell as the offline fallback
 *   same-origin      cache first (the shell and icons never change in place)
 *   Wikipedia art    stale-while-revalidate, opaque responses cached as-is
 */
const CACHE = 'doomsday-protocol-v11';
const POSTERS = 'doomsday-posters-v1';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './assets/doomsday-a.png',
  './assets/doomsday-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll rejects the whole batch if one file 404s, so add individually
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k !== POSTERS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // the page itself: always try the network so updates land, fall back offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // poster art lives on another origin and never changes
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.open(POSTERS).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => { c.put(req, res.clone()).catch(() => {}); return res; })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // Code and styles: network first, same as the page. index.html is fetched
  // fresh on every navigation, so serving a cached app.js or styles.css beside
  // it could pair new markup with old logic if CACHE was ever left un-bumped.
  // They are small; correctness beats the few ms.
  if (/\.(?:js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // static assets we ship (icons, the glyph): these never change in place
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});

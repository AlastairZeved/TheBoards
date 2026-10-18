/* Service worker — cache-first app shell, fully offline (PRD §3 / §6.8).
   Version-stamped cache; old caches are cleaned on activate. */
const CACHE = 'zeved-boards-v162';       // bump when shipped app.js/styles.css or any module changes
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'state.js',
  'persistence.js',
  'geometry.js',
  'render.js',
  'interactions.js',
  'menus.js',
  'export.js',
  'boards.js',
  'manifest.json',
  'fonts/MontserratAlternates-400.woff2',
  'fonts/MontserratAlternates-600.woff2',
  'fonts/MontserratAlternates-800.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/icon-192-light.png',
  'favicon.ico',
  'icons/favicon-16.png',
  'icons/favicon-32.png',
  'icons/favicon-48.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Stale-while-revalidate, still cache-first: a warm hit returns without
   waiting on the network while a fetch overwrites the entry for the next
   launch. `install` re-runs only when this file's bytes change, so a missed
   CACHE bump would otherwise be permanent. The bump still stands: it lands an
   update on the next launch, not the one after; this is the net under it. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {     // runtime-cache same-origin GETs
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (hit) return hit;                             // offline with a warm cache
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
      // Not awaited: `hit` wins; waitUntil keeps the worker alive to write.
      if (hit) e.waitUntil(net.catch(() => {}));
      return hit || net;
    })
  );
});

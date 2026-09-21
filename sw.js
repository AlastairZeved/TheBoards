/* Service worker — cache-first app shell, fully offline (PRD §3 / §6.8).
   Version-stamped cache; old caches are cleaned on activate. */
const CACHE = 'zeved-boards-v91';       // bump on every shipped app.js/styles.css change
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

/* Stale-while-revalidate. Still cache-first — a warm hit is returned without
   ever waiting on the network, so offline behaviour and cold-start latency are
   unchanged — but the fetch now runs *alongside* the hit rather than only when
   there isn't one, and overwrites the entry. So the next launch is current.

   Why: CACHE is version-stamped and `install` only re-runs when this file's own
   bytes change, which made a missed bump permanent rather than temporary. Two
   shipped changes (072a15e, 9ace6d6) never reached an installed app because of
   it. The bump discipline above still stands — it is what makes an update land
   on the *next* launch instead of the one after — this is the net under it. */
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
      // Revalidation is deliberately not awaited: `hit` wins the race whenever
      // there is one. e.waitUntil keeps the worker alive to finish the write.
      if (hit) e.waitUntil(net.catch(() => {}));
      return hit || net;
    })
  );
});

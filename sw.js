/* Hanum Laundry — service worker v4
   Network-first untuk file aplikasi (selalu versi terbaru saat online),
   fallback ke cache saat offline. Permintaan Supabase/CDN dibiarkan langsung ke jaringan. */
const CACHE = 'hanum-laundry-v16';
const ASSETS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request; let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

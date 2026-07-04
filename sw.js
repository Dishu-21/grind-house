// Grind House service worker
// Only caches the app shell (this HTML file + manifest + icons) so the app can
// still open when offline. It deliberately does NOT touch requests to
// supabase.co, Google Fonts, or the Supabase/Chart.js CDN scripts — those
// always go straight to the network so you never see stale data or a broken
// login. Bump CACHE_NAME whenever the shell files change so old caches get
// cleared out automatically.
const CACHE_NAME = 'grind-house-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the app shell itself. Everything
  // else (Supabase API/auth calls, realtime websockets, external CDNs, fonts)
  // is left completely alone and goes straight to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')) || url.pathname === '/' );

  if (!isShellFile) return;

  // Network-first for the HTML shell itself, so you always get the latest
  // version of the app when online — falling back to the cached copy only
  // when there's no connection at all. This avoids the classic PWA trap of
  // being stuck on a stale cached page after you've shipped an update.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

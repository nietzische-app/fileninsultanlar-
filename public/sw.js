/**
 * Hafif offline önbellek.
 *
 * ÖNEMLİ — HTML asla cache-first servis edilmez.
 *
 * Önceki sürüm `/` ve `/index.html`'i ön belleğe alıp her istekte
 * `cached || network` döndürüyordu. Vite içerik-hash'li paket üretir
 * (`index-a1b2c3.js`), yani eski HTML eski hash'i ister. Yeni bir
 * dağıtımdan sonra o dosya sunucuda artık yoktur: kullanıcı ya eski
 * oyunu görür ya da yarım yüklenmiş bir sürümü. "Sayfayı yeniliyorum
 * ama değişmiyor" ve "oyun bozuldu" şikâyetlerinin kaynağı buydu.
 *
 * Doğru bölüşüm:
 *   - HTML / gezinme  → ağ önce, çevrimdışıysa önbellek
 *   - /assets/*       → hash'li ve değişmez, önbellek önce
 *   - diğerleri       → önbelleği ver, arkada tazele
 */
const VERSION = 'v3';
const CACHE = `filenin-sultanlari-${VERSION}`;

/** Yalnızca çevrimdışı yedeği: kabuk. */
const OFFLINE_SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** Sayfanın "hemen devral" mesajı — güncelleme beklemede kalmasın. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === 'navigate' ||
    (request.destination === 'document') ||
    request.headers.get('accept')?.includes('text/html');

  // --- HTML: ağ önce ---
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(OFFLINE_SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_SHELL).then((c) => c ?? Response.error()))
    );
    return;
  }

  // --- Hash'li varlıklar: önbellek önce (içerik değişirse ad da değişir) ---
  const immutable = url.pathname.startsWith('/assets/');
  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // --- Diğerleri: önbelleği ver, arkada tazele ---
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

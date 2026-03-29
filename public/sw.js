// Nama Cache - Ubah versi jika Anda melakukan update besar pada CSS/JS
const CACHE_NAME = 'rhmt-music-v2.5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png'
];

// 1. Install Service Worker & Simpan Aset Inti ke Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('R_hmt Music: Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Aktivasi & Hapus Cache Lama (Cleaning)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('R_hmt Music: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Strategi Fetch: Stale-While-Revalidate
// Melayani dari cache dulu (instan), lalu update di background.
self.addEventListener('fetch', (event) => {
  // Jangan cache request API atau Youtube agar data pencarian selalu segar
  if (event.request.url.includes('/api/') || event.request.url.includes('youtube.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Update cache dengan versi terbaru dari jaringan
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // Jika offline dan tidak ada di cache, beri respon fallback jika perlu
      });

      // Kembalikan cache jika ada, jika tidak tunggu jaringan
      return cachedResponse || fetchPromise;
    })
  );
});

// Menangani klik pada notifikasi push (opsional untuk pengembangan masa depan)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

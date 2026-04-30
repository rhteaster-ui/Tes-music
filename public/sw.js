const CACHE_NAME = 'soundify-cache-v5';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/Gambar3.jpg',
    '/Gambar4.png'
];

function offlineApiResponse() {
    return new Response(JSON.stringify({
        status: 'error',
        error_code: 'OFFLINE_MODE',
        message: 'Koneksi internet terputus. Data terbaru tidak tersedia.',
        data: []
    }), { headers: { 'Content-Type': 'application/json' }, status: 503 });
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    if (event.request.url.includes('youtube.com') || event.request.url.includes('ytimg.com')) return;

    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request).catch(() => offlineApiResponse()));
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cached = await caches.match('/index.html');
                return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});

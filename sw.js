const CACHE_NAME = 'task-organizer-v2';
const urlsToCache = [
    './index.html',
    './src/css/styles.css',
    './src/js/app.js',
    './src/js/tasks.js',
    './src/js/calendar.js',
    './src/js/firebase-config.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache).catch(err => {
                    console.error('Erro ao adicionar ao cache:', err);
                });
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
const CACHE_NAME = 'task-organizer-v' + Date.now(); // Versão baseada em timestamp
const urlsToCache = [
    '/',
    '/index.html',
    '/src/css/styles.css',
    '/src/js/app.js',
    '/src/js/tasks.js',
    '/src/js/calendar.js',
    '/src/js/firebase-config.js',
    '/manifest.json'
];

// Instala o novo service worker e limpa caches antigos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting()) // Força ativação imediata
    );
});

// Remove caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Assume controle imediatamente
        })
    );
});

// Estratégia: Cache First, mas sempre verifica se há atualizações
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Se estiver no cache, retorna, mas busca atualização em background
                if (response) {
                    fetch(event.request).then((fetchResponse) => {
                        const responseClone = fetchResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    });
                    return response;
                }
                // Se não estiver no cache, busca da rede
                return fetch(event.request);
            })
    );
});
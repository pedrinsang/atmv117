const CACHE_NAME = 'atmv117-v1.0.1';
const urlsToCache = [
    '/',
    '/index.html',
    '/src/css/styles.css',
    '/src/js/app.js',
    '/src/js/tasks.js',
    '/src/js/calendar.js',
    '/src/js/firebase-config.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css'
];

// runtime flag controllable via postMessage from the page
let disableCaching = false;

// Instalar Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptar requisições - CORRIGIDO
self.addEventListener('fetch', (event) => {
    // FILTRAR: Só processar requisições GET
    if (event.request.method !== 'GET') {
        return; // Deixar POST/PUT/DELETE passarem direto
    }
    
    const requestUrl = new URL(event.request.url);
    
    // FILTRAR: Não cachear APIs externas
    if (
        requestUrl.hostname.includes('firestore.googleapis.com') ||
        requestUrl.hostname.includes('api.github.com') ||
        requestUrl.hostname.includes('firebase') ||
        requestUrl.hostname.includes('googleapis.com')
    ) {
        return; // Deixar APIs passarem direto
    }
    
    // If caching is disabled (development mode), prefer network-first
    if (disableCaching) {
        event.respondWith(
            fetch(event.request.clone()).then((response) => response).catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit
                if (response) {
                    return response;
                }
                
                // Buscar na rede
                return fetch(event.request.clone()).then((response) => {
                    // Verificar se é uma resposta válida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Cachear apenas se for GET
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                }).catch(() => {
                    // Fallback para cache em caso de erro
                    return caches.match(event.request);
                });
            })
    );
});

// Listener para mensagens do app
self.addEventListener('message', (event) => {
    if (!event.data) return;
    const data = event.data;
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (data.type === 'SET_DISABLE_CACHE') {
        disableCaching = !!data.value;
        console.log('ServiceWorker: disableCaching set to', disableCaching);
    }
    if (data.type === 'CLEAR_CACHE') {
        console.log('ServiceWorker: clearing all caches');
        caches.keys().then(keys => Promise.all(keys.map(k=>caches.delete(k))));
    }
});

// Sincronização em background (opcional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Sincronização em background');
        // Aqui você pode implementar sincronização offline
    }
});
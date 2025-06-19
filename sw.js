const CACHE_NAME = 'atmv117-v1.0.0';
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

// Interceptar requisições
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // FILTRAR: Só cachear requisições GET
    if (event.request.method !== 'GET') {
        // Para POST, PUT, DELETE (Firebase, GitHub) - deixar passar direto
        return;
    }
    
    // FILTRAR: Não cachear APIs externas que mudam frequentemente
    if (
        requestUrl.hostname.includes('firestore.googleapis.com') ||
        requestUrl.hostname.includes('api.github.com') ||
        requestUrl.hostname.includes('firebase') ||
        requestUrl.hostname.includes('googleapis.com')
    ) {
        // Deixar APIs passarem direto (sem cache)
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - retornar resposta do cache
                if (response) {
                    return response;
                }
                
                // IMPORTANTE: Clonar a requisição
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Verificar se recebemos uma resposta válida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // IMPORTANTE: Clonar a resposta
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            // Só cachear se for GET e resposta válida
                            if (event.request.method === 'GET') {
                                cache.put(event.request, responseToCache);
                            }
                        });
                    
                    return response;
                }).catch(() => {
                    // Se falhar, tentar buscar no cache
                    return caches.match(event.request);
                });
            })
    );
});

// Listener para mensagens do app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Sincronização em background (opcional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Sincronização em background');
        // Aqui você pode implementar sincronização offline
    }
});
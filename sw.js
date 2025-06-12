const CACHE_NAME = 'task-organizer-v' + Date.now(); // Nova versão a cada carregamento
const urlsToCache = [
    './',
    './index.html',
    './src/css/styles.css',
    './src/js/app.js',
    './src/js/tasks.js',
    './src/js/calendar.js',
    './src/js/firebase-config.js',
    './manifest.json'
];

// Instala o novo service worker e limpa caches antigos
self.addEventListener('install', (event) => {
    console.log('SW: Instalando nova versão');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW: Cachando arquivos');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('SW: Pulando espera');
                return self.skipWaiting(); // Força ativação imediata
            })
    );
});

// Remove caches antigos SEMPRE
self.addEventListener('activate', (event) => {
    console.log('SW: Ativando nova versão');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            console.log('SW: Limpando caches antigos');
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Removendo cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('SW: Assumindo controle');
            return self.clients.claim(); // Assume controle imediatamente
        })
    );
});

// Estratégia: Network First (sempre busca da rede primeiro)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Se conseguiu buscar da rede, atualiza o cache
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se a rede falhar, tenta buscar do cache
                return caches.match(event.request);
            })
    );
});

// src/js/app.js
navigator.serviceWorker.register('./sw.js') // Use './' em vez de '/'
    .then((registration) => {
        console.log('SW registrado com sucesso');
        // ...resto do código
    })
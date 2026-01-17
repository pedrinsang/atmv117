const CACHE_NAME = 'atmv117-v7'; // Mudei a versão para forçar atualização
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './register.html',
    './reset-password.html',
    './blocked.html',
    './admin.html',
    './manifest.json',
    
    // CSS
    './src/css/styles.css',
    './src/css/auth-styles.css',
    
    // JS (Note que removi o calendar.js)
    './src/js/lib/firebase-config.js',
    './src/js/lib/app.js',
    './src/js/lib/tasks.js',
    './src/js/lib/notifications.js',
    './src/js/lib/dados.js',
    './src/js/lib/aniversarios.js',
    './src/js/lib/admin.js',
    
    // Imagens (Verifique se esses arquivos existem mesmo na pasta)
    './src/img/logo-silhueta.png',
    './src/img/icon-192.png',
    './src/img/ATMV117.png',

    // CDNs Externos (Bootstrap, Flatpickr)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/flatpickr'
];

// Instalação: Cache de arquivos estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW: Caching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.error('SW: Falha ao cachear arquivos. Verifique se todos os caminhos existem.', err);
            })
    );
    self.skipWaiting();
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch: Interceptação de requisições
self.addEventListener('fetch', (event) => {
    // Ignora requisições do Firestore/Google APIs para não quebrar auth
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('firebase')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retorna do cache se existir, senão busca na rede
                return response || fetch(event.request).catch(() => {
                    // Fallback opcional para offline (pode ser index.html)
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

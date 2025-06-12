document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeApp, 2000);
    
    // Registra Service Worker com detecção de atualização
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('SW registrado com sucesso');
                
                // Detecta atualizações
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nova versão disponível
                            if (confirm('Nova versão disponível! Deseja atualizar agora?')) {
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('SW registration failed:', error);
            });

        // Escuta mensagens do service worker
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

    // Força verificação de atualizações a cada 5 minutos
    setInterval(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) reg.update();
            });
        }
    }, 5 * 60 * 1000);
});

function initializeApp() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase não carregado');
        setTimeout(initializeApp, 1000);
        return;
    }
    
    if (!window.db) {
        console.error('Firestore não inicializado');
        setTimeout(initializeApp, 1000);
        return;
    }
    
    console.log('Inicializando aplicação...');
    
    if (typeof loadTasks === 'function') {
        loadTasks();
    }
    
    if (typeof initializeCalendar === 'function') {
        initializeCalendar();
    }
    
    const today = new Date().toISOString().split('T')[0];
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput) {
        taskDateInput.setAttribute('min', today);
    }
    
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof addTask === 'function') {
                addTask();
            }
        });
    }
    
    console.log('Aplicação inicializada com sucesso');
}

let deferredPrompt = null;

// Detecta suporte ao evento de instalação
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installPwaBtn').style.display = 'inline-block';
});

// Botão para instalar o PWA (Android/Chrome)
document.getElementById('installPwaBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            deferredPrompt = null;
            document.getElementById('installPwaBtn').style.display = 'none';
        }
    }
});

// Detecta iOS e mostra instruções
function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isInStandaloneMode() {
    return ('standalone' in window.navigator) && window.navigator.standalone;
}

window.addEventListener('DOMContentLoaded', () => {
    if (isIos() && !isInStandaloneMode()) {
        document.getElementById('installPwaBtn').style.display = 'inline-block';
        document.getElementById('installPwaBtn').onclick = function() {
            const modal = new bootstrap.Modal(document.getElementById('iosInstallModal'));
            modal.show();
        };
    }
});
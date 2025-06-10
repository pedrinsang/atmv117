document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeApp, 2000);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    }
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

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA pode ser instalado');
});

window.addEventListener('appinstalled', (evt) => {
    console.log('PWA foi instalado');
});
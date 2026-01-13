const firebaseConfig = {
    apiKey: "AIzaSyA5bn85sy036cJDAJhZRTU3Z3PdkaZi3lY",
    authDomain: "atmv117.firebaseapp.com",
    projectId: "atmv117",
    storageBucket: "atmv117.firebasestorage.app",
    messagingSenderId: "262893477859",
    appId: "1:262893477859:web:322fac6968389050abcad6",
    measurementId: "G-WTV7S63HR2"
};

// Inicialização segura: verifica se já existe uma instância antes de criar
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

window.db = firebase.firestore();
window.auth = firebase.auth();
window.firebase = firebase;

const db = firebase.firestore();
const auth = firebase.auth();

console.log('Firebase inicializado');

// Adicionar handler global para erros de autenticação
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.code === 'permission-denied') {
        console.error('❌ Erro de permissão do Firestore:', event.reason);
        console.log('🔍 Verificando estado de autenticação...');
        
        // Verificar se realmente não está autenticado
        const user = firebase.auth().currentUser;
        if (!user) {
            console.error('🚫 Usuário não está autenticado - verificando redirecionamento');
            
            // Não redirecionar se há fluxo blocked ativo
            if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                console.log('Blocked flow ativo - firebase-config não redirecionando');
                return;
            }
            
            if (!window.isRedirecting) {
                window.isRedirecting = true;
                    console.trace('Redirecting to login from firebase-config unhandledrejection');
                    // Final guard before redirecting
                    if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                        console.log('Blocked flow detected at final redirect guard - aborting redirect');
                        window.isRedirecting = false;
                        return;
                    }
                    if (typeof safeNavigate === 'function') {
                        safeNavigate('login.html');
                    } else {
                        window.location.href = 'login.html';
                    }
            }
        } else {
            console.warn('⚠️ Usuário autenticado mas sem permissão - possível problema nas regras do Firestore');
        }
    }
});

// Handler adicional para erros de rede/conexão
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && (event.reason.code === 'unavailable' || (event.reason.message && event.reason.message.includes('offline')))) {
        console.warn('🌐 Problema de conectividade detectado');
    }
});

// ... (código existente do firebase-config.js)

console.log('Firebase inicializado');

// === CORREÇÃO: Função Global de Navegação ===
// Adicionada aqui porque admin.html não carrega app.js, mas precisa navegar com segurança.
window.safeNavigate = function(path, force = false) {
    if (window.isRedirecting && !force) return;
    window.isRedirecting = true;
    
    // Evitar loops de redirecionamento para a mesma página
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPath === path) {
        window.isRedirecting = false;
        return;
    }

    window.location.href = path;
};
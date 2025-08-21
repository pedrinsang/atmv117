const firebaseConfig = {
    apiKey: "AIzaSyA5bn85sy036cJDAJhZRTU3Z3PdkaZi3lY",
    authDomain: "atmv117.firebaseapp.com",
    projectId: "atmv117",
    storageBucket: "atmv117.firebasestorage.app",
    messagingSenderId: "262893477859",
    appId: "1:262893477859:web:322fac6968389050abcad6",
    measurementId: "G-WTV7S63HR2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db;
window.firebase = firebase;

// Adicionar handler global para erros de autenticação
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason?.code === 'permission-denied') {
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
                    safeNavigate('login.html');
            }
        } else {
            console.warn('⚠️ Usuário autenticado mas sem permissão - possível problema nas regras do Firestore');
        }
    }
});

// Handler adicional para erros de rede/conexão
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason?.code === 'unavailable' || event.reason?.message?.includes('offline')) {
        console.warn('🌐 Problema de conectividade detectado');
        // Você pode adicionar uma notificação para o usuário aqui
    }
});

console.log('Firebase inicializado');
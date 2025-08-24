// Sistema de Proteção de Rotas
class RouteProtection {
    constructor() {
        this.auth = firebase.auth();
        this.isProtectedPage = this.checkIfProtectedPage();
        this.init();
    }

    init() {
        // Se estamos em uma página protegida, verificar autenticação
        if (this.isProtectedPage) {
            this.showLoadingScreen();
            this.setupAuthStateListener();
        }
    }

    checkIfProtectedPage() {
        // Páginas que requerem autenticação
        const protectedPages = ['index.html', 'admin.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Se não há extensão, assumir que é index.html
        if (!currentPage.includes('.')) {
            return true;
        }
        
        return protectedPages.includes(currentPage);
    }

    setupAuthStateListener() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    // Não verificar mais conta bloqueada aqui - deixar para auth.js e app.js
                    // Usuário autenticado - pode continuar
                    this.hideLoadingScreen();
                    console.log('✅ Usuário autenticado:', user.email);
                } catch (err) {
                    console.error('Erro na verificação de autenticação:', err);
                    this.hideLoadingScreen();
                    this.redirectToLogin();
                }
            } else {
                // Se estamos no fluxo de blocked (sessionStorage) ou modal ativo, não redirecionar
                if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                    console.log('Blocked flow ativo - route protection não redirecionando');
                    this.hideLoadingScreen();
                    return;
                }
                
                // Usuário não autenticado - redirecionar
                console.log('❌ Usuário não autenticado - redirecionando para login');
                this.redirectToLogin();
            }
        });
    }

    showLoadingScreen() {
        // Criar overlay de carregamento
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'routeProtectionLoading';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #ff6b35, #ff8c42);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        loadingOverlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border mb-3" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Verificando autenticação...</span>
                </div>
                <h4>Verificando autenticação...</h4>
                <p>Por favor, aguarde enquanto verificamos suas credenciais.</p>
            </div>
        `;
        
        document.body.appendChild(loadingOverlay);
        
        // Timeout de segurança - se demorar muito, redirecionar
        setTimeout(() => {
            if (document.getElementById('routeProtectionLoading')) {
                console.warn('\u26a0\ufe0f Timeout na verifica\u00e7\u00e3o de autentica\u00e7\u00e3o');
                // Do not redirect if blocked flow is active
                if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                    console.log('Blocked flow ativo - routeProtection timeout n\u00e3o redirecionando');
                    return;
                }
                this.redirectToLogin();
            }
        }, 10000); // 10 segundos
    }

    hideLoadingScreen() {
        const loadingOverlay = document.getElementById('routeProtectionLoading');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    redirectToLogin() {
        // Mostrar mensagem antes de redirecionar
        this.showRedirectMessage();
        
        setTimeout(() => {
            // Guard against blocked flow/modal active before redirecting
            if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                console.log('Blocked flow ativo - redirectToLogin will not navigate');
                return;
            }
            safeNavigate('login.html');
        }, 2000);
    }

    showRedirectMessage() {
        const loadingOverlay = document.getElementById('routeProtectionLoading');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="text-center">
                    <i class="bi bi-shield-x" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                    <h4>Acesso Negado</h4>
                    <p>Você precisa estar logado para acessar esta página.</p>
                    <p>Redirecionando para o login...</p>
                    <div class="spinner-border spinner-border-sm mt-2" role="status">
                        <span class="visually-hidden">Redirecionando...</span>
                    </div>
                </div>
            `;
        }
    }
}

// Função global para verificar autenticação em qualquer lugar
window.requireAuth = function() {
    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resolve(user);
            } else {
                // Verificar se estamos no fluxo blocked (sessionStorage) ou modal ativo antes de redirecionar
                if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                    console.log('Blocked flow ativo - requireAuth não redirecionando');
                    reject('Blocked flow ativo');
                    return;
                }

                reject('Usuário não autenticado');
                safeNavigate('login.html');
            }
        });
    });
};

// Inicializar proteção de rotas quando o Firebase estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar o Firebase ser carregado
    const initRouteProtection = () => {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            window.routeProtection = new RouteProtection();
        } else {
            setTimeout(initRouteProtection, 100);
        }
    };
    
    initRouteProtection();
});

// Gerenciador de autenticação para a página principal
class MainAuthManager {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.currentUser = null;
        this.userData = null;
        this.init();
    }

    init() {
        // Aguardar o carregamento da página
        document.addEventListener('DOMContentLoaded', () => {
            this.setupAuthStateListener();
        });
    }

    setupAuthStateListener() {
        // Verificação mais rápida com timeout
        const authTimeout = setTimeout(() => {
            console.warn('⚠️ Timeout na verificação de autenticação - redirecionando para login');
            this.redirectToLogin();
        }, 8000); // 8 segundos

        this.auth.onAuthStateChanged(async (user) => {
            clearTimeout(authTimeout); // Cancelar timeout
            
            if (user) {
                // Usuário está logado
                this.currentUser = user;
                
                try {
                    await this.loadUserData();
                    this.showUserInterface();
                    this.hideLoadingIfExists();
                    console.log('✅ Usuário autenticado e dados carregados:', user.email);
                } catch (error) {
                    console.error('❌ Erro ao carregar dados do usuário:', error);
                    this.redirectToLogin();
                }
            } else {
                // Usuário não está logado, redirecionar para login
                console.log('❌ Usuário não autenticado - redirecionando para login');
                this.redirectToLogin();
            }
        });
    }

    async loadUserData() {
        try {
            const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                this.userData = userDoc.data();
                
                // Atualizar último login
                await this.db.collection('users').doc(this.currentUser.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Criar documento se não existir
                this.userData = {
                    fullName: this.currentUser.displayName || 'Usuário',
                    email: this.currentUser.email,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await this.db.collection('users').doc(this.currentUser.uid).set(this.userData);
            }
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
            // Se falhar, criar dados básicos
            this.userData = {
                fullName: this.currentUser.displayName || 'Usuário',
                email: this.currentUser.email,
                role: 'user'
            };
        }
    }

    showUserInterface() {
        // Mostrar dropdown do usuário
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.style.display = 'block';
        }

        // Atualizar nome do usuário (envolvido em span para permitir esconder no mobile)
        const userDisplayName = document.getElementById('userDisplayName');
        if (userDisplayName) {
            const displayName = this.userData.fullName || this.currentUser.displayName || 'Usuário';
            userDisplayName.innerHTML = `<span class="user-name-text">${displayName}</span>`;
        }

        // Atualizar email
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = this.currentUser.email;
        }

        // Mostrar opção admin se for administrador
        const adminPanelOption = document.getElementById('adminPanelOption');
        if (adminPanelOption && this.userData.role === 'admin') {
            adminPanelOption.style.display = 'block';
        }

        // Aplicar estilos específicos para admin
        if (this.userData.role === 'admin') {
            this.applyAdminStyling();
        }
    }

    applyAdminStyling() {
        // Adicionar indicador visual de admin
        const userDisplayName = document.getElementById('userDisplayName');
        if (userDisplayName) {
            const name = this.userData.fullName || this.currentUser.displayName || 'Admin';
            // shield icon + wrapped name so we can hide the text on small screens
            userDisplayName.innerHTML = `
                <i class="bi bi-shield-check text-warning me-1 admin-icon" aria-hidden="true"></i>
                <span class="user-name-text">${name}</span>
            `;
        }

        // Adicionar classe para estilos específicos de admin
        document.body.classList.add('admin-user');
    }

    redirectToLogin() {
        // Prevenir redirecionamentos múltiplos
        if (window.isRedirecting) return;
        window.isRedirecting = true;
        
        console.log('🔄 Redirecionando para página de login...');
        
        // Mostrar mensagem de carregamento antes de redirecionar
        this.showAuthLoading();
        
        // Redirecionar imediatamente se já estivermos tentando
        window.location.href = 'login.html';
    }

    showAuthLoading() {
        // Criar overlay de loading se não existir
        if (!document.getElementById('authLoadingOverlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'authLoadingOverlay';
            loadingOverlay.className = 'auth-loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="auth-loading-content">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <h5>Verificando autenticação...</h5>
                    <p class="text-muted">Redirecionando para o login...</p>
                </div>
            `;
            
            document.body.appendChild(loadingOverlay);
            
            // Adicionar estilos CSS
            const style = document.createElement('style');
            style.textContent = `
                .auth-loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.95);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                
                .auth-loading-content {
                    text-align: center;
                    padding: 40px;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                }
                
                body.admin-user .navbar-brand {
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important;
                    background: none !important;
                    text-shadow: 0 1px 0 rgba(0,0,0,0.2);
                }
            `;
            document.head.appendChild(style);
        }
    }

    hideLoadingIfExists() {
        const loadingOverlay = document.getElementById('authLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // Métodos públicos para usar em outras partes da aplicação
    getCurrentUser() {
        return this.currentUser;
    }

    getUserData() {
        return this.userData;
    }

    isAdmin() {
        return this.userData && this.userData.role === 'admin';
    }

    async updateUserData(newData) {
        try {
            await this.db.collection('users').doc(this.currentUser.uid).update(newData);
            this.userData = { ...this.userData, ...newData };
            return true;
        } catch (error) {
            console.error('Erro ao atualizar dados do usuário:', error);
            return false;
        }
    }
}

// Inicializar o gerenciador de autenticação
window.mainAuthManager = new MainAuthManager();

// Função global para obter dados do usuário atual (compatibilidade)
window.getCurrentUserData = function() {
    return window.mainAuthManager.getUserData();
};

// Função global para verificar se é admin (compatibilidade)
window.isAdmin = function() {
    return window.mainAuthManager.isAdmin();
};

// Função global para obter usuário atual (compatibilidade)
window.getCurrentUser = function() {
    return window.mainAuthManager.getCurrentUser();
};

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
        // Verificação de segurança com timeout para evitar loading infinito
        const authTimeout = setTimeout(() => {
            console.warn('⚠️ Timeout na verificação de autenticação.');
            // Só redireciona se não houver usuário detectado pelo Firebase ainda
            if (!this.currentUser) {
                this.redirectToLogin();
            }
        }, 8000); 

        this.auth.onAuthStateChanged(async (user) => {
            clearTimeout(authTimeout); // Cancelar timeout
            
            if (user) {
                // Usuário está logado
                this.currentUser = user;
                
                try {
                    await this.loadUserData();
                    this.showUserInterface();
                    this.hideLoadingIfExists();
                    console.log('✅ Usuário autenticado:', user.email);
                } catch (error) {
                    console.error('❌ Erro ao carregar dados:', error);
                    // Não redirecionar imediatamente em erro de dados para evitar loop,
                    // apenas se for erro crítico de auth
                }
            } else {
                // Usuário não está logado
                this.redirectToLogin();
            }
        });
    }

    async loadUserData() {
        try {
            const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                this.userData = userDoc.data();
                
                // Atualizar último login sem travar a UI
                this.db.collection('users').doc(this.currentUser.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(err => console.warn('Falha ao atualizar lastLogin', err));

            } else {
                // Criar documento básico se não existir
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
            console.error('Erro crítico ao carregar perfil:', error);
            // Fallback para não quebrar a UI
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
        if (userDropdown) userDropdown.style.display = 'block';

        // Mostrar sininho
        const notif = document.getElementById('notificationsDropdown');
        if (notif) notif.style.display = 'block';

        // Atualizar nome
        const userDisplayName = document.getElementById('userDisplayName');
        if (userDisplayName) {
            const displayName = this.userData.fullName || this.currentUser.displayName || 'Usuário';
            userDisplayName.innerHTML = `<span class="user-name-text">${displayName}</span>`;
        }

        // Atualizar email
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = this.currentUser.email;

        // Opção admin
        const adminPanelOption = document.getElementById('adminPanelOption');
        if (adminPanelOption && this.userData.role === 'admin') {
            adminPanelOption.style.display = 'block';
        }

        // Estilos admin
        if (this.userData.role === 'admin') {
            this.applyAdminStyling();
        }

        // Menu "Dados da Turma"
        try {
            const dadosMenu = document.querySelector('.menu-item.has-submenu[data-page="dados"]');
            if (dadosMenu) {
                const canSeeDados = !!this.userData.accepted || this.userData.role === 'admin';
                dadosMenu.style.display = canSeeDados ? '' : 'none';
            }
        } catch (e) { console.warn('Erro UI Menu:', e); }

        // Notificações
        try {
            if (typeof window.notificationsRefreshAccess === 'function') {
                window.notificationsRefreshAccess();
            }
        } catch(e) {}

        // Prompt de Matrícula (apenas se necessário)
        this.checkAndShowMatriculaPrompt();
    }

    checkAndShowMatriculaPrompt() {
        if (!this.userData.matricula && !this.userData.role === 'admin') {
            // Lógica do modal de matrícula aqui se necessário
            // Mantive simplificado para focar na segurança, 
            // mas você pode colar a lógica do modal original aqui se usar
            const modalEl = document.getElementById('matriculaPromptModal');
            if(modalEl) {
               // ... lógica de exibição do modal ...
               // Importante: Ao salvar, usar a nova função isMatriculaAccepted abaixo
            }
        }
    }

    /**
     * Validação de Matrícula SEGURA
     * Substitui a leitura de listas inteiras por busca direta de ID
     */
    async isMatriculaAccepted(matricula) {
        if (!matricula) return false;
        try {
            // Busca direta pelo ID do documento (Mais seguro e rápido)
            const docRef = await this.db.collection('matriculas_aceitas').doc(matricula).get();
            return docRef.exists;
        } catch (e) {
            console.warn('Erro ao validar matrícula:', e);
            return false;
        }
    }

    applyAdminStyling() {
        const userDisplayName = document.getElementById('userDisplayName');
        if (userDisplayName) {
            const name = this.userData.fullName || this.currentUser.displayName || 'Admin';
            userDisplayName.innerHTML = `
                <i class="bi bi-shield-check text-warning me-1 admin-icon"></i>
                <span class="user-name-text">${name}</span>
            `;
        }
        document.body.classList.add('admin-user');
    }

    redirectToLogin() {
        // Prevenir loop de redirecionamento
        if (window.isRedirecting) return;
        if (sessionStorage.getItem('blockedUid')) return;
        
        // Verifica se já estamos na página de login para não recarregar
        if (window.location.pathname.includes('login.html')) return;

        window.isRedirecting = true;
        console.log('🔄 Redirecionando para login...');
        this.showAuthLoading();
        
        if (typeof safeNavigate === 'function') {
            safeNavigate('login.html', true);
        } else {
            window.location.href = 'login.html';
        }
    }

    showAuthLoading() {
        if (!document.getElementById('authLoadingOverlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'authLoadingOverlay';
            loadingOverlay.className = 'auth-loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="auth-loading-content">
                    <div class="spinner-border text-primary mb-3"></div>
                    <h5>Verificando acesso...</h5>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
            
            // CSS Injetado
            const style = document.createElement('style');
            style.textContent = `
                .auth-loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: center; z-index: 9999; }
                .auth-loading-content { text-align: center; padding: 30px; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            `;
            document.head.appendChild(style);
        }
    }

    hideLoadingIfExists() {
        const loadingOverlay = document.getElementById('authLoadingOverlay');
        if (loadingOverlay) loadingOverlay.remove();
    }

    // Getters
    getCurrentUser() { return this.currentUser; }
    getUserData() { return this.userData; }
    isAdmin() { return this.userData && this.userData.role === 'admin'; }
}

// Inicializar
window.mainAuthManager = new MainAuthManager();

// Compatibilidade Global
window.getCurrentUserData = () => window.mainAuthManager.getUserData();
window.isAdmin = () => window.mainAuthManager.isAdmin();
window.getCurrentUser = () => window.mainAuthManager.getCurrentUser();
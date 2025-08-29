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

        // Mostrar sininho de notificações
        const notif = document.getElementById('notificationsDropdown');
        if (notif) {
            notif.style.display = 'block';
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

        // Mostrar/ocultar menu "Dados da Turma" com base na matrícula aceita
        try {
            const dadosMenu = document.querySelector('.menu-item.has-submenu[data-page="dados"]');
            if (dadosMenu) {
                const canSeeDados = !!this.userData.accepted || this.userData.role === 'admin';
                dadosMenu.style.display = canSeeDados ? '' : 'none';
            }
        } catch (e) {
            console.warn('Falha ao ajustar visibilidade do menu Dados da Turma:', e);
        }

        // Atualizar acesso às notificações de reclamações (somente aceitos/admin)
        try {
            if (typeof window.notificationsRefreshAccess === 'function') {
                window.notificationsRefreshAccess();
            }
        } catch(e) {
            console.warn('Falha ao atualizar acesso às notificações:', e);
        }

        // Exibir prompt de matrícula para usuários antigos sem matrícula
        try {
            const needsMatricula = !this.userData.matricula;
            if (needsMatricula) {
                const modalEl = document.getElementById('matriculaPromptModal');
                const inputEl = document.getElementById('matriculaPromptInput');
                const errorEl = document.getElementById('matriculaPromptError');
                const saveBtn = document.getElementById('matriculaPromptSave');
                if (modalEl && inputEl && saveBtn) {
                    let bsModal = null;
                    const backdropId = 'matriculaPromptBackdrop';
                    const showFallback = () => {
                        modalEl.classList.add('show');
                        modalEl.style.display = 'block';
                        modalEl.removeAttribute('aria-hidden');
                        modalEl.setAttribute('aria-modal', 'true');
                        // criar backdrop
                        if (!document.getElementById(backdropId)) {
                            const bd = document.createElement('div');
                            bd.id = backdropId;
                            bd.className = 'modal-backdrop fade show';
                            document.body.appendChild(bd);
                        }
                    };
                    const hideFallback = () => {
                        modalEl.classList.remove('show');
                        modalEl.style.display = 'none';
                        modalEl.setAttribute('aria-hidden', 'true');
                        modalEl.removeAttribute('aria-modal');
                        const bd = document.getElementById(backdropId);
                        if (bd) bd.remove();
                    };
                    const showModal = () => {
                        if (window.bootstrap && bootstrap.Modal) {
                            bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
                            bsModal.show();
                        } else {
                            showFallback();
                        }
                    };
                    const hideModal = () => {
                        if (bsModal) {
                            bsModal.hide();
                        } else {
                            hideFallback();
                        }
                    };

                    showModal();
                    saveBtn.onclick = async () => {
                        const matricula = (inputEl.value || '').trim();
                        if (!matricula) {
                            if (errorEl) { errorEl.textContent = 'Informe sua matrícula.'; errorEl.style.display = 'block'; }
                            return;
                        }
                        saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';
                        try {
                            // Validar matrícula com Firestore
                            const accepted = await this.isMatriculaAccepted(matricula);
                            const patch = { matricula, accepted: !!accepted };
                            await this.db.collection('users').doc(this.currentUser.uid).update(patch);
                            this.userData = { ...this.userData, ...patch };
                            if (errorEl) errorEl.style.display = 'none';
                            hideModal();
                            // Atualizar UI e menus conforme accepted
                            this.showUserInterface();
                        } catch (err) {
                            console.error('Erro ao salvar matrícula:', err);
                            if (errorEl) { errorEl.textContent = 'Erro ao validar/salvar matrícula.'; errorEl.style.display = 'block'; }
                        } finally {
                            saveBtn.disabled = false; saveBtn.textContent = 'Salvar';
                        }
                    };
                }
            }
        } catch(e) {
            console.warn('Falha ao exibir prompt de matrícula:', e);
        }
    }

    // Reuso da verificação de matrícula aceita (mesma lógica do auth.js)
    async isMatriculaAccepted(matricula) {
        try {
            // 1) Coleção: 'matriculas_aceitas' com docs por matrícula
            const colRef = this.db.collection('matriculas_aceitas');
            const snap = await colRef.limit(1).get();
            if (!snap.empty) {
                const docRef = await this.db.collection('matriculas_aceitas').doc(matricula).get();
                if (docRef.exists) return true;
            }
            // 2) Documento único config/matriculas_aceitas com array
            const cfgDoc = await this.db.collection('config').doc('matriculas_aceitas').get();
            if (cfgDoc.exists) {
                const data = cfgDoc.data();
                const arr = Array.isArray(data?.lista) ? data.lista : (Array.isArray(data?.matriculas) ? data.matriculas : null);
                if (arr && arr.includes(matricula)) return true;
            }
        } catch (e) {
            console.warn('Falha ao checar matriculas_aceitas (main-auth):', e);
        }
        return false;
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
    // Não redirecionar se estivermos no fluxo blocked
    if (sessionStorage.getItem('blockedUid')) return;
        window.isRedirecting = true;
        
        console.log('🔄 Redirecionando para página de login...');
        
        // Mostrar mensagem de carregamento antes de redirecionar
        this.showAuthLoading();
        
    // Redirecionar imediatamente se já estivermos tentando
    safeNavigate('login.html', true);
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

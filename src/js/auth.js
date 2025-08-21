// Sistema de Autenticação Firebase
class AuthSystem {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.currentUser = null;
        this.init();
    }

    init() {
        // Verificar se estamos na página de login antes de tentar acessar elementos
        if (this.isLoginPage()) {
            this.initLoginElements();
        }

        // Verificar se já está logado
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                
                // Verificar se a conta está bloqueada
                await this.checkUserStatus(user);
                
                if (this.isLoginPage()) {
                    this.redirectToApp();
                }
            }
        });
    }

    isLoginPage() {
        return document.getElementById('authForm') !== null;
    }

    initLoginElements() {
        // Elementos do DOM (só para página de login)
        this.authForm = document.getElementById('authForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.confirmPasswordInput = document.getElementById('confirmPassword');
        this.fullNameInput = document.getElementById('fullName');
        this.isRegisterModeCheckbox = document.getElementById('isRegisterMode');
        this.submitBtn = document.getElementById('submitBtn');
        this.togglePasswordBtn = document.getElementById('togglePassword');
        this.forgotPasswordLink = document.getElementById('forgotPassword');
        this.alertContainer = document.getElementById('alertContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
        this.nameGroup = document.getElementById('nameGroup');

        // Event listeners apenas se estamos na página de login
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Verificar se os elementos existem antes de adicionar listeners (defensivo)
        try {
            if (this.authForm) {
                this.authForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleFormSubmit();
                });
            }
        } catch (err) {
            console.warn('Falha ao adicionar listener em authForm:', err);
        }

        try {
            if (this.isRegisterModeCheckbox) {
                this.isRegisterModeCheckbox.addEventListener('change', () => {
                    this.toggleMode();
                });
            }
        } catch (err) {
            console.warn('Falha ao adicionar listener em isRegisterModeCheckbox:', err);
        }

        try {
            if (this.togglePasswordBtn) {
                this.togglePasswordBtn.addEventListener('click', () => {
                    this.togglePasswordVisibility();
                });
            }
        } catch (err) {
            console.warn('Falha ao adicionar listener em togglePasswordBtn:', err);
        }

        try {
            if (this.forgotPasswordLink) {
                this.forgotPasswordLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleForgotPassword();
                });
            }
        } catch (err) {
            console.warn('Falha ao adicionar listener em forgotPasswordLink:', err);
        }
    }

    toggleMode() {
        const isRegister = this.isRegisterModeCheckbox.checked;
        
        if (isRegister) {
            this.confirmPasswordGroup.classList.remove('d-none');
            this.nameGroup.classList.remove('d-none');
            this.submitBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Criar Conta';
            this.confirmPasswordInput.required = true;
            this.fullNameInput.required = true;
        } else {
            this.confirmPasswordGroup.classList.add('d-none');
            this.nameGroup.classList.add('d-none');
            this.submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Entrar';
            this.confirmPasswordInput.required = false;
            this.fullNameInput.required = false;
        }
    }

    togglePasswordVisibility() {
        const type = this.passwordInput.type === 'password' ? 'text' : 'password';
        this.passwordInput.type = type;
        
        const icon = this.togglePasswordBtn.querySelector('i');
        icon.className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    }

    async handleFormSubmit() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        const isRegister = this.isRegisterModeCheckbox.checked;

        // Validações básicas
        if (!email || !password) {
            this.showAlert('Por favor, preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        if (password.length < 6) {
            this.showAlert('A senha deve ter pelo menos 6 caracteres.', 'warning');
            return;
        }

        if (isRegister) {
            await this.handleRegister(email, password);
        } else {
            await this.handleLogin(email, password);
        }
    }

    async handleLogin(email, password) {
        this.showLoading(true);
        
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            this.showAlert('Login realizado com sucesso!', 'success');
            
            // Verificar dados do usuário no Firestore
            await this.checkUserData(userCredential.user);
            
            // Redirecionar será feito pelo onAuthStateChanged
        } catch (error) {
            console.error('Erro no login:', error);
            this.showAlert(this.getErrorMessage(error.code), 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister(email, password) {
        const confirmPassword = this.confirmPasswordInput.value;
        const fullName = this.fullNameInput.value.trim();

        // Validações adicionais para registro
        if (password !== confirmPassword) {
            this.showAlert('As senhas não coincidem.', 'warning');
            return;
        }

        if (!fullName) {
            this.showAlert('Por favor, informe seu nome completo.', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            // Criar usuário no Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Atualizar perfil com nome
            await user.updateProfile({
                displayName: fullName
            });

            // Criar documento do usuário no Firestore
            await this.createUserDocument(user, {
                fullName: fullName,
                email: email,
                role: 'user', // Por padrão, novos usuários são 'user'
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showAlert('Conta criada com sucesso!', 'success');
            
            // Redirecionar será feito pelo onAuthStateChanged
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showAlert(this.getErrorMessage(error.code), 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async createUserDocument(user, userData) {
        try {
            await this.db.collection('users').doc(user.uid).set(userData);
            console.log('Documento do usuário criado com sucesso');
        } catch (error) {
            console.error('Erro ao criar documento do usuário:', error);
            throw error;
        }
    }

    async checkUserData(user) {
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Se o documento não existe, criar um com dados básicos
                await this.createUserDocument(user, {
                    fullName: user.displayName || 'Usuário',
                    email: user.email,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Atualizar último login
                await this.db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Erro ao verificar dados do usuário:', error);
        }
    }

    async checkUserStatus(user) {
        // Evitar verificações simultâneas
        if (window.isCheckingBlockedAccount) {
            return;
        }
        
        window.isCheckingBlockedAccount = true;
        
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Se a conta está bloqueada, mostrar tela de bloqueio
                if (userData.disabled === true) {
                    this.showBlockedAccountScreen(user, userData);
                    return;
                }
            }
        } catch (error) {
            console.error('Erro ao verificar status do usuário:', error);
        } finally {
            // Reset flag após verificação
            setTimeout(() => {
                window.isCheckingBlockedAccount = false;
            }, 2000);
        }
    }

    showBlockedAccountScreen(user, userData) {
        // Store blocked info and redirect to dedicated blocked page
        try {
            sessionStorage.setItem('blockedUid', user.uid);
            sessionStorage.setItem('blockedEmail', user.email || (userData && userData.email) || '');
            // Avoid navigation loop: if already on blocked.html, just set the blocked flow flag
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPage === 'blocked.html') {
                try { sessionStorage.setItem('blockedFlowActive', '1'); } catch (e) {}
                return;
            }
            window.allowRedirect = true;
            window.location.href = 'blocked.html';
            window.allowRedirect = false;
        } catch (e) {
            console.error('Erro ao redirecionar para blocked.html:', e);
            this.createBlockedAccountModal(user, userData);
        }
    }

    createBlockedAccountModal(user, userData) {
        // Remove modal existente se houver
        const existingModal = document.getElementById('blockedAccountModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Definir flag global
        window.isBlockedAccountModalActive = true;

        const modalHTML = `
            <div class="modal fade show" id="blockedAccountModal" tabindex="-1" 
                 style="display: block !important; background: rgba(0,0,0,0.9); z-index: 9999;">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-danger">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                Conta Bloqueada
                            </h5>
                        </div>
                        <div class="modal-body text-center py-4">
                            <div class="mb-4">
                                <i class="bi bi-lock-fill text-danger" style="font-size: 4rem;"></i>
                            </div>
                            <h4 class="text-danger mb-3">Sua conta foi bloqueada</h4>
                            <p class="mb-4">
                                Sua conta (<strong>${user.email}</strong>) foi bloqueada por um administrador.
                                Isso pode ter ocorrido devido a violações das políticas de uso ou outras questões administrativas.
                            </p>
                            <div class="alert alert-warning">
                                <strong>Opções:</strong><br>
                                Você pode solicitar a exclusão completa da sua conta e dados abaixo.
                            </div>
                        </div>
                        <div class="modal-footer justify-content-center">
                                <button type="button" class="btn btn-danger me-2" id="deleteAccountBtn">
                                    <i class="bi bi-trash me-2"></i>Excluir minha conta e dados
                                </button>
                                <button type="button" class="btn btn-primary" id="goToLoginBtn">
                                    <i class="bi bi-arrow-left me-2"></i>Voltar ao Login
                                </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Adicionar event listener para o botão de exclusão
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const ok = confirm('Tem certeza? Isso removerá permanentemente seus dados e a conta do Authentication quando possível.');
                if (!ok) return;
                const user = firebase.auth().currentUser;
                if (!user) {
                    alert('Você precisa estar autenticado para excluir sua conta. Entre em contato com o administrador se necessário.');
                    return;
                }
                await window.deleteAccountCompletely(user.uid);
            });
        }

        // Adicionar event listener para o botão voltar ao login
        document.getElementById('goToLoginBtn').addEventListener('click', () => {
            window.isBlockedAccountModalActive = false;
            window.allowRedirect = true; // Permitir redirecionamento
            // Sign out if still signed in
                if (firebase.auth().currentUser) {
                firebase.auth().signOut().catch(()=>{}).finally(()=>{
                    safeNavigate('login.html', true);
                    window.allowRedirect = false; // Resetar flag
                });
            } else {
                safeNavigate('login.html', true);
                window.allowRedirect = false;
            }
        });
        
        // Prevenir fechamento do modal por cliques ou teclas
        const modal = document.getElementById('blockedAccountModal');
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        
        // Desabilitar tecla ESC
        document.addEventListener('keydown', function preventEscape(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Garantir que o modal permaneça visível
        setTimeout(() => {
            const modalCheck = document.getElementById('blockedAccountModal');
            if (modalCheck) {
                modalCheck.style.display = 'block';
                modalCheck.style.zIndex = '9999';
            }
        }, 100);
    }

    async handleForgotPassword() {
        // Redirect to dedicated reset page and prefill email if available
        const email = (this.emailInput && this.emailInput.value) ? this.emailInput.value.trim() : '';
        const target = 'reset-password.html' + (email ? ('?email=' + encodeURIComponent(email)) : '');
        try {
            window.location.href = target;
        } catch (e) {
            // fallback: attempt to send directly
            if (!email) {
                this.showAlert('Por favor, digite seu email primeiro.', 'warning');
                return;
            }
            try {
                await this.auth.sendPasswordResetEmail(email);
                this.showAlert('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
            } catch (error) {
                console.error('Erro ao enviar email de recuperação:', error);
                this.showAlert(this.getErrorMessage(error.code), 'danger');
            }
        }
    }

    redirectToApp() {
        // Redirecionar para a página principal
        window.location.href = 'index.html';
    }

    showAlert(message, type) {
        const alertId = 'alert-' + Date.now();
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        this.alertContainer.innerHTML = alertHTML;
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                alertElement.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.remove('d-none');
            this.authForm.classList.add('d-none');
        } else {
            this.loadingOverlay.classList.add('d-none');
            this.authForm.classList.remove('d-none');
        }
    }

    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'Usuário não encontrado. Verifique o email ou crie uma nova conta.',
            'auth/wrong-password': 'Senha incorreta. Tente novamente.',
            'auth/email-already-in-use': 'Este email já está sendo usado por outra conta.',
            'auth/weak-password': 'A senha é muito fraca. Use pelo menos 6 caracteres.',
            'auth/invalid-email': 'Email inválido. Verifique o formato do email.',
            'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
            'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
            'auth/user-disabled': 'Esta conta foi desabilitada.',
            'auth/operation-not-allowed': 'Operação não permitida.',
            'auth/invalid-credential': 'Credenciais inválidas. Verifique email e senha.',
            'default': 'Ocorreu um erro inesperado. Tente novamente.'
        };

        return errorMessages[errorCode] || errorMessages['default'];
    }
}

// Verificar se os elementos existem antes de inicializar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('authForm')) {
        window.authSystem = new AuthSystem();
    }
});

// Função global para logout (será usada em outras páginas)
window.logout = async function() {
    try {
        // If blocked flow is active, avoid redirecting to login (let blocked page handle it)
        if (sessionStorage.getItem('blockedUid')) {
            console.log('Blocked flow active - logout will not redirect to login');
            await firebase.auth().signOut();
            return;
        }
    await firebase.auth().signOut();
    safeNavigate('login.html', true);
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
};

// Função global para verificar se usuário está logado
window.checkAuth = function() {
    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resolve(user);
            } else {
                reject('Usuário não está logado');
            }
        });
    });
};

// Função global para obter dados do usuário atual
window.getCurrentUserData = async function() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Usuário não está logado');

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (!userDoc.exists) throw new Error('Dados do usuário não encontrados');

        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            ...userDoc.data()
        };
    } catch (error) {
        console.error('Erro ao obter dados do usuário:', error);
        throw error;
    }
};

// Função global para verificar se é administrador
window.isAdmin = async function() {
    try {
        const userData = await getCurrentUserData();
        return userData.role === 'admin';
    } catch (error) {
        console.error('Erro ao verificar se é admin:', error);
        return false;
    }
};

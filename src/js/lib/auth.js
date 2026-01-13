// ========================================
// SISTEMA DE AUTENTICAÇÃO FIREBASE
// ========================================
class AuthSystem {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.currentUser = null;
        this.init();
    }

    // ========================================
    // INICIALIZAÇÃO DO SISTEMA
    // ========================================
    init() {
        if (this.isLoginPage()) {
            this.initLoginElements();
        }

        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
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
        this.matriculaGroup = document.getElementById('matriculaGroup');
        this.matriculaInput = document.getElementById('registrationMatricula');

        this.setupEventListeners();
    }

    setupEventListeners() {
        try {
            if (this.authForm) {
                this.authForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleFormSubmit();
                });
            }
            if (this.isRegisterModeCheckbox) {
                this.isRegisterModeCheckbox.addEventListener('change', () => this.toggleMode());
            }
            if (this.togglePasswordBtn) {
                this.togglePasswordBtn.addEventListener('click', () => this.togglePasswordVisibility());
            }
            if (this.forgotPasswordLink) {
                this.forgotPasswordLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleForgotPassword();
                });
            }
        } catch (err) {
            console.warn('Falha ao adicionar listeners:', err);
        }
    }

    toggleMode() {
        const isRegister = this.isRegisterModeCheckbox.checked;
        
        if (isRegister) {
            this.confirmPasswordGroup.classList.remove('d-none');
            this.nameGroup.classList.remove('d-none');
            if (this.matriculaGroup) this.matriculaGroup.classList.remove('d-none');
            this.submitBtn.innerHTML = '<i class="bi bi-person-plus me-2"></i>Criar Conta';
            this.confirmPasswordInput.required = true;
            this.fullNameInput.required = true;
            if (this.matriculaInput) this.matriculaInput.required = true;
        } else {
            this.confirmPasswordGroup.classList.add('d-none');
            this.nameGroup.classList.add('d-none');
            if (this.matriculaGroup) this.matriculaGroup.classList.add('d-none');
            this.submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Entrar';
            this.confirmPasswordInput.required = false;
            this.fullNameInput.required = false;
            if (this.matriculaInput) this.matriculaInput.required = false;
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
            await this.checkUserData(userCredential.user);
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
        const matricula = (this.matriculaInput?.value || '').trim();

        if (password !== confirmPassword) {
            this.showAlert('As senhas não coincidem.', 'warning');
            return;
        }

        if (!fullName) {
            this.showAlert('Por favor, informe seu nome completo.', 'warning');
            return;
        }

        if (!matricula) {
            this.showAlert('Por favor, informe sua matrícula.', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            // Validar matrícula antes de criar conta no Auth
            const accepted = await this.isMatriculaAccepted(matricula);
            
            // Se você quiser BLOQUEAR o registro de matrículas não aceitas, descomente a linha abaixo:
            // if (!accepted) throw new Error('Matrícula não autorizada.');

            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await user.updateProfile({ displayName: fullName });

            await this.createUserDocument(user, {
                fullName: fullName,
                email: email,
                role: 'user',
                matricula: matricula,
                accepted: accepted === true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showAlert('Conta criada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no registro:', error);
            const msg = error.message === 'Matrícula não autorizada.' ? error.message : this.getErrorMessage(error.code);
            this.showAlert(msg, 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Verifica se a matrícula é aceita.
     * VERSÃO SEGURA: Busca direta pelo documento ID em vez de listar todos.
     */
    async isMatriculaAccepted(matricula) {
        if (!matricula) return false;
        try {
            // Verifica na coleção 'matriculas_aceitas' procurando pelo DOC ID igual à matrícula
            const docRef = await this.db.collection('matriculas_aceitas').doc(matricula).get();
            
            if (docRef.exists) {
                // Se o documento existe, a matrícula é válida
                return true;
            }
            
            // Fallback opcional para coleção 'matriculas' (se estiver usando outro nome)
            // ou retornar falso imediatamente para máxima segurança.
            console.log('Matrícula não encontrada na base de aceitas:', matricula);
            return false;
        } catch (e) {
            console.error('Erro ao validar matrícula:', e);
            return false;
        }
    }

    async createUserDocument(user, userData) {
        try {
            await this.db.collection('users').doc(user.uid).set(userData);
        } catch (error) {
            console.error('Erro ao criar documento do usuário:', error);
            throw error;
        }
    }

    async checkUserData(user) {
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                await this.createUserDocument(user, {
                    fullName: user.displayName || 'Usuário',
                    email: user.email,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await this.db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Erro ao verificar dados do usuário:', error);
        }
    }

    async checkUserStatus(user) {
        if (window.isCheckingBlockedAccount) return;
        window.isCheckingBlockedAccount = true;
        
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.disabled === true) {
                    this.showBlockedAccountScreen(user, userData);
                    return;
                }
            }
        } catch (error) {
            console.error('Erro ao verificar status do usuário:', error);
        } finally {
            setTimeout(() => { window.isCheckingBlockedAccount = false; }, 2000);
        }
    }

    showBlockedAccountScreen(user, userData) {
        try {
            sessionStorage.setItem('blockedUid', user.uid);
            sessionStorage.setItem('blockedEmail', user.email || (userData && userData.email) || '');
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPage === 'blocked.html') {
                try { sessionStorage.setItem('blockedFlowActive', '1'); } catch (e) {}
                return;
            }
            window.allowRedirect = true;
            window.location.href = 'blocked.html';
            window.allowRedirect = false;
        } catch (e) {
            console.error('Erro ao redirecionar:', e);
            this.createBlockedAccountModal(user, userData);
        }
    }

    createBlockedAccountModal(user, userData) {
        // ... (Mesma implementação do original para manter compatibilidade caso redirecionamento falhe) ...
        const existingModal = document.getElementById('blockedAccountModal');
        if (existingModal) existingModal.remove();
        window.isBlockedAccountModalActive = true;
        const modalHTML = `
            <div class="modal fade show" id="blockedAccountModal" tabindex="-1" style="display: block !important; background: rgba(0,0,0,0.9); z-index: 9999;">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-danger">
                        <div class="modal-header bg-danger text-white"><h5 class="modal-title">Conta Bloqueada</h5></div>
                        <div class="modal-body text-center py-4">
                            <h4 class="text-danger">Sua conta foi bloqueada</h4>
                            <p>Entre em contato com o administrador.</p>
                        </div>
                        <div class="modal-footer justify-content-center">
                             <button class="btn btn-primary" id="goToLoginBtn">Voltar ao Login</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('goToLoginBtn').addEventListener('click', () => {
            window.isBlockedAccountModalActive = false;
            window.allowRedirect = true;
            if (firebase.auth().currentUser) {
                firebase.auth().signOut().then(() => { window.location.href = 'login.html'; });
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async handleForgotPassword() {
        const email = (this.emailInput && this.emailInput.value) ? this.emailInput.value.trim() : '';
        const target = 'reset-password.html' + (email ? ('?email=' + encodeURIComponent(email)) : '');
        try { window.location.href = target; } catch (e) {}
    }

    redirectToApp() {
        window.location.href = 'index.html';
    }

    showAlert(message, type) {
        const alertId = 'alert-' + Date.now();
        const alertHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
        this.alertContainer.innerHTML = alertHTML;
        setTimeout(() => { const el = document.getElementById(alertId); if (el) el.remove(); }, 5000);
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
        const messages = {
            'auth/user-not-found': 'Usuário não encontrado.',
            'auth/wrong-password': 'Senha incorreta.',
            'auth/email-already-in-use': 'Email já em uso.',
            'auth/weak-password': 'Senha muito fraca.',
            'auth/invalid-email': 'Email inválido.',
            'default': 'Ocorreu um erro inesperado.'
        };
        return messages[errorCode] || messages['default'];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('authForm')) {
        window.authSystem = new AuthSystem();
    }
});

// Helpers globais
window.logout = async function() {
    try {
        if (sessionStorage.getItem('blockedUid')) {
            await firebase.auth().signOut();
            return;
        }
        await firebase.auth().signOut();
        window.location.href = 'login.html';
    } catch (error) { console.error('Erro logout:', error); }
};

window.checkAuth = function() {
    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => user ? resolve(user) : reject('Não logado'));
    });
};
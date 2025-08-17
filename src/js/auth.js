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
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
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

    async handleForgotPassword() {
        const email = this.emailInput.value.trim();
        
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
        await firebase.auth().signOut();
        window.location.href = 'login.html';
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

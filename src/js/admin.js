// Sistema de Administração
class AdminSystem {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.users = [];
        this.filteredUsers = [];
        this.auditLogs = [];
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            // Verificar autenticação
            await this.checkAuthentication();
            
            // Verificar se é admin
            await this.checkAdminAccess();
            
            // Inicializar interface
            this.setupEventListeners();
            
            // Carregar dados
            await this.loadUsers();
            
            this.showAdminContent();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showAccessDenied();
        }
    }

    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    resolve(user);
                } else {
                    // Redirecionar para login
                    window.location.href = 'login.html';
                    reject('Usuário não autenticado');
                }
            });
        });
    }

    async checkAdminAccess() {
        try {
            const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
            
            if (!userDoc.exists) {
                throw new Error('Dados do usuário não encontrados');
            }
            
            const userData = userDoc.data();
            if (userData.role !== 'admin') {
                throw new Error('Usuário não é administrador');
            }
            
            // Log de acesso admin para auditoria
            console.log(`Admin access granted to: ${this.currentUser.email} at ${new Date().toISOString()}`);
            
            // Verificação dupla: confirmar no servidor
            await this.verifyAdminOnServer();
            
        } catch (error) {
            console.error('Acesso negado:', error.message);
            throw new Error('Acesso negado - Apenas administradores podem acessar esta página');
        }
    }

    async verifyAdminOnServer() {
        try {
            // Tentar uma operação que só admins podem fazer
            const testQuery = await this.db.collection('users').limit(1).get();
            if (testQuery.empty) {
                // Se não conseguir ler usuários, não é admin
                throw new Error('Verificação de admin falhou');
            }
        } catch (error) {
            if (error.code === 'permission-denied') {
                throw new Error('Permissões insuficientes - não é administrador');
            }
            throw error;
        }
    }

    setupEventListeners() {
        // Busca de usuários
        document.getElementById('searchUsers').addEventListener('input', () => {
            this.filterUsers();
        });

        // Filtro por role
        document.getElementById('filterRole').addEventListener('change', () => {
            this.filterUsers();
        });

        // Ordenação
        document.getElementById('sortBy').addEventListener('change', () => {
            this.sortAndDisplayUsers();
        });
    }

    async loadUsers() {
        try {
            const usersSnapshot = await this.db.collection('users').get();
            
            this.users = [];
            usersSnapshot.forEach(doc => {
                this.users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.filteredUsers = [...this.users];
            this.updateStats();
            this.sortAndDisplayUsers();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            this.showAlert('Erro ao carregar usuários', 'danger');
        }
    }

    filterUsers() {
        const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
        const roleFilter = document.getElementById('filterRole').value;

        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.fullName?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm);
            
            const matchesRole = !roleFilter || user.role === roleFilter;

            return matchesSearch && matchesRole;
        });

        this.sortAndDisplayUsers();
    }

    sortAndDisplayUsers() {
        const sortBy = document.getElementById('sortBy').value;
        
        this.filteredUsers.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            // Handle Firestore timestamps
            if (aValue && aValue.toDate) aValue = aValue.toDate();
            if (bValue && bValue.toDate) bValue = bValue.toDate();

            // Handle different data types
            if (typeof aValue === 'string') {
                return aValue.localeCompare(bValue);
            } else if (aValue instanceof Date) {
                return bValue - aValue; // Most recent first
            }

            return 0;
        });

        this.displayUsers();
    }

    displayUsers() {
        const container = document.getElementById('usersContainer');
        
        if (this.filteredUsers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-people display-1 text-muted"></i>
                    <p class="text-muted mt-2">Nenhum usuário encontrado</p>
                </div>
            `;
            return;
        }

        const usersHTML = this.filteredUsers.map(user => this.createUserCard(user)).join('');
        container.innerHTML = usersHTML;
    }

    createUserCard(user) {
        const isCurrentUser = user.id === this.currentUser.uid;
        const lastLogin = user.lastLogin ? this.formatDate(user.lastLogin) : 'Nunca';
        const createdAt = user.createdAt ? this.formatDate(user.createdAt) : 'Data não disponível';
        
        return `
            <div class="card user-card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center" 
                                         style="width: 50px; height: 50px;">
                                        <i class="bi bi-person-fill text-white"></i>
                                    </div>
                                </div>
                                <div>
                                    <h6 class="mb-1">${user.fullName || 'Nome não disponível'}</h6>
                                    <p class="text-muted mb-0">${user.email}</p>
                                    ${isCurrentUser ? '<span class="badge bg-info">Você</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-secondary'} role-badge">
                                ${user.role === 'admin' ? 'Admin' : 'Usuário'}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <small class="text-muted">
                                <div>Criado: ${createdAt}</div>
                                <div>Último login: ${lastLogin}</div>
                            </small>
                        </div>
                        <div class="col-md-2">
                            <div class="btn-group btn-group-sm" role="group">
                                ${!isCurrentUser ? `
                                    <button class="btn btn-outline-${user.role === 'admin' ? 'warning' : 'success'} btn-role-toggle"
                                            onclick="adminSystem.changeUserRole('${user.id}', '${user.role === 'admin' ? 'user' : 'admin'}')">
                                        <i class="bi bi-shield${user.role === 'admin' ? '-slash' : '-check'}"></i>
                                        ${user.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                                    </button>
                                ` : `
                                    <button class="btn btn-outline-secondary" disabled>
                                        <i class="bi bi-person-check"></i> Você
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async changeUserRole(userId, newRole) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Verificação de segurança: não permitir auto-promoção/rebaixamento
        if (userId === this.currentUser.uid) {
            this.showAlert('Erro: Você não pode alterar seu próprio role por segurança.', 'danger');
            return;
        }

        const action = newRole === 'admin' ? 'promover a administrador' : 'remover privilégios de administrador';
        
        this.showConfirmModal(
            `Tem certeza que deseja ${action} o usuário "${user.fullName}"?`,
            async () => {
                try {
                    // Log da operação para auditoria
                    const auditLog = {
                        action: 'role_change',
                        adminId: this.currentUser.uid,
                        adminEmail: this.currentUser.email,
                        targetUserId: userId,
                        targetUserEmail: user.email,
                        oldRole: user.role,
                        newRole: newRole,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        ip: 'browser_session' // Em produção, você pode capturar o IP real
                    };

                    // Atualizar role do usuário
                    await this.db.collection('users').doc(userId).update({
                        role: newRole,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: this.currentUser.uid
                    });

                    // Salvar log de auditoria
                    await this.db.collection('admin_logs').add(auditLog);

                    console.log(`Admin ${this.currentUser.email} changed role of ${user.email} from ${user.role} to ${newRole}`);

                    this.showAlert(`Usuário ${action === 'promover a administrador' ? 'promovido' : 'rebaixado'} com sucesso!`, 'success');
                    
                    // Recarregar lista
                    await this.loadUsers();
                } catch (error) {
                    console.error('Erro ao alterar role do usuário:', error);
                    this.showAlert('Erro ao alterar permissões do usuário. Verifique suas permissões de administrador.', 'danger');
                }
            }
        );
    }

    updateStats() {
        const totalUsers = this.users.length;
        const totalAdmins = this.users.filter(u => u.role === 'admin').length;
        const totalRegularUsers = this.users.filter(u => u.role === 'user').length;
        
        // Usuários que fizeram login hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const onlineToday = this.users.filter(u => {
            if (!u.lastLogin) return false;
            const lastLogin = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
            return lastLogin >= today;
        }).length;

        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalAdmins').textContent = totalAdmins;
        document.getElementById('totalRegularUsers').textContent = totalRegularUsers;
        document.getElementById('onlineUsers').textContent = onlineToday;
    }

    showConfirmModal(message, onConfirm) {
        document.getElementById('confirmModalBody').innerHTML = message;
        
        const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
        modal.show();

        // Remove previous event listeners
        const confirmBtn = document.getElementById('confirmActionBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        // Add new event listener
        newConfirmBtn.addEventListener('click', () => {
            modal.hide();
            onConfirm();
        });
    }

    showAdminContent() {
        document.getElementById('loadingContainer').classList.add('d-none');
        document.getElementById('adminContent').classList.remove('d-none');
    }

    showAccessDenied() {
        document.getElementById('loadingContainer').classList.add('d-none');
        document.getElementById('accessDeniedContainer').classList.remove('d-none');
    }

    showAlert(message, type) {
        // Criar e mostrar alert temporário
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 1050;" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHTML);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            const alerts = document.querySelectorAll('.alert');
            if (alerts.length > 0) {
                alerts[alerts.length - 1].remove();
            }
        }, 5000);
    }

    formatDate(timestamp) {
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch (error) {
            return 'Data inválida';
        }
    }

    // Método para carregar logs de auditoria
    async loadAuditLogs() {
        try {
            const logsSnapshot = await this.db.collection('admin_logs')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            this.auditLogs = [];
            logsSnapshot.forEach(doc => {
                this.auditLogs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.displayAuditLogs();
        } catch (error) {
            console.error('Erro ao carregar logs de auditoria:', error);
            this.showAuditLogsError();
        }
    }

    // Método para exibir logs de auditoria
    displayAuditLogs() {
        const container = document.getElementById('auditLogsContainer');
        
        if (this.auditLogs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-journal-text display-4 text-muted"></i>
                    <p class="text-muted mt-2">Nenhum log de auditoria encontrado</p>
                    <small class="text-muted">Os logs aparecerão aqui quando ações administrativas forem realizadas</small>
                </div>
            `;
            return;
        }

        const logsHTML = this.auditLogs.map(log => this.createLogEntry(log)).join('');
        container.innerHTML = `
            <div class="audit-logs-list">
                ${logsHTML}
            </div>
        `;
    }

    // Método para criar entrada de log
    createLogEntry(log) {
        const timestamp = log.timestamp ? this.formatDate(log.timestamp) : 'Data não disponível';
        const actionIcon = this.getActionIcon(log.action);
        const actionColor = this.getActionColor(log.newRole);
        
        return `
            <div class="card mb-2 border-start border-${actionColor} border-3">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-center">
                            <i class="bi ${actionIcon} text-${actionColor} me-3"></i>
                            <div>
                                <strong>Mudança de Permissão</strong>
                                <p class="mb-1 small">
                                    <strong>${log.adminEmail}</strong> ${log.newRole === 'admin' ? 'promoveu' : 'rebaixou'} 
                                    <strong>${log.targetUserEmail}</strong> 
                                    ${log.newRole === 'admin' ? 'a administrador' : 'para usuário comum'}
                                </p>
                                <small class="text-muted">
                                    ${log.oldRole} → ${log.newRole} | ${timestamp}
                                </small>
                            </div>
                        </div>
                        <span class="badge bg-${actionColor}">${log.newRole.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Método para obter ícone da ação
    getActionIcon(action) {
        switch (action) {
            case 'role_change':
                return 'bi-shield-check';
            default:
                return 'bi-info-circle';
        }
    }

    // Método para obter cor da ação
    getActionColor(newRole) {
        return newRole === 'admin' ? 'success' : 'warning';
    }

    // Método para mostrar erro nos logs
    showAuditLogsError() {
        const container = document.getElementById('auditLogsContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Erro ao carregar logs de auditoria. Tente novamente.
            </div>
        `;
    }
}

// Função global para atualizar lista de usuários
window.refreshUserList = async function() {
    if (window.adminSystem) {
        await window.adminSystem.loadUsers();
    }
};

// Função global para atualizar logs de auditoria
window.refreshAuditLogs = async function() {
    if (window.adminSystem) {
        await window.adminSystem.loadAuditLogs();
    }
};

// Inicializar sistema admin quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.adminSystem = new AdminSystem();
    } catch (error) {
        console.error('Erro ao inicializar AdminSystem:', error);
        // Mostrar mensagem amigável
        const body = document.body || document.documentElement;
        if (body) {
            body.insertAdjacentHTML('afterbegin', '<div class="alert alert-danger m-3">Erro ao iniciar painel administrativo. Verifique o console para mais detalhes.</div>');
        }
    }
});

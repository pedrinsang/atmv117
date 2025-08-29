// ========================================
// SISTEMA DE ADMINISTRAÇÃO
// ========================================
class AdminSystem {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.users = [];
        this.filteredUsers = [];
        this.auditLogs = [];
        this.complaints = [];
        this.showOnlyUnread = false;
        this.currentUser = null;
        this.init();
    }

    // ========================================
    // INICIALIZAÇÃO DO SISTEMA ADMIN
    // ========================================
    async init() {
        try {
            // Verificar se usuário está autenticado
            await this.checkAuthentication();
            
            // Verificar se usuário possui acesso administrativo
            await this.checkAdminAccess();
            
            // Configurar eventos da interface
            this.setupEventListeners();
            
            // ========================================
            // CARREGAMENTO DE DADOS ADMINISTRATIVOS
            // ========================================
            // Carregar lista de usuários
            await this.loadUsers();
            // Carregar logs de auditoria
            await this.loadAuditLogs();
            
            // ========================================
            // SUBSCRIÇÕES E PAINÉIS ADMINISTRATIVOS
            // ========================================
            // Subscrever para links da turma
            this.subscribeClassLinksAdmin();
            // Subscrever para reclamações
            this.subscribeComplaints();

            // ========================================
            // CONFIGURAÇÃO DE BOTÕES ADMINISTRATIVOS
            // ========================================
            // Botão para adicionar link da turma
            const addBtn = document.getElementById('adminAddClassLinkBtn');
            if (addBtn) addBtn.addEventListener('click', ()=>{ if (typeof openEditLinkModal === 'function') openEditLinkModal(null); else this.openAdminEditLink(null); });
            
            // Botão para atualizar reclamações
            const refreshCompl = document.getElementById('refreshComplaintsBtn');
            if (refreshCompl) refreshCompl.addEventListener('click', ()=> this.subscribeComplaints());
            
            // Botão para atualizar links
            const refreshLinksBtn = document.getElementById('adminRefreshLinksBtn');
            if (refreshLinksBtn) refreshLinksBtn.addEventListener('click', ()=> { this.subscribeClassLinksAdmin(); this.showAlert('Links atualizados', 'success'); });
            
            // Botão para filtrar reclamações
            const toggleFilterBtn = document.getElementById('toggleComplaintsFilterBtn');
            if (toggleFilterBtn) toggleFilterBtn.addEventListener('click', ()=>{ this.showOnlyUnread = !this.showOnlyUnread; toggleFilterBtn.textContent = this.showOnlyUnread ? 'Mostrar todas' : 'Apenas não-lidas'; this.renderComplaints(); });

            // Exibir conteúdo administrativo
            this.showAdminContent();
        } catch (error) {
            console.error('Erro na inicialização do sistema administrativo:', error);
            this.showAccessDenied();
        }
    }

    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    
                    // Não verificar mais conta bloqueada aqui - deixar para auth.js e app.js
                    resolve(user);
                } else {
                    // Verificar se há modal de conta bloqueada ativo antes de redirecionar
                    if (window.isBlockedModalActive && window.isBlockedModalActive()) {
                        console.log('Modal de conta bloqueada ativo - admin não redirecionando');
                        reject('Modal de conta bloqueada ativo');
                        return;
                    }
                    
                    // Se estamos no fluxo blocked, não redirecionar
                    if (sessionStorage.getItem('blockedUid')) {
                        console.log('Blocked flow ativo - admin não redirecionando');
                        reject('Blocked flow ativo');
                        return;
                    }
                    // Redirecionar para login
                        safeNavigate('login.html');
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

    async checkUserBlocked(user) {
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                if (userData.disabled === true) {
                    this.showBlockedAccountScreen(user, userData);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Erro ao verificar status do usuário:', error);
            return false;
        }
    }

    showBlockedAccountScreen(user, userData) {
    // Do not force logout here; show modal and allow actions
    this.createBlockedAccountModal(user, userData);
    }

    createBlockedAccountModal(user, userData) {
        const modalHTML = `
            <div class="modal fade show" id="blockedAccountModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.8);">
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
                                Você pode excluir completamente sua conta e dados abaixo.
                            </div>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <button type="button" class="btn btn-danger me-2" id="adminDeleteAccountBtn">
                                <i class="bi bi-trash me-2"></i>Excluir minha conta e dados
                            </button>
                            <button type="button" class="btn btn-primary" id="adminBackToLoginBtn">
                                <i class="bi bi-arrow-left me-2"></i>Voltar ao Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Wire delete action
        const delBtn = document.getElementById('adminDeleteAccountBtn');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (!confirm('Tem certeza que deseja excluir sua conta e dados permanentemente?')) return;
                const uid = this.auth.currentUser?.uid;
                if (!uid) {
                    alert('Você precisa estar autenticado para excluir sua conta.');
                    return;
                }
                await window.deleteAccountCompletely(uid);
            });
        }

        const backBtn = document.getElementById('adminBackToLoginBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.allowRedirect = true;
                this.auth.signOut().catch(()=>{}).finally(()=>{
                    safeNavigate('login.html', true);
                    window.allowRedirect = false;
                });
            });
        }
    }

    // ------------------ Dados da Turma (links e reclamações) ------------------
    subscribeClassLinksAdmin(){
        if (!this.db) return;
        const container = document.getElementById('adminClassLinksContainer');
        if (!container) return;
        // First try a one-time read to show any errors immediately
        this.db.collection('classLinks').orderBy('order','asc').get().then(snapshot => {
            if (snapshot.empty) { container.innerHTML = '<div class="text-muted">Nenhum link cadastrado</div>'; }
            else {
                const items = [];
                snapshot.forEach(doc=>{ const d = doc.data()||{}; items.push({ id: doc.id, ...d }); });
                console.log('admin.js: initial classLinks.get() returned', snapshot.size, snapshot.docs.map(d=>d.id));
                container.innerHTML = `<div class="small text-muted mb-2">${items.length} link(s) carregado(s)</div>` + items.map(it => this.adminLinkCard(it)).join('');
            }
        }).catch(err => {
            console.error('Erro ao obter classLinks (get):', err);
            container.innerHTML = `<div class="text-danger">Erro ao carregar links: ${this.escapeHtml(err && (err.message || String(err)))}` + (err && err.code ? ` (code: ${this.escapeHtml(err.code)})` : '') + `</div>`;
        });

        // Then subscribe for realtime updates
        this.classLinksUnsub = this.db.collection('classLinks').orderBy('order','asc').onSnapshot(async snap => {
            console.log('admin.js: classLinks onSnapshot, size=', snap.size, 'ids=', snap.docs.map(d=>d.id));
            try {
                console.log('admin.js: snapshot.metadata =', snap.metadata || {});
            } catch(e){ /* ignore */ }

            if (snap.empty) {
                // Fallback: try a manual get() and render those results if present.
                console.warn('admin.js: onSnapshot empty — attempting manual get() as fallback');
                try {
                    const manual = await this.db.collection('classLinks').get();
                    console.log('admin.js: manual get() returned', manual.size, manual.docs.map(d=>d.id));
                    if (manual.empty) { container.innerHTML = '<div class="text-muted">Nenhum link cadastrado</div>'; return; }
                    const items = [];
                    manual.forEach(doc=>{ const d = doc.data()||{}; items.push({ id: doc.id, ...d }); });
                    container.innerHTML = `<div class="small text-muted mb-2">${items.length} link(s) carregado(s)</div>` + items.map(it => this.adminLinkCard(it)).join('');
                    return;
                } catch(getErr) {
                    console.error('admin.js: manual get() também falhou:', getErr);
                    container.innerHTML = `<div class="text-danger">Erro ao carregar links: ${this.escapeHtml(getErr && (getErr.message || String(getErr)))}${getErr && getErr.code ? ` (code: ${this.escapeHtml(getErr.code)})` : ''}</div>`;
                    return;
                }
            }

            const items = [];
            snap.forEach(doc=>{ const d = doc.data()||{}; items.push({ id: doc.id, ...d }); });
            container.innerHTML = `<div class="small text-muted mb-2">${items.length} link(s) carregado(s)</div>` + items.map(it => this.adminLinkCard(it)).join('');
        }, err => { console.error('Erro ao carregar classLinks admin (onSnapshot):', err); container.innerHTML = `<div class="text-danger">Erro ao carregar links: ${this.escapeHtml(err && (err.message || String(err)))}${err && err.code ? ` (code: ${this.escapeHtml(err.code)})` : ''}</div>`; });
    }

    adminLinkCard(link){
        const title = link.title || 'Sem título';
        const url = link.url || '#';
        return `
            <div class="d-flex justify-content-between align-items-start mb-2 p-2 border rounded">
                <div style="max-width:70%">
                    <div class="fw-bold text-truncate">${this.escapeHtml(title)}</div>
                    <div class="small text-muted text-truncate">${this.escapeHtml(url)}</div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="adminSystem.openAdminEditLink('${link.id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="adminSystem.deleteAdminLink('${link.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
    }

    async openAdminEditLink(id){
        // reuse the modal from dados.js if present, otherwise create local modal
        const existing = document.getElementById('classLinkModal');
        if (existing) {
            // delegate to global modal handler by filling inputs and showing
            const titleInput = document.getElementById('classLinkTitle');
            const urlInput = document.getElementById('classLinkUrl');
            const saveBtn = document.getElementById('classLinkSave');
            if (!id) { titleInput.value=''; urlInput.value=''; saveBtn.onclick = async ()=>{}; }
            // call the function from dados.js by opening modal
            if (typeof openEditLinkModal === 'function') {
                openEditLinkModal(id);
                return;
            }
        }
        // fallback: create a modal in the admin page and use it for create/edit
        try {
            let modal = document.getElementById('adminClassLinkModal');
            if (!modal) {
                document.body.insertAdjacentHTML('beforeend', `
                    <div class="modal fade" id="adminClassLinkModal" tabindex="-1">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Gerenciar Link da Turma</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-2">
                                        <label class="form-label">Título</label>
                                        <input id="adminClassLinkTitle" class="form-control" />
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label">URL</label>
                                        <input id="adminClassLinkUrl" class="form-control" placeholder="https://drive.google.com/..." />
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                    <button id="adminClassLinkSave" class="btn btn-primary">Salvar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                modal = document.getElementById('adminClassLinkModal');
            }

            const titleInput = document.getElementById('adminClassLinkTitle');
            const urlInput = document.getElementById('adminClassLinkUrl');
            const saveBtn = document.getElementById('adminClassLinkSave');

            const bsModal = new bootstrap.Modal(modal);

            // prepare save handler
            saveBtn.onclick = async () => {
                const title = titleInput.value.trim();
                const url = urlInput.value.trim();
                if (!title || !url) { alert('Preencha título e URL'); return; }
                try {
                    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';
                    if (!id) {
                        const ref = await this.db.collection('classLinks').add({ title, url, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: this.currentUser?.uid || null });
                        console.log('admin: created classLink', ref.id, { title, url });
                        this.showAlert('Link criado', 'success');
                    } else {
                        await this.db.collection('classLinks').doc(id).update({ title, url });
                        this.showAlert('Link atualizado', 'success');
                    }
                    bsModal.hide();
                    // refresh list
                    this.subscribeClassLinksAdmin();
                } catch (err) {
                    console.error('Erro ao salvar link admin:', err);
                    alert('Erro ao salvar link: ' + (err.message || err.code || ''));
                } finally {
                    saveBtn.disabled = false; saveBtn.textContent = 'Salvar';
                }
            };

            // If editing, load existing
            if (id) {
                try {
                    const doc = await this.db.collection('classLinks').doc(id).get();
                    const data = doc.exists ? doc.data() : {};
                    titleInput.value = data.title || '';
                    urlInput.value = data.url || '';
                } catch (err) {
                    console.warn('Erro ao carregar link para editar:', err);
                }
            } else {
                titleInput.value = '';
                urlInput.value = '';
            }

            bsModal.show();
        } catch (err) {
            console.error('Erro ao abrir modal admin para link:', err);
            this.showAlert('Erro ao abrir modal de link: ' + (err.message || err.code || ''), 'danger');
        }
    }

    async deleteAdminLink(id){
        if (!confirm('Confirmar exclusão deste link?')) return;
        try {
            await this.db.collection('classLinks').doc(id).delete();
            this.showAlert('Link excluído', 'success');
                // Refresh the admin list immediately to reflect deletion
                try { this.subscribeClassLinksAdmin(); } catch(e){ console.warn('Erro ao refresh links after delete', e); }
        } catch (err) {
            console.error('Erro ao excluir link admin:', err);
            this.showAlert('Erro ao excluir link: '+err.message, 'danger');
        }
    }

    subscribeComplaints(){
        if (!this.db) return;
        this.complaintsUnsub = this.db.collection('classComplaints').orderBy('createdAt','desc').limit(50).onSnapshot(snap => {
            const container = document.getElementById('adminComplaintsContainer');
            if (!container) return;
            if (snap.empty) { container.innerHTML = '<div class="text-muted">Nenhuma reclamação recente</div>'; return; }
            const items = [];
            snap.forEach(doc=>{ items.push({ id: doc.id, ...(doc.data()||{}) }); });
            this.complaints = items;
            this.renderComplaints();
        }, err => { console.error('Erro ao carregar complaints:', err); document.getElementById('adminComplaintsContainer').innerHTML = '<div class="text-danger">Erro ao carregar reclamações</div>'; });
    }

    renderComplaints(){
        const container = document.getElementById('adminComplaintsContainer');
        if (!container) return;
        let items = this.complaints || [];
        if (this.showOnlyUnread) items = items.filter(i => !i.seen);
        if (items.length === 0) { container.innerHTML = '<div class="text-muted">Nenhuma reclamação recente</div>'; return; }
        container.innerHTML = items.map(it => this.complaintCard(it)).join('');
    }

    complaintCard(c){
        const time = c.createdAt ? (c.createdAt.toDate ? this.formatDate(c.createdAt) : String(c.createdAt)) : '—';
        const who = c.anonymous ? 'Anônimo' : (c.userName || 'Anônimo');
        const seenClass = c.seen ? 'complaint-seen' : '';
        return `
            <div class="border rounded p-2 mb-2 ${seenClass}">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="max-width:75%">
                        <div class="small text-muted">${this.escapeHtml(who)} — ${time}</div>
                        <div class="mt-1">${this.escapeHtml(c.message)}</div>
                    </div>
                    <div class="btn-group-vertical ms-2">
                        <button class="btn btn-sm btn-outline-success" onclick="adminSystem.markComplaintSeen('${c.id}')">Marcar como lida</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="adminSystem.deleteComplaint('${c.id}')">Excluir</button>
                    </div>
                </div>
            </div>
        `;
    }

    async deleteComplaint(id){
        if (!confirm('Confirmar exclusão desta reclamação? Esta ação não pode ser desfeita.')) return;
        try {
            await this.db.collection('classComplaints').doc(id).delete();
            this.showAlert('Reclamação excluída', 'success');
        } catch (err) {
            console.error('Erro ao excluir reclamação:', err);
            this.showAlert('Erro ao excluir reclamação: ' + (err.message || err.code || ''), 'danger');
        }
    }

    // Toggle seen/unseen
    async markComplaintSeen(id){
        try {
            const doc = await this.db.collection('classComplaints').doc(id).get();
            if (!doc.exists) return this.showAlert('Reclamação não encontrada', 'warning');
            const data = doc.data() || {};
            const newSeen = !data.seen;
            const update = { seen: newSeen };
            if (newSeen) {
                update.seenAt = firebase.firestore.FieldValue.serverTimestamp();
                update.seenBy = this.currentUser?.uid || null;
                update.seenByEmail = this.currentUser?.email || null;
            } else {
                // Optional: clear metadata when marking as não lida
                update.seenAt = null;
                update.seenBy = null;
                update.seenByEmail = null;
            }
            await this.db.collection('classComplaints').doc(id).update(update);
            this.showAlert(newSeen ? 'Marcado como lido' : 'Marcado como não lida', 'success');
        } catch(err){ console.error(err); this.showAlert('Erro: '+(err.message||err.code||''),'danger'); }
    }

    async markComplaintResolved(id){
        try { await this.db.collection('classComplaints').doc(id).update({ resolved:true, seen:true }); this.showAlert('Marcado como resolvido', 'success'); }
        catch(err){ console.error(err); this.showAlert('Erro: '+err.message,'danger'); }
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
                const data = doc.data() || {};
                const fallbackName = data.fullName || data.displayName || (data.email ? data.email.split('@')[0] : null);
                this.users.push({
                    id: doc.id,
                    fullName: data.fullName || fallbackName,
                    displayName: data.displayName,
                    email: data.email,
                    role: data.role || 'user',
                    disabled: !!data.disabled,
                    createdAt: data.createdAt,
                    lastLogin: data.lastLogin,
                    ...data
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
    const displayName = this.getUserDisplayName(user);
        
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
                                    <h6 class="mb-1">${displayName}</h6>
                                    <p class="text-muted mb-0">${user.email}</p>
                                    ${isCurrentUser ? '<span class="badge bg-info">Você</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-secondary'} role-badge me-1">
                                ${user.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
                            </span>
                            ${user.disabled ? `<span class="badge bg-dark role-badge">Bloqueado</span>` : ''}
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
                                    <button class="btn btn-outline-${user.disabled ? 'secondary' : 'danger'} btn-role-toggle"
                                            onclick="adminSystem.changeUserDisabled('${user.id}', ${user.disabled ? 'false' : 'true'})">
                                        <i class="bi ${user.disabled ? 'bi-unlock' : 'bi-lock'}"></i>
                                        ${user.disabled ? 'Desbloquear' : 'Bloquear'}
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
            `Tem certeza que deseja ${action} o usuário "${this.getUserDisplayName(user)}"?`,
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

    async changeUserDisabled(userId, disabled) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Prevent changing own disabled state
        if (userId === this.currentUser.uid) {
            this.showAlert('Erro: Você não pode bloquear/desbloquear sua própria conta.', 'danger');
            return;
        }

        const actionLabel = disabled ? 'bloquear' : 'desbloquear';

        this.showConfirmModal(
            `Tem certeza que deseja ${actionLabel} o usuário "${this.getUserDisplayName(user)}"?`,
            async () => {
                try {
                    await this.db.collection('users').doc(userId).update({
                        disabled: disabled,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: this.currentUser.uid
                    });

                    // Salvar log de auditoria
                    const auditLog = {
                        action: disabled ? 'block_user' : 'unblock_user',
                        adminId: this.currentUser.uid,
                        adminEmail: this.currentUser.email,
                        targetUserId: userId,
                        targetUserEmail: user.email,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        details: { disabled: disabled }
                    };
                    await this.db.collection('admin_logs').add(auditLog);

                    this.showAlert(`Usuário ${disabled ? 'bloqueado' : 'desbloqueado'} com sucesso.`, 'success');
                    await this.loadUsers();
                } catch (error) {
                    console.error('Erro ao atualizar status de bloqueio do usuário:', error);
                    this.showAlert('Erro ao atualizar status do usuário. Verifique suas permissões.', 'danger');
                }
            }
        );
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

    async showAdminDebugInfo(){
        const header = document.querySelector('.admin-header .container .row .col');
        if (!header) return;
        const infoId = 'adminDebugInfo';
        let el = document.getElementById(infoId);
        if (!el) {
            el = document.createElement('div');
            el.id = infoId;
            el.className = 'small text-white mt-1';
            header.appendChild(el);
        }

        const uid = this.currentUser?.uid || '—';
        let claimAdmin = false;
        try {
            const token = await this.currentUser.getIdTokenResult();
            claimAdmin = !!(token && token.claims && token.claims.admin);
        } catch(e){ console.warn('Erro ao ler idTokenResult', e); }

        let role = '—';
        try {
            const doc = await this.db.collection('users').doc(uid).get();
            if (doc.exists) role = doc.data().role || '—';
        } catch(e){ console.warn('Erro ao ler users doc', e); }

        el.textContent = `UID: ${uid} · claim.admin: ${claimAdmin} · users/{uid}.role: ${role}`;
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

    // Escapa HTML para inserção segura em templates
    escapeHtml(text) {
        try {
            if (text === null || text === undefined) return '';
            const d = document.createElement('div');
            d.textContent = String(text);
            return d.innerHTML;
        } catch (e) {
            return String(text);
        }
    }

    // Resolver nome exibido do usuário a partir de possíveis campos
    getUserDisplayName(user) {
        if (!user) return 'Nome não disponível';
        const candidate = user.fullName || user.name || user.displayName;
        // Ignorar valores que na verdade armazenam role por engano
        if (candidate && this.isLikelyRoleString(candidate)) {
            // fallback para displayName ou email prefix
            return user.displayName || (user.email ? user.email.split('@')[0] : 'Nome não disponível');
        }
        return candidate || (user.email ? user.email.split('@')[0] : 'Nome não disponível');
    }

    // Detecta strings que provavelmente são roles salvas no lugar do nome
    isLikelyRoleString(value) {
        if (!value) return false;
        const v = String(value).trim().toLowerCase();
        const roleCandidates = [
            'admin', 'administrator', 'administrador',
            'user', 'usuário', 'usuario', 'usuário comum', 'usuario comum',
            'adm', 'adm.'
        ];
        return roleCandidates.includes(v);
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
        const actionInfo = this.getActionInfo(log);
        
        return `
            <div class="card mb-2 border-start border-${actionInfo.color} border-3">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-center">
                            <i class="bi ${actionInfo.icon} text-${actionInfo.color} me-3"></i>
                            <div>
                                <strong>${actionInfo.title}</strong>
                                <p class="mb-1 small">${actionInfo.description}</p>
                                <small class="text-muted">${timestamp}</small>
                            </div>
                        </div>
                        ${actionInfo.badge ? `<span class="badge bg-${actionInfo.color}">${actionInfo.badge}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Método para obter informações da ação
    getActionInfo(log) {
        const adminEmail = log.adminEmail || 'Admin desconhecido';
        const targetEmail = log.targetUserEmail || log.targetEmail || 'Usuário desconhecido';
        
        switch (log.action) {
            case 'role_change':
                const newRole = log.newRole || 'desconhecido';
                const oldRole = log.oldRole || 'desconhecido';
                const isPromotion = newRole === 'admin';
                return {
                    icon: 'bi-shield-check',
                    color: isPromotion ? 'success' : 'warning',
                    title: 'Mudança de Permissão',
                    description: `<strong>${adminEmail}</strong> ${isPromotion ? 'promoveu' : 'rebaixou'} <strong>${targetEmail}</strong> ${isPromotion ? 'a administrador' : 'para usuário comum'} (${oldRole} → ${newRole})`,
                    badge: newRole.toUpperCase()
                };
            
            case 'block_user':
                return {
                    icon: 'bi-lock',
                    color: 'danger',
                    title: 'Usuário Bloqueado',
                    description: `<strong>${adminEmail}</strong> bloqueou <strong>${targetEmail}</strong>`,
                    badge: 'BLOQUEADO'
                };
            
            case 'unblock_user':
                return {
                    icon: 'bi-unlock',
                    color: 'success',
                    title: 'Usuário Desbloqueado',
                    description: `<strong>${adminEmail}</strong> desbloqueou <strong>${targetEmail}</strong>`,
                    badge: 'ATIVO'
                };
            
            default:
                return {
                    icon: 'bi-info-circle',
                    color: 'info',
                    title: log.action || 'Ação Administrativa',
                    description: `<strong>${adminEmail}</strong> realizou uma ação administrativa`,
                    badge: null
                };
        }
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

// Dev helpers for pages that don't load app.js (admin.html)
function postToSW(msg){ if (!('serviceWorker' in navigator)) return; navigator.serviceWorker.getRegistration().then(reg=>{ if (reg && reg.active) reg.active.postMessage(msg); }); }

window.devDisableSWCache = function(disable){
    try { localStorage.setItem('disableSWCache', disable ? '1' : '0'); } catch(e){}
    postToSW({ type: 'SET_DISABLE_CACHE', value: !!disable });
};

window.devClearSWCache = function(){ postToSW({ type: 'CLEAR_CACHE' }); };

// Auto-apply based on URL or localStorage
try {
    const params = new URLSearchParams(window.location.search);
    const noCacheParam = params.get('no-cache');
    const fromStorage = localStorage.getItem('disableSWCache');
    if (noCacheParam === '1' || fromStorage === '1') {
        postToSW({ type: 'SET_DISABLE_CACHE', value: true });
        console.info('Dev: service worker caching disabled for this session (admin page)');
    }
} catch(e){ /* ignore */ }

// ========================================
// LÓGICA DO PAINEL ADMINISTRATIVO (FINAL CORRIGIDO)
// ========================================

let allUsersCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAdmin, 1000); 
});

function initAdmin() {
    if (!window.db || !window.firebase) return setTimeout(initAdmin, 500);

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const doc = await window.db.collection('users').doc(user.uid).get();
                if (!doc.exists || doc.data().role !== 'admin') {
                    alert('⛔ Acesso Negado.');
                    window.location.href = 'index.html';
                    return;
                }
                
                document.getElementById('adminEmailDisplay').textContent = user.email;
                
                // Carrega módulos
                loadUsers();
                loadMatriculas();
                loadComplaints();
                loadLinks();
                
                const searchInput = document.getElementById('searchUser');
                if(searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        renderUserList(e.target.value);
                    });
                }
                
            } catch (e) { console.error(e); }
        } else {
            window.location.href = 'login.html';
        }
    });
}

// ========================================
// 1. USUÁRIOS - LAYOUT MOBILE CORRIGIDO
// ========================================

function loadUsers() {
    window.db.collection('users').onSnapshot(snap => {
        const stat = document.getElementById('statUsers');
        if(stat) stat.textContent = snap.size;
        
        allUsersCache = [];
        snap.forEach(doc => {
            allUsersCache.push({ id: doc.id, ...doc.data() });
        });

        renderUserList('');
        
    }, err => console.log("Erro Users:", err));
}

function renderUserList(filterText = '') {
    const list = document.getElementById('usersList');
    if (!list) return;
    
    list.innerHTML = '';
    const currentUserUid = firebase.auth().currentUser.uid;
    const term = filterText.toLowerCase();

    const filtered = allUsersCache.filter(u => {
        const name = (u.fullName || u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const matricula = (u.matricula || '').toLowerCase();
        return name.includes(term) || email.includes(term) || matricula.includes(term);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-muted text-center py-4">Nenhum usuário encontrado.</div>';
        return;
    }

    filtered.forEach(u => {
        const isBlocked = u.disabled === true;
        const isAdmin = u.role === 'admin';
        const isSelf = u.id === currentUserUid;
        const userName = u.fullName || u.name || u.displayName || 'Sem Nome';

        // Badges
        const roleBadge = isAdmin 
            ? `<span class="badge bg-warning text-dark ms-2" style="font-size:0.6rem">ADMIN</span>`
            : `<span class="badge bg-secondary ms-2" style="font-size:0.6rem">ALUNO</span>`;

        // Botões
        let adminBtn = '';
        if (!isSelf) {
            if (isAdmin) {
                adminBtn = `<button class="btn btn-sm btn-outline-light rounded-pill px-3 me-2" title="Remover Admin" onclick="toggleUserAdmin('${u.id}', false)"><i class="bi bi-shield-minus"></i></button>`;
            } else {
                adminBtn = `<button class="btn btn-sm btn-outline-warning rounded-pill px-3 me-2" title="Tornar Admin" onclick="toggleUserAdmin('${u.id}', true)"><i class="bi bi-shield-plus"></i></button>`;
            }
        }

        const div = document.createElement('div');
        div.className = 'card p-3 mb-2 border-secondary bg-dark-subtle';
        
        // --- AQUI ESTÁ A CORREÇÃO DO LAYOUT ---
        // Usamos flex-column (vertical) no mobile e flex-sm-row (horizontal) no tablet/pc
        div.innerHTML = `
            <div class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
                
                <div class="d-flex align-items-center gap-3 w-100">
                    <div class="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0" style="width:40px;height:40px;">
                        <i class="bi bi-person"></i>
                    </div>
                    <div class="overflow-hidden w-100">
                        <div class="d-flex align-items-center flex-wrap">
                            <span class="fw-bold text-white text-truncate" style="max-width: 150px;">${userName}</span>
                            ${roleBadge}
                        </div>
                        <div class="small text-muted text-truncate">${u.email}</div>
                        <div class="small text-orange font-monospace">${u.matricula || 'Sem matrícula'}</div>
                    </div>
                </div>

                <div class="d-flex align-items-center justify-content-end w-100 w-sm-auto mt-2 mt-sm-0 border-top border-secondary pt-2 pt-sm-0 border-top-0-sm">
                    ${adminBtn}
                    ${isBlocked 
                        ? `<button class="btn btn-sm btn-success rounded-pill px-4" onclick="toggleUserAccess('${u.id}', false)">Ativar</button>` 
                        : `<button class="btn btn-sm btn-outline-danger rounded-pill px-4" onclick="toggleUserAccess('${u.id}', true)">Bloq.</button>`
                    }
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// Ações
window.toggleUserAdmin = async (uid, makeAdmin) => {
    const action = makeAdmin ? 'PROMOVER a Administrador' : 'REMOVER Admin';
    if(!confirm(`Deseja ${action} este usuário?`)) return;
    try {
        await window.db.collection('users').doc(uid).update({ role: makeAdmin ? 'admin' : 'user' });
    } catch(e) { alert('Erro: ' + e.message); }
};

window.toggleUserAccess = async (uid, disabled) => {
    if(!confirm(`Confirma ${disabled ? 'BLOQUEAR' : 'DESBLOQUEAR'} este usuário?`)) return;
    try { await window.db.collection('users').doc(uid).update({ disabled: disabled }); } 
    catch(e) { alert('Erro: ' + e.message); }
};

// 2. MATRÍCULAS
function loadMatriculas() {
    window.db.collection('matriculas_aceitas').onSnapshot(snap => {
        const list = document.getElementById('matriculasList');
        const stat = document.getElementById('statMatriculas');
        if(stat) stat.textContent = snap.size;
        if(list) {
            list.innerHTML = '';
            snap.forEach(doc => {
                const div = document.createElement('div');
                div.className = 'col-6 col-md-4 col-lg-3';
                div.innerHTML = `
                    <div class="card p-2 text-center position-relative border-secondary bg-dark-subtle">
                        <span class="fw-bold text-white font-monospace fs-5">${doc.id}</span>
                        <button class="btn btn-sm text-danger position-absolute top-0 end-0 p-1" onclick="deleteMatricula('${doc.id}')"><i class="bi bi-x-lg"></i></button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    });
}

window.addMatricula = async () => {
    const input = document.getElementById('newMatricula');
    const val = input.value.trim();
    if(!val) return;
    try { await window.db.collection('matriculas_aceitas').doc(val).set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }); input.value = ''; } 
    catch(e) { alert('Erro: ' + e.message); }
};

window.deleteMatricula = async (id) => {
    if(!confirm('Remover matrícula?')) return;
    await window.db.collection('matriculas_aceitas').doc(id).delete();
};

// 3. SUGESTÕES
function loadComplaints() {
    window.db.collection('complaints').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('adminComplaintsList');
        const stat = document.getElementById('statComplaints');
        if(stat) stat.textContent = snap.size;
        if(list) {
            list.innerHTML = '';
            if(snap.empty) { list.innerHTML = '<p class="text-muted text-center py-4">Vazio.</p>'; return; }
            snap.forEach(doc => {
                const c = doc.data();
                const date = c.createdAt ? c.createdAt.toDate().toLocaleDateString() : '-';
                const div = document.createElement('div');
                div.className = 'card p-3 mb-2 border-secondary bg-dark-subtle';
                div.innerHTML = `
                    <div class="d-flex justify-content-between mb-2">
                        <div><span class="badge bg-orange text-white">${c.userName || 'Anônimo'}</span> <small class="text-muted ms-2">${date}</small></div>
                        <button class="btn btn-sm btn-outline-success py-0 rounded-pill" onclick="deleteComplaint('${doc.id}')"><i class="bi bi-check-lg"></i></button>
                    </div>
                    <p class="text-white mb-0 small opacity-75">${c.text}</p>
                `;
                list.appendChild(div);
            });
        }
    });
}

window.deleteComplaint = async (id) => { if(!confirm('Arquivar?')) return; await window.db.collection('complaints').doc(id).delete(); };

// 4. LINKS
function loadLinks() {
    window.db.collection('classLinks').onSnapshot(snap => {
        const list = document.getElementById('adminLinksList');
        const stat = document.getElementById('statLinks');
        if(stat) stat.textContent = snap.size;
        if(list) {
            list.innerHTML = '';
            snap.forEach(doc => {
                const l = doc.data();
                const div = document.createElement('div');
                div.className = 'col-12 col-md-6';
                div.innerHTML = `
                    <div class="card p-3 h-100 border-secondary bg-dark-subtle d-flex flex-row justify-content-between align-items-center">
                        <div class="overflow-hidden me-2">
                            <div class="fw-bold text-white text-truncate">${l.title}</div>
                            <div class="small text-muted text-truncate">${l.url}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteLink('${doc.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    });
}

window.addNewLinkModal = async () => {
    const title = prompt("Título:"); if(!title) return; const url = prompt("URL:"); if(!url) return;
    await window.db.collection('classLinks').add({ title, url, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
};

window.deleteLink = async (id) => { if(!confirm('Excluir?')) return; await window.db.collection('classLinks').doc(id).delete(); };
window.logout = () => firebase.auth().signOut().then(() => window.location.href = 'login.html');
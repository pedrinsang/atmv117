// ========================================
// GERENCIAMENTO DE DADOS DA TURMA (LINKS E SUGESTÕES)
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa listeners se estiver na página correta
    if (document.getElementById('linksPage')) {
        loadClassLinks();
        setupLinkAdmin();
    }
    if (document.getElementById('sugestoesPage')) {
        loadComplaints();
        setupComplaintForm();
    }
});

// ========================================
// 1. LINKS ÚTEIS (ClassLinks)
// ========================================

function loadClassLinks() {
    if (!window.db) { setTimeout(loadClassLinks, 1000); return; }

    const container = document.getElementById('classLinksContainer');
    if (!container) return;

    window.db.collection('classLinks').orderBy('title', 'asc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">Nenhum link cadastrado.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const link = doc.data();
                const isAdmin = window.isAdmin && window.isAdmin();
                
                let deleteBtn = '';
                if (isAdmin) {
                    deleteBtn = `<button class="btn btn-sm btn-link text-danger ms-2 p-0" onclick="deleteClassLink('${doc.id}')"><i class="bi bi-trash"></i></button>`;
                }

                const card = document.createElement('div');
                card.className = 'card p-3 mb-2 d-flex flex-row align-items-center justify-content-between';
                card.style.minWidth = '250px';
                card.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="bi bi-link-45deg fs-4 text-orange me-3"></i>
                        <div>
                            <h6 class="mb-0 fw-bold text-white"><a href="${link.url}" target="_blank" class="text-white text-decoration-none stretched-link">${link.title}</a></h6>
                            <small class="text-muted">${link.description || ''}</small>
                        </div>
                    </div>
                    <div style="z-index: 2; position: relative;">${deleteBtn}</div>
                `;
                container.appendChild(card);
            });

            // Mostra controles de admin se for admin
            if (window.isAdmin && window.isAdmin()) {
                const controls = document.getElementById('classLinksAdminControls');
                if(controls) controls.style.display = 'block';
            }
        }, error => {
            console.error("Erro links:", error);
        });
}

function setupLinkAdmin() {
    const btn = document.getElementById('btnAddClassLink');
    if (btn) {
        btn.onclick = async () => {
            const title = prompt("Título do Link:");
            if (!title) return;
            const url = prompt("URL (https://...):");
            if (!url) return;
            const desc = prompt("Descrição curta (opcional):");

            try {
                await window.db.collection('classLinks').add({
                    title, url, description: desc,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) { alert('Erro ao adicionar: ' + e.message); }
        };
    }
}

window.deleteClassLink = async function(id) {
    if (confirm('Apagar este link?')) {
        try { await window.db.collection('classLinks').doc(id).delete(); }
        catch (e) { alert('Erro: ' + e.message); }
    }
};

// ========================================
// 2. SUGESTÕES (Complaints) - CORRIGIDO
// ========================================

function setupComplaintForm() {
    const btn = document.getElementById('btnSubmitComplaint');
    const txt = document.getElementById('complaintText');

    if (btn && txt) {
        btn.onclick = async () => {
            const text = txt.value.trim();
            if (!text) return alert('Escreva algo!');

            btn.disabled = true;
            btn.textContent = 'Enviando...';

            try {
                const user = firebase.auth().currentUser;
                // NOME CORRIGIDO: 'complaints' em vez de 'classComplaints'
                await window.db.collection('complaints').add({
                    text: text,
                    userId: user ? user.uid : 'anon',
                    userName: user ? (user.displayName || 'Anônimo') : 'Anônimo',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending' // pending, read, resolved
                });

                txt.value = '';
                alert('Sugestão enviada! Obrigado.');
            } catch (e) {
                console.error(e);
                alert('Erro ao enviar.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Enviar';
            }
        };
    }
}

function loadComplaints() {
    if (!window.db) return;

    const list = document.getElementById('complaintsList');
    if (!list) return;

    const user = firebase.auth().currentUser;
    // Regra: Admins veem tudo. Alunos veem as suas próprias (ou todas, dependendo da sua regra de negócio).
    // Vou assumir que alunos veem as SUAS sugestões para acompanhar.
    
    // NOME CORRIGIDO: 'complaints'
    let query = window.db.collection('complaints').orderBy('createdAt', 'desc').limit(20);

    // Se quiser que aluno veja apenas as dele, descomente abaixo:
    // if (!window.isAdmin()) query = query.where('userId', '==', user.uid);

    query.onSnapshot(snapshot => {
        list.innerHTML = '';
        if (snapshot.empty) {
            list.innerHTML = '<div class="text-muted text-center small">Nenhuma sugestão recente.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('pt-BR') : 'Hoje';
            const isMine = user && data.userId === user.uid;
            
            // Delete button apenas para admin
            let delBtn = '';
            if (window.isAdmin && window.isAdmin()) {
                delBtn = `<button class="btn btn-sm text-danger p-0 ms-2" onclick="deleteComplaint('${doc.id}')"><i class="bi bi-x-circle"></i></button>`;
            }

            const item = document.createElement('div');
            item.className = 'border-bottom border-secondary py-2';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <span class="badge bg-secondary mb-1">${date}</span>
                        ${isMine ? '<span class="badge bg-orange">Minha</span>' : ''}
                        <p class="text-white mb-0 small" style="white-space: pre-wrap;">${escapeHtml(data.text)}</p>
                    </div>
                    ${delBtn}
                </div>
            `;
            list.appendChild(item);
        });
    }, error => {
        console.warn("Erro ao ouvir complaints:", error.code);
        if (error.code === 'permission-denied') {
            list.innerHTML = '<div class="text-danger small text-center">Acesso restrito a administradores ou erro de permissão.</div>';
        }
    });
}

window.deleteComplaint = async function(id) {
    if(!confirm('Excluir sugestão?')) return;
    try {
        // NOME CORRIGIDO: 'complaints'
        await window.db.collection('complaints').doc(id).delete();
    } catch(e) { alert('Erro: ' + e.message); }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Exportar funções globais
window.loadClassLinks = loadClassLinks;
window.loadComplaints = loadComplaints;
// Dados da Turma - links e reclamações
// Integra com Firestore via window.db e usa firebase.auth() para roles

(function(){
    // Helpers
    function el(q) { return document.querySelector(q); }
    function escapeHtml(text){ if(!text && text !== 0) return ''; const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML; }
    function isValidUrl(url){
        try {
            const u = new URL(url);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch(e){
            return false;
        }
    }

    // Containers
    const linksContainer = () => el('#classLinksContainer');
    const adminControls = () => el('#classLinksAdminControls');
    const btnAdd = () => el('#btnAddClassLink');
    const complaintText = () => el('#complaintText');
    const btnSubmitComplaint = () => el('#btnSubmitComplaint');
    const complaintStatus = () => el('#complaintStatus');

    // State
    let isAdmin = false;
    let linksUnsub = null;

    async function checkAdmin() {
        const user = firebase.auth().currentUser;
        if (!user) { isAdmin = false; return; }
        try {
            const token = await user.getIdTokenResult();
            if (token && token.claims && token.claims.admin) { isAdmin = true; return; }
        } catch (e) {
            console.warn('Erro ao checar claim admin:', e);
        }
        // Fallback: check users collection
        try {
            const doc = await window.db.collection('users').doc(user.uid).get();
            const data = doc.exists ? doc.data() : null;
            isAdmin = data && (data.role === 'admin' || data.isAdmin === true);
        } catch (e) {
            console.warn('Erro ao checar users collection para role admin:', e);
            isAdmin = false;
        }
    }

    function renderLinkCard(dataObj){
        const { id, title, url } = dataObj;
    const card = document.createElement('div');
    card.className = 'btn btn-light shadow-sm text-start class-link-card';
        card.style.minWidth = '180px';
        card.style.maxWidth = '340px';
        card.style.padding = '0.6rem 0.8rem';
        card.dataset.id = id;
        // content centered (title + url)
        card.innerHTML = `
            <div class="class-link-content">
                <div class="fw-bold link-title text-truncate">${escapeHtml(title || 'Sem título')}</div>
                <div class="small text-muted link-url text-truncate">${escapeHtml(url || '')}</div>
            </div>
        `;

        // actions overlay (top-right)
        const actions = document.createElement('div');
        actions.className = 'class-link-actions';
        if (isAdmin) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn btn-sm btn-outline-secondary btn-edit';
            editBtn.setAttribute('data-id', id);
            editBtn.title = 'Editar';
            editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
            actions.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-sm btn-outline-danger btn-delete';
            delBtn.setAttribute('data-id', id);
            delBtn.title = 'Excluir';
            delBtn.innerHTML = '<i class="bi bi-trash"></i>';
            actions.appendChild(delBtn);
        }
        card.appendChild(actions);
        // Make whole card clickable to open the link (ignore clicks on internal controls)
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit') || e.target.closest('.btn-delete') || e.target.closest('a')) return;
            window.open(url, '_blank');
        });

        return card;
    }

    function clearLinks(){ const c = linksContainer(); if(c) c.innerHTML=''; }

    function subscribeClassLinks(){
        if (!window.db) return;
        if (linksUnsub) linksUnsub();
        linksUnsub = window.db.collection('classLinks').onSnapshot(snapshot => {
            console.log('dados.js: classLinks onSnapshot, docs:', snapshot.size, snapshot.docs.map(d=>d.id));
            const items = [];
            snapshot.forEach(doc => {
                const d = doc.data() || {};
                items.push({ id: doc.id, title: d.title, url: d.url, order: d.order || 0, createdAt: d.createdAt });
            });
            // sort by order then createdAt
            items.sort((a,b) => (a.order - b.order) || ( (b.createdAt && a.createdAt) ? (a.createdAt.seconds - b.createdAt.seconds) : 0 ));
            const container = linksContainer();
            if (!container) return;
            container.innerHTML = '';
            items.forEach(it => container.appendChild(renderLinkCard(it)));
            // ensure delegation handlers present
        }, err => { console.error('Erro ao ouvir classLinks:', err); });
    }

    // Delegated event handlers for edit/delete (works for dynamic nodes)
    function attachDelegation(){
        const container = linksContainer();
        if (!container) return;
        container.removeEventListener('click', delegatedClick);
        container.addEventListener('click', delegatedClick);
    }

    function delegatedClick(e){
    const container = linksContainer();
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            e.preventDefault(); e.stopPropagation();
            const id = editBtn.getAttribute('data-id');
            openEditLinkModal(id);
            return;
        }
        const delBtn = e.target.closest('.btn-delete');
        if (delBtn) {
            e.preventDefault(); e.stopPropagation();
            const id = delBtn.getAttribute('data-id');
            if (!confirm('Excluir este link?')) return;
            window.db.collection('classLinks').doc(id).delete().then(()=>{
                // remove card from DOM immediately for responsive UI
                const card = container.querySelector(`[data-id="${id}"]`);
                if (card && card.parentNode) card.parentNode.removeChild(card);
            }).catch(err=> alert('Erro ao excluir: '+err.message));
            return;
        }
    }

    // Modal create/edit
    async function openEditLinkModal(id){
        // create modal markup dynamically if needed
        let modal = document.getElementById('classLinkModal');
        if (!modal) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="classLinkModal" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header bg-orange text-white">
                                <h5 class="modal-title">Gerenciar Link</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-2">
                                    <label class="form-label">Título</label>
                                    <input id="classLinkTitle" class="form-control" />
                                </div>
                                <div class="mb-2">
                                    <label class="form-label">URL</label>
                                    <input id="classLinkUrl" class="form-control" placeholder="https://drive.google.com/..." />
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button id="classLinkSave" class="btn btn-orange">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            modal = document.getElementById('classLinkModal');
        }

        const titleInput = document.getElementById('classLinkTitle');
        const urlInput = document.getElementById('classLinkUrl');
        const saveBtn = document.getElementById('classLinkSave');

        // helper to set/save state
        const setSaving = (saving) => {
            if (saving) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }
            else { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
        };

        if (!id) {
            titleInput.value = '';
            urlInput.value = '';
            saveBtn.onclick = async () => {
                const title = titleInput.value.trim();
                const url = urlInput.value.trim();
                if (!title || !url) { alert('Preencha título e URL'); return; }
                if (!isValidUrl(url)) { alert('URL inválida. Inclua http:// ou https://'); return; }
                try {
                    setSaving(true);
                    const ref = await window.db.collection('classLinks').add({ title, url, createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: firebase.auth().currentUser?.uid || null });
                    console.log('classLink criado:', ref.id, { title, url });
                    const m = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                    m.hide();
                } catch (err) {
                    console.error('Erro ao criar link:', err); alert('Erro ao criar link: '+(err.message||err.code||String(err)));
                } finally { setSaving(false); }
            };
        } else {
            // load existing
            try {
                setSaving(true);
                const doc = await window.db.collection('classLinks').doc(id).get();
                const data = doc.data() || {};
                titleInput.value = data.title || '';
                urlInput.value = data.url || '';
                saveBtn.onclick = async () => {
                    const title = titleInput.value.trim();
                    const url = urlInput.value.trim();
                    if (!title || !url) { alert('Preencha título e URL'); return; }
                    if (!isValidUrl(url)) { alert('URL inválida. Inclua http:// ou https://'); return; }
                    try {
                        setSaving(true);
                        await window.db.collection('classLinks').doc(id).update({ title, url });
                        const m = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                        m.hide();
                    } catch (err) { console.error('Erro ao atualizar link:', err); alert('Erro ao atualizar: '+err.message); }
                    finally { setSaving(false); }
                };
            } catch (err) { console.error('Erro ao carregar link:', err); alert('Erro ao carregar link: '+err.message); }
            finally { setSaving(false); }
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    async function submitComplaint(){
        const text = complaintText().value.trim();
        if (!text) return alert('Escreva sua sugestão/ reclamação');
    // Store complaints anonymously: do not record user id or name
    const payload = { message: text, createdAt: firebase.firestore.FieldValue.serverTimestamp(), seen: false, resolved: false, anonymous: true };
        try {
            btnSubmitComplaint().disabled = true;
            await window.db.collection('classComplaints').add(payload);
            complaintText().value = '';
            complaintStatus().style.display = 'block';
            setTimeout(()=> complaintStatus().style.display='none', 3000);
        } catch (err) { alert('Erro ao enviar reclamação: '+err.message); }
        finally { btnSubmitComplaint().disabled = false; }
    }

    // Init
    async function init(){
        // wait for firebase
        if (typeof firebase === 'undefined' || !window.db) { setTimeout(init, 500); return; }
        await checkAdmin();
        if (isAdmin && adminControls()) adminControls().style.display = 'block';
        subscribeClassLinks();
        attachDelegation();

        if (btnAdd()) btnAdd().addEventListener('click', ()=> openEditLinkModal(null));
        if (btnSubmitComplaint()) btnSubmitComplaint().addEventListener('click', submitComplaint);

        // re-check admin when auth changes
        firebase.auth().onAuthStateChanged(async (u)=>{ await checkAdmin(); if (isAdmin && adminControls()) adminControls().style.display='block'; else if (adminControls()) adminControls().style.display='none'; });
    }

    init();

})();

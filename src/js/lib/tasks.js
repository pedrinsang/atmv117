// ========================================
// GERENCIAMENTO DE TAREFAS (CRUD)
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
});

// Carrega tarefas (pode ser visto por qualquer logado, mas adicionar precisa de acesso)
function loadTasks() {
    if (!window.db) { setTimeout(loadTasks, 500); return; }

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    
    // Lista principal (Mês)
    window.db.collection('tasks')
        .orderBy('date', 'asc')
        .where('date', '>=', firstDay)
        .onSnapshot(snapshot => {
            const list = document.getElementById('tasksList');
            if (!list) return;
            
            list.innerHTML = '';
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-calendar-check fs-1"></i><p>Nenhuma tarefa futura.</p></div>';
                return;
            }

            snapshot.forEach(doc => {
                const t = doc.data();
                const taskEl = createTaskCard(doc.id, t);
                list.appendChild(taskEl);
            });
            
            // Atualiza cache do calendário se necessário
            if (typeof loadPageCalendarData === 'function') loadPageCalendarData();
        });
        
    // Lista da Semana
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    window.db.collection('tasks')
        .where('date', '>=', startOfWeek.toISOString())
        .where('date', '<', endOfWeek.toISOString())
        .orderBy('date', 'asc')
        .onSnapshot(snap => {
             const wList = document.getElementById('tasksWeekList');
             if(!wList) return;
             wList.innerHTML = '';
             if(snap.empty) {
                 wList.innerHTML = '<div class="col-12 text-center text-muted py-4">Livre esta semana!</div>';
                 return;
             }
             snap.forEach(doc => wList.appendChild(createTaskCard(doc.id, doc.data())));
        });
}

function createTaskCard(id, t) {
    const types = { 'prova': 'danger', 'trabalho': 'success', 'atividade': 'warning' };
    const color = types[t.type] || 'secondary';
    const dateObj = new Date(t.date + 'T12:00:00');
    const day = dateObj.getDate();
    const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    
    const isOwner = firebase.auth().currentUser && firebase.auth().currentUser.uid === t.userId;
    const isAdmin = window.isAdmin && window.isAdmin();
    
    let actions = '';
    if (isOwner || isAdmin) {
        actions = `
        <div class="dropdown position-absolute top-0 end-0 m-2">
            <button class="btn btn-link text-white p-0" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="#" onclick="openEditTaskModal('${id}')"><i class="bi bi-pencil me-2"></i>Editar</a></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="deleteTask('${id}')"><i class="bi bi-trash me-2"></i>Excluir</a></li>
            </ul>
        </div>`;
    }

    const div = document.createElement('div');
    div.className = 'col-12 col-md-6 col-lg-4';
    div.innerHTML = `
        <div class="card h-100 bg-glass border-0 position-relative task-card-hover">
            <div class="card-body d-flex align-items-center gap-3">
                <div class="text-center rounded p-2" style="background: rgba(255,255,255,0.05); min-width: 60px;">
                    <span class="d-block fw-bold fs-4 text-white" style="line-height:1">${day}</span>
                    <span class="d-block small text-muted" style="font-size:0.7rem">${month}</span>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <span class="badge bg-${color} mb-1">${t.type.toUpperCase()}</span>
                    <h6 class="fw-bold text-white text-truncate mb-0">${t.title}</h6>
                    <small class="text-muted text-truncate d-block">${t.description || ''}</small>
                </div>
            </div>
            ${actions}
        </div>
    `;
    return div;
}

// === MODAL E CRIAÇÃO (AGORA PROTEGIDOS) ===

window.openAddTaskModal = async function(dateStr = null, reopenMode = false) {
    // 1. Verificação de Segurança
    const hasAccess = await window.verifyClassAccess();
    if (!hasAccess) return;

    // Reset Form
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    document.getElementById('driveInputsContainer').innerHTML = '';
    document.getElementById('youtubeInputsContainer').innerHTML = '';
    
    // Configura data
    const dateInput = document.getElementById('taskDate');
    if (dateStr) {
        if(dateInput._flatpickr) dateInput._flatpickr.setDate(dateStr);
        else dateInput.value = dateStr;
    } else {
        if(dateInput._flatpickr) dateInput._flatpickr.clear();
    }
    
    // Configura modo de reabertura (para quando adicionar várias seguidas)
    document.getElementById('taskReopenMode').value = reopenMode ? 'true' : 'false';

    // Fecha o modal de detalhes do dia se estiver aberto
    const dayModal = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal'));
    if (dayModal) dayModal.hide();

    new bootstrap.Modal(document.getElementById('taskModal')).show();
};

window.addTask = async function() {
    // 1. Verificação de Segurança (Redundância)
    const hasAccess = await window.verifyClassAccess();
    if (!hasAccess) return;

    const user = firebase.auth().currentUser;
    const title = document.getElementById('taskTitle').value;
    const type = document.getElementById('taskType').value;
    const date = document.getElementById('taskDate').value;
    const desc = document.getElementById('taskDescription').value;
    const id = document.getElementById('taskId').value;
    const reopenMode = document.getElementById('taskReopenMode').value === 'true';

    if (!title || !date) return alert('Preencha título e data.');

    // Coleta anexos
    const attachments = [];
    document.querySelectorAll('.attachment-input-group').forEach(group => {
        const url = group.querySelector('input').value;
        const type = group.dataset.type;
        if(url) attachments.push({ url, type });
    });

    const btn = document.getElementById('btnSaveTask');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const taskData = {
            title, type, date, description: desc, attachments,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await window.db.collection('tasks').doc(id).update(taskData);
        } else {
            taskData.userId = user.uid;
            taskData.userName = user.displayName;
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await window.db.collection('tasks').add(taskData);
        }

        const modalEl = document.getElementById('taskModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Se veio do modal "Tarefas do Dia", reabre ele para mostrar a nova tarefa
        if (reopenMode && date) {
            setTimeout(() => {
                if(window.showPageDayTasks) window.showPageDayTasks(date);
            }, 500);
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao salvar.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Tarefa';
    }
};

window.openEditTaskModal = async function(id) {
    // Edição também deve ser verificada, embora o botão só apareça para o dono/admin
    const hasAccess = await window.verifyClassAccess(true); // silent
    if (!hasAccess) return;

    try {
        const doc = await window.db.collection('tasks').doc(id).get();
        if (!doc.exists) return;
        const t = doc.data();

        document.getElementById('taskId').value = id;
        document.getElementById('taskTitle').value = t.title;
        document.getElementById('taskType').value = t.type;
        document.getElementById('taskDescription').value = t.description || '';
        document.getElementById('modalTitle').textContent = 'Editar Tarefa';
        
        const dateInput = document.getElementById('taskDate');
        if(dateInput._flatpickr) dateInput._flatpickr.setDate(t.date);
        else dateInput.value = t.date;

        // Limpa e recria inputs de anexo
        document.getElementById('driveInputsContainer').innerHTML = '';
        document.getElementById('youtubeInputsContainer').innerHTML = '';
        
        if (t.attachments) {
            t.attachments.forEach(att => {
                window.addAttachmentField(att.type, att.url);
            });
        }
        
        // Fecha modal de visualização e abre de edição
        const dayModal = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal'));
        if (dayModal) dayModal.hide();

        new bootstrap.Modal(document.getElementById('taskModal')).show();

    } catch (e) { console.error(e); }
};

window.deleteTask = async function(id) {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
        await window.db.collection('tasks').doc(id).delete();
        // Se estiver no modal do dia, ele vai atualizar sozinho via listener ou fechar
        const dayModal = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal'));
        if (dayModal) dayModal.hide();
    } catch (e) { alert('Erro: ' + e.message); }
};

window.addAttachmentField = function(type, value = '') {
    const container = document.getElementById(type + 'InputsContainer');
    const div = document.createElement('div');
    div.className = 'input-group attachment-input-group mb-2';
    div.dataset.type = type;
    div.innerHTML = `
        <span class="input-group-text bg-dark border-secondary text-muted"><i class="bi bi-link-45deg"></i></span>
        <input type="text" class="form-control bg-dark text-white border-secondary" placeholder="Cole o link aqui" value="${value}">
        <button type="button" class="btn btn-outline-danger border-secondary" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button>
    `;
    container.appendChild(div);
};
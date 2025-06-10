let tasks = [];

function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    tasksList.innerHTML = '<div class="col-12 text-center"><div class="loading"></div></div>';

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    if (window.db) {
        window.db.collection('tasks')
            .where('date', '>=', monthStart.toISOString().split('T')[0])
            .where('date', '<=', monthEnd.toISOString().split('T')[0])
            .orderBy('date')
            .onSnapshot((snapshot) => {
                tasks = [];
                snapshot.forEach((doc) => {
                    tasks.push({ id: doc.id, ...doc.data() });
                });
                renderTasks();
            });
    } else {
        setTimeout(loadTasks, 1000);
    }
}

function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card">
                    <div class="card-body">
                        <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                        <p class="mt-3">Nenhuma tarefa para este mês</p>
                        <button class="btn btn-orange" onclick="abrirCalendarioTelaCheia()">
                            Abrir Calendário
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    tasksList.innerHTML = tasks.map(task => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card task-card task-type-${task.type}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                        <span class="badge bg-${getTypeColor(task.type)}">${task.type}</span>
                    </div>
                    <p class="card-text  small">${escapeHtml(task.description) || 'Sem descrição'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small>
                            <i class="bi bi-calendar-event"></i>
                            ${formatDate(task.date)}
                        </small>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editTask('${task.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteTask('${task.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function addTask() {
    const title = document.getElementById('taskTitle').value;
    const type = document.getElementById('taskType').value;
    const date = document.getElementById('taskDate').value;
    const description = document.getElementById('taskDescription').value;

    if (!title || !type || !date) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    const task = {
        title: title.trim(),
        type,
        date,
        description: description.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: 'Usuário'
    };

    // Se estiver editando, atualiza a tarefa
    if (window.editingTaskId) {
        if (window.db) {
            window.db.collection('tasks').doc(window.editingTaskId).update(task)
                .then(() => {
                    document.getElementById('taskForm').reset();
                    const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
                    if (modal) modal.hide();
                    window.editingTaskId = null;
                    // Volta o texto do botão para "Adicionar"
                    const addBtn = document.querySelector('#taskModal .btn-orange');
                    if (addBtn) addBtn.textContent = 'Adicionar';
                })
                .catch((error) => {
                    console.error('Erro ao editar tarefa:', error);
                    alert('Erro ao editar tarefa. Tente novamente.');
                });
        }
        return;
    }

    if (window.db) {
        window.db.collection('tasks').add(task)
            .then(() => {
                document.getElementById('taskForm').reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
                if (modal) modal.hide();
            })
            .catch((error) => {
                console.error('Erro ao adicionar tarefa:', error);
                alert('Erro ao adicionar tarefa. Tente novamente.');
            });
    }
}

function deleteTask(taskId) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
        if (window.db) {
            window.db.collection('tasks').doc(taskId).delete()
                .catch((error) => {
                    console.error('Erro ao excluir tarefa:', error);
                    alert('Erro ao excluir tarefa. Tente novamente.');
                });
        }
    }
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskType').value = task.type;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskDescription').value = task.description || '';

    // Salva o ID da tarefa em edição
    window.editingTaskId = taskId;

    // Abre o modal
    const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
    taskModal.show();

    // Troca o texto do botão para "Salvar"
    const addBtn = document.querySelector('#taskModal .btn-orange');
    if (addBtn) addBtn.textContent = 'Salvar';
}

function getTypeColor(type) {
    switch (type) {
        case 'prova': return 'danger';
        case 'trabalho': return 'warning';
        case 'atividade': return 'success';
        default: return 'secondary';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit' 
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addTask = addTask;
window.deleteTask = deleteTask;
window.loadTasks = loadTasks;
window.editTask = editTask;
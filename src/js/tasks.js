let tasks = [];

// Configuração do GitHub
const GITHUB_CONFIG = {
    owner: 'pedrinsang',
    repo: 'atmv117',
    token: '', // SEM TOKEN AQUI!
    branch: 'main'
};

// Função para obter token de forma segura
function getGitHubToken() {
    if (!GITHUB_CONFIG.token) {
        const token = localStorage.getItem('github_token') || 
                     prompt('Digite seu GitHub Personal Access Token:');
        if (token) {
            GITHUB_CONFIG.token = token;
            localStorage.setItem('github_token', token);
        }
    }
    return GITHUB_CONFIG.token;
}

// FUNÇÃO AUXILIAR - DEFINIR
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Função para upload no GitHub
async function uploadToGitHub(file, taskId) {
    const token = getGitHubToken();
    if (!token) {
        throw new Error('Token do GitHub é necessário');
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const path = `uploads/${fileName}`;
    
    try {
        const base64Content = await fileToBase64(file);
        const content = base64Content.split(',')[1];
        
        const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`, // Usar token da função
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Upload: ${fileName} for task ${taskId}`,
                content: content,
                branch: GITHUB_CONFIG.branch
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('GitHub API Error:', errorData);
            throw new Error(`GitHub upload failed: ${response.status} - ${errorData.message}`);
        }
        
        const result = await response.json();
        
        return {
            name: file.name,
            fileName: fileName,
            path: path,
            downloadUrl: result.content.download_url,
            sha: result.content.sha,
            size: file.size,
            type: file.type
        };
        
    } catch (error) {
        console.error('Erro no upload GitHub:', error);
        throw error;
    }
}

// Função para deletar arquivo do GitHub
async function deleteFromGitHub(filePath, sha) {
    const token = getGitHubToken();
    if (!token) return;

    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`, // Usar token da função
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Delete: ${filePath}`,
                sha: sha,
                branch: GITHUB_CONFIG.branch
            })
        });
        
        if (!response.ok) {
            console.warn(`Erro ao deletar ${filePath}: ${response.status}`);
        }
        
    } catch (error) {
        console.warn('Erro ao deletar arquivo do GitHub:', error);
    }
}

// Função para carregar tarefas
function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    tasksList.innerHTML = '<div class="col-12 text-center"><div class="loading"></div></div>';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
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
                    const task = { id: doc.id, ...doc.data() };
                    // Exclui tarefas passadas
                    if (task.date < todayStr) {
                        window.db.collection('tasks').doc(task.id).delete();
                    } else {
                        tasks.push(task);
                    }
                });
                renderTasks();
                renderWeekTasks(); // Chama a renderização da aba da semana
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
                        <i class="bi bi-calendar-x " style="font-size: 3rem;"></i>
                        <p class=" mt-3">Nenhuma tarefa para este mês</p>
                        <button class="btn btn-orange" onclick="abrirCalendarioTelaCheia()">
                            Abrir Calendário
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Destaca a próxima tarefa do mês
    const todayStr = new Date().toISOString().split('T')[0];
    const nextTaskIndex = tasks.findIndex(task => task.date >= todayStr);

    tasksList.innerHTML = tasks.map((task, idx) => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card task-card task-type-${task.type} ${idx === nextTaskIndex ? 'border border-4 border-orange' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                        <span class="badge bg-${getTypeColor(task.type)}">${task.type}</span>
                    </div>
                    <p class="card-text small">${escapeHtml(task.description) || 'Sem descrição'}</p>
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

function renderWeekTasks() {
    const tasksWeekList = document.getElementById('tasksWeekList');
    if (!tasksWeekList) return;

    // Filtra tarefas da semana atual
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.date + 'T00:00:00');
        return taskDate >= weekStart && taskDate <= weekEnd;
    }).sort((a, b) => a.date.localeCompare(b.date));

    if (weekTasks.length === 0) {
        tasksWeekList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card">
                    <div class="card-body">
                        <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                        <p class="mt-3">Nenhuma tarefa para esta semana</p>
                        <button class="btn btn-orange" onclick="abrirCalendarioTelaCheia()">
                            Abrir Calendário
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Destaca a próxima tarefa
    const nextTaskIndex = weekTasks.findIndex(task => task.date >= today.toISOString().split('T')[0]);
    tasksWeekList.innerHTML = weekTasks.map((task, idx) => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card task-card task-type-${task.type} ${idx === nextTaskIndex ? 'border border-4 border-orange' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                        <span class="badge bg-${getTypeColor(task.type)}">${task.type}</span>
                    </div>
                    <p class="card-text small">${escapeHtml(task.description) || 'Sem descrição'}</p>
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
window.renderWeekTasks = renderWeekTasks;
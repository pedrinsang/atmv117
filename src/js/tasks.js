let tasks = [];

// Configuração do GitHub
const GITHUB_CONFIG = {
    owner: 'pedrinsang',
    repo: 'atmv117',
    token: '', // Será preenchido dinamicamente
    branch: 'main'
};

// Função para carregar token do ambiente (simulação client-side)
function initGitHubConfig() {
    // Para produção, o token seria carregado de variáveis de ambiente
    // Por agora, vamos usar uma abordagem mais segura
    const token = prompt('Digite seu GitHub Token (será usado apenas nesta sessão):');
    if (token) {
        GITHUB_CONFIG.token = token;
        localStorage.setItem('gh_token', token); // Temporário na sessão
    }
}

// Carregar token do localStorage se existir
if (localStorage.getItem('gh_token')) {
    GITHUB_CONFIG.token = localStorage.getItem('gh_token');
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
                'Authorization': `token ${GITHUB_CONFIG.token}`,
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
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
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
    if (!window.db) {
        console.log('Firestore não inicializado ainda...');
        setTimeout(loadTasks, 1000);
        return;
    }

    window.db.collection('tasks')
        .orderBy('date', 'asc')
        .get()
        .then((querySnapshot) => {
            tasks = [];
            querySnapshot.forEach((doc) => {
                tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderTasks();
            renderWeekTasks();
        })
        .catch((error) => {
            console.error('Erro ao carregar tarefas:', error);
        });
}

// Função para escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Função para formatar data
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Função para obter cor do tipo
function getTypeColor(type) {
    switch(type) {
        case 'prova': return 'danger';
        case 'trabalho': return 'warning';
        case 'atividade': return 'info';
        default: return 'secondary';
    }
}

// Função para renderizar tarefas
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card">
                    <div class="card-body">
                        <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                        <p class="mt-3">Nenhuma tarefa cadastrada</p>
                        <button class="btn btn-orange" data-bs-toggle="modal" data-bs-target="#taskModal">
                            Adicionar Primeira Tarefa
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTaskIndex = tasks.findIndex(task => task.date >= todayStr);

    // Na função renderTasks(), substitua o HTML do card por:
    tasksList.innerHTML = tasks.map((task, idx) => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card task-card task-type-${task.type} ${idx === nextTaskIndex ? 'border border-4 border-orange' : ''}" 
                 style="cursor: pointer;" 
                 onclick="showTaskDetails('${task.id}')">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                        <span class="badge bg-${getTypeColor(task.type)}">${task.type}</span>
                    </div>
                    <p class="card-text small">${escapeHtml(task.description) || 'Sem descrição'}</p>
                    
                    ${renderAttachments(task.attachments)}
                    
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <small>
                            <i class="bi bi-calendar-event"></i>
                            ${formatDate(task.date)}
                        </small>
                        <div onclick="event.stopPropagation();">
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

// Função para renderizar tarefas da semana
function renderWeekTasks() {
    const tasksWeekList = document.getElementById('tasksWeekList');
    if (!tasksWeekList) return;

    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6);

    const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.date + 'T00:00:00');
        return taskDate >= weekStart && taskDate <= weekEnd;
    });

    if (weekTasks.length === 0) {
        tasksWeekList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card">
                    <div class="card-body">
                        <i class="bi bi-calendar-check" style="font-size: 3rem;"></i>
                        <p class="mt-3">Nenhuma tarefa para esta semana</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTaskIndex = weekTasks.findIndex(task => task.date >= todayStr);

    tasksWeekList.innerHTML = weekTasks.map((task, idx) => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card task-card task-type-${task.type} ${idx === nextTaskIndex ? 'border border-4 border-orange' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                        <span class="badge bg-${getTypeColor(task.type)}">${task.type}</span>
                    </div>
                    <p class="card-text small">${escapeHtml(task.description) || 'Sem descrição'}</p>
                    
                    ${renderAttachments(task.attachments)}
                    
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

// Função para editar tarefa
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Definir modo de edição ANTES de abrir o modal
    window.editingTaskId = taskId;

    // Preencher formulário
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskType').value = task.type;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskDescription').value = task.description || '';

    // Preencher Google Drive links
    const container = document.getElementById('googleDriveContainer');
    container.innerHTML = '';
    
    if (task.attachments && task.attachments.googleDriveLinks && task.attachments.googleDriveLinks.length > 0) {
        task.attachments.googleDriveLinks.forEach((link, index) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'input-group mb-2';
            fieldDiv.innerHTML = `
                <input type="url" class="form-control form-control-sm" 
                       placeholder="https://drive.google.com/..." 
                       name="googleDriveLink" value="${link}">
                ${index === 0 ? 
                    `<button type="button" class="btn btn-sm btn-outline-success" onclick="addGoogleDriveField()">
                        <i class="bi bi-plus"></i>
                    </button>` :
                    `<button type="button" class="btn btn-sm btn-outline-danger" onclick="removeGoogleDriveField(this)">
                        <i class="bi bi-trash"></i>
                    </button>`
                }
            `;
            container.appendChild(fieldDiv);
        });
    } else {
        // Campo padrão
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'input-group mb-2';
        fieldDiv.innerHTML = `
            <input type="url" class="form-control form-control-sm" 
                   placeholder="https://drive.google.com/..." 
                   name="googleDriveLink">
            <button type="button" class="btn btn-sm btn-outline-success" onclick="addGoogleDriveField()">
                <i class="bi bi-plus"></i>
            </button>
        `;
        container.appendChild(fieldDiv);
    }

    // Alterar texto do botão e título
    const addBtn = document.querySelector('#taskModal .btn-orange');
    const modalTitle = document.querySelector('#taskModal .modal-title');
    
    if (addBtn) addBtn.textContent = 'Atualizar';
    if (modalTitle) modalTitle.textContent = 'Editar Tarefa';

    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

// Função para adicionar campo de Google Drive
function addGoogleDriveField() {
    const container = document.getElementById('googleDriveContainer');
    const newField = document.createElement('div');
    newField.className = 'input-group mb-2';
    newField.innerHTML = `
        <input type="url" class="form-control form-control-sm" 
               placeholder="https://drive.google.com/..." 
               name="googleDriveLink">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeGoogleDriveField(this)">
            <i class="bi bi-trash"></i>
        </button>
    `;
    container.appendChild(newField);
}

// Função para remover campo de Google Drive
function removeGoogleDriveField(button) {
    button.parentElement.remove();
}

// Preview dos arquivos selecionados
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('taskFiles');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const preview = document.getElementById('filesPreview');
            preview.innerHTML = '';
            
            Array.from(this.files).forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'alert alert-light py-2 mb-1';
                fileDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <i class="bi bi-file-earmark"></i>
                            <span class="small">${file.name}</span>
                            <span class="badge bg-secondary ms-2">${formatFileSize(file.size)}</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFile(${index})">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
                preview.appendChild(fileDiv);
            });
        });
    }
});

// Função para formatar tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Função para remover arquivo da seleção
function removeFile(index) {
    const fileInput = document.getElementById('taskFiles');
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
}

// Função addTask atualizada para múltiplos arquivos
async function addTask() {
    const title = document.getElementById('taskTitle').value;
    const type = document.getElementById('taskType').value;
    const date = document.getElementById('taskDate').value;
    const description = document.getElementById('taskDescription').value;
    
    // Coletar múltiplos links do Google Drive
    const googleDriveInputs = document.querySelectorAll('input[name="googleDriveLink"]');
    const googleDriveLinks = Array.from(googleDriveInputs)
        .map(input => input.value.trim())
        .filter(link => link);
    
    // Coletar múltiplos arquivos
    const files = Array.from(document.getElementById('taskFiles').files);

    if (!title || !type || !date) {
        alert('Por favor, preencha os campos obrigatórios.');
        return;
    }

    // Verificar tamanho dos arquivos
    for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
            alert(`Arquivo "${file.name}" muito grande! Máximo 25MB por arquivo.`);
            return;
        }
    }

    try {
        const taskId = Date.now().toString();
        const addBtn = document.querySelector('#taskModal .btn-orange');
        const originalText = addBtn.textContent;
        
        const attachments = {
            googleDriveLinks: googleDriveLinks,
            files: []
        };

        // Upload de múltiplos arquivos
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            addBtn.textContent = `Enviando arquivo ${i + 1}/${files.length}...`;
            console.log(`Fazendo upload do arquivo: ${file.name}`);
            
            const uploadedFile = await uploadToGitHub(file, taskId);
            attachments.files.push(uploadedFile);
        }

        addBtn.textContent = 'Salvando...';

        const task = {
            title,
            type,
            date,
            description,
            attachments,
            createdAt: new Date().toISOString()
        };

        if (window.editingTaskId) {
            // Ao editar, deletar arquivos antigos se necessário
            const oldTask = tasks.find(t => t.id === window.editingTaskId);
            if (oldTask && oldTask.attachments && oldTask.attachments.files) {
                for (const oldFile of oldTask.attachments.files) {
                    await deleteFromGitHub(oldFile.path, oldFile.sha);
                }
            }
            
            await window.db.collection('tasks').doc(window.editingTaskId).update(task);
            window.editingTaskId = null;
        } else {
            await window.db.collection('tasks').add(task);
        }
        
        // Limpar formulário completamente
        clearTaskForm();
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
        modal.hide();
        
        loadTasks();
        
    } catch (error) {
        console.error('Erro ao adicionar tarefa:', error);
        alert('Erro ao fazer upload ou salvar tarefa. Tente novamente.');
        
        const addBtn = document.querySelector('#taskModal .btn-orange');
        addBtn.textContent = window.editingTaskId ? 'Atualizar' : 'Adicionar';
    }
}

// Função deleteTask atualizada para múltiplos arquivos
async function deleteTask(taskId) {
    if (confirm('Tem certeza que deseja excluir esta tarefa? Todos os arquivos anexados também serão removidos.')) {
        try {
            const task = tasks.find(t => t.id === taskId);
            
            // Deletar múltiplos arquivos do GitHub
            if (task && task.attachments && task.attachments.files) {
                console.log(`Deletando ${task.attachments.files.length} arquivos do GitHub...`);
                for (const file of task.attachments.files) {
                    await deleteFromGitHub(file.path, file.sha);
                }
            }
            
            // Deletar tarefa do Firestore
            await window.db.collection('tasks').doc(taskId).delete();
            loadTasks();
            
        } catch (error) {
            console.error('Erro ao excluir tarefa:', error);
            alert('Erro ao excluir tarefa. Tente novamente.');
        }
    }
}

// Função renderAttachments atualizada para múltiplos anexos
function renderAttachments(attachments) {
    if (!attachments) return '';
    
    let html = '';
    
    // Múltiplos links do Google Drive
    if (attachments.googleDriveLinks && attachments.googleDriveLinks.length > 0) {
        attachments.googleDriveLinks.forEach((link, index) => {
            html += `
                <div class="mb-1">
                    <a href="${link}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-google"></i> Google Drive ${index + 1}
                    </a>
                </div>
            `;
        });
    }
    
    // Múltiplos arquivos
    if (attachments.files && attachments.files.length > 0) {
        attachments.files.forEach(file => {
            const icon = getFileIcon(file.type);
            const color = getFileColor(file.type);
            
            html += `
                <div class="mb-1">
                    <a href="${file.downloadUrl}" target="_blank" class="btn btn-sm btn-outline-${color}">
                        <i class="bi bi-${icon}"></i> ${file.name}
                    </a>
                </div>
            `;
        });
    }
    
    // Compatibilidade com formato antigo
    if (attachments.googleDrive) {
        html += `
            <div class="mb-1">
                <a href="${attachments.googleDrive}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-google"></i> Google Drive
                </a>
            </div>
        `;
    }
    
    if (attachments.pdf) {
        html += `
            <div class="mb-1">
                <a href="${attachments.pdf.downloadUrl || attachments.pdf}" target="_blank" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-file-earmark-pdf"></i> ${attachments.pdf.name || 'PDF'}
                </a>
            </div>
        `;
    }
    
    if (attachments.pptx) {
        html += `
            <div class="mb-1">
                <a href="${attachments.pptx.downloadUrl || attachments.pptx}" target="_blank" class="btn btn-sm btn-outline-warning">
                    <i class="bi bi-file-earmark-slides"></i> ${attachments.pptx.name || 'PowerPoint'}
                </a>
            </div>
        `;
    }
    
    return html ? `<div class="attachments mb-2">${html}</div>` : '';
}

// Função para determinar ícone do arquivo
function getFileIcon(type) {
    if (type.includes('pdf')) return 'file-earmark-pdf';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'file-earmark-slides';
    if (type.includes('word') || type.includes('document')) return 'file-earmark-word';
    if (type.includes('image')) return 'file-earmark-image';
    if (type.includes('text')) return 'file-earmark-text';
    return 'file-earmark';
}

// Função para determinar cor do botão
function getFileColor(type) {
    if (type.includes('pdf')) return 'danger';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'warning';
    if (type.includes('word') || type.includes('document')) return 'primary';
    if (type.includes('image')) return 'success';
    if (type.includes('text')) return 'info';
    return 'secondary';
}

// Variável para armazenar a tarefa atual sendo visualizada
let currentViewingTask = null;

// Função para mostrar detalhes da tarefa
function showTaskDetails(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentViewingTask = task;

    // Preencher informações básicas
    document.getElementById('taskDetailsTitle').textContent = task.title;
    document.getElementById('taskDetailsType').textContent = task.type;
    document.getElementById('taskDetailsType').className = `badge bg-${getTypeColor(task.type)} ms-2`;
    document.getElementById('taskDetailsDate').textContent = formatDate(task.date);
    document.getElementById('taskDetailsDescription').textContent = task.description || 'Sem descrição';

    // Renderizar anexos existentes
    renderExistingAttachments(task.attachments);

    // Resetar seção de adicionar anexos
    hideAddAttachmentsSection();

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
    modal.show();
}

// Função para renderizar anexos existentes com opção de remover
function renderExistingAttachments(attachments) {
    const container = document.getElementById('existingAttachments');
    
    if (!attachments || (!attachments.googleDriveLinks?.length && !attachments.files?.length && !attachments.googleDrive && !attachments.pdf && !attachments.pptx)) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                <p class="mt-2">Nenhum anexo</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Google Drive Links (novo formato)
    if (attachments.googleDriveLinks?.length > 0) {
        attachments.googleDriveLinks.forEach((link, index) => {
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                        <a href="${link}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-google"></i> Google Drive ${index + 1}
                        </a>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeGoogleDriveLink(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        });
    }

    // Arquivos (novo formato)
    if (attachments.files?.length > 0) {
        attachments.files.forEach((file, index) => {
            const icon = getFileIcon(file.type);
            const color = getFileColor(file.type);
            
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                        <a href="${file.downloadUrl}" target="_blank" class="btn btn-sm btn-outline-${color}">
                            <i class="bi bi-${icon}"></i> ${file.name}
                        </a>
                        <small class="text-muted ms-2">${formatFileSize(file.size)}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeAttachedFile(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        });
    }

    // Compatibilidade com formato antigo
    if (attachments.googleDrive) {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                <div>
                    <a href="${attachments.googleDrive}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-google"></i> Google Drive (antigo)
                    </a>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeLegacyGoogleDrive()">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    }

    if (attachments.pdf) {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                <div>
                    <a href="${attachments.pdf.downloadUrl || attachments.pdf}" target="_blank" class="btn btn-sm btn-outline-danger">
                        <i class="bi bi-file-earmark-pdf"></i> ${attachments.pdf.name || 'PDF'}
                    </a>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeLegacyPdf()">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    }

    if (attachments.pptx) {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                <div>
                    <a href="${attachments.pptx.downloadUrl || attachments.pptx}" target="_blank" class="btn btn-sm btn-outline-warning">
                        <i class="bi bi-file-earmark-slides"></i> ${attachments.pptx.name || 'PowerPoint'}
                    </a>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeLegacyPptx()">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Função para mostrar seção de adicionar anexos
function showAddAttachmentsSection() {
    document.getElementById('addAttachmentsSection').style.display = 'block';
    
    // Configurar event listener para preview de novos arquivos
    const newFileInput = document.getElementById('newTaskFiles');
    newFileInput.addEventListener('change', function() {
        const preview = document.getElementById('newFilesPreview');
        preview.innerHTML = '';
        
        Array.from(this.files).forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'alert alert-light py-2 mb-1';
            fileDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-file-earmark"></i>
                        <span class="small">${file.name}</span>
                        <span class="badge bg-secondary ms-2">${formatFileSize(file.size)}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeNewFile(${index})">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
            preview.appendChild(fileDiv);
        });
    });
}

// Função para esconder seção de adicionar anexos
function hideAddAttachmentsSection() {
    document.getElementById('addAttachmentsSection').style.display = 'none';
    
    // Limpar campos
    document.getElementById('newGoogleDriveContainer').innerHTML = `
        <div class="input-group mb-2">
            <input type="url" class="form-control form-control-sm" 
                   placeholder="https://drive.google.com/..." 
                   name="newGoogleDriveLink">
            <button type="button" class="btn btn-sm btn-outline-success" onclick="addNewGoogleDriveField()">
                <i class="bi bi-plus"></i>
            </button>
        </div>
    `;
    document.getElementById('newTaskFiles').value = '';
    document.getElementById('newFilesPreview').innerHTML = '';
}

// Função para adicionar campo de Google Drive na seção de novos
function addNewGoogleDriveField() {
    const container = document.getElementById('newGoogleDriveContainer');
    const newField = document.createElement('div');
    newField.className = 'input-group mb-2';
    newField.innerHTML = `
        <input type="url" class="form-control form-control-sm" 
               placeholder="https://drive.google.com/..." 
               name="newGoogleDriveLink">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeNewGoogleDriveField(this)">
            <i class="bi bi-trash"></i>
        </button>
    `;
    container.appendChild(newField);
}

// Função para remover campo de Google Drive na seção de novos
function removeNewGoogleDriveField(button) {
    button.parentElement.remove();
}

// Função para remover arquivo da seleção de novos
function removeNewFile(index) {
    const fileInput = document.getElementById('newTaskFiles');
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
}

// Função para adicionar novos anexos à tarefa
async function addNewAttachments() {
    if (!currentViewingTask) return;

    try {
        const addBtn = document.querySelector('#addAttachmentsSection .btn-success');
        const originalText = addBtn.textContent;
        
        // Coletar novos links do Google Drive
        const newGoogleDriveInputs = document.querySelectorAll('input[name="newGoogleDriveLink"]');
        const newGoogleDriveLinks = Array.from(newGoogleDriveInputs)
            .map(input => input.value.trim())
            .filter(link => link);
        
        // Coletar novos arquivos
        const newFiles = Array.from(document.getElementById('newTaskFiles').files);

        if (newGoogleDriveLinks.length === 0 && newFiles.length === 0) {
            alert('Selecione pelo menos um link ou arquivo para adicionar.');
            return;
        }

        // Verificar tamanho dos arquivos
        for (const file of newFiles) {
            if (file.size > 25 * 1024 * 1024) {
                alert(`Arquivo "${file.name}" muito grande! Máximo 25MB por arquivo.`);
                return;
            }
        }

        // Obter anexos atuais
        const currentAttachments = currentViewingTask.attachments || {};
        
        // Adicionar novos links do Google Drive
        if (newGoogleDriveLinks.length > 0) {
            const existingLinks = currentAttachments.googleDriveLinks || [];
            currentAttachments.googleDriveLinks = [...existingLinks, ...newGoogleDriveLinks];
        }

        // Upload de novos arquivos
        const existingFiles = currentAttachments.files || [];
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            addBtn.textContent = `Enviando ${i + 1}/${newFiles.length}...`;
            
            const uploadedFile = await uploadToGitHub(file, currentViewingTask.id);
            existingFiles.push(uploadedFile);
        }
        
        currentAttachments.files = existingFiles;

        addBtn.textContent = 'Salvando...';

        // Atualizar no Firestore
        await window.db.collection('tasks').doc(currentViewingTask.id).update({
            attachments: currentAttachments
        });

        // Atualizar tarefa local
        const taskIndex = tasks.findIndex(t => t.id === currentViewingTask.id);
        if (taskIndex !== -1) {
            tasks[taskIndex].attachments = currentAttachments;
            currentViewingTask.attachments = currentAttachments;
        }

        // Recarregar visualização
        renderExistingAttachments(currentAttachments);
        hideAddAttachmentsSection();
        loadTasks(); // Atualizar lista principal

        addBtn.textContent = originalText;

    } catch (error) {
        console.error('Erro ao adicionar anexos:', error);
        alert('Erro ao adicionar anexos. Tente novamente.');
    }
}

// Funções para remover anexos específicos
async function removeGoogleDriveLink(index) {
    if (!currentViewingTask || !confirm('Remover este link do Google Drive?')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        attachments.googleDriveLinks.splice(index, 1);

        await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
        
        currentViewingTask.attachments = attachments;
        renderExistingAttachments(attachments);
        loadTasks();

    } catch (error) {
        console.error('Erro ao remover link:', error);
        alert('Erro ao remover link.');
    }
}

async function removeAttachedFile(index) {
    if (!currentViewingTask || !confirm('Remover este arquivo? Ele será deletado permanentemente.')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        const fileToDelete = attachments.files[index];
        
        // Deletar do GitHub
        await deleteFromGitHub(fileToDelete.path, fileToDelete.sha);
        
        // Remover da lista
        attachments.files.splice(index, 1);

        await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
        
        currentViewingTask.attachments = attachments;
        renderExistingAttachments(attachments);
        loadTasks();

    } catch (error) {
        console.error('Erro ao remover arquivo:', error);
        alert('Erro ao remover arquivo.');
    }
}

// Funções para remover anexos legados
async function removeLegacyGoogleDrive() {
    if (!currentViewingTask || !confirm('Remover este link do Google Drive?')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        delete attachments.googleDrive;

        await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
        
        currentViewingTask.attachments = attachments;
        renderExistingAttachments(attachments);
        loadTasks();

    } catch (error) {
        console.error('Erro ao remover link legado:', error);
        alert('Erro ao remover link.');
    }
}

async function removeLegacyPdf() {
    if (!currentViewingTask || !confirm('Remover este PDF? Ele será deletado permanentemente.')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        
        if (attachments.pdf.path && attachments.pdf.sha) {
            await deleteFromGitHub(attachments.pdf.path, attachments.pdf.sha);
        }
        
        delete attachments.pdf;

        await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
        
        currentViewingTask.attachments = attachments;
        renderExistingAttachments(attachments);
        loadTasks();

    } catch (error) {
        console.error('Erro ao remover PDF legado:', error);
        alert('Erro ao remover PDF.');
    }
}

async function removeLegacyPptx() {
    if (!currentViewingTask || !confirm('Remover este PowerPoint? Ele será deletado permanentemente.')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        
        if (attachments.pptx.path && attachments.pptx.sha) {
            await deleteFromGitHub(attachments.pptx.path, attachments.pptx.sha);
        }
        
        delete attachments.pptx;

        await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
        
        currentViewingTask.attachments = attachments;
        renderExistingAttachments(attachments);
        loadTasks();

    } catch (error) {
        console.error('Erro ao remover PowerPoint legado:', error);
        alert('Erro ao remover PowerPoint.');
    }
}

// Funções para editar/deletar tarefa a partir do modal de detalhes
function editTaskFromDetails() {
    if (!currentViewingTask) return;
    
    // Fechar modal de detalhes
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    detailsModal.hide();
    
    // Abrir modal de edição
    setTimeout(() => {
        editTask(currentViewingTask.id);
    }, 300);
}

function deleteTaskFromDetails() {
    if (!currentViewingTask) return;
    
    // Fechar modal de detalhes
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    detailsModal.hide();
    
    // Deletar tarefa
    setTimeout(() => {
        deleteTask(currentViewingTask.id);
    }, 300);
}

// Função para limpar o formulário de nova tarefa
function clearTaskForm() {
    document.getElementById('taskForm').reset();
    
    // Limpar Google Drive container
    document.getElementById('googleDriveContainer').innerHTML = `
        <div class="input-group mb-2">
            <input type="url" class="form-control form-control-sm" 
                   placeholder="https://drive.google.com/..." 
                   name="googleDriveLink">
            <button type="button" class="btn btn-sm btn-outline-success" onclick="addGoogleDriveField()">
                <i class="bi bi-plus"></i>
            </button>
        </div>
    `;
    
    // Limpar preview de arquivos
    document.getElementById('filesPreview').innerHTML = '';
    
    // Resetar botão e título
    const addBtn = document.querySelector('#taskModal .btn-orange');
    const modalTitle = document.querySelector('#taskModal .modal-title');
    
    if (addBtn) addBtn.textContent = 'Adicionar';
    if (modalTitle) modalTitle.textContent = 'Adicionar Tarefa';
    
    // Limpar ID de edição
    window.editingTaskId = null;
}

// Event listener para limpar formulário quando modal for aberto para nova tarefa
document.addEventListener('DOMContentLoaded', function() {
    const taskModal = document.getElementById('taskModal');
    if (taskModal) {
        taskModal.addEventListener('show.bs.modal', function() {
            // Se não está editando uma tarefa, limpar o formulário
            if (!window.editingTaskId) {
                clearTaskForm();
            }
        });
    }
    
    // ...resto do código DOMContentLoaded existente...
    const fileInput = document.getElementById('taskFiles');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const preview = document.getElementById('filesPreview');
            preview.innerHTML = '';
            
            Array.from(this.files).forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'alert alert-light py-2 mb-1';
                fileDiv.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <i class="bi bi-file-earmark"></i>
                            <span class="small">${file.name}</span>
                            <span class="badge bg-secondary ms-2">${formatFileSize(file.size)}</span>
                        </div>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFile(${index})">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
                preview.appendChild(fileDiv);
            });
        });
    }
});
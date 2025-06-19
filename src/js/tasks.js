// ===== VARIÁVEIS GLOBAIS =====
let tasks = [];
let currentViewingTask = null;

// Configuração do GitHub
const GITHUB_CONFIG = {
    owner: 'pedrinsang',
    repo: 'atmv117',
    token: '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',
    branch: 'main'
};

// ===== FUNÇÕES AUXILIARES =====

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit' 
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTypeColor(type) {
    switch (type) {
        case 'prova': return 'danger';
        case 'trabalho': return 'warning';
        case 'atividade': return 'success';
        default: return 'secondary';
    }
}

function getFileIcon(type) {
    if (type.includes('pdf')) return 'file-earmark-pdf';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'file-earmark-slides';
    if (type.includes('word') || type.includes('document')) return 'file-earmark-word';
    if (type.includes('image')) return 'file-earmark-image';
    if (type.includes('text')) return 'file-earmark-text';
    return 'file-earmark';
}

function getFileColor(type) {
    if (type.includes('pdf')) return 'danger';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'warning';
    if (type.includes('word') || type.includes('document')) return 'primary';
    if (type.includes('image')) return 'success';
    if (type.includes('text')) return 'info';
    return 'secondary';
}

// ===== FUNÇÕES DO GITHUB =====

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

// ===== FUNÇÕES DE CARREGAMENTO =====

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
                renderWeekTasks();
            });
    } else {
        setTimeout(loadTasks, 1000);
    }
}

// ===== FUNÇÕES DE RENDERIZAÇÃO =====

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

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTaskIndex = tasks.findIndex(task => task.date >= todayStr);

    tasksList.innerHTML = tasks.map((task, idx) => {
        // Função para renderizar ícones de anexos
        function renderAttachmentIcons(attachments) {
            if (!attachments) return '';
            
            let icons = '';
            
            // Ícone para Google Drive Links
            if (attachments.googleDriveLinks?.length > 0) {
                icons += `
                    <span class="badge bg-primary me-1" title="${attachments.googleDriveLinks.length} link(s) Google Drive">
                        <i class="bi bi-google"></i> ${attachments.googleDriveLinks.length}
                    </span>
                `;
            }
            
            // Ícones para arquivos por tipo
            if (attachments.files?.length > 0) {
                const fileTypes = {};
                attachments.files.forEach(file => {
                    const type = file.type || 'application/octet-stream';
                    if (type.includes('pdf')) {
                        fileTypes.pdf = (fileTypes.pdf || 0) + 1;
                    } else if (type.includes('powerpoint') || type.includes('presentation')) {
                        fileTypes.ppt = (fileTypes.ppt || 0) + 1;
                    } else if (type.includes('word') || type.includes('document')) {
                        fileTypes.doc = (fileTypes.doc || 0) + 1;
                    } else if (type.includes('image')) {
                        fileTypes.img = (fileTypes.img || 0) + 1;
                    } else {
                        fileTypes.file = (fileTypes.file || 0) + 1;
                    }
                });
                
                // PDF
                if (fileTypes.pdf) {
                    icons += `
                        <span class="badge bg-danger me-1" title="${fileTypes.pdf} arquivo(s) PDF">
                            <i class="bi bi-file-earmark-pdf"></i> ${fileTypes.pdf}
                        </span>
                    `;
                }
                
                // PowerPoint
                if (fileTypes.ppt) {
                    icons += `
                        <span class="badge bg-warning me-1" title="${fileTypes.ppt} apresentação(ões)">
                            <i class="bi bi-file-earmark-slides"></i> ${fileTypes.ppt}
                        </span>
                    `;
                }
                
                // Word
                if (fileTypes.doc) {
                    icons += `
                        <span class="badge bg-info me-1" title="${fileTypes.doc} documento(s)">
                            <i class="bi bi-file-earmark-word"></i> ${fileTypes.doc}
                        </span>
                    `;
                }
                
                // Imagens
                if (fileTypes.img) {
                    icons += `
                        <span class="badge bg-success me-1" title="${fileTypes.img} imagem(ns)">
                            <i class="bi bi-file-earmark-image"></i> ${fileTypes.img}
                        </span>
                    `;
                }
                
                // Outros arquivos
                if (fileTypes.file) {
                    icons += `
                        <span class="badge bg-secondary me-1" title="${fileTypes.file} arquivo(s)">
                            <i class="bi bi-file-earmark"></i> ${fileTypes.file}
                        </span>
                    `;
                }
            }
            
            return icons ? `<div class="mt-2">${icons}</div>` : '';
        }

        return `
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
                        
                        ${renderAttachmentIcons(task.attachments)}
                        
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
        `;
    }).join('');
}

function renderWeekTasks() {
    const tasksWeekList = document.getElementById('tasksWeekList');
    if (!tasksWeekList) return;

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

    const nextTaskIndex = weekTasks.findIndex(task => task.date >= today.toISOString().split('T')[0]);
    
    tasksWeekList.innerHTML = weekTasks.map((task, idx) => {
        // Função para renderizar ícones de anexos (mesma da renderTasks)
        function renderAttachmentIcons(attachments) {
            if (!attachments) return '';
            
            let icons = '';
            
            if (attachments.googleDriveLinks?.length > 0) {
                icons += `
                    <span class="badge bg-primary me-1" title="${attachments.googleDriveLinks.length} link(s) Google Drive">
                        <i class="bi bi-google"></i> ${attachments.googleDriveLinks.length}
                    </span>
                `;
            }
            
            if (attachments.files?.length > 0) {
                const fileTypes = {};
                attachments.files.forEach(file => {
                    const type = file.type || 'application/octet-stream';
                    if (type.includes('pdf')) {
                        fileTypes.pdf = (fileTypes.pdf || 0) + 1;
                    } else if (type.includes('powerpoint') || type.includes('presentation')) {
                        fileTypes.ppt = (fileTypes.ppt || 0) + 1;
                    } else if (type.includes('word') || type.includes('document')) {
                        fileTypes.doc = (fileTypes.doc || 0) + 1;
                    } else if (type.includes('image')) {
                        fileTypes.img = (fileTypes.img || 0) + 1;
                    } else {
                        fileTypes.file = (fileTypes.file || 0) + 1;
                    }
                });
                
                if (fileTypes.pdf) {
                    icons += `<span class="badge bg-danger me-1" title="${fileTypes.pdf} PDF"><i class="bi bi-file-earmark-pdf"></i> ${fileTypes.pdf}</span>`;
                }
                if (fileTypes.ppt) {
                    icons += `<span class="badge bg-warning me-1" title="${fileTypes.ppt} PPT"><i class="bi bi-file-earmark-slides"></i> ${fileTypes.ppt}</span>`;
                }
                if (fileTypes.doc) {
                    icons += `<span class="badge bg-info me-1" title="${fileTypes.doc} DOC"><i class="bi bi-file-earmark-word"></i> ${fileTypes.doc}</span>`;
                }
                if (fileTypes.img) {
                    icons += `<span class="badge bg-success me-1" title="${fileTypes.img} IMG"><i class="bi bi-file-earmark-image"></i> ${fileTypes.img}</span>`;
                }
                if (fileTypes.file) {
                    icons += `<span class="badge bg-secondary me-1" title="${fileTypes.file} files"><i class="bi bi-file-earmark"></i> ${fileTypes.file}</span>`;
                }
            }
            
            return icons ? `<div class="mt-2">${icons}</div>` : '';
        }

        return `
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
                        
                        ${renderAttachmentIcons(task.attachments)}
                        
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
        `;
    }).join('');
}

function renderExistingAttachments(attachments) {
    const container = document.getElementById('existingAttachments');
    
    if (!attachments || (!attachments.googleDriveLinks?.length && !attachments.files?.length)) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                <p class="mt-2">Nenhum anexo</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Google Drive Links
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

    // Arquivos
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

    container.innerHTML = html;
}

// ===== FUNÇÕES DE CRUD DE TAREFAS =====

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

    if (window.editingTaskId) {
        if (window.db) {
            window.db.collection('tasks').doc(window.editingTaskId).update(task)
                .then(() => {
                    document.getElementById('taskForm').reset();
                    const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
                    if (modal) modal.hide();
                    window.editingTaskId = null;
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

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskType').value = task.type;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskDescription').value = task.description || '';

    window.editingTaskId = taskId;

    const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
    taskModal.show();

    const addBtn = document.querySelector('#taskModal .btn-orange');
    if (addBtn) addBtn.textContent = 'Salvar';
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

// ===== FUNÇÕES DO MODAL DE DETALHES =====

function showTaskDetails(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    currentViewingTask = task;

    document.getElementById('taskDetailsTitle').textContent = task.title;
    document.getElementById('taskDetailsType').textContent = task.type;
    document.getElementById('taskDetailsType').className = `badge bg-${getTypeColor(task.type)} ms-2`;
    document.getElementById('taskDetailsDate').textContent = formatDate(task.date);
    document.getElementById('taskDetailsDescription').textContent = task.description || 'Sem descrição';

    renderExistingAttachments(task.attachments);
    hideAddAttachmentsSection();

    const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
    modal.show();
}

function showAddAttachmentsSection() {
    document.getElementById('addAttachmentsSection').style.display = 'block';
}

function hideAddAttachmentsSection() {
    const section = document.getElementById('addAttachmentsSection');
    if (section) {
        section.style.display = 'none';
    }
}

function editTaskFromDetails() {
    if (currentViewingTask) {
        const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
        if (detailsModal) detailsModal.hide();
        setTimeout(() => editTask(currentViewingTask.id), 300);
    }
}

function deleteTaskFromDetails() {
    if (currentViewingTask) {
        const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
        if (detailsModal) detailsModal.hide();
        setTimeout(() => deleteTask(currentViewingTask.id), 300);
    }
}

// ===== FUNÇÕES DE GERENCIAMENTO DE ANEXOS =====

function addNewGoogleDriveField() {
    const container = document.getElementById('newGoogleDriveContainer');
    if (!container) return;
    
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

function removeNewGoogleDriveField(button) {
    button.parentElement.remove();
}

function removeNewFile(index) {
    const fileInput = document.getElementById('newTaskFiles');
    if (!fileInput) return;
    
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
}

async function addNewAttachments() {
    if (!currentViewingTask) return;

    try {
        const addBtn = document.querySelector('#addAttachmentsSection .btn-success');
        if (!addBtn) return;
        
        const originalText = addBtn.textContent;
        
        const newGoogleDriveInputs = document.querySelectorAll('input[name="newGoogleDriveLink"]');
        const newGoogleDriveLinks = Array.from(newGoogleDriveInputs)
            .map(input => input.value.trim())
            .filter(link => link);
        
        const newFileInput = document.getElementById('newTaskFiles');
        const newFiles = newFileInput ? Array.from(newFileInput.files) : [];

        if (newGoogleDriveLinks.length === 0 && newFiles.length === 0) {
            alert('Selecione pelo menos um link ou arquivo para adicionar.');
            return;
        }

        for (const file of newFiles) {
            if (file.size > 25 * 1024 * 1024) {
                alert(`Arquivo "${file.name}" muito grande! Máximo 25MB por arquivo.`);
                return;
            }
        }

        const currentAttachments = currentViewingTask.attachments || {};
        
        if (newGoogleDriveLinks.length > 0) {
            const existingLinks = currentAttachments.googleDriveLinks || [];
            currentAttachments.googleDriveLinks = [...existingLinks, ...newGoogleDriveLinks];
        }

        const existingFiles = currentAttachments.files || [];
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            addBtn.textContent = `Enviando ${i + 1}/${newFiles.length}...`;
            
            const uploadedFile = await uploadToGitHub(file, currentViewingTask.id);
            existingFiles.push(uploadedFile);
        }
        
        currentAttachments.files = existingFiles;
        addBtn.textContent = 'Salvando...';

        if (window.db) {
            await window.db.collection('tasks').doc(currentViewingTask.id).update({
                attachments: currentAttachments
            });

            const taskIndex = tasks.findIndex(t => t.id === currentViewingTask.id);
            if (taskIndex !== -1) {
                tasks[taskIndex].attachments = currentAttachments;
                currentViewingTask.attachments = currentAttachments;
            }

            renderExistingAttachments(currentAttachments);
            hideAddAttachmentsSection();
            loadTasks();

            alert('Anexos adicionados com sucesso!');
        }

        addBtn.textContent = originalText;

    } catch (error) {
        console.error('Erro ao adicionar anexos:', error);
        alert('Erro ao adicionar anexos. Tente novamente.');
    }
}

async function removeGoogleDriveLink(index) {
    if (!currentViewingTask || !confirm('Remover este link do Google Drive?')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        if (attachments.googleDriveLinks && attachments.googleDriveLinks.length > index) {
            attachments.googleDriveLinks.splice(index, 1);

            if (window.db) {
                await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
                
                currentViewingTask.attachments = attachments;
                
                const taskIndex = tasks.findIndex(t => t.id === currentViewingTask.id);
                if (taskIndex !== -1) {
                    tasks[taskIndex].attachments = attachments;
                }
                
                renderExistingAttachments(attachments);
                loadTasks();
                
                alert('Link removido com sucesso!');
            }
        }

    } catch (error) {
        console.error('Erro ao remover link:', error);
        alert('Erro ao remover link.');
    }
}

async function removeAttachedFile(index) {
    if (!currentViewingTask || !confirm('Remover este arquivo? Ele será deletado permanentemente.')) return;

    try {
        const attachments = { ...currentViewingTask.attachments };
        if (attachments.files && attachments.files.length > index) {
            const fileToDelete = attachments.files[index];
            
            await deleteFromGitHub(fileToDelete.path, fileToDelete.sha);
            attachments.files.splice(index, 1);

            if (window.db) {
                await window.db.collection('tasks').doc(currentViewingTask.id).update({ attachments });
                
                currentViewingTask.attachments = attachments;
                
                const taskIndex = tasks.findIndex(t => t.id === currentViewingTask.id);
                if (taskIndex !== -1) {
                    tasks[taskIndex].attachments = attachments;
                }
                
                renderExistingAttachments(attachments);
                loadTasks();
                
                alert('Arquivo removido com sucesso!');
            }
        }

    } catch (error) {
        console.error('Erro ao remover arquivo:', error);
        alert('Erro ao remover arquivo.');
    }
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const newFileInput = document.getElementById('newTaskFiles');
        if (newFileInput) {
            newFileInput.addEventListener('change', function() {
                const preview = document.getElementById('newFilesPreview');
                if (!preview) return;
                
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
    }, 1000);
});

// ===== FUNÇÕES GLOBAIS =====

window.addTask = addTask;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.loadTasks = loadTasks;
window.renderWeekTasks = renderWeekTasks;
window.showTaskDetails = showTaskDetails;
window.showAddAttachmentsSection = showAddAttachmentsSection;
window.hideAddAttachmentsSection = hideAddAttachmentsSection;
window.editTaskFromDetails = editTaskFromDetails;
window.deleteTaskFromDetails = deleteTaskFromDetails;
window.addNewGoogleDriveField = addNewGoogleDriveField;
window.removeNewGoogleDriveField = removeNewGoogleDriveField;
window.removeNewFile = removeNewFile;
window.addNewAttachments = addNewAttachments;
window.removeGoogleDriveLink = removeGoogleDriveLink;
window.removeAttachedFile = removeAttachedFile;
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

function renderAttachmentIcons(attachments) {
    if (!attachments) return '';
    
    let icons = '';
    
    // Google Drive Links
    if (attachments.googleDriveLinks?.length > 0) {
        icons += `
            <span class="badge bg-primary me-1" title="${attachments.googleDriveLinks.length} link(s) Google Drive">
                <i class="bi bi-google"></i> ${attachments.googleDriveLinks.length}
            </span>
        `;
    }
    
    // YouTube Links
    if (attachments.youtubeLinks?.length > 0) {
        icons += `
            <span class="badge bg-danger me-1" title="${attachments.youtubeLinks.length} vídeo(s) YouTube">
                <i class="bi bi-youtube"></i> ${attachments.youtubeLinks.length}
            </span>
        `;
    }
    
    // Arquivos por tipo
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
        
        // Renderizar badges por tipo
        if (fileTypes.pdf) icons += `<span class="badge bg-danger me-1" title="${fileTypes.pdf} PDF"><i class="bi bi-file-earmark-pdf"></i> ${fileTypes.pdf}</span>`;
        if (fileTypes.ppt) icons += `<span class="badge bg-warning me-1" title="${fileTypes.ppt} PPT"><i class="bi bi-file-earmark-slides"></i> ${fileTypes.ppt}</span>`;
        if (fileTypes.doc) icons += `<span class="badge bg-info me-1" title="${fileTypes.doc} DOC"><i class="bi bi-file-earmark-word"></i> ${fileTypes.doc}</span>`;
        if (fileTypes.img) icons += `<span class="badge bg-success me-1" title="${fileTypes.img} IMG"><i class="bi bi-file-earmark-image"></i> ${fileTypes.img}</span>`;
        if (fileTypes.file) icons += `<span class="badge bg-secondary me-1" title="${fileTypes.file} files"><i class="bi bi-file-earmark"></i> ${fileTypes.file}</span>`;
    }
    
    return icons ? `<div class="mt-2">${icons}</div>` : '';
}

// ===== FUNÇÕES DO GITHUB =====

async function uploadToGitHub(file, taskId) {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const path = `uploads/${fileName}`;
    
    try {
        // LIMITE REAL DO GITHUB: 25MB
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            throw new Error(`Arquivo muito grande: ${formatFileSize(file.size)} (máximo 25MB para GitHub)`);
        }
        
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
                message: `Upload: ${fileName} for task ${taskId} (${formatFileSize(file.size)})`,
                content: content,
                branch: GITHUB_CONFIG.branch
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('GitHub API Error:', errorData);
            
            // Tratamento específico para arquivo muito grande
            if (response.status === 422 && errorData.message?.includes('too large')) {
                throw new Error(`Arquivo muito grande para GitHub: ${formatFileSize(file.size)} (máximo 25MB)`);
            }
            
            if (response.status === 401) {
                throw new Error('Token GitHub inválido. Verifique as credenciais.');
            }
            
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

// ===== FUNÇÕES DE PROCESSAMENTO DE ARQUIVOS =====

async function processFileWithConversion(file, taskId) {
    try {
        console.log(`🔄 Processando ${file.name} (${formatFileSize(file.size)})...`);
        
        // Usar sistema simples
        const result = await window.fileConverter.processFile(file, taskId);
        
        console.log(`✅ Processamento bem-sucedido: ${file.name}`);
        return result;
        
    } catch (error) {
        console.error(`❌ Erro ao processar ${file.name}:`, error);
        throw error;
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
    `).join('');
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
    
    tasksWeekList.innerHTML = weekTasks.map((task, idx) => `
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
    `).join('');
}

function renderExistingAttachments(attachments) {
    const container = document.getElementById('existingAttachments');
    
    if (!attachments || (!attachments.googleDriveLinks?.length && !attachments.youtubeLinks?.length && !attachments.files?.length)) {
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

    // YouTube Links
    if (attachments.youtubeLinks?.length > 0) {
        attachments.youtubeLinks.forEach((link, index) => {
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                        <a href="${link}" target="_blank" class="btn btn-sm btn-outline-danger">
                            <i class="bi bi-youtube"></i> YouTube ${index + 1}
                        </a>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeYouTubeLink(${index})">
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
    const fileInput = document.getElementById('taskFiles');

    if (!title || !type || !date) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // Coletar anexos
    const attachments = {};

    // Google Drive Links
    const googleDriveInputs = document.querySelectorAll('input[name="googleDriveLink"]');
    const googleDriveLinks = Array.from(googleDriveInputs)
        .map(input => input.value.trim())
        .filter(link => link);
    if (googleDriveLinks.length > 0) {
        attachments.googleDriveLinks = googleDriveLinks;
    }

    // YouTube Links
    const youTubeInputs = document.querySelectorAll('input[name="youTubeLink"]');
    const youTubeLinks = Array.from(youTubeInputs)
        .map(input => input.value.trim())
        .filter(link => link);
    if (youTubeLinks.length > 0) {
        attachments.youtubeLinks = youTubeLinks;
    }

    const selectedFiles = fileInput && fileInput.files ? Array.from(fileInput.files) : [];

    const task = {
        title: title.trim(),
        type,
        date,
        description: description.trim(),
        attachments: Object.keys(attachments).length > 0 ? attachments : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: 'Usuário'
    };

    const saveTaskWithoutFiles = () => {
        if (window.editingTaskId) {
            if (window.db) {
                window.db.collection('tasks').doc(window.editingTaskId).update(task)
                    .then(() => {
                        clearTaskForm();
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
        } else {
            if (window.db) {
                window.db.collection('tasks').add(task)
                    .then(() => {
                        clearTaskForm();
                        const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
                        if (modal) modal.hide();
                    })
                    .catch((error) => {
                        console.error('Erro ao adicionar tarefa:', error);
                        alert('Erro ao adicionar tarefa. Tente novamente.');
                    });
            }
        }
    };

    const saveTaskWithFiles = async (taskId) => {
        try {
            const uploadedFiles = [];
            const failedFiles = [];
            
            const addBtn = document.querySelector('#taskModal .btn-orange');
            const originalText = addBtn ? addBtn.textContent : '';
            
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                if (addBtn) addBtn.textContent = `Enviando ${i + 1}/${selectedFiles.length}... ${file.name}`;
                
                try {
                    const uploadedFile = await processFileWithConversion(file, taskId);
                    uploadedFiles.push(uploadedFile);
                } catch (error) {
                    console.error(`❌ Falha com ${file.name}:`, error);
                    failedFiles.push({ name: file.name, size: file.size, error: error.message });
                }
            }
            
            if (uploadedFiles.length > 0) {
                task.attachments = task.attachments || {};
                task.attachments.files = uploadedFiles;
                
                await window.db.collection('tasks').doc(taskId).update({
                    attachments: task.attachments
                });
            }
            
            if (addBtn) addBtn.textContent = originalText;
            
            let message = '';
            if (uploadedFiles.length > 0) {
                message += `✅ ${uploadedFiles.length} arquivo(s) enviado(s)!\n`;
            }
            if (failedFiles.length > 0) {
                message += `\n❌ ${failedFiles.length} arquivo(s) muito grande(s):\n`;
                failedFiles.forEach(file => {
                    message += `• ${file.name} (${formatFileSize(file.size)})\n`;
                });
                message += `\n💡 Use Google Drive para estes arquivos.`;
            }
            
            if (message) alert(message);
            
            clearTaskForm();
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            if (modal) modal.hide();
            
        } catch (error) {
            console.error('Erro ao processar arquivos:', error);
            alert('Erro ao processar arquivos. Tarefa salva sem anexos.');
            
            clearTaskForm();
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            if (modal) modal.hide();
        }
    };

    if (selectedFiles.length === 0) {
        saveTaskWithoutFiles();
    } else {
        if (window.editingTaskId) {
            saveTaskWithFiles(window.editingTaskId);
        } else {
            if (window.db) {
                window.db.collection('tasks').add(task)
                    .then((docRef) => {
                        saveTaskWithFiles(docRef.id);
                    })
                    .catch((error) => {
                        console.error('Erro ao adicionar tarefa:', error);
                        alert('Erro ao adicionar tarefa. Tente novamente.');
                    });
            }
        }
    }
}

function clearTaskForm() {
    document.getElementById('taskForm').reset();
    
    const filesPreview = document.getElementById('filesPreview');
    if (filesPreview) filesPreview.innerHTML = '';
    
    const fileInput = document.getElementById('taskFiles');
    if (fileInput) {
        fileInput.value = '';
        fileInput.files = new DataTransfer().files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const googleDriveContainer = document.getElementById('googleDriveContainer');
    if (googleDriveContainer) {
        const extraFields = googleDriveContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        
        const firstInput = googleDriveContainer.querySelector('input[name="googleDriveLink"]');
        if (firstInput) firstInput.value = '';
    }
    
    const youTubeContainer = document.getElementById('youTubeContainer');
    if (youTubeContainer) {
        const extraFields = youTubeContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        
        const firstInput = youTubeContainer.querySelector('input[name="youTubeLink"]');
        if (firstInput) firstInput.value = '';
    }
    
    console.log('✅ Formulário limpo completamente');
}

function clearNewAttachmentsForm() {
    const newGoogleDriveContainer = document.getElementById('newGoogleDriveContainer');
    if (newGoogleDriveContainer) {
        const extraFields = newGoogleDriveContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        
        const firstInput = newGoogleDriveContainer.querySelector('input[name="newGoogleDriveLink"]');
        if (firstInput) firstInput.value = '';
    }
    
    const newYouTubeContainer = document.getElementById('newYouTubeContainer');
    if (newYouTubeContainer) {
        const extraFields = newYouTubeContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        
        const firstInput = newYouTubeContainer.querySelector('input[name="newYouTubeLink"]');
        if (firstInput) firstInput.value = '';
    }
    
    const newFileInput = document.getElementById('newTaskFiles');
    if (newFileInput) {
        newFileInput.value = '';
        newFileInput.files = new DataTransfer().files;
        newFileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const newFilesPreview = document.getElementById('newFilesPreview');
    if (newFilesPreview) newFilesPreview.innerHTML = '';
    
    console.log('✅ Formulário de novos anexos limpo');
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

        const newYouTubeInputs = document.querySelectorAll('input[name="newYouTubeLink"]');
        const newYouTubeLinks = Array.from(newYouTubeInputs)
            .map(input => input.value.trim())
            .filter(link => link);
        
        const newFileInput = document.getElementById('newTaskFiles');
        const newFiles = newFileInput ? Array.from(newFileInput.files) : [];

        if (newGoogleDriveLinks.length === 0 && newYouTubeLinks.length === 0 && newFiles.length === 0) {
            alert('Selecione pelo menos um link ou arquivo para adicionar.');
            return;
        }

        const currentAttachments = currentViewingTask.attachments || {};
        
        if (newGoogleDriveLinks.length > 0) {
            const existingLinks = currentAttachments.googleDriveLinks || [];
            currentAttachments.googleDriveLinks = [...existingLinks, ...newGoogleDriveLinks];
        }

        if (newYouTubeLinks.length > 0) {
            const existingYouTubeLinks = currentAttachments.youtubeLinks || [];
            currentAttachments.youtubeLinks = [...existingYouTubeLinks, ...newYouTubeLinks];
        }

        const existingFiles = currentAttachments.files || [];
        const failedFiles = [];
        
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            addBtn.textContent = `Processando ${i + 1}/${newFiles.length}... ${file.name}`;
            
            try {
                const uploadedFile = await processFileWithConversion(file, currentViewingTask.id);
                existingFiles.push(uploadedFile);
            } catch (error) {
                console.error(`❌ Falha com ${file.name}:`, error);
                failedFiles.push({ name: file.name, size: file.size, error: error.message });
            }
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
            clearNewAttachmentsForm();
            hideAddAttachmentsSection();
            loadTasks();

            let message = '';
            const successCount = newFiles.length - failedFiles.length;
            
            if (successCount > 0) {
                message += `✅ ${successCount} arquivo(s) adicionado(s) com sucesso!\n`;
            }
            
            if (failedFiles.length > 0) {
                message += `\n❌ ${failedFiles.length} arquivo(s) muito grande(s):\n`;
                failedFiles.forEach(file => {
                    message += `• ${file.name} (${formatFileSize(file.size)})\n`;
                });
                message += `\n💡 Use Google Drive para estes arquivos.`;
            }
            
            alert(message);
        }

        addBtn.textContent = originalText;

    } catch (error) {
        console.error('Erro ao adicionar anexos:', error);
        alert('Erro ao adicionar anexos. Tente novamente.');
    }
}

function hideAddAttachmentsSection() {
    const section = document.getElementById('addAttachmentsSection');
    if (section) {
        section.style.display = 'none';
        clearNewAttachmentsForm();
    }
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskType').value = task.type;
    document.getElementById('taskDate').value = task.date;
    document.getElementById('taskDescription').value = task.description || '';

    clearTaskForm();

    if (task.attachments?.googleDriveLinks) {
        const container = document.getElementById('googleDriveContainer');
        container.innerHTML = '';
        
        task.attachments.googleDriveLinks.forEach((link, index) => {
            if (index === 0) {
                container.innerHTML = `
                    <div class="input-group mb-2">
                        <input type="url" class="form-control form-control-sm" 
                               placeholder="https://drive.google.com/..." 
                               name="googleDriveLink" value="${link}">
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="addGoogleDriveField()">
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                `;
            } else {
                addGoogleDriveField();
                const inputs = container.querySelectorAll('input[name="googleDriveLink"]');
                inputs[inputs.length - 1].value = link;
            }
        });
    }

    if (task.attachments?.youtubeLinks) {
        const container = document.getElementById('youTubeContainer');
        container.innerHTML = '';
        
        task.attachments.youtubeLinks.forEach((link, index) => {
            if (index === 0) {
                container.innerHTML = `
                    <div class="input-group mb-2">
                        <input type="url" class="form-control form-control-sm" 
                               placeholder="https://youtube.com/watch?v=..." 
                               name="youTubeLink" value="${link}">
                        <button type="button" class="btn btn-sm btn-outline-success" onclick="addYouTubeField()">
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                `;
            } else {
                addYouTubeField();
                const inputs = container.querySelectorAll('input[name="youTubeLink"]');
                inputs[inputs.length - 1].value = link;
            }
        });
    }

    window.editingTaskId = taskId;
    const addBtn = document.querySelector('#taskModal .btn-orange');
    if (addBtn) addBtn.textContent = 'Salvar Alterações';

    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

function deleteTask(taskId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.attachments?.files) {
        task.attachments.files.forEach(async (file) => {
            try {
                await deleteFromGitHub(file.path, file.sha);
            } catch (error) {
                console.warn(`Erro ao deletar ${file.name}:`, error);
            }
        });
    }

    if (window.db) {
        window.db.collection('tasks').doc(taskId).delete()
            .then(() => {
                console.log('Tarefa excluída com sucesso');
            })
            .catch((error) => {
                console.error('Erro ao excluir tarefa:', error);
                alert('Erro ao excluir tarefa. Tente novamente.');
            });
    }
}

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
    clearNewAttachmentsForm();
    hideAddAttachmentsSection();

    const modal = new bootstrap.Modal(document.getElementById('taskDetailsModal'));
    modal.show();
}

function showAddAttachmentsSection() {
    const section = document.getElementById('addAttachmentsSection');
    if (section) {
        section.style.display = 'block';
        clearNewAttachmentsForm();
    }
}

function editTaskFromDetails() {
    if (!currentViewingTask) return;
    
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    if (detailsModal) detailsModal.hide();
    
    setTimeout(() => {
        editTask(currentViewingTask.id);
    }, 300);
}

function deleteTaskFromDetails() {
    if (!currentViewingTask) return;
    
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('taskDetailsModal'));
    if (detailsModal) detailsModal.hide();
    
    setTimeout(() => {
        deleteTask(currentViewingTask.id);
    }, 300);
}

// ===== FUNÇÕES DE GOOGLE DRIVE =====

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

function removeGoogleDriveField(button) {
    button.closest('.input-group').remove();
}

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

function removeNewGoogleDriveField(button) {
    button.closest('.input-group').remove();
}

function removeGoogleDriveLink(index) {
    if (!currentViewingTask || !currentViewingTask.attachments?.googleDriveLinks) return;
    
    if (!confirm('Tem certeza que deseja remover este link do Google Drive?')) return;
    
    currentViewingTask.attachments.googleDriveLinks.splice(index, 1);
    
    if (currentViewingTask.attachments.googleDriveLinks.length === 0) {
        delete currentViewingTask.attachments.googleDriveLinks;
    }
    
    if (window.db) {
        window.db.collection('tasks').doc(currentViewingTask.id).update({
            attachments: currentViewingTask.attachments
        }).then(() => {
            renderExistingAttachments(currentViewingTask.attachments);
            loadTasks();
        });
    }
}

// ===== FUNÇÕES DE YOUTUBE =====

function addYouTubeField() {
    const container = document.getElementById('youTubeContainer');
    const newField = document.createElement('div');
    newField.className = 'input-group mb-2';
    newField.innerHTML = `
        <input type="url" class="form-control form-control-sm" 
               placeholder="https://youtube.com/watch?v=..." 
               name="youTubeLink">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeYouTubeField(this)">
            <i class="bi bi-trash"></i>
        </button>
    `;
    container.appendChild(newField);
}

function removeYouTubeField(button) {
    button.closest('.input-group').remove();
}

function addNewYouTubeField() {
    const container = document.getElementById('newYouTubeContainer');
    const newField = document.createElement('div');
    newField.className = 'input-group mb-2';
    newField.innerHTML = `
        <input type="url" class="form-control form-control-sm" 
               placeholder="https://youtube.com/watch?v=..." 
               name="newYouTubeLink">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeNewYouTubeField(this)">
            <i class="bi bi-trash"></i>
        </button>
    `;
    container.appendChild(newField);
}

function removeNewYouTubeField(button) {
    button.closest('.input-group').remove();
}

function removeYouTubeLink(index) {
    if (!currentViewingTask || !currentViewingTask.attachments?.youtubeLinks) return;
    
    if (!confirm('Tem certeza que deseja remover este vídeo do YouTube?')) return;
    
    currentViewingTask.attachments.youtubeLinks.splice(index, 1);
    
    if (currentViewingTask.attachments.youtubeLinks.length === 0) {
        delete currentViewingTask.attachments.youtubeLinks;
    }
    
    if (window.db) {
        window.db.collection('tasks').doc(currentViewingTask.id).update({
            attachments: currentViewingTask.attachments
        }).then(() => {
            renderExistingAttachments(currentViewingTask.attachments);
            loadTasks();
        });
    }
}

// ===== FUNÇÕES DE ARQUIVOS =====

function removeNewFile(index) {
    const fileInput = document.getElementById('newTaskFiles');
    if (!fileInput || !fileInput.files) return;
    
    const dt = new DataTransfer();
    const files = Array.from(fileInput.files);
    
    files.forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function removeAttachedFile(index) {
    if (!currentViewingTask || !currentViewingTask.attachments?.files) return;
    
    const file = currentViewingTask.attachments.files[index];
    if (!confirm(`Tem certeza que deseja remover o arquivo "${file.name}"?`)) return;
    
    deleteFromGitHub(file.path, file.sha).catch(console.warn);
    
    currentViewingTask.attachments.files.splice(index, 1);
    
    if (currentViewingTask.attachments.files.length === 0) {
        delete currentViewingTask.attachments.files;
    }
    
    if (window.db) {
        window.db.collection('tasks').doc(currentViewingTask.id).update({
            attachments: currentViewingTask.attachments
        }).then(() => {
            renderExistingAttachments(currentViewingTask.attachments);
            loadTasks();
        });
    }
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====

Object.assign(window, {
    addTask,
    editTask,
    deleteTask,
    loadTasks,
    renderWeekTasks,
    showTaskDetails,
    showAddAttachmentsSection,
    hideAddAttachmentsSection,
    editTaskFromDetails,
    deleteTaskFromDetails,
    addGoogleDriveField,
    removeGoogleDriveField,
    addNewGoogleDriveField,
    removeNewGoogleDriveField,
    removeGoogleDriveLink,
    addYouTubeField,
    removeYouTubeField,
    addNewYouTubeField,
    removeNewYouTubeField,
    removeYouTubeLink,
    removeNewFile,
    addNewAttachments,
    removeAttachedFile,
    clearTaskForm,
    clearNewAttachmentsForm
});

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    const taskFiles = document.getElementById('taskFiles');
    if (taskFiles) {
        taskFiles.addEventListener('change', function() {
            const preview = document.getElementById('filesPreview');
            if (!preview) return;
            
            const files = Array.from(this.files);
            if (files.length === 0) {
                preview.innerHTML = '';
                return;
            }
            
            preview.innerHTML = files.map((file, index) => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                        <i class="bi bi-${getFileIcon(file.type)} text-${getFileColor(file.type)}"></i>
                        <span class="ms-2">${file.name}</span>
                        <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
                    </div>
                </div>
            `).join('');
        });
    }
    
    const newTaskFiles = document.getElementById('newTaskFiles');
    if (newTaskFiles) {
        newTaskFiles.addEventListener('change', function() {
            const preview = document.getElementById('newFilesPreview');
            if (!preview) return;
            
            const files = Array.from(this.files);
            if (files.length === 0) {
                preview.innerHTML = '';
                return;
            }
            
            preview.innerHTML = files.map((file, index) => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <div>
                        <i class="bi bi-${getFileIcon(file.type)} text-${getFileColor(file.type)}"></i>
                        <span class="ms-2">${file.name}</span>
                        <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeNewFile(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `).join('');
        });
    }
    
    const taskModal = document.getElementById('taskModal');
    if (taskModal) {
        taskModal.addEventListener('hidden.bs.modal', function() {
            if (!window.editingTaskId) {
                clearTaskForm();
            }
            window.editingTaskId = null;
            const addBtn = document.querySelector('#taskModal .btn-orange');
            if (addBtn) addBtn.textContent = 'Adicionar';
        });
    }
    
    console.log('✅ Event listeners do tasks.js configurados');
});
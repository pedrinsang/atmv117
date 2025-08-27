// ========================================
// SISTEMA DE GERENCIAMENTO DE TAREFAS
// ========================================

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let tasks = [];
let currentViewingTask = null;

// ========================================
// CONFIGURAÇÃO DO GITHUB (REMOVIDA POR SEGURANÇA)
// ========================================
// TOKEN GITHUB REMOVIDO - FUNCIONALIDADE DE UPLOAD DESABILITADA
// Sistema agora funciona apenas com links externos (Google Drive, YouTube)

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

// ========================================
// FUNÇÕES DE VALIDAÇÃO DE SEGURANÇA
// ========================================

// Valida entrada de dados da tarefa
function validateTaskInput(title, type, date, description) {
    const errors = [];
    
    // Validar título
    if (!title || title.trim().length < 2) {
        errors.push('Título deve ter pelo menos 2 caracteres');
    }
    if (title.length > 100) {
        errors.push('Título muito longo (máximo 100 caracteres)');
    }
    
    // Validar tipo
    const validTypes = ['prova', 'trabalho', 'atividade'];
    if (!validTypes.includes(type)) {
        errors.push('Tipo de tarefa inválido');
    }
    
    // Validar data
    const taskDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(taskDate.getTime())) {
        errors.push('Data inválida');
    }
    if (taskDate < today) {
        errors.push('Data não pode ser no passado');
    }
    
    // Validar descrição
    if (description && description.length > 1000) {
        errors.push('Descrição muito longa (máximo 1000 caracteres)');
    }
    
    return errors;
}

// Valida URLs de forma segura
function validateUrls(googleDriveLinks, youtubeLinks) {
    const errors = [];
    
    // Validar Google Drive
    googleDriveLinks.forEach((url, index) => {
        if (!isValidGoogleDriveUrl(url)) {
            errors.push(`Google Drive link ${index + 1} inválido`);
        }
    });
    
    // Validar YouTube
    youtubeLinks.forEach((url, index) => {
        if (!isValidYouTubeUrl(url)) {
            errors.push(`YouTube link ${index + 1} inválido`);
        }
    });
    
    return errors;
}

// Verifica se URL do Google Drive é válida
function isValidGoogleDriveUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'drive.google.com' || 
               urlObj.hostname === 'docs.google.com';
    } catch {
        return false;
    }
}

// Verifica se URL do YouTube é válida
function isValidYouTubeUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'www.youtube.com' || 
               urlObj.hostname === 'youtube.com' ||
               urlObj.hostname === 'youtu.be';
    } catch {
        return false;
    }
}

// Escapa caracteres HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Formata data para exibição em português
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit' 
    });
}

// Formata tamanho de arquivo em formato legível
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Retorna cor baseada no tipo de tarefa
function getTypeColor(type) {
    switch (type) {
        case 'prova': return 'danger';
        case 'trabalho': return 'success';
        case 'atividade': return 'warning';
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

// ========================================
// FUNÇÕES DO GITHUB (REMOVIDAS - SEM UPLOAD)
// ========================================
// Funcionalidade de upload removida por solicitação do usuário
// Apenas links externos (Google Drive, YouTube) são suportados

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

// ========================================
// FUNÇÕES DE CARREGAMENTO
// ========================================

function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    tasksList.innerHTML = '<div class="col-12 text-center"><div class="loading"></div></div>';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Carregar um período maior para melhor navegação no calendário
    const yearStart = new Date(today.getFullYear(), 0, 1); // Janeiro
    const yearEnd = new Date(today.getFullYear(), 11, 31); // Dezembro
    
    // Para exibição, ainda usar o mês atual
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    if (window.db) {
        // Verificar se o usuário está autenticado antes de acessar o Firestore
        if (!firebase.auth().currentUser) {
            console.log('Usuário não autenticado, aguardando autenticação...');
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    loadTasksData(yearStart, yearEnd, todayStr, monthStart, monthEnd);
                }
            });
            return;
        }
        
        loadTasksData(yearStart, yearEnd, todayStr, monthStart, monthEnd);
    } else {
        setTimeout(loadTasks, 1000);
    }
}

function loadTasksData(yearStart, yearEnd, todayStr, monthStart, monthEnd) {
    console.log('📋 Carregando tarefas...');
    
    // Verificar novamente se o usuário está autenticado
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('❌ Usuário não autenticado');
        const tasksList = document.getElementById('tasksList');
        if (tasksList) {
            tasksList.innerHTML = '<div class="col-12 text-center text-danger">❌ Erro de autenticação</div>';
        }
        return;
    }

    // Verificar se o banco de dados está disponível
    if (!window.db) {
        console.error('❌ Banco não disponível');
        const tasksList = document.getElementById('tasksList');
        if (tasksList) {
            tasksList.innerHTML = '<div class="col-12 text-center text-danger">❌ Banco de dados indisponível</div>';
        }
        return;
    }
    
    // Carregar todas as tarefas (modo global)
    window.db.collection('tasks').onSnapshot((snapshot) => {
        processTasksSnapshot(snapshot, user, yearStart, yearEnd, todayStr, monthStart, monthEnd, false);
    }, (error) => {
        console.error('❌ Erro ao carregar tarefas:', error);
        showErrorMessage();
    });
}

function processTasksSnapshot(snapshot, user, yearStart, yearEnd, todayStr, monthStart, monthEnd, isFallback) {
    tasks = []; // Array global para todas as tarefas do ano
    let displayTasks = []; // Array para tarefas do mês atual para exibição
    
    const yearStartStr = yearStart.toISOString().split('T')[0];
    const yearEndStr = yearEnd.toISOString().split('T')[0];
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];
    
    snapshot.forEach((doc) => {
        const taskData = doc.data();
        
            // Não filtrar por propriedade: tarefas são globais
            // Se houver fallback, apenas tentamos adicionar userId para rastreio, mas não pulamos tarefas
            if (isFallback && !taskData.userId) {
                const createdBy = taskData.createdBy;
                try {
                    // se parecer que foi criado por este usuário, atualizamos userId para rastreio
                    if (createdBy === user.email || createdBy === user.displayName || createdBy === 'Usuário') {
                        window.db.collection('tasks').doc(doc.id).update({ userId: user.uid }).catch(error => console.error('❌ Erro na migração:', error));
                        taskData.userId = user.uid;
                    }
                } catch (e) { /* ignore */ }
            }
        
        // ✅ CARREGAR TAREFAS DO ANO INTEIRO (para navegação no calendário)
        if (taskData.date >= yearStartStr && taskData.date <= yearEndStr) {
            const task = { id: doc.id, ...taskData };
            
            // Limpar tarefas antigas
            if (task.date < todayStr) {
                window.db.collection('tasks').doc(task.id).delete()
                    .catch(error => console.error('Erro ao deletar tarefa antiga:', error));
            } else {
                tasks.push(task); // Adicionar ao array global
                
                // ✅ SEPARAR TAREFAS DO MÊS ATUAL PARA EXIBIÇÃO
                if (taskData.date >= monthStartStr && taskData.date <= monthEndStr) {
                    displayTasks.push(task);
                }
            }
        }
    });
    
    // ✅ ORDENAR AMBOS OS ARRAYS
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    displayTasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // ✅ RENDERIZAR APENAS AS TAREFAS DO MÊS ATUAL
    renderTasks(displayTasks);
    renderWeekTasks(displayTasks);
}

function showErrorMessage() {
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
        tasksList.innerHTML = '<div class="col-12 text-center text-danger">❌ Erro ao carregar tarefas</div>';
    }
}

// ===== FUNÇÕES DE RENDERIZAÇÃO =====

function renderTasks(tasksToRender = tasks) {
    const tasksList = document.getElementById('tasksList');
    if (!tasksList) return;

    if (tasksToRender.length === 0) {
        tasksList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card">
                    <div class="card-body">
                        <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                        <p class="mt-3">Nenhuma tarefa para este mês</p>
                        <button class="btn btn-orange">
                            <a onclick="navigateToPage('calendario')">
                                <i class="bi bi-calendar3"></i>
                                Abrir Calendário
                            </a>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nextTaskIndex = tasksToRender.findIndex(task => task.date >= todayStr);

    tasksList.innerHTML = tasksToRender.map((task, idx) => `
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

function renderWeekTasks(tasksToRender = tasks) {
    const tasksWeekList = document.getElementById('tasksWeekList');
    if (!tasksWeekList) return;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekTasks = tasksToRender.filter(task => {
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
                        <a href="#" onclick="navigateToPage('calendario')">
                    <i class="bi bi-calendar3"></i>
                    <span>Calendário</span>
                </a>
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

// ========================================
// FUNÇÕES DE CRUD DE TAREFAS
// ========================================

function addTask() {
    const title = document.getElementById('taskTitle').value;
    const type = document.getElementById('taskType').value;
    let date = document.getElementById('taskDate').value;
    // If user sees dd/mm/yyyy (flatpickr altInput) or manual input in dd/mm/yyyy, convert to ISO YYYY-MM-DD
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (ddmmyyyy.test(date)) {
        const m = date.match(ddmmyyyy);
        date = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    } else if (!isoRegex.test(date)) {
        // if input is empty or an unexpected format, leave as-is and let validation handle it
    }
    const description = document.getElementById('taskDescription').value;

    // ========================================
    // VALIDAÇÕES DE SEGURANÇA
    // ========================================
    
    // Validar entrada básica
    const inputErrors = validateTaskInput(title, type, date, description);
    if (inputErrors.length > 0) {
        alert('Erros encontrados:\n' + inputErrors.join('\n'));
        return;
    }

    // Verificar autenticação ANTES de processar
    const currentUser = firebase.auth()?.currentUser;
    if (!currentUser) {
        alert('Você precisa estar logado para criar tarefas');
        return;
    }

    // Verificar se o banco está disponível
    if (!window.db) {
        alert('Erro: Banco de dados não disponível');
        return;
    }

    // ========================================
    // COLETAR E VALIDAR ANEXOS
    // ========================================
    const googleDriveInputs = document.querySelectorAll('input[name="googleDriveLink"]');
    const googleDriveLinks = Array.from(googleDriveInputs)
        .map(input => input.value.trim())
        .filter(link => link);

    const youTubeInputs = document.querySelectorAll('input[name="youTubeLink"]');
    const youTubeLinks = Array.from(youTubeInputs)
        .map(input => input.value.trim())
        .filter(link => link);

    // Validar URLs de forma segura
    const urlErrors = validateUrls(googleDriveLinks, youTubeLinks);
    if (urlErrors.length > 0) {
        alert('Erros nos links:\n' + urlErrors.join('\n'));
        return;
    }

    // ========================================
    // CRIAR OBJETO DA TAREFA (SANITIZADO)
    // ========================================
    const attachments = {};
    if (googleDriveLinks.length > 0) {
        attachments.googleDriveLinks = googleDriveLinks;
    }
    if (youTubeLinks.length > 0) {
        attachments.youtubeLinks = youTubeLinks;
    }

    const task = {
        title: escapeHtml(title.trim()),
        type: type, // Já validado na função validateTaskInput
        date: date,
        description: escapeHtml(description.trim()),
        attachments: Object.keys(attachments).length > 0 ? attachments : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.displayName || currentUser.email || 'Usuário',
        userId: currentUser.uid
    };

    // ========================================
    // SALVAR TAREFA NO FIRESTORE (COM TRATAMENTO DE ERRO)
    // ========================================
    const operation = window.editingTaskId ? 
        window.db.collection('tasks').doc(window.editingTaskId).update(task) :
        window.db.collection('tasks').add(task);

    operation
        .then(() => {
            clearTaskForm();
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            if (modal) modal.hide();
            window.editingTaskId = null;
            const addBtn = document.querySelector('#taskModal .btn-orange');
            if (addBtn) addBtn.textContent = 'Adicionar';
        })
}

// ========================================
// LIMPAR FORMULÁRIO DE TAREFA
// ========================================
function clearTaskForm() {
    document.getElementById('taskForm').reset();
    
    // Limpar containers de links extras
    const googleDriveContainer = document.getElementById('googleDriveContainer');
    if (googleDriveContainer) {
        const extraFields = googleDriveContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        // Limpar o primeiro campo também
        const firstInput = googleDriveContainer.querySelector('input[name="googleDriveLink"]');
        if (firstInput) firstInput.value = '';
    }
    
    const youTubeContainer = document.getElementById('youTubeContainer');
    if (youTubeContainer) {
        const extraFields = youTubeContainer.querySelectorAll('.input-group:not(:first-child)');
        extraFields.forEach(field => field.remove());
        // Limpar o primeiro campo também
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
    
    console.log('✅ Formulário de novos anexos limpo');
}

// ========================================
// ADICIONAR NOVOS ANEXOS (APENAS LINKS)
// ========================================
async function addNewAttachments() {
    if (!currentViewingTask) return;

    try {
        const addBtn = document.querySelector('#addAttachmentsSection .btn-success');
        if (!addBtn) return;
        
        const originalText = addBtn.textContent;
        addBtn.textContent = 'Adicionando...';
        
        // Coletar novos links do Google Drive
        const newGoogleDriveInputs = document.querySelectorAll('input[name="newGoogleDriveLink"]');
        const newGoogleDriveLinks = Array.from(newGoogleDriveInputs)
            .map(input => input.value.trim())
            .filter(link => link);

        // Coletar novos links do YouTube
        const newYouTubeInputs = document.querySelectorAll('input[name="newYouTubeLink"]');
        const newYouTubeLinks = Array.from(newYouTubeInputs)
            .map(input => input.value.trim())
            .filter(link => link);

        // ========================================
        // VALIDAR URLs DE FORMA SEGURA
        // ========================================
        const urlErrors = validateUrls(newGoogleDriveLinks, newYouTubeLinks);
        if (urlErrors.length > 0) {
            alert('Erros nos links:\n' + urlErrors.join('\n'));
            addBtn.textContent = originalText;
            return;
        }

        // Verificar se há pelo menos um link para adicionar
        if (newGoogleDriveLinks.length === 0 && newYouTubeLinks.length === 0) {
            alert('Por favor, adicione pelo menos um link');
            addBtn.textContent = originalText;
            return;
        }

        // Verificar autenticação
        const currentUser = firebase.auth()?.currentUser;
        if (!currentUser) {
            alert('Você precisa estar logado para adicionar anexos');
            addBtn.textContent = originalText;
            return;
        }

        if (newGoogleDriveLinks.length === 0 && newYouTubeLinks.length === 0) {
            alert('Adicione pelo menos um link para continuar.');
            return;
        }

        addBtn.textContent = 'Salvando...';

        // Atualizar anexos existentes
        const currentAttachments = currentViewingTask.attachments || {};
        
        if (newGoogleDriveLinks.length > 0) {
            const existingLinks = currentAttachments.googleDriveLinks || [];
            currentAttachments.googleDriveLinks = [...existingLinks, ...newGoogleDriveLinks];
        }

        if (newYouTubeLinks.length > 0) {
            const existingYouTubeLinks = currentAttachments.youtubeLinks || [];
            currentAttachments.youtubeLinks = [...existingYouTubeLinks, ...newYouTubeLinks];
        }

        // Salvar no Firestore
        if (window.db) {
            await window.db.collection('tasks').doc(currentViewingTask.id).update({
                attachments: currentAttachments
            });

            // Atualizar cache local
            const taskIndex = tasks.findIndex(t => t.id === currentViewingTask.id);
            if (taskIndex !== -1) {
                tasks[taskIndex].attachments = currentAttachments;
                currentViewingTask.attachments = currentAttachments;
            }

            // Atualizar interface
            renderExistingAttachments(currentAttachments);
            clearNewAttachmentsForm();
            hideAddAttachmentsSection();
            loadTasks();

            alert('✅ Links adicionados com sucesso!');
        }

        addBtn.textContent = originalText;

    } catch (error) {
        console.error('Erro ao adicionar novos anexos:', error);
        alert('Erro ao adicionar anexos. Tente novamente.');
        
        const addBtn = document.querySelector('#addAttachmentsSection .btn-success');
        if (addBtn) addBtn.textContent = 'Adicionar Links';
    }
}

// ========================================
// OCULTAR SEÇÃO DE ANEXOS
// ========================================
function hideAddAttachmentsSection() {
    const section = document.getElementById('addAttachmentsSection');
    if (section) {
        section.style.display = 'none';
        clearNewAttachmentsForm();
    }
}

function editTask(taskId) {
    // ✅ VERIFICAR AUTENTICAÇÃO ANTES DE EDITAR
    const currentUser = firebase.auth()?.currentUser;
    if (!currentUser) {
        alert('Você precisa estar logado para editar tarefas');
        return;
    }

    // Primeiro, tentar encontrar a tarefa na memória (mês atual)
    let task = tasks.find(t => t.id === taskId);
    
    if (!task) {
        // Se não encontrou na memória, buscar no Firestore
        console.log('🔍 Tarefa não encontrada na memória, buscando no Firestore...');
        
        if (!window.db) {
            alert('Erro: Banco de dados não disponível');
            return;
        }
        
        window.db.collection('tasks').doc(taskId).get()
            .then((doc) => {
                if (!doc.exists) {
                    alert('Tarefa não encontrada');
                    return;
                }
                
                const taskData = doc.data();
                
                // Permitir edição de qualquer tarefa (app global)
                
                task = { id: doc.id, ...taskData };
                populateEditForm(task);
            })
            .catch((error) => {
                console.error('Erro ao buscar tarefa:', error);
                alert('Erro ao carregar tarefa');
            });
        return;
    }

    // Permitir edição de qualquer tarefa (app global)

    populateEditForm(task);
}

function populateEditForm(task) {
    // Limpar o formulário antes de preencher com os dados da tarefa
    clearTaskForm();

    const titleEl = document.getElementById('taskTitle');
    const typeEl = document.getElementById('taskType');
    const dateEl = document.getElementById('taskDate');
    const descEl = document.getElementById('taskDescription');

    if (titleEl) titleEl.value = task.title;
    if (typeEl) typeEl.value = task.type;
    if (dateEl) dateEl.value = task.date;
    if (descEl) descEl.value = task.description || '';

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

    window.editingTaskId = task.id;
    const addBtn = document.querySelector('#taskModal .btn-orange');
    if (addBtn) addBtn.textContent = 'Salvar Alterações';

    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

function deleteTask(taskId) {
    // ✅ VERIFICAR AUTENTICAÇÃO ANTES DE DELETAR
    const currentUser = firebase.auth()?.currentUser;
    if (!currentUser) {
        alert('Você precisa estar logado para deletar tarefas');
        return;
    }

    // Primeiro, tentar encontrar a tarefa na memória (mês atual)
    let task = tasks.find(t => t.id === taskId);
    
    if (!task) {
        // Se não encontrou na memória, buscar no Firestore
        console.log('🔍 Tarefa não encontrada na memória, buscando no Firestore para deletar...');
        
        if (!window.db) {
            alert('Erro: Banco de dados não disponível');
            return;
        }
        
        window.db.collection('tasks').doc(taskId).get()
            .then((doc) => {
                if (!doc.exists) {
                    alert('Tarefa não encontrada');
                    return;
                }
                
                const taskData = doc.data();
                
                // Permitir deleção de qualquer tarefa (app global)
                
                // Confirmar deleção
                if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
                
                // Deletar do Firestore
                window.db.collection('tasks').doc(taskId).delete()
                    .then(() => {
                        console.log('✅ Tarefa deletada com sucesso');
                        // Recarregar tarefas se necessário
                        loadTasks();
                    })
                    .catch((error) => {
                        console.error('Erro ao deletar tarefa:', error);
                        alert('Erro ao deletar tarefa');
                    });
            })
            .catch((error) => {
                console.error('Erro ao buscar tarefa:', error);
                alert('Erro ao carregar tarefa');
            });
        return;
    }

    // Permitir deleção de qualquer tarefa (app global)

    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    // ✅ FUNCIONALIDADE DE UPLOAD REMOVIDA - SEM GITHUB

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
    // Primeiro, tentar encontrar a tarefa na memória (mês atual)
    let task = tasks.find(t => t.id === taskId);
    
    if (!task) {
        // Se não encontrou na memória, buscar no Firestore
        console.log('🔍 Tarefa não encontrada na memória, buscando no Firestore para visualizar...');
        
        if (!window.db) {
            alert('Erro: Banco de dados não disponível');
            return;
        }
        
        window.db.collection('tasks').doc(taskId).get()
            .then((doc) => {
                if (!doc.exists) {
                    alert('Tarefa não encontrada');
                    return;
                }
                
                const taskData = doc.data();
                
                // Permitir visualização de qualquer tarefa (app global)
                
                task = { id: doc.id, ...taskData };
                displayTaskDetails(task);
            })
            .catch((error) => {
                console.error('Erro ao buscar tarefa:', error);
                alert('Erro ao carregar tarefa');
            });
        return;
    }

    displayTaskDetails(task);
}

function displayTaskDetails(task) {
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
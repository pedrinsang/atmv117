// ========================================
// SISTEMA DE CALENDÁRIO
// ========================================

// ========================================
// VARIÁVEIS GLOBAIS DO CALENDÁRIO
// ========================================
let currentDate = new Date();
let calendarTasks = {};

// ========================================
// INICIALIZAÇÃO DO CALENDÁRIO
// ========================================
function initializeCalendar() {
    const calendarModal = document.getElementById('calendarModal');
    if (calendarModal) {
        // Evento quando modal do calendário é aberto
        calendarModal.addEventListener('shown.bs.modal', function() {
            // Só carregar o calendário se o usuário estiver autenticado
            if (firebase.auth().currentUser) {
                loadCalendar();
            } else {
                console.log('Aguardando autenticação para carregar calendário...');
                firebase.auth().onAuthStateChanged((user) => {
                    if (user) {
                        loadCalendar();
                    }
                });
            }
        });
    }
}

// ========================================
// CARREGAMENTO DO CALENDÁRIO
// ========================================
function loadCalendar() {
    console.log('📅 Função loadCalendar() chamada');

    // Verificar se Firestore está disponível
    if (!window.db) {
        console.log('⏳ Firestore não disponível, aguardando...');
        setTimeout(loadCalendar, 1000);
        return;
    }

    // ========================================
    // VERIFICAÇÃO DE AUTENTICAÇÃO
    // ========================================
    // Verificar se o usuário está autenticado antes de acessar o Firestore
    const currentUser = firebase.auth().currentUser;
    console.log('👤 Estado de autenticação atual:', currentUser ? `Logado: ${currentUser.email}` : 'Não logado');

    if (!currentUser) {
        console.log('⏳ Usuário não autenticado, aguardando autenticação...');
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('✅ Usuário autenticado, carregando dados do calendário...');
                unsubscribe(); // Remove o listener
                loadCalendarData();
            }
        });
        return;
    }

    // Carrega os dados do calendário
    loadCalendarData();
}

function loadCalendarData() {
    console.log('Iniciando carregamento de dados do calendário...');

    // Verificar novamente se o usuário está autenticado
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('❌ Usuário não autenticado ao tentar carregar calendário');
        return;
    }

    console.log('✅ Usuário autenticado, iniciando listener do calendário...');

    const unsubscribe = window.db.collection('tasks').onSnapshot((snapshot) => {
        console.log(`Snapshot recebido: ${snapshot.size} documentos`);

        calendarTasks = {};
        snapshot.forEach((doc) => {
            const task = doc.data();
            if (!calendarTasks[task.date]) {
                calendarTasks[task.date] = [];
            }
            calendarTasks[task.date].push({ id: doc.id, ...task });
        });

        console.log('🗓️ Tarefas processadas:', Object.keys(calendarTasks).length, 'dias com tarefas');
        renderCalendar();
    }, (error) => {
        console.error('❌ Erro ao carregar tarefas do calendário:', error);

        if (error.code === 'permission-denied') {
            console.error('🚫 Permissão negada - possíveis causas:');
            console.error('1. Usuário não está autenticado');
            console.error('2. Regras do Firestore não foram aplicadas');
            console.error('3. Token de autenticação expirado');

            // diagnóstico automático removido
        }

        // Mostrar erro na interface
        const calendar = document.getElementById('calendar');
        if (calendar) {
            calendar.innerHTML = `
                <div class="alert alert-danger">
                    <h6>❌ Erro ao carregar calendário</h6>
                    <p><strong>Erro:</strong> ${error.code} - ${error.message}</p>
                    <!-- diagnóstico removido -->
                </div>
            `;
        }
    });

    // Salvar referência para cleanup se necessário
    window.calendarUnsubscribe = unsubscribe;
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    if (!calendar) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    calendar.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <button class="btn btn-outline-orange" onclick="previousMonth()">
                <i class="bi bi-chevron-left"></i>
            </button>
            <h5 class="text-orange mb-0">${monthNames[month]} ${year}</h5>
            <button class="btn btn-outline-orange" onclick="nextMonth()">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <div class="calendar-header">
            ${dayNames.map(day => `<div class="calendar-header-day">${day}</div>`).join('')}
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
    `;

    const calendarGrid = document.getElementById('calendarGrid');
    const currentDateObj = new Date();

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const dateString = date.toISOString().split('T')[0];
        const isCurrentMonth = date.getMonth() === month;
        
        // Fix timezone issue - create date in local timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const calendarDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const isToday = calendarDate.getTime() === today.getTime();
        
        const tasksOfDay = calendarTasks[dateString] || [];

        // Conta quantos de cada tipo
        const hasProva = tasksOfDay.some(t => t.type === 'prova');
        const hasTrabalho = tasksOfDay.some(t => t.type === 'trabalho');
        const hasAtividade = tasksOfDay.some(t => t.type === 'atividade');
        const hasMulti = [hasProva, hasTrabalho, hasAtividade].filter(Boolean).length > 1;

        let dots = '';
        if (hasProva) dots += `<span class="task-dot prova"></span>`;
        if (hasTrabalho) dots += `<span class="task-dot trabalho"></span>`;
        if (hasAtividade) dots += `<span class="task-dot atividade"></span>`;

        // Check for birthdays on this date and add a blue birthday dot
        if (typeof getBirthdaysForDate === 'function') {
            const dayBirthdays = getBirthdaysForDate(date);
            if (dayBirthdays.length > 0) {
                dots += `<span class="task-dot aniversario" title="Aniversário${dayBirthdays.length > 1 ? 's' : ''}: ${dayBirthdays.map(b => b.name).join(', ')}"></span>`;
                dayClass += ' has-birthday has-task';
            }
        }

        let dayClass = 'calendar-day';
        if (!isCurrentMonth) dayClass += ' text-muted';
        if (isToday) dayClass += ' selected';
        if (tasksOfDay.length > 0) dayClass += ' has-task';
        if (hasMulti) dayClass += ' has-multi';
        else if (hasProva) dayClass += ' has-prova';
        else if (hasTrabalho) dayClass += ' has-trabalho';
        else if (hasAtividade) dayClass += ' has-atividade';

        const dayElement = document.createElement('div');
        dayElement.className = dayClass;
        dayElement.innerHTML = `
            <div><strong>${date.getDate()}</strong></div>
            <div class="calendar-dots mt-1">${dots}</div>
        `;

        if (tasksOfDay.length > 0 || birthdayIndicator) {
            dayElement.style.cursor = 'pointer';
            dayElement.addEventListener('click', () => abrirModalTarefasDoDia(dateString, tasksOfDay));
        }
        calendarGrid.appendChild(dayElement);
    }
}

// Utilitários
function getTypeColor(type) {
    switch (type) {
        case 'prova': return 'danger';
        case 'trabalho': return 'warning';
        case 'atividade': return 'success';
        default: return 'secondary';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function selectDate(date, element) {
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        if (el !== element) {
            el.classList.remove('selected');
        }
    });

    element.classList.add('selected');

    const dateString = date.toISOString().split('T')[0];
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput) {
        try {
            // If flatpickr is used, setDate will populate altInput correctly
            if (taskDateInput._flatpickr && typeof taskDateInput._flatpickr.setDate === 'function') {
                taskDateInput._flatpickr.setDate(dateString, true);
            } else {
                taskDateInput.value = dateString;
            }
        } catch (e) {
            taskDateInput.value = dateString;
        }
    }

    const calendarModal = bootstrap.Modal.getInstance(document.getElementById('calendarModal'));
    if (calendarModal) {
        calendarModal.hide();
    }

    setTimeout(() => {
        const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
        taskModal.show();
    }, 300);
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

function abrirCalendarioTelaCheia() {
    const calendarModal = new bootstrap.Modal(document.getElementById('calendarModal'));
    calendarModal.show();
}

// Abre o modal de edição de tarefa por cima do calendário (quando o calendário está em modal fullscreen)
function openTaskEditorOverCalendar(taskId) {
    try {
        const dayModalEl = document.getElementById('dayTasksModal');
        const dayModalInstance = dayModalEl ? bootstrap.Modal.getInstance(dayModalEl) : null;
        if (dayModalInstance) dayModalInstance.hide();

        setTimeout(() => {
            const taskModalEl = document.getElementById('taskModal');
            const calendarModalEl = document.getElementById('calendarModal');
            const calendarOpen = calendarModalEl && calendarModalEl.classList.contains('show');

            if (calendarOpen && taskModalEl) {
                // Garantir que o taskModal fique com z-index acima do calendário
                // Valores elevados para evitar conflitos com outros backdrops
                taskModalEl.style.zIndex = 20050;

                const onShown = function() {
                    // Ajustar o backdrop recém-criado para ficar logo abaixo do modal
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    const last = backdrops[backdrops.length - 1];
                    if (last) last.style.zIndex = 20040;
                    taskModalEl.removeEventListener('shown.bs.modal', onShown);
                };

                taskModalEl.addEventListener('shown.bs.modal', onShown);
            }

            // Reaproveita a função existente de edição
            if (typeof editTask === 'function') {
                editTask(taskId);
            } else {
                // fallback
                const m = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal'));
                if (m) m.hide();
                setTimeout(() => { if (typeof editTask === 'function') editTask(taskId); }, 300);
            }
        }, 300);
    } catch (e) {
        console.error('Erro ao abrir editor sobre o calendário', e);
        if (typeof editTask === 'function') editTask(taskId);
    }
}

function abrirModalTarefasDoDia(dateString, tasksOfDay) {
    const modalBody = document.getElementById('dayTasksModalBody');
    if (!modalBody) return;

    let content = '';
    
    // Check for birthdays on this date
    if (typeof getBirthdaysForDate === 'function') {
        const date = new Date(dateString + 'T00:00:00');
        const dayBirthdays = getBirthdaysForDate(date);
        
        if (dayBirthdays.length > 0) {
                content += '<h6 class="mb-2"><span class="legend-dot aniversario me-2" style="vertical-align:middle;"></span>Aniversários</h6>';
                dayBirthdays.forEach(birthday => {
                    content += `
                        <div class="mb-2 p-2 rounded border-start border-4 border-info bg-light">
                            <div class="fw-bold text-dark">${escapeHtml(birthday.name)}</div>
                            <div class="small text-muted">🎉 Aniversário</div>
                        </div>
                    `;
            });
            
            if (tasksOfDay.length > 0) {
                content += '<hr class="my-3">';
            }
        }
    }

    if (tasksOfDay.length === 0 && !content) {
        modalBody.innerHTML = '<p class="text-muted">Nenhuma tarefa ou aniversário para este dia.</p>';
    } else {
        if (tasksOfDay.length > 0) {
            if (content) {
                content += '<h6 class="text-orange mb-2"><i class="bi bi-list-task me-2"></i>Tarefas</h6>';
            }
            content += tasksOfDay.map(task => `
                <div class="mb-2 p-2 rounded border-start border-4 border-${getTypeColor(task.type)} bg-light">
                    <div class="fw-bold text-dark">${escapeHtml(task.title)}</div>
                    <div class="small text-muted"><strong>${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</strong></div>
                    <div class="small text-muted">${escapeHtml(task.description || '')}</div>
                    <div class="mt-2 d-flex justify-content-end">
                        <div onclick="event.stopPropagation();">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openTaskEditorOverCalendar('${task.id}')">
                                        <i class="bi bi-pencil"></i> Editar
                                    </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="(function(){ const m = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal')); if(m) m.hide(); setTimeout(function(){ deleteTask('${task.id}'); }, 300); })()">
                                <i class="bi bi-trash"></i> Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        modalBody.innerHTML = content;
    }

    const modal = new bootstrap.Modal(document.getElementById('dayTasksModal'));
    modal.show();
}

document.addEventListener('DOMContentLoaded', function() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const today = new Date();
    const el = document.getElementById('currentMonthName');
    if (el) el.textContent = monthNames[today.getMonth()] + ' ' + today.getFullYear();
});

window.initializeCalendar = initializeCalendar;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.selectDate = selectDate;
window.abrirCalendarioTelaCheia = abrirCalendarioTelaCheia;
window.abrirModalTarefasDoDia = abrirModalTarefasDoDia;
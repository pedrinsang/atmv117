let currentDate = new Date();
let calendarTasks = {};

function initializeCalendar() {
    const calendarModal = document.getElementById('calendarModal');
    if (calendarModal) {
        calendarModal.addEventListener('shown.bs.modal', function() {
            loadCalendar();
        });
    }
}

function loadCalendar() {
    if (!window.db) {
        setTimeout(loadCalendar, 1000);
        return;
    }
    
    window.db.collection('tasks').onSnapshot((snapshot) => {
        calendarTasks = {};
        snapshot.forEach((doc) => {
            const task = doc.data();
            if (!calendarTasks[task.date]) {
                calendarTasks[task.date] = [];
            }
            calendarTasks[task.date].push({ id: doc.id, ...task });
        });
        renderCalendar();
    });
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
        const isToday = date.toDateString() === currentDateObj.toDateString();
        const tasksOfDay = calendarTasks[dateString] || [];

        // Conta quantos de cada tipo
        const hasProva = tasksOfDay.some(t => t.type === 'prova');
        const hasTrabalho = tasksOfDay.some(t => t.type === 'trabalho');
        const hasAtividade = tasksOfDay.some(t => t.type === 'atividade');
        const hasMulti = [hasProva, hasTrabalho, hasAtividade].filter(Boolean).length > 1;

        let dots = '';
        if (hasProva) dots += `<span class="task-dot bg-danger"></span>`;
        if (hasTrabalho) dots += `<span class="task-dot bg-warning"></span>`;
        if (hasAtividade) dots += `<span class="task-dot bg-success"></span>`;

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

        if (tasksOfDay.length > 0) {
            dayElement.style.cursor = 'pointer';
            dayElement.addEventListener('click', () => abrirModalTarefasDoDia(dateString, tasksOfDay));
        }
        calendarGrid.appendChild(dayElement);
    }
}

// Adicione essas funções utilitárias se não existirem:
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
        taskDateInput.value = dateString;
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

function abrirModalTarefasDoDia(dateString, tasksOfDay) {
    const modalBody = document.getElementById('dayTasksModalBody');
    if (!modalBody) return;

    if (tasksOfDay.length === 0) {
        modalBody.innerHTML = '<p class="text-muted">Nenhuma tarefa para este dia.</p>';
    } else {
        modalBody.innerHTML = tasksOfDay.map(task => `
            <div class="mb-2 p-2 rounded border-start border-4 border-${getTypeColor(task.type)} bg-light">
            <div class="fw-bold text-dark">${escapeHtml(task.title)}</div>
            <div class="small text-muted"><strong>${task.type.charAt(0).toUpperCase() + task.type.slice(1)}</strong></div>
            <div class="small text-muted">${escapeHtml(task.description || '')}</div>
            </div>
        `).join('');
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
    document.getElementById('currentMonthName').textContent =
        monthNames[today.getMonth()] + ' ' + today.getFullYear();
});

window.initializeCalendar = initializeCalendar;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.selectDate = selectDate;
window.abrirCalendarioTelaCheia = abrirCalendarioTelaCheia;
window.abrirModalTarefasDoDia = abrirModalTarefasDoDia;
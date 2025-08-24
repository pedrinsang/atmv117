// ========================================
// SISTEMA DE CONTROLE DE DEBUG
// ========================================
// Sistema de emergência: bloqueia recarregamentos automáticos durante debug
try {
    // Previne fortemente reload/replace/assign até que o debug seja resolvido
    if (!window._debugKillSwitchInstalled) {
        window._debugKillSwitchInstalled = true;
        window._origReload = window.location.reload.bind(window.location);
        window.location.reload = function() { console.warn('DEBUG KILL-SWITCH: reload prevenido'); };
        window._origReplace = window.location.replace.bind(window.location);
        window.location.replace = function(url) { console.warn('DEBUG KILL-SWITCH: replace prevenido para', url); };
        window._origAssign = window.location.assign.bind(window.location);
        window.location.assign = function(url) { console.warn('DEBUG KILL-SWITCH: assign prevenido para', url); };
        try {
            // Banner suprimido: mantém marcador oculto para diagnósticos sem mostrar texto de debug
            const b = document.createElement('div');
            b.id = 'debugReloadBanner';
            b.style.display = 'none';
            document.documentElement.appendChild(b);
        } catch (e) { /* ignorar erros de DOM */ }
    }
} catch (e) { console.warn('Falha ao instalar debug kill-switch', e); }

// ========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Delay para garantir que todos os recursos foram carregados
    setTimeout(initializeApp, 2000);
    
    // ========================================
    // REGISTRO DO SERVICE WORKER
    // ========================================
    // Registra Service Worker com detecção de atualização (pula em dev - localhost/127.0.0.1)
    const _host = window.location.hostname;
    const allowSW = !(_host === '127.0.0.1' || _host === 'localhost' || window.location.protocol === 'file:');
    if (allowSW && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registrado com sucesso');
                
                // Detecta atualizações do Service Worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nova versão disponível - não força reload durante fluxo bloqueado
                            if (sessionStorage.getItem('blockedUid')) {
                                console.log('Fluxo bloqueado ativo - pulando prompt de atualização SW');
                                return;
                            }
                            try {
                                if (confirm('Nova versão disponível! Deseja atualizar agora?')) {
                                        safeReload(true);
                                }
                            } catch (e) { console.warn('Falha no prompt de atualização SW', e); }
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('SW registration failed:', error);
            });

        // Escuta mensagens do service worker
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Avoid reloading while blocked flow is active or if we've just reloaded due to SW
            if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                console.log('Fluxo bloqueado ativo - pulando reload por controllerchange');
                return;
            }
            const last = parseInt(sessionStorage.getItem('swReloaded') || '0', 10);
            if (last && (Date.now() - last) < 5000) {
                console.log('Reload SW recente detectado - pulando reload duplicado');
                return;
            }
            sessionStorage.setItem('swReloaded', Date.now().toString());
            console.log('Mudança de controlador do service worker detectada - recarregando página uma vez');
            safeReload(true);
        });
    }
    else {
        console.log('Pulando registro do service worker no host de desenvolvimento:', window.location.hostname);
    }

    // ========================================
    // VERIFICAÇÃO AUTOMÁTICA DE ATUALIZAÇÕES
    // ========================================
    // Força verificação de atualizações a cada 5 minutos
    setInterval(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) reg.update();
            });
        }
    }, 5 * 60 * 1000);

    // ========================================
    // FERRAMENTAS DE DESENVOLVIMENTO
    // ========================================
    // Helpers de dev: permite desabilitar cache SW via parâmetro URL ?no-cache=1 ou localStorage.disableSW='1'
    function postToSW(msg){ if (!('serviceWorker' in navigator)) return; navigator.serviceWorker.getRegistration().then(reg=>{ if (reg && reg.active) reg.active.postMessage(msg); }); }

    // Função para desabilitar cache do Service Worker em desenvolvimento
    window.devDisableSWCache = function(disable){
        localStorage.setItem('disableSWCache', disable ? '1' : '0');
        postToSW({ type: 'SET_DISABLE_CACHE', value: !!disable });
    };

    window.devClearSWCache = function(){ postToSW({ type: 'CLEAR_CACHE' }); };

    // Auto-apply based on URL or localStorage
    try {
        const params = new URLSearchParams(window.location.search);
        const noCacheParam = params.get('no-cache');
        const fromStorage = localStorage.getItem('disableSWCache');
        if (noCacheParam === '1' || fromStorage === '1') {
            // Notify active SW (if any)
            postToSW({ type: 'SET_DISABLE_CACHE', value: true });
            console.info('Dev: service worker caching disabled for this session');
        }
    } catch(e){ /* ignore */ }
});

function initializeApp() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase não carregado');
        setTimeout(initializeApp, 1000);
        return;
    }
    
    if (!window.db) {
        console.error('Firestore não inicializado');
        setTimeout(initializeApp, 1000);
        return;
    }
    
    console.log('Inicializando aplicação...');
    
    // Aguardar autenticação antes de carregar dados
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuário autenticado, verificando status...');
            
            // Verificar se a conta está bloqueada
            const isBlocked = await checkUserBlocked(user);
            if (isBlocked) {
                return; // Para aqui se a conta estiver bloqueada
            }
            
            console.log('Usuário autenticado e ativo, carregando dados...');
            
            if (typeof loadTasks === 'function') {
                loadTasks();
            }
            
            if (typeof initializeCalendar === 'function') {
                initializeCalendar();
            }
        } else {
            console.log('Usuário não autenticado');
            
            // Não redirecionar se há modal de conta bloqueada ativo ou se estamos no fluxo blocked
            if (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) {
                console.log('Blocked flow ativo - app.js não redirecionando');
                return;
            }
            
            // Se esta página requer autenticação, redirecionar para login
            const protectedPages = ['index.html', 'admin.html'];
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                if (protectedPages.includes(currentPage) || !currentPage.includes('.')) {
                    console.log('Página protegida detectada sem autenticação - redirecionando para login');
                    safeNavigate('login.html');
            }
        }
    });
    
    const today = new Date().toISOString().split('T')[0];
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput) {
        taskDateInput.setAttribute('min', today);
    }
    
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof addTask === 'function') {
                addTask();
            }
        });
    }
    
    console.log('Aplicação inicializada com sucesso');
}

let deferredPrompt = null;

// Detecta suporte ao evento de instalação
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const _installPwaBtn = document.getElementById('installPwaBtn');
    if (_installPwaBtn) _installPwaBtn.style.display = 'inline-block';
});

// Botão para instalar o PWA (Android/Chrome)
const _installPwaBtnClick = document.getElementById('installPwaBtn');
if (_installPwaBtnClick) {
    _installPwaBtnClick.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                deferredPrompt = null;
                const _btn = document.getElementById('installPwaBtn');
                if (_btn) _btn.style.display = 'none';
            }
        }
    });
}

// Detecta iOS e mostra instruções
function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isInStandaloneMode() {
    return ('standalone' in window.navigator) && window.navigator.standalone;
}

window.addEventListener('DOMContentLoaded', () => {
    if (isIos() && !isInStandaloneMode()) {
        const _installBtnIos = document.getElementById('installPwaBtn');
        if (_installBtnIos) {
            _installBtnIos.style.display = 'inline-block';
            _installBtnIos.onclick = function() {
                const iosModalEl = document.getElementById('iosInstallModal');
                if (iosModalEl && window.bootstrap && bootstrap.Modal) {
                    const modal = new bootstrap.Modal(iosModalEl);
                    modal.show();
                }
            };
        }
    }
});

// ===== SIDEBAR NAVIGATION FUNCTIONS =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

function navigateToPage(page) {
    // Hide all pages
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(p => p.classList.remove('active'));
    
    // Show selected page
    const targetPage = document.getElementById(page + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update menu active state
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => item.classList.remove('active'));
    
    const activeMenuItem = document.querySelector(`[data-page="${page}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
    
    // Handle special cases
    if (page === 'calendario') {
        // Initialize calendar for the page
        setTimeout(() => {
            initializeCalendarPage();
        }, 100);
    }
}

// Initialize calendar for the calendar page
function initializeCalendarPage() {
    const calendarPageView = document.getElementById('calendarPageView');
    if (!calendarPageView) return;
    
    // Clear any existing content
    calendarPageView.innerHTML = '';
    
    // Create calendar structure for the page
    const calendarHTML = `
        <div class="calendar" id="pageCalendar">
            <div class="calendar-header">
                <button class="btn btn-outline-orange btn-sm" onclick="changePageMonth(-1)">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <h4 class="calendar-month-year text-orange mb-0" id="pageCalendarMonthYear"></h4>
                <button class="btn btn-outline-orange btn-sm" onclick="changePageMonth(1)">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
            <div class="calendar-legend mb-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="legend-item d-flex align-items-center gap-2">
                        <span class="legend-dot trabalho"></span> <small>Trabalho</small>
                    </div>
                    <div class="legend-item d-flex align-items-center gap-2">
                        <span class="legend-dot prova"></span> <small>Prova</small>
                    </div>
                    <div class="legend-item d-flex align-items-center gap-2">
                        <span class="legend-dot atividade"></span> <small>Atividade</small>
                    </div>
                </div>
            </div>

            <div class="calendar-grid">
                <div class="calendar-days-header">
                    <div class="calendar-day-header">Dom</div>
                    <div class="calendar-day-header">Seg</div>
                    <div class="calendar-day-header">Ter</div>
                    <div class="calendar-day-header">Qua</div>
                    <div class="calendar-day-header">Qui</div>
                    <div class="calendar-day-header">Sex</div>
                    <div class="calendar-day-header">Sáb</div>
                </div>
                <div class="calendar-days" id="pageCalendarDays"></div>
            </div>
        </div>
    `;
    
    calendarPageView.innerHTML = calendarHTML;
    
    // Initialize the calendar with current date
    // Always attempt to load data for the page calendar
    if (typeof loadCalendarForPageView === 'function') {
        loadCalendarForPageView();
    } else if (typeof loadPageCalendarData === 'function') {
        loadPageCalendarData();
    }
}

// Load calendar data for page view
function loadCalendarForPageView() {
    if (!window.db || !firebase.auth().currentUser) {
        console.log('Aguardando autenticação para carregar calendário da página...');
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                loadPageCalendarData();
            }
        });
        return;
    }
    
    loadPageCalendarData();
}

// Load calendar data specifically for the page
function loadPageCalendarData() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    console.log('Carregando dados do calendário da página...');

    const buildTasksFromSnapshot = (querySnapshot) => {
        const tasks = {};
        querySnapshot.forEach((doc) => {
            const task = doc.data();
                const rawDate = task.date;
                if (!rawDate) return;

                // normalize to YYYY-MM-DD
                let dateKey = null;
                if (typeof rawDate === 'object') {
                    // Firestore Timestamp or similar
                    if (typeof rawDate.toDate === 'function') {
                        dateKey = rawDate.toDate().toISOString().split('T')[0];
                    } else if (rawDate.seconds) {
                        dateKey = new Date(rawDate.seconds * 1000).toISOString().split('T')[0];
                    } else {
                        // fallback: try JSON stringify
                        try { dateKey = String(rawDate); } catch (e) { return; }
                    }
                } else if (typeof rawDate === 'string') {
                    if (rawDate.indexOf('T') !== -1) {
                        dateKey = rawDate.split('T')[0];
                    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                        dateKey = rawDate;
                    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                        // convert dd/mm/yyyy to yyyy-mm-dd
                        const parts = rawDate.split('/');
                        dateKey = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                    } else {
                        // fallback
                        dateKey = rawDate;
                    }
                }

                if (!dateKey) return;

                if (!tasks[dateKey]) {
                    tasks[dateKey] = [];
                }
                tasks[dateKey].push({ id: doc.id, ...task });
            });
            
        // Store tasks globally for calendar use
        window.pageCalendarTasks = tasks;
        console.log('Tarefas carregadas para o calendário:', tasks);
        renderPageCalendar();
    };

    // Try user-specific query first (if logged in), otherwise fall back to all tasks
    if (user) {
        window.db.collection('tasks').where('userId', '==', user.uid).get()
            .then((snap) => {
                if (snap.empty) {
                    // no user-specific tasks — fetch all tasks as fallback
                    return window.db.collection('tasks').get();
                }
                return snap;
            })
            .then(buildTasksFromSnapshot)
            .catch((error) => {
                console.error('Erro ao carregar tarefas do calendário:', error);
            });
    } else {
        // not logged in — fetch all tasks
        window.db.collection('tasks').get()
            .then(buildTasksFromSnapshot)
            .catch((error) => {
                console.error('Erro ao carregar tarefas do calendário:', error);
            });
    }
}

// Render calendar for page view
function renderPageCalendar() {
    const monthYearElement = document.getElementById('pageCalendarMonthYear');
    const daysElement = document.getElementById('pageCalendarDays');
    const headerElement = document.querySelector('#pageCalendar .calendar-days-header');

    if (!monthYearElement || !daysElement || !headerElement) {
        console.log('Elementos do calendário não encontrados');
        return;
    }

    // Use current date or stored calendar date
    const now = window.pageCalendarDate || new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Set month/year header
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    monthYearElement.textContent = `${monthNames[month]} ${year}`;

    // build header
    const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    headerElement.innerHTML = weekNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Calculate calendar data
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Get previous month data
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

    // Get next month data
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    let calendarHTML = '';

    // Previous month days (to fill the first week)
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const prevDay = daysInPrevMonth - i;
        const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
        const hasTasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr];
        const taskCount = hasTasks ? hasTasks.length : 0;

        // build dots for task types
        let dotsHTML = '';
        if (taskCount > 0) {
            const types = [...new Set(hasTasks.map(t => t.type || ''))].slice(0, 6);
            const dots = types.map(t => `<span class="task-dot ${t}"></span>`).join('');
            dotsHTML = `<div class="task-dots">${dots}</div>`;
        }

        calendarHTML += `
            <div class="calendar-day other-month ${taskCount>0? 'has-task':''}" onclick="showPageDayTasks('${dateStr}')">
                <span class="day-number">${prevDay}</span>
                ${dotsHTML}
            </div>
        `;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = dateStr === todayStr;
        const hasTasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr];

    let dayClass = 'calendar-day';
    if (isToday) dayClass += ' selected';
    if (hasTasks) dayClass += ' has-task';

        const taskCount = hasTasks ? hasTasks.length : 0;

        // build dots for types
        let dotsHTML = '';
        if (taskCount > 0) {
            const types = [...new Set(hasTasks.map(t => t.type || ''))].slice(0, 6);
            const dots = types.map(t => `<span class="task-dot ${t}"></span>`).join('');
            dotsHTML = `<div class="task-dots">${dots}</div>`;
        }

        calendarHTML += `
            <div class="${dayClass}" onclick="showPageDayTasks('${dateStr}')">
                <span class="day-number">${day}</span>
                ${dotsHTML}
            </div>
        `;
    }

    // Calculate how many cells are already filled
    const cellsFilled = firstDayOfWeek + daysInMonth;
    const totalCells = Math.ceil(cellsFilled / 7) * 7;
    const nextMonthDays = totalCells - cellsFilled;

    // Next month days (to complete the grid)
    for (let day = 1; day <= nextMonthDays; day++) {
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasTasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr];
        const taskCount = hasTasks ? hasTasks.length : 0;

        let dotsHTML = '';
        if (taskCount > 0) {
            const types = [...new Set(hasTasks.map(t => t.type || ''))].slice(0, 6);
            const dots = types.map(t => `<span class="task-dot ${t}"></span>`).join('');
            dotsHTML = `<div class="task-dots">${dots}</div>`;
        }

        calendarHTML += `
            <div class="calendar-day other-month ${taskCount>0? 'has-task':''}" onclick="showPageDayTasks('${dateStr}')">
                <span class="day-number">${day}</span>
                ${dotsHTML}
            </div>
        `;
    }

    daysElement.innerHTML = calendarHTML;
    console.log('Calendário renderizado com sucesso');
}

// Show tasks for a specific day in page view
function showPageDayTasks(dateStr) {
    const tasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr];
    if (!tasks || tasks.length === 0) {
        // Show message for no tasks
    const dayTasksModalEl = document.getElementById('dayTasksModal');
    const modal = (dayTasksModalEl && window.bootstrap && bootstrap.Modal) ? new bootstrap.Modal(dayTasksModalEl) : null;
    const modalTitle = document.querySelector('#dayTasksModal .modal-title');
    const modalBody = document.getElementById('dayTasksModalBody');
        
        if (modalTitle && modalBody) {
            const date = new Date(dateStr + 'T12:00:00');
            const dateFormatted = date.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            modalTitle.textContent = `Tarefas de ${dateFormatted}`;
            modalBody.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-calendar-x" style="font-size: 3rem;"></i>
                    <p class="mt-3">Nenhuma tarefa encontrada para este dia.</p>
                </div>
            `;
            modal.show();
        }
        return;
    }
    
    // Use existing day tasks modal
    const modalTitle = document.querySelector('#dayTasksModal .modal-title');
    const modalBody = document.getElementById('dayTasksModalBody');
    
    if (modalTitle && modalBody) {
        const date = new Date(dateStr + 'T12:00:00');
        const dateFormatted = date.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        modalTitle.textContent = `Tarefas de ${dateFormatted}`;
        
        let tasksHTML = '';
        tasks.forEach(task => {
            const typeColors = {
                'prova': 'danger',
                'trabalho': 'warning', 
                'atividade': 'info'
            };
            const typeLabels = {
                'prova': 'Prova',
                'trabalho': 'Trabalho',
                'atividade': 'Atividade'
            };
            const badgeColor = typeColors[task.type] || 'secondary';
            const typeLabel = typeLabels[task.type] || task.type;

            // Prepare actions that first hide the day modal then call existing functions
            const editAction = `(() => { const m = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal')); if (m) m.hide(); setTimeout(()=> editTask('${task.id}'), 250); })()`;
            const deleteAction = `(() => { const m = bootstrap.Modal.getInstance(document.getElementById('dayTasksModal')); if (m) m.hide(); setTimeout(()=> deleteTask('${task.id}'), 250); })()`;

            tasksHTML += `
                <div class="card mb-3">
                    <div class="card-body bg-white text-dark">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">${escapeHtml(task.title)}</h6>
                            <span class="badge bg-${badgeColor}">${escapeHtml(typeLabel)}</span>
                        </div>
                        ${task.description ? `<p class="card-text small text-dark">${escapeHtml(task.description)}</p>` : ''}
                        <small class="text-muted d-block mb-2">
                            <i class="bi bi-calendar3 me-1"></i>${dateFormatted}
                        </small>
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); ${editAction}">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); ${deleteAction}">
                                <i class="bi bi-trash"></i> Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        modalBody.innerHTML = tasksHTML;
        
    const dayTasksModalEl2 = document.getElementById('dayTasksModal');
    const modal2 = (dayTasksModalEl2 && window.bootstrap && bootstrap.Modal) ? new bootstrap.Modal(dayTasksModalEl2) : null;
    if (modal2) modal2.show();
    }
}

// Change month in page calendar
function changePageMonth(direction) {
    console.log('Mudando mês:', direction);
    
    // Initialize calendar date if not exists
    if (!window.pageCalendarDate) {
        window.pageCalendarDate = new Date();
    }
    
    // Change month
    const currentMonth = window.pageCalendarDate.getMonth();
    const currentYear = window.pageCalendarDate.getFullYear();
    
    if (direction > 0) {
        // Next month
        if (currentMonth === 11) {
            window.pageCalendarDate = new Date(currentYear + 1, 0, 1);
        } else {
            window.pageCalendarDate = new Date(currentYear, currentMonth + 1, 1);
        }
    } else {
        // Previous month
        if (currentMonth === 0) {
            window.pageCalendarDate = new Date(currentYear - 1, 11, 1);
        } else {
            window.pageCalendarDate = new Date(currentYear, currentMonth - 1, 1);
        }
    }
    
    // Re-render calendar
    renderPageCalendar();
}

// Close sidebar when clicking outside (on overlay)
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // If none of the sidebar elements exist on this page, do nothing
    if (!sidebar && !menuToggle && !sidebarOverlay) return;

    // Only close sidebar if clicking on the overlay itself (not when modal is behind it)
    if (sidebarOverlay && event.target === sidebarOverlay) {
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }

    // If clicking outside sidebar and menu button, but not on modal elements
    if (sidebar && menuToggle && !sidebar.contains(event.target) && 
        !menuToggle.contains(event.target) && 
        !event.target.closest('.modal') &&
        sidebar.classList.contains('open')) {
        toggleSidebar();
    }
});

// Handle escape key to close sidebar
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});

// Function to check if user account is blocked
// Flags globais para controle de estado
window.isCheckingBlockedAccount = false;
window.isBlockedAccountModalActive = false;

// Função global para verificar se modal está ativo
window.isBlockedModalActive = function() {
    const modal = document.getElementById('blockedAccountModal');
    return modal && modal.style.display === 'block' && window.isBlockedAccountModalActive;
};

// Safe navigation helper: use this instead of assigning window.location.href
window.safeNavigate = function(url, force = false) {
    try {
        if (!force && (sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) && !window.allowRedirect) {
            console.log('🚫 safeNavigate blocked due to blocked flow/modal active:', url);
            console.trace();
            return;
        }
        // Prefer replace to avoid filling history
        try { window.location.replace(url); } catch (e) { window.location.href = url; }
    } catch (err) {
        console.error('safeNavigate error:', err);
        try { window.location.href = url; } catch (e) { /* last resort */ }
    }
};

// Safe reload helper to avoid infinite reload loops and provide trace info
window.safeReload = function(force = false) {
    try {
        if (!force && sessionStorage.getItem('blockedUid')) {
            console.log('Blocked flow active - safeReload aborted');
            return;
        }
        const last = parseInt(sessionStorage.getItem('swReloaded') || '0', 10);
        if (!force && last && (Date.now() - last) < 5000) {
            console.log('safeReload aborted - recent reload detected');
            return;
        }
        // Reload attempt flood protection
        window._reloadAttempts = window._reloadAttempts || [];
        const now = Date.now();
        window._reloadAttempts = window._reloadAttempts.filter(t => now - t < 10000);
        window._reloadAttempts.push(now);
        if (window._reloadAttempts.length > 3 && !force) {
            console.warn('Aborting safeReload: too many reload attempts in short time', window._reloadAttempts.length);
            return;
        }
        console.trace('Performing safeReload');
        sessionStorage.setItem('swReloaded', Date.now().toString());
        window.location.reload();
    } catch (e) {
        console.error('safeReload failed:', e);
    }
};

// Aggressive interceptors: wrap common navigation APIs to log stack traces and block during blocked flow
(function(){
    try {
        // reload
        if (!window._originalReload) {
            window._originalReload = window.location.reload.bind(window.location);
            window.location.reload = function() {
                console.trace('Intercepted location.reload call');
                if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                    console.log('Blocked flow - preventing location.reload');
                    return;
                }
                return window._originalReload();
            };
        }

        // replace
        if (!window._originalReplace) {
            window._originalReplace = window.location.replace.bind(window.location);
            window.location.replace = function(url) {
                console.trace('Intercepted location.replace ->', url);
                if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                    console.log('Blocked flow - preventing location.replace to', url);
                    return;
                }
                return window._originalReplace(url);
            };
        }

        // assign
        if (!window._originalAssign) {
            window._originalAssign = window.location.assign.bind(window.location);
            window.location.assign = function(url) {
                console.trace('Intercepted location.assign ->', url);
                if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                    console.log('Blocked flow - preventing location.assign to', url);
                    return;
                }
                return window._originalAssign(url);
            };
        }

        // history methods
        if (history && !history._originalPushState) {
            history._originalPushState = history.pushState.bind(history);
            history.pushState = function(state, title, url) {
                console.trace('Intercepted history.pushState ->', url);
                if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                    console.log('Blocked flow - preventing pushState to', url);
                    return;
                }
                return history._originalPushState(state, title, url);
            };
        }
        if (history && !history._originalReplaceState) {
            history._originalReplaceState = history.replaceState.bind(history);
            history.replaceState = function(state, title, url) {
                console.trace('Intercepted history.replaceState ->', url);
                if (sessionStorage.getItem('blockedUid') || sessionStorage.getItem('blockedFlowActive')) {
                    console.log('Blocked flow - preventing replaceState to', url);
                    return;
                }
                return history._originalReplaceState(state, title, url);
            };
        }
    } catch (e) {
        console.warn('Failed to install navigation interceptors', e);
    }
})();

// Wrap location.replace to guard blocked flow and log traces for debugging
if (!window._originalLocationReplace) {
    window._originalLocationReplace = window.location.replace.bind(window.location);
    window.location.replace = function(url) {
        if ((sessionStorage.getItem('blockedUid') || (window.isBlockedModalActive && window.isBlockedModalActive())) && !window.allowRedirect) {
            console.log('🚫 location.replace blocked due to blocked flow/modal active:', url);
            console.trace();
            return;
        }
        return window._originalLocationReplace(url);
    };
}

async function checkUserBlocked(user) {
    // Evitar verificações simultâneas
    if (window.isCheckingBlockedAccount) {
        return false;
    }
    
    window.isCheckingBlockedAccount = true;
    
    try {
        const userDoc = await window.db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            if (userData.disabled === true) {
                // Show blocked account screen
                showBlockedAccountScreen(user, userData);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Erro ao verificar status do usuário:', error);
        return false;
    } finally {
        // Reset flag após verificação
        setTimeout(() => {
            window.isCheckingBlockedAccount = false;
        }, 2000);
    }
}

// Show blocked account screen without forcing logout so user can choose actions
function showBlockedAccountScreen(user, userData) {
    // Store blocked info and redirect to blocked page where user can reauthenticate to delete
    try {
        sessionStorage.setItem('blockedUid', user.uid);
        sessionStorage.setItem('blockedEmail', user.email || (userData && userData.email) || '');
        // If we're already on the blocked page, don't navigate (prevents reload loop)
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'blocked.html') {
            // Ensure blocked flow flag is set for interceptors
            try { sessionStorage.setItem('blockedFlowActive', '1'); } catch (e) {}
            return;
        }
        window.allowRedirect = true;
        window.location.href = 'blocked.html';
        window.allowRedirect = false;
    } catch (e) {
        console.error('Erro ao redirecionar para blocked.html:', e);
        // Fallback: show modal
        createBlockedAccountModal(user, userData);
    }
}

// Helper: delete documents returned by a query in batches (handles >500 docs)
async function deleteQueryBatch(query, batchSize = 500) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) {
        return 0;
    }

    const batch = window.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return snapshot.size;
}

// Delete user data (Firestore) and then Auth account when possible
window.deleteAccountCompletely = async function(uid) {
    try {
        if (!uid) uid = firebase.auth().currentUser?.uid;
        if (!uid) throw new Error('Usuário não autenticado');

        // Show simple loading state
        const overlay = document.createElement('div');
        overlay.id = 'deleteAccountOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:10000;color:white;font-size:1.1rem;';
        overlay.innerHTML = '<div>Excluindo seus dados... Por favor aguarde.</div>';
        document.body.appendChild(overlay);

        // Delete tasks by user
        let removed = 0;
        let query = window.db.collection('tasks').where('userId', '==', uid);
        do {
            const deleted = await deleteQueryBatch(query);
            removed += deleted;
        } while (removed % 500 === 0 && removed !== 0);

        // Delete classLinks created by user
        removed = 0;
        query = window.db.collection('classLinks').where('createdBy', '==', uid);
        do {
            const deleted = await deleteQueryBatch(query);
            removed += deleted;
        } while (removed % 500 === 0 && removed !== 0);

        // Delete classComplaints created by user
        removed = 0;
        query = window.db.collection('classComplaints').where('createdBy', '==', uid);
        do {
            const deleted = await deleteQueryBatch(query);
            removed += deleted;
        } while (removed % 500 === 0 && removed !== 0);

        // Finally delete users doc
        await window.db.collection('users').doc(uid).delete().catch(err => {
            console.warn('Não foi possível remover documento users:', err.message || err);
        });

        // Attempt to delete Authentication user
        const currentUser = firebase.auth().currentUser;
        if (currentUser && currentUser.uid === uid) {
            try {
                await currentUser.delete();
                // Success: allow redirect and go to login
                window.allowRedirect = true;
                safeNavigate('login.html', true);
                window.allowRedirect = false;
            } catch (err) {
                // If requires-recent-login, inform the user
                console.error('Erro ao deletar usuário do Auth:', err);
                alert('Conta removida do banco de dados, mas não foi possível excluir a autenticação automaticamente.\n' +
                      'Razão: ' + (err.message || err) + '\n' +
                      'Por favor, re-autentique e tente novamente ou contate um administrador para remover sua conta do Authentication.');
                // Clean overlay
                const ov = document.getElementById('deleteAccountOverlay');
                if (ov) ov.remove();
            }
        } else {
            // User not signed in (or different) — we removed DB docs
            alert('Seus dados foram removidos do banco de dados. Para remover a credencial de autenticação, por favor entre em contato com o administrador.');
            const ov = document.getElementById('deleteAccountOverlay');
            if (ov) ov.remove();
        }
    } catch (err) {
        console.error('Erro durante exclusão completa de conta:', err);
        alert('Erro ao tentar excluir sua conta: ' + (err.message || err));
        const ov = document.getElementById('deleteAccountOverlay');
        if (ov) ov.remove();
    }
};



function createBlockedAccountModal(user, userData) {
    // Remove existing modal if any
    const existingModal = document.getElementById('blockedAccountModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Definir flag global
    window.isBlockedAccountModalActive = true;

    const modalHTML = `
        <div class="modal fade show" id="blockedAccountModal" tabindex="-1" 
             style="display: block !important; background: rgba(0,0,0,0.9); z-index: 9999;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-danger">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Conta Bloqueada
                        </h5>
                    </div>
                    <div class="modal-body text-center py-4">
                        <div class="mb-4">
                            <i class="bi bi-lock-fill text-danger" style="font-size: 4rem;"></i>
                        </div>
                        <h4 class="text-danger mb-3">Sua conta foi bloqueada</h4>
                        <p class="mb-4">
                            Sua conta (<strong>${user.email}</strong>) foi bloqueada por um administrador.
                            Isso pode ter ocorrido devido a violações das políticas de uso ou outras questões administrativas.
                        </p>
                        <div class="alert alert-warning">
                            <strong>Para solicitar a exclusão da sua conta:</strong><br>
                            Entre em contato com os administradores através do email de suporte
                            ou outros canais de comunicação disponíveis.
                        </div>
                    </div>
                    <div class="modal-footer justify-content-center">
                        <button type="button" class="btn btn-primary" id="goToLoginBtnApp">
                            <i class="bi bi-arrow-left me-2"></i>Voltar ao Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener for button
    const goToLoginBtnApp = document.getElementById('goToLoginBtnApp');
    if (goToLoginBtnApp) {
        goToLoginBtnApp.addEventListener('click', () => {
            window.isBlockedAccountModalActive = false;
            window.allowRedirect = true; // Permitir redirecionamento
            safeNavigate('login.html', true);
            window.allowRedirect = false; // Resetar flag
        });
    }
    
    // Prevent modal from closing
    const modal = document.getElementById('blockedAccountModal');
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    // Disable ESC key
    document.addEventListener('keydown', function preventEscape(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // Ensure modal stays visible
    setTimeout(() => {
        const modalCheck = document.getElementById('blockedAccountModal');
        if (modalCheck) {
            modalCheck.style.display = 'block';
            modalCheck.style.zIndex = '9999';
        }
    }, 100);
}

// Make functions globally available
window.navigateToPage = navigateToPage;
window.toggleSidebar = toggleSidebar;
window.initializeCalendarPage = initializeCalendarPage;
window.showPageDayTasks = showPageDayTasks;
window.changePageMonth = changePageMonth;
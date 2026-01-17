// ========================================
// SISTEMA DE CONTROLE DE DEBUG
// ========================================
try {
    if (!window._debugKillSwitchInstalled) {
        window._debugKillSwitchInstalled = true;
        window._origReload = window.location.reload.bind(window.location);
        window.location.reload = function() { console.warn('DEBUG KILL-SWITCH: reload prevenido'); };
        window._origReplace = window.location.replace.bind(window.location);
        window.location.replace = function(url) { console.warn('DEBUG KILL-SWITCH: replace prevenido para', url); };
        window._origAssign = window.location.assign.bind(window.location);
        window.location.assign = function(url) { console.warn('DEBUG KILL-SWITCH: assign prevenido para', url); };
        try { const b = document.createElement('div'); b.id = 'debugReloadBanner'; b.style.display = 'none'; document.documentElement.appendChild(b); } catch (e) {}
    }
} catch (e) { console.warn('Falha ao instalar debug kill-switch', e); }

// ========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeApp, 500);
    
    const _host = window.location.hostname;
    const allowSW = !(_host === '127.0.0.1' || _host === 'localhost' || window.location.protocol === 'file:');
    
    // Registro do Service Worker
    if (allowSW && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js?v=99').catch(err => console.error('SW falhou:', err));
    }

    // Configuração do Seletor de Data (Flatpickr)
    const taskDateInput = document.getElementById('taskDate');
    if (taskDateInput && typeof flatpickr !== 'undefined') {
        flatpickr(taskDateInput, {
            dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y', minDate: 'today',
            locale: { firstDayOfWeek: 0, weekdays: { shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], longhand: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] }, months: { shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] } }
        });
    }

    // Overlay da Sidebar
    const overlay = document.getElementById('sidebarOverlay');
    if(overlay) overlay.addEventListener('click', toggleSidebar);

    // === NAVEGAÇÃO POR TECLADO (SETINHAS) ===
    document.addEventListener('keydown', (e) => {
        const calPage = document.getElementById('calendarioPage');
        if (!calPage || !calPage.classList.contains('active')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            changePageMonth(-1); 
        } else if (e.key === 'ArrowRight') {
            changePageMonth(1);
        }
    });
});

function initializeApp() {
    if (typeof firebase === 'undefined' || !window.db) {
        if (!window._initRetries) window._initRetries = 0;
        if (window._initRetries < 5) { window._initRetries++; setTimeout(initializeApp, 500); }
        else { console.warn('Firebase não detectado.'); }
        return;
    }
    
    console.log('App inicializado.');
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Inicializações básicas
            if (typeof loadBirthdaysIntoCache === 'function') loadBirthdaysIntoCache();
            if (window.notificationSystem) setTimeout(() => window.notificationSystem.init(), 1000);

            let displayName = user.displayName;
            try {
                const doc = await window.db.collection('users').doc(user.uid).get();
                if (doc.exists) { 
                    const data = doc.data(); 
                    displayName = data.fullName || data.name || displayName;
                    window.currentUserData = data; 
                }
            } catch(e) { console.error(e); }
            
            // Atualiza UI com nome do usuário
            const nameEl = document.getElementById('userNameTitle');
            if (nameEl) nameEl.textContent = (displayName || 'Veterinário').split(' ')[0];
            const navNameEl = document.getElementById('navbarUserName');
            if (navNameEl) navNameEl.textContent = displayName || 'Usuário';
            const emailEl = document.getElementById('userEmail');
            if(emailEl) emailEl.textContent = user.email;

            // Verificações de Admin e Bloqueio
            if (typeof isAdmin === 'function' && isAdmin()) document.getElementById('adminPanelOption').style.display = 'block';
            if (typeof checkUserBlocked === 'function') { if(await checkUserBlocked(user)) return; }
            
            // Carrega Módulos Principais
            if (typeof loadTasks === 'function') loadTasks();
            if (typeof initializeCalendar === 'function') initializeCalendar();
            
            // INICIALIZA O SISTEMA DE HORÁRIOS
            if (typeof initScheduleSystem === 'function') initScheduleSystem();
            
            // Tenta carregar as notícias se já estiver na home
            if (document.getElementById('listaPage').classList.contains('active')) {
                if(window.loadUfsmNews) window.loadUfsmNews();
            }
            
        } else {
            const isPublicPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('reset-password.html') || window.location.pathname.includes('register.html');
            if (!isPublicPage && !sessionStorage.getItem('blockedUid')) window.location.href = 'login.html';
        }
    });
    
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', function(e) { e.preventDefault(); if (typeof addTask === 'function') addTask(); });
    }
}

window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.deferredPrompt = e; const btn = document.getElementById('installPwaBtn'); if (btn) btn.style.display = 'inline-block'; });

// ========================================
// VERIFICAÇÃO DE PERMISSÃO
// ========================================
window.verifyClassAccess = async function(silent = false) {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    
    if (window.isAdmin && window.isAdmin()) return true;
    if (window.isClassMemberConfirmed === true) return true;

    if (!window.currentUserData) {
        try {
            const doc = await window.db.collection('users').doc(user.uid).get();
            if (doc.exists) window.currentUserData = doc.data();
        } catch(e) { return false; }
    }

    if (window.currentUserData && window.currentUserData.matricula) {
        const userMatricula = window.currentUserData.matricula;
        try {
            const doc = await window.db.collection('matriculas_aceitas').doc(userMatricula).get();
            if (doc.exists) {
                window.isClassMemberConfirmed = true;
                return true;
            } else {
                if(!silent) alert(`🔒 Acesso Restrito\n\nSua matrícula (${userMatricula}) não está na lista da turma.`);
                return false;
            }
        } catch (e) { console.error(e); return false; }
    }
    
    if(!silent) alert("🔒 Acesso Restrito\n\nVocê precisa ter uma matrícula validada para realizar esta ação.");
    return false;
};

window.handleClassDataAccess = async function() {
    const hasAccess = await window.verifyClassAccess();
    if (hasAccess) toggleSidebar();
};

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
}

// ========================================
// NAVEGAÇÃO ENTRE PÁGINAS
// ========================================
function navigateToPage(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(pageId + 'Page');
    if (target) target.classList.add('active');
    
    // --- LÓGICA DE PADDING DO CALENDÁRIO ---
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        if (pageId === 'calendario') {
            mainContent.classList.add('calendar-mode');
            window.pageCalendarDate = new Date(); 
        } else {
            mainContent.classList.remove('calendar-mode');
        }
    }
    
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const sidebarItem = document.querySelector(`.menu-item[data-page="${pageId}"]`);
    if (sidebarItem) sidebarItem.classList.add('active');
    
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    let navTarget = pageId;
    if (['links', 'sugestoes', 'aniversarios', 'dados'].includes(pageId)) navTarget = 'turma'; 
    let navItem = document.querySelector(`.bottom-nav-item[data-nav-target="${navTarget}"]`);
    if (navItem) navItem.classList.add('active');

    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) toggleSidebar();

    // Carregamentos Específicos
    if (pageId === 'calendario') {
        setTimeout(() => { 
            if(typeof initializeCalendarPage === 'function') {
                if (document.getElementById('pageCalendarDays')) {
                    renderPageCalendar(); 
                } else {
                    initializeCalendarPage(); 
                }
            } 
        }, 100);
    }
    
    if (pageId === 'lista') {
        setTimeout(() => { 
            if(window.loadUfsmNews) window.loadUfsmNews(); 
        }, 100);
    }
    
    if (pageId === 'aniversarios') setTimeout(() => { if(window.loadBirthdays) window.loadBirthdays(); }, 100);
    
    if (pageId === 'notificacoes') {
        const badge = document.getElementById('bottomNavBadge');
        if(badge) badge.style.display = 'none';
        if (window.notificationSystem) {
            window.notificationSystem.renderListFromCache(); 
        }
    }
    window.scrollTo(0,0);
}

window.markAllNotificationsReadMobile = function() {
    const btn = document.getElementById('markAllNotificationsRead');
    if(btn) btn.click();
    setTimeout(() => navigateToPage('notificacoes'), 500);
};

// ========================================
// CALENDÁRIO
// ========================================
function initializeCalendarPage() {
    const calendarPageView = document.getElementById('calendarPageView');
    if (!calendarPageView) return;
    
    const calendarHTML = `
        <div class="calendar" id="pageCalendar">
            <div class="calendar-header d-flex align-items-center justify-content-between px-3 py-2">
                <button class="btn btn-outline-light border-0" onclick="changePageMonth(-1)" style="font-size: 1.5rem;"><i class="bi bi-chevron-left"></i></button>
                <div class="text-center">
                    <div id="pageCalendarYear" class="text-muted" style="font-size: 0.9rem; font-weight: 300; line-height: 1;"></div>
                    <div id="pageCalendarMonth" class="text-orange fw-bold" style="font-size: 1.6rem; text-transform: capitalize; line-height: 1.1;"></div>
                </div>
                <button class="btn btn-outline-light border-0" onclick="changePageMonth(1)" style="font-size: 1.5rem;"><i class="bi bi-chevron-right"></i></button>
            </div>
            
            <div class="calendar-legend mb-3 text-muted" style="font-size: 0.8rem;">
                <div class="d-flex flex-wrap gap-3 justify-content-center">
                    <div class="d-flex align-items-center gap-1"><span class="legend-dot trabalho"></span> Trabalho</div>
                    <div class="d-flex align-items-center gap-1"><span class="legend-dot prova"></span> Prova</div>
                    <div class="d-flex align-items-center gap-1"><span class="legend-dot atividade"></span> Atividade</div>
                    <div class="d-flex align-items-center gap-1"><span class="legend-dot aniversario"></span> Aniversário</div>
                </div>
            </div>
            
            <div class="calendar-grid" id="calendarGridWrapper">
                <div class="calendar-days-header">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<div class="calendar-day-header">${d}</div>`).join('')}</div>
                <div class="calendar-days" id="pageCalendarDays"></div>
            </div>
        </div>`;
    
    calendarPageView.innerHTML = calendarHTML;

    // Swipe
    const swipeArea = document.getElementById('pageCalendar');
    if (swipeArea) {
        let touchStartX = 0;
        let touchEndX = 0;
        swipeArea.addEventListener('touchstart', (e) => touchStartX = e.changedTouches[0].screenX, {passive: true});
        swipeArea.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) changePageMonth(1);
            if (touchEndX > touchStartX + 50) changePageMonth(-1);
        }, {passive: true});
    }

    if (typeof loadPageCalendarData === 'function') loadPageCalendarData();
}

function loadPageCalendarData() {
    if (!window.db) { setTimeout(loadPageCalendarData, 500); return; }
    window.db.collection('tasks').get().then(snapshot => {
        const tasks = {};
        snapshot.forEach(doc => {
            const t = doc.data();
            if(!t.date) return;
            const dKey = t.date.split('T')[0];
            if(!tasks[dKey]) tasks[dKey] = [];
            tasks[dKey].push({ id: doc.id, ...t });
        });
        window.pageCalendarTasks = tasks;
        renderPageCalendar();
    });
}

function renderPageCalendar(animationDir = 0) {
    const daysElement = document.getElementById('pageCalendarDays');
    const yearElement = document.getElementById('pageCalendarYear');
    const monthElement = document.getElementById('pageCalendarMonth');
    const gridWrapper = document.getElementById('calendarGridWrapper');
    
    if (!daysElement) return;

    const now = window.pageCalendarDate || new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    if(yearElement) yearElement.textContent = year;
    if(monthElement) monthElement.textContent = monthNames[month];

    if (gridWrapper && animationDir !== 0) {
        gridWrapper.classList.remove('anim-next', 'anim-prev');
        void gridWrapper.offsetWidth; 
        if (animationDir === 1) gridWrapper.classList.add('anim-next');
        else gridWrapper.classList.add('anim-prev');
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    for (let i = firstDay - 1; i >= 0; i--) html += `<div class="calendar-day other-month"><span class="day-number text-muted"></span></div>`;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasTasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr] ? window.pageCalendarTasks[dateStr] : [];
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        
        let bdays = [];
        if (typeof getBirthdaysForDate === 'function') {
             bdays = getBirthdaysForDate(new Date(year, month, day));
        }

        let allItems = [];
        if (bdays.length > 0) bdays.forEach(b => allItems.push({ type: 'aniversario', title: `🎉 ${b.name}`, isBday: true }));
        if (hasTasks.length > 0) hasTasks.forEach(t => allItems.push(t));

        let barsHtml = '';
        let dotsHtml = '';

        if (allItems.length > 0) {
            const barsContent = allItems.map(t => {
                return `<div class="task-bar ${t.type}">${t.title}</div>`;
            }).join('');

            const maxVisibleExpanded = 2; 
            const extraCount = allItems.length - maxVisibleExpanded;
            
            const moreLabel = extraCount > 0 
                ? `<div class="task-more-label">Clique para ver +${extraCount}</div>` 
                : '';

            barsHtml = `<div class="task-bars">${barsContent}${moreLabel}</div>`;
            dotsHtml = `<div class="task-dots">${allItems.slice(0,4).map(t => `<span class="task-dot ${t.type}"></span>`).join('')}</div>`;
        }

        let classes = `calendar-day ${isToday ? 'selected' : ''} ${allItems.length > 0 ? 'has-task' : ''}`;
        html += `<div class="${classes}" onclick="showPageDayTasks('${dateStr}')">
                    <span class="day-number">${day}</span>
                    ${dotsHtml}
                    ${barsHtml}
                 </div>`;
    }
    daysElement.innerHTML = html;
}

function changePageMonth(dir) {
    if (!window.pageCalendarDate) window.pageCalendarDate = new Date();
    window.pageCalendarDate.setMonth(window.pageCalendarDate.getMonth() + dir);
    renderPageCalendar(dir); 
}

function showPageDayTasks(dateStr) {
    const tasks = window.pageCalendarTasks && window.pageCalendarTasks[dateStr] ? window.pageCalendarTasks[dateStr] : [];
    let bdays = [];
    if (typeof getBirthdaysForDate === 'function') {
        const parts = dateStr.split('-');
        bdays = getBirthdaysForDate(new Date(parts[0], parts[1]-1, parts[2]));
    }

    if (tasks.length === 0 && bdays.length === 0) {
        if (typeof openAddTaskModal === 'function') openAddTaskModal(dateStr, false);
        return;
    }
    
    const modalBody = document.getElementById('dayTasksModalBody');
    const modalTitle = document.getElementById('dayTasksModalTitle');
    
    if (!modalBody) return;
    
    const dateObj = new Date(dateStr + 'T12:00:00');
    const datePretty = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    if(modalTitle) modalTitle.textContent = datePretty;
    
    let content = '';

    if (bdays.length > 0) {
        content += bdays.map(b => `
            <div class="alert alert-info py-2 mb-3 border-0 shadow-sm d-flex align-items-center" style="background: rgba(13, 202, 240, 0.2); color: #0dcaf0;">
                <i class="bi bi-gift-fill me-3 fs-4"></i>
                <div><strong class="d-block">Aniversário!</strong><span class="small">${b.name}</span></div>
            </div>`).join('');
    }
    
    if (tasks.length > 0) {
        content += `<div class="d-flex flex-column gap-3">`;
        content += tasks.map(t => {
            const types = { 'prova': 'danger', 'trabalho': 'success', 'atividade': 'warning' };
            const color = types[t.type] || 'secondary';
            const isOwner = window.auth.currentUser && window.auth.currentUser.uid === t.userId;
            const isAdmin = window.isAdmin && window.isAdmin();

            let actions = '';
            if (isOwner || isAdmin) {
                actions = `
                    <div class="mt-2 pt-2 border-top border-secondary d-flex justify-content-end gap-2">
                        <button class="btn btn-sm btn-outline-light border-0" onclick="openEditTaskModal('${t.id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTask('${t.id}')"><i class="bi bi-trash"></i></button>
                    </div>`;
            }

            let attachmentsHtml = '';
            const atts = t.attachments || [];
            if(t.attachmentUrl && !atts.length) atts.push({url: t.attachmentUrl, type: t.attachmentType});

            if (atts.length > 0) {
                attachmentsHtml = '<div class="d-flex flex-wrap gap-2 mt-2">';
                atts.forEach(att => {
                    let icon = 'bi-link-45deg'; let btnClass = 'btn-outline-light';
                    if (att.type === 'drive') { icon = 'bi-google'; btnClass = 'btn-outline-success'; }
                    else if (att.type === 'youtube') { icon = 'bi-youtube'; btnClass = 'btn-outline-danger'; }
                    attachmentsHtml += `<a href="${att.url}" target="_blank" class="btn btn-sm ${btnClass} rounded-pill py-1 px-3"><i class="bi ${icon}"></i></a>`;
                });
                attachmentsHtml += '</div>';
            }

            return `
            <div class="p-3 rounded border border-secondary" style="background: rgba(255,255,255,0.05); border-left: 4px solid var(--bs-${color}) !important;">
                <div class="d-flex justify-content-between mb-1"><span class="badge bg-${color}">${t.type.toUpperCase()}</span></div>
                <h6 class="fw-bold text-white mb-1">${t.title}</h6>
                <p class="text-muted small mb-0">${t.description || ''}</p>
                ${attachmentsHtml}
                ${actions}
            </div>`;
        }).join('');
        content += `</div>`;
    }
    
    content += `
        <div class="mt-4 pt-3 border-top border-secondary text-center">
            <button class="btn btn-orange rounded-pill w-100" onclick="openAddTaskModal('${dateStr}', true)">
                <i class="bi bi-plus-lg me-2"></i>Adicionar outra tarefa
            </button>
        </div>
    `;
    
    modalBody.innerHTML = content;
    new bootstrap.Modal(document.getElementById('dayTasksModal')).show();
}

async function checkUserBlocked(user) {
    if (window.isCheckingBlockedAccount) return false;
    window.isCheckingBlockedAccount = true;
    try {
        const doc = await window.db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().disabled) { sessionStorage.setItem('blockedUid', user.uid); window.location.href = 'blocked.html'; return true; }
    } catch(e) {}
    window.isCheckingBlockedAccount = false;
    return false;
}

window.toggleSidebar = toggleSidebar;
window.navigateToPage = navigateToPage;
window.changePageMonth = changePageMonth;
window.showPageDayTasks = showPageDayTasks;
window.logout = function() { firebase.auth().signOut().then(() => window.location.href='login.html'); };

// ========================================
// SISTEMA DE NOTIFICAÇÕES (Lógica "Lido por Mim")
// ========================================
window.notificationSystem = {
    initialized: false,
    unsubscribe: null,
    cacheSnapshot: null,

    init: function() {
        if (this.initialized || !window.db || !firebase.auth().currentUser) return;
        this.initialized = true;

        const user = firebase.auth().currentUser;
        
        this.unsubscribe = window.db.collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot(snapshot => {
                this.cacheSnapshot = snapshot;
                this.renderList(snapshot, user.uid);
            });
    },

    renderListFromCache: function() {
        const user = firebase.auth().currentUser;
        if(this.cacheSnapshot && user) {
            this.renderList(this.cacheSnapshot, user.uid);
        }
    },

    renderList: function(snapshot, userId) {
        const listEl = document.getElementById('notificationsList'); 
        const badgeEl = document.getElementById('bottomNavBadge');
        
        if (!snapshot || snapshot.empty) {
            if(listEl) listEl.innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-bell-slash fs-1"></i><p class="mt-2">Nenhuma notificação nova.</p></div>';
            if(badgeEl) badgeEl.style.display = 'none';
            return;
        }

        let unreadCount = 0;
        let html = '';

        snapshot.forEach(doc => {
            const n = doc.data();
            const isRead = n.readBy && n.readBy.includes(userId);

            if (!isRead) {
                unreadCount++;
                
                let dateStr = '';
                if (n.createdAt && n.createdAt.toDate) {
                    dateStr = n.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
                }

                let icon = 'bi-info-circle';
                let color = 'primary';
                if (n.type === 'prova') { icon = 'bi-exclamation-triangle'; color = 'danger'; }
                else if (n.type === 'trabalho') { icon = 'bi-journal-text'; color = 'success'; }
                else if (n.type === 'aviso') { icon = 'bi-megaphone'; color = 'warning'; }

                html += `
                <div class="card mb-3 border-0 shadow-sm" style="background: rgba(255,255,255,0.05);">
                    <div class="card-body d-flex align-items-start gap-3">
                        <div class="rounded-circle bg-${color} bg-opacity-10 p-2 text-${color}">
                            <i class="bi ${icon} fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-1 fw-bold text-white">${n.title}</h6>
                            <p class="mb-2 text-muted small">${n.body || n.message || ''}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span style="font-size: 0.7rem; color: #666;">${dateStr}</span>
                                <button class="btn btn-sm btn-outline-light py-0 px-2" style="font-size: 0.7rem;" onclick="window.notificationSystem.markAsRead('${doc.id}')">
                                    Marcar como lida
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        });

        if (listEl) {
            if (unreadCount === 0) {
                listEl.innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-check-circle fs-1"></i><p class="mt-2">Tudo lido por aqui!</p></div>';
            } else {
                listEl.innerHTML = html;
            }
        }

        if (badgeEl) {
            if (unreadCount > 0) {
                badgeEl.style.display = 'flex';
                badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                badgeEl.style.display = 'none';
            }
        }
    },

    markAsRead: async function(docId) {
        const user = firebase.auth().currentUser;
        if (!user) return;
        try {
            await window.db.collection('notifications').doc(docId).update({
                readBy: firebase.firestore.FieldValue.arrayUnion(user.uid)
            });
        } catch (error) {
            console.error("Erro ao marcar como lida:", error);
        }
    },

    markAllAsRead: async function() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const snapshot = await window.db.collection('notifications').get();
        const batch = window.db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const n = doc.data();
            if (!n.readBy || !n.readBy.includes(user.uid)) {
                const ref = window.db.collection('notifications').doc(doc.id);
                batch.update(ref, { 
                    readBy: firebase.firestore.FieldValue.arrayUnion(user.uid) 
                });
                count++;
            }
        });

        if (count > 0) await batch.commit();
    }
};

// ========================================
// SISTEMA DE NOTÍCIAS (CCR: VETERINÁRIA & EDITAIS) - VERSÃO SMART
// ========================================
window.loadUfsmNews = function() {
    const container = document.getElementById('ufsmNewsCarousel');
    if (!container) return;
    if (container.getAttribute('data-loaded') === 'true') return;

    const rssUrl = 'https://www.ufsm.br/unidades-universitarias/ccr/feed';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    console.log('Filtrando notícias (Smart Filter)...');

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error('Erro na API');
            return response.json();
        })
        .then(data => {
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                
                // 1. FILTRO DE CONTEÚDO (O que entra no carrossel?)
                const filteredItems = data.items.filter(item => {
                    const text = (item.title + ' ' + item.description).toLowerCase();
                    
                    // Palavras que queremos
                    const isVet = text.includes('veterinária') || text.includes('veterinário') || text.includes('mv');
                    const isEdital = text.includes('edital') || text.includes('seleção') || text.includes('resultado') || text.includes('bolsa') || text.includes('retificação');
                    
                    return isVet || isEdital;
                });

                const itemsToShow = filteredItems.length > 0 ? filteredItems : data.items.slice(0, 5);
                const isFallback = filteredItems.length === 0;

                let html = '';
                
                itemsToShow.forEach(item => {
                    // Imagem
                    let imgUrl = 'src/img/logo-silhueta.png'; 
                    if (item.enclosure && item.enclosure.link) imgUrl = item.enclosure.link;
                    else if (item.thumbnail) imgUrl = item.thumbnail;
                    else if (item.content) {
                        const imgMatch = item.content.match(/src="([^"]+)"/);
                        if (imgMatch && imgMatch[1]) imgUrl = imgMatch[1];
                    }

                    // --- LÓGICA DE ETIQUETA INTELIGENTE ---
                    const titleLower = item.title.toLowerCase();
                    
                    // Palavras que indicam Edital
                    const hasEditalKeyword = titleLower.includes('edital') || titleLower.includes('seleção') || titleLower.includes('resultado') || titleLower.includes('bolsa');
                    
                    // PALAVRAS PROIBIDAS (Blacklist)
                    const isBlacklisted = titleLower.includes('incra') || titleLower.includes('famílias') || titleLower.includes('reforma agrária') || titleLower.includes('seleção brasileira');

                    // Só marca como Edital se tiver a keyword E NÃO for proibido
                    const isSmartEdital = hasEditalKeyword && !isBlacklisted;
                    
                    let labelColor = 'var(--orange-primary)'; 
                    let labelText = '';
                    
                    try {
                        const dateObj = new Date(item.pubDate.replace(/-/g, '/'));
                        labelText = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'});
                    } catch(e) { labelText = 'NOVO'; }

                    if (isSmartEdital) {
                        labelColor = '#2ecc71'; // Verde
                        labelText = `<i class="bi bi-file-earmark-text me-1"></i>EDITAL • ${labelText}`;
                    }

                    html += `
                    <a href="${item.link}" target="_blank" class="news-card">
                        <img src="${imgUrl}" class="news-card-img" onerror="this.src='src/img/logo-silhueta.png'" loading="lazy">
                        <div class="news-card-overlay">
                            <span class="news-date" style="color: ${labelColor};">${labelText}</span>
                            <h6 class="news-title">${item.title}</h6>
                        </div>
                    </a>`;
                });
                
                if (isFallback) {
                    html += `<div class="d-flex align-items-center justify-content-center" style="min-width: 200px;">
                                <span class="text-muted small text-center px-2">Mostrando notícias gerais do CCR.</span>
                             </div>`;
                }
                
                container.innerHTML = html;
                container.setAttribute('data-loaded', 'true');
            } else {
                throw new Error('Lista vazia');
            }
        })
        .catch(err => {
            console.error('Erro:', err);
            container.innerHTML = `<div class="text-muted small w-100 text-center py-3">Não foi possível carregar as notícias.</div>`;
        });
};

// ========================================
// SISTEMA DE HORÁRIOS ACADÊMICOS
// ========================================

const VET_CURRICULUM = [
    { sem: 1, subjects: ["Anatomia dos Animais Domésticos A", "Bioquímica Geral", "Ecologia Veterinária", "Estatística Veterinária", "Genética Veterinária", "Histologia e Embriologia A", "Iniciação à Veterinária A", "Metodologia da Pesquisa A"] },
    { sem: 2, subjects: ["Anatomia dos Animais Domésticos B", "Bioclimatologia", "Bioquímica Especial Veterinária", "Biossegurança Aplicada", "Fisiologia Veterinária A", "Histologia e Embriologia B", "Microbiologia Geral", "Sociologia Rural"] },
    { sem: 3, subjects: ["Anatomia dos Animais Domésticos C", "Bem Estar Animal", "Bromatologia Animal", "Fisiologia Veterinária B", "Imunologia Geral", "Parasitologia Veterinária"] },
    { sem: 4, subjects: ["Anatomia Topográfica", "Equideocultura", "Farmacologia Geral", "Forragicultura", "Microbiologia Veterinária", "Nutrição Animal", "Ovinocultura", "Patologia Geral Veterinária"] },
    { sem: 5, subjects: ["Avicultura A", "Economia e Administração Rural", "Farmacologia Aplicada", "Legislação Agrária", "Patologia Clínica Veterinária", "Patologia Especial", "Semiologia Clínica Veterinária A", "Suinocultura"] },
    { sem: 6, subjects: ["Anestesiologia Veterinária A", "Bovinocultura de Corte", "Bovinocultura de Leite", "Diagnóstico por Imagem", "Melhoramento Animal", "Semiologia Clínica Veterinária B", "Técnica Cirúrgica A"] },
    { sem: 7, subjects: ["Andrologia Veterinária A", "Doenças das Aves", "Doenças Fúngicas", "Epidemiologia Geral", "Extensão Rural", "Patologia Cirúrgica A", "Tecnologia de Produtos Animal", "Terapêutica Veterinária A", "Toxicologia A"] },
    { sem: 8, subjects: ["Clínica Cirúrgica Veterinária", "Clínica de Pequenos Animais A", "Doenças Infecto-Contagiosas", "Doenças Parasitárias", "Indústria e Inspeção de Carnes", "Saúde Pública Veterinária"] },
    { sem: 9, subjects: ["Clínica de Pequenos Animais B", "Ginecologia Veterinária", "Medicina de Animais Selvagens A", "Medicina de Equinos", "Medicina de Ruminantes A", "Medicina de Suínos", "Obstetrícia Veterinária", "Ortopedia e Traumatologia"] },
    { sem: 10, subjects: ["Estágio Supervisionado"] }
];

let currentUserSchedule = {}; // Horário
let currentUserRooms = {}; // Salas
let selectedSubjectsTemp = []; 
let activeCell = null;

// Inicializa ao carregar a página
function initScheduleSystem() {
    if (!window.currentUserData || !window.db || !firebase.auth().currentUser) return;
    const uid = firebase.auth().currentUser.uid;

    // Carrega horário e salas
    window.db.collection('users').doc(uid).collection('schedule').doc('current').get()
    .then(doc => {
        if (doc.exists) {
            currentUserSchedule = doc.data();
            // Carrega salas
            window.db.collection('users').doc(uid).collection('schedule').doc('rooms').get()
            .then(roomDoc => {
                if(roomDoc.exists) currentUserRooms = roomDoc.data();
                
                document.getElementById('scheduleEmptyState').style.display = 'none';
                
                // 1. Mostra a caixa (Torna visível)
                const filledState = document.getElementById('scheduleFilledState');
                filledState.style.display = 'block';
                
                // 2. Renderiza o conteúdo
                renderHomeSchedule();
                renderClassroomsSlide();

                // 3. CORREÇÃO DO SWIPE TRAVADO:
                // Inicializa o carrossel manualmente AGORA que ele está visível.
                const carouselEl = document.getElementById('scheduleCarousel');
                if (carouselEl) {
                    // Pequeno delay para garantir que o navegador renderizou o "display: block"
                    setTimeout(() => {
                        new bootstrap.Carousel(carouselEl, {
                            interval: false, // Não roda sozinho
                            touch: true      // Garante o swipe
                        });
                    }, 50);
                }
            });
        } else {
            // Se não tiver horário, garante estado vazio
            document.getElementById('scheduleEmptyState').style.display = 'block';
            document.getElementById('scheduleFilledState').style.display = 'none';
        }
    })
    .catch(err => console.log("Sem horário salvo ainda."));
}

// ========================================
// FUNÇÃO DE RESET TOTAL
// ========================================
window.resetUserSchedule = function() {
    if (!confirm("⚠️ TEM CERTEZA?\n\nIsso apagará todo o seu horário e as salas configuradas. Essa ação não pode ser desfeita.")) {
        return;
    }

    if (!window.db || !firebase.auth().currentUser) return;
    const uid = firebase.auth().currentUser.uid;
    const batch = window.db.batch();

    // Referências para apagar
    const scheduleRef = window.db.collection('users').doc(uid).collection('schedule').doc('current');
    const roomsRef = window.db.collection('users').doc(uid).collection('schedule').doc('rooms');

    // Adiciona ao lote de exclusão
    batch.delete(scheduleRef);
    batch.delete(roomsRef);

    // Executa
    batch.commit().then(() => {
        // 1. Limpa variáveis locais
        currentUserSchedule = {};
        currentUserRooms = {};
        selectedSubjectsTemp = [];
        activeCell = null;

        // 2. Desmarca todos os checkboxes visualmente
        document.querySelectorAll('.subject-checkbox').forEach(cb => cb.checked = false);

        // 3. Reseta o Modal para o Passo 1
        changeScheduleStep(1);

        // 4. Fecha o modal
        const modalEl = document.getElementById('scheduleConfigModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // 5. Atualiza a Home para o estado "Vazio"
        document.getElementById('scheduleEmptyState').style.display = 'block';
        document.getElementById('scheduleFilledState').style.display = 'none';

        alert("Seu horário foi resetado com sucesso!");
    })
    .catch(err => {
        console.error(err);
        alert("Erro ao tentar resetar.");
    });
};

// ========================================
// FUNÇÃO AUXILIAR: FORMATA O NOME DA MATÉRIA (INTELIGENTE)
// ========================================
function formatSubjectName(fullName) {
    if (!fullName) return { short: '', long: '' };

    const ignore = ['de', 'da', 'do', 'dos', 'das', 'e', 'a', 'o', 'em', 'por', 'para', 'com', 'à', 'á'];

    const customAbbr = {
        'diagnóstico': 'Diag', 'diagnostico': 'Diag', 'imagem': 'Img',
        'veterinária': 'Vet', 'veterinaria': 'Vet', 'cirúrgica': 'Cir', 'cirurgica': 'Cir',
        'patologia': 'Pat', 'fisiologia': 'Fisio', 'anatomia': 'Anat',
        'tecnologia': 'Tec', 'produção': 'Prod', 'inspeção': 'Insp',
        'clínica': 'Clin', 'clinica': 'Clin', 'bovinocultura': 'Bov',
        'suinocultura': 'Suíno', 'avicultura': 'Aves', 'equideocultura': 'Equi',
        'ovinocultura': 'Ovinos', 'parasitologia': 'Parasito', 'microbiologia': 'Micro',
        'farmacologia': 'Farma', 'epidemiologia': 'Epidem', 'toxicologia': 'Toxic',
        'estatística': 'Estat', 'bioquímica': 'Bioquim', 'histologia': 'Histo',
        'embriologia': 'Embrio', 'sociologia': 'Socio', 'imunologia': 'Imuno',
        'zootecnia': 'Zoot', 'melhoramento': 'Melhor', 'semiologia': 'Semio',
        'anestesiologia': 'Anest', 'obstetrícia': 'Obst', 'andrologia': 'Andro',
        'ginecologia': 'Gineco', 'ortopedia': 'Ortop', 'deontologia': 'Deonto',
        'zoonoses': 'Zoon', 'estágio': 'Estágio', 'trabalho': 'TCC',
        'medicina': 'Med', 'domésticos': 'Dom'
    };

    const words = fullName.split(' ').filter(w => w.length > 0);
    const meaningfulWords = words.filter(w => !ignore.includes(w.toLowerCase()));

    if (meaningfulWords.length === 0) return { short: fullName.substring(0,3), long: fullName };

    let w1 = meaningfulWords[0];
    let shortName = customAbbr[w1.toLowerCase()] || w1.substring(0, 3);

    if (meaningfulWords.length > 1) {
        let w2 = meaningfulWords[1];
        let short2 = '';
        if (customAbbr[w2.toLowerCase()]) {
            short2 = customAbbr[w2.toLowerCase()];
        } else {
            short2 = w2.substring(0, 1).toUpperCase();
        }
        shortName += ". " + short2;
    }

    return { short: shortName, long: fullName };
}

window.openScheduleConfig = function() {
    renderSemesterAccordion();
    changeScheduleStep(1);
    new bootstrap.Modal(document.getElementById('scheduleConfigModal')).show();
};

function renderSemesterAccordion() {
    const container = document.getElementById('semestersAccordion');
    let html = '';
    VET_CURRICULUM.forEach(sem => {
        html += `
        <div class="accordion-item">
            <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSem${sem.sem}">
                    ${sem.sem}º Semestre
                </button>
            </h2>
            <div id="collapseSem${sem.sem}" class="accordion-collapse collapse" data-bs-parent="#semestersAccordion">
                <div class="accordion-body">
                    ${sem.subjects.map(sub => `
                        <div class="form-check">
                            <input class="form-check-input subject-checkbox" type="checkbox" value="${sub}" id="chk_${sub.replace(/\s/g, '')}" onchange="updateSelectedSubjects(this)">
                            <label class="form-check-label" for="chk_${sub.replace(/\s/g, '')}">${sub}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

window.updateSelectedSubjects = function(checkbox) {
    if (checkbox.checked) {
        if (!selectedSubjectsTemp.includes(checkbox.value)) selectedSubjectsTemp.push(checkbox.value);
    } else {
        selectedSubjectsTemp = selectedSubjectsTemp.filter(s => s !== checkbox.value);
    }
};

window.changeScheduleStep = function(step) {
    if (step === 1) {
        document.getElementById('stepSelectSubjects').style.display = 'block';
        document.getElementById('stepBuildGrid').style.display = 'none';
        document.getElementById('btnBackStep').style.display = 'none';
        document.getElementById('btnNextStep').style.display = 'block';
        document.getElementById('btnSaveSchedule').style.display = 'none';
    } else {
        if (selectedSubjectsTemp.length === 0) {
            alert('Selecione pelo menos uma matéria.');
            return;
        }
        document.getElementById('stepSelectSubjects').style.display = 'none';
        document.getElementById('stepBuildGrid').style.display = 'block';
        document.getElementById('btnBackStep').style.display = 'block';
        document.getElementById('btnNextStep').style.display = 'none';
        document.getElementById('btnSaveSchedule').style.display = 'block';
        renderGridEditor();
    }
};

window.renderGridEditor = function() {
    const isMorning = document.getElementById('shiftMorning').checked;
    const times = isMorning 
        ? ['07:30', '08:30', '09:30', '10:30', '11:30', '12:30'] 
        : ['13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'];
    
    const days = ['seg', 'ter', 'qua', 'qui', 'sex'];
    const tbody = document.getElementById('gridEditorBody');
    let html = '';

    times.forEach(time => {
        html += `<tr>`;
        html += `<td class="fw-bold text-orange">${time}</td>`;
        days.forEach(day => {
            const cellKey = `${day}_${time}`;
            const subject = currentUserSchedule[cellKey] || '';
            const filledClass = subject ? 'grid-filled' : '';
            const names = formatSubjectName(subject);
            
            html += `<td class="${filledClass}" onclick="openPickSubjectModal('${day}', '${time}')" id="cell_${cellKey}" title="${names.long}">
                        <span class="d-md-none">${names.short}</span>
                        <span class="d-none d-md-block" style="font-size: 0.7rem;">${names.long}</span>
                     </td>`;
        });
        html += `</tr>`;
    });
    tbody.innerHTML = html;
};

window.openPickSubjectModal = function(day, time) {
    activeCell = { day, time };
    const list = document.getElementById('pickSubjectList');
    let html = selectedSubjectsTemp.map(sub => `
        <button class="btn btn-outline-light w-100 mb-2 text-start" onclick="assignSubjectToCell('${sub}')">
            ${sub}
        </button>
    `).join('');
    list.innerHTML = html;
    new bootstrap.Modal(document.getElementById('pickSubjectModal')).show();
};

window.assignSubjectToCell = function(subject) {
    if (!activeCell) return;
    const key = `${activeCell.day}_${activeCell.time}`;
    currentUserSchedule[key] = subject;
    renderGridEditor();
    bootstrap.Modal.getInstance(document.getElementById('pickSubjectModal')).hide();
};

window.clearSelectedCell = function() {
    if (!activeCell) return;
    const key = `${activeCell.day}_${activeCell.time}`;
    delete currentUserSchedule[key];
    renderGridEditor();
    bootstrap.Modal.getInstance(document.getElementById('pickSubjectModal')).hide();
};

window.saveUserSchedule = function() {
    if (!window.db) return;
    const uid = firebase.auth().currentUser.uid;
    window.db.collection('users').doc(uid).collection('schedule').doc('current').set(currentUserSchedule)
    .then(() => {
        alert('Horário salvo com sucesso!');
        bootstrap.Modal.getInstance(document.getElementById('scheduleConfigModal')).hide();
        document.getElementById('scheduleEmptyState').style.display = 'none';
        document.getElementById('scheduleFilledState').style.display = 'block';
        renderHomeSchedule();
        renderClassroomsSlide(); // Gera os inputs de sala
    })
    .catch(err => {
        console.error(err);
        alert('Erro ao salvar horário.');
    });
};

window.renderHomeSchedule = function() {
    const isDaily = document.getElementById('viewDaily').checked;
    const container = document.getElementById('homeScheduleContainer');
    
    if (isDaily) {
        const daysMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const todayKey = daysMap[new Date().getDay()];
        if (todayKey === 'dom' || todayKey === 'sab') {
            container.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-emoji-sunglasses fs-1"></i><p>Bom descanso! Sem aulas hoje.</p></div>';
            return;
        }
        const todayClasses = [];
        Object.keys(currentUserSchedule).forEach(key => {
            const [day, time] = key.split('_');
            if (day === todayKey) todayClasses.push({ time, subject: currentUserSchedule[key] });
        });
        todayClasses.sort((a, b) => a.time.localeCompare(b.time));

        if (todayClasses.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-muted"><p>Nenhuma aula hoje.</p></div>';
            return;
        }
        let html = '<div class="d-flex flex-column">';
        todayClasses.forEach(c => {
            html += `<div class="daily-schedule-item"><div class="daily-time">${c.time}</div><div class="daily-subject text-white">${c.subject}</div></div>`;
        });
        html += '</div>';
        container.innerHTML = html;

    } else {
        let html = `<div class="table-responsive"><table class="table table-dark table-bordered table-sm text-center align-middle" style="font-size: 0.65rem;">
            <thead><tr><th style="width:10%">H</th><th style="width:18%">Seg</th><th style="width:18%">Ter</th><th style="width:18%">Qua</th><th style="width:18%">Qui</th><th style="width:18%">Sex</th></tr></thead><tbody>`;
        
        const allTimes = ['07:30', '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'];
        const days = ['seg', 'ter', 'qua', 'qui', 'sex'];

        const activeTimes = allTimes.filter(time => days.some(day => currentUserSchedule[`${day}_${time}`]));
        if (activeTimes.length === 0) { container.innerHTML = '<div class="text-center py-4 text-muted"><p>Semana livre!</p></div>'; return; }

        activeTimes.forEach(time => {
            let rowHtml = `<tr><td class="text-orange fw-bold">${time}</td>`;
            days.forEach(day => {
                const sub = currentUserSchedule[`${day}_${time}`];
                if (sub) {
                    const names = formatSubjectName(sub);
                    rowHtml += `<td class="bg-success bg-opacity-25 p-1" title="${names.long}">
                                    <span class="d-md-none fw-bold">${names.short}</span>
                                    <span class="d-none d-md-block text-wrap" style="line-height:1.1;">${names.long}</span>
                                </td>`;
                } else {
                    rowHtml += `<td></td>`;
                }
            });
            rowHtml += `</tr>`;
            html += rowHtml;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }
};

// ========================================
// SISTEMA DE SALAS DE AULA (SLIDE 2) - ATUALIZADO
// ========================================
window.renderClassroomsSlide = function() {
    const container = document.getElementById('classroomsListContainer');
    if (!container) return;

    const subjects = new Set(Object.values(currentUserSchedule));
    
    if (subjects.size === 0) {
        container.innerHTML = '<div class="text-center text-muted small mt-4">Nenhuma matéria configurada.</div>';
        return;
    }

    let html = '';
    subjects.forEach(sub => {
        // Formata nome (Curto e Longo)
        const names = formatSubjectName(sub);
        const savedRoom = currentUserRooms[sub] || '';

        html += `
        <div class="classroom-input-group d-flex align-items-center gap-3">
            
            <div class="classroom-label text-truncate flex-shrink-0" style="max-width: 50%;">
                
                <span class="d-md-none fw-bold text-orange" style="font-size: 1rem;">
                    ${names.short}
                </span>

                <span class="d-none d-md-block" title="${names.long}">
                    ${names.long}
                </span>

            </div>

            <input type="text" class="classroom-input flex-grow-1" 
                   placeholder="Sala / Prédio..." 
                   value="${savedRoom}" 
                   onchange="updateRoomValue('${sub}', this.value)">
        </div>`;
    });

    container.innerHTML = html;
};

window.updateRoomValue = function(subjectName, roomValue) {
    currentUserRooms[subjectName] = roomValue;
};

window.saveClassrooms = function() {
    if (!window.db) return;
    const uid = firebase.auth().currentUser.uid;
    const btn = document.querySelector('#scheduleCarousel .btn-outline-success');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';

    window.db.collection('users').doc(uid).collection('schedule').doc('rooms').set(currentUserRooms)
    .then(() => {
        setTimeout(() => {
            btn.innerHTML = '<i class="bi bi-check2"></i> Salvo!';
            btn.classList.replace('btn-outline-success', 'btn-success');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.replace('btn-success', 'btn-outline-success');
            }, 2000);
        }, 500);
    })
    .catch(err => { console.error(err); btn.innerHTML = 'Erro'; });
};
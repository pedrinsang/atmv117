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
            if (typeof loadBirthdaysIntoCache === 'function') loadBirthdaysIntoCache();
            
            // Inicializa sistema de notificações
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
            
            const nameEl = document.getElementById('userNameTitle');
            if (nameEl) nameEl.textContent = (displayName || 'Veterinário').split(' ')[0];
            
            const navNameEl = document.getElementById('navbarUserName');
            if (navNameEl) navNameEl.textContent = displayName || 'Usuário';

            const emailEl = document.getElementById('userEmail');
            if(emailEl) emailEl.textContent = user.email;

            if (typeof isAdmin === 'function' && isAdmin()) document.getElementById('adminPanelOption').style.display = 'block';
            if (typeof checkUserBlocked === 'function') { if(await checkUserBlocked(user)) return; }
            
            if (typeof loadTasks === 'function') loadTasks();
            if (typeof initializeCalendar === 'function') initializeCalendar();
            
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

function navigateToPage(pageId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(pageId + 'Page');
    if (target) target.classList.add('active');
    
    // --- LÓGICA DE PADDING DO CALENDÁRIO ---
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        if (pageId === 'calendario') {
            mainContent.classList.add('calendar-mode');
            
            // RESET PARA O DIA ATUAL: Sempre que entrar no calendário, volta para hoje
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

    if (pageId === 'calendario') {
        setTimeout(() => { 
            if(typeof initializeCalendarPage === 'function') {
                if (document.getElementById('pageCalendarDays')) {
                    renderPageCalendar(); // Redesenha com a data nova (hoje)
                } else {
                    initializeCalendarPage(); 
                }
            } 
        }, 100);
    }
    
    if (pageId === 'aniversarios') setTimeout(() => { if(window.loadBirthdays) window.loadBirthdays(); }, 100);
    
    if (pageId === 'notificacoes') {
        const badge = document.getElementById('bottomNavBadge');
        if(badge) badge.style.display = 'none';
        // Renderiza notificações ao entrar na página
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

            // Limite visível no CSS será controlado via nth-type
            // Calculamos o excesso baseado no limite de 2 (3º em diante escondido no hover)
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
    cacheSnapshot: null, // Cache para guardar o snapshot

    init: function() {
        if (this.initialized || !window.db || !firebase.auth().currentUser) return;
        this.initialized = true;

        const user = firebase.auth().currentUser;
        
        // Escuta as notificações em tempo real
        this.unsubscribe = window.db.collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot(snapshot => {
                this.cacheSnapshot = snapshot; // Salva no cache
                this.renderList(snapshot, user.uid);
            });
    },

    // Função auxiliar para renderizar se já tiver cache (útil ao navegar entre páginas)
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
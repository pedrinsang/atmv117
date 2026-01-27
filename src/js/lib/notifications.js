// ========================================
// SISTEMA DE NOTIFICAÇÕES (FINAL E COMPLETO)
// ========================================

window.notificationSystem = {
    lastViewed: 0,
    serverItems: [], // Vindos do Banco (Avisos, Criações, Exclusões)
    localItems: [],  // Calculados (Lembretes, Aniversários)
    allItems: [],    // A mistura dos dois
    unsubscribeList: [],

    init: function() {
        if (this._initialized) return;
        this._initialized = true;

        const stored = localStorage.getItem('notificationsLastViewed');
        this.lastViewed = stored ? parseInt(stored) : 0;
        
        this.startListener();
        
        // Recalcula itens locais a cada 60 segundos (para virar o dia se precisar)
        setInterval(() => this.generateLocalNotifications(), 60000);
    },

    startListener: function() {
        if (!window.db) { setTimeout(() => this.startListener(), 1000); return; }

        // Limpa ouvintes anteriores
        this.unsubscribeList.forEach(unsub => unsub());
        this.unsubscribeList = [];

        // 1. Escuta a coleção de NOTIFICAÇÕES GERAIS (Onde gravamos os eventos)
        this.unsubscribeList.push(
            window.db.collection('notifications')
                .orderBy('createdAt', 'desc')
                .limit(30)
                .onSnapshot(snapshot => {
                    this.serverItems = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        let createdAt = Date.now();
                        if (data.createdAt && data.createdAt.toMillis) createdAt = data.createdAt.toMillis();
                        else if (data.createdAt) createdAt = new Date(data.createdAt).getTime();
                        
                        this.serverItems.push({
                            id: doc.id,
                            type: data.type || 'aviso', 
                            title: data.title,
                            desc: data.body || data.description || '',
                            createdAt: createdAt
                        });
                    });
                    this.combineAndRender();
                })
        );
        
        // Gera os lembretes locais pela primeira vez
        this.generateLocalNotifications();
    },

    // FUNÇÃO QUE ESTAVA FALTANDO: Gera lembretes baseados em dados locais
    generateLocalNotifications: function() {
        this.localItems = [];
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        // Strings de data YYYY-MM-DD
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 1. TAREFAS (Hoje e Amanhã)
        if (window.pageCalendarTasks) {
            // Tarefas de Hoje
            if (window.pageCalendarTasks[todayStr]) {
                window.pageCalendarTasks[todayStr].forEach(t => {
                    this.localItems.push({
                        id: 'today-' + t.id,
                        type: 'alert-today',
                        title: '📅 É Hoje: ' + t.title,
                        desc: 'Esta tarefa vence hoje. Fique atento!',
                        createdAt: new Date().setHours(8, 0, 0, 0), // Finge que chegou às 08:00
                        sortWeight: 2
                    });
                });
            }
            // Tarefas de Amanhã
            if (window.pageCalendarTasks[tomorrowStr]) {
                window.pageCalendarTasks[tomorrowStr].forEach(t => {
                    this.localItems.push({
                        id: 'tom-' + t.id,
                        type: 'reminder',
                        title: '⏰ Amanhã: ' + t.title,
                        desc: 'Prepare-se, vence amanhã.',
                        createdAt: new Date().setHours(9, 0, 0, 0),
                        sortWeight: 1
                    });
                });
            }
        }

        // 2. ANIVERSÁRIOS (Hoje e Amanhã)
        if (window.birthdayCache && window.birthdayCache.length > 0) {
            const tDay = today.getDate(); const tMonth = today.getMonth() + 1;
            const tomDay = tomorrow.getDate(); const tomMonth = tomorrow.getMonth() + 1;

            window.birthdayCache.forEach(b => {
                const parts = b.date.split('-');
                const bMonth = parseInt(parts[1]);
                const bDay = parseInt(parts[2]);

                if (bMonth === tMonth && bDay === tDay) {
                    this.localItems.push({
                        id: 'bday-today-' + b.id,
                        type: 'bday-today',
                        title: '🎉 Parabéns ' + b.name + '!',
                        desc: 'Hoje é aniversário desse colega.',
                        createdAt: new Date().setHours(7, 0, 0, 0),
                        sortWeight: 3
                    });
                } else if (bMonth === tomMonth && bDay === tomDay) {
                    this.localItems.push({
                        id: 'bday-tom-' + b.id,
                        type: 'bday-soon',
                        title: '🎂 Niver Amanhã: ' + b.name,
                        desc: 'Não esqueça de parabenizar amanhã.',
                        createdAt: new Date().setHours(10, 0, 0, 0),
                        sortWeight: 1
                    });
                }
            });
        }

        this.combineAndRender();
    },

    combineAndRender: function() {
        // Junta tudo
        this.allItems = [...this.localItems, ...this.serverItems];

        // Ordena por data (mais recente primeiro)
        this.allItems.sort((a, b) => {
            if (Math.abs(a.createdAt - b.createdAt) < 60000 && a.sortWeight && b.sortWeight) {
                return b.sortWeight - a.sortWeight;
            }
            return b.createdAt - a.createdAt;
        });

        this.updateBadge();
        this.renderList();
    },

    updateBadge: function() {
        let count = 0;
        this.allItems.forEach(item => {
            if (item.createdAt > this.lastViewed) count++;
        });

        const badge = document.getElementById('bottomNavBadge');
        if (badge) {
            if (count > 0) {
                badge.style.display = 'flex';
                badge.textContent = count > 9 ? '9+' : count;
            } else {
                badge.style.display = 'none';
            }
        }
    },

    markAllAsRead: function() {
        this.lastViewed = Date.now();
        localStorage.setItem('notificationsLastViewed', this.lastViewed);
        const badge = document.getElementById('bottomNavBadge');
        if (badge) badge.style.display = 'none';
        this.renderList();
    },

    // Esta função é chamada pelo app.js ao abrir a página
    renderListFromCache: function() {
        this.generateLocalNotifications(); 
        this.markAllAsRead(); 
    },

    renderList: function() {
        const listDesktop = document.getElementById('notificationsList');
        const listMobile = document.getElementById('mobileNotificationsList');
        
        if (!listDesktop && !listMobile) return;

        const content = this.generateHTML();
        if (listDesktop) listDesktop.innerHTML = content;
        if (listMobile) listMobile.innerHTML = content;
    },

    generateHTML: function() {
        if (this.allItems.length === 0) {
            return `<div class="text-center text-muted py-5"><i class="bi bi-bell-slash fs-1 opacity-25"></i><p class="mt-3 small">Sem notificações.</p></div>`;
        }

        return this.allItems.map(item => {
            let icon = 'bi-info-circle'; let color = 'secondary';
            
            // Ícones
            if (item.type.includes('task')) { icon = 'bi-journal-check'; color = 'success'; }
            else if (item.type === 'aviso') { icon = 'bi-megaphone-fill'; color = 'info'; }
            else if (item.type.includes('alert')) { icon = 'bi-exclamation-diamond-fill'; color = 'orange'; }
            else if (item.type.includes('reminder')) { icon = 'bi-alarm-fill'; color = 'danger'; }
            else if (item.type.includes('bday')) { icon = 'bi-gift-fill'; color = 'primary'; }

            const isUnread = item.createdAt > this.lastViewed;
            const bgClass = isUnread ? 'bg-white bg-opacity-10 border-start border-4 border-orange' : 'bg-transparent border border-secondary border-opacity-25';
            
            const d = new Date(item.createdAt);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="card mb-2 ${bgClass} shadow-sm">
                <div class="card-body p-3 d-flex gap-3 align-items-start">
                    <div class="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0" 
                         style="width:40px;height:40px; background-color: var(--bs-${color}-bg-subtle, rgba(255,255,255,0.1)); color: var(--bs-${color}, white);">
                        <i class="bi ${icon} fs-5" style="${color === 'orange' ? 'color: var(--orange-primary);' : ''}"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="fw-bold text-white mb-1 text-truncate">${item.title}</h6>
                            ${isUnread ? '<span class="badge bg-orange tiny-badge ms-1">NOVO</span>' : ''}
                        </div>
                        <p class="text-gray-300 small mb-1 text-break" style="line-height: 1.3; opacity: 0.8;">${item.desc}</p>
                        <small class="text-muted d-block text-end" style="font-size:0.65rem">${dateStr} às ${timeStr}</small>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(window.notificationSystem) window.notificationSystem.init(); }, 2000);
});
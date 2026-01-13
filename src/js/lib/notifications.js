// ========================================
// SISTEMA DE NOTIFICAÇÕES INTELIGENTE
// ========================================

window.notificationSystem = {
    lastViewed: 0,
    unreadCount: 0,
    items: [],

    init: function() {
        const stored = localStorage.getItem('notificationsLastViewed');
        this.lastViewed = stored ? parseInt(stored) : 0;
        this.startListeners();
    },

    startListeners: function() {
        if (!window.db) { setTimeout(() => this.startListeners(), 1000); return; }

        // 1. Ouvir Tarefas
        window.db.collection('tasks').orderBy('createdAt', 'desc').limit(20)
            .onSnapshot(
                snap => this.processSnapshot(snap, 'task'),
                error => console.warn("Aviso: Permissão tarefas", error.code)
            );

        // 2. Ouvir Sugestões
        window.db.collection('complaints').orderBy('createdAt', 'desc').limit(20)
            .onSnapshot(
                snap => this.processSnapshot(snap, 'complaint'),
                error => console.warn("Aviso: Permissão sugestões", error.code)
            );
    },

    processSnapshot: function(snapshot, type) {
        if(snapshot.empty && this.items.length === 0) return;

        const currentBatch = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toMillis() : 0;
            currentBatch.push({
                id: doc.id,
                type: type,
                title: data.title || (type === 'complaint' ? 'Nova Sugestão' : 'Nova Tarefa'),
                date: data.date,
                createdAt: createdAt,
                desc: data.description || data.text
            });
        });

        this.mergeItems(currentBatch);
        this.checkTomorrowTasks();
        this.updateBadge(); // Atualiza número ao chegar dados
        this.renderList();
    },

    mergeItems: function(newItems) {
        const combined = [...newItems, ...this.items];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        this.items = unique.sort((a,b) => b.createdAt - a.createdAt);
    },

    checkTomorrowTasks: function() {
        if (!window.pageCalendarTasks) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tasksTomorrow = window.pageCalendarTasks[tomorrowStr];
        
        // Define data base como meia-noite de hoje para comparação
        const reminderTimestamp = new Date().setHours(0,0,0,0);

        if (tasksTomorrow && tasksTomorrow.length > 0) {
            tasksTomorrow.forEach(t => {
                this.items = this.items.filter(i => i.id !== 'remind-' + t.id);
                this.items.unshift({
                    id: 'remind-' + t.id,
                    type: 'reminder',
                    title: 'Lembrete: ' + t.title,
                    createdAt: reminderTimestamp,
                    desc: 'Esta tarefa é para amanhã!'
                });
            });
        }
        this.items.sort((a,b) => b.createdAt - a.createdAt);
    },

    updateBadge: function() {
        let count = 0;
        this.items.forEach(item => {
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
        // 1. Atualiza timestamp
        this.lastViewed = Date.now();
        localStorage.setItem('notificationsLastViewed', this.lastViewed);
        
        // 2. FORÇA VISUAL IMEDIATA: Esconde a bolinha na hora
        const badge = document.getElementById('bottomNavBadge');
        if(badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }

        // 3. Atualiza lista para remover destaques
        this.renderList();
    },

    renderList: function() {
        const list = document.getElementById('mobileNotificationsList');
        if (!list) return;

        if (this.items.length === 0) {
            list.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-bell-slash fs-1"></i><p class="mt-2">Sem notificações</p></div>';
            return;
        }

        let html = '';
        this.items.forEach(item => {
            let icon = 'bi-info-circle'; let color = 'primary';
            if (item.type === 'task') { icon = 'bi-journal-plus'; color = 'success'; } 
            else if (item.type === 'complaint') { icon = 'bi-chat-left-text'; color = 'warning'; } 
            else if (item.type === 'reminder') { icon = 'bi-alarm'; color = 'danger'; }

            const isUnread = item.createdAt > this.lastViewed;
            const bgClass = isUnread ? 'bg-white bg-opacity-10 border-orange' : 'bg-transparent border-secondary';
            
            html += `
            <div class="card mb-2 ${bgClass}" style="transition:0.3s">
                <div class="card-body p-3 d-flex gap-3 align-items-start">
                    <div class="bg-${color} bg-opacity-25 text-${color} rounded-circle p-2 d-flex align-items-center justify-content-center" style="width:40px;height:40px;min-width:40px;">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div>
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="fw-bold text-white mb-1">${item.title}</h6>
                            ${isUnread ? '<span class="badge bg-danger ms-2" style="font-size:0.5rem">NOVO</span>' : ''}
                        </div>
                        <p class="text-muted small mb-1">${item.desc || ''}</p>
                        <small class="text-secondary" style="font-size:0.7rem">
                            ${new Date(item.createdAt).toLocaleDateString('pt-BR')} às ${new Date(item.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </small>
                    </div>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.notificationSystem.init(), 1500);
});
// ========================================
// SISTEMA DE ANIVERSÁRIOS
// ========================================

// Cache Global para o Calendário
window.globalBirthdays = [];

// Função para carregar aniversários para uso global (Calendário)
async function loadBirthdaysIntoCache() {
    if (!window.db) return;
    try {
        const snapshot = await window.db.collection('birthdays').get();
        window.globalBirthdays = [];
        snapshot.forEach(doc => {
            window.globalBirthdays.push({ id: doc.id, ...doc.data() });
        });
        console.log('🎂 Aniversários carregados:', window.globalBirthdays.length);
        
        // Se a página de calendário estiver aberta, renderiza novamente
        if (document.getElementById('calendarioPage').classList.contains('active')) {
            if (typeof renderPageCalendar === 'function') renderPageCalendar();
        }
    } catch (e) {
        console.error('Erro ao cachear aniversários:', e);
    }
}

// Carrega todos os aniversários (Lista da Página)
async function loadBirthdays() {
    if (!window.db) return;
    try {
        const snapshot = await window.db.collection('birthdays').orderBy('month').orderBy('day').get();
        const container = document.getElementById('allBirthdays');
        if (!container) return;
        
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<div class="col-12 text-muted text-center py-3">Nenhum aniversário cadastrado.</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'col-6 col-md-4 col-lg-3';
            div.innerHTML = `
                <div class="card p-2 text-center h-100 position-relative">
                    <div class="fw-bold text-orange text-truncate">${escapeHtml(data.name)}</div>
                    <div class="small text-white">${data.day}/${data.month + 1}</div>
                    ${(window.auth.currentUser && data.addedBy === window.auth.currentUser.uid) ? 
                        `<button onclick="deleteBirthday('${doc.id}')" class="btn btn-sm text-danger position-absolute top-0 end-0 p-1"><i class="bi bi-trash"></i></button>` : ''}
                </div>`;
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function loadUpcomingBirthdays() {
    if (!window.db) return;
    try {
        const snapshot = await window.db.collection('birthdays').get();
        const container = document.getElementById('upcomingBirthdays');
        if (!container) return;
        
        const today = new Date();
        const upcoming = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            let nextBirthday = new Date(today.getFullYear(), data.month, data.day);
            if (nextBirthday < today && (data.month !== today.getMonth() || data.day !== today.getDate())) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            const diffDays = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 45) {
                upcoming.push({ ...data, diffDays, id: doc.id });
            }
        });
        
        upcoming.sort((a, b) => a.diffDays - b.diffDays);
        container.innerHTML = upcoming.length ? '' : '<div class="text-muted small">Ninguém soprando velinhas em breve.</div>';
        
        upcoming.forEach(b => {
            const dayText = b.diffDays === 0 ? 'Hoje!' : (b.diffDays === 1 ? 'Amanhã' : `Em ${b.diffDays} dias`);
            const div = document.createElement('div');
            div.className = 'd-flex justify-content-between align-items-center bg-dark p-2 rounded border border-secondary';
            div.innerHTML = `<div><span class="fw-bold text-white">${escapeHtml(b.name)}</span><small class="text-muted d-block">${b.day}/${b.month+1}</small></div><span class="badge ${b.diffDays===0?'bg-danger':'bg-orange'}">${dayText}</span>`;
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function addBirthday() {
    const name = document.getElementById('birthdayName').value;
    const dateStr = document.getElementById('birthdayDate').value;
    if (!name || !dateStr) return alert('Preencha tudo.');
    
    let day, month;
    if (dateStr.includes('-')) { const p = dateStr.split('-'); day = parseInt(p[2]); month = parseInt(p[1])-1; }
    else if (dateStr.includes('/')) { const p = dateStr.split('/'); day = parseInt(p[0]); month = parseInt(p[1])-1; }
    else return alert('Data inválida');

    try {
        await window.db.collection('birthdays').add({
            name, day, month, addedBy: window.auth.currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Salvo!');
        document.getElementById('birthdayName').value = '';
        document.getElementById('birthdayDate').value = '';
        loadBirthdaysIntoCache(); // Atualiza cache
        loadBirthdays();
        loadUpcomingBirthdays();
    } catch (e) { alert('Erro ao salvar.'); }
}

async function deleteBirthday(id) {
    if(confirm('Excluir?')) {
        await window.db.collection('birthdays').doc(id).delete();
        loadBirthdaysIntoCache(); // Atualiza cache
        loadBirthdays();
        loadUpcomingBirthdays();
    }
}

// Helper global para o calendário
window.getBirthdaysForDate = function(dateObj) {
    if (!window.globalBirthdays) return [];
    return window.globalBirthdays.filter(b => b.day === dateObj.getDate() && b.month === dateObj.getMonth());
};

window.loadBirthdays = loadBirthdays;
window.loadUpcomingBirthdays = loadUpcomingBirthdays;
window.loadBirthdaysIntoCache = loadBirthdaysIntoCache;
window.addBirthday = addBirthday;
window.deleteBirthday = deleteBirthday;

// Inicializa cache
document.addEventListener('DOMContentLoaded', () => setTimeout(loadBirthdaysIntoCache, 2000));
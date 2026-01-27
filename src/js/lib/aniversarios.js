// =================================================================
// SISTEMA DE ANIVERSÁRIOS (LISTA + CALENDÁRIO + NOTIFICAÇÃO)
// =================================================================

window.birthdayCache = [];

window.loadBirthdaysIntoCache = function() {
    if (!window.db) return;

    window.db.collection('birthdays').onSnapshot(snapshot => {
        window.birthdayCache = [];
        snapshot.forEach(doc => {
            window.birthdayCache.push({ id: doc.id, ...doc.data() });
        });
        
        if (document.getElementById('pageCalendarDays')) {
            if (typeof renderPageCalendar === 'function') renderPageCalendar();
        }

        if (document.getElementById('birthdaysListContainer')) {
            window.filterBirthdays(); 
        }

        // IMPORTANTE: Avisa o novo sistema de notificação
        if (window.notificationSystem && window.notificationSystem.generateLocalNotifications) {
            window.notificationSystem.generateLocalNotifications();
        }
    });
};

// --- MANTENHA AS OUTRAS FUNÇÕES ABAIXO (filterBirthdays, renderBirthdayList, etc) IGUAIS ---
// Só precisava alterar o 'loadBirthdaysIntoCache' acima.
// Se quiser garantir, copie e cole as funções de renderização que te mandei antes aqui embaixo.
// ...
// ...
// =================================================================
// RESTANTE DO CÓDIGO (COPIE AS FUNÇÕES DO CÓDIGO ANTERIOR SE PRECISAR)
// =================================================================
window.filterBirthdays = function() {
    const searchInput = document.getElementById('bdaySearch');
    const container = document.getElementById('birthdaysListContainer');
    if (!container) return;
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filteredList = window.birthdayCache.filter(b => b.name.toLowerCase().includes(term));
    renderBirthdayList(container, filteredList);
};

window.loadBirthdays = function() {
    const container = document.getElementById('birthdaysListContainer');
    if (!container) return;
    if (window.birthdayCache.length === 0) { window.loadBirthdaysIntoCache(); setTimeout(window.loadBirthdays, 500); return; }
    renderBirthdayList(container, window.birthdayCache);
};

function renderBirthdayList(container, dataList) {
    if (!dataList || dataList.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bi bi-balloon fs-1 mb-3 d-block" style="opacity: 0.3;"></i><p>Nenhum aniversário.</p></div>';
        return;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const currentYear = today.getFullYear();
    const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    const sortedBirthdays = [...dataList].map(b => {
        const [y, m, d] = b.date.split('-').map(Number);
        let nextBday = new Date(currentYear, m - 1, d);
        if (nextBday < today) nextBday.setFullYear(currentYear + 1);
        const diffTime = nextBday - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return { ...b, diffDays, day: d, month: m };
    }).sort((a, b) => a.diffDays - b.diffDays);

    let html = '';
    sortedBirthdays.forEach(b => {
        const isToday = b.diffDays === 0;
        const isTomorrow = b.diffDays === 1;
        let statusText = `Faltam ${b.diffDays} dias`;
        let cardClass = '';
        if (isToday) { statusText = '🎉 É HOJE!'; cardClass = 'is-today'; } 
        else if (isTomorrow) { statusText = 'Amanhã!'; cardClass = 'is-soon'; } 
        else if (b.diffDays < 7) { statusText = `Em ${b.diffDays} dias`; cardClass = 'is-soon'; } 
        else if (b.diffDays > 300) { statusText = 'Já passou este ano'; }

        html += `<div class="col-md-6 col-lg-4"><div class="bday-card ${cardClass}" onclick="openBirthdayModal('${b.id}', '${b.name}', '${b.date}')"><div class="bday-date-box"><span class="bday-day">${b.day}</span><span class="bday-month">${monthNames[b.month - 1]}</span></div><div class="bday-info flex-grow-1"><h6>${b.name}</h6><span class="bday-countdown">${statusText}</span></div><i class="bi bi-pencil-fill bday-edit-icon small"></i></div></div>`;
    });
    container.innerHTML = html;
}

window.getBirthdaysForDate = function(dateObj) {
    const m = dateObj.getMonth() + 1; const d = dateObj.getDate();
    return window.birthdayCache.filter(b => { if (!b.date) return false; const parts = b.date.split('-'); return parseInt(parts[1]) === m && parseInt(parts[2]) === d; });
};

window.openBirthdayModal = function(id = '', name = '', date = '') {
    const modalElement = document.getElementById('birthdayModal'); if (!modalElement) return;
    const modal = new bootstrap.Modal(modalElement);
    document.getElementById('bdayId').value = id; document.getElementById('bdayName').value = name; document.getElementById('bdayDate').value = date;
    const deleteBtn = document.getElementById('btnDeleteBday'); const title = document.getElementById('birthdayModalTitle');
    if (id) { if(title) title.textContent = 'Editar Aniversário'; if(deleteBtn) deleteBtn.classList.remove('d-none'); } 
    else { if(title) title.textContent = 'Novo Aniversário'; if(deleteBtn) deleteBtn.classList.add('d-none'); }
    modal.show();
};

window.saveBirthday = async function() {
    const id = document.getElementById('bdayId').value; const name = document.getElementById('bdayName').value.trim(); const date = document.getElementById('bdayDate').value;
    if (!name || !date) { alert("Preencha o nome e a data!"); return; }
    const btn = document.querySelector('#birthdayModal .btn-orange'); const originalText = btn ? btn.textContent : 'Salvar';
    if(btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }
    try {
        const data = { name: name, date: date, updatedBy: firebase.auth().currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (id) await window.db.collection('birthdays').doc(id).update(data); else await window.db.collection('birthdays').add(data);
        const modalEl = document.getElementById('birthdayModal'); const modal = bootstrap.Modal.getInstance(modalEl); if(modal) modal.hide();
    } catch (error) { console.error(error); alert("Erro ao salvar."); } 
    finally { if(btn) { btn.textContent = originalText; btn.disabled = false; } }
};

window.deleteBirthday = async function() {
    const id = document.getElementById('bdayId').value; if (!id || !confirm("Tem certeza que deseja apagar?")) return;
    try { await window.db.collection('birthdays').doc(id).delete(); const modalEl = document.getElementById('birthdayModal'); const modal = bootstrap.Modal.getInstance(modalEl); if(modal) modal.hide(); } 
    catch (error) { console.error(error); alert("Erro ao excluir."); }
};
// =================================================================
// SISTEMA DE ANIVERSÁRIOS (LISTA + CALENDÁRIO + BUSCA)
// =================================================================

// Cache global
window.birthdayCache = [];

// 1. Carrega dados para a memória (Listener em Tempo Real)
window.loadBirthdaysIntoCache = function() {
    if (!window.db) return;

    window.db.collection('birthdays').onSnapshot(snapshot => {
        window.birthdayCache = [];
        snapshot.forEach(doc => {
            window.birthdayCache.push({ id: doc.id, ...doc.data() });
        });
        
        // A. Atualiza pontinhos do calendário
        if (document.getElementById('pageCalendarDays')) {
            if (typeof renderPageCalendar === 'function') renderPageCalendar();
        }

        // B. Atualiza a lista (respeitando a busca atual, se houver)
        if (document.getElementById('birthdaysListContainer')) {
            window.filterBirthdays(); 
        }
    });
};

// 2. Função de Busca (Filtragem)
window.filterBirthdays = function() {
    const searchInput = document.getElementById('bdaySearch');
    const container = document.getElementById('birthdaysListContainer');
    
    if (!container) return;

    // Se o input não existir (ex: outra página), renderiza tudo
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filtra o cache
    const filteredList = window.birthdayCache.filter(b => 
        b.name.toLowerCase().includes(term)
    );

    renderBirthdayList(container, filteredList);
};

// 3. Renderiza a Lista na Aba "Aniversários" (Inicialização)
window.loadBirthdays = function() {
    const container = document.getElementById('birthdaysListContainer');
    if (!container) return;

    // Limpa a busca ao abrir a página (opcional, gosto pessoal)
    const searchInput = document.getElementById('bdaySearch');
    if(searchInput) searchInput.value = '';

    if (window.birthdayCache.length === 0) {
        window.loadBirthdaysIntoCache();
        setTimeout(window.loadBirthdays, 500);
        return;
    }

    // Renderiza a lista completa
    renderBirthdayList(container, window.birthdayCache);
};

// Função interna de desenho (Agora aceita uma lista específica)
function renderBirthdayList(container, dataList) {
    if (!dataList || dataList.length === 0) {
        // Mensagem diferente se for busca vazia ou lista vazia
        const isSearch = document.getElementById('bdaySearch')?.value.length > 0;
        const msg = isSearch ? "Ninguém encontrado com esse nome." : "Nenhum aniversário cadastrado ainda.";
        const action = isSearch ? "" : `<button class="btn btn-sm btn-outline-secondary rounded-pill mt-2" onclick="openBirthdayModal()">Adicionar o primeiro</button>`;

        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <i class="bi bi-search fs-1 mb-3 d-block" style="opacity: 0.3;"></i>
                <p>${msg}</p>
                ${action}
            </div>`;
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const currentYear = today.getFullYear();
    const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    // Ordenação Inteligente
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

        if (isToday) {
            statusText = '🎉 É HOJE!';
            cardClass = 'is-today';
        } else if (isTomorrow) {
            statusText = 'Amanhã!';
            cardClass = 'is-soon';
        } else if (b.diffDays < 7) {
            statusText = `Em ${b.diffDays} dias`;
            cardClass = 'is-soon';
        } else if (b.diffDays > 300) {
            statusText = 'Já passou este ano';
        }

        html += `
        <div class="col-md-6 col-lg-4">
            <div class="bday-card ${cardClass}" onclick="openBirthdayModal('${b.id}', '${b.name}', '${b.date}')">
                <div class="bday-date-box">
                    <span class="bday-day">${b.day}</span>
                    <span class="bday-month">${monthNames[b.month - 1]}</span>
                </div>
                <div class="bday-info flex-grow-1">
                    <h6>${b.name}</h6>
                    <span class="bday-countdown">${statusText}</span>
                </div>
                <i class="bi bi-pencil-fill bday-edit-icon small"></i>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// 4. Funções Auxiliares (Modal, Salvar, Excluir, Helpers)
window.getBirthdaysForDate = function(dateObj) {
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();
    return window.birthdayCache.filter(b => {
        if (!b.date) return false;
        const parts = b.date.split('-');
        return parseInt(parts[1]) === m && parseInt(parts[2]) === d;
    });
};

window.openBirthdayModal = function(id = '', name = '', date = '') {
    const modalElement = document.getElementById('birthdayModal');
    if (!modalElement) return;
    const modal = new bootstrap.Modal(modalElement);
    
    document.getElementById('bdayId').value = id;
    document.getElementById('bdayName').value = name;
    document.getElementById('bdayDate').value = date;
    
    const deleteBtn = document.getElementById('btnDeleteBday');
    const title = document.getElementById('birthdayModalTitle');
    
    if (id) {
        if(title) title.textContent = 'Editar Aniversário';
        if(deleteBtn) deleteBtn.classList.remove('d-none');
    } else {
        if(title) title.textContent = 'Novo Aniversário';
        if(deleteBtn) deleteBtn.classList.add('d-none');
    }
    modal.show();
};

window.saveBirthday = async function() {
    const id = document.getElementById('bdayId').value;
    const name = document.getElementById('bdayName').value.trim();
    const date = document.getElementById('bdayDate').value;

    if (!name || !date) { alert("Preencha o nome e a data!"); return; }

    const btn = document.querySelector('#birthdayModal .btn-orange');
    const originalText = btn ? btn.textContent : 'Salvar';
    if(btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

    try {
        const data = {
            name: name,
            date: date,
            updatedBy: firebase.auth().currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await window.db.collection('birthdays').doc(id).update(data);
        } else {
            await window.db.collection('birthdays').add(data);
        }

        const modalEl = document.getElementById('birthdayModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        if(btn) { btn.textContent = originalText; btn.disabled = false; }
    }
};

window.deleteBirthday = async function() {
    const id = document.getElementById('bdayId').value;
    if (!id || !confirm("Tem certeza que deseja apagar?")) return;

    try {
        await window.db.collection('birthdays').doc(id).delete();
        const modalEl = document.getElementById('birthdayModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
    } catch (error) {
        console.error(error);
        alert("Erro ao excluir.");
    }
};
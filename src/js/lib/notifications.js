// Notifications system: in-app only (no push) to show daily tasks, birthdays, and new complaints
(function(){
  const state = {
    unreadCount: 0,
    items: [],
    lastRenderedDayKey: null,
    unsubTasks: null,
    unsubBirthdays: null,
  unsubComplaints: null,
  complaintsSubscribed: false
  };

  function el(id){ return document.getElementById(id); }
  function fmtDate(d){
    try{ return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }catch{ return d.toISOString(); }
  }
  function isToday(date){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const t = new Date();
    const tt = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return d.getTime() === tt.getTime();
  }
  function toISODate(date){ return date.toISOString().split('T')[0]; }

  function ensureVisible(){
    const dd = el('notificationsDropdown');
    if (dd) dd.style.display = 'block';
  }

  function setBadge(n){
    const b = el('notificationsBadge');
    if (!b) return;
    if (n > 0){ b.textContent = String(n); b.style.display = 'inline-block'; }
    else { b.style.display = 'none'; }
  }

  function renderList(){
    const list = el('notificationsList');
    if (!list) return;
    if (state.items.length === 0){
      list.innerHTML = '<div class="text-muted small">Sem novas notificações</div>';
      return;
    }
    list.innerHTML = state.items.map(item => item.html).join('');
  }

  function addItem(id, html, key){
    if (state.items.find(i => i.id === id)) return;
    state.items.unshift({ id, html, key, unread: true });
    state.unreadCount = state.items.filter(i => i.unread).length;
    setBadge(state.unreadCount);
    renderList();
  }

  function markAllRead(){
    state.items.forEach(i => i.unread = false);
    state.unreadCount = 0;
    setBadge(0);
    // Add a subtle class removal if desired later
  }

  function onMarkAllClick(){ markAllRead(); }

  function todayKey(){ return toISODate(new Date()); }

  // Build daily notifications
  async function wireDailyTasks(){
    try{
      if (!window.db) return;
      const key = todayKey();
      if (state.lastRenderedDayKey === key) return; // we'll still wire realtime streams below
      state.lastRenderedDayKey = key;
      const snap = await window.db.collection('tasks').where('date','==', key).get();
      if (!snap.empty){
        const count = snap.size;
        addItem('tasks-'+key, `
          <div class="p-2 border-bottom small">
            <i class="bi bi-list-task me-1 text-orange"></i>
            ${count} tarefa(s) para hoje
          </div>
        `, key);
      }
      // Optional: subscribe for more tasks added today in realtime
      state.unsubTasks = window.db.collection('tasks').where('date','==', key)
        .onSnapshot(s => {
          s.docChanges().forEach(ch => {
            if (ch.type === 'added'){
              const id = 'tasks-live-'+key+'-'+ch.doc.id;
              addItem(id, `
                <div class="p-2 border-bottom small">
                  <i class="bi bi-list-task me-1 text-orange"></i>
                  Nova tarefa adicionada para hoje
                </div>
              `, key);
            }
          });
        });
    }catch(e){ console.warn('notifications: wireDailyTasks failed', e); }
  }

  async function wireBirthdays(){
    try{
      if (!window.db) return;
      const now = new Date();
      const d = now.getDate();
      const m = now.getMonth();
      state.unsubBirthdays = window.db.collection('birthdays')
        .where('day','==', d)
        .where('month','==', m)
        .onSnapshot(s => {
          if (s.empty) return;
          const names = [];
          s.forEach(doc => { const bd = doc.data()||{}; if (bd.name) names.push(bd.name); });
          if (names.length === 0) return;
          const key = todayKey();
          addItem('birthdays-'+key, `
            <div class="p-2 border-bottom small">
              <i class="bi bi-cake2 me-1 text-primary"></i>
              Aniversários de hoje: ${names.map(n => `<span class=\"badge bg-primary-subtle text-primary me-1\">${escapeHtml(n)}</span>`).join('')}
            </div>
          `, key);
        });
    }catch(e){ console.warn('notifications: wireBirthdays failed', e); }
  }

  function canSeeComplaints(){
    try {
      const isAdminFn = (typeof window.isAdmin === 'function') ? window.isAdmin : () => false;
      const getUserFn = (typeof window.getCurrentUserData === 'function') ? window.getCurrentUserData : () => null;
      const ud = getUserFn();
      return isAdminFn() || !!(ud && ud.accepted);
    } catch(e) { return false; }
  }

  function clearComplaintItems(){
    // Remove complaint-related items from the list when unsubscribing
    state.items = state.items.filter(it => it.key !== 'complaints');
    state.unreadCount = state.items.filter(i => i.unread).length;
    setBadge(state.unreadCount);
    renderList();
  }

  function subscribeComplaints(){
    if (!window.db || state.complaintsSubscribed) return;
    state.unsubComplaints = window.db.collection('classComplaints')
      .orderBy('createdAt','desc').limit(10)
      .onSnapshot(s => {
        s.docChanges().forEach(ch => {
          if (ch.type === 'added'){
            const c = ch.doc.data()||{};
            const when = c.createdAt && c.createdAt.toDate ? fmtDate(c.createdAt.toDate()) : '';
            const id = 'complaint-'+ch.doc.id;
            addItem(id, `
              <div class="p-2 border-bottom small">
                <i class="bi bi-chat-dots me-1 text-info"></i>
                Nova sugestão/reclamação recebida ${when ? '— '+when : ''}
              </div>
            `, 'complaints');
          }
        });
      });
    state.complaintsSubscribed = true;
  }

  function unsubscribeComplaints(){
    if (state.unsubComplaints) { try { state.unsubComplaints(); } catch{} finally { state.unsubComplaints = null; } }
    state.complaintsSubscribed = false;
    clearComplaintItems();
  }

  async function wireComplaints(){
    try{
      if (!window.db) return;
      if (canSeeComplaints()) subscribeComplaints();
    }catch(e){ console.warn('notifications: wireComplaints failed', e); }
  }

  // Expose a refresh hook so other parts (e.g., after userData loads) can re-check access
  window.notificationsRefreshAccess = function(){
    if (!window.db) return;
    if (canSeeComplaints()) {
      if (!state.complaintsSubscribed) subscribeComplaints();
    } else {
      if (state.complaintsSubscribed) unsubscribeComplaints();
    }
  };

  function escapeHtml(text){ if(!text && text!==0) return ''; const d=document.createElement('div'); d.textContent = String(text); return d.innerHTML; }

  function init(){
    // Only on index.html after auth
    document.addEventListener('DOMContentLoaded', () => {
      const markAllBtn = el('markAllNotificationsRead');
      if (markAllBtn) markAllBtn.addEventListener('click', onMarkAllClick);
  // Ensure we don't keep the initial "Carregando..." forever
  renderList();
      // Also render when dropdown is opened (Bootstrap 5 custom event)
      const bellBtn = el('notificationsButton');
      if (bellBtn) {
        bellBtn.addEventListener('show.bs.dropdown', renderList);
        bellBtn.addEventListener('click', () => setTimeout(renderList, 0)); // fallback
      }
    });

    // Show bell when user is authenticated
    if (typeof firebase !== 'undefined'){
      firebase.auth().onAuthStateChanged(user => {
        if (user){
          ensureVisible();
          // Replace loading placeholder with empty state if no items yet
          renderList();
          // Start wiring sources
          wireDailyTasks();
          wireBirthdays();
          wireComplaints();
          // Re-check access again shortly in case userData wasn't ready yet
          setTimeout(() => { if (typeof window.notificationsRefreshAccess === 'function') window.notificationsRefreshAccess(); }, 800);
        }
      });
    }

    // If DOM is already ready (script loaded late), render once
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      renderList();
    }
  }

  init();
})();

// blocked.js - page to let blocked users reauthenticate and delete account

// Immediately mark blocked flow active so other scripts (loaded earlier) detect it
try {
    sessionStorage.setItem('blockedFlowActive', '1');
    // Also set a recent swReload marker to avoid SW-triggered reloads during blocked flow
    try { sessionStorage.setItem('swReloaded', Date.now().toString()); } catch(e) {}
    // Prevent accidental redirects until user acts
    window.allowRedirect = false;
} catch (e) {}

document.addEventListener('DOMContentLoaded', () => {
    const emailEl = document.getElementById('blockedEmail');
    const passwordInput = document.getElementById('passwordInput');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const backBtn = document.getElementById('backToLogin');
    const msg = document.getElementById('blockedMessage');

    // Read stored info
    const blockedUid = sessionStorage.getItem('blockedUid');
    const blockedEmail = sessionStorage.getItem('blockedEmail');

    if (blockedEmail) {
        emailEl.textContent = blockedEmail;
    }

    backBtn.addEventListener('click', () => {
    sessionStorage.removeItem('blockedUid');
    sessionStorage.removeItem('blockedEmail');
    try { sessionStorage.removeItem('blockedFlowActive'); } catch(e) {}
    safeNavigate('login.html', true);
    });

    deleteBtn.addEventListener('click', async () => {
        const password = passwordInput.value || '';
        if (!password) {
            msg.innerHTML = '<div class="alert alert-warning">Digite sua senha.</div>';
            return;
        }

        msg.innerHTML = '<div class="alert alert-info">Tentando reautenticar...</div>';

        try {
            // Sign in with email + password to reauthenticate and obtain recent credentials
            const userCredential = await firebase.auth().signInWithEmailAndPassword(blockedEmail, password);
            const user = userCredential.user;
            if (!user) throw new Error('Falha ao autenticar');

            // Now call deletion helper
            msg.innerHTML = '<div class="alert alert-info">Excluindo sua conta e dados...</div>';
            try {
                await window.deleteAccountCompletely(user.uid);
            } finally {
                try { sessionStorage.removeItem('blockedFlowActive'); } catch(e) {}
            }

        } catch (err) {
            console.error('Erro na reautenticação/exclusão:', err);
            msg.innerHTML = '<div class="alert alert-danger">Erro: ' + (err.message || err) + '</div>';
        }
    });
});

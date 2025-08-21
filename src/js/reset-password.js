// reset-password.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const resetEmail = document.getElementById('resetEmail');
    const sendBtn = document.getElementById('sendResetBtn');
    const status = document.getElementById('resetStatus');

    if (emailParam && resetEmail) {
        resetEmail.value = decodeURIComponent(emailParam);
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = resetEmail.value.trim();
            if (!email) {
                status.innerHTML = '<div class="alert alert-warning">Por favor, digite seu email.</div>';
                return;
            }

            status.innerHTML = '<div class="alert alert-info">Enviando email de recuperação...</div>';
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                status.innerHTML = '<div class="alert alert-success">Email enviado! Verifique sua caixa de entrada.</div>';
            } catch (err) {
                console.error('Erro ao enviar email de recuperação:', err);
                const msg = (err && err.code) ? err.code : (err && err.message) ? err.message : 'Erro inesperado';
                status.innerHTML = '<div class="alert alert-danger">Erro: ' + msg + '</div>';
            }
        });
    }
});

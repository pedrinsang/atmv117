document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('debugEmail');
    const sendBtn = document.getElementById('debugSend');
    const result = document.getElementById('debugResult');

    sendBtn.addEventListener('click', async () => {
        const email = (emailInput.value || '').trim();
        if (!email) {
            result.innerHTML = '<div class="alert alert-warning">Digite um email</div>';
            return;
        }
        result.innerHTML = '<div class="alert alert-info">Enviando...</div>';
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            result.innerHTML = '<div class="alert alert-success">Email de redefinição enviado com sucesso. Verifique a caixa de entrada e spam.</div>';
            console.log('Reset email sent to', email);
        } catch (err) {
            console.error('Reset email error', err);
            result.innerHTML = '<div class="alert alert-danger">Erro: ' + (err && err.code ? err.code : (err && err.message ? err.message : 'erro desconhecido')) + '</div>';
        }
    });
});

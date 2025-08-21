// Helper: exposes the password reset email template as a string for easy copy/paste
window.emailTemplates = window.emailTemplates || {};
window.emailTemplates.passwordReset = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Redefinição de senha — ATMV117</title>
  <style>
    body { background-color:#f4f4f6; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
    .email-wrapper { width:100%; background:#f4f4f6; padding:20px 0; }
    .email-content { max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.06); }
    .email-header { background:#ff6b35; color:#fff; padding:24px; text-align:center; }
    .brand { font-size:20px; font-weight:700; letter-spacing:0.4px; }
    .email-body { padding:24px; color:#333; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.5; }
    .btn { display:inline-block; background:#ff6b35; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600; }
    .muted { color:#777; font-size:13px; }
    .footer { padding:18px; text-align:center; font-size:13px; color:#999; }
    a.small-link { color:#ff6b35; text-decoration:none; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-content">
      <div class="email-header">
        <div class="brand">ATMV117 — Organizador de Tarefas</div>
      </div>
      <div class="email-body">
        <h2 style="margin-top:0;color:#222;">Redefinição de senha</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no aplicativo da turma ATMV117.</p>
        <p style="text-align:center;margin:22px 0;"><a href="%LINK%" class="btn" target="_blank" rel="noopener">Redefinir minha senha</a></p>
        <p class="muted">Caso o botão acima não funcione, copie o link abaixo e cole no navegador:</p>
        <p style="word-break:break-all; font-size:13px; color:#555;">%LINK%</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p class="muted">Se você não solicitou esta alteração, pode ignorar este e-mail com segurança — sua senha permanecerá inalterada.</p>
        <p>Obrigado,<br/>Comissão da ATMV117</p>
      </div>
      <div class="footer">
        <div>ATMV117 • <a href="https://atmv117.firebaseapp.com" class="small-link">Visite o site</a></div>
      </div>
    </div>
  </div>
</body>
</html>`;

console.log('emailTemplates.passwordReset is available for copy/paste.');

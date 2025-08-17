# Teste de Proteção de Rotas

## Como testar se o redirecionamento está funcionando:

### Teste 1: Acesso direto sem login
1. Abra uma janela anônima/privada no navegador
2. Acesse diretamente: `http://localhost:3000/index.html` (ou seu domínio)
3. **Resultado esperado**: Deve mostrar tela de "Verificando autenticação..." e depois redirecionar para login

### Teste 2: Acesso ao admin sem permissão
1. Faça login como usuário comum
2. Tente acessar: `http://localhost:3000/admin.html`
3. **Resultado esperado**: Deve mostrar "Acesso negado" ou redirecionar para login

### Teste 3: Logout e proteção
1. Faça login normalmente
2. Acesse o index.html (deve funcionar)
3. Faça logout
4. Tente acessar index.html novamente
5. **Resultado esperado**: Deve redirecionar para login

### Teste 4: Session timeout
1. Faça login
2. Abra DevTools > Application > Storage > Clear storage
3. Recarregue a página
4. **Resultado esperado**: Deve detectar que não está mais logado e redirecionar

## Logs para verificar:

Abra o DevTools (F12) e veja o Console. Você deve ver mensagens como:
- ✅ Usuário autenticado: email@exemplo.com
- ❌ Usuário não autenticado - redirecionando para login
- 🔄 Redirecionando para página de login...

## Se algo não funcionar:

1. Verifique se os scripts estão sendo carregados na ordem correta
2. Confirme se as regras do Firestore foram aplicadas
3. Teste em janela anônima para evitar cache
4. Verifique o Console para erros de JavaScript

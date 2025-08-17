# 🚨 SOLUÇÃO URGENTE - Erro de Permissão Firestore

## O QUE FAZER AGORA (EM ORDEM):

### PASSO 1: Aplicar Regras do Firestore 🔥
**AÇÃO IMEDIATA NECESSÁRIA:**

1. **Abra:** https://console.firebase.google.com/
2. **Selecione projeto:** `atmv117`
3. **Vá para:** Firestore Database → Rules (Regras)
4. **Substitua TUDO** pelo conteúdo do arquivo: `firestore-rules-URGENTE.txt`
5. **Clique:** Publish (Publicar)
6. **Aguarde:** 2-3 minutos para propagação

### PASSO 2: Teste de Diagnóstico 🔍
**Após aplicar as regras:**

1. **Abra** sua aplicação
2. **Pressione F12** (DevTools)
3. **Vá para** Console
4. **Teste manualmente no Console:**
  - Verifique autenticação: `console.log('Usuário:', firebase.auth().currentUser)`
  - Tente leitura simples: `firebase.firestore().collection('tasks').limit(1).get().then(s=>console.log(s.size)).catch(e=>console.error(e))`
  - Colete erros/saídas (copie do Console) e envie se precisar de suporte.

### PASSO 3: Se ainda der erro ⚠️
**Regras de Teste (TEMPORÁRIAS):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**ATENÇÃO:** Essas regras são menos seguras, use apenas para teste!

### PASSO 4: Verificações Adicionais ✅

1. **Login/Logout:**
   - Faça logout completo
   - Limpe cache do navegador (Ctrl+Shift+Del)
   - Faça login novamente

2. **Verificar Autenticação:**
   - Console deve mostrar: "✅ Usuário autenticado"
   - Se não mostrar, há problema no login

3. **Teste em Janela Anônima:**
   - Abra janela privada/anônima
   - Acesse a aplicação
   - Faça login
   - Teste o calendário

### PASSO 5: Se NADA funcionar 🆘

**Execute estes comandos no Console:**

```javascript
// Verificar usuário atual
firebase.auth().currentUser

// Verificar conectividade Firestore
firebase.firestore().enableNetwork()

// Teste manual de leitura
firebase.firestore().collection('tasks').limit(1).get()
```

### POSSÍVEIS CAUSAS DO ERRO:

1. **❌ Regras não aplicadas** → Aplicar regras urgentes
2. **❌ Cache do navegador** → Limpar cache
3. **❌ Token expirado** → Logout/Login
4. **❌ Documento usuário ausente** → Diagnóstico criará automaticamente
5. **❌ Problema de rede** → Verificar conexão
6. **❌ Configuração Firebase** → Verificar projeto/chaves

### LOGS QUE VOCÊ DEVE VER:

**✅ SUCESSO:**
```
✅ Firebase carregado
✅ Usuário autenticado: email@exemplo.com
📅 Carregando dados do calendário...
✅ Calendário renderizado com sucesso
```

**❌ ERRO:**
```
❌ Erro de permissão do Firestore
🚫 PERMISSÃO NEGADA
```

### CONTATO DE EMERGÊNCIA:
Se nada funcionar, verifique:
- Projeto Firebase correto: `atmv117`
- Domínio autorizado no Firebase Auth
- Chaves de API válidas

**IMPORTANTE:** O diagnóstico automático agora detectará e reportará o problema específico!

# 🚨 SOLUÇÃO PARA ERRO DE PERMISSÃO NO FIRESTORE

## Problema:
```
FirebaseError: Missing or insufficient permissions.
```

## ✅ SOLUÇÕES IMPLEMENTADAS:

### 1. **Sistema de Diagnóstico Automático**

### 2. **Melhor Verificação de Autenticação**

### 3. **Regras do Firestore Corretas**
Suas regras estão corretas, mas precisam ser aplicadas no console do Firebase.

## 🔧 PASSOS PARA RESOLVER:

### PASSO 1: Aplicar Regras no Firebase Console
1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto **atmv117**
3. Firestore Database → Regras
4. Copie e cole exatamente estas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regras para a coleção de usuários
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && 
                   request.auth.uid == userId &&
                   request.resource.data.email == request.auth.token.email &&
                   request.resource.data.role == 'user';
      allow update: if request.auth != null && 
                   request.auth.uid == userId &&
                   !('role' in request.resource.data.diff(resource.data).changedKeys());
      allow read: if request.auth != null && 
                 exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
                 get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow update: if request.auth != null && 
                   exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' &&
                   request.auth.uid != userId &&
                   'role' in request.resource.data.diff(resource.data).changedKeys();
    }
    
    // Regras para logs de auditoria
    match /admin_logs/{logId} {
      allow read: if request.auth != null && 
                 exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
                 get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow create: if request.auth != null && 
                   exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Regras para tarefas - SIMPLES E FUNCIONAIS
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
    
    // Outras coleções
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Clique em **PUBLICAR**
6. Aguarde 2-3 minutos para propagação

### PASSO 2: Verificar Usuário no Firestore
1. Vá para Firestore Database → Dados
2. Verifique se existe uma coleção `users`
3. Verifique se seu usuário tem um documento em `users/{seu-uid}`

Se NÃO existe:
```javascript
// Execute no console do navegador após fazer login:
const user = firebase.auth().currentUser;
if (user) {
    firebase.firestore().collection('users').doc(user.uid).set({
        fullName: user.displayName || 'Usuário',
        email: user.email,
        role: 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}
```

### PASSO 3: Teste o Sistema
1. Faça logout e login novamente
2. Abra o calendário
3. Verifique o Console (F12) para logs detalhados
4. (Removido) A ferramenta de diagnóstico automático foi retirada. Use os testes manuais abaixo.

## 🔍 COMO DIAGNOSTICAR:

### Via Console do Navegador:
```javascript
// 1. Verificar autenticação
console.log('Usuário:', firebase.auth().currentUser);

// 2. Executar testes manuais (veja seção "Teste manual de leitura" abaixo)

// 3. Testar acesso manual
firebase.firestore().collection('tasks').limit(1).get()
    .then(snap => console.log('✅ Acesso OK:', snap.size))
    .catch(err => console.error('❌ Erro:', err));
```

### Logs que Você Deve Ver:
```
✅ Usuário autenticado: seu@email.com
📅 loadCalendar() chamado
👤 Estado de autenticação atual: Logado: seu@email.com
📊 Iniciando carregamento de dados do calendário...
📝 Snapshot recebido: X documentos
```

## 🚨 SE AINDA NÃO FUNCIONAR:

### Solução Temporária - Regras Abertas (APENAS PARA TESTE):
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

### Verificações Finais:
1. ✅ Regras aplicadas no console Firebase?
2. ✅ Usuário tem documento na coleção `users`?
3. ✅ Login/logout feito após aplicar regras?
4. ✅ Cache do navegador limpo?

## 📞 CONTATO:
Se o problema persistir, colete os logs do console (F12 → Console), copie a saída e envie-os para análise.

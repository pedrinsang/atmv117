# Configuração das Regras do Firestore

## Como aplicar as regras do Firestore:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione seu projeto: **atmv117**
3. No menu lateral, clique em **Firestore Database**
4. Clique na aba **Regras** (Rules)
5. Copie o conteúdo do arquivo `firestore-rules.txt` 
6. Cole no editor de regras do Firebase Console
7. Clique em **Publicar** (Publish)

## Verificar se as regras estão funcionando:

1. No Console do Firebase, vá para **Firestore Database** > **Regras**
2. Clique em **Simulador** (Simulator)
3. Teste uma operação de leitura na coleção `tasks`
4. Certifique-se de que está simulando como um usuário autenticado

## Regras atuais:

As regras no arquivo `firestore-rules.txt` permitem:
- Usuários podem gerenciar seus próprios dados em `/users/{userId}`
- Apenas admins podem ver todos os usuários e logs
- Coleção `tasks` requer autenticação para leitura e escrita
- Todas as outras coleções requerem autenticação

## Se ainda houver erros de permissão:

1. Verifique se o usuário está realmente logado
2. Confirme se as regras foram publicadas corretamente
3. Aguarde alguns minutos para que as regras sejam propagadas
4. Teste em uma janela anônima para limpar o cache

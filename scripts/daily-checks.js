// daily-check.js
// Esse script roda no servidor do GitHub Actions
const admin = require('firebase-admin');

// 1. Inicia o Firebase com a chave secreta
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupExpiredTasks(todayStr) {
  const overdueSnap = await db.collection('tasks')
    .where('date', '<', todayStr)
    .get();

  if (overdueSnap.empty) {
    console.log("🧹 Nenhuma tarefa vencida para excluir.");
    return;
  }

  const refs = overdueSnap.docs.map(doc => doc.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  console.log(`🧹 ${refs.length} tarefa(s) vencida(s) removida(s).`);
}

async function checkAndNotify() {
  console.log("🤖 Iniciando verificação diária...");

  // 2. Calcula a data de "Amanhã" (Fuso Horário BRASIL GMT-3)
  // O GitHub roda em UTC, então precisamos ajustar
  const now = new Date();
  // Ajusta para horário de Brasília (UTC-3)
  now.setHours(now.getHours() - 3);
  
  // Adiciona 1 dia para pegar "Amanhã"
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = now.toISOString().split('T')[0];
  
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  console.log(`🗑️ Removendo tarefas anteriores a: ${todayStr}`);
  console.log(`📅 Buscando tarefas para: ${tomorrowStr}`);

  try {
    // 2.5 Remove tarefas vencidas
    await cleanupExpiredTasks(todayStr);

    // 3. Busca tarefas no Banco
    const snapshot = await db.collection('tasks')
      .where('date', '==', tomorrowStr)
      .get();

    if (snapshot.empty) {
      console.log("✅ Nenhuma tarefa encontrada para amanhã.");
      return;
    }

    // 4. Para cada tarefa, cria um aviso
    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      const task = doc.data();
      const notifRef = db.collection('notifications').doc(); // ID automático

      console.log(`📢 Criando aviso para: ${task.title}`);

      batch.set(notifRef, {
        type: 'reminder', // Ícone de despertador
        title: `Lembrete: ${task.title}`,
        body: `Prepare-se! Essa tarefa é para amanhã (${tomorrowStr}).`,
        // Importante: Salva data como Timestamp para o app ordenar certo
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [] // Ninguém leu ainda
      });
      count++;
    });

    // 5. Salva tudo de uma vez
    await batch.commit();
    console.log(`🚀 Sucesso! ${count} notificações enviadas para a turma.`);

  } catch (error) {
    console.error("❌ Erro ao processar:", error);
    process.exit(1); // Avisa o GitHub que deu erro
  }
}

checkAndNotify();
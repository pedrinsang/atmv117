// scripts/news-scraper.js
const admin = require('firebase-admin');
const Parser = require('rss-parser');

// 1. Configuração Inicial
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const parser = new Parser();

const RSS_URL = 'https://www.ufsm.br/unidades-universitarias/ccr/feed';

async function scrapeNews() {
    console.log("📰 Iniciando busca de notícias...");

    try {
        // 2. Baixa o Feed da UFSM (Direto da fonte, sem APIs intermediárias limitadas)
        const feed = await parser.parseURL(RSS_URL);
        console.log(`📡 Encontrados ${feed.items.length} itens no feed.`);

        const batch = db.batch();
        let newCount = 0;

        // 3. Processa cada notícia
        for (const item of feed.items) {
            
            // --- LÓGICA DE FILTRAGEM (O "CÉREBRO") ---
            const title = item.title || "";
            const content = item.contentSnippet || item.content || "";
            const fullText = (title + " " + content).toLowerCase();
            const link = item.link;

            // Palavras-chave OBRIGATÓRIAS (Pelo menos uma dessas)
            const keywordsVet = ['veterinária', 'veterinaria', 'mv', 'hvu'];
            const keywordsEdital = ['edital', 'seleção', 'bolsa', 'resultado', 'retificação', 'estágio', 'monitoria'];
            
            // Palavras-chave PROIBIDAS (Blacklist)
            const blacklist = ['incra', 'reforma agrária', 'seleção pública para', 'curso de dança', 'teatro'];

            const hasVet = keywordsVet.some(k => fullText.includes(k));
            const hasEdital = keywordsEdital.some(k => fullText.includes(k));
            const isBlocked = blacklist.some(k => fullText.includes(k));

            // A Regra de Ouro:
            // 1. Tem que ser de Vet OU ser um Edital genérico
            // 2. E NÃO pode estar na lista de bloqueio
            const isRelevant = (hasVet || hasEdital) && !isBlocked;

            if (!isRelevant) {
                // console.log(`❌ Ignorado: ${title}`); // Descomente para debug
                continue;
            }

            // 4. Verifica se já salvamos essa notícia antes (Para não duplicar)
            // Usamos o link como ID único (codificado em base64 para ser válido no Firestore)
            const newsId = Buffer.from(link).toString('base64').replace(/\//g, '_');
            const docRef = db.collection('auto_news').doc(newsId);
            
            const doc = await docRef.get();
            if (!doc.exists) {
                // Tenta achar imagem
                let imgUrl = 'src/img/logo-silhueta.png';
                if (item.enclosure && item.enclosure.url) imgUrl = item.enclosure.url;
                
                // Formata Data (YYYY-MM-DD)
                let dateIso = new Date().toISOString().split('T')[0];
                if (item.pubDate) {
                    dateIso = new Date(item.pubDate).toISOString().split('T')[0];
                }

                console.log(`✅ SALVANDO: ${title}`);
                
                batch.set(docRef, {
                    title: title,
                    link: link,
                    date: dateIso,
                    description: content.substring(0, 200) + "...", // Resumo
                    img: imgUrl,
                    source: 'UFSM-CCR',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                newCount++;
            }
        }

        // 5. Salva no Banco
        if (newCount > 0) {
            await batch.commit();
            console.log(`🚀 ${newCount} novas notícias adicionadas ao App!`);
        } else {
            console.log("💤 Nenhuma notícia nova relevante encontrada.");
        }

    } catch (error) {
        console.error("❌ Erro no Scraper:", error);
        process.exit(1);
    }
}

scrapeNews();
// filepath: w:\projetos\atmv117\atmv117\src\js\fileConverter.js
// ===== SISTEMA SIMPLES: APENAS 25MB + GOOGLE DRIVE + YOUTUBE =====

class SimpleFileHandler {
    constructor() {
        this.maxFileSize = 25 * 1024 * 1024; // 25MB
        console.log('📁 Sistema simples de arquivos carregado (25MB máximo)');
    }

    // ⭐ PROCESSAR ARQUIVO (APENAS UPLOAD DIRETO)
    async processFile(file, taskId) {
        try {
            console.log(`📄 Processando: ${file.name} (${formatFileSize(file.size)})`);
            
            // Verificar tamanho
            if (file.size > this.maxFileSize) {
                throw new Error(`Arquivo muito grande! Máximo: ${formatFileSize(this.maxFileSize)}. Use Google Drive para arquivos maiores.`);
            }
            
            // Upload direto para GitHub
            return await uploadToGitHub(file, taskId);
            
        } catch (error) {
            console.error('Erro no processamento:', error);
            throw error;
        }
    }

    // ⭐ VERIFICAR SE ARQUIVO É VÁLIDO
    isValidFile(file) {
        return file.size <= this.maxFileSize;
    }

    // ⭐ STATUS DO SISTEMA
    getStatus() {
        return '✅ Sistema simples pronto (25MB máximo)';
    }
}

// ===== INSTÂNCIA GLOBAL =====
window.fileConverter = new SimpleFileHandler();

// ===== FUNÇÃO UTILITÁRIA =====
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log('✅ Sistema de arquivos simples carregado');
console.log('🎯 Funcionalidades:');
console.log('  - 📁 Upload direto até 25MB');
console.log('  - 🔗 Google Drive para arquivos maiores');
console.log('  - 📺 Links do YouTube');
console.log('  - ❌ SEM conversão automática');
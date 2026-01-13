/**
 * UserService
 * Responsável pela comunicação com o Firestore referente a usuários.
 */
class UserService {
    constructor() {
        this.db = firebase.firestore();
        this.collection = this.db.collection('users');
    }

    /**
     * Alterna o status de bloqueio de um usuário
     */
    async toggleBlockStatus(userId, shouldBlock, adminUid, adminEmail, userEmail) {
        try {
            await this.collection.doc(userId).update({
                disabled: shouldBlock,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: adminUid
            });
            
            // Log de auditoria
            await this.logAction(
                shouldBlock ? 'block_user' : 'unblock_user',
                adminUid,
                adminEmail,
                userId,
                userEmail,
                { disabled: shouldBlock }
            );
            return true;
        } catch (error) {
            console.error('Erro no UserService.toggleBlockStatus:', error);
            throw error;
        }
    }

    /**
     * Altera a função (role) de um usuário
     */
    async changeRole(userId, newRole, oldRole, adminUid, adminEmail, userEmail) {
        if (userId === adminUid) throw new Error("Você não pode alterar seu próprio papel.");
        
        try {
            await this.collection.doc(userId).update({
                role: newRole,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: adminUid
            });

            await this.logAction(
                'role_change', 
                adminUid, 
                adminEmail,
                userId, 
                userEmail,
                { oldRole, newRole }
            );
            return true;
        } catch (error) {
            console.error('Erro no UserService.changeRole:', error);
            throw error;
        }
    }

    /**
     * Registra ações administrativas no Firestore
     */
    async logAction(action, adminId, adminEmail, targetUserId, targetUserEmail, details) {
        try {
            await this.db.collection('admin_logs').add({
                action,
                adminId,
                adminEmail,
                targetUserId,
                targetUserEmail,
                details,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ip: 'browser_session'
            });
        } catch (e) {
            console.warn('Falha ao salvar log de auditoria (não crítico):', e);
        }
    }
}

// Inicializa globalmente para uso no admin.js
window.UserService = new UserService();
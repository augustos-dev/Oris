import { Router } from 'express';
import { auditLogController } from '../../controllers/auditLogController';
import { authenticate, authorize } from '../../middlewares/authMiddlewares';

const router = Router();

router.use(authenticate);

// Somente ADMIN/OWNER (a versão desta rota sem `authorize` deixava qualquer papel ler a auditoria).

/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Endpoints para consulta e registro do histórico de auditoria
 */

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Lista os logs de auditoria da clínica (ou da rede inteira, para o OWNER) com paginação
 *     description: >
 *       Acessos a prontuário/cadastro de paciente registrado em outra unidade da rede aparecem com `action: READ`.
 *       Somente ADMIN e OWNER.
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Quantidade de registros por página (máximo 100)
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [clinic, network], default: clinic }
 *         description: "`network` lista as unidades do tenant (exclusivo do OWNER; 403 para os demais)"
 *     responses:
 *       200:
 *         description: Lista de logs retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 45
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *                 logs:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/AuditLog'
 *                       - type: object
 *                         properties:
 *                           clinic:
 *                             type: object
 *                             properties:
 *                               id: { type: string, format: uuid }
 *                               name: { type: string }
 *       401:
 *         description: Não autorizado / Token inválido
 *       403:
 *         description: Papel sem acesso à auditoria, ou scope=network por quem não é OWNER
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', authorize('ADMIN'), auditLogController.listLogs);

export default router;
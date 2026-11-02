import { Router } from 'express'
import * as stockMovementController from '../../controllers/stockMovementController'
import { authenticate } from '../../middlewares/authMiddlewares'
import { authorize } from '../../middlewares/authMiddlewares'

const router = Router()

// Aplica autenticação JWT para todas as rotas de movimentação
router.use(authenticate)

/**
 * @openapi
 * /stock-movements:
 *   get:
 *     summary: Listar histórico de movimentações de estoque
 *     description: >
 *       Retorna o histórico paginado de entradas, saídas manuais e baixas automáticas por procedimento **da unidade ativa**.
 *       Atenção ao sinal de `quantity`: depende da origem (`EXIT_MANUAL` criado por esta API grava valor negativo; `ENTRY`, `EXIT_AUTO` e os ajustes de
 *       `PATCH /products/{id}/stock` gravam valor positivo). Para saber o sentido use sempre `type`.
 *     tags:
 *       - Stock Movements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: Filtrar histórico por um produto específico
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ENTRY, EXIT_MANUAL, EXIT_AUTO]
 *         required: false
 *         description: Filtrar por tipo de movimentação
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         example: "2026-08-01"
 *         description: Data inicial do período (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         example: "2026-08-31"
 *         description: Data final do período (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         required: false
 *         description: Quantidade de itens por página
 *     responses:
 *       200:
 *         description: Histórico de movimentações retornado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       tenantId:
 *                         type: string
 *                         format: uuid
 *                       clinicId:
 *                         type: string
 *                         format: uuid
 *                       productId:
 *                         type: string
 *                         format: uuid
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       type:
 *                         type: string
 *                         enum: [ENTRY, EXIT_MANUAL, EXIT_AUTO]
 *                       quantity:
 *                         type: number
 *                         example: 2.5
 *                         description: Aceita decimais. Para EXIT_AUTO é a quantidade realmente baixada (pode ser menor que a da ficha técnica se faltou saldo).
 *                       appointmentId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       procedureId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       reason:
 *                         type: string
 *                         example: "Exit Inteligente: Procedimento Realizado (Agendamento: 9f2c...)"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       product:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                             example: "Resina Composta A2"
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                             example: "Dr. Roberto"
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/',
  authorize('ADMIN', 'DENTIST', 'SECRETARY'),
  stockMovementController.listMovements
)

/**
 * @openapi
 * /stock-movements:
 *   post:
 *     summary: Registrar movimentação manual de estoque
 *     description: Permite dar entrada (reposição de estoque) ou saída manual (descarte/perda/ajuste) em um produto.
 *     tags:
 *       - Stock Movements
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - type
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
 *                 description: ID do produto no estoque
 *               type:
 *                 type: string
 *                 enum: [ENTRY, EXIT_MANUAL]
 *                 example: "ENTRY"
 *                 description: Tipo da movimentação (ENTRY para entrada, EXIT_MANUAL para saída)
 *               quantity:
 *                 type: number
 *                 example: 10
 *                 description: Quantidade movimentada (maior que zero; aceita decimais)
 *               reason:
 *                 type: string
 *                 example: "Reposição de estoque semanal - Nota Fiscal 1042"
 *                 description: Observação ou motivo da movimentação
 *     responses:
 *       201:
 *         description: Movimentação de estoque registrada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Movimentação de estoque registrada com sucesso."
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedProduct:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         quantity:
 *                           type: number
 *                           example: 35
 *                     movement:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         type:
 *                           type: string
 *                           example: "ENTRY"
 *                         quantity:
 *                           type: number
 *                           example: 10
 *                         reason:
 *                           type: string
 *       400:
 *         description: Quantidade inválida ou saldo insuficiente para saída manual (a checagem é atômica, então duas saídas simultâneas não deixam o saldo negativo).
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Produto não encontrado no estoque da unidade
 */
router.post(
  '/',
  authorize('ADMIN', 'DENTIST', 'SECRETARY'),
  stockMovementController.createMovement
)

export default router
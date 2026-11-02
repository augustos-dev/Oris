// backend/src/routes/treatment.routes.ts

import { Router } from 'express'
import {
  createTreatmentPlanController,
  listTreatmentPlansController,
  getTreatmentPlanByIdController,
  updateTreatmentPlanController,
  updateTreatmentPlanStatusController,
  deleteTreatmentPlanController,
} from '../../controllers/treatmentController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

router.use(authenticate)

/**
 * @openapi
 * /treatment-plans:
 *   get:
 *     summary: Lista os planos de tratamento e orçamentos
 *     description: >
 *       A listagem geral é da unidade ativa (visão gerencial). No Enterprise, ao filtrar por `patientId` a lista traz os planos
 *       do paciente em **toda a rede** (um tratamento pode ter começado em outra unidade).
 *     tags: [Treatment Plans]
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: dentistId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ORCAMENTO, APROVADO, EM_ANDAMENTO, CONCLUIDO, RECUSADO]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de planos de tratamento
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
 *                       id: { type: string, format: uuid }
 *                       title: { type: string }
 *                       status: { type: string }
 *                       totalAmount: { type: number }
 *                       createdAt: { type: string, format: date-time }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listTreatmentPlansController)

/**
 * @openapi
 * /treatment-plans/{id}:
 *   get:
 *     summary: Busca um plano de tratamento por ID com procedimentos vinculados
 *     description: No Enterprise, abre também planos criados em outras unidades da rede (a resposta traz a unidade em `clinic`).
 *     tags: [Treatment Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Plano de tratamento com lista de procedimentos
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getTreatmentPlanByIdController)

/**
 * @openapi
 * /treatment-plans:
 *   post:
 *     summary: Cria um novo plano de tratamento ou orçamento (ADMIN ou DENTIST)
 *     description: >
 *       O valor total é **calculado pelo servidor** (soma de `quantity × actualPrice`); não envie `totalAmount`.
 *       O plano pertence à unidade ativa. No Enterprise o paciente pode ser de qualquer unidade da rede, e os procedimentos
 *       precisam estar ativos na unidade. O dentista precisa atuar na unidade.
 *     tags: [Treatment Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, dentistId, title, procedures]
 *             properties:
 *               patientId: { type: string, format: uuid }
 *               dentistId: { type: string, format: uuid }
 *               title: { type: string, example: 'Reabilitação Oral Superior' }
 *               notes: { type: string }
 *               procedures:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [procedureId, quantity, actualPrice]
 *                   properties:
 *                     procedureId: { type: string, format: uuid }
 *                     quantity: { type: integer, example: 1 }
 *                     actualPrice: { type: number, example: 350.00 }
 *     responses:
 *       201:
 *         description: Plano de tratamento criado com sucesso (com `totalAmount` calculado)
 *       400:
 *         description: O plano precisa de ao menos um procedimento
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/', authorize('ADMIN', 'DENTIST'), createTreatmentPlanController)

/**
 * @openapi
 * /treatment-plans/{id}:
 *   put:
 *     summary: Atualiza um plano de tratamento (ADMIN ou DENTIST; somente na unidade que o criou)
 *     description: >
 *       Se `procedures` for enviado, a lista substitui a anterior e o total é recalculado. Planos APROVADO, EM_ANDAMENTO ou CONCLUIDO
 *       não aceitam troca de procedimentos (400).
 *     tags: [Treatment Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               notes: { type: string }
 *               procedures:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [procedureId, quantity, actualPrice]
 *                   properties:
 *                     procedureId: { type: string, format: uuid }
 *                     quantity: { type: integer }
 *                     actualPrice: { type: number }
 *     responses:
 *       200:
 *         description: Plano atualizado com sucesso
 *       400:
 *         description: Plano aprovado/em andamento/concluído não aceita troca de procedimentos
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authorize('ADMIN', 'DENTIST'), updateTreatmentPlanController)

/**
 * @openapi
 * /treatment-plans/{id}/status:
 *   patch:
 *     summary: Atualiza o status de um plano de tratamento
 *     description: >
 *       Transições permitidas: ORCAMENTO → APROVADO | RECUSADO; APROVADO → EM_ANDAMENTO | RECUSADO; EM_ANDAMENTO → CONCLUIDO.
 *       CONCLUIDO e RECUSADO são finais. Somente na unidade que criou o plano.
 *     tags: [Treatment Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ORCAMENTO, APROVADO, EM_ANDAMENTO, CONCLUIDO, RECUSADO]
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Transição de status inválida
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/status', authorize('ADMIN', 'DENTIST', 'SECRETARY'), updateTreatmentPlanStatusController)

/**
 * @openapi
 * /treatment-plans/{id}:
 *   delete:
 *     summary: Remove um plano de tratamento (ADMIN/OWNER; apenas em ORCAMENTO ou RECUSADO)
 *     tags: [Treatment Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Plano removido com sucesso
 *       400:
 *         description: Plano aprovado ou em andamento não pode ser deletado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('ADMIN'), deleteTreatmentPlanController)

export default router
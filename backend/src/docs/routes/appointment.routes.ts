import { Router } from 'express'
import {
  createAppointmentController,
  listAppointmentsController,
  getAppointmentByIdController,
  updateAppointmentController,
  updateAppointmentStatusController,
  deleteAppointmentController,
} from '../../controllers/apponitmentController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

// ─── Todas as rotas de agendamentos são privadas (Exigem Token JWT) ─────────
router.use(authenticate)

/**
 * @openapi
 * components:
 *   schemas:
 *     StockShortage:
 *       type: object
 *       description: Insumo que não tinha saldo suficiente na baixa automática (o atendimento NÃO é bloqueado)
 *       properties:
 *         productId: { type: string, format: uuid }
 *         productName: { type: string, example: "Pomada A" }
 *         needed: { type: number, example: 1 }
 *         deducted: { type: number, example: 0.5 }
 *         missing: { type: number, example: 0.5 }
 *     UpdateAppointmentDTO:
 *       type: object
 *       description: Todos os campos são opcionais. Campos fora desta lista (status, clinicId, autoStockDeducted...) são ignorados.
 *       properties:
 *         patientId: { type: string, format: uuid }
 *         dentistId: { type: string, format: uuid }
 *         procedureId: { type: string, format: uuid }
 *         dateTime: { type: string, format: date-time }
 *         durationMin: { type: integer }
 *         type: { type: string, enum: [PARTICULAR, CONVENIO] }
 *         room: { type: string, enum: [SALA_1, SALA_2, SALA_3, SALA_4] }
 *         notes: { type: string }
 */

/**
 * @openapi
 * /appointments:
 *   get:
 *     summary: Lista agendamentos com filtros e paginação
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Filtra agendamentos de um dia específico (YYYY-MM-DD)
 *       - in: query
 *         name: dentistId
 *         schema: { type: string, format: uuid }
 *         description: ID do dentista responsável
 *       - in: query
 *         name: patientId
 *         schema: { type: string, format: uuid }
 *         description: ID do paciente
 *       - in: query
 *         name: procedureId
 *         schema: { type: string, format: uuid }
 *         description: Filtra consultas vinculadas a um procedimento específico
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AGENDADO, CONFIRMADO, EM_ATENDIMENTO, FINALIZADO, CANCELADO, FALTOU, ESPERA]
 *         description: Status atual do atendimento
 *       - in: query
 *         name: room
 *         schema:
 *           type: string
 *           enum: [SALA_1, SALA_2, SALA_3, SALA_4]
 *         description: Sala/Consultório designado
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Appointment' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listAppointmentsController)

/**
 * @openapi
 * /appointments/{id}:
 *   get:
 *     summary: Busca um agendamento por ID com procedimento e produtos da ficha técnica
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos do agendamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getAppointmentByIdController)

/**
 * @openapi
 * /appointments:
 *   post:
 *     summary: Cria um novo agendamento (Valida conflitos de sala e agenda do dentista)
 *     description: >
 *       No plano Enterprise o paciente pode ter sido cadastrado em qualquer unidade da rede e o procedimento precisa estar
 *       **ativo na unidade**. O dentista pode atender em mais de uma unidade (vínculo em `user_clinics`).
 *       Conflito de sala vale só dentro da unidade; conflito de agenda do dentista vale em **todas** as unidades da rede.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentDTO'
 *     responses:
 *       201:
 *         description: Agendamento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Data no passado ou campos obrigatórios inválidos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Paciente, Dentista ou Procedimento não encontrado (no Enterprise, também procedimento inativo na unidade)
 *       409:
 *         description: Conflito de horário na sala (mesma unidade) ou na agenda do dentista (qualquer unidade)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN', 'SECRETARY', 'DENTIST'), createAppointmentController)

/**
 * @openapi
 * /appointments/{id}:
 *   put:
 *     summary: Atualiza/Remarca um agendamento (Revalida regras de conflito de horário)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/UpdateAppointmentDTO'
 *     responses:
 *       200:
 *         description: Agendamento atualizado com sucesso
 *       400:
 *         description: Agendamentos com status final (FINALIZADO, CANCELADO, FALTOU) não podem ser editados
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Agendamento, paciente, dentista ou procedimento informado não encontrado (as referências recebidas são validadas)
 *       409:
 *         description: Conflito de horário de sala ou dentista na nova data
 */
router.put('/:id', authorize('ADMIN', 'SECRETARY', 'DENTIST'), updateAppointmentController)

/**
 * @openapi
 * /appointments/{id}/status:
 *   patch:
 *     summary: Atualiza status do agendamento (Dispara Exit Inteligente com Trava de Idempotência se FINALIZADO)
 *     description: >
 *       Ao transitar o status para 'FINALIZADO', o sistema verifica se o agendamento possui um `procedureId`.
 *       Caso positivo, os insumos da **Ficha Técnica da unidade do atendimento** são abatidos no estoque **dessa unidade**, de forma atômica
 *       (o saldo nunca fica negativo). Se a unidade não tiver ficha técnica para o procedimento, nada é baixado.
 *       Se a baixa já tiver sido realizada (evolução clínica da mesma visita ou pagamento), a operação é ignorada para garantir idempotência.
 *       Quando falta insumo, o atendimento é finalizado mesmo assim e a resposta traz `stockWarnings`.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/UpdateAppointmentStatusDTO'
 *     responses:
 *       200:
 *         description: Status atualizado e baixa automática processada (se aplicável)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Appointment'
 *                 - type: object
 *                   properties:
 *                     stockWarnings:
 *                       type: array
 *                       description: Presente apenas quando faltou insumo na baixa automática
 *                       items: { $ref: '#/components/schemas/StockShortage' }
 *       400:
 *         description: Agendamento já finalizado ou motivo de cancelamento não informado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Agendamento não encontrado (ou procedimento informado inexistente / inativo na unidade)
 */
router.patch('/:id/status', authorize('ADMIN', 'SECRETARY', 'DENTIST'), updateAppointmentStatusController)

/**
 * @openapi
 * /appointments/{id}:
 *   delete:
 *     summary: Remove um agendamento
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Agendamento removido com sucesso
 *       400:
 *         description: Não é permitido deletar agendamentos em andamento ou finalizados
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('ADMIN', 'SECRETARY'), deleteAppointmentController)

export default router
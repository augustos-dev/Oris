// backend/src/routes/patient.routes.ts

import { Router } from 'express'
import {
  createPatientController,
  listPatientsController,
  getPatientByIdController,
  updatePatientController,
  deletePatientController,
} from '../../controllers/patientController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

// ─── Todas as rotas de pacientes são privadas ─────────────────────────────────

router.use(authenticate)

/**
 * @openapi
 * components:
 *   schemas:
 *     PatientExistsError:
 *       type: object
 *       description: >
 *         Plano Enterprise: o CPF já está cadastrado na rede. O front deve abrir o paciente existente
 *         (`details.patientId`) em vez de criar outro.
 *       properties:
 *         message: { type: string, example: "Este CPF já está cadastrado na rede. Abra o cadastro existente em vez de criar outro." }
 *         details:
 *           type: object
 *           properties:
 *             code: { type: string, example: PATIENT_EXISTS_IN_NETWORK }
 *             patientId: { type: string, format: uuid }
 *             patientName: { type: string }
 *             registeredAt: { type: string, example: "Messejana", description: "Unidade onde foi cadastrado" }
 */

/**
 * @openapi
 * /patients:
 *   get:
 *     summary: Lista pacientes com filtros e paginação
 *     description: >
 *       **Planos Basic/Premium:** apenas os pacientes da unidade. **Plano Enterprise:** busca na rede inteira (o paciente é achado pelo CPF
 *       em qualquer unidade); cada item traz a unidade de origem em `clinic`. Use `clinicId` para restringir a uma unidade.
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filtra por nome (case-insensitive)
 *       - in: query
 *         name: cpf
 *         schema: { type: string }
 *         description: Filtra por CPF (aceita com ou sem pontuação)
 *       - in: query
 *         name: phone
 *         schema: { type: string }
 *         description: Filtra por telefone
 *       - in: query
 *         name: insuranceName
 *         schema: { type: string }
 *         description: Filtra por convênio/operadora
 *       - in: query
 *         name: clinicId
 *         schema: { type: string, format: uuid }
 *         description: Enterprise - restringe a busca da rede a uma unidade
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de pacientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Patient' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listPatientsController)

/**
 * @openapi
 * /patients/{id}:
 *   get:
 *     summary: Busca um paciente por ID com prontuário e histórico
 *     description: >
 *       No Enterprise o paciente pode pertencer a outra unidade da rede; esse acesso fica registrado na auditoria (`action: READ`).
 *       Os últimos agendamentos trazem a unidade (`clinic`) de cada atendimento.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos do paciente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Patient'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getPatientByIdController)

/**
 * @openapi
 * /patients:
 *   post:
 *     summary: Cria um novo paciente (e prontuário vinculado)
 *     description: >
 *       O CPF é único por tenant. No **Enterprise**, se já existir na rede a resposta 409 traz `details.patientId` para abrir o cadastro existente.
 *       Um CPF de cadastro desativado (soft delete) também retorna 409; peça a reativação ao administrador.
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePatientDTO'
 *     responses:
 *       201:
 *         description: Paciente criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Patient'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: CPF já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/PatientExistsError'
 *                 - $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN', 'SECRETARY', 'DENTIST'), createPatientController)

/**
 * @openapi
 * /patients/{id}:
 *   put:
 *     summary: Atualiza os dados de um paciente
 *     description: No Enterprise, qualquer unidade da rede pode atualizar o cadastro (telefone, endereço, convênio...).
 *     tags: [Patients]
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
 *             $ref: '#/components/schemas/CreatePatientDTO'
 *     responses:
 *       200:
 *         description: Paciente atualizado com sucesso
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.put('/:id', authorize('ADMIN', 'SECRETARY', 'DENTIST'), updatePatientController)

/**
 * @openapi
 * /patients/{id}:
 *   delete:
 *     summary: Remove um paciente (soft delete; ADMIN ou OWNER)
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Paciente removido com sucesso
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('ADMIN'), deletePatientController)

export default router
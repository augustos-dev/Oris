import { Router } from 'express'
import {
  getMedicalRecordByPatientController,
  updateMedicalRecordController,
  getOdontogramController,
  upsertToothConditionController,
  deleteToothConditionController,
  getEvolutionsController,
  createEvolutionController,
  updateEvolutionController,
  lockEvolutionController,
} from '../../controllers/medicalRecordController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'
import { upload } from '../../middlewares/uploadMiddleware'

const medicalRecordRouter = Router()

// Aplica autenticação JWT para todas as rotas
medicalRecordRouter.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: MedicalRecords
 *   description: >
 *     Gestão de Prontuários, Evoluções Clínicas e Odontograma. **Enterprise:** o prontuário é único na rede (todas as unidades
 *     veem as evoluções do paciente, cada uma com a unidade em que foi registrada). **Demais planos:** apenas a unidade do paciente.
 */

/**
 * @openapi
 * /medical-records/public/anamnese:
 *   get:
 *     summary: Consulta os dados para preenchimento público da anamnese
 *     description: >
 *       Acesso sem login por token temporário gerado para o paciente. O link expira em 36 horas e deixa de funcionar
 *       após o envio da anamnese ou revogação.
 *     tags: [Medical Records Public]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Token recebido no link temporário
 *     responses:
 *       200:
 *         description: Dados do paciente, da clínica e prontuário disponível para preenchimento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 patientName: { type: string }
 *                 clinicName: { type: string }
 *                 medicalRecord:
 *                   type: object
 *                   nullable: true
 *                   additionalProperties: true
 *       400:
 *         description: Token não informado
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Link revogado ou já utilizado
 */
/**
 * @openapi
 * /medical-records/public/anamnese:
 *   put:
 *     summary: Envia a anamnese preenchida pelo paciente
 *     description: >
 *       Acesso sem login por token temporário. O envio registra o aceite dos termos e consome o token,
 *       que não poderá ser reutilizado.
 *     tags: [Medical Records Public]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: Token recebido no link temporário }
 *               mainComplaint: { type: string }
 *               chiefComplaint: { type: string, description: Alias aceito para mainComplaint }
 *               historyNotes: { type: string }
 *               allergies: { type: string }
 *               medicationsInUse: { type: string }
 *               medications: { type: string, description: Alias aceito para medicationsInUse }
 *               bloodType: { type: string }
 *               habits: { type: string }
 *               systemicDiseases: { type: string }
 *     responses:
 *       200:
 *         description: Anamnese salva e token consumido
 *       400:
 *         description: Token não informado ou dados inválidos
 *       401:
 *         description: Token inválido ou expirado
 *       403:
 *         description: Link revogado ou já utilizado
 */
/**
 * @openapi
 * /patients/{id}/anamnesis-token:
 *   post:
 *     summary: Gera um link temporário para preenchimento da anamnese
 *     description: >
 *       Revoga links pendentes anteriores do paciente. O token retornado é válido por 36 horas e só pode ser usado uma vez.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID do paciente
 *     responses:
 *       201:
 *         description: Token temporário gerado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 expiresInHours: { type: integer, example: 36 }
 *                 expiresAt: { type: string, format: date-time }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
/**
 * @openapi
 * /medical-records/{patientId}/anamnesis-token:
 *   post:
 *     summary: Gera um link temporário para preenchimento da anamnese
 *     description: >
 *       Rota alternativa à geração pelo cadastro de pacientes. Revoga links pendentes anteriores do paciente;
 *       o novo token é válido por 36 horas e só pode ser usado uma vez.
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID do paciente
 *     responses:
 *       201:
 *         description: Token temporário gerado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 expiresInHours: { type: integer, example: 36 }
 *                 expiresAt: { type: string, format: date-time }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

// ─── 1. SUB-ROTAS ESPECÍFICAS DE EVOLUÇÃO ──────────────────────────────────

/**
 * @swagger
 * /medical-records/{patientId}/evolutions:
 *   get:
 *     summary: Lista o histórico de evoluções de um paciente
 *     description: >
 *       Cada evolução traz `clinic` (unidade onde foi feita). Com o armazenamento privado ligado (`STORAGE_PRIVATE=true`),
 *       `attachments` são **URLs assinadas e temporárias** (expiram em ~1 h; não guarde em cache).
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente ou do prontuário
 *     responses:
 *       200:
 *         description: Lista de evoluções retornada com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
medicalRecordRouter.get(
  '/:patientId/evolutions',
  getEvolutionsController
)

/**
 * @swagger
 * /medical-records/{patientId}/evolutions:
 *   post:
 *     summary: Cria uma nova evolução clínica para o paciente (Dispara Exit Inteligente & Popula MedicalFiles)
 *     description: >
 *       Registra a evolução do paciente **na unidade ativa**, atualiza o snapshot do odontograma,
 *       popula automaticamente a tabela `MedicalFile` caso haja anexos e dispara o Exit Inteligente
 *       com trava de idempotência se houver um `procedureId` vinculado. A baixa usa a ficha técnica e o estoque **da unidade**;
 *       se houver agendamento da mesma visita (mesmo paciente e procedimento, janela de 12 h) a baixa é vinculada a ele e não se repete ao finalizá-lo.
 *       No Enterprise o procedimento precisa estar ativo na unidade. O profissional precisa atuar na unidade.
 *       Arquivos: imagens são convertidas para WebP; PDFs precisam ser PDFs válidos. Anexos enviados no corpo (`attachments` como texto/JSON)
 *       só são aceitos se forem arquivos desta plataforma e do próprio tenant.
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente ou do prontuário
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Realizado procedimento de restauração no dente 16 com resina."
 *               procedureId:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
 *                 description: ID do procedimento realizado (Aciona a baixa automática de estoque)
 *               appointmentId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do agendamento vinculado para controle de idempotência
 *               odontogramSnapshot:
 *                 type: string
 *                 description: JSON em string representando o snapshot do odontograma
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Até 20 arquivos em imagem/anexos
 *     responses:
 *       201:
 *         description: Evolução cadastrada com sucesso, arquivos salvos e estoque abatido
 *       400:
 *         description: Dados inválidos, arquivo corrompido/PDF inválido ou anexo de origem não aceita
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Paciente, profissional ou procedimento não encontrado (no Enterprise, também procedimento inativo na unidade)
 */
medicalRecordRouter.post(
  '/:patientId/evolutions', 
  authorize('DENTIST', 'ADMIN'), 
  upload.array('attachments', 20), 
  createEvolutionController
)

/**
 * @swagger
 * /medical-records/evolutions/{evolutionId}:
 *   put:
 *     summary: Atualiza uma evolução clínica existente (Respeita a trava de imutabilidade)
 *     description: Somente a unidade que registrou a evolução pode editá-la (outra unidade da rede recebe 404).
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: evolutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da evolução
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Ajuste na descrição da restauração."
 *     responses:
 *       200:
 *         description: Evolução atualizada
 *       400:
 *         description: Evolução travada não pode ser editada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Evolução não encontrada (ou registrada por outra unidade)
 */
medicalRecordRouter.put(
  '/evolutions/:evolutionId', 
  authorize('DENTIST', 'ADMIN'), 
  updateEvolutionController
)

/**
 * @swagger
 * /medical-records/evolutions/{evolutionId}/lock:
 *   patch:
 *     summary: Bloqueia manualmente uma evolução para edições (Trava de Imutabilidade LGPD/CFO)
 *     description: Somente a unidade que registrou a evolução pode travá-la.
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: evolutionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da evolução
 *     responses:
 *       200:
 *         description: Evolução trancada com sucesso
 *       400:
 *         description: Evolução já está travada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Evolução não encontrada (ou registrada por outra unidade)
 */
medicalRecordRouter.patch(
  '/evolutions/:evolutionId/lock', 
  authorize('DENTIST', 'ADMIN'), 
  lockEvolutionController
)

// ─── 2. SUB-ROTAS ESPECÍFICAS DE ODONTOGRAMA ───────────────────────────────

/**
 * @swagger
 * /medical-records/{medicalRecordId}/odontogram:
 *   get:
 *     summary: Obtém as condições dentárias e o odontograma por ID do Prontuário
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: medicalRecordId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do prontuário médico ou paciente
 *     responses:
 *       200:
 *         description: Odontograma retornado com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
medicalRecordRouter.get(
  '/:medicalRecordId/odontogram', 
  getOdontogramController
)

/**
 * @swagger
 * /medical-records/{patientId}/odontogram:
 *   put:
 *     summary: Atualiza ou insere a condição de um dente específico no odontograma (Upsert)
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente ou prontuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toothNumber
 *               - condition
 *             properties:
 *               toothNumber:
 *                 type: integer
 *                 example: 16
 *               condition:
 *                 type: string
 *                 example: "RESTAURADO"
 *               faces:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["MESIAL", "OCLUSAL"]
 *               notes:
 *                 type: string
 *                 example: "Resina composta realizada em 2026."
 *     responses:
 *       200:
 *         description: Condição do dente salva
 *       400:
 *         description: Número de dente inválido
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
medicalRecordRouter.put(
  '/:patientId/odontogram', 
  authorize('ADMIN', 'DENTIST'), 
  upsertToothConditionController
)

/**
 * @swagger
 * /medical-records/{patientId}/odontogram/{toothNumber}:
 *   delete:
 *     summary: Remove a condição registrada de um dente específico no odontograma
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente ou prontuário
 *       - in: path
 *         name: toothNumber
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número do dente (por exemplo 16 ou 21)
 *     responses:
 *       204:
 *         description: Condição removida com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
medicalRecordRouter.delete(
  '/:patientId/odontogram/:toothNumber', 
  authorize('ADMIN', 'DENTIST'), 
  deleteToothConditionController
)

// ─── 3. ROTAS GENÉRICAS DO PRONTUÁRIO (Sempre por último) ───────────────────

/**
 * @swagger
 * /medical-records/{patientId}:
 *   get:
 *     summary: Obtém os dados gerais do prontuário médico do paciente (com as evoluções)
 *     description: >
 *       No Enterprise abre o prontuário único da rede, inclusive de paciente cadastrado em outra unidade; esse acesso
 *       entre unidades é registrado na auditoria (`action: READ`). Demais planos: apenas pacientes da unidade (404 caso contrário).
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente
 *     responses:
 *       200:
 *         description: Dados do prontuário retornados com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
medicalRecordRouter.get(
  '/:patientId', 
  getMedicalRecordByPatientController
)

/**
 * @swagger
 * /medical-records/{patientId}:
 *   put:
 *     summary: Atualiza as informações de anamnese e históricas do prontuário
 *     tags: [MedicalRecords]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do paciente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chiefComplaint:
 *                 type: string
 *                 example: "Dor ao mastigar do lado direito."
 *               historyNotes:
 *                 type: string
 *               allergies:
 *                 type: string
 *                 example: "Alergia a Penicilina"
 *               medications:
 *                 type: string
 *               bloodType:
 *                 type: string
 *                 example: "O+"
 *               habits:
 *                 type: string
 *               systemicDiseases:
 *                 type: string
 *                 example: "Hipertensão controlada."
 *     responses:
 *       200:
 *         description: Prontuário atualizado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
medicalRecordRouter.put(
  '/:patientId', 
  authorize('ADMIN', 'DENTIST'), 
  updateMedicalRecordController
)

export default medicalRecordRouter
// backend/src/routes/user.routes.ts

import { Router } from 'express'
import {
  createUserController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  updateUserRoleController,
  updateUserStatusController,
  changePasswordController,
  deleteUserController,
  getRolePermissionsController,
  updateRolePermissionsController,
  listUserClinicsController,
  assignUserClinicController,
  removeUserClinicController,
} from '../../controllers/userController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

router.use(authenticate)

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required: [name, email, password, role]
 *       properties:
 *         name: { type: string }
 *         email: { type: string, format: email, description: "Normalizado (sem espaços e em minúsculas)" }
 *         password: { type: string, minLength: 6 }
 *         role:
 *           type: string
 *           enum: [ADMIN, DENTIST, SECRETARY, OWNER]
 *           description: "OWNER só existe no plano Enterprise e só quem já é OWNER pode atribuí-lo"
 *         phone: { type: string }
 *         cro: { type: string }
 *         defaultCommissionPercentage: { type: number }
 *     UserSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         tenantId: { type: string, format: uuid }
 *         clinicId: { type: string, format: uuid, description: "Unidade principal do usuário" }
 *         name: { type: string }
 *         email: { type: string }
 *         role: { type: string, enum: [ADMIN, DENTIST, SECRETARY, OWNER] }
 *         phone: { type: string, nullable: true }
 *         cro: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *         isActive: { type: boolean }
 *         lastLoginAt: { type: string, format: date-time, nullable: true }
 */

// ─── Própria conta ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /users/me/change-password:
 *   patch:
 *     summary: Altera a senha do usuário autenticado
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       401:
 *         description: Senha atual incorreta ou token inválido
 */
router.patch('/me/change-password', changePasswordController)

// ─── Permissões granulares (RBAC) ────────────────────────────────────────────

/**
 * @openapi
 * /users/permissions/{role}:
 *   get:
 *     summary: Lista as permissões granulares de um papel na unidade ativa (ADMIN/OWNER)
 *     description: >
 *       Retorna as regras da unidade e as regras globais do tenant. Quando existem as duas para o mesmo módulo, vale a da unidade.
 *       Se o papel ainda não tem regras, as padrões são criadas.
 *     tags: [Users - RBAC]
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string, enum: [ADMIN, DENTIST, SECRETARY, OWNER] }
 *     responses:
 *       200:
 *         description: Lista de módulos e permissões do papel
 *       400:
 *         description: Papel inválido
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/permissions/:role', authorize('ADMIN'), getRolePermissionsController)

/**
 * @openapi
 * /users/permissions:
 *   put:
 *     summary: Atualiza permissões de acesso em lote para um papel, na unidade ativa (ADMIN/OWNER)
 *     description: ADMIN e OWNER têm acesso total e fixo (não editável).
 *     tags: [Users - RBAC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, permissions]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [DENTIST, SECRETARY]
 *               clinicId:
 *                 type: string
 *                 format: uuid
 *                 description: Opcional. Padrão é a unidade ativa.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [module]
 *                   properties:
 *                     module:
 *                       type: string
 *                       enum: [DASHBOARD, AGENDA, PATIENTS, RECORDS, STOCK, FINANCIAL, PROCEDURES, SUPPLIERS, SETTINGS, REPORTS, AI_TRANSCRIPTION, COMMISSIONS, TASKS, MY_OFFICE, RECEIVABLES, INSURANCE_BATCHES]
 *                     canRead: { type: boolean }
 *                     canCreate: { type: boolean }
 *                     canUpdate: { type: boolean }
 *                     canDelete: { type: boolean }
 *     responses:
 *       200:
 *         description: Permissões atualizadas com sucesso
 *       400:
 *         description: Não é permitido alterar permissões de ADMIN/OWNER ou dados inválidos
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/permissions', authorize('ADMIN'), updateRolePermissionsController)

// ─── Usuários ────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lista os usuários da unidade ativa (ADMIN/OWNER)
 *     description: Para listar os usuários de outra unidade da rede, o OWNER troca a unidade ativa (`POST /auth/switch-clinic`).
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ADMIN, DENTIST, SECRETARY, OWNER] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UserSummary' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authorize('ADMIN'), listUsersController)

/**
 * @openapi
 * /users/{id}/clinics:
 *   get:
 *     summary: Unidade principal e unidades adicionais em que o usuário atua (Enterprise)
 *     tags: [Users - Rede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unidades do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 primary:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string }
 *                 additional:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       name: { type: string }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/clinics', authorize('ADMIN'), listUserClinicsController)

/**
 * @openapi
 * /users/{id}/clinics/{clinicId}:
 *   post:
 *     summary: Vincula o usuário a uma unidade adicional (somente OWNER, plano Enterprise)
 *     description: >
 *       Permite que um profissional atue em mais de uma unidade (ele passa a poder trocar para a unidade em `POST /auth/switch-clinic`
 *       e a ser escalado nas agendas dela). As permissões padrão do papel são criadas na unidade, se ainda não existirem.
 *     tags: [Users - Rede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Vínculo criado (ou já existente)
 *       400:
 *         description: Esta já é a unidade principal do usuário
 *       403:
 *         description: Plano sem rede, ou usuário não é OWNER
 *       404:
 *         description: Usuário ou unidade não encontrados
 *   delete:
 *     summary: Remove o vínculo do usuário com uma unidade adicional (somente OWNER)
 *     description: A unidade principal (`clinicId` do usuário) não pode ser removida por esta rota.
 *     tags: [Users - Rede]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: clinicId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Vínculo removido
 *       403:
 *         description: Usuário não é OWNER
 *       404:
 *         description: Vínculo não encontrado
 */
router.post('/:id/clinics/:clinicId', authorize('ADMIN'), assignUserClinicController)
router.delete('/:id/clinics/:clinicId', authorize('ADMIN'), removeUserClinicController)

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Busca um usuário da unidade ativa por ID (ADMIN/OWNER)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSummary'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authorize('ADMIN'), getUserByIdController)

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Cria um novo usuário na unidade ativa (ADMIN/OWNER)
 *     description: >
 *       Dentistas respeitam o limite de profissionais do pacote contratado (403 ao atingir). O papel OWNER só pode ser
 *       atribuído por outro OWNER, no plano Enterprise. Cria as permissões padrão do papel na unidade.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSummary'
 *       403:
 *         description: Sem permissão, limite de profissionais atingido ou atribuição de OWNER não permitida
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', authorize('ADMIN'), createUserController)

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Atualiza dados de um usuário da unidade ativa (ADMIN/OWNER)
 *     tags: [Users]
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
 *               name: { type: string }
 *               phone: { type: string }
 *               cro: { type: string }
 *               avatarUrl: { type: string }
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authorize('ADMIN'), updateUserController)

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     summary: Altera o papel de um usuário (ADMIN/OWNER; você não altera o seu próprio)
 *     description: >
 *       Promover a DENTIST respeita o limite de profissionais. `OWNER` só pode ser atribuído ou alterado por outro OWNER (Enterprise).
 *     tags: [Users]
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, DENTIST, SECRETARY, OWNER]
 *     responses:
 *       200:
 *         description: Papel atualizado com sucesso
 *       400:
 *         description: Você não pode alterar a sua própria permissão
 *       403:
 *         description: Sem permissão, limite de profissionais atingido ou alteração de OWNER não permitida
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/role', authorize('ADMIN'), updateUserRoleController)

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     summary: Ativa ou desativa um usuário (ADMIN/OWNER; você não desativa a si mesmo)
 *     description: Reativar um dentista respeita o limite de profissionais do pacote.
 *     tags: [Users]
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Você não pode desativar a sua própria conta
 *       403:
 *         description: Sem permissão ou limite de profissionais atingido
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/status', authorize('ADMIN'), updateUserStatusController)

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Remove um usuário da unidade ativa (ADMIN/OWNER; bloqueado se houver agendamentos vinculados)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Usuário removido com sucesso
 *       400:
 *         description: Usuário com agendamentos vinculados (desative em vez de excluir) ou tentativa de excluir a si mesmo
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('ADMIN'), deleteUserController)

export default router

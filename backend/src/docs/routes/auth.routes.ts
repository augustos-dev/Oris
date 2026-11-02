// backend/src/routes/auth.routes.ts

import { Router } from 'express'
import {
  registerController,
  loginController,
  getMeController,
  listMyClinicsController,
  switchClinicController,
} from '../../controllers/authController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

/**
 * @openapi
 * components:
 *   schemas:
 *     NetworkClinic:
 *       type: object
 *       description: Unidade (clínica) que o usuário pode acessar
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: "Messejana" }
 *         logoUrl: { type: string, nullable: true }
 *         cnpj: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *     AuthMeResponse:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         email: { type: string, format: email }
 *         role: { type: string, enum: [ADMIN, DENTIST, SECRETARY, OWNER] }
 *         phone: { type: string, nullable: true }
 *         cro: { type: string, nullable: true }
 *         avatarUrl: { type: string, nullable: true }
 *         lastLoginAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         tenant:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             slug: { type: string }
 *             plan: { type: string, enum: [BASIC, PREMIUM, ENTERPRISE] }
 *             status: { type: string }
 *             trialEndsAt: { type: string, format: date-time, nullable: true }
 *             isBetaPartner: { type: boolean }
 *         clinic:
 *           $ref: '#/components/schemas/NetworkClinic'
 *         clinics:
 *           type: array
 *           description: Unidades que o usuário pode acessar (OWNER vê todas as ativas do tenant)
 *           items: { $ref: '#/components/schemas/NetworkClinic' }
 */

// ─── Rotas Públicas ──────────────────────────────────────────────────────────

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica um usuário e retorna o token JWT
 *     description: >
 *       Limite de 5 tentativas incorretas por IP + e-mail a cada 15 minutos (429). Além disso, 5 senhas erradas
 *       seguidas bloqueiam a conta por 15 minutos.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginDTO'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso. O token carrega a unidade principal do usuário como unidade ativa.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         description: Muitas tentativas ou conta temporariamente bloqueada
 */
router.post('/login', loginController)

// ─── Rotas Privadas (exigem JWT válido) ──────────────────────────────────────

router.use(authenticate)

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Cadastra um colaborador na clínica (apenas ADMIN ou OWNER autenticado)
 *     description: >
 *       **Esta rota deixou de ser pública.** O `tenantId` vem sempre do token (não é aceito no corpo).
 *       A unidade é a do usuário autenticado; apenas o OWNER pode informar `clinicId` para cadastrar em outra unidade da rede.
 *       O papel `OWNER` não pode ser atribuído por aqui. Dentistas respeitam o limite de profissionais do pacote contratado.
 *       A resposta traz o token do **novo** usuário.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [ADMIN, DENTIST, SECRETARY] }
 *               phone: { type: string }
 *               cro: { type: string }
 *               clinicId: { type: string, format: uuid, description: "Somente OWNER. Padrão: unidade ativa." }
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Sem permissão, papel OWNER solicitado, ou limite de profissionais do pacote atingido
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/register', authorize('ADMIN'), registerController)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Retorna o perfil do usuário autenticado, a unidade ativa e as unidades acessíveis
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMeResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: O usuário não tem mais acesso à unidade ativa do token (faça login novamente)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/me', getMeController)

/**
 * @openapi
 * /auth/clinics:
 *   get:
 *     summary: Lista as unidades que o usuário pode acessar (rede Enterprise)
 *     description: A unidade principal e os vínculos em `user_clinics`. O papel OWNER enxerga todas as unidades ativas do tenant.
 *     tags: [Auth - Rede]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unidades acessíveis, em ordem alfabética
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/NetworkClinic' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/clinics', listMyClinicsController)

/**
 * @openapi
 * /auth/switch-clinic:
 *   post:
 *     summary: Troca a unidade ativa da sessão e devolve um novo token
 *     description: >
 *       O acesso à unidade é validado no banco. Depois da troca, todas as rotas passam a operar na nova unidade
 *       (agenda, estoque, financeiro e as buscas de pacientes de planos não-Enterprise). Substitua o token guardado pelo novo.
 *     tags: [Auth - Rede]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clinicId]
 *             properties:
 *               clinicId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unidade trocada. O `user.clinicId` da resposta é a nova unidade ativa.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: clinicId não informado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Sem acesso a esta unidade
 */
router.post('/switch-clinic', switchClinicController)

export default router

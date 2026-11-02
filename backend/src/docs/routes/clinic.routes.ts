// backend/src/routes/clinic.routes.ts

import { Router } from 'express'
import {
  createClinicController,
  listClinicsController,
  getClinicByIdController,
  updateClinicController,
  deactivateClinicController,
  reactivateClinicController,
  getClinicCustomizationController,
  updateClinicCustomizationController,
} from '../../controllers/clinicController'
import {
  setClinicProcedureController,
  cloneClinicProceduresController,
  reconcileRecipesController,
  proceduresWithoutRecipeController,
} from '../../controllers/clinicCatalogController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'
import { ownClinicOrOwner } from '../../middlewares/clinicAcessMiddlewares'

const router = Router()

router.use(authenticate)

/**
 * @openapi
 * components:
 *   schemas:
 *     ClinicProcedureLink:
 *       type: object
 *       description: Ativação e preço de um procedimento da rede em uma unidade (plano Enterprise)
 *       properties:
 *         id: { type: string, format: uuid }
 *         clinicId: { type: string, format: uuid }
 *         procedureId: { type: string, format: uuid }
 *         isActive: { type: boolean }
 *         price: { type: number, nullable: true, description: "null = usa o preço base do procedimento" }
 */

// ─── White-Label & Customização Visual ───────────────────────────────────────

/**
 * @openapi
 * /clinics/{id}/customization:
 *   get:
 *     summary: Obtém os parâmetros de identidade visual da clínica (cores, logos e tipografia)
 *     tags: [Clinics - White-label]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Configurações visuais retornadas com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/customization', getClinicCustomizationController)

/**
 * @openapi
 * /clinics/{id}/customization:
 *   put:
 *     summary: Atualiza o tema, paleta de cores e identidade visual da clínica (ADMIN da unidade ou OWNER)
 *     description: No plano Enterprise, o ADMIN só altera a própria unidade; o OWNER altera qualquer uma.
 *     tags: [Clinics - White-label]
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
 *               clinicName: { type: string }
 *               primaryColor: { type: string, example: "#06b6d4" }
 *               accentColor: { type: string, example: "#0891b2" }
 *               secondaryColor: { type: string, example: "#0f172a" }
 *               fontFamily: { type: string, enum: [Inter, Roboto, Poppins, Montserrat] }
 *               darkModeDefault: { type: boolean }
 *               customLogoUrl: { type: string, format: uri }
 *               customFavicon: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Identidade visual da clínica atualizada com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/customization', authorize('ADMIN'), ownClinicOrOwner, updateClinicCustomizationController)

// ─── Catálogo por unidade (Enterprise) ───────────────────────────────────────

/**
 * @openapi
 * /clinics/{id}/procedures-without-recipe:
 *   get:
 *     summary: Procedimentos ativos na unidade que ainda NÃO têm ficha técnica (não baixam estoque)
 *     description: Use depois de importar os produtos da filial para conferir o que falta configurar. Plano Enterprise.
 *     tags: [Clinics - Catálogo da unidade]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de procedimentos sem receita na unidade
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   category: { type: string, nullable: true }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:id/procedures-without-recipe', authorize('ADMIN'), ownClinicOrOwner, proceduresWithoutRecipeController)

/**
 * @openapi
 * /clinics/{id}/procedures/clone:
 *   post:
 *     summary: Copia os procedimentos ativos de outra unidade para esta (ação do usuário)
 *     description: >
 *       `{id}` é a unidade **destino**. Só ativa na destino os procedimentos que ela ainda não tem (não sobrescreve ajustes já feitos).
 *       O procedimento da rede não é duplicado; a unidade nova nunca fica ligada à de origem. Plano Enterprise.
 *     tags: [Clinics - Catálogo da unidade]
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
 *             required: [fromClinicId]
 *             properties:
 *               fromClinicId: { type: string, format: uuid }
 *               copyPrices: { type: boolean, default: true, description: "Copia também o preço da unidade de origem (ponto de partida)" }
 *     responses:
 *       200:
 *         description: Resultado da cópia
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 copied: { type: integer, description: "Procedimentos ativados agora na unidade destino" }
 *                 alreadyPresent: { type: integer, description: "Já existiam na unidade destino (preservados)" }
 *       400:
 *         description: fromClinicId ausente ou igual à unidade destino
 *       403:
 *         description: Plano sem catálogo por unidade, ou sem permissão sobre a unidade
 *       404:
 *         description: Unidade não encontrada neste tenant
 */
router.post('/:id/procedures/clone', authorize('ADMIN'), ownClinicOrOwner, cloneClinicProceduresController)

/**
 * @openapi
 * /clinics/{id}/procedures/{procedureId}:
 *   patch:
 *     summary: Ativa/desativa um procedimento da rede nesta unidade e define o preço local
 *     tags: [Clinics - Catálogo da unidade]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: procedureId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive: { type: boolean }
 *               price: { type: number, nullable: true, description: "null volta a usar o preço base da rede" }
 *     responses:
 *       200:
 *         description: Vínculo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClinicProcedureLink'
 *       400:
 *         description: isActive não booleano ou preço inválido
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/procedures/:procedureId', authorize('ADMIN'), ownClinicOrOwner, setClinicProcedureController)

/**
 * @openapi
 * /clinics/{id}/recipes/reconcile:
 *   post:
 *     summary: Recria na unidade as fichas técnicas de outra unidade, casando os produtos pelo nome
 *     description: >
 *       `{id}` é a unidade **destino**. Rode depois de importar os produtos da filial (pode rodar várias vezes: só entra o que ainda não existia).
 *       O nome é comparado sem acento, caixa ou espaços extras; a quantidade da origem entra como ponto de partida para editar.
 *       Considera apenas procedimentos ativos na unidade destino. `pending` lista o que não achou produto equivalente. Plano Enterprise.
 *     tags: [Clinics - Catálogo da unidade]
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
 *             required: [fromClinicId]
 *             properties:
 *               fromClinicId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado da reconciliação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created: { type: integer }
 *                 pending:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       procedureId: { type: string, format: uuid }
 *                       productName: { type: string, example: "Pomada A" }
 *       400:
 *         description: fromClinicId ausente ou igual à unidade destino
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/recipes/reconcile', authorize('ADMIN'), ownClinicOrOwner, reconcileRecipesController)

// ─── Clínicas ────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /clinics:
 *   get:
 *     summary: Lista as clínicas do tenant (paginado)
 *     tags: [Clinics]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
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
 *         description: Lista paginada de clínicas
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
 *                       name: { type: string }
 *                       cnpj: { type: string }
 *                       phone: { type: string }
 *                       email: { type: string }
 *                       address: { type: string }
 *                       isActive: { type: boolean }
 *                       _count:
 *                         type: object
 *                         properties:
 *                           users: { type: integer }
 *                           patients: { type: integer }
 *                           appointments: { type: integer }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listClinicsController)

/**
 * @openapi
 * /clinics/{id}:
 *   get:
 *     summary: Busca uma clínica por ID
 *     tags: [Clinics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos da clínica
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getClinicByIdController)

/**
 * @openapi
 * /clinics:
 *   post:
 *     summary: Cria uma nova unidade (respeita o limite de clínicas do pacote contratado)
 *     description: >
 *       Planos Basic/Premium têm 1 clínica. No Enterprise o limite é o `maxClinics` contratado e **somente o OWNER** cria unidades.
 *       A unidade nasce vazia: sem produtos, sem procedimentos ativos e sem fichas técnicas. Use `/clinics/{id}/procedures/clone`
 *       e `/clinics/{id}/recipes/reconcile` para configurá-la.
 *     tags: [Clinics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: 'Sorriso Prime - Filial Norte' }
 *               cnpj: { type: string, example: '11222333000199' }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               logoUrl: { type: string }
 *               paymentIntegrationActive: { type: boolean }
 *     responses:
 *       201:
 *         description: Clínica criada com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Limite de clínicas do pacote atingido, assinatura inativa, ou (Enterprise) usuário não é OWNER
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', authorize('ADMIN'), createClinicController)

/**
 * @openapi
 * /clinics/{id}:
 *   put:
 *     summary: Atualiza os dados cadastrais de uma clínica (ADMIN da unidade ou OWNER)
 *     description: >
 *       Apenas os campos listados são aceitos; o restante do corpo é ignorado. Para ativar/desativar use `/deactivate` e `/reactivate`
 *       (enviar `isActive` diferente do atual retorna 400). No Enterprise o ADMIN só altera a própria unidade.
 *     tags: [Clinics]
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
 *               cnpj: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               logoUrl: { type: string }
 *               paymentIntegrationActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Clínica atualizada com sucesso
 *       400:
 *         description: Tentativa de alterar `isActive` por esta rota
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.put('/:id', authorize('ADMIN'), ownClinicOrOwner, updateClinicController)

/**
 * @openapi
 * /clinics/{id}/deactivate:
 *   patch:
 *     summary: Desativa uma clínica (no Enterprise, somente o OWNER)
 *     tags: [Clinics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Clínica desativada com sucesso
 *       400:
 *         description: Não é possível desativar a única clínica ativa do tenant
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/deactivate', authorize('ADMIN'), deactivateClinicController)

/**
 * @openapi
 * /clinics/{id}/reactivate:
 *   patch:
 *     summary: Reativa uma clínica desativada (respeita o limite do pacote; no Enterprise, somente o OWNER)
 *     tags: [Clinics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Clínica reativada com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Limite de clínicas do pacote atingido, ou usuário não é OWNER (Enterprise)
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/reactivate', authorize('ADMIN'), reactivateClinicController)

export default router

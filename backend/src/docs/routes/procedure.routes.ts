import { Router } from 'express'
import {
  createProcedureController,
  listProceduresController,
  getProcedureByIdController,
  updateProcedureController,
  deleteProcedureController,
  setProcedureProductsController,
  getProcedureProductsController,
} from '../../controllers/procedureController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const procedureRouter = Router()

// ─── Autenticação Global do Módulo ───────────────────────────────────────────
procedureRouter.use(authenticate)

/**
 * @openapi
 * components:
 *   schemas:
 *     ProcedureClinicView:
 *       type: object
 *       description: Procedimento na visão da unidade ativa
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         code: { type: string, nullable: true }
 *         category: { type: string }
 *         durationMin: { type: integer }
 *         basePrice: { type: number, description: "Preço base da rede" }
 *         effectivePrice: { type: number, description: "Preço praticado na unidade (preço da unidade, ou o base)" }
 *         clinicPrice: { type: number, nullable: true, description: "Preço próprio da unidade (Enterprise)" }
 *         isActiveInClinic: { type: boolean, description: "No Enterprise, se a unidade oferece o procedimento. Nos demais planos é sempre true" }
 *         procedureProducts:
 *           type: array
 *           description: Ficha técnica DESTA unidade
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               clinicId: { type: string, format: uuid }
 *               productId: { type: string, format: uuid }
 *               quantity: { type: number }
 *               unit: { type: string, enum: [UN, ML, MG, G, L, CX] }
 *               product: { type: object }
 */

/**
 * @openapi
 * /procedures:
 *   get:
 *     summary: Lista o catálogo de procedimentos da unidade ativa
 *     description: >
 *       O procedimento é da rede, mas a ficha técnica (`procedureProducts`), o preço efetivo e a ativação são **da unidade**.
 *       No plano Enterprise a lista traz apenas o que a unidade oferece; use `scope=catalog` para ver o catálogo inteiro da rede
 *       (tela de configuração/ativação).
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filtrar procedimentos pelo nome
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filtrar por especialidade/categoria (ex. Dentística / Estética)
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [clinic, catalog], default: clinic }
 *         description: Enterprise - `catalog` lista todo o catálogo da rede, inclusive o que a unidade não oferece
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de procedimentos com duração, precificação da unidade e insumos vinculados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ProcedureClinicView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
procedureRouter.get('/', listProceduresController)

/**
 * @openapi
 * /procedures/{id}:
 *   get:
 *     summary: Busca detalhes de um procedimento por ID (na visão da unidade ativa)
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados detalhados do procedimento, com preço efetivo e ficha técnica da unidade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcedureClinicView'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
procedureRouter.get('/:id', getProcedureByIdController)

/**
 * @openapi
 * /procedures/{id}/products:
 *   get:
 *     summary: Lista a Ficha Técnica (insumos do estoque) de um procedimento NA UNIDADE ativa
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de produtos/insumos associados
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
procedureRouter.get('/:id/products', getProcedureProductsController)

// ─── Rotas de Escrita (Apenas ADMIN) ──────────────────────────────────────────

/**
 * @openapi
 * /procedures:
 *   post:
 *     summary: Cadastra um novo procedimento no catálogo
 *     description: No Enterprise o procedimento nasce ativo **somente** na unidade que o cadastrou; as demais ativam por conta própria.
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, basePrice]
 *             properties:
 *               name: { type: string, example: "Restauração Resina Composta" }
 *               code: { type: string, example: "PROC-001" }
 *               basePrice: { type: number, example: 150.00 }
 *               durationMin: { type: integer, example: 30, description: "Duração na agenda em minutos" }
 *               category: { type: string, example: "Dentística / Estética" }
 *     responses:
 *       201:
 *         description: Procedimento cadastrado com sucesso
 *       409:
 *         description: Já existe um procedimento com este nome
 */
procedureRouter.post('/', authorize('ADMIN'), createProcedureController)

/**
 * @openapi
 * /procedures/{id}:
 *   put:
 *     summary: Atualiza um procedimento existente (aceita name, code, basePrice, durationMin e category)
 *     description: No Enterprise o catálogo é compartilhado pela rede, então somente o OWNER altera. A unidade ajusta preço e ativação em `/clinics/{id}/procedures/{procedureId}`.
 *     tags: [Procedures]
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
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               basePrice: { type: number }
 *               durationMin: { type: integer }
 *               category: { type: string }
 *     responses:
 *       200:
 *         description: Procedimento atualizado com sucesso
 *       403:
 *         description: Enterprise - somente o dono da rede (OWNER) altera o catálogo compartilhado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Já existe um procedimento com este nome
 */
procedureRouter.put('/:id', authorize('ADMIN'), updateProcedureController)

/**
 * @openapi
 * /procedures/{id}/products:
 *   post:
 *     summary: Configura a Ficha Técnica do procedimento NA UNIDADE ativa (associa insumos do estoque)
 *     description: >
 *       Define quais produtos, quantidades e unidades serão consumidos do estoque **da unidade** ao realizar este procedimento.
 *       Substitui a ficha da unidade (as fichas das outras unidades não são tocadas). Só aceita produtos da própria unidade
 *       (o banco também garante isso) e sem repetição.
 *     tags: [Procedures]
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
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: number, example: 0.5, description: "Quantidade gasta (aceita decimais)" }
 *                     unit: { type: string, enum: [UN, ML, MG, G, L, CX], example: "ML" }
 *     responses:
 *       200:
 *         description: Ficha técnica vinculada com sucesso
 *       400:
 *         description: Insumo de outra unidade ou repetido na lista
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
procedureRouter.post('/:id/products', authorize('ADMIN'), setProcedureProductsController)

/**
 * @openapi
 * /procedures/{id}:
 *   delete:
 *     summary: Deleta um procedimento do catálogo
 *     description: No Enterprise, somente o OWNER (o catálogo é da rede inteira).
 *     tags: [Procedures]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Procedimento removido com sucesso
 *       400:
 *         description: Procedimento vinculado a um plano de tratamento não pode ser excluído
 *       403:
 *         description: Enterprise - somente o dono da rede (OWNER) exclui procedimentos
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
procedureRouter.delete('/:id', authorize('ADMIN'), deleteProcedureController)

export default procedureRouter
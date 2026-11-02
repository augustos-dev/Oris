import { Router } from 'express'
import {
  createProductController,
  listProductController,
  adjustStockController,
  expringProductController,
  productByIdController,
  deleteProductController,
  lowStockController,
  updateProductController,
} from '../../controllers/productController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const productRouter = Router()

// ─── Autenticação Global do Módulo ───────────────────────────────────────────
productRouter.use(authenticate)

/**
 * @openapi
 * tags:
 *   name: Products
 *   description: >
 *     Gestão de estoque, insumos e rastreabilidade sanitária. **O estoque é por unidade:** cada clínica tem os próprios produtos
 *     (mesmo na rede Enterprise), e a baixa automática por procedimento consome só os produtos da unidade do atendimento.
 */

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Lista produtos do estoque com filtros e paginação
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Nome do produto para busca parcial
 *       - in: query
 *         name: lotNumber
 *         schema: { type: string }
 *         description: Filtra por número do lote
 *       - in: query
 *         name: unit
 *         schema: { type: string, enum: [UN, ML, MG, G, L, CX] }
 *         description: Filtra por unidade de medida
 *       - in: query
 *         name: supplierId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: lowStock
 *         schema: { type: boolean }
 *         description: Filtra apenas produtos com estoque crítico
 *       - in: query
 *         name: expiring
 *         schema: { type: boolean }
 *         description: Filtra apenas produtos vencendo em 30 dias
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de produtos com status de estoque, lote, preço de custo, fracionamento e unidade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
productRouter.get('/', listProductController)

/**
 * @openapi
 * /products/low-stock:
 *   get:
 *     summary: Lista produtos com estoque crítico (quantity <= minQuantity)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de produtos em estoque crítico
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
productRouter.get('/low-stock', lowStockController)

/**
 * @openapi
 * /products/expiring:
 *   get:
 *     summary: Lista produtos vencendo nos próximos 30 dias
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de produtos próximos do vencimento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
productRouter.get('/expiring', expringProductController)

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Busca um produto por ID (Com histórico de saídas do Exit Inteligente)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dados completos do produto (incluindo lote, preço de custo, unidades por embalagem, fornecedor e movimentações)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productRouter.get('/:id', productByIdController)

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Cria um novo produto no estoque com rastreabilidade de lote e conversão de embalagem
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, quantity, minQuantity]
 *             properties:
 *               name: { type: string, example: "Caixa de Luvas Azul" }
 *               quantity: { type: number, example: 10 }
 *               minQuantity: { type: number, example: 2 }
 *               unit: { type: string, enum: [UN, ML, MG, G, L, CX], example: "CX" }
 *               costPrice: { type: number, example: 22.00, description: "Preço de custo/compra da embalagem ou unidade" }
 *               itemsPerPackage: { type: integer, example: 100, description: "Quantidade de unidades/conteúdo dentro da embalagem para cálculo de fracionamento" }
 *               supplierId: { type: string, format: uuid }
 *               lotNumber: { type: string, example: "LT-8842" }
 *               manufacturingDate: { type: string, format: date-time }
 *               expiryDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Produto criado com sucesso e registrado no AuditLog
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Fornecedor informado não encontrado
 */
productRouter.post('/', authorize('ADMIN', 'SECRETARY'), createProductController)

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     summary: Atualiza os dados de um produto (Lote, Validade, Custo, Rendimento, Qtds, Observações)
 *     description: >
 *       Apenas os campos listados abaixo são aceitos; o restante do corpo é ignorado (tenantId, clinicId e id nunca mudam).
 *       Alterar `quantity` por aqui **não gera movimentação** no histórico: para entradas e saídas use `PATCH /products/{id}/stock`.
 *     tags: [Products]
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
 *               quantity: { type: number }
 *               minQuantity: { type: number }
 *               unit: { type: string, enum: [UN, ML, MG, G, L, CX] }
 *               costPrice: { type: number }
 *               itemsPerPackage: { type: integer, description: "Unidades por caixa ou conteúdo total da embalagem" }
 *               supplierId: { type: string, format: uuid }
 *               lotNumber: { type: string }
 *               manufacturingDate: { type: string, format: date-time }
 *               expiryDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Produto ou fornecedor informado não encontrado nesta unidade
 */
productRouter.put('/:id', authorize('ADMIN', 'SECRETARY'), updateProductController)

/**
 * @openapi
 * /products/{id}/stock:
 *   patch:
 *     summary: Ajusta o estoque de um produto e registra histórico em StockMovement
 *     description: Registra `ENTRY` (delta positivo) ou `EXIT_MANUAL` (delta negativo) com a quantidade em valor absoluto.
 *     tags: [Products]
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
 *             required: [quantity, reason]
 *             properties:
 *               quantity: { type: number, example: -2, description: "Delta de alteração (positivo para entrada, negativo para saída)" }
 *               reason: { type: string, example: "Uso clínico no atendimento" }
 *     responses:
 *       200:
 *         description: Estoque ajustado com sucesso
 *       400:
 *         description: Estoque insuficiente para a saída solicitada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productRouter.patch('/:id/stock', authorize('ADMIN', 'SECRETARY', 'DENTIST'), adjustStockController)

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     summary: Remove um produto (Apenas ADMIN, exige estoque zerado)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Produto removido com sucesso
 *       400:
 *         description: Produto com estoque acima de zero não pode ser removido
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
productRouter.delete('/:id', authorize('ADMIN'), deleteProductController)

export default productRouter